/**
 * @file useChatAgentEditor.ts
 * @description Custom React hook managing the workspace, folder, tagging, title,
 * and list of URLs (representing selected models) for the ChatAgent editor.
 * Provides a manual save method and handles database interactions.
 * 
 * @usage
 * ```tsx
 * import { useChatAgentEditor } from './useChatAgentEditor';
 * const state = useChatAgentEditor({ agentId });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { createChatAgent, updateChatAgent, deleteChatAgent } from './chatAgentData';
import type { ChatAgentRecord, CreateChatAgentInput, UpdateChatAgentInput } from './chatAgentTypes';
import { useChatAgent } from './chatAgentHooks';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';

export interface ChatAgentEditorProps {
  agentId?: string | null;
  onBack?: () => void;
  initialName?: string;
  initialUrls?: string[];
}

export function useChatAgentEditor(props: ChatAgentEditorProps) {
  const { agentId, onBack, initialName, initialUrls } = props;

  const [activeAgentId, setActiveAgentId] = useState<string | null>(agentId ?? null);
  const activeAgentIdRef = useRef<string | null>(agentId ?? null);

  const [agentTitle, setAgentTitle] = useState<string>(initialName || '');
  const [agentUrls, setAgentUrls] = useState<string[]>(initialUrls || []);
  
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const [isInitialized, setIsInitialized] = useState<boolean>(!agentId);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // We still track original saved state to compute `isDirty` if the user tries to exit without saving.
  const lastSavedTitleRef = useRef<string>(initialName || '');
  const lastSavedUrlsRef = useRef<string[]>(initialUrls || []);
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);

  // Load existing or set defaults
  useEffect(() => {
    if (agentId) {
      activeAgentIdRef.current = agentId;
      setActiveAgentId(agentId);
      setIsInitialized(false);
      return;
    }

    activeAgentIdRef.current = null;
    setActiveAgentId(null);
    setAgentTitle(initialName || '');
    setAgentUrls(initialUrls || []);
    setTagIds([]);

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

    lastSavedTitleRef.current = initialName || '';
    lastSavedUrlsRef.current = initialUrls || [];
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    setSaveStatus('idle');
    setIsInitialized(true);
  }, [agentId, initialName, initialUrls]);

  // Sync when parent updates models/urls (e.g., from ModelSelector)
  useEffect(() => {
    if (initialUrls) {
      setAgentUrls(prev => {
        const prevSorted = [...prev].sort().join(',');
        const newSorted = [...initialUrls].sort().join(',');
        return prevSorted !== newSorted ? initialUrls : prev;
      });
    }
  }, [initialUrls]);

  const liveAgent = useChatAgent(activeAgentId);

  const isDirty = useMemo(() => {
    const titleChanged = agentTitle !== lastSavedTitleRef.current;
    
    const currentUrlsSorted = [...agentUrls].sort().join(',');
    const savedUrlsSorted = [...lastSavedUrlsRef.current].sort().join(',');
    const urlsChanged = currentUrlsSorted !== savedUrlsSorted;

    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;
    const tagsChanged = [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

    return titleChanged || urlsChanged || workspaceChanged || folderChanged || tagsChanged;
  }, [agentTitle, agentUrls, workspaceId, folderId, tagIds]);

  // Update from live query if not dirty
  useEffect(() => {
    if (!liveAgent) return;

    if (!isInitialized || !isDirty) {
      setAgentTitle(liveAgent.title);
      setAgentUrls(liveAgent.urls);
      setWorkspaceId(liveAgent.workspaceId);
      setFolderId(liveAgent.folderId);
      setTagIds(liveAgent.tagIds);

      lastSavedTitleRef.current = liveAgent.title;
      lastSavedUrlsRef.current = liveAgent.urls;
      lastSavedWorkspaceIdRef.current = liveAgent.workspaceId;
      lastSavedFolderIdRef.current = liveAgent.folderId;
      lastSavedTagIdsRef.current = liveAgent.tagIds;

      setLastSavedAt(new Date(liveAgent.updatedAt));
      setSaveStatus('saved');
      setIsInitialized(true);
    }
  }, [liveAgent, isDirty, isInitialized]);

  // MANUAL Save Trigger - no debounce or autosave!
  const handleSave = useCallback(async (
    targetWorkspaceId?: string,
    targetFolderId?: string | null,
    targetTagIds?: string[]
  ): Promise<string | null> => {
    
    // Resolve destinations
    const finalWsId = targetWorkspaceId !== undefined ? targetWorkspaceId : workspaceId;
    const finalFolderId = targetFolderId !== undefined ? targetFolderId : folderId;
    const finalTagIds = targetTagIds !== undefined ? targetTagIds : tagIds;

    const currentAgentId = activeAgentIdRef.current;

    setSaveStatus('saving');
    try {
      let savedAgent: ChatAgentRecord;
      if (!currentAgentId) {
        // Create
        const input: CreateChatAgentInput = {
          workspaceId: finalWsId || undefined,
          folderId: finalFolderId,
          title: agentTitle,
          urls: agentUrls,
          tagIds: finalTagIds,
        };
        savedAgent = await createChatAgent(input);
        
        activeAgentIdRef.current = savedAgent.id;
        setActiveAgentId(savedAgent.id);
      } else {
        // Update
        const input: UpdateChatAgentInput = {
          workspaceId: finalWsId || undefined,
          folderId: finalFolderId,
          title: agentTitle,
          urls: agentUrls,
          tagIds: finalTagIds,
        };
        savedAgent = await updateChatAgent(currentAgentId, input);
        
        const oldWsObj = lastSavedWorkspaceIdRef.current ? { workspace_id: lastSavedWorkspaceIdRef.current } : null;
        const oldFldObj = lastSavedFolderIdRef.current ? { folder_id: lastSavedFolderIdRef.current } : null;
        const oldCompoundId = getItemCompoundId({
          id: currentAgentId,
          workspace_id: oldWsObj?.workspace_id || null,
          folder_id: oldFldObj?.folder_id || null,
          snippet: { id: currentAgentId, category: 'agent' }
        });
        
        const newWsObj = savedAgent.workspaceId ? { workspace_id: savedAgent.workspaceId } : null;
        const newFldObj = savedAgent.folderId ? { folder_id: savedAgent.folderId } : null;
        const newCompoundId = getItemCompoundId({
          id: savedAgent.id,
          workspace_id: newWsObj?.workspace_id || null,
          folder_id: newFldObj?.folder_id || null,
          snippet: { id: savedAgent.id, category: 'agent' }
        });
        
        if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
          await migrateItemCompoundId(oldCompoundId, newCompoundId, 'agent');
        }
      }

      // Sync state back
      setWorkspaceId(savedAgent.workspaceId);
      setFolderId(savedAgent.folderId);
      setTagIds(savedAgent.tagIds);
      setAgentTitle(savedAgent.title);
      setAgentUrls(savedAgent.urls);

      lastSavedTitleRef.current = savedAgent.title;
      lastSavedUrlsRef.current = savedAgent.urls;
      lastSavedWorkspaceIdRef.current = savedAgent.workspaceId;
      lastSavedFolderIdRef.current = savedAgent.folderId;
      lastSavedTagIdsRef.current = savedAgent.tagIds;

      const wId = savedAgent.workspaceId;
      const fId = savedAgent.folderId;
      if (wId) void StorageManager.setItem('lastUsedWorkspaceId', wId);
      if (fId) void StorageManager.setItem('lastUsedFolderId', fId);
      else void StorageManager.removeItem('lastUsedFolderId');

      setSaveStatus('saved');
      setLastSavedAt(new Date(savedAgent.updatedAt));
      return savedAgent.id;
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      return null;
    }
  }, [agentTitle, agentUrls, workspaceId, folderId, tagIds]);

  const handleDelete = useCallback(async () => {
    const currentId = activeAgentIdRef.current;
    if (!currentId) {
      if (onBack) onBack();
      return;
    }
    try {
      await deleteChatAgent(currentId);
      if (onBack) onBack();
    } catch (msg) {
      console.error('Delete failed:', msg);
    }
  }, [onBack]);

  return {
    activeAgentId,
    liveAgent,
    agentTitle,
    agentUrls,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    lastSavedAt,
    isDirty,
    
    setAgentTitle,
    setAgentUrls,
    setWorkspaceId,
    setFolderId,
    setTagIds,
    
    handleSave,
    handleDelete,
  };
}
