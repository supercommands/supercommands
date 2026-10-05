import TextExpanderIcon from '../../icons/TextExpanderIcon';
import type { TagUpdateInput } from '../../../allObjectFolder/src/createObject/tags/tagTypes';
/**
 * @file EditorCommandChainPalette.tsx
 * @description Scoped command-chain property palette for editors (Note, Link, Snippet, Todo).
 * Triggered via Alt+/ inside SharedPropertiesToolbar.
 *
 * Supports:
 * - Scoped fields per entity: strictly relevant properties (title/description excluded).
 * - Instant dynamic auto-save in real time without manual apply buttons.
 * - Shift cycling between missing fields.
 * - Empty Backspace field removal.
 * - Anchored popups for TagSelector, shortcut capture, Todo schedule, and Todo references near field markers.
 * - URL input for Link.
 * - Complete design token and theme integration matching Alt+S New Tab theme.
 */
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiFileText, FiLink, FiCheckSquare, FiCalendar, FiPaperclip, FiRepeat, FiSearch, FiX, FiCheck, FiStar } from 'react-icons/fi';
import { useDbStore } from '../../../storage/store/useDbStore';
import type { TagRecord } from '../../../allObjectFolder/src/createObject/tags';
import { findCommandChainFieldMarkers, getCommandChainCursorMarker, getCommandChainFieldPopupLeft, removeCommandChainFieldAtCursor, } from '../../commandTerminal/chaining';
import { getEditorPrefixLabels, getEditorPrefixEntries, parseEditorPropertyInput, getNextEditorMissingField, formatEditorPropertiesToInput, ALLOWED_FIELDS_BY_EDITOR_ENTITY, type EditorEntityType, type EditorPropertyField, } from './editorPropertyAdapter';
import { TagSelector } from '../TagSelector';
import { NewDueDateDropdown } from '../../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import { useConvertibleItems } from '../../../allObjectFolder/src/createObject/todos/todoHooks';
import { useKeystrokeRecording } from '../../hotkeys';
import { useShortcutValidation } from '../../shortcuts';
import { UnifiedContextMenu } from '../../ui/UnifiedContextMenu';
import { useUIStore } from '../../uiStateManager';
import { buildPrefixMapFromSettings } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingRecord } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export interface EditorCommandChainPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    itemId?: string;
    entityType?: EditorEntityType | string;
    organisationId?: string | null;
    // Selected state from toolbar
    selectedTags?: TagRecord[];
    dbTags?: TagRecord[];
    pendingHotkey?: string;
    pendingShortcut?: string;
    // Link specific
    url?: string;
    onUrlChange?: (url: string) => void;
    // Todo specific
    reminderDate?: string;
    reminderTime?: string;
    isRecurring?: boolean;
    recurringCycle?: string | null;
    onTodoScheduleChange?: (schedule: {
        date: string;
        time: string;
        isRecurring: boolean;
        cycle: string | null;
    }) => void;
    references?: any[];
    onReferencesChange?: (references: any[]) => void;
    // Persistence triggers (called immediately upon change)
    onTagsChange?: (tags: TagRecord[]) => void;
    onTagSelect?: (tag: TagRecord) => void;
    onCreateTag?: (name: string) => Promise<TagRecord | null | undefined>;
    onUpdateTag?: (tagId: string, updates: TagUpdateInput) => Promise<TagRecord>;
    onRenameTag?: (tagId: string, name: string) => Promise<void>;
    onHotkeyChange?: (hotkey: string) => void;
    onHotkeyOverwrite?: (conflictId: string, hotkey: string) => Promise<void> | void;
    onShortcutChange?: (shortcut: string) => void;
    onShortcutOverwrite?: (conflictId: string, shortcut: string) => Promise<void> | void;
    onShortcutResolve?: (value: string, approval: import('../../shortcuts/core/shortcutAssignmentTypes').ShortcutAssignmentApproval) => Promise<void>;
    isFavorite?: boolean;
    onToggleFavorite?: () => Promise<void> | void;
    // Theme & Appearance
    appearanceScope?: 'default' | 'alts';
    appearanceTokens?: React.CSSProperties;
}
const RECURRING_OPTIONS = [
    { id: 'one-time', label: 'Once' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' }
];
type ReferenceCategory = 'all' | 'note' | 'snippet' | 'link' | 'tabgroup' | 'aiPrompt' | 'agent' | 'command';
const REFERENCE_CATEGORIES: Array<{
    key: ReferenceCategory;
    label: string;
}> = [
    { key: 'all', label: 'All' },
    { key: 'note', label: 'Notes' },
    { key: 'snippet', label: 'Text Expanders' },
    { key: 'link', label: 'Links' },
    { key: 'tabgroup', label: 'Tab Sessions' },
    { key: 'aiPrompt', label: 'AI Prompts' },
    { key: 'agent', label: 'Chat Agents' },
    { key: 'command', label: 'Commands' }
];
const getReferenceItemName = (item: any): string => String(item?.name || item?.title || item?.key || item?.label || item?.url || item?.id || 'Untitled item');
const getReferenceItemCategory = (item: any): ReferenceCategory => {
    const raw = String(item?.category || item?.type || '').toLowerCase();
    if (raw === 'note')
        return 'note';
    if (raw === 'snippet' || raw === 'text' || raw === 'text_expander')
        return 'snippet';
    if (raw === 'link')
        return 'link';
    if (raw === 'tabgroup' || raw === 'tab_session' || raw === 'session')
        return 'tabgroup';
    if (raw === 'aiprompt' || raw === 'ai_prompt' || raw === 'prompt')
        return 'aiPrompt';
    if (raw === 'agent' || raw === 'chat_agent')
        return 'agent';
    if (raw === 'command')
        return 'command';
    return 'note';
};
const buildTodoReferencePayload = (item: any) => ({
    id: String(item?.id || getReferenceItemName(item)),
    name: getReferenceItemName(item),
    title: getReferenceItemName(item),
    category: getReferenceItemCategory(item),
    type: getReferenceItemCategory(item),
    data: item?.data || item,
});
export const EditorCommandChainPalette: React.FC<EditorCommandChainPaletteProps> = ({ isOpen, onClose, itemId = '', entityType = 'note', organisationId = null, selectedTags = [], dbTags = [], pendingHotkey = '', pendingShortcut = '', url = '', onUrlChange, reminderDate = '', reminderTime = '', isRecurring = false, recurringCycle = null, onTodoScheduleChange, references = [], onReferencesChange, onTagsChange, onTagSelect, onCreateTag, onRenameTag, onUpdateTag, onHotkeyChange, onHotkeyOverwrite, onShortcutChange, onShortcutOverwrite, onShortcutResolve, isFavorite = false, onToggleFavorite, appearanceScope = 'default', appearanceTokens, }) => {
    const isAltSAppearance = appearanceScope === 'alts';
    const storePrefixSettings = useDbStore(state => state.prefixSettings);
    const [bgPrefixSettings, setBgPrefixSettings] = useState<PrefixSettingRecord[] | null>(null);
    const convertibleItems = useConvertibleItems() as any[];
    const resolvedEntity = useMemo<EditorEntityType>(() => {
        const raw = String(entityType || 'note').toLowerCase();
        if (raw.includes('link'))
            return 'link';
        if (raw.includes('snippet'))
            return 'snippet';
        if (raw.includes('todo'))
            return 'todo';
        return 'note';
    }, [entityType]);
    // When running in content script / website popup, query background script for records if store is empty
    useEffect(() => {
        if (!isOpen)
            return;
        if (storePrefixSettings && storePrefixSettings.length > 0)
            return;
        try {
            const chromeAny = (window as any)?.chrome;
            if (chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({ action: 'db_get_all_records' }, (res: any) => {
                    if (res?.success && Array.isArray(res?.prefixSettings)) {
                        setBgPrefixSettings(res.prefixSettings);
                    }
                });
            }
        }
        catch (_) {
            // Non-extension or test environment
        }
    }, [isOpen, storePrefixSettings]);
    const activePrefixSettings = useMemo(() => {
        if (storePrefixSettings && storePrefixSettings.length > 0)
            return storePrefixSettings;
        return bgPrefixSettings || [];
    }, [storePrefixSettings, bgPrefixSettings]);
    const commandTerminalPrefixes = useMemo(() => {
        return buildPrefixMapFromSettings(activePrefixSettings);
    }, [activePrefixSettings]);
    // Derive labels and entries for active editor entity
    const prefixOptions = useMemo(() => ({ prefixSettings: activePrefixSettings, prefixes: commandTerminalPrefixes }), [activePrefixSettings, commandTerminalPrefixes]);
    const prefixLabels = useMemo(() => getEditorPrefixLabels(resolvedEntity, prefixOptions), [resolvedEntity, prefixOptions]);
    const prefixEntries = useMemo(() => getEditorPrefixEntries(resolvedEntity, prefixOptions), [resolvedEntity, prefixOptions]);
    // Input & Cursor state
    const [inputValue, setInputValue] = useState('');
    const [cursorPos, setCursorPos] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const tagControlRef = useRef<HTMLDivElement>(null);
    const hotkeyControlRef = useRef<HTMLDivElement>(null);
    const shortcutControlRef = useRef<HTMLDivElement>(null);
    const timeControlRef = useRef<HTMLDivElement>(null);
    const recurringControlRef = useRef<HTMLDivElement>(null);
    const referenceControlRef = useRef<HTMLDivElement>(null);
    // Active popup anchored beneath the input / control
    const [activePopupField, setActivePopupField] = useState<EditorPropertyField | null>(null);
    const dismissedPopupMarkerRef = useRef<string | null>(null);
    // Track open state transitions so we only initialize text on OPEN, NEVER while user is typing
    const prevIsOpenRef = useRef(false);
    const popupFields = useMemo(() => new Set<EditorPropertyField>(['tag', 'hotkey', 'shortcut', 'time', 'recurring', 'reference']), []);
    const getPopupMarkerId = useCallback((marker: {
        field: string;
        start: number;
        prefix: string;
    }) => `${marker.field}:${marker.start}:${String(marker.prefix || '').toLowerCase()}`, []);
    const isMac = useMemo(() => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || ''), []);
    const { hotkey: hotkeyDraft, setHotkey: setHotkeyDraft, captureHotkey, resetHotkey, } = useKeystrokeRecording(pendingHotkey, isMac);
    const [shortcutDraft, setShortcutDraft] = useState(pendingShortcut);
    const [referenceQuery, setReferenceQuery] = useState('');
    const [referenceCategory, setReferenceCategory] = useState<ReferenceCategory>('all');
    const [isHotkeySaving, setIsHotkeySaving] = useState(false);
    const [isShortcutSaving, setIsShortcutSaving] = useState(false);
    const portalTarget = React.useMemo<HTMLElement>(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined')
            return null as any;
        const modalHost = (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
            (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
            (window as any).__ALTS_PORTAL_HOST__ ||
            (window as any).__ALTQ_PORTAL_HOST__;
        if (modalHost instanceof HTMLElement)
            return modalHost;
        return document.body;
    }, []);
    const appearanceStyle = React.useMemo<React.CSSProperties>(() => ({
        ...appearanceTokens,
        '--alts-popup-bg': 'var(--alts-popup-bg, #18181b)',
        '--alts-search-bg': 'var(--alts-search-bg, #1f1f23)',
        '--alts-border-color': 'var(--alts-border-color, rgba(255, 255, 255, 0.12))',
        '--alts-divider-color': 'var(--alts-divider-color, rgba(255, 255, 255, 0.08))',
        '--alts-row-hover-bg': 'var(--alts-row-hover-bg, rgba(255, 255, 255, 0.06))',
        '--alts-row-selected-bg': 'var(--alts-row-selected-bg, rgba(255, 255, 255, 0.12))',
        '--alts-focus-color': 'var(--alts-focus-color, #a855f7)',
        '--alts-focus-ring': 'var(--alts-focus-ring, #a855f7)',
        '--alts-text-primary': 'var(--alts-text-primary, #f4f4f5)',
        '--alts-text-secondary': 'var(--alts-text-secondary, #a1a1aa)',
        '--alts-text-section': 'var(--alts-text-section, #a1a1aa)',
        '--alts-text-placeholder': 'var(--alts-text-placeholder, #71717a)',
        '--alts-shortcut-border': 'var(--alts-shortcut-border, rgba(255, 255, 255, 0.15))',
        '--alts-shortcut-bg': 'var(--alts-shortcut-bg, rgba(255, 255, 255, 0.08))',
        '--alts-shortcut-text': 'var(--alts-shortcut-text, #a1a1aa)',
        '--color-contextMenuBg': 'var(--alts-popup-bg, #18181b)',
        '--color-modalBg': 'var(--alts-popup-bg, #18181b)',
        '--color-popupBg': 'var(--alts-popup-bg, #18181b)',
        '--color-inputBg': 'var(--alts-search-bg, #1f1f23)',
        '--color-hoverBg': 'var(--alts-row-hover-bg, rgba(255, 255, 255, 0.06))',
        '--color-selectedBg': 'var(--alts-row-selected-bg, rgba(255, 255, 255, 0.12))',
        '--color-borderDefault': 'var(--alts-border-color, rgba(255, 255, 255, 0.12))',
        '--color-borderActive': 'var(--alts-focus-color, #a855f7)',
        '--color-textPrimary': 'var(--alts-text-primary, #f4f4f5)',
        '--color-textSecondary': 'var(--alts-text-secondary, #a1a1aa)',
        '--color-textPlaceholder': 'var(--alts-text-placeholder, #71717a)',
    }) as React.CSSProperties, [appearanceTokens]);
    const { validateShortcut } = useShortcutValidation();
    const closeActivePopup = useCallback((options: {
        rememberDismissed?: boolean;
        focusInput?: boolean;
    } = {}) => {
        if (options.rememberDismissed && activePopupField) {
            const markers = findCommandChainFieldMarkers(inputValue, prefixEntries);
            const marker = getCommandChainCursorMarker(inputValue, markers, cursorPos);
            if (marker && marker.field === activePopupField) {
                dismissedPopupMarkerRef.current = getPopupMarkerId(marker);
            }
        }
        setActivePopupField(null);
        if (options.focusInput) {
            window.requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [activePopupField, cursorPos, getPopupMarkerId, inputValue, prefixEntries]);
    const openPopupField = useCallback((field: EditorPropertyField) => {
        dismissedPopupMarkerRef.current = null;
        setActivePopupField(field);
    }, []);
    const togglePopupField = useCallback((field: EditorPropertyField) => {
        if (activePopupField === field) {
            closeActivePopup({ rememberDismissed: true });
        }
        else {
            openPopupField(field);
        }
    }, [activePopupField, closeActivePopup, openPopupField]);
    // Intercept global Escape key so that open sub-popups close first without closing the outer editor
    useEffect(() => {
        if (!isOpen)
            return;
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement | null)?.closest('[data-tag-rename-input="true"]'))
                return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (activePopupField) {
                    closeActivePopup({ rememberDismissed: true, focusInput: true });
                }
                else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    }, [isOpen, activePopupField, closeActivePopup, onClose]);
    useEffect(() => {
        if (!isOpen)
            return;
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            if (activePopupField) {
                closeActivePopup({ rememberDismissed: true, focusInput: true });
                return true;
            }
            onClose();
            return true;
        });
        return unregister;
    }, [isOpen, activePopupField, closeActivePopup, onClose]);
    // Initialize input value ONLY when palette transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            const timeStr = reminderDate ? (reminderTime ? `${reminderDate} ${reminderTime}` : reminderDate) : '';
            const recStr = isRecurring ? (recurringCycle || 'daily') : '';
            const refStr = Array.isArray(references)
                ? (references as any[]).map(r => (typeof r === 'string' ? r : r?.name || r?.title || r?.id || '')).filter(Boolean).join(', ')
                : '';
            const initialText = formatEditorPropertiesToInput({
                entity: resolvedEntity,
                tagNames: (selectedTags as TagRecord[]).map(t => t.name),
                hotkey: pendingHotkey,
                shortcut: pendingShortcut,
                url: url || '',
                time: timeStr,
                recurring: recStr,
                reference: refStr,
                labels: prefixLabels,
            });
            setInputValue(initialText);
            setActivePopupField(null);
            dismissedPopupMarkerRef.current = null;
            window.requestAnimationFrame(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const endPos = initialText.length;
                    inputRef.current.setSelectionRange(endPos, endPos);
                    setCursorPos(endPos);
                }
            });
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, resolvedEntity, selectedTags, pendingHotkey, pendingShortcut, url, reminderDate, reminderTime, isRecurring, recurringCycle, references, prefixLabels]);
    // Parse current input values
    const parsedValues = useMemo(() => parseEditorPropertyInput(resolvedEntity, inputValue, prefixOptions), [resolvedEntity, inputValue, prefixOptions]);
    const commandTagRecords = useMemo<TagRecord[]>(() => {
        const dbTagMap = new Map(((dbTags || []) as TagRecord[]).map(tag => [tag.name.trim().toLowerCase(), tag]));
        return parsedValues.tagNames.map(name => {
            const match = dbTagMap.get(name.trim().toLowerCase());
            if (match)
                return match;
            return {
                id: `temp_${name}`,
                name,
                workspaceId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        });
    }, [dbTags, parsedValues.tagNames, organisationId]);
    const referenceTokens = useMemo(() => String(parsedValues.reference || '')
        .split(',')
        .map(token => token.trim())
        .filter(Boolean), [parsedValues.reference]);
    const selectedReferenceItems = useMemo(() => {
        const itemByToken = new Map<string, any>();
        convertibleItems.forEach(item => {
            itemByToken.set(String(item.id || '').toLowerCase(), item);
            itemByToken.set(getReferenceItemName(item).toLowerCase(), item);
        });
        const fromParsed = referenceTokens.map(token => {
            const matched = itemByToken.get(token.toLowerCase());
            return matched || { id: token, name: token, category: 'note' };
        });
        const fromProps = Array.isArray(references)
            ? (references as any[]).map(ref => {
                const id = String(ref?.id || '').toLowerCase();
                const name = getReferenceItemName(ref).toLowerCase();
                return itemByToken.get(id) || itemByToken.get(name) || ref;
            })
            : [];
        const combined = fromParsed.length > 0 ? fromParsed : fromProps;
        const seen = new Set<string>();
        return combined.filter(item => {
            const key = String(item?.id || getReferenceItemName(item)).toLowerCase();
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }, [convertibleItems, referenceTokens, references]);
    const filteredReferenceItems = useMemo(() => {
        const query = referenceQuery.trim().toLowerCase();
        return convertibleItems
            .filter(item => referenceCategory === 'all' || getReferenceItemCategory(item) === referenceCategory)
            .filter(item => {
            if (!query)
                return true;
            const name = getReferenceItemName(item).toLowerCase();
            const category = getReferenceItemCategory(item).toLowerCase();
            return name.includes(query) || category.includes(query) || String(item?.id || '').toLowerCase().includes(query);
        })
            .slice(0, 80);
    }, [convertibleItems, referenceCategory, referenceQuery]);
    const referenceCounts = useMemo(() => {
        return REFERENCE_CATEGORIES.reduce<Record<ReferenceCategory, number>>((acc, category) => {
            acc[category.key] =
                category.key === 'all'
                    ? convertibleItems.length
                    : convertibleItems.filter(item => getReferenceItemCategory(item) === category.key).length;
            return acc;
        }, {} as Record<ReferenceCategory, number>);
    }, [convertibleItems]);
    useEffect(() => {
        if (activePopupField === 'hotkey') {
            resetHotkey(parsedValues.hotkey || pendingHotkey || '');
        }
    }, [activePopupField, parsedValues.hotkey, pendingHotkey, resetHotkey]);
    useEffect(() => {
        if (activePopupField === 'shortcut') {
            setShortcutDraft(parsedValues.shortcut || pendingShortcut || '');
        }
    }, [activePopupField, parsedValues.shortcut, pendingShortcut]);
    useEffect(() => {
        if (activePopupField === 'reference') {
            setReferenceQuery('');
        }
    }, [activePopupField]);
    // Next missing field for Shift key cycling
    const nextMissingField = useMemo(() => getNextEditorMissingField(resolvedEntity, parsedValues.presentFields, prefixLabels), [resolvedEntity, parsedValues.presentFields, prefixLabels]);
    // Detect which field marker the cursor is in and update active bottom popup
    const updateCursorAndPopup = useCallback((currentInputVal: string, currentCursor: number | null) => {
        if (currentCursor === null) {
            dismissedPopupMarkerRef.current = null;
            setActivePopupField(null);
            return;
        }
        const markers = findCommandChainFieldMarkers(currentInputVal, prefixEntries);
        const marker = getCommandChainCursorMarker(currentInputVal, markers, currentCursor);
        if (marker && popupFields.has(marker.field as EditorPropertyField)) {
            const markerId = getPopupMarkerId(marker);
            if (dismissedPopupMarkerRef.current === markerId) {
                setActivePopupField(null);
                return;
            }
            setActivePopupField(marker.field as EditorPropertyField);
        }
        else {
            dismissedPopupMarkerRef.current = null;
            setActivePopupField(null);
        }
    }, [getPopupMarkerId, popupFields, prefixEntries]);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const pos = e.target.selectionStart;
        setInputValue(val);
        setCursorPos(pos);
        updateCursorAndPopup(val, pos);
    };
    const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
        const pos = (e.target as HTMLInputElement).selectionStart;
        setCursorPos(pos);
        updateCursorAndPopup(inputValue, pos);
    };
    // Replaces or appends a field value directly into the input and moves the cursor
    const updateFieldValueInInput = useCallback((field: EditorPropertyField, newValue: string, options: {
        focusInput?: boolean;
        keepPopupClosed?: boolean;
    } = {}) => {
        const prefix = prefixLabels[field];
        if (!prefix)
            return;
        const markers = findCommandChainFieldMarkers(inputValue, prefixEntries);
        const targetMarker = markers.find(m => m.field === field);
        const trimmedVal = newValue.trim();
        const newSegment = trimmedVal ? `${prefix} ${trimmedVal}` : `${prefix} `;
        let nextInput = '';
        let nextCursor = 0;
        if (targetMarker) {
            const before = inputValue.slice(0, targetMarker.start);
            const after = inputValue.slice(targetMarker.end);
            nextInput = `${before}${newSegment}${after}`;
            nextCursor = before.length + newSegment.length;
        }
        else {
            const separator = inputValue.trim().length > 0 ? ' ' : '';
            nextInput = `${inputValue.trim()}${separator}${newSegment}`;
            nextCursor = nextInput.length;
        }
        setInputValue(nextInput);
        setCursorPos(nextCursor);
        if (options.keepPopupClosed) {
            const nextMarker = findCommandChainFieldMarkers(nextInput, prefixEntries).find(marker => marker.field === field);
            if (nextMarker) {
                dismissedPopupMarkerRef.current = getPopupMarkerId(nextMarker);
            }
            setActivePopupField(null);
        }
        window.requestAnimationFrame(() => {
            if (options.focusInput !== false && inputRef.current) {
                inputRef.current.focus();
                inputRef.current.setSelectionRange(nextCursor, nextCursor);
            }
            updateCursorAndPopup(nextInput, nextCursor);
        });
    }, [getPopupMarkerId, inputValue, prefixLabels, prefixEntries, updateCursorAndPopup]);
    // Tag selection / change handler with instant persistence
    const handleTagValueChange = useCallback((tagNamesCsv: string) => {
        updateFieldValueInInput('tag', tagNamesCsv, { focusInput: false });
        // Instant dynamic save: synchronize with selectedTags
        const names = tagNamesCsv
            .split(',')
            .map(n => n.trim())
            .filter(Boolean);
        const dbTagMap = new Map(((dbTags || []) as TagRecord[]).map(t => [t.name.toLowerCase(), t]));
        const nextSelectedTags: TagRecord[] = names.map(name => {
            const match = dbTagMap.get(name.toLowerCase());
            if (match)
                return match;
            return {
                id: `temp_${name}`,
                name,
                workspaceId: null,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
        });
        if (onTagsChange) {
            onTagsChange(nextSelectedTags);
        }
        names.forEach(name => {
            const match = dbTagMap.get(name.toLowerCase());
            if (match && onTagSelect) {
                const alreadySelected = (selectedTags as TagRecord[]).some(t => t.id === match.id);
                if (!alreadySelected) {
                    onTagSelect(match);
                }
            }
        });
    }, [updateFieldValueInInput, dbTags, onTagsChange, onTagSelect, selectedTags, organisationId]);
    const writeCommandTags = useCallback((nextTags: TagRecord[]) => {
        const names = Array.from(new Map(nextTags
            .map(tag => String(tag.name || '').trim())
            .filter(Boolean)
            .map(name => [name.toLowerCase(), name])).values());
        handleTagValueChange(names.join(', '));
    }, [handleTagValueChange]);
    const toggleCommandTag = useCallback((tag: TagRecord) => {
        const normalizedName = String(tag.name || '').trim().toLowerCase();
        const exists = commandTagRecords.some(selected => String(selected.name || '').trim().toLowerCase() === normalizedName);
        writeCommandTags(exists
            ? commandTagRecords.filter(selected => String(selected.name || '').trim().toLowerCase() !== normalizedName)
            : [...commandTagRecords, tag]);
    }, [commandTagRecords, writeCommandTags]);
    const removeCommandTag = useCallback((tagId: string) => {
        writeCommandTags(commandTagRecords.filter(tag => tag.id !== tagId));
    }, [commandTagRecords, writeCommandTags]);
    const createCommandTag = useCallback(async (name: string) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        const existing = ((dbTags || []) as TagRecord[]).find(tag => tag.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            toggleCommandTag(existing);
            return;
        }
        const created = onCreateTag ? await onCreateTag(trimmed) : null;
        toggleCommandTag(created || {
            id: `temp_${trimmed}`,
            name: trimmed,
            workspaceId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }, [dbTags, onCreateTag, toggleCommandTag, organisationId]);
    // Hotkey change handler with instant persistence
    const handleHotkeyChange = useCallback((newHotkey: string) => {
        updateFieldValueInInput('hotkey', newHotkey, { focusInput: false });
        if (onHotkeyChange) {
            onHotkeyChange(newHotkey);
        }
    }, [updateFieldValueInInput, onHotkeyChange]);
    const handleHotkeyCaptureKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        if (event.key === 'Escape') {
            closeActivePopup({ rememberDismissed: true, focusInput: true });
            return;
        }
        if (event.key === 'Backspace') {
            if (hotkeyDraft) {
                setHotkeyDraft('');
                handleHotkeyChange('');
            }
            else {
                const removed = removeCommandChainFieldAtCursor({
                    source: inputValue,
                    cursor: cursorPos,
                    entries: prefixEntries,
                });
                if (removed) {
                    dismissedPopupMarkerRef.current = null;
                    setInputValue(removed.nextSource);
                    setCursorPos(removed.nextCursor);
                }
            }
            return;
        }
        const captured = captureHotkey(event);
        if (captured && captured !== 'CANCEL') {
            handleHotkeyChange(captured);
        }
    }, [captureHotkey, closeActivePopup, cursorPos, handleHotkeyChange, hotkeyDraft, inputValue, prefixEntries]);
    const saveHotkeyDraft = useCallback(async () => {
        setIsHotkeySaving(true);
        try {
            handleHotkeyChange(hotkeyDraft);
            closeActivePopup({ rememberDismissed: true, focusInput: true });
        }
        finally {
            setIsHotkeySaving(false);
        }
    }, [closeActivePopup, handleHotkeyChange, hotkeyDraft]);
    const overwriteHotkeyDraft = useCallback(async (conflictId: string) => {
        setIsHotkeySaving(true);
        try {
            await onHotkeyOverwrite?.(conflictId, hotkeyDraft);
            handleHotkeyChange(hotkeyDraft);
            closeActivePopup({ rememberDismissed: true, focusInput: true });
        }
        finally {
            setIsHotkeySaving(false);
        }
    }, [closeActivePopup, handleHotkeyChange, hotkeyDraft, onHotkeyOverwrite]);
    // Text command change handler with instant persistence
    const handleShortcutChange = useCallback((newShortcut: string) => {
        updateFieldValueInInput('shortcut', newShortcut, { focusInput: false });
        if (onShortcutChange) {
            onShortcutChange(newShortcut);
        }
    }, [updateFieldValueInInput, onShortcutChange]);
    const saveShortcutDraft = useCallback(async () => {
        setIsShortcutSaving(true);
        try {
            handleShortcutChange(shortcutDraft);
            closeActivePopup({ rememberDismissed: true, focusInput: true });
        }
        finally {
            setIsShortcutSaving(false);
        }
    }, [closeActivePopup, handleShortcutChange, shortcutDraft]);
    const overwriteShortcutDraft = useCallback(async (conflictId: string) => {
        setIsShortcutSaving(true);
        try {
            await onShortcutOverwrite?.(conflictId, shortcutDraft);
            handleShortcutChange(shortcutDraft);
            closeActivePopup({ rememberDismissed: true, focusInput: true });
        }
        finally {
            setIsShortcutSaving(false);
        }
    }, [closeActivePopup, handleShortcutChange, onShortcutOverwrite, shortcutDraft]);
    const handleFavoriteAction = useCallback(() => {
        void onToggleFavorite?.();
        onClose();
    }, [onClose, onToggleFavorite]);
    // URL change handler for Link entity
    const handleUrlChange = useCallback((newUrl: string) => {
        updateFieldValueInInput('url', newUrl, { focusInput: false });
        if (onUrlChange) {
            onUrlChange(newUrl);
        }
    }, [updateFieldValueInInput, onUrlChange]);
    // Todo DueDate change handler
    const handleDueDateSelect = useCallback(({ date, time }: {
        date: string;
        time: string | null;
        isAnytime: boolean;
    }) => {
        const timeVal = time ? `${date} ${time}` : date;
        updateFieldValueInInput('time', timeVal, { focusInput: false, keepPopupClosed: true });
        if (onTodoScheduleChange) {
            onTodoScheduleChange({
                date,
                time: time || reminderTime || '',
                isRecurring: !!isRecurring,
                cycle: recurringCycle,
            });
        }
        closeActivePopup({ rememberDismissed: true });
    }, [closeActivePopup, updateFieldValueInInput, onTodoScheduleChange, reminderTime, isRecurring, recurringCycle]);
    // Todo Recurring change handler
    const handleRecurringChange = useCallback((cycleValue: string) => {
        const isRec = cycleValue !== 'one-time';
        updateFieldValueInInput('recurring', cycleValue, { focusInput: false, keepPopupClosed: true });
        if (onTodoScheduleChange) {
            onTodoScheduleChange({
                date: reminderDate || '',
                time: reminderTime || '',
                isRecurring: isRec,
                cycle: isRec ? cycleValue : null,
            });
        }
        closeActivePopup({ rememberDismissed: true });
    }, [closeActivePopup, updateFieldValueInInput, onTodoScheduleChange, reminderDate, reminderTime]);
    const writeCommandReferences = useCallback((nextItems: any[]) => {
        const uniqueItems = Array.from(new Map(nextItems
            .filter(Boolean)
            .map(item => [String(item?.id || getReferenceItemName(item)).toLowerCase(), item])).values());
        const referenceText = uniqueItems.map(getReferenceItemName).join(', ');
        updateFieldValueInInput('reference', referenceText, { focusInput: false });
        onReferencesChange?.(uniqueItems.map(buildTodoReferencePayload));
    }, [onReferencesChange, updateFieldValueInInput]);
    const toggleReferenceItem = useCallback((item: any) => {
        const targetKey = String(item?.id || getReferenceItemName(item)).toLowerCase();
        const exists = selectedReferenceItems.some(selected => String(selected?.id || getReferenceItemName(selected)).toLowerCase() === targetKey);
        writeCommandReferences(exists
            ? selectedReferenceItems.filter(selected => String(selected?.id || getReferenceItemName(selected)).toLowerCase() !== targetKey)
            : [...selectedReferenceItems, item]);
    }, [selectedReferenceItems, writeCommandReferences]);
    // Keydown handler: Shift cycling, Backspace field removal, Escape/Enter closing
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation?.();
            if (activePopupField) {
                closeActivePopup({ rememberDismissed: true, focusInput: true });
                return;
            }
            onClose();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            void (async () => {
                // Commit all parsed values immediately on Enter
                if (parsedValues.tagNames.length > 0 && onTagsChange) {
                    const dbTagMap = new Map(((dbTags || []) as TagRecord[]).map(t => [t.name.toLowerCase(), t]));
                    const committedTags: TagRecord[] = parsedValues.tagNames.map(name => {
                        const match = dbTagMap.get(name.toLowerCase());
                        return match || {
                            id: `temp_${name}`,
                            name,
                            workspaceId: null,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        };
                    });
                    onTagsChange(committedTags);
                }
                if (parsedValues.hotkey && onHotkeyChange) {
                    onHotkeyChange(parsedValues.hotkey);
                }
                if (parsedValues.shortcut && onShortcutChange) {
                    const validation = await validateShortcut(parsedValues.shortcut, itemId || `${resolvedEntity}-editor`);
                    if (!validation.isValid) {
                        openPopupField('shortcut');
                        return;
                    }
                    onShortcutChange(parsedValues.shortcut);
                }
                if (parsedValues.url && onUrlChange) {
                    onUrlChange(parsedValues.url);
                }
                if ((parsedValues.time || parsedValues.recurring) && onTodoScheduleChange) {
                    let date = reminderDate;
                    let time = reminderTime;
                    if (parsedValues.time) {
                        const parts = parsedValues.time.split(' ');
                        if (parts[0])
                            date = parts[0];
                        if (parts[1])
                            time = parts[1];
                    }
                    const isRec = Boolean(parsedValues.recurring && parsedValues.recurring !== 'one-time');
                    const cycle = isRec ? parsedValues.recurring || 'daily' : null;
                    onTodoScheduleChange({
                        date: date || '',
                        time: time || '',
                        isRecurring: isRec,
                        cycle,
                    });
                }
                if (parsedValues.reference && onReferencesChange) {
                    const parts = parsedValues.reference
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean)
                        .map(name => ({ id: name, name }));
                    onReferencesChange(parts);
                }
                onClose();
            })();
            return;
        }
        // Shift key cycles to next missing field if alone or with empty field
        if (e.key === 'Shift' && !e.altKey && !e.ctrlKey && !e.metaKey) {
            if (nextMissingField) {
                e.preventDefault();
                const base = inputValue.trim();
                const addition = `${nextMissingField.prefix} `;
                const separator = base.length > 0 ? ' ' : '';
                const nextVal = `${base}${separator}${addition}`;
                const nextPos = nextVal.length;
                setInputValue(nextVal);
                setCursorPos(nextPos);
                window.requestAnimationFrame(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(nextPos, nextPos);
                        updateCursorAndPopup(nextVal, nextPos);
                    }
                });
            }
            return;
        }
        // Backspace: handle empty field removal at cursor
        if (e.key === 'Backspace') {
            const removed = removeCommandChainFieldAtCursor({
                source: inputValue,
                cursor: inputRef.current?.selectionStart ?? cursorPos,
                entries: prefixEntries,
            });
            if (removed) {
                e.preventDefault();
                dismissedPopupMarkerRef.current = null;
                setInputValue(removed.nextSource);
                setCursorPos(removed.nextCursor);
                window.requestAnimationFrame(() => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        inputRef.current.setSelectionRange(removed.nextCursor, removed.nextCursor);
                        updateCursorAndPopup(removed.nextSource, removed.nextCursor);
                    }
                });
            }
        }
    };
    const getFieldPopupPosition = (field: EditorPropertyField, width: number) => {
        const inputRect = inputRef.current?.getBoundingClientRect();
        const cardRect = cardRef.current?.getBoundingClientRect();
        const markerLeft = inputRect && cardRect
            ? getCommandChainFieldPopupLeft({
                input: inputRef.current,
                hostRect: cardRect,
                source: inputValue,
                sourceOffset: 0,
                field,
                entries: prefixEntries,
                width,
            })
            : null;
        if (inputRect && cardRect && markerLeft !== null) {
            return {
                x: cardRect.left + markerLeft,
                y: inputRect.bottom + 8,
            };
        }
        const fallbackEl = field === 'tag'
            ? tagControlRef.current
            : field === 'hotkey'
                ? hotkeyControlRef.current
                : field === 'shortcut'
                    ? shortcutControlRef.current
                    : field === 'time'
                        ? timeControlRef.current
                        : field === 'recurring'
                            ? recurringControlRef.current
                            : field === 'reference'
                                ? referenceControlRef.current
                                : null;
        const fallbackRect = fallbackEl?.getBoundingClientRect();
        if (fallbackRect) {
            return {
                x: fallbackRect.left,
                y: fallbackRect.bottom + 6,
            };
        }
        return {
            x: Math.max(12, window.innerWidth / 2 - width / 2),
            y: Math.max(12, window.innerHeight / 2 - 120),
        };
    };
    if (!isOpen)
        return null;
    // Build the fields for the create panel table matching the active entity type
    const allowedFields = ALLOWED_FIELDS_BY_EDITOR_ENTITY[resolvedEntity];
    const panelFields: Array<{
        key: EditorPropertyField;
        prefix: string;
        label: string;
        value: string;
        present: boolean;
    }> = [];
    allowedFields.forEach(fieldKey => {
        if (fieldKey === 'time') {
            panelFields.push({
                key: 'time',
                prefix: prefixLabels.time,
                label: 'Due Date / Time',
                value: parsedValues.time || (reminderDate ? `${reminderDate} ${reminderTime}`.trim() : ''),
                present: parsedValues.presentFields.includes('time'),
            });
        }
        else if (fieldKey === 'recurring') {
            panelFields.push({
                key: 'recurring',
                prefix: prefixLabels.recurring,
                label: 'Recurring',
                value: parsedValues.recurring || (isRecurring ? (recurringCycle || 'daily') : 'one-time'),
                present: parsedValues.presentFields.includes('recurring'),
            });
        }
        else if (fieldKey === 'reference') {
            panelFields.push({
                key: 'reference',
                prefix: prefixLabels.reference,
                label: 'References',
                value: parsedValues.reference || (Array.isArray(references) ? (references as any[]).map(r => r?.name || r?.title || r?.id || '').filter(Boolean).join(', ') : ''),
                present: parsedValues.presentFields.includes('reference'),
            });
        }
        else if (fieldKey === 'url') {
            panelFields.push({
                key: 'url',
                prefix: prefixLabels.url,
                label: 'URL',
                value: parsedValues.url || url || '',
                present: parsedValues.presentFields.includes('url'),
            });
        }
        else if (fieldKey === 'tag') {
            panelFields.push({
                key: 'tag',
                prefix: prefixLabels.tag,
                label: 'Tags',
                value: parsedValues.tagNames.join(', '),
                present: parsedValues.presentFields.includes('tag'),
            });
        }
        else if (fieldKey === 'hotkey') {
            panelFields.push({
                key: 'hotkey',
                prefix: prefixLabels.hotkey,
                label: 'Hotkey',
                value: parsedValues.hotkey || pendingHotkey || '',
                present: parsedValues.presentFields.includes('hotkey'),
            });
        }
        else if (fieldKey === 'shortcut') {
            panelFields.push({
                key: 'shortcut',
                prefix: prefixLabels.shortcut,
                label: 'Text Command',
                value: parsedValues.shortcut || pendingShortcut || '',
                present: parsedValues.presentFields.includes('shortcut'),
            });
        }
    });
    const helperControlAttribute = `data-${resolvedEntity}-helper-control` as any;
    const staticControlClassName = 'min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0 rounded-md border border-[var(--alts-border-color,rgba(255,255,255,0.12))] bg-[var(--alts-row-hover-bg,rgba(255,255,255,0.06))] px-2.5 py-1.5 text-[12px] font-medium leading-5 text-[var(--alts-text-primary,#f4f4f5)]';
    // Entity config for Header
    const entityMeta = {
        note: { icon: <FiFileText className="w-3.5 h-3.5"/>, title: 'Configure Note Properties' },
        link: { icon: <FiLink className="w-3.5 h-3.5"/>, title: 'Configure Link Properties' },
        snippet: { icon: <TextExpanderIcon className="w-3.5 h-3.5"/>, title: 'Configure Snippet Properties' },
        todo: { icon: <FiCheckSquare className="w-3.5 h-3.5"/>, title: 'Configure Todo Properties' },
    }[resolvedEntity];
    const removeEmptyPopupField = () => {
        const removed = removeCommandChainFieldAtCursor({
            source: inputValue,
            cursor: cursorPos,
            entries: prefixEntries,
        });
        if (removed) {
            dismissedPopupMarkerRef.current = null;
            setInputValue(removed.nextSource);
            setCursorPos(removed.nextCursor);
            window.requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.setSelectionRange(removed.nextCursor, removed.nextCursor);
            });
        }
    };
    const popupLayer = activePopupField
        ? (() => {
            if (activePopupField === 'tag') {
                const position = getFieldPopupPosition('tag', 360);
                return createPortal(<div {...{ [helperControlAttribute]: '' }} data-command-chain-tag-popup style={{
                        ...appearanceStyle,
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        zIndex: 2147483647,
                    }} className="w-[360px] max-w-[calc(100vw-24px)]" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
              <TagSelector selectedTags={commandTagRecords} dbTags={dbTags} onTagSelect={toggleCommandTag} onRemoveTag={removeCommandTag} onCreateTag={createCommandTag} onRenameTag={onRenameTag} onUpdateTag={onUpdateTag} onClearTags={() => writeCommandTags([])} organisationId={organisationId} placeholder="Search or create tag" isOpen onOpenChange={open => {
                        if (open)
                            openPopupField('tag');
                        else
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                    }} appearanceScope={appearanceScope} appearanceTokens={appearanceStyle} autoFocusInput onBackspaceEmpty={removeEmptyPopupField}/>
            </div>, portalTarget);
            }
            if (activePopupField === 'hotkey') {
                const position = getFieldPopupPosition('hotkey', 260);
                return (<UnifiedContextMenu x={position.x} y={position.y} onClose={() => closeActivePopup({ rememberDismissed: true, focusInput: true })} itemId={itemId || `${resolvedEntity}-editor`} portalContainer={portalTarget} appearanceScope={appearanceScope} appearanceTokens={appearanceStyle} hotkeyInput={{
                        value: hotkeyDraft,
                        onChange: handleHotkeyCaptureKeyDown,
                        onSave: () => {
                            void saveHotkeyDraft();
                        },
                        onCancel: () => {
                            resetHotkey(parsedValues.hotkey || pendingHotkey || '');
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                        },
                        onClear: () => {
                            setHotkeyDraft('');
                            handleHotkeyChange('');
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                        },
                        onOverwrite: conflictId => {
                            void overwriteHotkeyDraft(conflictId);
                        },
                        isSaving: isHotkeySaving,
                        isUpdating: Boolean(parsedValues.hotkey || pendingHotkey),
                    }}/>);
            }
            if (activePopupField === 'shortcut') {
                const position = getFieldPopupPosition('shortcut', 260);
                return (<UnifiedContextMenu x={position.x} y={position.y} onClose={() => closeActivePopup({ rememberDismissed: true, focusInput: true })} itemId={itemId || `${resolvedEntity}-editor`} portalContainer={portalTarget} appearanceScope={appearanceScope} appearanceTokens={appearanceStyle} shortcutInput={{
                        value: shortcutDraft,
                        onResolve: onShortcutResolve ? async (approval) => {
                            setIsShortcutSaving(true);
                            try {
                                await onShortcutResolve(shortcutDraft, approval);
                                handleShortcutChange(shortcutDraft);
                                closeActivePopup({ rememberDismissed: true, focusInput: true });
                            }
                            finally {
                                setIsShortcutSaving(false);
                            }
                        } : undefined,
                        onChange: setShortcutDraft,
                        onSave: () => {
                            void saveShortcutDraft();
                        },
                        onCancel: () => {
                            setShortcutDraft(parsedValues.shortcut || pendingShortcut || '');
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                        },
                        onClear: () => {
                            setShortcutDraft('');
                            handleShortcutChange('');
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                        },
                        onOverwrite: conflictId => {
                            void overwriteShortcutDraft(conflictId);
                        },
                        onBackspaceEmpty: removeEmptyPopupField,
                        isSaving: isShortcutSaving,
                        isUpdating: Boolean(parsedValues.shortcut || pendingShortcut),
                    }}/>);
            }
            if (activePopupField === 'time') {
                const position = getFieldPopupPosition('time', 320);
                return createPortal(<div {...{ [helperControlAttribute]: '' }} data-command-chain-time-popup style={{
                        ...appearanceStyle,
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        zIndex: 2147483647,
                    }} className="font-sans text-[var(--color-textPrimary,#f4f4f5)]" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
              <NewDueDateDropdown isOpen onClose={() => closeActivePopup({ rememberDismissed: true, focusInput: true })} positionClassName="relative top-0 left-0" currentDate={parsedValues.time ? parsedValues.time.split(' ')[0] : reminderDate} currentTime={parsedValues.time ? parsedValues.time.split(' ')[1] || '' : reminderTime} onSelect={handleDueDateSelect}/>
            </div>, portalTarget);
            }
            if (activePopupField === 'recurring') {
                const position = getFieldPopupPosition('recurring', 240);
                return createPortal(<div {...{ [helperControlAttribute]: '' }} data-command-chain-recurring-popup style={{
                        ...appearanceStyle,
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        zIndex: 2147483647,
                    }} className="w-[240px] rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-contextMenuBg)] p-1.5 font-sans text-[var(--color-textPrimary)] shadow-2xl" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
              {RECURRING_OPTIONS.map(option => {
                        const selected = (parsedValues.recurring || (isRecurring ? recurringCycle || 'daily' : 'one-time')) === option.id;
                        return (<button key={option.id} type="button" className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${selected
                                ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                                : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`} onClick={() => handleRecurringChange(option.id)}>
                    <FiRepeat className="h-3.5 w-3.5 shrink-0"/>
                    <span>{option.label}</span>
                  </button>);
                    })}
            </div>, portalTarget);
            }
            if (activePopupField === 'reference') {
                const position = getFieldPopupPosition('reference', 560);
                const selectedKeys = new Set(selectedReferenceItems.map(item => String(item?.id || getReferenceItemName(item)).toLowerCase()));
                return createPortal(<div {...{ [helperControlAttribute]: '' }} data-command-chain-reference-popup style={{
                        ...appearanceStyle,
                        position: 'fixed',
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        zIndex: 2147483647,
                    }} className="w-[560px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-contextMenuBg)] font-sans text-[var(--color-textPrimary)] shadow-2xl" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
              <div className="flex items-center gap-2 border-b border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2.5">
                <FiSearch className="h-3.5 w-3.5 shrink-0 text-[var(--color-textSecondary)]"/>
                <input type="text" value={referenceQuery} onChange={event => setReferenceQuery(event.target.value)} onKeyDown={event => {
                        event.stopPropagation();
                        event.nativeEvent.stopImmediatePropagation?.();
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closeActivePopup({ rememberDismissed: true, focusInput: true });
                        }
                        else if (event.key === 'Backspace' && !referenceQuery && selectedReferenceItems.length === 0) {
                            event.preventDefault();
                            removeEmptyPopupField();
                        }
                    }} autoFocus placeholder="Search saved items" className="min-w-0 flex-1 border-none bg-transparent text-[13px] font-medium text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]"/>
                {selectedReferenceItems.length > 0 ? (<span className="shrink-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-selectedBg)] px-2 py-1 text-[10px] font-semibold text-[var(--color-textSecondary)]">
                    {selectedReferenceItems.length} selected
                  </span>) : null}
                <button type="button" className="rounded-md p-1 text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" onClick={() => closeActivePopup({ rememberDismissed: true, focusInput: true })} aria-label="Close references">
                  <FiX className="h-3.5 w-3.5"/>
                </button>
              </div>

              <div className="flex h-[260px] min-h-0">
                <div className="w-[150px] shrink-0 overflow-y-auto border-r border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-1.5">
                  {REFERENCE_CATEGORIES.map(category => (<button key={category.key} type="button" className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${referenceCategory === category.key
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`} onClick={() => setReferenceCategory(category.key)}>
                      <span className="min-w-0 truncate">{category.label}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-textSecondary)]">
                        {referenceCounts[category.key] || 0}
                      </span>
                    </button>))}
                </div>

                <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
                  {filteredReferenceItems.length > 0 ? (filteredReferenceItems.map(item => {
                        const key = String(item?.id || getReferenceItemName(item)).toLowerCase();
                        const selected = selectedKeys.has(key);
                        return (<button key={`${getReferenceItemCategory(item)}-${item.id}`} type="button" className={`flex min-w-0 items-center gap-2 border-b border-[var(--color-borderDefault)] px-3 py-2 text-left transition-colors ${selected
                                ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                                : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'}`} onClick={() => toggleReferenceItem(item)}>
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] ${selected
                                ? 'border-[var(--color-borderActive)] bg-[var(--color-selectedBg)]'
                                : 'border-[var(--color-borderDefault)]'}`}>
                            {selected ? <FiCheck className="h-2.5 w-2.5"/> : null}
                          </span>
                          <FiPaperclip className="h-3.5 w-3.5 shrink-0 text-[var(--color-textSecondary)]"/>
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                            {getReferenceItemName(item)}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--color-textSecondary)]">
                            {REFERENCE_CATEGORIES.find(category => category.key === getReferenceItemCategory(item))?.label || 'Item'}
                          </span>
                        </button>);
                    })) : (<div className="flex h-full items-center justify-center text-[12px] font-medium text-[var(--color-textSecondary)]">
                      No matching items
                    </div>)}
                </div>
              </div>
            </div>, portalTarget);
            }
            return null;
        })()
        : null;
    return createPortal(<div data-editor-command-chain-palette style={appearanceStyle} className={`${isAltSAppearance ? 'z-alts-subpopup' : 'z-[100000]'} fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[var(--glass-blur,4px)] pointer-events-auto`} onClick={e => {
            e.stopPropagation();
            onClose();
        }}>
      <div ref={cardRef} onClick={e => e.stopPropagation()} className="alts-popup-root relative w-[min(760px,calc(100vw-32px))] font-['Inter',_sans-serif] text-[14px] leading-normal text-left text-[var(--alts-text-primary,#f4f4f5)] antialiased box-border m-0 p-0 rounded-2xl border border-[var(--alts-border-color,rgba(255,255,255,0.12))] bg-[var(--alts-popup-bg,#18181b)] shadow-2xl shrink-0 select-none overflow-visible backdrop-blur-xl" style={{
            boxShadow: 'var(--alts-popup-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.5))',
        }}>
        {/* Top Search Shell */}
        <div className="alts-search-shell relative flex items-center min-h-[60px] px-4 w-full bg-[var(--alts-search-bg,#1f1f23)] rounded-t-2xl border-b border-[var(--alts-divider-color,rgba(255,255,255,0.08))]">
          <div className="relative flex-1 h-full flex items-center">
            <input type="text" ref={inputRef} placeholder={`Configure properties (${prefixLabels.tag} work ${prefixLabels.hotkey} alt+1)...`} value={inputValue} onChange={handleInputChange} onSelect={handleInputSelect} onKeyDown={handleKeyDown} className="flex-1 min-w-0 bg-transparent border-none text-[18px] font-normal caret-[var(--alts-text-primary,#f4f4f5)] placeholder:text-[var(--alts-text-placeholder,#71717a)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--alts-text-primary,#f4f4f5)]"/>

            {/* Right-side Shift pill */}
            {nextMissingField ? (<div className="ml-3 hidden max-w-[300px] shrink-0 items-center gap-1.5 truncate text-right text-[11px] font-medium text-[var(--alts-shortcut-text,#a1a1aa)] sm:flex">
                <span className="rounded border border-[var(--alts-border-color,rgba(255,255,255,0.12))] bg-[var(--alts-row-hover-bg,rgba(255,255,255,0.06))] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--alts-text-primary,#f4f4f5)]">
                  Shift
                </span>
                <span className="min-w-0 truncate">
                  {nextMissingField.prefix} {nextMissingField.label}
                </span>
              </div>) : null}
          </div>
        </div>

        {/* Panel Content */}
        <div className="flex w-full flex-col px-4 pb-4 pt-3 text-[var(--alts-text-primary,#f4f4f5)]">
          {/* Header Row with category icon and shortcut pill */}
          <div className="flex min-w-0 items-center justify-between gap-3 pb-2">
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold leading-4 text-[var(--alts-text-section,#a1a1aa)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--alts-row-hover-bg,rgba(255,255,255,0.06))] text-[var(--alts-text-secondary,#a1a1aa)]">
                {entityMeta.icon}
              </span>
              <span className="min-w-0 whitespace-nowrap">{entityMeta.title}</span>
            </div>
            <span className="shrink-0 rounded border border-[var(--alts-shortcut-border,rgba(255,255,255,0.15))] bg-[var(--alts-shortcut-bg,rgba(255,255,255,0.08))] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--alts-shortcut-text,#a1a1aa)]">
              Alt + /
            </span>
          </div>

          {onToggleFavorite ? (<div className="mb-2 flex flex-col gap-1 border-b border-[var(--alts-divider-color,rgba(255,255,255,0.08))] pb-2">
              <button type="button" onClick={handleFavoriteAction} className="flex min-w-0 items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-[12px] font-semibold leading-4 text-[var(--alts-text-primary,#f4f4f5)] transition-colors hover:border-[var(--alts-border-color,rgba(255,255,255,0.12))] hover:bg-[var(--alts-row-hover-bg,rgba(255,255,255,0.06))]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--alts-row-hover-bg,rgba(255,255,255,0.06))] text-[var(--alts-text-secondary,#a1a1aa)]">
                  <FiStar className="h-3.5 w-3.5"/>
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {isFavorite ? 'Unfavorite' : 'Favorite'}
                </span>
                <span className="shrink-0 text-[11px] font-medium text-[var(--alts-text-secondary,#a1a1aa)]">
                  {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                </span>
              </button>
            </div>) : null}

          {/* Table Rows for each field */}
          <div className="mt-1 flex flex-col gap-2">
            {panelFields.map(field => (<div key={field.key} className="flex min-w-0 items-center gap-2 py-0.5">
                <div className="grid w-[148px] shrink-0 grid-cols-[40px_104px] items-center gap-1">
                  <span className="whitespace-nowrap text-[11px] font-semibold leading-4 text-[var(--color-success,#10b981)]">
                    {field.prefix}
                  </span>
                  <span className="whitespace-nowrap text-[12px] font-semibold leading-4 text-[var(--alts-text-primary,#f4f4f5)]">
                    {field.label}
                  </span>
                </div>

                {/* Field Controls according to field key */}
                {field.key === 'tag' ? (<div {...{ [helperControlAttribute]: '' }} ref={tagControlRef} className={`${staticControlClassName} w-[360px] max-w-[calc(100%-156px)] cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))]`} onClick={() => togglePopupField('tag')}>
                    <div className="min-w-0 truncate">
                      {field.value || 'Select tags'}
                    </div>
                  </div>) : field.key === 'hotkey' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <div ref={hotkeyControlRef} className={`${staticControlClassName} w-full cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))]`} onClick={() => togglePopupField('hotkey')}>
                      <div className="min-w-0 truncate">
                        {field.value || 'Press shortcut in popup'}
                      </div>
                    </div>
                  </div>) : field.key === 'shortcut' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <div ref={shortcutControlRef} className={`${staticControlClassName} w-full cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))]`} onClick={() => togglePopupField('shortcut')} data-command-chain-shortcut-trigger>
                      <div className="min-w-0 truncate">
                        {field.value || 'Type command in popup'}
                      </div>
                    </div>
                  </div>) : field.key === 'time' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <div ref={timeControlRef} className={`${staticControlClassName} w-full cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))] flex items-center justify-between`} onClick={() => togglePopupField('time')}>
                      <div className="min-w-0 truncate">
                        {field.value || 'Select date and time'}
                      </div>
                      <FiCalendar className="w-3.5 h-3.5 shrink-0 ml-1.5 text-[var(--alts-text-secondary,#a1a1aa)]"/>
                    </div>
                  </div>) : field.key === 'recurring' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <div {...{ [helperControlAttribute]: '' }} ref={recurringControlRef} className={`${staticControlClassName} w-full cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))] flex items-center justify-between`} onClick={() => togglePopupField('recurring')}>
                      <div className="min-w-0 truncate">
                        {RECURRING_OPTIONS.find(option => option.id === field.value)?.label || 'Once'}
                      </div>
                      <FiRepeat className="ml-1.5 h-3.5 w-3.5 shrink-0 text-[var(--alts-text-secondary,#a1a1aa)]"/>
                    </div>
                  </div>) : field.key === 'reference' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <div {...{ [helperControlAttribute]: '' }} ref={referenceControlRef} className={`${staticControlClassName} w-full cursor-pointer hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))] flex items-center justify-between`} onClick={() => togglePopupField('reference')}>
                      <div className="min-w-0 truncate">
                        {field.value || 'Attach saved items'}
                      </div>
                      <FiPaperclip className="ml-1.5 h-3.5 w-3.5 shrink-0 text-[var(--alts-text-secondary,#a1a1aa)]"/>
                    </div>
                  </div>) : field.key === 'url' ? (<div className="relative min-w-0 w-[360px] max-w-[calc(100%-156px)] shrink-0">
                    <input type="text" placeholder="https://example.com" value={field.value || ''} onFocus={() => closeActivePopup({ rememberDismissed: true })} onChange={e => handleUrlChange(e.target.value)} className={`${staticControlClassName} w-full outline-none hover:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))] focus:border-[var(--alts-focus-color,var(--color-focusRing,#a855f7))]`}/>
                  </div>) : null}
              </div>))}
          </div>
        </div>
      </div>
      {popupLayer}
    </div>, portalTarget);
};
