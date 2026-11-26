import { Code2, FileText, Globe, Languages } from 'lucide-react';
import type { LanguageMode } from '../types/chat';
import { getLocalizedStrings } from '../utils/i18n';
import { BrandMark } from './BrandMark';

interface StarterPrompt {
  id: string;
  label: string;
  prompt: string;
  requiresSearch?: boolean;
  icon: typeof Code2;
  accentClass: string;
}

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'hinglish-roadmap',
    label: 'Hinglish Planner',
    prompt:
      'Mujhe 30 din mein full-stack web development seekhne ka practical daily plan Hinglish mein do.',
    icon: Languages,
    accentClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'marathi-guide',
    label: 'मराठी माहिती',
    prompt:
      'महाराष्ट्रातील ३ प्रसिद्ध ऐतिहासिक किल्ल्यांची थोडक्यात आणि रंजक माहिती मराठीत लिहा.',
    icon: Globe,
    accentClass: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    id: 'hindi-writing',
    label: 'हिन्दी लेखन',
    prompt:
      'स्वस्थ जीवनशैली और समय प्रबंधन पर एक प्रेरणादायक छोटा अनुच्छेद हिन्दी में लिखो।',
    icon: FileText,
    accentClass: 'text-pink-600 dark:text-pink-400',
  },
  {
    id: 'code-help',
    label: 'Code Assistant',
    prompt:
      'Write a clean TypeScript debounce hook example for a search input in React.',
    icon: Code2,
    accentClass: 'text-blue-600 dark:text-blue-400',
  },
];

interface WelcomeScreenProps {
  languageMode: LanguageMode;
  onSelectPrompt: (prompt: string, useWebSearch?: boolean) => void;
}

export function WelcomeScreen({
  languageMode,
  onSelectPrompt,
}: WelcomeScreenProps) {
  const strings = getLocalizedStrings(languageMode);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 w-full flex flex-col">
      <div className="my-auto max-w-3xl mx-auto w-full flex flex-col items-center">
        <div className="mb-4 p-2 rounded-2xl bg-gradient-to-br from-violet-500/15 via-blue-500/15 to-pink-500/15 border border-violet-200/70 dark:border-violet-700/40">
          <BrandMark className="w-12 h-12" />
        </div>

      <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-center text-balance bg-gradient-to-r from-violet-700 via-blue-600 to-pink-600 dark:from-violet-300 dark:via-blue-300 dark:to-pink-300 bg-clip-text text-transparent">
        {strings.greeting}
      </h1>

      <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 text-center max-w-lg">
        {strings.subtitle}
      </p>

      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {STARTER_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPrompt(item.prompt, item.requiresSearch)}
              className="group flex items-start gap-3 p-4 rounded-2xl border border-violet-200/80 dark:border-violet-800/50 bg-white/90 dark:bg-[#1e1a2e]/90 hover:border-violet-400 dark:hover:border-pink-500/50 text-left transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 via-blue-100 to-pink-100 dark:from-violet-900/50 dark:via-blue-900/40 dark:to-pink-900/40 shrink-0">
                <Icon className={`w-4 h-4 ${item.accentClass}`} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {item.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {item.prompt}
                </div>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
