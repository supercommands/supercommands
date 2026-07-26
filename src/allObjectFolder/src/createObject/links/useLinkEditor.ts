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
import type { LinkRecord, CreateLinkInput, UpdateLinkInput, LinkItem } from './linkTypes';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { saveShortcut, clearShortcut } from '../../../../shared-components/shortcuts';
import { useShortcutValidation } from '../../../../shared-components/shortcuts/hooks/useShortcutValidation';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';

export interface UseLinkEditorParams {
  linkId?: string; // If provided, load this link
  initialDraftKey?: string; // Optional initial title for a new link
  initialDraftUrls?: LinkItem[]; // Optional initial urls for a new link
}

export interface LinkEditorProps extends UseLinkEditorParams {
  onBack?: () => void;
}

const areLinkItemsEqual = (a: LinkItem[], b: LinkItem[]) => {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.url === b[i].url && (item.title || item.name) === (b[i].title || b[i].name) && item.id === b[i].id);
};

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every(item => setB.has(item));
};

const normalizeEditorShortcut = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getDirtyDebugSnapshot = ({
  activeLinkId,
  linkTitle,
  linkUrls,
  workspaceId,
  folderId,
  tagIds,
  linkShortcut,
  lastSavedTitle,
  lastSavedUrls,
  lastSavedWorkspaceId,
  lastSavedFolderId,
  lastSavedTagIds,
  lastSavedShortcut,
}: {
  activeLinkId: string | null;
  linkTitle: string;
  linkUrls: LinkItem[];
  workspaceId: string | null;
  folderId: string | null;
  tagIds: string[];
  linkShortcut: string;
  lastSavedTitle: string;
  lastSavedUrls: LinkItem[];
  lastSavedWorkspaceId: string | null;
  lastSavedFolderId: string | null;
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
    workspaceChanged: workspaceId !== lastSavedWorkspaceId,
    folderChanged: folderId !== lastSavedFolderId,
    tagsChanged: !areStringArraysEqual(tagIds, lastSavedTagIds),
    shortcutChanged:
      normalizeEditorShortcut(linkShortcut) !== normalizeEditorShortcut(lastSavedShortcut),
    current: {
      title: linkTitle,
      urlCount: linkUrls.length,
      workspaceId,
      folderId,
      tagIds,
      shortcut: normalizeEditorShortcut(linkShortcut),
    },
    saved: {
      title: lastSavedTitle,
      urlCount: lastSavedUrls.length,
      workspaceId: lastSavedWorkspaceId,
      folderId: lastSavedFolderId,
      tagIds: lastSavedTagIds,
      shortcut: normalizeEditorShortcut(lastSavedShortcut),
    },
  };
};

