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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { createNote, updateNote, deleteNote } from './noteData';
import type { NoteRecord, CreateNoteInput, UpdateNoteInput } from './noteTypes';
import type { NoteEditorViewProps } from './ui/NoteEditorView';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import {
  normalizeNoteBody,
  extractTextFromHTML,
} from './noteHelpers';
import { getNote } from './noteData';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId, extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';

const ENABLE_DEBUG_LOGS = false;
const AUTOSAVE_DELAY_MS = 400;
const sameTagIds = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

const noteEditorLog = (...args: unknown[]) => {
  if (ENABLE_DEBUG_LOGS) console.log('[NoteEditorLog]', ...args);
};

const summarizeHtml = (html: string) => ({
  length: html.length,
  preview: html.slice(0, 120),
});

const sameString = (a: string | null | undefined, b: string | null | undefined) => a === b;
const sameTagList = sameTagIds;

export function useNoteEditor(props: NoteEditorViewProps) {
  const {
    noteId,
    onBack,
    initialDraftKey,
    initialDraftContent,
  } = props;
  const resolvedNoteId = noteId && noteId !== 'new' ? noteId : null;

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
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);
  const lastSavedUpdatedAtRef = useRef<number | null>(null);

  // We use this ref to synchronously track ID creation inside save locks
  const activeNoteIdRef = useRef<string | null>(resolvedNoteId);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(resolvedNoteId);

  const [noteTitle, setNoteTitle] = useState<string>(initialDraftKey || '');
  const [noteBody, setNoteBody] = useState<string>(initialDraftContent || '');
  const noteBodyRef = useRef<string>(initialDraftContent || '');

  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  // Editor state tracking for location and tags
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
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

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);

  // Save Lock to prevent overlapping autosaves
  const isSelfDeletingRef = useRef(false);
  const saveInProgressRef = useRef(false);
  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const handleSaveRef = useRef<any>(null);

  // Keep track of latest inputs for retry to avoid stale closures!
  const currentInputsRef = useRef({ noteTitle, noteBody: noteBodyRef.current, workspaceId, folderId, tagIds, isInitialized });
  currentInputsRef.current = { noteTitle, noteBody: noteBodyRef.current, workspaceId, folderId, tagIds, isInitialized };

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

    if (resolvedNoteId) {
      noteEditorLog('init existing note', { resolvedNoteId });
      const existingNoteTitle = '';
      const existingNoteBody = '';
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
      lastSavedTitleRef.current = '';
      lastSavedBodyRef.current = '';
      lastSavedWorkspaceIdRef.current = null;
      lastSavedFolderIdRef.current = null;
      lastSavedTagIdsRef.current = [];
      lastSavedUpdatedAtRef.current = null;

      setNoteTitle(existingNoteTitle);
      setNoteBody(existingNoteBody);
      noteBodyRef.current = existingNoteBody;
      setWorkspaceId(null);
      setFolderId(null);
      setTagIds([]);

      currentInputsRef.current = {
        noteTitle: existingNoteTitle,
        noteBody: existingNoteBody,
        workspaceId: null,
        folderId: null,
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

    // Load default workspace (falling back to smart default) and folder
    const initDefaults = async () => {
      const smartWs = await getSmartDefaultWorkspace();
      if (smartWs) {
        setWorkspaceId(smartWs.id);
        const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
        setFolderId(savedFolderId || null);
      } else {
        setWorkspaceId(null);
        setFolderId(null);
      }
    };
    void initDefaults();

    setTagIds([]);

    lastSavedTitleRef.current = initialDraftKey || '';
    lastSavedBodyRef.current = initialDraftContent || '';
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedUpdatedAtRef.current = null;
    currentInputsRef.current = {
      noteTitle: initialDraftKey || '',
      noteBody: initialDraftContent || '',
      workspaceId: null,
      folderId: null,
      tagIds: [],
      isInitialized: true,
    };
    setSaveStatus('idle');
    setIsNoteDeleted(false);
    hasLoadedLiveNoteRef.current = true;
    setIsInitialized(true);
    noteEditorLog('init draft ready', {
      title: initialDraftKey || '',
      body: summarizeHtml(initialDraftContent || ''),
    });
  }, [resolvedNoteId, initialDraftKey, initialDraftContent, clearAutosaveTimer]);

  // Removed properties effect

  // Natively sync across tabs using centralized useDbStore
  const rawLiveNote = useDbStore(state => {
    if (!activeNoteId) return undefined;
    const cleanId = extractSnippetIdFromCompoundId(activeNoteId);
    return (
      state.notes.find(n => n.id === activeNoteId || n.id === cleanId) ||
      state.snippets.find(s => s.id === activeNoteId || s.id === cleanId) ||
      state.todos.find(t => t.id === activeNoteId || t.id === cleanId)
    );
  });

  const liveNote = useMemo(() => {
    if (!rawLiveNote) return undefined;
    const note = rawLiveNote as any;

    // Check if it's a Todo record — 'isDone' is a reliable discriminator
    if ('isDone' in note) {
      return {
        id: note.id,
        title: note.title || note.name || note.key || '',
        body: note.body || note.description || note.content || note.value || '',
        workspaceId: note.workspaceId || note.workspace_id || null,
        folderId: note.folderId || note.folder_id || null,
        tagIds: note.tagIds || (Array.isArray(note.tags) ? note.tags.map((t: any) => typeof t === 'string' ? t : t.id) : []),
        updatedAt: note.updatedAt || Date.now(),
        createdAt: note.createdAt || Date.now(),
      } as any;
    }

    // Check if it's a Snippet record
    if ('config' in note) {
      const configStr = typeof note.config === 'string' ? note.config : JSON.stringify(note.config || '');
      return {
        ...note,
        title: note.title || note.name || note.key || '',
        body: note.body || configStr || note.content || note.value || '',
        workspaceId: note.workspaceId || note.workspace_id || null,
        folderId: note.folderId || note.folder_id || null,
        tagIds: note.tagIds || (Array.isArray(note.tags) ? note.tags.map((t: any) => typeof t === 'string' ? t : t.id) : []),
        updatedAt: note.updatedAt || Date.now(),
        createdAt: note.createdAt || Date.now(),
      } as any;
    }

    return {
      ...note,
      title: note.title || note.name || note.key || '',
      body: note.body || note.content || note.value || '',
      workspaceId: note.workspaceId || note.workspace_id || null,
      folderId: note.folderId || note.folder_id || null,
      tagIds: note.tagIds || (Array.isArray(note.tags) ? note.tags.map((t: any) => typeof t === 'string' ? t : t.id) : []),
      updatedAt: note.updatedAt || Date.now(),
      createdAt: note.createdAt || Date.now(),
    } as NoteRecord;
  }, [rawLiveNote]);

  const handleSave = useCallback(async (silent: boolean = false, overrideProps?: SharedProperties | null): Promise<boolean> => {
    noteEditorLog('handleSave called', {
      silent,
      overrideProps,
      activeNoteId: activeNoteIdRef.current,
      conflict: hasConflictRef.current,
      saveInProgress: saveInProgressRef.current,
      savePending: Boolean(savePromiseRef.current),
      currentInputs: {
        noteTitle: currentInputsRef.current.noteTitle,
        noteBody: summarizeHtml(currentInputsRef.current.noteBody),
        workspaceId: currentInputsRef.current.workspaceId,
        folderId: currentInputsRef.current.folderId,
        tagIds: currentInputsRef.current.tagIds,
        isInitialized: currentInputsRef.current.isInitialized,
      },
    });

    if (hasConflictRef.current) {
      noteEditorLog('handleSave blocked by conflict');
      return false;
    }
    clearAutosaveTimer();
    const {
      noteTitle: currentTitle,
      noteBody: currentBody,
      workspaceId: currentWsId,
      folderId: currentFId,
      tagIds: currentTIds,
      isInitialized: currentIsInit,
    } = currentInputsRef.current;

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
      workspaceId: currentWsId,
      folderId: currentFId,
      tagIds: currentTIds,
    });

    if (currentNoteId && !currentIsInit) {
      noteEditorLog('handleSave deferred until init completes', { currentNoteId });
      if (!silent) setSaveStatus('saving');
      saveAgainRef.current = true;
      return false;
    }

    if (!currentNoteId && !hasTitle && !hasBody) {
      noteEditorLog('handleSave skipped for empty draft');
      setSaveStatus('idle');
      return false;
    }

    if (currentNoteId && !hasTitle && !hasBody) {
      noteEditorLog('handleSave deleting empty note', { currentNoteId });
      if (savePromiseRef.current) {
        saveAgainRef.current = true;
        return savePromiseRef.current;
      }

      const performDelete = async (): Promise<boolean> => {
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
            lastSavedWorkspaceIdRef.current = null;
            lastSavedFolderIdRef.current = null;
            lastSavedTagIdsRef.current = [];
            lastSavedUpdatedAtRef.current = null;
            clearAutosaveTimer();
            setSaveStatus('idle');
            setLastSavedAt(null);
            isDirtyRef.current = false;
            setIsDirty(false);
          }
          return true;
        } catch (err) {
          console.error('[useNoteEditor] Auto-delete failed:', err);
          noteEditorLog('auto delete failed', { currentNoteId, err });
          setSaveStatus('error');
          return false;
        } finally {
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
      noteEditorLog('handleSave reusing in-flight promise');
      saveAgainRef.current = true;
      return savePromiseRef.current;
    }

    const performSave = async (): Promise<boolean> => {

      noteEditorLog('performSave start', {
        currentNoteId,
        savingNoteId,
        silent,
        overrideProps,
      });
      saveInProgressRef.current = true;
      if (!silent) setSaveStatus('saving');

      let activeWorkspaceId = currentWsId;
      let activeFolderId = currentFId;
      let activeTagIds = currentTIds;

      if (overrideProps) {
        if (overrideProps.workspaceId !== undefined) activeWorkspaceId = overrideProps.workspaceId;
        if (overrideProps.folderId !== undefined) activeFolderId = overrideProps.folderId;
        if (overrideProps.selectedTags) activeTagIds = overrideProps.selectedTags.map(t => t.id);
      }

      const currentTagIdsKey = [...activeTagIds].sort().join(',');

      try {
        let savedNote: NoteRecord;
        if (!currentNoteId) {
          const input: CreateNoteInput = {
            workspaceId: activeWorkspaceId || undefined,
            folderId: activeFolderId,
            title: currentTitle,
            body: currentBody,
            tagIds: activeTagIds,
          };
          noteEditorLog('creating note', {
            input: {
              ...input,
              body: summarizeHtml(input.body),
            },
          });
          savedNote = await createNote(input);
          noteEditorLog('createNote success', {
            savedId: savedNote.id,
            updatedAt: savedNote.updatedAt,
          });
        } else {
          const input: UpdateNoteInput = {
            expectedUpdatedAt: lastSavedUpdatedAtRef.current ?? undefined,
          };
          if (currentTitle !== lastSavedTitleRef.current) input.title = currentTitle;
          if (normalizeNoteBody(currentBody) !== normalizeNoteBody(lastSavedBodyRef.current)) input.body = currentBody;
          if (activeWorkspaceId !== lastSavedWorkspaceIdRef.current) input.workspaceId = activeWorkspaceId || undefined;
          if (activeFolderId !== lastSavedFolderIdRef.current) input.folderId = activeFolderId;
          if (!sameTagIds(activeTagIds, lastSavedTagIdsRef.current)) input.tagIds = activeTagIds;

          if (Object.keys(input).length <= 1) {
            noteEditorLog('update skipped, no field changes', {
              currentNoteId,
              lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
            });
            hasConflictRef.current = false;
            setConflictNote(null);
            isDirtyRef.current = false;
            setIsDirty(false);
            if (!silent) {
              setSaveStatus('saved');
              if (lastSavedUpdatedAtRef.current !== null) {
                setLastSavedAt(new Date(lastSavedUpdatedAtRef.current));
              }
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
            workspace_id: lastSavedWorkspaceIdRef.current,
            folder_id: lastSavedFolderIdRef.current,
            category: 'note',
          });
          
          savedNote = await updateNote(currentNoteId, input);
          
          const newCompoundId = getItemCompoundId({
            id: savedNote.id,
            workspace_id: savedNote.workspaceId,
            folder_id: savedNote.folderId,
            category: 'note',
          });

          if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
            await migrateItemCompoundId(oldCompoundId, newCompoundId, 'note');
          }

          noteEditorLog('updateNote success', {
            savedId: savedNote.id,
            updatedAt: savedNote.updatedAt,
          });
        }

        if (activeNoteIdRef.current !== savingNoteId) {
          noteEditorLog('save result ignored because active note changed', {
            savingNoteId,
            activeNow: activeNoteIdRef.current,
          });
          return true;
        }

        if (!currentNoteId) {
          activeNoteIdRef.current = savedNote.id;
          setActiveNoteId(savedNote.id);
          hasLoadedLiveNoteRef.current = false;
          noteEditorLog('switched draft to saved note id', { savedId: savedNote.id });
        }

        const currentTagIdsKey = [...currentInputsRef.current.tagIds].sort().join(',');
        const snapshotMatches = {
          title: currentInputsRef.current.noteTitle === currentTitle,
          body: currentInputsRef.current.noteBody === currentBody,
          workspace: currentInputsRef.current.workspaceId === activeWorkspaceId,
          folder: currentInputsRef.current.folderId === activeFolderId,
          init: currentInputsRef.current.isInitialized === currentIsInit,
          tags: currentTagIdsKey === [...activeTagIds].sort().join(','),
        };
        const stillMatchesSnapshot = Object.values(snapshotMatches).every(Boolean);

        if (currentInputsRef.current.workspaceId === activeWorkspaceId) {
          setWorkspaceId(savedNote.workspaceId);
          currentInputsRef.current = {
            ...currentInputsRef.current,
            workspaceId: savedNote.workspaceId,
          };
        }
        if (currentInputsRef.current.folderId === activeFolderId) {
          setFolderId(savedNote.folderId);
          currentInputsRef.current = {
            ...currentInputsRef.current,
            folderId: savedNote.folderId,
          };
        }
        if (sameTagIds(currentInputsRef.current.tagIds, activeTagIds)) {
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
        lastSavedWorkspaceIdRef.current = savedNote.workspaceId;
        lastSavedFolderIdRef.current = savedNote.folderId;
        lastSavedTagIdsRef.current = savedNote.tagIds;
        lastSavedUpdatedAtRef.current = savedNote.updatedAt;
        hasConflictRef.current = false;
        noteEditorLog('save canonical refs updated', {
          savedId: savedNote.id,
          lastSavedUpdatedAt: savedNote.updatedAt,
          workspaceId: savedNote.workspaceId,
          folderId: savedNote.folderId,
          tagCount: savedNote.tagIds.length,
        });

        if (savedNote.workspaceId) StorageManager.setItem('lastUsedWorkspaceId', savedNote.workspaceId);
        if (savedNote.folderId) StorageManager.setItem('lastUsedFolderId', savedNote.folderId);
        else StorageManager.removeItem('lastUsedFolderId');

        setLastSavedAt(new Date(savedNote.updatedAt));
        setConflictNote(null);

        if (stillMatchesSnapshot) {
          noteEditorLog('save completed and snapshot matched');
          isDirtyRef.current = false;
          setIsDirty(false);
          setSaveStatus(silent ? 'idle' : 'saved');
        } else {
          noteEditorLog('save completed but snapshot moved, scheduling another autosave');
          isDirtyRef.current = true;
          setIsDirty(true);
          setSaveStatus('saving');
          scheduleAutosaveRef.current();
        }

        return true;
      } catch (err: any) {
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
          setConflictNote(err.remoteNote ?? liveNote ?? null);
          isDirtyRef.current = true;
          setIsDirty(true);
          return false;
        }
        console.error('Save failed:', err);
        noteEditorLog('save failed', { err });
        setSaveStatus('error');
        return false;
      } finally {
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

    savePromiseRef.current = performSave();
    return savePromiseRef.current;
  }, []);

  const scheduleAutosave = useCallback(() => {
    if (hasConflictRef.current) return;
    noteEditorLog('scheduleAutosave', {
      activeNoteId: activeNoteIdRef.current,
      noteTitle: currentInputsRef.current.noteTitle,
      noteBody: summarizeHtml(currentInputsRef.current.noteBody),
      workspaceId: currentInputsRef.current.workspaceId,
      folderId: currentInputsRef.current.folderId,
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

  useEffect(() => clearAutosaveTimer, [clearAutosaveTimer]);

  const handleBodyChange = useCallback((html: string) => {
    // If the content is effectively empty in both previous and new state, ignore it
    const isNewEmpty = extractTextFromHTML(html) === '';
    const isPrevEmpty = extractTextFromHTML(noteBodyRef.current) === '';
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
    if (!hasConflictRef.current) scheduleAutosave();
  }, [scheduleAutosave]);

  const handleTitleChange = useCallback((title: string) => {
    if (sameString(noteTitle, title)) return;
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
    if (!hasConflictRef.current) scheduleAutosave();
  }, [scheduleAutosave, noteTitle]);

  handleSaveRef.current = handleSave;

  const handleDelete = useCallback(async () => {
    const currentNoteId = activeNoteIdRef.current;
    noteEditorLog('handleDelete', { currentNoteId });
    if (!currentNoteId) {
      clearAutosaveTimer();
      if (onBack) onBack();
      return;
    }
    setIsDeleteDialogOpen(false);
    clearAutosaveTimer();
    try {
      await deleteNote(currentNoteId);
      noteEditorLog('delete success', { currentNoteId });
      setIsNoteDeleted(true);
    } catch (msg) {
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

    if (isDirtyRef.current && (hasTitle || hasBody)) {
      setIsUnsavedChangesDialogOpen(true);
    } else {
      if (onBack) onBack();
    }
  }, [onBack, noteTitle]);

  // If liveNote is fetched from IndexedDB, update the editor if we aren't currently dirty
  useEffect(() => {
    if (activeNoteId && hasLoadedLiveNoteRef.current && liveNote === undefined) {
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

    if (!liveNote) return;
    hasLoadedLiveNoteRef.current = true;

    noteEditorLog('live note received', {
      activeNoteId,
      liveId: liveNote.id,
      liveUpdatedAt: liveNote.updatedAt,
      lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
      isDirty: isDirtyRef.current,
      initialized: isInitialized,
    });

    if (isInitialized && lastSavedUpdatedAtRef.current !== null && liveNote.updatedAt <= lastSavedUpdatedAtRef.current) {
      noteEditorLog('live note ignored because it is not newer than last saved', {
        liveUpdatedAt: liveNote.updatedAt,
        lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
      });
      setIsNoteDeleted(false);
      return;
    }

    if (isDirtyRef.current && lastSavedUpdatedAtRef.current !== null && liveNote.updatedAt > lastSavedUpdatedAtRef.current) {
      noteEditorLog('live note arrived while dirty, checking field-level merge');
      const localTitleChanged = currentInputsRef.current.noteTitle !== lastSavedTitleRef.current;
      const localBodyChanged = currentInputsRef.current.noteBody !== lastSavedBodyRef.current;
      const localWsChanged = currentInputsRef.current.workspaceId !== lastSavedWorkspaceIdRef.current;
      const localFolderChanged = currentInputsRef.current.folderId !== lastSavedFolderIdRef.current;
      const localTagsChanged = [...currentInputsRef.current.tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

      const remoteTitleChanged = liveNote.title !== lastSavedTitleRef.current;
      const remoteBodyChanged = normalizeNoteBody(liveNote.body) !== normalizeNoteBody(lastSavedBodyRef.current);
      const remoteWsChanged = liveNote.workspaceId !== lastSavedWorkspaceIdRef.current;
      const remoteFolderChanged = liveNote.folderId !== lastSavedFolderIdRef.current;
      const remoteTagsChanged = [...liveNote.tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

      const hasAnyConflict = (localTitleChanged && remoteTitleChanged) ||
        (localBodyChanged && remoteBodyChanged) ||
        (localWsChanged && remoteWsChanged) ||
        (localFolderChanged && remoteFolderChanged) ||
        (localTagsChanged && remoteTagsChanged);

      if (hasAnyConflict) {
        noteEditorLog('live note conflict detected', {
          localTitleChanged,
          localBodyChanged,
          localWsChanged,
          localFolderChanged,
          localTagsChanged,
          remoteTitleChanged,
          remoteBodyChanged,
          remoteWsChanged,
          remoteFolderChanged,
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
        setWorkspaceId(liveNote.workspaceId);
        currentInputsRef.current.workspaceId = liveNote.workspaceId;
      }
      if (remoteFolderChanged) {
        noteEditorLog('merging remote folder');
        setFolderId(liveNote.folderId);
        currentInputsRef.current.folderId = liveNote.folderId;
      }
      if (remoteTagsChanged) {
        noteEditorLog('merging remote tags');
        setTagIds(liveNote.tagIds);
        currentInputsRef.current.tagIds = liveNote.tagIds;
      }

      // Update base refs to remote so our next save applies cleanly on top of it
      lastSavedTitleRef.current = liveNote.title;
      lastSavedBodyRef.current = liveNote.body;
      lastSavedWorkspaceIdRef.current = liveNote.workspaceId;
      lastSavedFolderIdRef.current = liveNote.folderId;
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
        setWorkspaceId(liveNote.workspaceId);
        setFolderId(liveNote.folderId);
        setTagIds(liveNote.tagIds);

        currentInputsRef.current = {
          noteTitle: liveNote.title,
          noteBody: liveNote.body,
          workspaceId: liveNote.workspaceId,
          folderId: liveNote.folderId,
          tagIds: liveNote.tagIds,
          isInitialized: true,
        };
      }

      lastSavedTitleRef.current = liveNote.title || '';
      lastSavedBodyRef.current = liveNote.body || (liveNote as any).content || '';
      lastSavedWorkspaceIdRef.current = liveNote.workspaceId;
      lastSavedFolderIdRef.current = liveNote.folderId;
      lastSavedTagIdsRef.current = liveNote.tagIds;
      lastSavedUpdatedAtRef.current = liveNote.updatedAt;
      if (!hasLocalEdits) {
        currentInputsRef.current = {
          noteTitle: liveNote.title,
          noteBody: liveNote.body,
          workspaceId: liveNote.workspaceId,
          folderId: liveNote.folderId,
          tagIds: liveNote.tagIds,
          isInitialized: true,
        };
      } else {
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
    } else if (!isDirtyRef.current) {
      // Background sync from other tabs
      noteEditorLog('background sync applied', {
        liveId: liveNote.id,
        liveUpdatedAt: liveNote.updatedAt,
      });
      setNoteTitle(liveNote.title);
      setNoteBody(liveNote.body);
      noteBodyRef.current = liveNote.body;
      setWorkspaceId(liveNote.workspaceId);
      setFolderId(liveNote.folderId);
      setTagIds(liveNote.tagIds);

      lastSavedTitleRef.current = liveNote.title;
      lastSavedBodyRef.current = liveNote.body;
      lastSavedWorkspaceIdRef.current = liveNote.workspaceId;
      lastSavedFolderIdRef.current = liveNote.folderId;
      lastSavedTagIdsRef.current = liveNote.tagIds;
      currentInputsRef.current = {
        noteTitle: liveNote.title,
        noteBody: liveNote.body,
        workspaceId: liveNote.workspaceId,
        folderId: liveNote.folderId,
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
  }, [activeNoteId, clearAutosaveTimer, isInitialized, liveNote]);

  const handlePropertiesChange = useCallback((newProps: SharedProperties) => {
    noteEditorLog('properties change', {
      activeNoteId: activeNoteIdRef.current,
      workspaceId: newProps.workspaceId,
      folderId: newProps.folderId,
      selectedTagsCount: newProps.selectedTags?.length ?? 0,
    });
    const prevWsId = currentInputsRef.current.workspaceId;
    const prevFId = currentInputsRef.current.folderId;

    let wId = prevWsId;
    let fId = prevFId;
    let tIds = currentInputsRef.current.tagIds;

    if (newProps.workspaceId !== undefined) wId = newProps.workspaceId;
    if (newProps.folderId !== undefined) fId = newProps.folderId;
    if (newProps.selectedTags) tIds = newProps.selectedTags.map((t: any) => t.id);

    const tagsChanged = !sameTagList(tIds, currentInputsRef.current.tagIds);
    const workspaceChanged = !sameString(wId, prevWsId);
    const folderChanged = !sameString(fId, prevFId);
    const locationChanged = workspaceChanged || folderChanged;
    const propertiesChanged = tagsChanged || locationChanged;

    if (!propertiesChanged) {
      return;
    }

    setWorkspaceId(wId);
    setFolderId(fId);
    setTagIds(tIds);

    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      setIsDirty(true);
    }

    currentInputsRef.current = {
      ...currentInputsRef.current,
      workspaceId: wId,
      folderId: fId,
      tagIds: tIds,
    };

    // Persist changes to StorageManager for defaults
    if (wId) StorageManager.setItem('lastUsedWorkspaceId', wId);
    if (fId) StorageManager.setItem('lastUsedFolderId', fId);
    else StorageManager.removeItem('lastUsedFolderId');

    noteEditorLog('properties persisted locally', {
      workspaceId: wId,
      folderId: fId,
      tagIds: tIds,
    });

    setSaveStatus('saving');
    if (!hasConflictRef.current) scheduleAutosave();
  }, [scheduleAutosave]);

  const resolveConflictWithRemote = useCallback(() => {
    if (!conflictNote) return;

    noteEditorLog('resolve conflict with remote', {
      conflictId: conflictNote.id,
      conflictUpdatedAt: conflictNote.updatedAt,
    });

    setNoteTitle(conflictNote.title);
    setNoteBody(conflictNote.body);
    noteBodyRef.current = conflictNote.body;
    setWorkspaceId(conflictNote.workspaceId);
    setFolderId(conflictNote.folderId);
    setTagIds(conflictNote.tagIds);
    currentInputsRef.current = {
      noteTitle: conflictNote.title,
      noteBody: conflictNote.body,
      workspaceId: conflictNote.workspaceId,
      folderId: conflictNote.folderId,
      tagIds: conflictNote.tagIds,
      isInitialized: true,
    };

    lastSavedTitleRef.current = conflictNote.title;
    lastSavedBodyRef.current = conflictNote.body;
    lastSavedWorkspaceIdRef.current = conflictNote.workspaceId;
    lastSavedFolderIdRef.current = conflictNote.folderId;
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
    if (!conflictNote) return false;
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
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedUpdatedAtRef.current = null;

    const initDefaults = async () => {
      const smartWs = await getSmartDefaultWorkspace();
      if (smartWs) {
        setWorkspaceId(smartWs.id);
        const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
        setFolderId(savedFolderId || null);
      } else {
        setWorkspaceId(null);
        setFolderId(null);
      }
    };
    void initDefaults();
    setTagIds([]);

    currentInputsRef.current = {
      noteTitle: '',
      noteBody: '',
      workspaceId: null,
      folderId: null,
      tagIds: [],
      isInitialized: true,
    };
  }, []);

  const flushSave = useCallback(async () => {
    while (savePromiseRef.current || isDirtyRef.current) {
      if (savePromiseRef.current) {
        await savePromiseRef.current;
      }
      if (isDirtyRef.current) {
        await handleSave(false);
      }
    }
  }, [handleSave]);

  const syncRevision = liveNote?.updatedAt ?? 0;

  return {
    noteTitle,
    noteBody,
    activeNoteId,
    liveNote,
    isNoteDeleted,
    workspaceId,
    folderId,
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
  };
}
