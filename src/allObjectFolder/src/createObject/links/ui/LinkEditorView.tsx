import { createTodo } from '../../todos/todoData';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { EditorHeader } from '../../../../../shared-components/editorContainer/EditorHeader';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { useShortcutValidation } from '../../../../../shared-components/shortcuts/hooks/useShortcutValidation';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Reorder } from 'framer-motion';
import { FaPlus,
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
  FaEllipsisV,
  FaGlobe,
  FaLock,
  FaUsers,
  FaStar,
  FaKeyboard,
  FaList,
  FaCopy,
  FaDirections } from 'react-icons/fa';
import { FiStar, FiChevronLeft, FiChevronRight, FiTag, FiCopy } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { LuSparkles } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut, clearShortcut as apiClearShortcut } from '../../../../../shared-components/shortcuts';
import { getItemCompoundId, readAllHotkeys, readAllShortcuts } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';

import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { clsx } from 'clsx';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { getUserId } from '../../../../../storage/API/core/api';
import { deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { saveShortcut } from '../../../../../shared-components/shortcuts';
import { deleteUserShortcutByReference, normalizeShortcutTrigger } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import type { BrowserTab, CreateLinkInput, LinkRecord, SelectedLink, ContentTab, UpdateLinkInput } from '../linkTypes';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import { useChromeTabs } from './hooks/useChromeTabs';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import { HighlightedInput } from './components/HighlightedInput';
import { useLinkEditor } from '../useLinkEditor';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import type { SnippetRecord } from '../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { nowUtc } from '../../../../../shared-components/utils';
import { deleteLink, updateLink } from '../linkData';
import { createTag } from '../../tags/tagData';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';


interface LinkEditorViewProps {
  isOpen: boolean;
  onClose: () => void;
  link: any | null;
  prefill?: any | null;
  initialTagIds?: string[];
  onLinkCreated?: (link: any) => void | Promise<void>;
  reload: () => void; // Kept for compatibility, though we use optimistic updates
  isFullScreenMode?: boolean;
  isWidgetMode?: boolean;
  isOverlay?: boolean;
  hideRightPanel?: boolean;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
  onSavedClose?: () => void;
  saveLinkAdapter?: (args: {
    mode: 'create' | 'update';
    linkId?: string;
    input: CreateLinkInput | UpdateLinkInput;
  }) => Promise<LinkRecord>;
  propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
}

const LinkDragHandle: React.FC = () => (
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

const getLinkReorderKey = (item: { id?: string; url?: string }, index?: number): string => {
  if (item.id) return item.id;
  return `${item.url || 'link-item'}-${index ?? 0}`;
};

const LinkEditorView: React.FC<LinkEditorViewProps> = ({
  isOpen,
  onClose,
  link: initialLinkProp,
  prefill,
  initialTagIds,
  onLinkCreated,
  reload,
  isFullScreenMode = false,
  isWidgetMode = false,
  isOverlay: propIsOverlay,
  hideRightPanel = false,
  appearanceScope = 'default',
  appearanceTokens,
  onSavedClose,
  saveLinkAdapter,
  propertyPersistenceAdapter,
}) => {
  const activeEditor = useUIStore(state => state.activeEditor);
  const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
  const isAltSOverlay = appearanceScope === 'alts';
  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isNormalLinkMode = !isWidgetMode && !isFullScreenMode && !isOverlay && !isFocusMode;

  useEffect(() => {
    // Portal target for session sidebar removed
  }, []);

  const [localLinkOverride, setLocalLinkOverride] = useState<any | null>(null);
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const hasUserModifiedRef = useRef(false);
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const [hotkeysMap, setHotkeysMap] = useState<Record<string, string>>({});
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [linkToDeleteId, setLinkToDeleteId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setLocalLinkOverride(null);
      setIsForceCreateNew(false);
      hasPrefilledEditModeRef.current = false;
      hasUserModifiedRef.current = false;
      isShortcutManuallyEditedRef.current = false;
      setLinkShortcut('');
    } else {
      hasUserModifiedRef.current = false;
      isShortcutManuallyEditedRef.current = false;
      if (!initialLinkProp && !localLinkOverride) {
        setLinkShortcut('');
      }
      if (!initialLinkProp) {

      }
      const focusInput = () => {
        const input = titleInputRef.current;
        if (input) {
          input.focus();
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      };
      // Immediate and fallback timeouts to guarantee DOM focus inside modal on open/mount
      setTimeout(focusInput, 50);
      setTimeout(focusInput, 150);
    }
  }, [isOpen, initialLinkProp, localLinkOverride]);

  const initialLink = isForceCreateNew ? null : localLinkOverride || initialLinkProp;

  const linkId = initialLink?.id || (initialLink as any)?.snippet_id || null;
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const snippets = useDbStore(state => state.snippets);
  const links = useDbStore(state => state.links);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const tags = useDbStore(state => state.tags);
  const { isFavorite, toggleFavorite, addFavorite } = useFavorites();

  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const rightSideSearchInputRef = useRef<HTMLInputElement>(null);

  // Legacy Redux team state removed - now using Dexie directly

  // const triggerNotification = useNotification(); // Removed toast usage

  // Legacy orgTeam logic removed

  const hasInitializedPrefill = useRef(false);
  const hasFetchedWorkspaces = useRef(false);

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



  const {
    linkTitle: title,
    setLinkTitle: setTitle,
    linkUrls: selectedLinks,
    setLinkUrls: setSelectedLinks,
    linkShortcut,
    setLinkShortcut,
    isShortcutManuallyEditedRef,
    saveStatus,
    setSaveStatus,
    saveError,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    lastSavedShortcutRef,
    isDirty: hasUnsavedChanges,
    handleSave: executeSave,
    activeLinkId,
    liveLink,
    handlePropertiesChange,
    workspaceId,
    folderId,
    tagIds,
    isLinkDeleted,
    conflictLink,
    resolveConflictWithRemote,
    keepLocalVersion,
    resetEditor,
    isInitialized,
    isShortcutInitialized,
    versionHistoryItems,
    selectedVersionId,
    setSelectedVersionId,
    isViewingHistory,
  } = useLinkEditor({ 
    linkId, 
    initialDraftKey: prefill?.key, 
    initialDraftUrls: EMPTY_INITIAL_URLS,
    initialTagIds,
    onLinkCreated,
    saveLinkAdapter,
    propertyPersistenceAdapter,
  });

  const tagIdsKey = useMemo(() => [...tagIds].sort().join('|'), [tagIds]);

  // Note: useLinkEditor already returns displayTitle/displayUrls/displayShortcut as
  // linkTitle/linkUrls/linkShortcut, which automatically switch to the historical
  // snapshot values when selectedVersionId is set. No extra sync effects needed.
  const initialProperties = useMemo(() => {
    return {
      id: activeLinkId,
      title: title,
      workspaceId: workspaceId,
      folderId: folderId,
      tagIds: tagIds,
      category: 'link',
      tags: [...tagIds].sort().map((id: string) => {
        const found = tags.find(t => t.id === id);
        return found ? found : { id, name: '' };
      }),
      
    };
  }, [activeLinkId, title, workspaceId, folderId, tagIds, tagIdsKey, tags]);

  const { validateShortcut } = useShortcutValidation();
  const [titleError, setTitleError] = useState<string | null>(null);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isShortcutOverrideable, setIsShortcutOverrideable] = useState<boolean>(false);
  const [shortcutConflictId, setShortcutConflictId] = useState<string | null>(null);

  // Clear validation errors when switching between active links/drafts
  useEffect(() => {
    setTitleError(null);
    setShortcutError(null);
  }, [activeLinkId]);

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (linkShortcut) {
        const currentCompound = getItemCompoundId({
          id: initialLink?.id || activeLinkId,
          workspace_id: workspaceId || null,
          folder_id: folderId || null,
          snippet: { id: initialLink?.id || activeLinkId, category: 'link' },
        });
        if (shortcutsMap && shortcutsMap[currentCompound] === linkShortcut) {
          if (active) {
            setShortcutError(null);
            setIsShortcutOverrideable(false);
            setShortcutConflictId(null);
          }
          return;
        }
        const res = await validateShortcut(linkShortcut, initialLink?.id || activeLinkId || 'new');
        if (active) {
          if (!res.isValid) {
            setShortcutError(res.errorMessage || 'This shortcut is already taken.');
            setIsShortcutOverrideable(!!res.isOverrideable);
            setShortcutConflictId(res.conflictId || null);
          } else {
            setShortcutError(null);
            setIsShortcutOverrideable(false);
            setShortcutConflictId(null);
          }
        }
      } else {
        if (active) {
          setShortcutError(null);
          setIsShortcutOverrideable(false);
          setShortcutConflictId(null);
        }
      }
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [linkShortcut, activeLinkId, initialLink, shortcutsMap, workspaceId, folderId, validateShortcut]);

  const handleOverrideShortcut = useCallback(async () => {
    if (!linkShortcut) return;
    console.log('[ShortcutDebug] Executing handleOverrideShortcut for linkShortcut:', linkShortcut);
    let targetId = initialLink?.id || activeLinkId;
    if (!targetId) {
      console.log('[ShortcutDebug] Saving new link item to get real ID before shortcut reassignment...');
      const saveSuccess = await executeSave(true);
      if (!saveSuccess) return;
      targetId = activeLinkId;
    }
    if (!targetId) return;

    if (shortcutConflictId) {
      console.log('[ShortcutDebug] Explicitly clearing conflicting shortcut reference:', shortcutConflictId);
      if (propertyPersistenceAdapter?.clearShortcut) {
        await propertyPersistenceAdapter.clearShortcut({
          id: shortcutConflictId,
          referenceId: shortcutConflictId,
          type: 'link',
        });
      } else {
        await apiClearShortcut(shortcutConflictId, shortcutConflictId, 'link');
      }
    }

    const currentCompound = getItemCompoundId({
      id: targetId,
      workspace_id: workspaceId || null,
      folder_id: folderId || null,
      snippet: { id: targetId, category: 'link' },
    });
    console.log(`[ShortcutDebug] Saving shortcut "${linkShortcut}" to target ID "${targetId}" (compound: ${currentCompound})...`);
    if (propertyPersistenceAdapter?.saveShortcut) {
      await propertyPersistenceAdapter.saveShortcut({
        id: targetId,
        referenceId: currentCompound,
        shortcut: linkShortcut,
        label: title || 'Link',
        type: 'link',
      });
    } else {
      await apiSaveShortcut(targetId, currentCompound, linkShortcut, title || 'Link', 'link');
    }
    console.log('[ShortcutDebug] Shortcut reassignment saved to DB. Clearing validation error.');
    setShortcutError(null);
    setIsShortcutOverrideable(false);
    setShortcutConflictId(null);
    await executeSave(true);
  }, [linkShortcut, initialLink, activeLinkId, workspaceId, folderId, title, shortcutConflictId, executeSave, propertyPersistenceAdapter]);

  // Determine mode based on whether a snippet is passed or has been saved
  const isEditMode = !!initialLink || !!activeLinkId;

  const compoundId = useMemo(() => {
    if (!activeLinkId) return '';
    return getItemCompoundId({
      id: activeLinkId,
      workspace_id: workspaceId,
      folder_id: folderId,
      snippet: { id: activeLinkId, category: 'link' }
    });
  }, [activeLinkId, workspaceId, folderId]);

  const shouldLoadBrowserTabs = isOpen;
  const { tabsByWindow, allTabs, currentWindowId, collapsedWindows, setCollapsedWindows, hasFetchedTabs, fetchTabs } = useChromeTabs(shouldLoadBrowserTabs);
  const hasPrefilledEditModeRef = useRef(false);

  const lastSyncTimeRef = useRef<string | null>(null);
  const [conflictModalData, setConflictModalData] = useState<{
    cloudSnippet: any;
    localData: {
      title: string;
      selectedLinks: SelectedLink[];
    };
  } | null>(null);

  useEffect(() => {
    if (initialLink && initialLink.updated_at) {
      lastSyncTimeRef.current = initialLink.updated_at;
    }
  }, [initialLink]);

  const handleOverwriteHotkey = async (conflictId: string, newValue: string) => {
    try {
      if (propertyPersistenceAdapter?.clearHotkey) {
        await propertyPersistenceAdapter.clearHotkey({ id: conflictId, referenceId: conflictId, type: 'link' });
      } else {
        await deleteUserHotkeyByReference(conflictId);
      }
      await handleHotkeyChange(newValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
    }
  };

  const handleOverwriteShortcut = async (conflictId: string, newValue: string) => {
    try {
      if (propertyPersistenceAdapter?.clearShortcut) {
        await propertyPersistenceAdapter.clearShortcut({ id: conflictId, referenceId: conflictId, type: 'link' });
      } else {
        await deleteUserShortcutByReference(conflictId);
      }
      await handleShortcutChange(newValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
    }
  };

  const [isTitleManuallyModified, setIsTitleManuallyModified] = useState(false);






  const getBackupKey = useCallback(() => {
    const currentSnippetId = (initialLink as any)?.id || (initialLink as any)?.snippet_id;
    return currentSnippetId
      ? `unsaved_session_backup_${currentSnippetId}`
      : 'unsaved_session_backup_new';
  }, [initialLink]);

  const clearStashedBackup = useCallback(() => {
    void StorageManager.removeItem(getBackupKey());
  }, [getBackupKey]);





  // Handle prefill data (e.g. from history/bookmarks/session)
  useEffect(() => {
    if (isOpen && !isEditMode && prefill && !hasInitializedPrefill.current && !isForceCreateNew) {
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
          // session logic removed
        }
      } else {
        setSelectedLinks([
          {
            id: prefillId || generateEntityId('linkItem'),
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
  }, [isOpen, isEditMode, prefill, isForceCreateNew]);

  const [footerStatus, setFooterStatus] = useState<{ type: 'idle' | 'saving' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const userId = 'local_user';
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
  const [customLinkUrl, setCustomLinkUrl] = useState('');
  const [customLinkName, setCustomLinkName] = useState('');

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
  // Session popup logic removed
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
      // Session click outside handler removed
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
  const [suggestionRect, setSuggestionRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (linkSuggestions.length === 0 || !isLeftCustomLinkFormOpen) {
      setSuggestionRect(null);
      return;
    }

    const updateRect = () => {
      if (customLinkUrlRef.current) {
        const rect = customLinkUrlRef.current.getBoundingClientRect();
        setSuggestionRect({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [linkSuggestions, isLeftCustomLinkFormOpen]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const favButtonRef = useRef<HTMLButtonElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
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
    queryParams: Array<{ key: string; value: string }>;
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
      const paths = u.pathname
        .split('/')
        .filter(Boolean)
        .map(path => path.replace(/%7Bquery%7D/gi, '{query}').replace(/%5Bquery%5D/gi, '[query]'));
      const cleanDomain = u.host.replace(/^www\./i, '');
      const queryParams = Array.from(u.searchParams.entries()).map(([key, value]) => ({ key, value }));
      return { protocol: u.protocol.replace(':', ''), domain: cleanDomain, paths, queryParams };
    } catch {
      return null;
    }
  }, []);

  const assembleUrl = useCallback((parts: {
    protocol: string;
    domain: string;
    paths: string[];
    queryParams: Array<{ key: string; value: string }>;
  }) => {
    const pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
    const protocol = parts.protocol || 'https';
    const searchParams = new URLSearchParams();
    parts.queryParams.forEach(({ key, value }) => {
      if (key.trim()) searchParams.append(key, value);
    });
    const serializedSearch = searchParams
      .toString()
      .replace(/%7Bquery%7D/gi, '{query}')
      .replace(/%5Bquery%5D/gi, '[query]');
    const search = serializedSearch ? `?${serializedSearch}` : '';
    return `${protocol}://${parts.domain}${pathStr}${search}`;
  }, []);

  const duplicateLink = useCallback((link: SelectedLink) => {
    setSelectedLinks(prev => {
      const newId = generateEntityId('linkItem');
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
  const [focusedQueryIndex, setFocusedQueryIndex] = useState<number | null>(null);
  const [focusedField, setFocusedField] = useState<'domain' | 'path' | 'queryValue' | null>(null);
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


  useEffect(() => {
    if (!isOpen) {
      hasAutoSelectedRef.current = false;
    }
  }, [isOpen]);

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

  // If manualWorkspaceId is set, it means the user explicitly used the picker.
  // We should trust the manual state fully (even if folder is null) to allow moving to root.
  const isManualOverride = manualWorkspaceId !== null;

  const resolvedLocation = useMemo(() => {
    if (!isEditMode || !initialLink || (initialLink as any).workspace_id) return null;

    const snipId = initialLink.id || (initialLink as any).snippet_id;
    if (!snipId) return null;

    const match = snippets.find(
      (s: SnippetRecord) => String(s.id) === String(snipId) || String((s as any).snippet_id) === String(snipId),
    );
    if (!match) return null;

    return { workspace_id: match.workspaceId, folder_id: match.folderId ?? undefined };
  }, [isEditMode, initialLink, snippets]);

  const hasDestination = true;
  const needsDestinationSelection = false;

  const isDuplicateName = useCallback(
    (newName: string) => {
      // Duplicate checks in Redux are disabled as Dexie handles it natively
      return false;
    },
    [initialLink],
  );

  const isDuplicateTitle = useMemo(() => {
    return isDuplicateName(title);
  }, [title, isDuplicateName]);

  // Removed dead userId fetch effect

  // Sync Favorite, Hotkey and Shortcut state using unified utilities for 100% parity
  useEffect(() => {
    const syncData = async () => {
      if (!isOpen) return;

      if (!initialLink) {
        setPendingTodoData(null);
      }
    };

    syncData();
  }, [initialLink, isOpen]);




  const fetchTableMaps = useCallback(async () => {
    try {
      const [hotkeys, shortcuts] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
      setHotkeysMap(hotkeys);
      setShortcutsMap(shortcuts);
    } catch (error) {
      console.error('[LinkEditorView] Failed to fetch table maps:', error);
    }
  }, []);

  useEffect(() => {
    if (isAltSOverlay) return;
    void fetchTableMaps();
  }, [fetchTableMaps, activeLinkId, saveStatus, isAltSOverlay]);

  const toggleFavoriteLocal = async (item: any) => {
    try {
      const targetId = item.id || (item as any).snippet_id;
      const category = (item.category || '').toLowerCase();
      const type = category.includes('link') || category.includes('tabgroup') ? 'link' : 'note';
      await toggleFavorite(targetId, type, item.key);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  const handleToggleFavorite = () => {
    if (initialLink) {
      toggleFavoriteLocal(initialLink);
    } else {

    }
  };

  const handleCreateTodoFromLink = async () => {
    // Cloud snippet-to-todo logic has been removed as it's dead code.
    setLinkTodoStatus('idle');
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    if (initialLink?.id && !String(initialLink.id).startsWith('temp-')) {
      try {
        if (!newHotkey) {
          if (propertyPersistenceAdapter?.clearHotkey) {
            await propertyPersistenceAdapter.clearHotkey({ id: initialLink.id, referenceId: compoundId, type: 'link' });
          } else {
            await apiClearHotkey(initialLink.id, compoundId, 'link');
          }
        } else {
          if (propertyPersistenceAdapter?.saveHotkey) {
            await propertyPersistenceAdapter.saveHotkey({
              id: initialLink.id,
              referenceId: compoundId,
              hotkey: newHotkey,
              type: 'link',
            });
          } else {
            await apiSaveHotkey(initialLink.id, compoundId, newHotkey, 'link');
          }
        }
        showFooterStatus('success', newHotkey ? 'Hotkey updated' : 'Hotkey cleared');
      } catch (error) {
        console.error('Failed to update hotkey:', error);
        showFooterStatus('error', 'Failed to update hotkey');
      }
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    if (initialLink?.id && !String(initialLink.id).startsWith('temp-')) {
      try {
        if (!newShortcut) {
          if (propertyPersistenceAdapter?.clearShortcut) {
            await propertyPersistenceAdapter.clearShortcut({ id: initialLink.id, referenceId: compoundId, type: 'link' });
          } else {
            await apiClearShortcut(initialLink.id, compoundId, 'link');
          }
        } else {
          if (propertyPersistenceAdapter?.saveShortcut) {
            await propertyPersistenceAdapter.saveShortcut({
              id: initialLink.id,
              referenceId: compoundId,
              shortcut: newShortcut,
              label: title.trim() || initialLink.key || '',
              type: 'link',
            });
          } else {
            await apiSaveShortcut(
              initialLink.id,
              compoundId,
              newShortcut,
              title.trim() || initialLink.key || '',
              'link',
            );
          }
        }
        showFooterStatus('success', 'Shortcut updated');
      } catch (error) {
        console.error('Failed to update shortcut:', error);
        showFooterStatus('error', 'Failed to update shortcut');
      }
    }
  };

  const sortedLinks = useMemo(() => {
    if (hideRightPanel) return [];
    const query = tableSearchQuery.trim().toLowerCase();
    const sorted = [...links].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!query) return sorted;
    return sorted.filter(link => {
      const compound = getItemCompoundId({
        id: link.id,
        workspace_id: link.workspaceId || null,
        folder_id: link.folderId || null,
        snippet: { id: link.id, category: 'link' },
      });
      const shortcut = shortcutsMap[compound] || '';
      const titleMatch = (link.title || '').toLowerCase().includes(query);
      const shortcutMatch = shortcut.toLowerCase().includes(query);
      const previewMatch = (link.urls || [])
        .some((item: any) => `${item.name || ''} ${item.url || ''}`.toLowerCase().includes(query));
      return titleMatch || shortcutMatch || previewMatch;
    });
  }, [hideRightPanel, links, shortcutsMap, tableSearchQuery]);

  const handleLoadLinkItem = useCallback((id: string) => {
    const found = links.find(link => link.id === id);
    if (!found) return;
    setIsForceCreateNew(false);
    setLocalLinkOverride(found);
    hasInitializedPrefill.current = false;
    hasPrefilledEditModeRef.current = false;
  }, [links]);

  const handleDeleteLinkItem = useCallback(async (id: string) => {
    try {
      await deleteLink(id);
      if (id === activeLinkId) {
        useUIStore.getState().openEditor({ type: 'link', id: 'new' });
        setIsForceCreateNew(true);
        resetEditor();
        setLocalLinkOverride(null);
        hasInitializedPrefill.current = true;
        hasSyncedInitialDataRef.current = false;
        
        setCustomLinkUrl('');
        setCustomLinkName('');
        setIsCustomLinkFormOpen(false);
        setIsLeftCustomLinkFormOpen(false);
      }
    } catch (error) {
      console.error('[LinkEditorView] Failed to delete link item:', error);
    }
  }, [activeLinkId, resetEditor]);

  const handleUpdateItemField = useCallback(async (id: string, field: 'title' | 'shortcut' | 'tags', value: string) => {
    try {
      const existing = links.find(link => link.id === id);
      if (!existing) return;

      if (field === 'title') {
        const updatedTitle = value.trim() || 'Untitled Link';
        await updateLink(id, { title: updatedTitle });
        const compound = getItemCompoundId({
          id,
          workspace_id: existing.workspaceId || null,
          folder_id: existing.folderId || null,
          snippet: { id, category: 'link' },
        });
        const shortcut = shortcutsMap[compound] || '';
        if (shortcut) {
          await apiSaveShortcut(id, compound, shortcut.toLowerCase(), updatedTitle, 'link');
        }
        if (id === activeLinkId) {
          setTitle(updatedTitle);
          if (lastSavedTitleRef) lastSavedTitleRef.current = updatedTitle;
        }
      } else if (field === 'shortcut') {
        const finalShortcut = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const compound = getItemCompoundId({
          id,
          workspace_id: existing.workspaceId || null,
          folder_id: existing.folderId || null,
          snippet: { id, category: 'link' },
        });
        if (finalShortcut) {
          await apiSaveShortcut(id, compound, finalShortcut, existing.title, 'link');
        } else {
          await apiClearShortcut(id, compound, 'link');
        }
        if (id === activeLinkId) {
          setLinkShortcut(finalShortcut);
          if (lastSavedShortcutRef) lastSavedShortcutRef.current = finalShortcut;
        }
      } else if (field === 'tags') {
        const tagNames = value.split(',').map(t => t.trim()).filter(Boolean);
        const resolvedTags: any[] = [];
        for (const name of tagNames) {
          const matchedTag = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase() && t.workspaceId === existing.workspaceId);
          if (matchedTag) {
            resolvedTags.push(matchedTag);
          } else if (existing.workspaceId) {
            const newTag = await createTag(name, existing.workspaceId);
            resolvedTags.push(newTag);
          }
        }
        await updateLink(id, { tagIds: resolvedTags.map((t: any) => t.id) });
      }

      if (id === activeLinkId) {
        if (setSaveStatus) setSaveStatus('saved');
        if (setLastSavedAt) setLastSavedAt(new Date());
      }

      await fetchTableMaps();
    } catch (error) {
      console.error('[LinkEditorView] Failed to update item field:', error);
    }
  }, [links, shortcutsMap, activeLinkId, setTitle, setLinkShortcut, setSaveStatus, setLastSavedAt, lastSavedTitleRef, lastSavedShortcutRef, tags, fetchTableMaps]);

  useEffect(() => {
    if (showPathQueryDropdown) {
      setTimeout(() => {
        dropdownButtonRef.current?.focus();
      }, 0);
    }
  }, [showPathQueryDropdown]);

  const insertCustomVariable = useCallback(() => {
    if (!editingUrlParts) return;

    if (focusedField === 'queryValue' && focusedQueryIndex !== null) {
      const newQueryParams = editingUrlParts.queryParams.map((param, index) =>
        index === focusedQueryIndex ? { ...param, value: `${param.value}{query}` } : param,
      );
      setEditingUrlParts(prev => (prev ? { ...prev, queryParams: newQueryParams } : prev));
    } else if (focusedField === 'domain') {
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    } else if (focusedField === 'path' && focusedPathIndex !== null) {
      const newPaths = [...editingUrlParts.paths];
      // Append /{query} to the selected path component
      newPaths[focusedPathIndex] = (newPaths[focusedPathIndex] || '') + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else if (editingUrlParts.queryParams.length > 0) {
      const lastQueryIndex = editingUrlParts.queryParams.length - 1;
      const newQueryParams = editingUrlParts.queryParams.map((param, index) =>
        index === lastQueryIndex ? { ...param, value: `${param.value}{query}` } : param,
      );
      setEditingUrlParts(prev => (prev ? { ...prev, queryParams: newQueryParams } : prev));
    } else if (editingUrlParts.paths.length > 0) {
      // Default: append to last path
      const newPaths = [...editingUrlParts.paths];
      newPaths[newPaths.length - 1] = newPaths[newPaths.length - 1] + '/{query}';
      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
    } else {
      // No paths, add to domain
      setEditingUrlParts(prev => (prev ? { ...prev, domain: prev.domain + '/{query}' } : prev));
    }
  }, [editingUrlParts, focusedField, focusedPathIndex, focusedQueryIndex]);

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
        setFocusedSuggestionIndex(-1);
      } catch (e) {
        console.error('[LinkEditModal] Search failed:', e);
      }
    };

    performSearch();
  }, [customLinkUrl, isLeftCustomLinkFormOpen, getHostname]);

  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
  };

  const rawSearchTagsRef = useRef<Record<string, string[]> | string>({});
  const lastPrefilledSnippetIdRef = useRef<string | null>(null);

  // Prefill fields when editing an existing link/tabgroup
  useEffect(() => {
    const currentId = initialLink?.id || (initialLink as any)?.snippet_id;
    if (!isOpen || !isEditMode || !initialLink) return;
    if (hasPrefilledEditModeRef.current && lastPrefilledSnippetIdRef.current === currentId) return;

    hasPrefilledEditModeRef.current = true;
    lastPrefilledSnippetIdRef.current = currentId;
    try {
      setTitle(initialLink.title || initialLink.key || initialLink.name || '');

      if (initialLink.tags && initialLink.tags.length > 0) {

      } else if (initialLink.searchtags) {
        const rawTags = initialLink.searchtags;
        rawSearchTagsRef.current = rawTags;
        let firstTag = '';
        if (typeof rawTags === 'object' && rawTags !== null) {
          const myTags = (rawTags as Record<string, string[]>)[userId] || [];
          if (myTags.length > 0) firstTag = myTags[0];
        } else if (typeof rawTags === 'string') {
          firstTag = rawTags.split(',')[0].trim();
        }
        if (firstTag) {

        }
      } else {
        // Local storage backup fallback for searchtags
        const snipId = initialLink.id || (initialLink as any).snippet_id;
        if (snipId) {
          chrome.storage.local.get('alts_searchtags_backup', result => {
            const backup = result.alts_searchtags_backup || {};
            if (backup[snipId]) {
              const bTag = backup[snipId];
              let firstTag = '';
              if (typeof bTag === 'object' && bTag !== null) {
                const myTags = bTag[userId] || [];
                if (myTags.length > 0) firstTag = myTags[0];
              } else if (typeof bTag === 'string') {
                firstTag = bTag.split(',')[0].trim();
              }
              if (firstTag) {

              }
            }
          });
        }
      }

      const category = String(initialLink.category || initialLink.kind || "link").toLowerCase();

      const isGroup = category === 'link' || category === 'snippet' || category === 'tabgroup';

      if (isGroup) {
        // Handle new LinkRecord format directly
        if (initialLink.urls && Array.isArray(initialLink.urls)) {
          // Check if urls are string array or LinkItem array
          if (initialLink.urls.length > 0 && typeof initialLink.urls[0] === 'string') {
            setSelectedLinks(initialLink.urls.map((u: string) => ({
              url: u,
              title: '',
              id: generateEntityId('linkItem')
            })));
          } else {
            setSelectedLinks(initialLink.urls);
          }
        } else {
          // Handle legacy snippet format (JSON value string)
          let urls: string[] = [];
          let names: string[] = [];
          if (typeof initialLink.value === 'string') {
            try {
              // Try explicit JSON parse first
              if (initialLink.value.trim().startsWith('{')) {
                const parsed = JSON.parse(initialLink.value);
                urls = Array.isArray((parsed as any)?.urls) ? (parsed as any).urls : [];
                names = Array.isArray((parsed as any)?.names) ? (parsed as any).names : [];
              } else {
                // Fallback for plain string that wasn't JSON
                urls = [initialLink.value];
              }
            } catch {
              // If parse fails
              if (initialLink.value) {
                urls = [initialLink.value];
                names = [initialLink.key || initialLink.title || initialLink.value];
              }
            }
          } else if (initialLink.value && typeof initialLink.value === 'object') {
            const val = initialLink.value as any;
            urls = Array.isArray(val?.urls) ? val.urls : [];
            names = Array.isArray(val?.names) ? val.names : [];
          }

          if (urls.length === 0 && initialLink.value && typeof initialLink.value === 'string') {
            // Ultimate fallback if parsing returned empty but we have a value
            urls = [initialLink.value];
            names = [initialLink.key || initialLink.title || initialLink.value];
          }

          setSelectedLinks(
            urls.map((u, idx) => {
              const isNote = u.startsWith('note:');
              return {
                url: u,
                title: names[idx] || (isNote ? 'Note snippet' : ''),
                name: names[idx] || (isNote ? 'Note snippet' : ''),
                id: generateEntityId('linkItem')
              };
            })
          );
        }
      } else {
        // Single link fallback for legacy non-group categories
        let urlVal = '';
        if (typeof initialLink.value === 'string') {
          if (initialLink.value.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(initialLink.value);
              urlVal = parsed.url || parsed.urls?.[0] || initialLink.value;
            } catch {
              urlVal = initialLink.value;
            }
          } else {
            urlVal = initialLink.value;
          }
        } else if (initialLink.urls && Array.isArray(initialLink.urls) && initialLink.urls.length > 0) {
          urlVal = typeof initialLink.urls[0] === 'string' ? initialLink.urls[0] : (initialLink.urls[0] as any).url || '';
        } else {
          urlVal = String((initialLink.value as any) || '');
        }

        setSelectedLinks([
          {
            id: `prefill-0`,
            url: urlVal,
            title: initialLink.title || initialLink.key || urlVal,
            name: initialLink.title || initialLink.key || urlVal,
          },
        ]);
      }
    } catch {
      // ignore prefill errors
    }
  }, [isOpen, isEditMode, initialLink, getHostname]);

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
    if (isOpen && activeContentTab === 'Current Tabs' && hasFetchedTabs && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
    }
  }, [isOpen, activeContentTab, tabsByWindow, hasFetchedTabs]);

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

      // 1. Current Tabs from tabsByWindow
      const seenNormalizedUrls = new Set<string>();
      Object.entries(tabsByWindow).forEach(([windowIdStr, tabs]) => {
        const winId = Number(windowIdStr);

        tabs.forEach(t => {
          if (t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')) {
            const norm = String(t.url || "").toLowerCase().trim().replace(/\/$/, '');
            if (seenNormalizedUrls.has(norm)) {
              return; // Skip duplicate tab in "Current Tabs" UI list
            }
            seenNormalizedUrls.add(norm);

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
      });

      // 2. Links & Notes from Redux (allData)
      // Helper to process snippets into list items
      const processSnippet = (s: any) => {
        const category = String(s.category || "").toLowerCase();

        const isLink = category === 'link';
        if (!isLink) return;

        let subtitle = '';
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

        items.push({
          id: s.id || s.snippet_id || generateEntityId('linkItem'),
          url: subtitle,
          name: s.key || 'Untitled',
          source: 'link',
          favIconUrl: subtitle ? getFaviconUrl(getHostname(subtitle)) : undefined,
          originalData: s,
        });
      };


      // Links-only architecture: snippets in this view are link records.
      snippets.forEach(processSnippet);

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
  }, [isOpen, snippets, tabsByWindow, currentWindowId]);

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
      const addedLinks = selectedLinks;
      const notAddedCurrentTabs = availableItems.filter(item => {
        if (item.source !== 'tab') return false;
        return !selectedLinks.some((selected: any) => {
          if (selected.source === 'tab' && selected.originalData?.id === item.originalData?.id) return true;
          return selected.url === item.url;
        });
      });
      list = notAddedCurrentTabs;
    } else if (contentSearchQuery.trim() && activeContentTab === 'All saved files') {
      const q = contentSearchQuery.toLowerCase();
      list = list.filter(i => String(i.name || i.title || "").toLowerCase().includes(q) || String(i.url || "").toLowerCase().includes(q));
    }

    return list;
  }, [availableItems, activeContentTab, contentSearchQuery, selectedLinks]);

  const checkIsAdded = useCallback((item: SelectedLink) => {
    return selectedLinks.some((selected: any) => {
      if (item.source === selected.source && item.originalData && selected.originalData) {
        const id1 = selected.originalData?.id || selected.originalData?.snippet_id;
        const id2 = item.originalData?.id || item.originalData?.snippet_id;
        return id1 && id2 && id1 === id2;
      }
      return selected.url === item.url;
    });
  }, [selectedLinks]);

  const allRenderedItems = useMemo(() => {
    const renderedSelected = selectedLinks.map((item: any) => ({
      item,
      isAdded: true,
    }));

    const renderedActive = (activeContentTab === 'Selected tabs')
      ? []
      : filteredItems.filter((item: any) => !checkIsAdded(item)).map((item: any) => ({
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
      setManualWorkspaceId(workspace.workspace_id);
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
      setManualWorkspaceId(workspace.workspace_id);
      setManualFolderId(folder.folder_id);
      setIsLocationPickerOpen(false);
    },
    [],
  );

  const addLink = useCallback(
    (tab: BrowserTab) => {
      hasUserModifiedRef.current = true;
      const linkName = tab.title || getHostname(tab.url);

      setSelectedLinks(prev => {
        const linkId = generateEntityId('linkItem');
        return [
          ...prev,
          {
            id: linkId,
            url: tab.url,
            name: linkName,
            favIconUrl: tab.favIconUrl,
            source: 'tab' as const,
          },
        ];
      });
    },
    [getHostname, isTitleManuallyModified],
  );

  const removeLink = useCallback((linkId: string) => {
    hasUserModifiedRef.current = true;
    setSelectedLinks(prev => prev.filter(link => link.id !== linkId));
  }, []);

  // Add item from content bar (handles tabs, links, notes)
  const addItemFromContentBar = useCallback(
    (item: SelectedLink) => {
      hasUserModifiedRef.current = true;
      setSelectedLinks(prev => {
        const newId = generateEntityId('linkItem');
        return [
          ...prev,
          {
            ...item,
            id: newId,
          },
        ];
      });
    },
    [isTitleManuallyModified],
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
    const id = generateEntityId('linkItem');

    setSelectedLinks(prev => [
      ...prev,
      {
        id,
        url: normalizedUrl,
        name,
        source: 'custom',
        favIconUrl: getFaviconUrl(getHostname(normalizedUrl)),
      },
    ]);

    setCustomLinkUrl('');
    setCustomLinkName('');
    setTimeout(() => {
      customLinkUrlRef.current?.focus();
    }, 50);
  }, [customLinkName, customLinkUrl, getHostname]);

  const toggleWindowCollapse = useCallback((windowId: number) => {
    setCollapsedWindows(prev => ({
      ...prev,
      [windowId]: !prev[windowId],
    }));
  }, []);

  const handleSave = useCallback(
    async (isAutoSave: boolean = false, overrideLinks?: SelectedLink[], overrideTitle?: string) => {
      if (shortcutError) {
        if (!isAutoSave) {
          showFooterStatus('error', shortcutError);
        }
        return false;
      }
      if (overrideTitle !== undefined) setTitle(overrideTitle);
      if (overrideLinks !== undefined) setSelectedLinks(overrideLinks);

      const saved = await executeSave(isAutoSave);

      if (saved && !isAutoSave) {
        setTimeout(() => (onSavedClose || onClose)(), 1500);
      }
      return saved;
    }, [executeSave, setTitle, setSelectedLinks, onClose, onSavedClose, shortcutError]);

  const parseSnippetValue = useCallback((value: string): SelectedLink[] => {
    if (!value) return [];
    try {
      if (value.startsWith('{') || value.startsWith('[')) {
        const parsed = JSON.parse(value);
        if (parsed && Array.isArray(parsed.urls)) {
          return parsed.urls.map((url: string, index: number) => ({
            id: generateEntityId('linkItem'),
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
    id: generateEntityId('linkItem'),
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


  // Unload event listener to stash unsaved edits
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasUnsavedChanges) {
        const backupData = {
          title,
          selectedLinks,
          workspaceId: propertiesRef.current?.workspaceId || null,
          folderIdForSave: propertiesRef.current?.folderId || null,
          teamId,
          timestamp: Date.now()
        };
        void StorageManager.setItem(getBackupKey(), backupData);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, getBackupKey, title, selectedLinks, teamId]);

  // Mount effect to restore stashed backup
  useEffect(() => {
    if (!isOpen) return;

    StorageManager.getItem(getBackupKey()).then((backup: any) => {
      if (backup) {
        try {
          if (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000) {

            setTitle(backup.title || '');
            setSelectedLinks(backup.selectedLinks || []);
            if (backup.targetWorkspaceId) {
              setManualWorkspaceId(backup.targetWorkspaceId);
            }
            if (backup.folderIdForSave) {
              setManualFolderId(backup.folderIdForSave);
            }
            // Clear backup after successful restoration so it doesn't loop
            void StorageManager.removeItem(getBackupKey());
            showFooterStatus('success', 'Restored unsaved changes');
          }
        } catch (err) {
          console.error('[LinkEditModal] Failed to restore stashed backup:', err);
        }
      }
    });
  }, [isOpen, getBackupKey]);

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
    // 1. Save current link in background without blocking instant UI reset
    void executeSave(false);

    const currentProps = useUIStore.getState().activeEditor?.props || {};
    const cleanProps = { ...currentProps, category: 'link', snippet: null, prefill: null, item: null, link: null };
    useUIStore.getState().openEditor({ type: 'link', id: 'new', props: cleanProps });

    // 3. Synchronously transition state to Create mode
    setIsForceCreateNew(true);
    resetEditor();
    setTitle('');
    setSelectedLinks([]);
    setLinkShortcut('');
    hasUserModifiedRef.current = false;
    setLocalLinkOverride(null);
    hasInitializedPrefill.current = true;
    hasSyncedInitialDataRef.current = false;

    setCustomLinkUrl('');
    setCustomLinkName('');
    setIsCustomLinkFormOpen(false);
    setIsLeftCustomLinkFormOpen(false);

    // 4. Immediately focus title input for single-press shortcut readiness
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        const length = titleInputRef.current.value.length;
        titleInputRef.current.setSelectionRange(length, length);
      }
    }, 0);
  }, [executeSave, resetEditor]);

  const handleCloseAttempt = useCallback(async () => {
    // Explicitly force a final save before closing.
    const saved = await handleSave(false);
    if (!saved && shortcutError) {
      return;
    }

    onClose();
  }, [handleSave, onClose, shortcutError]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => {
      if (document.getElementById('hotkey-assignment-popup')) {
        return true; // we just let those handle it or block it
      }
      if (isCustomLinkFormOpen) {
        setIsCustomLinkFormOpen(false);
        setCustomLinkUrl('');
        setCustomLinkName('');
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
        return true;
      }
      if (isLeftCustomLinkFormOpen) {
        const hasInputText = customLinkUrl.trim().length > 0;
        setIsLeftCustomLinkFormOpen(false);
        setCustomLinkUrl('');
        setCustomLinkName('');
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
        if (!hasInputText) {
          handleCloseAttempt();
        }
        return true;
      }
      handleCloseAttempt();
      return true; // We intercepted the escape, don't let uiStateManager forcefully close
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isOpen, isLeftCustomLinkFormOpen, isCustomLinkFormOpen, customLinkUrl, handleCloseAttempt]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!isOpen) return;
      const isCtrlShiftEnter = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter';
      if (isCtrlShiftEnter) {
        event.preventDefault();
        event.stopPropagation();
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

    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
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
      } else if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
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
  const altSAppearanceStyle = isAltSOverlay
    ? ({
        ...appearanceTokens,
        '--color-editorBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
        '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
        '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
        '--color-inputBg': 'var(--alts-search-bg, var(--color-altsSearchBg))',
        '--color-containerBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
        '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
        '--color-selectedBg': 'var(--alts-row-selected-bg, var(--color-altsRowSelectedBg))',
        '--color-borderDefault': 'color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 30%, transparent)',
        '--color-borderActive': 'color-mix(in srgb, var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg)) 44%, var(--alts-border-color, var(--color-altsBorderColor)))',
        '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
        '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
        '--color-textMuted': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
        '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
        '--color-iconDefault': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
        '--color-focusRing': 'color-mix(in srgb, var(--alts-focus-color, var(--color-altsFocusColor)) 18%, transparent)',
      } as React.CSSProperties & Record<`--${string}`, string>)
    : appearanceTokens;

  return (
    <>
      {isAltSOverlay && (
        <style>{`
          .link-editor-alts-overlay :where(.border, .border-t, .border-r, .border-b, .border-l) {
            border-color: color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 30%, transparent) !important;
          }
          .link-editor-alts-overlay :where(input, button, section, [role="dialog"]) {
            --tw-ring-color: color-mix(in srgb, var(--alts-focus-color, var(--color-altsFocusColor)) 18%, transparent) !important;
          }
          .link-editor-alts-overlay [data-link-editor-surface="alts"] {
            background: transparent !important;
            border-color: transparent !important;
            box-shadow: none !important;
          }
          .link-editor-alts-overlay :where(
            [class*="text-neutral-800"],
            [class*="text-neutral-700"],
            [class*="dark:text-neutral-300"],
            [class*="dark:text-neutral-200"],
            [class*="dark:text-neutral-100"]
          ) {
            color: var(--color-textPrimary) !important;
          }
          .link-editor-alts-overlay :where(
            [class*="text-neutral-600"],
            [class*="text-neutral-500"],
            [class*="text-neutral-400"],
            [class*="dark:text-neutral-500"],
            [class*="dark:text-neutral-400"]
          ) {
            color: var(--color-textSecondary) !important;
          }
          .link-editor-alts-overlay :where(
            [class*="bg-white"][class*="dark:bg-neutral-900"],
            [class*="dark:bg-[#1C1C1E]"]
          ) {
            background-color: var(--color-modalBg) !important;
          }
          .link-editor-alts-overlay :where([class*="border-black/5"], [class*="dark:border-neutral-700"], [class*="dark:border-white/10"]) {
            border-color: var(--color-borderDefault) !important;
          }
        `}</style>
      )}
      <EditorContainer
        style={altSAppearanceStyle}
        className={clsx(
          isAltSOverlay && 'link-editor-alts-overlay',
          isWidgetMode
            ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
            : isNormalLinkMode
              ? 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-4 md:px-6 py-2'
              : isAltSOverlay
                ? 'w-full h-full min-h-0 max-h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent p-0 overflow-hidden'
                : 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-6 md:px-12 lg:px-24 py-4',
        )}
        innerClassName={isWidgetMode
          ? 'flex flex-col w-full h-full overflow-hidden bg-transparent'
          : isNormalLinkMode
            ? 'flex flex-row items-start gap-2 relative bg-transparent w-full h-auto min-h-0 max-h-[85vh] overflow-y-auto custom-scrollbar border-none'
            : isAltSOverlay
              ? 'flex flex-col relative bg-transparent mx-auto min-h-0 h-full max-h-full overflow-hidden w-full'
              : 'flex flex-row items-stretch gap-2 relative bg-transparent mx-auto min-h-[450px] h-auto max-h-[860px] max-h-[90vh] overflow-visible w-[calc(100%-20px)] max-w-[1800px]'
        }
      >
        {/* Left Editor Surface */}
        <div
          data-link-editor-surface={isAltSOverlay ? 'alts' : undefined}
          className={isWidgetMode
            ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-transparent border-none relative'
            : isNormalLinkMode
              ? 'flex-1 min-w-0 flex flex-col h-auto min-h-0 max-h-full overflow-hidden rounded-none border-none shadow-none bg-[var(--color-editorBg)] relative'
              : isAltSOverlay
                ? 'w-full min-w-0 flex flex-col h-full min-h-0 max-h-full overflow-hidden rounded-none border-none shadow-none bg-transparent relative'
                : 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] relative'
          }>
          <EditorHeader
              hideBorder={isNormalLinkMode}
              title={isForceCreateNew ? 'Create a link collection' : activeLinkId ? 'Edit link collection' : 'Create a link collection'}
              titleClassName={isNormalLinkMode ? 'absolute left-1/2 top-1/2 w-full max-w-[740px] -translate-x-1/2 -translate-y-1/2 px-4 md:px-6 text-lg font-bold text-[var(--color-textPrimary)] truncate pointer-events-none' : undefined}
              isDirty={hasUnsavedChanges}
              saveStatus={saveStatus === 'error' && saveError ? 'error' : saveStatus}
              lastSavedAt={lastSavedAt}
              activeId={activeLinkId}
              onCloseClick={onClose}
              showCloseButton={isAltSOverlay}
              headerActions={
                <SharedPropertiesToolbar
                  key={activeLinkId || 'new-link'}
                  initialSnippet={initialProperties}
                  currentSnapshot={{
                    title,
                    urls: (selectedLinks || []).map((item: any) => ({ ...item })),
                    workspaceId,
                    folderId,
                    tagIds: [...(tagIds || [])],
                    shortcut: linkShortcut || '',
                  }}
                  compoundId={compoundId}
                  defaultName={title || 'New Link List'}
                  onChange={handlePropertiesChange}
                  versionHistoryItems={versionHistoryItems}
                  versionHistory={links.find(l => l.id === activeLinkId)?.versionHistory || initialLink?.versionHistory}
                  selectedVersionId={selectedVersionId}
                  onSelectVersion={setSelectedVersionId}
                  entityType="link"
                  appearanceScope={appearanceScope}
                  appearanceTokens={altSAppearanceStyle}
                  propertyPersistenceAdapter={propertyPersistenceAdapter}
                  showTodo={true}
                  onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                    console.log('[LinkEditorView:onCreateTodo] Called with:', { deadlineVal, isRecurring, recurringCycle, activeLinkId, title, selectedLinksCount: selectedLinks?.length });
                    const linkId = activeLinkId || generateEntityId('link');
                    const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                    const todoTitle = title || 'New Link List';
                    try {
                      const scheduleType: 'one-time' | 'recurring' = isRecurring ? 'recurring' : 'one-time';
                      const todoInput = {
                        title: todoTitle,
                        references: [{ type: 'link', id: linkId, name: todoTitle }],
                        scheduleType,
                        scheduleTime,
                        recurringCycle: isRecurring ? recurringCycle as any : undefined,
                        description: '',
                      };
                      const newTodo = propertyPersistenceAdapter?.createTodo
                        ? await propertyPersistenceAdapter.createTodo(todoInput)
                        : await createTodo(
                            todoInput.title,
                            todoInput.references,
                            todoInput.scheduleType,
                            todoInput.scheduleTime,
                            todoInput.recurringCycle,
                            todoInput.description,
                          );
                      console.log('[LinkEditorView:onCreateTodo] Successfully created To-Do in Dexie:', newTodo);

                      const chromeAny = (window as any).chrome;
                      if (chromeAny?.runtime?.sendMessage) {
                        chromeAny.runtime.sendMessage({
                          action: 'schedule_newtodo_alarm',
                          todoId: newTodo.id,
                          scheduleTime: scheduleTime
                        });
                        console.log('[LinkEditorView:onCreateTodo] Dispatched schedule_newtodo_alarm for todoId:', newTodo.id);
                      }
                    } catch (err) {
                      console.error('[LinkEditorView:onCreateTodo] Failed to create and schedule link todo', err);
                    }
                  }}
                  saveStatus={saveStatus}
                  openPopupsToBottom={true}
                  showShortcut={false}
                  layout="horizontal"
                />
              }
            />

            <div className={clsx(isAltSOverlay ? 'flex-1 flex flex-col min-h-0 relative overflow-hidden' : 'flex-1 flex flex-col min-h-0 relative')}>
              <div className={clsx(
                isWidgetMode
                  ? "w-full flex-1 flex flex-col min-h-0 px-3 py-2"
                  : isNormalLinkMode
                    ? "w-full max-w-[740px] mx-auto flex-1 flex flex-col min-h-0 px-4 md:px-6 pt-1 pb-4"
                    : isAltSOverlay
                      ? "w-full flex-1 flex flex-col min-h-0 overflow-hidden px-2 pt-1 pb-0"
                      : "w-full flex-1 flex flex-col min-h-0 px-6 pt-1 pb-4",
                (isLeftCustomLinkFormOpen && linkSuggestions.length > 0) ? "overflow-visible" : "overflow-hidden"
              )}>

            {/* Title & Shortcut Fields */}
            <EditorTitleShortcutInput
              title={title}
              setTitle={(val) => {
                setTitle(val);
                if (val.trim()) setTitleError(null);
                setIsTitleManuallyModified(true);
                hasUserModifiedRef.current = true;
              }}
              titleError={titleError || saveError}
              shortcutError={shortcutError}
              isOverrideable={isShortcutOverrideable}
              onOverrideShortcut={handleOverrideShortcut}
              shortcut={linkShortcut}
              setShortcut={(val) => {
                setLinkShortcut(val);
                isShortcutManuallyEditedRef.current = true;
                hasUserModifiedRef.current = true;
              }}
              titleRef={titleInputRef}
              shortcutRef={shortcutInputRef}
              onTitleBlur={async () => {
                if (!title.trim()) {
                  setTitleError('Enter the title');
                } else if (hasUnsavedChanges) {
                  await handleSave(true);
                }
              }}
              onShortcutBlur={async () => {
                if (hasUnsavedChanges) {
                  await handleSave(true);
                }
              }}
              onCopyTitleToShortcut={(isInitialized && isShortcutInitialized) ? () => {
                const val = title.toLowerCase().replace(/[^a-z0-9_]/g, '');
                setLinkShortcut(val);
                isShortcutManuallyEditedRef.current = true;
                hasUserModifiedRef.current = true;
              } : undefined}
              onTitleEnter={async (shiftKey, e) => {
                if (e?.ctrlKey || e?.metaKey) {
                  handleCreateNew();
                } else {
                  if (!title.trim()) {
                    setTitleError('Enter the title');
                  } else if (hasUnsavedChanges) {
                    await handleSave(true);
                  }
                }
              }}
              onShortcutEnter={async () => {
                if (hasUnsavedChanges) {
                  await handleSave(true);
                }
              }}
              onArrowDownPress={() => {
                savedFilesInputRef.current?.focus();
              }}
            />
            {/* Link Deleted Banner */}
            {isLinkDeleted && (
              <div className="w-full flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 -mx-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-800/50 flex items-center justify-center text-red-600 dark:text-red-400">
                    <FaTrash size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">This link collection was deleted</h3>
                    <p className="text-xs text-red-600 dark:text-red-400/80">
                      Another tab or user deleted this link collection. You can copy your links below or create a new collection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conflict Banner */}
            {saveStatus === 'conflict' && conflictLink && (
              <div className="w-full flex flex-col gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 -mx-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Conflict Detected</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400/80">
                      This link collection was modified in another tab. Merging failed because you both edited the same fields.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1 ml-11">
                  <button
                    onClick={resolveConflictWithRemote}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-200 dark:bg-amber-700/50 text-amber-800 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-600/50 transition-colors"
                  >
                    Discard mine, use latest
                  </button>
                  <button
                    onClick={keepLocalVersion}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-white dark:bg-neutral-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Keep mine & overwrite
                  </button>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {activeLinkId && liveLink === undefined && !isLinkDeleted && !isAltSOverlay && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                  <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Loading collection...</div>
                </div>
              </div>
            )}

            <div className={clsx(
              isAltSOverlay
                ? "flex-1 flex flex-col min-w-0 min-h-0 relative mt-4"
                : "flex-1 flex flex-col min-w-0 relative h-full max-h-full mt-4",
              (isLeftCustomLinkFormOpen && linkSuggestions.length > 0) ? "overflow-visible" : "overflow-hidden"
            )}>

              {/* Links section label */}
              <h4 className="text-xs font-semibold text-[var(--color-textSecondary)] mb-1.5 px-3.5">
                Active links ({allRenderedItems.length})
              </h4>
              {/* List */}
              <div
                ref={listContainerRef}
                className={clsx(
                  isAltSOverlay
                    ? "flex-1 min-h-0 w-full relative"
                    : "flex-1 min-h-0 w-full relative",
                  "rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm",
                  (isLeftCustomLinkFormOpen && linkSuggestions.length > 0)
                    ? "overflow-visible"
                    : "overflow-y-auto custom-scrollbar"
                )}>
                <div className="flex flex-col w-full divide-y divide-[var(--color-borderDefault)] pb-2">
                  {(() => {
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
                        if (item.favIconUrl) {
                          return <img src={item.favIconUrl} className="w-5 h-5 object-contain" alt="" />;
                        }

                        if (item.url && item.url.startsWith('http')) {
                          return (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center overflow-hidden bg-white shadow-sm flex-shrink-0">
                              <img
                                src={getFaviconUrl(getHostname(item.url))}
                                alt=""
                                className="w-4 h-4 object-cover"
                              />
                            </div>
                          );
                        }
                        return (
                          <div className="w-5 h-5 rounded flex items-center justify-center bg-black/5 dark:bg-neutral-800 text-neutral-500">
                            <FaLink size={12} />
                          </div>
                        );
                      })();

                      const itemLabel = (() => {
                        return (item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
                      })();

                      const itemContent = (
                        <>
                          <div className="flex-shrink-0 relative flex items-center gap-2">
                            {isAdded ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-200 active:cursor-grabbing"
                                style={{ willChange: 'transform' }}
                                title="Drag to reorder links"
                              >
                                <LinkDragHandle />
                              </div>
                            ) : null}
                            {itemIcon}
                          </div>

                          <div
                            className={clsx(
                              'text-[11px] font-normal truncate transition-opacity duration-200 text-left min-w-0 flex-1 pr-3',
                              focusedTabIndex === globalIdx ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
                              'text-neutral-500 dark:text-neutral-400',
                            )}>
                            {itemLabel}
                          </div>

                          <div
                            className={clsx(
                              "text-[13px] font-medium tracking-tight truncate min-w-0 w-[180px] md:w-[200px] lg:w-[220px] shrink",
                              isAdded ? "text-neutral-800 dark:text-neutral-300" : "text-neutral-500 dark:text-neutral-400"
                            )}
                            style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                            {item.name || item.title || item.url}
                          </div>

                          <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-[112px] md:min-w-[132px]">
                            <div
                              className={clsx(
                                "text-[12px] font-semibold transition-all duration-200 select-none shrink-0 flex items-center justify-center min-w-[52px]",
                                "text-emerald-500 dark:text-emerald-400"
                              )}
                            >
                              {isAdded ? 'Added' : '+ Add'}
                            </div>

                            {isAdded && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeLink(item.id);
                                }}
                                className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center focus:outline-none"
                                title="Remove"
                              >
                                <FaTrash size={11} />
                              </button>
                            )}

                            {isAdded && (
                              <div
                                className="relative shrink-0 three-dots-container flex items-center min-w-[28px] justify-center"
                              >
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setActiveMenuLinkId(prev => prev === item.id ? null : item.id);
                                  }}
                                  className="p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center focus:outline-none"
                                  title="More options"
                                >
                                  <FaEllipsisV size={11} />
                                </button>

                                {activeMenuLinkId === item.id && (
                                  <div
                                    onClick={e => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1 bg-white dark:bg-neutral-900 border border-black/5 dark:border-neutral-700 rounded-xl shadow-2xl z-[999] py-1 flex flex-col w-32 overflow-hidden"
                                  >
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setActiveMenuLinkId(null);
                                        openLinkEditPopup(item);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-neutral-800 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-white"
                                    >
                                      <FaLink size={10} className="opacity-70" />
                                      <span>Params</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        setActiveMenuLinkId(null);
                                        duplicateLink(item);
                                      }}
                                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors text-neutral-800 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-white"
                                    >
                                      <FaCopy size={10} className="opacity-70" />
                                      <span>Duplicate</span>
                                    </button>
                                  </div>
                                )}
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
                        className: `group flex items-center gap-3 py-2 px-3 transition-all cursor-pointer focus:outline-none first:rounded-t-xl last:rounded-b-xl ${focusedTabIndex === globalIdx
                          ? 'bg-white/10'
                          : 'hover:bg-white/5'
                          }`,
                      };

                      if (isAdded) {
                        return (
                          <Reorder.Item
                            key={getLinkReorderKey(item, idx)}
                            as="div"
                            value={getLinkReorderKey(item, idx)}
                            {...commonProps}
                          >
                            {itemContent}
                          </Reorder.Item>
                        );
                      }

                      return (
                        <div
                          key={getLinkReorderKey(item, idx)}
                          {...commonProps}
                        >
                          {itemContent}
                        </div>
                      );
                    };

                    const renderedSelected = allRenderedItems.filter(wrap => wrap.isAdded);
                    const renderedActive = allRenderedItems.filter(wrap => !wrap.isAdded);

                    return (
                      <>
                        <Reorder.Group
                          axis="y"
                          values={selectedLinks.map(getLinkReorderKey)}
                          onReorder={(nextOrder: string[]) => {
                            hasUserModifiedRef.current = true;
                            setSelectedLinks(currentLinks => {
                              const linksByKey = new Map(
                                currentLinks.map((link, index) => [getLinkReorderKey(link, index), link]),
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
                          <>
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
                                            id: generateEntityId('linkItem'),
                                            url: item.url,
                                            name: item.title || getHostname(item.url),
                                            source: 'custom',
                                            favIconUrl: getFaviconUrl(getHostname(item.url)),
                                          },
                                        ]);
                                        setCustomLinkUrl('');
                                        setCustomLinkName('');
                                        setLinkSuggestions([]);
                                        setTimeout(() => {
                                          customLinkUrlRef.current?.focus();
                                        }, 50);
                                        return;
                                      }

                                      handleAddCustomLink();
                                    } else if (event.key === 'Escape') {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      const hasInputText = customLinkUrl.trim().length > 0;
                                      setIsLeftCustomLinkFormOpen(false);
                                      setCustomLinkUrl('');
                                      setCustomLinkName('');
                                      if (titleInputRef.current) {
                                        titleInputRef.current.focus();
                                      }
                                      if (!hasInputText) {
                                        handleCloseAttempt();
                                      }
                                    }
                                  }}
                                  placeholder="Add a link URL..."
                                  autoFocus
                                  className="w-full bg-transparent border-none text-[13.5px] font-normal text-neutral-800 dark:text-neutral-100 placeholder-[var(--color-textPlaceholder)]/50 focus:outline-none h-6"
                                  style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
                                />
                                {linkSuggestions.length > 0 && suggestionRect && createPortal(
                                  <div
                                    className="fixed bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[999999] overflow-hidden max-h-[250px] flex flex-col"
                                    style={{ top: suggestionRect.top, left: suggestionRect.left, width: suggestionRect.width }}
                                  >
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 dark:text-neutral-500  tracking-wider bg-white/50 dark:bg-black/20 border-b border-black/5 dark:border-white/5">
                                      Suggestions
                                    </div>
                                    <div className="overflow-y-auto custom-scrollbar">
                                      {linkSuggestions.map((suggestion, idx) => (
                                        <div
                                          key={idx}
                                          className={`px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors ${focusedSuggestionIndex === idx
                                            ? 'bg-[#3B66AE] text-white'
                                            : 'hover:bg-white dark:hover:bg-white/5 text-neutral-800 dark:text-neutral-200'
                                            }`}
                                          onClick={() => {
                                            const id = generateEntityId('linkItem');
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
                                            setLinkSuggestions([]);
                                            setTimeout(() => {
                                              customLinkUrlRef.current?.focus();
                                            }, 50);
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
                                            <div className="hidden w-3.5 h-3.5 rounded flex items-center justify-center text-neutral-500">
                                              {suggestion.source === 'bookmark' ? <FaBookmark size={10} /> : <FaHistory size={10} />}
                                            </div>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div
                                              className={`font-medium truncate ${focusedSuggestionIndex === idx ? 'text-white' : 'text-neutral-600 dark:text-neutral-200'}`}>
                                              {suggestion.title}
                                            </div>
                                            <div
                                              className={`truncate opacity-80 text-[10px] ${focusedSuggestionIndex === idx ? 'text-white/70' : 'text-neutral-500'}`}>
                                              {suggestion.url}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </div>

                            <div
                              aria-hidden="true"
                              className="h-[2px] w-full shrink-0 bg-[var(--color-borderActive)]"
                            />
                          </>
                        ) : (
                          <div
                            onClick={() => {
                              setIsLeftCustomLinkFormOpen(true);
                              setCustomLinkUrl('');
                            }}
                            className="group flex items-center justify-center gap-2.5 py-3 px-3 transition-all cursor-pointer focus:outline-none hover:bg-[var(--color-hoverBg)] last:rounded-b-xl"
                          >
                            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)] transition-colors">
                              <FaPlus size={11} />
                            </div>
                            <span className="text-[13.5px] font-semibold text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)] transition-colors">Add a custom link</span>
                          </div>
                        )}

                        {/* Empty State when no items are available */}
                        {allRenderedItems.length === 0 && !isLeftCustomLinkFormOpen && (
                          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-[var(--color-containerBg)] flex items-center justify-center text-neutral-400 dark:text-neutral-500 mb-3">
                              <FaLink size={20} />
                            </div>
                            <h4 className="text-lg font-bold text-[var(--color-textPrimary)] mb-1">No active tabs open</h4>
                            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 max-w-[280px] mb-4">
                              Open a tab in your browser or add a link manually.
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                {isEditMode && !hasUnsavedChanges && (
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
                    className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none"
                  >
                    <span>Create another</span>
                  </button>
                )}
                {showTooltip &&
                  createPortal(
                    <div
                      style={{
                        ...(isAltSOverlay ? altSAppearanceStyle : undefined),
                        position: 'absolute',
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                        zIndex: 2147483647,
                        color: 'var(--color-textPrimary)',
                      }}
                      className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textSecondary)]">
                          Ctrl
                        </kbd>
                        <span className="text-[10px] text-[var(--color-textMuted)] font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textSecondary)]">
                          Shift
                        </kbd>
                        <span className="text-[10px] text-[var(--color-textMuted)] font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textSecondary)]">
                          Enter
                        </kbd>
                      </div>
                      <span className="font-medium text-[var(--color-textSecondary)]">to save and create another</span>
                    </div>,
                    isAltSOverlay
                      ? (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
                        (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
                        (window as any).__ALTS_PORTAL_HOST__ ||
                        (window as any).__ALTQ_PORTAL_HOST__ ||
                        document.body
                      : document.body,
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Full-Height Sibling Column (Top Edge to Bottom Edge) */}
      {!hideRightPanel && (
      <RightSideItemsPanel<any>
          hideBorder={isNormalLinkMode}
          items={sortedLinks}
          activeItemId={activeLinkId}
          searchQuery={tableSearchQuery}
          onSearchChange={setTableSearchQuery}
          onCloseClick={onClose}
          searchPlaceholder="Search links..."
          getItemTitle={item => item.title || 'Untitled Link'}
          getItemPreview={item =>
            (item.urls || [])
              .map((link: any) => link.name || link.title || link.url || '')
              .filter(Boolean)
              .join(', ')
          }
          getItemCompoundId={item =>
            getItemCompoundId({
              id: item.id,
              workspace_id: item.workspaceId || null,
              folder_id: item.folderId || null,
              snippet: { id: item.id, category: 'link' },
            })
          }
          getItemType={() => 'link'}
          getItemWorkspaceId={item => item.workspaceId || null}
          getItemFolderId={item => item.folderId || null}
          getItemTagIds={item => item.tagIds || []}
          shortcutPrefix="c"
          shortcutsMap={shortcutsMap}
          hotkeysMap={hotkeysMap}
          workspaceNamesMap={workspaceNamesMap}
          folderNamesMap={folderNamesMap}
          tagNamesMap={tagNamesMap}
          onLoadItem={id => handleLoadLinkItem(id)}
          onDeleteItem={async id => {
            try {
              const target = sortedLinks.find((l: any) => l.id === id);
              const compoundId = getItemCompoundId({
                id,
                workspace_id: target?.workspaceId || null,
                folder_id: target?.folderId || null,
                snippet: { id, category: 'link' },
              });
              await apiClearShortcut(id, compoundId, 'link');
              await deleteLink(id);
              const isCurrentItem =
                id === activeLinkId ||
                id === (initialLink as any)?.id ||
                String(id) === String(activeLinkId || '') ||
                String(id) === String((initialLink as any)?.id || '');

              if (isCurrentItem) {
                resetEditor();
                setTitle('');
                setSelectedLinks([]);
                setLinkShortcut('');
              }
            } catch (err) {
              console.error('Delete link failed:', err);
            }
          }}
          onOpenerClick={item => {
            (item.urls || []).forEach((u: any, idx: number) => {
              const cleanUrl = typeof u === 'string' ? u : u?.url || '';
              if (cleanUrl) {
                const urlWithProtocol = cleanUrl.startsWith('//') ? `https:${cleanUrl}` : cleanUrl;
                const chromeAny = (window as any)?.chrome;
                if (chromeAny?.tabs?.create) {
                  chromeAny.tabs.create({ url: urlWithProtocol, active: idx === 0 });
                } else {
                  window.open(urlWithProtocol, '_blank', 'noopener');
                }
              }
            });
          }}
          onUpdateShortcut={async (id, val) => { await handleUpdateItemField(id, 'shortcut', val); }}
          onUpdateTitle={async (id, val) => { await handleUpdateItemField(id, 'title', val); }}
          onUpdateTags={async (id, tagText) => { await handleUpdateItemField(id, 'tags', tagText); }}
          isFavorite={isFavorite}
          toggleFavorite={toggleFavorite}
          addFavorite={addFavorite}
          isExpanded={isRightPanelExpanded}
          onExpandChange={setIsRightPanelExpanded}
          searchInputRef={rightSideSearchInputRef}
          emptyStateMessage="No links found"
        />
      )}
      </EditorContainer>

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
                <tr className="border-b border-black/5 dark:border-neutral-700">
                  <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">Link Name</td>
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
                      className="w-full bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                    />
                  </td>
                </tr>
                <tr className="border-b border-black/5 dark:border-neutral-700">
                  <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">Full URL</td>
                  <td className="py-2">
                    <input
                      ref={urlNameInputRef}
                      value={localUrlValue}
                      onChange={e => {
                        const cleaned = e.target.value.replace(/^https?:\/\/(www\.)?/i, '');
                        setLocalUrlValue(cleaned);
                        const parts = parseUrlParts(e.target.value);
                        setLinkTodoStatus('idle');
                        if (parts) {
                          setEditingUrlParts(parts);
                        }
                      }}
                      onFocus={() => {
                        setFocusedField(null);
                        setFocusedPathIndex(null);
                        setFocusedQueryIndex(null);
                        setShowPathQueryDropdown(false);
                      }}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          domainInputRef.current?.focus();
                        }
                      }}
                      className="w-full bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs truncate"
                    />
                  </td>
                </tr>
                {/* Show structured domain, path, and query fields when the URL is parseable. */}
                {editingUrlParts && (() => {
                  const parts = editingUrlParts;
                  return (
                    <>
                      <tr className="border-b border-black/5 dark:border-neutral-700">
                        <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">Domain</td>
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
                              setFocusedQueryIndex(null);
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
                            className="w-full bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                          />
                          {showPathQueryDropdown && focusedField === 'domain' && (
                            <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-neutral-900 rounded-lg border border-black/5 dark:border-neutral-700 shadow-lg z-[9999]">
                              <div className="px-3 py-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 border-b border-black/5 dark:border-neutral-700">
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
                                className="w-full text-left px-3 py-2 text-xs bg-black/5 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-neutral-700 transition-colors focus:bg-black/5 dark:focus:bg-neutral-700 focus:outline-none">
                                Insert {'{query}'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {parts.paths.map((path, idx) => (
                        <tr key={`path-${idx}`} className="border-b border-black/5 dark:border-neutral-700">
                          <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">Path {idx + 1}</td>
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
                                setFocusedQueryIndex(null);
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
                              className="w-full bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                            />
                            {showPathQueryDropdown && focusedPathIndex === idx && focusedField === 'path' && (
                              <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-neutral-900 rounded-lg border border-black/5 dark:border-neutral-700 shadow-lg z-[9999]">
                                <div className="px-3 py-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 border-b border-black/5 dark:border-neutral-700">
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
                                  className="w-full text-left px-3 py-2 text-xs bg-black/5 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-neutral-700 transition-colors focus:bg-black/5 dark:focus:bg-neutral-700 focus:outline-none">
                                  Insert {'{query}'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {parts.queryParams.map((param, idx) => (
                        <tr key={`query-${idx}`} className="border-b border-black/5 dark:border-neutral-700">
                          <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">
                            Query {idx + 1}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={param.key}
                                placeholder="Parameter"
                                aria-label={`Query ${idx + 1} parameter`}
                                onChange={e => {
                                  const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                    itemIndex === idx ? { ...item, key: e.target.value } : item,
                                  );
                                  setEditingUrlParts(prev =>
                                    prev ? { ...prev, queryParams: newQueryParams } : prev,
                                  );
                                }}
                                onFocus={() => {
                                  setFocusedField(null);
                                  setFocusedPathIndex(null);
                                  setFocusedQueryIndex(idx);
                                }}
                                onKeyDown={e => e.stopPropagation()}
                                className="min-w-0 flex-1 bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                              />
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">=</span>
                              <div className="relative min-w-0 flex-[1.4]">
                                <HighlightedInput
                                  value={param.value}
                                  placeholder="Value"
                                  aria-label={`Query ${idx + 1} value`}
                                  onChange={(e: any) => {
                                    const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                      itemIndex === idx ? { ...item, value: e.target.value } : item,
                                    );
                                    setEditingUrlParts(prev =>
                                      prev ? { ...prev, queryParams: newQueryParams } : prev,
                                    );
                                    if (showPathQueryDropdown) setShowPathQueryDropdown(false);
                                  }}
                                  onFocus={() => {
                                    setFocusedField('queryValue');
                                    setFocusedPathIndex(null);
                                    setFocusedQueryIndex(idx);
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
                                      const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                        itemIndex === idx ? { ...item, value: `${item.value}@` } : item,
                                      );
                                      setEditingUrlParts(prev =>
                                        prev ? { ...prev, queryParams: newQueryParams } : prev,
                                      );
                                      setShowPathQueryDropdown(true);
                                    } else if (showPathQueryDropdown) {
                                      setShowPathQueryDropdown(false);
                                    } else if (e.key === 'Enter' && !/{query}|\[query\]/i.test(param.value)) {
                                      e.preventDefault();
                                      const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                        itemIndex === idx ? { ...item, value: `${item.value}{query}` } : item,
                                      );
                                      setEditingUrlParts(prev =>
                                        prev ? { ...prev, queryParams: newQueryParams } : prev,
                                      );
                                    }
                                  }}
                                  className="w-full bg-black/5 dark:bg-neutral-800 border border-black/5 dark:border-neutral-700 rounded px-2 py-1 text-neutral-800 dark:text-neutral-100 text-xs"
                                />
                                {showPathQueryDropdown &&
                                  focusedQueryIndex === idx &&
                                  focusedField === 'queryValue' && (
                                    <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-neutral-900 rounded-lg border border-black/5 dark:border-neutral-700 shadow-lg z-[9999]">
                                      <div className="px-3 py-1.5 text-[10px] text-neutral-500 dark:text-neutral-400 border-b border-black/5 dark:border-neutral-700">
                                        Add Variable (Click to select)
                                      </div>
                                      <button
                                        ref={dropdownButtonRef}
                                        type="button"
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                              itemIndex === idx
                                                ? { ...item, value: item.value.replace(/@$/, '{query}') }
                                                : item,
                                            );
                                            setEditingUrlParts(prev =>
                                              prev ? { ...prev, queryParams: newQueryParams } : prev,
                                            );
                                            setShowPathQueryDropdown(false);
                                            lastFocusedInputRef.current?.focus();
                                          } else if (e.key === 'Escape') {
                                            setShowPathQueryDropdown(false);
                                            lastFocusedInputRef.current?.focus();
                                          }
                                        }}
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          const newQueryParams = parts.queryParams.map((item, itemIndex) =>
                                            itemIndex === idx
                                              ? { ...item, value: item.value.replace(/@$/, '{query}') }
                                              : item,
                                          );
                                          setEditingUrlParts(prev =>
                                            prev ? { ...prev, queryParams: newQueryParams } : prev,
                                          );
                                          setShowPathQueryDropdown(false);
                                          lastFocusedInputRef.current?.focus();
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs bg-black/5 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-neutral-700 transition-colors focus:bg-black/5 dark:focus:bg-neutral-700 focus:outline-none">
                                        Insert {'{query}'}
                                      </button>
                                    </div>
                                  )}
                              </div>
                              <button
                                type="button"
                                aria-label={`Remove query ${idx + 1}`}
                                title="Remove query parameter"
                                onClick={() => {
                                  const newQueryParams = parts.queryParams.filter((_, itemIndex) => itemIndex !== idx);
                                  setEditingUrlParts(prev =>
                                    prev ? { ...prev, queryParams: newQueryParams } : prev,
                                  );
                                  setFocusedField(null);
                                  setFocusedQueryIndex(null);
                                  setShowPathQueryDropdown(false);
                                }}
                                className="h-6 w-6 shrink-0 rounded text-neutral-500 hover:text-red-500 hover:bg-black/5 dark:hover:bg-neutral-800 transition-colors">
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b border-black/5 dark:border-neutral-700">
                        <td className="py-2 pr-4 text-neutral-600 dark:text-neutral-400 font-medium">Queries</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUrlParts(prev =>
                                prev
                                  ? { ...prev, queryParams: [...prev.queryParams, { key: '', value: '' }] }
                                  : prev,
                              );
                              setFocusedField(null);
                              setFocusedPathIndex(null);
                              setFocusedQueryIndex(parts.queryParams.length);
                              setShowPathQueryDropdown(false);
                            }}
                            className="px-2 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-black/5 dark:bg-neutral-800 rounded hover:bg-black/10 dark:hover:bg-neutral-700 transition-colors">
                            + Add Query Param
                          </button>
                        </td>
                      </tr>
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
                  className="px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-black/5 dark:bg-neutral-800 rounded-lg hover:bg-black/5 dark:hover:bg-neutral-700 transition-colors">
                  {'{ }'} Insert Param{' '}
                  <span className="ml-1.5 px-1 rounded border border-black/5 dark:border-neutral-600 bg-white dark:bg-white/5 text-[9px] font-bold text-neutral-500 dark:text-neutral-400">
                    @
                  </span>
                </button>
              )}
              {!editingUrlParts && <div />}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeLinkEditPopup}
                  className="px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-black/5 dark:bg-neutral-800 rounded-lg hover:bg-black/5 dark:hover:bg-neutral-700 transition-colors">
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
              This session was modified on another device/window since you opened it. How would you like to resolve the conflict?
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
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmation
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setLinkToDeleteId(null);
        }}
        onConfirm={async () => {
          if (linkToDeleteId) {
            try {
              const target = sortedLinks.find((l: any) => l.id === linkToDeleteId);
              const compoundId = getItemCompoundId({
                id: linkToDeleteId,
                workspace_id: target?.workspaceId || null,
                folder_id: target?.folderId || null,
                snippet: { id: linkToDeleteId, category: 'link' },
              });
              await apiClearShortcut(linkToDeleteId, compoundId, 'link');
              await deleteLink(linkToDeleteId);
              const isCurrentItem =
                linkToDeleteId === activeLinkId ||
                linkToDeleteId === (initialLink as any)?.id ||
                String(linkToDeleteId) === String(activeLinkId || '') ||
                String(linkToDeleteId) === String((initialLink as any)?.id || '');

              if (isCurrentItem) {
                resetEditor();
                setTitle('');
                setSelectedLinks([]);
                setLinkShortcut('');
              }
            } catch (err) {
              console.error('Delete link failed:', err);
            }
          }
          setIsDeleteDialogOpen(false);
          setLinkToDeleteId(null);
        }}
        title={linkToDeleteId && sortedLinks.find((l: any) => l.id === linkToDeleteId)?.title ? `Delete "${sortedLinks.find((l: any) => l.id === linkToDeleteId)?.title}"?` : 'Delete this link?'}
        description="Are you sure you want to delete this link? This action cannot be undone."
        zIndex={100005}
      />
    </>
  );
};

export default LinkEditorView;
