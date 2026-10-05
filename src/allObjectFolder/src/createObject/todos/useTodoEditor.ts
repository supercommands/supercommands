/**
 * @file useTodoEditor.ts
 * @description Custom React hook managing state and autosave for Todo editor.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createTodo, updateTodoContent, deleteTodo, mapTodoReferences } from './todoData';
import type { TodoRecord, ScheduleType, RecurringType } from './todoTypes';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { db } from '../../../../storage/indexDB/dbConfig';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { saveShortcutGuarded } from '../../../../shared-components/shortcuts';
import type { ShortcutAssignmentApproval } from '../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { getVersionsNewestFirst, getSnapshotById } from '../../../../shared-components/versionHistory/structuredVersionHistory';
import { ensureDashboardViewTag } from '../tags/dashboardTagData';

// Compare the same canonical reference IDs that persistence writes.
const todoReferenceIds = (items: any[] = []) => JSON.stringify(mapTodoReferences(items).map(item => item.id).sort());
const NO_REQUIRED_TAG_IDS: string[] = [];
export interface UseTodoEditorParams {
    todoId?: string;
    initialTitle?: string;
    initialDescription?: string;
    initialScheduleType?: ScheduleType | '';
    initialScheduleTime?: number;
    initialRecurringCycle?: RecurringType;
    initialItems?: any[]; // The selected convertible items
    initialTags?: string[];
    /** Tags that must stay attached to this Todo, such as its owning Workspace tag. */
    requiredTagIds?: string[];
    requiredWorkspaceId?: string;
    organisationId?: string;
}
export function useTodoEditor(props: UseTodoEditorParams) {
    const { todoId, initialTitle, initialDescription, initialScheduleType, initialScheduleTime, initialRecurringCycle, initialItems, initialTags } = props;
    const requiredTagIds = props.requiredTagIds ?? NO_REQUIRED_TAG_IDS;
    const requiredTagIdsRef = useRef(requiredTagIds);
    requiredTagIdsRef.current = requiredTagIds;
    const requiredWorkspaceIdRef = useRef(props.requiredWorkspaceId);
    requiredWorkspaceIdRef.current = props.requiredWorkspaceId;
    const organisationIdRef = useRef(props.organisationId);
    organisationIdRef.current = props.organisationId;
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
    const lastSavedTagsRef = useRef<string[]>(Array.from(new Set([...(initialTags || []), ...requiredTagIds])));
    const lastSavedUpdatedAtRef = useRef<number | null>(null);
    const isDirtyRef = useRef(false);
    const activeTodoIdRef = useRef<string | null>(todoId ?? null);
    const [activeTodoId, setActiveTodoId] = useState<string | null>(todoId ?? null);
    const [todoTitle, setTodoTitle] = useState<string>(initialTitle || '');
    const [todoDescription, setTodoDescription] = useState<string>(initialDescription || '');
    const [scheduleType, setScheduleType] = useState<ScheduleType | ''>(initialScheduleType || 'one-time');
    const [scheduleTime, setScheduleTime] = useState<number>(initialScheduleTime !== undefined ? initialScheduleTime : Date.now());
    const [recurringCycle, setRecurringCycle] = useState<RecurringType | undefined>(initialRecurringCycle);
    const [selectedItems, setSelectedItems] = useState<any[]>(initialItems || []);
    const [tagIds, setTagIds] = useState<string[]>(() => Array.from(new Set([...(initialTags || []), ...requiredTagIds])));
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
            if (todoId === activeTodoIdRef.current && isInitialized)
                return;
            activeTodoIdRef.current = todoId;
            isShortcutManuallyEditedRef.current = false;
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
        setTagIds(Array.from(new Set([...(initialTags || []), ...requiredTagIdsRef.current])));
        setTodoShortcut('');
        lastSavedShortcutRef.current = '';
        lastLoadedCompoundIdRef.current = null;
        lastSavedTitleRef.current = initialTitle || '';
        lastSavedDescriptionRef.current = initialDescription || '';
        lastSavedScheduleTypeRef.current = initialScheduleType || 'one-time';
        lastSavedScheduleTimeRef.current = initialScheduleTime !== undefined ? initialScheduleTime : Date.now();
        lastSavedRecurringCycleRef.current = initialRecurringCycle;
        lastSavedItemsRef.current = initialItems || [];
        lastSavedTagsRef.current = Array.from(new Set([...(initialTags || []), ...requiredTagIdsRef.current]));
        lastSavedUpdatedAtRef.current = null;
        setSaveStatus('idle');
        setIsTodoDeleted(false);
        setIsInitialized(true);
    }, [todoId]);
    useEffect(() => {
        if (requiredTagIds.length === 0)
            return;
        setTagIds(current => {
            const next = Array.from(new Set([...current, ...requiredTagIds]));
            return next.length === current.length ? current : next;
        });
    }, [requiredTagIds]);
    const currentTargetId = activeTodoId === '' ? null : (activeTodoId || todoId);
    // Sync state reactively with Zustand store using active todoId
    const liveTodo = useDbStore(state => state.todos.find(t => currentTargetId ? t.id === currentTargetId : false));
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const versionHistory = liveTodo?.versionHistory;
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
    const scheduleTimeChanged = isInitialized && ((scheduleTime !== undefined && lastSavedScheduleTimeRef.current !== undefined && Math.abs(scheduleTime - lastSavedScheduleTimeRef.current) >= 60000) ||
        (scheduleTime !== undefined && lastSavedScheduleTimeRef.current === undefined));
    // 4. Arrays (Tags): position determines the right-side hierarchy path.
    const safeTags = tagIds || [];
    const safeLastTags = lastSavedTagsRef.current || [];
    const tagsChanged = isInitialized && (safeTags.length !== safeLastTags.length ||
        safeTags.join(',') !== safeLastTags.join(','));
    // 5. Arrays (Attachments): Extract IDs, sort, and join for pure structural comparison
    const safeItems = selectedItems || [];
    const safeLastItems = lastSavedItemsRef.current || [];
    const itemsChanged = isInitialized && todoReferenceIds(safeItems) !== todoReferenceIds(safeLastItems);
    // 6. Shortcuts: Strip spaces/casing
    const targetCompoundId = currentTargetId ? getItemCompoundId({
        id: currentTargetId,
        snippet: { id: currentTargetId, category: 'todo' }
    }) : null;
    const hasLoadedShortcut = !currentTargetId || lastLoadedCompoundIdRef.current === targetCompoundId;
    const shortcutChanged = isInitialized && hasLoadedShortcut && (todoShortcut || '').toLowerCase().replace(/[^a-z0-9_]/g, '') !== (lastSavedShortcutRef.current || '');
    const isDirty = !isTodoDeleted && isInitialized && (titleChanged || descriptionChanged || scheduleTypeChanged || scheduleTimeChanged || recurringCycleChanged || itemsChanged || tagsChanged || shortcutChanged);
    isDirtyRef.current = isViewingHistory ? false : isDirty;
    useEffect(() => {
        if (!currentTargetId) {
            setTodoShortcut('');
            lastSavedShortcutRef.current = '';
            lastLoadedCompoundIdRef.current = null;
            return;
        }
        if (lastLoadedCompoundIdRef.current === targetCompoundId)
            return;
        let cancelled = false;
        const loadSavedShortcut = async () => {
            if (!targetCompoundId)
                return;
            try {
                const shortcutsMap = await readAllShortcuts();
                const savedTodo = await db.todos.get(currentTargetId);
                const sc = normalizeShortcutTrigger(shortcutsMap[targetCompoundId] ?? savedTodo?.shortcut ?? '');
                if (!cancelled && isMounted.current && activeTodoIdRef.current === currentTargetId) {
                    if (!isShortcutManuallyEditedRef.current) {
                        setTodoShortcut(sc);
                    }
                    lastSavedShortcutRef.current = sc;
                    lastLoadedCompoundIdRef.current = targetCompoundId;
                }
            }
            catch (err) {
                console.error('Failed to load todo shortcut:', err);
            }
        };
        void loadSavedShortcut();
        return () => { cancelled = true; };
    }, [currentTargetId, todoId, targetCompoundId]);
    useEffect(() => {
        if (liveTodo === undefined || isTodoDeleted)
            return;
        if (liveTodo === null) {
            if (!isInitialized)
                setIsInitialized(true);
            return;
        }
        if (lastSavedUpdatedAtRef.current !== null && liveTodo.updatedAt <= lastSavedUpdatedAtRef.current) {
            setIsTodoDeleted(false);
            return;
        }
        if (isDirty)
            return;
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
    const handleSave = useCallback(async function saveFn(isAutoSave: boolean = false, overrideProps?: {
        title?: string;
        description?: string;
        scheduleType?: ScheduleType | '';
        scheduleTime?: number;
        recurringCycle?: RecurringType;
        selectedItems?: any[];
        tagIds?: string[];
        shortcut?: string;
        textCommandApproval?: ShortcutAssignmentApproval;
    }): Promise<string | false> {
        if (overrideProps?.textCommandApproval && savePromiseRef.current) {
            await savePromiseRef.current;
            return saveFn(isAutoSave, overrideProps);
        }
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
        const finalTagIds = Array.from(new Set([...(overrideProps?.tagIds !== undefined ? overrideProps.tagIds : tagIds), ...requiredTagIdsRef.current]));
        const loopShortcut = overrideProps?.shortcut !== undefined ? overrideProps.shortcut : todoShortcut;
        // A schedule, tag, or command change alone must not save an incomplete Todo.
        if (!finalTitle.trim() || !finalDesc.trim()) {
            return false;
        }
        // Use default title if none provided
        const computedTitle = finalTitle.trim() ? finalTitle : (finalItems.length ? (finalItems[0].name || finalItems[0].title || finalItems[0].key || 'Untitled Todo') : 'Untitled Todo');
        setSaveStatus('saving');
        setSaveError(null);
        const execute = async (): Promise<string | false> => {
            try {
                let persistedTagIds = finalTagIds;
                if (requiredWorkspaceIdRef.current) {
                    const workspaceTag = await ensureDashboardViewTag(requiredWorkspaceIdRef.current, '');
                    if (!workspaceTag)
                        throw new Error('The Workspace is no longer available. Todo was not saved.');
                    persistedTagIds = Array.from(new Set([...persistedTagIds, workspaceTag.id]));
                }
                let savedRecord: TodoRecord | undefined;
                if (!activeTodoIdRef.current) {
                    // CREATE
                    const created = await createTodo(computedTitle, finalItems, (finalScheduleType || 'one-time') as ScheduleType, finalScheduleTime, finalRecurring, finalDesc, persistedTagIds, undefined, organisationIdRef.current);
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
                }
                else {
                    // UPDATE
                    const mappedReferences = mapTodoReferences(finalItems);
                    const didReschedule = Math.abs((finalScheduleTime || 0) - (lastSavedScheduleTimeRef.current || 0)) >= 60000;
                    const updates: Partial<TodoRecord> = {
                        name: computedTitle,
                        description: finalDesc,
                        scheduleType: (finalScheduleType || 'one-time') as ScheduleType,
                        scheduleTime: finalScheduleTime,
                        recurringType: finalRecurring,
                        references: mappedReferences,
                        tagIds: persistedTagIds,
                        tags: persistedTagIds,
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
                    const finalShortcut = loopShortcut.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    const commandChanged = finalShortcut !== normalizeShortcutTrigger(lastSavedShortcutRef.current || '');
                    if (finalShortcut && (commandChanged || normalizeShortcutTrigger(savedRecord.shortcut || '') !== finalShortcut)) {
                        const valRes = await validateShortcut(finalShortcut, targetId);
                        if (valRes.isValid || overrideProps?.textCommandApproval) {
                            if (commandChanged)
                                await saveShortcutGuarded(targetCompoundId, finalShortcut, 'todo', overrideProps?.textCommandApproval);
                            savedRecord = await updateTodoContent(targetId, { shortcut: finalShortcut });
                            lastSavedShortcutRef.current = finalShortcut;
                        }
                    }
                    else if (lastSavedShortcutRef.current && !finalShortcut) {
                        await clearShortcut(targetId, targetCompoundId, 'todo');
                        savedRecord = await updateTodoContent(targetId, { shortcut: '' });
                        lastSavedShortcutRef.current = '';
                    }
                    if (isMounted.current) {
                        lastSavedUpdatedAtRef.current = savedRecord.updatedAt;
                        setLastSavedAt(new Date(savedRecord.updatedAt));
                    }
                }
                if (isMounted.current && activeTodoIdRef.current !== activeTodoId) {
                    setActiveTodoId(activeTodoIdRef.current);
                }
                return activeTodoIdRef.current || false;
            }
            catch (err: any) {
                console.error('save FAILED:', err);
                if (isMounted.current) {
                    setSaveStatus('error');
                    setSaveError(err.message || 'Unknown save error');
                }
                return false;
            }
            finally {
                savePromiseRef.current = null;
                if (saveAgainRef.current && isMounted.current) {
                    saveAgainRef.current = false;
                    const queuedOverride = queuedSaveOverrideRef.current;
                    const queuedIsAutoSave = queuedSaveIsAutoSaveRef.current ?? isAutoSave;
                    queuedSaveOverrideRef.current = null;
                    queuedSaveIsAutoSaveRef.current = null;
                    void saveFn(queuedIsAutoSave, queuedOverride);
                }
            }
        };
        savePromiseRef.current = execute() as Promise<string | false>;
        return savePromiseRef.current;
    }, [selectedVersionId, validateShortcut]);
    const handleDelete = useCallback(async () => {
        if (!activeTodoIdRef.current)
            return;
        try {
            await deleteTodo(activeTodoIdRef.current);
            setIsTodoDeleted(true);
        }
        catch (err) {
            console.error('Failed to delete todo:', err);
        }
    }, []);
    const bindExternalSavedTodo = useCallback((todo: TodoRecord) => {
        if (!todo?.id || !isMounted.current)
            return;
        activeTodoIdRef.current = todo.id;
        setActiveTodoId(todo.id);
        lastSavedTitleRef.current = todo.name || '';
        lastSavedDescriptionRef.current = todo.description || '';
        lastSavedScheduleTypeRef.current = todo.scheduleType;
        lastSavedScheduleTimeRef.current = todo.scheduleTime;
        lastSavedRecurringCycleRef.current = todo.recurringType;
        lastSavedItemsRef.current = todo.references || [];
        lastSavedTagsRef.current = todo.tagIds || [];
        lastSavedShortcutRef.current = todo.shortcut || '';
        lastSavedUpdatedAtRef.current = todo.updatedAt || Date.now();
        setSaveStatus('saved');
        setSaveError(null);
        setLastSavedAt(new Date(todo.updatedAt || Date.now()));
        setIsTodoDeleted(false);
        setIsInitialized(true);
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
        setTagIds(requiredTagIdsRef.current);
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
        lastSavedTagsRef.current = requiredTagIdsRef.current;
        lastSavedUpdatedAtRef.current = null;
        setSaveStatus('idle');
        setIsTodoDeleted(false);
        setIsInitialized(true);
    }, []);
    const flushSave = useCallback(async () => {
        const refreshDirtyRef = () => {
            const current = currentInputsRef.current;
            const currentTitleChanged = (current.todoTitle || '').trim() !== (lastSavedTitleRef.current || '').trim();
            const currentDescriptionChanged = (current.todoDescription || '').trim() !== (lastSavedDescriptionRef.current || '').trim();
            const currentScheduleTypeChanged = (current.scheduleType || 'one-time') !== (lastSavedScheduleTypeRef.current || 'one-time');
            const currentRecurringChanged = (current.recurringCycle || '') !== (lastSavedRecurringCycleRef.current || '');
            const currentScheduleTimeChanged = (current.scheduleTime !== undefined && lastSavedScheduleTimeRef.current !== undefined && Math.abs(current.scheduleTime - lastSavedScheduleTimeRef.current) >= 60000) ||
                (current.scheduleTime !== undefined && lastSavedScheduleTimeRef.current === undefined);
            const currentItemsChanged = todoReferenceIds(current.selectedItems || []) !== todoReferenceIds(lastSavedItemsRef.current || []);
            const currentTagsChanged = (current.tagIds || []).length !== (lastSavedTagsRef.current || []).length ||
                (current.tagIds || []).join(',') !== (lastSavedTagsRef.current || []).join(',');
            const currentShortcutChanged = (current.todoShortcut || '').toLowerCase().replace(/[^a-z0-9_]/g, '') !== (lastSavedShortcutRef.current || '');
            isDirtyRef.current =
                !isTodoDeleted &&
                    current.isInitialized &&
                    (currentTitleChanged ||
                        currentDescriptionChanged ||
                        currentScheduleTypeChanged ||
                        currentScheduleTimeChanged ||
                        currentRecurringChanged ||
                        currentItemsChanged ||
                        currentTagsChanged ||
                        currentShortcutChanged);
        };
        while (savePromiseRef.current || isDirtyRef.current) {
            if (savePromiseRef.current) {
                await savePromiseRef.current;
                refreshDirtyRef();
            }
            if (isDirtyRef.current) {
                const { todoTitle, todoDescription } = currentInputsRef.current;
                if (!todoTitle.trim() || !todoDescription.trim()) {
                    // Back/navigation may discard an incomplete draft without creating it.
                    return true;
                }
                const saved = await handleSave(false);
                refreshDirtyRef();
                if (!saved)
                    return false;
            }
        }
        return !isDirtyRef.current;
    }, [handleSave, isTodoDeleted]);
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
        handleSave, handleDelete, bindExternalSavedTodo, isInitialized,
        activeTodoId: todoId || activeTodoId,
        resetEditor,
        flushSave,
        liveTodo,
        versionHistory,
        versionHistoryItems,
        selectedVersionId,
        setSelectedVersionId,
        isViewingHistory,
        displayIsDone,
    };
}
