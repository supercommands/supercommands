import type { TagUpdateInput } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { TagEditPopover } from './TagEditPopover';
import { TagAppearance } from './TagAppearance';
import { getTheme } from '../../../packages/ui/lib/theme/registry';

const tagEditorTheme = getTheme('reflect-new-tab').tokens;
const tagEditorStyle = {
    ...Object.fromEntries(Object.entries(tagEditorTheme).map(([key, value]) => [`--color-${key}`, value])),
    '--color-popupBg': tagEditorTheme.rootBg,
    '--color-inputBg': tagEditorTheme.rootBg,
    backgroundColor: tagEditorTheme.rootBg,
    borderColor: tagEditorTheme.borderActive,
} as React.CSSProperties;
/**
 * @file TagSelector.tsx
 * @description Integrated tag input and dropdown selector matching reference design.
 * Provides chip-based selected tag rendering, case-insensitive search, inline caret input,
 * keyboard navigation, and explicit tag creation.
 */
import * as React from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FiGrid, FiChevronDown, FiX, FiPlus, FiCheck, FiTrash2, FiSearch, FiEdit2 } from 'react-icons/fi';
import { deleteTag, renameTag, updateTag, type TagRecord } from '../../allObjectFolder/src/createObject/tags';
import { useDbStore } from '../../storage/store/useDbStore';
import { useUIStore } from '../uiStateManager';
export interface TagSelectorProps {
    /** Currently selected tags for the object */
    selectedTags: TagRecord[];
    /** Available database tags */
    dbTags: TagRecord[];
    /** Callback when a tag is selected or toggled */
    onTagSelect: (tag: TagRecord) => void;
    /** Insert or move a tag at a gap in the selected tag path. */
    onInsertTag?: (tag: TagRecord, gapIndex: number) => void;
    /** Create and insert a tag at a selected gap. */
    onCreateTagAt?: (name: string, gapIndex: number) => Promise<void> | void;
    /** Callback to remove a specific tag by ID */
    onRemoveTag?: (tagId: string) => void;
    /** Callback to create a new tag */
    onCreateTag?: (name: string) => Promise<any> | void;
    /** Callback to delete a tag permanently */
    onDeleteTag?: (tagId: string) => Promise<any> | void;
    /** Rename an existing tag through the caller's persistence layer. */
    onUpdateTag?: (tagId: string, updates: TagUpdateInput) => Promise<TagRecord>;
    onRenameTag?: (tagId: string, name: string) => Promise<void>;
    /** Callback to clear all selected tags from the object */
    onClearTags?: () => void;
    /** Workspace ID if available */
    organisationId?: string | null;
    /** Placeholder text when empty */
    placeholder?: string;
    /** Controlled open state */
    isOpen?: boolean;
    /** Controlled open state callback */
    onOpenChange?: (open: boolean) => void;
    /** Additional container CSS classes */
    className?: string;
    /** Optional visual scope used by portal-hosted editor surfaces such as Alt+S. */
    appearanceScope?: 'default' | 'alts';
    appearanceTokens?: React.CSSProperties;
    /** Forces the editor-black tag dropdown surface for shared editor toolbars. */
    forceEditorBlack?: boolean;
    /** Focuses the tag query input when a controlled command popup opens. */
    autoFocusInput?: boolean;
    /** Optional query to preload when an external trigger opens the selector. */
    initialQuery?: string;
    /** Mirrors query changes to an external trigger surface, such as a title hashtag draft. */
    onQueryChange?: (query: string) => void;
    /** Called when Backspace is pressed with no query and no selected tags. */
    onBackspaceEmpty?: () => void;
}
export const TagSelector: React.FC<TagSelectorProps> = ({ selectedTags = [], dbTags = [], onTagSelect, onInsertTag, onCreateTagAt, onRemoveTag, onCreateTag, onDeleteTag, onRenameTag, onUpdateTag, onClearTags, organisationId = null, placeholder = 'Search or create tag', isOpen: externalIsOpen, onOpenChange, className = '', appearanceScope = 'default', appearanceTokens, forceEditorBlack = false, autoFocusInput = false, initialQuery, onQueryChange, onBackspaceEmpty, }) => {
    const isAltSAppearance = appearanceScope === 'alts';
    const shouldUseEditorBlack = forceEditorBlack || isAltSAppearance;
    const appearanceStyle = React.useMemo<React.CSSProperties | undefined>(() => {
        if (!shouldUseEditorBlack)
            return appearanceTokens;
        return {
            ...appearanceTokens,
            '--color-contextMenuBg': 'var(--alts-glass-popup-bg, #0E0F10)',
            '--color-modalBg': 'var(--alts-glass-popup-bg, #0E0F10)',
            '--color-popupBg': 'var(--alts-glass-popup-bg, #0E0F10)',
            '--color-inputBg': 'var(--alts-glass-search-bg, #0E0F10)',
            '--color-hoverBg': 'var(--alts-row-hover-bg, rgba(255, 255, 255, 0.05))',
            '--color-selectedBg': 'var(--alts-row-selected-bg, rgba(255, 255, 255, 0.07))',
            '--color-borderDefault': 'var(--alts-border-color, rgba(255, 255, 255, 0.1))',
            '--color-borderActive': 'var(--alts-focus-color, rgba(255, 255, 255, 0.2))',
            '--color-textPrimary': 'var(--alts-text-primary, #FFFFFF)',
            '--color-textSecondary': 'var(--alts-text-secondary, #D4D4D4)',
            '--color-textMuted': 'var(--alts-text-section, #737373)',
            '--color-textPlaceholder': 'var(--alts-text-placeholder, #A3A3A3)',
        } as React.CSSProperties;
    }, [appearanceTokens, shouldUseEditorBlack]);
    const handleDeleteTag = async (e: React.MouseEvent, tag: TagRecord) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            if (onDeleteTag) {
                await onDeleteTag(tag.id);
            }
            else {
                if (tag.id && !tag.id.startsWith('temp_'))
                    await deleteTag(tag.id);
            }
            if (onRemoveTag) {
                onRemoveTag(tag.id);
            }
        }
        catch (err) {
            console.error('[TagSelector] Failed to delete tag:', err);
        }
    };
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const editorBlackFieldStyle = shouldUseEditorBlack
        ? {
            backgroundColor: 'var(--color-inputBg)',
            borderColor: isOpen ? 'var(--color-borderActive)' : 'var(--color-borderDefault)',
        }
        : undefined;
    const editorBlackDropdownStyle = shouldUseEditorBlack
        ? {
            backgroundColor: 'var(--color-popupBg)',
            borderColor: 'var(--color-borderActive)',
        }
        : undefined;
    const editorBlackSelectedStyle = shouldUseEditorBlack
        ? { backgroundColor: 'var(--color-selectedBg)', borderColor: 'var(--color-borderDefault)' }
        : undefined;
    const editorBlackActiveStyle = shouldUseEditorBlack
        ? { backgroundColor: 'var(--color-hoverBg)' }
        : undefined;
    const setIsOpen = useCallback((open: boolean) => {
        if (externalIsOpen === undefined) {
            setInternalIsOpen(open);
        }
        onOpenChange?.(open);
    }, [externalIsOpen, onOpenChange]);
    const [query, setQuery] = useState('');
    const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [appearanceEditingTag, setAppearanceEditingTag] = useState<TagRecord | null>(null);
    const [savedTagEdits, setSavedTagEdits] = useState<Record<string, Partial<TagRecord>>>({});
    const closeAppearanceEditor = useCallback(() => { setAppearanceEditingTag(null); window.setTimeout(() => inputRef.current?.focus(), 0); }, []);
    const [editingTag, setEditingTag] = useState<TagRecord | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [renameError, setRenameError] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const renamePendingRef = useRef(false);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const [renamedNames, setRenamedNames] = useState<Record<string, string>>({});
    const cancelRename = () => {
        if (renamePendingRef.current)
            return;
        setEditingTag(null);
        setRenameError('');
        inputRef.current?.focus();
    };
    const saveRename = async () => {
        if (!editingTag || renamePendingRef.current)
            return;
        const tag = editingTag;
        const name = renameDraft.trim();
        if (!name) {
            setRenameError('Tag name cannot be empty');
            return;
        }
        if (dbTags.some(candidate => candidate.id !== tag.id &&
            (candidate.workspaceId) === (tag.workspaceId) &&
            (renamedNames[candidate.id] || candidate.name).trim().toLowerCase() === name.toLowerCase())) {
            setRenameError('A tag with this name already exists in this scope');
            return;
        }
        if (name === (renamedNames[tag.id] || tag.name)) {
            cancelRename();
            return;
        }
        renamePendingRef.current = true;
        setIsRenaming(true);
        setRenameError('');
        try {
            if (onRenameTag)
                await onRenameTag(tag.id, name);
            else
                await renameTag(tag.id, name);
            setRenamedNames(previous => ({ ...previous, [tag.id]: name }));
            setEditingTag(null);
            inputRef.current?.focus();
        }
        catch (error) {
            setRenameError(error instanceof Error ? error.message : 'Unable to rename tag. Please try again.');
        }
        finally {
            renamePendingRef.current = false;
            setIsRenaming(false);
        }
    };
    useEffect(() => {
        if (!isOpen) {
            setAppearanceEditingTag(null);
            setEditingTag(null);
            setRenameError('');
            setInsertionIndex(null);
        }
    }, [isOpen]);
    useEffect(() => {
        if (editingTag) {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }
    }, [editingTag?.id]);
    useEffect(() => {
        if (!editingTag)
            return;
        return useUIStore.getState().registerEscapeInterceptor(() => {
            if (!renamePendingRef.current) {
                setEditingTag(null);
                setRenameError('');
                inputRef.current?.focus();
            }
            return true;
        });
    }, [editingTag?.id]);
    useEffect(() => {
        if (editingTag && !isRenaming)
            renameInputRef.current?.focus();
    }, [isRenaming, editingTag?.id]);
    useEffect(() => {
        setRenamedNames(previous => Object.fromEntries(Object.entries(previous).filter(([id, name]) => {
            const tag = dbTags.find(candidate => candidate.id === id);
            return tag && tag.name !== name;
        })));
        setSavedTagEdits(previous => Object.fromEntries(Object.entries(previous).filter(([id, patch]) => {
            const current = dbTags.find(tag => tag.id === id);
            return current && (current.name !== patch.name || JSON.stringify(current.appearance) !== JSON.stringify(patch.appearance));
        })));
    }, [dbTags]);
    const setQueryValue = useCallback((nextQuery: string) => {
        setQuery(nextQuery);
        onQueryChange?.(nextQuery);
    }, [onQueryChange]);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [editPlacement, setEditPlacement] = useState<React.CSSProperties>({});
    React.useLayoutEffect(() => {
        if (!appearanceEditingTag) { setEditPlacement({}); return; }
        const position = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const margin = 16; // Existing popup viewport gutter (spacing-4).
            const below = Math.max(0, window.innerHeight - rect.bottom - margin);
            const above = Math.max(0, rect.top - margin);
            setEditPlacement(above > below
                ? { top: 'auto', bottom: '100%', maxHeight: above, overflowY: 'auto' }
                : { maxHeight: below, overflowY: 'auto' });
        };
        position();
        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
        return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
    }, [appearanceEditingTag?.id]);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isCreatingRef = useRef(false);
    const dashboardViews = useDbStore(state => state.widgetViews);
    const organisations = useDbStore(state => state.organisations);
    // Normalize only exact scope duplicates. Global and dashboard tags may share names.
    const uniqueDbTags = useMemo(() => {
        const map = new Map<string, TagRecord>();
        (dbTags || []).forEach(t => {
            if (!t || !t.name)
                return;
            const key = `${(renamedNames[t.id] || t.name).trim().toLowerCase()}::${t.workspaceId || 'global'}`;
            if (!map.has(key))
                map.set(key, { ...t, ...(renamedNames[t.id] ? { name: renamedNames[t.id] } : {}), ...savedTagEdits[t.id] });
        });
        return Array.from(map.values());
    }, [dbTags, renamedNames, savedTagEdits]);
    const trimmedQuery = query.trim().toLowerCase();
    // Filter existing tags case-insensitively
    const filteredTags = useMemo(() => {
        if (!trimmedQuery)
            return uniqueDbTags;
        return uniqueDbTags.filter(t => t.name.toLowerCase().includes(trimmedQuery));
    }, [uniqueDbTags, trimmedQuery]);
    const getTagContext = useCallback((tag: TagRecord) => {
        if (!tag.workspaceId)
            return { group: 'global', organisation: '', view: '' };
        const view = dashboardViews.find(candidate => candidate.id === tag.workspaceId);
        const organisation = view ? organisations.find(candidate => candidate.id === view.organisationId) : null;
        return {
            group: 'dashboard',
            organisation: organisation?.organisationName || 'Organisation',
            view: view?.title || 'Dashboard View',
        };
    }, [dashboardViews, organisations]);
    const orderedFilteredTags = useMemo(() => {
        return [...filteredTags].sort((left, right) => {
            const leftGlobal = left.workspaceId ? 1 : 0;
            const rightGlobal = right.workspaceId ? 1 : 0;
            if (leftGlobal !== rightGlobal)
                return leftGlobal - rightGlobal;
            const leftContext = getTagContext(left);
            const rightContext = getTagContext(right);
            return (leftContext.organisation.localeCompare(rightContext.organisation) ||
                leftContext.view.localeCompare(rightContext.view) ||
                left.name.localeCompare(right.name));
        });
    }, [filteredTags, getTagContext]);
    const groupedFilteredTags = useMemo(() => {
        return [
            {
                key: 'default',
                label: 'TAGS',
                tags: orderedFilteredTags.filter(tag => !tag.workspaceId),
            },
            {
                key: 'workspace',
                label: 'WORKSPACE TAGS',
                tags: orderedFilteredTags.filter(tag => Boolean(tag.workspaceId)),
            }
        ].filter(section => section.tags.length > 0);
    }, [orderedFilteredTags]);
    // Check exact case-insensitive match
    const exactMatch = useMemo(() => {
        if (!trimmedQuery)
            return null;
        return uniqueDbTags.find(t => t.name.trim().toLowerCase() === trimmedQuery);
    }, [uniqueDbTags, trimmedQuery]);
    const canCreate = Boolean(trimmedQuery && !exactMatch);
    const totalSelectableItems = orderedFilteredTags.length + (canCreate ? 1 : 0);
    // Reset activeIndex when query or options change
    useEffect(() => {
        setActiveIndex(0);
    }, [query, orderedFilteredTags.length, canCreate]);
    // Scroll active keyboard item into view
    useEffect(() => {
        if (isOpen && itemRefs.current[activeIndex]) {
            itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);
    useEffect(() => {
        if (!isOpen || !autoFocusInput)
            return;
        const frameId = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
        return () => window.cancelAnimationFrame(frameId);
    }, [autoFocusInput, isOpen]);
    React.useLayoutEffect(() => {
        if (isOpen && onInsertTag)
            inputRef.current?.focus();
    }, [insertionIndex, isOpen, selectedTags.length]);
    useEffect(() => {
        if (!isOpen || initialQuery === undefined)
            return;
        setQuery(initialQuery);
    }, [initialQuery, isOpen]);
    // Click outside to close dropdown
    useEffect(() => {
        const handlePointerDownOutside = (e: PointerEvent) => {
            if (!isOpen)
                return;
            const target = e.target as Node;
            if (containerRef.current &&
                !containerRef.current.contains(target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('pointerdown', handlePointerDownOutside);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDownOutside);
        };
    }, [isOpen, setIsOpen]);
    const handleRemoveTagChip = (e: React.MouseEvent, tag: TagRecord) => {
        e.stopPropagation();
        e.preventDefault();
        if (onRemoveTag) {
            onRemoveTag(tag.id);
        }
        else {
            onTagSelect(tag);
        }
        inputRef.current?.focus();
    };
    const handleSelectOption = async (tag: TagRecord) => {
        if (insertionIndex !== null && onInsertTag) {
            onInsertTag(tag, insertionIndex);
            setInsertionIndex(null);
        }
        else {
            onTagSelect(tag);
        }
        setQuery('');
        setActiveIndex(0);
        inputRef.current?.focus();
    };
    const handleCreateOption = async () => {
        if (!trimmedQuery || isCreatingRef.current)
            return;
        isCreatingRef.current = true;
        try {
            const rawName = query.trim();
            if (insertionIndex !== null && onCreateTagAt) {
                await onCreateTagAt(rawName, insertionIndex);
                setInsertionIndex(null);
            }
            else if (onCreateTag) {
                await onCreateTag(rawName);
            }
            else {
                const newTag: TagRecord = {
                    id: `temp_${rawName}`,
                    name: rawName,
                    workspaceId: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                onTagSelect(newTag);
            }
            setQuery('');
            setActiveIndex(0);
        }
        finally {
            isCreatingRef.current = false;
            inputRef.current?.focus();
        }
    };
    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                return;
            }
            if (totalSelectableItems > 0) {
                setActiveIndex(prev => (prev + 1) % totalSelectableItems);
            }
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                return;
            }
            if (totalSelectableItems > 0) {
                setActiveIndex(prev => (prev - 1 + totalSelectableItems) % totalSelectableItems);
            }
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (!isOpen) {
                setIsOpen(true);
                return;
            }
            if (canCreate && activeIndex === orderedFilteredTags.length) {
                await handleCreateOption();
            }
            else if (orderedFilteredTags[activeIndex]) {
                await handleSelectOption(orderedFilteredTags[activeIndex]);
            }
            else if (exactMatch) {
                await handleSelectOption(exactMatch);
            }
            else if (canCreate) {
                await handleCreateOption();
            }
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation?.();
            setIsOpen(false);
        }
        else if (e.key === 'Backspace' && query === '') {
            if (insertionIndex !== null) {
                e.preventDefault();
                setInsertionIndex(null);
            }
            else if (selectedTags.length > 0) {
                const lastTag = selectedTags[selectedTags.length - 1];
                if (onRemoveTag) {
                    onRemoveTag(lastTag.id);
                }
                else {
                    onTagSelect(lastTag);
                }
            }
            else if (onBackspaceEmpty) {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation?.();
                onBackspaceEmpty();
            }
        }
    };
    const activeInsertionIndex = insertionIndex === null ? selectedTags.length : Math.min(insertionIndex, selectedTags.length);
    const renderInputAt = (index: number) => {
        const isAtEnd = index === selectedTags.length;
        return <div className={isAtEnd ? 'flex flex-1 min-w-[80px] items-center' : 'flex min-w-6 max-w-full shrink-0 items-center'}>
          <input ref={inputRef} type="text" size={isAtEnd ? undefined : Math.max(1, query.length + 1)} value={query} placeholder={selectedTags.length === 0 ? placeholder : ''} aria-label={index === 0 && selectedTags.length > 0 ? `Insert tag before ${selectedTags[0].name}` : isAtEnd ? 'Search or add a tag' : `Insert tag between ${selectedTags[index - 1].name} and ${selectedTags[index].name}`} onChange={e => {
            setQueryValue(e.target.value);
            if (!isOpen)
                setIsOpen(true);
        }} onFocus={() => {
            if (!isOpen)
                setIsOpen(true);
        }} onKeyDown={handleKeyDown} className={`${isAtEnd ? 'w-full' : 'min-w-6 max-w-full'} bg-transparent text-xs text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none border-none p-0`}/>
        </div>;
    };
    const renderInsertionGap = (index: number) => {
        if (activeInsertionIndex === index)
            return renderInputAt(index);
        const label = index === 0 ? `Insert tag before ${selectedTags[0].name}` : index === selectedTags.length ? `Insert tag after ${selectedTags[index - 1].name}` : `Insert tag between ${selectedTags[index - 1].name} and ${selectedTags[index].name}`;
        return <button type="button" aria-label={label} title={label} onPointerDown={event => event.preventDefault()} onClick={event => {
            event.stopPropagation();
            setInsertionIndex(index);
            setIsOpen(true);
        }} className="h-8 w-3 shrink-0 cursor-text rounded bg-transparent hover:bg-[var(--color-hoverBg)] focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"/>;
    };
    return (<div ref={containerRef} style={appearanceStyle} className={`${shouldUseEditorBlack ? 'tag-selector-editor-black ' : ''}relative w-full text-left ${className}`}>
      {shouldUseEditorBlack && (<style>{`
          .tag-selector-editor-black {
            --color-contextMenuBg: var(--alts-glass-popup-bg, #0E0F10) !important;
            --color-modalBg: var(--alts-glass-popup-bg, #0E0F10) !important;
            --color-popupBg: var(--alts-glass-popup-bg, #0E0F10) !important;
            --color-inputBg: var(--alts-glass-search-bg, #0E0F10) !important;
            --color-hoverBg: var(--alts-row-hover-bg, rgba(255, 255, 255, 0.05)) !important;
            --color-selectedBg: var(--alts-row-selected-bg, rgba(255, 255, 255, 0.07)) !important;
            --color-borderDefault: var(--alts-border-color, rgba(255, 255, 255, 0.1)) !important;
            --color-borderActive: var(--alts-focus-color, rgba(255, 255, 255, 0.2)) !important;
            --color-textPrimary: var(--alts-text-primary, #FFFFFF) !important;
            --color-textSecondary: var(--alts-text-secondary, #D4D4D4) !important;
            --color-textMuted: var(--alts-text-section, #737373) !important;
            --color-textPlaceholder: var(--alts-text-placeholder, #A3A3A3) !important;
          }
          .tag-selector-editor-black,
          .tag-selector-editor-black * {
            box-sizing: border-box;
          }
          .tag-selector-editor-black [data-tag-selector-field="true"],
          .tag-selector-editor-black [data-tag-selector-dropdown="true"] {
            background: var(--color-inputBg) !important;
          }
          .tag-selector-editor-black [data-tag-selector-chip="true"],
          .tag-selector-editor-black [data-tag-selector-option-selected="true"] {
            background: var(--color-selectedBg) !important;
          }
          .tag-selector-editor-black [data-tag-selector-option-active="true"] {
            background: var(--color-hoverBg) !important;
          }
          .tag-selector-editor-black input {
            background: transparent !important;
            color: var(--color-textPrimary) !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .tag-selector-editor-black input::placeholder {
            color: var(--color-textPlaceholder) !important;
          }
          .tag-selector-editor-black button {
            appearance: none;
            color: inherit;
          }
        `}</style>)}
      {/* Closed/Collapsed & Expanded Input Field Container */}
      <div onClick={() => {
            if (!isOpen)
                setIsOpen(true);
            inputRef.current?.focus();
        }} className={`group relative z-[51] flex items-center flex-wrap gap-1.5 min-h-[38px] px-3 py-1.5 border cursor-text transition-colors duration-150 ${isOpen
            ? 'rounded-t-xl rounded-b-none border-[var(--color-borderActive)] bg-[var(--color-popupBg)]'
            : 'rounded-xl border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] hover:border-[var(--color-borderActive)]'}`} style={editorBlackFieldStyle} data-tag-selector-field="true" aria-expanded={isOpen} aria-haspopup="listbox" role="combobox" aria-label="Tags">
        {/* Left Search Icon when no tags selected */}
        {selectedTags.length === 0 && (<FiSearch className="text-[var(--color-textMuted)] flex-shrink-0 mr-0.5" size={15}/>)}

        {/* Selected Tag Chips */}
        {selectedTags.map((tag, index) => (<React.Fragment key={tag.id}>
          {onInsertTag && renderInsertionGap(index)}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] text-xs font-medium border border-[var(--color-borderDefault)] select-none transition-colors" style={editorBlackSelectedStyle} data-tag-selector-chip="true">
            {tag.workspaceId && !tag.appearance ? (<FiGrid className="shrink-0 text-[var(--color-textMuted)]" size={11} aria-hidden="true"/>) : <TagAppearance tag={{ ...tag, ...dbTags.find(candidate => candidate.id === tag.id), ...savedTagEdits[tag.id] }}/> }
            <span className="truncate max-w-[120px]">{savedTagEdits[tag.id]?.name || renamedNames[tag.id] || dbTags.find(candidate => candidate.id === tag.id)?.name || tag.name}</span>
            <button type="button" aria-label={`Remove tag "${tag.name}"`} onClick={e => handleRemoveTagChip(e, tag)} className="text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] rounded p-0.5 focus:outline-none transition-colors">
              <FiX size={11}/>
            </button>
          </span>
        </React.Fragment>))}
        {onInsertTag && selectedTags.length > 0 && renderInsertionGap(selectedTags.length)}

        {/* Inline Caret / Search Input */}
        {(!onInsertTag || selectedTags.length === 0) && renderInputAt(selectedTags.length)}

        {/* Right Dropdown Chevron Icon */}
        <button type="button" aria-label="Toggle tag dropdown" onClick={e => {
            e.stopPropagation();
            setIsOpen(!isOpen);
        }} className="text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] flex-shrink-0 ml-auto p-0.5 transition-transform duration-200 focus:outline-none">
          <FiChevronDown size={16} className="transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
        </button>
      </div>

      {/* Open Anchored Dropdown Popover */}
      {isOpen && (<div ref={dropdownRef} className={`absolute left-0 right-0 top-full z-50 flex flex-col overflow-hidden ${appearanceEditingTag ? 'rounded-xl border' : 'rounded-t-none rounded-b-xl border border-t-0'} border-[var(--color-borderActive)] bg-[var(--color-popupBg)] shadow-2xl animate-in fade-in duration-150`} style={{ ...editorBlackDropdownStyle, ...(appearanceEditingTag ? { ...tagEditorStyle, ...editPlacement } : {}) }} data-tag-selector-dropdown="true">
        {appearanceEditingTag ? <TagEditPopover key={appearanceEditingTag.id} tag={appearanceEditingTag} onCancel={closeAppearanceEditor} onSave={async updates => {
            const saved = onUpdateTag ? await onUpdateTag(appearanceEditingTag.id, updates) : await updateTag(appearanceEditingTag.id, updates);
            setSavedTagEdits(previous => ({ ...previous, [saved.id]: saved }));
            setRenamedNames(previous => ({ ...previous, [saved.id]: saved.name }));
            closeAppearanceEditor();
        }}/> : <>

          {selectedTags.length > 0 && onClearTags && (<div className="flex items-center justify-end px-3 pt-2.5 pb-1 select-none">
              <button type="button" onClick={e => {
                    e.stopPropagation();
                    onClearTags();
                }} className="text-[10px] text-[var(--color-danger)] hover:underline font-medium focus:outline-none">
                Clear all
              </button>
            </div>)}

          {/* Vertically Scrollable List of Matching Tags */}
          <div className="max-h-[160px] overflow-y-auto px-1 py-1 custom-scrollbar" role="listbox">
            {orderedFilteredTags.length === 0 && !canCreate && (<div className="px-3 py-3 text-xs text-[var(--color-textMuted)] text-center italic select-none">
                No tags found
              </div>)}

            <div className="grid grid-cols-2 gap-1">
              {groupedFilteredTags.map(section => (<div key={section.key} className={`min-w-0 ${section.key === 'workspace' ? 'col-start-2' : ''}`}>
                  <div className="px-2.5 pb-0.5 pt-1 text-[10px] font-bold tracking-wider uppercase text-[var(--color-textMuted)] select-none">
                    {section.label}
                  </div>
                  {section.tags.map(tag => {
                    const index = orderedFilteredTags.findIndex(option => option.id === tag.id);
                    const isSelected = selectedTags.some(st => st.id === tag.id);
                    const isActive = activeIndex === index;
                    return (<div key={tag.id || tag.name} role="option" aria-selected={isSelected} ref={el => {
                            itemRefs.current[index] = el;
                        }} onPointerDown={e => {
                            if ((e.target as HTMLElement | null)?.closest('button,input') || editingTag?.id === tag.id)
                                return;
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectOption(tag);
                        }} onClick={e => e.stopPropagation()} onMouseEnter={() => setActiveIndex(index)} className={`group/tagitem flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${isActive
                            ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                            : 'text-[var(--color-textPrimary)]'} ${isSelected ? 'bg-[var(--color-selectedBg)] font-medium text-[var(--color-accent)]' : ''}`} style={isSelected ? editorBlackSelectedStyle : isActive ? editorBlackActiveStyle : undefined} data-tag-selector-option-active={isActive ? 'true' : undefined} data-tag-selector-option-selected={isSelected ? 'true' : undefined}>
                        <span className="flex min-w-0 flex-1 items-center gap-1.5">
                          {tag.workspaceId && !tag.appearance ? (<FiGrid className="shrink-0 text-[var(--color-textMuted)]" size={12}/>) : <TagAppearance tag={tag}/>}
                          {editingTag?.id === tag.id ? (<span className="flex min-w-0 flex-1 flex-col gap-1">
                              <input ref={renameInputRef} data-tag-rename-input="true" value={renameDraft} disabled={isRenaming} aria-label={`Rename tag ${tag.name}`} aria-invalid={Boolean(renameError)} className="min-w-0 w-full rounded border border-[var(--color-borderActive)] bg-[var(--color-inputBg)] px-1.5 py-0.5 text-xs text-[var(--color-textPrimary)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]" onChange={event => { setRenameDraft(event.target.value); setRenameError(''); }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
                                event.stopPropagation();
                                event.nativeEvent.stopImmediatePropagation();
                                if (event.nativeEvent.isComposing)
                                    return;
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void saveRename();
                                }
                                else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelRename();
                                }
                            }}/>
                              {renameError && <span role="alert" className="text-xs text-[var(--color-error)]">{renameError}</span>}
                            </span>) : <span className="truncate">{tag.name}</span>}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected && <FiCheck size={14} className="text-[var(--color-accent)] shrink-0"/>}
                          {!tag.id.startsWith('temp_') && (<button type="button" aria-label={`Edit tag "${tag.name}"`} title="Edit tag" disabled={isRenaming} onPointerDown={event => event.stopPropagation()} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                setAppearanceEditingTag(tag);
                            }} className="text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] opacity-0 group-hover/tagitem:opacity-100 focus:opacity-100 group-focus-within/tagitem:opacity-100 transition-opacity p-0.5 rounded cursor-pointer border-none bg-transparent">
                              <FiEdit2 size={12}/>
                            </button>)}
                          <button type="button" disabled={isRenaming || editingTag?.id === tag.id} aria-label={`Delete tag "${tag.name}" permanently`} title="Delete tag permanently" onClick={e => handleDeleteTag(e, tag)} className="text-[var(--color-textMuted)] hover:text-red-500 opacity-0 group-hover/tagitem:opacity-100 focus:opacity-100 group-focus-within/tagitem:opacity-100 transition-opacity p-0.5 rounded cursor-pointer border-none bg-transparent">
                            <FiTrash2 size={12}/>
                          </button>
                        </div>
                      </div>);
                })}
                </div>))}
            </div>
          </div>

          {/* Visually Distinct Bottom Row for Tag Creation */}
          {canCreate && (<div className="border-t border-[var(--color-borderDefault)] p-1">
              <div role="option" aria-selected={false} ref={el => {
                    itemRefs.current[orderedFilteredTags.length] = el;
                }} onPointerDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateOption();
                }} onClick={e => e.stopPropagation()} onMouseEnter={() => setActiveIndex(orderedFilteredTags.length)} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-[var(--color-accent)] font-medium cursor-pointer select-none transition-colors ${activeIndex === orderedFilteredTags.length ? 'bg-[var(--color-hoverBg)]' : ''}`} style={activeIndex === orderedFilteredTags.length ? editorBlackActiveStyle : undefined} data-tag-selector-option-active={activeIndex === orderedFilteredTags.length ? 'true' : undefined}>
                <FiPlus size={14} className="flex-shrink-0"/>
                <span className="truncate">
                  Create &ldquo;{query.trim()}&rdquo;
                </span>
              </div>
            </div>)}
        </>}
        </div>)}
    </div>);
};
