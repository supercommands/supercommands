/**
 * @file useSessionEditor.ts
 * @description A custom React hook containing state management and logic for the Session editor,
 * including tab-list comparison, autosaving, workspace/tag syncing, and concurrency conflict checks.
 *
 * @usage
 * ```tsx
 * import { useSessionEditor } from './useSessionEditor';
 * const state = useSessionEditor({ sessionId });
 * ```
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ConflictError, createSession, updateSession, deleteSession } from './sessionData';
import { getSessionTabTitle } from './sessionHelpers';
import type { SessionRecord, CreateSessionInput, UpdateSessionInput } from './sessionTypes';
import type { LinkItem } from '../links/linkTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { SessionOpenSettings, DEFAULT_SESSION_SETTINGS, normalizeSessionOpenSettings } from './sessionSettings';
import { getVersionsNewestFirst, getSnapshotById } from '../../../../shared-components/versionHistory/structuredVersionHistory';
const SESSION_WIDGET_DEBUG = false;
const sessionWidgetDebug = (label: string, data: Record<string, unknown>) => {
    if (!SESSION_WIDGET_DEBUG)
        return;
    console.log(label, data);
};
const sanitizeSessionLinkMetadata = (link: LinkItem): LinkItem => {
    if (!link?.originalData)
        return link;
    const snapshot = link.originalData.sessionAgentSnapshot;
    const rest = { ...link };
    delete rest.originalData;
    return snapshot
        ? {
            ...rest,
            originalData: { sessionAgentSnapshot: snapshot },
        }
        : rest;
};
export interface UseSessionEditorParams {
    sessionId?: string;
    initialDraftKey?: string;
    initialDraftUrls?: LinkItem[];
    sessionOpenSettings?: SessionOpenSettings;
}
const areLinkItemsEqual = (a: LinkItem[], b: LinkItem[]) => {
    if (!a || !b)
        return a === b;
    if (a.length !== b.length)
        return false;
    // The live session tracker can regenerate ids, source metadata, favicons, and
    // titles while tabs settle. The saved session should become dirty only when
    // the actual tab URL list changes.
    return a.every((item, i) => item && b[i] && item.url === b[i].url);
};
const areStringArraysEqual = (a: string[], b: string[]) => {
    if (!a || !b)
        return a === b;
    if (a.length !== b.length)
        return false;
    const setB = new Set(b);
    return a.every(item => setB.has(item));
};
const getCurrentChromeWindowId = async (): Promise<number | undefined> => {
    const chromeAny = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
    if (!chromeAny?.windows?.getCurrent)
        return undefined;
    return new Promise(resolve => {
        chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
            if (chromeAny.runtime?.lastError || typeof currentWindow?.id !== 'number') {
                resolve(undefined);
                return;
            }
            resolve(currentWindow.id);
        });
    });
};
export function useSessionEditor(props: UseSessionEditorParams) {
    const { sessionId, initialDraftKey, initialDraftUrls } = props;
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
    const lastSavedDescriptionRef = useRef<string>('');
    const lastSavedUrlsRef = useRef<LinkItem[]>(initialDraftUrls || []);
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
    const lastSavedTagIdsRef = useRef<string[]>([]);
    const lastSavedSettingsRef = useRef<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
    const lastSavedUpdatedAtRef = useRef<number | null>(null);
    const isDirtyRef = useRef(false);
    const activeSessionIdRef = useRef<string | null>(sessionId ?? null);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
    const [sessionTitle, setSessionTitle] = useState<string>(initialDraftKey || '');
    const [sessionDescription, setSessionDescription] = useState<string>('');
    const [sessionUrls, setSessionUrls] = useState<LinkItem[]>(initialDraftUrls || []);
    const [sessionShortcut, setSessionShortcut] = useState<string>('');
    const isShortcutManuallyEditedRef = useRef(false);
    const updateSessionShortcut = useCallback((val: string) => {
        isShortcutManuallyEditedRef.current = true;
        setSessionShortcut(val);
    }, []);
    const isSessionShortcutManuallyEditedRef = useRef<boolean>(false);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [openSettings, setOpenSettings] = useState<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
    const [isInitialized, setIsInitialized] = useState<boolean>(!sessionId);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isSessionDeleted, setIsSessionDeleted] = useState(false);
    const saveAgainRef = useRef(false);
    const savePromiseRef = useRef<Promise<string | false> | null>(null);
    const queuedSaveOverrideRef = useRef<any | null>(null);
    const queuedSaveIsAutoSaveRef = useRef<boolean | null>(null);
    const currentInputsRef = useRef({ sessionTitle, sessionDescription, sessionUrls, organisationId, tagIds, openSettings, isInitialized });
    currentInputsRef.current = { sessionTitle, sessionDescription, sessionUrls, organisationId, tagIds, openSettings, isInitialized };
    // Sync state reactively with Zustand store using the active sessionId/prop
    const liveSession = useDbStore(state => state.sessions.find(s => s.id === (sessionId || activeSessionId)));
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const versionHistory = liveSession?.versionHistory;
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
    const displayTitle = historicalSnapshot ? historicalSnapshot.title : sessionTitle;
    const displayDescription = historicalSnapshot ? (historicalSnapshot.description || '') : sessionDescription;
    const displayUrls = historicalSnapshot ? historicalSnapshot.urls : sessionUrls;
    const displayOrganisationId = historicalSnapshot ? historicalSnapshot.organisationId : organisationId;
    const displayTagIds = historicalSnapshot ? historicalSnapshot.tagIds : tagIds;
    const displaySettings = historicalSnapshot ? normalizeSessionOpenSettings(historicalSnapshot.sessionOpenSettings || openSettings) : normalizeSessionOpenSettings(openSettings);
    const displayShortcut = '';
    useEffect(() => {
        setSelectedVersionId(null);
    }, [sessionId, activeSessionId]);
    const titleChanged = isInitialized && sessionTitle.trim() !== (lastSavedTitleRef.current || '').trim();
    const descriptionChanged = isInitialized && sessionDescription.trim() !== (lastSavedDescriptionRef.current || '').trim();
    const organisationChanged = isInitialized && organisationId !== lastSavedOrganisationIdRef.current;
    const urlsChanged = isInitialized && !areLinkItemsEqual(sessionUrls, lastSavedUrlsRef.current);
    const tagsChanged = isInitialized && !areStringArraysEqual(tagIds, lastSavedTagIdsRef.current);
    const settingsChanged = isInitialized && JSON.stringify(openSettings) !== JSON.stringify(lastSavedSettingsRef.current);
    const isDirty = !isViewingHistory && isInitialized && (titleChanged || descriptionChanged || organisationChanged || urlsChanged || tagsChanged || settingsChanged);
    isDirtyRef.current = isDirty;
    const isEditMode = !!sessionId || !!activeSessionId;
    useEffect(() => {
        if (liveSession === undefined || isSessionDeleted || !activeSessionId)
            return;
        if (liveSession === null) {
            if (!isInitialized)
                setIsInitialized(true);
            return;
        }
        if (lastSavedUpdatedAtRef.current !== null && liveSession.updatedAt <= lastSavedUpdatedAtRef.current) {
            sessionWidgetDebug('[SessionWidgetDebug][useSessionEditor-liveSession-skip-stale]', {
                sessionId,
                activeSessionId,
                liveSessionId: liveSession.id,
                liveSessionUpdatedAt: liveSession.updatedAt,
                lastSavedUpdatedAt: lastSavedUpdatedAtRef.current,
            });
            setIsSessionDeleted(false);
            return;
        }
        // DO NOT OVERWRITE if user is typing
        if (isDirty) {
            sessionWidgetDebug('[SessionWidgetDebug][useSessionEditor-liveSession-skip-dirty]', {
                sessionId,
                activeSessionId,
                liveSessionId: liveSession.id,
                liveUrlCount: Array.isArray(liveSession.urls) ? liveSession.urls.length : 0,
            });
            return;
        }
        const sanitizedUrls = (liveSession.urls || []).map(sanitizeSessionLinkMetadata);
        sessionWidgetDebug('[SessionWidgetDebug][useSessionEditor-liveSession-hydrate]', {
            sessionId,
            activeSessionId,
            liveSessionId: liveSession.id,
            title: liveSession.title,
            urlCount: sanitizedUrls.length,
            autoSaveMode: liveSession.sessionOpenSettings?.autoSaveMode,
        });
        setSessionTitle(liveSession.title);
        setSessionDescription(liveSession.description || '');
        setSessionUrls(sanitizedUrls);
        setOrganisationId(liveSession.organisationId);
        setTagIds(liveSession.tagIds || []);
        const normalizedLiveSettings = normalizeSessionOpenSettings(liveSession.sessionOpenSettings);
        setOpenSettings(normalizedLiveSettings);
        lastSavedTitleRef.current = liveSession.title;
        lastSavedDescriptionRef.current = liveSession.description || '';
        lastSavedUrlsRef.current = sanitizedUrls;
        lastSavedOrganisationIdRef.current = liveSession.organisationId;
        lastSavedTagIdsRef.current = liveSession.tagIds || [];
        lastSavedSettingsRef.current = normalizedLiveSettings;
        lastSavedUpdatedAtRef.current = liveSession.updatedAt;
        setIsInitialized(true);
        setSaveStatus('saved');
        setSaveError(null);
        setLastSavedAt(new Date(liveSession.updatedAt));
        setIsSessionDeleted(false);
    }, [liveSession, isInitialized, isSessionDeleted, isDirty]);
    useEffect(() => {
        const currentId = sessionId || activeSessionId;
        if (currentId && openSettings) {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    action: 'update_workspace_settings',
                    workspaceId: currentId,
                    openSettings
                }).catch(() => { });
            }
        }
    }, [sessionId, activeSessionId, openSettings]);
    const handleSave = useCallback(async function saveFn(isAutoSave: boolean = false, overrideProps?: {
        organisationId?: string | null;
        tagIds?: string[];
        openSettings?: SessionOpenSettings;
        title?: string;
        urls?: any[];
        shortcut?: string;
    }): Promise<string | false> {
        if (savePromiseRef.current) {
            saveAgainRef.current = true;
            if (overrideProps) {
                queuedSaveOverrideRef.current = {
                    ...(queuedSaveOverrideRef.current || {}),
                    ...overrideProps,
                };
            }
            queuedSaveIsAutoSaveRef.current =
                queuedSaveIsAutoSaveRef.current === null
                    ? isAutoSave
                    : queuedSaveIsAutoSaveRef.current && isAutoSave;
            return savePromiseRef.current as Promise<any>;
        }
        const { sessionTitle: title, sessionDescription: desc, sessionUrls: urls, organisationId: wsId, tagIds: tIds, openSettings: settings } = currentInputsRef.current;
        const finalOrganisationId = overrideProps?.organisationId !== undefined ? overrideProps.organisationId : wsId;
        const finalTagIds = overrideProps?.tagIds !== undefined ? overrideProps.tagIds : tIds;
        const finalSettings = normalizeSessionOpenSettings(overrideProps?.openSettings !== undefined ? overrideProps.openSettings : settings);
        const finalTitle = overrideProps?.title !== undefined ? overrideProps.title : title;
        const normalizedTitle = finalTitle.trim() || 'Untitled Workspace';
        const finalDescription = desc;
        const rawUrls = overrideProps?.urls !== undefined ? overrideProps.urls : urls;
        const finalUrls = (rawUrls || []).map((link: LinkItem) => {
            const canonicalTitle = getSessionTabTitle(link);
            const sanitizedLink = sanitizeSessionLinkMetadata(link);
            return {
                ...sanitizedLink,
                title: canonicalTitle,
            };
        });
        setSaveStatus('saving');
        setSaveError(null);
        const execute = async (): Promise<string | false> => {
            try {
                let savedRecord: SessionRecord;
                const previousSessionId = activeSessionIdRef.current;
                if (!previousSessionId) {
                    // Create new
                    const input: CreateSessionInput = {
                        title: normalizedTitle,
                        description: finalDescription,
                        urls: finalUrls,
                        organisationId: finalOrganisationId,
                        tagIds: finalTagIds,
                        sessionOpenSettings: finalSettings,
                    };
                    const created = await createSession(input);
                    savedRecord = created;
                    if (isMounted.current) {
                        activeSessionIdRef.current = created.id;
                        setOrganisationId(created.organisationId);
                        setTagIds(created.tagIds);
                        const normalizedCreatedSettings = normalizeSessionOpenSettings(created.sessionOpenSettings);
                        setOpenSettings(normalizedCreatedSettings);
                        lastSavedTitleRef.current = created.title;
                        lastSavedDescriptionRef.current = created.description || '';
                        lastSavedUrlsRef.current = created.urls;
                        lastSavedOrganisationIdRef.current = created.organisationId;
                        lastSavedTagIdsRef.current = created.tagIds;
                        lastSavedSettingsRef.current = normalizedCreatedSettings;
                        lastSavedUpdatedAtRef.current = created.updatedAt;
                        setSaveStatus('saved');
                        setLastSavedAt(new Date(created.updatedAt));
                    }
                }
                else {
                    // Update existing
                    const input: UpdateSessionInput = {
                        title: normalizedTitle,
                        description: finalDescription,
                        urls: finalUrls,
                        organisationId: finalOrganisationId,
                        tagIds: finalTagIds,
                        sessionOpenSettings: finalSettings,
                        expectedUpdatedAt: lastSavedUpdatedAtRef.current,
                    };
                    let updated: SessionRecord;
                    try {
                        updated = await updateSession(activeSessionIdRef.current!, input);
                    }
                    catch (error) {
                        if (isAutoSave && error instanceof ConflictError && error.remoteSession) {
                            lastSavedUpdatedAtRef.current = error.remoteSession.updatedAt;
                            updated = await updateSession(activeSessionIdRef.current!, {
                                ...input,
                                expectedUpdatedAt: error.remoteSession.updatedAt,
                            });
                        }
                        else {
                            throw error;
                        }
                    }
                    savedRecord = updated;
                    if (isMounted.current) {
                        setOrganisationId(updated.organisationId);
                        setTagIds(updated.tagIds);
                        const normalizedUpdatedSettings = normalizeSessionOpenSettings(updated.sessionOpenSettings);
                        setOpenSettings(normalizedUpdatedSettings);
                        lastSavedTitleRef.current = updated.title;
                        lastSavedDescriptionRef.current = updated.description || '';
                        lastSavedUrlsRef.current = updated.urls;
                        lastSavedOrganisationIdRef.current = updated.organisationId;
                        lastSavedTagIdsRef.current = updated.tagIds;
                        lastSavedSettingsRef.current = normalizedUpdatedSettings;
                        lastSavedUpdatedAtRef.current = updated.updatedAt;
                        setSaveStatus('saved');
                        setLastSavedAt(new Date(updated.updatedAt));
                    }
                }
                const targetId = activeSessionIdRef.current;
                if (targetId && savedRecord) {
                    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                        const currentWindowId = await getCurrentChromeWindowId();
                        chrome.runtime.sendMessage({
                            action: 'update_active_workspace_urls',
                            workspaceId: targetId,
                            windowId: currentWindowId,
                            urls: savedRecord.urls.map(link => link.url),
                            names: savedRecord.urls.map(link => link.title || link.name || link.url),
                        }).catch(() => { });
                        chrome.runtime.sendMessage({
                            action: 'update_active_workspace_settings',
                            workspaceId: targetId,
                            openSettings: normalizeSessionOpenSettings(savedRecord.sessionOpenSettings),
                        }).catch(() => { });
                    }
                }
                if (isMounted.current && activeSessionIdRef.current !== activeSessionId) {
                    setActiveSessionId(activeSessionIdRef.current);
                }
                return activeSessionIdRef.current;
            }
            catch (err: any) {
                console.error('[SessionFlow][useSessionEditor] ✘ save FAILED:', err);
                if (isMounted.current) {
                    setSaveStatus('error');
                    setSaveError(err.message || 'Unknown save error');
                }
                return false;
            }
            finally {
                savePromiseRef.current = null;
                if (saveAgainRef.current && isMounted.current && activeSessionIdRef.current !== null) {
                    saveAgainRef.current = false;
                    const queuedOverride = queuedSaveOverrideRef.current;
                    const queuedIsAutoSave = queuedSaveIsAutoSaveRef.current ?? isAutoSave;
                    queuedSaveOverrideRef.current = null;
                    queuedSaveIsAutoSaveRef.current = null;
                    void saveFn(queuedIsAutoSave, queuedOverride);
                }
                else {
                    saveAgainRef.current = false;
                    queuedSaveOverrideRef.current = null;
                    queuedSaveIsAutoSaveRef.current = null;
                }
            }
        };
        savePromiseRef.current = execute() as Promise<string | false>;
        return savePromiseRef.current;
    }, []);
    const handleDelete = useCallback(async () => {
        if (!activeSessionIdRef.current)
            return;
        try {
            await deleteSession(activeSessionIdRef.current);
            setIsSessionDeleted(true);
        }
        catch (err) {
            console.error('Failed to delete session:', err);
        }
    }, []);
    const resetEditor = useCallback(() => {
        saveAgainRef.current = false;
        savePromiseRef.current = null;
        queuedSaveOverrideRef.current = null;
        queuedSaveIsAutoSaveRef.current = null;
        activeSessionIdRef.current = null;
        currentInputsRef.current = {
            sessionTitle: '',
            sessionDescription: '',
            sessionUrls: [],
            organisationId: currentInputsRef.current.organisationId,
            tagIds: [],
            openSettings: DEFAULT_SESSION_SETTINGS,
            isInitialized: true,
        };
        setActiveSessionId(null);
        setSessionTitle('');
        setSessionDescription('');
        setSessionUrls([]);
        setTagIds([]);
        setOpenSettings(DEFAULT_SESSION_SETTINGS);
        setSessionShortcut('');
        isSessionShortcutManuallyEditedRef.current = false;
        lastSavedTitleRef.current = '';
        lastSavedDescriptionRef.current = '';
        lastSavedUrlsRef.current = [];
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = [];
        lastSavedSettingsRef.current = DEFAULT_SESSION_SETTINGS;
        lastSavedUpdatedAtRef.current = null;
        setSaveStatus('idle');
        setLastSavedAt(null);
        setIsSessionDeleted(false);
        setIsInitialized(true);
    }, []);
    const flushSave = useCallback(async () => {
        const refreshDirtyRef = () => {
            const current = currentInputsRef.current;
            isDirtyRef.current =
                current.isInitialized &&
                    (current.sessionTitle.trim() !== (lastSavedTitleRef.current || '').trim() ||
                        current.sessionDescription.trim() !== (lastSavedDescriptionRef.current || '').trim() ||
                        current.organisationId !== lastSavedOrganisationIdRef.current
                        ||
                            !areLinkItemsEqual(current.sessionUrls, lastSavedUrlsRef.current) ||
                        !areStringArraysEqual(current.tagIds, lastSavedTagIdsRef.current) ||
                        JSON.stringify(current.openSettings) !== JSON.stringify(lastSavedSettingsRef.current));
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
        sessionTitle: displayTitle,
        setSessionTitle,
        sessionDescription: displayDescription,
        setSessionDescription,
        sessionUrls: displayUrls,
        setSessionUrls,
        sessionShortcut: displayShortcut,
        setSessionShortcut,
        isShortcutManuallyEditedRef,
        isSessionShortcutManuallyEditedRef,
        organisationId: displayOrganisationId,
        setOrganisationId,
        tagIds: displayTagIds,
        setTagIds,
        openSettings: displaySettings,
        setOpenSettings,
        saveStatus,
        setSaveStatus,
        saveError,
        setSaveError,
        lastSavedAt,
        setLastSavedAt,
        isDirty: isViewingHistory ? false : isDirty,
        handleSave: async (isAutoSave?: boolean, overrideProps?: any) => {
            if (selectedVersionId && selectedVersionId !== 'current')
                return false;
            return handleSave(isAutoSave, overrideProps);
        },
        handleDelete,
        isInitialized: isInitialized && (sessionId === activeSessionId),
        activeSessionId: sessionId || activeSessionId,
        resetEditor,
        flushSave,
        lastSavedTitleRef,
        versionHistory,
        versionHistoryItems,
        selectedVersionId,
        setSelectedVersionId,
        isViewingHistory,
    };
}
