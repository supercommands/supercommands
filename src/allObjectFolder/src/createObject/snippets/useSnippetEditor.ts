/**
 * @file useSnippetEditor.ts
 * @description A custom React hook containing state management and logic for the Snippet editor,
 * including debounced autosaving, workspace sync, tag mapping, deletion, and dirty state checks.
 * 
 * @usage
 * ```tsx
 * import { useSnippetEditor } from './useSnippetEditor';
 * const state = useSnippetEditor(editorProps);
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { createSnippet, updateSnippet, deleteSnippet } from './snippetData';
import type { SnippetRecord, CreateSnippetInput, UpdateSnippetInput } from './snippetTypes';
import { useSnippet } from './snippetHooks';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';

export interface SnippetEditorViewProps {
  snippetId?: string | null;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftConfig?: string | Record<string, any>;
}

export function useSnippetEditor(props: SnippetEditorViewProps) {
  const {
    snippetId,
    onBack,
    initialDraftKey,
    initialDraftConfig,
  } = props;

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
  const lastSavedConfigRef = useRef<string | Record<string, any>>(initialDraftConfig || '');
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);
  const lastSavedShortcutRef = useRef<string>('');

  // We use this ref to synchronously track ID creation inside save locks
  const activeSnippetIdRef = useRef<string | null>(snippetId ?? null);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(snippetId ?? null);

  const [snippetTitle, setSnippetTitle] = useState<string>(initialDraftKey || '');
  const [snippetConfig, setSnippetConfig] = useState<string | Record<string, any>>(initialDraftConfig || '');
  const { validateShortcut } = useShortcutValidation();
  const [snippetShortcut, setSnippetShortcut] = useState<string>('');
  const isShortcutManuallyEditedRef = useRef(false);

  // Editor state tracking for location and tags
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(!snippetId);
  const [isShortcutInitialized, setIsShortcutInitialized] = useState<boolean>(!snippetId);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);

  // Save Lock to prevent overlapping autosaves
  const saveInProgressRef = useRef(false);
  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  // Keep track of latest inputs for retry to avoid stale closures!
  const currentInputsRef = useRef({ snippetTitle, snippetConfig, workspaceId, folderId, tagIds, isInitialized, snippetShortcut });
  currentInputsRef.current = { snippetTitle, snippetConfig, workspaceId, folderId, tagIds, isInitialized, snippetShortcut };

  // Initialize draft OR load existing snippet ID
  useEffect(() => {
    isShortcutManuallyEditedRef.current = false;
    setSnippetShortcut('');
    lastSavedShortcutRef.current = '';

    if (snippetId) {
      activeSnippetIdRef.current = snippetId;
      setActiveSnippetId(snippetId);
      setIsInitialized(false);
      setIsShortcutInitialized(false);
      setSaveStatus('idle');

      setSnippetTitle('');
      setSnippetConfig('');
      setWorkspaceId(null);
      setFolderId(null);
      setTagIds([]);

      lastSavedTitleRef.current = '';
      lastSavedConfigRef.current = '';
      lastSavedWorkspaceIdRef.current = null;
      lastSavedFolderIdRef.current = null;
      lastSavedTagIdsRef.current = [];
      return;
    }

    activeSnippetIdRef.current = null;
    setActiveSnippetId(null);
    setSnippetTitle(initialDraftKey || '');
    setSnippetConfig(initialDraftConfig || '');
    setIsUnsavedChangesDialogOpen(false);

    // Background Destination Logic: Snippets have no UI for this on initial render
    // Load default workspace (falling back to smart default) and folder from local storage
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
    lastSavedConfigRef.current = initialDraftConfig || '';
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    setSaveStatus('idle');
    setIsInitialized(true);
    setIsShortcutInitialized(true);
  }, [snippetId, initialDraftKey, initialDraftConfig]);

  // Natively sync across tabs using Dexie's useLiveQuery
  const liveSnippet = useSnippet(activeSnippetId);

  // Helper to safely compare configs (which might be strings or objects)
  const isConfigEqual = (configA: string | Record<string, any>, configB: string | Record<string, any>) => {
    const normalize = (c: any) => typeof c === 'string' ? c : JSON.stringify(c);
    return normalize(configA) === normalize(configB);
  };

  const sanitizeTitleToShortcut = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const isDirty = useMemo(() => {
    if (!isInitialized || !isShortcutInitialized) return false;
    const hasTitle = snippetTitle.trim().length > 0;
    const normalizedConfig = typeof snippetConfig === 'string' ? snippetConfig : JSON.stringify(snippetConfig || {});
    const hasConfig = normalizedConfig.trim().length > 0 && normalizedConfig !== '[]' && normalizedConfig !== '{}';

    // If it's a new snippet and has not yet received both title and config, it is not dirty
    if (!activeSnippetId && (!hasTitle || !hasConfig)) {
      return false;
    }

    const titleChanged = snippetTitle !== lastSavedTitleRef.current;
    const configChanged = !isConfigEqual(snippetConfig, lastSavedConfigRef.current);
    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;
    const shortcutChanged = isShortcutInitialized && snippetShortcut !== lastSavedShortcutRef.current;

    // Check if tag IDs match using sorted string comparison
    const tagsChanged =
      tagIds.length !== lastSavedTagIdsRef.current.length ||
      [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

    return titleChanged || configChanged || workspaceChanged || folderChanged || tagsChanged || shortcutChanged;
  }, [activeSnippetId, snippetTitle, snippetConfig, workspaceId, folderId, tagIds, snippetShortcut, isInitialized, isShortcutInitialized]);

  const handleSave = useCallback(async (silent: boolean = false, overrideProps?: Partial<SharedProperties> | null): Promise<boolean> => {
    // ALWAYS read from refs to avoid stale closure issues during retries
    const { snippetTitle: currentTitle, snippetConfig: currentConfig, workspaceId: currentWsId, folderId: currentFId, tagIds: currentTIds, isInitialized: currentIsInit, snippetShortcut: currentShortcut } = currentInputsRef.current;

    const hasTitle = currentTitle.trim().length > 0;
    // For config, we check if it is not completely empty
    const normalizedConfig = typeof currentConfig === 'string' ? currentConfig : JSON.stringify(currentConfig || {});
    const hasConfig = normalizedConfig.trim().length > 0 && normalizedConfig !== '{}';

    const currentSnippetId = activeSnippetIdRef.current;
    const savingSnippetId = currentSnippetId;

    // Do not save if we are still waiting for the existing snippet to load its properties
    if (currentSnippetId && !currentIsInit) {
      return false;
    }

    // Do not save a brand new snippet until they have entered BOTH title and config!
    if (!currentSnippetId && (!hasTitle || !hasConfig)) {
      return false;
    }

    // If it's an existing snippet and they cleared both title and config, delete it
    if (currentSnippetId && !hasTitle && !hasConfig) {
      if (savePromiseRef.current) {
        saveAgainRef.current = true;
        return savePromiseRef.current;
      }

      const performDelete = async (): Promise<boolean> => {
        saveInProgressRef.current = true;
        try {
          const wsObj = currentWsId ? { workspace_id: currentWsId } : null;
          const fldObj = currentFId ? { folder_id: currentFId } : null;
          const compoundId = getItemCompoundId({ snippet: { id: currentSnippetId }, workspace: wsObj, folder: fldObj });
          await clearShortcut(currentSnippetId, compoundId, 'snippet');
          await deleteSnippet(currentSnippetId);
          if (activeSnippetIdRef.current === savingSnippetId) {
            activeSnippetIdRef.current = null;
            setActiveSnippetId(null);

            lastSavedTitleRef.current = '';
            lastSavedConfigRef.current = '';
            lastSavedWorkspaceIdRef.current = null;
            lastSavedFolderIdRef.current = null;
            lastSavedTagIdsRef.current = [];
            lastSavedShortcutRef.current = '';

            setSaveStatus('idle');
            setLastSavedAt(null);
          }
          return true;
        } catch (err) {
          console.error('Auto-delete failed:', err);
          return false;
        } finally {
          saveInProgressRef.current = false;
          savePromiseRef.current = null;
          if (saveAgainRef.current) {
            saveAgainRef.current = false;
            return handleSave(silent);
          }
        }
      };

      savePromiseRef.current = performDelete();
      return savePromiseRef.current;
    }

    // Save Concurrency Control (Save Lock)
    if (savePromiseRef.current) {
      saveAgainRef.current = true;
      return savePromiseRef.current;
    }

    const performSave = async (): Promise<boolean> => {
      saveInProgressRef.current = true;
      if (!silent) setSaveStatus('saving');

      // Use override props if provided (allows synchronous saves on toolbar updates)
      let activeWorkspaceId = currentWsId;
      let activeFolderId = currentFId;
      let activeTagIds = currentTIds;

      if (overrideProps) {
        if (overrideProps.workspaceId !== undefined) activeWorkspaceId = overrideProps.workspaceId;
        if (overrideProps.folderId !== undefined) activeFolderId = overrideProps.folderId;
        if (overrideProps.selectedTags) activeTagIds = overrideProps.selectedTags.map(t => t.id);
      }

      try {
        let savedSnippet: SnippetRecord;
        if (!currentSnippetId) {
          // CREATE SNIPPET
          const input: CreateSnippetInput = {
            workspaceId: activeWorkspaceId || undefined,
            folderId: activeFolderId,
            title: currentTitle,
            config: currentConfig,
            tagIds: activeTagIds,
          };
          savedSnippet = await createSnippet(input);
        } else {
          // UPDATE SNIPPET
          const input: UpdateSnippetInput = {
            title: currentTitle,
            config: currentConfig,
            workspaceId: activeWorkspaceId || undefined,
            folderId: activeFolderId,
            tagIds: activeTagIds,
          };
          savedSnippet = await updateSnippet(currentSnippetId, input);
        }

        // Save shortcut!
        const wsObj = savedSnippet.workspaceId ? { workspace_id: savedSnippet.workspaceId } : null;
        const fldObj = savedSnippet.folderId ? { folder_id: savedSnippet.folderId } : null;
        const newCompoundId = getItemCompoundId({ snippet: savedSnippet, workspace: wsObj, folder: fldObj });

        if (currentSnippetId) {
          const oldWsObj = lastSavedWorkspaceIdRef.current ? { workspace_id: lastSavedWorkspaceIdRef.current } : null;
          const oldFldObj = lastSavedFolderIdRef.current ? { folder_id: lastSavedFolderIdRef.current } : null;
          const oldCompoundId = getItemCompoundId({ snippet: { id: currentSnippetId, category: 'snippet' }, workspace: oldWsObj, folder: oldFldObj });
          
          if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
            await migrateItemCompoundId(oldCompoundId, newCompoundId, 'snippet');
          }
        }

        const compoundId = newCompoundId;

        const finalShortcut = (currentShortcut || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (finalShortcut) {
          const valRes = await validateShortcut(finalShortcut, savedSnippet.id);
          if (valRes.isValid) {
            console.log(`[ShortcutDebug][SnippetEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for snippet "${savedSnippet.id}"...`);
            await saveShortcut(savedSnippet.id, compoundId, finalShortcut, savedSnippet.title, 'snippet');
          } else {
            console.warn(`[ShortcutDebug][SnippetEditor] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
          }
          // Always update the ref to prevent infinite autosave loops
          lastSavedShortcutRef.current = finalShortcut;
        } else {
          console.log(`[ShortcutDebug][SnippetEditor] handleSave: Clearing shortcut for snippet "${savedSnippet.id}"...`);
          await clearShortcut(savedSnippet.id, compoundId, 'snippet');
          lastSavedShortcutRef.current = '';
        }

        if (activeSnippetIdRef.current !== savingSnippetId) {
          return true; // Saved to DB, but do not update this editor
        }

        // For new snippets, bind the new snippet ID
        if (!currentSnippetId) {
          activeSnippetIdRef.current = savedSnippet.id;
          setActiveSnippetId(savedSnippet.id);
        }

        // Sync inputs if they haven't changed since the save started
        if (currentInputsRef.current.workspaceId === activeWorkspaceId) setWorkspaceId(savedSnippet.workspaceId);
        if (currentInputsRef.current.folderId === activeFolderId) setFolderId(savedSnippet.folderId);
        if (currentInputsRef.current.tagIds === activeTagIds) setTagIds(savedSnippet.tagIds);
        if (currentInputsRef.current.snippetTitle === currentTitle) setSnippetTitle(savedSnippet.title);
        if (isConfigEqual(currentInputsRef.current.snippetConfig, currentConfig)) setSnippetConfig(savedSnippet.config);
        setSnippetShortcut(finalShortcut);

        lastSavedTitleRef.current = savedSnippet.title;
        lastSavedConfigRef.current = savedSnippet.config;
        lastSavedWorkspaceIdRef.current = savedSnippet.workspaceId;
        lastSavedFolderIdRef.current = savedSnippet.folderId;
        lastSavedTagIdsRef.current = savedSnippet.tagIds;

        // Persist default selections to StorageManager
        if (savedSnippet.workspaceId) StorageManager.setItem('lastUsedWorkspaceId', savedSnippet.workspaceId);
        if (savedSnippet.folderId) StorageManager.setItem('lastUsedFolderId', savedSnippet.folderId);
        else StorageManager.removeItem('lastUsedFolderId');

        if (!silent) {
          setSaveStatus('saved');
          setLastSavedAt(new Date(savedSnippet.updatedAt));
        }
        return true;
      } catch (msg) {
        console.error('Save failed:', msg);
        setSaveStatus('error');
        return false;
      } finally {
        saveInProgressRef.current = false;
        savePromiseRef.current = null;

        if (saveAgainRef.current) {
          saveAgainRef.current = false;
          // Trigger save again with the LATEST refs! (Do not pass stale overrideProps)
          return handleSave(silent);
        }
      }
    }; // end performSave

    savePromiseRef.current = performSave();
    return savePromiseRef.current;
  }, []); // NO DEPS! Safe because it reads entirely from currentInputsRef.current

  const handleDelete = useCallback(async () => {
    const currentSnippetId = activeSnippetIdRef.current;
    if (!currentSnippetId) {
      if (onBack) onBack();
      return;
    }
    setIsDeleteDialogOpen(false);
    try {
      const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
      const fldObj = folderId ? { folder_id: folderId } : null;
      const compoundId = getItemCompoundId({ snippet: { id: currentSnippetId }, workspace: wsObj, folder: fldObj });
      await clearShortcut(currentSnippetId, compoundId, 'snippet');
      await deleteSnippet(currentSnippetId);
      if (onBack) onBack();
    } catch (msg) {
      console.error('Delete failed:', msg);
    }
  }, [onBack, workspaceId, folderId]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesDialogOpen(true);
    } else {
      if (onBack) onBack();
    }
  }, [isDirty, onBack]);

  // Autosave effect triggered by input changes
  useEffect(() => {
    if (!isDirty) return;

    setSaveStatus('saving');

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    const delay = 400;
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, delay);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [snippetTitle, snippetConfig, workspaceId, folderId, tagIds, snippetShortcut, handleSave, isDirty]);

  // Synchronize shortcut from DB on load or activeSnippetId changes
  useEffect(() => {
    if (activeSnippetId) {
      const loadSavedShortcut = async () => {
        try {
          const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
          const fldObj = folderId ? { folder_id: folderId } : null;
          const targetCompoundId = getItemCompoundId({
            id: activeSnippetId,
            workspace_id: wsObj?.workspace_id || null,
            folder_id: fldObj?.folder_id || null,
            snippet: { id: activeSnippetId, category: 'snippet' }
          });
          const shortcutsMap = await readAllShortcuts();
          const sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] || '');
          if (isMounted.current) {
            if (!isShortcutManuallyEditedRef.current) {
              setSnippetShortcut(sc);
            }
            lastSavedShortcutRef.current = sc;
            setIsShortcutInitialized(true);
          }
        } catch (err) {
          console.error('Failed to load shortcut:', err);
          if (isMounted.current) {
            setIsShortcutInitialized(true);
          }
        }
      };
      void loadSavedShortcut();
    } else {
      setIsShortcutInitialized(true);
    }
  }, [activeSnippetId, workspaceId, folderId]);

  // If liveSnippet is fetched from IndexedDB, update the editor if we aren't currently dirty
  useEffect(() => {
    if (!liveSnippet) return;

    let parsedConfig = liveSnippet.config;
    if (typeof liveSnippet.config === 'string') {
      try {
        parsedConfig = JSON.parse(liveSnippet.config);
      } catch (e) {
        // ignore
      }
    }

    if (!isInitialized) {
      // First load of an existing snippet
      setSnippetTitle(liveSnippet.title);
      setSnippetConfig(parsedConfig);
      setWorkspaceId(liveSnippet.workspaceId);
      setFolderId(liveSnippet.folderId);
      setTagIds(liveSnippet.tagIds);

      lastSavedTitleRef.current = liveSnippet.title;
      lastSavedConfigRef.current = parsedConfig;
      lastSavedWorkspaceIdRef.current = liveSnippet.workspaceId;
      lastSavedFolderIdRef.current = liveSnippet.folderId;
      lastSavedTagIdsRef.current = liveSnippet.tagIds;

      setLastSavedAt(new Date(liveSnippet.updatedAt));
      setSaveStatus('saved');
      setIsInitialized(true);
    } else if (!isDirty) {
      // Background sync from other tabs
      setSnippetTitle(liveSnippet.title);
      setSnippetConfig(parsedConfig);
      setWorkspaceId(liveSnippet.workspaceId);
      setFolderId(liveSnippet.folderId);
      setTagIds(liveSnippet.tagIds);

      lastSavedTitleRef.current = liveSnippet.title;
      lastSavedConfigRef.current = parsedConfig;
      lastSavedWorkspaceIdRef.current = liveSnippet.workspaceId;
      lastSavedFolderIdRef.current = liveSnippet.folderId;
      lastSavedTagIdsRef.current = liveSnippet.tagIds;

      setLastSavedAt(new Date(liveSnippet.updatedAt));
      setSaveStatus('saved');
    }
  }, [liveSnippet, isDirty, isInitialized]);

  const updateSnippetTitleAndShortcut = useCallback((title: string) => {
    setSnippetTitle(title);
  }, []);

  const updateSnippetShortcut = useCallback((sc: string) => {
    isShortcutManuallyEditedRef.current = true;
    setSnippetShortcut(sc);
  }, []);

  const loadSnippet = useCallback((id: string | null) => {
    isShortcutManuallyEditedRef.current = false;
    activeSnippetIdRef.current = id;
    setActiveSnippetId(id);
    if (id) {
      setIsInitialized(false);
      setIsShortcutInitialized(false);
    } else {
      setSnippetTitle('');
      setSnippetConfig('');
      setSnippetShortcut('');
      const initDefaults = async () => {
        const smartWs = await getSmartDefaultWorkspace();
        if (smartWs) {
          const wsId = smartWs.id;
          setWorkspaceId(wsId);
          // If exactly one folder in workspace, select it by default
          const allFolders = useDbStore.getState().folders;
          const wsFolders = allFolders.filter(f => f.workspaceId === wsId);
          if (wsFolders.length === 1) {
            setFolderId(wsFolders[0].id);
          } else {
            const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
            setFolderId(savedFolderId || null);
          }
        } else {
          setWorkspaceId(null);
          setFolderId(null);
        }
      };
      void initDefaults();
      setTagIds([]);
      lastSavedTitleRef.current = '';
      lastSavedConfigRef.current = '';
      lastSavedWorkspaceIdRef.current = null;
      lastSavedFolderIdRef.current = null;
      lastSavedTagIdsRef.current = [];
      lastSavedShortcutRef.current = '';
      setSaveStatus('idle');
      setIsInitialized(true);
    }
  }, []);

  const handlePropertiesChange = useCallback((newProps: Partial<SharedProperties>) => {
    const prevWsId = currentInputsRef.current.workspaceId;
    const prevFId = currentInputsRef.current.folderId;
    const prevTIds = currentInputsRef.current.tagIds;

    let wId = prevWsId;
    let fId = prevFId;
    let tIds = prevTIds;

    if (newProps.workspaceId !== undefined) {
      wId = newProps.workspaceId;
      if (wId !== prevWsId) {
        const allFolders = useDbStore.getState().folders;
        const wsFolders = allFolders.filter(f => f.workspaceId === wId);
        if (wsFolders.length === 1) {
          fId = wsFolders[0].id;
        } else {
          fId = null;
        }
      }
    }
    if (newProps.folderId !== undefined) fId = newProps.folderId;
    if (newProps.selectedTags) tIds = newProps.selectedTags.map((t: any) => t.id);

    const tagsChanged = [...tIds].sort().join(',') !== [...prevTIds].sort().join(',');
    const locationChanged = prevWsId !== wId || prevFId !== fId;

    if (!locationChanged && !tagsChanged) return;

    setWorkspaceId(wId);
    setFolderId(fId);
    setTagIds(tIds);
    currentInputsRef.current.tagIds = tIds;

    // Persist changes to StorageManager for defaults
    if (wId) StorageManager.setItem('lastUsedWorkspaceId', wId);
    if (fId) StorageManager.setItem('lastUsedFolderId', fId);
    else StorageManager.removeItem('lastUsedFolderId');

    // Trigger an immediate SILENT save if location or tags change!
    void handleSave(true, newProps);
  }, [handleSave]);

  return {
    snippetTitle,
    snippetConfig,
    snippetShortcut,
    activeSnippetId: snippetId || activeSnippetId,
    liveSnippet,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    setSaveStatus,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    lastSavedShortcutRef,
    isDirty,
    isDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    setSnippetTitle: updateSnippetTitleAndShortcut,
    setSnippetConfig,
    setSnippetShortcut: updateSnippetShortcut,
    handleSave,
    handleDelete,
    handleClose,
    setIsDeleteDialogOpen,
    setIsUnsavedChangesDialogOpen,
    handlePropertiesChange,
    loadSnippet,
    isInitialized: isInitialized && (snippetId === activeSnippetId),
    isShortcutInitialized,
  };
}
