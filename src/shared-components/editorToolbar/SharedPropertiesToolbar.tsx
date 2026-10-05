import type { TagUpdateInput } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { PURE_BLACK_EDITOR_BACKGROUND } from '../editorContainer/functionalEditorSurfaceStyle';
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaInfo, FaStar } from 'react-icons/fa';
import { FiStar, FiTag, FiZapOff, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import { useFavorites } from '../favorites';
import { MoreHorizontal, MoreVertical, RotateCcwClock } from 'lucide-react';
import { HotkeyAssignButton, saveHotkey, clearHotkey } from '../hotkeys';
import { ShortcutAssignButton, saveShortcut, saveShortcutGuarded, clearShortcut } from '../shortcuts';
import { checkShortcutAssignment, normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import type { ShortcutAssignmentApproval } from '../shortcuts/core/shortcutAssignmentTypes';
import { AltSlashPopup } from './AltSlashPopup';
import { EditorCommandChainPalette } from './chaining/EditorCommandChainPalette';
import { DestinationPicker } from './DestinationPicker';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import InlineTimeInput from '../inputs/InlineTimeInput';
import CustomTimePicker from '../inputs/CustomTimePicker';
import { getItemCompoundId, readAllHotkeys, readAllShortcuts, extractSnippetIdFromCompoundId, } from '../hotkeys/utils/hotkeyUtils';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { createTag, updateTag, deleteTag } from '../../allObjectFolder/src/createObject/tags';
import { ensureLibraryWidgetForDashboardTagAsync } from '../../storage/localStorage/widgetDashboardStorage';
import { getSmartDefaultOrganisation } from '../../storage/localStorage/lastUsedOrganisation';
import { TagSelector } from './TagSelector';
import { insertTagAt, sameTagOrder } from './tagOrder';
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
        '#14b8a6'
    ];
    const nameStr = String(tagName || '');
    if (!nameStr)
        return colors[0];
    let sum = 0;
    for (let i = 0; i < nameStr.length; i++) {
        sum += nameStr.charCodeAt(i) * (i + 1);
    }
    const index = sum % colors.length;
    return colors[index];
};
import { BRAND } from '../brandingConfig';
const getEditorDocsUrl = (entityType: string) => {
    const normalized = entityType.toLowerCase();
    if (normalized === 'note' || normalized === 'notes')
        return BRAND.docs.notes;
    if (normalized === 'link' || normalized === 'links')
        return BRAND.docs.links;
    if (normalized === 'snippet' ||
        normalized === 'snippets' ||
        normalized === 'text-expander' ||
        normalized === 'text-expanders') {
        return BRAND.docs.textExpanders;
    }
    if (normalized === 'todo' || normalized === 'todos')
        return BRAND.docs.todos;
    if (normalized === 'aiprompt' ||
        normalized === 'prompt' ||
        normalized === 'prompts' ||
        normalized === 'chatagent' ||
        normalized === 'chat-agent' ||
        normalized === 'chat-agents-prompts') {
        return BRAND.docs.chatAgentsPrompts;
    }
    return BRAND.docs.root;
};
export const SharedPropertiesToolbar = React.forwardRef<HTMLDivElement, SharedPropertiesToolbarProps>((props, ref) => {
    const { initialSnippet, currentSnapshot: currentSnapshotProp, compoundId, defaultName, onChange, activeNoteId, showTodo = false, todoStatus, onCreateTodo, snippetBreadCrum, saveStatus, orgTags = [], setOrgTags, openPopupsToLeft = false, openPopupsToBottom = false, showShortcut = true, showLocationPicker = true, layout = 'vertical', showDocsButton = true, reserveTopRightChromeSpace = false, setNoteVersionIndex, selectedNoteVersionIndex, versionHistoryItems, selectedVersionId, onSelectVersion, entityType, appearanceScope = 'default', appearanceTokens, propertyPersistenceAdapter, externalTagPickerRequest, onExternalTagQueryChange, onExternalTagSelected, onExternalTagPickerClose, } = props;
    const isAltSAppearance = appearanceScope === 'alts';
    const toolbarAppearanceStyle = React.useMemo<React.CSSProperties | undefined>(() => {
        if (!isAltSAppearance)
            return appearanceTokens;
        return {
            ...appearanceTokens,
            '--color-contextMenuBg': PURE_BLACK_EDITOR_BACKGROUND,
            '--color-modalBg': PURE_BLACK_EDITOR_BACKGROUND,
            '--color-popupBg': PURE_BLACK_EDITOR_BACKGROUND,
            '--color-inputBg': PURE_BLACK_EDITOR_BACKGROUND,
            '--color-containerBg': PURE_BLACK_EDITOR_BACKGROUND,
            '--color-hoverBg': 'rgba(255, 255, 255, 0.05)',
            '--color-selectedBg': 'rgba(255, 255, 255, 0.07)',
            '--color-borderDefault': 'rgba(255, 255, 255, 0.1)',
            '--color-borderActive': 'rgba(255, 255, 255, 0.2)',
            '--color-textPrimary': '#FFFFFF',
            '--color-textSecondary': '#D4D4D4',
            '--color-textMuted': '#737373',
            '--color-textPlaceholder': '#A3A3A3',
            '--color-iconDefault': '#9CA3AF',
            '--color-focusRing': 'rgba(255, 255, 255, 0.2)',
        } as React.CSSProperties;
    }, [appearanceTokens, isAltSAppearance]);
    const toolbarPortalClassName = isAltSAppearance ? 'shared-properties-toolbar-alts-portal z-alts-subpopup' : '';
    const toolbarPortalTarget = React.useMemo<HTMLElement | null>(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return null;
        if (isAltSAppearance) {
            const modalHost = (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
                (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
                (window as any).__ALTS_PORTAL_HOST__ ||
                (window as any).__ALTQ_PORTAL_HOST__;
            if (modalHost instanceof HTMLElement)
                return modalHost;
        }
        return document.body;
    }, [isAltSAppearance]);
    const { isFavorite, addFavorite, removeFavorite } = useFavorites();
    const saveToolbarHotkey = React.useCallback(async (id: string, referenceId: string, hotkey: string, type: string) => {
        if (propertyPersistenceAdapter?.saveHotkey) {
            await propertyPersistenceAdapter.saveHotkey({ id, referenceId, hotkey, type });
            return;
        }
        await saveHotkey(id, referenceId, hotkey, type as any);
    }, [propertyPersistenceAdapter]);
    const clearToolbarHotkey = React.useCallback(async (id: string, referenceId: string, type: string) => {
        if (propertyPersistenceAdapter?.clearHotkey) {
            await propertyPersistenceAdapter.clearHotkey({ id, referenceId, type });
            return;
        }
        await clearHotkey(id, referenceId, type as any);
    }, [propertyPersistenceAdapter]);
    const pendingShortcutApproval = useRef<{
        value: string;
        approval: ShortcutAssignmentApproval;
    } | null>(null);
    const shortcutWasEditedRef = useRef(false);
    const saveToolbarShortcut = React.useCallback(async (id: string, referenceId: string, shortcut: string, label: string, type: string) => {
        if (propertyPersistenceAdapter?.saveShortcut) {
            await propertyPersistenceAdapter.saveShortcut({ id, referenceId, shortcut, label, type,
                approval: pendingShortcutApproval.current?.value === shortcut ? pendingShortcutApproval.current.approval : undefined });
            pendingShortcutApproval.current = null;
            return;
        }
        await saveShortcutGuarded(referenceId, shortcut, type as any, pendingShortcutApproval.current?.value === shortcut ? pendingShortcutApproval.current.approval : undefined);
        pendingShortcutApproval.current = null;
    }, [propertyPersistenceAdapter]);
    const clearToolbarShortcut = React.useCallback(async (id: string, referenceId: string, type: string) => {
        if (propertyPersistenceAdapter?.clearShortcut) {
            await propertyPersistenceAdapter.clearShortcut({ id, referenceId, type });
            return;
        }
        await clearShortcut(id, referenceId, type as any);
    }, [propertyPersistenceAdapter]);
    const addToolbarFavorite = React.useCallback(async (referenceId: string, referenceType: string, label: string) => {
        if (propertyPersistenceAdapter?.addFavorite) {
            await propertyPersistenceAdapter.addFavorite({ referenceId, referenceType, label });
            return;
        }
        await addFavorite(referenceId, referenceType, label);
    }, [addFavorite, propertyPersistenceAdapter]);
    const removeToolbarFavorite = React.useCallback(async (referenceId: string) => {
        if (propertyPersistenceAdapter?.removeFavorite) {
            await propertyPersistenceAdapter.removeFavorite({ referenceId });
            return;
        }
        await removeFavorite(referenceId);
    }, [propertyPersistenceAdapter, removeFavorite]);
    const createToolbarTag = React.useCallback(async (name: string) => {
        if (propertyPersistenceAdapter?.createTag) {
            return propertyPersistenceAdapter.createTag({ name, workspaceId: null });
        }
        return createTag(name);
    }, [propertyPersistenceAdapter]);
    const updateToolbarTag = React.useCallback(async (tagId: string, updates: TagUpdateInput) => {
        if (propertyPersistenceAdapter?.updateTag) {
            return propertyPersistenceAdapter.updateTag({ tagId, updates });
        }
        return updateTag(tagId, updates);
    }, [propertyPersistenceAdapter]);
    const deleteToolbarTag = React.useCallback(async (tagId: string) => {
        if (propertyPersistenceAdapter?.deleteTag) {
            await propertyPersistenceAdapter.deleteTag({ tagId });
            return;
        }
        await deleteTag(tagId);
    }, [propertyPersistenceAdapter]);
    const isSupportedEntity = React.useMemo(() => {
        if (entityType) {
            return ['note', 'todo', 'snippet', 'link', 'session'].includes(String(entityType).toLowerCase());
        }
        if (activeNoteId)
            return true;
        if (versionHistoryItems && versionHistoryItems.length > 0)
            return true;
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (['note', 'notes', 'todo', 'todos', 'snippet', 'snippets', 'link', 'links', 'tabgroup', 'session', 'sessions'].some(c => cat.includes(c))) {
            return true;
        }
        return false;
    }, [entityType, activeNoteId, versionHistoryItems, initialSnippet]);
    const showVersionHistoryButton = Boolean(compoundId &&
        compoundId !== 'new' &&
        isSupportedEntity);
    const notes = useDbStore(state => state.notes);
    const resolvedEntityType = React.useMemo(() => {
        if (entityType)
            return String(entityType).toLowerCase();
        if (activeNoteId)
            return 'note';
        const cat = String(initialSnippet?.category || '').toLowerCase();
        if (cat.includes('note'))
            return 'note';
        if (cat.includes('todo'))
            return 'todo';
        if (cat.includes('snippet'))
            return 'snippet';
        if (cat.includes('link'))
            return 'link';
        if (cat.includes('session') || cat.includes('tab'))
            return 'session';
        return 'note';
    }, [entityType, activeNoteId, initialSnippet]);
    const supportsShortcutControls = resolvedEntityType !== 'session';
    const supportsTextShortcut = supportsShortcutControls;
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
        if (Object.prototype.hasOwnProperty.call(props, 'versionHistory'))
            return props.versionHistory;
        if (activeNoteId) {
            const n = notes.find(item => item.id === activeNoteId);
            if (n?.versionHistory)
                return n.versionHistory;
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
                if (n?.body !== undefined)
                    return n.body;
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
    const [tagPopupPos, setTagPopupPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const lastToggleTimeRef = useRef(0);
    const [reminderDate, setReminderDate] = useState<string>('');
    const [reminderTime, setReminderTime] = useState<string>('');
    const [isRecurring, setIsRecurring] = useState<boolean>(false);
    const [recurringCycle, setRecurringCycle] = useState<string | null>(null);
    const [url, setUrl] = useState<string>('');
    const [references, setReferences] = useState<any[]>([]);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editingTagName, setEditingTagName] = useState<string>('');
    const allDbTags = useDbStore(state => state.tags);
    const dashboardViews = useDbStore(state => state.widgetViews);
    // Normal editors see global tags plus dashboard tags owned by the selected
    // workspace. Tags from unrelated workspaces stay out of this picker.
    const dbTags = React.useMemo(() => {
        if (!organisationId)
            return allDbTags.filter(tag => !tag.workspaceId);
        const organisationViewIds = new Set(dashboardViews
            .filter(view => view.organisationId === organisationId)
            .map(view => view.id));
        return allDbTags.filter(tag => !tag.workspaceId || organisationViewIds.has(tag.workspaceId));
    }, [allDbTags, dashboardViews, organisationId]);
    const handleSaveTagEdit = async (tagId: string) => {
        const trimmed = editingTagName.trim();
        setEditingTagId(null);
        if (!trimmed)
            return;
        try {
            await updateToolbarTag(tagId, { name: trimmed });
            setSelectedTags(prev => prev.map(t => (t.id === tagId ? { ...t, name: trimmed } : t)));
        }
        catch (err) {
            console.error('[SharedPropertiesToolbar] Failed to update tag:', err);
        }
    };
    const handleDeleteTag = async (tagId: string) => {
        try {
            await deleteToolbarTag(tagId);
            setSelectedTags(prev => prev.filter(t => t.id !== tagId));
            if (editingTagId === tagId)
                setEditingTagId(null);
        }
        catch (err) {
            console.error('[SharedPropertiesToolbar] Failed to delete tag:', err);
        }
    };
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const shortcutsMap = useDbStore(state => state.shortcutsMap);
    const organisations = useDbStore(state => state.organisations);
    const shouldShowLocationPicker = showLocationPicker && organisations.length > 1;
    const organisationNamesMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        organisations.forEach(w => {
            if (w.id)
                map[w.id] = w.organisationName || (w as any).name || '';
        });
        return map;
    }, [organisations]);
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
                const captureSelector = '[data-is-hotkey-input="true"], [data-hotkey-capture], [data-command-chain-shortcut-popup]';
                const eventPath = typeof e.composedPath === 'function' ? e.composedPath() : [];
                const isCaptureTarget = eventPath.some(target => target instanceof Element && Boolean(target.closest(captureSelector)));
                if (isCaptureTarget) {
                    return;
                }
                const activeElement = document.activeElement;
                // Handle shadow DOMs if applicable (e.g. content scripts)
                let target = activeElement;
                while (target && target.shadowRoot && target.shadowRoot.activeElement) {
                    target = target.shadowRoot.activeElement;
                }
                // Ignore if focused inside a specific hotkey assigner input
                if (target && target.closest && target.closest(captureSelector)) {
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
        organisationId: undefined as any,
        tagIdsStr: undefined as any,
        reminderDate: undefined as any,
        reminderTime: undefined as any,
        isRecurring: undefined as any,
        recurringCycle: undefined as any,
        url: undefined as any,
        references: undefined as any,
        shortcut: undefined as any,
    });
    // Reset tracking state when compoundId changes to force full re-sync
    useEffect(() => {
        const prevRawId = extractSnippetIdFromCompoundId(prevCompoundIdRef.current || '');
        const newRawId = extractSnippetIdFromCompoundId(compoundId || '');
        const wasFullyFormed = !!prevCompoundIdRef.current && prevCompoundIdRef.current !== prevRawId;
        const isMove = prevCompoundIdRef.current !== compoundId && prevRawId === newRawId && prevRawId !== '' && wasFullyFormed;
        if (!isMove) {
            prevIncomingRef.current = {
                organisationId: undefined,
                tagIdsStr: undefined,
                reminderDate: undefined,
                reminderTime: undefined,
                isRecurring: undefined,
                recurringCycle: undefined,
                url: undefined,
                references: undefined,
                shortcut: undefined,
            };
        }
        isFirstBubbleRef.current = true;
    }, [compoundId]);
    // Fetch Hotkey and Shortcut on mount or when compoundId changes
    useEffect(() => {
        if (!compoundId || compoundId === 'new') {
            const isTransitioningToNew = prevCompoundIdRef.current !== 'new' && prevCompoundIdRef.current !== '';
            if (isTransitioningToNew) {
                pendingShortcutApproval.current = null;
                setIsFav(false);
                setPendingHotkey('');
                setPendingShortcut('');
                setSelectedTags([]);
                setOrganisationId(null);
                setReminderDate('');
                setReminderTime('');
                setIsRecurring(false);
                setRecurringCycle(null);
                if (onChange) {
                    onChange({
                        isFav: false,
                        pendingHotkey: supportsShortcutControls ? '' : undefined,
                        pendingShortcut: supportsTextShortcut && resolvedEntityType !== 'todo' ? '' : undefined,
                        selectedTags: [],
                        organisationId: undefined,
                    } as any);
                }
            }
            prevCompoundIdRef.current = compoundId || 'new';
            return;
        }
        const wasUnsaved = (!prevCompoundIdRef.current || prevCompoundIdRef.current === 'new') && !!compoundId && compoundId !== 'new';
        const prevRawId = extractSnippetIdFromCompoundId(prevCompoundIdRef.current || '');
        const newRawId = extractSnippetIdFromCompoundId(compoundId || '');
        const wasFullyFormed = !!prevCompoundIdRef.current && prevCompoundIdRef.current !== prevRawId;
        const isMove = prevCompoundIdRef.current !== compoundId && prevRawId === newRawId && prevRawId !== '' && wasFullyFormed;
        if (!wasUnsaved && !isMove)
            pendingShortcutApproval.current = null;
        prevCompoundIdRef.current = compoundId;
        let isMounted = true;
        if (wasUnsaved) {
            // The item was just saved and received a valid compoundId!
            // If there are pending hotkey/shortcut/favorite entered by the user, save them now.
            const savePendingKeys = async () => {
                const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || extractSnippetIdFromCompoundId(compoundId);
                let itemType: any = 'note';
                const cat = String(initialSnippet?.category || '').toLowerCase();
                if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat))
                    itemType = 'link';
                else if (['snippet', 'snippets'].includes(cat))
                    itemType = 'snippet';
                else if (['automation', 'automations'].includes(cat))
                    itemType = 'automation';
                else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
                    itemType = 'aiPrompt';
                else if (['todo', 'todos'].includes(cat))
                    itemType = 'todo';
                if (supportsShortcutControls && pendingHotkey && isMounted) {
                    try {
                        await saveToolbarHotkey(snippetId || compoundId, compoundId, pendingHotkey, itemType);
                    }
                    catch (err) {
                        console.error('Failed to save pending hotkey on creation:', err);
                    }
                }
                if (supportsTextShortcut && pendingShortcut && isMounted) {
                    try {
                        const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';
                        await saveToolbarShortcut(snippetId || compoundId, compoundId, pendingShortcut, itemName, itemType);
                    }
                    catch (err) {
                        console.error('Failed to save pending shortcut on creation:', err);
                    }
                }
                if (isFav && isMounted) {
                    try {
                        const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
                        await addToolbarFavorite(compoundId, itemType, label);
                    }
                    catch (err) {
                        console.error('Failed to save pending favorite on creation:', err);
                    }
                }
            };
            void savePendingKeys();
        }
        else if (isMove) {
            // Do not fetch from DB because the background migration is in progress.
            // We already have the correct values in state, so we just preserve them seamlessly.
        }
        else {
            // Use reactive hotkeys from useDbStore
            if (supportsShortcutControls) {
                const snippetIdPart = extractSnippetIdFromCompoundId(compoundId);
                const hotkey = hotkeysMap[compoundId] || (snippetIdPart !== compoundId ? hotkeysMap[snippetIdPart] : '') || '';
                const rawShortcut = (currentSnapshotProp && typeof currentSnapshotProp === 'object' && (currentSnapshotProp as any).shortcut !== undefined)
                    ? (currentSnapshotProp as any).shortcut
                    : (initialSnippet?.shortcut !== undefined)
                        ? initialSnippet.shortcut
                        : (shortcutsMap[compoundId] || (snippetIdPart !== compoundId ? shortcutsMap[snippetIdPart] : '') || '');
                const shortcut = supportsTextShortcut ? normalizeShortcutTrigger(
                    resolvedEntityType === 'todo' && !rawShortcut
                        ? shortcutsMap[compoundId] || (snippetIdPart !== compoundId ? shortcutsMap[snippetIdPart] : '') || rawShortcut
                        : rawShortcut,
                ) : '';
                setPendingHotkey(hotkey);
                setPendingShortcut(shortcut);
            }
            else {
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
            const incomingTagIds = initialSnippet.tagIds || (initialSnippet.tags ? initialSnippet.tags.map((t: any) => t.id) : []);
            const incomingTagIdsStr = incomingTagIds.join(',');
            const orderedIncomingTags = Array.isArray(initialSnippet.tagIds)
                ? incomingTagIds.map((id: string) => (initialSnippet.tags || []).find((tag: any) => tag.id === id) || { id })
                : initialSnippet.tags || [];
            const resolvedTags = orderedIncomingTags.length > 0
                ? orderedIncomingTags.map((t: any) => {
                    const found = allDbTags.find(dbT => dbT.id === t.id);
                    const fallbackName = t.id && t.id.startsWith('temp_') ? t.id.replace('temp_', '') : t.id;
                    const name = found ? found.name : t.name && t.name !== '...' && t.name !== t.id ? t.name : fallbackName;
                    return found
                        ? { ...found, name }
                        : {
                            id: t.id || t.name,
                            name,
                            workspaceId: t.workspaceId ?? null,
                            createdAt: t.createdAt || Date.now(),
                            updatedAt: t.updatedAt || Date.now(),
                        };
                })
                : incomingTagIds.map((id: string) => {
                    const found = allDbTags.find(t => t.id === id);
                    return found
                        ? { ...found }
                        : {
                            id,
                            name: id.startsWith('temp_') ? id.replace('temp_', '') : id,
                            workspaceId: null,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        };
                });
            const namesChanged = selectedTags.some((tag: any) => {
                const resolved = resolvedTags.find((item: any) => item.id === tag.id);
                return resolved && (resolved.name !== tag.name || resolved.workspaceId !== tag.workspaceId || JSON.stringify(resolved.appearance) !== JSON.stringify(tag.appearance));
            });
            const hasMissingNames = selectedTags.some((t: any) => t.name === '...');
            const canResolveNow = resolvedTags.some((rt: any) => {
                const st = selectedTags.find((s: any) => s.id === rt.id);
                return st?.name === '...' && rt.name !== '...';
            });
            if (incomingTagIdsStr !== prevIncomingRef.current.tagIdsStr || namesChanged || (hasMissingNames && canResolveNow)) {
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
                }
                catch {
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
            const newCycle = initialSnippet.recurring_cycle;
            if (prevIncomingRef.current.recurringCycle !== newCycle) {
                prevIncomingRef.current.recurringCycle = newCycle;
                setRecurringCycle(newCycle);
            }
            const newWs = initialSnippet.organisationId || initialSnippet.organisation_id;
            if (prevIncomingRef.current.organisationId !== newWs) {
                prevIncomingRef.current.organisationId = newWs;
                setOrganisationId(newWs);
            }
            if (!newWs) {
                void getSmartDefaultOrganisation().then(defaultOrganisation => {
                    if (defaultOrganisation?.id)
                        setOrganisationId(defaultOrganisation.id);
                });
            }
            const initialUrl = initialSnippet.url || initialSnippet.linkUrl || '';
            if (prevIncomingRef.current.url !== initialUrl) {
                prevIncomingRef.current.url = initialUrl;
                setUrl(initialUrl);
            }
            const initialRefs = initialSnippet.references || [];
            if (prevIncomingRef.current.references !== initialRefs) {
                prevIncomingRef.current.references = initialRefs;
                setReferences(initialRefs);
            }
            const incomingShortcut = (currentSnapshotProp && typeof currentSnapshotProp === 'object' && (currentSnapshotProp as any).shortcut !== undefined)
                ? (currentSnapshotProp as any).shortcut
                : initialSnippet.shortcut;
            if (incomingShortcut !== undefined && !isUserChangeRef.current) {
                // Todo snapshots start empty while the editor restores its saved command.
                const storedTodoShortcut = resolvedEntityType === 'todo' && compoundId && !incomingShortcut
                    ? shortcutsMap[compoundId] || shortcutsMap[extractSnippetIdFromCompoundId(compoundId)]
                    : undefined;
                const norm = normalizeShortcutTrigger(storedTodoShortcut || incomingShortcut);
                if (norm !== prevIncomingRef.current.shortcut) {
                    prevIncomingRef.current.shortcut = norm;
                    setPendingShortcut(norm);
                }
            }
        }
    }, [initialSnippet, allDbTags, selectedTags, compoundId, currentSnapshotProp, shortcutsMap]);
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
            const initWs = initialSnippet?.organisationId || initialSnippet?.organisation_id;
            const payload = {
                isFav,
                pendingHotkey: supportsShortcutControls ? pendingHotkey : undefined,
                pendingShortcut: supportsTextShortcut && (resolvedEntityType !== 'todo' || shortcutWasEditedRef.current) ? pendingShortcut : undefined,
                selectedTags: selectedTags,
                availableTags,
                reminderDate,
                reminderTime,
                isRecurring,
                recurringCycle,
                organisationId: organisationId,
                url: resolvedEntityType === 'link' ? url : undefined,
                references: resolvedEntityType === 'todo' ? references : undefined,
            };
            console.log('[SharedPropertiesToolbar] Bubbling up changes. Payload:', payload, 'showShortcut:', supportsTextShortcut);
            onChange(payload as any);
            shortcutWasEditedRef.current = false;
            for (const tag of selectedTags) {
                if (tag.workspaceId) {
                    void ensureLibraryWidgetForDashboardTagAsync({
                        tagId: tag.id,
                        workspaceId: tag.workspaceId,
                        entityType: resolvedEntityType,
                    }).catch(error => console.error('[SharedPropertiesToolbar] Failed to sync dashboard library widget:', error));
                }
            }
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
        organisationId,
        url,
        references,
        showShortcut
    ]);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const path = event.composedPath();
            if (todoPopupRef.current &&
                !path.includes(todoPopupRef.current) &&
                (!todoPortalRef.current || !path.includes(todoPortalRef.current))) {
                setIsTodoPopupOpen(false);
            }
            if (locationPopupRef.current &&
                !path.includes(locationPopupRef.current) &&
                (!locationPortalRef.current || !path.includes(locationPortalRef.current))) {
                setIsLocationPickerOpen(false);
            }
            if (popupRef.current &&
                !path.includes(popupRef.current) &&
                (!tagPortalRef.current || !path.includes(tagPortalRef.current))) {
                setTagPopupOpen(false);
            }
            if (externalTagPortalRef.current && !path.includes(externalTagPortalRef.current)) {
                setExternalTagPopupOpen(false);
                setExternalTagQuery(undefined);
                onExternalTagPickerClose?.();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onExternalTagPickerClose]);
    const onToggleFavorite = async (e?: React.MouseEvent) => {
        if (e)
            e.stopPropagation();
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
        }
        else {
            setIsFav(true);
            let type = 'note';
            const catVal = String(initialSnippet?.category || '').toLowerCase();
            if (['session', 'sessions', 'tab session'].includes(catVal))
                type = 'session';
            else if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(catVal))
                type = 'link';
            else if (['snippet', 'snippets'].includes(catVal))
                type = 'snippet';
            else if (['automation', 'automations'].includes(catVal))
                type = 'automation';
            else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(catVal))
                type = 'aiPrompt';
            else if (['todo', 'todos'].includes(catVal))
                type = 'todo';
            const label = initialSnippet?.title || initialSnippet?.name || defaultName || '';
            await addToolbarFavorite(compoundId, type, label);
        }
    };
    const onHotkeyChange = async (hotkey: string) => {
        if (!supportsShortcutControls)
            return;
        isUserChangeRef.current = true;
        setPendingHotkey(hotkey);
        if (compoundId && compoundId !== 'new') {
            try {
                const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
                let itemType: any = 'note';
                const cat = String(initialSnippet?.category || '').toLowerCase();
                if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat))
                    itemType = 'link';
                else if (['snippet', 'snippets'].includes(cat))
                    itemType = 'snippet';
                else if (['automation', 'automations'].includes(cat))
                    itemType = 'automation';
                else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
                    itemType = 'aiPrompt';
                else if (['todo', 'todos'].includes(cat))
                    itemType = 'todo';
                if (!hotkey)
                    await clearToolbarHotkey(snippetId || compoundId, compoundId, itemType);
                else
                    await saveToolbarHotkey(snippetId || compoundId, compoundId, hotkey, itemType);
            }
            catch (err) {
                console.error('Auto-save hotkey failed', err);
            }
        }
    };
    const onShortcutChange = async (shortcut: string) => {
        if (!supportsTextShortcut)
            return;
        shortcutWasEditedRef.current = true;
        isUserChangeRef.current = true;
        const normalizedShortcut = normalizeShortcutTrigger(shortcut);
        if (pendingShortcutApproval.current?.value !== normalizedShortcut)
            pendingShortcutApproval.current = null;
        setPendingShortcut(normalizedShortcut);
        if (compoundId && compoundId !== 'new') {
            try {
                const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
                let itemType: any = 'note';
                const cat = String(initialSnippet?.category || '').toLowerCase();
                if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat))
                    itemType = 'link';
                else if (['snippet', 'snippets'].includes(cat))
                    itemType = 'snippet';
                else if (['automation', 'automations'].includes(cat))
                    itemType = 'automation';
                else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
                    itemType = 'aiPrompt';
                else if (['todo', 'todos'].includes(cat))
                    itemType = 'todo';
                const itemName = initialSnippet?.title || initialSnippet?.name || defaultName || 'Untitled';
                if (!normalizedShortcut)
                    await clearToolbarShortcut(snippetId || compoundId, compoundId, itemType);
                else
                    await saveToolbarShortcut(snippetId || compoundId, compoundId, normalizedShortcut, itemName, itemType);
            }
            catch (err) {
                pendingShortcutApproval.current = null;
                console.error('Auto-save shortcut failed', err);
                throw err;
            }
        }
    };
    const onHotkeyOverwrite = async (conflictId: string, hotkeyValue: string) => {
        if (!supportsShortcutControls)
            return;
        if (!compoundId || compoundId === 'new')
            return;
        try {
            const snippetId = initialSnippet?.id || initialSnippet?.snippet_id || '';
            let itemType: any = 'note';
            const cat = String(initialSnippet?.category || '').toLowerCase();
            if (initialSnippet?.urls || ['link', 'links', 'tabgroup'].includes(cat))
                itemType = 'link';
            else if (['snippet', 'snippets'].includes(cat))
                itemType = 'snippet';
            else if (['automation', 'automations'].includes(cat))
                itemType = 'automation';
            else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat))
                itemType = 'aiPrompt';
            else if (['todo', 'todos'].includes(cat))
                itemType = 'todo';
            await clearToolbarHotkey(conflictId, conflictId, itemType);
            await saveToolbarHotkey(snippetId || compoundId, compoundId, hotkeyValue, itemType);
            setPendingHotkey(hotkeyValue);
        }
        catch (err) {
            console.error('Failed to overwrite hotkey', err);
        }
    };
    const onShortcutResolve = async (value: string, approval: ShortcutAssignmentApproval) => {
        if (!supportsTextShortcut)
            throw new Error('This item does not support Text Commands.');
        const normalized = normalizeShortcutTrigger(value);
        pendingShortcutApproval.current = { value: normalized, approval };
        await onShortcutChange(normalized);
    };
    const onShortcutOverwrite = async (_conflictId: string, value: string) => {
        const check = await checkShortcutAssignment(value, compoundId);
        if (check.status === 'error')
            throw new Error(check.message);
        if (check.status === 'conflict')
            await onShortcutResolve(value, { ...check.conflict, mode: 'overwrite' });
        else
            await onShortcutChange(value);
    };
    const onTagSelect = (tag: any) => handleTagSelect(tag);
    // --- Hover & Popup State ---
    const [isTodoPopupOpen, setIsTodoPopupOpen] = useState(false);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [tagPopupOpen, setTagPopupOpen] = useState(false);
    const [externalTagPopupOpen, setExternalTagPopupOpen] = useState(false);
    const [externalTagPopupPos, setExternalTagPopupPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [externalTagQuery, setExternalTagQuery] = useState<string | undefined>(undefined);
    const [isVersionHistoryCategoryOpen, setIsVersionHistoryCategoryOpen] = useState<boolean>(false);
    const [isToolbarExpanded, setIsToolbarExpanded] = useState(true);
    useEffect(() => {
        if (!shouldShowLocationPicker && isLocationPickerOpen) {
            setIsLocationPickerOpen(false);
        }
    }, [shouldShowLocationPicker, isLocationPickerOpen]);
    useEffect(() => {
        if (isAltSlashOpen ||
            isTodoPopupOpen ||
            isLocationPickerOpen ||
            tagPopupOpen ||
            externalTagPopupOpen ||
            isVersionHistoryCategoryOpen) {
            setIsToolbarExpanded(true);
        }
    }, [
        isAltSlashOpen,
        isTodoPopupOpen,
        isLocationPickerOpen,
        tagPopupOpen,
        externalTagPopupOpen,
        isVersionHistoryCategoryOpen
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
                if (externalTagPopupOpen) {
                    setExternalTagPopupOpen(false);
                    setExternalTagQuery(undefined);
                    onExternalTagPickerClose?.();
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
        externalTagPopupOpen,
        isVersionHistoryCategoryOpen,
        isAltSlashOpen,
        isToolbarExpanded,
        onExternalTagPickerClose
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
    const externalTagPortalRef = useRef<HTMLDivElement>(null);
    const [todoPopupPos, setTodoPopupPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [locationPopupPos, setLocationPopupPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [versionHistoryCategoryPopupPos, setVersionHistoryCategoryPopupPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const lastExternalTagRequestIdRef = useRef<number | null>(null);
    useEffect(() => {
        if (!externalTagPickerRequest || externalTagPickerRequest.id === lastExternalTagRequestIdRef.current)
            return;
        lastExternalTagRequestIdRef.current = externalTagPickerRequest.id;
        setExternalTagQuery(externalTagPickerRequest.query || '');
        setExternalTagPopupPos(externalTagPickerRequest.position);
        setExternalTagPopupOpen(true);
        setIsToolbarExpanded(true);
    }, [externalTagPickerRequest]);
    useEffect(() => {
        if (tagPopupOpen && popupRef.current) {
            const rect = popupRef.current.getBoundingClientRect();
            let x = rect.left;
            let y = rect.bottom + 4;
            if (openPopupsToBottom) {
                x = Math.max(12, rect.right - 240);
                y = rect.bottom + 4;
            }
            else if (openPopupsToLeft) {
                x = rect.left - 244;
                y = rect.top;
            }
            else {
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
            }
            else if (openPopupsToLeft) {
                x = rect.left - 244;
                y = rect.top;
            }
            else {
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
            }
            else if (openPopupsToLeft) {
                x = rect.left - 264;
                y = rect.top;
            }
            else {
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
            }
            else if (openPopupsToLeft) {
                x = rect.left - 264;
                y = rect.top;
            }
            else {
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
        if (!shouldShowLocationPicker)
            return;
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
                }
                catch (e) {
                    deadlineVal = new Date(reminderDate).toISOString();
                }
            }
            onCreateTodo(deadlineVal, isRecurring, recurringCycle || 'daily');
            setIsTodoPopupOpen(false);
        }
    };
    const handleOrganisationDestination = (wsId: string) => {
        isUserChangeRef.current = true;
        setOrganisationId(wsId);
    };
    const handleTagSelect = (tag: any) => {
        isUserChangeRef.current = true;
        setSelectedTags(prev => {
            const exists = prev.find(t => t.id === tag.id);
            const nextTags = exists ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
            return nextTags;
        });
    };
    const handleInsertTag = (tag: TagRecord, gapIndex: number) => {
        setSelectedTags(previous => {
            const next = insertTagAt(previous, tag, gapIndex);
            if (sameTagOrder(previous.map(item => item.id), next.map(item => item.id)))
                return previous;
            isUserChangeRef.current = true;
            return next;
        });
    };
    const handleCreateTagAt = async (name: string, gapIndex: number) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        const existing = dbTags.find(tag => tag.name.trim().toLowerCase() === trimmed.toLowerCase());
        const created = existing || await createToolbarTag(trimmed);
        const tag = dbTags.find(candidate => candidate.id === created.id) || {
            ...created,
            name: created.name || trimmed,
            workspaceId: created.workspaceId ?? null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        handleInsertTag(tag, gapIndex);
    };
    const handleExternalTagSelect = (tag: TagRecord) => {
        const exists = selectedTags.some(t => t.id === tag.id);
        if (!exists)
            onExternalTagSelected?.(tag);
        handleTagSelect(tag);
        setExternalTagPopupOpen(false);
        setExternalTagQuery(undefined);
        onExternalTagPickerClose?.();
    };
    return (<>
      {isAltSAppearance && (<style>{`
          .shared-properties-toolbar-alts,
          .shared-properties-toolbar-alts-portal {
            color: var(--color-textPrimary);
            font-family: inherit;
          }
          .shared-properties-toolbar-alts-portal {
            --color-contextMenuBg: ${PURE_BLACK_EDITOR_BACKGROUND} !important;
            --color-modalBg: ${PURE_BLACK_EDITOR_BACKGROUND} !important;
            --color-popupBg: ${PURE_BLACK_EDITOR_BACKGROUND} !important;
            --color-inputBg: ${PURE_BLACK_EDITOR_BACKGROUND} !important;
            --color-containerBg: ${PURE_BLACK_EDITOR_BACKGROUND} !important;
            --color-hoverBg: rgba(255, 255, 255, 0.05) !important;
            --color-selectedBg: rgba(255, 255, 255, 0.07) !important;
            --color-borderDefault: rgba(255, 255, 255, 0.1) !important;
            --color-borderActive: rgba(255, 255, 255, 0.2) !important;
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
        `}</style>)}
      {showDocsButton &&
            typeof document !== 'undefined' &&
            createPortal(<button type="button" onClick={handleOpenDocs} style={{ position: 'fixed', top: '14px', right: '14px', zIndex: 999999 }} className="w-9 h-9 p-0 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none" title="Open docs">
            <FaInfo size={17}/>
          </button>, document.body)}
      <div data-shared-toolbar="true" style={toolbarAppearanceStyle} className={layout === 'horizontal'
            ? `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex items-center gap-1 relative z-10 w-fit ${reserveTopRightChromeSpace ? 'mr-24' : ''}`
            : `${isAltSAppearance ? 'shared-properties-toolbar-alts ' : ''}flex flex-col items-center gap-1 relative z-10`}>
        {/* Favorites (Star) */}
        <div className="relative">
          <button type="button" onClick={e => {
            void onToggleFavorite(e);
        }} className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed" title="Favorite (Alt+/)">
            {isFav ? <FaStar size={20} className="text-yellow-500 fill-yellow-500"/> : <FiStar size={20}/>}
          </button>
        </div>

        {supportsShortcutControls && (<div className="relative">
            <HotkeyAssignButton ref={hotkeyButtonRef} itemId={compoundId} currentHotkey={pendingHotkey} onHotkeyChange={onHotkeyChange} isFavorite={isFav} onToggleFavorite={onToggleFavorite} showFavorite={false} isFavLoading={false} isHotkeyLoading={false} sidebarMode={true} openToLeft={openPopupsToLeft} openToBottom={openPopupsToBottom} onOverwriteHotkey={onHotkeyOverwrite} title="Hotkey (Alt+/)" portalContainer={toolbarPortalTarget} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle} className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"/>
          </div>)}

        {/* Text Command / Shortcut */}
        {supportsTextShortcut && showShortcut && (<div className="relative">
            <ShortcutAssignButton ref={shortcutButtonRef} itemId={compoundId} currentShortcut={pendingShortcut} onShortcutChange={(shortcut: string) => {
                if (onShortcutChange)
                    onShortcutChange(shortcut);
            }} onOverwriteShortcut={onShortcutOverwrite} onResolveShortcut={onShortcutResolve} defaultName={defaultName} isShortcutLoading={false} sidebarMode={true} openToLeft={openPopupsToLeft} openToBottom={openPopupsToBottom} title="Shortcut (Alt+/)" portalContainer={toolbarPortalTarget} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle} className="w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"/>
          </div>)}

        {/* Location (Workspace) */}
        {shouldShowLocationPicker && (<div ref={locationPopupRef}>
            <button type="button" onClick={e => {
                e.stopPropagation();
                handleLocationPickerToggle();
            }} disabled={saveStatus === 'saving'} className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${isLocationPickerOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`} title={`${snippetBreadCrum?.organisation_name || 'Organisation'} (Alt+/)`}>
              <span className="flex h-5 w-5 items-center justify-center text-[12px] font-bold leading-none">
                W
              </span>
            </button>
            {isLocationPickerOpen &&
                locationPopupPos &&
                createPortal(<div ref={locationPortalRef} style={{
                        ...toolbarAppearanceStyle,
                        position: 'fixed',
                        left: `${locationPopupPos.x}px`,
                        top: `${locationPopupPos.y}px`,
                        zIndex: 2147483647,
                    }} className={`${toolbarPortalClassName} w-[260px]`}>
                  <DestinationPicker selectedOrganisationId={organisationId} onSelectOrganisation={handleOrganisationDestination} onClear={() => {
                        isUserChangeRef.current = true;
                        setOrganisationId(null);
                    }} onClose={() => setIsLocationPickerOpen(false)}/>
                </div>, toolbarPortalTarget || document.body)}
          </div>)}

        {/* Tags */}
        <div ref={popupRef}>
          <button type="button" onClick={handleTagIconClick} className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${tagPopupOpen ? 'bg-black/5 dark:bg-white/5 text-neutral-200' : ''}`} title={`${selectedTags.length > 0 ? selectedTags.map(t => t.name).join(', ') : 'Tags'} (Alt+/)`}>
            <FiTag size={20}/>
            {selectedTags.length > 0 && (<span className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#141414]">
                {selectedTags.length}
              </span>)}
          </button>
          {tagPopupOpen &&
            tagPopupPos &&
            createPortal(<div ref={tagPortalRef} style={{
                    ...toolbarAppearanceStyle,
                    position: 'fixed',
                    left: `${tagPopupPos.x}px`,
                    top: `${tagPopupPos.y}px`,
                    zIndex: 2147483647,
                }} className={`${toolbarPortalClassName} w-[280px] animate-in fade-in zoom-in-95 duration-200`}>
                <TagSelector selectedTags={selectedTags} dbTags={dbTags} onTagSelect={handleTagSelect} onInsertTag={handleInsertTag} onCreateTagAt={handleCreateTagAt} onUpdateTag={async (tagId, updates) => {
                    const saved = await updateToolbarTag(tagId, updates);
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? saved : tag));
                    return saved;
                }} onRenameTag={async (tagId, name) => {
                    await updateToolbarTag(tagId, { name });
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? { ...tag, name } : tag));
                }} onRemoveTag={tagId => {
                    isUserChangeRef.current = true;
                    setSelectedTags(prev => prev.filter(t => t.id !== tagId));
                }} onCreateTag={async (name: string) => {
                    isUserChangeRef.current = true;
                    const trimmed = name.trim();
                    if (!trimmed)
                        return;
                    const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                    if (existing) {
                        handleTagSelect(existing);
                    }
                    else {
                        const newTagRecord = await createToolbarTag(trimmed);
                        handleTagSelect(newTagRecord);
                    }
                }} onClearTags={() => {
                    isUserChangeRef.current = true;
                    setSelectedTags([]);
                }} organisationId={organisationId} isOpen={true} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle} forceEditorBlack={true} onOpenChange={open => {
                    if (!open) {
                        setTagPopupOpen(false);
                    }
                }}/>
              </div>, toolbarPortalTarget || document.body)}
          {externalTagPopupOpen &&
            externalTagPopupPos &&
            createPortal(<div ref={externalTagPortalRef} style={{
                    ...toolbarAppearanceStyle,
                    position: 'fixed',
                    left: `${externalTagPopupPos.x}px`,
                    top: `${externalTagPopupPos.y}px`,
                    zIndex: 2147483647,
                }} className={`${toolbarPortalClassName} w-[280px] animate-in fade-in zoom-in-95 duration-200`}>
                <TagSelector selectedTags={selectedTags} dbTags={dbTags} onTagSelect={handleExternalTagSelect} onUpdateTag={async (tagId, updates) => {
                    const saved = await updateToolbarTag(tagId, updates);
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? saved : tag));
                    return saved;
                }} onRenameTag={async (tagId, name) => {
                    await updateToolbarTag(tagId, { name });
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? { ...tag, name } : tag));
                }} onRemoveTag={tagId => {
                    isUserChangeRef.current = true;
                    setSelectedTags(prev => prev.filter(t => t.id !== tagId));
                }} onCreateTag={async (name: string) => {
                    isUserChangeRef.current = true;
                    const trimmed = name.trim();
                    if (!trimmed)
                        return;
                    const existing = dbTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
                    if (existing) {
                        handleExternalTagSelect(existing);
                    }
                    else {
                        const newTagRecord = await createToolbarTag(trimmed);
                        handleExternalTagSelect(newTagRecord);
                    }
                }} onClearTags={() => {
                    isUserChangeRef.current = true;
                    setSelectedTags([]);
                }} organisationId={organisationId} isOpen={true} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle} forceEditorBlack={true} autoFocusInput={true} initialQuery={externalTagQuery} onQueryChange={query => {
                    setExternalTagQuery(query);
                    onExternalTagQueryChange?.(query);
                }} onOpenChange={open => {
                    if (!open) {
                        setExternalTagPopupOpen(false);
                        setExternalTagQuery(undefined);
                        onExternalTagPickerClose?.();
                    }
                }}/>
              </div>, toolbarPortalTarget || document.body)}
        </div>

        {/* Version History */}
        {showVersionHistoryButton && (<div ref={versionHistoryParentRef}>
            <button type="button" onClick={handleVersionHistoryToggle} className={`w-9 h-9 p-0 shrink-0 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-200 transition-all flex items-center justify-center cursor-pointer relative disabled:opacity-30 disabled:cursor-not-allowed ${isVersionHistoryCategoryOpen ? 'bg-black/5 dark:bg-white/5 text-purple-500 dark:text-purple-400' : ''}`} title="Version History (Alt+h)">
              <RotateCcwClock size={20}/>
            </button>

            {isVersionHistoryCategoryOpen && (<VersionHistoryComparisonModal isOpen={isVersionHistoryCategoryOpen} onClose={() => setIsVersionHistoryCategoryOpen(false)} entityType={resolvedEntityType} entityId={compoundId} entityTitle={defaultName || initialSnippet?.title || initialSnippet?.name || 'Untitled'} currentSnapshot={resolvedCurrentSnapshot} versionHistory={resolvedVersionHistory} triggerRef={versionHistoryParentRef} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle}/>)}
          </div>)}
      </div>

      {['note', 'link', 'snippet', 'todo'].includes(resolvedEntityType) ? (<EditorCommandChainPalette isOpen={isAltSlashOpen} onClose={() => setIsAltSlashOpen(false)} itemId={compoundId} entityType={resolvedEntityType as any} organisationId={organisationId} selectedTags={selectedTags} dbTags={dbTags} pendingHotkey={pendingHotkey} pendingShortcut={pendingShortcut} url={url || initialSnippet?.url || initialSnippet?.linkUrl || ''} onUrlChange={nextUrl => {
                isUserChangeRef.current = true;
                setUrl(nextUrl);
            }} reminderDate={reminderDate} reminderTime={reminderTime} isRecurring={isRecurring} recurringCycle={recurringCycle} onTodoScheduleChange={({ date, time, isRecurring: rec, cycle }) => {
                isUserChangeRef.current = true;
                setReminderDate(date);
                setReminderTime(time);
                setIsRecurring(rec);
                setRecurringCycle(cycle);
            }} references={references.length > 0 ? references : initialSnippet?.references || []} onReferencesChange={nextRefs => {
                isUserChangeRef.current = true;
                setReferences(nextRefs);
            }} onTagsChange={tags => {
                isUserChangeRef.current = true;
                setSelectedTags(tags);
            }} onTagSelect={tag => {
                isUserChangeRef.current = true;
                handleTagSelect(tag);
            }} onCreateTag={async (name) => {
                isUserChangeRef.current = true;
                const newTag = await createToolbarTag(name);
                handleTagSelect(newTag);
                return newTag;
            }} onUpdateTag={async (tagId, updates) => {
                    const saved = await updateToolbarTag(tagId, updates);
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? saved : tag));
                    return saved;
                }} onRenameTag={async (tagId, name) => {
                await updateToolbarTag(tagId, { name });
                setSelectedTags(previous => previous.map(tag => tag.id === tagId ? { ...tag, name } : tag));
            }} onHotkeyChange={hotkey => {
                isUserChangeRef.current = true;
                onHotkeyChange(hotkey);
            }} onHotkeyOverwrite={onHotkeyOverwrite} onShortcutChange={shortcut => {
                isUserChangeRef.current = true;
                onShortcutChange(shortcut);
            }} onShortcutOverwrite={onShortcutOverwrite} onShortcutResolve={onShortcutResolve} isFavorite={isFav} onToggleFavorite={() => {
                void onToggleFavorite();
            }} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle}/>) : (<AltSlashPopup isOpen={isAltSlashOpen} onClose={() => setIsAltSlashOpen(false)} isFav={isFav} onToggleFav={onToggleFavorite} pendingHotkey={pendingHotkey} onHotkeyChange={onHotkeyChange} pendingShortcut={pendingShortcut} onShortcutChange={onShortcutChange} reminderDate={reminderDate} reminderTime={reminderTime} isRecurring={isRecurring} recurringCycle={recurringCycle} onTodoScheduleChange={({ date, time, isRecurring: rec, cycle }) => {
                isUserChangeRef.current = true;
                setReminderDate(date);
                setReminderTime(time);
                setIsRecurring(rec);
                setRecurringCycle(cycle);
            }} organisationId={organisationId} organisationNamesMap={organisationNamesMap} onDestinationChange={(wsId) => {
                isUserChangeRef.current = true;
                setOrganisationId(wsId);
            }} selectedTags={selectedTags} dbTags={dbTags} onTagSelect={tag => {
                isUserChangeRef.current = true;
                handleTagSelect(tag);
            }} onCreateTag={async (name) => {
                isUserChangeRef.current = true;
                const newTag = await createToolbarTag(name);
                handleTagSelect(newTag);
                return newTag;
            }} onUpdateTag={async (tagId, updates) => {
                    const saved = await updateToolbarTag(tagId, updates);
                    setSelectedTags(previous => previous.map(tag => tag.id === tagId ? saved : tag));
                    return saved;
                }} onRenameTag={async (tagId, name) => {
                await updateToolbarTag(tagId, { name });
                setSelectedTags(previous => previous.map(tag => tag.id === tagId ? { ...tag, name } : tag));
            }} showTodo={showTodo} showHotkey={supportsShortcutControls} showShortcut={supportsTextShortcut && !['snippet', 'snippets'].includes(String(initialSnippet?.category || '').toLowerCase())} showLocationPicker={shouldShowLocationPicker} showTags={true} appearanceScope={appearanceScope} appearanceTokens={toolbarAppearanceStyle}/>)}
    </>);
});
SharedPropertiesToolbar.displayName = 'SharedPropertiesToolbar';
