import { FUNCTIONAL_EDITOR_SURFACE_STYLE, PURE_BLACK_EDITOR_BACKGROUND } from '../../../../../shared-components/editorContainer/functionalEditorSurfaceStyle';
import * as React from 'react';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { recordTimelineOpen } from '../../../../../pages/AltS_search_newtab/src/components/timeline/timelineActivity';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { useNoteEditor } from '../useNoteEditor';
import { normalizeNoteBody, extractTextFromHTML } from '../noteHelpers';
import TextEditor from '../../../../../shared-components/TextEditor';
import { EditorTopRightChrome } from '../../../../../shared-components/editorContainer/EditorTopRightChrome';
import { BRAND } from '../../../../../shared-components/brandingConfig';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { FiTrash2, FiList, FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { NoteCollectionSheetView, type NoteSheetHandle } from '../../../../../shared-components/notesSheet/NoteCollectionSheetView';
import { saveHotkey, clearHotkey } from '../../../../../shared-components/hotkeys/core/hotkeyManager';
import { LuExternalLink } from 'react-icons/lu';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import type { SharedProperties } from '../../../../../shared-components/editorToolbar/types';
import { createTodo } from '../../todos/todoData';
import { updateNote, deleteNote } from '../noteData';
import { createTag } from '../../tags/tagData';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../../shared-components/shortcuts';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import { NoteVersionHistory, NoteRecord } from '../noteTypes';
import { getHistoricalVersion } from '../noteHistory';
const getNoteTagIds = (note: any) => {
    if (Array.isArray(note?.tagIds))
        return note.tagIds;
    if (!Array.isArray(note?.tags))
        return [];
    return note.tags.map((tag: any) => (typeof tag === 'string' ? tag : tag?.id)).filter(Boolean);
};
const noteEditorViewLog = (...args: unknown[]) => {
    console.log('[NoteEditorView]', ...args);
};
const findTitleHashTrigger = (title: string) => {
    const match = /(^|\s)#([^\s#]*)$/.exec(title);
    if (!match)
        return null;
    const hashIndex = title.lastIndexOf('#');
    if (hashIndex < 0)
        return null;
    return {
        start: hashIndex,
        query: match[2] || '',
    };
};
const getTitleHashPopupPosition = (input: HTMLInputElement, title: string, hashIndex: number) => {
    const rect = input.getBoundingClientRect();
    const style = window.getComputedStyle(input);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const font = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
    let prefixWidth = 0;
    if (context) {
        context.font = font;
        prefixWidth = context.measureText(title.slice(0, hashIndex)).width;
    }
    const paddingLeft = Number.parseFloat(style.paddingLeft || '0') || 0;
    const x = Math.max(12, Math.min(rect.left + paddingLeft + prefixWidth, window.innerWidth - 300));
    const y = Math.min(rect.bottom + 8, window.innerHeight - 260);
    return { x, y };
};
const stripTitleHashToken = (title: string, hashIndex: number) => {
    if (hashIndex < 0 || hashIndex >= title.length)
        return title;
    const before = title.slice(0, hashIndex).replace(/\s+$/, '');
    const after = title.slice(hashIndex).replace(/^#[^\s#]*(\s+)?/, '');
    return [before, after.trimStart()].filter(Boolean).join(' ').trim();
};
export interface NoteEditorViewProps {
    onNavigationGuardReady?: (guard: (() => Promise<boolean>) | null) => void;
    noteId?: string | null;
    onBack?: () => void;
    initialDraftKey?: string;
    initialDraftContent?: string;
    initialDraftInstanceId?: number;
    initialTagIds?: string[];
    onNoteCreated?: (note: NoteRecord) => void | Promise<void>;
    isFullScreenMode?: boolean;
    isWidgetMode?: boolean;
    isEditMode?: boolean;
    isOverlay?: boolean;
    hideRightPanel?: boolean;
    appearanceScope?: 'default' | 'alts';
    workspaceCollectionMode?: boolean;
    workspaceCollectionFilterTagIds?: string[];
    organisationCollectionOrganisationId?: string | null;
    appearanceTokens?: React.CSSProperties;
    onSavedClose?: () => void;
    saveNoteAdapter?: (args: {
        mode: 'create' | 'update';
        noteId?: string;
        input: any;
    }) => Promise<NoteRecord>;
    propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
    initialVersionHistory?: NoteVersionHistory;
}
export function NoteEditorView(props: NoteEditorViewProps) {
    const { isFullScreenMode = false, isWidgetMode = false, isEditMode = false, isOverlay: propIsOverlay, hideRightPanel = false, appearanceScope = 'default', workspaceCollectionMode = false, workspaceCollectionFilterTagIds = [], organisationCollectionOrganisationId = null, appearanceTokens, propertyPersistenceAdapter, } = props;
    const activeEditor = useUIStore(state => state.activeEditor);
    const isFocusMode = useUIStore(state => state.isFocusMode);
    const isOverlay = !isFullScreenMode && Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
    const isNormalNoteMode = !isWidgetMode && !isFullScreenMode && !isOverlay && !isFocusMode;
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const [isForceCreateNew, setIsForceCreateNew] = useState(false);
    const [notesView, setNotesView] = useState<'editor' | 'sheet'>('editor');
    const notesSheetRef = useRef<NoteSheetHandle>(null);
    const [newDraftTagIds, setNewDraftTagIds] = useState<string[] | undefined>();
    const [draftInstanceId, setDraftInstanceId] = useState(0);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    // Sidebar States & DB Store Selectors
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(props.noteId ?? null);
    const [searchQuery, setSearchQuery] = useState('');
    const rightSideSearchInputRef = useRef<HTMLInputElement>(null);
    const [titleTagDraft, setTitleTagDraft] = useState<string | null>(null);
    const [titleTagStartIndex, setTitleTagStartIndex] = useState<number | null>(null);
    const [titleTagDraftCommitted, setTitleTagDraftCommitted] = useState(false);
    const [titleTagPickerRequest, setTitleTagPickerRequest] = useState<{
        id: number;
        query: string;
        position?: {
            x: number;
            y: number;
        } | null;
    } | null>(null);
    const previousTitleTagNoteIdRef = useRef<string | null>(null);
    const titleTagRequestIdRef = useRef(0);
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
                e.preventDefault();
                setTimeout(() => {
                    rightSideSearchInputRef.current?.focus();
                    rightSideSearchInputRef.current?.select();
                }, 50);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [pendingLoadNoteId, setPendingLoadNoteId] = useState<string | null>(null);
    const [isUnsavedLoadDialogOpen, setIsUnsavedLoadDialogOpen] = useState(false);
    const notes = useDbStore(state => state.notes);
    const tags = useDbStore(state => state.tags);
    const organisations = useDbStore(state => state.organisations);
    const shortcutsMap = useDbStore(state => state.shortcutsMap);
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const { isFavorite, toggleFavorite, addFavorite } = useFavorites();
    const { validateShortcut } = useShortcutValidation();
    const tagNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        tags.forEach(t => {
            map[t.id] = t.name;
        });
        return map;
    }, [tags]);
    const organisationNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        organisations.forEach(w => {
            map[w.id] = w.organisationName;
        });
        return map;
    }, [organisations]);
    const filteredNotes = React.useMemo(() => {
        const collectionTagSet = new Set(workspaceCollectionFilterTagIds.filter(Boolean));
        let list = workspaceCollectionMode
            ? notes.filter(note => {
                if (collectionTagSet.size > 0) {
                    return (note.tagIds || []).some(tagId => collectionTagSet.has(String(tagId)));
                }
                return !organisationCollectionOrganisationId || note.organisationId === organisationCollectionOrganisationId;
            })
            : [...notes];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(n => {
                const titleMatch = (n.title || '').toLowerCase().includes(q);
                const plainText = n.body ? extractTextFromHTML(n.body) : '';
                const bodyMatch = plainText.toLowerCase().includes(q);
                return titleMatch || bodyMatch;
            });
        }
        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [notes, searchQuery, workspaceCollectionFilterTagIds, workspaceCollectionMode, organisationCollectionOrganisationId]);
    React.useEffect(() => {
        setSelectedNoteId(props.noteId ?? null);
        if (props.noteId) {
            setIsForceCreateNew(false);
        }
    }, [props.noteId]);
    const editorProps = React.useMemo(() => {
        if (isForceCreateNew) {
            return {
                ...props,
                noteId: null,
                initialDraftKey: undefined,
                initialDraftContent: undefined,
                initialTagIds: newDraftTagIds ?? props.initialTagIds,
                initialDraftInstanceId: draftInstanceId,
                onNoteCreated: props.onNoteCreated,
            };
        }
        return {
            ...props,
            noteId: selectedNoteId,
            initialTagIds: selectedNoteId ? undefined : props.initialTagIds,
            onNoteCreated: props.onNoteCreated,
        };
    }, [props, isForceCreateNew, selectedNoteId, newDraftTagIds, draftInstanceId]);
    const state = useNoteEditor(editorProps);
    useEffect(() => {
        const previousNoteId = previousTitleTagNoteIdRef.current;
        previousTitleTagNoteIdRef.current = state.activeNoteId;
        if (previousNoteId === state.activeNoteId)
            return;
        if (!previousNoteId && state.activeNoteId) {
            setTitleTagPickerRequest(null);
            return;
        }
        setTitleTagPickerRequest(null);
        setTitleTagDraft(null);
        setTitleTagStartIndex(null);
        setTitleTagDraftCommitted(false);
    }, [state.activeNoteId]);
    const buildTitleTagDraft = useCallback((query: string) => {
        const start = titleTagStartIndex ?? findTitleHashTrigger(titleTagDraft ?? state.noteTitle)?.start;
        if (start === null || start === undefined)
            return;
        const cleanTitle = (titleTagDraft ?? state.noteTitle).slice(0, start).replace(/\s+$/, '');
        setTitleTagDraft(`${cleanTitle} #${query}`);
    }, [state.noteTitle, titleTagDraft, titleTagStartIndex]);
    const handleTitleTagSelected = useCallback((tag: {
        name?: string;
    }) => {
        if (!tag?.name)
            return;
        const cleanTitle = (titleTagDraft ?? state.noteTitle)
            .slice(0, titleTagStartIndex ?? state.noteTitle.length)
            .replace(/\s+$/, '');
        noteEditorViewLog('title hash tag selected', {
            activeNoteId: state.activeNoteId,
            tagName: tag.name,
            titleBeforeHash: cleanTitle,
            draftTitle: titleTagDraft ?? state.noteTitle,
            hashStartIndex: titleTagStartIndex,
        });
        state.setNoteTitle(cleanTitle);
        setTitleTagDraft(null);
        setTitleTagStartIndex(null);
        setTitleTagDraftCommitted(false);
        setTitleTagPickerRequest(null);
        window.requestAnimationFrame(() => {
            state.titleInputRef.current?.focus();
        });
    }, [state, titleTagDraft, titleTagStartIndex]);
    const handleTitleTagPickerClose = useCallback(() => {
        setTitleTagPickerRequest(null);
        window.requestAnimationFrame(() => {
            state.titleInputRef.current?.focus();
        });
    }, [state.titleInputRef]);
    const handleTitleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const nextTitle = event.target.value;
        const trigger = findTitleHashTrigger(nextTitle);
        if (!trigger) {
            if (titleTagDraftCommitted && titleTagStartIndex !== null) {
                noteEditorViewLog('title hash token stripped after commit', {
                    activeNoteId: state.activeNoteId,
                    nextTitle,
                    strippedTitle: stripTitleHashToken(nextTitle, titleTagStartIndex),
                    hashStartIndex: titleTagStartIndex,
                });
                setTitleTagDraft(nextTitle);
                state.setNoteTitle(stripTitleHashToken(nextTitle, titleTagStartIndex));
                setTitleTagPickerRequest(null);
                return;
            }
            setTitleTagDraft(null);
            setTitleTagDraftCommitted(false);
            setTitleTagStartIndex(null);
            state.setNoteTitle(nextTitle);
            setTitleTagPickerRequest(null);
            return;
        }
        const cleanTitle = nextTitle.slice(0, trigger.start).replace(/\s+$/, '');
        noteEditorViewLog('title hash trigger opened', {
            activeNoteId: state.activeNoteId,
            query: trigger.query,
            cleanTitle,
            hashStartIndex: trigger.start,
        });
        setTitleTagDraft(nextTitle);
        setTitleTagDraftCommitted(false);
        state.setNoteTitle(cleanTitle);
        setTitleTagStartIndex(trigger.start);
        titleTagRequestIdRef.current += 1;
        setTitleTagPickerRequest({
            id: titleTagRequestIdRef.current,
            query: trigger.query,
            position: getTitleHashPopupPosition(event.currentTarget, nextTitle, trigger.start),
        });
    }, [state, titleTagDraftCommitted, titleTagStartIndex]);
    const notePlainText = useMemo(() => extractTextFromHTML(state.noteBody || ''), [state.noteBody]);
    const noteWordCount = useMemo(() => (notePlainText.trim() ? notePlainText.trim().split(/\s+/).length : 0), [notePlainText]);
    const noteCharCount = notePlainText.length;
    const syncFullScreenNoteUrl = useCallback((id: string) => {
        if (!isFullScreenMode || typeof window === 'undefined')
            return;
        const url = new URL(window.location.href);
        url.searchParams.set('open_note', 'true');
        url.searchParams.set('noteid', id);
        window.history.replaceState({}, '', url.toString());
    }, [isFullScreenMode]);
    const loadNoteIntoEditor = useCallback((id: string) => {
        setNotesView('editor');
        setIsForceCreateNew(false);
        setSelectedNoteId(id);
        if (notes.some(note => note.id === id && note.deletedAt == null)) recordTimelineOpen('note', id);
        syncFullScreenNoteUrl(id);
    }, [notes, syncFullScreenNoteUrl]);
    const handleLoadNote = useCallback(async (id: string) => {
        if (notesView === 'sheet' && !await notesSheetRef.current?.flushEdit())
            return;
        if (state.isDirty) {
            const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
            if (!saved) {
                setPendingLoadNoteId(id);
                setIsUnsavedLoadDialogOpen(true);
                return;
            }
        }
        loadNoteIntoEditor(id);
    }, [loadNoteIntoEditor, state, notesView]);
    const handleDeleteClickFromList = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setNoteToDeleteId(id);
        setIsDeleteConfirmOpen(true);
    }, []);
    const handleConfirmDeleteFromList = useCallback(async () => {
        if (!noteToDeleteId)
            return;
        try {
            await deleteNote(noteToDeleteId);
            if (noteToDeleteId === selectedNoteId || noteToDeleteId === state.activeNoteId) {
                state.setIsNoteDeleted(true);
            }
        }
        catch (err) {
            console.error('Failed to delete note from list', err);
        }
        finally {
            setIsDeleteConfirmOpen(false);
            setNoteToDeleteId(null);
        }
    }, [noteToDeleteId, selectedNoteId, state]);
    const getNoteCompoundId = useCallback((note: any) => {
        return getItemCompoundId({
            id: note.id,
            organisation_id: note.organisationId,
            snippet: {
                id: note.id,
                category: 'note',
            },
        });
    }, []);
    const textToDisplay = useCallback(() => {
        if (!state)
            return '';
        if (!state.activeNoteId)
            return state.noteBody;
        if (state.noteVersionIndex === 0) {
            return state.noteBody;
        }
        const note = state.liveNote;
        const versionHistory = note && note.versionHistory && typeof (note.versionHistory as any).lastSavedText === 'string'
            ? (note.versionHistory as any)
            : { lastCheckpointAt: Date.now(), lastSavedText: state.noteBody, historyBuffer: [] };
        return getHistoricalVersion(state.noteBody, versionHistory, state.noteVersionIndex);
    }, [state]);
    const handleEditorChange = useCallback((newText: string) => {
        state.setNoteBody(newText);
    }, [state.setNoteBody]);
    const handleOpenerClick = useCallback(async (noteId: string) => {
        if (!(await state.flushSave()))
            return;
        const chromeAny = (window as any)?.chrome;
        const baseUrl = chromeAny?.runtime?.getURL
            ? chromeAny.runtime.getURL('AltS_search_newtab/index.html')
            : '/AltS_search_newtab/index.html';
        const url = `${baseUrl}?open_note=true&noteid=${encodeURIComponent(noteId)}`;
        if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url, active: true });
        }
        else {
            window.open(url, '_blank', 'noopener');
        }
    }, [state.activeNoteId, state.flushSave]);
    const containerRef = useRef<HTMLDivElement>(null);
    const toolbarIdRef = React.useRef(`note-toolbar-${Math.random().toString(36).slice(2, 10)}`);
    const defaultToolbarNameRef = React.useRef(state.noteTitle);
    const toolbarSelector = `#${toolbarIdRef.current}`;
    const noteCompoundId = React.useMemo(() => {
        if (!state.activeNoteId)
            return '';
        return getItemCompoundId({
            id: state.activeNoteId,
            organisation_id: state.organisationId,
            snippet: {
                id: state.activeNoteId,
                category: 'note',
            },
        });
    }, [state.activeNoteId, state.organisationId]);
    const isEmbedded = appearanceScope === 'alts' ||
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true');
    const isWorkspaceCollectionMode = workspaceCollectionMode && appearanceScope === 'alts';
    const tagIdsKey = React.useMemo(() => state.tagIds.join('|'), [state.tagIds]);
    const initialProperties = React.useMemo(() => {
        return {
            id: state.activeNoteId,
            title: state.noteTitle,
            organisationId: state.organisationId,
            tagIds: [...state.tagIds],
            tags: state.tagIds.map(id => tags.find(tag => tag.id === id) || { id, name: '' }),
            versionHistory: state.liveNote?.versionHistory,
        };
    }, [state.activeNoteId, state.noteTitle, state.organisationId, tagIdsKey, tags, state.liveNote?.versionHistory]);
    React.useEffect(() => {
        if (notesView !== 'editor')
            return;
        const timer = setTimeout(() => {
            const input = state.titleInputRef.current;
            if (input) {
                input.focus();
                const length = input.value.length;
                input.setSelectionRange(length, length);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [state.titleInputRef, notesView]);
    React.useEffect(() => {
        defaultToolbarNameRef.current = state.noteTitle;
    }, [state.activeNoteId, state.noteTitle]);
    const handleCreateNew = useCallback(async () => {
        if (notesView === 'sheet' && !(await notesSheetRef.current?.flushEdit()))
            return;
        if (!(await state.flushSave()))
            return;
        setNotesView('editor');
        if (!isFullScreenMode) {
            const currentProps = useUIStore.getState().activeEditor?.props || {};
            useUIStore.getState().openEditor({ type: 'note', id: 'new', props: {
                    ...currentProps, snippet: null, prefill: null, item: null,
                    initialDraftKey: null, initialDraftContent: null,
                } });
        }
        setNewDraftTagIds(props.initialTagIds);
        setDraftInstanceId(value => value + 1);
        setSelectedNoteId(null);
        setIsForceCreateNew(true);
        setShowTooltip(false);
        syncFullScreenNoteUrl('new');
        defaultToolbarNameRef.current = '';
        if (state.titleInputRef.current) {
            state.titleInputRef.current.focus();
        }
    }, [state, setShowTooltip, isFullScreenMode, props.initialTagIds, syncFullScreenNoteUrl, notesView]);
    const updateCreateAnotherTooltipPosition = useCallback((button: HTMLElement) => {
        const rect = button.getBoundingClientRect();
        const viewportMargin = 12;
        const tooltipGap = 8;
        const estimatedTooltipWidth = 310;
        const estimatedTooltipHeight = 40;
        const maxLeft = Math.max(viewportMargin, window.innerWidth - estimatedTooltipWidth - viewportMargin);
        const left = Math.min(Math.max(viewportMargin, rect.right - estimatedTooltipWidth), maxLeft);
        const top = Math.max(viewportMargin, rect.top - estimatedTooltipHeight - tooltipGap);
        setTooltipPos({ top, left });
    }, []);
    React.useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            // Create New Shortcut strictly on Ctrl+Shift+Enter
            if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
                event.preventDefault();
                handleCreateNew();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [handleCreateNew]);
    const handleDeleteClick = React.useCallback(() => {
        state.setIsDeleteDialogOpen(true);
    }, [state.setIsDeleteDialogOpen]);
    const onDeleteProp = state.activeNoteId ? handleDeleteClick : undefined;
    const handleNotesClose = async () => {
        if (notesView === 'sheet' && !await notesSheetRef.current?.flushEdit())
            return;
        state.handleClose();
    };
    const notesViewToggle = !isWidgetMode ? (<button type="button" aria-label={notesView === 'editor' ? 'Show Notes spreadsheet' : 'Show Notes editor'} title={notesView === 'editor' ? 'Show Notes spreadsheet' : 'Show Notes editor'} aria-pressed={notesView === 'sheet'} onMouseDown={event => event.preventDefault()} onClick={async () => {
            if (notesView === 'sheet' && !await notesSheetRef.current?.flushEdit())
                return;
            if (notesView === 'editor' && state.isDirty) {
                const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                if (!saved)
                    return;
            }
            setNotesView(current => current === 'editor' ? 'sheet' : 'editor');
        }} className="w-9 h-9 p-0 rounded-lg text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
      {notesView === 'editor' ? <FiMaximize2 size={15}/> : <FiMinimize2 size={15}/>}
    </button>) : undefined;
    const notesSheet = notesView === 'sheet' && !isWidgetMode ? (<NoteCollectionSheetView ref={notesSheetRef} notes={filteredNotes} getCompoundId={getNoteCompoundId} shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNamesMap={tagNamesMap} isFavorite={isFavorite} onOpen={id => void handleLoadNote(id)} onDelete={id => { setNoteToDeleteId(id); setIsDeleteConfirmOpen(true); }} onUpdate={async (note, changes) => {
            const input = { ...changes, expectedUpdatedAt: note.updatedAt };
            if (props.saveNoteAdapter)
                await props.saveNoteAdapter({ mode: 'update', noteId: note.id, input });
            else
                await updateNote(note.id, input);
        }} onShortcut={async (note, value) => {
            const referenceId = getNoteCompoundId(note);
            if (value.trim()) {
                if (propertyPersistenceAdapter?.saveShortcut)
                    await propertyPersistenceAdapter.saveShortcut({ id: note.id, referenceId, shortcut: value, label: note.title, type: 'note' });
                else
                    await saveShortcut(note.id, referenceId, value, note.title, 'note');
            }
            else {
                if (propertyPersistenceAdapter?.clearShortcut)
                    await propertyPersistenceAdapter.clearShortcut({ id: note.id, referenceId, type: 'note' });
                else
                    await clearShortcut(note.id, referenceId, 'note');
            }
        }} onHotkey={async (note, value) => {
            const referenceId = getNoteCompoundId(note);
            if (value.trim()) {
                if (propertyPersistenceAdapter?.saveHotkey)
                    await propertyPersistenceAdapter.saveHotkey({ id: note.id, referenceId, hotkey: value, type: 'note' });
                else
                    await saveHotkey(note.id, referenceId, value, 'note');
            }
            else {
                if (propertyPersistenceAdapter?.clearHotkey)
                    await propertyPersistenceAdapter.clearHotkey({ id: note.id, referenceId, type: 'note' });
                else
                    await clearHotkey(note.id, referenceId, 'note');
            }
        }} onFavorite={async (note) => {
            const referenceId = getNoteCompoundId(note);
            if (isFavorite(referenceId) && propertyPersistenceAdapter?.removeFavorite)
                await propertyPersistenceAdapter.removeFavorite({ referenceId });
            else if (!isFavorite(referenceId) && propertyPersistenceAdapter?.addFavorite)
                await propertyPersistenceAdapter.addFavorite({ referenceId, referenceType: 'note', label: note.title });
            else
                await toggleFavorite(referenceId, 'note', note.title);
        }}/>) : null;
    const notesItemsPanel = !isWidgetMode && !hideRightPanel ? (<RightSideItemsPanel<any> hideBorder={isNormalNoteMode || isFullScreenMode} items={filteredNotes} activeItemId={state.activeNoteId} searchQuery={searchQuery} onSearchChange={setSearchQuery} onCloseClick={handleNotesClose} searchPlaceholder="Search notes..." getItemTitle={note => note.title || ''} getItemPreview={note => (note.body ? extractTextFromHTML(note.body).substring(0, 80) : '')} getItemIcon={() => <NotesIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>} getItemCompoundId={note => getNoteCompoundId(note)} getItemType={() => 'note'} getItemOrganisationId={note => note.organisationId} getItemTagIds={getNoteTagIds} shortcutPrefix="c" shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} organisationNamesMap={organisationNamesMap} tagNamesMap={tagNamesMap} onLoadItem={handleLoadNote} onDeleteItem={async (id) => {
            try {
                await deleteNote(id);
                if (id === selectedNoteId || id === state.activeNoteId) {
                    state.setIsNoteDeleted(true);
                }
            }
            catch (err) {
                console.error('Failed to delete note from list', err);
            }
        }} onOpenerClick={item => handleOpenerClick(item.id)} onUpdateShortcut={async (id, val) => {
            const noteItem = notes.find(n => n.id === id);
            const compound = noteItem ? getNoteCompoundId(noteItem) : id;
            if (val.trim()) {
                const res = await validateShortcut(val.trim(), id);
                if (!res.isValid) {
                    alert(res.errorMessage || 'Invalid shortcut');
                    return;
                }
                await saveShortcut(id, compound, val.trim(), noteItem?.title || 'Untitled Note', 'note');
            }
            else {
                await clearShortcut(id, compound, 'note');
            }
        }} onUpdateTitle={async (id, val) => {
            if (id === state.activeNoteId) {
                state.setNoteTitle(val);
                if (!(await state.flushSave()))
                    throw new Error('Could not save the note title.');
            }
            else {
                const note = notes.find(item => item.id === id);
                await updateNote(id, { title: val, expectedUpdatedAt: note?.updatedAt });
            }
        }} onUpdateTags={async (id, tagText) => {
            const tagNamesArr = tagText
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            const targetNote = notes.find(n => n.id === id);
            const tagIdsToSave: string[] = [];
            for (const name of tagNamesArr) {
                const existing = tags.find(t => targetNote?.tagIds?.includes(t.id) && t.name.toLowerCase() === name.toLowerCase())
                    || tags.find(t => !t.workspaceId && t.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    tagIdsToSave.push(existing.id);
                }
                else {
                    try {
                        const newTag = await createTag(name);
                        tagIdsToSave.push(newTag.id);
                    }
                    catch (e) {
                        console.error('Failed creating tag inline', e);
                    }
                }
            }
            if (id === state.activeNoteId) {
                state.handlePropertiesChange({ selectedTags: tagIdsToSave.map(tagId => tags.find(tag => tag.id === tagId) || { id: tagId, name: '' } as any) });
                if (!(await state.flushSave()))
                    throw new Error('Could not save note tags.');
            }
            else {
                await updateNote(id, { tagIds: tagIdsToSave, expectedUpdatedAt: targetNote?.updatedAt });
            }
        }} isFavorite={isFavorite} toggleFavorite={toggleFavorite} addFavorite={addFavorite} isExpanded={false} onExpandChange={() => undefined} compactItemMenu="delete-only" searchInputRef={rightSideSearchInputRef} emptyStateMessage="No notes found" onCreateItemInTag={async (tagNames, tagIds) => {
            if (state.isDirty) {
                const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                if (!saved)
                    return;
            }
            // Resolve or create tag records in DB to guarantee IDs exist
            const resolvedTagRecords: any[] = [];
            for (let i = 0; i < tagNames.length; i++) {
                const name = tagNames[i].trim();
                if (!name)
                    continue;
                const directId = tagIds[i];
                const existing = tags.find(t => t.id === directId) || tags.find(t => !t.workspaceId && t.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    resolvedTagRecords.push(existing);
                }
                else {
                    try {
                        const created = await createTag(name);
                        resolvedTagRecords.push(created);
                    }
                    catch (err) {
                        console.error('Failed to create tag on + click', err);
                    }
                }
            }
            // Apply selected tags to editor properties
            setNewDraftTagIds(resolvedTagRecords.map(tag => tag.id));
            setDraftInstanceId(value => value + 1);
            setSelectedNoteId(null);
            setIsForceCreateNew(true);
            syncFullScreenNoteUrl('new');
            setTimeout(() => {
                state.titleInputRef.current?.focus();
            }, 50);
        }}/>) : null;
    const isLoadingNote = state.isLoading;
    useEffect(() => {
        if (isFullScreenMode && state.activeNoteId)
            syncFullScreenNoteUrl(state.activeNoteId);
    }, [isFullScreenMode, state.activeNoteId, syncFullScreenNoteUrl]);
    const flushForNavigation = useCallback(async () => {
        if (notesView === 'sheet' && !await notesSheetRef.current?.flushEdit()) return false;
        return state.flushSave();
    }, [notesView, state.flushSave]);
    useEffect(() => {
        props.onNavigationGuardReady?.(flushForNavigation);
        return () => props.onNavigationGuardReady?.(null);
    }, [props.onNavigationGuardReady, flushForNavigation]);
    useEffect(() => {
        if (isWidgetMode)
            return;
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            state.handleClose();
            return true;
        });
        return unregister;
    }, [isWidgetMode, state.handleClose]);
    useEffect(() => {
        if (!isFullScreenMode)
            return;
        const handleOpen = (event: Event) => {
            const id = (event as CustomEvent<string>).detail;
            if (id)
                void handleLoadNote(id);
        };
        window.addEventListener('notes:open-fullscreen', handleOpen);
        return () => window.removeEventListener('notes:open-fullscreen', handleOpen);
    }, [isFullScreenMode, handleLoadNote]);
    return (<>
      <EditorContainer useBlackSurface={!isWidgetMode} ref={containerRef} data-note-editor-surface="true" style={isOverlay
            ? ({
                ...appearanceTokens,
                colorScheme: 'dark',
                backgroundColor: PURE_BLACK_EDITOR_BACKGROUND,
                color: '#FFFFFF',
                '--color-editorBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-inputBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-containerBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-panelBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-cardBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-popupBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-innerPopupBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-contextMenuBg': PURE_BLACK_EDITOR_BACKGROUND,
                '--color-textPrimary': '#FFFFFF',
                '--color-textSecondary': '#D4D4D4',
                '--color-textMuted': '#737373',
                '--color-textPlaceholder': '#A3A3A3',
                '--color-iconDefault': '#9CA3AF',
                '--color-borderDefault': 'rgba(255, 255, 255, 0.1)',
                '--color-borderActive': 'rgba(255, 255, 255, 0.2)',
                '--color-hoverBg': 'rgba(255, 255, 255, 0.05)',
                '--color-selectedBg': 'rgba(255, 255, 255, 0.07)',
            } as any)
            : appearanceTokens} className={isWidgetMode
            ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
            : isNormalNoteMode
                ? 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-4 md:px-6 py-2'
                : `w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-6 md:px-10 lg:px-14 py-4'}`} innerClassName={isWidgetMode
            ? 'flex flex-col w-full h-full overflow-hidden bg-transparent'
            : isNormalNoteMode
                ? 'flex flex-col relative bg-transparent w-full h-full max-h-none border-none'
                : `flex flex-col relative bg-transparent ${isFullScreenMode
                    ? 'w-full rounded-none h-full max-h-none border-none'
                    : 'w-[calc(100%-60px)] max-w-[1440px] mx-auto h-[860px] max-h-[90vh] overflow-visible transition-all duration-300 border-none'}`}>
        {(state.isNoteDeleted || state.isNoteMissing || state.loadError) && notesView === 'editor' ? (<div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
            <div className="max-w-md w-full rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 p-7 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center mb-4 border border-red-500/20">
                <FiTrash2 size={20}/>
              </div>
              <div className="text-lg font-semibold text-[var(--color-textPrimary)]">
                {state.loadError ? 'Could not load this note.' : state.isNoteMissing ? 'This note could not be found.' : 'This note was deleted in another tab.'}
              </div>
              <div className="mt-1.5 text-sm text-[var(--color-textSecondary)] max-w-xs">
                The editor is disabled to avoid saving stale content.
              </div>
              <button type="button" onClick={state.handleClose} className="mt-6 inline-flex items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 border border-transparent dark:border-white/10 px-6 py-2.5 text-sm font-medium text-white transition-all cursor-pointer shadow-md active:scale-95">
                Back
              </button>
            </div>
          </div>) : (<div className="relative flex-1 min-h-0 flex flex-row gap-2 bg-transparent text-[var(--color-textPrimary)] overflow-visible">
            {!isWidgetMode && (!isFullScreenMode || notesView === 'sheet') && (<EditorTopRightChrome docsUrl={BRAND.docs.notes} onClose={handleNotesClose} sheetCreateAction={notesView === 'sheet' ? { label: 'New Note', onCreate: () => { void handleCreateNew(); } } : undefined} leadingActionSlot={notesViewToggle}/>)}

            {/* Notes Items Panel */}
            {notesItemsPanel}

            {notesSheet}
             {/* Editor Surface: Header + Content + Footer Toolbar */} <div style={notesView === 'sheet' && !isWidgetMode ? { display: 'none' } : undefined} className={isWidgetMode
                ? 'group/note-widget flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-transparent border-none relative'
                : isNormalNoteMode || isFullScreenMode
                    ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-none border-none shadow-none bg-[var(--color-editorBg)] relative'
                    : 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] relative'}>
              {/* Main Workspace Left Side */}
              {isLoadingNote ? (<div className="flex-1 flex flex-col items-center justify-center min-h-0 min-w-0 bg-[var(--color-editorBg)] text-[var(--color-textPrimary)]">
                  <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin"/>
                  <p className="text-lg font-medium mt-4">Loading note...</p>
                </div>) : (<div className="flex-grow flex flex-col min-h-0 min-w-0 relative">
                {!isWidgetMode && (<div className="absolute top-2.5 right-2 z-50 flex items-center gap-3">
                    <div className="transition-opacity duration-300">
                      <AutoSaveIndicator saveStatus={state.saveStatus} lastSavedAt={state.lastSavedAt} activeId={state.activeNoteId}/>
                    </div>

                    {state.conflictNote && (<div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
                        <div className="font-semibold">This note changed in another tab.</div>
                        <div className="mt-1 flex items-center gap-2">
                          <button type="button" onClick={state.resolveConflictWithRemote} className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-50 dark:hover:bg-amber-900">
                            Use latest
                          </button>
                          <button type="button" onClick={state.keepLocalVersion} className="rounded-md bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 dark:bg-neutral-800 dark:text-amber-50 dark:hover:bg-neutral-700">
                            Keep mine and overwrite latest version
                          </button>
                        </div>
                      </div>)}

                    <SharedPropertiesToolbar key={state.activeNoteId || 'new-note'} initialSnippet={initialProperties} entityType="note" versionHistory={state.liveNote?.versionHistory ?? null} currentSnapshot={{
                        entityType: 'note',
                        title: state.noteTitle || '',
                        body: state.noteBody || '',
                        shortcut: (noteCompoundId
                            ? shortcutsMap[noteCompoundId]
                            : state.activeNoteId
                                ? shortcutsMap[state.activeNoteId]
                                : '') || '',
                        organisationId: state.organisationId,
                        tagIds: [...(state.tagIds || [])],
                    }} compoundId={noteCompoundId} setNoteVersionIndex={state.setNoteVersionIndex} selectedNoteVersionIndex={state.noteVersionIndex} defaultName={defaultToolbarNameRef.current} onChange={state.handlePropertiesChange} activeNoteId={state.activeNoteId} showTodo={true} todoStatus={'idle'} openPopupsToLeft={true} openPopupsToBottom={true} layout="horizontal" showDocsButton={false} reserveTopRightChromeSpace={!isWidgetMode && !isFullScreenMode} onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                        if (!(await state.flushSave()))
                            return;
                        const currentNote = state.getCurrentNote();
                        const noteId = currentNote.id;
                        if (!noteId)
                            return;
                        const plainTitle = currentNote.noteTitle.trim() || 'Untitled Note';
                        if (!plainTitle) {
                            alert('Title is required to create a To-Do for a Note.');
                            return;
                        }
                        const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                        try {
                            const newTodo = propertyPersistenceAdapter?.createTodo
                                ? await propertyPersistenceAdapter.createTodo({
                                    title: plainTitle,
                                    description: '',
                                    references: [{ type: 'note', id: noteId, name: plainTitle }],
                                    scheduleType: isRecurring ? 'recurring' : 'one-time',
                                    scheduleTime,
                                    recurringCycle: isRecurring ? (recurringCycle as any) : undefined,
                                    tagIds: currentNote.tagIds,
                                    organisationId: currentNote.organisationId,
                                })
                                : await createTodo(plainTitle, [{ type: 'note', id: noteId, name: plainTitle }], isRecurring ? 'recurring' : 'one-time', scheduleTime, isRecurring ? (recurringCycle as any) : undefined, '', currentNote.tagIds, '', currentNote.organisationId ?? undefined);
                            const chromeAny = (window as any).chrome;
                            if (chromeAny?.runtime?.sendMessage) {
                                chromeAny.runtime.sendMessage({
                                    action: 'schedule_newtodo_alarm',
                                    todoId: newTodo.id,
                                    scheduleTime: scheduleTime,
                                });
                            }
                        }
                        catch (err) {
                            console.error('[NoteEditorView:onCreateTodo] Failed to create and schedule note todo', err);
                        }
                    }} snippetBreadCrum={null} appearanceScope={appearanceScope} appearanceTokens={isWidgetMode ? appearanceTokens : { ...appearanceTokens, ...FUNCTIONAL_EDITOR_SURFACE_STYLE }} propertyPersistenceAdapter={propertyPersistenceAdapter} externalTagPickerRequest={titleTagPickerRequest} onExternalTagQueryChange={buildTitleTagDraft} onExternalTagSelected={handleTitleTagSelected} onExternalTagPickerClose={handleTitleTagPickerClose}/>

                    {isFullScreenMode && (<EditorTopRightChrome docsUrl={BRAND.docs.notes} onClose={state.handleClose} positionClassName="relative" leadingActionSlot={notesViewToggle}/>)}
                  </div>)}

                <div className={isWidgetMode
                    ? 'w-full flex-grow flex flex-col min-h-0 px-3 py-2'
                    : isWorkspaceCollectionMode
                        ? 'w-full max-w-[900px] mx-auto xl:-translate-x-12 flex-grow flex flex-col min-h-0 px-4 md:px-6 py-6'
                        : isNormalNoteMode || isFullScreenMode
                            ? `w-full max-w-3xl mx-auto ${isEmbedded ? '' : 'xl:-translate-x-12'} flex-grow flex flex-col min-h-0 px-4 md:px-6 py-6`
                            : 'w-full flex-grow flex flex-col min-h-0 px-6 md:px-12 py-6'}>
                  <div className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isWidgetMode ? 'py-1' : 'py-4'}`}>
                    <div className="flex-grow min-w-0 flex items-center gap-3">
                      <input ref={state.titleInputRef} value={titleTagDraft ?? state.noteTitle} onChange={handleTitleInputChange} onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        state.editorRef.current?.focus();
                    }
                }} type="text" placeholder="Title" style={{ pointerEvents: 'auto' }} className={`w-full ${isWidgetMode ? 'text-[11px] font-bold' : 'text-4xl font-bold leading-tight'} text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isWidgetMode ? 'pl-[12px]' : 'pl-[14px]'}`}/>
                    </div>
                    {isWidgetMode && state.activeNoteId && (<button type="button" aria-label="Open note in full screen" title="Open note in full screen" data-no-widget-drag="true" onPointerDown={e => e.stopPropagation()} onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (state.activeNoteId) {
                            handleOpenerClick(state.activeNoteId);
                        }
                    }} className="mr-1.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-transparent text-[var(--color-iconDefault)] opacity-0 transition-all group-hover/note-widget:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-borderActive)]">
                        <LuExternalLink size={12}/>
                      </button>)}
                  </div>

                  <div className={`note-rich-text flex-grow min-h-0 overflow-hidden flex flex-col font-sans font-normal text-[var(--color-textPrimary)] ${isWidgetMode ? 'text-2xl' : 'note-reading-size text-lg'} ${isFullScreenMode ? 'pt-1 pb-3' : 'pb-3'}`}>
                    <div className="flex-grow min-h-0 overflow-hidden relative">
                      <TextEditor readOnly={(isWidgetMode && isEditMode) || state.noteVersionIndex !== 0} key={selectedNoteId || `draft-${draftInstanceId}`} ref={state.editorRef} syncRevision={state.syncRevision} value={textToDisplay()} onChange={handleEditorChange} placeholder="Start writing your note..." onUpArrowAtStart={() => state.titleInputRef.current?.focus()} showToolbar={true} notesFormatting={!isWidgetMode} toolbarSelector={toolbarSelector} isFocusMode={isFullScreenMode} onDelete={onDeleteProp} onImageSaveStart={state.onImageSaveStart} onImageSaveEnd={state.onImageSaveEnd} normalizeHtml={normalizeNoteBody}/>
                    </div>
                  </div>
                </div>
              </div>)}

              {!isWidgetMode && !isLoadingNote && (<div className={`relative z-50 mt-auto flex-shrink-0 ${isNormalNoteMode ? 'border-none' : 'border-t border-black/10 dark:border-white/10'} bg-[var(--color-editorBg)]`}>
                  <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {!(isNormalNoteMode || isFullScreenMode || isEmbedded) && <button type="button" onClick={state.handleClose} className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                        <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                          Esc
                        </span>
                      </button>}
                    </div>

                    <div className="flex-grow flex items-center justify-center gap-2">
                      <div id={toolbarIdRef.current} className={`${state.noteVersionIndex !== 0 ? 'hidden' : 'flex'} items-center justify-center empty:hidden !border-none !p-0`}/>
                    </div>

                    {showTooltip &&
                    ReactDOM.createPortal(<div style={{
                            position: 'fixed',
                            top: `${tooltipPos.top}px`,
                            left: `${tooltipPos.left}px`,
                            zIndex: 2147483647,
                            color: 'var(--color-textPrimary)',
                        }} className="max-w-[calc(100vw-24px)] rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] px-3 py-2 shadow-2xl z-alts-subpopup flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
                          <div className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                              Ctrl
                            </kbd>
                            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                              Shift
                            </kbd>
                            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                              Enter
                            </kbd>
                          </div>
                          <span className="whitespace-nowrap text-[var(--color-textSecondary)] font-medium">
                            to save and create another
                          </span>
                        </div>, document.body)}
                    <div className="flex min-w-[132px] items-center justify-end">
                      {state.activeNoteId && (<button type="button" onClick={handleCreateNew} onMouseEnter={e => {
                        updateCreateAnotherTooltipPosition(e.currentTarget);
                        setShowTooltip(true);
                    }} onFocus={e => {
                        updateCreateAnotherTooltipPosition(e.currentTarget);
                        setShowTooltip(true);
                    }} onMouseLeave={() => setShowTooltip(false)} onBlur={() => setShowTooltip(false)} className="absolute bottom-20 right-6 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none">
                          <span>Create another</span>
                        </button>)}
                    </div>
                  </div>
                </div>)}
            </div>
          </div>)}
      </EditorContainer>

      {!isWidgetMode && (<>
          <DeleteConfirmation isOpen={state.isDeleteDialogOpen} onClose={() => state.setIsDeleteDialogOpen(false)} onConfirm={state.handleDelete} title="Delete Note" description="Are you sure you want to delete this note? This action cannot be undone." zIndex={100005}/>

          <DeleteConfirmation isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleConfirmDeleteFromList} title="Delete Note" description="Are you sure you want to delete this note? This action cannot be undone." zIndex={100005}/>

          <UnsavedChangesDialog isOpen={state.isUnsavedChangesDialogOpen} onDiscard={() => {
                state.discardChanges();
                state.setIsUnsavedChangesDialogOpen(false);
                if (props.onBack)
                    props.onBack();
            }} onSave={async () => {
                const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                if (saved) {
                    state.setIsUnsavedChangesDialogOpen(false);
                    if (props.onBack)
                        props.onBack();
                }
                return saved;
            }} onClose={() => state.setIsUnsavedChangesDialogOpen(false)}/>

          <UnsavedChangesDialog isOpen={isUnsavedLoadDialogOpen} onDiscard={() => {
                state.discardChanges();
                setIsUnsavedLoadDialogOpen(false);
                if (pendingLoadNoteId) {
                    loadNoteIntoEditor(pendingLoadNoteId);
                    setPendingLoadNoteId(null);
                }
            }} onSave={async () => {
                const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                if (saved) {
                    setIsUnsavedLoadDialogOpen(false);
                    if (pendingLoadNoteId) {
                        loadNoteIntoEditor(pendingLoadNoteId);
                        setPendingLoadNoteId(null);
                    }
                }
                return saved;
            }} onClose={() => {
                setIsUnsavedLoadDialogOpen(false);
                setPendingLoadNoteId(null);
            }}/>
        </>)}
    </>);
}
