import { createTodo } from '../../todos/todoData';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { useShortcutValidation } from '../../../../../shared-components/shortcuts/hooks/useShortcutValidation';

import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Reorder } from 'framer-motion';
import {
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronRight,
  FaSave,
  FaTimes,
  FaArrowRight,
  FaLongArrowAltRight,
  FaCheckCircle,
  FaCheck,
  FaAt,
  FaFileAlt,
  FaPen,
  FaLink,
  FaSearch,
  FaHistory,
  FaBookmark,
  FaFolder,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaKeyboard,
  FaRobot,
  FaList,
  FaCopy,
  FaDirections,
  FaLayerGroup,
} from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiTag, FiSettings, FiCopy } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';

import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut, clearShortcut as apiClearShortcut } from '../../../../../shared-components/shortcuts';

import type { WorkspaceData } from '../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { SnippetRecord } from '../../snippets/snippetTypes';

import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { clsx } from 'clsx';
import { formatSaveDestinationPath, getDestinationPathDetails } from '../../../../../shared-components/pathUtils';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { getUserId } from '../../../../../storage/API/core/api';
import { deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { deleteUserShortcutByReference } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import { createTag } from '../../tags/tagData';
import { deleteSession, updateSession } from '../sessionData';

import type { BrowserTab, SelectedLink, ContentTab } from '../../links/linkTypes';
import { useChromeTabs } from '../../links/ui/hooks/useChromeTabs';
import { useLinkSessionManager } from '../useSessionManager';
import { TabButton } from '../../links/ui/components/TabButton';
import { HighlightedInput } from '../../links/ui/components/HighlightedInput';
import { useSessionEditor } from '../useSessionEditor';
import {
  type SessionOpenSettings,
  DEFAULT_SESSION_SETTINGS,
} from '../sessionSettings';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { nowUtc } from '../../../../../shared-components/utils';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';

interface SessionEditorViewProps {
  isOpen: boolean;
  onClose: () => void;
  session: any | null;
  prefill?: any | null;
  reload: () => void; // Kept for compatibility, though we use optimistic updates
}

interface SessionSettingsRowProps {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
  isLast?: boolean;
}

const SessionSettingsRow: React.FC<SessionSettingsRowProps> = ({
  title,
  description,
  enabled,
  onClick,
  isLast = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'w-full flex items-center justify-between gap-3 text-left py-2.5 px-3 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5',
      !isLast && 'border-b border-black/5 dark:border-white/5',
    )}
  > 
    <div className="min-w-0 flex-1">
      <div className="text-[12.5px] font-medium text-neutral-900 dark:text-neutral-100">{title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">{description}</div>
    </div>
    <div
      className={clsx(
        'relative h-5 w-9 shrink-0 rounded-full transition-all duration-200',
        enabled
          ? 'bg-indigo-600 shadow-sm'
          : 'bg-neutral-300 dark:bg-neutral-700',
      )}
      aria-hidden="true"
    >
      <span
        className={clsx(
          'absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200',
          enabled ? 'left-[18px]' : 'left-[2px]',
        )}
      />
    </div>
  </button>
);

const SessionDragHandle: React.FC = () => (
  <div className="grid grid-cols-2 gap-[2px]">
    {Array.from({ length: 6 }).map((_, index) => (
      <span
        key={index}
        className="h-[2.5px] w-[2.5px] rounded-full bg-current opacity-80"
      />
    ))}
  </div>
);


const EMPTY_INITIAL_URLS: any[] = [];

const getSessionReorderKey = (item: { id?: string; url?: string }, index?: number): string => {
  if (item.id) return item.id;
  return `${item.url || 'session-item'}-${index ?? 0}`;
};

const normalizeSessionTabUrl = (url?: string): string => {
  if (!url) return '';
  try {
    let value = String(url).toLowerCase().trim();
    value = value.replace(/^https?:\/\//, '');
    value = value.replace(/^www\./, '');
    value = value.replace(/\/$/, '');
    return value;
  } catch {
    return String(url || '').toLowerCase().trim();
  }
};

const getTabInstanceKey = (item: { id?: string; source?: string; originalData?: any } | null | undefined): string | null => {
  if (!item || item.source !== 'tab') return null;

  const runtimeTabId = item.originalData?.id;
  if (runtimeTabId !== undefined && runtimeTabId !== null && runtimeTabId !== '') {
    return `tab:${String(runtimeTabId)}`;
  }

  if (typeof item.id === 'string' && item.id.startsWith('tab-')) {
    const suffix = item.id.slice(4);
    const parsedTabId = suffix.split('-')[0];
    if (parsedTabId) {
      return `tab:${parsedTabId}`;
    }
  }

  return null;
};

const areSameSessionItems = (
  left: { id?: string; url?: string; source?: string; originalData?: any },
  right: { id?: string; url?: string; source?: string; originalData?: any },
): boolean => {
  const leftTabKey = getTabInstanceKey(left);
  const rightTabKey = getTabInstanceKey(right);
  if (leftTabKey && rightTabKey) {
    if (leftTabKey === rightTabKey) return true;
  }

  if (left.source === right.source && left.originalData && right.originalData) {
    const leftOriginalId = left.originalData?.id || left.originalData?.snippet_id;
    const rightOriginalId = right.originalData?.id || right.originalData?.snippet_id;
    if (leftOriginalId && rightOriginalId) {
      if (leftOriginalId === rightOriginalId) return true;
    }
  }

  const leftSource = left.source || 'tab';
  const rightSource = right.source || 'tab';
  const sameUrl = normalizeSessionTabUrl(left.url) === normalizeSessionTabUrl(right.url);

  // Tab rows can rehydrate without a stable source label, so URL identity is
  // the reliable match for live-tab vs saved-tab comparisons.
  if (leftSource === 'tab' || rightSource === 'tab') {
    return sameUrl;
  }

  return sameUrl && leftSource === rightSource;
};

const SessionEditorView: React.FC<SessionEditorViewProps> = ({
  isOpen,
  onClose,
  session: initialSessionProp,
  prefill,
  reload,
}) => {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('session-sidebar-portal-target'));
  }, [isOpen]);

  const handleTabCaptured = useCallback((newLink: SelectedLink) => {
    setSelectedLinks((prev: SelectedLink[]) => {
      if (!newLink.url) return prev;
      
      const newTabId = newLink.originalData?.id;
      if (newTabId) {
        const existingIndex = prev.findIndex(link => link.originalData?.id === newTabId);
        if (existingIndex !== -1) {
          const existing = prev[existingIndex];
          if (existing.url === newLink.url && existing.name === newLink.name) {
            return prev;
          }
          
          const updated = [...prev];
          updated[existingIndex] = { ...existing, url: newLink.url, name: newLink.name || existing.name };
          return updated;
        }
      }

      if (prev.some((link: SelectedLink) => areSameSessionItems(link, newLink))) return prev;
      return [...prev, newLink];
    });
  }, []);
  const {
    activeSessionId,
    setActiveSessionId,
    sessionName,
    setSessionName,
    sessionError,
    setSessionError,
    isStartingSession,
    setIsStartingSession
  } = useLinkSessionManager(handleTabCaptured);
  const [localSessionOverride, setLocalSessionOverride] = useState<any | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hasUserModifiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setLocalSessionOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
    } else {
      hasUserModifiedRef.current = false;
      if (!initialSessionProp) {
        
      }
    }
  }, [isOpen, initialSessionProp]);

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const sessions = useDbStore(state => state.sessions);
  const snippets = useDbStore(state => state.snippets);
  const automations = useDbStore(state => state.automations);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const tags = useDbStore(state => state.tags);

  const workspaceNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach((w: any) => {
      map[w.id] = w.workspaceName;
    });
    return map;
  }, [workspaces]);

  const folderNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach((f: any) => {
      map[f.id] = f.folderName;
    });
    return map;
  }, [folders]);

  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach((t: any) => {
      map[t.id] = t.name;
    });
    return map;
  }, [tags]);

  const [tableSearchQuery, setTableSearchQuery] = useState('');

  const sortedSessions = useMemo(() => {
    const query = tableSearchQuery.trim().toLowerCase();
    const sorted = [...(sessions || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!query) return sorted;
    return sorted.filter(session => {
      const titleMatch = (session.title || (session as any).name || '').toLowerCase().includes(query);
      const previewMatch = (session.urls || (session as any).tabs || [])
        .some((item: any) => `${item.name || ''} ${item.url || ''}`.toLowerCase().includes(query));
      return titleMatch || previewMatch;
    });
  }, [sessions, tableSearchQuery]);

  const resolvedActiveSession = useMemo(() => {
    if (!activeSessionId) return null;
    const found = sessions.find(
      session => String(session.id) === String(activeSessionId)
    );
    return found || null;
  }, [activeSessionId, sessions]);

  const initialSession = isForceCreateNew ? null : resolvedActiveSession || localSessionOverride || initialSessionProp;
  const currentSessionId = isForceCreateNew ? null : (initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null);
  const persistedSessionRecord = useMemo(() => {
    if (!currentSessionId) return null;
    return (
      sessions.find(session => String(session.id) === String(currentSessionId)) ||
      null
    );
  }, [currentSessionId, sessions]);
  const isMac = navigator.userAgent.includes('Mac');
  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);

  const initialUrls = useMemo(() => {
    if (!prefill) return EMPTY_INITIAL_URLS;
    if (prefill.category === 'TabGroup') return EMPTY_INITIAL_URLS;
    return [
      {
        id: prefill.id || (prefill as any).snippet_id || `temp-${Date.now()}`,
        url: typeof prefill.value === 'string' ? prefill.value : '',
        name: prefill.key || '',
        source: 'link',
      }
    ];
  }, [prefill]);

  const {
    sessionTitle: title,
    setSessionTitle: setTitle,
    sessionUrls: selectedLinks,
    setSessionUrls: setSelectedLinks,
    sessionShortcut,
    setSessionShortcut,
    isSessionShortcutManuallyEditedRef,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    lastSavedAt,
    setLastSavedAt,
    lastSavedShortcutRef,
    lastSavedTitleRef,
    isDirty: hasUnsavedChanges,
    handleSave: executeSave,
    activeSessionId: liveSessionId,
    resetEditor,
    isInitialized,
    workspaceId,
    setWorkspaceId,
    folderId,
    setFolderId,
    tagIds,
    setTagIds,
    openSettings: sessionOpenSettings,
    setOpenSettings: setSessionOpenSettings,
    isShortcutInitialized,
  } = useSessionEditor({ sessionId: currentSessionId || undefined, initialDraftKey: prefill?.key || '', initialDraftUrls: EMPTY_INITIAL_URLS });

  const { validateShortcut } = useShortcutValidation();
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  // Clear validation errors when switching between active sessions/drafts
  useEffect(() => {
    if (setSessionError) setSessionError(null);
    setShortcutError(null);
  }, [liveSessionId, setSessionError]);

  const sessionCompoundId = useMemo(() => {
    if (!currentSessionId) return '';

    return getItemCompoundId({
      id: currentSessionId,
      workspace_id: workspaceId || undefined,
      folder_id: folderId || undefined,
      snippet: {
        id: currentSessionId,
        category: 'session',
      },
    });
  }, [currentSessionId, workspaceId, folderId]);

  useEffect(() => {
    if (liveSessionId && liveSessionId !== activeSessionId) {
      setActiveSessionId(liveSessionId);
    }
  }, [liveSessionId, activeSessionId, setActiveSessionId]);

  useEffect(() => {
    hasUserModifiedRef.current = false;
  }, [activeSessionId]);

  const [runningSessionId, setRunningSessionId] = useState<string | null>(null);

  // Determine mode based on whether a snippet is passed or has been saved
  const isEditMode = !!initialSession || !!liveSessionId;

  const { tabsByWindow, allTabs, currentWindowId, collapsedWindows, setCollapsedWindows, hasFetchedTabs, fetchTabs } = useChromeTabs(isOpen);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    let handleStorageChange: any = null;

    if (chromeAny?.storage?.local && currentWindowId !== null && currentWindowId !== undefined) {
      const checkRunningSession = () => {
        chromeAny.storage.local.get('active_sessions', (result: any) => {
          const sessionsList = result.active_sessions || [];
          const matched = sessionsList.find((s: any) => s.windowId === currentWindowId);
          setRunningSessionId(matched ? matched.sessionId : null);
        });
      };
      
      checkRunningSession();
      handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local' && changes.active_sessions) {
          checkRunningSession();
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (chromeAny?.storage?.onChanged && handleStorageChange) {
        chromeAny.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [currentWindowId]);

  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [hasAutoPinned, setHasAutoPinned] = useState(false);

  // Pin the tab automatically when a new session is saved for the first time
  useEffect(() => {
    if (!initialSession && saveStatus === 'saved' && !hasAutoPinned) {
      setHasAutoPinned(true);
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to auto-pin extension tab:', e);
      }
    }
  }, [saveStatus, initialSession, hasAutoPinned]);

  // Session open-behavior settings state
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const settingsPopupRef = useRef<HTMLDivElement | null>(null);
  const normalizeSessionShortcut = useCallback((value: string) => {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }, []);
  const hasPendingSessionChanges = hasUnsavedChanges;

  const hasPrefilledEditModeRef = useRef(false);

  useEffect(() => {
    if (!isInitialized) {
      setSessionError(null);
      return;
    }
    const trimmedName = title.trim();
    if (!trimmedName) {
      setSessionError(null);
      return;
    }
    const currentSessionId = (initialSession as any)?.id || (initialSession as any)?.snippet_id || liveSessionId;

    // 1. Check duplicate session names in local snippet records
    const exists = sessions.some((s: any) =>
      (s.title || '').trim().toLowerCase() === trimmedName.toLowerCase() &&
      String(s.id || s.snippet_id || '') !== String(currentSessionId || '')
    );

    if (exists) {
      setSessionError('A Tab Session with this name already exists.');
      return;
    }

    // 2. Check duplicate session names in active sessions stored in local storage
    const checkActiveSessions = async () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.get('active_sessions', (res: any) => {
          const activeSessions = res.active_sessions || [];
          const duplicateActive = activeSessions.some((s: any) =>
            s.sessionName?.toLowerCase() === trimmedName.toLowerCase() &&
            String(s.sessionId || '') !== String(currentSessionId || '')
          );
          if (duplicateActive) {
            setSessionError('A Tab Session with this name is currently active.');
          } else {
            setSessionError(null);
          }
        });
      } else {
        setSessionError(null);
      }
    };

    checkActiveSessions();
  }, [title, snippets, initialSession, liveSessionId, isInitialized]);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  useEffect(() => {
    if (initialSession && initialSession.updatedAt) {
      lastSyncTimeRef.current = initialSession.updatedAt;
    }
  }, [initialSession]);

  const handleOverwriteHotkey = async (conflictId: string, newValue: string) => {
    try {
      await deleteUserHotkeyByReference(conflictId);
      await handleHotkeyChange(newValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string, newValue: string) => {
    try {
      console.log(`[ShortcutDebug][SessionEditor] Executing handleOverwriteShortcut for value "${newValue}", deleting conflictId "${conflictId}"...`);
      await deleteUserShortcutByReference(conflictId);
      await handleShortcutChange(newValue, initialSession?.id || liveSessionId || currentSessionId || undefined);
      console.log('[ShortcutDebug][SessionEditor] Overwrite completed successfully.');
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
    }
  };

  const [isTitleManuallyModified, setIsTitleManuallyModified] = useState(false);




  // Load already-captured links from storage on session start/refresh
  useEffect(() => {
    
    if (!activeSessionId) return;

    chrome.storage.local.get('active_sessions', (result) => {
      const data = result.active_sessions || [];
      
      const session = data.find((s: any) => s.sessionId === activeSessionId);
      
      if (session) {
        if (Array.isArray(session.capturedUrls) && Array.isArray(session.capturedNames)) {
          const preloaded: SelectedLink[] = session.capturedUrls.map((url: string, index: number) => ({
            id: String(Date.now() + index + Math.random()),
            name: session.capturedNames[index]?.trim() || getHostname(url) || url,
            url: url,
            source: 'tab',
            favIconUrl: getFaviconUrl(getHostname(url))
          }));
          setSelectedLinks(prev => {
            if (prev.length === 0) return preloaded;
            return prev;
          });
        }

        // Legacy cloud team mapping removed - no longer needed with local Dexie storage
      }
    });
  }, [activeSessionId]);




  // Handle prefill data (e.g. from history/bookmarks/session)

  useEffect(() => {
    if (isOpen && !isEditMode && prefill && !hasInitializedPrefill.current) {
      setTitle(prefill.key || '');
      const prefillId = prefill.id || (prefill as any).snippet_id;
      if (prefillId && !prefill.searchtags) {
        chrome.storage.local.get('alts_searchtags_backup', result => {
          const backup = result.alts_searchtags_backup || {};
          if (backup[prefillId]) {
            // Note: Since we are in the outer parent state for 'prefill', we can't directly 
            // set (propertiesRef.current?.selectedTag) here. The real mapping happens in the internal useEffect around line 1150.
            // But we must remove setSearchtags since the state is gone.
          }
        });
      }

      if (prefill.category === 'TabGroup') {
        if (prefillId) {
          setActiveSessionId(prefillId);
        }
      } else {
        setSelectedLinks([
          {
            id: prefillId || `temp-${Date.now()}`,
            url: typeof prefill.value === 'string' ? prefill.value : '',
            name: prefill.key || '',
            source: 'link',
          },
        ]);
      }
      hasInitializedPrefill.current = true;
    } else if (!isOpen) {
      hasInitializedPrefill.current = false;
    }
  }, [isOpen, isEditMode, prefill]);

  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [userId, setUserId] = useState('');
  const footerStatusTimeoutRef = useRef<number | null>(null);

  const showFooterStatus = useCallback((type: 'idle' | 'saving' | 'success' | 'error', message: string) => {
    if (footerStatusTimeoutRef.current) {
      window.clearTimeout(footerStatusTimeoutRef.current);
    }
    setFooterStatus({ type, message });
    
    if (type === 'success' || type === 'error') {
      footerStatusTimeoutRef.current = window.setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  }, []);

  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isAltEnterPickerOpen, setIsAltEnterPickerOpen] = useState(false);
  const [isCustomLinkFormOpen, setIsCustomLinkFormOpen] = useState(false);
  const [isLeftCustomLinkFormOpen, setIsLeftCustomLinkFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [customLinkName, setCustomLinkName] = useState('');
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);

  // Hotkey assignment state (user: hotkey key-pair format)
  const propertiesRef = useRef<any>({});
  const initialFavRef = useRef<boolean>(false);

  // Reminder & Schedule states
          const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
  const [linkTodoStatus, setLinkTodoStatus] = useState<'idle' | 'creating' | 'success'>('idle');
  const [pendingTodoData, setPendingTodoData] = useState<{
    deadlineVal: string;
    isRecurring: boolean;
    recurringCycle: string | null;
    isAnytime: boolean;
    taskTitle: string;
    tempId: string;
  } | null>(null);
  const cyclePopupRef = useRef<HTMLDivElement | null>(null);
  const timePopupRef = useRef<HTMLDivElement | null>(null);
  const sessionPopupRef = useRef<HTMLDivElement | null>(null);
  const todoPopupRef = useRef<HTMLDivElement | null>(null);
  const todoHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cyclePopupRef.current && !cyclePopupRef.current.contains(event.target as Node)) {
        setIsCycleDropdownOpen(false);
      }
      if (timePopupRef.current && !timePopupRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
      if (todoPopupRef.current && !todoPopupRef.current.contains(event.target as Node)) {
        setIsTodoPopupOpen(false);
      }
      if (sessionPopupRef.current && !sessionPopupRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.session-btn')) {
        setSessionDialogOpen(false);
      }
      if (settingsPopupRef.current && !settingsPopupRef.current.contains(event.target as Node) && !(event.target as HTMLElement).closest('.settings-btn')) {
        setIsSettingsPopupOpen(false);
      }
      if (event.target instanceof Element && !event.target.closest('.three-dots-container')) {
        setActiveMenuLinkId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (locationHoverTimerRef.current) clearTimeout(locationHoverTimerRef.current);
      if (tagHoverTimerRef.current) clearTimeout(tagHoverTimerRef.current);
      if (todoHoverTimerRef.current) clearTimeout(todoHoverTimerRef.current);
    };
  }, []);

  // History and Bookmarks Search
  const [linkSuggestions, setLinkSuggestions] = useState<
    Array<{ title: string; url: string; source: 'history' | 'bookmark' }>
  >([]);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const customLinkUrlRef = useRef<HTMLInputElement>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');
  const editingUrlInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuLinkId, setActiveMenuLinkId] = useState<string | null>(null);

  const tabItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAutoSelectedRef = useRef(false);

  // Link edit popup state
  const [editingPopupLinkId, setEditingPopupLinkId] = useState<string | null>(null);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    search: string;
  } | null>(null);

  // Local state for the URL input to allow editing
  const [localUrlValue, setLocalUrlValue] = useState('');
  // Local state for the link name (display name) editing
  const [editingLinkName, setEditingLinkName] = useState('');
  const urlNameInputRef = useRef<HTMLInputElement>(null);
  const linkNameInputRef = useRef<HTMLInputElement>(null);
  const domainInputRef = useRef<HTMLInputElement>(null);

  const parseUrlParts = useCallback((url: string) => {
    try {
      let normalized = url.trim();
      if (normalized && !/^https?:\/\//i.test(normalized)) {
        normalized = `https://${normalized}`;
      }
      const u = new URL(normalized);
      const paths = u.pathname.split('/').filter(Boolean);
      const cleanDomain = u.host.replace(/^www\./i, '');
      return { protocol: u.protocol.replace(':', ''), domain: cleanDomain, paths, search: u.search };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: { protocol: string; domain: string; paths: string[]; search: string }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    const protocol = parts.protocol || 'https';
    return `${protocol}://${parts.domain}${pathStr}${parts.search}`;
  }, []);

  const duplicateLink = useCallback((link: SelectedLink) => {
    setSelectedLinks(prev => {
      const newId = `duplicate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      return [
        ...prev,
        {
          ...link,
          id: newId,
          name: `${link.name} (Copy)`
        }
      ];
    });
  }, []);

  const openLinkEditPopup = useCallback(
    (link: SelectedLink) => {
      const parts = parseUrlParts(link.url);
      setEditingPopupLinkId(link.id);
      setEditingUrlParts(parts);
      setLocalUrlValue(link.url.replace(/^https?:\/\/(www\.)?/i, ''));
      setEditingLinkName(link.name || '');
    },
    [parseUrlParts],
  );

  const closeLinkEditPopup = useCallback(() => {
    setEditingPopupLinkId(null);
    setEditingUrlParts(null);
    setLocalUrlValue('');
    setEditingLinkName('');
  }, []);

  const saveLinkEditPopup = useCallback(() => {
    if (!editingPopupLinkId) return;
    hasUserModifiedRef.current = true;
    let newUrl = editingUrlParts ? assembleUrl(editingUrlParts) : localUrlValue;
    
    newUrl = newUrl.trim();
    if (newUrl && !/^https?:\/\//i.test(newUrl)) {
      newUrl = `https://${newUrl}`;
    }

    setSelectedLinks(prev =>
      prev.map(link =>
        link.id === editingPopupLinkId ? { ...link, url: newUrl, name: editingLinkName || link.name } : link,
      ),
    );
    closeLinkEditPopup();
  }, [editingPopupLinkId, editingUrlParts, editingLinkName, localUrlValue, assembleUrl, closeLinkEditPopup]);

  // Track which path input is focused for inserting variables
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | null>(null);
  const [showPathQueryDropdown, setShowPathQueryDropdown] = useState(false);

  // Sync editingUrlParts to localUrlValue when parts change (if not editing manualy)
  useEffect(() => {
    if (!editingUrlParts) return;
    if (document.activeElement === urlNameInputRef.current) return;

    const assembled = assembleUrl(editingUrlParts);
    setLocalUrlValue(assembled.replace(/^https?:\/\/(www\.)?/i, ''));
  }, [editingUrlParts, assembleUrl]);

  // Content bar state (from BuildView)
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>('Current Tabs');
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState<SelectedLink[]>([]);

  // Fallback to Current Tabs if selected links are cleared
  useEffect(() => {
    if (selectedLinks.length === 0 && activeContentTab === 'Selected tabs') {
      setActiveContentTab('Current Tabs');
    }
  }, [selectedLinks.length, activeContentTab]);

  // "All saved files" inline search state
  const [isSavedFilesSearchOpen, setIsSavedFilesSearchOpen] = useState(false);
  const [savedFilesSearchQuery, setSavedFilesSearchQuery] = useState('');
  const [focusedSavedFileIndex, setFocusedSavedFileIndex] = useState(-1);
  const savedFilesInputRef = useRef<HTMLInputElement>(null);

  const savedFileSuggestions = useMemo(() => {
    if (savedFilesSearchQuery.trim().length < 3) return [];
    const q = savedFilesSearchQuery.toLowerCase();
    return availableItems.filter(i => String(i.name || "").toLowerCase().includes(q) || (i.url || '').toLowerCase().includes(q)).slice(0, 10);
  }, [availableItems, savedFilesSearchQuery]);
  const listContainerRef = useRef<HTMLDivElement>(null);


  const seenAutoSelectedTabsRef = useRef<Set<string>>(new Set());

  // Auto-select ALL browser tabs when opening in create mode for a Session
  useEffect(() => {
    if (isOpen && !isEditMode && !prefill && availableItems.length > 0) {
      const allTabsItems = availableItems.filter(item => item.source === 'tab');
      let addedAny = false;
      
      // Use functional state update to avoid dependency cycle
      setSelectedLinks(prevLinks => {
        const newLinks = [...prevLinks];
        for (const tab of allTabsItems) {
          const tabId = tab.originalData?.id || tab.url;
          if (tabId && !seenAutoSelectedTabsRef.current.has(String(tabId))) {
            seenAutoSelectedTabsRef.current.add(String(tabId));
            if (!newLinks.some(link => areSameSessionItems(link, tab))) {
              newLinks.push(tab);
              addedAny = true;
            }
          }
        }
        return addedAny ? newLinks : prevLinks;
      });

      if (addedAny) {
        seenAutoSelectedTabsRef.current.clear();
      }
    }
  }, [isOpen, isEditMode, prefill, availableItems, isTitleManuallyModified]);

  // Live-tracking: sync selectedLinks with currently open tabs (add opened, remove closed)
  const previousOpenTabsRef = useRef<Map<string, string> | null>(null);
  const liveTrackingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const currentSessionId = initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null;
    const isLiveSyncingSession = currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);

    if (!isOpen || sessionOpenSettings.autoSaveMode === 'dont_save' || !hasFetchedTabs || !isLiveSyncingSession) {
      previousOpenTabsRef.current = null;
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
        liveTrackingTimeoutRef.current = null;
      }
      return;
    }
    
    const allTabsItems = availableItems.filter(item => item.source === 'tab');
    const currentOpenTabState = new Map(
      allTabsItems
        .map(item => {
          const key = getTabInstanceKey(item);
          if (!key) return null;
          const signature = JSON.stringify({
            url: item.url,
            name: item.name,
            favIconUrl: item.favIconUrl || '',
          });
          return [key, signature] as const;
        })
        .filter((entry): entry is readonly [string, string] => Boolean(entry)),
    );
    const currentOpenItemsByKey = new Map(
      allTabsItems
        .map(item => {
          const key = getTabInstanceKey(item);
          return key ? [key, item] as const : null;
        })
        .filter((entry): entry is readonly [string, SelectedLink] => Boolean(entry)),
    );
    
    if (previousOpenTabsRef.current === null) {
      previousOpenTabsRef.current = currentOpenTabState;
      return;
    }

    const previousOpenTabState = previousOpenTabsRef.current;
    const addedTabKeys = [...currentOpenTabState.keys()].filter(tabKey => !previousOpenTabState.has(tabKey));
    const removedTabKeys = [...previousOpenTabState.keys()].filter(tabKey => !currentOpenTabState.has(tabKey));
    const changedTabKeys = [...currentOpenTabState.entries()]
      .filter(([tabKey, signature]) => previousOpenTabState.get(tabKey) !== undefined && previousOpenTabState.get(tabKey) !== signature)
      .map(([tabKey]) => tabKey);

    if (addedTabKeys.length > 0 || removedTabKeys.length > 0 || changedTabKeys.length > 0) {
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
      }
      liveTrackingTimeoutRef.current = window.setTimeout(() => {
        setSelectedLinks(prevLinks => {
          let newLinks = [...prevLinks];
          let changed = false;

          if (removedTabKeys.length > 0) {
            const beforeCount = newLinks.length;
            newLinks = newLinks.filter(link => {
              if (link.source !== 'tab') return true;
              const tabKey = getTabInstanceKey(link);
              if (!tabKey) return true;
              return !removedTabKeys.includes(tabKey);
            });
            if (newLinks.length !== beforeCount) changed = true;
          }

          if (changedTabKeys.length > 0) {
            newLinks = newLinks.map(link => {
              if (link.source !== 'tab') return link;
              const tabKey = getTabInstanceKey(link);
              if (!tabKey || !changedTabKeys.includes(tabKey)) return link;

              const updatedItem = currentOpenItemsByKey.get(tabKey);
              if (!updatedItem) return link;
              changed = true;
              return {
                ...link,
                url: updatedItem.url,
                name: updatedItem.name,
                favIconUrl: updatedItem.favIconUrl,
                originalData: updatedItem.originalData,
              };
            });
          }

          for (const tabKey of addedTabKeys) {
            if (!newLinks.some(link => getTabInstanceKey(link) === tabKey)) {
              const tabItem = currentOpenItemsByKey.get(tabKey);
              if (tabItem) {
                newLinks.push(tabItem);
                changed = true;
              }
            }
          }

          if (changed) {
            hasUserModifiedRef.current = true;
          }
          return changed ? newLinks : prevLinks;
        });
        liveTrackingTimeoutRef.current = null;
      }, 800);
    }

    previousOpenTabsRef.current = currentOpenTabState;
    return () => {
      if (liveTrackingTimeoutRef.current !== null) {
        window.clearTimeout(liveTrackingTimeoutRef.current);
        liveTrackingTimeoutRef.current = null;
      }
    };
  }, [isOpen, availableItems, sessionOpenSettings.autoSaveMode, setSelectedLinks, hasFetchedTabs, activeSessionId, runningSessionId, initialSession]);

  useEffect(() => {
    const currentSessionId = initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null;
    const isLiveSyncingSession = currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);

    if (!isOpen || sessionOpenSettings.autoSaveMode === 'dont_save' || !hasFetchedTabs || !isLiveSyncingSession) return;

    const currentTabItems = availableItems.filter(item => item.source === 'tab');
    if (currentTabItems.length === 0) return;

    setSelectedLinks(prevLinks => {
      const currentTabQueuesByUrl = new Map<string, SelectedLink[]>();
      currentTabItems.forEach(item => {
        const normalizedUrl = normalizeSessionTabUrl(item.url);
        const queueKey = `url:${normalizedUrl}`;
        const existingQueue = currentTabQueuesByUrl.get(queueKey) || [];
        existingQueue.push(item);
        currentTabQueuesByUrl.set(queueKey, existingQueue);
      });

      let changed = false;
      const nextLinks = prevLinks.map(link => {
        if (link.source !== 'tab' || getTabInstanceKey(link)) {
          return link;
        }

        const normalizedUrl = normalizeSessionTabUrl(link.url);
        const fallbackKey = `url:${normalizedUrl}`;
        const queue = currentTabQueuesByUrl.get(fallbackKey);
        const matchedLiveTab = queue?.shift();

        if (!matchedLiveTab) {
          return link;
        }

        changed = true;
        return {
          ...link,
          url: matchedLiveTab.url,
          name: link.name || matchedLiveTab.name,
          favIconUrl: link.favIconUrl || matchedLiveTab.favIconUrl,
          originalData: matchedLiveTab.originalData,
        };
      });

      if (changed) {
        hasUserModifiedRef.current = true;
      }
      return changed ? nextLinks : prevLinks;
    });
  }, [availableItems, isOpen, sessionOpenSettings.autoSaveMode, setSelectedLinks, hasFetchedTabs, activeSessionId, runningSessionId, initialSession]);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  // Manual location overrides (for changing folder via picker)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);
  const lastAutoSaveSignatureRef = useRef<string | null>(null);

  // If manualWorkspaceId is set, it means the user explicitly used the picker.
  // We should trust the manual state fully (even if folder is null) to allow moving to root.
  const isManualOverride = manualWorkspaceId !== null;

  const hasDestination = true;
  const needsDestinationSelection = false;

  const isDuplicateName = useCallback(
    (newName: string) => {
      // Duplicate checks in Redux are disabled as Dexie handles it natively
      return false;
    },
    [initialSession],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  const autoSaveSignature = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        urls: selectedLinks.map(link => link.url),
        shortcut: normalizeSessionShortcut(sessionShortcut),
        openSettings: sessionOpenSettings,
        tagIds: tagIds || [],
        workspaceId: workspaceId || null,
        folderId: folderId || null,
      }),
    [title, selectedLinks, sessionOpenSettings, normalizeSessionShortcut, sessionShortcut, tagIds, workspaceId, folderId],
  );
  const hasPersistedCurrentSignature =
    saveStatus !== 'saving' && lastAutoSaveSignatureRef.current === autoSaveSignature;
  const shouldShowUnsavedIndicator =
    hasPendingSessionChanges &&
    !hasPersistedCurrentSignature &&
    (
      sessionOpenSettings.autoSaveMode !== 'dont_save' ||
      hasUserModifiedRef.current ||
      saveStatus === 'saving'
    );

  // Load user ID on mount
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    fetchUserId();
  }, []);



  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (!initialSession) {
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialSession, isOpen, userId]);


  const { toggleFavorite, isFavorite } = useFavorites();

  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});

  const fetchTableMaps = useCallback(async () => {
    try {
      const [shortcuts, hotkeys] = await Promise.all([
        readAllShortcuts(),
        readAllHotkeys()
      ]);
      setShortcutsMap(shortcuts);
      setHotkeysMap(hotkeys);
    } catch (err) {
      console.error('Failed to fetch table maps', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void fetchTableMaps();
    }
  }, [isOpen, fetchTableMaps, activeSessionId, saveStatus]);

  const toggleFavoriteLocal = async (item: any) => {
    if (!userId) return;
    try {
      const targetId = item.id || (item as any).snippet_id;
      const type = 'session';
      await toggleFavorite(targetId, type, item.key);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const handleToggleFavorite = () => {
    if (initialSession) {
      toggleFavoriteLocal(initialSession);
    } else {
      
    }
  };

  const handleCreateTodoFromLink = async () => {
    // Cloud snippet-to-todo logic has been removed as it's dead code.
    setLinkTodoStatus('idle');
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    if (initialSession?.id && !String(initialSession.id).startsWith('temp-')) {
      try {
        if (!newHotkey) {
          await apiClearHotkey(initialSession.id, sessionCompoundId, 'session');
        } else {
          await apiSaveHotkey(initialSession.id, sessionCompoundId, newHotkey, 'session');
        }
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        showFooterStatus('error', 'Failed to update hotkey');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string, targetSessionId?: string) => {
    const sessionIdForShortcut = targetSessionId || initialSession?.id || liveSessionId;
    if (sessionIdForShortcut && !String(sessionIdForShortcut).startsWith('temp-')) {
      const compoundIdForShortcut = getItemCompoundId({
        id: sessionIdForShortcut,
        workspace_id: propertiesRef.current?.workspaceId || (initialSession as any)?.workspace_id || (initialSession as any)?.workspaceId || undefined,
        folder_id: propertiesRef.current?.folderId || (initialSession as any)?.folder_id || (initialSession as any)?.folderId || undefined,
        snippet: {
          id: sessionIdForShortcut,
          category: 'session',
        },
      });
      try {
        if (!newShortcut) {
          await apiClearShortcut(sessionIdForShortcut, compoundIdForShortcut, 'session');
        } else {
          await apiSaveShortcut(
            sessionIdForShortcut,
            compoundIdForShortcut,
            newShortcut,
            title.trim() || initialSession?.title || '',
            'session',
          );
        }
        showFooterStatus('success', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        showFooterStatus('error', 'Failed to update shortcut');
      }
    }
  };

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      // Append /{query} to the selected path component
      newPaths[focusedPathIndex] = (newPaths[focusedPathIndex] || '') + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else if (editingUrlParts.paths.length > 0) {
      // Default: append to last path
      const newPaths = [...editingUrlParts.paths];
      newPaths[newPaths.length - 1] = newPaths[newPaths.length - 1] + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      // No paths, add to domain
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex]);

  const teamId = '';

  const getHostname = useCallback((url: string) => {
    try {
      if (!url) return '';
      // Ensure protocol
      const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return new URL(safeUrl).hostname;
    } catch (error) {
      return url;
    }
  }, []);

  const getResolvedLinkFavicon = useCallback((link?: { url?: string; favIconUrl?: string }) => {
    if (link?.favIconUrl) return link.favIconUrl;
    if (!link?.url || !/^https?:\/\//i.test(link.url)) return '';
    return getFaviconUrl(getHostname(link.url));
  }, [getHostname]);


  useEffect(() => {
    if (!isLeftCustomLinkFormOpen || !customLinkUrl.trim()) {
      setLinkSuggestions([]);
      setFocusedSuggestionIndex(-1);
      return;
    }

    const query = customLinkUrl.trim();
    if (query.length < 1) return;

    const performSearch = async () => {
      const results: Array<{ title: string; url: string; source: 'history' | 'bookmark' }> = [];
      const chromeAny = (window as any).chrome;

      const searchBookmarks = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.bookmarks?.search) {
            chromeAny.bookmarks.search(query, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      const searchHistory = (): Promise<any[]> => {
        return new Promise(resolve => {
          if (chromeAny?.history?.search) {
            chromeAny.history.search({ text: query, maxResults: 10 }, (res: any[]) => resolve(res || []));
          } else {
            resolve([]);
          }
        });
      };

      try {
        const [bookmarks, history] = await Promise.all([searchBookmarks(), searchHistory()]);

        bookmarks.forEach((b: any) => {
          if (b.url) results.push({ title: b.title, url: b.url, source: 'bookmark' });
        });
        history.forEach((h: any) => {
          if (h.url) results.push({ title: h.title || getHostname(h.url), url: h.url, source: 'history' });
        });

        // Deduplicate by URL
        const unique = new Map();
        results.forEach(r => {
          if (!unique.has(r.url)) unique.set(r.url, r);
        });

        const finalResults = Array.from(unique.values()).slice(0, 5);
        
        setLinkSuggestions(finalResults);
        setFocusedSuggestionIndex(finalResults.length > 0 ? 0 : -1);
      } catch (e) {
        console.error('[LinkEditModal] Search failed:', e);
      }
    };

    performSearch();
  }, [customLinkUrl, isLeftCustomLinkFormOpen, getHostname]);

  // Focus title input on mount/open
  useEffect(() => {
    let timer: number | undefined;
    if (isOpen) {
      timer = window.setTimeout(() => {
        titleInputRef.current?.focus();
      }, 60);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
  };

  const rawSearchTagsRef = useRef<Record<string, string[]> | string>({});
  const lastPrefilledSnippetIdRef = useRef<string | null>(null);

  // Prefill fields when editing an existing session is now natively handled by useSessionEditor's liveSession sync.

  useEffect(() => {
    if (!isCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isCustomLinkFormOpen]);

  useEffect(() => {
    if (!isLeftCustomLinkFormOpen) return;
    const timeout = window.setTimeout(() => customLinkUrlRef.current?.focus(), 60);
    return () => window.clearTimeout(timeout);
  }, [isLeftCustomLinkFormOpen]);

  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedRef.current = false;
    }
  }, [isOpen]);

  // Auto-open custom link input if there are no open browser tabs on Current Tabs
  useEffect(() => {
    if (isOpen && activeContentTab === 'Current Tabs' && hasFetchedTabs && !hasAutoOpenedRef.current && !activeSessionId) {
      hasAutoOpenedRef.current = true;
    }
  }, [isOpen, activeContentTab, tabsByWindow, hasFetchedTabs, activeSessionId, currentWindowId]);

  useEffect(() => {
    if (!isOpen) return;
    fetchTabs();
    const interval = window.setInterval(fetchTabs, 5000);
    return () => window.clearInterval(interval);
  }, [isOpen, fetchTabs]);

  useEffect(() => {
    if (!editingUrlId) return;
    const t = window.setTimeout(() => editingUrlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [editingUrlId]);

  // Load items for content bar (from BuildView)
  useEffect(() => {
    if (!isOpen) return;

    const loadItems = async () => {
      const items: SelectedLink[] = [];

      // 1. Current Tabs from the active window only.
      // The session editor should not mix tabs from other browser windows into the
      // current session view, because that makes unrelated windows appear captured.
      const activeWindowTabs =
        tabsByWindow && currentWindowId !== null && currentWindowId !== undefined
          ? tabsByWindow[currentWindowId] || []
          : [];

      activeWindowTabs.forEach(t => {
        if (t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) {
          items.push({
            id: `tab-${t.id}`,
            url: t.url,
            name: t.title || 'Untitled Tab',
            favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),

            source: 'tab',
            originalData: t,
          });
        }
      });

      // 2. Links & Notes from Redux (allData)
      // Helper to process snippets into list items
      const processSnippet = (s: any) => {
        const category = String(s.category || "").toLowerCase();

        const isTabGroup = category === 'link' || category === 'link';
        const isLink = category === 'link';
        const isNote = category === 'snippet';

        if (!isLink && !isNote) return;

        let subtitle = '';
        if (isLink) {
          try {
            if (typeof s.value === 'string') {
              if (s.value.trim().startsWith('{')) {
                const parsed = JSON.parse(s.value);
                if (parsed.urls && Array.isArray(parsed.urls) && parsed.urls.length > 0) {
                  subtitle = parsed.urls[0];
                } else if (parsed.url) {
                  subtitle = parsed.url;
                } else {
                  subtitle = s.value;
                }
              } else {
                subtitle = s.value;
              }
            }
          } catch {
            subtitle = '';
          }
        } else {
          subtitle = 'Note';
        }

        items.push({
          id: s.id || s.snippet_id || `snip-${Math.random()}`,
          url: isNote ? `note:${s.id || s.snippet_id}` : subtitle,
          name: s.key || 'Untitled',
          source: isLink ? 'link' : 'note',
          favIconUrl: (isLink && subtitle) ? getFaviconUrl(getHostname(subtitle)) : undefined,
          originalData: s,
        });
      };

      const processAutomation = (auto: any) => {
        if (!auto) return;
        const steps = auto.automation_steps || auto.steps;
        const isAi =
          Array.isArray(steps) &&
          steps.some(
            (s: any) =>
              String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
        if (!isAi) return;

        if (items.some(existing => String(existing.id) === String(auto.id || auto.automation_id))) return;

        items.push({
          id: auto.id || auto.automation_id || `agent-${Math.random()}`,
          url: 'agent_chat',
          name: auto.name || auto.title || 'AI Agent',
          source: 'link',
          originalData: auto,
        });
      };

      // Fetch local automations
      try {
        const localData = await new Promise<any>(resolve => {
          chrome.storage.local.get(['automations', 'saved_automations'], resolve);
        });
        const toAutomationArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (value && typeof value === 'object') return Object.values(value);
          return [];
        };
        const syncedAutomations = toAutomationArray(localData?.automations);
        const legacyAutomations = toAutomationArray(localData?.saved_automations);
        const localAutos = syncedAutomations.length > 0 ? syncedAutomations : legacyAutomations;

        localAutos.forEach(processAutomation);
      } catch (e) {
        console.warn('[LinkEditModal] Failed to load local automations:', e);
      }

      // Load all local DB items so Recent and cross-workspace items stay visible.
      snippets.forEach(processSnippet);
      automations.forEach(processAutomation);

      // Sort items by updated_at or created_at (descending) to show recent items first
      // Note: originalData might not always have updated_at depending on source, fallback to created_at or 0
      items.sort((a, b) => {
        const tA = a.originalData?.updated_at || a.originalData?.created_at || 0;
        const tB = b.originalData?.updated_at || b.originalData?.created_at || 0;
        // Handle ISO strings or timestamps
        const timeA = new Date(tA).getTime();
        const timeB = new Date(tB).getTime();
        return timeB - timeA;
      });

      setAvailableItems(items);
    };

    loadItems();
  }, [isOpen, snippets, automations, tabsByWindow, activeSessionId, currentWindowId]);

  // Scroll to top when active tab changes
  useEffect(() => {
    if (listContainerRef.current) {
      listContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeContentTab]);

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    if (activeContentTab === 'Selected tabs') {
      return selectedLinks;
    }

    let list = availableItems;

    // Tab Filter
    if (activeContentTab === 'Current Tabs') {
      const notAddedCurrentTabs = availableItems.filter(item => {
        if (item.source !== 'tab') return false;
        return !selectedLinks.some(selected => areSameSessionItems(selected, item));
      });
      list = notAddedCurrentTabs;
    } else if (contentSearchQuery.trim() && activeContentTab === 'All saved files') {
      const q = contentSearchQuery.toLowerCase();
      list = list.filter(i => String(i.name || i.title || "").toLowerCase().includes(q) || String(i.url || "").toLowerCase().includes(q));
    }

    return list;
  }, [availableItems, activeContentTab, contentSearchQuery, selectedLinks]);

  const checkIsAdded = useCallback((item: SelectedLink) => {
    return selectedLinks.some(selected => areSameSessionItems(selected, item));
  }, [selectedLinks]);

  const liveTabTitleByUrl = useMemo(() => {
    const titles = new Map<string, string>();

    availableItems.forEach(item => {
      if (item.source !== 'tab') return;
      const normalizedUrl = normalizeSessionTabUrl(item.url);
      const title = String(item.title || item.name || '').trim();
      if (normalizedUrl && title) {
        titles.set(normalizedUrl, title);
      }
    });

    return titles;
  }, [availableItems]);

  const allRenderedItems = useMemo(() => {
    const renderedSelected = selectedLinks.map(item => ({
      item,
      isAdded: true,
    }));

    const renderedActive = (activeContentTab === 'Selected tabs')
      ? []
      : filteredItems.filter(item => !checkIsAdded(item)).map(item => ({
          item,
          isAdded: false,
        }));

    return [...renderedSelected, ...renderedActive];
  }, [selectedLinks, filteredItems, activeContentTab, checkIsAdded]);

  const handleWorkspaceDestination = useCallback(
    (workspace: any, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id || null);
      setManualFolderId(null);
      setIsLocationPickerOpen(false);
    },
    [],
  );

  const handleFolderDestination = useCallback(
    (workspace: any, folder: any, isPersonal?: boolean) => {
      // Switch team if personal workspace selected
      hasUserModifiedRef.current = true;

      // Update local override
      setManualWorkspaceId(workspace.workspace_id || null);
      setManualFolderId(folder.folder_id || null);
      setIsLocationPickerOpen(false);
    },
    [],
  );

  const addLink = useCallback(
    (tab: BrowserTab) => {
      hasUserModifiedRef.current = true;
      const linkName = tab.title || getHostname(tab.url);

      setSelectedLinks(prev => {
        const linkId = `tab-${tab.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            id: linkId,
            url: tab.url,
            name: linkName,
            favIconUrl: tab.favIconUrl,
            windowId: tab.windowId,
            source: 'tab' as const,
            originalData: tab,
          },
        ];
      });

      if (activeSessionId) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: tab.url
        }).catch(() => {});
      }
    },
    [getHostname, isTitleManuallyModified, activeSessionId],
  );

  const removeLink = useCallback((linkId: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.filter(link => link.id !== linkId));
  }, []);

  // Add item from content bar (handles tabs, links, notes)
  const addItemFromContentBar = useCallback(
    (item: SelectedLink) => {
      hasUserModifiedRef.current = true;
      if (item.url === 'agent_chat') {
        const agentId = item.id || item.originalData?.id || item.originalData?.snippet_id;

        setSelectedLinks(prev => {
          const agentUrl = `agent_chat?id=${agentId}`;
          if (prev.some(existing => existing.url === agentUrl)) return prev;

          const newId = `agent-${agentId}-${Date.now()}`;
          return [
            ...prev,
            {
              ...item,
              id: newId,
              url: agentUrl,
              name: `${item.name} (AI Agent)`,
              source: 'custom',
              favIconUrl: 'https://chatgpt.com/favicon.ico', // Indicator for AI
            },
          ];
        });
        return;
      }

      setSelectedLinks(prev => {
        const newId = `${item.source}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return [
          ...prev,
          {
            ...item,
            id: newId,
          },
        ];
      });

      if (activeSessionId && item.url) {
        chrome.runtime.sendMessage({
          action: 'open_tab_in_session',
          sessionId: activeSessionId,
          url: item.url
        }).catch(() => {});
      }
    },
    [isTitleManuallyModified, activeSessionId],
  );

  const updateLinkName = useCallback((linkId: string, name: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.map(link => (link.id === linkId ? { ...link, name: name || link.url } : link)));
  }, []);

  const handleAddCustomLink = useCallback(() => {
    hasUserModifiedRef.current = true;
    const rawUrl = customLinkUrl.trim();
    if (!rawUrl) {
      showFooterStatus('error', 'Enter a URL to add.');
      return;
    }

    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      // Validate URL

      new URL(normalizedUrl);
    } catch (error) {
      showFooterStatus('error', 'Enter a valid URL.');
      return;
    }

    const name = customLinkName.trim() || getHostname(normalizedUrl);
    const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const customLink: SelectedLink = {
      id,
      url: normalizedUrl,
      name,
      source: 'custom',
      favIconUrl: getFaviconUrl(getHostname(normalizedUrl)),
    };
    const nextSelectedLinks = [...selectedLinks, customLink];

    setSelectedLinks(nextSelectedLinks);

    if (sessionOpenSettings.autoSaveMode === 'auto_save') {
      void executeSave(true, {
        openSettings: sessionOpenSettings,
        workspaceId: propertiesRef.current?.workspaceId,
        folderId: propertiesRef.current?.folderId,
        tagIds: propertiesRef.current?.tagIds,
        urls: nextSelectedLinks,
      });
    }

    if (activeSessionId) {
      chrome.runtime.sendMessage({
        action: 'open_tab_in_session',
        sessionId: activeSessionId,
        url: normalizedUrl
      }).catch(() => {});
    }

    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    setActiveContentTab('Current Tabs');
  }, [customLinkName, customLinkUrl, getHostname, selectedLinks, executeSave, sessionOpenSettings, propertiesRef, activeSessionId]);

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);

  const handleCreateSession = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setIsStartingSession(true);
    setSessionError(null);

    try {
      // 1. Check duplicate session names in local snippet records
      let exists = false;
      const currentSessionIdLocal = (initialSession as any)?.id || (initialSession as any)?.snippet_id;
      exists = sessions.some((s: any) =>
        s.title?.trim().toLowerCase() === trimmedName.toLowerCase() &&
        String(s.id) !== String(currentSessionIdLocal) &&
        String((s as any).snippet_id) !== String(currentSessionIdLocal)
      );

      if (exists) {
        showFooterStatus('error', 'A Tab Session with this name already exists.');
        setIsStartingSession(false);
        return;
      }

      // 2. Check duplicate session names in active sessions stored in local storage
      const activeSessionsResult = await new Promise<any[]>((resolve) => {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get('active_sessions', (res: any) => resolve(res.active_sessions || []));
        } else {
          resolve([]);
        }
      });
      const currentSessionId = (initialSession as any)?.id || (initialSession as any)?.snippet_id || liveSessionId;
      const duplicateActive = activeSessionsResult.some((s: any) =>
        s.sessionName?.toLowerCase() === trimmedName.toLowerCase() &&
        String(s.sessionId || '') !== String(currentSessionId || '')
      );
      if (duplicateActive) {
        showFooterStatus('error', 'A Tab Session with this name is currently active.');
        setIsStartingSession(false);
        return;
      }

      const sessionId = isEditMode && initialSession
        ? (initialSession.id || (initialSession as any).snippet_id)
        : generateEntityId('session');

      // Pin the extension tab immediately when a session is started
      try {
        if ((window as any).chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'pin_extension_tab' });
        }
      } catch (e) {
        console.error('Failed to pin extension tab:', e);
      }

      const initialUrls = selectedLinks.map(l => l.url);
      const initialNames = selectedLinks.map(l => l.name);

      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'start_session',
          sessionId,
          sessionName: name.trim(),
          workspaceId: propertiesRef.current?.workspaceId || null,
          folderId: propertiesRef.current?.folderId || null,
          teamId,
          storageMode: 'local',
          initialUrls,
          initialNames,
          openSettings: sessionOpenSettings,
        }, (response) => {
          if (chrome.runtime.lastError || !response?.ok) {
            reject(new Error(response?.error || 'Failed to start session'));
          } else {
            resolve();
          }
        });
      });
      setSessionDialogOpen(false);
      setSessionName('');
      showFooterStatus('success', 'Tab Session started!');
      onClose(); // Return to home view since session is running in a separate window
    } catch (e: any) {
      showFooterStatus('error', e.message || 'Failed to start session');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleCopyTitleToShortcut = useCallback(() => {
    const normalizedShortcut = normalizeSessionShortcut(title);
    if (!normalizedShortcut) return;
    isSessionShortcutManuallyEditedRef.current = true;
    setSessionShortcut(normalizedShortcut);
    hasUserModifiedRef.current = true;
  }, [isSessionShortcutManuallyEditedRef, normalizeSessionShortcut, setSessionShortcut, title]);

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (sessionShortcut) {
        const sessionCompoundId = getItemCompoundId({
          id: currentSessionId,
          workspace_id: workspaceId || undefined,
          folder_id: folderId || undefined,
          snippet: {
            id: currentSessionId,
            category: 'session',
          },
        });
        if (shortcutsMap && shortcutsMap[sessionCompoundId] === sessionShortcut) {
          if (active) setShortcutError(null);
          return;
        }
        const res = await validateShortcut(sessionShortcut, currentSessionId || 'new');
        if (active) {
          if (!res.isValid) {
            setShortcutError(res.errorMessage || 'This shortcut is already taken.');
          } else {
            setShortcutError(null);
          }
        }
      } else {
        if (active) setShortcutError(null);
      }
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [sessionShortcut, currentSessionId, shortcutsMap, workspaceId, folderId, validateShortcut]);

  const handleSave = useCallback(
    async (
      isAutoSave: boolean = false,
      overrideLinks?: SelectedLink[],
      overrideTitle?: string,
      overrideSettings?: SessionOpenSettings,
      overrideProps?: { workspaceId?: string | null; folderId?: string | null; tagIds?: string[] }
    ) => {
      if (shortcutError) {
        if (!isAutoSave) {
          showFooterStatus('error', shortcutError);
        }
        return false;
      }
      if (!hasUnsavedChanges && !overrideProps && !overrideLinks && !overrideTitle && !overrideSettings) {
        return true;
      }
      if (overrideTitle !== undefined) setTitle(overrideTitle);
      if (overrideLinks !== undefined) setSelectedLinks(overrideLinks);

      const saved = await executeSave(isAutoSave, { 
        openSettings: overrideSettings || sessionOpenSettings,
        workspaceId: overrideProps?.workspaceId,
        folderId: overrideProps?.folderId,
        tagIds: overrideProps?.tagIds,
        title: overrideTitle,
        urls: overrideLinks,
      });

      if (saved) {
        setIsForceCreateNew(false);
      }

      if (saved && !isAutoSave) {
        setTimeout(() => onClose(), 1500);
      }
      return saved;
    }, [executeSave, setTitle, setSelectedLinks, onClose, sessionOpenSettings, shortcutError, hasUnsavedChanges]);

  const handlePropertiesChange = useCallback((properties: any) => {
    let newTagIds: string[] | undefined = undefined;
    
    // Extract tagIds from selectedTags (array of {id, name}) if provided
    if (properties.selectedTags !== undefined) {
      newTagIds = properties.selectedTags.map((tag: any) => tag.id) as string[];
      setTagIds(newTagIds);
    } else if (properties.tagIds !== undefined) {
      newTagIds = properties.tagIds as string[];
      setTagIds(newTagIds);
    }

    propertiesRef.current = {
      ...properties,
      tagIds: newTagIds !== undefined ? newTagIds : propertiesRef.current?.tagIds
    };

    if (properties.workspaceId !== undefined) {
      setWorkspaceId(properties.workspaceId);
    }
    if (properties.folderId !== undefined) {
      setFolderId(properties.folderId);
    }
    
    // Only trigger autosave if this was a user-initiated change
    if (properties.workspaceId !== undefined || properties.folderId !== undefined || properties.selectedTags !== undefined) {
      hasUserModifiedRef.current = true;
      void handleSave(true, undefined, undefined, undefined, {
        workspaceId: properties.workspaceId,
        folderId: properties.folderId,
        tagIds: newTagIds !== undefined ? newTagIds : propertiesRef.current?.tagIds
      });
    }
  }, [setWorkspaceId, setFolderId, setTagIds, tagIds, handleSave]);


  const updateSessionSettings = useCallback(
    (patch: Partial<SessionOpenSettings>) => {
      const hasChanges = Object.keys(patch).some(
        key => patch[key as keyof SessionOpenSettings] !== sessionOpenSettings[key as keyof SessionOpenSettings]
      );
      if (!hasChanges) return;

      const nextSettings = { ...sessionOpenSettings, ...patch }; 
      setSessionOpenSettings(nextSettings);

      const currentSessionId = initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null;
      const isLiveSyncing = currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);

      const shouldAutosave = Boolean(
        (activeSessionId && isLiveSyncing) || 
        (!activeSessionId && title.trim() && selectedLinks.length > 0)
      );
      if (shouldAutosave) {
        const shouldPreservePersistedContentOnly =
          nextSettings.autoSaveMode === 'dont_save' && !!persistedSessionRecord;

        void handleSave(
          true,
          shouldPreservePersistedContentOnly ? persistedSessionRecord.urls : undefined,
          shouldPreservePersistedContentOnly ? persistedSessionRecord.title : undefined,
          nextSettings,
        );
      }
    },
    [activeSessionId, handleSave, persistedSessionRecord, selectedLinks.length, sessionOpenSettings, title, runningSessionId, initialSession],
  );

  useEffect(() => {
    if (!isOpen || sessionOpenSettings.autoSaveMode !== 'auto_save') return;
    const currentSessionId = initialSession?.id || (initialSession as any)?.snippet_id || activeSessionId || null;
    const isLiveSyncingSession = currentSessionId && runningSessionId && String(currentSessionId) === String(runningSessionId);

    const shouldBlockAutoSave = !hasUserModifiedRef.current;
    if (shouldBlockAutoSave) {
      return;
    }
    if (!hasPendingSessionChanges) {
      lastAutoSaveSignatureRef.current = autoSaveSignature;
      return;
    }
    if (lastAutoSaveSignatureRef.current === autoSaveSignature) {
      return;
    }
    const timer = setTimeout(() => {
      void handleSave(true).then(saved => {
        if (saved) {
          lastAutoSaveSignatureRef.current = autoSaveSignature;
          hasUserModifiedRef.current = false;
        }
      });
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [autoSaveSignature, handleSave, hasPendingSessionChanges, isOpen, sessionOpenSettings.autoSaveMode, activeSessionId, runningSessionId, initialSession]);

  const parseSnippetValue = useCallback((value: string): SelectedLink[] => {
    if (!value) return [];
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.urls)) {
          return parsed.urls.map((url: string, index: number) => ({
            id: `cloud-${index}-${Date.now()}`,
            url,
            name: parsed.names?.[index] || getHostname(url),
            source: 'link' as const,
          }));
        }
      }
    } catch (e) {
      console.warn('[LinkEditModal] Failed to parse snippet value:', e);
    }
    return [{
      id: `cloud-single-${Date.now()}`,
      url: value,
      name: '',
      source: 'link' as const,
    }];
  }, [getHostname]);

  const handleResolveConflictOverwrite = useCallback(async () => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    
    // Set sync baseline to cloud timestamp so retry bypasses comparison check
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    
    // Retry saving
    await handleSave(false, localData.selectedLinks, localData.title);
  }, [conflictModalData, handleSave]);

  const handleResolveConflictMerge = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet, localData } = conflictModalData;
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    
    const merged = [...localData.selectedLinks];
    cloudLinks.forEach(cl => {
      if (!merged.some(l => l.url === cl.url)) {
        merged.push(cl);
      }
    });

    setTitle(cloudSnippet.key || localData.title);
    setSelectedLinks(merged);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Merged local and cloud edits');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const handleResolveConflictDiscard = useCallback(() => {
    if (!conflictModalData) return;
    const { cloudSnippet } = conflictModalData;
    
    setTitle(cloudSnippet.key || '');
    const cloudLinks = parseSnippetValue(cloudSnippet.value);
    setSelectedLinks(cloudLinks);
    
    lastSyncTimeRef.current = cloudSnippet.updated_at;
    setConflictModalData(null);
    showFooterStatus('success', 'Loaded cloud version');
  }, [conflictModalData, parseSnippetValue, showFooterStatus]);

  const hasSyncedInitialDataRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasSyncedInitialDataRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditMode && isOpen && !hasSyncedInitialDataRef.current) {
      if (title.trim() !== '' && selectedLinks.length > 0) {
        hasSyncedInitialDataRef.current = true;
      }
    }
  }, [
    isEditMode,
    isOpen,
    title,
    selectedLinks,
  ]);

  const handleCreateNew = useCallback(async () => {
    // Save current session silently (autosave=true) — we just want to persist,
    // NOT trigger onClose or open a new Chrome window
    await executeSave(true);

    setIsForceCreateNew(true);
    resetEditor();
    setLocalSessionOverride(null);
    hasInitializedPrefill.current = false;
    hasSyncedInitialDataRef.current = false;

    // Keep last workspace/folder for convenience, but clear session-specific tags
    propertiesRef.current = { 
      workspaceId: propertiesRef.current?.workspaceId ?? null, 
      folderId: propertiesRef.current?.folderId ?? null, 
      tagIds: [] 
    };

    // Reset all UI state
    setCustomLinkUrl('');
    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);
    setIsSettingsPopupOpen(false);
    setIsLocationPickerOpen(false);
    setIsTitleManuallyModified(false);
    setHasAutoPinned(false);
    setFooterStatus({ type: 'idle', message: '' });
    setEditingUrlId(null);
    setEditingUrlValue('');
    isSessionShortcutManuallyEditedRef.current = false;
    setSessionShortcut('');
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [executeSave, resetEditor]);

  const handleCloseAttempt = useCallback(async () => {
    const endSessionIfActive = () => {
      if (activeSessionId) {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.windows?.getCurrent) {
          chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
            if (currentWindow?.id) {
              chromeAny.runtime.sendMessage({
                action: 'end_session',
                windowId: currentWindow.id
              }).catch((e: any) => console.error('[LinkEditModal] Failed to send end_session to background:', e));
            }
          });
        }
        setActiveSessionId(null);
      }
    };
    
    // Explicitly force a final save before closing.
    const saved = await handleSave(false);
    if (!saved && shortcutError) {
      return;
    }
    
    onClose();
    endSessionIfActive();
  }, [activeSessionId, handleSave, onClose, hasPendingSessionChanges, shortcutError]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => {
      if (isLeftCustomLinkFormOpen || isCustomLinkFormOpen || document.getElementById('hotkey-assignment-popup')) {
        return true; // we just let those handle it or block it
      }
      handleCloseAttempt();
      return true; // We intercepted the escape, don't let uiStateManager forcefully close
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isOpen, isLeftCustomLinkFormOpen, isCustomLinkFormOpen, handleCloseAttempt]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isOpen) return;
      // Create New Shortcut strictly on Ctrl+Shift+Enter
      else if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        handleCreateNew();
      }
      // Location Picker Shortcut: Alt+Enter (Win) -> Option+Enter (Mac)
      else if (
        event.altKey && // Option is also altKey on Mac
        event.key === 'Enter'
      ) {
        event.preventDefault();
        if (saveStatus === 'saving') return;
        if (false) {
          showFooterStatus('error', 'Create a workspace first');
          return;
        }
        setIsLocationPickerOpen(prev => !prev);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        setIsCustomLinkFormOpen(true);
        setCustomLinkUrl(prev => (prev && prev.length > 0 ? prev : ''));
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    handleSave,
    saveStatus,
    needsDestinationSelection,
    onClose,

    isOpen,
    hasUnsavedChanges,
    title,
    selectedLinks,

    handleCloseAttempt,
    isMac,
    isEditMode,
    isLeftCustomLinkFormOpen,
    isCustomLinkFormOpen,
    handleCreateNew,
  ]);

  // Browser-level warning for unsaved changes commented out per request
  /*
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isOpen) return undefined;
      const hasUnsavedChanges = !isEditMode && (selectedLinks.length > 0 || title.trim().length > 0);

      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, isEditMode, selectedLinks.length, title]);
  */


  const [focusedTabIndex, setFocusedTabIndex] = useState(0);

  // Reset focus index when changing tabs
  useEffect(() => {
    setFocusedTabIndex(0);
  }, [activeContentTab]);

  // Sync focus index when left custom link form is toggled
  useEffect(() => {
    if (isLeftCustomLinkFormOpen) {
      setFocusedTabIndex(allRenderedItems.length);
    }
  }, [isLeftCustomLinkFormOpen, allRenderedItems.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleNavigation = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Skip global "Enter to add link" if certain interactive elements are focused
      const focused = document.activeElement;
      const isHeaderElementFocused =
        focused === titleInputRef.current ||
        focused === favButtonRef.current ||
        (hotkeyButtonRef.current &&
          (focused === hotkeyButtonRef.current || hotkeyButtonRef.current.contains(focused as Node)));

      if (
        isCustomLinkFormOpen ||
        isLeftCustomLinkFormOpen ||
        isLocationPickerOpen ||
        isAltEnterPickerOpen ||
        editingUrlId
      )
        return;

      const totalNavigable = allRenderedItems.length + 1;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev >= totalNavigable - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTabIndex(prev => (prev <= 0 ? totalNavigable - 1 : prev - 1));
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        // Stop global Enter trigger if typing in any input/textarea (like Title input, Search Tags input, etc.)
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
          return;
        }
        // Trigger Add Link even when typing in the title input (keeping focus in title input)
        e.preventDefault();
        e.stopPropagation();
        if (focusedTabIndex === allRenderedItems.length) {
          setIsLeftCustomLinkFormOpen(true);
          setCustomLinkUrl('');
        } else if (allRenderedItems[focusedTabIndex]) {
          const { item, isAdded } = allRenderedItems[focusedTabIndex];

          if (isAdded) {
            removeLink(item.id);
          } else {
            addItemFromContentBar(item);
          }
        }
      }
    };

    window.addEventListener('keydown', handleNavigation);
    return () => window.removeEventListener('keydown', handleNavigation);
  }, [
    allRenderedItems,
    selectedLinks,
    focusedTabIndex,
    addLink,
    addItemFromContentBar,
    removeLink,
    editingUrlId,
    isAltEnterPickerOpen,
    isCustomLinkFormOpen,
    isLeftCustomLinkFormOpen,
    isLocationPickerOpen,
    isOpen,
  ]);

  // Auto-select first tab when opening in create mode - DISABLED per user request
  // useEffect(() => {
  //   if (isOpen && !isEditMode && !hasAutoSelectedRef.current && allTabs.length > 0) {
  //     addLink(allTabs[0]);
  //     hasAutoSelectedRef.current = true;
  //   }
  //   if (!isOpen) {
  //     hasAutoSelectedRef.current = false;
  //   }
  // }, [isOpen, isEditMode, allTabs, addLink]);

  useEffect(() => {
    const el = tabItemRefs.current[focusedTabIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedTabIndex]);

  if (!isOpen) return null;

  const globalTabRenderIndex = 0;

  const handleUpdateItemField = useCallback(async (id: string, field: string, value: string) => {
    try {
      const existing = sortedSessions.find((s: any) => s.id === id);
      if (!existing) return;

      const currentActiveId = liveSessionId || currentSessionId || activeSessionId;
      const isEditingActiveItem = String(id) === String(currentActiveId);

      if (field === 'title') {
        const updatedTitle = value.trim() || 'Untitled Session';
        await updateSession(id, { title: updatedTitle });
        const compound = getItemCompoundId({
          id,
          workspace_id: existing.workspaceId || null,
          folder_id: existing.folderId || null,
          snippet: { id, category: 'session' },
        });
        const shortcut = shortcutsMap[compound] || '';
        if (shortcut) {
          await apiSaveShortcut(id, compound, shortcut.toLowerCase(), updatedTitle, 'session');
        }
        if (isEditingActiveItem) {
          setTitle(updatedTitle);
          if (lastSavedTitleRef) lastSavedTitleRef.current = updatedTitle;
          if (setSaveError) setSaveError(null);
          if (setSessionError) setSessionError(null);
        }
      } else if (field === 'shortcut') {
        const finalShortcut = value.toLowerCase().replace(/[^a-z0-9]/g, '');
        const compound = getItemCompoundId({
          id,
          workspace_id: existing.workspaceId || null,
          folder_id: existing.folderId || null,
          snippet: { id, category: 'session' },
        });
        if (finalShortcut) {
          await apiSaveShortcut(id, compound, finalShortcut, existing.title || 'Untitled Session', 'session');
        } else {
          await apiClearShortcut(id, compound, 'session');
        }
        if (isEditingActiveItem) {
          setSessionShortcut(finalShortcut);
          if (lastSavedShortcutRef) lastSavedShortcutRef.current = finalShortcut;
        }
      } else if (field === 'tags') {
        const tagNames = value.split(',').map(t => t.trim()).filter(Boolean);
        const resolvedTags: any[] = [];
        const allTags = useDbStore.getState().tags;
        for (const name of tagNames) {
          const matchedTag = allTags.find((t: any) => t.name.toLowerCase() === name.toLowerCase() && t.workspaceId === existing.workspaceId);
          if (matchedTag) {
            resolvedTags.push(matchedTag);
          } else if (existing.workspaceId) {
            const newTag = await createTag(name, existing.workspaceId);
            resolvedTags.push(newTag);
          }
        }
        await updateSession(id, { tagIds: resolvedTags.map((t: any) => t.id) });
      }

      if (isEditingActiveItem) {
        if (setSaveStatus) setSaveStatus('saved');
        if (setLastSavedAt) setLastSavedAt(new Date());
      }

      await fetchTableMaps();
    } catch (error) {
      console.error('[SessionEditorView] Failed to update item field:', error);
    }
  }, [sortedSessions, shortcutsMap, activeSessionId, liveSessionId, currentSessionId, setTitle, setSessionShortcut, setSaveStatus, setSaveError, setLastSavedAt, lastSavedTitleRef, lastSavedShortcutRef, fetchTableMaps]);
  return (
    <>
      <WorkspaceEditorLayout
        title={isEditMode ? 'Tab Sessions' : 'Create a Tab Session'}
        isDirty={hasUnsavedChanges && hasUserModifiedRef.current && (isEditMode || !!title.trim())}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        activeId={currentSessionId}
        hideRightColumnBorder={!(isEditMode || activeSessionId || currentSessionId)}
        onSave={async () => {
          const res = await executeSave(false);
          return !!res;
        }}
        onDiscard={resetEditor}
        onCloseCallback={onClose}
        searchQuery={tableSearchQuery}
        setSearchQuery={setTableSearchQuery}
        searchPlaceholder="Search sessions..."
        deleteModalProps={{
          isOpen: isDeleteDialogOpen,
          onClose: () => {
            setIsDeleteDialogOpen(false);
            setSessionToDeleteId(null);
          },
          onConfirm: async () => {
            if (sessionToDeleteId) {
              try {
                const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
                const fldObj = folderId ? { folder_id: folderId } : null;
                const compoundId = getItemCompoundId({ snippet: { id: sessionToDeleteId, category: 'session' }, workspace: wsObj, folder: fldObj });
                await apiClearShortcut(sessionToDeleteId, compoundId, 'session');
                await deleteSession(sessionToDeleteId);
                if (sessionToDeleteId === activeSessionId) {
                  resetEditor();
                }
                void fetchTableMaps();
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
            setIsDeleteDialogOpen(false);
            setSessionToDeleteId(null);
          },
          title: sessionToDeleteId && sessions.find(s => s.id === sessionToDeleteId)?.title ? `Delete "${sessions.find(s => s.id === sessionToDeleteId)?.title}"?` : 'Delete this session?',
          description: "Are you sure you want to delete this session? This action cannot be undone."
        }}
        headerActions={
          <div className="flex items-center gap-3">
            <SharedPropertiesToolbar
              key={currentSessionId || 'new-session'}
              initialSnippet={{ ...initialSession, ...initialSessionProp, workspaceId, folderId, tagIds: tagIds, category: 'session' }}
              compoundId={sessionCompoundId}
              defaultName={title || 'New Session'}
              onChange={handlePropertiesChange}
              showShortcut={false}
              showTodo={true}
              onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                if (!activeSessionId) return;
                const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                try {
                  const references = selectedLinks.map(link => ({
                    type: (link as any).category || 'tab',
                    id: link.id || link.url
                  }));
                  
                  const newTodo = await createTodo(
                    title || 'New Session',
                    references.length > 0 ? references : [{ type: 'session', id: activeSessionId }],
                    isRecurring ? 'recurring' : 'one-time',
                    scheduleTime,
                    isRecurring ? recurringCycle as any : undefined
                  );

                  const chromeAny = (window as any).chrome;
                  if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({
                      action: 'schedule_newtodo_alarm',
                      todoId: newTodo.id,
                      scheduleTime: scheduleTime
                    });
                  }
                } catch (err) {
                  console.error('Failed to create and schedule session todo', err);
                }
              }}
              saveStatus={saveStatus}
              openPopupsToBottom={true}
              layout="horizontal"
            />
            <div className="relative inline-block z-[9999]"> 
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsSettingsPopupOpen(prev => !prev);
                }}
                className="p-2 transition-all rounded-lg text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none z-50 settings-btn"
                title="Tab Session settings">
                <FiSettings size={14} />
              </button>
              {isSettingsPopupOpen && (
                <div
                  ref={settingsPopupRef}
                  className="absolute right-0 top-full mt-1.5 w-[285px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#18181c] text-neutral-600 dark:text-neutral-300 shadow-2xl shadow-black/80 opacity-100 z-[99999]"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-4 pt-3 pb-2 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
                      Tab Session settings
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSettingsPopupOpen(false)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-600 dark:hover:bg-white/5 dark:hover:text-neutral-200"
                    >
                      <FaTimes size={10} />
                    </button>
                  </div>

                  <div className="p-1.5">
                    <SessionSettingsRow
                      title="Open in a new window"
                      description="Open this tab session in a separate browser window."
                      enabled={sessionOpenSettings.openMode === 'new_window'}
                      onClick={() =>
                        updateSessionSettings({
                          openMode:
                            sessionOpenSettings.openMode === 'new_window'
                              ? 'same_window'
                              : 'new_window',
                        })
                      }
                    />
                    <SessionSettingsRow
                      title="Focus this window"
                      description="When opening in the same window, close existing tabs and start fresh."
                      enabled={sessionOpenSettings.focusWindow === true}
                      onClick={() =>
                        updateSessionSettings({
                          focusWindow: !sessionOpenSettings.focusWindow,
                        })
                      }
                    />
                    <SessionSettingsRow
                      title="Auto-save behavior"
                      description="Automatically update the session when tabs are added or removed."
                      enabled={sessionOpenSettings.autoSaveMode === 'auto_save'}
                      onClick={() => {
                        hasUserModifiedRef.current = true;
                        updateSessionSettings({
                          autoSaveMode:
                            sessionOpenSettings.autoSaveMode === 'auto_save'
                              ? 'dont_save'
                              : 'auto_save',
                        });
                      }}
                      isLast
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        rightColumnContent={
          (isEditMode || currentSessionId) ? (
            <div className="flex flex-col gap-3">
              <div className="mt-2 pt-2">
                <SessionSettingsRow
                  title="Auto-save behavior"
                  description="Automatically update the session when tabs are added or removed."
                  enabled={sessionOpenSettings.autoSaveMode === 'auto_save'}
                  onClick={() => {
                    hasUserModifiedRef.current = true;
                    updateSessionSettings({
                      autoSaveMode:
                        sessionOpenSettings.autoSaveMode === 'auto_save'
                          ? 'dont_save'
                          : 'auto_save',
                    });
                  }}
                  isLast
                />
              </div>
            </div>
          ) : undefined
        }
        bottomListContent={
          <ExistingItemsTable<any>
            items={sortedSessions}
            activeItemId={activeSessionId ?? null}
            onLoadItem={async (id) => {
              if (hasUnsavedChanges && (activeSessionId || title.trim().length > 0)) {
                setSessionNotice('Saving current session...');
                const saved = await executeSave(true);
                if (!saved) {
                  setSessionError('Please save your current session before switching.');
                  setSessionNotice(null);
                  return;
                }
                setSessionNotice(null);
              }
              
              const chromeAny = (window as any).chrome;
              if (activeSessionId && chromeAny?.storage?.local) {
                chromeAny.storage.local.get('active_sessions', (result: any) => {
                  const activeSessions: any[] = result.active_sessions || [];
                  const isCurrentlyTracking = activeSessions.some(
                    (s) => String(s.sessionId) === String(activeSessionId)
                  );
                  if (isCurrentlyTracking) {
                    try {
                      if (chromeAny.runtime?.sendMessage) {
                        chromeAny.runtime.sendMessage({ action: 'end_session', sessionId: activeSessionId });
                      }
                    } catch (err) {
                      console.error('Failed to stop session tracking', err);
                    }
                    setSessionNotice('Background tracking stopped. Edit normally.');
                    setTimeout(() => setSessionNotice(null), 6000);
                  }
                  if (setSaveError) setSaveError(null);
                  if (setSessionError) setSessionError(null);
                  setActiveSessionId(id);
                });
              } else {
                if (setSaveError) setSaveError(null);
                if (setSessionError) setSessionError(null);
                setActiveSessionId(id);
              }
            }}
            onUpdateItemField={handleUpdateItemField}
            getItemTitle={(item) => item.name || item.title || 'Untitled Session'}
            getItemPreview={(item) =>
              (item.urls || item.tabs || [])
                .map((t: any) => {
                  const text = t.name || t.title || t.url || '';
                  return text.length > 45 ? text.substring(0, 45) + '...' : text;
                })
                .filter(Boolean)
                .join(', ')
            }
            getItemCompoundId={(item) =>
              getItemCompoundId({
                id: item.id,
                workspace_id: item.workspaceId || null,
                folder_id: item.folderId || null,
                snippet: { id: item.id, category: 'session' },
              })
            }
            getItemType={() => 'session'}
            shortcutsMap={shortcutsMap}
            hotkeysMap={hotkeysMap}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onFavoriteToggled={fetchTableMaps}
            onDeleteClick={(id) => {
              setSessionToDeleteId(id);
              setIsDeleteDialogOpen(true);
            }}
            title=""
            emptyStateMessage="No sessions found"
            folderNamesMap={folderNamesMap}
            workspaceNamesMap={workspaceNamesMap}
            tagNamesMap={tagNamesMap}
          />
        }
        containerMaxWidthClass={(isEditMode || currentSessionId) ? "max-w-[1200px]" : "max-w-[940px]"}
      >
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="w-full flex-1 flex flex-col min-h-0 px-3 pt-0.5 pb-2 overflow-hidden">
            {/* Error notifications */}
            <EditorTitleShortcutInput
              titleError={sessionError || saveError}
              title={title}
              setTitle={(val) => {
                hasUserModifiedRef.current = true;
                if (val.trim()) {
                  if (setSaveError) setSaveError(null);
                  if (setSessionError) setSessionError(null);
                }
                setTitle(val);
              }}
              shortcut={sessionShortcut}
              setShortcut={(val) => {
                hasUserModifiedRef.current = true;
                setSessionShortcut(val);
              }}
              titlePlaceholder="Title"
              shortcutPlaceholder="Shortcut"
              onTitleBlur={() => {
                if (sessionOpenSettings.autoSaveMode === 'auto_save') {
                  void handleSave(true);
                }
              }}
              onShortcutBlur={async () => {
                if (sessionOpenSettings.autoSaveMode === 'auto_save' && hasUnsavedChanges) {
                  void handleSave(true);
                }
              }}
              onTitleEnter={(shiftKey) => {
                if (shiftKey) {
                  handleCopyTitleToShortcut();
                  return;
                }
                const trimmedTitle = title.trim();
                if (!activeSessionId && !isEditMode) {
                  if (!trimmedTitle) {
                    setSessionError('Enter the title');
                  } else {
                    setSessionError(null);
                    handleCreateSession(trimmedTitle);
                  }
                } else {
                  void handleSave(false);
                }
              }}
              onShortcutEnter={() => {
                if (hasUnsavedChanges) {
                  void handleSave(false);
                }
              }}
              onCopyTitleToShortcut={(isInitialized && isShortcutInitialized) ? handleCopyTitleToShortcut : undefined}
              titleRef={titleInputRef}
              shortcutRef={shortcutInputRef}
            />
            {sessionNotice && (
              <span className="flex items-center gap-1.5 whitespace-nowrap text-amber-600 dark:text-amber-400 mt-1 text-[12px] font-medium bg-amber-500/10 px-4 py-1 rounded-lg border border-amber-500/25 mx-4">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {sessionNotice}
              </span>
            )}

            {/* Main Workspace Inner content */}
            <div className={clsx(
              "flex-1 flex flex-col min-w-0 relative h-full max-h-full mt-4",
              ((isLeftCustomLinkFormOpen && linkSuggestions.length > 0) || isSettingsPopupOpen) ? "overflow-visible" : "overflow-hidden"
            )}>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 px-3.5">
                Tabs ({allRenderedItems.length})
              </h4>
              <div
                ref={listContainerRef}
                className={clsx(
                  "flex-1 min-h-0 w-full",
                  "rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden",
                  (isLeftCustomLinkFormOpen && linkSuggestions.length > 0)
                    ? "overflow-visible"
                    : "overflow-y-auto custom-scrollbar"
                )}>
                <div className="flex flex-col w-full divide-y divide-black/5 dark:divide-white/5 pb-2">
                  {(() => {
                    const renderedSelected = allRenderedItems.filter(i => i.isAdded);
                    const renderedActive = allRenderedItems.filter(i => !i.isAdded);

                    const renderItem = (item: any, isAdded: boolean, idx: number, globalIdx: number) => {
                      const handleToggle = (e?: React.MouseEvent) => {
                        if (e) {
                          e.stopPropagation();
                          e.preventDefault();
                        }
                        if (isAdded) {
                          removeLink(item.id);
                        } else {
                          addItemFromContentBar(item);
                        }
                      };

                      const itemIcon = (() => {
                        if (item.url === 'agent_chat') {
                          const step = (item.originalData?.automation_steps || item.originalData?.steps)?.[0];
                          let urls: string[] = [];
                          if (step?.config?.allAiUrls) {
                            urls = Object.values(step.config.allAiUrls as Record<string, string>)
                              .map(u => String(u))
                              .filter(u => !u.includes('cmd_select_status=false'));
                          } else if (step?.config?.url) {
                            urls = [step.config.url].filter(u => !u.includes('cmd_select_status=false'));
                          }

                          if (urls.length > 0) {
                            return (
                              <div className="flex -space-x-1.5 items-center w-8">
                                {urls.slice(0, 3).map((url, i) => (
                                  <div
                                    key={`agent-icon-${item.id}-${i}`}
                                    className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1E] overflow-hidden shadow-sm bg-white flex-shrink-0">
                                    <img
                                      src={getFaviconUrl(getHostname(url))}
                                      alt=""
                                      className="w-4 h-4 object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return (
                            <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                              <FaRobot size={12} />
                            </div>
                          );
                        }

                        const resolvedIcon = getResolvedLinkFavicon(item);
                        if (resolvedIcon) {
                          return <img src={resolvedIcon} className="w-5 h-5 object-contain" alt="" />;
                        }

                        return (
                          <div className="w-5 h-5 rounded flex items-center justify-center bg-[#eee8d5] dark:bg-neutral-800 text-[#93a1a1]">
                            {item.source === 'note' ? <FaFileAlt size={12} /> : <FaLink size={12} />}
                          </div>
                        );
                      })();

                      const itemLabel = (() => {
                        if (item.source === 'note' || item.url?.startsWith('note:')) {
                          return 'Note';
                        }
                        if (item.url === 'agent_chat') {
                          return 'AI Agent';
                        }
                        return (item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
                      })();
                      const liveTabTitle =
                        item.source === 'tab'
                          ? liveTabTitleByUrl.get(normalizeSessionTabUrl(item.url))
                          : '';
                      const itemTitle =
                        liveTabTitle ||
                        String(item.title || item.name || '').trim() ||
                        getHostname(item.url) ||
                        itemLabel;

                      const itemContent = (
                        <>
                          <div className="flex-shrink-0 relative flex items-center gap-2">
                            {isAdded ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200 active:cursor-grabbing"
                                style={{ willChange: 'transform' }}
                                title="Drag to reorder tabs"
                              >
                                <SessionDragHandle />
                              </div>
                            ) : null}
                            {itemIcon}
                          </div>

                          <div
                            className={clsx(
                              "text-[13px] font-medium tracking-tight truncate w-[280px] shrink-0",
                              isAdded ? "text-neutral-800 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-400"
                            )}
                            style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                            {itemTitle}
                          </div>

                          <div
                            className={clsx(
                              'text-[11px] font-normal truncate transition-opacity duration-200 text-left w-[260px] shrink-0 pr-4',
                              focusedTabIndex === globalIdx ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
                              'text-neutral-500 dark:text-neutral-400',
                            )}>
                            {itemLabel}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                             <div
                               className={clsx(
                                 "text-[12px] font-semibold transition-all duration-200 select-none shrink-0 flex items-center justify-center min-w-[50px]",
                                 "text-emerald-500 dark:text-emerald-400"
                               )}
                             >
                               {isAdded ? 'Added' : '+ Add'}
                             </div>

                             {isAdded && (
                               <div className="relative shrink-0 flex items-center">
                                 <button
                                   type="button"
                                   onClick={e => {
                                     e.stopPropagation();
                                     e.preventDefault();
                                     removeLink(item.id);
                                   }}
                                   className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center focus:outline-none"
                                   title="Remove link"
                                 >
                                   <FaTrash size={11} />
                                 </button>
                               </div>
                             )}
                           </div>
                        </>
                      );

                      const commonProps = {
                        ref: (el: HTMLDivElement | null) => {
                          tabItemRefs.current[globalIdx] = el;
                        },
                        onClick: handleToggle,
                        onDoubleClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          e.preventDefault();
                          openLinkEditPopup(item);
                        },
                        className: `group flex items-center gap-3 py-2 px-3 transition-all cursor-pointer focus:outline-none first:rounded-t-xl last:rounded-b-xl ${
                          focusedTabIndex === globalIdx
                            ? 'bg-white/10'
                            : 'hover:bg-white/5'
                        }`,
                      };

                      if (isAdded) {
                        return (
                          <Reorder.Item
                            key={getSessionReorderKey(item, idx)}
                            as="div"
                            value={getSessionReorderKey(item, idx)}
                            {...commonProps}
                          >
                            {itemContent}
                          </Reorder.Item>
                        );
                      }

                      return (
                        <div
                          key={getSessionReorderKey(item, idx)}
                          {...commonProps}
                        >
                          {itemContent}
                        </div>
                      );
                    };

                    return (
                      <>
                        <Reorder.Group
                          axis="y"
                          values={selectedLinks.map(getSessionReorderKey)}
                          onReorder={(nextOrder: string[]) => {
                            hasUserModifiedRef.current = true;
                            setSelectedLinks(currentLinks => {
                              const linksByKey = new Map(
                                currentLinks.map((link, index) => [getSessionReorderKey(link, index), link]),
                              );
                              const reordered = nextOrder
                                .map(key => linksByKey.get(key))
                                .filter((link): link is SelectedLink => Boolean(link));

                              if (reordered.length !== currentLinks.length) return currentLinks;
                              return reordered;
                            });
                          }}
                          className="flex flex-col"
                        >
                          {renderedSelected.map((wrap, idx) => renderItem(wrap.item, wrap.isAdded, idx, idx))}
                        </Reorder.Group>

                        {renderedActive.map((wrap, idx) =>
                          renderItem(wrap.item, wrap.isAdded, idx, renderedSelected.length + idx),
                        )}

                        {/* Custom link form appended inside the card wrapper when input form is open */}
                        {isLeftCustomLinkFormOpen ? (
                          <div
                            ref={el => {
                              tabItemRefs.current[allRenderedItems.length] = el as any;
                            }}
                            className="flex items-center gap-3 py-2 px-3 transition-all focus:outline-none bg-transparent relative z-50 last:rounded-b-xl">
                            
                            {/* Inline Text Input */}
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 justify-start">
                              {(allRenderedItems.length === 0 && !customLinkUrl) && (
                                <span className="text-red-500/50 text-[13.5px] font-bold select-none shrink-0">*</span>
                              )}
                              <input
                                ref={customLinkUrlRef}
                                value={customLinkUrl}
                                onChange={event => setCustomLinkUrl(event.target.value)}
                                onKeyDown={event => {
                                  if (
                                    linkSuggestions.length > 0 &&
                                    (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                                  ) {
                                    event.preventDefault();
                                    if (event.key === 'ArrowDown') {
                                      setFocusedSuggestionIndex(prev =>
                                        Math.min(prev + 1, linkSuggestions.length - 1),
                                      );
                                    } else {
                                      setFocusedSuggestionIndex(prev => Math.max(prev - 1, -1));
                                    }
                                    return;
                                  }

                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.stopPropagation();

                                    if (focusedSuggestionIndex >= 0 && linkSuggestions[focusedSuggestionIndex]) {
                                      const item = linkSuggestions[focusedSuggestionIndex];
                                      setSelectedLinks(prev => [
                                        ...prev,
                                        {
                                          id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                          url: item.url,
                                          name: item.title || getHostname(item.url),
                                          source: 'custom',
                                          favIconUrl: getFaviconUrl(getHostname(item.url)),
                                        },
                                      ]);
                                      setCustomLinkUrl('');
                                      setCustomLinkName('');
                                      setIsLeftCustomLinkFormOpen(false);
                                      setLinkSuggestions([]);
                                      setActiveContentTab('Current Tabs');
                                      return;
                                    }

                                    handleAddCustomLink();
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsLeftCustomLinkFormOpen(false);
                                    setCustomLinkUrl('');
                                    setCustomLinkName('');
                                  }
                                }}
                                placeholder="Type or paste a URL..."
                                autoFocus
                                className="w-full bg-transparent border-none text-[13.5px] font-normal text-[#073642] dark:text-neutral-100 placeholder-[var(--color-textPlaceholder)]/50 focus:outline-none h-6"
                                style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
                              />
                              {linkSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1C1C1E] border border-[#eee8d5] dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[99] overflow-hidden max-h-[250px] flex flex-col">
                                  <div className="px-3 py-1.5 text-[10px] font-bold text-[#93a1a1] dark:text-neutral-500 tracking-wider bg-[#fdf6e3]/50 dark:bg-black/20 border-b border-[#eee8d5] dark:border-white/5">
                                    Suggestions
                                  </div>
                                  <div className="overflow-y-auto custom-scrollbar">
                                    {linkSuggestions.map((suggestion, idx) => (
                                      <div
                                        key={idx}
                                        className={`px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors ${
                                          focusedSuggestionIndex === idx
                                            ? 'bg-[#3B66AE] text-white'
                                            : 'hover:bg-[#fdf6e3] dark:hover:bg-white/5 text-[#073642] dark:text-neutral-200'
                                        }`}
                                        onClick={() => {
                                          const id = `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                                          setSelectedLinks(prev => [
                                            ...prev,
                                            {
                                              id,
                                              url: suggestion.url,
                                              name: suggestion.title || getHostname(suggestion.url),
                                              source: 'custom',
                                              favIconUrl: getFaviconUrl(getHostname(suggestion.url)),
                                            },
                                          ]);
                                          setCustomLinkUrl('');
                                          setCustomLinkName('');
                                          setIsLeftCustomLinkFormOpen(false);
                                          setLinkSuggestions([]);
                                          setActiveContentTab('Current Tabs');
                                        }}>
                                        <div className="flex-shrink-0 relative">
                                          <img
                                            src={getFaviconUrl(getHostname(suggestion.url))}
                                            alt=""
                                            className="w-3.5 h-3.5 rounded-sm object-cover"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                          />
                                          <div className="hidden w-3.5 h-3.5 rounded flex items-center justify-center text-[#93a1a1]">
                                            {suggestion.source === 'bookmark' ? <FaBookmark size={10} /> : <FaHistory size={10} />}
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div
                                            className={`font-medium truncate ${focusedSuggestionIndex === idx ? 'text-white' : 'text-[#586e75] dark:text-neutral-200'}`}>
                                            {suggestion.title}
                                          </div>
                                          <div
                                            className={`truncate opacity-80 text-[10px] ${focusedSuggestionIndex === idx ? 'text-white/70' : 'text-[#93a1a1]'}`}>
                                            {suggestion.url}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setIsLeftCustomLinkFormOpen(true);
                              setCustomLinkUrl('');
                            }}
                            className="group flex items-center justify-center gap-2.5 py-4 px-3 transition-all cursor-pointer focus:outline-none hover:bg-white/5 last:rounded-b-xl"
                          >
                            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">
                              <FaPlus size={13} className="text-emerald-500 dark:text-emerald-400" />
                            </div>
                            <span className="text-base font-semibold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors">Add a custom link</span>
                          </div>
                        )}

                        {/* Empty State when no items are available */}
                        {allRenderedItems.length === 0 && !isLeftCustomLinkFormOpen && (
                          <div className="flex items-center justify-center gap-2 py-3 px-4 mx-4 mb-4 mt-2 border border-black/10 dark:border-white/10 rounded-lg">
                            <FaLink size={12} className="text-neutral-400 dark:text-neutral-500" />
                            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">No active tabs open</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              {isEditMode && !hasPendingSessionChanges && (
                <button
                  id="create-another-btn"
                  type="button"
                  onClick={handleCreateNew}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                      top: rect.top + window.scrollY - 46,
                      left: rect.left + window.scrollX - 40,
                    });
                    setShowTooltip(true);
                  }}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-black/10 dark:border-white/20 bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/90 hover:bg-neutral-200 dark:hover:bg-white/20 hover:text-neutral-900 dark:hover:text-white cursor-pointer select-none"
                >
                  <span>Create another</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </WorkspaceEditorLayout>

      {/* Link Edit Popup */}
      {editingPopupLinkId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-[8px]"
          onClick={closeLinkEditPopup}>
          <div
            style={{
              backgroundColor: 'rgba(23, 24, 33, 0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
            className="rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-5 min-w-[600px] max-w-[90%] text-white"
            onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Edit Link</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Link Name</td>
                  <td className="py-2">
                    <input
                      ref={linkNameInputRef}
                      value={editingLinkName}
                      onChange={e => setEditingLinkName(e.target.value)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          urlNameInputRef.current?.focus();
                        }
                      }}
                      placeholder="Enter display name for the link"
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                  <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      ref={urlNameInputRef}
                      value={localUrlValue}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/^https?:\/\/(www\.)?/i, '');
                        setLocalUrlValue(cleaned);
                        const parts = parseUrlParts(e.target.value);
                        if (parts) {
                          setEditingUrlParts(parts);
                        }
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          domainInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs truncate"
                    />
                  </td>
                </tr>
                {/* Only show Domain and Path fields if URL is parseable */}
                {editingUrlParts && (() => {
                  const parts = editingUrlParts;
                  return (
                    <>
                    <tr className="border-b border-[#eee8d5] dark:border-neutral-700">
                      <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Domain</td>
                      <td className="py-2 relative">
                        <HighlightedInput
                          ref={domainInputRef}
                          value={parts.domain}
                          onChange={(e: any) =>
                            setEditingUrlParts(prev => (prev ? { ...prev, domain: e.target.value } : prev))
                          }
                          onFocus={() => {
                            setFocusedField('domain');
                            setFocusedPathIndex(null);
                          }}
                          onBlur={(e: any) => {
                            if (e.relatedTarget === dropdownButtonRef.current) return;
                            setTimeout(() => setShowPathQueryDropdown(false), 150);
                          }}
                          onKeyDown={(e: any) => {
                            e.stopPropagation();
                            if (e.key === '@') {
                              e.preventDefault();
                              lastFocusedInputRef.current = e.currentTarget;
                              setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '@' } : prev));
                              setShowPathQueryDropdown(true);
                            } else if (showPathQueryDropdown) {
                              setShowPathQueryDropdown(false);
                            }
                          }}
                          className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                        />
                        {showPathQueryDropdown && focusedField === 'domain' && (
                          <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                            <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                              Add Variable (Click to select)
                            </div>
                            <button
                              ref={dropdownButtonRef}
                              type="button"
                              onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newDomain = parts.domain.replace(
                                      /@$/,
                                      parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                    );
                                    setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  } else if (e.key === 'Escape') {
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  }
                              }}
                              onClick={e => {
                                e.preventDefault();
                                const newDomain = parts.domain.replace(
                                  /@$/,
                                  parts.domain.endsWith('/') ? '{query}' : '/{query}',
                                );
                                setEditingUrlParts(prev => (prev ? { ...prev, domain: newDomain } : prev));
                                setShowPathQueryDropdown(false);
                                lastFocusedInputRef.current?.focus();
                              }}
                              className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                              Insert {'{query}'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {parts.paths.map((path, idx) => (
                      <tr key={idx} className="border-b border-[#eee8d5] dark:border-neutral-700">
                        <td className="py-2 pr-4 text-[#586e75] dark:text-neutral-400 font-medium">Path {idx + 1}</td>
                        <td className="py-2 relative">
                          <HighlightedInput
                            value={path}
                            onChange={(e: any) => {
                              const newPaths = [...parts.paths];
                              newPaths[idx] = e.target.value;
                              setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              }
                            }}
                            onFocus={() => {
                              setFocusedField('path');
                              setFocusedPathIndex(idx);
                            }}
                            onBlur={(e: any) => {
                              if (e.relatedTarget === dropdownButtonRef.current) return;
                              setTimeout(() => setShowPathQueryDropdown(false), 150);
                            }}
                            onKeyDown={(e: any) => {
                              e.stopPropagation();
                              if (e.key === '@') {
                                e.preventDefault();
                                lastFocusedInputRef.current = e.currentTarget;
                                const newPaths = [...parts.paths];
                                newPaths[idx] = path + '@';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                setShowPathQueryDropdown(true);
                              } else if (showPathQueryDropdown) {
                                setShowPathQueryDropdown(false);
                              } else if (e.key === 'Enter' && !/{query}|\[query\]/i.test(path)) {
                                e.preventDefault();
                                const newPaths = [...parts.paths];
                                newPaths[idx] = path + '{query}';
                                setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                              }
                            }}
                            className="w-full bg-[#eee8d5] dark:bg-neutral-800 border border-[#eee8d5] dark:border-neutral-700 rounded px-2 py-1 text-[#073642] dark:text-neutral-100 text-xs"
                          />
                          {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-[#fdf6e3] dark:bg-neutral-900 rounded-lg border border-[#eee8d5] dark:border-neutral-700 shadow-lg z-[9999]">
                              <div className="px-3 py-1.5 text-[10px] text-[#93a1a1] dark:text-neutral-400 border-b border-[#eee8d5] dark:border-neutral-700">
                                Add Variable (Click to select)
                              </div>
                              <button
                                ref={dropdownButtonRef}
                                type="button"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newPaths = [...parts.paths];
                                    const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                    newPaths[idx] = path.replace(/@$/, suffix);
                                    setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  } else if (e.key === 'Escape') {
                                    setShowPathQueryDropdown(false);
                                    lastFocusedInputRef.current?.focus();
                                  }
                                }}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  const newPaths = [...parts.paths];
                                  const suffix = path.endsWith('/') ? '{query}' : '/{query}';
                                  newPaths[idx] = path.replace(/@$/, suffix);
                                  setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                  setShowPathQueryDropdown(false);
                                  lastFocusedInputRef.current?.focus();
                                }}
                                className="w-full text-left px-3 py-2 text-xs bg-[#eee8d5] dark:bg-neutral-800 text-[#073642] dark:text-neutral-200 hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors focus:bg-[#eee8d5] dark:focus:bg-neutral-700 focus:outline-none">
                                Insert {'{query}'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                  );
                })()}
              </tbody>
            </table>
            <div className="flex justify-between items-center gap-2 mt-4">
              {editingUrlParts && (
                <button
                  type="button"
                  onClick={insertCustomVariable}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  {'{ }'} Insert Param{' '}
                  <span className="ml-1.5 px-1 rounded border border-[#eee8d5] dark:border-neutral-600 bg-[#fdf6e3] dark:bg-white/5 text-[9px] font-bold text-[#93a1a1] dark:text-neutral-400">
                    @
                  </span>
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-[#586e75] dark:text-neutral-300 bg-[#eee8d5] dark:bg-neutral-800 rounded-lg hover:bg-[#eee8d5] dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-white bg-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {conflictModalData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200]">
          <div className="bg-[var(--color-editorBg)] border border-black/10 dark:border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              Sync Conflict Detected
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4 leading-relaxed">
              This Tab Session was modified on another device/window since you opened it. How would you like to resolve the conflict?
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleResolveConflictMerge}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                Merge Changes (Keep Both)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictOverwrite}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-red-500/35 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all transform active:scale-95"
              >
                Overwrite Cloud (Keep Local)
              </button>
              <button
                type="button"
                onClick={handleResolveConflictDiscard}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-[var(--color-borderDefault)] bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all transform active:scale-95"
              >
                Reload Cloud Version (Discard Local)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Session Links Portal */}
      {portalTarget &&
        createPortal(
          <div className="flex flex-col gap-1.5 p-3 h-full overflow-y-auto custom-scrollbar">
            {selectedLinks.length > 0 ? (
              selectedLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 group relative"
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md overflow-hidden bg-white/50 dark:bg-black/20 shadow-sm border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                    {getResolvedLinkFavicon(link) ? (
                      <img src={getResolvedLinkFavicon(link)} className="w-3.5 h-3.5 object-contain" alt="" />
                    ) : (
                      <FaLink size={10} className="text-neutral-400 dark:text-neutral-500" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium tracking-wide truncate flex-1 text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                    {link.name || link.url}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <FaLayerGroup size={24} className="text-neutral-400" />
                <span className="text-[11px] font-medium text-neutral-500">No links captured yet</span>
              </div>
            )}
          </div>,
          portalTarget!
        )}

    </>
  );
};

export default SessionEditorView;
