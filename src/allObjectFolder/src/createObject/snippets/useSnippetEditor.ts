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
import { createTag } from '../tags/tagData';
import type { SnippetRecord, CreateSnippetInput, UpdateSnippetInput } from './snippetTypes';
import { useSnippet } from './snippetHooks';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import type { SharedProperties, SharedPropertiesToolbarProps } from '../../../../shared-components/editorToolbar/types';
import { clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { saveShortcutGuarded } from '../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';
import { getVersionsNewestFirst, getSnapshotById } from '../../../../shared-components/versionHistory/structuredVersionHistory';
export interface SnippetEditorViewProps {
    snippetId?: string | null;
    onBack?: () => void;
    initialDraftKey?: string;
    initialDraftConfig?: string | Record<string, any>;
    initialTagIds?: string[];
    onSnippetCreated?: (snippet: SnippetRecord) => void | Promise<void>;
    saveSnippetAdapter?: (args: {
        mode: 'create' | 'update';
        snippetId?: string;
        input: CreateSnippetInput | UpdateSnippetInput;
    }) => Promise<SnippetRecord>;
    propertyPersistenceAdapter?: SharedPropertiesToolbarProps['propertyPersistenceAdapter'];
}
export function useSnippetEditor(props: SnippetEditorViewProps) {
    const { snippetId, onBack, initialDraftKey, initialDraftConfig, initialTagIds, onSnippetCreated, saveSnippetAdapter, propertyPersistenceAdapter, } = props;
    const onSnippetCreatedRef = useRef(onSnippetCreated);
    onSnippetCreatedRef.current = onSnippetCreated;
    const propertyPersistenceAdapterRef = useRef(propertyPersistenceAdapter);
    propertyPersistenceAdapterRef.current = propertyPersistenceAdapter;
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
    const lastSavedConfigRef = useRef<string | Record<string, any>>(initialDraftConfig || '');
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
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
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>(!snippetId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : []);
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
    const visibleSaveRequestedDuringLockRef = useRef(false);
    const isDirtyRef = useRef(false);
    // Keep track of latest inputs for retry to avoid stale closures!
    const currentInputsRef = useRef({ snippetTitle, snippetConfig, organisationId, tagIds, isInitialized, snippetShortcut });
    currentInputsRef.current = { snippetTitle, snippetConfig, organisationId, tagIds, isInitialized, snippetShortcut };
    const hasMountedDraftRef = useRef(false);
    // Natively sync across tabs using Dexie's useLiveQuery
    const liveSnippet = useSnippet(activeSnippetId);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const versionHistory = liveSnippet?.versionHistory;
    const versionHistoryItems = useMemo(() => {
        if (!versionHistory || !Array.isArray(versionHistory.versions) || versionHistory.versions.length === 0) {
            return [];
        }
        const historyEntries = getVersionsNewestFirst(versionHistory);
        const items: Array<{
            id: string;
            label: string;
            savedAt?: number;
            isCurrent?: boolean;
        }> = [
            { id: 'current', label: 'Current', isCurrent: true }
        ];
        historyEntries.forEach((entry, idx) => {
            const versionNum = historyEntries.length - idx;
            items.push({
                id: entry.id,
                label: `Version ${versionNum}`,
                savedAt: entry.savedAt,
            });
        });
        return items;
    }, [versionHistory]);
    const historicalSnapshot = useMemo(() => {
        if (!selectedVersionId || selectedVersionId === 'current' || !versionHistory)
            return null;
        return getSnapshotById(versionHistory, selectedVersionId);
    }, [selectedVersionId, versionHistory]);
    const isViewingHistory = Boolean(historicalSnapshot);
    const displayTitle = historicalSnapshot ? historicalSnapshot.title : snippetTitle;
    const displayConfig = historicalSnapshot ? historicalSnapshot.config : snippetConfig;
    const displayTagIds = historicalSnapshot ? historicalSnapshot.tagIds : tagIds;
    const displayOrganisationId = historicalSnapshot ? historicalSnapshot.organisationId : organisationId;
    const displayShortcut = (historicalSnapshot && historicalSnapshot.shortcut) ? historicalSnapshot.shortcut : snippetShortcut;
    useEffect(() => {
        setSelectedVersionId(null);
    }, [snippetId, activeSnippetId]);
    // Helper to safely compare configs (which might be strings or objects)
    const isConfigEqual = (configA: string | Record<string, any>, configB: string | Record<string, any>) => {
        const normalize = (c: any) => typeof c === 'string' ? c : JSON.stringify(c);
        return normalize(configA) === normalize(configB);
    };
    const sanitizeTitleToShortcut = (title: string) => {
        return title.toLowerCase().replace(/[^a-z0-9_]/g, '');
    };
    const isDirty = useMemo(() => {
        if (isViewingHistory)
            return false;
        if (!isInitialized || !isShortcutInitialized)
            return false;
        const hasTitle = snippetTitle.trim().length > 0;
        const normalizedConfig = typeof snippetConfig === 'string' ? snippetConfig : JSON.stringify(snippetConfig || {});
        const hasConfig = normalizedConfig.trim().length > 0 && normalizedConfig !== '[]' && normalizedConfig !== '{}';
        // If it's a new snippet and has not yet received both title and config, it is not dirty
        if (!activeSnippetId && (!hasTitle || !hasConfig)) {
            return false;
        }
        const titleChanged = snippetTitle !== lastSavedTitleRef.current;
        const configChanged = !isConfigEqual(snippetConfig, lastSavedConfigRef.current);
        const organisationChanged = organisationId !== lastSavedOrganisationIdRef.current;
        const shortcutChanged = isShortcutInitialized && snippetShortcut !== lastSavedShortcutRef.current;
        // Tag order is the hierarchy path, so a move is a real edit.
        const tagsChanged = tagIds.length !== lastSavedTagIdsRef.current.length ||
            tagIds.join(',') !== lastSavedTagIdsRef.current.join(',');
        return titleChanged || configChanged || organisationChanged || tagsChanged || shortcutChanged;
    }, [activeSnippetId, snippetTitle, snippetConfig, organisationId, tagIds, snippetShortcut, isInitialized, isShortcutInitialized]);
    isDirtyRef.current = isDirty;
    const handleSave = useCallback(async (silent: boolean = false, overrideProps?: Partial<SharedProperties> | null): Promise<boolean> => {
        if (overrideProps?.textCommandApproval && savePromiseRef.current) {
            await savePromiseRef.current;
            return handleSave(silent, overrideProps);
        }
        // ALWAYS read from refs to avoid stale closure issues during retries
        const { snippetTitle: currentTitle, snippetConfig: currentConfig, organisationId: currentWsId, tagIds: currentTIds, isInitialized: currentIsInit, snippetShortcut: currentShortcut } = currentInputsRef.current;
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
                if (!silent)
                    visibleSaveRequestedDuringLockRef.current = true;
                saveAgainRef.current = true;
                return savePromiseRef.current;
            }
            const performDelete = async (): Promise<boolean> => {
                saveInProgressRef.current = true;
                try {
                    const wsObj = currentWsId ? { organisation_id: currentWsId } : null;
                    const compoundId = getItemCompoundId({ snippet: { id: currentSnippetId }, organisation: wsObj });
                    await clearShortcut(currentSnippetId, compoundId, 'snippet');
                    await deleteSnippet(currentSnippetId);
                    if (activeSnippetIdRef.current === savingSnippetId) {
                        activeSnippetIdRef.current = null;
                        setActiveSnippetId(null);
                        lastSavedTitleRef.current = '';
                        lastSavedConfigRef.current = '';
                        lastSavedOrganisationIdRef.current = null;
                        lastSavedTagIdsRef.current = [];
                        lastSavedShortcutRef.current = '';
                        setSaveStatus('idle');
                        setLastSavedAt(null);
                    }
                    return true;
                }
                catch (err) {
                    console.error('Auto-delete failed:', err);
                    return false;
                }
                finally {
                    saveInProgressRef.current = false;
                    savePromiseRef.current = null;
                    if (saveAgainRef.current && activeSnippetIdRef.current !== null) {
                        saveAgainRef.current = false;
                        return handleSave(silent);
                    }
                    else {
                        saveAgainRef.current = false;
                    }
                }
            };
            savePromiseRef.current = performDelete();
            return savePromiseRef.current;
        }
        // Save Concurrency Control (Save Lock)
        if (savePromiseRef.current) {
            if (!silent)
                visibleSaveRequestedDuringLockRef.current = true;
            saveAgainRef.current = true;
            return savePromiseRef.current;
        }
        const performSave = async (): Promise<boolean> => {
            saveInProgressRef.current = true;
            if (!silent)
                setSaveStatus('saving');
            // Use override props if provided (allows synchronous saves on toolbar updates)
            let activeOrganisationId = currentWsId;
            let activeTagIds = currentTIds;
            let activeShortcut = currentShortcut;
            if (overrideProps) {
                if (overrideProps.organisationId !== undefined)
                    activeOrganisationId = overrideProps.organisationId;
                if (overrideProps.selectedTags)
                    activeTagIds = overrideProps.selectedTags.map(t => t.id);
                if (overrideProps.pendingShortcut !== undefined)
                    activeShortcut = overrideProps.pendingShortcut;
            }
            try {
                // Convert any temp tags into real tags before saving
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
                                resolvedTagIds.push(tId);
                            }
                        }
                        else {
                            resolvedTagIds.push(tId);
                        }
                    }
                    activeTagIds = resolvedTagIds;
                }
                let savedSnippet: SnippetRecord;
                if (!currentSnippetId) {
                    // CREATE SNIPPET
                    const input: CreateSnippetInput = {
                        organisationId: activeOrganisationId,
                        title: currentTitle,
                        config: currentConfig,
                        tagIds: activeTagIds,
                        shortcut: activeShortcut,
                    };
                    savedSnippet = saveSnippetAdapter
                        ? await saveSnippetAdapter({ mode: 'create', input })
                        : await createSnippet(input);
                    if (onSnippetCreatedRef.current) {
                        try {
                            await onSnippetCreatedRef.current(savedSnippet);
                        }
                        catch (err) {
                            console.error('[useSnippetEditor] onSnippetCreated callback failed:', err);
                        }
                    }
                }
                else {
                    // UPDATE SNIPPET
                    const input: UpdateSnippetInput = {
                        title: currentTitle,
                        config: currentConfig,
                        organisationId: activeOrganisationId,
                        tagIds: activeTagIds,
                        shortcut: activeShortcut,
                    };
                    savedSnippet = saveSnippetAdapter
                        ? await saveSnippetAdapter({ mode: 'update', snippetId: currentSnippetId, input })
                        : await updateSnippet(currentSnippetId, input);
                }
                // Save shortcut!
                const wsObj = savedSnippet.organisationId ? { organisation_id: savedSnippet.organisationId } : null;
                const newCompoundId = getItemCompoundId({ snippet: savedSnippet, organisation: wsObj });
                if (currentSnippetId) {
                    const oldWsObj = lastSavedOrganisationIdRef.current ? { organisation_id: lastSavedOrganisationIdRef.current } : null;
                    const oldCompoundId = getItemCompoundId({ snippet: { id: currentSnippetId, category: 'snippet' }, organisation: oldWsObj });
                    if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
                        await migrateItemCompoundId(oldCompoundId, newCompoundId, 'snippet');
                    }
                }
                const compoundId = newCompoundId;
                const finalShortcut = (activeShortcut || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (finalShortcut) {
                    const valRes = await validateShortcut(finalShortcut, savedSnippet.id);
                    if (valRes.isValid || overrideProps?.textCommandApproval) {
                        console.log(`[ShortcutDebug][SnippetEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for snippet "${savedSnippet.id}"...`);
                        if (propertyPersistenceAdapterRef.current?.saveShortcut) {
                            await propertyPersistenceAdapterRef.current.saveShortcut({
                                id: savedSnippet.id,
                                referenceId: compoundId,
                                shortcut: finalShortcut,
                                label: savedSnippet.title,
                                type: 'snippet',
                                approval: overrideProps?.textCommandApproval,
                            });
                        }
                        else {
                            await saveShortcutGuarded(compoundId, finalShortcut, 'snippet', overrideProps?.textCommandApproval);
                        }
                    }
                    else {
                        console.warn(`[ShortcutDebug][SnippetEditor] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
                    }
                    // Always update the ref to prevent infinite autosave loops
                    lastSavedShortcutRef.current = finalShortcut;
                }
                else if (lastSavedShortcutRef.current !== '') {
                    console.log(`[ShortcutDebug][SnippetEditor] handleSave: Clearing shortcut for snippet "${savedSnippet.id}"...`);
                    if (propertyPersistenceAdapterRef.current?.clearShortcut) {
                        await propertyPersistenceAdapterRef.current.clearShortcut({
                            id: savedSnippet.id,
                            referenceId: compoundId,
                            type: 'snippet',
                        });
                    }
                    else {
                        await clearShortcut(savedSnippet.id, compoundId, 'snippet');
                    }
                    lastSavedShortcutRef.current = '';
                }
                if (activeSnippetIdRef.current !== savingSnippetId) {
                    visibleSaveRequestedDuringLockRef.current = false;
                    return true; // Saved to DB, but do not update this editor
                }
                // For new snippets, bind the new snippet ID
                if (!currentSnippetId) {
                    activeSnippetIdRef.current = savedSnippet.id;
                    setActiveSnippetId(savedSnippet.id);
                }
                // Sync inputs if they haven't changed since the save started
                if (currentInputsRef.current.organisationId === activeOrganisationId)
                    setOrganisationId(savedSnippet.organisationId);
                ;
                if (currentInputsRef.current.tagIds === activeTagIds)
                    setTagIds(savedSnippet.tagIds);
                if (currentInputsRef.current.snippetTitle === currentTitle)
                    setSnippetTitle(savedSnippet.title);
                if (isConfigEqual(currentInputsRef.current.snippetConfig, currentConfig))
                    setSnippetConfig(savedSnippet.config);
                setSnippetShortcut(finalShortcut);
                lastSavedTitleRef.current = savedSnippet.title;
                lastSavedConfigRef.current = savedSnippet.config;
                lastSavedOrganisationIdRef.current = savedSnippet.organisationId;
                lastSavedTagIdsRef.current = savedSnippet.tagIds;
                // Persist default selections to StorageManager
                if (savedSnippet.organisationId)
                    StorageManager.setItem('lastUsedOrganisationId', savedSnippet.organisationId);
                if (!silent || visibleSaveRequestedDuringLockRef.current) {
                    setSaveStatus('saved');
                    setLastSavedAt(new Date(savedSnippet.updatedAt));
                }
                visibleSaveRequestedDuringLockRef.current = false;
                return true;
            }
            catch (msg) {
                console.error('Save failed:', msg);
                visibleSaveRequestedDuringLockRef.current = false;
                setSaveStatus('error');
                return false;
            }
            finally {
                saveInProgressRef.current = false;
                savePromiseRef.current = null;
                if (saveAgainRef.current && activeSnippetIdRef.current !== null) {
                    saveAgainRef.current = false;
                    // Trigger save again with the LATEST refs! (Do not pass stale overrideProps)
                    return handleSave(silent);
                }
                else {
                    saveAgainRef.current = false;
                }
            }
        }; // end performSave
        savePromiseRef.current = performSave();
        return savePromiseRef.current;
    }, []); // NO DEPS! Safe because it reads entirely from currentInputsRef.current
    const handleDelete = useCallback(async () => {
        const currentSnippetId = activeSnippetIdRef.current;
        if (!currentSnippetId) {
            if (onBack)
                onBack();
            return;
        }
        setIsDeleteDialogOpen(false);
        try {
            const wsObj = organisationId ? { organisation_id: organisationId } : null;
            const compoundId = getItemCompoundId({ snippet: { id: currentSnippetId }, organisation: wsObj });
            await clearShortcut(currentSnippetId, compoundId, 'snippet');
            await deleteSnippet(currentSnippetId);
            if (onBack)
                onBack();
        }
        catch (msg) {
            console.error('Delete failed:', msg);
        }
    }, [onBack, organisationId]);
    const handleClose = useCallback(() => {
        if (isDirty) {
            setIsUnsavedChangesDialogOpen(true);
        }
        else {
            if (onBack)
                onBack();
        }
    }, [isDirty, onBack]);
    // Autosave effect triggered by input changes
    useEffect(() => {
        if (!isDirty)
            return;
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
    }, [snippetTitle, snippetConfig, organisationId, tagIds, snippetShortcut, handleSave, isDirty]);
    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
            if (isDirtyRef.current) {
                void handleSave(true);
            }
        };
    }, [handleSave]);
    // Synchronize shortcut from DB on load or activeSnippetId changes
    useEffect(() => {
        if (activeSnippetId) {
            const loadSavedShortcut = async () => {
                try {
                    const wsObj = organisationId ? { organisation_id: organisationId } : null;
                    const targetCompoundId = getItemCompoundId({
                        id: activeSnippetId,
                        organisation_id: wsObj?.organisation_id,
                        snippet: { id: activeSnippetId, category: 'snippet' }
                    });
                    const shortcutsMap = await readAllShortcuts();
                    let sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] || shortcutsMap[activeSnippetId] || '');
                    if (!sc) {
                        const matchingKey = Object.keys(shortcutsMap).find(key => key === activeSnippetId || key.endsWith(`-${activeSnippetId}`));
                        if (matchingKey) {
                            sc = normalizeShortcutTrigger(shortcutsMap[matchingKey] || '');
                        }
                    }
                    if (isMounted.current) {
                        if (!isShortcutManuallyEditedRef.current) {
                            setSnippetShortcut(sc);
                        }
                        lastSavedShortcutRef.current = sc;
                        setIsShortcutInitialized(true);
                    }
                }
                catch (err) {
                    console.error('Failed to load shortcut:', err);
                    if (isMounted.current) {
                        setIsShortcutInitialized(true);
                    }
                }
            };
            void loadSavedShortcut();
        }
        else {
            setIsShortcutInitialized(true);
        }
    }, [activeSnippetId, organisationId]);
    // If liveSnippet is fetched from IndexedDB, update the editor if we aren't currently dirty
    useEffect(() => {
        if (!liveSnippet || !activeSnippetId)
            return;
        let parsedConfig = liveSnippet.config;
        if (typeof liveSnippet.config === 'string') {
            try {
                parsedConfig = JSON.parse(liveSnippet.config);
            }
            catch (e) {
                // ignore
            }
        }
        if (!isInitialized) {
            // First load of an existing snippet
            setSnippetTitle(liveSnippet.title);
            setSnippetConfig(parsedConfig);
            setOrganisationId(liveSnippet.organisationId);
            setTagIds(liveSnippet.tagIds);
            lastSavedTitleRef.current = liveSnippet.title;
            lastSavedConfigRef.current = parsedConfig;
            lastSavedOrganisationIdRef.current = liveSnippet.organisationId;
            lastSavedTagIdsRef.current = liveSnippet.tagIds;
            setLastSavedAt(new Date(liveSnippet.updatedAt));
            setSaveStatus('saved');
            setIsInitialized(true);
        }
        else if (!isDirty) {
            // Background sync from other tabs
            setSnippetTitle(liveSnippet.title);
            setSnippetConfig(parsedConfig);
            setOrganisationId(liveSnippet.organisationId);
            setTagIds(liveSnippet.tagIds);
            lastSavedTitleRef.current = liveSnippet.title;
            lastSavedConfigRef.current = parsedConfig;
            lastSavedOrganisationIdRef.current = liveSnippet.organisationId;
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
        }
        else {
            setSnippetTitle('');
            setSnippetConfig('');
            setSnippetShortcut('');
            const initDefaults = async () => {
                const savedWsId = await StorageManager.getItem('lastUsedOrganisationId');
                if (savedWsId) {
                    setOrganisationId(savedWsId);
                }
                else {
                    const smartWs = await getSmartDefaultOrganisation();
                    if (smartWs) {
                        const wsId = smartWs.id;
                        setOrganisationId(wsId);
                    }
                    else {
                        setOrganisationId(null);
                    }
                }
            };
            void initDefaults();
            setTagIds([]);
            lastSavedTitleRef.current = '';
            lastSavedConfigRef.current = '';
            lastSavedOrganisationIdRef.current = null;
            lastSavedTagIdsRef.current = [];
            lastSavedShortcutRef.current = '';
            setSaveStatus('idle');
            setIsInitialized(true);
        }
    }, []);
    const handlePropertiesChange = useCallback((newProps: Partial<SharedProperties>) => {
        if (selectedVersionId && selectedVersionId !== 'current')
            return;
        const prevWsId = currentInputsRef.current.organisationId;
        const prevTIds = currentInputsRef.current.tagIds;
        let wId = prevWsId;
        let tIds = prevTIds;
        if (newProps.organisationId !== undefined) {
            wId = newProps.organisationId;
        }
        if (newProps.selectedTags)
            tIds = newProps.selectedTags.map((t: any) => t.id);
        const tagsChanged = tIds.join(',') !== prevTIds.join(',');
        const locationChanged = prevWsId !== wId;
        let shortcutChanged = false;
        if (newProps.pendingShortcut !== undefined) {
            const normSc = (newProps.pendingShortcut || '').toLowerCase().trim();
            if (normSc !== (currentInputsRef.current.snippetShortcut || '').toLowerCase().trim()) {
                shortcutChanged = true;
                setSnippetShortcut(normSc);
                currentInputsRef.current.snippetShortcut = normSc;
            }
        }
        if (!locationChanged && !tagsChanged && !shortcutChanged)
            return;
        setOrganisationId(wId);
        setTagIds(tIds);
        currentInputsRef.current.tagIds = tIds;
        // Persist changes to StorageManager for defaults
        if (wId)
            StorageManager.setItem('lastUsedOrganisationId', wId);
        // Trigger an immediate SILENT save if location or tags change!
        void handleSave(true, newProps);
    }, [handleSave, selectedVersionId]);
    const flushSave = useCallback(async () => {
        const refreshDirtyRef = () => {
            const current = currentInputsRef.current;
            const hasTitle = current.snippetTitle.trim().length > 0;
            const normalizedConfig = typeof current.snippetConfig === 'string'
                ? current.snippetConfig
                : JSON.stringify(current.snippetConfig || {});
            const hasConfig = normalizedConfig.trim().length > 0 && normalizedConfig !== '{}' && normalizedConfig !== '[]';
            if (!activeSnippetIdRef.current && (!hasTitle || !hasConfig)) {
                isDirtyRef.current = false;
                return;
            }
            isDirtyRef.current =
                current.snippetTitle !== lastSavedTitleRef.current ||
                    !isConfigEqual(current.snippetConfig, lastSavedConfigRef.current) ||
                    current.organisationId !== lastSavedOrganisationIdRef.current
                    ||
                        current.tagIds.join(',') !== lastSavedTagIdsRef.current.join(',') ||
                    current.snippetShortcut !== lastSavedShortcutRef.current;
        };
        while (savePromiseRef.current || isDirtyRef.current) {
            if (savePromiseRef.current) {
                await savePromiseRef.current;
                refreshDirtyRef();
            }
            if (isDirtyRef.current) {
                const saved = await handleSave(false);
                refreshDirtyRef();
                if (!saved)
                    return false;
            }
        }
        return !isDirtyRef.current;
    }, [handleSave]);
    return {
        snippetTitle: displayTitle,
        snippetConfig: displayConfig,
        snippetShortcut: displayShortcut,
        activeSnippetId: snippetId || activeSnippetId,
        liveSnippet,
        organisationId: displayOrganisationId,
        tagIds: displayTagIds,
        saveStatus,
        setSaveStatus,
        lastSavedAt,
        setLastSavedAt,
        lastSavedTitleRef,
        lastSavedShortcutRef,
        isDirty: isViewingHistory ? false : isDirty,
        isDeleteDialogOpen,
        isUnsavedChangesDialogOpen,
        setSnippetTitle: updateSnippetTitleAndShortcut,
        setSnippetConfig,
        setSnippetShortcut: updateSnippetShortcut,
        handleSave: async (silent?: boolean, overrideProps?: any) => {
            if (selectedVersionId && selectedVersionId !== 'current')
                return false;
            return handleSave(silent, overrideProps);
        },
        flushSave,
        handleDelete,
        handleClose,
        setIsDeleteDialogOpen,
        setIsUnsavedChangesDialogOpen,
        handlePropertiesChange,
        loadSnippet,
        isInitialized: isInitialized && (snippetId === activeSnippetId),
        isShortcutInitialized,
        versionHistoryItems,
        selectedVersionId,
        setSelectedVersionId,
        isViewingHistory,
    };
}
