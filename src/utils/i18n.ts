import type { LanguageMode } from '../types/chat';

export interface LocalizedStrings {
  greeting: string;
  subtitle: string;
  inputPlaceholder: string;
  newChat: string;
  searchChats: string;
  settings: string;
  backToChat: string;
  disclaimer: string;
  listening: string;
  languageLabel: string;
  speechLangCode: string;
}

const STRINGS: Record<LanguageMode, LocalizedStrings> = {
  auto: {
    greeting: 'Hey, I am Riva AI',
    subtitle:
      'Ask anything in English, हिन्दी, मराठी, or Hinglish. Upload images or PDFs, or tap the mic to speak.',
    inputPlaceholder: 'Message Riva AI in English, Hindi, Marathi, or Hinglish...',
    newChat: 'New chat',
    searchChats: 'Search chats...',
    settings: 'Settings',
    backToChat: 'Back to chat',
    disclaimer: 'Riva AI can make mistakes. Verify important information.',
    listening: 'Listening... speak now',
    languageLabel: 'Auto',
    speechLangCode: 'en-IN',
  },
  english: {
    greeting: 'How can Riva help today?',
    subtitle:
      'Write code, summarize PDFs, analyze photos, or search the web in seconds.',
    inputPlaceholder: 'Ask Riva AI anything...',
    newChat: 'New chat',
    searchChats: 'Search chats...',
    settings: 'Settings',
    backToChat: 'Back to chat',
    disclaimer: 'Riva AI can make mistakes. Verify important information.',
    listening: 'Listening... speak now',
    languageLabel: 'English',
    speechLangCode: 'en-US',
  },
  hindi: {
    greeting: 'नमस्ते, मैं रीवा AI हूँ',
    subtitle:
      'मुझसे हिन्दी, मराठी, अंग्रेज़ी या हिंग्लिश में कुछ भी पूछें। फोटो या PDF अपलोड करें, या बोलकर सवाल पूछें।',
    inputPlaceholder: 'रीवा AI को संदेश लिखें...',
    newChat: 'नई चैट',
    searchChats: 'चैट खोजें...',
    settings: 'सेटिंग्स',
    backToChat: 'चैट पर लौटें',
    disclaimer: 'रीवा AI से गलती हो सकती है। महत्वपूर्ण जानकारी की जांच करें।',
    listening: 'सुन रही हूँ... अब बोलें',
    languageLabel: 'हिन्दी',
    speechLangCode: 'hi-IN',
  },
  marathi: {
    greeting: 'नमस्कार, मी रीवा AI आहे',
    subtitle:
      'मला मराठी, हिन्दी, इंग्रजी किंवा हिंग्लिशमध्ये काहीही विचारा. फोटो किंवा PDF अपलोड करा, किंवा बोलून प्रश्न विचारा.',
    inputPlaceholder: 'रीवा AI ला संदेश लिहा...',
    newChat: 'नवीन चॅट',
    searchChats: 'चॅट शोधा...',
    settings: 'सेटिंग्ज',
    backToChat: 'चॅटवर परत जा',
    disclaimer: 'रीवा AI कडून चूक होऊ शकते. महत्त्वाची माहिती तपासून घ्या.',
    listening: 'ऐकत आहे... आता बोला',
    languageLabel: 'मराठी',
    speechLangCode: 'mr-IN',
  },
  hinglish: {
    greeting: 'Hi! Main Riva AI hoon',
    subtitle:
      'Apne sawal poochho, images ya PDFs upload karo, ya mic dabakar bol kar baat karo.',
    inputPlaceholder: 'Riva AI ko message likho...',
    newChat: 'New chat',
    searchChats: 'Chats search karo...',
    settings: 'Settings',
    backToChat: 'Chat par wapas jao',
    disclaimer: 'Riva AI se galti ho sakti hai. Zaroori info check kar lein.',
    listening: 'Sun rahi hoon... ab boliye',
    languageLabel: 'Hinglish',
    speechLangCode: 'en-IN',
  },
};

export function getLocalizedStrings(mode: LanguageMode): LocalizedStrings {
  return STRINGS[mode] ?? STRINGS.auto;
}
