export type ChatModeId = 'balanced' | 'fast' | 'lite';
export type LanguageMode = 'auto' | 'english' | 'hindi' | 'marathi' | 'hinglish';

export interface ChatModeOption {
  id: ChatModeId;
  label: string;
  description: string;
  apiModel: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  thinkingLevel?: 'LOW' | 'HIGH';
}

export const CHAT_MODES: ChatModeOption[] = [
  {
    id: 'balanced',
    label: 'Riva Balanced',
    description: 'Thoughtful answers for coding, writing & analysis',
    apiModel: 'gemini-4-hydrogen',
    thinkingLevel: 'HIGH',
  },
  {
    id: 'fast',
    label: 'Riva Fast',
    description: 'Quick everyday replies with low latency',
    apiModel: 'gemini-4-hydrogen',
    thinkingLevel: 'LOW',
  },
  {
    id: 'lite',
    label: 'Riva Lite',
    description: 'Lightweight instant responses',
    apiModel: 'gemini-3.1-flash-lite',
  },
];

export type AttachmentKind = 'image' | 'pdf';

export interface FileAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  previewUrl?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  attachments?: FileAttachment[];
  sources?: GroundingSource[];
  usedWebSearch?: boolean;
  isError?: boolean;
}

export type FolderColor = 'violet' | 'blue' | 'pink' | 'emerald' | 'amber';

export interface ChatFolder {
  id: string;
  name: string;
  color: FolderColor;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modeId: ChatModeId;
  folderId?: string | null;
  messages: ChatMessage[];
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  languageMode: LanguageMode;
  customInstructions: string;
  defaultModeId: ChatModeId;
}

export interface DateGroup {
  label: string;
  items: Conversation[];
}
