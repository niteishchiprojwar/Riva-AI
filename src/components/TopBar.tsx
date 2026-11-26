import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  FileDown,
  Languages,
  Loader2,
  Menu,
  Moon,
  Settings,
  SquarePen,
  Sun,
} from 'lucide-react';
import { CHAT_MODES, type ChatModeId, type LanguageMode } from '../types/chat';
import { BrandMark } from './BrandMark';

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  selectedModeId: ChatModeId;
  onSelectMode: (modeId: ChatModeId) => void;
  languageMode: LanguageMode;
  onSelectLanguage: (lang: LanguageMode) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  activeView: 'chat' | 'settings';
  onOpenSettings: () => void;
  canExportPdf: boolean;
  isExportingPdf: boolean;
  exportPdfSuccess: boolean;
  onExportPdf: () => void;
}

const LANGUAGE_OPTIONS: Array<{ id: LanguageMode; short: string; label: string }> = [
  { id: 'auto', short: 'Auto', label: 'Auto (EN / HI / MR / Hinglish)' },
  { id: 'english', short: 'EN', label: 'English' },
  { id: 'hindi', short: 'हिन्दी', label: 'हिन्दी (Hindi)' },
  { id: 'marathi', short: 'मराठी', label: 'मराठी (Marathi)' },
  { id: 'hinglish', short: 'Hinglish', label: 'Hinglish' },
];

export function TopBar({
  sidebarOpen,
  onToggleSidebar,
  onNewChat,
  selectedModeId,
  onSelectMode,
  languageMode,
  onSelectLanguage,
  theme,
  onToggleTheme,
  activeView,
  onOpenSettings,
  canExportPdf,
  isExportingPdf,
  exportPdfSuccess,
  onExportPdf,
}: TopBarProps) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);

  const activeMode =
    CHAT_MODES.find((m) => m.id === selectedModeId) ?? CHAT_MODES[0];
  const activeLang =
    LANGUAGE_OPTIONS.find((l) => l.id === languageMode) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <header className="h-[54px] shrink-0 sticky top-0 z-20 flex items-center justify-between gap-2 px-2 sm:px-4 border-b border-violet-200/70 dark:border-violet-900/50 bg-white/90 dark:bg-[#181426]/90 backdrop-blur-md">
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open chat history"
            className="min-h-[44px] min-w-[36px] sm:min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center md:hidden shrink-0">
          <BrandMark className="w-6 h-6" />
        </div>

        <div className="relative min-w-0" ref={modeRef}>
          <button
            type="button"
            onClick={() => setModeMenuOpen((prev) => !prev)}
            aria-expanded={modeMenuOpen}
            aria-haspopup="listbox"
            className="min-h-[40px] max-w-full inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-sm font-semibold text-slate-900 dark:text-white hover:bg-violet-100/60 dark:hover:bg-violet-900/40 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span className="truncate bg-gradient-to-r from-violet-700 via-blue-600 to-pink-600 dark:from-violet-300 dark:via-blue-300 dark:to-pink-300 bg-clip-text text-transparent">
              {activeView === 'settings' ? 'Settings' : activeMode.label}
            </span>
            {activeView === 'chat' && (
              <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            )}
          </button>

          {modeMenuOpen && activeView === 'chat' && (
            <div
              role="listbox"
              aria-label="Select AI mode"
              className="absolute left-0 mt-1.5 w-72 rounded-2xl border border-violet-200/80 dark:border-violet-800/60 bg-white dark:bg-[#1e1a2e] shadow-xl p-1.5 z-30"
            >
              {CHAT_MODES.map((mode) => {
                const isSelected = mode.id === selectedModeId;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectMode(mode.id);
                      setModeMenuOpen(false);
                    }}
                    className="w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {mode.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {mode.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-violet-600 dark:text-pink-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => setLangMenuOpen((prev) => !prev)}
            aria-expanded={langMenuOpen}
            aria-label="Select language"
            className="min-h-[40px] inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-violet-100/70 dark:bg-violet-900/40 hover:bg-violet-200/70 dark:hover:bg-violet-800/50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Languages className="w-3.5 h-3.5 text-violet-700 dark:text-pink-400 shrink-0" />
            <span>{activeLang.short}</span>
          </button>

          {langMenuOpen && (
            <div
              role="listbox"
              aria-label="Language options"
              className="absolute right-0 mt-1.5 w-52 rounded-2xl border border-violet-200/80 dark:border-violet-800/60 bg-white dark:bg-[#1e1a2e] shadow-xl p-1.5 z-30"
            >
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = opt.id === languageMode;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectLanguage(opt.id);
                      setLangMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left text-slate-800 dark:text-slate-100 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-violet-600 dark:text-pink-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeView === 'chat' && canExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExportingPdf}
            aria-label={
              isExportingPdf
                ? 'Exporting conversation as PDF'
                : 'Export conversation as PDF'
            }
            title="Export conversation as PDF"
            className={`min-h-[44px] min-w-[36px] sm:min-w-[42px] lg:px-2.5 inline-flex items-center justify-center gap-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 ${
              exportPdfSuccess
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                : 'text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
            }`}
          >
            {isExportingPdf ? (
              <Loader2 className="w-[18px] h-[18px] animate-spin text-violet-600 dark:text-pink-400 shrink-0" />
            ) : exportPdfSuccess ? (
              <Check className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <FileDown className="w-[18px] h-[18px] shrink-0" />
            )}
            <span className="hidden lg:inline text-xs font-semibold">
              {exportPdfSuccess ? 'Saved' : 'PDF'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onNewChat}
          aria-label="Start new chat"
          className="min-h-[44px] min-w-[36px] sm:min-w-[42px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <SquarePen className="w-[18px] h-[18px]" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
          className="min-h-[44px] min-w-[36px] sm:min-w-[42px] inline-flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {theme === 'dark' ? (
            <Sun className="w-[18px] h-[18px]" />
          ) : (
            <Moon className="w-[18px] h-[18px]" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings page"
          className={`min-h-[44px] min-w-[36px] sm:min-w-[42px] inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            activeView === 'settings'
              ? 'bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 text-white'
              : 'text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>
      </div>
    </header>
  );
}
