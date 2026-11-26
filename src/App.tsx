import { useEffect, useRef, useState } from 'react';
import { Composer } from './components/Composer';
import { MessageList } from './components/MessageList';
import { SettingsPage } from './components/SettingsPage';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import {
  CHAT_MODES,
  type ChatFolder,
  type ChatMessage,
  type ChatModeId,
  type Conversation,
  type FileAttachment,
  type FolderColor,
  type GroundingSource,
  type LanguageMode,
  type UserPreferences,
} from './types/chat';
import {
  deriveConversationTitle,
  unassignFolderFromConversations,
} from './utils/chatUtils';
import { exportConversationToPdf } from './utils/pdfExport';
import {
  loadConversations,
  loadFolders,
  loadPreferences,
  saveConversations,
  saveFolders,
  savePreferences,
} from './utils/storage';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [folders, setFolders] = useState<ChatFolder[]>(() => loadFolders());
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadPreferences()
  );

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeView, setActiveView] = useState<'chat' | 'settings'>('chat');

  const [selectedModeId, setSelectedModeId] = useState<ChatModeId>(
    preferences.defaultModeId
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const [promptInput, setPromptInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportPdfSuccess, setExportPdfSuccess] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveFolders(folders);
  }, [folders]);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;

  const displayedMessages: ChatMessage[] = activeConversation?.messages ?? [];

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  };

  const handleNewChat = () => {
    stopStreaming();
    setBannerError(null);
    setActiveView('chat');
    setActiveConversationId(null);
    setPromptInput('');
    setAttachments([]);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    stopStreaming();
    setBannerError(null);
    setActiveView('chat');
    setActiveConversationId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setSelectedModeId(conv.modeId);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleOpenSettings = () => {
    setBannerError(null);
    setActiveView((prev) => (prev === 'settings' ? 'chat' : 'settings'));
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const streamAssistantReply = async (params: {
    targetConvId: string;
    historyForRequest: ChatMessage[];
    assistantMsgId: string;
    modeId: ChatModeId;
    languageMode: LanguageMode;
    webSearch: boolean;
    shouldAutoTitle?: { convId: string; firstPrompt: string };
  }) => {
    const {
      targetConvId,
      historyForRequest,
      assistantMsgId,
      modeId,
      languageMode,
      webSearch,
      shouldAutoTitle,
    } = params;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setBannerError(null);

    const updateAssistantMessage = (
      updater: (msg: ChatMessage) => ChatMessage
    ) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConvId
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantMsgId ? updater(m) : m
                ),
              }
            : c
        )
      );
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          modeId,
          languageMode,
          useWebSearch: webSearch,
          systemInstruction: preferences.customInstructions || undefined,
          messages: historyForRequest.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map((a) => ({
              mimeType: a.mimeType,
              dataBase64: a.dataBase64,
            })),
          })),
        }),
      });

      if (!response.ok || !response.body) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(
          typeof errPayload?.error === 'string'
            ? errPayload.error
            : `Request failed (${response.status})`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const rawEvent of events) {
          const line = rawEvent
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;

          const jsonText = line.slice(6).trim();
          if (!jsonText) continue;

          const parsed = JSON.parse(jsonText) as
            | { type: 'delta'; text: string }
            | { type: 'sources'; sources: GroundingSource[] }
            | { type: 'error'; message: string }
            | { type: 'done' };

          if (parsed.type === 'delta') {
            updateAssistantMessage((m) => ({
              ...m,
              content: m.content + parsed.text,
            }));
          } else if (parsed.type === 'sources') {
            updateAssistantMessage((m) => ({
              ...m,
              sources: parsed.sources,
            }));
          } else if (parsed.type === 'error') {
            updateAssistantMessage((m) => ({
              ...m,
              content: parsed.message,
              isError: true,
            }));
          }
        }
      }

      if (shouldAutoTitle) {
        fetch('/api/chat/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: shouldAutoTitle.firstPrompt }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && typeof data.title === 'string' && data.title.trim()) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === shouldAutoTitle.convId
                    ? { ...c, title: data.title.trim() }
                    : c
                )
              );
            }
          })
          .catch(() => {
            // Keep derived fallback title
          });
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Unable to reach Riva AI service.';
      updateAssistantMessage((m) => ({
        ...m,
        content: message,
        isError: true,
      }));
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const sendMessage = async (
    overrideText?: string,
    overrideWebSearch?: boolean
  ) => {
    const rawText = overrideText ?? promptInput;
    const trimmed = rawText.trim();
    const currentAttachments = overrideText ? [] : attachments;
    const activeWebSearch = overrideWebSearch ?? useWebSearch;

    if (
      isStreaming ||
      (trimmed.length === 0 && currentAttachments.length === 0)
    ) {
      return;
    }

    setActiveView('chat');
    const now = Date.now();
    const userMsg: ChatMessage = {
      id: makeId('user'),
      role: 'user',
      content: trimmed,
      createdAt: now,
      attachments:
        currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    const assistantMsg: ChatMessage = {
      id: makeId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      usedWebSearch: activeWebSearch,
    };

    if (!overrideText) {
      setPromptInput('');
      setAttachments([]);
    }

    if (!activeConversation) {
      const newConvId = makeId('conv');
      const initialTitle = deriveConversationTitle(
        trimmed || currentAttachments[0]?.name || 'Document analysis'
      );
      const assignedFolderId =
        selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized'
          ? selectedFolderId
          : null;
      const newConv: Conversation = {
        id: newConvId,
        title: initialTitle,
        createdAt: now,
        updatedAt: now,
        modeId: selectedModeId,
        folderId: assignedFolderId,
        messages: [userMsg, assistantMsg],
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConvId);

      await streamAssistantReply({
        targetConvId: newConvId,
        historyForRequest: [userMsg],
        assistantMsgId: assistantMsg.id,
        modeId: selectedModeId,
        languageMode: preferences.languageMode,
        webSearch: activeWebSearch,
        shouldAutoTitle: trimmed
          ? { convId: newConvId, firstPrompt: trimmed }
          : undefined,
      });
      return;
    }

    const nextHistory = [...activeConversation.messages, userMsg];
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              updatedAt: now,
              modeId: selectedModeId,
              messages: [...nextHistory, assistantMsg],
            }
          : c
      )
    );

    await streamAssistantReply({
      targetConvId: activeConversation.id,
      historyForRequest: nextHistory,
      assistantMsgId: assistantMsg.id,
      modeId: selectedModeId,
      languageMode: preferences.languageMode,
      webSearch: activeWebSearch,
    });
  };

  const handleRegenerate = async (assistantMessageId: string) => {
    if (isStreaming || !activeConversation) return;
    const targetIdx = activeConversation.messages.findIndex(
      (m) => m.id === assistantMessageId
    );
    if (targetIdx <= 0) return;

    const historyUpToUser = activeConversation.messages.slice(0, targetIdx);
    const freshAssistant: ChatMessage = {
      id: makeId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      usedWebSearch: useWebSearch,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [...historyUpToUser, freshAssistant],
            }
          : c
      )
    );

    await streamAssistantReply({
      targetConvId: activeConversation.id,
      historyForRequest: historyUpToUser,
      assistantMsgId: freshAssistant.id,
      modeId: selectedModeId,
      languageMode: preferences.languageMode,
      webSearch: useWebSearch,
    });
  };

  const handleEditUserMessage = async (
    messageId: string,
    newContent: string
  ) => {
    if (isStreaming || !activeConversation) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    const updatedUser: ChatMessage = {
      ...activeConversation.messages[idx],
      content: newContent,
      createdAt: Date.now(),
    };
    const historyUpToEdited = [
      ...activeConversation.messages.slice(0, idx),
      updatedUser,
    ];
    const freshAssistant: ChatMessage = {
      id: makeId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
      usedWebSearch: useWebSearch,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [...historyUpToEdited, freshAssistant],
            }
          : c
      )
    );

    await streamAssistantReply({
      targetConvId: activeConversation.id,
      historyForRequest: historyUpToEdited,
      assistantMsgId: freshAssistant.id,
      modeId: selectedModeId,
      languageMode: preferences.languageMode,
      webSearch: useWebSearch,
    });
  };

  const handleRenameConversation = (id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
  };

  const handleDeleteConversation = (id: string) => {
    if (activeConversationId === id) {
      stopStreaming();
      setActiveConversationId(null);
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const handleClearAllConversations = () => {
    stopStreaming();
    setActiveConversationId(null);
    setConversations([]);
  };

  const handleCreateFolder = (name: string, color: FolderColor): string => {
    const newId = makeId('folder');
    const newFolder: ChatFolder = {
      id: newId,
      name,
      color,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
    return newId;
  };

  const handleRenameFolder = (id: string, name: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const handleDeleteFolder = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setConversations((prev) => unassignFolderFromConversations(prev, id));
    if (selectedFolderId === id) {
      setSelectedFolderId('all');
    }
  };

  const handleMoveConversationToFolder = (
    conversationId: string,
    folderId: string | null
  ) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, folderId } : c))
    );
  };

  const canExportPdf =
    Boolean(activeConversation) &&
    displayedMessages.some(
      (m) => m.content.trim().length > 0 || (m.attachments && m.attachments.length > 0)
    ) &&
    !isStreaming;

  const handleExportPdf = async () => {
    if (!activeConversation || !canExportPdf || isExportingPdf) return;
    setBannerError(null);
    setIsExportingPdf(true);
    try {
      const modeLabel =
        CHAT_MODES.find((m) => m.id === activeConversation.modeId)?.label ??
        'Riva AI';
      await exportConversationToPdf(activeConversation, modeLabel);
      setExportPdfSuccess(true);
      window.setTimeout(() => setExportPdfSuccess(false), 2200);
    } catch (err) {
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Unable to export conversation as PDF.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="h-dvh w-full flex overflow-hidden bg-gradient-to-br from-[#faf7ff] via-[#f4f7ff] to-[#fff5fa] dark:from-[#13111c] dark:via-[#111524] dark:to-[#1a1020] text-slate-900 dark:text-slate-100">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        folders={folders}
        selectedFolderId={selectedFolderId}
        activeConversationId={activeConversationId}
        activeView={activeView}
        languageMode={preferences.languageMode}
        onSelectFolder={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onMoveConversationToFolder={handleMoveConversationToFolder}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={handleOpenSettings}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onNewChat={handleNewChat}
          selectedModeId={selectedModeId}
          onSelectMode={setSelectedModeId}
          languageMode={preferences.languageMode}
          onSelectLanguage={(lang) =>
            setPreferences((prev) => ({ ...prev, languageMode: lang }))
          }
          theme={preferences.theme}
          onToggleTheme={() =>
            setPreferences((prev) => ({
              ...prev,
              theme: prev.theme === 'dark' ? 'light' : 'dark',
            }))
          }
          activeView={activeView}
          onOpenSettings={handleOpenSettings}
          canExportPdf={canExportPdf}
          isExportingPdf={isExportingPdf}
          exportPdfSuccess={exportPdfSuccess}
          onExportPdf={handleExportPdf}
        />

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {bannerError && (
            <div
              role="alert"
              className="mx-auto mt-3 max-w-3xl w-[calc(100%-1.5rem)] px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between"
            >
              <span>{bannerError}</span>
              <button
                type="button"
                onClick={() => setBannerError(null)}
                className="ml-3 underline font-semibold shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeView === 'settings' ? (
            <SettingsPage
              preferences={preferences}
              onSavePreferences={(next) => {
                setPreferences(next);
                setSelectedModeId(next.defaultModeId);
              }}
              onClearAllConversations={handleClearAllConversations}
              onBackToChat={() => setActiveView('chat')}
              conversationCount={conversations.length}
            />
          ) : (
            <>
              {displayedMessages.length === 0 ? (
                <WelcomeScreen
                  languageMode={preferences.languageMode}
                  onSelectPrompt={(prompt, requiresSearch) => {
                    if (requiresSearch) {
                      setUseWebSearch(true);
                    }
                    sendMessage(prompt, requiresSearch ?? useWebSearch);
                  }}
                />
              ) : (
                <MessageList
                  messages={displayedMessages}
                  isStreaming={isStreaming}
                  languageMode={preferences.languageMode}
                  onRegenerate={handleRegenerate}
                  onEditUserMessage={handleEditUserMessage}
                  onError={setBannerError}
                />
              )}

              <Composer
                value={promptInput}
                onChange={setPromptInput}
                attachments={attachments}
                onAddAttachment={(att) =>
                  setAttachments((prev) => [...prev, att].slice(0, 4))
                }
                onRemoveAttachment={(id) =>
                  setAttachments((prev) => prev.filter((a) => a.id !== id))
                }
                useWebSearch={useWebSearch}
                onToggleWebSearch={() => setUseWebSearch((prev) => !prev)}
                languageMode={preferences.languageMode}
                isStreaming={isStreaming}
                onSend={() => sendMessage()}
                onStop={stopStreaming}
                onError={setBannerError}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
