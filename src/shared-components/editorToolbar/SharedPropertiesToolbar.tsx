import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaInfo, FaStar } from 'react-icons/fa';
import { FiStar, FiTag, FiZapOff, FiEdit2, FiTrash2, FiInfo } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useFavorites } from '../favorites';
import { MoreHorizontal, MoreVertical, RotateCcwClock } from 'lucide-react';

import { HotkeyAssignButton, saveHotkey, clearHotkey } from '../hotkeys';
import { ShortcutAssignButton, saveShortcut, clearShortcut } from '../shortcuts';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { AltSlashPopup } from './AltSlashPopup';
import { DestinationPicker } from './DestinationPicker';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import InlineTimeInput from '../inputs/InlineTimeInput';
import CustomTimePicker from '../inputs/CustomTimePicker';
import {
  getItemCompoundId,
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
} from '../hotkeys/utils/hotkeyUtils';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { useTags, createTag, updateTag, deleteTag } from '../../allObjectFolder/src/createObject/tags';
import { TagSelector } from './TagSelector';
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

const getEditorDocsUrl = (entityType: string) => {
  const normalized = entityType.toLowerCase();
  if (normalized === 'note' || normalized === 'notes') return 'https://www.cmdos.app/docs/notes';
  if (normalized === 'link' || normalized === 'links') return 'https://www.cmdos.app/docs/links';
  if (normalized === 'snippet' || normalized === 'snippets' || normalized === 'text-expander') {
    return 'https://www.cmdos.app/docs/text-expander';
  }
  if (normalized === 'todo' || normalized === 'todos') return 'https://www.cmdos.app/docs';
  return 'https://www.cmdos.app/docs';
};

