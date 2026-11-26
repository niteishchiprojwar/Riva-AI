import type { ChatFolder, Conversation, UserPreferences } from '../types/chat';

const CONVERSATIONS_KEY = 'riva_ai_conversations_v1';
const FOLDERS_KEY = 'riva_ai_folders_v1';
const PREFERENCES_KEY = 'riva_ai_preferences_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  languageMode: 'auto',
  customInstructions: '',
  defaultModeId: 'balanced',
};

export function createSampleFolders(nowMs: number = Date.now()): ChatFolder[] {
  return [
    {
      id: 'folder-coding',
      name: 'Coding & Tech',
      color: 'blue',
      createdAt: nowMs - 48 * 60 * 60 * 1000,
    },
    {
      id: 'folder-wellness',
      name: 'Daily Life & Health',
      color: 'pink',
      createdAt: nowMs - 24 * 60 * 60 * 1000,
    },
  ];
}

export function createSampleConversations(
  nowMs: number = Date.now()
): Conversation[] {
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  return [
    {
      id: 'riva-sample-hinglish',
      title: '30-day Python study roadmap',
      createdAt: nowMs - 2 * oneHour,
      updatedAt: nowMs - 2 * oneHour,
      modeId: 'balanced',
      folderId: 'folder-coding',
      messages: [
        {
          id: 'riva-m1',
          role: 'user',
          content: 'Mujhe Python basics seekhne ka crisp 4-week plan bana kar do.',
          createdAt: nowMs - 2 * oneHour,
        },
        {
          id: 'riva-m2',
          role: 'assistant',
          content: `Bilkul! Yahan ek simple aur practical 4-week Python roadmap hai:

### Week 1: Core Foundations
- Variables, data types, loops (\`for\`, \`while\`), aur functions seekho.
- Daily 30 min chhoti scripts likho (e.g., unit converter ya tip calculator).

### Week 2: Data Structures & Files
- Lists, dictionaries, sets, aur file handling (\`with open(...)\`) practice karo.

### Week 3: Mini Projects & APIs
- \`requests\` library se ek weather ya currency API fetch app banao.

\`\`\`python
def greet(name: str) -> str:
    return f"Namaste, {name}! Ready to code."

print(greet("Aarav"))
\`\`\`

### Week 4: Revision & GitHub
- Apne 2 best mini projects clean README ke saath GitHub par push karo.`,
          createdAt: nowMs - 2 * oneHour + 4000,
        },
      ],
    },
    {
      id: 'riva-sample-hindi',
      title: 'सुबह की स्वस्थ दिनचर्या सुझाव',
      createdAt: nowMs - oneDay - oneHour,
      updatedAt: nowMs - oneDay - oneHour,
      modeId: 'fast',
      folderId: 'folder-wellness',
      messages: [
        {
          id: 'riva-m3',
          role: 'user',
          content: 'अच्छी सेहत और ऊर्जा के लिए सुबह की 4 सरल आदतें बताओ।',
          createdAt: nowMs - oneDay - oneHour,
        },
        {
          id: 'riva-m4',
          role: 'assistant',
          content: `अच्छी सेहत और दिनभर की ऊर्जा के लिए ये 4 सरल आदतें अपनाएं:

1. **गुनगुना पानी पिएं:** उठने के तुरंत बाद 1-2 गिलास पानी पीकर शरीर को हाइड्रेट करें।
2. **15 मिनट स्ट्रेचिंग या वॉक:** हल्का योग या ताज़ी हवा में टहलना मूड और फोकस दोनों बढ़ाता है।
3. **पौष्टिक नाश्ता:** प्रोटीन और फाइबर युक्त नाश्ता (जैसे दलिया, पोहा, या फल-मेवे) लें।
4. **स्क्रीन-फ्री शुरुआत:** सुबह पहले 20 मिनट मोबाइल से दूर रहकर दिन की प्राथमिकता तय करें।`,
          createdAt: nowMs - oneDay - oneHour + 3000,
        },
      ],
    },
  ];
}

export function loadConversations(): Conversation[] {
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) {
      const seeded = createSampleConversations();
      saveConversations(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    window.localStorage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify(conversations)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadFolders(): ChatFolder[] {
  try {
    const raw = window.localStorage.getItem(FOLDERS_KEY);
    if (!raw) {
      const seeded = createSampleFolders();
      saveFolders(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFolders(folders: ChatFolder[]): void {
  try {
    window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      languageMode:
        parsed.languageMode === 'english' ||
        parsed.languageMode === 'hindi' ||
        parsed.languageMode === 'marathi' ||
        parsed.languageMode === 'hinglish' ||
        parsed.languageMode === 'auto'
          ? parsed.languageMode
          : 'auto',
      customInstructions:
        typeof parsed.customInstructions === 'string'
          ? parsed.customInstructions
          : '',
      defaultModeId:
        parsed.defaultModeId === 'fast' ||
        parsed.defaultModeId === 'lite' ||
        parsed.defaultModeId === 'balanced'
          ? parsed.defaultModeId
          : 'balanced',
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}
