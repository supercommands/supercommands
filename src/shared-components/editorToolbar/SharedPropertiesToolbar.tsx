import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaStar, FaFolder } from 'react-icons/fa';
import { FiStar, FiTag, FiZapOff, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useFavorites } from '../favorites';
import { MoreHorizontal, MoreVertical, RotateCcwClock } from 'lucide-react';

import { HotkeyAssignButton, saveHotkey, clearHotkey } from '../hotkeys';
import { ShortcutAssignButton, saveShortcut, clearShortcut } from '../shortcuts';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { deleteUserShortcutByReference } from '../shortcuts/core/shortcutDbData';
import { deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import { AltSlashPopup } from './AltSlashPopup';
import { DestinationPicker } from './DestinationPicker';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import InlineTimeInput from '../inputs/InlineTimeInput';
import CustomTimePicker from '../inputs/CustomTimePicker';
import { FavoriteCategoryManager } from '../favoriteCategories';
import {
  getItemCompoundId,
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
} from '../hotkeys/utils/hotkeyUtils';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import { useTags, createTag, updateTag, deleteTag } from '../../allObjectFolder/src/createObject/tags';
import { useDbStore } from '../../storage/store/useDbStore';

import type { SharedPropertiesToolbarProps, SharedProperties } from './types';
import VersionHistoryManager from './VersionHistoryManager';
import { VersionHistoryComparisonModal } from '../versionHistory';

const getTagColor = (tagName: string) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f43f5e', // rose
    '#14b8a6', // teal
  ];
  const nameStr = String(tagName || '');
  if (!nameStr) return colors[0];
  let sum = 0;
  for (let i = 0; i < nameStr.length; i++) {
    sum += nameStr.charCodeAt(i) * (i + 1);
  }
  const index = sum % colors.length;
  return colors[index];
};

