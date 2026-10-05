import TextExpanderIcon from '../icons/TextExpanderIcon';
import * as React from 'react';
import { useSheetEngine } from '../sheetEngine/useSheetEngine';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { FaCheck, FaRegClock, FaStar, FaTrash } from 'react-icons/fa';
import { FiAlertOctagon, FiCalendar, FiCheckCircle, FiCheckSquare, FiCircle, FiClock, FiFileText, FiFolder, FiLink, FiLoader, FiMinusCircle, FiMoreHorizontal, FiPieChart, FiPlayCircle, FiRepeat, FiSearch, FiStar, FiX } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { GridCommandInput, GridHotkeyInput } from '../spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../spreadsheetUi/ui/SpreadsheetTagSelector';
import { SpreadsheetPrioritySelector } from '../spreadsheetUi/ui/SpreadsheetPrioritySelector';
import { EXPLORER_MAIN_CONTENT_STYLE } from '../knowledgeGraph/explorerMainContentStyle';
import { COLLECTION_SHEET_GROUP_ROW_STYLE } from '../collectionSheets/collectionSheetGroupStyle';
import { CollectionSheetBackButton } from '../collectionSheets/CollectionSheetBackButton';
import { COLLECTION_SHEET_TITLE_CLASS, CollectionSheetEditButton } from '../collectionSheets/CollectionSheetTitle';
import { getItemCompoundId } from '../hotkeys/utils/hotkeyUtils';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, CollectionSheetColumnDividers, useCollectionSheetColumnDividerOffsets, } from '../collectionSheets/CollectionSheetColumnDividers';
import { COLLECTION_SHEET_HOVERED_CELL_CLASS, useCollectionSheetHighlight } from '../collectionSheets/useCollectionSheetHighlight';
import { NewDueDateDropdown } from '../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import type { TodoRecord, TodoReference } from '../../allObjectFolder/src/createObject/todos/todoTypes';
type TodoSheetItem = {
    id: string;
    name?: string;
    title?: string;
    key?: string;
    label?: string;
    category?: string;
    data?: any;
};
export type TodoSheetGroupingMode = 'default' | 'priority';
type TodoCollectionSheetViewProps = {
    todos: TodoRecord[];
    items: TodoSheetItem[];
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    tagNamesMap?: Record<string, string>;
    groupingMode?: TodoSheetGroupingMode;
    isExpanded: boolean;
    isFavorite: (id: string) => boolean;
    onOpenTodo?: (todo: TodoRecord) => void;
    onToggleFavorite: (id: string) => void;
    onDeleteTodo: (id: string) => void;
    onUpdateTitle: (id: string, value: string) => void | Promise<void>;
    onUpdateDescription: (id: string, value: string) => void | Promise<void>;
    onUpdateShortcut: (id: string, value: string) => void | Promise<void>;
    onUpdateHotkey: (id: string, value: string) => void | Promise<void>;
    onUpdateSchedule: (id: string, value: {
        scheduleType: 'one-time' | 'recurring';
        recurringType?: 'daily' | 'weekly' | 'monthly';
    }) => void | Promise<void>;
    onUpdateDueDate: (id: string, value: {
        scheduleTime: number;
        isAnytime?: boolean;
    }) => void | Promise<void>;
    onUpdateReferences: (id: string, references: TodoSheetItem[]) => void | Promise<void>;
    onUpdateTags: (id: string, tagIds: string[]) => void | Promise<void>;
    onUpdatePriority: (id: string, value: string) => void | Promise<void>;
    onCompleteTodo: (id: string) => void | Promise<void>;
    showStats?: boolean;
};
const TODO_SHEET_COLUMNS = [
    { id: 'completion', header: '', width: 60 },
    { id: 'title', header: '', width: 210 },
    { id: 'description', header: '', width: 230 },
    { id: 'repeat', header: 'Repeat', width: 75 },
    { id: 'dueDate', header: 'Due date', width: 145 },
    { id: 'priority', header: 'Priority', width: 75 },
    { id: 'command', header: 'Command', width: 90 },
    { id: 'attach', header: 'Attach', width: 60 },
    { id: 'hotkey', header: 'Hotkey', width: 75 },
    { id: 'tags', header: 'Tags', width: 60 },
    { id: 'actions', header: 'Actions', width: 80 }
] as const;
type TodoSheetColumnId = (typeof TODO_SHEET_COLUMNS)[number]['id'];
type TodoSheetColumn = (typeof TODO_SHEET_COLUMNS)[number];
const TODO_SHEET_COLLAPSED_COLUMN_IDS = new Set<TodoSheetColumnId>([
    'completion',
    'title',
    'description',
    'repeat',
    'dueDate',
    'priority',
    'command'
]);
const TODO_SHEET_GROUP_LABEL_COL_SPAN = 3;
const TODO_SHEET_TITLE_COLUMN_INDEX = TODO_SHEET_COLUMNS.findIndex(column => column.id === 'title');
const TODO_SHEET_LAST_COLLAPSED_COLUMN_INDEX = TODO_SHEET_COLUMNS.findIndex(column => column.id === 'command');
type CellPosition = {
    rowIndex: number;
    colIndex: number;
};
type ActionCellTarget = 'favorite' | 'delete';
const isSelectableColumn = (_columnId: TodoSheetColumnId) => true;
const hasRightDivider = (columnId: TodoSheetColumnId) => columnId === 'description' ||
    columnId === 'priority' ||
    columnId === 'command' ||
    columnId === 'attach' ||
    columnId === 'hotkey' ||
    columnId === 'tags';
const isEditableColumn = (columnId: TodoSheetColumnId) => columnId === 'title' ||
    columnId === 'description' ||
    columnId === 'command' ||
    columnId === 'hotkey' ||
    columnId === 'repeat' ||
    columnId === 'dueDate' ||
    columnId === 'attach' ||
    columnId === 'tags' ||
    columnId === 'priority';
