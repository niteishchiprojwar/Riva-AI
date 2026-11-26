import type {
  ChatFolder,
  ChatMessage,
  ChatModeId,
  Conversation,
  DateGroup,
  GroundingSource,
  LanguageMode,
} from '../types/chat.ts';

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_PDF_MIME_TYPE = 'application/pdf';

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_PDF_MIME_TYPE,
]);

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function deriveConversationTitle(rawText: string): string {
  const cleaned = rawText.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'New chat';
  }
  if (cleaned.length <= 42) {
    return cleaned;
  }
  const sliced = cleaned.slice(0, 42);
  const lastSpace = sliced.lastIndexOf(' ');
  const base = lastSpace > 20 ? sliced.slice(0, lastSpace) : sliced;
  return `${base}...`;
}

export function groupConversationsByDate(
  conversations: Conversation[],
  nowMs: number = Date.now()
): DateGroup[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const nowDate = new Date(nowMs);
  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfLast7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const previous7Days: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of sorted) {
    if (conv.updatedAt >= startOfToday) {
      today.push(conv);
    } else if (conv.updatedAt >= startOfYesterday) {
      yesterday.push(conv);
    } else if (conv.updatedAt >= startOfLast7Days) {
      previous7Days.push(conv);
    } else {
      older.push(conv);
    }
  }

  const groups: DateGroup[] = [];
  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
  if (previous7Days.length > 0)
    groups.push({ label: 'Previous 7 Days', items: previous7Days });
  if (older.length > 0) groups.push({ label: 'Older', items: older });

  return groups;
}

export function filterConversations(
  conversations: Conversation[],
  query: string,
  folderFilter?: string | null
): Conversation[] {
  let pool = conversations;

  if (folderFilter === 'uncategorized') {
    pool = pool.filter((conv) => !conv.folderId);
  } else if (folderFilter && folderFilter !== 'all') {
    pool = pool.filter((conv) => conv.folderId === folderFilter);
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return pool;
  }
  return pool.filter((conv) => {
    if (conv.title.toLowerCase().includes(normalized)) {
      return true;
    }
    return conv.messages.some((msg) =>
      msg.content.toLowerCase().includes(normalized)
    );
  });
}

export interface FolderChatCounts {
  all: number;
  uncategorized: number;
  byFolder: Record<string, number>;
}

export function getFolderChatCounts(
  conversations: Conversation[],
  folders: ChatFolder[]
): FolderChatCounts {
  const validIds = new Set(folders.map((f) => f.id));
  const byFolder: Record<string, number> = {};
  for (const folder of folders) {
    byFolder[folder.id] = 0;
  }

  let uncategorized = 0;
  for (const conv of conversations) {
    if (conv.folderId && validIds.has(conv.folderId)) {
      byFolder[conv.folderId] = (byFolder[conv.folderId] ?? 0) + 1;
    } else {
      uncategorized++;
    }
  }

  return {
    all: conversations.length,
    uncategorized,
    byFolder,
  };
}

export function unassignFolderFromConversations(
  conversations: Conversation[],
  folderId: string
): Conversation[] {
  return conversations.map((conv) =>
    conv.folderId === folderId ? { ...conv, folderId: null } : conv
  );
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export function formatModelContents(messages: ChatMessage[]): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const msg of messages) {
    if (msg.isError) continue;
    const parts: GeminiPart[] = [];

    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        if (att.dataBase64 && ALLOWED_ATTACHMENT_MIME_TYPES.has(att.mimeType)) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64,
            },
          });
        }
      }
    }

    if (msg.content.trim().length > 0) {
      parts.push({ text: msg.content });
    } else if (parts.length > 0 && msg.role === 'user') {
      parts.push({
        text: 'Please analyze the attached file(s) and summarize the key insights.',
      });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  return contents;
}

export interface RawGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export function extractGroundingSources(
  chunks: RawGroundingChunk[] | undefined
): GroundingSource[] {
  if (!chunks || !Array.isArray(chunks)) {
    return [];
  }
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    if (!uri) continue;
    if (!uri.startsWith('https://') && !uri.startsWith('http://')) continue;
    if (seen.has(uri)) continue;
    seen.add(uri);

    let title = chunk.web?.title?.trim() || '';
    if (!title) {
      try {
        title = new URL(uri).hostname.replace(/^www\./, '');
      } catch {
        title = uri;
      }
    }
    sources.push({ title, uri });
  }

  return sources;
}

