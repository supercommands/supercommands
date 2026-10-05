/**
 * @file useNoteEditor.ts
 * @description A custom React hook containing state management and logic for the Note editor,
 * including debounced autosaving, Quill editor instance handling, tag sync, deletion, and conflict checks.
 *
 * @usage
 * ```tsx
 * import { useNoteEditor } from './useNoteEditor';
 * const state = useNoteEditor(editorProps);
 * ```
 */
export const baseVersionHistory = {
    lastSavedText: '',
    historyBuffer: [],
    lastCheckpointAt: Date.now(),
};
import { useState, useEffect, useCallback, useRef } from 'react';
import { createNote, updateNote, deleteNote } from './noteData';
import { createTag } from '../tags/tagData';
import type { NoteRecord, CreateNoteInput, UpdateNoteInput } from './noteTypes';
import type { NoteEditorViewProps } from './ui/NoteEditorView';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import { sameTagOrder } from '../../../../shared-components/editorToolbar/tagOrder';
import { normalizeNoteBody, extractTextFromHTML, extractAssetIdsFromHtml } from './noteHelpers';
import { hasNoteDraftContent } from './noteDraftPolicy';
import { getNote } from './noteData';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId, extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';
const AUTOSAVE_DELAY_MS = 400;
const sameTagIds = sameTagOrder;
const noteEditorLog = (...args: unknown[]) => {
    console.log('[NoteEditorLog]', ...args);
};
const summarizeHtml = (html: string) => ({
    length: html.length,
    preview: html.slice(0, 120),
});
const sameString = (a: string | null | undefined, b: string | null | undefined) => a === b;
const sameTagList = sameTagIds;
async function getDraftLocation(collectionOrganisationId?: string | null) {
    const savedOrganisationId = await StorageManager.getItem('lastUsedOrganisationId');
    const organisationId = collectionOrganisationId || savedOrganisationId || (await getSmartDefaultOrganisation())?.id;
    return { organisationId };
}
export function useNoteEditor(props: NoteEditorViewProps) {
    const { noteId, onBack, initialDraftKey, initialDraftContent, initialTagIds, onNoteCreated, saveNoteAdapter, onSavedClose, propertyPersistenceAdapter } = props;
    const resolvedNoteId = noteId && noteId !== 'new' && !noteId.startsWith('temp-')
        ? extractSnippetIdFromCompoundId(noteId) : null;
    const persistenceRef = useRef({ saveNoteAdapter, onSavedClose });
    persistenceRef.current = { saveNoteAdapter, onSavedClose };
    const defaultsGenerationRef = useRef(0);
    const discardRef = useRef(false);
    const liveNoteRef = useRef<NoteRecord | undefined>(undefined);
    const onNoteCreatedRef = useRef(onNoteCreated);
    onNoteCreatedRef.current = onNoteCreated;
    const propertyPersistenceAdapterRef = useRef(propertyPersistenceAdapter);
    propertyPersistenceAdapterRef.current = propertyPersistenceAdapter;
    noteEditorLog('render', {
        incomingNoteId: noteId,
        resolvedNoteId,
        initialDraftKey,
        initialDraftContent: summarizeHtml(initialDraftContent || ''),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const editorRef = useRef<any>(null); // Quill editor instance
    const titleInputRef = useRef<HTMLInputElement>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
    const lastSavedBodyRef = useRef<string>(initialDraftContent || '');
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
    const lastSavedTagIdsRef = useRef<string[]>([]);
    const lastSavedUpdatedAtRef = useRef<number | null>(null);
    // We use this ref to synchronously track ID creation inside save locks
    const activeNoteIdRef = useRef<string | null>(resolvedNoteId);
    const [activeNoteId, setActiveNoteId] = useState<string | null>(resolvedNoteId);
    const [noteVersionIndex, setNoteVersionIndex] = useState<number>(0);
    const [noteTitle, setNoteTitle] = useState<string>(initialDraftKey || '');
    const [noteBody, setNoteBody] = useState<string>(initialDraftContent || '');
    const noteBodyRef = useRef<string>(initialDraftContent || '');
    const [isDirty, setIsDirty] = useState(false);
    const isDirtyRef = useRef(false);
    // Editor state tracking for location and tags
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>(!resolvedNoteId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : []);
    const [isInitialized, setIsInitialized] = useState<boolean>(!resolvedNoteId);
    const [saveStatusRaw, setSaveStatusRaw] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
    const setSaveStatus = useCallback((status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict') => {
        setSaveStatusRaw(status);
    }, []);
    const saveStatus = saveStatusRaw;
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isNoteDeleted, setIsNoteDeleted] = useState(false);
    const hasLoadedLiveNoteRef = useRef(false);
    const [conflictNote, setConflictNote] = useState<NoteRecord | null>(null);
    const hasConflictRef = useRef(false);
    // Save Lock for local images
    const [isSavingImage, setIsSavingImage] = useState(false);
    const activeImageSavesRef = useRef(0);
    const onImageSaveStart = useCallback(() => {
        activeImageSavesRef.current += 1;
        setIsSavingImage(true);
    }, []);
    const onImageSaveEnd = useCallback(() => {
        activeImageSavesRef.current = Math.max(0, activeImageSavesRef.current - 1);
        if (activeImageSavesRef.current === 0) {
            setIsSavingImage(false);
            // Auto-trigger save when image finishes uploading if needed
            scheduleAutosaveRef.current();
        }
    }, []);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);
    // Save Lock to prevent overlapping autosaves
    const isSelfDeletingRef = useRef(false);
    const saveInProgressRef = useRef(false);
    const saveAgainRef = useRef(false);
    const savePromiseRef = useRef<Promise<boolean> | null>(null);
    const pendingSaveOverrideRef = useRef<Partial<SharedProperties> | null>(null);
    const handleSaveRef = useRef<any>(null);
    // Keep track of latest inputs for retry to avoid stale closures!
    const currentInputsRef = useRef({
        noteTitle,
        noteBody: noteBodyRef.current,
        organisationId,
        tagIds,
        isInitialized,
    });
    currentInputsRef.current = { noteTitle, noteBody: noteBodyRef.current, organisationId, tagIds, isInitialized };
    const scheduleAutosaveRef = useRef<() => void>(() => { });
    const clearAutosaveTimer = useCallback(() => {
        if (autosaveTimerRef.current) {
            noteEditorLog('clear autosave timer');
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
    }, []);
    // Initialize draft OR load existing note ID
    useEffect(() => {
        noteEditorLog('init effect start', {
            resolvedNoteId,
            initialDraftKey,
            initialDraftContent: summarizeHtml(initialDraftContent || ''),
        });
        clearAutosaveTimer();
        const generation = ++defaultsGenerationRef.current;
        discardRef.current = false;
        setNoteVersionIndex(0);
        pendingSaveOverrideRef.current = null;
        saveAgainRef.current = false;
        if (resolvedNoteId) {
            noteEditorLog('init existing note', { resolvedNoteId });
            const existingNoteTitle = initialDraftKey || '';
            const existingNoteBody = initialDraftContent || '';
            activeNoteIdRef.current = resolvedNoteId;
            setActiveNoteId(resolvedNoteId);
            setIsInitialized(false);
            setIsNoteDeleted(false);
            hasConflictRef.current = false;
            setConflictNote(null);
            hasLoadedLiveNoteRef.current = false;
            // Reset dirty status and refs so loading a new note starts fresh
            isDirtyRef.current = false;
            setIsDirty(false);
            lastSavedTitleRef.current = existingNoteTitle;
            lastSavedBodyRef.current = existingNoteBody;
            lastSavedOrganisationIdRef.current = null;
            lastSavedTagIdsRef.current = [];
            lastSavedUpdatedAtRef.current = null;
            setNoteTitle(existingNoteTitle);
            setNoteBody(existingNoteBody);
            noteBodyRef.current = existingNoteBody;
            setOrganisationId(null);
            setTagIds([]);
            currentInputsRef.current = {
                noteTitle: existingNoteTitle,
                noteBody: existingNoteBody,
                organisationId: null,
                tagIds: [],
                isInitialized: false,
            };
            setSaveStatus('idle');
            setLastSavedAt(null);
            return;
        }
        activeNoteIdRef.current = null;
        setActiveNoteId(null);
        setNoteTitle(initialDraftKey || '');
        setNoteBody(initialDraftContent || '');
        noteBodyRef.current = initialDraftContent || '';
        isDirtyRef.current = false;
        setIsDirty(false);
        setSaveStatus('idle');
        setLastSavedAt(null);
        // A stale defaults request must never change a subsequently opened note.
        setOrganisationId(null);
        const initDefaults = async () => {
            const { organisationId: defaultOrganisationId } = await getDraftLocation(props.organisationCollectionOrganisationId);
            if (generation !== defaultsGenerationRef.current)
                return;
            setOrganisationId(defaultOrganisationId);
            currentInputsRef.current = { ...currentInputsRef.current, organisationId: defaultOrganisationId, isInitialized: true };
            setIsInitialized(true);
            scheduleAutosaveRef.current();
        };
        setIsInitialized(false);
        void initDefaults().catch(error => {
            if (generation !== defaultsGenerationRef.current)
                return;
            console.error('[useNoteEditor] Default location loading failed', error);
            setSaveStatus('error');
        });
        setTagIds(!resolvedNoteId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : []);
        lastSavedTitleRef.current = initialDraftKey || '';
        lastSavedBodyRef.current = initialDraftContent || '';
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = [];
        lastSavedUpdatedAtRef.current = null;
        currentInputsRef.current = {
            noteTitle: initialDraftKey || '',
            noteBody: initialDraftContent || '',
            organisationId: null,
            tagIds: Array.from(new Set(initialTagIds || [])),
            isInitialized: false,
        };
        const hasDraftContent = hasNoteDraftContent(initialDraftKey || '', initialDraftContent || '');
        isDirtyRef.current = hasDraftContent;
        setIsDirty(hasDraftContent);
        setSaveStatus(hasDraftContent ? 'saving' : 'idle');
        setIsNoteDeleted(false);
        hasLoadedLiveNoteRef.current = true;
        noteEditorLog('init draft ready', {
            title: initialDraftKey || '',
            body: summarizeHtml(initialDraftContent || ''),
        });
    }, [resolvedNoteId, initialDraftKey, initialDraftContent, clearAutosaveTimer, props.organisationCollectionOrganisationId, props.initialDraftInstanceId]);
    // Removed properties effect
    // Content and history are read together through the domain layer, including
    // compound IDs and legacy record projections. Dexie tracks all queried tables.
    const loadedNote = useLiveQuery(async () => {
        const id = activeNoteId;
        if (!id)
            return { id, note: undefined, error: null as Error | null };
        try {
            return { id, note: await getNote(id), error: null as Error | null };
        }
        catch (error) {
            return { id, note: undefined, error: error instanceof Error ? error : new Error(String(error)) };
        }
    }, [activeNoteId]);
    const isNoteResolved = loadedNote?.id === activeNoteId;
    const liveNote = isNoteResolved ? loadedNote?.note : undefined;
    const loadError = isNoteResolved ? loadedNote?.error : null;
    liveNoteRef.current = liveNote;
    // A draft already has its local content when its first save assigns an ID.
    // Keep Quill mounted while the subscription catches up, preserving typing/focus.
    const isLoading = Boolean(activeNoteId && !isInitialized && (!isNoteResolved || liveNote));
    const isNoteMissing = Boolean(activeNoteId && isNoteResolved && !liveNote && !loadError);
    const handleSave = useCallback(async (silent: boolean = false, overrideProps?: Partial<SharedProperties> | null): Promise<boolean> => {
        const mergeOverrides = (current: Partial<SharedProperties> | null | undefined, next: Partial<SharedProperties> | null | undefined): Partial<SharedProperties> | null => {
            if (!current && !next)
                return null;
            return {
                ...(current || {}),
                ...(next || {}),
                selectedTags: next?.selectedTags ?? current?.selectedTags,
            };
        };
        const effectiveOverrideProps = mergeOverrides(pendingSaveOverrideRef.current, overrideProps);
        pendingSaveOverrideRef.current = null;
        noteEditorLog('handleSave called', {
            silent,
            overrideProps: effectiveOverrideProps,
            activeNoteId: activeNoteIdRef.current,
            conflict: hasConflictRef.current,
            saveInProgress: saveInProgressRef.current,
            savePending: Boolean(savePromiseRef.current),
            currentInputs: {
                noteTitle: currentInputsRef.current.noteTitle,
                noteBody: summarizeHtml(currentInputsRef.current.noteBody),
                organisationId: currentInputsRef.current.organisationId,
                tagIds: currentInputsRef.current.tagIds,
                isInitialized: currentInputsRef.current.isInitialized,
            },
        });
        if (discardRef.current)
            return false;
        if (hasConflictRef.current) {
            noteEditorLog('handleSave blocked by conflict');
            return false;
        }
        clearAutosaveTimer();
        const { noteTitle: currentTitle, noteBody: currentBody, organisationId: currentWsId, tagIds: currentTIds, isInitialized: currentIsInit, } = currentInputsRef.current;
        const hasTitle = currentTitle.trim().length > 0;
        const hasBody = normalizeNoteBody(currentBody).trim().length > 0;
        const currentNoteId = activeNoteIdRef.current;
        const savingNoteId = currentNoteId;
        noteEditorLog('handleSave snapshot', {
            currentNoteId,
            hasTitle,
            hasBody,
            currentIsInit,
            noteTitle,
            noteBody: summarizeHtml(currentBody),
            organisationId: currentWsId,
            tagIds: currentTIds,
        });
        if (!currentIsInit) {
            noteEditorLog('handleSave deferred until init completes', { currentNoteId });
            if (!silent)
                setSaveStatus('saving');
            pendingSaveOverrideRef.current = mergeOverrides(pendingSaveOverrideRef.current, effectiveOverrideProps);
            saveAgainRef.current = true;
            return false;
        }
        if (activeImageSavesRef.current > 0) {
            noteEditorLog('handleSave deferred because image is actively saving');
            if (!silent)
                setSaveStatus('saving');
            pendingSaveOverrideRef.current = mergeOverrides(pendingSaveOverrideRef.current, effectiveOverrideProps);
            saveAgainRef.current = true;
            return false;
        }
        const hasTags = (effectiveOverrideProps?.selectedTags ?? currentTIds).length > 0;
        if (!currentNoteId && !hasNoteDraftContent(currentTitle, currentBody)) {
            noteEditorLog('handleSave skipped for empty draft');
            pendingSaveOverrideRef.current = null;
            isDirtyRef.current = false;
            setIsDirty(false);
            setSaveStatus('idle');
            // Nothing needs saving. Let Close/navigation/Create-another continue.
            return true;
        }
        if (currentNoteId && !hasTitle && !hasBody && !hasTags) {
            noteEditorLog('handleSave deleting empty note', { currentNoteId });
            if (savePromiseRef.current) {
                saveAgainRef.current = true;
                return savePromiseRef.current;
            }
            const performDelete = async (): Promise<boolean> => {
                if (discardRef.current)
                    return false;
                saveInProgressRef.current = true;
                try {
                    await deleteNote(currentNoteId);
                    noteEditorLog('auto delete success', { currentNoteId });
                    if (activeNoteIdRef.current === savingNoteId) {
                        activeNoteIdRef.current = null;
                        setActiveNoteId(null);
                        setIsNoteDeleted(false);
                        lastSavedTitleRef.current = '';
                        lastSavedBodyRef.current = '';
                        lastSavedOrganisationIdRef.current = null;
                        lastSavedTagIdsRef.current = [];
                        lastSavedUpdatedAtRef.current = null;
                        clearAutosaveTimer();
                        setSaveStatus('idle');
                        setLastSavedAt(null);
                        isDirtyRef.current = false;
                        setIsDirty(false);
                    }
                    return true;
                }
                catch (err) {
                    console.error('[useNoteEditor] Auto-delete failed:', err);
                    noteEditorLog('auto delete failed', { currentNoteId, err });
                    setSaveStatus('error');
                    return false;
                }
                finally {
                    saveInProgressRef.current = false;
                    savePromiseRef.current = null;
                    if (saveAgainRef.current && !hasConflictRef.current) {
                        saveAgainRef.current = false;
                        scheduleAutosaveRef.current();
                    }
                }
            };
            savePromiseRef.current = performDelete();
            return savePromiseRef.current;
        }
        if (savePromiseRef.current) {
            noteEditorLog('handleSave reusing in-flight promise', {
                saveInProgress: saveInProgressRef.current,
                saveAgain: saveAgainRef.current,
                pendingOverride: Boolean(pendingSaveOverrideRef.current),
            });
            pendingSaveOverrideRef.current = mergeOverrides(pendingSaveOverrideRef.current, effectiveOverrideProps);
            saveAgainRef.current = true;
            return savePromiseRef.current;
        }
        const performSave = async (): Promise<boolean> => {
            if (discardRef.current)
                return false;
            noteEditorLog('performSave start', {
                currentNoteId,
                savingNoteId,
                silent,
                overrideProps: effectiveOverrideProps,
            });
            saveInProgressRef.current = true;
            if (!silent)
                setSaveStatus('saving');
            let activeOrganisationId = currentWsId;
            let activeTagIds = currentTIds;
            if (effectiveOverrideProps) {
                if (effectiveOverrideProps.organisationId !== undefined)
                    activeOrganisationId = effectiveOverrideProps.organisationId;
                if (effectiveOverrideProps.selectedTags)
                    activeTagIds = effectiveOverrideProps.selectedTags.map(t => t.id);
            }
            const snapshotTagIds = [...activeTagIds];
            try {
                // Convert temporary tag IDs before any record is written.
                const finalOrganisationId = activeOrganisationId || (await getSmartDefaultOrganisation())?.id;
                if (finalOrganisationId) {
                    const resolvedTagIds: string[] = [];
                    for (const tId of activeTagIds) {
                        if (tId.startsWith('temp_')) {
                            const tagName = tId.replace('temp_', '');
                            try {
                                const newTag = propertyPersistenceAdapterRef.current?.createTag
                                    ? await propertyPersistenceAdapterRef.current.createTag({ name: tagName })
                                    : await createTag(tagName);
                                resolvedTagIds.push(newTag.id);
                            }
                            catch (e) {
                                console.error('Failed to create temp tag', e);
                                throw e;
                            }
                        }
                        else {
                            resolvedTagIds.push(tId);
                        }
                    }
                    activeTagIds = resolvedTagIds;
                }
                if (discardRef.current)
                    return false;
                let savedNote: NoteRecord;
                if (!currentNoteId) {
                    const input: CreateNoteInput = {
                        organisationId: activeOrganisationId ?? undefined,
                        title: currentTitle,
                        body: currentBody,
                        tagIds: activeTagIds,
                        assetIds: extractAssetIdsFromHtml(currentBody),
                    };
                    noteEditorLog('creating note', {
                        input: {
                            ...input,
                            body: summarizeHtml(input.body),
                        },
                    });
                    savedNote = persistenceRef.current.saveNoteAdapter
                        ? await persistenceRef.current.saveNoteAdapter({ mode: 'create', input })
                        : await createNote(input);
                    noteEditorLog('createNote success', {
                        savedId: savedNote.id,
                        updatedAt: savedNote.updatedAt,
                    });
                    if (onNoteCreatedRef.current) {
                        try {
                            await onNoteCreatedRef.current(savedNote);
                        }
                        catch (err) {
                            console.error('[useNoteEditor] onNoteCreated callback failed:', err);
                        }
                    }
                }
                else {
                    const input: UpdateNoteInput = {
                        expectedUpdatedAt: lastSavedUpdatedAtRef.current ?? undefined,
                    };
                    if (currentTitle !== lastSavedTitleRef.current)
                        input.title = currentTitle;
                    if (normalizeNoteBody(currentBody) !== normalizeNoteBody(lastSavedBodyRef.current)) {
                        input.body = currentBody;
                        input.assetIds = extractAssetIdsFromHtml(currentBody);
                    }
                    if (activeOrganisationId !== lastSavedOrganisationIdRef.current)
                        input.organisationId = activeOrganisationId ?? undefined;
                    if (!sameTagIds(activeTagIds, lastSavedTagIdsRef.current))
                        input.tagIds = activeTagIds;
                    if (Object.keys(input).length <= 1) {
                        noteEditorLog('update skipped, no field changes', {
                            currentNoteId,
                            lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
                        });
                        hasConflictRef.current = false;
                        setConflictNote(null);
                        isDirtyRef.current = false;
                        setIsDirty(false);
                        setSaveStatus('saved');
                        if (lastSavedUpdatedAtRef.current !== null) {
                            setLastSavedAt(new Date(lastSavedUpdatedAtRef.current));
                        }
                        return true;
                    }
                    noteEditorLog('updating note', {
                        noteId: currentNoteId,
                        input: {
                            ...input,
                            body: input.body ? summarizeHtml(input.body) : undefined,
                        },
                    });
                    const oldCompoundId = getItemCompoundId({
                        id: currentNoteId,
                        organisation_id: lastSavedOrganisationIdRef.current,
                        category: (liveNoteRef.current as any)?.sourceType || 'note',
                    });
                    savedNote = persistenceRef.current.saveNoteAdapter
                        ? await persistenceRef.current.saveNoteAdapter({ mode: 'update', noteId: currentNoteId, input })
                        : await updateNote(currentNoteId, input);
                    const newCompoundId = getItemCompoundId({
                        id: savedNote.id,
                        organisation_id: savedNote.organisationId,
                        category: 'note',
                    });
                    if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
                        await migrateItemCompoundId(oldCompoundId, newCompoundId, (liveNoteRef.current as any)?.sourceType || 'note');
                    }
                    noteEditorLog('updateNote success', {
                        savedId: savedNote.id,
                        updatedAt: savedNote.updatedAt,
                    });
                }
                if (persistenceRef.current.onSavedClose && !silent) {
                    persistenceRef.current.onSavedClose();
                }
                const activeNoteChangedDuringSave = currentNoteId
                    ? activeNoteIdRef.current !== savingNoteId
                    : activeNoteIdRef.current !== null && activeNoteIdRef.current !== savedNote.id;
                noteEditorLog('save result active-note check', {
                    currentNoteId,
                    savingNoteId,
                    activeNow: activeNoteIdRef.current,
                    savedId: savedNote.id,
                    ignored: activeNoteChangedDuringSave,
                    savedTagIds: savedNote.tagIds,
                    activeTagIds,
                    snapshotTagIds,
                });
                if (activeNoteChangedDuringSave) {
                    noteEditorLog('save result ignored because active note changed', {
                        savingNoteId,
                        activeNow: activeNoteIdRef.current,
                        savedId: savedNote.id,
                    });
                    return true;
                }
                if (!currentNoteId) {
                    activeNoteIdRef.current = savedNote.id;
                    setActiveNoteId(savedNote.id);
                    hasLoadedLiveNoteRef.current = false;
                    noteEditorLog('switched draft to saved note id', { savedId: savedNote.id });
                }
                const currentTagIdsKey = currentInputsRef.current.tagIds.join(',');
                const snapshotMatches = {
                    title: currentInputsRef.current.noteTitle === currentTitle,
                    body: currentInputsRef.current.noteBody === currentBody,
                    organisation: currentInputsRef.current.organisationId === activeOrganisationId,
                    init: currentInputsRef.current.isInitialized === currentIsInit,
                    tags: currentTagIdsKey === activeTagIds.join(',') ||
                        currentTagIdsKey === snapshotTagIds.join(','),
                };
                const stillMatchesSnapshot = Object.values(snapshotMatches).every(Boolean);
                if (currentInputsRef.current.organisationId === activeOrganisationId) {
                    setOrganisationId(savedNote.organisationId);
                    currentInputsRef.current = {
                        ...currentInputsRef.current,
                        organisationId: savedNote.organisationId,
                    };
                }
                {
                    currentInputsRef.current = {
                        ...currentInputsRef.current,
                    };
                }
                if (sameTagIds(currentInputsRef.current.tagIds, activeTagIds) ||
                    sameTagIds(currentInputsRef.current.tagIds, snapshotTagIds)) {
                    setTagIds(savedNote.tagIds);
                    currentInputsRef.current = {
                        ...currentInputsRef.current,
                        tagIds: savedNote.tagIds,
                    };
                }
                if (currentInputsRef.current.noteTitle === currentTitle) {
                    if (currentInputsRef.current.noteTitle.trim() !== savedNote.title.trim()) {
                        setNoteTitle(savedNote.title);
                        currentInputsRef.current = {
                            ...currentInputsRef.current,
                            noteTitle: savedNote.title,
                        };
                    }
                }
                if (currentInputsRef.current.noteBody === currentBody) {
                    if (normalizeNoteBody(currentInputsRef.current.noteBody) !== savedNote.body) {
                        const editorHasFocus = Boolean(editorRef.current?.hasFocus?.());
                        if (!editorHasFocus) {
                            noteBodyRef.current = savedNote.body;
                            setNoteBody(savedNote.body);
                            currentInputsRef.current = {
                                ...currentInputsRef.current,
                                noteBody: savedNote.body,
                            };
                        }
                    }
                }
                lastSavedTitleRef.current = savedNote.title;
                lastSavedBodyRef.current = savedNote.body;
                lastSavedOrganisationIdRef.current = savedNote.organisationId;
                lastSavedTagIdsRef.current = savedNote.tagIds;
                lastSavedUpdatedAtRef.current = savedNote.updatedAt;
                hasConflictRef.current = false;
                noteEditorLog('save canonical refs updated', {
                    savedId: savedNote.id,
                    lastSavedUpdatedAt: savedNote.updatedAt,
                    organisationId: savedNote.organisationId,
                    tagCount: savedNote.tagIds.length,
                });
                if (savedNote.organisationId)
                    StorageManager.setItem('lastUsedOrganisationId', savedNote.organisationId);
                setLastSavedAt(new Date(savedNote.updatedAt));
                setConflictNote(null);
                const currentMatchesSavedNote = currentInputsRef.current.noteTitle === savedNote.title &&
                    normalizeNoteBody(currentInputsRef.current.noteBody) === normalizeNoteBody(savedNote.body) &&
                    currentInputsRef.current.organisationId === savedNote.organisationId
                    &&
                        sameTagIds(currentInputsRef.current.tagIds, savedNote.tagIds);
                if (stillMatchesSnapshot || currentMatchesSavedNote) {
                    noteEditorLog('save completed and snapshot matched');
                    isDirtyRef.current = false;
                    setIsDirty(false);
                    setSaveStatus('saved');
                }
                else {
                    noteEditorLog('save completed but snapshot moved, scheduling another autosave');
                    isDirtyRef.current = true;
                    setIsDirty(true);
                    setSaveStatus('saving');
                    scheduleAutosaveRef.current();
                }
                return true;
            }
            catch (err: any) {
                if (err.name === 'ConflictError') {
                    console.warn('Conflict detected:', err.message);
                    noteEditorLog('conflict detected', {
                        message: err.message,
                        remoteUpdatedAt: err.remoteNote?.updatedAt,
                        remoteId: err.remoteNote?.id,
                    });
                    hasConflictRef.current = true;
                    clearAutosaveTimer();
                    setSaveStatus('conflict');
                    setConflictNote(err.remoteNote ?? liveNoteRef.current ?? null);
                    isDirtyRef.current = true;
                    setIsDirty(true);
                    return false;
                }
                console.error('Save failed:', err);
                noteEditorLog('save failed', { err });
                setSaveStatus('error');
                return false;
            }
            finally {
                saveInProgressRef.current = false;
                savePromiseRef.current = null;
                noteEditorLog('performSave finished', {
                    activeNoteId: activeNoteIdRef.current,
                    saveAgain: saveAgainRef.current,
                    hasConflict: hasConflictRef.current,
                });
                if (saveAgainRef.current && !hasConflictRef.current) {
                    saveAgainRef.current = false;
                    scheduleAutosaveRef.current();
                }
            }
        };
        savePromiseRef.current = Promise.resolve().then(performSave);
        return savePromiseRef.current;
    }, []);
    const scheduleAutosave = useCallback(() => {
        if (hasConflictRef.current || discardRef.current)
            return;
        noteEditorLog('scheduleAutosave', {
            activeNoteId: activeNoteIdRef.current,
            noteTitle: currentInputsRef.current.noteTitle,
            noteBody: summarizeHtml(currentInputsRef.current.noteBody),
            organisationId: currentInputsRef.current.organisationId,
            tagCount: currentInputsRef.current.tagIds.length,
            isInitialized: currentInputsRef.current.isInitialized,
        });
        if (!isDirtyRef.current) {
            return;
        }
        clearAutosaveTimer();
        autosaveTimerRef.current = setTimeout(() => {
            noteEditorLog('autosave timer fired');
            void handleSave();
        }, AUTOSAVE_DELAY_MS);
    }, [clearAutosaveTimer, handleSave]);
    scheduleAutosaveRef.current = scheduleAutosave;
    useEffect(() => {
        return () => {
            ++defaultsGenerationRef.current;
            clearAutosaveTimer();
            if (isDirtyRef.current && !hasConflictRef.current && !discardRef.current) {
                void handleSaveRef.current?.(true);
            }
        };
    }, [clearAutosaveTimer]);
    const handleBodyChange = useCallback((html: string) => {
        // If the content is effectively empty in both previous and new state, ignore it
        const isNewEmpty = extractTextFromHTML(html) === '' && !html.includes('<img');
        const isPrevEmpty = extractTextFromHTML(noteBodyRef.current) === '' && !noteBodyRef.current.includes('<img');
        if (isNewEmpty && isPrevEmpty) {
            return;
        }
        if (sameString(normalizeNoteBody(noteBodyRef.current), normalizeNoteBody(html))) {
            return;
        }
        noteEditorLog('body change', {
            activeNoteId: activeNoteIdRef.current,
            body: summarizeHtml(html),
        });
        setNoteBody(html);
        noteBodyRef.current = html;
        currentInputsRef.current.noteBody = html;
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveStatus('saving');
        if (!hasConflictRef.current)
            scheduleAutosave();
    }, [scheduleAutosave]);
    const handleTitleChange = useCallback((title: string) => {
        if (sameString(noteTitle, title))
            return;
        noteEditorLog('title change', {
            activeNoteId: activeNoteIdRef.current,
            title,
        });
        setNoteTitle(title);
        currentInputsRef.current = {
            ...currentInputsRef.current,
            noteTitle: title,
        };
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveStatus('saving');
        if (!hasConflictRef.current)
            scheduleAutosave();
    }, [scheduleAutosave, noteTitle]);
    handleSaveRef.current = handleSave;
    const handleDelete = useCallback(async () => {
        const currentNoteId = activeNoteIdRef.current;
        noteEditorLog('handleDelete', { currentNoteId });
        if (!currentNoteId) {
            clearAutosaveTimer();
            if (onBack)
                onBack();
            return;
        }
        setIsDeleteDialogOpen(false);
        clearAutosaveTimer();
        try {
            await deleteNote(currentNoteId);
            noteEditorLog('delete success', { currentNoteId });
            setIsNoteDeleted(true);
        }
        catch (msg) {
            console.error('Delete failed:', msg);
            noteEditorLog('delete failed', { currentNoteId, msg });
        }
    }, [onBack]);
    const handleClose = useCallback(() => {
        const hasTitle = noteTitle.trim().length > 0;
        const hasBody = extractTextFromHTML(noteBodyRef.current).trim().length > 0;
        noteEditorLog('handleClose', {
            activeNoteId: activeNoteIdRef.current,
            isDirty: isDirtyRef.current,
            hasTitle,
            hasBody,
        });
        if (isDirtyRef.current && (hasNoteDraftContent(noteTitle, noteBodyRef.current) || activeNoteIdRef.current)) {
            setIsUnsavedChangesDialogOpen(true);
        }
        else {
            if (onBack)
                onBack();
        }
    }, [onBack, noteTitle]);
    // If liveNote is fetched from IndexedDB, update the editor if we aren't currently dirty
    useEffect(() => {
        if (activeNoteId && isNoteResolved && !loadError && hasLoadedLiveNoteRef.current && liveNote === undefined) {
            noteEditorLog('live note missing, treated as deleted', { activeNoteId });
            setIsNoteDeleted(true);
            clearAutosaveTimer();
            isDirtyRef.current = false;
            setIsDirty(false);
            setSaveStatus('error');
            activeNoteIdRef.current = null;
            setActiveNoteId(null);
            return;
        }
        if (!liveNote || savePromiseRef.current)
            return;
        hasLoadedLiveNoteRef.current = true;
        noteEditorLog('live note received', {
            activeNoteId,
            liveId: liveNote.id,
            liveUpdatedAt: liveNote.updatedAt,
            lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
            isDirty: isDirtyRef.current,
            initialized: isInitialized,
        });
        if (isInitialized &&
            lastSavedUpdatedAtRef.current !== null &&
            liveNote.updatedAt <= lastSavedUpdatedAtRef.current) {
            noteEditorLog('live note ignored because it is not newer than last saved', {
                liveUpdatedAt: liveNote.updatedAt,
                lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
            });
            setIsNoteDeleted(false);
            return;
        }
        if (isDirtyRef.current &&
            lastSavedUpdatedAtRef.current !== null &&
            liveNote.updatedAt > lastSavedUpdatedAtRef.current) {
            noteEditorLog('live note arrived while dirty, checking field-level merge');
            const localTitleChanged = currentInputsRef.current.noteTitle !== lastSavedTitleRef.current;
            const localBodyChanged = currentInputsRef.current.noteBody !== lastSavedBodyRef.current;
            const localWsChanged = currentInputsRef.current.organisationId !== lastSavedOrganisationIdRef.current;
            const localTagsChanged = !sameTagIds(currentInputsRef.current.tagIds, lastSavedTagIdsRef.current);
            const remoteTitleChanged = liveNote.title !== lastSavedTitleRef.current;
            const remoteBodyChanged = normalizeNoteBody(liveNote.body) !== normalizeNoteBody(lastSavedBodyRef.current);
            const remoteWsChanged = liveNote.organisationId !== lastSavedOrganisationIdRef.current;
            const remoteTagsChanged = !sameTagIds(liveNote.tagIds, lastSavedTagIdsRef.current);
            const hasAnyConflict = (localTitleChanged && remoteTitleChanged && currentInputsRef.current.noteTitle !== liveNote.title) ||
                (localBodyChanged && remoteBodyChanged && normalizeNoteBody(currentInputsRef.current.noteBody) !== normalizeNoteBody(liveNote.body)) ||
                (localWsChanged && remoteWsChanged && currentInputsRef.current.organisationId !== liveNote.organisationId)
                ||
                    (localTagsChanged && remoteTagsChanged && !sameTagIds(currentInputsRef.current.tagIds, liveNote.tagIds));
            if (hasAnyConflict) {
                noteEditorLog('live note conflict detected', {
                    localTitleChanged,
                    localBodyChanged,
                    localWsChanged,
                    localTagsChanged,
                    remoteTitleChanged,
                    remoteBodyChanged,
                    remoteWsChanged,
                    remoteTagsChanged,
                });
                hasConflictRef.current = true;
                setConflictNote(liveNote);
                clearAutosaveTimer();
                setSaveStatus('conflict');
                return;
            }
            // Field-level merge: Apply remote changes that don't conflict with local edits
            if (remoteTitleChanged) {
                noteEditorLog('merging remote title');
                setNoteTitle(liveNote.title);
                currentInputsRef.current.noteTitle = liveNote.title;
            }
            if (remoteBodyChanged) {
                noteEditorLog('merging remote body');
                setNoteBody(liveNote.body);
                noteBodyRef.current = liveNote.body;
                currentInputsRef.current.noteBody = liveNote.body;
            }
            if (remoteWsChanged) {
                noteEditorLog('merging remote workspace');
                setOrganisationId(liveNote.organisationId);
                currentInputsRef.current.organisationId = liveNote.organisationId;
            }
            if (remoteTagsChanged) {
                noteEditorLog('merging remote tags');
                setTagIds(liveNote.tagIds);
                currentInputsRef.current.tagIds = liveNote.tagIds;
            }
            // Update base refs to remote so our next save applies cleanly on top of it
            lastSavedTitleRef.current = liveNote.title;
            lastSavedBodyRef.current = liveNote.body;
            lastSavedOrganisationIdRef.current = liveNote.organisationId;
            lastSavedTagIdsRef.current = liveNote.tagIds;
            lastSavedUpdatedAtRef.current = liveNote.updatedAt;
            setLastSavedAt(new Date(liveNote.updatedAt));
            // We are still dirty because we have non-conflicting local changes that need to be saved
            noteEditorLog('post-merge autosave scheduled');
            scheduleAutosave();
            return;
        }
        if (!isInitialized) {
            // First load of an existing note
            noteEditorLog('first live load for existing note', {
                activeNoteId,
                liveId: liveNote.id,
                isDirty: isDirtyRef.current,
            });
            const hasLocalEdits = isDirtyRef.current;
            if (!hasLocalEdits) {
                setNoteTitle(liveNote.title);
                setNoteBody(liveNote.body);
                noteBodyRef.current = liveNote.body;
                setOrganisationId(liveNote.organisationId);
                setTagIds(liveNote.tagIds);
                currentInputsRef.current = {
                    noteTitle: liveNote.title,
                    noteBody: liveNote.body,
                    organisationId: liveNote.organisationId,
                    tagIds: liveNote.tagIds,
                    isInitialized: true,
                };
            }
            lastSavedTitleRef.current = liveNote.title || '';
            lastSavedBodyRef.current = liveNote.body || (liveNote as any).content || '';
            lastSavedOrganisationIdRef.current = liveNote.organisationId;
            lastSavedTagIdsRef.current = liveNote.tagIds;
            lastSavedUpdatedAtRef.current = liveNote.updatedAt;
            if (!hasLocalEdits) {
                currentInputsRef.current = {
                    noteTitle: liveNote.title,
                    noteBody: liveNote.body,
                    organisationId: liveNote.organisationId,
                    tagIds: liveNote.tagIds,
                    isInitialized: true,
                };
            }
            else {
                currentInputsRef.current = {
                    ...currentInputsRef.current,
                    isInitialized: true,
                };
            }
            hasConflictRef.current = false;
            setConflictNote(null);
            setLastSavedAt(new Date(liveNote.updatedAt));
            setSaveStatus(hasLocalEdits ? 'saving' : 'saved');
            isDirtyRef.current = hasLocalEdits;
            setIsDirty(hasLocalEdits);
            setIsInitialized(true);
            if ((saveAgainRef.current || hasLocalEdits) && !hasConflictRef.current) {
                saveAgainRef.current = false;
                noteEditorLog('first load requests autosave retry', {
                    saveAgain: saveAgainRef.current,
                    hasLocalEdits,
                });
                scheduleAutosave();
            }
        }
        else if (!isDirtyRef.current) {
            // Background sync from other tabs
            noteEditorLog('background sync applied', {
                liveId: liveNote.id,
                liveUpdatedAt: liveNote.updatedAt,
            });
            setNoteTitle(liveNote.title);
            setNoteBody(liveNote.body);
            noteBodyRef.current = liveNote.body;
            setOrganisationId(liveNote.organisationId);
            setTagIds(liveNote.tagIds);
            lastSavedTitleRef.current = liveNote.title;
            lastSavedBodyRef.current = liveNote.body;
            lastSavedOrganisationIdRef.current = liveNote.organisationId;
            lastSavedTagIdsRef.current = liveNote.tagIds;
            currentInputsRef.current = {
                noteTitle: liveNote.title,
                noteBody: liveNote.body,
                organisationId: liveNote.organisationId,
                tagIds: liveNote.tagIds,
                isInitialized: true,
            };
            setLastSavedAt(new Date(liveNote.updatedAt));
            setSaveStatus('saved');
            lastSavedUpdatedAtRef.current = liveNote.updatedAt;
            hasConflictRef.current = false;
            setConflictNote(null);
        }
        setIsNoteDeleted(false);
    }, [activeNoteId, clearAutosaveTimer, isInitialized, liveNote, isNoteResolved, loadError, saveStatusRaw]);
    const handlePropertiesChange = useCallback((newProps: Partial<SharedProperties>) => {
        noteEditorLog('properties change', {
            activeNoteId: activeNoteIdRef.current,
            organisationId: newProps.organisationId,
            selectedTagsCount: newProps.selectedTags?.length ?? 0,
        });
        const prevWsId = currentInputsRef.current.organisationId;
        let wId = prevWsId;
        let tIds = currentInputsRef.current.tagIds;
        if (newProps.organisationId !== undefined)
            wId = newProps.organisationId;
        if (newProps.selectedTags)
            tIds = newProps.selectedTags.map((t: any) => t.id);
        const tagsChanged = !sameTagList(tIds, currentInputsRef.current.tagIds);
        const organisationChanged = !sameString(wId, prevWsId);
        const locationChanged = organisationChanged;
        const propertiesChanged = tagsChanged || locationChanged;
        if (!propertiesChanged) {
            return;
        }
        setOrganisationId(wId);
        setTagIds(tIds);
        if (!isDirtyRef.current) {
            isDirtyRef.current = true;
            setIsDirty(true);
        }
        currentInputsRef.current = {
            ...currentInputsRef.current,
            organisationId: wId,
            tagIds: tIds,
        };
        // Persist changes to StorageManager for defaults
        if (wId)
            StorageManager.setItem('lastUsedOrganisationId', wId);
        noteEditorLog('properties persisted locally', {
            organisationId: wId,
            tagIds: tIds,
        });
        setSaveStatus('saving');
        if (!hasConflictRef.current) {
            void handleSave(true, newProps);
        }
    }, [handleSave]);
    const resolveConflictWithRemote = useCallback(() => {
        if (!conflictNote)
            return;
        noteEditorLog('resolve conflict with remote', {
            conflictId: conflictNote.id,
            conflictUpdatedAt: conflictNote.updatedAt,
        });
        setNoteTitle(conflictNote.title);
        setNoteBody(conflictNote.body);
        noteBodyRef.current = conflictNote.body;
        setOrganisationId(conflictNote.organisationId);
        setTagIds(conflictNote.tagIds);
        currentInputsRef.current = {
            noteTitle: conflictNote.title,
            noteBody: conflictNote.body,
            organisationId: conflictNote.organisationId,
            tagIds: conflictNote.tagIds,
            isInitialized: true,
        };
        lastSavedTitleRef.current = conflictNote.title;
        lastSavedBodyRef.current = conflictNote.body;
        lastSavedOrganisationIdRef.current = conflictNote.organisationId;
        lastSavedTagIdsRef.current = conflictNote.tagIds;
        lastSavedUpdatedAtRef.current = conflictNote.updatedAt;
        isDirtyRef.current = false;
        setIsDirty(false);
        setConflictNote(null);
        hasConflictRef.current = false;
        setSaveStatus('saved');
        setLastSavedAt(new Date(conflictNote.updatedAt));
    }, [conflictNote]);
    const keepLocalVersion = useCallback(async () => {
        if (!conflictNote)
            return false;
        noteEditorLog('keep local version requested', {
            conflictId: conflictNote.id,
            conflictUpdatedAt: conflictNote.updatedAt,
        });
        const currentId = activeNoteIdRef.current;
        const latestRemote = currentId ? await getNote(currentId) : null;
        lastSavedUpdatedAtRef.current = latestRemote?.updatedAt ?? conflictNote.updatedAt;
        hasConflictRef.current = false;
        setConflictNote(null);
        setSaveStatus('saving');
        return handleSave();
    }, [conflictNote, handleSave]);
    const resetEditor = useCallback(() => {
        const generation = ++defaultsGenerationRef.current;
        discardRef.current = false;
        setNoteVersionIndex(0);
        pendingSaveOverrideRef.current = null;
        saveAgainRef.current = false;
        activeNoteIdRef.current = null;
        setActiveNoteId(null);
        setNoteTitle('');
        setNoteBody('');
        noteBodyRef.current = '';
        isDirtyRef.current = false;
        setIsDirty(false);
        setIsUnsavedChangesDialogOpen(false);
        setSaveStatus('idle');
        setLastSavedAt(null);
        hasLoadedLiveNoteRef.current = true;
        hasConflictRef.current = false;
        setConflictNote(null);
        setIsNoteDeleted(false);
        setIsInitialized(true);
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        lastSavedTitleRef.current = '';
        lastSavedBodyRef.current = '';
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = [];
        lastSavedUpdatedAtRef.current = null;
        const initDefaults = async () => {
            const { organisationId: wId } = await getDraftLocation(props.organisationCollectionOrganisationId);
            if (generation !== defaultsGenerationRef.current)
                return;
            setOrganisationId(wId);
            currentInputsRef.current = { ...currentInputsRef.current, organisationId: wId, isInitialized: true };
            setIsInitialized(true);
            scheduleAutosaveRef.current();
        };
        setOrganisationId(null);
        setIsInitialized(false);
        void initDefaults().catch(error => {
            if (generation === defaultsGenerationRef.current)
                setSaveStatus('error');
            console.error('[useNoteEditor] Reset defaults failed', error);
        });
        setTagIds([]);
        currentInputsRef.current = {
            noteTitle: '',
            noteBody: '',
            organisationId: null,
            tagIds: [],
            isInitialized: false,
        };
    }, [props.organisationCollectionOrganisationId]);
    const flushSave = useCallback(async () => {
        while (savePromiseRef.current || isDirtyRef.current) {
            if (savePromiseRef.current) {
                await savePromiseRef.current;
            }
            if (isDirtyRef.current) {
                const saved = await handleSave(false);
                if (!saved || hasConflictRef.current)
                    return false;
            }
        }
        return !isDirtyRef.current && !hasConflictRef.current;
    }, [handleSave]);
    const discardChanges = useCallback(() => {
        discardRef.current = true;
        ++defaultsGenerationRef.current;
        clearAutosaveTimer();
        pendingSaveOverrideRef.current = null;
        saveAgainRef.current = false;
        isDirtyRef.current = false;
        setIsDirty(false);
    }, [clearAutosaveTimer]);
    const getCurrentNote = useCallback(() => ({ id: activeNoteIdRef.current, ...currentInputsRef.current }), []);
    const syncRevision = liveNote?.updatedAt ?? 0;
    return {
        setNoteVersionIndex,
        noteVersionIndex,
        noteTitle,
        noteBody,
        activeNoteId,
        liveNote,
        isLoading,
        isNoteMissing,
        loadError,
        discardChanges,
        getCurrentNote,
        isNoteDeleted,
        organisationId,
        tagIds,
        saveStatus,
        lastSavedAt,
        isDirty,
        isDeleteDialogOpen,
        isUnsavedChangesDialogOpen,
        conflictNote,
        editorRef,
        titleInputRef,
        setNoteTitle: handleTitleChange,
        setNoteBody: handleBodyChange,
        handleSave,
        flushSave,
        handleDelete,
        handleClose,
        setIsNoteDeleted,
        setIsDeleteDialogOpen,
        setIsUnsavedChangesDialogOpen,
        handlePropertiesChange,
        syncRevision,
        resolveConflictWithRemote,
        keepLocalVersion,
        resetEditor,
        onImageSaveStart,
        onImageSaveEnd,
        isSavingImage,
    };
}
