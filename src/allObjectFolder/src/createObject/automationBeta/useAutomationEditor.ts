/**
 * @file useAutomationEditor.ts
 * @description Custom React hook managing the state, editing actions, and autosaving/deleting
 * logic for the Automation Builder. Handles workspace selection, tagging, and dialog control.
 * 
 * @usage
 * ```tsx
 * import { useAutomationEditor } from './useAutomationEditor';
 * const state = useAutomationEditor({ automationId });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import { createAutomation, updateAutomation, deleteAutomation } from './automationData';
import type { AutomationRecord, CreateAutomationInput, UpdateAutomationInput } from './automationTypes';
import type { SharedProperties } from '../../../../shared-components/editorToolbar/types';
import type { AutomationStep } from './utilities/automation';
import { useAutomation } from './automationHooks';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';

export interface AutomationEditorProps {
  automationId?: string | null;
  onBack?: () => void;
  initialDraftName?: string;
  initialDraftSteps?: AutomationStep[];
}

export function useAutomationEditor(props: AutomationEditorProps) {
  const { automationId, onBack, initialDraftName, initialDraftSteps } = props;

  const lastSavedNameRef = useRef<string>(initialDraftName || '');
  const lastSavedStepsRef = useRef<string>(JSON.stringify(initialDraftSteps || []));
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);

  // Synchronously track ID inside save locks
  const activeAutomationIdRef = useRef<string | null>(automationId ?? null);
  const [activeAutomationId, setActiveAutomationId] = useState<string | null>(automationId ?? null);

  const [automationName, setAutomationName] = useState<string>(initialDraftName || '');
  const [automationSteps, setAutomationSteps] = useState<AutomationStep[]>(initialDraftSteps || []);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(!automationId);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);

  // Save Lock
  const saveInProgressRef = useRef(false);
  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  const currentInputsRef = useRef({ automationName, automationSteps, workspaceId, folderId, tagIds, isInitialized });
  currentInputsRef.current = { automationName, automationSteps, workspaceId, folderId, tagIds, isInitialized };

  useEffect(() => {
    if (automationId) {
      activeAutomationIdRef.current = automationId;
      setActiveAutomationId(automationId);
      setIsInitialized(false);
      return;
    }

    activeAutomationIdRef.current = null;
    setActiveAutomationId(null);
    setAutomationName(initialDraftName || '');
    setAutomationSteps(initialDraftSteps || []);

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
    lastSavedNameRef.current = initialDraftName || '';
    lastSavedStepsRef.current = JSON.stringify(initialDraftSteps || []);
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    setSaveStatus('idle');
    setIsInitialized(true);
  }, [automationId, initialDraftName, initialDraftSteps]);

  const liveAutomation = useAutomation(activeAutomationId);

  const isDirty = useMemo(() => {
    const nameChanged = automationName !== lastSavedNameRef.current;
    const stepsChanged = JSON.stringify(automationSteps) !== lastSavedStepsRef.current;
    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;

    const tagsChanged =
      tagIds.length !== lastSavedTagIdsRef.current.length ||
      [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');

    return nameChanged || stepsChanged || workspaceChanged || folderChanged || tagsChanged;
  }, [automationName, automationSteps, workspaceId, folderId, tagIds]);

  const handleSave = useCallback(async (silent: boolean = false, overrideProps?: SharedProperties | null): Promise<boolean> => {
    const {
      automationName: currentName,
      automationSteps: currentSteps,
      workspaceId: currentWsId,
      folderId: currentFId,
      tagIds: currentTIds,
      isInitialized: currentIsInit
    } = currentInputsRef.current;

    const hasName = currentName.trim().length > 0;
    const hasSteps = currentSteps.length > 0;

    const currentAutomationId = activeAutomationIdRef.current;
    const savingAutomationId = currentAutomationId;

    if (currentAutomationId && !currentIsInit) return false;
    if (!currentAutomationId && !hasName && !hasSteps) return false;

    if (currentAutomationId && !hasName && !hasSteps) {
      if (savePromiseRef.current) {
        saveAgainRef.current = true;
        return savePromiseRef.current;
      }

      const performDelete = async (): Promise<boolean> => {
        saveInProgressRef.current = true;
        try {
          await deleteAutomation(currentAutomationId);
          if (activeAutomationIdRef.current === savingAutomationId) {
            activeAutomationIdRef.current = null;
            setActiveAutomationId(null);

            lastSavedNameRef.current = '';
            lastSavedStepsRef.current = '[]';
            lastSavedWorkspaceIdRef.current = null;
            lastSavedFolderIdRef.current = null;
            lastSavedTagIdsRef.current = [];

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

    if (savePromiseRef.current) {
      saveAgainRef.current = true;
      return savePromiseRef.current;
    }

    const performSave = async (): Promise<boolean> => {
      saveInProgressRef.current = true;
      if (!silent) setSaveStatus('saving');

      let activeWorkspaceId = currentWsId;
      let activeFolderId = currentFId;
      let activeTagIds = currentTIds;

      if (overrideProps) {
        if (overrideProps.workspaceId !== undefined) activeWorkspaceId = overrideProps.workspaceId;
        if (overrideProps.folderId !== undefined) activeFolderId = overrideProps.folderId;
        if (overrideProps.selectedTags) activeTagIds = overrideProps.selectedTags.map(t => t.id || (t as any).tag_id);
      }

      try {
        let savedAutomation: AutomationRecord;
        if (!currentAutomationId) {
          const input: CreateAutomationInput = {
            workspaceId: activeWorkspaceId || undefined,
            folderId: activeFolderId,
            name: currentName,
            steps: currentSteps,
            tagIds: activeTagIds,
          };
          savedAutomation = await createAutomation(input);
        } else {
          const input: UpdateAutomationInput = {
            name: currentName,
            steps: currentSteps,
            workspaceId: activeWorkspaceId || undefined,
            folderId: activeFolderId,
            tagIds: activeTagIds,
          };
          savedAutomation = await updateAutomation(currentAutomationId, input);
        }

        if (activeAutomationIdRef.current !== savingAutomationId) return true;

        if (!currentAutomationId) {
          activeAutomationIdRef.current = savedAutomation.id;
          setActiveAutomationId(savedAutomation.id);
        }

        if (currentInputsRef.current.workspaceId === activeWorkspaceId) setWorkspaceId(savedAutomation.workspaceId);
        if (currentInputsRef.current.folderId === activeFolderId) setFolderId(savedAutomation.folderId);
        if (currentInputsRef.current.tagIds === activeTagIds) setTagIds(savedAutomation.tagIds);
        if (currentInputsRef.current.automationName === currentName) setAutomationName(savedAutomation.name);
        if (JSON.stringify(currentInputsRef.current.automationSteps) === JSON.stringify(currentSteps)) setAutomationSteps(savedAutomation.steps);

        lastSavedNameRef.current = savedAutomation.name;
        lastSavedStepsRef.current = JSON.stringify(savedAutomation.steps);
        lastSavedWorkspaceIdRef.current = savedAutomation.workspaceId;
        lastSavedFolderIdRef.current = savedAutomation.folderId;
        lastSavedTagIdsRef.current = savedAutomation.tagIds;

        if (savedAutomation.workspaceId) await StorageManager.setItem('lastUsedWorkspaceId', savedAutomation.workspaceId);
        if (savedAutomation.folderId) await StorageManager.setItem('lastUsedFolderId', savedAutomation.folderId);
        else await StorageManager.removeItem('lastUsedFolderId');

        if (!silent) {
          setSaveStatus('saved');
          setLastSavedAt(new Date(savedAutomation.updatedAt));
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
          return handleSave(silent);
        }
      }
    };

    savePromiseRef.current = performSave();
    return savePromiseRef.current;
  }, []);

  const handleDelete = useCallback(async () => {
    const currentAutomationId = activeAutomationIdRef.current;
    if (!currentAutomationId) {
      if (onBack) onBack();
      return;
    }
    setIsDeleteDialogOpen(false);
    try {
      await deleteAutomation(currentAutomationId);
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

  useEffect(() => {
    if (!liveAutomation) return;

    if (!isInitialized) {
      setAutomationName(liveAutomation.name);
      setAutomationSteps(liveAutomation.steps);
      setWorkspaceId(liveAutomation.workspaceId);
      setFolderId(liveAutomation.folderId);
      setTagIds(liveAutomation.tagIds);

      lastSavedNameRef.current = liveAutomation.name;
      lastSavedStepsRef.current = JSON.stringify(liveAutomation.steps);
      lastSavedWorkspaceIdRef.current = liveAutomation.workspaceId;
      lastSavedFolderIdRef.current = liveAutomation.folderId;
      lastSavedTagIdsRef.current = liveAutomation.tagIds;

      setLastSavedAt(new Date(liveAutomation.updatedAt));
      setSaveStatus('saved');
      setIsInitialized(true);
    } else if (!isDirty) {
      setAutomationName(liveAutomation.name);
      setAutomationSteps(liveAutomation.steps);
      setWorkspaceId(liveAutomation.workspaceId);
      setFolderId(liveAutomation.folderId);
      setTagIds(liveAutomation.tagIds);

      lastSavedNameRef.current = liveAutomation.name;
      lastSavedStepsRef.current = JSON.stringify(liveAutomation.steps);
      lastSavedWorkspaceIdRef.current = liveAutomation.workspaceId;
      lastSavedFolderIdRef.current = liveAutomation.folderId;
      lastSavedTagIdsRef.current = liveAutomation.tagIds;

      setLastSavedAt(new Date(liveAutomation.updatedAt));
      setSaveStatus('saved');
    }
  }, [liveAutomation, isDirty, isInitialized]);

  const handlePropertiesChange = useCallback((newProps: SharedProperties) => {
    const prevWsId = currentInputsRef.current.workspaceId;
    const prevFId = currentInputsRef.current.folderId;

    let wId = prevWsId;
    let fId = prevFId;
    let tIds = currentInputsRef.current.tagIds;

    if (newProps.workspaceId !== undefined) wId = newProps.workspaceId;
    if (newProps.folderId !== undefined) fId = newProps.folderId;
    if (newProps.selectedTags) tIds = newProps.selectedTags.map((t: any) => t.id);

    setWorkspaceId(wId);
    setFolderId(fId);
    setTagIds(tIds);

    if (wId) void StorageManager.setItem('lastUsedWorkspaceId', wId);
    if (fId) void StorageManager.setItem('lastUsedFolderId', fId);
    else void StorageManager.removeItem('lastUsedFolderId');

    if (prevWsId !== wId || prevFId !== fId) {
      void handleSave(true, newProps);
    }
  }, [handleSave]);

  return {
    automationName,
    automationSteps,
    activeAutomationId,
    liveAutomation,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    lastSavedAt,
    isDirty,
    isDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    setAutomationName,
    setAutomationSteps,
    handleSave,
    handleDelete,
    handleClose,
    setIsDeleteDialogOpen,
    setIsUnsavedChangesDialogOpen,
    handlePropertiesChange
  };
}
