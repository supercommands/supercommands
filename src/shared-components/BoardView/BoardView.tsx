import * as React from 'react';
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useAppearance } from '@extension/ui';
import { useUIStore } from '../uiStateManager';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTerminal,
  FaFlag,
  FaLink,
  FaHistory,
  FaBookmark,
  FaRobot,
  FaSearch,
  FaGlobe,
  FaFolder,
  FaFolderOpen,
  FaClock,
  FaCode,
  FaPlus,
  FaCheckCircle,
  FaRegCircle,
  FaCamera,
  FaExpand,
  FaImages,
  FaTable,
  FaCopy
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiX } from 'react-icons/fi';
import { isSameDay, format } from 'date-fns';
import { resolveEntityById } from '../utils/entityResolver';
import { isLocalEntityId } from '../utils';
import NotesIcon from '../icons/notesIcon';
import type {
  SuggestionState,
  SuggestionListItem,
} from '../searchBarMain/userInterfaceComponents/searchBar';
import { getFaviconUrl } from '../searchBarMain/utilityFunctions/utils';
import { PAGE_ACTION_ITEMS } from '../../pages/AltS_search_websites/src/commands/pageActions';

import { useDbStore } from '../../storage/store/useDbStore';
import { StorageManager } from '../../storage/localStorage/storageManager';
import {
  CustomSearchPrefixesForOmniboxStorage,
  DEFAULT_OMNIBOX_PREFIXES,
} from '../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { VisualKeyDisplay } from '../hotkeys/ui/VisualKeyDisplay';
import { EditablePrefixKey } from '../shortcuts/ui/EditablePrefixKey';

import { UnifiedContextMenu } from '../ui/UnifiedContextMenu';
import { useKeystrokeRecording } from '../hotkeys';
import { getItemCompoundId, extractSnippetIdFromCompoundId } from '../hotkeys/utils/hotkeyUtils';

