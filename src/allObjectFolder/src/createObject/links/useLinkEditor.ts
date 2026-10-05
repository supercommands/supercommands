/**
 * @file useLinkEditor.ts
 * @description A custom React hook containing state management and logic for the Link editor,
 * including debounced autosaving, workspace sync, tag mapping, deletion, and concurrency conflict handling.
 *
 * @usage
 * ```tsx
 * import { useLinkEditor } from './useLinkEditor';
 * const state = useLinkEditor({ linkId });
 * ```
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createLink, updateLink, deleteLink } from './linkData';
import { createTag } from '../tags/tagData';
import type { LinkRecord, CreateLinkInput, UpdateLinkInput, LinkItem } from './linkTypes';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import { sameTagOrder } from '../../../../shared-components/editorToolbar/tagOrder';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { clearShortcut } from '../../../../shared-components/shortcuts';
import { saveShortcutGuarded } from '../../../../shared-components/shortcuts';
import type { ShortcutAssignmentApproval } from '../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import { useShortcutValidation } from '../../../../shared-components/shortcuts/hooks/useShortcutValidation';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';
import { getVersionsNewestFirst, getSnapshotById } from '../../../../shared-components/versionHistory/structuredVersionHistory';
type LinkPropertyPersistenceAdapter = {
    saveShortcut?: (args: {
        id: string;
        referenceId: string;
        shortcut: string;
        label: string;
        type: string;
        approval?: ShortcutAssignmentApproval;
    }) => Promise<void>;
    clearShortcut?: (args: {
        id: string;
        referenceId: string;
        type: string;
    }) => Promise<void>;
    createTag?: (args: {
        name: string;
        workspaceId?: string | null;
    }) => Promise<{
        id: string;
        name?: string;
        workspaceId?: string | null;
    }>;
};
export interface UseLinkEditorParams {
    linkId?: string; // If provided, load this link
    initialDraftKey?: string; // Optional initial title for a new link
    initialDraftUrls?: LinkItem[]; // Optional initial urls for a new link
    initialTagIds?: string[];
    onLinkCreated?: (link: LinkRecord) => void | Promise<void>;
    saveLinkAdapter?: (args: {
        mode: 'create' | 'update';
        linkId?: string;
        input: CreateLinkInput | UpdateLinkInput;
    }) => Promise<LinkRecord>;
    propertyPersistenceAdapter?: LinkPropertyPersistenceAdapter;
}
export interface LinkEditorProps extends UseLinkEditorParams {
    onBack?: () => void;
}
const areLinkItemsEqual = (a: LinkItem[], b: LinkItem[]) => {
    if (a.length !== b.length)
        return false;
    return a.every((item, i) => item.url === b[i].url && (item.title || item.name) === (b[i].title || b[i].name) && item.id === b[i].id);
};
const areStringArraysEqual = sameTagOrder;
const normalizeEditorShortcut = (value: string) => normalizeShortcutTrigger(value || '')
    .replace(/^c[_\s-]+/i, '')
    .replace(/[^a-z0-9_]/g, '');
const getDirtyDebugSnapshot = ({ activeLinkId, linkTitle, linkUrls, organisationId, tagIds, linkShortcut, lastSavedTitle, lastSavedUrls, lastSavedOrganisationId, lastSavedTagIds, lastSavedShortcut, }: {
    activeLinkId: string | null;
    linkTitle: string;
    linkUrls: LinkItem[];
    organisationId: string | null;
    tagIds: string[];
    linkShortcut: string;
    lastSavedTitle: string;
    lastSavedUrls: LinkItem[];
    lastSavedOrganisationId: string | null;
    lastSavedTagIds: string[];
    lastSavedShortcut: string;
}) => {
    const hasTitle = linkTitle.trim().length > 0;
    const hasUrls = linkUrls.length > 0;
    return {
        activeLinkId,
        hasTitle,
        hasUrls,
        titleChanged: linkTitle !== lastSavedTitle,
        urlsChanged: !areLinkItemsEqual(linkUrls, lastSavedUrls),
        organisationChanged: organisationId !== lastSavedOrganisationId,
        tagsChanged: !areStringArraysEqual(tagIds, lastSavedTagIds),
        shortcutChanged: normalizeEditorShortcut(linkShortcut) !== normalizeEditorShortcut(lastSavedShortcut),
        current: {
            title: linkTitle,
            urlCount: linkUrls.length,
            organisationId,
            tagIds,
            shortcut: normalizeEditorShortcut(linkShortcut),
        },
        saved: {
            title: lastSavedTitle,
            urlCount: lastSavedUrls.length,
            organisationId: lastSavedOrganisationId,
            tagIds: lastSavedTagIds,
            shortcut: normalizeEditorShortcut(lastSavedShortcut),
        },
    };
};
export function useLinkEditor(props: LinkEditorProps) {
    const { linkId, onBack, initialDraftKey, initialDraftUrls, initialTagIds, onLinkCreated, saveLinkAdapter, propertyPersistenceAdapter, } = props;
    const titleInputRef = useRef<HTMLInputElement>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);
    const onLinkCreatedRef = useRef(onLinkCreated);
    onLinkCreatedRef.current = onLinkCreated;
    const saveLinkAdapterRef = useRef(saveLinkAdapter);
    saveLinkAdapterRef.current = saveLinkAdapter;
    const propertyPersistenceAdapterRef = useRef(propertyPersistenceAdapter);
    propertyPersistenceAdapterRef.current = propertyPersistenceAdapter;
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
    const lastSavedUrlsRef = useRef<LinkItem[]>(initialDraftUrls || []);
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
    const lastSavedTagIdsRef = useRef<string[]>([]);
    const lastSavedUpdatedAtRef = useRef<number | null>(null);
    // We use this ref to synchronously track ID creation inside save locks
    const activeLinkIdRef = useRef<string | null>(linkId ?? null);
    const requestedLinkIdRef = useRef<string | null>(linkId ?? null);
    const [activeLinkId, setActiveLinkId] = useState<string | null>(linkId ?? null);
    const [linkTitle, setLinkTitle] = useState<string>(initialDraftKey || '');
    const [linkUrls, setLinkUrls] = useState<LinkItem[]>(initialDraftUrls || []);
    const { validateShortcut } = useShortcutValidation();
    const [linkShortcut, setLinkShortcut] = useState<string>('');
    const lastSavedShortcutRef = useRef<string>('');
    const isShortcutManuallyEditedRef = useRef<boolean>(false);
    // Editor state tracking for location and tags
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>(!linkId && Array.isArray(initialTagIds) ? [...initialTagIds] : []);
    const [isInitialized, setIsInitialized] = useState<boolean>(!linkId);
    const [isShortcutInitialized, setIsShortcutInitialized] = useState<boolean>(!linkId);
    const [saveStatusRaw, setSaveStatusRaw] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
    const setSaveStatus = useCallback((status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict') => {
        console.log('[DEBUG-SaveStatus] setSaveStatus called with:', status);
        setSaveStatusRaw(status);
    }, []);
    const saveStatus = saveStatusRaw;
    const [saveError, setSaveError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isLinkDeleted, setIsLinkDeleted] = useState(false);
    const hasLoadedLiveLinkRef = useRef(false);
    const hasLoadedShortcutRef = useRef(false);
    const isImportedCloudSnippetRef = useRef(false);
    const [conflictLink, setConflictLink] = useState<LinkRecord | null>(null);
    const hasConflictRef = useRef(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);
    // Save Lock to prevent overlapping autosaves
    const saveAgainRef = useRef(false);
    const savePromiseRef = useRef<Promise<string | boolean> | null>(null);
    const pendingSaveAfterInitRef = useRef(false);
    const isDirtyRef = useRef(false);
    // Keep track of latest inputs for retry to avoid stale closures!
    const currentInputsRef = useRef({ linkTitle, linkUrls, organisationId, tagIds, isInitialized, linkShortcut });
    currentInputsRef.current = { linkTitle, linkUrls, organisationId, tagIds, isInitialized, linkShortcut };
    // The collection sheet keeps this hook mounted while selecting different rows.
    // Bind the requested record before prefilled fields can be treated as a new draft.
    useEffect(() => {
        const requestedId = linkId ?? null;
        if (requestedLinkIdRef.current === requestedId)
            return;
        requestedLinkIdRef.current = requestedId;
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        isDirtyRef.current = false;
        saveAgainRef.current = false;
        pendingSaveAfterInitRef.current = false;
        activeLinkIdRef.current = requestedId;
        setActiveLinkId(requestedId);
        setLinkTitle('');
        setLinkUrls([]);
        setOrganisationId(null);
        setTagIds([]);
        setLinkShortcut('');
        isShortcutManuallyEditedRef.current = false;
        hasLoadedShortcutRef.current = false;
        hasLoadedLiveLinkRef.current = false;
        lastSavedTitleRef.current = '';
        lastSavedUrlsRef.current = [];
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = [];
        lastSavedShortcutRef.current = '';
        lastSavedUpdatedAtRef.current = null;
        currentInputsRef.current = {
            linkTitle: '', linkUrls: [], organisationId: null, tagIds: [],
            isInitialized: !requestedId, linkShortcut: '',
        };
        setIsInitialized(!requestedId);
        setIsShortcutInitialized(!requestedId);
        setSaveStatus('idle');
        setLastSavedAt(null);
        setSaveError(null);
        hasConflictRef.current = false;
        setConflictLink(null);
    }, [linkId]);
    // Natively sync across tabs using centralized useDbStore
    const liveLink = useDbStore(state => state.links.find(l => l.id === activeLinkId));
    const liveLinkRef = useRef(liveLink);
    liveLinkRef.current = liveLink;
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const versionHistory = liveLink?.versionHistory;
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
    const displayTitle = historicalSnapshot ? historicalSnapshot.title : linkTitle;
    const displayUrls = historicalSnapshot ? historicalSnapshot.urls : linkUrls;
    const displayOrganisationId = historicalSnapshot ? historicalSnapshot.organisationId : organisationId;
    const displayTagIds = historicalSnapshot ? historicalSnapshot.tagIds : tagIds;
    const displayShortcut = (historicalSnapshot && historicalSnapshot.shortcut) ? historicalSnapshot.shortcut : linkShortcut;
    useEffect(() => {
        setSelectedVersionId(null);
    }, [linkId, activeLinkId]);
    let isDirty = false;
    if (isViewingHistory) {
        isDirty = false;
    }
    else if (isInitialized && isShortcutInitialized) {
        const hasTitle = linkTitle.trim().length > 0;
        const hasUrls = linkUrls.length > 0;
        // If it's a new link and has not yet received both title and urls, it is not dirty
        if (!activeLinkId && (!hasTitle || !hasUrls)) {
            isDirty = false;
        }
        else {
            const titleChanged = linkTitle !== lastSavedTitleRef.current;
            const organisationChanged = organisationId !== lastSavedOrganisationIdRef.current;
            // Check URL array changes using helper
            const urlsChanged = !areLinkItemsEqual(linkUrls, lastSavedUrlsRef.current);
            // Check if tag IDs match using set equality
            const tagsChanged = !areStringArraysEqual(tagIds, lastSavedTagIdsRef.current);
            const shortcutChanged = isShortcutInitialized && normalizeEditorShortcut(linkShortcut) !== normalizeEditorShortcut(lastSavedShortcutRef.current);
            isDirty = titleChanged || urlsChanged || organisationChanged || tagsChanged || shortcutChanged;
        }
    }
    isDirtyRef.current = isDirty;
    useEffect(() => {
        console.log('[LinkEditor Debug] Dirty snapshot', getDirtyDebugSnapshot({
            activeLinkId,
            linkTitle,
            linkUrls,
            organisationId,
            tagIds,
            linkShortcut,
            lastSavedTitle: lastSavedTitleRef.current,
            lastSavedUrls: lastSavedUrlsRef.current,
            lastSavedOrganisationId: lastSavedOrganisationIdRef.current,
            lastSavedTagIds: lastSavedTagIdsRef.current,
            lastSavedShortcut: lastSavedShortcutRef.current,
        }));
    }, [activeLinkId, linkTitle, linkUrls, organisationId, tagIds, linkShortcut, isDirty]);
    const isEditMode = !!linkId || !!activeLinkId;
    // Synchronize shortcut from DB on load or activeLinkId changes
    useEffect(() => {
        if (activeLinkIdRef.current !== activeLinkId)
            return;
        if (!activeLinkId) {
            setLinkShortcut('');
            lastSavedShortcutRef.current = '';
            hasLoadedShortcutRef.current = false;
            setIsShortcutInitialized(true);
            return;
        }
        setIsShortcutInitialized(false);
        let cancelled = false;
        const loadSavedShortcut = async () => {
            try {
                const wsObj = organisationId ? { organisation_id: organisationId } : null;
                const targetCompoundId = getItemCompoundId({
                    id: activeLinkId,
                    organisation_id: wsObj?.organisation_id,
                    snippet: { id: activeLinkId, category: 'link' },
                });
                const shortcutsMap = await readAllShortcuts();
                let sc = normalizeEditorShortcut(shortcutsMap[targetCompoundId] || shortcutsMap[activeLinkId] || '');
                if (!sc) {
                    const matchingKey = Object.keys(shortcutsMap).find(key => key === activeLinkId || key.endsWith(`-${activeLinkId}`));
                    if (matchingKey) {
                        sc = normalizeEditorShortcut(shortcutsMap[matchingKey] || '');
                    }
                }
                if (!sc && liveLinkRef.current?.id === activeLinkId) {
                    sc = normalizeEditorShortcut(liveLinkRef.current.shortcut || '');
                }
                if (!cancelled && isMounted.current && activeLinkIdRef.current === activeLinkId) {
                    if (!isShortcutManuallyEditedRef.current) {
                        setLinkShortcut(sc);
                        currentInputsRef.current.linkShortcut = sc;
                    }
                    lastSavedShortcutRef.current = sc;
                    hasLoadedShortcutRef.current = true;
                    setIsShortcutInitialized(true);
                }
            }
            catch (err) {
                console.error('Failed to load shortcut:', err);
                if (!cancelled && isMounted.current && activeLinkIdRef.current === activeLinkId) {
                    setIsShortcutInitialized(true);
                }
            }
        };
        void loadSavedShortcut();
        return () => { cancelled = true; };
    }, [activeLinkId, organisationId]);
    const handleSave = useCallback(async (silent: boolean = false, overrideProps?: Partial<SharedProperties> | null): Promise<string | boolean> => {
        if (overrideProps?.textCommandApproval && savePromiseRef.current) {
            await savePromiseRef.current;
            return handleSave(silent, overrideProps);
        }
        if (hasConflictRef.current)
            return false;
        // ALWAYS read from refs to avoid stale closure issues during retries
        const { linkTitle: currentTitle, linkUrls: currentUrls, organisationId: currentWsId, tagIds: currentTIds, isInitialized: currentIsInit, linkShortcut: currentShortcut, } = currentInputsRef.current;
        if (isMounted.current)
            setSaveError(null);
        if (!silent && autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        const hasTitle = currentTitle.trim().length > 0;
        const hasUrls = currentUrls.length > 0;
        const currentLinkId = activeLinkIdRef.current;
        const savingLinkId = currentLinkId;
        const normalizedCurrentShortcut = normalizeEditorShortcut(currentShortcut);
        const hasMeaningfulChanges = currentTitle !== lastSavedTitleRef.current ||
            !areLinkItemsEqual(currentUrls, lastSavedUrlsRef.current) ||
            currentWsId !== lastSavedOrganisationIdRef.current
            ||
                !areStringArraysEqual(currentTIds, lastSavedTagIdsRef.current) ||
            normalizedCurrentShortcut !== normalizeEditorShortcut(lastSavedShortcutRef.current);
        if (currentLinkId && currentIsInit && hasTitle && hasUrls && !hasMeaningfulChanges && !overrideProps?.textCommandApproval) {
            if (isMounted.current && saveStatusRaw !== 'saved') {
                setSaveStatus('saved');
                if (lastSavedUpdatedAtRef.current !== null) {
                    setLastSavedAt(new Date(lastSavedUpdatedAtRef.current));
                }
            }
            return true;
        }
        // 1. Empty Draft Auto-deletion (or do nothing if it's a new unsaved link)
        if (!hasTitle && !hasUrls) {
            if (!currentLinkId) {
                if (isMounted.current)
                    setSaveStatus('idle');
                return false;
            }
            if (savePromiseRef.current) {
                saveAgainRef.current = true;
                return savePromiseRef.current;
            }
            const performDelete = async (): Promise<boolean> => {
                try {
                    await deleteLink(currentLinkId);
                    if (activeLinkIdRef.current === savingLinkId) {
                        activeLinkIdRef.current = null;
                        setActiveLinkId(null);
                        setIsLinkDeleted(false);
                        lastSavedTitleRef.current = '';
                        lastSavedUrlsRef.current = [];
                        lastSavedOrganisationIdRef.current = null;
                        lastSavedTagIdsRef.current = [];
                        lastSavedUpdatedAtRef.current = null;
                        if (autosaveTimerRef.current)
                            clearTimeout(autosaveTimerRef.current);
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
                    savePromiseRef.current = null;
                    if (saveAgainRef.current && !hasConflictRef.current) {
                        saveAgainRef.current = false;
                        if (autosaveTimerRef.current)
                            clearTimeout(autosaveTimerRef.current);
                        autosaveTimerRef.current = setTimeout(() => handleSave(), 400);
                    }
                }
            };
            savePromiseRef.current = performDelete();
            return savePromiseRef.current;
        }
        // 2. Missing Title Validation
        if (!hasTitle) {
            if (isMounted.current) {
                setSaveError('Enter the title');
            }
            return false;
        }
        // 3. Missing Links Validation
        if (!hasUrls) {
            if (isMounted.current) {
                setSaveError('Add at least one link to this collection');
            }
            return false;
        }
        // Do not save if we are still waiting for the existing link to load its properties
        console.log('[useLinkEditor] handleSave called', { currentLinkId, currentIsInit, isDirty, silent });
        if (currentLinkId && !currentIsInit) {
            console.log('[useLinkEditor] handleSave deferred until init completes', { currentLinkId });
            if (!silent)
                setSaveStatus('saving');
            saveAgainRef.current = true;
            if (autosaveTimerRef.current)
                clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = setTimeout(() => handleSave(silent), 500);
            return false;
        }
        if (!currentLinkId && !hasTitle && !hasUrls) {
            console.log('[useLinkEditor] handleSave early return: nothing to save');
            return false;
        }
        if (currentLinkId && !hasTitle && !hasUrls) {
            console.log('[useLinkEditor] handleSave triggering delete');
            if (savePromiseRef.current) {
                saveAgainRef.current = true;
                return savePromiseRef.current;
            }
            const performDelete = async (): Promise<boolean> => {
                try {
                    await deleteLink(currentLinkId);
                    setIsLinkDeleted(true);
                    setSaveStatus('idle');
                    return true;
                }
                catch (err: any) {
                    console.error('Delete failed during save:', err);
                    return false;
                }
                finally {
                    savePromiseRef.current = null;
                }
            };
            savePromiseRef.current = performDelete();
            return savePromiseRef.current;
        }
        // Save Concurrency Control (Save Lock)
        if (savePromiseRef.current) {
            console.log('[useLinkEditor] handleSave queued (already saving)');
            saveAgainRef.current = true;
            return savePromiseRef.current;
        }
        const performSave = async (): Promise<string | boolean> => {
            let finalResult: string | boolean = false;
            // Re-read latest inputs inside the loop to avoid stale data
            const loopWsId = overrideProps && overrideProps.organisationId !== undefined ? overrideProps.organisationId : currentInputsRef.current.organisationId;
            const loopFId = null;
            let loopTagIds = overrideProps && overrideProps.selectedTags ? overrideProps.selectedTags.map((t: {
                id: string;
            }) => t.id) : currentInputsRef.current.tagIds;
            const loopTitle = currentInputsRef.current.linkTitle;
            const loopUrls = currentInputsRef.current.linkUrls;
            const loopShortcut = overrideProps && overrideProps.pendingShortcut !== undefined
                ? normalizeEditorShortcut(overrideProps.pendingShortcut)
                : currentInputsRef.current.linkShortcut;
            if (!silent && isMounted.current)
                setSaveStatus('saving');
            // Sanitize URLs before saving
            const sanitizedUrls = loopUrls.map(u => {
                let validUrl = u.url.trim();
                if (validUrl) {
                    try {
                        const parsed = new URL(validUrl);
                        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                            validUrl = 'https://' + validUrl;
                        }
                        else if (!parsed.hostname) {
                            validUrl = 'https://' + validUrl;
                        }
                    }
                    catch {
                        if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
                            validUrl = 'https://' + validUrl;
                        }
                    }
                }
                return { ...u, url: validUrl };
            });
            try {
                // Convert any temp tags into real tags before saving
                const finalOrganisationId = loopWsId || (await getSmartDefaultOrganisation())?.id;
                if (finalOrganisationId) {
                    const resolvedTagIds: string[] = [];
                    for (const tId of loopTagIds) {
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
                    loopTagIds = resolvedTagIds;
                }
                let savedLink: LinkRecord;
                const isCreating = !currentLinkId || isImportedCloudSnippetRef.current;
                const previousCompoundId = !isCreating && currentLinkId
                    ? getItemCompoundId({
                        id: currentLinkId,
                        organisation_id: lastSavedOrganisationIdRef.current,
                        snippet: { id: currentLinkId, category: 'link' },
                    })
                    : '';
                if (isCreating) {
                    const input: CreateLinkInput = {
                        id: currentLinkId,
                        organisationId: loopWsId,
                        title: loopTitle,
                        urls: sanitizedUrls,
                        tagIds: loopTagIds,
                        shortcut: loopShortcut,
                    };
                    savedLink = saveLinkAdapterRef.current
                        ? await saveLinkAdapterRef.current({ mode: 'create', input })
                        : await createLink(input);
                    isImportedCloudSnippetRef.current = false;
                    if (onLinkCreatedRef.current) {
                        try {
                            await onLinkCreatedRef.current(savedLink);
                        }
                        catch (err) {
                            console.error('[useLinkEditor] onLinkCreated callback failed:', err);
                        }
                    }
                }
                else {
                    // UPDATE LINK
                    const input: UpdateLinkInput = {
                        title: loopTitle,
                        urls: sanitizedUrls,
                        organisationId: loopWsId,
                        tagIds: loopTagIds,
                        shortcut: loopShortcut,
                        expectedUpdatedAt: lastSavedUpdatedAtRef.current ?? undefined,
                    };
                    const titleChanged = loopTitle !== lastSavedTitleRef.current;
                    const urlsChanged = !areLinkItemsEqual(sanitizedUrls, lastSavedUrlsRef.current);
                    const organisationChanged = loopWsId !== lastSavedOrganisationIdRef.current;
                    const tagsChanged = !areStringArraysEqual(loopTagIds, lastSavedTagIdsRef.current);
                    const normalizedLoopShortcut = normalizeEditorShortcut(loopShortcut);
                    const shortcutChanged = normalizedLoopShortcut !== lastSavedShortcutRef.current;
                    if (!titleChanged && !urlsChanged && !organisationChanged && !tagsChanged && !shortcutChanged) {
                        hasConflictRef.current = false;
                        setConflictLink(null);
                        setSaveStatus('saved');
                        if (lastSavedUpdatedAtRef.current !== null) {
                            setLastSavedAt(new Date(lastSavedUpdatedAtRef.current));
                        }
                        return true;
                    }
                    savedLink = saveLinkAdapterRef.current
                        ? await saveLinkAdapterRef.current({ mode: 'update', linkId: currentLinkId, input })
                        : await updateLink(currentLinkId, input);
                }
                if (activeLinkIdRef.current !== savingLinkId) {
                    return true; // Saved to DB, but do not update this editor
                }
                // For new links, bind the new link ID
                if (!currentLinkId) {
                    activeLinkIdRef.current = savedLink.id;
                    if (isMounted.current)
                        setActiveLinkId(savedLink.id);
                    hasLoadedLiveLinkRef.current = false;
                }
                // Sync inputs if they haven't changed since the save started
                if (currentInputsRef.current.organisationId === loopWsId && isMounted.current)
                    setOrganisationId(savedLink.organisationId);
                if (null === loopFId && isMounted.current)
                    ;
                if (areStringArraysEqual(currentInputsRef.current.tagIds, loopTagIds) && isMounted.current) {
                    setTagIds(savedLink.tagIds);
                }
                if (currentInputsRef.current.linkTitle === loopTitle && isMounted.current)
                    setLinkTitle(savedLink.title);
                // Only update urls if user hasn't typed anything new
                if (areLinkItemsEqual(currentInputsRef.current.linkUrls, loopUrls) && isMounted.current) {
                    setLinkUrls(savedLink.urls);
                }
                lastSavedTitleRef.current = savedLink.title;
                lastSavedUrlsRef.current = savedLink.urls;
                lastSavedOrganisationIdRef.current = savedLink.organisationId;
                lastSavedTagIdsRef.current = savedLink.tagIds;
                lastSavedUpdatedAtRef.current = savedLink.updatedAt;
                hasConflictRef.current = false;
                // Save shortcut!
                const wsObj = savedLink.organisationId ? { organisation_id: savedLink.organisationId } : null;
                const targetCompoundId = getItemCompoundId({
                    id: savedLink.id,
                    organisation_id: wsObj?.organisation_id,
                    snippet: { id: savedLink.id, category: 'link' }
                });
                if (previousCompoundId && targetCompoundId && previousCompoundId !== targetCompoundId) {
                    await migrateItemCompoundId(previousCompoundId, targetCompoundId, 'link');
                }
                if (currentLinkId && currentLinkId !== savedLink.id) {
                    const previousRawIdCompound = getItemCompoundId({
                        id: currentLinkId,
                        organisation_id: savedLink.organisationId,
                        snippet: { id: currentLinkId, category: 'link' },
                    });
                    if (previousRawIdCompound && previousRawIdCompound !== targetCompoundId) {
                        await migrateItemCompoundId(previousRawIdCompound, targetCompoundId, 'link');
                    }
                }
                const finalShortcut = normalizeEditorShortcut(loopShortcut);
                if (finalShortcut && (!currentLinkId || finalShortcut !== normalizeEditorShortcut(lastSavedShortcutRef.current))) {
                    const valRes = await validateShortcut(finalShortcut, savedLink.id);
                    if (valRes.isValid || overrideProps?.textCommandApproval) {
                        console.log(`[ShortcutDebug] handleSave: Valid shortcut "${finalShortcut}", saving to DB for item "${savedLink.id}"...`);
                        if (propertyPersistenceAdapterRef.current?.saveShortcut) {
                            await propertyPersistenceAdapterRef.current.saveShortcut({
                                id: savedLink.id,
                                referenceId: targetCompoundId,
                                shortcut: finalShortcut,
                                label: savedLink.title,
                                type: 'link',
                                approval: overrideProps?.textCommandApproval,
                            });
                        }
                        else {
                            await saveShortcutGuarded(targetCompoundId, finalShortcut, 'link', overrideProps?.textCommandApproval);
                        }
                    }
                    else {
                        console.warn(`[ShortcutDebug] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
                    }
                    // Always update the ref to prevent infinite autosave loops
                    lastSavedShortcutRef.current = finalShortcut;
                }
                else if (!finalShortcut && lastSavedShortcutRef.current !== '') {
                    console.log(`[ShortcutDebug] handleSave: Clearing shortcut for item "${savedLink.id}"...`);
                    if (propertyPersistenceAdapterRef.current?.clearShortcut) {
                        await propertyPersistenceAdapterRef.current.clearShortcut({
                            id: savedLink.id,
                            referenceId: targetCompoundId,
                            type: 'link',
                        });
                    }
                    else {
                        await clearShortcut(savedLink.id, targetCompoundId, 'link');
                    }
                    lastSavedShortcutRef.current = '';
                }
                hasLoadedShortcutRef.current = true;
                if (isMounted.current) {
                    setLinkShortcut(finalShortcut);
                    currentInputsRef.current.linkShortcut = finalShortcut;
                }
                console.log('[LinkEditor Debug] Save settled', getDirtyDebugSnapshot({
                    activeLinkId: savedLink.id,
                    linkTitle: currentInputsRef.current.linkTitle,
                    linkUrls: currentInputsRef.current.linkUrls,
                    organisationId: currentInputsRef.current.organisationId,
                    tagIds: currentInputsRef.current.tagIds,
                    linkShortcut: finalShortcut,
                    lastSavedTitle: savedLink.title,
                    lastSavedUrls: savedLink.urls,
                    lastSavedOrganisationId: savedLink.organisationId,
                    lastSavedTagIds: savedLink.tagIds,
                    lastSavedShortcut: finalShortcut,
                }));
                if (!currentLinkId && isMounted.current && activeLinkIdRef.current !== activeLinkId) {
                    setActiveLinkId(savedLink.id);
                }
                // Persist default selections to localStorage
                const wId = savedLink.organisationId;
                if (wId)
                    void StorageManager.setItem('lastUsedOrganisationId', wId);
                setConflictLink(null);
                if (isMounted.current) {
                    setSaveStatus('saved');
                    if (savedLink.updatedAt) {
                        setLastSavedAt(new Date(savedLink.updatedAt));
                    }
                    else {
                        setLastSavedAt(new Date());
                    }
                }
                finalResult = savedLink.id || true;
            }
            catch (err: any) {
                if (err.name === 'ConflictError') {
                    console.warn('Conflict detected:', err.message);
                    hasConflictRef.current = true;
                    if (autosaveTimerRef.current)
                        clearTimeout(autosaveTimerRef.current);
                    setSaveStatus('conflict');
                    setConflictLink(err.remoteLink ?? liveLinkRef.current ?? null);
                    return false;
                }
                console.error('Save failed:', err);
                if (isMounted.current)
                    setSaveStatus('error');
                finalResult = false;
            }
            finally {
                savePromiseRef.current = null;
                if (saveAgainRef.current && !hasConflictRef.current) {
                    saveAgainRef.current = false;
                    if (autosaveTimerRef.current)
                        clearTimeout(autosaveTimerRef.current);
                    autosaveTimerRef.current = setTimeout(() => handleSave(silent), 400);
                }
            }
            return finalResult;
        }; // end performSave
        savePromiseRef.current = performSave();
        return savePromiseRef.current;
    }, []);
    const handleDelete = useCallback(async () => {
        const currentLinkId = activeLinkIdRef.current;
        if (!currentLinkId) {
            if (onBack)
                onBack();
            return;
        }
        setIsDeleteDialogOpen(false);
        try {
            await deleteLink(currentLinkId);
            if (onBack)
                onBack();
        }
        catch (msg) {
            console.error('Delete failed:', msg);
        }
    }, [onBack]);
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
        if (!isDirty) {
            console.log('[DEBUG-Autosave] Bypassing autosave - isDirty is false');
            return;
        }
        const hasTitle = linkTitle.trim().length > 0;
        const hasUrls = linkUrls.length > 0;
        console.log('[DEBUG-Autosave] isDirty is true, conditions:', { activeLinkId, hasTitle, hasUrls });
        if (activeLinkId || (hasTitle && hasUrls)) {
            setSaveStatus('saving');
        }
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
    }, [linkTitle, linkUrls, linkShortcut, organisationId, tagIds, handleSave, isDirty, activeLinkId]);
    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
            if (isDirtyRef.current && !hasConflictRef.current) {
                void handleSave(true);
            }
        };
    }, [handleSave]);
    // Trigger pending save if user typed before initialization completed
    useEffect(() => {
        if (isInitialized && pendingSaveAfterInitRef.current) {
            pendingSaveAfterInitRef.current = false;
            handleSave();
        }
    }, [isInitialized, handleSave]);
    // If liveLink is fetched from IndexedDB, update the editor if we aren't currently dirty
    useEffect(() => {
        console.log('[DEBUG-Sync] liveLink sync effect triggered:', { liveLink, isDirty, activeLinkId });
        if (liveLink === undefined || !activeLinkId || activeLinkIdRef.current !== activeLinkId)
            return;
        hasLoadedLiveLinkRef.current = true;
        if (liveLink === null) {
            console.log('[DEBUG-Sync] liveLink is null');
            if (!isInitialized) {
                isImportedCloudSnippetRef.current = true;
                setIsInitialized(true);
            }
            return;
        }
        if (lastSavedUpdatedAtRef.current !== null && liveLink.updatedAt <= lastSavedUpdatedAtRef.current) {
            console.log('[DEBUG-Sync] liveLink is older or equal to lastSavedUpdatedAtRef:', { liveLinkUpdate: liveLink.updatedAt, lastSaved: lastSavedUpdatedAtRef.current });
            setIsLinkDeleted(false);
            return;
        }
        if (isDirty && lastSavedUpdatedAtRef.current !== null && liveLink.updatedAt > lastSavedUpdatedAtRef.current) {
            const localTitleChanged = currentInputsRef.current.linkTitle !== lastSavedTitleRef.current;
            const localUrlsChanged = !areLinkItemsEqual(currentInputsRef.current.linkUrls, lastSavedUrlsRef.current);
            const localWsChanged = currentInputsRef.current.organisationId !== lastSavedOrganisationIdRef.current;
            const localTagsChanged = !areStringArraysEqual(currentInputsRef.current.tagIds, lastSavedTagIdsRef.current);
            const remoteTitleChanged = liveLink.title !== lastSavedTitleRef.current;
            const remoteUrlsChanged = !areLinkItemsEqual(liveLink.urls, lastSavedUrlsRef.current);
            const remoteWsChanged = liveLink.organisationId !== lastSavedOrganisationIdRef.current;
            const remoteTagsChanged = !areStringArraysEqual(liveLink.tagIds, lastSavedTagIdsRef.current);
            const hasAnyConflict = (localTitleChanged && remoteTitleChanged) ||
                (localUrlsChanged && remoteUrlsChanged) ||
                (localWsChanged && remoteWsChanged)
                ||
                    (localTagsChanged && remoteTagsChanged);
            if (hasAnyConflict) {
                hasConflictRef.current = true;
                setConflictLink(liveLink);
                if (autosaveTimerRef.current)
                    clearTimeout(autosaveTimerRef.current);
                setSaveStatus('conflict');
                return;
            }
            // Field-level merge
            if (remoteTitleChanged) {
                setLinkTitle(liveLink.title);
                currentInputsRef.current.linkTitle = liveLink.title;
            }
            if (remoteUrlsChanged) {
                setLinkUrls(liveLink.urls);
                currentInputsRef.current.linkUrls = liveLink.urls;
            }
            if (remoteWsChanged) {
                setOrganisationId(liveLink.organisationId);
                currentInputsRef.current.organisationId = liveLink.organisationId;
            }
            if (remoteTagsChanged) {
                setTagIds(liveLink.tagIds);
                currentInputsRef.current.tagIds = liveLink.tagIds;
            }
            lastSavedTitleRef.current = liveLink.title;
            lastSavedUrlsRef.current = liveLink.urls;
            lastSavedOrganisationIdRef.current = liveLink.organisationId;
            lastSavedTagIdsRef.current = liveLink.tagIds;
            lastSavedUpdatedAtRef.current = liveLink.updatedAt;
            setLastSavedAt(new Date(liveLink.updatedAt));
            if (autosaveTimerRef.current)
                clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = setTimeout(() => handleSave(), 400);
            return;
        }
        if (!isInitialized) {
            // First load of an existing link
            const hasLocalEdits = isDirty;
            if (!hasLocalEdits) {
                setLinkTitle(liveLink.title);
                setLinkUrls(liveLink.urls);
                setOrganisationId(liveLink.organisationId);
                setTagIds(liveLink.tagIds);
                currentInputsRef.current = {
                    linkTitle: liveLink.title,
                    linkUrls: liveLink.urls,
                    organisationId: liveLink.organisationId,
                    tagIds: liveLink.tagIds,
                    isInitialized: true,
                    linkShortcut: linkShortcut
                };
            }
            else {
                currentInputsRef.current = {
                    ...currentInputsRef.current,
                    isInitialized: true
                };
            }
            lastSavedTitleRef.current = liveLink.title;
            lastSavedUrlsRef.current = liveLink.urls;
            lastSavedOrganisationIdRef.current = liveLink.organisationId;
            lastSavedTagIdsRef.current = liveLink.tagIds;
            lastSavedUpdatedAtRef.current = liveLink.updatedAt;
            hasConflictRef.current = false;
            setConflictLink(null);
            setLastSavedAt(new Date(liveLink.updatedAt));
            setSaveStatus(hasLocalEdits ? 'saving' : 'saved');
            setIsInitialized(true);
            if ((saveAgainRef.current || hasLocalEdits) && !hasConflictRef.current) {
                saveAgainRef.current = false;
                if (autosaveTimerRef.current)
                    clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = setTimeout(() => handleSave(), 400);
            }
        }
        else if (!isDirty) {
            // Background sync from other tabs
            setLinkTitle(liveLink.title);
            setLinkUrls(liveLink.urls);
            setOrganisationId(liveLink.organisationId);
            setTagIds(liveLink.tagIds);
            lastSavedTitleRef.current = liveLink.title;
            lastSavedUrlsRef.current = liveLink.urls;
            lastSavedOrganisationIdRef.current = liveLink.organisationId;
            lastSavedTagIdsRef.current = liveLink.tagIds;
            lastSavedUpdatedAtRef.current = liveLink.updatedAt;
            setLastSavedAt(new Date(liveLink.updatedAt));
            setSaveStatus('saved');
        }
    }, [liveLink, isDirty, isInitialized, activeLinkId, handleSave]);
    const handlePropertiesChange = useCallback((newProps: Partial<SharedProperties>) => {
        const prevWsId = currentInputsRef.current.organisationId;
        const prevTIds = currentInputsRef.current.tagIds;
        let wId = prevWsId;
        let tIds = prevTIds;
        if (newProps.organisationId !== undefined)
            wId = newProps.organisationId;
        if (newProps.selectedTags)
            tIds = newProps.selectedTags.map((t: any) => t.id);
        const tagsChanged = !areStringArraysEqual(tIds, prevTIds);
        const hasDestinationChange = prevWsId !== wId || tagsChanged;
        let shortcutChanged = false;
        if (newProps.pendingShortcut !== undefined) {
            const normalizedShortcut = normalizeEditorShortcut(newProps.pendingShortcut);
            if (normalizedShortcut !== currentInputsRef.current.linkShortcut) {
                shortcutChanged = true;
                setLinkShortcut(normalizedShortcut);
                currentInputsRef.current.linkShortcut = normalizedShortcut;
            }
        }
        if (!hasDestinationChange && !shortcutChanged) {
            return;
        }
        currentInputsRef.current = {
            ...currentInputsRef.current,
            organisationId: wId,
            tagIds: tIds,
        };
        setOrganisationId(wId);
        setTagIds(tIds);
        // Trigger an immediate silent save if destination or tags change.
        void handleSave(true, newProps);
    }, [handleSave]);
    const resolveConflictWithRemote = useCallback(() => {
        if (!conflictLink)
            return;
        setLinkTitle(conflictLink.title);
        setLinkUrls(conflictLink.urls);
        setOrganisationId(conflictLink.organisationId);
        setTagIds(conflictLink.tagIds);
        currentInputsRef.current = {
            linkTitle: conflictLink.title,
            linkUrls: conflictLink.urls,
            organisationId: conflictLink.organisationId,
            tagIds: conflictLink.tagIds,
            isInitialized: true,
            linkShortcut: linkShortcut
        };
        lastSavedTitleRef.current = conflictLink.title;
        lastSavedUrlsRef.current = conflictLink.urls;
        lastSavedOrganisationIdRef.current = conflictLink.organisationId;
        lastSavedTagIdsRef.current = conflictLink.tagIds;
        lastSavedUpdatedAtRef.current = conflictLink.updatedAt;
        hasConflictRef.current = false;
        setConflictLink(null);
        setLastSavedAt(new Date(conflictLink.updatedAt));
        setSaveStatus('saved');
    }, [conflictLink, setSaveStatus]);
    const keepLocalVersion = useCallback(() => {
        if (!conflictLink)
            return;
        lastSavedUpdatedAtRef.current = conflictLink.updatedAt;
        hasConflictRef.current = false;
        setConflictLink(null);
        setSaveStatus('saving');
        void handleSave(false);
    }, [conflictLink, handleSave, setSaveStatus]);
    const resetEditor = useCallback(() => {
        activeLinkIdRef.current = null;
        setActiveLinkId(null);
        setLinkTitle('');
        setLinkUrls([]);
        lastSavedTitleRef.current = '';
        lastSavedUrlsRef.current = [];
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = [];
        lastSavedUpdatedAtRef.current = null;
        setSaveStatus('idle');
        setSaveError(null);
        setLastSavedAt(null);
        setIsLinkDeleted(false);
        hasLoadedLiveLinkRef.current = true;
        isImportedCloudSnippetRef.current = false;
        hasConflictRef.current = false;
        setConflictLink(null);
        setIsInitialized(true);
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
            autosaveTimerRef.current = null;
        }
        setLinkShortcut('');
        lastSavedShortcutRef.current = '';
        isShortcutManuallyEditedRef.current = false;
        hasLoadedShortcutRef.current = false;
        currentInputsRef.current = {
            linkTitle: '',
            linkUrls: [],
            organisationId,
            tagIds,
            isInitialized: true,
            linkShortcut: '',
        };
    }, [organisationId, tagIds]);
    const flushSave = useCallback(async () => {
        const refreshDirtyRef = () => {
            const current = currentInputsRef.current;
            const hasTitle = current.linkTitle.trim().length > 0;
            const hasUrls = current.linkUrls.length > 0;
            if (!activeLinkIdRef.current && (!hasTitle || !hasUrls)) {
                isDirtyRef.current = false;
                return;
            }
            isDirtyRef.current =
                current.linkTitle !== lastSavedTitleRef.current ||
                    !areLinkItemsEqual(current.linkUrls, lastSavedUrlsRef.current) ||
                    current.organisationId !== lastSavedOrganisationIdRef.current
                    ||
                        !areStringArraysEqual(current.tagIds, lastSavedTagIdsRef.current) ||
                    normalizeEditorShortcut(current.linkShortcut) !== normalizeEditorShortcut(lastSavedShortcutRef.current);
        };
        while (savePromiseRef.current || isDirtyRef.current) {
            if (savePromiseRef.current) {
                await savePromiseRef.current;
                refreshDirtyRef();
            }
            if (isDirtyRef.current) {
                const saved = await handleSave(false);
                refreshDirtyRef();
                if (!saved || hasConflictRef.current)
                    return false;
            }
        }
        return !isDirtyRef.current && !hasConflictRef.current;
    }, [handleSave]);
    currentInputsRef.current = {
        linkTitle,
        linkUrls,
        organisationId,
        tagIds,
        isInitialized,
        linkShortcut,
    };
    return {
        linkTitle: displayTitle,
        linkUrls: displayUrls,
        linkShortcut: displayShortcut,
        setLinkShortcut,
        isShortcutManuallyEditedRef,
        activeLinkId,
        liveLink,
        organisationId: displayOrganisationId,
        tagIds: displayTagIds,
        saveStatus,
        setSaveStatus,
        saveError,
        setSaveError,
        lastSavedAt,
        setLastSavedAt,
        lastSavedTitleRef,
        lastSavedShortcutRef,
        isDirty: isViewingHistory ? false : isDirty,
        isInitialized,
        isShortcutInitialized,
        isDeleteDialogOpen,
        isUnsavedChangesDialogOpen,
        isLinkDeleted,
        conflictLink,
        titleInputRef,
        setLinkTitle,
        setLinkUrls,
        handleSave: async (silent?: boolean, overrideProps?: any) => {
            if (selectedVersionId && selectedVersionId !== 'current')
                return false;
            return handleSave(silent, overrideProps);
        },
        handleDelete,
        handleClose,
        setIsDeleteDialogOpen,
        setIsUnsavedChangesDialogOpen,
        handlePropertiesChange,
        flushSave,
        resolveConflictWithRemote,
        keepLocalVersion,
        resetEditor,
        versionHistoryItems,
        selectedVersionId,
        setSelectedVersionId,
        isViewingHistory,
    };
}
