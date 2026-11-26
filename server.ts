import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { CHAT_MODES } from './src/types/chat.ts';
import {
  buildLanguageSystemInstruction,
  deriveConversationTitle,
  extractGroundingSources,
  extractReadableErrorMessage,
  formatModelContents,
  validateChatRequest,
  validateTtsRequest,
  type RawGroundingChunk,
} from './src/utils/chatUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  if (err instanceof Error) {
    const readable = extractReadableErrorMessage(err.message || '');
    if (readable.includes('GEMINI_API_KEY')) {
      return { status: 500, message: readable };
    }
    if (readable.includes('unauthorized')) {
      return { status: 403, message: readable };
    }
    if (readable.includes('Rate limit')) {
      return { status: 429, message: readable };
    }
    return { status: 500, message: readable };
  }
  return { status: 500, message: 'Failed to generate response.' };
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED')
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const validation = validateChatRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { modeId, languageMode, useWebSearch, systemInstruction, messages } =
      validation.data;
    const mode = CHAT_MODES.find((m) => m.id === modeId) ?? CHAT_MODES[0];

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    const writeEvent = (payload: Record<string, unknown>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const ai = createGeminiClient();
      const contents = formatModelContents(
        messages.map((m, idx) => ({
          id: String(idx),
          role: m.role,
          content: m.content,
          createdAt: Date.now(),
          attachments: m.attachments?.map((a, aIdx) => ({
            id: `${idx}-${aIdx}`,
            kind: a.mimeType === 'application/pdf' ? 'pdf' : 'image',
            name: a.mimeType === 'application/pdf' ? `doc-${aIdx}.pdf` : `image-${aIdx}`,
            mimeType: a.mimeType,
            sizeBytes: Math.round((a.dataBase64.length * 3) / 4),
            dataBase64: a.dataBase64,
          })),
        }))
      );

      const combinedSystemInstruction = buildLanguageSystemInstruction(
        languageMode,
        systemInstruction
      );

      const config: Record<string, unknown> = {
        systemInstruction: combinedSystemInstruction,
      };

      if (mode.apiModel === 'gemini-4-hydrogen' && mode.thinkingLevel === 'LOW') {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.LOW,
        };
      }

      if (useWebSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      let stream: Awaited<ReturnType<typeof ai.models.generateContentStream>> | null =
        null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          stream = await ai.models.generateContentStream({
            model: mode.apiModel,
            contents,
            config,
          });
          break;
        } catch (err) {
          if (attempt < 2 && isTransientError(err) && !clientClosed) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
      if (!stream) {
        throw new Error('Failed to start stream.');
      }

      const collectedChunks: RawGroundingChunk[] = [];

      for await (const chunk of stream) {
        if (clientClosed) break;

        const text = chunk.text;
        if (text) {
          writeEvent({ type: 'delta', text });
        }

        const rawChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as
          | RawGroundingChunk[]
          | undefined;
        if (rawChunks && rawChunks.length > 0) {
          collectedChunks.push(...rawChunks);
        }
      }

      if (!clientClosed) {
        const sources = extractGroundingSources(collectedChunks);
        if (sources.length > 0) {
          writeEvent({ type: 'sources', sources });
        }
        writeEvent({ type: 'done' });
      }
    } catch (err) {
      const formatted = formatApiError(err);
      if (!clientClosed) {
        writeEvent({ type: 'error', message: formatted.message });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  app.post('/api/chat/title', async (req: Request, res: Response) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const fallback = deriveConversationTitle(prompt);

    try {
      const ai = createGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Generate a concise 3 to 5 word title (no quotes, no trailing punctuation, same language as user) for a conversation starting with:\n\n${prompt.slice(0, 500)}`,
      });
      const generated = (response.text ?? '').replace(/["'`]/g, '').trim();
      res.json({ title: generated || fallback });
    } catch {
      res.json({ title: fallback });
    }
  });

  app.post('/api/tts', async (req: Request, res: Response) => {
    const validation = validateTtsRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { text, languageMode } = validation.data;
    const styleByLanguage: Record<string, string> = {
      english: 'Warm, clear, natural English assistant',
      hindi: 'Warm, clear, natural Hindi assistant',
      marathi: 'Warm, clear, natural Marathi assistant',
      hinglish: 'Warm, friendly bilingual Hindi and English assistant',
      auto: 'Warm, clear, natural conversational assistant',
    };
    const style = styleByLanguage[languageMode] ?? styleByLanguage.auto;

    try {
      const ai = createGeminiClient('v1beta');
      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null =
        null;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text,
                    speechMetadata: { style },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
          });
          break;
        } catch (err) {
          if (attempt < 2 && isTransientError(err)) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }

      const part = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!part?.data) {
        res.status(502).json({ error: 'No audio data returned by speech service.' });
        return;
      }

      res.json({
        audioBase64: part.data,
        mimeType: part.mimeType || 'audio/wav',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Riva AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
