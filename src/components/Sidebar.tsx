import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Layers,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChatFolder,
  Conversation,
  FolderColor,
  LanguageMode,
} from '../types/chat';
import {
  filterConversations,
  getFolderChatCounts,
  groupConversationsByDate,
} from '../utils/chatUtils';
import { getLocalizedStrings } from '../utils/i18n';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  folders: ChatFolder[];
  selectedFolderId: string;
  activeConversationId: string | null;
  activeView: 'chat' | 'settings';
  languageMode: LanguageMode;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string, color: FolderColor) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveConversationToFolder: (
    conversationId: string,
    folderId: string | null
  ) => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onOpenSettings: () => void;
}

const FOLDER_COLORS: FolderColor[] = [
  'violet',
  'blue',
  'pink',
  'emerald',
  'amber',
];

const FOLDER_COLOR_STYLES: Record<
  FolderColor,
  { dot: string; icon: string; badge: string }
> = {
  violet: {
    dot: 'bg-violet-500',
    icon: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  },
  blue: {
    dot: 'bg-blue-500',
    icon: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  },
  pink: {
    dot: 'bg-pink-500',
    icon: 'text-pink-600 dark:text-pink-400',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-200',
  },
  emerald: {
    dot: 'bg-emerald-500',
    icon: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  amber: {
    dot: 'bg-amber-500',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  },
};

export function Sidebar({
  isOpen,
  onClose,
  conversations,
  folders,
  selectedFolderId,
  activeConversationId,
  activeView,
  languageMode,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveConversationToFolder,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onOpenSettings,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const [foldersExpanded, setFoldersExpanded] = useState(true);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState<FolderColor>('violet');
  const [pendingAssignConvId, setPendingAssignConvId] = useState<string | null>(
    null
  );

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftFolderName, setDraftFolderName] = useState('');
  const [movingConvId, setMovingConvId] = useState<string | null>(null);

  const moveMenuRef = useRef<HTMLDivElement | null>(null);
  const strings = getLocalizedStrings(languageMode);

  useEffect(() => {
    if (!movingConvId) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        moveMenuRef.current &&
        !moveMenuRef.current.contains(e.target as Node)
      ) {
        setMovingConvId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMovingConvId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [movingConvId]);

  const folderMap = useMemo(() => {
    const map = new Map<string, ChatFolder>();
    for (const f of folders) {
      map.set(f.id, f);
    }
    return map;
  }, [folders]);

  const folderCounts = useMemo(
    () => getFolderChatCounts(conversations, folders),
    [conversations, folders]
  );

  const grouped = useMemo(() => {
    const filtered = filterConversations(
      conversations,
      searchQuery,
      selectedFolderId
    );
    return groupConversationsByDate(filtered);
  }, [conversations, searchQuery, selectedFolderId]);

  const activeFolderLabel =
    selectedFolderId === 'all'
      ? null
      : selectedFolderId === 'uncategorized'
        ? 'Uncategorized'
        : folderMap.get(selectedFolderId)?.name ?? null;

  const startEditing = (conv: Conversation) => {
    setMovingConvId(null);
    setEditingId(conv.id);
    setDraftTitle(conv.title);
  };

  const commitRename = (id: string) => {
    const trimmed = draftTitle.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftTitle('');
  };

  const startCreatingFolder = (assignConvId?: string) => {
    setFoldersExpanded(true);
    setCreatingFolder(true);
    setNewFolderName('');
    setPendingAssignConvId(assignConvId ?? null);
    setMovingConvId(null);
  };

  const submitCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const createdId = onCreateFolder(trimmed, newFolderColor);
    if (pendingAssignConvId) {
      onMoveConversationToFolder(pendingAssignConvId, createdId);
      setPendingAssignConvId(null);
    } else {
      onSelectFolder(createdId);
    }
    setCreatingFolder(false);
    setNewFolderName('');
  };

  const startEditingFolder = (folder: ChatFolder) => {
    setEditingFolderId(folder.id);
    setDraftFolderName(folder.name);
  };

  const commitRenameFolder = (id: string) => {
    const trimmed = draftFolderName.trim();
    if (trimmed) {
      onRenameFolder(id, trimmed);
    }
    setEditingFolderId(null);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px] z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Chat history sidebar"
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-[280px] shrink-0 bg-gradient-to-b from-[#f5f1ff] via-[#f6f7ff] to-[#fdf2f8] dark:from-[#171326] dark:via-[#141526] dark:to-[#1d1324] border-r border-violet-200/80 dark:border-violet-900/50 transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        <div className="h-[54px] px-3 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left hover:bg-white/70 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <BrandMark className="w-7 h-7 shrink-0" />
            <span className="text-base font-bold tracking-tight bg-gradient-to-r from-violet-700 via-blue-600 to-pink-600 dark:from-violet-300 dark:via-blue-300 dark:to-pink-300 bg-clip-text text-transparent whitespace-nowrap">
              Riva AI
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pb-3 space-y-2.5 shrink-0">
          <button
            type="button"
            onClick={onNewChat}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 hover:opacity-95 shadow-sm shadow-violet-600/20 transition-opacity whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{strings.newChat}</span>
          </button>

          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={strings.searchChats}
              aria-label="Search chat history"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl bg-white/90 dark:bg-[#1e1a2e] border border-violet-200/80 dark:border-violet-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <nav
          aria-label="Saved conversations"
          className="flex-1 overflow-y-auto px-2 py-1 space-y-4"
        >
          {/* Folders / Topic Organization */}
          <section aria-label="Chat folders" className="px-0.5">
            <div className="flex items-center justify-between px-2 pb-1">
              <button
                type="button"
                onClick={() => setFoldersExpanded((prev) => !prev)}
                aria-expanded={foldersExpanded}
                className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide text-violet-700/85 dark:text-violet-300/85 hover:text-violet-900 dark:hover:text-white py-1"
              >
                {foldersExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>Folders</span>
              </button>

              <button
                type="button"
                onClick={() => startCreatingFolder()}
                aria-label="Create folder"
                title="Create new folder"
                className="p-1.5 rounded-lg text-violet-600 dark:text-violet-300 hover:bg-white/80 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {creatingFolder && (
              <div className="mb-2 mx-1 p-2.5 rounded-xl bg-white/95 dark:bg-[#1e1a2e] border border-violet-300 dark:border-violet-700/70 shadow-sm space-y-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitCreateFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setPendingAssignConvId(null);
                    }
                  }}
                  placeholder="Topic folder name..."
                  aria-label="New folder name"
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-violet-50/50 dark:bg-[#151221] border border-violet-200 dark:border-violet-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {FOLDER_COLORS.map((color) => {
                      const active = newFolderColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewFolderColor(color)}
                          aria-label={`Select ${color} folder color`}
                          aria-pressed={active}
                          className={`w-4 h-4 rounded-full ${FOLDER_COLOR_STYLES[color].dot} transition-transform ${
                            active
                              ? 'ring-2 ring-offset-2 ring-slate-700 dark:ring-white dark:ring-offset-[#1e1a2e] scale-110'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingFolder(false);
                        setPendingAssignConvId(null);
                      }}
                      aria-label="Cancel folder creation"
                      className="px-2 py-1 text-[11px] font-medium rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitCreateFolder}
                      disabled={!newFolderName.trim()}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-pink-500 text-white disabled:opacity-45"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {foldersExpanded && (
              <ul className="space-y-0.5">
                <li>
                  <button
                    type="button"
                    onClick={() => onSelectFolder('all')}
                    aria-pressed={selectedFolderId === 'all'}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      selectedFolderId === 'all'
                        ? 'bg-white dark:bg-[#252038] text-slate-950 dark:text-white border border-violet-200 dark:border-violet-700/60 shadow-2xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                      <span className="truncate">All Chats</span>
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {folderCounts.all}
                    </span>
                  </button>
                </li>

                {folders.map((folder) => {
                  const isSelected = selectedFolderId === folder.id;
                  const isEditingThis = editingFolderId === folder.id;
                  const style =
                    FOLDER_COLOR_STYLES[folder.color] ??
                    FOLDER_COLOR_STYLES.violet;
                  const count = folderCounts.byFolder[folder.id] ?? 0;

                  return (
                    <li
                      key={folder.id}
                      className={`group flex items-center gap-1 rounded-xl transition-colors ${
                        isSelected
                          ? 'bg-white dark:bg-[#252038] border border-violet-200 dark:border-violet-700/60 text-slate-950 dark:text-white shadow-2xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="flex-1 flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={draftFolderName}
                            onChange={(e) => setDraftFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRenameFolder(folder.id);
                              if (e.key === 'Escape') setEditingFolderId(null);
                            }}
                            aria-label={`Edit folder name for ${folder.name}`}
                            autoFocus
                            className="flex-1 min-w-0 px-2 py-1 text-xs rounded-lg bg-white dark:bg-[#1a1628] border border-violet-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => commitRenameFolder(folder.id)}
                            aria-label="Save folder name"
                            className="p-1 rounded-lg text-violet-700 dark:text-pink-400 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFolderId(null)}
                            aria-label="Cancel folder rename"
                            className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onSelectFolder(isSelected ? 'all' : folder.id)
                            }
                            aria-pressed={isSelected}
                            className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs font-medium rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {isSelected ? (
                                <FolderOpen
                                  className={`w-3.5 h-3.5 shrink-0 ${style.icon}`}
                                />
                              ) : (
                                <Folder
                                  className={`w-3.5 h-3.5 shrink-0 ${style.icon}`}
                                />
                              )}
                              <span className="truncate">{folder.name}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                              {count}
                            </span>
                          </button>
                          <div className="flex items-center pr-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEditingFolder(folder)}
                              aria-label={`Rename folder '${folder.name}'`}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteFolder(folder.id)}
                              aria-label={`Delete folder '${folder.name}'`}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}

                {folders.length > 0 && folderCounts.uncategorized > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectFolder(
                          selectedFolderId === 'uncategorized'
                            ? 'all'
                            : 'uncategorized'
                        )
                      }
                      aria-pressed={selectedFolderId === 'uncategorized'}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        selectedFolderId === 'uncategorized'
                          ? 'bg-white dark:bg-[#252038] text-slate-950 dark:text-white border border-violet-200 dark:border-violet-700/60 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Uncategorized</span>
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {folderCounts.uncategorized}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>

          <div className="border-t border-violet-200/70 dark:border-violet-900/50 mx-2" />

          {/* Active Folder Filter Header + Conversations */}
          <div className="space-y-4">
            {activeFolderLabel && (
              <div className="px-2.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-violet-700 dark:text-pink-300 truncate">
                  {activeFolderLabel}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectFolder('all')}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline shrink-0"
                >
                  Show all
                </button>
              </div>
            )}

            {grouped.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                {searchQuery.trim()
                  ? 'No matching chats found.'
                  : activeFolderLabel
                    ? `No chats in "${activeFolderLabel}" yet.`
                    : 'Start a conversation to see it saved here.'}
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-wide text-violet-700/80 dark:text-violet-300/80">
                    {group.label}
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((conv) => {
                      const isActive =
                        activeView === 'chat' && conv.id === activeConversationId;
                      const isEditing = editingId === conv.id;
                      const isMoving = movingConvId === conv.id;
                      const convFolder = conv.folderId
                        ? folderMap.get(conv.folderId)
                        : undefined;
                      const folderDotStyle = convFolder
                        ? FOLDER_COLOR_STYLES[convFolder.color]?.dot
                        : undefined;

                      return (
                        <li key={conv.id} className="relative">
                          <div
                            className={`group flex items-center gap-1 rounded-xl transition-colors ${
                              isActive
                                ? 'bg-white dark:bg-[#252038] border border-violet-200 dark:border-violet-700/60 text-slate-950 dark:text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-1 px-2 py-1.5">
                                <input
                                  type="text"
                                  value={draftTitle}
                                  onChange={(e) => setDraftTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename(conv.id);
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  aria-label={`Edit title for ${conv.title}`}
                                  autoFocus
                                  className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg bg-white dark:bg-[#1a1628] border border-violet-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => commitRename(conv.id)}
                                  aria-label="Save title"
                                  className="p-1.5 rounded-lg text-violet-700 dark:text-pink-400 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  aria-label="Cancel rename"
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onSelectConversation(conv.id)}
                                  className="flex-1 min-w-0 min-h-[40px] flex items-center gap-2 px-2.5 py-2 text-left text-sm font-medium rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                                >
                                  {folderDotStyle && selectedFolderId === 'all' && (
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${folderDotStyle}`}
                                      title={convFolder?.name}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="truncate">{conv.title}</span>
                                </button>
                                <div className="flex items-center pr-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMovingConvId(isMoving ? null : conv.id)
                                    }
                                    aria-label={`Move '${conv.title}' to folder`}
                                    aria-expanded={isMoving}
                                    title="Move to folder"
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isMoving
                                        ? 'text-violet-700 dark:text-pink-400 bg-violet-100/80 dark:bg-violet-900/40'
                                        : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40'
                                    }`}
                                  >
                                    <FolderInput className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditing(conv)}
                                    aria-label={`Rename '${conv.title}'`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-violet-100/70 dark:hover:bg-violet-900/40"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteConversation(conv.id)}
                                    aria-label={`Delete '${conv.title}'`}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {isMoving && (
                            <div
                              ref={moveMenuRef}
                              role="menu"
                              aria-label={`Select folder for '${conv.title}'`}
                              className="mt-1 mx-1 rounded-xl border border-violet-200 dark:border-violet-700/70 bg-white dark:bg-[#1e1a2e] shadow-lg p-1.5 z-20 space-y-0.5"
                            >
                              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Move to folder
                              </div>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  onMoveConversationToFolder(conv.id, null);
                                  setMovingConvId(null);
                                }}
                                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                              >
                                <span className="truncate">Uncategorized</span>
                                {!conv.folderId && (
                                  <Check className="w-3.5 h-3.5 text-violet-600 dark:text-pink-400 shrink-0" />
                                )}
                              </button>

                              {folders.map((f) => {
                                const assigned = conv.folderId === f.id;
                                const dotClass =
                                  FOLDER_COLOR_STYLES[f.color]?.dot ??
                                  'bg-violet-500';
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      onMoveConversationToFolder(conv.id, f.id);
                                      setMovingConvId(null);
                                    }}
                                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-slate-800 dark:text-slate-100 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`}
                                      />
                                      <span className="truncate">{f.name}</span>
                                    </span>
                                    {assigned && (
                                      <Check className="w-3.5 h-3.5 text-violet-600 dark:text-pink-400 shrink-0" />
                                    )}
                                  </button>
                                );
                              })}

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => startCreatingFolder(conv.id)}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-0.5 border-t border-violet-100 dark:border-violet-800/50 text-xs font-medium text-violet-700 dark:text-pink-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-b-lg"
                              >
                                <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                                <span>New folder...</span>
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </nav>

        <div className="p-2.5 border-t border-violet-200/80 dark:border-violet-900/50 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
              activeView === 'settings'
                ? 'bg-gradient-to-r from-violet-600 via-blue-600 to-pink-500 text-white'
                : 'text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="truncate">{strings.settings}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