export function useLinkEditor(props: LinkEditorProps) {
  const {
    linkId,
    onBack,
    initialDraftKey,
    initialDraftUrls,
  } = props;

  const titleInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const lastSavedUpdatedAtRef = useRef<number | null>(null);

  // We use this ref to synchronously track ID creation inside save locks
  const activeLinkIdRef = useRef<string | null>(linkId ?? null);
  const [activeLinkId, setActiveLinkId] = useState<string | null>(linkId ?? null);

  const [linkTitle, setLinkTitle] = useState<string>(initialDraftKey || '');
  const [linkUrls, setLinkUrls] = useState<LinkItem[]>(initialDraftUrls || []);
  const { validateShortcut } = useShortcutValidation();
  const [linkShortcut, setLinkShortcut] = useState<string>('');
  const lastSavedShortcutRef = useRef<string>('');
  const isShortcutManuallyEditedRef = useRef<boolean>(false);

  // Editor state tracking for location and tags
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
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

  // Keep track of latest inputs for retry to avoid stale closures!
  const currentInputsRef = useRef({ linkTitle, linkUrls, workspaceId, folderId, tagIds, isInitialized, linkShortcut });
  currentInputsRef.current = { linkTitle, linkUrls, workspaceId, folderId, tagIds, isInitialized, linkShortcut };

  // Initialize draft OR load existing link ID
  useEffect(() => {
    if (linkId) {
      activeLinkIdRef.current = linkId;
      setActiveLinkId(linkId);
      setLinkShortcut('');
      lastSavedShortcutRef.current = '';
      isShortcutManuallyEditedRef.current = false;
      hasLoadedShortcutRef.current = false;
      setIsInitialized(false);
      setIsShortcutInitialized(false);
      setIsLinkDeleted(false);
      hasLoadedLiveLinkRef.current = false;
      isImportedCloudSnippetRef.current = false;
      return;
    }

    activeLinkIdRef.current = null;
    setActiveLinkId(null);
    setLinkTitle(initialDraftKey || '');
    setLinkUrls(initialDraftUrls || []);
    setLinkShortcut('');
    lastSavedShortcutRef.current = '';
    isShortcutManuallyEditedRef.current = false;
    hasLoadedShortcutRef.current = false;

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
    lastSavedUrlsRef.current = initialDraftUrls || [];
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedUpdatedAtRef.current = null;
    setSaveStatus('idle');
    setIsLinkDeleted(false);
    hasLoadedLiveLinkRef.current = true;
    setIsInitialized(true);
    setIsShortcutInitialized(true);
  }, [linkId]);

  // Natively sync across tabs using centralized useDbStore
  const liveLink = useDbStore(state => state.links.find(l => l.id === activeLinkId));
  const liveLinkRef = useRef(liveLink);
  liveLinkRef.current = liveLink;

  let isDirty = false;
  if (isInitialized && isShortcutInitialized) {
    const hasTitle = linkTitle.trim().length > 0;
    const hasUrls = linkUrls.length > 0;

    // If it's a new link and has not yet received both title and urls, it is not dirty
    if (!activeLinkId && (!hasTitle || !hasUrls)) {
      isDirty = false;
    } else {
      const titleChanged = linkTitle !== lastSavedTitleRef.current;
      const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
      const folderChanged = folderId !== lastSavedFolderIdRef.current;

      // Check URL array changes using helper
      const urlsChanged = !areLinkItemsEqual(linkUrls, lastSavedUrlsRef.current);

      // Check if tag IDs match using set equality
      const tagsChanged = !areStringArraysEqual(tagIds, lastSavedTagIdsRef.current);

      const shortcutChanged =
        isShortcutInitialized && normalizeEditorShortcut(linkShortcut) !== normalizeEditorShortcut(lastSavedShortcutRef.current);

      isDirty = titleChanged || urlsChanged || workspaceChanged || folderChanged || tagsChanged || shortcutChanged;
    }
  }

  useEffect(() => {
    console.log('[LinkEditor Debug] Dirty snapshot', getDirtyDebugSnapshot({
      activeLinkId,
      linkTitle,
      linkUrls,
      workspaceId,
      folderId,
      tagIds,
      linkShortcut,
      lastSavedTitle: lastSavedTitleRef.current,
      lastSavedUrls: lastSavedUrlsRef.current,
      lastSavedWorkspaceId: lastSavedWorkspaceIdRef.current,
      lastSavedFolderId: lastSavedFolderIdRef.current,
      lastSavedTagIds: lastSavedTagIdsRef.current,
      lastSavedShortcut: lastSavedShortcutRef.current,
    }));
  }, [activeLinkId, linkTitle, linkUrls, workspaceId, folderId, tagIds, linkShortcut, isDirty]);

  const isEditMode = !!linkId || !!activeLinkId;



  // Synchronize shortcut from DB on load or activeLinkId changes
  useEffect(() => {
    if (!activeLinkId) {
      setLinkShortcut('');
      lastSavedShortcutRef.current = '';
      hasLoadedShortcutRef.current = false;
      setIsShortcutInitialized(true);
      return;
    }

    setIsShortcutInitialized(false);

    const loadSavedShortcut = async () => {
      try {
        const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
        const fldObj = folderId ? { folder_id: folderId } : null;
        const targetCompoundId = getItemCompoundId({
          id: activeLinkId,
          workspace_id: wsObj?.workspace_id || null,
          folder_id: fldObj?.folder_id || null,
          snippet: { id: activeLinkId, category: 'link' }
        });
        const shortcutsMap = await readAllShortcuts();
        const sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] || '');
        if (isMounted.current) {
          if (!isShortcutManuallyEditedRef.current) {
            setLinkShortcut(sc);
            currentInputsRef.current.linkShortcut = sc;
          }
          lastSavedShortcutRef.current = sc;
          hasLoadedShortcutRef.current = true;
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
  }, [activeLinkId, workspaceId, folderId]);

  const handleSave = useCallback(async (silent: boolean = false, overrideProps?: SharedProperties | null): Promise<string | boolean> => {
    if (hasConflictRef.current) return false;

    // ALWAYS read from refs to avoid stale closure issues during retries
    const {
      linkTitle: currentTitle,
      linkUrls: currentUrls,
      workspaceId: currentWsId,
      folderId: currentFId,
      tagIds: currentTIds,
      isInitialized: currentIsInit,
      linkShortcut: currentShortcut,
    } = currentInputsRef.current;

    if (isMounted.current) setSaveError(null);
    if (!silent && autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const hasTitle = currentTitle.trim().length > 0;
    const hasUrls = currentUrls.length > 0;
    const currentLinkId = activeLinkIdRef.current;
    const savingLinkId = currentLinkId;

    const normalizedCurrentShortcut = normalizeEditorShortcut(currentShortcut);
    const hasMeaningfulChanges =
      currentTitle !== lastSavedTitleRef.current ||
      !areLinkItemsEqual(currentUrls, lastSavedUrlsRef.current) ||
      currentWsId !== lastSavedWorkspaceIdRef.current ||
      currentFId !== lastSavedFolderIdRef.current ||
      !areStringArraysEqual(currentTIds, lastSavedTagIdsRef.current) ||
      normalizedCurrentShortcut !== normalizeEditorShortcut(lastSavedShortcutRef.current);

    if (currentLinkId && currentIsInit && hasTitle && hasUrls && !hasMeaningfulChanges) {
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
        if (isMounted.current) setSaveStatus('idle');
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
            lastSavedWorkspaceIdRef.current = null;
            lastSavedFolderIdRef.current = null;
            lastSavedTagIdsRef.current = [];
            lastSavedUpdatedAtRef.current = null;
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
            setSaveStatus('idle');
            setLastSavedAt(null);
          }
          return true;
        } catch (err) {
          console.error('Auto-delete failed:', err);
          return false;
        } finally {
          savePromiseRef.current = null;
          if (saveAgainRef.current && !hasConflictRef.current) {
            saveAgainRef.current = false;
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
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
      if (!silent) setSaveStatus('saving');
      saveAgainRef.current = true;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
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
        } catch (err: any) {
          console.error('Delete failed during save:', err);
          return false;
        } finally {
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
      const loopWsId = overrideProps && overrideProps.workspaceId !== undefined ? overrideProps.workspaceId : currentInputsRef.current.workspaceId;
      const loopFId = overrideProps && overrideProps.folderId !== undefined ? overrideProps.folderId : currentInputsRef.current.folderId;
      const loopTagIds = overrideProps && overrideProps.selectedTags ? overrideProps.selectedTags.map((t: { id: string }) => t.id) : currentInputsRef.current.tagIds;
      const loopTitle = currentInputsRef.current.linkTitle;
      const loopUrls = currentInputsRef.current.linkUrls;
      const loopShortcut = currentInputsRef.current.linkShortcut;

      if (!silent && isMounted.current) setSaveStatus('saving');

      // Sanitize URLs before saving
      const sanitizedUrls = loopUrls.map(u => {
        let validUrl = u.url.trim();
        if (validUrl) {
          try {
            const parsed = new URL(validUrl);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              validUrl = 'https://' + validUrl;
            } else if (!parsed.hostname) {
              validUrl = 'https://' + validUrl;
            }
          } catch {
            if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
              validUrl = 'https://' + validUrl;
            }
          }
        }
        return { ...u, url: validUrl };
      });

      try {
        let savedLink: LinkRecord;
        const isCreating = !currentLinkId || isImportedCloudSnippetRef.current;

        if (isCreating) {
          const input: CreateLinkInput = {
            id: currentLinkId || undefined,
            workspaceId: loopWsId || undefined,
            folderId: loopFId,
            title: loopTitle,
            urls: sanitizedUrls,
            tagIds: loopTagIds,
          };

          savedLink = await createLink(input);
          isImportedCloudSnippetRef.current = false;
        } else {
          // UPDATE LINK
          const input: UpdateLinkInput = {
            title: loopTitle,
            urls: sanitizedUrls,
            workspaceId: loopWsId || undefined,
            folderId: loopFId,
            tagIds: loopTagIds,
            expectedUpdatedAt: lastSavedUpdatedAtRef.current ?? undefined,
          };

          const titleChanged = loopTitle !== lastSavedTitleRef.current;
          const urlsChanged = !areLinkItemsEqual(sanitizedUrls, lastSavedUrlsRef.current);
          const workspaceChanged = loopWsId !== lastSavedWorkspaceIdRef.current;
          const folderChanged = loopFId !== lastSavedFolderIdRef.current;
          const tagsChanged = !areStringArraysEqual(loopTagIds, lastSavedTagIdsRef.current);
          const normalizedLoopShortcut = normalizeEditorShortcut(loopShortcut);
          const shortcutChanged = normalizedLoopShortcut !== lastSavedShortcutRef.current;

          if (!titleChanged && !urlsChanged && !workspaceChanged && !folderChanged && !tagsChanged && !shortcutChanged) {
            hasConflictRef.current = false;
            setConflictLink(null);
            setSaveStatus('saved');
            if (lastSavedUpdatedAtRef.current !== null) {
              setLastSavedAt(new Date(lastSavedUpdatedAtRef.current));
            }
            return true;
          }

          savedLink = await updateLink(currentLinkId, input);
        }

        if (activeLinkIdRef.current !== savingLinkId) {
          return true; // Saved to DB, but do not update this editor
        }

        // For new links, bind the new link ID
        if (!currentLinkId) {
          activeLinkIdRef.current = savedLink.id;
          if (isMounted.current) setActiveLinkId(savedLink.id);
          hasLoadedLiveLinkRef.current = false;
        }

        // Sync inputs if they haven't changed since the save started
        if (currentInputsRef.current.workspaceId === loopWsId && isMounted.current) setWorkspaceId(savedLink.workspaceId);
        if (currentInputsRef.current.folderId === loopFId && isMounted.current) setFolderId(savedLink.folderId);
        if (areStringArraysEqual(currentInputsRef.current.tagIds, loopTagIds) && isMounted.current) {
          setTagIds(savedLink.tagIds);
        }
        if (currentInputsRef.current.linkTitle === loopTitle && isMounted.current) setLinkTitle(savedLink.title);
        // Only update urls if user hasn't typed anything new
        if (areLinkItemsEqual(currentInputsRef.current.linkUrls, loopUrls) && isMounted.current) {
          setLinkUrls(savedLink.urls);
        }

        lastSavedTitleRef.current = savedLink.title;
        lastSavedUrlsRef.current = savedLink.urls;
        lastSavedWorkspaceIdRef.current = savedLink.workspaceId;
        lastSavedFolderIdRef.current = savedLink.folderId;
        lastSavedTagIdsRef.current = savedLink.tagIds;
        lastSavedUpdatedAtRef.current = savedLink.updatedAt;
        hasConflictRef.current = false;

        // Save shortcut!
        const wsObj = savedLink.workspaceId ? { workspace_id: savedLink.workspaceId } : null;
        const fldObj = savedLink.folderId ? { folder_id: savedLink.folderId } : null;
        const targetCompoundId = getItemCompoundId({
          id: savedLink.id,
          workspace_id: wsObj?.workspace_id || null,
          folder_id: fldObj?.folder_id || null,
          snippet: { id: savedLink.id, category: 'link' }
        });

        const finalShortcut = normalizeEditorShortcut(loopShortcut);
        if (finalShortcut) {
          const valRes = await validateShortcut(finalShortcut, savedLink.id);
          if (valRes.isValid) {
            console.log(`[ShortcutDebug] handleSave: Valid shortcut "${finalShortcut}", saving to DB for item "${savedLink.id}"...`);
            await saveShortcut(savedLink.id, targetCompoundId, finalShortcut, savedLink.title, 'link');
          } else {
            console.warn(`[ShortcutDebug] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
          }
          // Always update the ref to prevent infinite autosave loops
          lastSavedShortcutRef.current = finalShortcut;
        } else {
          console.log(`[ShortcutDebug] handleSave: Clearing shortcut for item "${savedLink.id}"...`);
          await clearShortcut(savedLink.id, targetCompoundId, 'link');
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
          workspaceId: currentInputsRef.current.workspaceId,
          folderId: currentInputsRef.current.folderId,
          tagIds: currentInputsRef.current.tagIds,
          linkShortcut: finalShortcut,
          lastSavedTitle: savedLink.title,
          lastSavedUrls: savedLink.urls,
          lastSavedWorkspaceId: savedLink.workspaceId,
          lastSavedFolderId: savedLink.folderId,
          lastSavedTagIds: savedLink.tagIds,
          lastSavedShortcut: finalShortcut,
        }));

        if (!currentLinkId && isMounted.current && activeLinkIdRef.current !== activeLinkId) {
          setActiveLinkId(savedLink.id);
        }

        // Persist default selections to localStorage
        const wId = savedLink.workspaceId;
        const fId = savedLink.folderId;
        if (wId) void StorageManager.setItem('lastUsedWorkspaceId', wId);
        if (fId) void StorageManager.setItem('lastUsedFolderId', fId);
        else void StorageManager.removeItem('lastUsedFolderId');

        setConflictLink(null);

        if (isMounted.current) {
          setSaveStatus('saved');
          if (savedLink.updatedAt) {
            setLastSavedAt(new Date(savedLink.updatedAt));
          } else {
            setLastSavedAt(new Date());
          }
        }
        finalResult = savedLink.id || true;
      } catch (err: any) {
        if (err.name === 'ConflictError') {
          console.warn('Conflict detected:', err.message);
          hasConflictRef.current = true;
          if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
          setSaveStatus('conflict');
          setConflictLink(err.remoteLink ?? liveLinkRef.current ?? null);
          return false;
        }
        console.error('Save failed:', err);
        if (isMounted.current) setSaveStatus('error');
        finalResult = false;
      } finally {
        savePromiseRef.current = null;
        if (saveAgainRef.current && !hasConflictRef.current) {
          saveAgainRef.current = false;
          if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
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
      if (onBack) onBack();
      return;
    }
    setIsDeleteDialogOpen(false);
    try {
      await deleteLink(currentLinkId);
      if (onBack) onBack();
    } catch (msg) {
      console.error('Delete failed:', msg);
    }
  }, [onBack]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesDialogOpen(true);
    } else {
      if (onBack) onBack();
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
  }, [linkTitle, linkUrls, linkShortcut, workspaceId, folderId, tagIds, handleSave, isDirty, activeLinkId]);

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
    if (liveLink === undefined) return;
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
      const localWsChanged = currentInputsRef.current.workspaceId !== lastSavedWorkspaceIdRef.current;
      const localFolderChanged = currentInputsRef.current.folderId !== lastSavedFolderIdRef.current;
      const localTagsChanged = !areStringArraysEqual(currentInputsRef.current.tagIds, lastSavedTagIdsRef.current);

      const remoteTitleChanged = liveLink.title !== lastSavedTitleRef.current;
      const remoteUrlsChanged = !areLinkItemsEqual(liveLink.urls, lastSavedUrlsRef.current);
      const remoteWsChanged = liveLink.workspaceId !== lastSavedWorkspaceIdRef.current;
      const remoteFolderChanged = liveLink.folderId !== lastSavedFolderIdRef.current;
      const remoteTagsChanged = !areStringArraysEqual(liveLink.tagIds, lastSavedTagIdsRef.current);

      const hasAnyConflict = (localTitleChanged && remoteTitleChanged) ||
        (localUrlsChanged && remoteUrlsChanged) ||
        (localWsChanged && remoteWsChanged) ||
        (localFolderChanged && remoteFolderChanged) ||
        (localTagsChanged && remoteTagsChanged);

      if (hasAnyConflict) {
        hasConflictRef.current = true;
        setConflictLink(liveLink);
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
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
        setWorkspaceId(liveLink.workspaceId);
        currentInputsRef.current.workspaceId = liveLink.workspaceId;
      }
      if (remoteFolderChanged) {
        setFolderId(liveLink.folderId);
        currentInputsRef.current.folderId = liveLink.folderId;
      }
      if (remoteTagsChanged) {
        setTagIds(liveLink.tagIds);
        currentInputsRef.current.tagIds = liveLink.tagIds;
      }

      lastSavedTitleRef.current = liveLink.title;
      lastSavedUrlsRef.current = liveLink.urls;
      lastSavedWorkspaceIdRef.current = liveLink.workspaceId;
      lastSavedFolderIdRef.current = liveLink.folderId;
      lastSavedTagIdsRef.current = liveLink.tagIds;
      lastSavedUpdatedAtRef.current = liveLink.updatedAt;
      setLastSavedAt(new Date(liveLink.updatedAt));

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => handleSave(), 400);
      return;
    }

    if (!isInitialized) {
      // First load of an existing link
      const hasLocalEdits = isDirty;

      if (!hasLocalEdits) {
        setLinkTitle(liveLink.title);
        setLinkUrls(liveLink.urls);
        setWorkspaceId(liveLink.workspaceId);
        setFolderId(liveLink.folderId);
        setTagIds(liveLink.tagIds);
        currentInputsRef.current = {
          linkTitle: liveLink.title,
          linkUrls: liveLink.urls,
          workspaceId: liveLink.workspaceId,
          folderId: liveLink.folderId,
          tagIds: liveLink.tagIds,
          isInitialized: true,
          linkShortcut: linkShortcut
        };
      } else {
        currentInputsRef.current = {
          ...currentInputsRef.current,
          isInitialized: true
        };
      }

      lastSavedTitleRef.current = liveLink.title;
      lastSavedUrlsRef.current = liveLink.urls;
      lastSavedWorkspaceIdRef.current = liveLink.workspaceId;
      lastSavedFolderIdRef.current = liveLink.folderId;
      lastSavedTagIdsRef.current = liveLink.tagIds;
      lastSavedUpdatedAtRef.current = liveLink.updatedAt;

      hasConflictRef.current = false;
      setConflictLink(null);

      setLastSavedAt(new Date(liveLink.updatedAt));
      setSaveStatus(hasLocalEdits ? 'saving' : 'saved');
      setIsInitialized(true);

      if ((saveAgainRef.current || hasLocalEdits) && !hasConflictRef.current) {
        saveAgainRef.current = false;
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => handleSave(), 400);
      }
    } else if (!isDirty) {
      // Background sync from other tabs
      setLinkTitle(liveLink.title);
      setLinkUrls(liveLink.urls);
      setWorkspaceId(liveLink.workspaceId);
      setFolderId(liveLink.folderId);
      setTagIds(liveLink.tagIds);

      lastSavedTitleRef.current = liveLink.title;
      lastSavedUrlsRef.current = liveLink.urls;
      lastSavedWorkspaceIdRef.current = liveLink.workspaceId;
      lastSavedFolderIdRef.current = liveLink.folderId;
      lastSavedTagIdsRef.current = liveLink.tagIds;
      lastSavedUpdatedAtRef.current = liveLink.updatedAt;

      setLastSavedAt(new Date(liveLink.updatedAt));
      setSaveStatus('saved');
    }
  }, [liveLink, isDirty, isInitialized, activeLinkId, handleSave]);

  const handlePropertiesChange = useCallback((newProps: SharedProperties) => {
    const prevWsId = currentInputsRef.current.workspaceId;
    const prevFId = currentInputsRef.current.folderId;
    const prevTIds = currentInputsRef.current.tagIds;

    let wId = prevWsId;
    let fId = prevFId;
    let tIds = prevTIds;

    if (newProps.workspaceId !== undefined) wId = newProps.workspaceId;
    if (newProps.folderId !== undefined) fId = newProps.folderId;
    if (newProps.selectedTags) tIds = newProps.selectedTags.map((t: any) => t.id);

    const tagsChanged = !areStringArraysEqual(tIds, prevTIds);
    const hasDestinationChange = prevWsId !== wId || prevFId !== fId || tagsChanged;

    if (!hasDestinationChange) {
      return;
    }

    currentInputsRef.current = {
      ...currentInputsRef.current,
      workspaceId: wId,
      folderId: fId,
      tagIds: tIds,
    };

    setWorkspaceId(wId);
    setFolderId(fId);
    setTagIds(tIds);

    // Trigger an immediate silent save if destination or tags change.
    void handleSave(true, newProps);
  }, [handleSave]);

  const resolveConflictWithRemote = useCallback(() => {
    if (!conflictLink) return;
    setLinkTitle(conflictLink.title);
    setLinkUrls(conflictLink.urls);
    setWorkspaceId(conflictLink.workspaceId);
    setFolderId(conflictLink.folderId);
    setTagIds(conflictLink.tagIds);

    currentInputsRef.current = {
      linkTitle: conflictLink.title,
      linkUrls: conflictLink.urls,
      workspaceId: conflictLink.workspaceId,
      folderId: conflictLink.folderId,
      tagIds: conflictLink.tagIds,
      isInitialized: true,
      linkShortcut: linkShortcut
    };

    lastSavedTitleRef.current = conflictLink.title;
    lastSavedUrlsRef.current = conflictLink.urls;
    lastSavedWorkspaceIdRef.current = conflictLink.workspaceId;
    lastSavedFolderIdRef.current = conflictLink.folderId;
    lastSavedTagIdsRef.current = conflictLink.tagIds;
    lastSavedUpdatedAtRef.current = conflictLink.updatedAt;

    hasConflictRef.current = false;
    setConflictLink(null);
    setLastSavedAt(new Date(conflictLink.updatedAt));
    setSaveStatus('saved');
  }, [conflictLink, setSaveStatus]);

  const keepLocalVersion = useCallback(() => {
    if (!conflictLink) return;
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
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
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
      workspaceId,
      folderId,
      tagIds,
      isInitialized: true,
      linkShortcut: '',
    };
  }, [workspaceId, folderId, tagIds]);

  return {
    linkTitle,
    linkUrls,
    linkShortcut,
    setLinkShortcut,
    isShortcutManuallyEditedRef,
    activeLinkId: linkId || activeLinkId,
    liveLink,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    setSaveStatus,
    saveError,
    setSaveError,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    lastSavedShortcutRef,
    isDirty,
    isInitialized: isInitialized && (linkId === activeLinkId),
    isShortcutInitialized,
    isDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    isLinkDeleted,
    conflictLink,
    titleInputRef,
    setLinkTitle,
    setLinkUrls,
    handleSave,
    handleDelete,
    handleClose,
    setIsDeleteDialogOpen,
    setIsUnsavedChangesDialogOpen,
    handlePropertiesChange,
    resolveConflictWithRemote,
    keepLocalVersion,
    resetEditor
  };
}