type TodoSheetGroup = {
    id: string;
    label: string;
    todos: TodoRecord[];
};
const getTodoGroupIcon = (groupId: string) => {
    if (groupId === 'overdue')
        return <FiPieChart size={13} className="shrink-0 opacity-95 text-[var(--color-error)]"/>;
    if (groupId === 'today')
        return <FiCalendar size={13} className="shrink-0 opacity-95 text-[var(--color-accent)]"/>;
    if (groupId === 'upcoming')
        return <FiClock size={13} className="shrink-0 opacity-95 text-[var(--color-info)]"/>;
    if (groupId === 'completed')
        return <FiCheckCircle size={13} className="shrink-0 opacity-95 text-[var(--color-success)]"/>;
    if (groupId === 'no-date')
        return <FiMinusCircle size={13} className="shrink-0 opacity-95 text-[var(--color-textMuted)]"/>;
    return <FiCheckSquare size={13} className="shrink-0 opacity-95 text-[var(--color-iconDefault)]"/>;
};
const TodoCompletionControl = ({ todo, onCompleteTodo, }: {
    todo: TodoRecord;
    onCompleteTodo: (id: string) => void | Promise<void>;
}) => {
    const isCompleted = Boolean(todo.isDone);
    return (<button type="button" tabIndex={-1} disabled={isCompleted} aria-label={isCompleted ? `${todo.name || 'Todo'} is completed` : `Mark ${todo.name || 'Todo'} as completed`} title={isCompleted ? 'Completed' : 'Mark as completed'} onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
        }} onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            if (!isCompleted)
                void onCompleteTodo(todo.id);
        }} className={clsx('flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded text-[var(--color-textMuted)] transition-colors focus:outline-none', isCompleted
            ? 'cursor-default text-[var(--color-success)]'
            : 'hover:text-[var(--color-success)] focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]')}>
      {isCompleted ? <FiCheckCircle size={13}/> : <FiCircle size={13}/>}
    </button>);
};
const getTodoPriorityGroupIcon = (priority: string) => {
    const normalizedPriority = priority.trim().toLowerCase();
    if (normalizedPriority === 'critical') {
        return <FiAlertOctagon size={13} className="shrink-0 opacity-95 text-[var(--color-error)]"/>;
    }
    if (normalizedPriority === 'urgent') {
        return <FiClock size={13} className="shrink-0 opacity-95 text-[var(--color-warning)]"/>;
    }
    if (normalizedPriority === 'in progress') {
        return <FiPlayCircle size={13} className="shrink-0 opacity-95 text-[var(--color-accent)]"/>;
    }
    if (normalizedPriority === 'done') {
        return <FiCheckCircle size={13} className="shrink-0 opacity-95 text-[var(--color-success)]"/>;
    }
    if (normalizedPriority === 'backlog') {
        return <FiLoader size={13} className="shrink-0 opacity-95 text-[var(--color-textMuted)]"/>;
    }
    return <FiMoreHorizontal size={13} className="shrink-0 opacity-95 text-[var(--color-textSecondary)]"/>;
};
const getStartOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
};
const getEndOfToday = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.getTime();
};
const buildDefaultTodoGroups = (todos: TodoRecord[]): TodoSheetGroup[] => {
    const startOfToday = getStartOfToday();
    const endOfToday = getEndOfToday();
    const groups: TodoSheetGroup[] = [
        { id: 'overdue', label: 'Due', todos: [] },
        { id: 'today', label: 'Today', todos: [] },
        { id: 'upcoming', label: 'Upcoming', todos: [] },
        { id: 'completed', label: 'Completed', todos: [] },
        { id: 'no-date', label: 'No due date', todos: [] }
    ];
    const byId = new Map(groups.map(group => [group.id, group]));
    todos.forEach(todo => {
        if (todo.isDone) {
            byId.get('completed')?.todos.push(todo);
            return;
        }
        const scheduleTime = Number(todo.scheduleTime || 0);
        if (!scheduleTime || !Number.isFinite(scheduleTime)) {
            byId.get('no-date')?.todos.push(todo);
        }
        else if (scheduleTime < startOfToday) {
            byId.get('overdue')?.todos.push(todo);
        }
        else if (scheduleTime <= endOfToday) {
            byId.get('today')?.todos.push(todo);
        }
        else {
            byId.get('upcoming')?.todos.push(todo);
        }
    });
    return groups.filter(group => group.todos.length > 0);
};
const buildPriorityTodoGroups = (todos: TodoRecord[]): TodoSheetGroup[] => {
    const priorityOrder = ['Urgent', 'In Progress', 'Done'];
    const groups = new Map<string, TodoSheetGroup>();
    const getGroup = (priority: string) => {
        const label = priority || 'No priority';
        const id = priority ? `priority-${label.toLowerCase()}` : 'priority-none';
        if (!groups.has(id)) {
            groups.set(id, { id, label, todos: [] });
        }
        return groups.get(id)!;
    };
    todos.forEach(todo => {
        getGroup(String(todo.priority || '').trim()).todos.push(todo);
    });
    return Array.from(groups.values()).sort((a, b) => {
        if (a.id === 'priority-none')
            return 1;
        if (b.id === 'priority-none')
            return -1;
        const aIndex = priorityOrder.indexOf(a.label);
        const bIndex = priorityOrder.indexOf(b.label);
        if (aIndex !== -1 || bIndex !== -1) {
            return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
        }
        return a.label.localeCompare(b.label);
    });
};
const normalizeShortcut = (shortcut: string) => normalizeShortcutTrigger(shortcut || '')
    .replace(/^[ct][_\s-]+/i, '')
    .replace(/[^a-z0-9_]/g, '');