export function buildLanguageSystemInstruction(
  languageMode: LanguageMode,
  customInstructions?: string
): string {
  const basePrompt =
    'You are Riva AI, a warm, intelligent, and helpful AI assistant. Format responses cleanly with Markdown (headings, bullet lists, tables, and fenced code blocks with language tags when writing code). Analyze any attached images or PDF documents accurately and thoroughly.';

  let languageDirective =
    'Respond naturally in the same language and script the user uses (English, Hindi in Devanagari, Marathi in Devanagari, or Hinglish in Latin script).';
  if (languageMode === 'english') {
    languageDirective = 'Always respond in clear, natural English.';
  } else if (languageMode === 'hindi') {
    languageDirective =
      'Always respond in natural, easy-to-read Hindi (Devanagari script), keeping technical/code terms clear.';
  } else if (languageMode === 'marathi') {
    languageDirective =
      'Always respond in natural, easy-to-read Marathi (Devanagari script), keeping technical/code terms clear.';
  } else if (languageMode === 'hinglish') {
    languageDirective =
      'Always respond in friendly, natural conversational Hinglish (Hindi words written in Roman/Latin script mixed naturally with English).';
  }

  const trimmedCustom = customInstructions?.trim();
  return trimmedCustom
    ? `${basePrompt}\n\nLanguage preference: ${languageDirective}\n\nUser custom instructions:\n${trimmedCustom}`
    : `${basePrompt}\n\nLanguage preference: ${languageDirective}`;
}

export interface ValidatedChatRequest {
  modeId: ChatModeId;
  languageMode: LanguageMode;
  useWebSearch: boolean;
  systemInstruction?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    attachments?: Array<{
      mimeType: string;
      dataBase64: string;
    }>;
  }>;
}

export function validateChatRequest(
  body: unknown
): { ok: true; data: ValidatedChatRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const record = body as Record<string, unknown>;
  const rawMode = record.modeId;
  const modeId: ChatModeId =
    rawMode === 'balanced' || rawMode === 'fast' || rawMode === 'lite'
      ? rawMode
      : 'balanced';

  const rawLang = record.languageMode;
  const languageMode: LanguageMode =
    rawLang === 'english' ||
    rawLang === 'hindi' ||
    rawLang === 'marathi' ||
    rawLang === 'hinglish' ||
    rawLang === 'auto'
      ? rawLang
      : 'auto';

  const useWebSearch = Boolean(record.useWebSearch);
  const systemInstruction =
    typeof record.systemInstruction === 'string' &&
    record.systemInstruction.trim().length > 0
      ? record.systemInstruction.trim().slice(0, 4000)
      : undefined;

  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    return { ok: false, error: 'At least one message is required.' };
  }

  const sanitizedMessages: ValidatedChatRequest['messages'] = [];
  for (const item of record.messages) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Invalid message format.' };
    }
    const m = item as Record<string, unknown>;
    const role =
      m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    if (!role) {
      return { ok: false, error: 'Message role must be user or assistant.' };
    }
    const content = typeof m.content === 'string' ? m.content : '';
    const attachments: Array<{ mimeType: string; dataBase64: string }> = [];

    if (Array.isArray(m.attachments)) {
      for (const rawAtt of m.attachments) {
        if (!rawAtt || typeof rawAtt !== 'object') continue;
        const att = rawAtt as Record<string, unknown>;
        if (
          typeof att.mimeType === 'string' &&
          ALLOWED_ATTACHMENT_MIME_TYPES.has(att.mimeType) &&
          typeof att.dataBase64 === 'string' &&
          att.dataBase64.length > 0
        ) {
          attachments.push({
            mimeType: att.mimeType,
            dataBase64: att.dataBase64,
          });
        }
      }
    }

    if (content.trim().length === 0 && attachments.length === 0) {
      continue;
    }

    sanitizedMessages.push({
      role,
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  if (sanitizedMessages.length === 0) {
    return { ok: false, error: 'Message content cannot be empty.' };
  }

  const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return { ok: false, error: 'The final message must come from the user.' };
  }

  return {
    ok: true,
    data: {
      modeId,
      languageMode,
      useWebSearch,
      systemInstruction,
      messages: sanitizedMessages,
    },
  };
}

export function extractReadableErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Failed to generate response.';

  if (trimmed.includes('GEMINI_API_KEY is not configured')) {
    return trimmed;
  }
  if (
    trimmed.includes('API_KEY_INVALID') ||
    trimmed.includes('PERMISSION_DENIED')
  ) {
    return 'API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }
  if (
    trimmed.includes('RESOURCE_EXHAUSTED') ||
    trimmed.includes('"code": 429') ||
    trimmed.includes('"code":429')
  ) {
    return 'Rate limit reached. Please wait a moment and try again.';
  }
  if (
    trimmed.includes('UNAVAILABLE') ||
    trimmed.includes('"code": 503') ||
    trimmed.includes('"code":503')
  ) {
    return 'The AI model is temporarily experiencing high demand. Please try again in a moment.';
  }

  try {
    const parsed = JSON.parse(trimmed) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return extractReadableErrorMessage(parsed.error.message);
    }
  } catch {
    // Not JSON; return as-is
  }

  return trimmed;
}

const MAX_TTS_CHARACTERS = 4000;

