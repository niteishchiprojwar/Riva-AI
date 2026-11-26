import { useState } from 'react';
import { ArrowLeft, Check, ShieldCheck, Trash2 } from 'lucide-react';
import {
  CHAT_MODES,
  type ChatModeId,
  type LanguageMode,
  type UserPreferences,
} from '../types/chat';
import { getLocalizedStrings } from '../utils/i18n';

interface SettingsPageProps {
  preferences: UserPreferences;
  onSavePreferences: (next: UserPreferences) => void;
  onClearAllConversations: () => void;
  onBackToChat: () => void;
  conversationCount: number;
}

const LANGUAGE_CHOICES: Array<{
  id: LanguageMode;
  title: string;
  desc: string;
}> = [
  {
    id: 'auto',
    title: 'Auto (EN / हिन्दी / मराठी / Hinglish)',
    desc: 'Replies in whichever language you write or speak',
  },
  {
    id: 'english',
    title: 'English',
    desc: 'Clear English interface and responses',
  },
  {
    id: 'hindi',
    title: 'हिन्दी (Hindi)',
    desc: 'Devanagari Hindi interface and responses',
  },
  {
    id: 'marathi',
    title: 'मराठी (Marathi)',
    desc: 'Devanagari Marathi interface and responses',
  },
  {
    id: 'hinglish',
    title: 'Hinglish',
    desc: 'Conversational Hindi + English in Latin script',
  },
];

export function SettingsPage({
  preferences,
  onSavePreferences,
  onClearAllConversations,
  onBackToChat,
  conversationCount,
}: SettingsPageProps) {
  const [languageMode, setLanguageMode] = useState<LanguageMode>(
    preferences.languageMode
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(preferences.theme);
  const [defaultModeId, setDefaultModeId] = useState<ChatModeId>(
    preferences.defaultModeId
  );
  const [customInstructions, setCustomInstructions] = useState(
    preferences.customInstructions
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const strings = getLocalizedStrings(languageMode);

  const handleSave = () => {
    onSavePreferences({
      theme,
      languageMode,
      defaultModeId,
      customInstructions: customInstructions.trim(),
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-violet-100/70 dark:hover:bg-violet-900/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{strings.backToChat}</span>
          </button>

          {savedNotice && (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-pink-300"
            >
              <Check className="w-3.5 h-3.5" />
              Settings saved
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-700 via-blue-600 to-pink-600 dark:from-violet-300 dark:via-blue-300 dark:to-pink-300 bg-clip-text text-transparent">
            Riva AI Settings
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Customize language, appearance, model behavior, and saved chat data.
          </p>
        </div>

        <section className="rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white/95 dark:bg-[#1e1a2e]/95 p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Language Preference (English · हिन्दी · मराठी · Hinglish)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {LANGUAGE_CHOICES.map((opt) => {
              const selected = languageMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setLanguageMode(opt.id);
                    onSavePreferences({
                      ...preferences,
                      theme,
                      languageMode: opt.id,
                      defaultModeId,
                      customInstructions: customInstructions.trim(),
                    });
                  }}
                  aria-pressed={selected}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'border-violet-600 bg-violet-50/90 dark:bg-violet-950/60 dark:border-pink-400'
                      : 'border-slate-200 dark:border-violet-900/50 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {opt.title}
                    </span>
                    {selected && (
                      <Check className="w-4 h-4 text-violet-600 dark:text-pink-400 shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {opt.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white/95 dark:bg-[#1e1a2e]/95 p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Theme Appearance
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-violet-100/60 dark:bg-[#141122] border border-violet-200/70 dark:border-violet-800/50">
              <button
                type="button"
                onClick={() => {
                  setTheme('light');
                  onSavePreferences({
                    ...preferences,
                    theme: 'light',
                    languageMode,
                    defaultModeId,
                    customInstructions: customInstructions.trim(),
                  });
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme('dark');
                  onSavePreferences({
                    ...preferences,
                    theme: 'dark',
                    languageMode,
                    defaultModeId,
                    customInstructions: customInstructions.trim(),
                  });
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-violet-600 to-pink-500 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-default-mode"
              className="block text-sm font-semibold text-slate-900 dark:text-white mb-2"
            >
              Default Assistant Mode
            </label>
            <select
              id="settings-default-mode"
              value={defaultModeId}
              onChange={(e) => setDefaultModeId(e.target.value as ChatModeId)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-violet-200 dark:border-violet-800/60 bg-white dark:bg-[#141122] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {CHAT_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white/95 dark:bg-[#1e1a2e]/95 p-4 sm:p-5 space-y-3">
          <label
            htmlFor="settings-custom-instructions"
            className="block text-sm font-semibold text-slate-900 dark:text-white"
          >
            Custom Instructions
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Guide Riva AI’s tone, formatting, or persona across conversations.
          </p>
          <textarea
            id="settings-custom-instructions"
            rows={4}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Example: Explain concepts simply with real-world examples and concise bullet points."
            className="w-full rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/40 dark:bg-[#141122] p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 hover:opacity-95 transition-opacity"
            >
              Save Preferences
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white/95 dark:bg-[#1e1a2e]/95 p-4 sm:p-5 space-y-4">
          <div className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-pink-400 shrink-0 mt-0.5" />
            <span>
              All AI requests are processed securely on the server. API credentials never appear in browser code, and chat history stays locally in your browser.
            </span>
          </div>

          <div className="pt-3 border-t border-violet-100 dark:border-violet-800/50 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Saved Conversations
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {conversationCount} conversation{conversationCount === 1 ? '' : 's'} stored locally
              </div>
            </div>

            {confirmClear ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllConversations();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                >
                  Confirm Clear
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={conversationCount === 0}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
