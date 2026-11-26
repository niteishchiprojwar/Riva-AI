import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  ArrowUp,
  FileText,
  FileUp,
  Globe,
  ImagePlus,
  Mic,
  MicOff,
  Square,
  X,
} from 'lucide-react';
import type { FileAttachment, LanguageMode } from '../types/chat';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_PDF_MIME_TYPE,
  formatFileSize,
} from '../utils/chatUtils';
import { getLocalizedStrings } from '../utils/i18n';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  attachments: FileAttachment[];
  onAddAttachment: (attachment: FileAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  useWebSearch: boolean;
  onToggleWebSearch: () => void;
  languageMode: LanguageMode;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onError: (message: string) => void;
}

export function Composer({
  value,
  onChange,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  useWebSearch,
  onToggleWebSearch,
  languageMode,
  isStreaming,
  onSend,
  onStop,
  onError,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [isListening, setIsListening] = useState(false);

  const strings = getLocalizedStrings(languageMode);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && (value.trim().length > 0 || attachments.length > 0)) {
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }
        onSend();
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  };

  const readFileAsAttachment = (file: File, expectedKind: 'image' | 'pdf') => {
    if (expectedKind === 'image' && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      onError('Please choose a valid PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (expectedKind === 'pdf' && file.type !== ALLOWED_PDF_MIME_TYPE) {
      onError('Please select a valid PDF document (.pdf).');
      return;
    }

    const maxBytes = expectedKind === 'pdf' ? 12 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      onError(
        expectedKind === 'pdf'
          ? 'PDF must be smaller than 12 MB.'
          : 'Image must be smaller than 8 MB.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) return;
      const dataBase64 = result.slice(commaIdx + 1);
      onAddAttachment({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: expectedKind,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataBase64,
        previewUrl: expectedKind === 'image' ? result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => readFileAsAttachment(f, 'image'));
    e.target.value = '';
  };

  const handlePdfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => readFileAsAttachment(f, 'pdf'));
    e.target.value = '';
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechCtor = getSpeechRecognition();
    if (!SpeechCtor) {
      onError(
        'Voice input is not supported in this browser. Try Chrome, Edge, or Safari, or type your message.'
      );
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = strings.speechLangCode;
      recognition.interimResults = true;
      recognition.continuous = false;

      const basePrefix = value.trim() ? `${value.trim()} ` : '';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript ?? '';
        }
        onChange(`${basePrefix}${transcript}`.trimStart());
        adjustHeight();
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          onError('Microphone permission was denied. Allow mic access to use voice input.');
        } else if (event.error !== 'aborted') {
          onError('Could not capture voice input. Please try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      onError('Unable to start microphone voice input.');
    }
  };

  const canSend =
    !isStreaming && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div className="shrink-0 px-3 sm:px-4 pb-3 pt-1 bg-gradient-to-t from-[#faf8ff] via-[#faf8ff]/95 to-transparent dark:from-[#13111c] dark:via-[#13111c]/95">
      <div className="max-w-3xl mx-auto">
        {isListening && (
          <div
            role="status"
            className="mb-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600/15 via-blue-600/15 to-pink-500/15 border border-violet-300 dark:border-violet-700 text-xs font-medium text-violet-900 dark:text-pink-200 flex items-center justify-between"
          >
            <span>{strings.listening}</span>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className="underline font-semibold"
            >
              Stop
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-violet-200 dark:border-violet-800/70 bg-white dark:bg-[#1d192c] shadow-sm focus-within:border-violet-500 dark:focus-within:border-pink-400/70 transition-colors">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3.5 pt-3">
              {attachments.map((att) =>
                att.kind === 'image' ? (
                  <div
                    key={att.id}
                    className="relative rounded-xl overflow-hidden border border-violet-200 dark:border-violet-700"
                  >
                    <img
                      src={att.previewUrl}
                      alt={att.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      aria-label={`Remove ${att.name}`}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white inline-flex items-center justify-center hover:bg-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-xs text-slate-800 dark:text-slate-100"
                  >
                    <FileText className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate max-w-[140px]">
                        {att.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatFileSize(att.sizeBytes)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      aria-label={`Remove ${att.name}`}
                      className="p-1 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          <div className="px-3.5 pt-3 pb-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={strings.inputPlaceholder}
              aria-label="Message input"
              className="w-full max-h-[160px] resize-none bg-transparent text-[15px] leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <div className="px-2 pb-2 pt-1 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                onChange={handleImageChange}
                className="hidden"
                aria-label="Upload image file"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                aria-label="Upload image"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <ImagePlus className="w-[18px] h-[18px] text-violet-600 dark:text-violet-400" />
              </button>

              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handlePdfChange}
                className="hidden"
                aria-label="Upload PDF file"
              />
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                aria-label="Upload PDF"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <FileUp className="w-[18px] h-[18px] text-pink-600 dark:text-pink-400" />
              </button>

              <button
                type="button"
                onClick={toggleVoiceInput}
                aria-pressed={isListening}
                aria-label={isListening ? 'Stop voice input' : 'Voice input'}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  isListening
                    ? 'bg-pink-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-[18px] h-[18px]" />
                ) : (
                  <Mic className="w-[18px] h-[18px] text-blue-600 dark:text-blue-400" />
                )}
              </button>

              <button
                type="button"
                onClick={onToggleWebSearch}
                aria-pressed={useWebSearch}
                aria-label={
                  useWebSearch ? 'Disable web search' : 'Enable web search'
                }
                className={`min-h-[40px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                  useWebSearch
                    ? 'bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                  }
                  onSend();
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                  }
                }}
                disabled={!canSend}
                aria-label="Send message"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 text-white hover:opacity-95 disabled:opacity-40 disabled:from-slate-300 disabled:via-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:via-slate-700 dark:disabled:to-slate-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          {strings.disclaimer}
        </p>
      </div>
    </div>
  );
}