export const SharedPropertiesToolbar = React.forwardRef<HTMLDivElement, SharedPropertiesToolbarProps>((props, ref) => {
  const {
    initialSnippet,
    currentSnapshot: currentSnapshotProp,
    compoundId,
    defaultName,
    onChange,
    activeNoteId,
    showTodo = false,
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
    appearanceScope = 'default',
    appearanceTokens,
    propertyPersistenceAdapter,
  } = props;

  const isAltSAppearance = appearanceScope === 'alts';
  const toolbarAppearanceStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!isAltSAppearance) return appearanceTokens;
    return {
      ...appearanceTokens,
      '--color-contextMenuBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-inputBg': 'var(--alts-input-bg, var(--color-altsInputBg))',
      '--color-containerBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
      '--color-selectedBg': 'var(--alts-selected-bg, var(--color-altsSelectedBg))',
      '--color-borderDefault': 'var(--alts-border-color, var(--color-altsBorderColor))',
      '--color-borderActive': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
      '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
      '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
      '--color-textMuted': 'var(--alts-text-muted, var(--color-altsTextMuted))',
      '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
      '--color-iconDefault': 'var(--alts-icon-fg, var(--color-altsIconFg))',
      '--color-focusRing': 'var(--alts-focus-ring, var(--color-altsFocusRing))',
    } as React.CSSProperties;
  }, [appearanceTokens, isAltSAppearance]);
  const toolbarPortalClassName = isAltSAppearance ? 'shared-properties-toolbar-alts-portal z-alts-subpopup' : '';
  const toolbarPortalTarget = React.useMemo<HTMLElement | null>(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (isAltSAppearance) {
      const modalHost =
        (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
        (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
        (window as any).__ALTS_PORTAL_HOST__ ||
        (window as any).__ALTQ_PORTAL_HOST__;
      if (modalHost instanceof HTMLElement) return modalHost;
    }
    return document.body;
  }, [isAltSAppearance]);
  const { isFavorite, addFavorite, removeFavorite } =
    useFavorites();

  const saveToolbarHotkey = React.useCallback(
    async (id: string, referenceId: string, hotkey: string, type: string) => {
      if (propertyPersistenceAdapter?.saveHotkey) {
        await propertyPersistenceAdapter.saveHotkey({ id, referenceId, hotkey, type });
        return;
      }
      await saveHotkey(id, referenceId, hotkey, type as any);
    },
    [propertyPersistenceAdapter],
  );

  const clearToolbarHotkey = React.useCallback(
    async (id: string, referenceId: string, type: string) => {
      if (propertyPersistenceAdapter?.clearHotkey) {
        await propertyPersistenceAdapter.clearHotkey({ id, referenceId, type });
        return;
      }
      await clearHotkey(id, referenceId, type as any);
    },
    [propertyPersistenceAdapter],
  );

  const saveToolbarShortcut = React.useCallback(
    async (id: string, referenceId: string, shortcut: string, label: string, type: string) => {
      if (propertyPersistenceAdapter?.saveShortcut) {
        await propertyPersistenceAdapter.saveShortcut({ id, referenceId, shortcut, label, type });
        return;
      }
      await saveShortcut(id, referenceId, shortcut, label, type as any);
    },
    [propertyPersistenceAdapter],
  );

  const clearToolbarShortcut = React.useCallback(
    async (id: string, referenceId: string, type: string) => {
      if (propertyPersistenceAdapter?.clearShortcut) {
        await propertyPersistenceAdapter.clearShortcut({ id, referenceId, type });
        return;
      }
      await clearShortcut(id, referenceId, type as any);
    },
    [propertyPersistenceAdapter],
  );

  const addToolbarFavorite = React.useCallback(
    async (referenceId: string, referenceType: string, label: string) => {
      if (propertyPersistenceAdapter?.addFavorite) {
        await propertyPersistenceAdapter.addFavorite({ referenceId, referenceType, label });
        return;
      }
      await addFavorite(referenceId, referenceType, label);
    },
    [addFavorite, propertyPersistenceAdapter],
  );

  const removeToolbarFavorite = React.useCallback(
    async (referenceId: string) => {
      if (propertyPersistenceAdapter?.removeFavorite) {
        await propertyPersistenceAdapter.removeFavorite({ referenceId });
        return;
      }
      await removeFavorite(referenceId);
    },
    [propertyPersistenceAdapter, removeFavorite],
  );

  const createToolbarTag = React.useCallback(
    async (name: string, targetWorkspaceId: string) => {
      if (propertyPersistenceAdapter?.createTag) {
        return propertyPersistenceAdapter.createTag({ name, workspaceId: targetWorkspaceId });
      }
      return createTag(name, targetWorkspaceId);
    },
    [propertyPersistenceAdapter],
  );

  const updateToolbarTag = React.useCallback(
    async (tagId: string, updates: Partial<TagRecord>) => {
      if (propertyPersistenceAdapter?.updateTag) {
        await propertyPersistenceAdapter.updateTag({ tagId, updates });
        return;
      }
      await updateTag(tagId, updates);
    },
    [propertyPersistenceAdapter],
  );

  const deleteToolbarTag = React.useCallback(
    async (tagId: string) => {
      if (propertyPersistenceAdapter?.deleteTag) {
        await propertyPersistenceAdapter.deleteTag({ tagId });
        return;
      }
      await deleteTag(tagId);
    },
    [propertyPersistenceAdapter],
  );

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
  const supportsShortcutControls = resolvedEntityType !== 'session';
  const supportsTextShortcut = supportsShortcutControls && showShortcut;

  const handleOpenDocs = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const docsUrl = getEditorDocsUrl(resolvedEntityType);
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: docsUrl });
      return;
    }
    window.open(docsUrl, '_blank', 'noopener,noreferrer');
  }, [resolvedEntityType]);

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

  // --- Internally Managed State for Shared Properties ---
  const [isFav, setIsFav] = useState<boolean>(false);
  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isAltSlashOpen, setIsAltSlashOpen] = useState<boolean>(false);

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

  const allDbTags = useDbStore(state => state.tags);
  const workspaceDbTags = useTags(workspaceId || undefined) || [];
  const dbTags = React.useMemo(
    () => (resolvedEntityType === 'snippet' && workspaceId && workspaceDbTags.length === 0 ? allDbTags : workspaceDbTags),
    [allDbTags, resolvedEntityType, workspaceDbTags, workspaceId],
  );

  const handleSaveTagEdit = async (tagId: string) => {
    const trimmed = editingTagName.trim();
    setEditingTagId(null);
    if (!trimmed) return;
    try {
      await updateToolbarTag(tagId, { name: trimmed });
      setSelectedTags(prev => prev.map(t => (t.id === tagId ? { ...t, name: trimmed } : t)));
    } catch (err) {
      console.error('[SharedPropertiesToolbar] Failed to update tag:', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteToolbarTag(tagId);
      setSelectedTags(prev => prev.filter(t => t.id !== tagId));
      if (editingTagId === tagId) setEditingTagId(null);
    } catch (err) {
      console.error('[SharedPropertiesToolbar] Failed to delete tag:', err);
    }
  };

  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const workspaces = useDbStore(state => state.workspaces);
  const shouldShowLocationPicker = showLocationPicker && workspaces.length > 1;

  const workspaceNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach(w => {
      if (w.id) map[w.id] = w.workspaceName || (w as any).name || '';
    });
    return map;
  }, [workspaces]);

  // Sync isFav with IndexedDB
  useEffect(() => {
    if (compoundId && compoundId !== 'new') {
      const dbFav = isFavorite(compoundId);
      const timeSinceToggle = Date.now() - lastToggleTimeRef.current;
      if (dbFav !== isFav && timeSinceToggle < 1500) {
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
            pendingHotkey: supportsShortcutControls ? '' : undefined,
            pendingShortcut: supportsTextShortcut ? '' : undefined,
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
        if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

        if (supportsShortcutControls && pendingHotkey && isMounted) {
          try {
            await saveToolbarHotkey(snippetId || compoundId, compoundId, pendingHotkey, itemType);
          } catch (err) {
            console.error('Failed to save pending hotkey on creation:', err);
          }
        }
        if (supportsTextShortcut && pendingShortcut && isMounted) {
          try {
            const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';
            await saveToolbarShortcut(snippetId || compoundId, compoundId, pendingShortcut, itemName, itemType);
          } catch (err) {
            console.error('Failed to save pending shortcut on creation:', err);
          }
        }
        if (isFav && isMounted) {
          try {
            const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
            await addToolbarFavorite(compoundId, itemType, label);
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
      if (supportsShortcutControls) {
        const snippetIdPart = extractSnippetIdFromCompoundId(compoundId);
        const hotkey = hotkeysMap[compoundId] || (snippetIdPart !== compoundId ? hotkeysMap[snippetIdPart] : '') || '';
        const shortcut = supportsTextShortcut
          ? normalizeShortcutTrigger(
              shortcutsMap[compoundId] || (snippetIdPart !== compoundId ? shortcutsMap[snippetIdPart] : '') || '',
            )
          : '';
        setPendingHotkey(hotkey);
        setPendingShortcut(shortcut);
      } else {
        setPendingHotkey('');
        setPendingShortcut('');
      }
    }
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compoundId, hotkeysMap, shortcutsMap]);

  // Initialize state from existing object
  useEffect(() => {
    if (initialSnippet) {
      const incomingTagIds =
        initialSnippet.tagIds || (initialSnippet.tags ? initialSnippet.tags.map((t: any) => t.id) : []);
      const incomingTagIdsStr = [...incomingTagIds].sort().join(',');

      const resolvedTags =
        Array.isArray(initialSnippet.tags) && initialSnippet.tags.length > 0
          ? initialSnippet.tags.map((t: any) => {
              const found = dbTags.find(dbT => dbT.id === t.id);
              const fallbackName = t.id && t.id.startsWith('temp_') ? t.id.replace('temp_', '') : t.id;
              const name = t.name && t.name !== '...' && t.name !== t.id ? t.name : found ? found.name : t.name || fallbackName;
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
        pendingHotkey: supportsShortcutControls ? pendingHotkey : undefined,
        pendingShortcut: supportsTextShortcut ? pendingShortcut : undefined,
        selectedTags: selectedTags,
        availableTags,
        reminderDate,
        reminderTime,
        isRecurring,
        recurringCycle,
        workspaceId: workspaceId,
        folderId: folderId,
      };
      console.log('[SharedPropertiesToolbar] Bubbling up changes. Payload:', payload, 'showShortcut:', supportsTextShortcut);
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
      await removeToolbarFavorite(compoundId);
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
      await addToolbarFavorite(compoundId, type, label);
    }
  };



  const onHotkeyChange = async (hotkey: string) => {
    if (!supportsShortcutControls) return;
    isUserChangeRef.current = true;
    setPendingHotkey(hotkey);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

        if (!hotkey) await clearToolbarHotkey(snippetId || compoundId, compoundId, itemType);
        else await saveToolbarHotkey(snippetId || compoundId, compoundId, hotkey, itemType);
      } catch (err) {
        console.error('Auto-save hotkey failed', err);
      }
    }
  };

  const onShortcutChange = async (shortcut: string) => {
    if (!supportsTextShortcut) return;
    isUserChangeRef.current = true;
    const normalizedShortcut = normalizeShortcutTrigger(shortcut);
    setPendingShortcut(normalizedShortcut);
    if (compoundId && compoundId !== 'new') {
      try {
        const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
        let itemType: any = 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
        else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
        else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
        else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
          itemType = 'aiPrompt';
        else if (['todo', 'todos'].includes(cat)) itemType = 'todo';
        const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';

        if (!normalizedShortcut) await clearToolbarShortcut(snippetId || compoundId, compoundId, itemType);
        else await saveToolbarShortcut(snippetId || compoundId, compoundId, normalizedShortcut, itemName, itemType);
      } catch (err) {
        console.error('Auto-save shortcut failed', err);
      }
    }
  };

  const onHotkeyOverwrite = async (conflictId: string, hotkeyValue: string) => {
    if (!supportsShortcutControls) return;
    if (!compoundId || compoundId === 'new') return;

    try {
      const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
      let itemType: any = 'note';
      const cat = String(initialSnippet?.category || '').toLowerCase();
      if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
      else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
      else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
        itemType = 'aiPrompt';
      else if (['todo', 'todos'].includes(cat)) itemType = 'todo';

      await clearToolbarHotkey(conflictId, conflictId, itemType);
      await saveToolbarHotkey(snippetId || compoundId, compoundId, hotkeyValue, itemType);
      setPendingHotkey(hotkeyValue);
    } catch (err) {
      console.error('Failed to overwrite hotkey', err);
    }
  };

  const onShortcutOverwrite = async (conflictId: string, shortcutValue: string) => {
    if (!supportsTextShortcut) return;
    if (!compoundId || compoundId === 'new') return;

    try {
      const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
      let itemType: any = 'note';
      const cat = String(initialSnippet?.category || '').toLowerCase();
      if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat)) itemType = 'link';
      else if (['snippet', 'snippets'].includes(cat)) itemType = 'snippet';
      else if (['automation', 'automations'].includes(cat)) itemType = 'automation';
      else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
        itemType = 'aiPrompt';
      else if (['todo', 'todos'].includes(cat)) itemType = 'todo';
      const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';

      await clearToolbarShortcut(conflictId, conflictId, itemType);
      const normalizedShortcut = normalizeShortcutTrigger(shortcutValue);
      await saveToolbarShortcut(snippetId || compoundId, compoundId, normalizedShortcut, itemName, itemType);
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
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);

  useEffect(() => {
    if (!shouldShowLocationPicker && isLocationPickerOpen) {
      setIsLocationPickerOpen(false);
    }
  }, [shouldShowLocationPicker, isLocationPickerOpen]);

  useEffect(() => {
    if (
      isAltSlashOpen ||
      isTodoPopupOpen ||
      isLocationPickerOpen ||
      tagPopupOpen ||
      isVersionHistoryCategoryOpen
    ) {
      setIsToolbarExpanded(true);
    }
  }, [
    isAltSlashOpen,
    isTodoPopupOpen,
    isLocationPickerOpen,
    tagPopupOpen,
    isVersionHistoryCategoryOpen,
  ]);

  useEffect(() => {
    const handleEscapeKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
    if (!shouldShowLocationPicker) return;
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
      {isAltSAppearance && (
        <style>{`
          .shared-properties-toolbar-alts,
          .shared-properties-toolbar-alts-portal {
            color: var(--color-textPrimary);
            font-family: inherit;
          }
          .shared-properties-toolbar-alts button {
            color: var(--color-textSecondary);
          }
          .shared-properties-toolbar-alts button:hover,
          .shared-properties-toolbar-alts button[aria-expanded="true"] {
            background: var(--color-hoverBg);
            color: var(--color-textPrimary);
          }
          .shared-properties-toolbar-alts-portal {
            color: var(--color-textPrimary);
          }
          .shared-properties-toolbar-alts-portal input,
          .shared-properties-toolbar-alts-portal textarea,
          .shared-properties-toolbar-alts-portal select {
            background: var(--color-inputBg);
            color: var(--color-textPrimary);
            border-color: var(--color-borderDefault);
          }
          .shared-properties-toolbar-alts-portal input::placeholder,
          .shared-properties-toolbar-alts-portal textarea::placeholder {
            color: var(--color-textPlaceholder);
          }
          .shared-properties-toolbar-alts-portal button {
            color: var(--color-textSecondary);
          }
          .shared-properties-toolbar-alts-portal button:hover {
            color: var(--color-textPrimary);
          }
        `}</style>
      )}
      <div
        data-shared-toolbar="true"
        style={toolbarAppearanceStyle}
        className={
          layout === 'horizontal'
            ? `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex items-center gap-1.5 relative z-10 w-fit`
            : `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex flex-col items-center gap-1 relative z-10`
        }>
      {typeof document !== 'undefined' &&
        createPortal(
          <button
            type="button"
            onClick={handleOpenDocs}
            style={{ position: 'fixed', top: '14px', right: '14px', zIndex: 999999 }}
            className="w-9 h-9 p-0 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none"
            title="Open docs">
            <FaInfo size={17} />
          </button>,
          document.body,
        )}
      <div
        data-shared-toolbar="true"
        style={toolbarAppearanceStyle}
        className={
          layout === 'horizontal'
            ? `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex items-center gap-1.5 relative z-10 w-fit`
            : `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex flex-col items-center gap-1 relative z-10`
        }>
        {/* Favorites (Star) */}
        <div className="relative">
          <button
            type="button"
            onClick={e => {
              void onToggleFavorite(e);
            }}
            className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed"
            title="Favorite (Alt+/)">
            {isFav ? <FaStar size={20} className="text-yellow-500 fill-yellow-500" /> : <FiStar size={20} />}
          </button>
        </div>

        {supportsShortcutControls && (
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
              portalContainer={toolbarPortalTarget}
              appearanceScope={appearanceScope}
              appearanceTokens={toolbarAppearanceStyle}
              className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Text Command / Shortcut */}
        {supportsTextShortcut && (
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
              portalContainer={toolbarPortalTarget}
              appearanceScope={appearanceScope}
              appearanceTokens={toolbarAppearanceStyle}
              className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"
            />
          </div>
        )}

        {/* Location (Workspace) */}
        {shouldShowLocationPicker && (
          <div ref={locationPopupRef}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                handleLocationPickerToggle();
              }}
              disabled={saveStatus === 'saving'}
              className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isLocationPickerOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
              title={`${snippetBreadCrum?.workspace_name || 'Workspace'} (Alt+/)`}>
              <span className="flex h-5 w-5 items-center justify-center text-[12px] font-bold leading-none">
                W
              </span>
            </button>
            {isLocationPickerOpen &&
              locationPopupPos &&
              createPortal(
                <div
                  ref={locationPortalRef}
                  style={{
                    ...toolbarAppearanceStyle,
                    position: 'fixed',
                    left: `${locationPopupPos.x}px`,
                    top: `${locationPopupPos.y}px`,
                    zIndex: 2147483647,
                  }}
                  className={`${toolbarPortalClassName} w-[260px]`}>
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
                toolbarPortalTarget || document.body,
              )}
          </div>
        )}

        {/* Tags */}
        <div ref={popupRef}>
          <button
            type="button"
            onClick={handleTagIconClick}
            className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${tagPopupOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
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
                  ...toolbarAppearanceStyle,
                  position: 'fixed',
                  left: `${tagPopupPos.x}px`,
                  top: `${tagPopupPos.y}px`,
                  zIndex: 2147483647,
                }}
                className={`${toolbarPortalClassName} w-[280px] animate-in fade-in zoom-in-95 duration-200`}>
                <TagSelector
                  selectedTags={selectedTags}
                  dbTags={dbTags}
                  onTagSelect={handleTagSelect}
                  onRemoveTag={tagId => {
                    isUserChangeRef.current = true;
                    setSelectedTags(prev => prev.filter(t => t.id !== tagId));
                  }}
                  onCreateTag={async (name: string) => {
                    isUserChangeRef.current = true;
                    const trimmed = name.trim();
                    if (!trimmed) return;
                    const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                    if (existing) {
                      handleTagSelect(existing);
                    } else if (workspaceId) {
                      const newTagRecord = await createToolbarTag(trimmed, workspaceId);
                      handleTagSelect(newTagRecord);
                    } else {
                      handleTagSelect({
                        id: `temp_${trimmed}`,
                        name: trimmed,
                        workspaceId: '',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      });
                    }
                  }}
                  onClearTags={() => {
                    isUserChangeRef.current = true;
                    setSelectedTags([]);
                  }}
                  workspaceId={workspaceId}
                  isOpen={true}
                  appearanceScope={appearanceScope}
                  appearanceTokens={toolbarAppearanceStyle}
                  onOpenChange={open => {
                    if (!open) setTagPopupOpen(false);
                  }}
                />
              </div>,
              toolbarPortalTarget || document.body,
            )}
        </div>

        {/* Version History */}
        {showVersionHistoryButton && (
          <div ref={versionHistoryParentRef}>
            <button
              type="button"
              onClick={handleVersionHistoryToggle}
              className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${isVersionHistoryCategoryOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`}
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
                appearanceScope={appearanceScope}
                appearanceTokens={toolbarAppearanceStyle}
              />
            )}
          </div>
        )}
      </div>
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
            const newTag = await createToolbarTag(name, workspaceId);
            handleTagSelect({ id: newTag.id, name: newTag.name });
            return newTag;
          } else {
            const tempTag = { id: `temp_${name}`, name };
            handleTagSelect(tempTag);
            return tempTag;
          }
        }}
        showTodo={showTodo}
        showHotkey={supportsShortcutControls}
        showShortcut={
          supportsTextShortcut && !['snippet', 'snippets'].includes(String(initialSnippet?.category || '').toLowerCase())
        }
        showLocationPicker={shouldShowLocationPicker}
        showTags={true}
        appearanceScope={appearanceScope}
        appearanceTokens={toolbarAppearanceStyle}
      />
    </>
  );
});

SharedPropertiesToolbar.displayName = 'SharedPropertiesToolbar';
