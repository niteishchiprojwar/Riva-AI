import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Pencil,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react';
import type { ChatMessage, LanguageMode } from '../types/chat';
import { formatFileSize, stripMarkdownForSpeech } from '../utils/chatUtils';
import { BrandMark } from './BrandMark';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  languageMode: LanguageMode;
  onRegenerate: (assistantMessageId: string) => void;
  onEditUserMessage: (messageId: string, newContent: string) => void;
  onError: (message: string | null) => void;
}

export function MessageList({
  messages,
  isStreaming,
  languageMode,
  onRegenerate,
  onEditUserMessage,
  onError,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevFirstIdRef = useRef<string | undefined>(messages[0]?.id);
  const prevCountRef = useRef<number>(messages.length);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const stopSpeech = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setTtsLoadingId(null);
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    const cache = ttsCacheRef.current;
    return () => {
      stopSpeech();
      for (const objectUrl of cache.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      cache.clear();
    };
  }, [stopSpeech]);

  useEffect(() => {
    if (isStreaming) {
      stopSpeech();
    }
  }, [isStreaming, stopSpeech]);

  useEffect(() => {
    const firstId = messages[0]?.id;
    const switchedThread = firstId !== prevFirstIdRef.current;
    const appendedMessage = messages.length > prevCountRef.current;

    prevFirstIdRef.current = firstId;
    prevCountRef.current = messages.length;

    if (switchedThread) {
      stopSpeech();
    }

    if (switchedThread && !isStreaming) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (isStreaming || appendedMessage) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isStreaming, stopSpeech]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  const playAudioUrl = async (msgId: string, url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingId(null);
      }
    };
    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingId(null);
        onError('Unable to play the generated audio in this browser.');
      }
    };

    setSpeakingId(msgId);
    try {
      await audio.play();
    } catch (err) {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingId(null);
        if ((err as Error).name !== 'AbortError') {
          onError('Audio playback was blocked or unavailable.');
        }
      }
    }
  };

  const handleToggleSpeech = async (msg: ChatMessage) => {
    if (speakingId === msg.id || ttsLoadingId === msg.id) {
      stopSpeech();
      return;
    }

    stopSpeech();
    onError(null);

    if (!stripMarkdownForSpeech(msg.content)) {
      onError('No readable text found in this response.');
      return;
    }

    const cacheKey = `${msg.id}:${msg.content.length}`;
    const cachedUrl = ttsCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      await playAudioUrl(msg.id, cachedUrl);
      return;
    }

    const controller = new AbortController();
    ttsAbortRef.current = controller;
    setTtsLoadingId(msg.id);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          text: msg.content,
          languageMode,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!response.ok || !payload.audioBase64) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : `Speech generation failed (${response.status})`
        );
      }

      if (controller.signal.aborted) {
        return;
      }

      const binary = atob(payload.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: payload.mimeType || 'audio/wav',
      });
      const objectUrl = URL.createObjectURL(blob);
      ttsCacheRef.current.set(cacheKey, objectUrl);

      setTtsLoadingId(null);
      await playAudioUrl(msg.id, objectUrl);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      setTtsLoadingId(null);
      setSpeakingId(null);
      onError(
        err instanceof Error
          ? err.message
          : 'Failed to generate speech for this response.'
      );
    } finally {
      if (ttsAbortRef.current === controller) {
        ttsAbortRef.current = null;
      }
    }
  };

  const beginEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditDraft(msg.content);
  };

  const submitEdit = (id: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setEditingMessageId(null);
    onEditUserMessage(id, trimmed);
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-5"
    >
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const isMsgStreaming =
            isStreaming && isLast && msg.role === 'assistant';

          if (msg.role === 'user') {
            const isEditing = editingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className="group flex flex-col items-end"
                data-testid="user-message"
              >
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 justify-end max-w-[85%]">
                    {msg.attachments.map((att) =>
                      att.kind === 'image' ? (
                        <img
                          key={att.id}
                          src={
                            att.previewUrl ||
                            `data:${att.mimeType};base64,${att.dataBase64}`
                          }
                          alt={att.name}
                          referrerPolicy="no-referrer"
                          className="max-h-52 max-w-[220px] rounded-2xl border border-violet-200 dark:border-violet-800 object-cover shadow-xs"
                        />
                      ) : (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#231e36] border border-violet-200 dark:border-violet-800/70 text-xs text-slate-800 dark:text-slate-100 shadow-xs"
                        >
                          <FileText className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[160px]">
                              {att.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              PDF · {formatFileSize(att.sizeBytes)}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {isEditing ? (
                  <div className="w-full max-w-xl rounded-2xl border border-violet-300 dark:border-violet-700 bg-white dark:bg-[#1e1a2e] p-3 shadow-sm">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      aria-label="Edit your message"
                      className="w-full resize-none bg-transparent text-[15px] text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMessageId(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => submitEdit(msg.id)}
                        disabled={!editDraft.trim()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 text-white hover:opacity-95 disabled:opacity-50"
                      >
                        Save &amp; Send
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {msg.content && (
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-gradient-to-br from-violet-600 via-blue-600 to-pink-500 px-4 py-3 text-[15px] leading-relaxed text-white shadow-sm shadow-violet-600/15 whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    )}
                    {!isStreaming && (
                      <div className="mt-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          aria-label="Copy prompt"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-violet-600 dark:text-pink-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEdit(msg)}
                          aria-label="Edit prompt"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className="group flex items-start gap-2.5 sm:gap-3.5"
              data-testid="assistant-message"
            >
              <div className="mt-1 shrink-0">
                <BrandMark className="w-7 h-7" />
              </div>

              <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[88%]">
                <div className="rounded-2xl rounded-tl-sm bg-white/95 dark:bg-[#1e1a2e]/95 border border-violet-200/80 dark:border-violet-800/50 px-4 py-3 shadow-xs">
                  {msg.usedWebSearch && (
                    <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                      <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Web Search Grounded</span>
                    </div>
                  )}

                  {msg.isError ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-sm text-rose-800 dark:text-rose-200"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{msg.content}</span>
                    </div>
                  ) : msg.content.length === 0 && isMsgStreaming ? (
                    <div
                      className="py-1 text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2.5"
                      aria-live="polite"
                    >
                      <span>Riva is thinking</span>
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-600 riva-dot-1" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 riva-dot-2" />
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 riva-dot-3" />
                      </span>
                    </div>
                  ) : (
                    <MarkdownRenderer
                      content={msg.content}
                      isStreaming={isMsgStreaming}
                    />
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-violet-100 dark:border-violet-800/50">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        Sources
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src) => (
                          <a
                            key={src.uri}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/40 text-xs text-slate-700 dark:text-slate-200 hover:border-pink-400 transition-colors max-w-[220px]"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {!isMsgStreaming && (
                  <div
                    className={`mt-1.5 flex items-center gap-1 transition-opacity ${
                      isLast ||
                      ttsLoadingId === msg.id ||
                      speakingId === msg.id
                        ? 'opacity-90'
                        : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100'
                    }`}
                  >
                    {!msg.isError && msg.content && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          aria-label="Copy response"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-violet-600 dark:text-pink-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSpeech(msg)}
                          aria-label={
                            ttsLoadingId === msg.id
                              ? 'Cancel speech generation'
                              : speakingId === msg.id
                                ? 'Stop reading aloud'
                                : 'Listen to response'
                          }
                          aria-pressed={speakingId === msg.id}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                            speakingId === msg.id || ttsLoadingId === msg.id
                              ? 'text-violet-700 dark:text-pink-300 bg-violet-100/80 dark:bg-violet-900/50 font-medium'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
                          }`}
                        >
                          {ttsLoadingId === msg.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 dark:text-pink-400" />
                              <span>Loading...</span>
                            </>
                          ) : speakingId === msg.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onRegenerate(msg.id)}
                      aria-label="Regenerate response"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