export function stripMarkdownForSpeech(markdown: string): string {
  if (!markdown) return '';

  let text = markdown
    // Replace fenced code blocks with a brief spoken cue
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
    // Replace inline code with inner text
    .replace(/`([^`]+)`/g, '$1')
    // Replace markdown images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Replace markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip markdown heading markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    // Strip blockquote markers
    .replace(/^\s{0,3}>\s?/gm, '')
    // Strip bullet/numbered list prefixes
    .replace(/^\s{0,4}(?:[-*+]|\d+\.)\s+/gm, '')
    // Strip horizontal rules and table separator rows
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*$/gm, ' ')
    // Turn table pipes into pauses
    .replace(/\|/g, ', ')
    // Strip bold/italic/strikethrough markers
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > MAX_TTS_CHARACTERS) {
    const sliced = text.slice(0, MAX_TTS_CHARACTERS);
    const lastBoundary = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('। '),
      sliced.lastIndexOf('! '),
      sliced.lastIndexOf('? '),
      sliced.lastIndexOf(' ')
    );
    text = (lastBoundary > 200 ? sliced.slice(0, lastBoundary + 1) : sliced).trim();
  }

  return text;
}

export interface ValidatedTtsRequest {
  text: string;
  languageMode: LanguageMode;
}

export function validateTtsRequest(
  body: unknown
): { ok: true; data: ValidatedTtsRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  const record = body as Record<string, unknown>;
  const rawText = typeof record.text === 'string' ? record.text : '';
  const spokenText = stripMarkdownForSpeech(rawText);

  if (!spokenText) {
    return { ok: false, error: 'No speakable text provided.' };
  }

  const rawLang = record.languageMode;
  const languageMode: LanguageMode =
    rawLang === 'english' ||
    rawLang === 'hindi' ||
    rawLang === 'marathi' ||
    rawLang === 'hinglish' ||
    rawLang === 'auto'
      ? rawLang
      : 'auto';

  return {
    ok: true,
    data: {
      text: spokenText,
      languageMode,
    },
  };
}

export type PdfContentBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'code'; language?: string; text: string };

export interface PdfExportMessage {
  role: 'user' | 'assistant';
  roleLabel: string;
  timestampLabel: string;
  attachments: string[];
  blocks: PdfContentBlock[];
  sources: Array<{ title: string; uri: string }>;
  isError?: boolean;
}

export interface PdfExportDocument {
  title: string;
  modeLabel: string;
  exportedAtLabel: string;
  filename: string;
  messages: PdfExportMessage[];
}

export function sanitizePdfFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  const slug = cleaned.slice(0, 64).replace(/-$/g, '');
  return `${slug || 'riva-ai-chat'}.pdf`;
}

function cleanInlineMarkdownForPdf(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    .trim();
}

export function parseMarkdownBlocksForPdf(markdown: string): PdfContentBlock[] {
  if (!markdown || !markdown.trim()) return [];

  const blocks: PdfContentBlock[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*```([a-zA-Z0-9_-]*)\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({
        kind: 'code',
        language,
        text: codeLines.join('\n'),
      });
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const headingText = cleanInlineMarkdownForPdf(headingMatch[1]);
      if (headingText) {
        blocks.push({ kind: 'heading', text: headingText });
      }
      i++;
      continue;
    }

    const bulletMatch = trimmed.match(/^(?:[-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const bulletText = cleanInlineMarkdownForPdf(bulletMatch[1]);
      if (bulletText) {
        blocks.push({ kind: 'bullet', text: bulletText });
      }
      i++;
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/);
    const paraText = cleanInlineMarkdownForPdf(
      quoteMatch ? quoteMatch[1] : trimmed
    );
    if (paraText) {
      blocks.push({ kind: 'paragraph', text: paraText });
    }
    i++;
  }

  return blocks;
}

export function buildPdfExportData(
  conversation: Conversation,
  modeLabel: string,
  nowMs: number = Date.now()
): PdfExportDocument {
  const title = conversation.title.trim() || 'Riva AI Conversation';
  const exportedAtLabel = new Date(nowMs).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const messages: PdfExportMessage[] = conversation.messages
    .filter(
      (msg) =>
        msg.content.trim().length > 0 ||
        (msg.attachments && msg.attachments.length > 0)
    )
    .map((msg) => {
      const timestampLabel = new Date(msg.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      const attachments = (msg.attachments ?? []).map((att) =>
        att.kind === 'pdf'
          ? `PDF: ${att.name} (${formatFileSize(att.sizeBytes)})`
          : `Image: ${att.name}`
      );
      const blocks =
        msg.role === 'user'
          ? msg.content
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
              .map((text): PdfContentBlock => ({ kind: 'paragraph', text }))
          : parseMarkdownBlocksForPdf(msg.content);

      return {
        role: msg.role,
        roleLabel: msg.role === 'user' ? 'You' : 'Riva AI',
        timestampLabel,
        attachments,
        blocks,
        sources: (msg.sources ?? []).map((s) => ({ title: s.title, uri: s.uri })),
        isError: msg.isError,
      };
    });

  return {
    title,
    modeLabel,
    exportedAtLabel,
    filename: sanitizePdfFilename(title),
    messages,
  };
}