export const SharedPropertiesToolbar = React.forwardRef<HTMLDivElement, SharedPropertiesToolbarProps>((props, ref) => {
  const {
    initialSnippet,
    currentSnapshot: currentSnapshotProp,
    compoundId,
    defaultName,
    onChange,
    activeNoteId,
    showTodo = true,
    todoStatus,
    onCreateTodo,
    snippetBreadCrum,
    saveStatus,
    orgTags = [],
    setOrgTags,
    openPopupsToLeft = false,
    openPopupsToBottom = false,
    showShortcut = true,
    showLocationPicker = true,
    layout = 'vertical',
    setNoteVersionIndex,
    selectedNoteVersionIndex,
    versionHistoryItems,
    selectedVersionId,
    onSelectVersion,
    entityType,
  } = props;

  const isSupportedEntity = React.useMemo(() => {
    if (entityType) {
      return ['note', 'todo', 'snippet', 'link', 'session'].includes(String(entityType).toLowerCase());
    }
    if (activeNoteId) return true;
    if (versionHistoryItems && versionHistoryItems.length > 0) return true;
    const cat = String(initialSnippet?.category || '').toLowerCase();
    if (['note', 'notes', 'todo', 'todos', 'snippet', 'snippets', 'link', 'links', 'tabgroup', 'session', 'sessions'].some(c => cat.includes(c))) {
      return true;
    }
    return false;
  }, [entityType, activeNoteId, versionHistoryItems, initialSnippet]);

  const showVersionHistoryButton = Boolean(
    compoundId &&
      compoundId !== 'new' &&
      isSupportedEntity,
  );

  const notes = useDbStore(state => state.notes);

  const resolvedEntityType = React.useMemo(() => {
    if (entityType) return String(entityType).toLowerCase();
    if (activeNoteId) return 'note';
    const cat = String(initialSnippet?.category || '').toLowerCase();
    if (cat.includes('note')) return 'note';
    if (cat.includes('todo')) return 'todo';
    if (cat.includes('snippet')) return 'snippet';
    if (cat.includes('link')) return 'link';
    if (cat.includes('session') || cat.includes('tab')) return 'session';
    return 'note';
  }, [entityType, activeNoteId, initialSnippet]);

  const resolvedVersionHistory = React.useMemo(() => {
    if (props.versionHistory) return props.versionHistory;
    if (activeNoteId) {
      const n = notes.find(item => item.id === activeNoteId);
      if (n?.versionHistory) return n.versionHistory;
    }
    return initialSnippet?.versionHistory;
  }, [props.versionHistory, activeNoteId, notes, initialSnippet]);

  const resolvedCurrentSnapshot = React.useMemo(() => {
    // If the caller provides an explicit currentSnapshot, use it directly.
    // This is the preferred path for typed editors (e.g. Link) that have a live
    // state object with all required fields (urls, title, etc.).
    if (currentSnapshotProp !== undefined) {
      return currentSnapshotProp;
    }
    if (resolvedEntityType === 'note') {
      if (activeNoteId) {
        const n = notes.find(item => item.id === activeNoteId);
        if (n?.body !== undefined) return n.body;
      }
      return initialSnippet?.body || '';
    }
    return initialSnippet;
  }, [currentSnapshotProp, resolvedEntityType, activeNoteId, notes, initialSnippet]);

  const { isFavorite, toggleFavorite, addFavorite, removeFavorite, setFavoriteCategory, getFavoriteRecord } =
    useFavorites();

  // --- Internally Managed State for Shared Properties ---
  const [isFav, setIsFav] = useState<boolean>(false);
  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isAltSlashOpen, setIsAltSlashOpen] = useState<boolean>(false);
  const [isFavoriteCategoryOpen, setIsFavoriteCategoryOpen] = useState<boolean>(false);
  const [selectedFavoriteCategoryId, setSelectedFavoriteCategoryId] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<TagRecord[]>([]);
  const [availableTags, setAvailableTags] = useState<TagRecord[]>([]);
  const [tagPopupPos, setTagPopupPos] = useState<{ x: number; y: number } | null>(null);

  const lastToggleTimeRef = useRef(0);

  const [reminderDate, setReminderDate] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringCycle, setRecurringCycle] = useState<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);

  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState<string>('');

  const dbTags = useTags(workspaceId || undefined) || [];

  const handleSaveTagEdit = async (tagId: string) => {
    const trimmed = editingTagName.trim();
    setEditingTagId(null);
    if (!trimmed) return;
    try {
      await updateTag(tagId, { name: trimmed });
      setSelectedTags(prev => prev.map(t => (t.id === tagId ? { ...t, name: trimmed } : t)));
    } catch (err) {
      console.error('[SharedPropertiesToolbar] Failed to update tag:', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      setSelectedTags(prev => prev.filter(t => t.id !== tagId));
      if (editingTagId === tagId) setEditingTagId(null);
    } catch (err) {
      console.error('[SharedPropertiesToolbar] Failed to delete tag:', err);
    }
  };

  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);

  const workspaceNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach(w => {
      if (w.id) map[w.id] = w.workspaceName || (w as any).name || '';
    });
    return map;
  }, [workspaces]);

  const folderNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach(f => {
      if (f.id) map[f.id] = f.folderName || (f as any).name || '';
    });
    return map;
  }, [folders]);

  // Sync isFav with IndexedDB
  useEffect(() => {
    if (compoundId && compoundId !== 'new') {
      const dbFav = isFavorite(compoundId);
      const timeSinceToggle = Date.now() - lastToggleTimeRef.current;
      if (!dbFav && isFav && timeSinceToggle < 1500) {
        return;
      }
      setIsFav(dbFav);
    }
  }, [compoundId, isFavorite, isFav]);

  useEffect(() => {
    const handleAltSlashKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === '/' || e.code === 'Slash')) {
        const activeElement = document.activeElement;

        // Handle shadow DOMs if applicable (e.g. content scripts)
        let target = activeElement;
        while (target && target.shadowRoot && target.shadowRoot.activeElement) {
          target = target.shadowRoot.activeElement;
        }

        // Ignore if focused inside a specific hotkey assigner input
        if (target && target.getAttribute && target.getAttribute('data-is-hotkey-input') === 'true') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        setIsAltSlashOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleAltSlashKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleAltSlashKeyDown, { capture: true });
  }, []);

  const prevCompoundIdRef = useRef<string>(compoundId);
  const prevIncomingRef = useRef({
    workspaceId: undefined as any,
    folderId: undefined as any,
    tagIdsStr: undefined as any,
    reminderDate: undefined as any,
    reminderTime: undefined as any,
    isRecurring: undefined as any,
    recurringCycle: undefined as any,
  });

  // Reset tracking state when compoundId changes to force full re-sync
  useEffect(() => {
    const prevRawId = extractSnippetIdFromCompoundId(prevCompoundIdRef.current || '');
    const newRawId = extractSnippetIdFromCompoundId(compoundId || '');
    const wasFullyFormed = !!prevCompoundIdRef.current && prevCompoundIdRef.current !== prevRawId;
    const isMove =
      prevCompoundIdRef.current !== compoundId && prevRawId === newRawId && prevRawId !== '' && wasFullyFormed;

    if (!isMove) {
      prevIncomingRef.current = {
        workspaceId: undefined,
        folderId: undefined,
        tagIdsStr: undefined,
        reminderDate: undefined,
        reminderTime: undefined,
        isRecurring: undefined,
        recurringCycle: undefined,
      };
    }
    isFirstBubbleRef.current = true;
  }, [compoundId]);

  // Fetch Hotkey and Shortcut on mount or when compoundId changes
  useEffect(() => {
    if (!compoundId || compoundId === 'new') {
      const isTransitioningToNew = prevCompoundIdRef.current !== 'new' && prevCompoundIdRef.current !== '';
      if (isTransitioningToNew) {
        setIsFav(false);
        setPendingHotkey('');
        setPendingShortcut('');
        setSelectedTags([]);
        setWorkspaceId(null);
        setFolderId(null);
        setReminderDate('');
        setReminderTime('');
        setIsRecurring(false);
        setRecurringCycle(null);
        if (onChange) {
          onChange({
            isFav: false,
            pendingHotkey: '',
            pendingShortcut: showShortcut ? '' : undefined,
            selectedTags: [],
            workspaceId: undefined,
            folderId: undefined,
          } as any);
        }
      }
      prevCompoundIdRef.current = compoundId || 'new';
      return;
    }

    const wasUnsaved =
      (!prevCompoundIdRef.current || prevCompoundIdRef.current === 'new') && !!compoundId && compoundId !== 'new';

    const prevRawId = extractSnippetIdFromCompoundId(prevCompoundIdRef.current || '');
    const newRawId = extractSnippetIdFromCompoundId(compoundId || '');
    const wasFullyFormed = !!prevCompoundIdRef.current && prevCompoundIdRef.current !== prevRawId;
    const isMove =
      prevCompoundIdRef.current !== compoundId && prevRawId === newRawId && prevRawId !== '' && wasFullyFormed;

    prevCompoundIdRef.current = compoundId;

    let isMounted = true;

    if (wasUnsaved) {
      // The item was just saved and received a valid compoundId!
      // If there are pending hotkey/shortcut/favorite entered by the user, save them now.
      const savePendingKeys = async () => {
        const snippetId =
          initialSnippet?.id || initialSnippet?.snippet_id || extractSnippetIdFromCompoundId(compoundId);
        let itemType: any = 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (['session', 'sessions', 'tab session'].includes(cat)) itemType = 'session';
        else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

        if (pendingHotkey && isMounted) {
          try {
            await saveHotkey(snippetId || compoundId, compoundId, pendingHotkey, itemType);
          } catch (err) {
            console.error('Failed to save pending hotkey on creation:', err);
          }
        }
        if (pendingShortcut && isMounted) {
          try {
            const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';
            await saveShortcut(snippetId || compoundId, compoundId, pendingShortcut, itemName, itemType);
          } catch (err) {
            console.error('Failed to save pending shortcut on creation:', err);
          }
        }
        if (isFav && isMounted) {
          try {
            const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
            await addFavorite(compoundId, itemType, label);
          } catch (err) {
            console.error('Failed to save pending favorite on creation:', err);
          }
        }
      };
      void savePendingKeys();
    } else if (isMove) {
      // It's the exact same item, just moved to a new folder/workspace!
      // Do not fetch from DB because the background migration is in progress.
      // We already have the correct values in state, so we just preserve them seamlessly.
    } else {
      // Use reactive hotkeys from useDbStore
      const snippetIdPart = extractSnippetIdFromCompoundId(compoundId);
      const hotkey = hotkeysMap[compoundId] || (snippetIdPart !== compoundId ? hotkeysMap[snippetIdPart] : '') || '';
      const shortcut = normalizeShortcutTrigger(
        shortcutsMap[compoundId] || (snippetIdPart !== compoundId ? shortcutsMap[snippetIdPart] : '') || '',
      );
      setPendingHotkey(hotkey);
      setPendingShortcut(shortcut);
    }
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundId, hotkeysMap, shortcutsMap]);

  // Initialize state from existing object
  useEffect(() => {
    if (initialSnippet && compoundId && compoundId !== 'new') {
      const incomingTagIds =
        initialSnippet.tagIds || (initialSnippet.tags ? initialSnippet.tags.map((t: any) => t.id) : []);
      const incomingTagIdsStr = [...incomingTagIds].sort().join(',');

      const resolvedTags =
        Array.isArray(initialSnippet.tags) && initialSnippet.tags.length > 0
          ? initialSnippet.tags.map((t: any) => {
              const found = dbTags.find(dbT => dbT.id === t.id);
              const name = t.name && t.name !== '...' && t.name !== t.id ? t.name : found ? found.name : t.name || t.id;
              return { id: t.id || t.name, name };
            })
          : incomingTagIds.map((id: string) => {
              const found = dbTags.find(t => t.id === id);
              return found
                ? { id: found.id, name: found.name }
                : { id: id, name: id.startsWith('temp_') ? id.replace('temp_', '') : id };
            });

      const hasMissingNames = selectedTags.some((t: any) => t.name === '...');
      const canResolveNow = resolvedTags.some((rt: any) => {
        const st = selectedTags.find((s: any) => s.id === rt.id);
        return st?.name === '...' && rt.name !== '...';
      });

      if (incomingTagIdsStr !== prevIncomingRef.current.tagIdsStr || (hasMissingNames && canResolveNow)) {
        prevIncomingRef.current.tagIdsStr = incomingTagIdsStr;
        setSelectedTags(resolvedTags);
      }

      let newDate = '';
      let newTime = '';
      if (initialSnippet.event_deadline) {
        try {
          const dt = new Date(initialSnippet.event_deadline);
          newDate = dt.toISOString().split('T')[0];
          newTime = dt.toTimeString().substring(0, 5);
        } catch {
          /* ignore */
        }
      }

      if (prevIncomingRef.current.reminderDate !== newDate || prevIncomingRef.current.reminderTime !== newTime) {
        prevIncomingRef.current.reminderDate = newDate;
        prevIncomingRef.current.reminderTime = newTime;
        setReminderDate(newDate);
        setReminderTime(newTime);
      }

      const newRecurring = !!initialSnippet.is_recurring;
      if (prevIncomingRef.current.isRecurring !== newRecurring) {
        prevIncomingRef.current.isRecurring = newRecurring;
        setIsRecurring(newRecurring);
      }

      const newCycle = initialSnippet.recurring_cycle || null;
      if (prevIncomingRef.current.recurringCycle !== newCycle) {
        prevIncomingRef.current.recurringCycle = newCycle;
        setRecurringCycle(newCycle);
      }

      const newWs = initialSnippet.workspaceId || initialSnippet.workspace_id || null;
      if (prevIncomingRef.current.workspaceId !== newWs) {
        prevIncomingRef.current.workspaceId = newWs;
        setWorkspaceId(newWs);
      }

      const newFolder = initialSnippet.folderId || initialSnippet.folder_id || null;
      if (prevIncomingRef.current.folderId !== newFolder) {
        prevIncomingRef.current.folderId = newFolder;
        setFolderId(newFolder);
      }
    }
  }, [initialSnippet, dbTags, selectedTags, compoundId]);

  const isFirstBubbleRef = useRef(true);
  const isUserChangeRef = useRef(false);

  // Bubble editable note properties up whenever they change.
  // Favorite state is handled separately so a star toggle does not trigger note autosave UI.
  useEffect(() => {
    if (isFirstBubbleRef.current) {
      isFirstBubbleRef.current = false;
      return;
    }
    if (onChange && isUserChangeRef.current) {
      const initWs = initialSnippet?.workspaceId || initialSnippet?.workspace_id || null;
      const initFolder = initialSnippet?.folderId || initialSnippet?.folder_id || null;

      const payload = {
        isFav,
        pendingHotkey,
        pendingShortcut: showShortcut ? pendingShortcut : undefined,
        selectedTags: selectedTags,
        availableTags,
        reminderDate,
        reminderTime,
        isRecurring,
        recurringCycle,
        workspaceId: workspaceId,
        folderId: folderId,
      };
      console.log('[SharedPropertiesToolbar] Bubbling up changes. Payload:', payload, 'showShortcut:', showShortcut);
      onChange(payload as any);
      isUserChangeRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isFav,
    pendingHotkey,
    pendingShortcut,
    selectedTags,
    availableTags,
    reminderDate,
    reminderTime,
    isRecurring,
    recurringCycle,
    workspaceId,
    folderId,
    showShortcut,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();
      if (
        todoPopupRef.current &&
        !path.includes(todoPopupRef.current) &&
        (!todoPortalRef.current || !path.includes(todoPortalRef.current))
      ) {
        setIsTodoPopupOpen(false);
      }
      if (
        locationPopupRef.current &&
        !path.includes(locationPopupRef.current) &&
        (!locationPortalRef.current || !path.includes(locationPortalRef.current))
      ) {
        setIsLocationPickerOpen(false);
      }

      if (
        popupRef.current &&
        !path.includes(popupRef.current) &&
        (!tagPortalRef.current || !path.includes(tagPortalRef.current))
      ) {
        setTagPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onToggleFavorite = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Close other popups
    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);

    isUserChangeRef.current = true;
    lastToggleTimeRef.current = Date.now();

    if (!compoundId || compoundId === 'new') {
      setIsFav(prev => !prev);
      return;
    }

    if (isFav) {
      setIsFav(false);
      await removeFavorite(compoundId);
    } else {
      setIsFav(true);
      let type = 'note';
      const catVal = String(initialSnippet?.category || '').toLowerCase();
      if (['session', 'sessions', 'tab session'].includes(catVal)) type = 'session';
      else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(catVal)) type = 'link';
      else if (['snippet', 'snippets'].includes(catVal)) type = 'snippet';
      else if (['automation', 'automations'].includes(catVal)) type = 'automation';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(catVal))
        type = 'aiPrompt';
      else if (['todo', 'todos'].includes(catVal)) type = 'todo';

      const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
      await addFavorite(compoundId, type, label);
    }
  };

  const handleFavoriteStarClick = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);
    setIsVersionHistoryCategoryOpen(false);
    setSelectedFavoriteCategoryId(getFavoriteRecord(compoundId || '')?.favoriteCategoryId ?? null);
    setIsFavoriteCategoryOpen(true);

    if (!isFav) {
      await onToggleFavorite(e);
    }
  };

  const handleRemoveFavorite = async () => {
    if (!compoundId || compoundId === 'new') {
      setIsFav(false);
      setIsFavoriteCategoryOpen(false);
      return;
    }

    isUserChangeRef.current = true;
    lastToggleTimeRef.current = Date.now();
    setIsFav(false);
    await removeFavorite(compoundId);
    setIsFavoriteCategoryOpen(false);
  };

  const handleFavoriteCategorySelect = async (categoryId: string | null) => {
    if (!compoundId || compoundId === 'new') return;
    setSelectedFavoriteCategoryId(categoryId);
    if (isFav) {
      await setFavoriteCategory(compoundId, categoryId);
      return;
    }

    let type = 'note';
    const catVal = String(initialSnippet?.category || '').toLowerCase();
    if (['session', 'sessions', 'tab session'].includes(catVal)) type = 'session';
    else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(catVal)) type = 'link';
    else if (['snippet', 'snippets'].includes(catVal)) type = 'snippet';
    else if (['automation', 'automations'].includes(catVal)) type = 'automation';
    else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(catVal))
      type = 'aiPrompt';
    else if (['todo', 'todos'].includes(catVal)) type = 'todo';

    const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
    await addFavorite(compoundId, type, label, categoryId);
    setIsFav(true);
  };

  const onHotkeyChange = async (hotkey: string) => {
    isUserChangeRef.current = true;
    setPendingHotkey(hotkey);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (['session', 'sessions', 'tab session'].includes(cat)) itemType = 'session';
        else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

        if (!hotkey) await clearHotkey(snippetId || compoundId, compoundId, itemType);
        else await saveHotkey(snippetId || compoundId, compoundId, hotkey, itemType);
      } catch (err) {
        console.error('Auto-save hotkey failed', err);
      }
    }
  };

  const onShortcutChange = async (shortcut: string) => {
    isUserChangeRef.current = true;
    const normalizedShortcut = normalizeShortcutTrigger(shortcut);
    setPendingShortcut(normalizedShortcut);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (['session', 'sessions', 'tab session'].includes(cat)) itemType = 'session';
        else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';
        const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';

        if (!normalizedShortcut) await clearShortcut(snippetId || compoundId, compoundId, itemType);
        else await saveShortcut(snippetId || compoundId, compoundId, normalizedShortcut, itemName, itemType);
      } catch (err) {
        console.error('Auto-save shortcut failed', err);
      }
    }
  };

  const onHotkeyOverwrite = async (conflictId: string, hotkeyValue: string) => {
    if (!compoundId || compoundId === 'new') return;

    try {
      const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
      let itemType: any = 'note';
      const cat = String(initialSnippet?.category || '').toLowerCase();
      if (['session', 'sessions', 'tab session'].includes(cat)) itemType = 'session';
      else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
      else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
      else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
        itemType = 'aiPrompt';
      else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

      await deleteUserHotkeyByReference(conflictId);
      await saveHotkey(snippetId || compoundId, compoundId, hotkeyValue, itemType);
      setPendingHotkey(hotkeyValue);
    } catch (err) {
      console.error('Failed to overwrite hotkey', err);
    }
  };

  const onShortcutOverwrite = async (conflictId: string, shortcutValue: string) => {
    if (!compoundId || compoundId === 'new') return;

    try {
      const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
      let itemType: any = 'note';
      const cat = String(initialSnippet?.category || '').toLowerCase();
      if (['session', 'sessions', 'tab session'].includes(cat)) itemType = 'session';
      else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
      else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
      else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
        itemType = 'aiPrompt';
      else if (['todo', 'todos'].includes(cat)) itemType = 'todo';
      const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';

      await deleteUserShortcutByReference(conflictId);
      const normalizedShortcut = normalizeShortcutTrigger(shortcutValue);
      await saveShortcut(snippetId || compoundId, compoundId, normalizedShortcut, itemName, itemType);
      setPendingShortcut(normalizedShortcut);
    } catch (err) {
      console.error('Failed to overwrite shortcut', err);
    }
  };
  const onTagSelect = (tag: any) => handleTagSelect(tag);

  // --- Hover & Popup State ---
  const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [isVersionHistoryCategoryOpen, setIsVersionHistoryCategoryOpen] = useState<boolean>(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);

  useEffect(() => {
    if (
      isAltSlashOpen ||
      isFavoriteCategoryOpen ||
      isTodoPopupOpen ||
      isLocationPickerOpen ||
      tagPopupOpen ||
      isVersionHistoryCategoryOpen
    ) {
      setIsToolbarExpanded(true);
    }
  }, [
    isAltSlashOpen,
    isFavoriteCategoryOpen,
    isTodoPopupOpen,
    isLocationPickerOpen,
    tagPopupOpen,
    isVersionHistoryCategoryOpen,
  ]);

  useEffect(() => {
    const handleEscapeKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFavoriteCategoryOpen) {
          setIsFavoriteCategoryOpen(false);
          return;
        }
        if (isTodoPopupOpen) {
          setIsTodoPopupOpen(false);
          return;
        }
        if (isLocationPickerOpen) {
          setIsLocationPickerOpen(false);
          return;
        }
        if (tagPopupOpen) {
          setTagPopupOpen(false);
          return;
        }
        if (isVersionHistoryCategoryOpen) {
          setIsVersionHistoryCategoryOpen(false);
          return;
        }
        if (isAltSlashOpen) {
          setIsAltSlashOpen(false);
          return;
        }
        if (isToolbarExpanded) {
          setIsToolbarExpanded(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscapeKeyDown);
    return () => window.removeEventListener('keydown', handleEscapeKeyDown);
  }, [
    isFavoriteCategoryOpen,
    isTodoPopupOpen,
    isLocationPickerOpen,
    tagPopupOpen,
    isVersionHistoryCategoryOpen,
    isAltSlashOpen,
    isToolbarExpanded,
  ]);

  const todoHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const locationHoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tagHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutButtonRef = useRef<HTMLButtonElement>(null);
  const todoPopupRef = useRef<HTMLDivElement>(null);
  const versionHistoryParentRef = useRef<HTMLDivElement>(null);
  const locationPopupRef = useRef<HTMLDivElement>(null);
  const versionHistoryCategoryRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null); // Tag popup ref

  const todoPortalRef = useRef<HTMLDivElement>(null);
  const locationPortalRef = useRef<HTMLDivElement>(null);
  const tagPortalRef = useRef<HTMLDivElement>(null);

  const [todoPopupPos, setTodoPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [locationPopupPos, setLocationPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [versionHistoryCategoryPopupPos, setVersionHistoryCategoryPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (tagPopupOpen && popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      let x = rect.left;
      let y = rect.bottom + 4;
      if (openPopupsToBottom) {
        x = Math.max(12, rect.right - 240);
        y = rect.bottom + 4;
      } else if (openPopupsToLeft) {
        x = rect.left - 244;
        y = rect.top;
      } else {
        x = rect.right + 12;
        y = rect.top;
      }
      setTagPopupPos({ x, y });
    }
  }, [tagPopupOpen, openPopupsToBottom, openPopupsToLeft]);

  useEffect(() => {
    if (isTodoPopupOpen && todoPopupRef.current) {
      const rect = todoPopupRef.current.getBoundingClientRect();
      let x = rect.left;
      let y = rect.bottom + 4;
      if (openPopupsToBottom) {
        x = Math.max(12, rect.right - 240);
        y = rect.bottom + 4;
      } else if (openPopupsToLeft) {
        x = rect.left - 244;
        y = rect.top;
      } else {
        x = rect.right + 12;
        y = rect.top;
      }
      setTodoPopupPos({ x, y });
    }
  }, [isTodoPopupOpen, openPopupsToBottom, openPopupsToLeft]);

  useEffect(() => {
    if (isLocationPickerOpen && locationPopupRef.current) {
      const rect = locationPopupRef.current.getBoundingClientRect();
      let x = rect.left;
      let y = rect.bottom + 4;
      if (openPopupsToBottom) {
        x = Math.max(12, rect.right - 260);
        y = rect.bottom + 4;
      } else if (openPopupsToLeft) {
        x = rect.left - 264;
        y = rect.top;
      } else {
        x = rect.right + 12;
        y = rect.top;
      }
      setLocationPopupPos({ x, y });
    }
  }, [isLocationPickerOpen, openPopupsToBottom, openPopupsToLeft]);

  useEffect(() => {
    if (isVersionHistoryCategoryOpen && versionHistoryParentRef?.current) {
      const rect = versionHistoryParentRef.current.getBoundingClientRect();
      let x = rect.left;
      let y = rect.bottom + 4;
      if (openPopupsToBottom) {
        x = Math.max(12, rect.right - 260);
        y = rect.bottom + 4;
      } else if (openPopupsToLeft) {
        x = rect.left - 264;
        y = rect.top;
      } else {
        x = rect.right + 12;
        y = rect.top;
      }
      setVersionHistoryCategoryPopupPos({ x, y });
    }
  }, [isVersionHistoryCategoryOpen, openPopupsToBottom, openPopupsToLeft]);

  // --- Todo State ---
  const [isAnytime, setIsAnytime] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [isCycleDropdownOpen, setIsCycleDropdownOpen] = useState(false);
  const timePopupRef = useRef<HTMLDivElement>(null);
  const cyclePopupRef = useRef<HTMLDivElement>(null);

  // --- Tags State ---
  const [newTagName, setNewTagName] = useState('');

  // Handlers
  const handleTodoPopupToggle = () => {
    setIsTodoPopupOpen(prev => !prev);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);
    setIsVersionHistoryCategoryOpen(false);
  };

  const handleLocationPickerToggle = () => {
    setIsLocationPickerOpen(prev => !prev);
    setIsTodoPopupOpen(false);
    setTagPopupOpen(false);
    setIsVersionHistoryCategoryOpen(false);
  };

  const handleTagIconClick = () => {
    setTagPopupOpen(prev => !prev);
    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
    setIsVersionHistoryCategoryOpen(false);
  };

  const handleVersionHistoryToggle = () => {
    setIsVersionHistoryCategoryOpen(prev => !prev);
    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);
  };

  const handleMoreActionsToggle = () => {
    setIsToolbarExpanded(prev => {
      const next = !prev;
      if (!next) {
        setIsTodoPopupOpen(false);
        setIsLocationPickerOpen(false);
        setTagPopupOpen(false);
        setIsFavoriteCategoryOpen(false);
        setIsVersionHistoryCategoryOpen(false);
        setIsAltSlashOpen(false);
      }
      return next;
    });
  };

  const handleMoreActionsDoubleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsToolbarExpanded(false);
    setIsTodoPopupOpen(false);
    setIsLocationPickerOpen(false);
    setTagPopupOpen(false);
    setIsFavoriteCategoryOpen(false);
    setIsVersionHistoryCategoryOpen(false);
    setIsAltSlashOpen(false);
  };

  const handleCreateTodoFromNote = () => {
    if (onCreateTodo) {
      let deadlineVal = '';
      if (reminderDate) {
        try {
          const timeStr = reminderTime ? (reminderTime.length === 5 ? `${reminderTime}:00` : reminderTime) : '09:00:00';
          deadlineVal = new Date(`${reminderDate}T${timeStr}`).toISOString();
        } catch (e) {
          deadlineVal = new Date(reminderDate).toISOString();
        }
      }
      onCreateTodo(deadlineVal, isRecurring, recurringCycle || 'daily');
      setIsTodoPopupOpen(false);
    }
  };

  const handleWorkspaceDestination = (wsId: string) => {
    isUserChangeRef.current = true;
    setWorkspaceId(wsId);
    setFolderId(null);
  };

  const handleFolderDestination = (wsId: string, folderId: string) => {
    isUserChangeRef.current = true;
    setWorkspaceId(wsId);
    setFolderId(folderId);
  };

  const handleTagSelect = (tag: any) => {
    isUserChangeRef.current = true;
    setSelectedTags(prev => {
      const exists = prev.find(t => t.id === tag.id);
      const nextTags = exists ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
      return nextTags;
    });
  };

  return (
    <>
      <div
        data-shared-toolbar="true"
        onMouseEnter={() => setIsToolbarExpanded(true)}
        className={
          layout === 'horizontal'
            ? 'flex items-center gap-1.5 relative z-10 w-fit'
            : 'flex flex-col items-center gap-1 relative z-10'
        }>
        {!isToolbarExpanded && showShortcut && (
          <div className="relative">
            <ShortcutAssignButton
              ref={shortcutButtonRef}
              itemId={compoundId}
              currentShortcut={pendingShortcut}
              onShortcutChange={(shortcut: string) => {
                if (onShortcutChange) onShortcutChange(shortcut);
              }}
              onOverwriteShortcut={onShortcutOverwrite}
              defaultName={defaultName}
              isShortcutLoading={false}
              sidebarMode={true}
              openToLeft={openPopupsToLeft}
              openToBottom={openPopupsToBottom}
              title="Shortcut (Alt+/)"
              className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
        )}
        {isToolbarExpanded && (
          <div
            className={
              layout === 'horizontal'
                ? 'flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150'
                : 'flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-150'
            }>
            {/* Favorites (Star) */}
            <div className="relative">
              <button
                type="button"
                onClick={e => {
                  void handleFavoriteStarClick(e);
                }}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed"
                title="Favorite (Alt+/)">
                {isFav ? <FaStar size={20} className="text-yellow-500 fill-yellow-500" /> : <FiStar size={20} />}
              </button>
              <FavoriteCategoryManager
                isOpen={isFavoriteCategoryOpen}
                onOpenChange={setIsFavoriteCategoryOpen}
                showTrigger={false}
                popoverClassName={`absolute ${
                  openPopupsToBottom
                    ? 'right-0 top-full mt-2'
                    : openPopupsToLeft
                      ? 'right-full top-0 mr-3'
                      : 'left-full top-0 ml-3'
                }`}
                isFavorite={isFav}
                selectedCategoryId={selectedFavoriteCategoryId}
                onSelectCategory={(categoryId: string | null) => {
                  void handleFavoriteCategorySelect(categoryId);
                }}
                onRemoveFavorite={() => {
                  void handleRemoveFavorite();
                }}
              />
            </div>

            {/* Hotkeys */}
            <div className="relative">
              <HotkeyAssignButton
                ref={hotkeyButtonRef}
                itemId={compoundId}
                currentHotkey={pendingHotkey}
                onHotkeyChange={onHotkeyChange}
                isFavorite={isFav}
                onToggleFavorite={onToggleFavorite}
                showFavorite={false}
                isFavLoading={false}
                isHotkeyLoading={false}
                sidebarMode={true}
                openToLeft={openPopupsToLeft}
                openToBottom={openPopupsToBottom}
                onOverwriteHotkey={onHotkeyOverwrite}
                title="Hotkey (Alt+/)"
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>

            {/* Text Command / Shortcut */}
            {showShortcut && (
              <div className="relative">
                <ShortcutAssignButton
                  ref={shortcutButtonRef}
                  itemId={compoundId}
                  currentShortcut={pendingShortcut}
                  onShortcutChange={(shortcut: string) => {
                    if (onShortcutChange) onShortcutChange(shortcut);
                  }}
                  onOverwriteShortcut={onShortcutOverwrite}
                  defaultName={defaultName}
                  isShortcutLoading={false}
                  sidebarMode={true}
                  openToLeft={openPopupsToLeft}
                  openToBottom={openPopupsToBottom}
                  title="Shortcut (Alt+/)"
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* Create To-Do */}
            {showTodo && (
              <div ref={todoPopupRef} className="relative">
                <button
                  type="button"
                  onClick={handleTodoPopupToggle}
                  className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed border-none bg-transparent shadow-none"
                  title={
                    reminderDate
                      ? `Todo set for ${reminderDate}${reminderTime ? ' at ' + reminderTime : ''}`
                      : 'Create Todo (Alt+/)'
                  }>
                  <BsCalendarCheck size={20} />
                </button>
                {isTodoPopupOpen &&
                  todoPopupPos &&
                  createPortal(
                    <div
                      ref={todoPortalRef}
                      style={{
                        position: 'fixed',
                        left: `${todoPopupPos.x}px`,
                        top: `${todoPopupPos.y}px`,
                        zIndex: 2147483647,
                      }}>
                      <NewDueDateDropdown
                        isOpen={isTodoPopupOpen}
                        onClose={() => setIsTodoPopupOpen(false)}
                        positionClassName=""
                        onSelect={({ date, time }) => {
                          console.log('[SharedPropertiesToolbar:onSelect] Selected date & time from NewDueDateDropdown:', {
                            date,
                            time,
                          });
                          isUserChangeRef.current = true;
                          setReminderDate(date);
                          const selectedTime = time || '';
                          setReminderTime(selectedTime);
                          setIsTodoPopupOpen(false);

                          if (onCreateTodo) {
                            let deadlineVal = '';
                            if (date) {
                              try {
                                const timeStr = selectedTime
                                  ? selectedTime.length === 5
                                    ? `${selectedTime}:00`
                                    : selectedTime
                                  : '09:00:00';
                                deadlineVal = new Date(`${date}T${timeStr}`).toISOString();
                              } catch (e) {
                                deadlineVal = new Date(date).toISOString();
                              }
                            }
                            console.log(
                              '[SharedPropertiesToolbar:onSelect] Invoking onCreateTodo with deadlineVal:',
                              deadlineVal,
                            );
                            onCreateTodo(deadlineVal, isRecurring, recurringCycle || 'daily');
                          } else {
                            console.warn('[SharedPropertiesToolbar:onSelect] onCreateTodo callback prop is not defined!');
                          }
                        }}
                        currentDate={reminderDate}
                        currentTime={reminderTime}
                      />
                    </div>,
                    document.body,
                  )}
              </div>
            )}

            {/* Location (Folder) */}
            {showLocationPicker && (
              <div ref={locationPopupRef}>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleLocationPickerToggle();
                  }}
                  disabled={saveStatus === 'saving'}
                  className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isLocationPickerOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                  title={`${snippetBreadCrum?.folder_name || snippetBreadCrum?.workspace_name || 'Folders'} (Alt+/)`}>
                  <FaFolder size={20} />
                </button>
                {isLocationPickerOpen &&
                  locationPopupPos &&
                  createPortal(
                    <div
                      ref={locationPortalRef}
                      style={{
                        position: 'fixed',
                        left: `${locationPopupPos.x}px`,
                        top: `${locationPopupPos.y}px`,
                        zIndex: 2147483647,
                      }}
                      className="w-[260px]">
                      <DestinationPicker
                        selectedWorkspaceId={workspaceId}
                        selectedFolderId={folderId}
                        onSelectWorkspace={handleWorkspaceDestination}
                        onSelectFolder={handleFolderDestination}
                        onClear={() => {
                          isUserChangeRef.current = true;
                          setWorkspaceId(null);
                          setFolderId(null);
                        }}
                        onClose={() => setIsLocationPickerOpen(false)}
                      />
                    </div>,
                    document.body,
                  )}
              </div>
            )}

            {/* Tags */}
            <div ref={popupRef}>
              <button
                type="button"
                onClick={handleTagIconClick}
                className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${tagPopupOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                title={`${selectedTags.length > 0 ? selectedTags.map(t => t.name).join(', ') : 'Tags'} (Alt+/)`}>
                <FiTag size={20} />
                {selectedTags.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#141414]">
                    {selectedTags.length}
                  </span>
                )}
              </button>
              {tagPopupOpen &&
                tagPopupPos &&
                createPortal(
                  <div
                    ref={tagPortalRef}
                    style={{
                      position: 'fixed',
                      left: `${tagPopupPos.x}px`,
                      top: `${tagPopupPos.y}px`,
                      zIndex: 2147483647,
                    }}
                    className="w-[240px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault,rgba(255,255,255,0.1))] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                    {/* Integrated Inline Search Row */}
                    <div className="border-b border-slate-100 dark:border-white/5 flex items-center">
                      <form
                        onSubmit={async e => {
                          e.preventDefault();
                          if (!newTagName.trim()) return;
                          const trimmed = newTagName.trim();
                          const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                          if (existing) {
                            handleTagSelect({ id: existing.id, name: existing.name });
                          } else {
                            if (workspaceId) {
                              const newTagRecord = await createTag(trimmed, workspaceId);
                              handleTagSelect({ id: newTagRecord.id, name: newTagRecord.name });
                            } else {
                              handleTagSelect({ id: `temp_${trimmed}`, name: trimmed });
                            }
                          }
                          setNewTagName('');
                        }}
                        className="flex-1 flex">
                        <input
                          type="text"
                          placeholder="Type to search or create..."
                          value={newTagName}
                          onChange={e => setNewTagName(e.target.value)}
                          className="w-full bg-transparent px-3 py-2 text-xs outline-none text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)]"
                        />
                      </form>
                    </div>

                    {/* Selected Tags list (if any tags are selected, show them in a tight flex container) */}
                    {selectedTags.length > 0 && (
                      <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5">
                        {selectedTags.map(st => (
                          <span
                            key={st.id}
                            className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-500/20">
                            {st.name}
                            <button
                              type="button"
                              onClick={() => handleTagSelect(st)}
                              className="hover:text-blue-800 dark:hover:text-blue-200 opacity-70 hover:opacity-100 transition-opacity">
                              <FiZapOff size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tag List Area */}
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `
                    .no-scrollbar::-webkit-scrollbar {
                      display: none !important;
                    }
                    .no-scrollbar {
                      -ms-overflow-style: none !important;
                      scrollbar-width: none !important;
                    }
                  `,
                      }}
                    />
                    <div className="p-2 flex flex-col gap-1 max-h-[140px] overflow-y-auto no-scrollbar">
                      {/* Clear Tags item (Remove radical) with red dot */}
                      {selectedTags.length > 0 && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            isUserChangeRef.current = true;
                            setSelectedTags([]);
                          }}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left text-xs text-red-500 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors mb-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-500" />
                          <span className="font-medium flex-1">Clear Tags</span>
                          <FiZapOff size={10} className="opacity-75" />
                        </button>
                      )}

                      {newTagName.trim() && (
                        <button
                          type="button"
                          onClick={async e => {
                            e.stopPropagation();
                            const trimmed = newTagName.trim();
                            const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                            if (existing) {
                              handleTagSelect({ id: existing.id, name: existing.name });
                            } else {
                              if (workspaceId) {
                                const newTagRecord = await createTag(trimmed, workspaceId);
                                handleTagSelect({ id: newTagRecord.id, name: newTagRecord.name });
                              } else {
                                handleTagSelect({ id: `temp_${trimmed}`, name: trimmed });
                              }
                            }
                            setNewTagName('');
                          }}
                          className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs text-neutral-500 hover:text-neutral-900 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors border border-dashed border-neutral-300 dark:border-white/10 mb-1">
                          <div className="flex items-center gap-2">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-neutral-400 dark:text-neutral-500">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="16" />
                              <line x1="8" y1="12" x2="16" y2="12" />
                            </svg>
                            <span>Create "{newTagName.trim()}"</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/5 text-neutral-400 dark:text-neutral-400 font-mono scale-90">
                            Enter
                          </span>
                        </button>
                      )}

                      {dbTags
                        .filter(
                          (t, index, self) =>
                            index === self.findIndex(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase()),
                        )
                        .map((tag, idx) => {
                          const isSelected = selectedTags.some(
                            t => t.id === tag.id || t.name.trim().toLowerCase() === tag.name.trim().toLowerCase(),
                          );
                          const dotColor = getTagColor(tag.name);
                          const isEditingThisTag = editingTagId === tag.id;

                          if (isEditingThisTag) {
                            return (
                              <div
                                key={tag.id || idx}
                                className="flex items-center gap-1.5 px-2 py-1 bg-black/10 dark:bg-white/10 rounded-lg">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: dotColor }}
                                />
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingTagName}
                                  onChange={e => setEditingTagName(e.target.value)}
                                  onKeyDown={async e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await handleSaveTagEdit(tag.id);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setEditingTagId(null);
                                    }
                                  }}
                                  onBlur={() => handleSaveTagEdit(tag.id)}
                                  className="flex-1 bg-transparent px-1 py-0.5 text-xs outline-none text-[var(--color-textPrimary)] font-medium border-b border-blue-500 min-w-0"
                                />
                              </div>
                            );
                          }

                          return (
                            <div
                              key={tag.id || idx}
                              onClick={() => handleTagSelect({ id: tag.id, name: tag.name })}
                              className={`group flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-medium'
                                  : 'text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
                              }`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: dotColor }}
                                />
                                <span className="truncate">{tag.name}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {/* Pencil / Edit Icon */}
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingTagId(tag.id);
                                    setEditingTagName(tag.name);
                                  }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-200 transition-all cursor-pointer"
                                  title="Rename Tag">
                                  <FiEdit2 size={11} />
                                </button>

                                {/* Trash / Delete Icon */}
                                <button
                                  type="button"
                                  onClick={async e => {
                                    e.stopPropagation();
                                    await handleDeleteTag(tag.id);
                                  }}
                                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 transition-all cursor-pointer"
                                  title="Delete Tag">
                                  <FiTrash2 size={11} />
                                </button>

                                {isSelected && (
                                  <span
                                    className="text-[var(--color-danger)] p-0.5 rounded flex items-center justify-center bg-[var(--color-dangerBg)]"
                                    title="Added">
                                    <FiZapOff size={10} />
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>,
                  document.body,
                )}
            </div>

            {/* Version History */}
            {showVersionHistoryButton && (
              <div ref={versionHistoryParentRef}>
                <button
                  type="button"
                  onClick={handleVersionHistoryToggle}
                  className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${isVersionHistoryCategoryOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
                  title="Version History (Alt+h)">
                  <RotateCcwClock size={20} />
                </button>

                {isVersionHistoryCategoryOpen && (
                  <VersionHistoryComparisonModal
                    isOpen={isVersionHistoryCategoryOpen}
                    onClose={() => setIsVersionHistoryCategoryOpen(false)}
                    entityType={resolvedEntityType}
                    entityId={compoundId}
                    entityTitle={defaultName || initialSnippet?.title || initialSnippet?.name || 'Untitled'}
                    currentSnapshot={resolvedCurrentSnapshot}
                    versionHistory={resolvedVersionHistory}
                    triggerRef={versionHistoryParentRef}
                  />
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleMoreActionsToggle}
          onDoubleClick={handleMoreActionsDoubleClick}
          aria-label={isToolbarExpanded ? 'Hide shared properties' : 'Show shared properties'}
          aria-expanded={isToolbarExpanded}
          className={`p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed border-none bg-transparent shadow-none ${isToolbarExpanded ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
          title={isToolbarExpanded ? 'Hide shared properties' : 'Show shared properties'}>
          {isToolbarExpanded ? <MoreVertical size={20} /> : <MoreHorizontal size={20} />}
        </button>
      </div>

      <AltSlashPopup
        isOpen={isAltSlashOpen}
        onClose={() => setIsAltSlashOpen(false)}
        isFav={isFav}
        onToggleFav={onToggleFavorite}
        pendingHotkey={pendingHotkey}
        onHotkeyChange={onHotkeyChange}
        pendingShortcut={pendingShortcut}
        onShortcutChange={onShortcutChange}
        reminderDate={reminderDate}
        reminderTime={reminderTime}
        isRecurring={isRecurring}
        recurringCycle={recurringCycle}
        onTodoScheduleChange={({ date, time, isRecurring: rec, cycle }) => {
          isUserChangeRef.current = true;
          setReminderDate(date);
          setReminderTime(time);
          setIsRecurring(rec);
          setRecurringCycle(cycle);
        }}
        workspaceId={workspaceId}
        folderId={folderId}
        folderNamesMap={folderNamesMap}
        workspaceNamesMap={workspaceNamesMap}
        onDestinationChange={(wsId, fId) => {
          isUserChangeRef.current = true;
          setWorkspaceId(wsId);
          setFolderId(fId);
        }}
        selectedTags={selectedTags}
        dbTags={dbTags}
        onTagSelect={tag => {
          isUserChangeRef.current = true;
          handleTagSelect(tag);
        }}
        onCreateTag={async name => {
          isUserChangeRef.current = true;
          if (workspaceId) {
            const newTag = await createTag(name, workspaceId);
            handleTagSelect({ id: newTag.id, name: newTag.name });
            return newTag;
          } else {
            const tempTag = { id: `temp_${name}`, name };
            handleTagSelect(tempTag);
            return tempTag;
          }
        }}
        showTodo={showTodo}
        showShortcut={
          showShortcut && !['snippet', 'snippets'].includes(String(initialSnippet?.category || '').toLowerCase())
        }
        showLocationPicker={showLocationPicker}
        showTags={true}
      />
    </>
  );
});

SharedPropertiesToolbar.displayName = 'SharedPropertiesToolbar';
