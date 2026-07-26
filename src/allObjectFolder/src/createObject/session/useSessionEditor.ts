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

import { createSession, updateSession, deleteSession } from './sessionData';
import type { SessionRecord, CreateSessionInput, UpdateSessionInput } from './sessionTypes';
import type { LinkItem } from '../links/linkTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { SessionOpenSettings, DEFAULT_SESSION_SETTINGS } from './sessionSettings';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';

export interface UseSessionEditorParams {
  sessionId?: string;
  initialDraftKey?: string;
  initialDraftUrls?: LinkItem[];
  sessionOpenSettings?: SessionOpenSettings;
}

const areLinkItemsEqual = (a: LinkItem[], b: LinkItem[]) => {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  // The live session tracker can regenerate ids, source metadata, favicons, and
  // titles while tabs settle. The saved session should become dirty only when
  // the actual tab URL list changes.
  return a.every((item, i) => item && b[i] && item.url === b[i].url);
};

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(item => setB.has(item));
};

export function useSessionEditor(props: UseSessionEditorParams) {
  const { sessionId, initialDraftKey, initialDraftUrls } = props;

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const lastSavedTitleRef = useRef<string>(initialDraftKey || '');
  const lastSavedUrlsRef = useRef<LinkItem[]>(initialDraftUrls || []);
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);
  const lastSavedSettingsRef = useRef<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
  const lastSavedUpdatedAtRef = useRef<number | null>(null);

  const activeSessionIdRef = useRef<string | null>(sessionId ?? null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);

  const [sessionTitle, setSessionTitle] = useState<string>(initialDraftKey || '');
  const [sessionUrls, setSessionUrls] = useState<LinkItem[]>(initialDraftUrls || []);
  const { validateShortcut } = useShortcutValidation();
  const [sessionShortcut, setSessionShortcut] = useState<string>('');
  const isShortcutManuallyEditedRef = useRef(false);

  const updateSessionShortcut = useCallback((val: string) => {
    isShortcutManuallyEditedRef.current = true;
    setSessionShortcut(val);
  }, []);
  const lastSavedShortcutRef = useRef<string>('');
  const isSessionShortcutManuallyEditedRef = useRef<boolean>(false);
  const lastLoadedCompoundIdRef = useRef<string | null>(null);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [openSettings, setOpenSettings] = useState<SessionOpenSettings>(DEFAULT_SESSION_SETTINGS);
  const [isInitialized, setIsInitialized] = useState<boolean>(!sessionId);
  const [isShortcutInitialized, setIsShortcutInitialized] = useState<boolean>(!sessionId);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSessionDeleted, setIsSessionDeleted] = useState(false);

  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<string | false> | null>(null);
  const queuedSaveOverrideRef = useRef<any | null>(null);
  const queuedSaveIsAutoSaveRef = useRef<boolean | null>(null);

  const currentInputsRef = useRef({ sessionTitle, sessionUrls, workspaceId, folderId, tagIds, openSettings, isInitialized, sessionShortcut });
  currentInputsRef.current = { sessionTitle, sessionUrls, workspaceId, folderId, tagIds, openSettings, isInitialized, sessionShortcut };

  // Load or initialize
  useEffect(() => {

    if (sessionId) {
      if (sessionId === activeSessionIdRef.current && isInitialized) {
        return;
      }
      activeSessionIdRef.current = sessionId;
      setActiveSessionId(sessionId);
      setIsSessionDeleted(false);
      lastLoadedCompoundIdRef.current = null;
      setSessionShortcut('');
      lastSavedShortcutRef.current = '';

      lastSavedTitleRef.current = '';
      lastSavedUrlsRef.current = [];
      lastSavedWorkspaceIdRef.current = null;
      lastSavedFolderIdRef.current = null;
      lastSavedTagIdsRef.current = [];
      lastSavedSettingsRef.current = DEFAULT_SESSION_SETTINGS;
      lastSavedUpdatedAtRef.current = null;
      
      setIsShortcutInitialized(false);
      setSessionTitle('');
      setSessionUrls([]);
      setIsInitialized(false);
      return;
    }

    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    setSessionTitle(initialDraftKey || '');
    setSessionUrls(initialDraftUrls || []);
    setOpenSettings(DEFAULT_SESSION_SETTINGS);
    setSessionShortcut('');
    lastSavedShortcutRef.current = '';
    isSessionShortcutManuallyEditedRef.current = false;
    lastLoadedCompoundIdRef.current = null;

    const initDefaults = async () => {
      const smartWs = await getSmartDefaultWorkspace();
      if (smartWs) {
        setWorkspaceId(smartWs.id);
        lastSavedWorkspaceIdRef.current = smartWs.id;
        const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
        setFolderId(savedFolderId || null);
        lastSavedFolderIdRef.current = savedFolderId || null;
      } else {
        setWorkspaceId(null);
        lastSavedWorkspaceIdRef.current = null;
        setFolderId(null);
        lastSavedFolderIdRef.current = null;
      }
    };
    void initDefaults();

    setTagIds([]);
    lastSavedTitleRef.current = initialDraftKey || '';
    lastSavedUrlsRef.current = initialDraftUrls || [];
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedSettingsRef.current = DEFAULT_SESSION_SETTINGS;
    lastSavedUpdatedAtRef.current = null;
    setSaveStatus('idle');
    setIsSessionDeleted(false);
    setIsInitialized(true);
    setIsShortcutInitialized(true);
  }, [sessionId]);

  // Sync state reactively with Zustand store using the active sessionId/prop
  const liveSession = useDbStore(state => state.sessions.find(s => s.id === (sessionId || activeSessionId)));

  const titleChanged = isInitialized && sessionTitle.trim() !== (lastSavedTitleRef.current || '').trim();
  const workspaceChanged = isInitialized && workspaceId !== lastSavedWorkspaceIdRef.current;
  const folderChanged = isInitialized && folderId !== lastSavedFolderIdRef.current;
  const urlsChanged = isInitialized && !areLinkItemsEqual(sessionUrls, lastSavedUrlsRef.current);
  const tagsChanged = isInitialized && !areStringArraysEqual(tagIds, lastSavedTagIdsRef.current);
  const settingsChanged = isInitialized && JSON.stringify(openSettings) !== JSON.stringify(lastSavedSettingsRef.current);
  const shortcutChanged = isInitialized && isShortcutInitialized && sessionShortcut.toLowerCase().replace(/[^a-z0-9]/g, '') !== (lastSavedShortcutRef.current || '');

  const isDirty = isInitialized && isShortcutInitialized && (titleChanged || workspaceChanged || folderChanged || urlsChanged || tagsChanged || settingsChanged || shortcutChanged);

  const isEditMode = !!sessionId || !!activeSessionId;

  // Synchronize shortcut from DB on load or activeSessionId changes

  useEffect(() => {
    const currentId = sessionId || activeSessionId;
    if (!currentId) {
      setIsShortcutInitialized(true);
      return;
    }

    const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
    const fldObj = folderId ? { folder_id: folderId } : null;
    const targetCompoundId = getItemCompoundId({
      id: currentId,
      workspace_id: wsObj?.workspace_id || null,
      folder_id: fldObj?.folder_id || null,
      snippet: { id: currentId, category: 'session' }
    });

    if (lastLoadedCompoundIdRef.current === targetCompoundId) {
      return;
    }

    setIsShortcutInitialized(false);

    const loadSavedShortcut = async () => {
      try {
        const shortcutsMap = await readAllShortcuts();
        const sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] || '');
        if (isMounted.current) {
          if (!isShortcutManuallyEditedRef.current) {
            setSessionShortcut(sc);
          }
          lastSavedShortcutRef.current = sc;
          lastLoadedCompoundIdRef.current = targetCompoundId;
          setIsShortcutInitialized(true);
        }
      } catch (err) {
        console.error('Failed to load session shortcut:', err);
        if (isMounted.current) {
          setIsShortcutInitialized(true);
        }
      }
    };
    void loadSavedShortcut();
  }, [sessionId, activeSessionId, workspaceId, folderId]);

  useEffect(() => {
    if (liveSession === undefined || isSessionDeleted) return;

    if (liveSession === null) {
      if (!isInitialized) setIsInitialized(true);
      return;
    }



    if (lastSavedUpdatedAtRef.current !== null && liveSession.updatedAt <= lastSavedUpdatedAtRef.current) {
      setIsSessionDeleted(false);
      return;
    }

    // DO NOT OVERWRITE if user is typing
    if (isDirty) {

      return;
    }

    const sanitizedUrls = (liveSession.urls || []).map(link => {
      if (link && link.originalData) {
        const { originalData, ...rest } = link;
        return rest;
      }
      return link;
    });


    setSessionTitle(liveSession.title);
    setSessionUrls(sanitizedUrls);
    setWorkspaceId(liveSession.workspaceId);
    setFolderId(liveSession.folderId);
    setTagIds(liveSession.tagIds || []);
    setOpenSettings(liveSession.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

    lastSavedTitleRef.current = liveSession.title;
    lastSavedUrlsRef.current = sanitizedUrls;
    lastSavedWorkspaceIdRef.current = liveSession.workspaceId;
    lastSavedFolderIdRef.current = liveSession.folderId;
    lastSavedTagIdsRef.current = liveSession.tagIds || [];
    lastSavedSettingsRef.current = liveSession.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
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
          action: 'update_session_settings',
          sessionId: currentId,
          openSettings
        }).catch(() => {});
      }
    }
  }, [sessionId, activeSessionId, openSettings]);

  const handleSave = useCallback(async function saveFn(
    isAutoSave: boolean = false,
    overrideProps?: {
      workspaceId?: string | null;
      folderId?: string | null;
      tagIds?: string[];
      openSettings?: SessionOpenSettings;
      title?: string;
      urls?: any[];
    }
  ): Promise<string | false> {
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

    const { sessionTitle: title, sessionUrls: urls, workspaceId: wsId, folderId: fldId, tagIds: tIds, openSettings: settings, sessionShortcut } = currentInputsRef.current;
    const finalWorkspaceId = overrideProps?.workspaceId !== undefined ? overrideProps.workspaceId : wsId;
    const finalFolderId = overrideProps?.folderId !== undefined ? overrideProps.folderId : fldId;
    const finalTagIds = overrideProps?.tagIds !== undefined ? overrideProps.tagIds : tIds;
    const finalSettings = overrideProps?.openSettings !== undefined ? overrideProps.openSettings : settings;
    const finalTitle = overrideProps?.title !== undefined ? overrideProps.title : title;
    const rawUrls = overrideProps?.urls !== undefined ? overrideProps.urls : urls;
    const loopShortcut = sessionShortcut;
    const finalUrls = (rawUrls || []).map((link: any) => {
      if (link && link.originalData) {
        const { originalData, ...rest } = link;
        return rest;
      }
      return link;
    });

    if (!finalTitle.trim()) {
      if (isMounted.current) {
        setSaveError('Enter the title');
      }
      return false;
    }

    if (!finalUrls || finalUrls.length === 0) {
      if (isMounted.current) {
        setSaveError('Add at least one link to this session');
      }
      return false;
    }

    setSaveStatus('saving');
    setSaveError(null);

    const execute = async (): Promise<string | false> => {
      try {
        let savedRecord: SessionRecord;
        if (!activeSessionIdRef.current) {
          // Create new
          const input: CreateSessionInput = {
            title: finalTitle,
            urls: finalUrls,
            workspaceId: finalWorkspaceId || undefined,
            folderId: finalFolderId,
            tagIds: finalTagIds,
            sessionOpenSettings: finalSettings,
          };

          const created = await createSession(input);
          savedRecord = created;
          if (isMounted.current) {
            activeSessionIdRef.current = created.id;
            setWorkspaceId(created.workspaceId);
            setFolderId(created.folderId);
            setTagIds(created.tagIds);
            setOpenSettings(created.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

            lastSavedTitleRef.current = created.title;
            lastSavedUrlsRef.current = created.urls;
            lastSavedWorkspaceIdRef.current = created.workspaceId;
            lastSavedFolderIdRef.current = created.folderId;
            lastSavedTagIdsRef.current = created.tagIds;
            lastSavedSettingsRef.current = created.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
            lastSavedUpdatedAtRef.current = created.updatedAt;
            setSaveStatus('saved');
            setLastSavedAt(new Date(created.updatedAt));
          }
        } else {
          // Update existing
          const input: UpdateSessionInput = {
            title: finalTitle,
            urls: finalUrls,
            workspaceId: finalWorkspaceId || undefined,
            folderId: finalFolderId,
            tagIds: finalTagIds,
            sessionOpenSettings: finalSettings,
            expectedUpdatedAt: lastSavedUpdatedAtRef.current || undefined,
          };

          const updated = await updateSession(activeSessionIdRef.current, input);
          savedRecord = updated;
          if (isMounted.current) {
            setWorkspaceId(updated.workspaceId);
            setFolderId(updated.folderId);
            setTagIds(updated.tagIds);
            setOpenSettings(updated.sessionOpenSettings || DEFAULT_SESSION_SETTINGS);

            lastSavedTitleRef.current = updated.title;
            lastSavedUrlsRef.current = updated.urls;
            lastSavedWorkspaceIdRef.current = updated.workspaceId;
            lastSavedFolderIdRef.current = updated.folderId;
            lastSavedTagIdsRef.current = updated.tagIds;
            lastSavedSettingsRef.current = updated.sessionOpenSettings || DEFAULT_SESSION_SETTINGS;
            lastSavedUpdatedAtRef.current = updated.updatedAt;
            setSaveStatus('saved');
            setLastSavedAt(new Date(updated.updatedAt));
          }
        }

        // Save shortcut trigger!
        const targetId = activeSessionIdRef.current;
        if (targetId && savedRecord) {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'update_active_session_urls',
              sessionId: targetId,
              urls: savedRecord.urls.map(link => link.url),
              names: savedRecord.urls.map(link => link.title || link.name || link.url),
            }).catch(() => {});
          }

          const wsObj = savedRecord.workspaceId ? { workspace_id: savedRecord.workspaceId } : null;
          const fldObj = savedRecord.folderId ? { folder_id: savedRecord.folderId } : null;
          const targetCompoundId = getItemCompoundId({
            id: targetId,
            workspace_id: wsObj?.workspace_id || null,
            folder_id: fldObj?.folder_id || null,
            snippet: { id: targetId, category: 'session' }
          });
          
          const finalShortcut = loopShortcut.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (finalShortcut) {
            const valRes = await validateShortcut(finalShortcut, targetId);
            if (valRes.isValid) {
              console.log(`[ShortcutDebug][SessionEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for session "${targetId}"...`);
              await saveShortcut(targetId, targetCompoundId, finalShortcut, savedRecord.title, 'session');
            } else {
              console.warn(`[ShortcutDebug][SessionEditor] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
            }
            // Always update the ref to prevent infinite autosave loops
            lastSavedShortcutRef.current = finalShortcut;
          } else {
            console.log(`[ShortcutDebug][SessionEditor] handleSave: Clearing shortcut for session "${targetId}"...`);
            await clearShortcut(targetId, targetCompoundId, 'session');
            lastSavedShortcutRef.current = '';
          }
        }

        if (isMounted.current && activeSessionIdRef.current !== activeSessionId) {
          setActiveSessionId(activeSessionIdRef.current);
        }

        return activeSessionIdRef.current || false;
      } catch (err: any) {
        console.error('[SessionFlow][useSessionEditor] ✘ save FAILED:', err);
        if (isMounted.current) {
          setSaveStatus('error');
          setSaveError(err.message || 'Unknown save error');
        }
        return false;
      } finally {
        savePromiseRef.current = null;
        if (saveAgainRef.current && isMounted.current) {
          saveAgainRef.current = false;
          const queuedOverride = queuedSaveOverrideRef.current;
          const queuedIsAutoSave = queuedSaveIsAutoSaveRef.current ?? isAutoSave;
          queuedSaveOverrideRef.current = null;
          queuedSaveIsAutoSaveRef.current = null;
          void saveFn(queuedIsAutoSave, queuedOverride || undefined);
        }
      }
    };

    savePromiseRef.current = execute() as Promise<string | false>;
    return savePromiseRef.current;
  }, []);

  const handleDelete = useCallback(async () => {
    if (!activeSessionIdRef.current) return;
    try {
      await deleteSession(activeSessionIdRef.current);
      setIsSessionDeleted(true);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, []);

  const resetEditor = useCallback(() => {
    activeSessionIdRef.current = null;
    setActiveSessionId(null);
    setSessionTitle('');
    setSessionUrls([]);
    setTagIds([]);
    // Keep workspaceId/folderId so new session defaults to the same location
    setOpenSettings(DEFAULT_SESSION_SETTINGS);
    setSessionShortcut('');
    lastSavedShortcutRef.current = '';
    isSessionShortcutManuallyEditedRef.current = false;
    lastLoadedCompoundIdRef.current = null;
    lastSavedTitleRef.current = '';
    lastSavedUrlsRef.current = [];
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedSettingsRef.current = DEFAULT_SESSION_SETTINGS;
    lastSavedUpdatedAtRef.current = null;
    setSaveStatus('idle');
    setLastSavedAt(null);
    setIsSessionDeleted(false);
    setIsInitialized(true);
  }, []);

  return {
    sessionTitle,
    setSessionTitle,
    sessionUrls,
    setSessionUrls,
    sessionShortcut,
    setSessionShortcut,
    isShortcutManuallyEditedRef,
    isSessionShortcutManuallyEditedRef,
    workspaceId,
    setWorkspaceId,
    folderId,
    setFolderId,
    tagIds,
    setTagIds,
    openSettings,
    setOpenSettings,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    lastSavedAt,
    setLastSavedAt,
    isDirty,
    handleSave,
    handleDelete,
    isInitialized: isInitialized && (sessionId === activeSessionId),
    isShortcutInitialized,
    activeSessionId: sessionId || activeSessionId,
    resetEditor,
    lastSavedShortcutRef,
    lastSavedTitleRef,
  };
}