const getTodoCompoundId = (todo: TodoRecord) => getItemCompoundId({
    id: todo.id,
    organisation_id: todo.organisationId,
    snippet: { id: todo.id, category: 'todo' },
});
const getMappedValue = (map: Record<string, string>, todo: TodoRecord) => {
    const compoundId = getTodoCompoundId(todo);
    return map[compoundId] || map[todo.id] || '';
};
const formatDueDate = (scheduleTime: number) => {
    if (!scheduleTime || !Number.isFinite(scheduleTime))
        return '';
    try {
        return format(new Date(scheduleTime), 'h:mm a d MMM');
    }
    catch {
        return '';
    }
};
const getReferenceLabel = (ref: TodoReference | TodoSheetItem) => String((ref as any)?.name || (ref as any)?.title || (ref as any)?.key || (ref as any)?.label || 'Saved item');
const getItemIcon = (item: TodoSheetItem) => {
    const category = String(item.category || item.data?.category || '').toLowerCase();
    if (category === 'snippet')
        return <TextExpanderIcon size={13} className="text-[var(--color-iconDefault)]"/>;
    if (category === 'link')
        return <FiLink size={13} className="text-[var(--color-iconDefault)]"/>;
    if (category === 'workspace' || category === 'tabgroup' || category === 'session') {
        return <FiFolder size={13} className="text-[var(--color-iconDefault)]"/>;
    }
    if (['agent', 'chat_agent', 'aiprompt', 'ai_prompt', 'prompt'].includes(category) || item.data?.type === 'agent') {
        return <LuSparkles size={13} className="text-[var(--color-iconDefault)]"/>;
    }
    return <FiFileText size={13} className="text-[var(--color-iconDefault)]"/>;
};
const BufferedTodoSheetInput = ({ initialValue, startValue, placeholder, multiline = false, onSave, onCancel, onNavigateFromCleanEdit, }: {
    initialValue: string;
    startValue?: string | null;
    placeholder?: string;
    multiline?: boolean;
    onSave: (value: string) => void | Promise<void>;
    onCancel: () => void;
    onNavigateFromCleanEdit: (rowDelta: number, colDelta: number) => void;
}) => {
    const [localValue, setLocalValue] = React.useState(startValue ?? initialValue);
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const skipBlurSaveRef = React.useRef(false);
    const save = React.useCallback(() => {
        if (skipBlurSaveRef.current)
            return;
        void onSave(localValue);
    }, [localValue, onSave]);
    React.useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
        const frameId = window.requestAnimationFrame(() => {
            input.scrollTop = input.scrollHeight;
            input.scrollLeft = input.scrollWidth;
        });
        return () => window.cancelAnimationFrame(frameId);
    }, []);
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && (!multiline || !event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            save();
            skipBlurSaveRef.current = true;
            onNavigateFromCleanEdit(1, 0);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            save();
            skipBlurSaveRef.current = true;
            onNavigateFromCleanEdit(0, event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            skipBlurSaveRef.current = true;
            onCancel();
        }
    };
    if (multiline) {
        return (<textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={localValue} placeholder={placeholder} className="h-full min-h-[34px] w-full resize-none bg-transparent px-0.5 py-1 text-[11px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]" onChange={event => setLocalValue(event.target.value)} onBlur={save} onKeyDown={handleKeyDown}/>);
    }
    return (<input ref={inputRef as React.RefObject<HTMLInputElement>} value={localValue} placeholder={placeholder} className="h-full w-full bg-transparent px-0.5 text-[11px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]" onChange={event => setLocalValue(event.target.value)} onBlur={save} onKeyDown={handleKeyDown}/>);
};
const TodoRepeatCellEditor = ({ cellElement, value, onSave, onCancel, onCommit, onNavigateFromCleanEdit, }: {
    cellElement: HTMLElement | null;
    value: {
        scheduleType: 'one-time' | 'recurring';
        recurringType?: 'daily' | 'weekly' | 'monthly';
    };
    onSave: (value: {
        scheduleType: 'one-time' | 'recurring';
        recurringType?: 'daily' | 'weekly' | 'monthly';
    }) => void;
    onCancel: () => void;
    onCommit?: () => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
}) => {
    const [focusedIndex, setFocusedIndex] = React.useState(() => value.scheduleType === 'one-time'
        ? 0
        : Math.max(1, ['daily', 'weekly', 'monthly'].indexOf(value.recurringType || '') + 1));
    const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
    const [position, setPosition] = React.useState(() => ({ top: 100, left: 12 }));
    const [themeVars, setThemeVars] = React.useState<React.CSSProperties>({});
    const options = [
        { id: 'one-time', label: 'Once', icon: <FaRegClock size={12}/> },
        { id: 'daily', label: 'Daily', icon: <FiRepeat size={12}/> },
        { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12}/> },
        { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12}/> }
    ] as const;
    React.useLayoutEffect(() => {
        if (!cellElement)
            return;
        const rect = cellElement.getBoundingClientRect();
        const menuHeight = 164;
        const menuWidth = 150;
        const placeAbove = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
        setPosition({
            top: placeAbove ? Math.max(8, rect.top - menuHeight - 4) : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 4),
            left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - menuWidth - 8)),
        });
        const computed = window.getComputedStyle(cellElement);
        const style = [
            '--color-popupBg',
            '--color-hoverBg',
            '--color-textPrimary',
            '--color-textSecondary',
            '--color-borderDefault'
        ].reduce<React.CSSProperties>((nextStyle, variableName) => {
            const value = computed.getPropertyValue(variableName).trim();
            if (value)
                (nextStyle as Record<string, string>)[variableName] = value;
            return nextStyle;
        }, {});
        setThemeVars(style);
    }, [cellElement]);
    React.useLayoutEffect(() => {
        optionRefs.current[focusedIndex]?.focus();
        const frame = requestAnimationFrame(() => optionRefs.current[focusedIndex]?.focus());
        return () => cancelAnimationFrame(frame);
    }, [focusedIndex]);
    return createPortal(<div data-ignore-grid-nav="true" data-todo-local-escape="true" tabIndex={-1} className="w-[150px] overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-1 shadow-2xl" style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 100000, ...themeVars }} onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
            else if (event.key === 'Tab') {
                event.preventDefault();
                onCancel();
                onNavigateFromCleanEdit?.(0, event.shiftKey ? -1 : 1);
            }
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                const nextIndex = (focusedIndex + 1) % options.length;
                setFocusedIndex(nextIndex);
                optionRefs.current[nextIndex]?.focus();
            }
            else if (event.key === 'ArrowUp') {
                event.preventDefault();
                const nextIndex = (focusedIndex - 1 + options.length) % options.length;
                setFocusedIndex(nextIndex);
                optionRefs.current[nextIndex]?.focus();
            }
            else if (event.key === 'Enter') {
                event.preventDefault();
                const option = options[focusedIndex];
                onSave(option.id === 'one-time'
                    ? { scheduleType: 'one-time', recurringType: undefined }
                    : { scheduleType: 'recurring', recurringType: option.id });
                onCommit?.();
            }
        }}>
      {options.map((option, index) => {
            const selected = option.id === 'one-time'
                ? value.scheduleType === 'one-time'
                : value.scheduleType === 'recurring' && value.recurringType === option.id;
            return (<button key={option.id} type="button" onMouseEnter={() => setFocusedIndex(index)} tabIndex={index === focusedIndex ? 0 : -1} ref={element => {
                    optionRefs.current[index] = element;
                }} onClick={() => onSave(option.id === 'one-time'
                    ? { scheduleType: 'one-time', recurringType: undefined }
                    : { scheduleType: 'recurring', recurringType: option.id })} className={clsx('flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors', index === focusedIndex || selected
                    ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]', index === focusedIndex && 'ring-1 ring-[var(--color-borderActive)] ring-inset')}>
            {option.icon}
            <span>{option.label}</span>
          </button>);
        })}
    </div>, document.body);
};
const TodoAttachCellEditor = ({ cellElement, items, initialReferences, onSave, onCancel, onNavigateFromCleanEdit, }: {
    cellElement: HTMLElement | null;
    items: TodoSheetItem[];
    initialReferences: TodoReference[];
    onSave: (items: TodoSheetItem[]) => void;
    onCancel: () => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
}) => {
    const [query, setQuery] = React.useState('');
    const [selectedItems, setSelectedItems] = React.useState<TodoSheetItem[]>(() => initialReferences.map(ref => ({ id: ref.id, name: ref.name, category: ref.type })));
    const [selectedCategory, setSelectedCategory] = React.useState<'all' | 'note' | 'snippet' | 'link' | 'workspace' | 'aiPrompt'>('all');
    const [focusedIndex, setFocusedIndex] = React.useState(0);
    const searchInputRef = React.useRef<HTMLInputElement | null>(null);
    const popoverRef = React.useRef<HTMLDivElement | null>(null);
    const position = React.useMemo(() => {
        const rect = cellElement?.getBoundingClientRect();
        const width = Math.min(600, window.innerWidth - 24);
        if (!rect)
            return { top: 100, left: 12, width };
        const left = Math.max(12, Math.min(rect.left - 260, window.innerWidth - width - 12));
        const top = Math.min(rect.bottom + 4, window.innerHeight - 330);
        return { top: Math.max(12, top), left, width };
    }, [cellElement]);
    React.useEffect(() => {
        searchInputRef.current?.focus();
    }, []);
    React.useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target)
                return;
            if (popoverRef.current?.contains(target) || cellElement?.contains(target))
                return;
            onSave(selectedItems);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [cellElement, onSave, selectedItems]);
    const categories = React.useMemo(() => {
        const lowered = query.trim().toLowerCase();
        const next = {
            all: [] as TodoSheetItem[],
            note: [] as TodoSheetItem[],
            snippet: [] as TodoSheetItem[],
            link: [] as TodoSheetItem[],
            organisation: [] as TodoSheetItem[],
            aiPrompt: [] as TodoSheetItem[],
        };
        items.forEach(item => {
            const label = getReferenceLabel(item);
            if (lowered && !label.toLowerCase().includes(lowered))
                return;
            const category = String(item.category || item.data?.category || '').toLowerCase();
            next.all.push(item);
            if (category === 'note')
                next.note.push(item);
            else if (category === 'snippet')
                next.snippet.push(item);
            else if (category === 'link')
                next.link.push(item);
            else if (category === 'workspace' || category === 'tabgroup' || category === 'session')
                next.organisation.push(item);
            else if (['agent', 'chat_agent', 'aiprompt', 'ai_prompt', 'prompt'].includes(category) ||
                item.data?.type === 'agent') {
                next.aiPrompt.push(item);
            }
        });
        return next;
    }, [items, query]);
    const activeItems = categories[selectedCategory];
    const toggleSelection = (item: TodoSheetItem) => {
        setSelectedItems(prev => prev.some(selected => selected.id === item.id)
            ? prev.filter(selected => selected.id !== item.id)
            : [...prev, item]);
    };
    const content = (<div ref={popoverRef} data-ignore-grid-nav="true" data-todo-local-escape="true" style={{
            ...EXPLORER_MAIN_CONTENT_STYLE,
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 99999,
        }} className="overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] text-[var(--color-textPrimary)] shadow-2xl" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
            else if (event.key === 'Tab') {
                event.preventDefault();
                onSave(selectedItems);
                onNavigateFromCleanEdit?.(0, event.shiftKey ? -1 : 1);
            }
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, Math.max(activeItems.length - 1, 0)));
            }
            else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
            }
            else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.target === searchInputRef.current && !query) {
                event.preventDefault();
                const categoryKeys = ['all', 'note', 'snippet', 'link', 'workspace', 'aiPrompt'] as const;
                const nextIndex = Math.max(0, Math.min(categoryKeys.length - 1, categoryKeys.indexOf(selectedCategory) + (event.key === 'ArrowRight' ? 1 : -1)));
                setSelectedCategory(categoryKeys[nextIndex]);
                setFocusedIndex(0);
            }
            else if (event.key === 'Enter' && activeItems[focusedIndex]) {
                event.preventDefault();
                toggleSelection(activeItems[focusedIndex]);
            }
        }}>
      <div className="flex items-center gap-2 border-b border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2">
        <FiSearch size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
        <input ref={searchInputRef} value={query} onChange={event => {
            setQuery(event.target.value);
            setFocusedIndex(0);
        }} placeholder="Search and select saved..." className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]"/>
        <span className="shrink-0 rounded border border-[var(--color-borderDefault)] bg-[var(--color-selectedBg)] px-2 py-1 text-[10px] text-[var(--color-textSecondary)]">
          {selectedItems.length} selected
        </span>
        <button type="button" onClick={() => onSave(selectedItems)} className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" title="Done">
          <FiX size={13}/>
        </button>
      </div>
      <div className="flex h-[250px]">
        <div className="flex w-[150px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] p-1.5">
          {[
            { key: 'all' as const, label: 'All', count: categories.all.length, icon: <FiCheckSquare size={13}/> },
            { key: 'note' as const, label: 'Notes', count: categories.note.length, icon: <FiFileText size={13}/> },
            {
                key: 'snippet' as const,
                label: 'Text Expanders',
                count: categories.snippet.length,
                icon: <TextExpanderIcon size={13}/>,
            },
            { key: 'link' as const, label: 'Links', count: categories.link.length, icon: <FiLink size={13}/> },
            {
                key: 'workspace' as const,
                label: 'Organisations',
                count: categories.organisation.length,
                icon: <FiFolder size={13}/>,
            },
            {
                key: 'aiPrompt' as const,
                label: 'Chat Agents',
                count: categories.aiPrompt.length,
                icon: <LuSparkles size={13}/>,
            }
        ].map(category => (<button key={category.key} type="button" onClick={() => {
                setSelectedCategory(category.key);
                setFocusedIndex(0);
            }} className={clsx('flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors', selectedCategory === category.key
                ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]')}>
              <span className="flex min-w-0 items-center gap-1.5">
                {category.icon}
                <span className="truncate">{category.label}</span>
              </span>
              <span className="shrink-0 tabular-nums opacity-70">{category.count}</span>
            </button>))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {activeItems.length === 0 ? (<div className="flex h-full items-center justify-center text-[12px] text-[var(--color-textMuted)]">
              Nothing here
            </div>) : (activeItems.map((item, index) => {
            const selected = selectedItems.some(selectedItem => selectedItem.id === item.id);
            const focused = index === focusedIndex;
            return (<button key={item.id} type="button" onMouseEnter={() => setFocusedIndex(index)} onClick={() => toggleSelection(item)} className={clsx('flex items-center gap-2 border-b border-[var(--color-borderDefault)] px-3 py-2 text-left text-[12px] transition-colors', selected || focused
                    ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]')}>
                  <span className={clsx('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border', selected
                    ? 'border-[var(--color-borderActive)] bg-[var(--color-selectedBg)]'
                    : 'border-[var(--color-borderDefault)] bg-transparent')}>
                    {selected && <FaCheck size={8}/>}
                  </span>
                  {getItemIcon(item)}
                  <span className="min-w-0 flex-1 truncate">{getReferenceLabel(item)}</span>
                </button>);
        }))}
        </div>
      </div>
    </div>);
    return createPortal(content, document.body);
};
const TodoDueDateCellEditor = ({ cellElement, currentDate, currentTime, onClose, onSelect, onNavigateFromCleanEdit, }: {
    cellElement: HTMLElement | null;
    currentDate: string;
    currentTime: string;
    onClose: () => void;
    onSelect: (selection: {
        date: string;
        time: string | null;
        isAnytime: boolean;
    }) => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
}) => {
    const position = React.useMemo(() => {
        const width = 240;
        const estimatedHeight = 230;
        const rect = cellElement?.getBoundingClientRect();
        if (!rect)
            return { top: 12, left: 12 };
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        const opensAbove = rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
        const top = opensAbove
            ? Math.max(12, rect.top - estimatedHeight - 4)
            : Math.min(rect.bottom + 4, window.innerHeight - 12);
        return { top, left };
    }, [cellElement]);
    return createPortal(<NewDueDateDropdown isOpen currentDate={currentDate} currentTime={currentTime} positionClassName="" rootStyle={{
            ...EXPLORER_MAIN_CONTENT_STYLE,
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 99999,
        }} onClose={onClose} onSelect={onSelect} onNavigateFromCleanEdit={onNavigateFromCleanEdit}/>, document.body);
};
export const TodoCollectionSheetView: React.FC<TodoCollectionSheetViewProps> = ({ todos, items, shortcutsMap, hotkeysMap, tagNamesMap = {}, groupingMode = 'default', isExpanded, isFavorite, onOpenTodo, onToggleFavorite, onDeleteTodo, onUpdateTitle, onUpdateDescription, onUpdateShortcut, onUpdateHotkey, onUpdateSchedule, onUpdateDueDate, onUpdateReferences, onUpdateTags, onUpdatePriority, onCompleteTodo, showStats = true, }) => {
    // Keep the collection's source order stable: editing a record updates its timestamp,
    // but must not move its row.
    const sortedTodos = React.useMemo(() => [...todos], [todos]);
    const groupedTodoSections = React.useMemo(() => (groupingMode === 'priority' ? buildPriorityTodoGroups(sortedTodos) : buildDefaultTodoGroups(sortedTodos)), [groupingMode, sortedTodos]);
    const visibleTodos = React.useMemo(() => groupedTodoSections.flatMap(group => group.todos), [groupedTodoSections]);
    const visibleTodoRowIndexById = React.useMemo(() => {
        const rowIndexById = new Map<string, number>();
        visibleTodos.forEach((todo, index) => rowIndexById.set(todo.id, index));
        return rowIndexById;
    }, [visibleTodos]);
    const todoStats = React.useMemo(() => {
        const total = todos.length;
        const recurring = todos.filter(todo => todo.scheduleType === 'recurring').length;
        const completed = todos.filter(todo => todo.isDone).length;
        const pending = total - completed;
        return [
            { label: 'Total Todo', value: total, helper: 'All' },
            { label: 'Recurring Todo', value: recurring, helper: 'Repeats' },
            { label: 'Completed Todo', value: completed, helper: 'Done' },
            { label: 'Pending Todo', value: pending, helper: 'Open' }
        ];
    }, [todos]);
    const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(null);
    const [editingCell, setEditingCell] = React.useState<CellPosition | null>(null);
    const { isKeyboardHighlight, isHoveredRow, rowPointerProps } = useCollectionSheetHighlight();
    const selectedCellRef = React.useRef<CellPosition | null>(null);
    const selectedTodoIdRef = React.useRef<string | null>(null);
    const editingCellRef = React.useRef<CellPosition | null>(null);
    const [focusedActionCell, setFocusedActionCell] = React.useState<{
        rowIndex: number;
        target: ActionCellTarget;
    } | null>(null);
    const focusedActionCellRef = React.useRef<typeof focusedActionCell>(null);
    const previousGroupingModeRef = React.useRef<TodoSheetGroupingMode>(groupingMode);
    const cellRefs = React.useRef<Record<string, HTMLTableCellElement | null>>({});
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const displayColumns = React.useMemo<readonly TodoSheetColumn[]>(() => {
        return isExpanded
            ? TODO_SHEET_COLUMNS
            : TODO_SHEET_COLUMNS.filter(column => TODO_SHEET_COLLAPSED_COLUMN_IDS.has(column.id));
    }, [isExpanded]);
    const dividerColumnIndexes = React.useMemo(() => displayColumns.reduce<number[]>((indexes, column, index) => hasRightDivider(column.id) && index < displayColumns.length - 1 ? [...indexes, index] : indexes, []), [displayColumns]);
    const dividerOffsets = useCollectionSheetColumnDividerOffsets(tableRef, dividerColumnIndexes);
    const sheetWidth = React.useMemo(() => {
        let total = 0;
        for (const column of displayColumns) {
            total += column.width;
        }
        return total;
    }, [displayColumns]);
    const visibleColumnIndexes = React.useMemo(() => displayColumns
        .filter(column => isSelectableColumn(column.id))
        .map(column => TODO_SHEET_COLUMNS.findIndex(candidate => candidate.id === column.id)), [displayColumns]);
    const focusCell = React.useCallback((rowIndex: number, colIndex: number, shouldAutoOpen = false, actionTarget: ActionCellTarget = 'favorite') => {
        const columnId = TODO_SHEET_COLUMNS[colIndex]?.id;
        if (!columnId || !isSelectableColumn(columnId) || !visibleColumnIndexes.includes(colIndex))
            return;
        const nextCell = { rowIndex, colIndex };
        selectedTodoIdRef.current = visibleTodos[rowIndex]?.id ?? null;
        const shouldAutoEditCell = shouldAutoOpen && isEditableColumn(columnId);
        selectedCellRef.current = nextCell;
        editingCellRef.current = shouldAutoEditCell ? nextCell : null;
        setSelectedCell(nextCell);
        setEditingCell(shouldAutoEditCell ? nextCell : null);
        const nextFocusedActionCell = columnId === 'actions' ? { rowIndex, target: actionTarget } : null;
        focusedActionCellRef.current = nextFocusedActionCell;
        setFocusedActionCell(nextFocusedActionCell);
        if (!shouldAutoEditCell) {
            requestAnimationFrame(() => {
                if (editingCellRef.current)
                    return;
                if (selectedCellRef.current?.rowIndex !== rowIndex || selectedCellRef.current?.colIndex !== colIndex)
                    return;
                cellRefs.current[`${rowIndex}:${colIndex}`]?.focus({ preventScroll: true });
            });
        }
    }, [visibleColumnIndexes, visibleTodos]);
    React.useEffect(() => {
        const currentCell = selectedCellRef.current;
        if (!currentCell)
            return;
        if (visibleTodos.length === 0) {
            selectedTodoIdRef.current = null;
            selectedCellRef.current = null;
            setSelectedCell(null);
            setEditingCell(null);
            return;
        }
        const recordIndex = visibleTodos.findIndex(todo => todo.id === selectedTodoIdRef.current);
        const nextIndex = recordIndex >= 0 ? recordIndex : Math.min(currentCell.rowIndex, visibleTodos.length - 1);
        if (nextIndex !== currentCell.rowIndex || recordIndex < 0) {
            focusCell(nextIndex, currentCell.colIndex, false);
        }
    }, [focusCell, visibleTodos]);
    React.useEffect(() => {
        if (selectedCell || visibleTodos.length === 0)
            return;
        focusCell(0, TODO_SHEET_TITLE_COLUMN_INDEX, false);
    }, [focusCell, selectedCell, visibleTodos.length]);
    React.useEffect(() => {
        if (previousGroupingModeRef.current === groupingMode)
            return;
        previousGroupingModeRef.current = groupingMode;
        if (visibleTodos.length === 0) {
            selectedCellRef.current = null;
            editingCellRef.current = null;
            focusedActionCellRef.current = null;
            setSelectedCell(null);
            setEditingCell(null);
            setFocusedActionCell(null);
            return;
        }
        focusCell(0, TODO_SHEET_TITLE_COLUMN_INDEX, false);
    }, [focusCell, groupingMode, visibleTodos.length]);
    const { moveCell: moveSelectedCell, handleCellKeyDown, initialTypedValue } = useSheetEngine({
        rowCount: visibleTodos.length,
        visibleColumnIndexes,
        selectedCell,
        editingCell,
        onSelect: (cell, edit) => focusCell(cell.rowIndex, cell.colIndex, edit, selectedCellRef.current?.colIndex === cell.colIndex && TODO_SHEET_COLUMNS[cell.colIndex]?.id === 'actions'
            ? focusedActionCellRef.current?.target
            : undefined),
    });
    const previousIsExpandedRef = React.useRef(isExpanded);
    React.useEffect(() => {
        if (previousIsExpandedRef.current === isExpanded)
            return;
        previousIsExpandedRef.current = isExpanded;
        setEditingCell(null);
        editingCellRef.current = null;
        setFocusedActionCell(null);
        focusedActionCellRef.current = null;
        if (!isExpanded) {
            setSelectedCell(selected => selected && selected.colIndex > TODO_SHEET_LAST_COLLAPSED_COLUMN_INDEX
                ? { rowIndex: selected.rowIndex, colIndex: TODO_SHEET_LAST_COLLAPSED_COLUMN_INDEX }
                : selected);
            if (selectedCellRef.current && selectedCellRef.current.colIndex > TODO_SHEET_LAST_COLLAPSED_COLUMN_INDEX) {
                selectedCellRef.current = {
                    rowIndex: selectedCellRef.current.rowIndex,
                    colIndex: TODO_SHEET_LAST_COLLAPSED_COLUMN_INDEX,
                };
            }
        }
    }, [isExpanded]);
    React.useEffect(() => {
        editingCellRef.current = editingCell;
    }, [editingCell]);
    React.useEffect(() => {
        focusedActionCellRef.current = focusedActionCell;
    }, [focusedActionCell]);
    React.useEffect(() => {
        if (!selectedCell || editingCell || editingCellRef.current)
            return;
        cellRefs.current[`${selectedCell.rowIndex}:${selectedCell.colIndex}`]?.focus();
    }, [editingCell, isExpanded, selectedCell]);
    return (<div className="flex h-full min-h-0 w-full flex-col">
    <div data-todo-local-escape={editingCell ? 'true' : undefined} className={clsx('relative mx-auto flex h-auto max-h-[90%] min-h-0 w-full flex-col overflow-visible bg-transparent pt-4 text-[var(--color-textPrimary)] transition-[max-width] duration-300 ease-in-out')} style={{ maxWidth: sheetWidth }}>
      <CollectionSheetBackButton/>
      {showStats && (<div className="w-full shrink-0 px-0 pb-3 pt-1">
          <div className="grid w-fit max-w-full grid-cols-4 overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm">
            {todoStats.map(stat => (<div key={stat.label} className="flex min-w-[132px] flex-col items-center justify-center border-r border-[var(--color-borderDefault)] px-4 py-2 text-center last:border-r-0">
                <div className="w-full truncate text-[9px] font-semibold uppercase leading-none text-[var(--color-textMuted)]">
                  {stat.label}
                </div>
                <div className="mt-1.5 text-center text-[17px] font-semibold leading-none tabular-nums text-[var(--color-textPrimary)]">
                  {stat.value}
                </div>
                <div className="mt-1.5 w-full truncate text-[9px] font-medium uppercase leading-none text-[var(--color-textMuted)]">
                  {stat.helper}
                </div>
              </div>))}
          </div>
        </div>)}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="relative w-full" style={{ width: sheetWidth }}>
          <table ref={tableRef} className="table-fixed border-separate border-spacing-0 bg-transparent" style={{ width: sheetWidth }}>
          <colgroup>
            {displayColumns.map(column => (<col key={column.id} style={{ width: column.width }}/>))}
          </colgroup>
          <tbody>
            {groupedTodoSections.map((group, groupIndex) => (<React.Fragment key={group.id}>
                <tr className="h-8 overflow-hidden rounded-lg" style={COLLECTION_SHEET_GROUP_ROW_STYLE}>
                  <td colSpan={groupIndex === 0 ? TODO_SHEET_GROUP_LABEL_COL_SPAN : displayColumns.length} className="px-2 py-1.5 first:rounded-l-lg last:rounded-r-lg">
                    <div className="flex items-center gap-3 text-[12px] font-semibold text-[var(--color-textPrimary)]">
                      {groupingMode === 'priority'
                ? getTodoPriorityGroupIcon(group.label)
                : getTodoGroupIcon(group.id)}
                      <span className="truncate text-[var(--color-textSecondary)]">{group.label}</span>
                      <span className="text-[11px] font-medium tabular-nums text-[var(--color-textMuted)]">
                        {group.todos.length}
                      </span>
                    </div>
                  </td>
                  {groupIndex === 0 &&
                displayColumns.slice(TODO_SHEET_GROUP_LABEL_COL_SPAN).map(column => (<td key={column.id} className={clsx('px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--color-textSecondary)] first:rounded-l-lg last:rounded-r-lg', column.id === 'actions' && 'text-center')}>
                        {column.header}
                      </td>))}
                </tr>
                {group.todos.map(todo => {
                const index = visibleTodoRowIndexById.get(todo.id);
                if (index === undefined)
                    return null;
                const shortcut = normalizeShortcut(getMappedValue(shortcutsMap, todo) || todo.shortcut || '');
                const hotkey = getMappedValue(hotkeysMap, todo);
                const repeatLabel = todo.dailySeriesId
                    ? 'Daily occurrence'
                    : todo.scheduleType === 'recurring'
                    ? (todo.recurringType || 'daily').charAt(0).toUpperCase() + (todo.recurringType || 'daily').slice(1)
                    : 'Once';
                const tagText = (todo.tagIds || [])
                    .map(tagId => tagNamesMap[tagId])
                    .filter(Boolean)
                    .join(', ');
                const attachCount = todo.references?.length || 0;
                const cellValues: Record<TodoSheetColumnId, string> = {
                    completion: '',
                    title: todo.name || 'Untitled Todo',
                    description: todo.description || '',
                    command: shortcut ? `c_${shortcut}` : '',
                    hotkey,
                    repeat: repeatLabel,
                    dueDate: formatDueDate(todo.scheduleTime),
                    attach: attachCount ? `${attachCount} attached` : '',
                    tags: tagText,
                    priority: todo.priority || '',
                    actions: '',
                };
                const favorite = isFavorite(todo.id);
                return (<tr key={todo.id} data-collection-sheet-row="true" {...rowPointerProps(index)} className="group/row h-9 bg-transparent text-[var(--color-textPrimary)]">
                  {displayColumns.map((column, colIndex) => {
                        const isSelected = isKeyboardHighlight && selectedCell?.rowIndex === index && selectedCell?.colIndex === colIndex;
                        const isHovered = isHoveredRow(index);
                        const isEditing = editingCell?.rowIndex === index && editingCell?.colIndex === colIndex;
                        const focusedActionTarget = isSelected &&
                            column.id === 'actions' &&
                            focusedActionCell?.rowIndex === index
                            ? focusedActionCell.target
                            : null;
                        const cellKey = `${index}:${colIndex}`;
                        if (column.id === 'completion') {
                            return (<td key={column.id} ref={element => {
                                    cellRefs.current[cellKey] = element;
                                }} tabIndex={0} aria-label={todo.isDone ? 'Todo completed' : 'Mark Todo completed'} className={clsx('p-0 align-middle outline-none', COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected && 'ring-1 ring-[var(--color-borderActive)] ring-inset')} onFocus={() => focusCell(index, colIndex, false)} onClick={() => focusCell(index, colIndex, false)} onKeyDown={event => handleCellKeyDown(event, { rowIndex: index, colIndex }, 'toggle', () => {
                                    if (!todo.isDone)
                                        void onCompleteTodo(todo.id);
                                })}>
                          <div className="flex h-full w-full items-center justify-end pr-1">
                            <TodoCompletionControl todo={todo} onCompleteTodo={onCompleteTodo}/>
                          </div>
                        </td>);
                        }
                        if (column.id === 'actions') {
                            return (<td key={column.id} ref={element => {
                                    cellRefs.current[cellKey] = element;
                                }} tabIndex={0} className={clsx('p-0 align-middle outline-none relative transition-all', COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected ? 'z-[50] overflow-visible rounded bg-transparent' : '')} onFocus={() => {
                                    if (!isSelected) {
                                        focusCell(index, colIndex, false);
                                    }
                                }} onClick={() => {
                                    focusCell(index, colIndex, false);
                                }} onKeyDown={event => {
                                    if (event.key === 'ArrowRight') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (focusedActionTarget === 'delete') {
                                            moveSelectedCell(0, 1);
                                        }
                                        else {
                                            const nextFocusedActionCell = { rowIndex: index, target: 'delete' as const };
                                            focusedActionCellRef.current = nextFocusedActionCell;
                                            setFocusedActionCell(nextFocusedActionCell);
                                        }
                                    }
                                    else if (event.key === 'ArrowLeft') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (focusedActionTarget === 'delete') {
                                            const nextFocusedActionCell = { rowIndex: index, target: 'favorite' as const };
                                            focusedActionCellRef.current = nextFocusedActionCell;
                                            setFocusedActionCell(nextFocusedActionCell);
                                        }
                                        else {
                                            moveSelectedCell(0, -1);
                                        }
                                    }
                                    else if (event.key === 'ArrowUp') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        moveSelectedCell(-1, 0);
                                    }
                                    else if (event.key === 'ArrowDown') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        moveSelectedCell(1, 0);
                                    }
                                    else if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (focusedActionTarget === 'delete') {
                                            onDeleteTodo(todo.id);
                                        }
                                        else {
                                            onToggleFavorite(todo.id);
                                        }
                                    }
                                    else if (event.key === 'f' || event.key === 'F') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onToggleFavorite(todo.id);
                                    }
                                    else if (event.key === 'Delete' || event.key === 'Backspace') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onDeleteTodo(todo.id);
                                    }
                                }}>
                          <div className="flex min-h-[28px] w-full items-center justify-center gap-1">
                            <button type="button" tabIndex={-1} onMouseDown={event => {
                                    event.preventDefault();
                                    const nextCell = { rowIndex: index, colIndex };
                                    const nextFocusedActionCell = { rowIndex: index, target: 'favorite' as const };
                                    selectedCellRef.current = nextCell;
                                    editingCellRef.current = null;
                                    focusedActionCellRef.current = nextFocusedActionCell;
                                    setSelectedCell(nextCell);
                                    setEditingCell(null);
                                    setFocusedActionCell(nextFocusedActionCell);
                                }} onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onToggleFavorite(todo.id);
                                }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] transition-colors hover:text-amber-400 focus:outline-none', focusedActionTarget === 'favorite' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-amber-400')} title={favorite ? 'Remove favorite' : 'Add favorite'} aria-label={favorite ? 'Remove favorite' : 'Add favorite'}>
                              {favorite ? (<FaStar className="text-xs text-amber-400"/>) : (<FiStar className="text-xs"/>)}
                            </button>
                            <button type="button" tabIndex={-1} onMouseDown={event => {
                                    event.preventDefault();
                                    const nextCell = { rowIndex: index, colIndex };
                                    const nextFocusedActionCell = { rowIndex: index, target: 'delete' as const };
                                    selectedCellRef.current = nextCell;
                                    editingCellRef.current = null;
                                    focusedActionCellRef.current = nextFocusedActionCell;
                                    setSelectedCell(nextCell);
                                    setEditingCell(null);
                                    setFocusedActionCell(nextFocusedActionCell);
                                }} onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDeleteTodo(todo.id);
                                }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-70 transition-colors hover:text-[var(--color-error)] hover:opacity-100 focus:outline-none', focusedActionTarget === 'delete' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-[var(--color-error)] opacity-100')} title="Delete Todo">
                              <FaTrash size={12}/>
                            </button>
                          </div>
                        </td>);
                        }
                        return (<td key={column.id} ref={element => {
                                cellRefs.current[cellKey] = element;
                            }} tabIndex={0} className={clsx('relative cursor-pointer overflow-hidden align-middle text-[11px] text-[var(--color-textPrimary)] outline-none', COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected
                                ? 'z-[50] overflow-visible rounded bg-transparent py-[2px] ring-1 ring-[var(--color-borderActive)] ring-inset'
                                : 'py-[1.5px]', column.id === 'title' ? 'px-1' : 'px-2')} onFocus={event => {
                                if (event.target !== event.currentTarget)
                                    return;
                                const currentCell = selectedCellRef.current || selectedCell;
                                if (currentCell?.rowIndex === index && currentCell?.colIndex === colIndex)
                                    return;
                                focusCell(index, colIndex, false);
                            }} onClick={() => {
                                if (!isEditing)
                                    focusCell(index, colIndex, !(column.id === 'repeat' && todo.dailySeriesId));
                            }} onKeyDown={event => {
                                handleCellKeyDown(event, { rowIndex: index, colIndex }, column.id === 'title' || column.id === 'description' || column.id === 'command'
                                    ? 'text'
                                    : isEditableColumn(column.id) && !(column.id === 'repeat' && todo.dailySeriesId)
                                        ? 'popup'
                                        : 'readonly');
                            }}>
                        {isEditing && column.id === 'title' ? (<BufferedTodoSheetInput initialValue={todo.name || ''} startValue={initialTypedValue} placeholder="Enter title" onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdateTitle(todo.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'description' ? (<BufferedTodoSheetInput initialValue={todo.description || ''} startValue={initialTypedValue} placeholder="Enter description" multiline onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdateDescription(todo.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'command' ? (<GridCommandInput navigateOnCleanArrow={false} itemId={getTodoCompoundId(todo)} initialValue={shortcut} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                    void onUpdateShortcut(todo.id, normalizeShortcut(value));
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                    void onUpdateShortcut(todo.id, normalizeShortcut(value));
                                    setEditingCell(null);
                                }}/>) : isEditing && column.id === 'hotkey' ? (<GridHotkeyInput navigateOnCleanArrow={false} itemId={getTodoCompoundId(todo)} initialValue={hotkey} requireModifierCombo onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                    void onUpdateHotkey(todo.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                    void onUpdateHotkey(todo.id, value);
                                    setEditingCell(null);
                                }}/>) : isEditing && column.id === 'repeat' && !todo.dailySeriesId ? (<TodoRepeatCellEditor cellElement={cellRefs.current[cellKey]} value={{ scheduleType: todo.scheduleType, recurringType: todo.recurringType }} onNavigateFromCleanEdit={moveSelectedCell} onSave={value => {
                                    void onUpdateSchedule(todo.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'dueDate' ? (<TodoDueDateCellEditor cellElement={cellRefs.current[cellKey]} currentDate={format(new Date(todo.scheduleTime || Date.now()), 'yyyy-MM-dd')} currentTime={format(new Date(todo.scheduleTime || Date.now()), 'HH:mm')} onNavigateFromCleanEdit={moveSelectedCell} onClose={() => setEditingCell(null)} onSelect={({ date, time, isAnytime }) => {
                                    const parsed = new Date(`${date}T${time || '09:00'}:00`).getTime();
                                    void onUpdateDueDate(todo.id, { scheduleTime: parsed, isAnytime });
                                    setEditingCell(null);
                                }}/>) : isEditing && column.id === 'attach' ? (<TodoAttachCellEditor cellElement={cellRefs.current[cellKey]} items={items} initialReferences={todo.references || []} onSave={value => {
                                    void onUpdateReferences(todo.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onNavigateFromCleanEdit={moveSelectedCell}/>) : isEditing && column.id === 'tags' ? (<SpreadsheetTagSelector keepOpenOnEnter cellElement={cellRefs.current[cellKey]} initialTagIds={todo.tagIds || []} organisationId={todo.organisationId} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => setEditingCell(null)} onSave={tagIds => {
                                    void onUpdateTags(todo.id, tagIds);
                                }} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'priority' ? (<SpreadsheetPrioritySelector cellElement={cellRefs.current[cellKey]} initialPriority={todo.priority || ''} onNavigateFromCleanEdit={moveSelectedCell} onSave={value => {
                                    void onUpdatePriority(todo.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)}/>) : column.id === 'title' ? (<div className="flex h-full w-full min-w-0 items-center gap-1">
                            <span className={COLLECTION_SHEET_TITLE_CLASS}>
                              {cellValues.title}
                            </span>
                            {onOpenTodo && (<CollectionSheetEditButton itemLabel={todo.name || 'Todo'} onEdit={() => onOpenTodo(todo)}/>)}
                          </div>) : column.id === 'repeat' ? (<span className={clsx('inline-flex max-w-full items-center truncate rounded-full bg-transparent px-2 py-1 text-[11px] text-[var(--color-textPrimary)] transition-colors', isHovered && 'bg-[var(--color-hoverBg)]')}>
                            {cellValues.repeat}
                          </span>) : (<span className={clsx('block text-[11px] text-[var(--color-textPrimary)]', (column.id === 'description' || column.id === 'tags') && isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate', column.id === 'description' && 'opacity-95', ['dueDate', 'attach', 'tags', 'priority'].includes(column.id) && 'opacity-85')}>
                            {cellValues[column.id]}
                          </span>)}
                      </td>);
                    })}
                </tr>);
            })}
                <tr aria-hidden="true" className="h-9 bg-[var(--color-editorBg)]">
                  <td colSpan={displayColumns.length} className="relative z-20 h-9 bg-[var(--color-editorBg)] p-0"/>
                </tr>
              </React.Fragment>))}
            {sortedTodos.length === 0 && (<tr>
                <td colSpan={displayColumns.length} className="h-32 text-center text-[12px] text-[var(--color-textMuted)]">
                  No Todo found
                </td>
              </tr>)}
          </tbody>
          </table>
          <CollectionSheetColumnDividers offsets={dividerOffsets}/>
        </div>
      </div>
    </div>
    </div>);
};
export default TodoCollectionSheetView;
