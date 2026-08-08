/**
 * @file useTodoEditor.ts
 * @description Custom React hook managing state and autosave for Todo editor.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createTodo, updateTodoContent, deleteTodo, mapTodoReferences } from './todoData';
import type { TodoRecord, ScheduleType, RecurringType } from './todoTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { getVersionsNewestFirst, getSnapshotById } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface UseTodoEditorParams {
  todoId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialScheduleType?: ScheduleType | '';
  initialScheduleTime?: number;
  initialRecurringCycle?: RecurringType;
  initialItems?: any[]; // The selected convertible items
  initialTags?: string[];
}

export function useTodoEditor(props: UseTodoEditorParams) {
  const { 
    todoId, initialTitle, initialDescription, 
    initialScheduleType, initialScheduleTime, 
    initialRecurringCycle, initialItems, initialTags
  } = props;

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const lastSavedTitleRef = useRef<string>(initialTitle || '');
  const lastSavedDescriptionRef = useRef<string>(initialDescription || '');
  const lastSavedScheduleTypeRef = useRef<ScheduleType | ''>(initialScheduleType || 'one-time');
  const lastSavedScheduleTimeRef = useRef<number | undefined>(initialScheduleTime !== undefined ? initialScheduleTime : undefined);
  const lastSavedRecurringCycleRef = useRef<RecurringType | undefined>(initialRecurringCycle);
  const lastSavedItemsRef = useRef<any[]>(initialItems || []);
  const lastSavedTagsRef = useRef<string[]>(initialTags || []);
  const lastSavedUpdatedAtRef = useRef<number | null>(null);

  const activeTodoIdRef = useRef<string | null>(todoId ?? null);
  const [activeTodoId, setActiveTodoId] = useState<string | null>(todoId ?? null);

  const [todoTitle, setTodoTitle] = useState<string>(initialTitle || '');
  const [todoDescription, setTodoDescription] = useState<string>(initialDescription || '');
  const [scheduleType, setScheduleType] = useState<ScheduleType | ''>(initialScheduleType || 'one-time');
  const [scheduleTime, setScheduleTime] = useState<number>(initialScheduleTime !== undefined ? initialScheduleTime : Date.now());
  const [recurringCycle, setRecurringCycle] = useState<RecurringType | undefined>(initialRecurringCycle);
  const [selectedItems, setSelectedItems] = useState<any[]>(initialItems || []);
  const [tagIds, setTagIds] = useState<string[]>(initialTags || []);
  const { validateShortcut } = useShortcutValidation();
  const [todoShortcut, setTodoShortcut] = useState<string>('');
  const isShortcutManuallyEditedRef = useRef(false);

  const updateTodoShortcut = useCallback((val: string) => {
    isShortcutManuallyEditedRef.current = true;
    setTodoShortcut(val);
  }, []);
  
  const lastSavedShortcutRef = useRef<string>('');
  const lastLoadedCompoundIdRef = useRef<string | null>(null);

  const [isInitialized, setIsInitialized] = useState<boolean>(!todoId);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isTodoDeleted, setIsTodoDeleted] = useState(false);

  const saveAgainRef = useRef(false);
  const savePromiseRef = useRef<Promise<string | false> | null>(null);
  const queuedSaveOverrideRef = useRef<any | null>(null);
  const queuedSaveIsAutoSaveRef = useRef<boolean | null>(null);

  const currentInputsRef = useRef({ todoTitle, todoDescription, scheduleType, scheduleTime, recurringCycle, selectedItems, tagIds, todoShortcut, isInitialized });
  currentInputsRef.current = { todoTitle, todoDescription, scheduleType, scheduleTime, recurringCycle, selectedItems, tagIds, todoShortcut, isInitialized };

  // Load or initialize
  useEffect(() => {
    if (todoId) {
      if (todoId === activeTodoIdRef.current && isInitialized) return;
      activeTodoIdRef.current = todoId;
      setActiveTodoId(todoId);
      setIsTodoDeleted(false);
      lastLoadedCompoundIdRef.current = null;
      setTodoShortcut('');
      lastSavedShortcutRef.current = '';

      lastSavedTitleRef.current = '';
      lastSavedDescriptionRef.current = '';
      lastSavedScheduleTypeRef.current = 'one-time';
      lastSavedScheduleTimeRef.current = undefined;
      lastSavedRecurringCycleRef.current = undefined;
      lastSavedItemsRef.current = [];
      lastSavedTagsRef.current = [];
      lastSavedUpdatedAtRef.current = null;
      
      setIsInitialized(false);
      return;
    }

    if (activeTodoIdRef.current && isInitialized) {
      return;
    }

    activeTodoIdRef.current = null;
    setActiveTodoId(null);
    setTodoTitle(initialTitle || '');
    setTodoDescription(initialDescription || '');
    setScheduleType(initialScheduleType || 'one-time');
    setScheduleTime(initialScheduleTime !== undefined ? initialScheduleTime : Date.now());
    setRecurringCycle(initialRecurringCycle);
    setSelectedItems(initialItems || []);
    setTagIds(initialTags || []);
    setTodoShortcut('');
    lastSavedShortcutRef.current = '';
    lastLoadedCompoundIdRef.current = null;

    lastSavedTitleRef.current = initialTitle || '';
    lastSavedDescriptionRef.current = initialDescription || '';
    lastSavedScheduleTypeRef.current = initialScheduleType || 'one-time';
    lastSavedScheduleTimeRef.current = initialScheduleTime !== undefined ? initialScheduleTime : Date.now();
    lastSavedRecurringCycleRef.current = initialRecurringCycle;
    lastSavedItemsRef.current = initialItems || [];
    lastSavedTagsRef.current = initialTags || [];
    lastSavedUpdatedAtRef.current = null;

    setSaveStatus('idle');
    setIsTodoDeleted(false);
    setIsInitialized(true);
  }, [todoId]);

  const currentTargetId = activeTodoId === '' ? null : (activeTodoId || todoId || null);

  // Sync state reactively with Zustand store using active todoId
  const liveTodo = useDbStore(state => state.todos.find(t => currentTargetId ? t.id === currentTargetId : false));

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const versionHistory = liveTodo?.versionHistory;
  const versionHistoryItems = useMemo(() => {
    if (!versionHistory || !Array.isArray(versionHistory.versions) || versionHistory.versions.length === 0) {
      return [];
    }
    const historyEntries = getVersionsNewestFirst(versionHistory);
    const items: Array<{ id: string; label: string; savedAt?: number; isCurrent?: boolean }> = [
      { id: 'current', label: 'Current', isCurrent: true },
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
    if (!selectedVersionId || selectedVersionId === 'current' || !versionHistory) return null;
    return getSnapshotById(versionHistory, selectedVersionId);
  }, [selectedVersionId, versionHistory]);

  const isViewingHistory = Boolean(historicalSnapshot);

  const displayTitle = historicalSnapshot ? historicalSnapshot.name : todoTitle;
  const displayDescription = historicalSnapshot ? (historicalSnapshot.description || '') : todoDescription;
  const displayScheduleType = historicalSnapshot ? historicalSnapshot.scheduleType : scheduleType;
  const displayScheduleTime = historicalSnapshot ? historicalSnapshot.scheduleTime : scheduleTime;
  const displayRecurringCycle = historicalSnapshot ? historicalSnapshot.recurringType : recurringCycle;
  const displaySelectedItems = historicalSnapshot ? (historicalSnapshot.references || []) : selectedItems;
  const displayTagIds = historicalSnapshot ? (historicalSnapshot.tagIds || []) : tagIds;
  const displayIsDone = historicalSnapshot ? historicalSnapshot.isDone : (liveTodo?.isDone ?? false);
  const displayShortcut = (historicalSnapshot && historicalSnapshot.shortcut) ? historicalSnapshot.shortcut : todoShortcut;

  useEffect(() => {
    setSelectedVersionId(null);
  }, [todoId, activeTodoId]);

  // 1. Strings: Fallback to empty strings and trim whitespace
  const titleChanged = isInitialized && (todoTitle || '').trim() !== (lastSavedTitleRef.current || '').trim();
  const descriptionChanged = isInitialized && (todoDescription || '').trim() !== (lastSavedDescriptionRef.current || '').trim();
  
  // 2. Selects/Enums: Provide exact default fallbacks
  const scheduleTypeChanged = isInitialized && (scheduleType || 'one-time') !== (lastSavedScheduleTypeRef.current || 'one-time');
  const recurringCycleChanged = isInitialized && (recurringCycle || '') !== (lastSavedRecurringCycleRef.current || '');
  
  // 3. Timestamps: Tolerate truncation discrepancies (< 60000ms variance)
  const scheduleTimeChanged = isInitialized && (
    (scheduleTime !== undefined && lastSavedScheduleTimeRef.current !== undefined && Math.abs(scheduleTime - lastSavedScheduleTimeRef.current) >= 60000) ||
    (scheduleTime !== undefined && lastSavedScheduleTimeRef.current === undefined)
  );
  
  // 4. Arrays (Tags): Sort and join to guarantee identical matching regardless of reference or order
  const safeTags = tagIds || [];
  const safeLastTags = lastSavedTagsRef.current || [];
  const tagsChanged = isInitialized && (
    safeTags.length !== safeLastTags.length || 
    [...safeTags].sort().join(',') !== [...safeLastTags].sort().join(',')
  );

  // 5. Arrays (Attachments): Extract IDs, sort, and join for pure structural comparison
  const safeItems = selectedItems || [];
  const safeLastItems = lastSavedItemsRef.current || [];
  const itemsChanged = isInitialized && (
    safeItems.length !== safeLastItems.length || 
    [...safeItems].map(i => i.id).sort().join(',') !== [...safeLastItems].map(i => i.id).sort().join(',')
  );

  // 6. Shortcuts: Strip spaces/casing
  const targetCompoundId = currentTargetId ? getItemCompoundId({
    id: currentTargetId,
    snippet: { id: currentTargetId, category: 'todo' }
  }) : null;
  const hasLoadedShortcut = !currentTargetId || lastLoadedCompoundIdRef.current === targetCompoundId;
  const shortcutChanged = isInitialized && hasLoadedShortcut && (todoShortcut || '').toLowerCase().replace(/[^a-z0-9]/g, '') !== (lastSavedShortcutRef.current || '');

  const isDirty = !isTodoDeleted && isInitialized && (titleChanged || descriptionChanged || scheduleTypeChanged || scheduleTimeChanged || recurringCycleChanged || itemsChanged || tagsChanged || shortcutChanged);

  useEffect(() => {
    if (!currentTargetId) {
      setTodoShortcut('');
      lastSavedShortcutRef.current = '';
      lastLoadedCompoundIdRef.current = null;
      return;
    }

    if (lastLoadedCompoundIdRef.current === targetCompoundId) return;

    const loadSavedShortcut = async () => {
      if (!targetCompoundId) return;
      try {
        const shortcutsMap = await readAllShortcuts();
        const sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] || '');
        if (isMounted.current && (todoId || activeTodoIdRef.current)) {
          if (!isShortcutManuallyEditedRef.current) {
            setTodoShortcut(sc);
          }
          lastSavedShortcutRef.current = sc;
          lastLoadedCompoundIdRef.current = targetCompoundId;
        }
      } catch (err) {
        console.error('Failed to load todo shortcut:', err);
      }
    };
    void loadSavedShortcut();
  }, [currentTargetId, todoId]);

  useEffect(() => {
    if (liveTodo === undefined || isTodoDeleted) return;

    if (liveTodo === null) {
      if (!isInitialized) setIsInitialized(true);
      return;
    }

    if (lastSavedUpdatedAtRef.current !== null && liveTodo.updatedAt <= lastSavedUpdatedAtRef.current) {
      setIsTodoDeleted(false);
      return;
    }

    if (isDirty) return;

    setTodoTitle(liveTodo.name);
    setTodoDescription(liveTodo.description || '');
    setScheduleType(liveTodo.scheduleType);
    setScheduleTime(liveTodo.scheduleTime);
    setRecurringCycle(liveTodo.recurringType);
    setSelectedItems(liveTodo.references);
    setTagIds(liveTodo.tagIds || []);

    lastSavedTitleRef.current = liveTodo.name;
    lastSavedDescriptionRef.current = liveTodo.description || '';
    lastSavedScheduleTypeRef.current = liveTodo.scheduleType;
    lastSavedScheduleTimeRef.current = liveTodo.scheduleTime;
    lastSavedRecurringCycleRef.current = liveTodo.recurringType;
    lastSavedItemsRef.current = liveTodo.references;
    lastSavedTagsRef.current = liveTodo.tagIds || [];
    lastSavedUpdatedAtRef.current = liveTodo.updatedAt;

    setIsInitialized(true);
    setSaveStatus('saved');
    setLastSavedAt(new Date(liveTodo.updatedAt));
    setIsTodoDeleted(false);
  }, [liveTodo, isInitialized, isTodoDeleted, isDirty]);

  const handleSave = useCallback(
    async function saveFn(
      isAutoSave: boolean = false,
      overrideProps?: {
        title?: string;
        description?: string;
        scheduleType?: ScheduleType | '';
        scheduleTime?: number;
        recurringCycle?: RecurringType;
        selectedItems?: any[];
        tagIds?: string[];
      }
    ): Promise<string | false> {
      if (selectedVersionId && selectedVersionId !== 'current') {
        return false;
      }
      if (savePromiseRef.current) {
        saveAgainRef.current = true;
        if (overrideProps) {
          queuedSaveOverrideRef.current = { ...(queuedSaveOverrideRef.current || {}), ...overrideProps };
        }
        queuedSaveIsAutoSaveRef.current = queuedSaveIsAutoSaveRef.current === null ? isAutoSave : queuedSaveIsAutoSaveRef.current && isAutoSave;
        return savePromiseRef.current as Promise<any>;
      }

      const { todoTitle, todoDescription, scheduleType, scheduleTime, recurringCycle, selectedItems, tagIds, todoShortcut } = currentInputsRef.current;
      const finalTitle = overrideProps?.title !== undefined ? overrideProps.title : todoTitle;
      const finalDesc = overrideProps?.description !== undefined ? overrideProps.description : todoDescription;
      const finalScheduleType = overrideProps?.scheduleType !== undefined ? overrideProps.scheduleType : scheduleType;
      const finalScheduleTime = overrideProps?.scheduleTime !== undefined ? overrideProps.scheduleTime : scheduleTime;
      const finalRecurring = overrideProps?.recurringCycle !== undefined ? overrideProps.recurringCycle : recurringCycle;
      const finalItems = overrideProps?.selectedItems !== undefined ? overrideProps.selectedItems : selectedItems;
      const finalTagIds = overrideProps?.tagIds !== undefined ? overrideProps.tagIds : tagIds;
      const loopShortcut = todoShortcut;

      // Use default title if none provided
      const computedTitle = finalTitle.trim() ? finalTitle : (finalItems.length ? (finalItems[0].name || finalItems[0].title || finalItems[0].key || 'Untitled Todo') : 'Untitled Todo');

      setSaveStatus('saving');
      setSaveError(null);

      const execute = async (): Promise<string | false> => {
        try {
          let savedRecord: TodoRecord | undefined;

          if (!activeTodoIdRef.current) {
            // CREATE
            const created = await createTodo(
              computedTitle,
              finalItems,
              (finalScheduleType || 'one-time') as ScheduleType,
              finalScheduleTime,
              finalRecurring,
              finalDesc,
              finalTagIds || []
            );
            
            savedRecord = created;
            if (isMounted.current) {
              activeTodoIdRef.current = created.id;
              lastSavedTitleRef.current = created.name;
              lastSavedDescriptionRef.current = created.description || '';
              lastSavedScheduleTypeRef.current = created.scheduleType;
              lastSavedScheduleTimeRef.current = created.scheduleTime;
              lastSavedRecurringCycleRef.current = created.recurringType;
              lastSavedItemsRef.current = created.references;
              lastSavedTagsRef.current = created.tagIds || [];
              lastSavedUpdatedAtRef.current = created.updatedAt;
              setSaveStatus('saved');
              setLastSavedAt(new Date(created.updatedAt));
            }
          } else {
            // UPDATE
            const mappedReferences = mapTodoReferences(finalItems);
            const didReschedule =
              Math.abs((finalScheduleTime || 0) - (lastSavedScheduleTimeRef.current || 0)) >= 60000;

            const updates: Partial<TodoRecord> = {
              name: computedTitle,
              description: finalDesc,
              scheduleType: (finalScheduleType || 'one-time') as ScheduleType,
              scheduleTime: finalScheduleTime,
              recurringType: finalRecurring,
              references: mappedReferences,
              tagIds: finalTagIds,
              ...(didReschedule && finalScheduleTime > Date.now() ? { isDone: false } : {}),
            };

            const updated = await updateTodoContent(activeTodoIdRef.current, updates);
            savedRecord = updated;
            if (isMounted.current) {
              lastSavedTitleRef.current = updated.name;
              lastSavedDescriptionRef.current = updated.description || '';
              lastSavedScheduleTypeRef.current = updated.scheduleType;
              lastSavedScheduleTimeRef.current = finalScheduleTime;
              lastSavedRecurringCycleRef.current = updated.recurringType;
              lastSavedItemsRef.current = updated.references;
              lastSavedTagsRef.current = updated.tagIds || [];
              lastSavedUpdatedAtRef.current = updated.updatedAt;
              setSaveStatus('saved');
              setLastSavedAt(new Date(updated.updatedAt));
            }
          }

          // Handle shortcuts
          const targetId = activeTodoIdRef.current;
          if (targetId && savedRecord) {
            const targetCompoundId = getItemCompoundId({
              id: targetId,
              snippet: { id: targetId, category: 'todo' }
            });
            const finalShortcut = loopShortcut.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (finalShortcut) {
              const valRes = await validateShortcut(finalShortcut, targetId);
              if (valRes.isValid) {
                console.log(`[ShortcutDebug][TodoEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for todo "${targetId}"...`);
                await saveShortcut(targetId, targetCompoundId, finalShortcut, savedRecord.name, 'todo');
                await updateTodoContent(targetId, { shortcut: finalShortcut });
              }
            } else if (lastSavedShortcutRef.current && !finalShortcut) {
              console.log(`[ShortcutDebug][TodoEditor] handleSave: Clearing shortcut for todo "${targetId}"...`);
              await clearShortcut(targetId, targetCompoundId, 'todo');
              await updateTodoContent(targetId, { shortcut: '' });
              lastSavedShortcutRef.current = '';
            }
          }

          if (isMounted.current && activeTodoIdRef.current !== activeTodoId) {
            setActiveTodoId(activeTodoIdRef.current);
          }

          return activeTodoIdRef.current || false;
        } catch (err: any) {
          console.error('save FAILED:', err);
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
    },
    [selectedVersionId, validateShortcut]
  );

  const handleDelete = useCallback(async () => {
    if (!activeTodoIdRef.current) return;
    try {
      await deleteTodo(activeTodoIdRef.current);
      setIsTodoDeleted(true);
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  }, []);

  const resetEditor = useCallback(() => {
    activeTodoIdRef.current = null;
    setActiveTodoId('');
    setTodoTitle('');
    setTodoDescription('');
    setScheduleType('one-time');
    const now = Date.now();
    setScheduleTime(now);
    setRecurringCycle(undefined);
    setSelectedItems([]);
    setTagIds([]);
    setTodoShortcut('');
    setSelectedVersionId(null);
    lastSavedShortcutRef.current = '';
    lastLoadedCompoundIdRef.current = null;

    lastSavedTitleRef.current = '';
    lastSavedDescriptionRef.current = '';
    lastSavedScheduleTypeRef.current = 'one-time';
    lastSavedScheduleTimeRef.current = now;
    lastSavedRecurringCycleRef.current = undefined;
    lastSavedItemsRef.current = [];
    lastSavedTagsRef.current = [];
    lastSavedUpdatedAtRef.current = null;

    setSaveStatus('idle');
    setIsTodoDeleted(false);
    setIsInitialized(true);
  }, []);

  return {
    todoTitle: displayTitle, setTodoTitle,
    todoDescription: displayDescription, setTodoDescription,
    scheduleType: displayScheduleType, setScheduleType,
    scheduleTime: displayScheduleTime, setScheduleTime,
    recurringCycle: displayRecurringCycle, setRecurringCycle,
    selectedItems: displaySelectedItems, setSelectedItems,
    tagIds: displayTagIds, setTagIds,
    todoShortcut: displayShortcut, setTodoShortcut: updateTodoShortcut,
    saveStatus, setSaveStatus, saveError, setSaveError, lastSavedAt, setLastSavedAt, isDirty: isViewingHistory ? false : isDirty,
    lastSavedTitleRef, lastSavedShortcutRef,
    handleSave, handleDelete, isInitialized,
    activeTodoId: todoId || activeTodoId,
    resetEditor,
    liveTodo,
    versionHistory,
    versionHistoryItems,
    selectedVersionId,
    setSelectedVersionId,
    isViewingHistory,
    displayIsDone,
  };
}