import { saveUserHotkey, deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import {
  saveUserShortcut,
  deleteUserShortcutByReference,
  normalizeShortcutTrigger,
} from '../shortcuts/core/shortcutDbData';
import { updateTodo } from '../../allObjectFolder/src/createObject/todos/todoData';
import { deleteAiPrompt } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { runAiPrompt } from '../../allObjectFolder/src/createObject/aiPrompt';
import { deleteSession } from '../../allObjectFolder/src/createObject/session/sessionData';
import { useFavorites } from '../favorites';
import { db } from '../../storage/indexDB/dbConfig';
import { isCommandId } from '../commands';
import { SHARED_ALL_COMMANDS } from '../commands/surface';

import { FiPlay, FiExternalLink, FiEdit2, FiTrash2, FiStar, FiZap, FiPlus } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { saveShortcut as apiSaveShortcut } from '../shortcuts';
import { SessionGridIcon } from '../icons/sessionGridIcon';
import { getCommandSpacePrefix } from '../triggers';


// Helper for query highlighting
const highlightMatch = (text: string, query: string) => {
  if (!text || !query) return text;
  const lowerText = String(text || '').toLowerCase();
  const lowerQuery = String(query || '').toLowerCase();
  const startIndex = lowerText.indexOf(lowerQuery);
  if (startIndex === -1) return text;
  const endIndex = startIndex + query.length;
  return (
    <>
      {text.substring(0, startIndex)}
      <span className="font-bold text-[var(--color-textPrimary)] bg-amber-300/40 dark:bg-amber-400/30 rounded-sm px-0.5">{text.substring(startIndex, endIndex)}</span>
      {text.substring(endIndex)}
    </>
  );
};

// ─── Slash Category Launcher (mirrors AltQ's @alias system) ──────────────────

const buildSlashSectionAliases = (
  prefixes?: Partial<Awaited<ReturnType<typeof CustomSearchPrefixesForOmniboxStorage.getPrefixes>>> | null,
): Record<string, string> => {
  const resolved = { ...DEFAULT_OMNIBOX_PREFIXES, ...(prefixes || {}) };
  const aliases: Record<string, string> = {
    A: 'all',
    TS: 'thissite',
    [String(resolved.todo).trim().toUpperCase()]: 'todos',
    [String(resolved.note).trim().toUpperCase()]: 'notes',
    [String(resolved.session).trim().toUpperCase()]: 'sessions',
    [String(resolved.snippet).trim().toUpperCase()]: 'snippets',
    [String(resolved.link).trim().toUpperCase()]: 'links',
    [String(resolved.bookmark).trim().toUpperCase()]: 'bookmarks',
    [String(resolved.command).trim().toUpperCase()]: 'commands',
    [String(resolved.system_command).trim().toUpperCase()]: 'system_commands',
    [String(resolved.automation).trim().toUpperCase()]: 'automations',
    [String(resolved.agent).trim().toUpperCase()]: 'chat_agents',
  };

  return Object.fromEntries(Object.entries(aliases).filter(([alias]) => alias.trim().length > 0));
};

const focusSearchbarInput = () => {
  const inputEl = document.getElementById('searchbar-input');
  if (inputEl) {
    inputEl.focus();
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch (e) {
      console.error('[BoardView] Failed to set cursor position:', e);
    }
  }
};

const getTodoDueLabel = (item: any): string => {
  if (!item.event_deadline) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const d = new Date(item.event_deadline.replace(' ', 'T'));
  if (isNaN(d.getTime())) {
    if (item.is_anytime) return 'Anytime';
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isOverdue =
    !item.is_done &&
    d.getTime() < now.getTime() &&
    (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let dateStr = '';

  if (dDate.getTime() === startOfToday.getTime()) {
    dateStr = 'Today';
  } else if (dDate.getTime() === startOfTomorrow.getTime()) {
    dateStr = 'Tomorrow';
  } else if (d.getFullYear() >= 2035) {
    dateStr = 'Anytime';
  } else {
    dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const isRecurring = !!(item.is_recurring || item.recurring);
  const recurLabel = isRecurring ? ' • Recurring' : '';

  if (isOverdue) {
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let overdueText = '';
    if (diffMins < 60) overdueText = `${diffMins}m overdue`;
    else if (diffHrs < 24) overdueText = `${diffHrs}h overdue`;
    else overdueText = `${diffDays}d overdue`;

    return `${dateStr}, ${timeStr} (${overdueText})${recurLabel}`;
  }

  if (dateStr === 'Anytime') return `Anytime${recurLabel}`;
  return `${dateStr}, ${timeStr}${recurLabel}`;
};

interface SlashMode {
  slashDropdown: boolean; // show the category picker
  activeSection: string | null; // matched section key, or null
  searchQuery: string; // text after the alias for within-category filtering
}

/**
 * Parse a board search value that starts with '/'.
 * Matches only when the alias is followed by a space, allowing partial inputs to filter the dropdown.
 */
function parseSlashMode(value: string, slashSectionAliases: Record<string, string>, commandPrefix: string = 'c'): SlashMode {
  const normalizedValue = value.replace(/\u00A0/g, ' ');
  let textAfterPrefix = '';
  
  const colonMatch = normalizedValue.match(/^([a-zA-Z0-9_-]+):\s/);
  let isColon = false;
  let colonPrefix = '';
  let colonSection = '';

  if (colonMatch && colonMatch[0]) {
    const colonAlias = colonMatch[1].toUpperCase();
    
    if (slashSectionAliases[colonAlias]) {
      isColon = true;
      colonPrefix = colonMatch[0];
      colonSection = slashSectionAliases[colonAlias];
    }
  }

  const isSlash = normalizedValue.startsWith('/');
  const isCmd = normalizedValue.toLowerCase().startsWith(`${commandPrefix.toLowerCase()} `);

  if (isColon) {
    textAfterPrefix = normalizedValue.slice(colonPrefix.length);
  } else if (isSlash) {
    textAfterPrefix = normalizedValue.slice(1);
  } else if (isCmd) {
    textAfterPrefix = normalizedValue.slice(commandPrefix.length + 1);
  } else {
    return { slashDropdown: false, activeSection: null, searchQuery: normalizedValue };
  }

  // Find the longest matching alias
  let bestAlias = '';
  let activeSection: string | null = null;

  if (isColon) {
    activeSection = colonSection;
    if (activeSection) {
      let query = textAfterPrefix;
      return { slashDropdown: false, activeSection, searchQuery: query };
    }
  }

  for (const [alias, section] of Object.entries(slashSectionAliases)) {
    const upperText = textAfterPrefix.toUpperCase();
    const upperAlias = alias.toUpperCase();

    const matchExactOrSpace = upperText === upperAlias || upperText.startsWith(upperAlias + ' ');

    if (matchExactOrSpace) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    let query = textAfterPrefix.slice(bestAlias.length);
    if (query.startsWith(' ')) query = query.slice(1);
    return { slashDropdown: false, activeSection, searchQuery: query };
  }

  if (isCmd) {
    return { slashDropdown: false, activeSection: null, searchQuery: textAfterPrefix };
  }

  // No match → show the dropdown picker
  return { slashDropdown: true, activeSection: null, searchQuery: '' };
}

/** Metadata (icon + label) for each board group shown in the slash picker */
const SLASH_SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  all: {
    title: 'All',
    icon: (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  todos: { title: 'Todos', icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
  snippets: { title: 'Text Expanders', icon: <FaCode size={16} className="text-[var(--color-iconDefault)]" /> },
  links: { title: 'Links', icon: <FaLink size={16} className="text-[var(--color-iconDefault)]" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark size={16} className="text-[var(--color-iconDefault)]" /> },
  chat_agents: { title: 'Chat Agents', icon: <FaRobot size={16} className="text-[var(--color-iconDefault)]" /> },
  sessions: { title: 'Tab Sessions', icon: <SessionGridIcon size={16} className="text-[var(--color-iconDefault)]" /> },
  commands: { title: 'Commands', icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" /> },
  system_commands: { title: 'System Commands', icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" /> },
  automations: { title: 'Automations', icon: <FiZap size={16} className="text-[var(--color-iconDefault)]" /> },
};
export type SlashLauncherItem =
  | {
      kind: 'action';
      id: 'ai' | 'collections';
      title: string;
      description?: string;
      icon: React.ReactNode;
      keywords?: string[];
    }
  | {
      kind: 'category';
      id: string;
      title: string;
      alias: string;
      icon: React.ReactNode;
      keywords?: string[];
    };

const SUGGESTION_ACTION_ITEMS: Array<Extract<SlashLauncherItem, { kind: 'action' }>> = [
  {
    kind: 'action',
    id: 'ai',
    title: 'All AI Chat Agents',
    description: 'Search across all AI assistants at once',
    keywords: ['ai', 'chat', 'assistants', 'gpt', 'claude', 'gemini', 'perplexity'],
    icon: (
      <div className="flex -space-x-1.5 items-center justify-start shrink-0 py-0.5">
        {['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'].map((host, idx) => (
          <div
            key={host}
            className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-white shadow-sm shrink-0 relative"
            style={{ zIndex: 4 - idx }}>
            <img src={getFaviconUrl(host)} alt={host} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    ),
  },
  {
    kind: 'action',
    id: 'collections',
    title: 'All Command Shortcuts',
    description: 'Access all your saved collections and shortcuts',
    keywords: ['collections', 'shortcuts', 'commands', 'all', 'folders'],
    icon: (
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-[var(--color-iconDefault)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
    ),
  },
];

interface BoardViewProps {
  state?: SuggestionState | null;
  searchValue?: string;
  unfilteredSuggestions?: SuggestionListItem[];
  externalBookmarks?: SuggestionListItem[];
  onClose?: () => void;
  isLoggedIn?: boolean;
  extraGroups?: {
    title: string;
    items: SuggestionListItem[];
    icon: React.ReactNode;
  }[];
  onExecuteItem?: (item: any, e?: React.MouseEvent | KeyboardEvent) => boolean | void;
  hideCloseButton?: boolean;
  isEmbedded?: boolean;
  forceNativeStyling?: boolean;
  includeWebsitePageActions?: boolean;
  portalContainer?: HTMLElement;
  onSheetRedirect?: (section?: string) => void;
  onBoardRedirect?: () => void;
}

const BoardView = React.forwardRef<any, BoardViewProps>(({
  state,
  searchValue = '',
  unfilteredSuggestions = [],
  externalBookmarks = [],
  onClose,
  isLoggedIn,
  extraGroups = [],
  onExecuteItem,
  hideCloseButton = false,
  isEmbedded = false,
  forceNativeStyling = false,
  includeWebsitePageActions = false,
  portalContainer,
  onSheetRedirect,
  onBoardRedirect,
}, ref) => {
  const { theme } = useAppearance();

  React.useImperativeHandle(ref, () => ({
    openContextMenu: (x: number, y: number, fav: any) => {
      const type = (fav.type || fav.category || '').toLowerCase();
      let kind = type === 'note' || type === 'link' || type === 'snippet' ? 'snippet' : type;
      if (type === 'session') kind = 'session';
      if (type === 'command') kind = 'command';
      if (type === 'todo') kind = 'todo';
      if (type === 'automation') kind = 'automation';
      if (type === 'agent' || type === 'aiprompt' || type === 'chat_agent') kind = 'chat_agent';

      const realItemId = fav.item_id || fav.reference_id || fav.snippet_id || fav.note_id || fav.link_id || fav.commandId || fav.automation_id || fav.session_id || fav.id;

      const innerObj = {
        ...fav,
        id: realItemId,
        item_id: realItemId,
        folder_id: fav.folder_id || fav.folderId,
        workspace_id: fav.workspace_id || fav.workspaceId,
      };

      const item = {
        ...fav,
        _kind: kind,
        snippet: kind === 'snippet' ? innerObj : undefined,
        session: kind === 'session' ? innerObj : undefined,
        data: fav,
        id: realItemId,
        item_id: realItemId,
        folder_id: fav.folder_id || fav.folderId,
        workspace_id: fav.workspace_id || fav.workspaceId,
      };
      setContextMenuState({ x, y, item, preferDown: true });
    },
    executeFavorite: (fav: any, e?: any) => {
      const type = (fav.type || fav.category || '').toLowerCase();
      let kind = type === 'note' || type === 'link' || type === 'snippet' ? 'snippet' : type;
      if (type === 'session') kind = 'session';
      if (type === 'command') kind = 'command';
      if (type === 'todo') kind = 'todo';
      if (type === 'automation' || type === 'automations') kind = 'automation';
      if (type === 'agent' || type === 'aiprompt' || type === 'chat_agent' || type === 'prompt') kind = 'chat_agent';

      const item = {
        ...fav,
        _kind: kind,
        snippet: kind === 'snippet' ? fav : undefined,
        session: kind === 'session' ? fav : undefined,
        automation: kind === 'automation' ? fav : undefined,
        command: kind === 'command' ? fav : undefined,
        data: fav,
        id: fav.id || fav.snippet_id || fav.commandId,
      };

      // Call the internal executeItem method
      executeItem(item, e);
    }
  }));
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollLeftRef = useRef<number>(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollLeftRef.current = e.currentTarget.scrollLeft;
  }, []);

  React.useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeftRef.current;
    }
  });
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [slashDropdownSelectedIndex, setSlashDropdownSelectedIndex] = useState(-1);
  const [omniboxPrefixes, setOmniboxPrefixes] = useState<Awaited<ReturnType<typeof CustomSearchPrefixesForOmniboxStorage.getPrefixes>> | null>(null);

  useEffect(() => {
    const loadPrefixes = () => {
      CustomSearchPrefixesForOmniboxStorage.getPrefixes()
        .then(prefixes => {
          setOmniboxPrefixes(prefixes);
        })
        .catch(console.error);
    };

    loadPrefixes();
    window.addEventListener('omniboxPrefixesChanged', loadPrefixes);

    return () => {
      window.removeEventListener('omniboxPrefixesChanged', loadPrefixes);
    };
  }, []);

  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbSessions = useDbStore(state => state.sessions);
  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  const dbAutomations = useDbStore(state => state.automations);
  const dbChatAgents = useDbStore(state => state.chatAgents);
  const dbAiPrompts = useDbStore(state => state.aiPrompts);
  const expandedWorkspaces = useUIStore(state => state.expandedWorkspaces);
  const commands = useDbStore(state => state.commands);
  const visibleCommands = useMemo(() => commands.filter((cmd: any) => {
    if (cmd?.showInDashboard === false) return false;
    if (!includeWebsitePageActions) {
      if (cmd.surface === 'website' || cmd.category === 'thissite_action' || cmd.category === 'page_action') return false;
    }
    return true;
  }), [commands, includeWebsitePageActions]);
  const filterVisibleCommandSuggestions = (items: any[] = []) =>
    items.filter((item: any) => {
      const kind = item?._kind || item?.type;
      if (kind === 'command' || item?.commandType !== undefined) {
        if (item?.command?.showInDashboard === false || item?.showInDashboard === false) return false;
        const cmd = item?.command || item;
        if (cmd?.category === 'browser' && (!cmd?.prefix || cmd?.prefix.trim() === '')) return false;
        if (!includeWebsitePageActions) {
          if (cmd.surface === 'website' || cmd.category === 'thissite_action' || cmd.category === 'page_action') return false;
        }
      }
      return true;
    });

  // defaultWorkspaceId has been removed as it relied on the old architecture and is now dead code.

  const rawSearchValue = searchValue || state?.value || '';
  const prevSearchValueRef = useRef(rawSearchValue);
  const isSlashSelectedRef = useRef(false);
  const slashSectionAliases = useMemo(() => buildSlashSectionAliases(omniboxPrefixes), [omniboxPrefixes]);
  const slashAliasDisplay = useMemo(() => {
    const reverse: Record<string, string> = {};
    Object.entries(slashSectionAliases).forEach(([alias, section]) => {
      if (!reverse[section]) {
        reverse[section] = alias;
      }
    });
    return reverse;
  }, [slashSectionAliases]);
  const commandPrefix = getCommandSpacePrefix(omniboxPrefixes);
  const parsedSlashMode = useMemo(() => parseSlashMode(rawSearchValue, slashSectionAliases, commandPrefix), [rawSearchValue, slashSectionAliases, commandPrefix]);
  const slashMode = useMemo(() => {
    if (state?.showEmptySlashDropdown) {
      return {
        slashDropdown: true,
        activeSection: null,
        searchQuery: '',
      };
    }
    return parsedSlashMode;
  }, [parsedSlashMode, state?.showEmptySlashDropdown]);
  const normalizedSearchValue = rawSearchValue.replace(/\u00A0/g, ' ').trimStart().toLowerCase();
  const isBroadCommandMode =
    !slashMode.slashDropdown &&
    !slashMode.activeSection &&
    normalizedSearchValue.startsWith(`${commandPrefix} `);
  const isCommandSectionMode =
    isBroadCommandMode || slashMode.activeSection === 'commands' || (!slashMode.activeSection && selectedSidebarSection === 'commands');

  const effectiveSidebarSection = slashMode.slashDropdown
    ? 'all'
    : slashMode.activeSection && slashMode.activeSection !== 'all'
      ? slashMode.activeSection
      : isCommandSectionMode
        ? 'commands'
        : selectedSidebarSection;

  // Favorites, hotkeys and shortcuts state

  const [userId, setUserId] = useState('');
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [boardCollapsedGroups, setBoardCollapsedGroups] = useState<Record<string, boolean>>({
    active: false,
    overdue: false,
    scheduled_fut: false,
    completed: true, // completed collapsed by default to keep the UI clean
  });
  const [chromeBookmarks, setChromeBookmarks] = useState<any[]>([]);

  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; item: any; preferDown?: boolean } | null>(null);
  const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
  const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState<boolean>(false);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  const todoCreatePrefill = useUIStore(state =>
    state.activeEditor?.type === 'todo' ? state.activeEditor.props?.prefill : null,
  );
  const { captureHotkey } = useKeystrokeRecording(editValue, isMac);

  const handleCancelEdit = () => {
    setEditingShortcutFor(null);
    setEditingHotkeyFor(null);
    setEditValue('');
    setSaveError(null);
    setConflictId(null);
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get(['user_id'], (result: any) => {
            setUserId(result?.user_id || 'local_user');
          });
        } else {
          setUserId('local_user');
        }
      } catch {
        setUserId('local_user');
      }
    };
    getUser();

    const flattenBookmarks = (nodes: any[], result: any[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          result.push({
            id: `bookmark-${node.id}`,
            _kind: 'bookmark',
            type: 'bookmark',
            title: node.title,
            url: node.url,
          });
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      const chromeAny = (window as any)?.chrome;
      chromeAny?.bookmarks?.getTree?.((tree: any) => {
        const flattened = flattenBookmarks(tree);
        setChromeBookmarks(flattened);
      });
    };

    const chromeAny = (window as any)?.chrome;
    loadBookmarks();

    if (chromeAny?.bookmarks?.onRemoved) {
      chromeAny.bookmarks.onRemoved.addListener(loadBookmarks);
      chromeAny.bookmarks.onCreated.addListener(loadBookmarks);
      chromeAny.bookmarks.onChanged.addListener(loadBookmarks);
    }

    if (chromeAny?.storage?.local) {
      const handleChange = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          // Only reload bookmarks from storage changes, not todos.
        }
      };

      chromeAny.storage.onChanged.addListener(handleChange);

      return () => {
        chromeAny.storage.onChanged.removeListener(handleChange);
        if (chromeAny?.bookmarks?.onRemoved) {
          chromeAny.bookmarks.onRemoved.removeListener(loadBookmarks);
          chromeAny.bookmarks.onCreated.removeListener(loadBookmarks);
          chromeAny.bookmarks.onChanged.removeListener(loadBookmarks);
        }
      };
    }
    return undefined;
  }, []);

  const convertibleItems = useMemo(() => {
    const items: any[] = [];

    // 1. Notes, Links, Snippets, Sessions from IndexedDB
    dbNotes.forEach((n: any) => items.push({ id: n.id, name: n.title || n.key, category: 'note', data: n }));
    dbLinks.forEach((l: any) =>
      items.push({ id: l.id, name: l.title || l.key, category: 'link', _kind: 'link', data: l }),
    );
    dbSnippets.forEach((s: any) => items.push({ id: s.id, name: s.title || s.key, category: 'snippet', data: s }));
    dbSessions.forEach((s: any) =>
      items.push({ id: s.id, name: s.title || s.key, category: 'session', _kind: 'session', data: s }),
    );

    // 2. Flat Dexie collections for workspaces, folders, automations, and agents
    dbWorkspaces.forEach((workspace: any) => {
      items.push({
        id: workspace.id || workspace.workspace_id,
        name: workspace.name || workspace.workspace_name || 'Workspace',
        category: 'workspace',
        data: workspace,
      });
    });

    dbFolders.forEach((folder: any) => {
      items.push({
        id: folder.id || folder.folder_id,
        name: folder.name || folder.folder_name || 'Folder',
        category: 'folder',
        data: folder,
      });
    });

    dbAutomations.forEach((auto: any) => {
      items.push({
        id: auto.id || auto.automation_id,
        name: auto.name || auto.title || 'Automation',
        category: 'automation',
        data: auto,
      });
    });

    dbChatAgents.forEach((agent: any) => {
      items.push({
        id: agent.id || agent.agent_id || agent.chat_agent_id,
        name: agent.name || agent.title || 'Agent',
        category: 'agent',
        data: agent,
      });
    });

    dbAiPrompts.forEach((prompt: any) => {
      items.push({
        id: prompt.id,
        name: prompt.title || 'Chat Agent',
        category: 'aiPrompt',
        data: prompt,
      });
    });

    // 2. Commands
    visibleCommands.forEach(cmd => {
      items.push({
        id: `cmd-${cmd.id}`,
        name: cmd.label,
        category: 'command',
        data: { ...cmd, key: cmd.label, value: cmd.id },
      });
    });

    // 3. Local Commands
    return items;
  }, [
    dbNotes,
    dbLinks,
    dbSnippets,
    dbWorkspaces,
    dbFolders,
    dbAutomations,
    dbChatAgents,
    dbAiPrompts,
    visibleCommands,
  ]);

  const [asyncItems, setAsyncItems] = useState<any[]>([]);
  useEffect(() => {
    const loadModules = async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.storage?.local) return;
      const storage: any = await new Promise(resolve => chromeAny.storage.local.get(['installed_modules'], resolve));
      const localModules = storage.installed_modules || [];

      const mapModules = (modules: any[]) =>
        modules.map((m: any) => ({
          id: `mod-${m.id || m.installation_id || m.module_id || m.installationId}`,
          name: m.name || m.module_name || m.label || 'Untitled Module',
          category: 'module',
          data: m,
        }));

      if (Array.isArray(localModules) && localModules.length > 0) {
        setAsyncItems(mapModules(localModules));
      }
    };

    loadModules();

    const listener = (changes: any) => {
      if (changes.installed_modules) {
        loadModules();
      }
    };
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(listener);
      return () => chromeAny.storage.onChanged.removeListener(listener);
    }
    return undefined;
  }, []);

  const finalConvertibleItems = useMemo(() => {
    return [...convertibleItems, ...asyncItems];
  }, [convertibleItems, asyncItems]);

  const rawTodos = useDbStore(state => state.todos);
  const todosList = useMemo(() => {
    return rawTodos.map(t => ({
      ...t,
      _kind: 'todo',
      type: 'todo',
      snippet_id: t.id,
      todo_id: t.id,
      key: t.name,
      title: t.name,
      is_done: t.isDone,
      is_todo_type: true,
      is_recurring: !!t.recurringType,
      config: { id: t.references?.map((r: any) => r.id) || [], title: t.name },
      event_deadline: t.scheduleTime ? new Date(t.scheduleTime).toISOString() : null,
    }));
  }, [rawTodos]);

  const { favorites: userFavorites, toggleFavorite: toggleSharedFavorite } = useFavorites();
  const favoriteIdSet = useMemo(() => {
    const set = new Set<string>();
    userFavorites.forEach(fav => {
      set.add(String(fav.reference_id));
      const rawId = extractSnippetIdFromCompoundId(fav.reference_id);
      if (rawId) set.add(rawId);
    });
    return set;
  }, [userFavorites]);

  const getSessionReferenceIds = (item: any) => {
    const primaryId = getItemCompoundId(item);
    const rawId =
      extractSnippetIdFromCompoundId(primaryId) ||
      String(item?.session?.id || item?.snippet?.id || item?.snippet?.snippet_id || item?.id || '');

    const ids = [primaryId];
    if (rawId && rawId !== primaryId) ids.push(rawId);
    return ids.filter(Boolean);
  };

  const toggleFavoriteForItem = async (item: any) => {
    const kind = item._kind || item.type;
    const category = String(item.snippet?.category || item.category || '').toLowerCase();
    const referenceType =
      kind === 'command'
        ? 'command'
        : kind === 'aiPrompt'
          ? 'aiPrompt'
          : kind === 'chat_agent'
            ? 'chat_agent'
            : category === 'automation'
              ? 'automation'
              : category === 'link' || kind === 'bookmark'
                ? 'link'
                : kind === 'session' || category === 'session'
                  ? 'session'
                  : 'note';

    const compoundId = getItemCompoundId(item);
    const rawId =
      extractSnippetIdFromCompoundId(compoundId) ||
      String(item.snippet?.id || item.snippet?.snippet_id || item.todo_id || item.id || '');
    const label = getTitle(item);
    const targetReferenceId = compoundId || rawId;

    console.log('[BoardView][Favorite] Toggle requested', {
      kind,
      category,
      referenceType,
      label,
      targetReferenceId,
      compoundId,
      rawId,
      item,
    });

    try {
      if (isEmbedded) {
        chrome.runtime.sendMessage({
          action: 'toggle_favorite',
          payload: { targetReferenceId, referenceType, label },
          userId: userId || 'local_user'
        });
      } else {
        await toggleSharedFavorite(targetReferenceId, referenceType, label);
      }
      console.log('[BoardView][Favorite] Toggle completed', {
        kind,
        category,
        referenceType,
        label,
        targetReferenceId,
      });
      useUIStore.getState().queueNotification({
        message: `⭐ Favorite updated`,
        type: 'info',
      });
    } catch (error: any) {
      console.error('[BoardView][Favorite] Toggle failed', {
        kind,
        category,
        referenceType,
        label,
        targetReferenceId,
        compoundId,
        rawId,
        message: error?.message || String(error),
        error,
      });
      throw error;
    }
  };

  const saveHotkey = async (item: any, hotkeyValue: string, shouldClose = true) => {
    const itemId = getItemCompoundId(item);
    const kind = item._kind || item.type;
    const category = String(item.snippet?.category || item.category || '').toLowerCase();
    const isSessionItem = kind === 'session' || category === 'session';
    const sessionReferenceIds = isSessionItem ? getSessionReferenceIds(item) : [itemId];
    const [primarySessionId, legacySessionId] = sessionReferenceIds;

    useUIStore.getState().setCommandStatus({
      status: 'loading',
      message: !hotkeyValue ? 'Clearing...' : isUpdatingHotkey ? 'Updating...' : 'Saving...',
    });
    setIsSaving(true);

    try {
      if (!hotkeyValue) {
        for (const referenceId of sessionReferenceIds) {
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'delete_user_hotkey', payload: { referenceId }, userId: userId || 'local_user' });
          } else {
            await deleteUserHotkeyByReference(referenceId);
          }
        }
      } else {
        const type =
          kind === 'command'
            ? 'command'
            : kind === 'aiPrompt' || kind === 'chat_agent' || category === 'automation'
              ? 'automation'
              : isSessionItem
                ? 'session'
                : category === 'link'
                  ? 'link'
                  : 'note';
        if (legacySessionId) {
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'delete_user_hotkey', payload: { referenceId: legacySessionId }, userId: userId || 'local_user' });
          } else {
            await deleteUserHotkeyByReference(legacySessionId);
          }
        }
        if (isEmbedded) {
          chrome.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue, referenceId: primarySessionId || itemId, referenceType: type }, userId: userId || 'local_user' });
        } else {
          await saveUserHotkey(hotkeyValue, primarySessionId || itemId, type as any);
        }
      }

      useUIStore.getState().setCommandStatus({ status: 'success', message: !hotkeyValue ? 'Cleared' : 'Saved' });
      useUIStore.getState().queueNotification({
        message: !hotkeyValue ? '⌨️ Hotkey cleared' : '⌨️ Hotkey saved',
        type: 'success',
      });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear hotkey:', error);
      useUIStore.getState().setCommandStatus({ status: 'error', message: error.message || 'Failed to update hotkey' });
      useUIStore.getState().queueNotification({
        message: error.message || 'Failed to update hotkey',
        type: 'error',
      });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
      if (shouldClose) {
        setEditingHotkeyFor(null);
        setEditValue('');
        setSaveError(null);
      } else {
        setEditValue(hotkeyValue);
        setSaveError(null);
      }
    }
  };

  const saveShortcut = async (item: any, shortcutValue: string) => {
    const itemId = getItemCompoundId(item);
    const kind = item._kind || item.type;
    const category = String(item.snippet?.category || item.category || '').toLowerCase();
    const isSessionItem = kind === 'session' || category === 'session';
    const sessionReferenceIds = isSessionItem ? getSessionReferenceIds(item) : [itemId];
    const [primarySessionId, legacySessionId] = sessionReferenceIds;
    const normalized = String(shortcutValue || '')
      .trim()
      .toLowerCase();

    useUIStore.getState().setCommandStatus({
      status: 'loading',
      message: !normalized ? 'Clearing...' : isUpdatingShortcut ? 'Updating...' : 'Saving...',
    });
    setIsSaving(true);

    try {
      if (!normalized) {
        for (const referenceId of sessionReferenceIds) {
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'delete_user_shortcut', payload: { referenceId }, userId: userId || 'local_user' });
          } else {
            await deleteUserShortcutByReference(referenceId);
          }
        }
      } else {
        if (kind === 'command') {
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'api_save_shortcut', payload: { id: itemId, referenceId: itemId, trigger: normalized, label: getTitle(item), type: 'command' }, userId: userId || 'local_user' });
          } else {
            await apiSaveShortcut(itemId, itemId, normalized, getTitle(item), 'command');
          }
        } else if (kind === 'aiPrompt' || kind === 'chat_agent') {
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'api_save_shortcut', payload: { id: itemId, referenceId: itemId, trigger: normalized, label: getTitle(item), type: 'automation' }, userId: userId || 'local_user' });
          } else {
            await apiSaveShortcut(itemId, itemId, normalized, getTitle(item), 'automation' as any);
          }
        } else if (isSessionItem) {
          if (legacySessionId) {
            if (isEmbedded) {
              chrome.runtime.sendMessage({ action: 'delete_user_shortcut', payload: { referenceId: legacySessionId }, userId: userId || 'local_user' });
            } else {
              await deleteUserShortcutByReference(legacySessionId);
            }
          }
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'api_save_shortcut', payload: { id: primarySessionId || itemId, referenceId: primarySessionId || itemId, trigger: normalized, label: getTitle(item), type: 'session' }, userId: userId || 'local_user' });
          } else {
            await apiSaveShortcut(primarySessionId || itemId, primarySessionId || itemId, normalized, getTitle(item), 'session' as any);
          }
        } else {
          const type = kind === 'command' ? 'command' : category === 'link' ? 'link' : 'note';
          if (isEmbedded) {
            chrome.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized, referenceId: itemId, type }, userId: userId || 'local_user' });
          } else {
            await saveUserShortcut(normalized, itemId, type as any);
          }
        }
      }

      useUIStore.getState().setCommandStatus({ status: 'success', message: !normalized ? 'Cleared' : 'Saved' });
      useUIStore.getState().queueNotification({
        message: !normalized ? '⚡ Shortcut cleared' : '⚡ Shortcut saved',
        type: 'success',
      });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } catch (error: any) {
      console.error('[BoardView] Failed to save/clear shortcut:', error);
      useUIStore
        .getState()
        .setCommandStatus({ status: 'error', message: error.message || 'Failed to update shortcut' });
      useUIStore.getState().queueNotification({
        message: error.message || 'Failed to update shortcut',
        type: 'error',
      });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
      setEditingShortcutFor(null);
      setEditValue('');
      setSaveError(null);
    }
  };

  const handleOverwriteHotkey = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    useUIStore.getState().setCommandStatus({ status: 'loading', message: 'Overwriting existing hotkey...' });

    try {
      // Clear existing conflict using full compound ID — no ID stripping
      await deleteUserHotkeyByReference(conflictId);
      await saveHotkey(contextMenuState.item, editValue);
      setEditingHotkeyFor(null);
      setEditValue('');
      setConflictId(null);
      await new Promise(resolve => setTimeout(resolve, 800));
      setContextMenuState(null);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Overwrite failed' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string) => {
    if (!conflictId || !contextMenuState?.item) return;
    setIsSaving(true);
    useUIStore.getState().setCommandStatus({ status: 'loading', message: 'Overwriting existing shortcut...' });

    try {
      // Clear existing conflict using full compound ID — no ID stripping
      await deleteUserShortcutByReference(conflictId);
      await saveShortcut(contextMenuState.item, editValue);
      setEditingShortcutFor(null);
      setEditValue('');
      setConflictId(null);
      await new Promise(resolve => setTimeout(resolve, 800));
      setContextMenuState(null);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Overwrite failed' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoToConflict = () => {
    if (conflictId) {
      useUIStore.getState().setHighlightedCommandId(conflictId);
      setContextMenuState(null);
    }
  };

  const buildContextMenuActions = (item: any) => {
    const kind = item._kind || item.type;
    const isNote =
      kind === 'snippet' &&
      !['link', 'tabgroup', 'Tab Session', 'automation', 'agent', 'snippet'].includes(
        String(item.snippet?.category || '').toLowerCase(),
      );
    const isSnippet =
      kind === 'snippet' &&
      String(item.snippet?.category || '').toLowerCase() === 'snippet';
    const isSession =
      kind === 'session' ||
      (kind === 'snippet' && ['session'].includes(String(item.snippet?.category || '').toLowerCase())) ||
      (item as any).category === 'session';
    const isLink =
      (kind === 'snippet' && ['link'].includes(String(item.snippet?.category || '').toLowerCase())) ||
      kind === 'link' ||
      kind === 'bookmark';
    const isTabGroup =
      kind === 'snippet' && ['tabgroup', 'Tab Session'].includes(String(item.snippet?.category || '').toLowerCase());
    const isTodo = kind === 'todo';
    const isCommand = kind === 'command' || kind === 'common_command';
    const isAutomation =
      kind === 'automation' ||
      kind === 'agent' ||
      (kind === 'snippet' && String(item.snippet?.category || '').toLowerCase() === 'automation');

    const isEditable =
      kind === 'snippet' || kind === 'link' || kind === 'session' || kind === 'bookmark' || isTodo || isAutomation;
    const isFavoriteable = isEditable || isCommand;
    const isShortcuttable = isEditable || isCommand;

    const actions: any[] = [];

    if (isNote) {
      actions.push({
        key: 'open-AltS_search_newtab',
        label: `Open in full screen ${isMac ? '(⌘+Enter)' : '(Ctrl+Enter)'}`,
        icon: <FiExternalLink size={14} />,
        onSelect: () => {
          const snippetId = item.snippet?.snippet_id || item.snippet?.id;
          if (snippetId) {
            openTab({
              url: (window as any).chrome.runtime.getURL(
                `AltS_search_newtab/index.html?alts_action=true&type=note&id=${encodeURIComponent(snippetId)}`,
              ),
            });
          }
        },
      });
    }

    if (kind === 'snippet' || kind === 'aiPrompt' || kind === 'chat_agent' || isEditable) {
      const isChatAgent = kind === 'aiPrompt' || kind === 'chat_agent';
      const labelText = isTodo
        ? 'Edit todo'
        : isChatAgent
          ? 'Edit Agent'
          : isTabGroup
            ? 'Edit routine'
            : isSession
              ? 'Edit Tab Session'
              : isLink
                ? 'Edit link'
                : isSnippet
                  ? 'Edit snippet'
                  : 'Edit note';
      actions.push({
        key: 'edit',
        label: `${labelText} ${isMac ? '(⌘+Shift+E)' : '(Alt+Shift+E)'}`,
        icon: <FiEdit2 size={14} />,
        onSelect: () => {
          if (isChatAgent) {
            const mergedAgent = {
              ...item.data,
              favorite: item.favorite ?? item.data?.favorite,
              tags: item.tags ?? item.data?.tags,
              shortcut: item.shortcut ?? item.data?.shortcut,
              hotkey: item.hotkey ?? item.data?.hotkey,
            };
            const originalType = (item.data?.type || item.data?.category || kind).toLowerCase();
            const targetEditorType = (originalType === 'aiprompt' || originalType === 'prompt') ? 'aiPrompt' : 'agent';
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', targetEditorType);
              url.searchParams.set('entityId', String(item.id || item.data?.id));
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ props: { item: mergedAgent, snippet: mergedAgent } }));
              openTab({ url: url.toString() });
            } else {
              useUIStore.getState().openEditor({ type: targetEditorType as any, id: item.id || item.data?.id, props: { item: mergedAgent } });
            }
            return;
          }
          const actualSnippet = item.snippet || item.session || item.data || item;
          if (isTodo) {
            const prefill = {
              todo_id: actualSnippet.id || item.todo_id || item.id,
              snippet_id: actualSnippet.id || item.todo_id || item.id,
              is_todo_type: true,
              key: actualSnippet.name || actualSnippet.title || '',
              title: actualSnippet.name || actualSnippet.title || '',
              value: actualSnippet.description || actualSnippet.value || '',
              event_deadline: actualSnippet.scheduleTime
                ? new Date(actualSnippet.scheduleTime).toISOString()
                : actualSnippet.event_deadline || null,
              is_recurring: actualSnippet.scheduleType === 'recurring' || !!actualSnippet.is_recurring,
              recurring_cycle: actualSnippet.recurringType || actualSnippet.recurring_cycle || null,
              is_anytime: actualSnippet.isAnytime || actualSnippet.is_anytime || false,
              is_done: actualSnippet.isDone || actualSnippet.is_done || false,
              config: actualSnippet.references
                ? {
                  id: actualSnippet.references.map((r: any) => r.id),
                  title: actualSnippet.name,
                }
                : actualSnippet.config || null,
              shortcut: actualSnippet.shortcut || item.shortcut || item.data?.shortcut || '',
              tags: actualSnippet.tags || item.tags || item.data?.tags || [],
              favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
              hotkey: actualSnippet.hotkey || item.hotkey || item.data?.hotkey,
            };
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', 'todo');
              url.searchParams.set('entityId', prefill.todo_id);
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ props: { prefill, item: prefill, snippet: prefill } }));
              openTab({ url: url.toString() });
            } else {
              useUIStore.getState().setTodoCreatePrefill(prefill);
              useUIStore.getState().openEditor({
                type: 'todo',
                id: prefill.todo_id,
                props: { prefill },
              });
            }
          } else if (isSession) {
            const mergedSession = {
              ...actualSnippet,
              favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
              tags: actualSnippet.tags || item.tags || item.data?.tags,
              shortcut: actualSnippet.shortcut || item.shortcut || item.data?.shortcut,
              hotkey: actualSnippet.hotkey || item.hotkey || item.data?.hotkey,
            };
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('session_mode', 'true');
              url.searchParams.set('session_id', actualSnippet.id);
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ props: { snippet: mergedSession, session: mergedSession, item: mergedSession } }));
              openTab({ url: url.toString() });
            } else {
              useUIStore.getState().openEditor({
                type: 'session',
                id: actualSnippet.id,
                props: { snippet: mergedSession, session: mergedSession, item: mergedSession },
              });
            }
          } else if (isLink || isTabGroup) {
            const wsId = item.workspace?.workspace_id || actualSnippet?.workspaceId || actualSnippet?.workspace_id;
            const fId = item.folder?.folder_id || actualSnippet?.folderId || actualSnippet?.folder_id;
            const suggestionPayload = {
              item: {
                ...actualSnippet,
                favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
                tags: actualSnippet.tags || item.tags || item.data?.tags,
                shortcut: actualSnippet.shortcut || item.shortcut || item.data?.shortcut,
                hotkey: actualSnippet.hotkey || item.hotkey || item.data?.hotkey,
              },
              workspace: item.workspace || (wsId ? { workspace_id: wsId } : null),
              folder: item.folder || (fId ? { folder_id: fId } : null),
            };
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', 'link');
              url.searchParams.set('entityId', String(item.id || item.data?.id));
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ linkPrefill: suggestionPayload, props: { snippet: suggestionPayload.item, item: suggestionPayload.item } }));
              openTab({ url: url.toString() });
              return;
            }

            useUIStore.getState().setLinkEditPrefill(suggestionPayload);
            useUIStore.getState().openEditor({
              type: 'link',
              id: actualSnippet.id || item.id,
              props: { snippet: suggestionPayload.item }
            });
          } else if (isSnippet) {
            const mergedSnippet = {
              ...actualSnippet,
              favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
              tags: actualSnippet.tags || item.tags || item.data?.tags,
              shortcut: actualSnippet.shortcut || item.shortcut || item.data?.shortcut,
              hotkey: actualSnippet.hotkey || item.hotkey || item.data?.hotkey,
              category: 'snippet'
            };
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', 'note');
              url.searchParams.set('entityId', String(actualSnippet.snippet_id || actualSnippet.id || item.id || item.data?.id));
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ props: { item: mergedSnippet, snippet: mergedSnippet, category: 'snippet' } }));
              openTab({ url: url.toString() });
            } else {
              useUIStore.getState().openEditor({
                type: 'note',
                id: String(actualSnippet.snippet_id || actualSnippet.id || item.id || item.data?.id),
                props: { item: mergedSnippet, snippet: mergedSnippet, category: 'snippet' },
              });
            }
          } else if (isNote) {
            const mergedNote = {
              ...actualSnippet,
              favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
              tags: actualSnippet.tags || item.tags || item.data?.tags,
              shortcut: actualSnippet.shortcut || item.shortcut || item.data?.shortcut,
              hotkey: actualSnippet.hotkey || item.hotkey || item.data?.hotkey,
            };
            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              const url = new URL((window as any).chrome.runtime.getURL('AltS_search_newtab/index.html'));
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', 'note');
              url.searchParams.set('entityId', String(item.id || item.data?.id));
              url.searchParams.set('edit_mode', 'true');
              url.searchParams.set('editorProps', JSON.stringify({ props: { item: mergedNote, snippet: mergedNote } }));
              openTab({ url: url.toString() });
            } else {
              useUIStore.getState().openEditor({
                type: 'note',
                id: String(item.id || item.data?.id),
                props: {
                  item: mergedNote,
                  snippet: mergedNote,
                  initialDraftKey: mergedNote.title || mergedNote.name || mergedNote.key,
                  initialDraftContent: mergedNote.body || mergedNote.content || mergedNote.value,
                },
              });
            }
          } else {
            executeItem(item);
          }
        },
      });

      if (!isTodo) {
        actions.push({
          key: 'create-todo',
          label: 'Create Todo',
          icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
          onSelect: () => {
            const actualSnippet = item.snippet || item.session || item.data || item;
            const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.id;
            const snippetKey = actualSnippet?.key || actualSnippet?.title || actualSnippet?.name || getTitle(item);

            let snippetValue = '';
            if (actualSnippet?.value) {
              snippetValue =
                typeof actualSnippet.value === 'string' ? actualSnippet.value : JSON.stringify(actualSnippet.value);
            } else if (actualSnippet?.body) {
              snippetValue = actualSnippet.body;
            } else if (actualSnippet?.urls) {
              snippetValue = JSON.stringify({ urls: actualSnippet.urls.map((u: any) => u.url) });
            }

            if (isEmbedded && (window as any).chrome?.runtime?.getURL) {
              openTab({ url: (window as any).chrome.runtime.getURL(`AltS_search_newtab/index.html?create_todo=true`) });
            } else {
              useUIStore.getState().openEditor({
                type: 'todo',
                id: 'new',
                props: {
                  prefill: {
                    snippet_id: snippetId,
                    key: snippetKey,
                    value: snippetValue,
                    category: actualSnippet?.category || item.kind,
                  },
                },
              });
              useUIStore.getState().setSidebar('todoSidebar', { open: true });
            }
          },
        });
      }

      actions.push({
        key: 'delete',
        label: 'Delete',
        icon: <FiTrash2 size={14} />,
        className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
        onSelect: () => {
          const actualSnippet = item.snippet || item.session || item.data || item;
          const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.todo_id || item.id;
          if (state?.onRequestSnippetDelete && snippetId) {
            let commandId:
              | 'delete_snippet'
              | 'delete_link'
              | 'delete_folder'
              | 'delete_todo'
              | 'delete_session'
              | 'delete_prompt'
              | 'delete_agent'
              | 'delete_automation' = 'delete_snippet';
            if (isLink) commandId = 'delete_link';
            else if (isTodo) commandId = 'delete_todo';
            else if (isSession) commandId = 'delete_session';
            else if (kind === 'aiPrompt') commandId = 'delete_prompt';
            else if (kind === 'chat_agent') commandId = 'delete_agent';
            else if (isAutomation) commandId = 'delete_automation';

            const wsId = item.workspace?.workspace_id || actualSnippet?.workspaceId || actualSnippet?.workspace_id;
            const fId = item.folder?.folder_id || actualSnippet?.folderId || actualSnippet?.folder_id;

            state.onRequestSnippetDelete({
              snippetId,
              snippetKey: actualSnippet?.key || actualSnippet?.title || actualSnippet?.name || getTitle(item),
              id: snippetId,
              key: actualSnippet?.key || actualSnippet?.title || actualSnippet?.name || getTitle(item),
              category: actualSnippet?.category || (isLink ? 'link' : isTodo ? 'todo' : kind),
              workspaceId: wsId || '',
              folderId: fId,
              commandId,
            });
            return;
          }
          if (kind === 'aiPrompt' || kind === 'chat_agent') {
            const id = item.id || item.data?.id;
            if (id) {
              deleteAiPrompt(id).catch(console.error);
            }
            return;
          }
          if (isSession) {
            const actualSnippet = item.snippet || item.session || item.data || item;
            const snippetId = actualSnippet?.snippet_id || actualSnippet?.id || item.id;
            if (snippetId) {
              deleteSession(snippetId).catch(console.error);
            }
            return;
          }
        },
      });
    }

    if (
      !isTodo &&
      (kind === 'snippet' ||
        kind === 'command' ||
        kind === 'common_command' ||
        kind === 'aiPrompt' ||
        kind === 'chat_agent' ||
        isFavoriteable)
    ) {
      actions.push({ key: `div-fav-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const rawId = extractSnippetIdFromCompoundId(compoundId);
      const isFav = favoriteIdSet.has(compoundId) || favoriteIdSet.has(rawId);

      actions.push({
        key: 'favorite',
        label: isFav ? 'Remove from favourites' : 'Mark as favourite',
        icon: isFav ? <FaStar size={14} className="text-yellow-500" /> : <FiStar size={14} />,
        closeOnExecute: false,
        onSelect: () => {
          console.log('[BoardView][UnifiedContextMenu][Favorite] Clicked', {
            isFav,
            kind,
            category: String(item.snippet?.category || item.category || '').toLowerCase(),
            compoundId,
            rawId,
            item,
            usesExternalToggleHandler: !!state?.onToggleFavorite,
          });
          if (state?.onToggleFavorite) {
            state.onToggleFavorite(item);
          } else {
            void toggleFavoriteForItem(item);
          }
        },
      });
    }

    if (
      !isTodo &&
      (kind === 'snippet' || kind === 'command' || kind === 'aiPrompt' || kind === 'chat_agent' || isShortcuttable)
    ) {
      actions.push({ key: `div-assign-0`, divider: true });

      const compoundId = getItemCompoundId(item);
      const rawId = extractSnippetIdFromCompoundId(compoundId);
      const directId = item.id || item.item_id || item.reference_id || item.snippet?.id || '';

      const candidateIds = Array.from(new Set([compoundId, rawId, directId, item.compoundId].filter(Boolean)));
      const sessionReferenceIds = isSession ? getSessionReferenceIds(item) : candidateIds;
      const currentShortcut = sessionReferenceIds.map(id => shortcutsMap[id]).find(Boolean) || item.shortcut || item.data?.shortcut || '';
      const normalizedCurrentShortcut = currentShortcut ? normalizeShortcutTrigger(currentShortcut) : '';

      if (currentShortcut) {
        actions.push({
          key: 'remove-shortcut',
          label: `Remove command`,
          shortcut: normalizedCurrentShortcut,
          icon: <FiTrash2 size={14} />,
          className: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400',
          closeOnExecute: true,
          onSelect: async () => {
            await saveShortcut(item, '');
          },
        });
      }

      actions.push({
        key: 'assign-shortcut',
        label: currentShortcut ? 'Edit command' : 'Assign command',
        shortcut: normalizedCurrentShortcut,
        icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingShortcutFor(compoundId);
          setEditingHotkeyFor(null);
          const displayValue = normalizedCurrentShortcut;
          setEditValue(displayValue);
          setIsUpdatingShortcut(!!currentShortcut);
          setSaveError(null);
        },
      });

      const currentHotkey = sessionReferenceIds.map(id => hotkeysMap[id]).find(Boolean) || item.hotkey || item.data?.hotkey || '';

      if (currentHotkey) {
        actions.push({
          key: 'remove-hotkey',
          label: `Remove hotkey`,
          shortcut: currentHotkey,
          icon: <FiTrash2 size={14} />,
          className: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400',
          closeOnExecute: true,
          onSelect: async () => {
            await saveHotkey(item, '', true);
          },
        });
      }

      actions.push({
        key: 'assign-hotkey',
        label: currentHotkey ? 'Edit hotkey' : 'Assign hotkey',
        shortcut: currentHotkey,
        icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
        className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
        closeOnExecute: false,
        onSelect: async () => {
          setEditingHotkeyFor(compoundId);
          setEditingShortcutFor(null);
          setEditValue(currentHotkey || '');
          setIsUpdatingHotkey(!!currentHotkey);
          setSaveError(null);
        },
      });
    }

    return actions;
  };

  const query = (rawSearchValue || '').trim();
  const hasSelectedCategorySearch =
    selectedSidebarSection !== 'all' &&
    !!query &&
    !query.startsWith('/') &&
    !slashMode.activeSection &&
    !isCommandSectionMode;

  // When query is empty OR slash mode is active, build items directly from Dexie/current team.
  // Slash mode must bypass state.suggestions because the Searchbar filters suggestions
  // using the raw text (e.g. '/L'), which matches nothing and returns 0 results.
  const isSlashModeActive =
    query.startsWith('/') || isCommandSectionMode || !!slashMode.activeSection || hasSelectedCategorySearch;
  let sourceItems: SuggestionListItem[];
  if (query.length === 0 || isSlashModeActive) {
    // Build from Dexie/current team directly
    const boardItems: SuggestionListItem[] = [];
    // Add Dexie items (notes, links,snippets)
    dbNotes.forEach((n: any) =>
      boardItems.push({
        _kind: 'snippet',
        snippet: { ...n, category: n.category || 'note' },
        workspace: n.workspaceId ? { workspace_id: n.workspaceId } : null,
        folder: n.folderId ? { folder_id: n.folderId } : null,
      } as any),
    );
    dbLinks.forEach((l: any) =>
      boardItems.push({
        _kind: 'snippet',
        snippet: { ...l, category: l.category || 'link' },
        workspace: l.workspaceId ? { workspace_id: l.workspaceId } : null,
        folder: l.folderId ? { folder_id: l.folderId } : null,
      } as any),
    );
    dbSnippets.forEach((s: any) =>
      boardItems.push({
        _kind: 'snippet',
        snippet: { ...s, category: s.category || 'snippet' },
        workspace: s.workspaceId ? { workspace_id: s.workspaceId } : null,
        folder: s.folderId ? { folder_id: s.folderId } : null,
      } as any),
    );
    dbSessions.forEach((s: any) =>
      boardItems.push({
        _kind: 'session',
        session: s,
        workspace: s.workspaceId ? { workspace_id: s.workspaceId } : null,
        folder: s.folderId ? { folder_id: s.folderId } : null,
      } as any),
    );
    dbChatAgents.forEach((agent: any) => boardItems.push({ _kind: 'chat_agent', ...agent } as any));
    dbAiPrompts.forEach((prompt: any) => boardItems.push({ _kind: 'aiPrompt', ...prompt } as any));
    dbAutomations.forEach((automation: any) => boardItems.push({ _kind: 'automation', automation } as any));

    // Add all commands from the central store
    visibleCommands.forEach((cmd: any) => {
      boardItems.push({
        _kind: 'command',
        commandType: 'remote',
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        command: cmd,
      } as any);
    });

    // Add website-only page action commands only when explicitly enabled.
    if (includeWebsitePageActions) {
      PAGE_ACTION_ITEMS.forEach((cmd: any) => {
        boardItems.push({
          ...cmd,
          _kind: 'command',
          commandType: 'page_action',
          command: cmd,
        } as any);
      });
    }

    const availableBookmarks = externalBookmarks.length > 0 ? externalBookmarks : chromeBookmarks;

    if (availableBookmarks.length > 0) {
      boardItems.push(...availableBookmarks);
    } else {
      const fallbackSuggestions = unfilteredSuggestions.length > 0 ? unfilteredSuggestions : state?.suggestions || [];
      fallbackSuggestions.forEach((item: any) => {
        const kind = item._kind || item.type;
        if (kind === 'bookmark') {
          boardItems.push(item);
        }
      });
    }

    const cachedCategoryItems = filterVisibleCommandSuggestions([
      ...(unfilteredSuggestions || []),
      ...(state?.suggestions || []),
    ]).filter((item: any) => {
      const kind = item?._kind || item?.type;
      if (kind !== 'workspace_item' && kind !== 'session' && kind !== 'chat_agent' && kind !== 'aiPrompt' && kind !== 'automation')
        return false;
      const category = String(item?.item?.category || item?.category || item?.snippet?.category || '').toLowerCase();
      return [
        'note',
        'notes',
        'link',
        'links',
        'snippet',
        'snippets',
        'session',
        'sessions',
        'tab session',
        'tabgroup',
        'todo',
        'todos',
        'bookmark',
        'bookmarks',
        'automation',
        'automations',
        'aiprompt',
        'ai_prompt',
        'prompt',
        'chatagent',
        'chat_agent',
        'agent',
      ].includes(category) || kind !== 'workspace_item';
    });

    const getCategoryMergeKeys = (item: any): string[] => {
      const kind = String(item?._kind || item?.type || '').toLowerCase();
      const category = String(
        item?.item?.category ||
        item?.snippet?.category ||
        item?.category ||
        (kind === 'aiprompt' || kind === 'chat_agent' || kind === 'chatagent' || kind === 'agent' ? 'agent' : kind),
      ).toLowerCase();
      const normalizedCategory = ['sessions', 'tab session', 'tabgroup'].includes(category)
        ? 'session'
        : ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent'].includes(category)
          ? 'agent'
          : category;
      const id = String(
        item?.item?.id ||
        item?.item?.item_id ||
        item?.id ||
        item?.session?.id ||
        item?.session?.session_id ||
        item?.automation?.id ||
        item?.automation?.automation_id ||
        item?.snippet?.id ||
        item?.snippet?.snippet_id ||
        item?.data?.id ||
        '',
      ).trim().toLowerCase();
      const title = String(
        item?.item?.title ||
        item?.item?.key ||
        item?.item?.name ||
        item?.session?.title ||
        item?.session?.key ||
        item?.session?.name ||
        item?.snippet?.title ||
        item?.snippet?.key ||
        item?.snippet?.name ||
        item?.data?.title ||
        item?.data?.key ||
        item?.data?.name ||
        item?.title ||
        item?.key ||
        item?.name ||
        '',
      ).trim().toLowerCase();

      return [
        id ? `${normalizedCategory}:id:${id}` : '',
        title ? `${normalizedCategory}:title:${title}` : '',
      ].filter(Boolean);
    };

    const getShortcutBadge = (item: any) =>
      item?._displayShortcut || item?.item?._displayShortcut || item?.shortcut || item?.data?.shortcut || '';

    const seenCategoryItems = new Map<string, any>();
    boardItems.forEach((item: any) => {
      getCategoryMergeKeys(item).forEach(key => seenCategoryItems.set(key, item));
    });

    cachedCategoryItems.forEach((item: any) => {
      const keys = getCategoryMergeKeys(item);
      const existing = keys.map(key => seenCategoryItems.get(key)).find(Boolean);
      if (existing) {
        const shortcutBadge = getShortcutBadge(item);
        if (shortcutBadge && !getShortcutBadge(existing)) {
          existing._displayShortcut = shortcutBadge;
        }
        return;
      }
      keys.forEach(key => seenCategoryItems.set(key, item));
      boardItems.push(item);
    });

    // Add todos — show ALL non-done todos in Board View so nothing is hidden

    const mappedTodos = todosList.map(t => ({
      ...t,
      _kind: 'todo',
      type: 'todo',
      is_todo_type: true,
    }));

    boardItems.push(...(mappedTodos as any));

    const mergedBoardItems: SuggestionListItem[] = [];
    const finalSeenCategoryItems = new Map<string, any>();

    boardItems.forEach((item: any) => {
      const kind = String(item?._kind || item?.type || '').toLowerCase();
      const category = String(item?.item?.category || item?.snippet?.category || item?.category || kind).toLowerCase();
      const isCategoryEntity =
        kind === 'workspace_item' ||
        kind === 'session' ||
        kind === 'snippet' ||
        kind === 'todo' ||
        kind === 'bookmark' ||
        kind === 'automation' ||
        kind === 'aiprompt' ||
        kind === 'chat_agent' ||
        kind === 'chatagent' ||
        kind === 'agent' ||
        ['note', 'notes', 'link', 'links', 'session', 'sessions', 'tab session', 'tabgroup', 'todo', 'todos', 'bookmark', 'bookmarks', 'automation', 'automations', 'aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent', 'snippet', 'snippets'].includes(category);

      if (!isCategoryEntity) {
        mergedBoardItems.push(item);
        return;
      }

      const keys = getCategoryMergeKeys(item);
      const existing = keys.map(key => finalSeenCategoryItems.get(key)).find(Boolean);
      if (existing) {
        const shortcutBadge = getShortcutBadge(item);
        if (shortcutBadge && !getShortcutBadge(existing)) {
          existing._displayShortcut = shortcutBadge;
        }
        return;
      }

      keys.forEach(key => finalSeenCategoryItems.set(key, item));
      mergedBoardItems.push(item);
    });

    // If the board has data, use it; otherwise fall back to unfilteredSuggestions cache
    // When in command section mode (c space or /c), use suggestions from searchbar which are already filtered to user commands
    if (isCommandSectionMode) {
      sourceItems = filterVisibleCommandSuggestions(state?.suggestions || unfilteredSuggestions || []);
    } else {
      sourceItems =
        mergedBoardItems.length > 0
          ? mergedBoardItems
          : unfilteredSuggestions.length > 0
            ? filterVisibleCommandSuggestions(unfilteredSuggestions)
            : filterVisibleCommandSuggestions(state?.suggestions || []);
    }
  } else {
    // Filter chrome bookmarks by query
    const lowerQuery = String(query || '').toLowerCase();

    // Check if the searchbar explicitly supplied only commands (e.g. command menu trigger)
    const activeSuggestions = filterVisibleCommandSuggestions(state?.suggestions || unfilteredSuggestions || []);
    const isExplicitCommandMenu =
      !slashMode.activeSection &&
      activeSuggestions.length > 0 &&
      activeSuggestions.every(
        (s: any) => s._kind === 'command' || s.commandType !== undefined || s._kind === 'workspace_item',
      );

    const availableBookmarks = externalBookmarks.length > 0 ? externalBookmarks : chromeBookmarks;
    const filteredBookmarks = isExplicitCommandMenu
      ? []
      : availableBookmarks.filter(
        b =>
          (b.title && String(b.title).toLowerCase().includes(lowerQuery)) ||
          (b.url && String(b.url).toLowerCase().includes(lowerQuery)),
      );
    sourceItems = [...activeSuggestions, ...filteredBookmarks];
  }

  const handleCreateItem = (groupKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[BoardView] handleCreateItem triggered:', { groupKey, isEmbedded });
    if (isEmbedded) {
      let param = '';
      switch (groupKey) {
        case 'notes':
          param = 'create_note=true';
          break;
        case 'snippets':
          param = 'create_snippet=true';
          break;
        case 'links':
          param = 'create_link=true';
          break;
        case 'sessions':
        case 'tab sessions':
          param = 'session_mode=true';
          break;
        case 'todos':
          param = 'create_todo=true';
          break;
        case 'chat agents':
        case 'chat_agents':
          param = 'create_chat_agent=true';
          break;
        case 'automations':
          param = 'create_automation=true';
          break;
        case 'bookmarks':
          param = 'create_link=true';
          break;
        case 'commands':
        case 'system commands':
        case 'system_commands':
          param = 'trigger_hotkey=true&type=command&id=new';
          break;
      }
      console.log('[BoardView] Embedded mode redirecting with parameter:', param);
      const chromeAny = (window as any).chrome;
      if (param && chromeAny?.runtime?.getURL && chromeAny?.runtime?.sendMessage) {
        const url = chromeAny.runtime.getURL(`AltS_search_newtab/index.html?${param}`);
        console.log('[BoardView] Opening new tab URL via background script sendMessage:', url);
        chromeAny.runtime.sendMessage({ action: 'open_tab', url, active: true });
      } else {
        console.warn('[BoardView] Chrome extension APIs not available for redirection:', {
          hasParam: !!param,
          hasSendMessage: !!chromeAny?.runtime?.sendMessage,
          hasGetURL: !!chromeAny?.runtime?.getURL,
        });
      }
      return;
    }
    console.log('[BoardView] Standard mode opening editor directly for:', groupKey);
    switch (groupKey) {
      case 'notes':
        useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note' } });
        break;
      case 'snippets':
        useUIStore.getState().openEditor({ type: 'snippet', id: 'new' });
        break;
      case 'links':
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
        break;
      case 'sessions':
      case 'tab sessions':
        useUIStore.getState().openEditor({ type: 'session', id: 'new' });
        break;
      case 'todos':
        useUIStore
          .getState()
          .openEditor({ type: 'todo', id: 'new', props: { prefill: { isCreateModalOnly: true } as any } });
        break;
      case 'chat agents':
      case 'chat_agents':
        useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true });
        break;
      case 'automations':
        useUIStore
          .getState()
          .openEditor({ type: 'agent', id: 'new', isNew: true, props: { editMode: false, automation: null } });
        break;
      case 'bookmarks':
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
        break;
      case 'commands':
      case 'system commands':
      case 'system_commands':
        useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
        break;
    }
  };

  const filteredAllItems = sourceItems.filter(item => {
    const kind = (item as any)._kind || (item as any).type;
    return !['history', 'ai_history', 'open_url'].includes(kind);
  });

  const builtInCommandsById = useMemo(
    () => new Map((SHARED_ALL_COMMANDS as any[]).map((cmd: any) => [String(cmd.id), cmd])),
    [],
  );

  const normalizeCommandPrefix = (prefix: any) => String(prefix || '').trim().replace(/^\/+/, '').toLowerCase();

  const isCustomizedBuiltInCommand = (item: any) => {
    const command = item?.command || item;
    const commandId = String(command?.id || item?.id || '');
    const base = builtInCommandsById.get(commandId);
    if (!base) return false;

    const currentPrefix = normalizeCommandPrefix(command?.prefix);
    const basePrefix = normalizeCommandPrefix(base?.prefix);
    const currentLabel = String(command?.label || '').trim();
    const baseLabel = String(base?.label || '').trim();
    const currentCategory = String(command?.category || '').trim().toLowerCase();
    const baseCategory = String(base?.category || '').trim().toLowerCase();
    const currentUrlTemplate = String(command?.urlTemplate || '').trim();
    const baseUrlTemplate = String(base?.urlTemplate || '').trim();

    return (
      currentPrefix !== basePrefix ||
      currentLabel !== baseLabel ||
      currentCategory !== baseCategory ||
      currentUrlTemplate !== baseUrlTemplate
    );
  };

  const getCommandBucket = (item: any): 'commands' | 'system_commands' | null => {
    const kind = item?._kind || item?.type;

    if (item?.commandType === 'proxy' || kind === 'workspace_item') {
      return 'commands';
    }

    if (!['command', 'common_command', 'module', 'aggregate', 'agent_collection'].includes(kind)) {
      return null;
    }

    const command = item?.command || item;
    const commandId = String(command?.id || item?.id || '');
    const base = builtInCommandsById.get(commandId);
    const category = String(command?.category || item?.category || base?.category || '').toLowerCase();

    if (!base || isCustomizedBuiltInCommand(item)) {
      return 'commands';
    }

    return 'system_commands';
  };

  // Define our groups
  const groups = {
    todos: {
      title: 'Todos',
      items: [] as SuggestionListItem[],
      icon: <BsCalendarCheck size={16} className="text-[var(--color-iconDefault)]" />,
    },
    notes: { title: 'Notes', items: [] as SuggestionListItem[], icon: <NotesIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
    snippets: { title: 'Text Expanders', items: [] as SuggestionListItem[], icon: <FaCode size={16} className="text-[var(--color-iconDefault)]" /> },
    links: { title: 'Links', items: [] as SuggestionListItem[], icon: <FaLink size={16} className="text-[var(--color-iconDefault)]" /> },
    bookmarks: { title: 'Bookmarks', items: [] as SuggestionListItem[], icon: <FaBookmark size={16} className="text-[var(--color-iconDefault)]" /> },
    sessions: { title: 'Tab Sessions', items: [] as SuggestionListItem[], icon: <SessionGridIcon size={16} className="text-[var(--color-iconDefault)]" /> },
    chat_agents: {
      title: 'Chat Agents',
      items: [] as SuggestionListItem[],
      icon: <FaRobot size={16} className="text-[var(--color-iconDefault)]" />,
    },
    commands: { title: 'Commands', items: [] as SuggestionListItem[], icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" /> },
    system_commands: {
      title: 'System Commands',
      items: [] as SuggestionListItem[],
      icon: <FaTerminal size={16} className="text-[var(--color-iconDefault)]" />,
    },
    automations: {
      title: 'Automations',
      items: [] as SuggestionListItem[],
      icon: <FiZap size={16} className="text-[var(--color-iconDefault)]" />,
    },
  };

  const activeSuggestionsForMenu = filterVisibleCommandSuggestions(state?.suggestions || unfilteredSuggestions || []);
  const hasAtLeastOneCommand = activeSuggestionsForMenu.some((s: any) => s._kind === 'command' || s.commandType !== undefined);
  const isExplicitMenuState = !slashMode.activeSection && (state?.mode === 'command' || (!state &&
    activeSuggestionsForMenu.length > 0 &&
    hasAtLeastOneCommand &&
    activeSuggestionsForMenu.every(
      (s: any) => s._kind === 'command' || s.commandType !== undefined || s._kind === 'workspace_item',
    )));

  filteredAllItems.forEach(item => {
    if (isExplicitMenuState) {
      const bucket = getCommandBucket(item);
      if (bucket === 'system_commands') {
        groups.system_commands.items.push(item);
      } else {
        groups.commands.items.push(item);
      }
      return;
    }

    const kind = (item as any)._kind || (item as any).type;
    if (kind === 'snippet' || kind === 'workspace_item') {
      const cat = String((item as any).item?.category || (item as any).snippet?.category || '').toLowerCase();
      if (['link', 'links'].includes(cat)) groups.links.items.push(item);
      else if (['session', 'sessions', 'tab session', 'tabgroup'].includes(cat)) groups.sessions.items.push(item);
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat)) groups.chat_agents.items.push(item);
      else if (['automation', 'automations'].includes(cat)) groups.automations.items.push(item);
      else if (['todo', 'todos'].includes(cat)) groups.todos.items.push(item);
      else if (['snippet', 'snippets'].includes(cat)) groups.snippets.items.push(item);
      else if (['bookmark', 'bookmarks'].includes(cat)) groups.bookmarks.items.push(item);
      else if (['command', 'commands'].includes(cat)) groups.commands.items.push(item);
      else groups.notes.items.push(item);
    } else if (
      kind === 'aiPrompt' ||
      kind === 'chat_agent' ||
      kind === 'prompt' ||
      kind === 'chatAgent' ||
      kind === 'agent'
    ) {
      groups.chat_agents.items.push(item);
    } else if (['command', 'agent_collection', 'common_command', 'module', 'aggregate'].includes(kind)) {
      const targetBucket = getCommandBucket(item);
      if (targetBucket === 'system_commands') groups.system_commands.items.push(item);
      else groups.commands.items.push(item);
    } else if (kind === 'bookmark') {
      groups.bookmarks.items.push(item);
    } else if (kind === 'todo') {
      groups.todos.items.push(item);
    } else if (kind === 'automation' || kind === 'agent' || kind === 'module') {
      groups.automations.items.push(item);
    } else if (kind === 'link' || (item as any).category === 'link') {
      groups.links.items.push(item);
    } else if (kind === 'session' || (item as any).category === 'session') {
      groups.sessions.items.push(item);
    } else if (
      kind === 'history' ||
      kind === 'ai_history' ||
      kind === 'open_url' ||
      kind === 'math_result' ||
      kind === 'time_result'
    ) {
      // Intentionally empty: hide these from the Board View entirely
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      groups.notes.items.push(item); // Folders make most sense in notes/snippets
    } else {
      groups.notes.items.push(item); // fallback
    }
  });

  const sortCommandGroupItems = (items: any[]) => {
    items.sort((a: any, b: any) => {
      const getCategoryPriority = (item: any) => {
        const cat = String(item.command?.category || item.category || '').toLowerCase();
        const cmdType = item.commandType;
        const id = item.id || item.command?.id || '';
        const label = String(item.label || item.command?.label || '').toLowerCase();

        if (cmdType === 'proxy' || item._kind === 'workspace_item') return 0; // User shortcuts have absolute highest priority
        if (label.startsWith('create')) return 1; // Create related commands
        if (cat === 'browser') return 2; // Browser commands
        if (cmdType === 'page_action' || cat === 'page_action') return 3;
        if (cat === 'ai' && id !== 'ai') return 4;
        if (cat === 'thissite_action') return 6;
        return 5; // Local app commands and other global commands
      };

      const priorityDiff = getCategoryPriority(a) - getCategoryPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      // If priorities are exactly the same, rely on the original search ranking score as a tie-breaker
      return (b.score || 0) - (a.score || 0);
    });
  };
  sortCommandGroupItems(groups.commands.items as any[]);
  sortCommandGroupItems(groups.system_commands.items as any[]);
  const unwrapProxy = (item: any) => {
    let resolved = item?.commandType === 'proxy' && item?.proxyEntity ? item.proxyEntity : item;
    if (resolved?._kind === 'workspace_item' && resolved.item) {
      const cat = String(resolved.item.category || 'note').toLowerCase();
      // Map category to the correct _kind so renderIcon/getTitle/getDesc work correctly
      let mappedKind: string;
      if (['session', 'sessions', 'tab session'].includes(cat)) mappedKind = 'session';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat)) mappedKind = 'aiPrompt';
      else if (['automation', 'automations'].includes(cat)) mappedKind = 'automation';
      else if (['todo', 'todos'].includes(cat)) mappedKind = 'todo';
      else if (['command', 'commands'].includes(cat)) mappedKind = 'command';
      else mappedKind = 'snippet';

      if (mappedKind === 'session') {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'session',
          session: resolved.item,
          category: cat,
        };
      } else if (mappedKind === 'aiPrompt') {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'aiPrompt',
          category: cat,
          title: resolved.item.title || resolved.item.key || resolved.item.name,
        };
      } else if (mappedKind === 'automation') {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'automation',
          category: cat,
        };
      } else if (mappedKind === 'command') {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'command',
          category: cat,
        };
      } else if (mappedKind === 'todo') {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'todo',
          category: cat,
        };
      } else {
        resolved = {
          ...resolved,
          ...resolved.item,
          _kind: 'snippet',
          snippet: resolved.item,
          category: cat,
        };
      }
    }
    return resolved;
  };

  const getTitle = (item: any): string => {
    const kind = item._kind || (item as any).type;

    if (kind === 'todo') return item.key || item.title || item.name || 'Todo';
    if (kind === 'command' || kind === 'common_command') return item.label || item.command?.label || 'Command';
    if (kind === 'aggregate') return item.label || 'All AI Chat Agents';
    if (kind === 'snippet')
      return item.snippet?.key || item.snippet?.title || item.snippet?.name || item.snippet?.url || 'Text Expander';
    if (kind === 'session')
      return (
        item.session?.key ||
        item.session?.title ||
        item.session?.name ||
        item.data?.title ||
        item.data?.key ||
        item.title ||
        'Untitled Tab Session'
      );
    if (kind === 'bookmark') return item.title || item.url || 'Link';
    if (kind === 'open_url') return item.displayUrl || item.url || 'Open URL';
    if (kind === 'workspace') return item.workspace?.workspace_name || 'Workspace';
    if (kind === 'folder') return item.folder?.folder_name || 'Folder';
    if (kind === 'aiPrompt' || kind === 'chat_agent' || kind === 'chatAgent' || kind === 'agent')
      return item.title || item.name || item.key || item.label || 'Chat Agent';
    if (kind === 'automation') return item.automation?.name || item.title || 'Automation';
    if (kind === 'module') return item.module?.name || item.module?.module_key || 'Module';
    if (kind === 'agent_collection') return item.title || 'Agent Collection';

    // Fallback for custom-shaped items (e.g. extraGroups items from AltS_search_websites)
    return item.label || item.name || item.title || item.key || 'Untitled';
  };

  const getSuggestionLabel = (item: any) => {
    const kind = item._kind || (item as any).type;
    if (kind === 'todo') return 'Todo';
    if (kind === 'command' || kind === 'aggregate' || kind === 'common_command') return 'Command';
    if (kind === 'snippet') {
      const cat = String(item.snippet?.category || '').toLowerCase();
      if (['link'].includes(cat)) return 'Links';
      if (['session'].includes(cat)) return 'Tab Sessions';
      if (cat === 'link' || cat === 'link') return 'Link Group';
      if (cat === 'note') return 'Snippet';
      return 'Notes';
    }
    if (kind === 'bookmark') return 'Bookmark';
    if (kind === 'automation') return 'Automation';
    if (kind === 'agent_collection') return 'Agent Collection';
    return 'Search';
  };

  const getCategoryLabel = (item: any): string | null => {
    const kind = item._kind || (item as any).type;
    const normalizedCategory = String(
      item.category ||
      item.command?.category ||
      item.snippet?.category ||
      item.automation?.category ||
      item.item?.category ||
      kind ||
      '',
    ).toLowerCase();

    if (kind === 'command' || kind === 'common_command') {
      if (normalizedCategory === 'browser') return 'Browser';
      const nestedPrefix = String(item.prefix || item.command?.prefix || '').trim();
      if (nestedPrefix) {
        const bucket = getCommandBucket(item);
        if (bucket === 'system_commands') {
          const sysPrefix = String(omniboxPrefixes?.system_command || 'sc').trim().toLowerCase() || 'sc';
          return `${commandPrefix} ${sysPrefix} ${nestedPrefix}`;
        }
        return `${commandPrefix} ${nestedPrefix}`;
      }
      if (normalizedCategory === 'ai') return 'Prompt';
      if (normalizedCategory === 'page_action') return 'Page Action';
      if (normalizedCategory === 'thissite_action') return 'This Site';
      return 'Command';
    }

    if (kind === 'bookmark') return 'Bookmark';
    if (kind === 'open_url') return 'Link';
    if (kind === 'session') return 'Session';
    if (kind === 'automation') return 'Automation';
    if (kind === 'aiPrompt' || kind === 'prompt' || kind === 'chat_agent' || kind === 'agent') return 'Chat Agent';
    if (kind === 'todo') return 'Todo';
    if (kind === 'module') return 'Module';

    if (kind === 'snippet' || kind === 'note' || kind === 'link' || kind === 'workspace_item') {
      if (['note', 'notes'].includes(normalizedCategory)) return 'Note';
      if (['link', 'links', 'collection'].includes(normalizedCategory)) return 'Link';
      if (['snippet', 'snippets'].includes(normalizedCategory)) return 'Text Expander';
      if (['session', 'sessions', 'tab session'].includes(normalizedCategory)) return 'Session';
      if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(normalizedCategory)) {
        return 'Chat Agent';
      }
      if (['automation', 'automations'].includes(normalizedCategory)) return 'Automation';
      if (['command', 'commands'].includes(normalizedCategory)) return 'Command';
      if (['bookmark', 'bookmarks'].includes(normalizedCategory)) return 'Bookmark';
      if (['todo', 'todos'].includes(normalizedCategory)) return 'Todo';
      return 'Note';
    }

    return null;
  };

  const shouldShowCategoryLabel = (item: any) => {
    if (!isCommandSectionMode) return false;
    return Boolean(getCategoryLabel(item));
  };

  const getDesc = (item: any): string => {
    const rawDesc = (() => {
      const kind = item._kind || (item as any).type;

      if (kind === 'todo') {
        const dueLabel = getTodoDueLabel(item);
        let val = '';
        if (typeof item.value === 'string') {
          val = item.value.replace(/<[^>]+>/g, '').trim();
        }
        if (dueLabel && val) {
          return `${dueLabel} • ${val}`;
        }
        return dueLabel || val || '';
      }
      if (kind === 'command' || kind === 'common_command') return String(item.description || '').replace(/<[^>]+>/g, '');
      if (kind === 'snippet') {
        const s = item.snippet;
        if (!s) return '';
        if (s.description) return String(s.description).replace(/<[^>]+>/g, '');
        if (s.url && typeof s.url === 'string') return s.url;
        if (s.body) return s.body.replace(/<[^>]+>/g, '').trim();
        if (s.code) return s.code;
        if (s.urls && Array.isArray(s.urls)) {
          return s.urls
            .map((u: any) => {
              if (typeof u === 'object' && u !== null && u.url) return String(u.url);
              return String(u);
            })
            .join(', ');
        }
        if (typeof s.value === 'string') return s.value.replace(/<[^>]+>/g, '').trim();
        return '';
      }
      if (kind === 'bookmark') return item.url || '';
      if (kind === 'aiPrompt' || kind === 'chat_agent' || kind === 'chatAgent' || kind === 'agent')
        return String(item.description || item.prompt || item.body || item.value || '').replace(/<[^>]+>/g, '');
      if (kind === 'open_url') return item.url || '';
      if (kind === 'session') {
        const sessionUrls = item.session?.urls || item.data?.urls;
        if (sessionUrls && Array.isArray(sessionUrls)) {
          const count = sessionUrls.length;
          return `${count} tab${count !== 1 ? 's' : ''} saved`;
        }
      }
      if (kind === 'note') {
        if (item.description) return String(item.description).replace(/<[^>]+>/g, '');
        if (item.body) return item.body.replace(/<[^>]+>/g, '').trim();
      }
      if (item.description) return String(item.description).replace(/<[^>]+>/g, '');
      return '';
    })();

    const title = getTitle(item).trim();
    const finalDesc = rawDesc.trim();

    if (finalDesc === title) {
      return '';
    }
    return finalDesc;
  };

  const getDisplayedShortcutText = (item: any): string => {
    const unwrapped = unwrapProxy(item);
    const compoundId = getItemCompoundId(unwrapped);
    return String(
      unwrapped?._displayShortcut ||
      unwrapped?.item?._displayShortcut ||
      item?._displayShortcut ||
      item?.item?._displayShortcut ||
      unwrapped?.shortcut ||
      unwrapped?.data?.shortcut ||
      item?.shortcut ||
      item?.data?.shortcut ||
      (compoundId && shortcutsMap[compoundId] ? normalizeShortcutTrigger(shortcutsMap[compoundId]) : '') ||
      (compoundId && hotkeysMap[compoundId] ? hotkeysMap[compoundId] : '') ||
      '',
    );
  };

  const getSnippetAllUrls = (item: any): string[] => {
    if (!item) return [];
    let urls: any[] = [];
    if (typeof item.value === 'string') {
      const raw = item.value as string;
      try {
        const parsed = JSON.parse(raw || '{}');
        if (Array.isArray(parsed)) urls = parsed;
        else if (parsed && parsed.urls && Array.isArray(parsed.urls)) urls = parsed.urls;
        else if (raw.startsWith('http')) urls = [raw];
      } catch {
        if (raw.startsWith('http')) urls = [raw];
      }
    } else if (item && item.value && typeof item.value === 'object') {
      if (Array.isArray(item.value)) urls = item.value;
      else if ('urls' in (item.value as any)) urls = (item.value as any).urls || [];
    }
    if (item && item.urls && Array.isArray(item.urls)) {
      urls = [...urls, ...item.urls];
    }
    if (item && item.url && typeof item.url === 'string') {
      urls = [...urls, item.url];
    }
    // log removed
    urls = urls.map((u: any) => {
      if (typeof u === 'object' && u !== null && u.url) return String(u.url);
      return String(u);
    });
    return urls;
  };

  const isLightTheme = Boolean(theme && !theme.isDark);

  const getTodoMetadataTextClass = (
    isFocused: boolean,
    tone: 'date' | 'description' | 'overdue' = 'description',
  ) => {
    if (!isLightTheme) {
      return isFocused ? 'text-white/90' : 'text-white/70';
    }

    if (tone === 'overdue') {
      return 'text-[var(--color-error)]';
    }

    if (tone === 'date') {
      return isFocused
        ? 'text-[var(--color-textPrimary)]'
        : 'text-[var(--color-textSecondary)]';
    }

    return isFocused
      ? 'text-[var(--color-textSecondary)]'
      : 'text-[var(--color-textMuted)]';
  };

  const renderTodoMetadata = (item: any, isFocused: boolean) => {
    if (!item.event_deadline) {
      if (item.is_anytime) {
        return (
          <span
            className={clsx(
              'text-[11px] font-medium transition-colors',
              getTodoMetadataTextClass(isFocused, 'date'),
            )}>
            Anytime
          </span>
        );
      }
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      if (!val) return null;
      return (
        <span
          className={clsx(
            'text-[11px] truncate transition-colors',
            getTodoMetadataTextClass(isFocused, 'description'),
          )}>
          {val}
        </span>
      );
    }

    const d = new Date(item.event_deadline.replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';
      return (
        <span
          className={clsx(
            'text-[11px] truncate transition-colors',
            getTodoMetadataTextClass(isFocused, 'description'),
          )}>
          {item.is_anytime ? 'Anytime' : ''}
          {val ? ` • ${val}` : ''}
        </span>
      );
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const isOverdue =
      !item.is_done &&
      d.getTime() < now.getTime() &&
      (dDate.getTime() < startOfToday.getTime() || (item.event_deadline && item.event_deadline.includes(':')));

    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let dateStr = '';

    if (dDate.getTime() === startOfToday.getTime()) {
      dateStr = 'Today';
    } else if (dDate.getTime() === startOfTomorrow.getTime()) {
      dateStr = 'Tomorrow';
    } else if (d.getFullYear() >= 2035) {
      dateStr = 'Anytime';
    } else {
      dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const isRecurring = !!(item.is_recurring || item.recurring);
    const val = typeof item.value === 'string' ? item.value.replace(/<[^>]+>/g, '').trim() : '';

    return (
      <div className="flex flex-col min-w-0 w-full text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOverdue ? (
            <span className={clsx('font-semibold', getTodoMetadataTextClass(isFocused, 'overdue'))}>
              {dateStr}, {timeStr} (
              {(() => {
                const diffMs = now.getTime() - d.getTime();
                const diffMins = Math.floor(diffMs / (60 * 1000));
                const diffHrs = Math.floor(diffMs / (60 * 60 * 1000));
                const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
                if (diffMins < 60) return `${diffMins}m overdue`;
                if (diffHrs < 24) return `${diffHrs}h overdue`;
                return `${diffDays}d overdue`;
              })()}
              )
            </span>
          ) : (
            <span className={clsx('font-semibold', getTodoMetadataTextClass(isFocused, 'date'))}>
              {dateStr === 'Anytime' ? 'Anytime' : `${dateStr}, ${timeStr}`}
            </span>
          )}
          {isRecurring && (
            <span className={clsx('font-medium', isLightTheme ? 'text-[var(--color-success)]' : 'text-emerald-500 dark:text-emerald-400')}>
              • Recurring
            </span>
          )}
        </div>
        {val && (
          <span
            className={clsx('truncate mt-0.5 transition-colors', getTodoMetadataTextClass(isFocused, 'description'))}>
            {val}
          </span>
        )}
      </div>
    );
  };

  const normalizeTodoBoardItem = (item: any) => {
    const source =
      item?._kind === 'workspace_item' && item?.item
        ? item.item
        : item?.commandType === 'proxy' && item?.proxyEntity?.item
          ? item.proxyEntity.item
          : item;

    const scheduleIso =
      source?.event_deadline ||
      (source?.scheduleTime ? new Date(source.scheduleTime).toISOString() : null);

    return {
      ...item,
      ...source,
      _kind: 'todo',
      type: 'todo',
      category: 'todo',
      id: source?.id || source?.todo_id || item?.id,
      todo_id: source?.todo_id || source?.id || item?.todo_id || item?.id,
      key: source?.key || source?.title || source?.name || '',
      title: source?.title || source?.key || source?.name || '',
      name: source?.name || source?.title || source?.key || '',
      value: source?.value || source?.description || '',
      description: source?.description || source?.value || '',
      is_done: source?.is_done ?? source?.isDone ?? false,
      isDone: source?.isDone ?? source?.is_done ?? false,
      scheduleTime: source?.scheduleTime,
      event_deadline: scheduleIso,
      is_recurring: source?.is_recurring ?? (source?.scheduleType === 'recurring'),
      is_anytime: source?.is_anytime ?? false,
    };
  };

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;

    // Persist to IndexedDB (useDbStore liveQuery handles the UI update automatically)
    try {
      if (isEmbedded && (window as any).chrome?.runtime?.sendMessage) {
        (window as any).chrome.runtime.sendMessage({ action: 'db_update_todo', todoId: sid, status: newStatus }, () => {
          window.dispatchEvent(new CustomEvent('todosUpdated'));
        });
      } else {
        await updateTodo(sid, newStatus);
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }
    } catch (err) {
      console.warn('[BoardView] Failed to toggle todo in IndexedDB:', err);
    }
  };

  const renderIcon = (item: any) => {
    if (item.icon && React.isValidElement(item.icon)) return item.icon;

    const kind = item._kind || (item as any).type;
    const entity = kind === 'workspace_item' ? item.item : item;
    const entityKind = kind === 'workspace_item' ? entity.category || 'note' : kind;

    if (entityKind === 'todo') {
      return (
        <div
          className="w-full h-full cursor-pointer flex items-center justify-center transition-transform hover:scale-110 group/check"
          onPointerDown={e => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleTodo(e, item);
          }}>
          {entity.is_done ? (
            <FaCheckCircle className="text-emerald-500 w-[18px] h-[18px] drop-shadow-sm" />
          ) : (
            <FaRegCircle className="text-[var(--color-iconDefault)] w-[18px] h-[18px]" />
          )}
        </div>
      );
    }

    if (entityKind === 'command' || entityKind === 'common_command') {
      // Page-action commands get specific icons
      const cmdType = entity.commandType;
      const cmdId = entity.id || entity.command?.id || '';
      if (cmdType === 'page_action') {
        if (cmdId === 'capture_screenshot') return <FaCamera className="text-sky-400" size={16} />;
        if (cmdId === 'capture_clip_screenshot') return <FaCopy className="text-sky-400" size={16} />;
        if (cmdId === 'capture_full_screenshot') return <FaExpand className="text-sky-400" size={16} />;
        if (cmdId === 'downloadallimages') return <FaImages className="text-emerald-400" size={16} />;
        if (cmdId === 'downloadalltables') return <FaTable className="text-amber-400" size={16} />;
      }
      const iconHost = entity.command?.iconHost;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaTerminal className="text-[var(--color-iconDefault)]" size={16} />;
    }
    if (entityKind === 'aggregate' || entityKind === 'agent_collection')
      return <SessionGridIcon className="text-[var(--color-iconDefault)]" size={16} />;

    if (entityKind === 'session') {
      const urls = getSnippetAllUrls(entity.session || entity);
      if (urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`session-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }
      return <SessionGridIcon className="text-purple-400" size={16} />;
    }

    if (entityKind === 'snippet' || entityKind === 'note' || entityKind === 'link') {
      const category = String(entity.snippet?.category || entity.category || entityKind || '').toLowerCase();
      const isTodoItem = entityKind === 'todo' || category === 'todo';
      const isTabGroup = category === 'link';
      const urls = getSnippetAllUrls(entity.snippet || entity);

      if (isTabGroup && urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center w-8">
            {urls.slice(0, 3).map((url, i) => (
              <div
                key={`tabgroup-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }

      const firstUrl = urls[0];
      if (firstUrl && ['link'].includes(category)) {
        return (
          <img
            src={getFaviconUrl(firstUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      }

      if (['link'].includes(category)) return <FaLink className="text-blue-400" size={16} />;
      if (category === 'snippet') return <FaCode className="text-[var(--color-iconDefault)]" size={16} />;
      return <NotesIcon className="text-[var(--color-iconDefault)]" size={16} />;
    }

    if (entityKind === 'bookmark' || entityKind === 'open_url') {
      const targetUrl = entityKind === 'open_url' ? entity.url?.split(',')[0] : entity.url;
      if (targetUrl)
        return (
          <img
            src={getFaviconUrl(targetUrl)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaLink className="text-[var(--color-iconDefault)]" size={16} />;
    }

    if (
      entityKind === 'aiPrompt' ||
      entityKind === 'chatAgent' ||
      entityKind === 'prompt' ||
      entityKind === 'chat_agent' ||
      entityKind === 'agent'
    ) {
      const urls = Object.values(entity.modelUrls || {});
      if (urls.length > 0) {
        return (
          <div className="flex -space-x-1.5 items-center">
            {urls.slice(0, 3).map((url: any, i) => (
              <div
                key={`aiprompt-icon-${i}`}
                className="w-5 h-5 rounded-full flex items-center justify-center ring-1 ring-white/10 overflow-hidden bg-white/5 shadow-sm">
                <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
              </div>
            ))}
          </div>
        );
      }
      return <FaRobot className="text-[var(--color-iconDefault)]" size={16} />;
    }

    if (entityKind === 'automation') return <FiZap className="text-[var(--color-iconDefault)]" size={16} />;
    if (entityKind === 'module') {
      const iconHost = entity.module?.icon_host || entity.module?.parent_icon_host;
      if (iconHost)
        return (
          <img
            src={getFaviconUrl(iconHost)}
            className="w-5 h-5 object-cover rounded-sm"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        );
      return <FaRobot className="text-[var(--color-iconDefault)]" size={16} />;
    }

    return <FaSearch className="text-[var(--color-iconDefault)]" size={16} />;
  };

  // Define strict priority and default arrays
  const orderedKeys = [
    'todos',
    'notes',
    'links',
    'bookmarks',
    'sessions',
    'chat_agents',
    'commands',
    'system_commands',
    'snippets',
    'automations',
  ] as const;
  const finalKeys = [...orderedKeys];
  const activeGroups = finalKeys.map(k => ({ ...(groups as any)[k], id: k }));


  const openTab = (options: { url: string; active?: boolean }) => {
    const { url, active = true } = options;
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny) {
      window.open(url, '_blank');
      return;
    }
    if (chromeAny.tabs && chromeAny.tabs.create) {
      chromeAny.tabs.create({ url, active });
    } else if (chromeAny.runtime && chromeAny.runtime.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'open_tab', url, active }, () => {
        if (chromeAny.runtime.lastError && active) window.open(url, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
    if (onClose && active) {
      onClose();
    }
  };

  const startSessionFromTodoReference = async (sessionLike: any) => {
    const syntheticEvent = {
      stopPropagation: () => { },
      preventDefault: () => { },
    } as any;

    const normalizedSessionItem = {
      _kind: 'session',
      category: 'session',
      session: sessionLike?.session || sessionLike?.data || sessionLike?.item || sessionLike,
      data: sessionLike?.data || sessionLike?.session || sessionLike?.item || sessionLike,
      sessionOpenSettings:
        sessionLike?.sessionOpenSettings ||
        sessionLike?.data?.sessionOpenSettings ||
        sessionLike?.session?.sessionOpenSettings ||
        sessionLike?.item?.sessionOpenSettings,
    };

    await handleStartSession(normalizedSessionItem, syntheticEvent);
  };

  const executeTodoItem = async (todo: any, e?: React.MouseEvent | KeyboardEvent) => {
    
    // We do not return if todo.is_done so the user can still open a completed task.

    const chromeAny = (window as any)?.chrome;
    const { category, value, snippet_id } = todo;
    const cat = String(category || (todo as any).snippet_category || '').toLowerCase();

    // Helper to extract URLs
    const extractUrls = (val: any) => {
      let rawUrls: any[] = [];
      try {
        if (typeof val === 'object' && val !== null) {
          if (Array.isArray(val)) rawUrls = val;
          else if (val.urls) rawUrls = val.urls;
          else if (val.url) rawUrls = [val.url];
        } else if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
          const parsed = JSON.parse(val || '{}');
          if (Array.isArray(parsed)) rawUrls = parsed;
          else rawUrls = parsed.urls || (val.startsWith('http') ? [val] : []);
        } else if (typeof val === 'string' && val.startsWith('http')) {
          rawUrls = [val];
        }
      } catch (err) {
        if (val && typeof val === 'string' && val.startsWith('http')) {
          rawUrls = [val];
        }
      }

      let finalUrls: string[] = [];
      if (Array.isArray(rawUrls)) {
        finalUrls = rawUrls.map(u => {
          if (typeof u === 'object' && u !== null && u.url) return String(u.url);
          return String(u);
        });
      }

      return finalUrls.filter(u => u && u.startsWith('http'));
    };

    let skipToggle = todo.is_done || false;

    if (cat === 'custom' || cat === 'todo' || todo.todo_id || (todo.id && String(todo.id).startsWith('todo_'))) {
      const triggerId = snippet_id || todo.id || todo.todo_id || (todo as any).todoId;
      openTab({
        url: chromeAny.runtime.getURL(
          `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`,
        ),
      });
    } else if (['session', 'sessions', 'tab session', 'tabgroup'].includes(cat)) {
      await startSessionFromTodoReference({
        _kind: 'session',
        category: 'session',
        data: {
          id: snippet_id || todo.id || todo.todo_id || value,
          title: todo.key || todo.title || todo.name || 'Untitled Tab Session',
          value,
          urls: todo.urls,
          sessionOpenSettings: todo.sessionOpenSettings,
        },
        sessionOpenSettings: todo.sessionOpenSettings,
      });
    } else if (['link', 'collection', 'agent_collection'].includes(cat)) {
      extractUrls(value).forEach(url => openTab({ url }));
    } else if (['note', 'snippet'].includes(cat)) {
      let matchedSnippetItem: { snippet: any; workspace: any } | null = null;
      if (snippet_id) {
        const flatSnippet = dbSnippets.find((s: any) => String(s.id || s.snippet_id) === String(snippet_id));
        if (flatSnippet) {
          matchedSnippetItem = { snippet: flatSnippet, workspace: null };
        }
      }
      if (matchedSnippetItem && state?.onSnippetSelect) {
        state.onSnippetSelect({
          snippet: matchedSnippetItem.snippet,
          workspace: matchedSnippetItem.workspace,
          folder: null,
        } as any);
      } else if (true) {
        openTab({
          url: chromeAny.runtime.getURL(
            `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippet_id)}`,
          ),
        });
      }
      skipToggle = true; // Don't toggle done when opening note/snippet editor
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent', 'custom'].includes(cat)) {
      const triggerId = value || snippet_id;
      if (true) {
        if (cat === 'custom') {
          openTab({
            url: chromeAny.runtime.getURL(
              `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`,
            ),
          });
        } else {
          openTab({
            url: chromeAny.runtime.getURL(
              `AltS_search_newtab/index.html?trigger_hotkey=true&type=${cat}&id=${encodeURIComponent(triggerId)}`,
            ),
          });
        }
      }
    }

    // A. Check if this is a config-based multi-item todo
    const configIds = todo.config?.id || (Array.isArray(todo.references) ? todo.references.map((r: any) => r.id) : undefined);
    if (Array.isArray(configIds) && configIds.length > 0) {
      for (const cid of configIds) {
        const cidStr = String(cid);
        const matched = finalConvertibleItems.find(item => {
          const itemIdStr = String(item.id);
          if (itemIdStr === cidStr) return true;
          const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-|agent-|prompt-|session-)/, '');
          const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-|agent-|prompt-|session-)/, '');
          return strippedItemId === strippedCid;
        });

        if (matched) {
          const itemCat = String(matched.category || '').toLowerCase();
          const itemId = matched.id;
          const itemVal = matched.data?.value || matched.data?.url || matched.data?.link || '';
          if (['session', 'sessions', 'tab session', 'tabgroup'].includes(itemCat)) {
            await startSessionFromTodoReference(matched);
          } else if (['link', 'collection', 'agent_collection'].includes(itemCat)) {
            extractUrls(itemVal).forEach(url => openTab({ url }));
          } else if (['note', 'snippet', 'custom'].includes(itemCat)) {
            openTab({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(itemCat)) {
            openTab({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?trigger_hotkey=true&type=${itemCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }
    }

    if (!skipToggle) {
      const syntheticEvent = {
        stopPropagation: () => { },
        preventDefault: () => { },
      } as any;
      await handleToggleTodo(syntheticEvent, todo);
    }
  };

  const executeItem = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const rawKind = item._kind || (item as any).type;
    const entity = rawKind === 'workspace_item' ? item.item : item;

    let kind = rawKind;
    if (rawKind === 'workspace_item') {
      const cat = String(entity.category || '').toLowerCase();
      if (['link', 'links'].includes(cat)) kind = 'link';
      else if (['session', 'sessions', 'tab session', 'tabgroup'].includes(cat)) kind = 'session';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat)) kind = 'aiPrompt';
      else if (['automation', 'automations'].includes(cat)) kind = 'automation';
      else if (['todo', 'todos'].includes(cat)) kind = 'todo';
      else if (['snippet', 'snippets'].includes(cat)) kind = 'snippet';
      else if (['command', 'commands'].includes(cat)) kind = 'command';
      else if (['bookmark', 'bookmarks'].includes(cat)) kind = 'bookmark';
      else kind = 'note';
    }

    console.log('--- executeItem START ---', { kind, item, entity });

    if (onExecuteItem) {
      const handled = onExecuteItem(item, e);
      if (handled) {
        return;
      }
    }

    const isCtrl = e && 'ctrlKey' in e && (e.ctrlKey || e.metaKey);
    const chromeAny = (window as any)?.chrome;

    if (kind === 'todo') {
      executeTodoItem(entity, e);
      return;
    }

    if (kind === 'static_view') {
      const alias = slashAliasDisplay[item.id];
      if (alias && state?.onQueryChange) {
        state.onQueryChange(`/${alias} `);
      }
      return;
    }

    if (kind === 'session') {
      handleStartSession(item, e as any);
      return;
    }

    if (kind === 'aiPrompt' || kind === 'prompt' || kind === 'chatAgent' || kind === 'chat_agent' || kind === 'agent') {
      void runAiPrompt(entity).catch(err => {
        console.error('[BoardView] Failed to run AI prompt:', err);
      });
      return;
    }

    if (kind === 'snippet' || kind === 'note' || kind === 'link') {
      const rawCategory = entity.snippet?.category || entity.category || (entity.data && entity.data.category) || '';
      const category = String(rawCategory).toLowerCase();
      const urls = getSnippetAllUrls(entity.snippet || entity.data || entity);
      console.log('--- executeItem snippet ---', { category, entity, urls });

      if (isCtrl) {
        if (urls.length > 0) {
          urls.forEach(url => {
            if (url.startsWith('note:')) {
              const sid = url.substring(5);
              if (chromeAny?.runtime?.getURL) {
                openTab({
                  url: chromeAny.runtime.getURL(
                    `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`,
                  ),
                  active: false,
                });
              }
            } else if (url.startsWith('agent_chat?id=')) {
              const agentId = url.split('id=')[1];
              if (chromeAny?.runtime?.getURL) {
                openTab({
                  url: chromeAny.runtime.getURL(
                    `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                  ),
                  active: false,
                });
              }
            } else {
              openTab({ url, active: false });
            }
          });
        } else {
          const sid = entity.snippet?.snippet_id || entity.snippet?.id || entity.id;
          if (sid && chromeAny?.runtime?.getURL) {
            openTab({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`,
              ),
              active: false,
            });
          }
        }
        return;
      }

      const actualSnippet = entity.snippet || entity.session || entity.data || entity;
      const actualId = String(actualSnippet.snippet_id || actualSnippet.id || entity.id || '');

      let inferredCategory = category;
      if (!inferredCategory) {
        if (actualId.startsWith('note_')) inferredCategory = 'note';
        else if (actualId.startsWith('link_')) inferredCategory = 'link';
        else if (actualId.startsWith('snippet_')) inferredCategory = 'snippet';
        else if (actualId.startsWith('session_')) inferredCategory = 'session';
      }

      if (['snippet', 'note', 'session'].includes(inferredCategory) || inferredCategory === 'notes') {
        const actualType = (inferredCategory === 'notes' || inferredCategory === 'snippet') ? 'note' : inferredCategory;

        if (isEmbedded && chromeAny?.runtime?.getURL) {
          if (inferredCategory === 'snippet') {
            const mergedSnippet = {
              ...actualSnippet,
              favorite: actualSnippet.favorite ?? item.favorite ?? item.data?.favorite,
              tags: actualSnippet.tags ?? item.tags ?? item.data?.tags,
              shortcut: actualSnippet.shortcut ?? item.shortcut ?? item.data?.shortcut,
              hotkey: actualSnippet.hotkey ?? item.hotkey ?? item.data?.hotkey,
            };
            const url = new URL(chromeAny.runtime.getURL('AltS_search_newtab/index.html'));
            url.searchParams.set('alts_action', 'true');
            url.searchParams.set('type', 'note');
            url.searchParams.set('entityId', String(actualId));
            url.searchParams.set('edit_mode', 'true');
            url.searchParams.set('editorProps', JSON.stringify({ props: { item: mergedSnippet, snippet: mergedSnippet, category: 'snippet' } }));
            openTab({ url: url.toString(), active: true });
          } else {
            openTab({
              url: chromeAny.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(actualId)}`
              ),
              active: true,
            });
          }
        } else {
          if (actualType === 'todo') {
            useUIStore.getState().setTodoCreatePrefill(actualSnippet);
          }
          useUIStore.getState().openEditor({
            type: actualType as 'note' | 'session' | 'todo',
            id: actualId,
            props: {
              category: inferredCategory === 'snippet' ? 'snippet' : undefined,
              snippet: inferredCategory === 'snippet' ? { ...actualSnippet, category: 'snippet' } : actualSnippet,
              item: actualSnippet,
              initialDraftKey: actualSnippet.title || actualSnippet.name || actualSnippet.key,
              initialDraftContent: actualSnippet.body || actualSnippet.content || actualSnippet.value,
            },
          });
        }
        return;
      }

      // Handle links, tabgroups, etc. by opening URLs directly
      // (bypassing state.onRequestOpenUrls which silently skips already-open URLs)
      if (urls.length > 0) {
        urls.forEach((url, i) => {
          if (true) {
            openTab({ url, active: i === 0 });
          } else {
            window.open(url, '_blank');
          }
        });
      } else if (state?.onSnippetSelect) {
        state.onSnippetSelect(item);
      }
    } else if (['workspace', 'folder', 'folder_search'].includes(kind)) {
      if (isCtrl) return;
      if (state?.onSnippetSelect) {
        state.onSnippetSelect(item);
      }
      if (onClose) onClose();
      return;
    } else if (kind === 'command' || kind === 'common_command' || kind === 'aggregate') {
      if (isCtrl) {
        if (true) {
          const extUrl = chromeAny.runtime.getURL(
            `AltS_search_newtab/index.html?lock_command=${encodeURIComponent(item.id)}`,
          );
          openTab({ url: extUrl, active: false });
        }
        return;
      }

      // If the parent provided a command handler (e.g. newtab search bar), use it
      if (state?.onCommandMouseDown) {
        state.onCommandMouseDown(e as any, item.id);
        return;
      }

      // Standalone fallback: resolve the urlTemplate directly
      // item may be the raw CommandDefinition or wrapped as { command: ... }
      const cmdDef = item.command || item;
      const cmdId: string = cmdDef.id || item.id || '';
      const urlTemplate: string = cmdDef.urlTemplate || '';

      // ─── Local app commands — trigger in-app UI exactly like the create panel ───
      const localResult = (() => {
        const targetCommand = SHARED_ALL_COMMANDS.find((c: any) => c.id === cmdId);

        // If it's a URL-based command (browser commands, etc.), let the later logic handle it
        if (targetCommand && targetCommand.urlTemplate && !['dashboard', 'tutorials'].includes(cmdId)) {
          return false;
        }

        // If embedded, route UI-based commands to the New Tab page
        if (targetCommand && isEmbedded && chromeAny?.runtime?.getURL) {
          openTab({
            url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${encodeURIComponent(cmdId)}`)
          });
          return true;
        }

        // If NOT embedded and the command exists in ALL_COMMANDS, execute it directly
        if (targetCommand && targetCommand.execute) {
          targetCommand.execute({
            services: {
              navigation: (args: any) => {
                if (args.kind === 'noteEditor') {
                  const cat = args.noteProps?.category || 'note';
                  useUIStore.getState().openEditor({ type: cat === 'snippet' ? 'snippet' : 'note', id: 'new', props: { category: cat } });
                } else if (args.kind === 'linkEditor') {
                  useUIStore.getState().openEditor({ type: 'link', id: 'new' });
                } else if (args.kind === 'sessionEditor') {
                  useUIStore.getState().openEditor({ type: 'session', id: 'new' });
                } else if (args.kind === 'commandList') {
                  useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
                } else if (args.kind === 'folderEditor') {
                  useUIStore.getState().openCreateItem('folder' as any, { id: 'new' });
                } else if (args.kind === 'createWorkspace') {
                  useUIStore.getState().openCreateItem('workspace' as any, { id: 'new' });
                } else if (args.kind === 'home') {
                  useUIStore.getState().setView({ type: 'home' });
                } else if (args.kind === 'custom') {
                  useUIStore.getState().openEditor({ type: 'aiPrompt' as any, id: 'new' }); // Fallback for custom prompt editor
                }
              },
              reload: () => window.location.reload(),
              clearDraftAutomation: () => { },
            } as any
          } as any);
          return true;
        }

        // Fallback ONLY for special buttons that don't exist in allCommands.tsx
        switch (cmdId) {
          case 'dashboard': openTab({ url: 'https://app.cmdos.io' }); return true;
          case 'tutorials': openTab({ url: 'https://docs.cmdos.io' }); return true;
          case 'refresh': window.location.reload(); return true;
          case 'toggle-dark-mode': document.documentElement.classList.toggle('dark'); return true;
          case 'calendar':
            chromeAny?.runtime?.sendMessage?.({
              action: 'open_tab_with_auto_submit', url: 'https://gemini.google.com/app',
              autoSubmit: { kind: 'gemini', prompt: 'Help me manage my calendar and schedule.' }, forceNewTab: true,
            });
            return true;
          // Sidebars that aren't defined as official commands but exist in UI buttons
          case 'bookmarks':
            if (isEmbedded) openTab({ url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${cmdId}`) });
            else setSelectedSidebarSection('bookmarks');
            return true;
          case 'shortcuts':
            if (isEmbedded) openTab({ url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${cmdId}`) });
            else useUIStore.getState().setSidebar('commandListSidebar' as any, { open: true });
            return true;
          case 'profile':
            if (isEmbedded) openTab({ url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${cmdId}`) });
            else useUIStore.getState().setSidebar('settingsSidebar' as any, { open: true });
            return true;
          case 'store':
            if (isEmbedded) openTab({ url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${cmdId}`) });
            else useUIStore.getState().setSidebar('storeSidebar' as any, { open: true });
            return true;
          case 'saved-automation':
            if (isEmbedded) openTab({ url: chromeAny.runtime.getURL(`AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${cmdId}`) });
            else useUIStore.getState().setSidebar('automationSidebar' as any, { open: true });
            return true;
          default:
            return false;
        }
      })();

      if (localResult) {
        onClose?.();
        return;
      }

      if (!urlTemplate) return;

      // Browser chrome:// pages (no query needed) — open immediately
      const needsQuery = urlTemplate.includes('{query}');
      const isAiCmd =
        cmdId === 'ai' || ['gpt', 'claude', 'perplexity', 'gemini'].includes(cmdId) || cmdDef.category === 'ai';

      if (!needsQuery && !isAiCmd) {
        openTab({ url: urlTemplate });
        onClose?.();
        return;
      }

      // Search commands: open the newtab and pre-lock the command so the user can type
      if (true) {
        const extUrl = chromeAny.runtime.getURL(
          `AltS_search_newtab/index.html?lock_command=${encodeURIComponent(item.id || cmdDef.id)}`,
        );
        openTab({ url: extUrl });
        onClose?.();
      }
    } else if (kind === 'bookmark' || kind === 'open_url') {
      const urlsToOpen = item.url ? item.url.split(',').filter(Boolean) : [];
      if (isCtrl) {
        urlsToOpen.forEach((url: string) => {
          openTab({ url, active: false });
        });
        return;
      }
      if (state?.onRequestOpenUrls) {
        if (urlsToOpen.length > 0) {
          state.onRequestOpenUrls(urlsToOpen, item.title || item.displayUrl);
        }
      } else if (urlsToOpen.length > 0) {
        // Standalone fallback: open directly
        openTab({ url: urlsToOpen[0] });
        onClose?.();
      }
    } else if (kind === 'automation' && state?.onAutomationSelect) {
      if (isCtrl) return;
      state.onAutomationSelect(item.automation);
    } else if (kind === 'module' && state?.onModuleSelect) {
      if (isCtrl) return;
      state.onModuleSelect(item.module);
    } else if (kind === 'agent_collection' && state?.onAgentCollectionSelect) {
      if (isCtrl) return;
      state.onAgentCollectionSelect(item);
    }
  };

  const handleStartSession = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const record = item.data || item.session || item.snippet || item.item || item;
    if (!record) return;

    const isActualSession = !!item.session || item._kind === 'session' || (item._kind === 'workspace_item' && record.category?.toLowerCase().includes('session'));
    const sessionId = isActualSession ? record.id : record.snippet_id || record.id;
    const sessionName = isActualSession
      ? record.title || record.key || record.name || 'Untitled Tab Session'
      : record.key || record.name || record.title || 'Untitled Tab Session';
    const workspaceId = isActualSession ? record.workspaceId : record.workspace_id || null;
    const folderId = isActualSession ? record.folderId : record.folder_id || null;

    let initialUrls: string[] = [];
    let initialNames: string[] = [];
    let openSettings = record.sessionOpenSettings || item.sessionOpenSettings;
    const extractSessionUrlPayload = (entries: any[] | undefined | null) => {
      if (!Array.isArray(entries)) {
        return { urls: [] as string[], names: [] as string[] };
      }

      const urls: string[] = [];
      const names: string[] = [];

      entries.forEach((entry: any) => {
        const url = typeof entry === 'string' ? entry : entry?.url;
        if (!url) return;
        urls.push(url);
        names.push(typeof entry === 'string' ? '' : entry?.title || entry?.name || '');
      });

      return { urls, names };
    };

    try {
      const resolved = await resolveEntityById(sessionId);
      const sessionRecord = resolved?.entity as any;
      if (sessionRecord) {
        openSettings = sessionRecord.sessionOpenSettings || openSettings;
        const resolvedPayload = extractSessionUrlPayload(sessionRecord.urls);
        if (resolvedPayload.urls.length > 0) {
          initialUrls = resolvedPayload.urls;
          initialNames = resolvedPayload.names;
        }
      }
    } catch (err) { }

    if (initialUrls.length === 0 && isActualSession) {
      const recordPayload = extractSessionUrlPayload(record.urls);
      initialUrls = recordPayload.urls;
      initialNames = recordPayload.names;
    } else {
      try {
        const parsed = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
        if (Array.isArray(parsed)) {
          initialUrls = parsed.map((l: any) => l.url || l);
          initialNames = parsed.map((l: any) => l.name || '');
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
          if (Array.isArray(parsed.names)) initialNames = parsed.names;
        }
      } catch (err) { }

      if (initialUrls.length === 0) {
        initialUrls = getSnippetAllUrls(record);
      }
    }

    const activeTabContext = await new Promise<{ currentTabId: number | null; currentWindowId: number | null; currentPageUrl: string }>((resolve) => {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.tabs?.query) {
        resolve({
          currentTabId: null,
          currentWindowId: null,
          currentPageUrl: window.location.href,
        });
        return;
      }

      chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        const activeTab = tabs?.[0];
        resolve({
          currentTabId: activeTab?.id ?? null,
          currentWindowId: activeTab?.windowId ?? null,
          currentPageUrl: activeTab?.url || window.location.href,
        });
      });
    });

    chrome.runtime.sendMessage(
      {
        action: 'start_session',
        sessionId,
        sessionName,
        workspaceId,
        folderId: folderId || null,
        teamId: 'local',
        storageMode: 'local',
        initialUrls,
        initialNames,
        openSettings,
        isInlineCreation: true,
        ...activeTabContext,
      },
      response => {
        if (response?.ok && openSettings?.openMode === 'same_window') {
          if (response?.reused || response?.reusedCurrentTab) {
            return;
          }
          const encodedName = encodeURIComponent(sessionName);
          window.history.replaceState(
            null,
            '',
            `?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
          );
          useUIStore.getState().openEditor({
            type: 'session',
            id: sessionId,
            props: {
              session: {
                id: sessionId,
                title: sessionName,
              },
            },
          });
        }
      },
    );
  };

  // Click outside or ESC to close context menu
  useEffect(() => {
    if (!contextMenuState) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Use composedPath to support portal-mounted menus and cross Shadow DOM boundaries
      const path = event.composedPath();
      const isInsideMenu = path.some((el: any) => el.getAttribute && el.getAttribute('data-unified-menu') === 'true');
      if (isInsideMenu) return; // click was inside menu
      setContextMenuState(null);
    };
    document.addEventListener('mousedown', handleMouseDown, true);

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      setContextMenuState(null);
      return true;
    });

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      unregister();
    };
  }, [contextMenuState]);

  useEffect(() => {
    if (focus[0] >= 0 && focus[1] >= 0) {
      const element = document.getElementById(`board-item-${focus[0]}-${focus[1]}`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [focus]);

  // ── Slash mode integration ────────────────────────────────────────────────

  // Automatically insert space after valid slash shortcut typed
  useEffect(() => {
    const prevVal = prevSearchValueRef.current;
    prevSearchValueRef.current = rawSearchValue;

    if (!rawSearchValue.startsWith('/')) return;

    const isExactlyAlias = Object.keys(slashSectionAliases).some(
      alias => rawSearchValue.toUpperCase() === `/${alias.toUpperCase()}`,
    );

    if (isExactlyAlias) {
      const aliasMatch = rawSearchValue.slice(1).toUpperCase();
      const expectedPrev = `/${aliasMatch} `;
      if (prevVal.toUpperCase() !== expectedPrev) {
        state?.onQueryChange?.(`${rawSearchValue} `);
        requestAnimationFrame(() => {
          focusSearchbarInput();
        });
      }
    }
  }, [rawSearchValue, state]);

  // When a /alias matches, sync the sidebar to that section automatically.
  // Sidebar reflects the slash selection so the left nav stays in step.
  useEffect(() => {
    const prev = prevSearchValueRef.current;
    prevSearchValueRef.current = rawSearchValue;

    if (slashMode.activeSection && slashMode.activeSection !== 'all') {
      setSelectedSidebarSection(slashMode.activeSection);
      isSlashSelectedRef.current = true;
    } else if (slashMode.activeSection === 'all') {
      setSelectedSidebarSection('all');
      isSlashSelectedRef.current = true;
    } else if (!rawSearchValue.trim()) {
      setSelectedSidebarSection('all');
      isSlashSelectedRef.current = false;
    }
    // When slash mode is exited, only reset to 'all' if it was selected by a slash command
    if (!slashMode.slashDropdown && !slashMode.activeSection) {
      const prevWasSlashOrColon = prev.startsWith('/') || /^[a-zA-Z0-9_-]+:/.test(prev);
      const currIsSlashOrColon = rawSearchValue.startsWith('/') || /^[a-zA-Z0-9_-]+:/.test(rawSearchValue);
      if (prevWasSlashOrColon && !currIsSlashOrColon) {
        if (isSlashSelectedRef.current) {
          setSelectedSidebarSection('all');
          isSlashSelectedRef.current = false;
        }
      }
    }
  }, [slashMode.activeSection, slashMode.slashDropdown, rawSearchValue]);

  // Slash launcher options (Suggestions + All Results)
  const slashPickerFilterText = String(rawSearchValue.slice(1) || '').trim().toLowerCase();

  const filteredSuggestions = useMemo(() => {
    return SUGGESTION_ACTION_ITEMS.filter(item => {
      if (!slashPickerFilterText) return true;
      return (
        item.title.toLowerCase().includes(slashPickerFilterText) ||
        item.id.toLowerCase().includes(slashPickerFilterText) ||
        (item.keywords && item.keywords.some(k => k.toLowerCase().includes(slashPickerFilterText)))
      );
    });
  }, [slashPickerFilterText]);

  const filteredCategories = useMemo(() => {
    return Object.keys(SLASH_SECTION_META)
      .map(name => {
        const meta = SLASH_SECTION_META[name];
        const alias = slashAliasDisplay[name] || '';
        return {
          kind: 'category' as const,
          id: name,
          title: meta.title,
          alias,
          icon: meta.icon,
        };
      })
      .filter(item => {
        if (!slashPickerFilterText) return true;
        return (
          item.title.toLowerCase().includes(slashPickerFilterText) ||
          item.id.toLowerCase().includes(slashPickerFilterText) ||
          item.alias.toLowerCase().includes(slashPickerFilterText)
        );
      });
  }, [slashPickerFilterText, slashAliasDisplay]);

  const visibleLauncherItems = useMemo<SlashLauncherItem[]>(() => {
    return [...filteredSuggestions, ...filteredCategories];
  }, [filteredSuggestions, filteredCategories]);

  const executeLauncherItem = useCallback((item: SlashLauncherItem) => {
    if (item.kind === 'action') {
      setSlashDropdownSelectedIndex(-1);
      state?.onDismissSlashDropdown?.({ clearQuery: true, blur: false });
      state?.onQueryChange?.('');
      if (item.id === 'ai') {
        if (state?.onSlashSuggestionSelect) {
          state.onSlashSuggestionSelect('ai');
        } else {
          useUIStore.getState().setLockedCommand('ai');
        }
      } else if (item.id === 'collections') {
        if (onSheetRedirect) {
          onSheetRedirect('collections');
        } else if (state?.onSlashSuggestionSelect) {
          state.onSlashSuggestionSelect('collections');
        } else {
          useUIStore.getState().openSheet('collections');
        }
      }
    } else {
      const alias = item.alias;
      state?.onQueryChange?.(`/${alias} `);
      setSlashDropdownSelectedIndex(-1);
      requestAnimationFrame(() => {
        focusSearchbarInput();
      });
    }
  }, [state, onSheetRedirect]);

  // Reset highlight index when dropdown closes
  useEffect(() => {
    if (!slashMode.slashDropdown) {
      setSlashDropdownSelectedIndex(-1);
    }
  }, [slashMode.slashDropdown]);

  // Keyboard navigation for the slash dropdown
  useEffect(() => {
    if (!slashMode.slashDropdown) return;

    const handleSlashKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => (prev < visibleLauncherItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSlashDropdownSelectedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, visibleLauncherItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const selected = visibleLauncherItems[slashDropdownSelectedIndex >= 0 ? slashDropdownSelectedIndex : 0];
        if (selected) {
          executeLauncherItem(selected);
        }
      }
    };

    window.addEventListener('keydown', handleSlashKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleSlashKey, { capture: true });
    };
  }, [slashMode.slashDropdown, visibleLauncherItems, slashDropdownSelectedIndex, executeLauncherItem]);

  // When slash mode is active, re-filter board items using the slash searchQuery
  // (e.g. /n google → filter notes by "google")
  const slashSearchQuery = slashMode.searchQuery;
  const stripSelectedSectionLabel = (value: string) => {
    const label = String(SLASH_SECTION_META[selectedSidebarSection]?.title || '').trim();
    const normalized = String(value || '').trim();
    if (!label || !normalized.toLowerCase().startsWith(label.toLowerCase())) return normalized;
    return normalized.slice(label.length).trimStart();
  };
  const categorySearchQuery = slashSearchQuery.trim() || (hasSelectedCategorySearch ? stripSelectedSectionLabel(query) : '');

  // Override the activeGroups items with slash search query filtering
  const finalGroupsBase = (() => {
    const combinedGroups = [...extraGroups, ...activeGroups];

    // Check if the searchbar explicitly supplied only commands (e.g. command menu trigger)
    const activeSuggestions = filterVisibleCommandSuggestions(state?.suggestions || unfilteredSuggestions || []);
    const hasAtLeastOneCommand = activeSuggestions.some((s: any) => s._kind === 'command' || s.commandType !== undefined);
    const isExplicitCommandMenu =
      activeSuggestions.length > 0 &&
      hasAtLeastOneCommand &&
      activeSuggestions.every(
        (s: any) => s._kind === 'command' || s.commandType !== undefined || s._kind === 'workspace_item',
      );

    const isCategoryFilterActive = Boolean(slashMode.activeSection || hasSelectedCategorySearch);
    if (
      isExplicitCommandMenu ||
      !categorySearchQuery.trim() ||
      (state?.mode === 'command' && !isCategoryFilterActive)
    )
      return combinedGroups;

    if (!slashMode.activeSection && !hasSelectedCategorySearch)
      return combinedGroups;

    const lower = String(categorySearchQuery || '').toLowerCase();
    const filteredGroups = combinedGroups.map(g => ({
      ...g,
      items: g.items.filter((item: any) => {
        const unwrappedItem = unwrapProxy(item);
        const t = String(getTitle(unwrappedItem)).toLowerCase();
        const d = String(getDesc(unwrappedItem)).toLowerCase();
        const c = String(getCategoryLabel(unwrappedItem) || '').toLowerCase();
        const shortcut = getDisplayedShortcutText(unwrappedItem).toLowerCase();
        const shortcutParts = shortcut.split(/\s+/);
        const shortcutWithoutCategoryPrefix = shortcutParts.slice(2).join(' ');
        return (
          t.includes(lower) ||
          d.includes(lower) ||
          c.includes(lower) ||
          shortcut.includes(lower) ||
          shortcutWithoutCategoryPrefix.includes(lower)
        );
      }),
    }));
    return filteredGroups;
  })();

  // ESC to clear search globally when active, as long as context menus aren't open
  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (slashMode.slashDropdown) return false;
      if (todoCreatePrefill) return false;

      if (rawSearchValue) {
        setSelectedSidebarSection('all');
        isSlashSelectedRef.current = false;
        state?.onQueryChange?.('');
        return true;
      } else if (onClose) {
        onClose();
        return true;
      }
      return false;
    });
    return unregister;
  }, [slashMode.slashDropdown, rawSearchValue, state, onClose, todoCreatePrefill]);

  // Filter the active groups based on the selected sidebar section.
  // Rules:
  //  - slashDropdown open (only '/' typed) → show ALL columns behind the picker
  //  - slash alias matched (e.g. '/L') → show only that column
  //  - normal sidebar click → use selectedSidebarSection

  // Normalize a group title to its sidebar ID for matching (e.g. "This Site" → "thissite")
  const toSidebarId = (title: string) => String(title).toLowerCase().replace(/\s+/g, '');

  const rawSearchVal = (rawSearchValue || '').trim();

  const finalGroups = (
    effectiveSidebarSection === 'all'
      ? finalGroupsBase
      : finalGroupsBase.filter(
        g =>
          // Built-in groups: match by their exact ID
          (g as any).id === effectiveSidebarSection ||
          // Built-in groups: match by their exact key (todos, notes, etc.)
          String(g.title).toLowerCase() === effectiveSidebarSection ||
          // Extra groups: match by sanitized ID (e.g. "This Site" → "thissite")
          toSidebarId(g.title) === effectiveSidebarSection,
      )
  ).filter(g => {
    if (!g || !Array.isArray(g.items)) return false;
    // If user is actively searching (with actual query text), hide columns that have 0 results
    if (slashMode.searchQuery.trim() !== '') {
      return (g.items?.length ?? 0) > 0;
    }
    return true;
  });

  // Automatically focus the first available result item when query changes or result set updates
  const groupItemCounts = useMemo(() => finalGroups.map(g => g.items?.length ?? 0).join(','), [finalGroups]);

  useEffect(() => {
    if (!rawSearchValue || rawSearchValue.trim() === '') {
      setFocus([-1, -1]);
      return;
    }

    let firstValidCol = -1;
    for (let c = 0; c < finalGroups.length; c++) {
      if ((finalGroups[c]?.items?.length ?? 0) > 0) {
        firstValidCol = c;
        break;
      }
    }
    if (firstValidCol !== -1) {
      setFocus([firstValidCol, 0]);
    } else {
      setFocus([-1, -1]);
    }
  }, [rawSearchValue, groupItemCounts]);

  useEffect(() => {
    if (finalGroups.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (state?.isAtMenuOpen || state?.isContextualPopupOpen || state?.showAIHistoryPanel || slashMode.slashDropdown) {
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        let [col, row] = focus;
        const isUnfocused = col < 0 || row < 0;

        if (isUnfocused) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            setFocus([0, 0]);
          }
          return;
        }

        if (col < 0 || col >= finalGroups.length) col = 0;
        if (row < 0 || row >= finalGroups[col].items.length) row = 0;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.min(row + 1, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          row = Math.max(row - 1, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.min(col + 1, finalGroups.length - 1);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          col = Math.max(col - 1, 0);
          row = Math.min(row, finalGroups[col].items.length - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const item = finalGroups[col].items[row];
          if (item) {
            executeItem(item, e);
          }
        }
        setFocus([col, row]);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [finalGroups, focus, state, slashMode.slashDropdown]);

  const totalItems = [...activeGroups, ...extraGroups].reduce((acc, g) => acc + (g?.items?.length ?? 0), 0);

  const SIDEBAR_ITEMS = [
    {
      id: 'all',
      label: 'All',
      icon: (isSelected: boolean) => (
        <svg
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    ...extraGroups.map(eg => ({
      id: String(eg.title).toLowerCase().replace(/\s+/g, ''),
      label: eg.title,
      icon: (isSelected: boolean) => (
        <div
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors flex items-center justify-center',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}>
          {eg.icon}
        </div>
      ),
    })),
    {
      id: 'todos',
      label: 'Todos',
      icon: (isSelected: boolean) => (
        <BsCalendarCheck
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: (isSelected: boolean) => (
        <NotesIcon
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'snippets',
      label: 'Text Expander',
      icon: (isSelected: boolean) => (
        <FaCode
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },

    {
      id: 'links',
      label: 'Links',
      icon: (isSelected: boolean) => (
        <FaLink
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'bookmarks',
      label: 'Bookmarks',
      icon: (isSelected: boolean) => (
        <FaBookmark
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'sessions',
      label: 'Tab Sessions',
      icon: (isSelected: boolean) => (
        <SessionGridIcon
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'chat_agents',
      label: 'Chat Agents',
      icon: (isSelected: boolean) => (
        <FaRobot
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'commands',
      label: 'Commands',
      icon: (isSelected: boolean) => (
        <FaTerminal
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'system_commands',
      label: 'System Commands',
      icon: (isSelected: boolean) => (
        <FaTerminal
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
    {
      id: 'automations',
      label: 'Automations',
      icon: (isSelected: boolean) => (
        <FiZap
          className={clsx(
            'w-4 h-4 shrink-0 transition-colors',
            isSelected ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
          )}
        />
      ),
    },
  ];



  return (
    <div
      className={clsx('mx-auto w-full max-w-[1400px] relative', isEmbedded ? 'flex flex-col flex-1 min-h-0' : 'h-full')}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => {
        // log removed
        e.stopPropagation();
      }}>
      {onClose && !slashMode.slashDropdown && !hideCloseButton && (
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 z-[60] p-2 flex items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] rounded-lg transition-all hover:scale-110 cursor-pointer focus:outline-none"
          title="Close Board View (Esc)">
          <FiX size={22} strokeWidth={2.5} />
        </button>
      )}
      <div
        className={clsx(
          'w-full flex items-stretch overflow-hidden transition-all duration-300 ease-in-out relative',
          slashMode.slashDropdown
            ? 'h-auto border-transparent shadow-none bg-transparent'
            : isEmbedded
              ? 'flex-1 min-h-0 rounded-2xl border border-[var(--color-borderDefault)] shadow-2xl'
              : 'h-[600px] rounded-2xl border border-[var(--color-borderDefault)] shadow-2xl',
        )}
        style={{
          backgroundColor: slashMode.slashDropdown ? 'transparent' : (theme?.tokens?.sheetBg || 'var(--color-sheetBg)'),
          opacity: 1,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }}>
        {/* Left Sidebar */}
        {!slashMode.slashDropdown && (
          <div className="w-[220px] shrink-0 flex flex-col border-r border-[var(--color-borderDefault)] py-4 px-3 overflow-y-auto hover-scrollbar group/sidebar">
            {SIDEBAR_ITEMS.map(item => {
              const isSelected = effectiveSidebarSection === item.id;
              return (
                <button
                  key={item.id}
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                  onMouseUp={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation();
                    isSlashSelectedRef.current = false;
                    (state as any)?.onSidebarSectionSelect?.(item.id);
                    if (state?.onQueryChange) {
                      const alias = slashAliasDisplay[item.id];
                      const newQuery = alias ? `/${alias} ` : '';

                      if (newQuery !== rawSearchValue) {
                        state.onQueryChange(newQuery);
                      }
                    }
                    setSelectedSidebarSection(item.id);
                    setFocus([0, 0]); // Reset focus when switching tabs
                  }}
                  className={clsx(
                    'flex items-center gap-3 px-2 py-1.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer w-full text-left mb-1 group',
                    isSelected
                      ? 'text-[var(--color-textPrimary)] font-semibold bg-[var(--color-selectedBg)] border border-[var(--color-borderSelected,var(--color-borderDefault))] shadow-xs'
                      : 'text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] border border-transparent',
                  )}>
                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                    {item.icon(isSelected)}
                  </div>
                  <span className="flex-1 tracking-tight truncate leading-tight">{item.label}</span>
                  {omniboxPrefixes &&
                    (item.id === 'notes' ||
                      item.id === 'links' ||
                      item.id === 'bookmarks' ||
                      item.id === 'snippets' ||
                      item.id === 'commands' ||
                      item.id === 'system_commands' ||
                      item.id === 'sessions' ||
                      item.id === 'automations' ||
                      item.id === 'todos' ||
                      item.id === 'chat_agents') && (
                      <span className="ml-2 flex items-center gap-1">
                        <EditablePrefixKey
                          category={
                            item.id === 'notes'
                              ? 'note'
                              : item.id === 'snippets'
                                ? 'snippet'
                                : item.id === 'commands'
                                  ? 'command'
                                  : item.id === 'system_commands'
                                    ? 'system_command'
                                    : item.id === 'links'
                                      ? 'link'
                                      : item.id === 'bookmarks'
                                        ? 'bookmark'
                                        : item.id === 'sessions'
                                          ? 'session'
                                          : item.id === 'automations'
                                            ? 'automation'
                                            : item.id === 'todos'
                                              ? 'todo'
                                              : item.id === 'chat_agents'
                                                ? 'agent'
                                                : 'note'
                          }
                          currentValue={
                            item.id === 'notes'
                              ? omniboxPrefixes.note
                              : item.id === 'snippets'
                                ? omniboxPrefixes.snippet || ''
                                : item.id === 'links'
                                  ? omniboxPrefixes.link
                                  : item.id === 'bookmarks'
                                    ? omniboxPrefixes.bookmark || ''
                                    : item.id === 'commands'
                                      ? omniboxPrefixes.command
                                      : item.id === 'system_commands'
                                        ? omniboxPrefixes.system_command || ''
                                        : item.id === 'sessions'
                                          ? omniboxPrefixes.session || ''
                                          : item.id === 'automations'
                                            ? omniboxPrefixes.automation || ''
                                            : item.id === 'todos'
                                              ? omniboxPrefixes.todo || ''
                                              : item.id === 'chat_agents'
                                                ? omniboxPrefixes.agent || ''
                                                : ''
                          }
                        />
                      </span>
                    )}
                </button>
              );
            })}
            {(onSheetRedirect || onBoardRedirect) && (
              <>
                <div className="flex-grow" />
                <div className="pt-2 mt-auto flex items-center gap-2 pl-1 select-none shrink-0">
                  {onSheetRedirect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSheetRedirect();
                      }}
                      className="w-[28px] h-[28px] rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] hover:border-[var(--color-borderActive)] focus:outline-none"
                      title="Table (SpreadSheet)"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                        <line x1="8" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="8" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="8" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="5" cy="7" r="1" fill="currentColor" />
                        <circle cx="5" cy="12" r="1" fill="currentColor" />
                        <circle cx="5" cy="17" r="1" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                  {onBoardRedirect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBoardRedirect();
                      }}
                      className="w-[28px] h-[28px] rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] hover:border-[var(--color-borderActive)] focus:outline-none"
                      title="Board (Kanaban)"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                        <line x1="9" y1="2" x2="9" y2="22" stroke="currentColor" strokeWidth="1.5" />
                        <line x1="15" y1="2" x2="15" y2="22" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="4" y="5" width="3" height="4" rx="0.5" fill="currentColor" />
                        <rect x="4" y="11" width="3" height="6" rx="0.5" fill="currentColor" />
                        <rect x="10" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
                        <rect x="10" y="14" width="3" height="5" rx="0.5" fill="currentColor" />
                        <rect x="17" y="5" width="3" height="5" rx="0.5" fill="currentColor" />
                        <rect x="17" y="12" width="3" height="4" rx="0.5" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Main Board Content */}
        {!slashMode.slashDropdown && (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch gap-0 board-scrollbar pb-2.5">
            {finalGroups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-transparent">
                <FaSearch
                  size={24}
                  className="text-neutral-300 dark:text-neutral-700 mb-2 transition-transform duration-300 hover:scale-110"
                />
                <span className="text-sm font-medium text-neutral-400 dark:text-neutral-600">No suggestions found</span>
              </div>
            ) : (
              finalGroups.map((group, colIdx) => (
                <div
                  key={group.title}
                  className={clsx(
                    'flex flex-col items-start flex-1 min-w-[260px] max-w-[400px] bg-transparent pr-4 pl-4 pt-4 pb-4 box-border',
                    'border-r border-[var(--color-borderDefault)] last:border-r-0',
                  )}>
                  {/* Header */}
                  <div className="w-full pb-1 mb-1 justify-between min-h-[32px] shrink-0 flex items-center box-border">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className="text-[var(--color-iconDefault)] shrink-0 mr-3 flex items-center justify-center">{group.icon}</div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <h2 className="text-[14px] font-medium text-[var(--color-textPrimary)] tracking-tight leading-tight capitalize truncate flex items-center gap-1.5">
                          {group.title}
                          <span className="text-neutral-500 font-normal">· {group.items.length}</span>
                        </h2>
                      </div>
                    </div>
                    {!['bookmarks', 'commands', 'system commands'].includes(String(group.title).toLowerCase()) && (
                      <button
                        onClick={e => handleCreateItem(String(group.title).toLowerCase(), e)}
                        className="shrink-0 p-1.5 rounded-md text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer"
                        title={`Create new ${String(group.title).toLowerCase().slice(0, -1)}`}>
                        <FiPlus className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                    )}
                  </div>

                  {/* Cards Scrollable Area */}
                  <div className="flex-1 min-w-0 flex py-1 scroll-smooth box-border flex-col items-center overflow-y-auto overflow-x-hidden w-full gap-0 hide-scrollbar">
                    {(() => {
                      if (group.title.toLowerCase() !== 'todos') {
                        if (group.items.length === 0) return null;
                        return group.items.map((item: any, idx: number) => {
                          const unwrappedItem = unwrapProxy(item);
                          const rawTitle = getTitle(unwrappedItem);
                          const categoryLabel = getCategoryLabel(unwrappedItem);
                          const desc = getDesc(unwrappedItem);
                          const isFocused = focus[0] === colIdx && focus[1] === idx;
                          const compoundId = getItemCompoundId(unwrappedItem);
                          const displayedShortcut =
                            unwrappedItem._displayShortcut ||
                            unwrappedItem.item?._displayShortcut ||
                            (shortcutsMap[compoundId] ? normalizeShortcutTrigger(shortcutsMap[compoundId]) : '') ||
                            hotkeysMap[compoundId] ||
                            '';

                          return (
                            <div
                              key={idx}
                              id={`board-item-${colIdx}-${idx}`}
                              style={{ pointerEvents: 'all' }}
                              onPointerDown={e => {
                                if (e.button === 2) return;
                                e.stopPropagation();
                                e.preventDefault();
                                executeItem(unwrappedItem, e as any);
                              }}
                              onMouseDown={e => {
                                if (e.button === 2) return;
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              onContextMenu={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setContextMenuState({
                                  x: e.clientX,
                                  y: e.clientY,
                                  item: unwrappedItem,
                                });
                              }}
                              className="shrink-0 flex flex-col group cursor-pointer box-border relative w-full h-auto min-h-[32px] py-0.5 items-center">
                              <div
                                className={clsx(
                                  'rounded-xl transition-all duration-200 overflow-hidden box-border h-full py-2 px-3 w-full flex flex-col justify-center text-left',
                                  isFocused
                                    ? 'bg-[var(--color-selectedBg)] shadow-md border border-[var(--color-borderActive)]'
                                    : 'bg-transparent hover:bg-[var(--color-hoverBg)] border border-transparent',
                                )}>
                                <div className="flex items-center justify-between min-w-0 w-full gap-2">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                                      {renderIcon(unwrappedItem)}
                                    </div>
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span
                                        className="text-[13px] tracking-tight truncate leading-tight flex-1 min-w-0 font-medium text-[var(--color-textPrimary)] transition-colors duration-200">
                                        {highlightMatch(rawTitle, query)}
                                      </span>
                                      {shouldShowCategoryLabel(unwrappedItem) && categoryLabel && (
                                        <span
                                          className={clsx(
                                            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-tight border',
                                            isFocused
                                              ? 'text-[var(--color-textPrimary)] border-[var(--color-borderActive)] bg-[var(--color-selectedBg)]'
                                              : 'text-[var(--color-textSecondary)] border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] group-hover:text-[var(--color-textPrimary)]',
                                          )}>
                                          {categoryLabel}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {displayedShortcut && (
                                    <div className="shrink-0 ml-2">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--color-textSecondary)] border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] font-mono">
                                        {displayedShortcut.toLowerCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {desc && (
                                  <div className="flex min-w-0 w-full pl-[34px] mt-0.5">
                                    <span className="text-[11px] truncate w-full leading-relaxed text-[var(--color-textSecondary)]">
                                      {desc}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        });
                      }

                      // Otherwise, it is the Todos column! Group it into collapsible sections
                      const todoItems = group.items.map((t: any) => normalizeTodoBoardItem(t));
                      const allActive = todoItems.filter((t: any) => !t.isDone && !t.is_done);
                      const allDone = todoItems.filter((t: any) => t.isDone || t.is_done);

                      const nowVal = new Date();
                      const parseTaskDateLocal = (t: any) => {
                        if (t.scheduleTime) return new Date(t.scheduleTime);
                        if (t.event_deadline) return new Date(String(t.event_deadline).replace(' ', 'T'));
                        return new Date(0);
                      };

                      const overdueItems = allActive.filter((t: any) => {
                        const d = parseTaskDateLocal(t);
                        const isRecurring = t.scheduleType === 'recurring' || !!(t.is_recurring || t.recurring);
                        return (
                          !isRecurring &&
                          d.getTime() > 0 &&
                          d.getTime() < nowVal.getTime() &&
                          (!isSameDay(d, nowVal) ||
                            (t.event_deadline && String(t.event_deadline).includes(':')) ||
                            t.scheduleTime)
                        );
                      });

                      const scheduledItems = allActive.filter((t: any) => {
                        if (overdueItems.includes(t)) return false;
                        const d = parseTaskDateLocal(t);
                        const isRecurring = t.scheduleType === 'recurring' || !!(t.is_recurring || t.recurring);
                        if (isRecurring) return false;
                        return d.getTime() > nowVal.getTime() && !isSameDay(d, nowVal);
                      });

                      const activeItems = allActive.filter((t: any) => {
                        if (overdueItems.includes(t)) return false;
                        if (scheduledItems.includes(t)) return false;
                        return true;
                      });

                      const sorted = (arr: any[]) =>
                        [...arr].sort((a, b) => parseTaskDateLocal(a).getTime() - parseTaskDateLocal(b).getTime());

                      const renderTodoRowLocal = (item: any, idx: number) => {
                        const rawTitle = getTitle(item);
                        const isFocused = focus[0] === colIdx && focus[1] === idx;
                        return (
                          <div
                            key={`todo-${item.id}-${idx}`}
                            id={`board-item-${colIdx}-${idx}`}
                            style={{ pointerEvents: 'all' }}
                            onPointerDown={e => {
                              if (e.button === 2) return;
                              e.stopPropagation();
                              e.preventDefault();
                              executeItem(item, e as any);
                            }}
                            onMouseDown={e => {
                              if (e.button === 2) return;
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onContextMenu={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenuState({
                                x: e.clientX,
                                y: e.clientY,
                                item,
                              });
                            }}
                            className="shrink-0 flex flex-col group cursor-pointer box-border relative w-full h-auto min-h-[32px] py-0.5 items-center">
                            <div
                              className={clsx(
                                'rounded-xl transition-all duration-200 overflow-hidden box-border h-full py-2 px-3 w-full flex flex-col justify-center text-left',
                                isFocused
                                  ? 'bg-[var(--color-selectedBg)] shadow-md border border-[var(--color-borderActive)]'
                                  : 'bg-transparent hover:bg-[var(--color-hoverBg)] border border-transparent',
                              )}>
                              <div className="flex items-center justify-between min-w-0 w-full gap-2">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center">
                                    {renderIcon(item)}
                                  </div>
                                  <span
                                    className="text-[13px] tracking-tight truncate leading-tight flex-1 min-w-0 font-medium text-[var(--color-textPrimary)] transition-colors duration-200">
                                    {highlightMatch(rawTitle, query)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col min-w-0 w-full pl-[34px] mt-0.5 gap-0.5">
                                {renderTodoMetadata(item, isFocused)}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      const makeHeaderLocal = (key: string, label: string, count: number) => {
                        const isCollapsed = boardCollapsedGroups[key];
                        return (
                          <div
                            key={`${key}-header`}
                            className="w-full py-2 px-3 flex items-center gap-1.5 select-none cursor-pointer hover:bg-[var(--color-hoverBg)] rounded-lg transition-all"
                            onClick={e => {
                              e.stopPropagation();
                              setBoardCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
                            }}>
                            <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-textMuted)] uppercase flex items-center gap-1.5">
                              {isCollapsed ? '▶' : '▼'} {label} ({count})
                            </span>
                          </div>
                        );
                      };

                      const rows: React.ReactNode[] = [];
                      let localIdx = 0;

                      // 1. Overdue
                      if (overdueItems.length > 0) {
                        rows.push(makeHeaderLocal('overdue', 'Overdue', overdueItems.length));
                        if (!boardCollapsedGroups.overdue) {
                          sorted(overdueItems).forEach(t => {
                            rows.push(renderTodoRowLocal(t, localIdx++));
                          });
                        }
                      }

                      // 2. Active
                      if (activeItems.length > 0) {
                        rows.push(makeHeaderLocal('active', 'Active', activeItems.length));
                        if (!boardCollapsedGroups.active) {
                          sorted(activeItems).forEach(t => {
                            rows.push(renderTodoRowLocal(t, localIdx++));
                          });
                        }
                      }

                      // 3. Scheduled
                      if (scheduledItems.length > 0) {
                        rows.push(makeHeaderLocal('scheduled_fut', 'Scheduled', scheduledItems.length));
                        if (!boardCollapsedGroups.scheduled_fut) {
                          sorted(scheduledItems).forEach(t => {
                            rows.push(renderTodoRowLocal(t, localIdx++));
                          });
                        }
                      }

                      // 4. Completed
                      if (allDone.length > 0) {
                        rows.push(makeHeaderLocal('completed', 'Completed', allDone.length));
                        if (!boardCollapsedGroups.completed) {
                          [...allDone]
                            .sort((a, b) => parseTaskDateLocal(b).getTime() - parseTaskDateLocal(a).getTime())
                            .forEach(t => {
                              rows.push(renderTodoRowLocal(t, localIdx++));
                            });
                        }
                      }

                      return <div className="w-full flex flex-col gap-0">{rows}</div>;
                    })()}
                  </div>
                  {/* end Cards Scrollable Area */}
                </div>
              ))
            )}
          </div>
        )}
        {/* end Main Board Content */}
      </div>
      {/* end inner overflow-hidden board */}

      {/* ── Slash Category Launcher Dropdown ─────────────────────────────────────
          Outside the overflow-hidden inner board, so it is NEVER clipped.
          left-[150px] skips the sidebar; centered max-w-2xl in the content area.
      ───────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {slashMode.slashDropdown && (
          <>
            {/* Dim backdrop (invisible but catches clicks to close) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={() => {
                if (state?.onDismissSlashDropdown) {
                  state.onDismissSlashDropdown({ clearQuery: true, blur: true });
                } else {
                  state?.onQueryChange?.('');
                }
              }}
            />
            {/* Dropdown panel */}
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[-16px] left-0 right-0 z-[70] flex justify-center px-6 pt-0">
              <div
                role="listbox"
                aria-label="Slash search suggestions"
                className="w-full max-w-[480px] min-[1600px]:max-w-[540px] min-[1800px]:max-w-2xl max-[1480px]:max-w-[440px] max-[1370px]:max-w-[400px] max-[1270px]:max-w-[360px] bg-[var(--color-containerBg)] border border-[var(--color-borderDefault)] rounded-b-xl rounded-t-none shadow-2xl overflow-hidden flex flex-col">
                {/* Options */}
                <div className="flex flex-col py-1.5 max-h-[420px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0">
                  {visibleLauncherItems.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[var(--color-textMuted)] select-none">No matching results</div>
                  ) : (
                    <>
                      {filteredSuggestions.length > 0 && (
                        <div className="flex flex-col">
                          <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-[var(--color-textMuted)] tracking-wider uppercase select-none">
                            SUGGESTIONS
                          </div>
                          {filteredSuggestions.map(item => {
                            const globalIndex = visibleLauncherItems.indexOf(item);
                            const isSelected = slashDropdownSelectedIndex === globalIndex;
                            return (
                              <div
                                key={item.id}
                                role="option"
                                aria-selected={isSelected}
                                onMouseDown={e => e.preventDefault()}
                                onPointerDown={e => e.preventDefault()}
                                onClick={() => executeLauncherItem(item)}
                                onMouseEnter={() => setSlashDropdownSelectedIndex(globalIndex)}
                                className={clsx(
                                  'mx-2 px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors rounded-lg',
                                  isSelected
                                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]',
                                )}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="shrink-0 min-w-[36px] flex items-center justify-start">
                                    {item.icon}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-medium tracking-tight truncate">{item.title}</span>
                                    {item.description && (
                                      <span className="text-[11px] text-[var(--color-textMuted)] truncate opacity-80">{item.description}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {filteredCategories.length > 0 && (
                        <div className="flex flex-col mt-1">
                          <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-[var(--color-textMuted)] tracking-wider uppercase select-none">
                            ALL RESULTS
                          </div>
                          {filteredCategories.map(item => {
                            const globalIndex = visibleLauncherItems.indexOf(item);
                            const isSelected = slashDropdownSelectedIndex === globalIndex;
                            return (
                              <div
                                key={item.id}
                                role="option"
                                aria-selected={isSelected}
                                onMouseDown={e => e.preventDefault()}
                                onPointerDown={e => e.preventDefault()}
                                onClick={() => executeLauncherItem(item)}
                                onMouseEnter={() => setSlashDropdownSelectedIndex(globalIndex)}
                                className={clsx(
                                  'mx-2 px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition-colors rounded-lg',
                                  isSelected
                                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]',
                                )}>
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="shrink-0 w-[22px] h-[22px] flex items-center justify-center opacity-80 text-[var(--color-iconDefault)]">
                                    {item.icon}
                                  </div>
                                  <span className="text-[13px] font-medium tracking-tight truncate">{item.title}</span>
                                </div>
                                {item.alias && (
                                  <span
                                    className={clsx(
                                      'text-[11px] font-mono px-2 py-0.5 rounded-md border font-semibold tracking-wider min-w-[34px] text-center shrink-0',
                                      isSelected
                                        ? 'border-[var(--color-borderActive)] bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                                        : 'border-[var(--color-borderDefault)] bg-transparent text-[var(--color-textMuted)]',
                                    )}>
                                    /{item.alias}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* ─────────────────────────────────────────────────────────────────────── */}

      {contextMenuState && (
        <UnifiedContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          portalContainer={portalContainer}
          preferDown={contextMenuState.preferDown}
          onClose={() => {
            setContextMenuState(null);
            handleCancelEdit();
          }}
          actions={buildContextMenuActions(contextMenuState.item)}
          showSearch={!!userId}
          itemId={getItemCompoundId(contextMenuState.item)}
          hotkeyInput={
            editingHotkeyFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  const result = captureHotkey(e);
                  if (!result) return;
                  if (result === 'CANCEL') {
                    handleCancelEdit();
                  } else if (result) {
                    setEditValue(result as string);
                    setSaveError(null);
                  }
                },
                onSave: () => saveHotkey(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteHotkey,
                isSaving: isSaving,
                isUpdating: isUpdatingHotkey,
                onClear: () => {
                  setEditValue('');
                  saveHotkey(contextMenuState.item, '', false);
                },
              }
              : undefined
          }
          shortcutInput={
            editingShortcutFor && contextMenuState.item
              ? {
                value: editValue,
                onChange: setEditValue,
                onSave: () => saveShortcut(contextMenuState.item, editValue),
                onCancel: handleCancelEdit,
                onOverwrite: handleOverwriteShortcut,
                isSaving: isSaving,
                isUpdating: isUpdatingShortcut,
              }
              : undefined
          }
          onNavigateAlreadyAssigned={handleGoToConflict}
          error={saveError || undefined}
          conflictId={conflictId}
        />
      )}
    </div>
  );
});

export default BoardView;
