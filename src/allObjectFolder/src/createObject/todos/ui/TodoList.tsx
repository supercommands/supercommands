import { useDbStore } from '../../../../../storage/store/useDbStore';
import { createTodo, updateTodo, deleteTodo } from '../todoData';
import { useConvertibleItems } from '../todoHooks';
import { db } from '../../../../../storage/indexDB/dbConfig';
import type { TodoReferenceType } from '../todoTypes';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { nowUtc } from '../../../../../shared-components/utils';
import {
  FaTimes,
  FaSun,
  FaRegCalendarAlt,
  FaRegCheckCircle,
  FaSyncAlt,
  FaBolt,
  FaRegCircle,
  FaRegClock,
  FaCheck,
  FaBell,
  FaTrash,
  FaLink,
  FaBox,
  FaLayerGroup,
  FaRobot,
  FaCloudDownloadAlt,
  FaStore,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaBookmark,
  FaFlag,
  FaCode,
  FaTag,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaQuestionCircle,
  FaSearch,
} from 'react-icons/fa';
import {
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
  FiBell,
  FiClock,
  FiStar,
  FiFileText,
  FiSearch,
  FiPlus,
  FiCalendar,
  FiRepeat,
  FiCheckCircle,
  FiCheck,
  FiCheckSquare,
  FiChevronDown,
  FiChevronRight,
  FiSettings,
  FiX,
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { BsCalendarPlus, BsCheck2Circle, BsCalendarCheck, BsPinAngleFill } from 'react-icons/bs';

import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import AutomationDynamicIcon from '../../../../../shared-components/icons/automationDynamicIcon';
import CmdIcon from '../../../../../shared-components/icons/cmdIcon';
import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useAppearance } from '@extension/ui';
import { isLocalEntityId } from '../../../../../shared-components/utils';
import { resolveEntityById } from '../../../../../shared-components/utils/entityResolver';



import { COMMANDS, AI_GROUP } from '../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { LOCAL_COMMANDS } from '../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import CreateTodoView from './CreateTodoView';
import FullScreenNoteView from '../../../../../shared-components/editorViews/fullScreenNoteView';


import { deleteNote } from '../../notes/noteData';

import { format, endOfDay, isSameDay, formatDistanceToNow, isToday, isBefore, startOfToday, isTomorrow } from 'date-fns';
import useNotification from '../../../../../shared-components/notifications/useNotification';
import TodoCalendar from './TodoCalendar';

import pinTodoGif from '../assests/pin-todo.gif';
import todoDataBlurGif from '../assests/todo-data-blur.gif';
import unpinTodoGif from '../assests/unpin-todo.gif';

type TodoItem = any; // TODO: Full migration to TodoRecord (camelCase) pending plan approval

interface TodoListProps {
  isOpen: boolean;
  onClose: () => void;
  searchbarRef?: React.RefObject<any>;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  isSidebar?: boolean;
  isCreateModalOnly?: boolean;
}

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="flex items-center gap-0.5">
    {keys.map((key, i) => (
      <React.Fragment key={i}>
        <kbd className="min-w-[1.2rem] h-4 flex items-center justify-center px-1 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[9px] font-bold font-mono">
          {key}
        </kbd>
        {i < keys.length - 1 && <span className="text-[9px] opacity-80 font-bold">+</span>}
      </React.Fragment>
    ))}
  </span>
);

const TodoList: React.FC<TodoListProps> = React.memo(({ isOpen, onClose, searchbarRef, isLoggedIn, onRequireLogin, isSidebar, isCreateModalOnly }) => {
  const { theme } = useAppearance();
  const triggerNotification = useNotification();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<
    'today' | 'scheduled' | 'done' | 'one-time' | 'recurring' | 'calendar'
  >('today');
  const todoDisplayMode = useUIStore(s => s.todoDisplayMode);
  const setTodoDisplayMode = useUIStore.getState().setTodoDisplayMode;
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<'pin' | 'data-blur' | 'collapse' | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    active: false,
    overdue: false,
    scheduled_fut: false,
    completed: true,
  });

  const toggleGroupCollapsed = (groupKey: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };
  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [inlineNoteId, setInlineNoteId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [createSearchQuery, setCreateSearchQuery] = useState('');
  const todoCreatePrefill = useUIStore(s => s.todoCreatePrefill);
  const selectedWorkspace = useUIStore(s => s.selectedWorkspaceId)
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const activeTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});


  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isModeDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const button = dropdownRef.current?.parentElement?.querySelector('button');
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        (!button || !button.contains(e.target as Node))
      ) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isModeDropdownOpen]);


  const performPermanentDelete = async (task: TodoItem) => {
    const sid = String(task.snippet_id);
    const chromeAny = (window as any).chrome;
    const targetTodoId = task.todo_id || task.id;

    if (targetTodoId) {
      await db.todos.delete(String(targetTodoId));
    }

    try {
      if (task.todo_id) {
        await deleteTodo(String(task.todo_id));
      } else if (sid && !isLocalEntityId(sid)) {
        await deleteNote(sid);
      }
    } catch (e) {
      console.error('Permanent delete failed:', e);
    }

    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: targetTodoId ? String(targetTodoId) : sid });
    }
  };

  useEffect(() => {
    return () => {
      const sids = Object.keys(activeTimeoutsRef.current);
      sids.forEach(sid => {
        clearTimeout(activeTimeoutsRef.current[sid]);
        const t = tasksRef.current.find(item => String(item.snippet_id) === sid);
        if (t) {
          performPermanentDelete(t);
        }
      });
    };
  }, []);

  const listHeight = useMemo(() => {
    const maxAvailable = windowDimensions.height - 180;
    const desiredHeight = windowDimensions.height * (windowDimensions.width >= 1600 ? 0.60 : 0.50);
    return Math.min(Math.max(desiredHeight, 300), maxAvailable);
  }, [windowDimensions]);

  const rowHeight = useMemo(() => {
    if (windowDimensions.width >= 1600) return 54;
    if (windowDimensions.width >= 1200) return 49;
    return 44;
  }, [windowDimensions]);

  const now = new Date();
  const parseTaskDate = (d: string | undefined) => {
    if (!d) return new Date(0);
    return new Date(String(d).replace(' ', 'T'));
  };



  const normalizeDeadline = (d: string | undefined): string => {
    if (!d) return '';
    return String(d).replace(' ', 'T').split('.')[0];
  };

  const extractActualId = (id: string): string => {
    if (id.length <= 36) return id;
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const match = id.match(uuidRegex);
    return match ? match[0] : id;
  };

  useEffect(() => {
    if (todoCreatePrefill && isOpen) {
      if (todoCreatePrefill.autoSave) {
        handleCreateFromSelection({
          type: todoCreatePrefill.category,
          item: todoCreatePrefill,
          title: todoCreatePrefill.key,
          description: todoCreatePrefill.value,
          scheduleType: todoCreatePrefill.is_recurring ? 'recurring' : 'one-time',
          recurringCycle: todoCreatePrefill.recurring_cycle,
          deadline: todoCreatePrefill.event_deadline,
          isAnytime: todoCreatePrefill.is_anytime || false,
        });
        useUIStore.getState().setTodoCreatePrefill(null);
      } else {
        useUIStore.getState().openEditor({ type: 'todo', id: '' });
      }
    }
  }, [todoCreatePrefill, isOpen]);

  const handleClose = useCallback(() => {
    useUIStore.getState().setTodoCreatePrefill(null);
    onClose();
  }, [onClose]);



  const isDarkMode = document.documentElement.classList.contains('dark');

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const formatDeadline = (deadlineStr: string) => {
    if (!deadlineStr) return '';
    try {
      const date = new Date(deadlineStr.replace(' ', 'T'));
      if (isNaN(date.getTime())) return deadlineStr;

      const now = new Date();
      const diffInMinutes = Math.floor((date.getTime() - now.getTime()) / 60000);

      if (Math.abs(diffInMinutes) < 60) {
        if (diffInMinutes === 0) return 'Just now';
        const unit = Math.abs(diffInMinutes) === 1 ? 'min' : 'mins';
        return diffInMinutes > 0 ? `In ${diffInMinutes} ${unit}` : `${Math.abs(diffInMinutes)} ${unit} ago`;
      }

      if (Math.abs(diffInMinutes) < 24 * 60) {
        return formatDistanceToNow(date, { addSuffix: true });
      }

      return format(date, 'MMM d, h:mm a');
    } catch (e) {
      return deadlineStr;
    }
  };


  const rawTodos = useDbStore(state => state.todos);
  const dexieTodos = useMemo(() => {
    return [...rawTodos].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [rawTodos]);

  const dexieTodosRef = useRef(dexieTodos);
  useEffect(() => {
    dexieTodosRef.current = dexieTodos;
  });

  const tasks = useMemo<TodoItem[]>(() => {
    return dexieTodos.map(dt => ({
      snippet_id: dt.id,
      id: dt.id,
      todo_id: dt.id,
      key: dt.name,
      title: dt.name,
      description: dt.description || '',
      value: dt.description || '',
      category: 'custom',
      is_done: dt.isDone,
      event_deadline: new Date(dt.scheduleTime).toISOString(),
      is_recurring: dt.scheduleType === 'recurring',
      recurring_cycle: dt.recurringType || null,
      is_todo_type: true,
      is_anytime: false,
      created_at: new Date(dt.createdAt).toISOString(),
      updated_at: new Date(dt.updatedAt).toISOString(),
      folder_id: '',
      workspace_id: '',
      references: dt.references,
      config: { id: dt.references.map(r => r.id), title: dt.name },
      shortcut: dt.shortcut || '',
      tags: dt.tags || dt.tagIds || [],
      tagIds: dt.tagIds || dt.tags || [],
    }));
  }, [dexieTodos]);

  const tasksRef = useRef<TodoItem[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);


  const filteredTasks = tasks.filter(task => {
    const deadline = parseTaskDate(task.event_deadline);

    if (activeSection === 'today') {
      if (task.is_done) {
        const completionDate = task.updated_at ? new Date(task.updated_at.replace(' ', 'T')) : deadline;
        return !isNaN(completionDate.getTime()) && isSameDay(completionDate, now);
      }

      // Recurring todos always appear in the today view (they repeat regardless of next date)
      if (task.is_recurring) return true;

      const isFutureDay = !isSameDay(deadline, now) && deadline.getTime() > now.getTime();

      return (
        !isNaN(deadline.getTime()) &&
        !isFutureDay &&
        (isSameDay(deadline, now) ||
          deadline.getTime() < now.getTime() ||
          task.is_anytime ||
          (task.event_deadline && task.event_deadline.substring(0, 4) >= '2035'))
      );
    }
    if (activeSection === 'scheduled') {
      return !task.is_done;
    }
    if (activeSection === 'calendar') {
      return isSameDay(deadline, selectedDate);
    }
    return true;
  });

  const searchFilteredTasks = filteredTasks.filter(task => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const rawTitle = task.key || task.title || '';
    const title = (typeof rawTitle === 'object' ? JSON.stringify(rawTitle) : String(rawTitle)).toLowerCase();
    const cat = (task.category || '').toLowerCase();
    return title.includes(q) || cat.includes(q);
  });

  const activeTasks = searchFilteredTasks
    .filter(t => !t.is_done)
    .sort((a, b) => {
      const parseDate = (d: string) => {
        if (!d) return 0;
        const date = new Date(d.replace(' ', 'T'));
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      return parseDate(a.event_deadline) - parseDate(b.event_deadline);
    });

  const doneTasks = searchFilteredTasks
    .filter(t => t.is_done)
    .sort((a, b) => {
      const parseDate = (d: string) => {
        if (!d) return 0;
        const date = new Date(d.replace(' ', 'T'));
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      return parseDate(b.event_deadline) - parseDate(a.event_deadline);
    });

  const allOrderedTasks = React.useMemo(() => {
    if (activeSection === 'today') {
      const overdueItems = activeTasks.filter(t => {
        const deadlineDate = parseTaskDate(t.event_deadline);
        return deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (t.event_deadline && t.event_deadline.includes(':')));
      });
      const todayActiveItems = activeTasks.filter(t => !overdueItems.includes(t));
      return [...todayActiveItems, ...overdueItems, ...doneTasks];
    }
    return [...activeTasks, ...doneTasks];
  }, [activeTasks, doneTasks, activeSection]);

  const counts: Record<string, number> = useMemo(() => {
    return {
      today: activeTasks.filter(t => {
        const d = parseTaskDate(t.event_deadline);
        return isToday(d) || (d.getTime() < now.getTime() && !t.is_done);
      }).length,
      scheduled: activeTasks.length,
      done: doneTasks.length,
      calendar: 0,
    };
  }, [activeTasks, doneTasks, now]);

  const globalOverdueCount = useMemo(() =>
    tasks.filter(t => !t.is_done && parseTaskDate(t.event_deadline).getTime() < now.getTime()).length,
    [tasks, now]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [activeSection, tasks.length, searchQuery]);

  // fetchTasks removed - mapping happens synchronously via useMemo on dexieTodos

  useEffect(() => {
    if (selectedIndex === -1 || !scrollableRef.current) return;
    const selectedElement = scrollableRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, activeSection]);

  const handleEdit = (task: TodoItem) => {
    const possibleIds = [task.todo_id, (task as any).id, (task as any).snippet_todo_id];
    const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

    const taskWithId = {
      ...task,
      todo_id: numericId || task.todo_id || task.snippet_id
    };
    useUIStore.getState().setTodoCreatePrefill(taskWithId);
  };

  const calculateNextDeadline = (currentDeadline: string, cycle: string | null): string | null => {
    if (!cycle) return null;
    let date = new Date(currentDeadline.replace(' ', 'T'));
    if (isNaN(date.getTime())) return null;

    if (date.getFullYear() >= 2035) {
      date = new Date();
    }

    if (cycle === 'daily') date.setDate(date.getDate() + 1);
    else if (cycle === 'weekly') date.setDate(date.getDate() + 7);
    else if (cycle === 'monthly') date.setMonth(date.getMonth() + 1);
    else return null;

    return date.toISOString();
  };

  const handleToggleDone = async (task: TodoItem) => {
    try {
      const chromeAny = (window as any).chrome;
      const isRecurring = !!(task.is_recurring || (task as any).recurring);
      const isCompleting = !task.is_done;
      const sid = String(task.snippet_id);

      let nextDeadline = task.event_deadline;
      let newDoneStatus = isCompleting;
      let historyTask: TodoItem | null = null;

      if (isCompleting && isRecurring) {
        const calc = calculateNextDeadline(task.event_deadline, task.recurring_cycle);
        if (calc) {
          historyTask = {
            ...task,
            snippet_id: `hist-${Date.now()}`,
            id: `hist-${Date.now()}`,
            is_done: true,
            is_recurring: false,
            event_deadline: task.event_deadline,
            created_at: nowUtc(),
            updated_at: nowUtc(),
          };

          nextDeadline = calc;
          newDoneStatus = false;
        }
      }



      if (sid && !isLocalEntityId(sid)) {
        const todoId = String(task.todo_id || sid);
        await db.todos.update(todoId, {
          isDone: isRecurring ? false : isCompleting,
          scheduleTime: new Date(nextDeadline).getTime(),
          updatedAt: Date.now(),
          recurringType: (task.recurring_cycle as any) || undefined,
          scheduleType: isRecurring ? 'recurring' : 'one-time',
        });
      }

      if (chromeAny?.runtime?.sendMessage) {
        if (isCompleting && !isRecurring) {
          chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: String(task.todo_id || sid) });
        } else if (isRecurring) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(task.todo_id || sid),
            deadline: nextDeadline,
            is_anytime: !!task.is_anytime
          });
        }
      }

      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to toggle todo status:', error);
      triggerNotification('Failed to update task', 'error');
    }
  };

  const handleEditTask = async (task: TodoItem) => {
    const possibleIds = [task.todo_id, (task as any).id, (task as any).snippet_todo_id];
    const numericId = possibleIds.find(id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));

    const taskWithId = {
      ...task,
      todo_id: numericId || task.todo_id || task.snippet_id
    };
    useUIStore.getState().setTodoCreatePrefill(taskWithId);
    useUIStore.getState().openEditor({ type: 'todo', id: String(taskWithId.todo_id || taskWithId.snippet_id || '') });
  };

  const handleDelete = async (task: TodoItem) => {
    try {
      const sid = String(task.snippet_id);
      setDeletingIds(prev => [...prev, sid]);

      if (activeTimeoutsRef.current[sid]) {
        clearTimeout(activeTimeoutsRef.current[sid]);
      }

      activeTimeoutsRef.current[sid] = setTimeout(async () => {
        delete activeTimeoutsRef.current[sid];
        setDeletingIds(prev => prev.filter(id => id !== sid));

        await performPermanentDelete(task);
        window.dispatchEvent(new CustomEvent('todosUpdated'));
      }, 3000);

      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to delete todo:', error);
      triggerNotification('Failed to delete task', 'error');
    }
  };

  const handleUndo = (sid: string) => {
    if (activeTimeoutsRef.current[sid]) {
      clearTimeout(activeTimeoutsRef.current[sid]);
      delete activeTimeoutsRef.current[sid];
    }
    setDeletingIds(prev => prev.filter(id => id !== sid));
    window.dispatchEvent(new CustomEvent('todosUpdated'));
  };

  const handleSnooze = async (task: TodoItem) => {
    try {
      const chromeAny = (window as any).chrome;
      const sid = String(task.snippet_id);



      if (sid && !isLocalEntityId(sid)) {
        await db.todos.update(String(task.todo_id || sid), {
          isDone: true,
          updatedAt: Date.now(),
        });
      }

      triggerNotification(`Snoozed: "${task.key}"`, 'success');

      if (chromeAny?.runtime?.sendMessage) {
        const isRecurring = !!(task.is_recurring || (task as any).recurring);
        if (isRecurring) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(task.todo_id || sid),
            immediate: true,
          });
        } else {
          chromeAny.runtime.sendMessage({ action: 'clear_todo_alarm', todoId: String(task.todo_id || sid) });
        }
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (error) {
      console.error('Failed to snooze task:', error);
      triggerNotification('Failed to snooze task', 'error');
    }
  };

  const extractUrlsFromValue = (value: any): string[] => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.urls) return parsed.urls;
      } catch { }
      if (value.startsWith('http')) return [value];
    }
    return value?.urls || [];
  };

  const startSessionFromTodoReference = async (sessionLike: any) => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.runtime?.sendMessage) return;

    const record = sessionLike?.data || sessionLike?.session || sessionLike?.item || sessionLike;
    if (!record) return;

    const sessionId = record.id || record.session_id || record.snippet_id;
    if (!sessionId) return;

    const sessionName = record.title || record.key || record.name || 'Untitled Tab Session';
    const workspaceId = record.workspaceId || record.workspace_id || null;
    const folderId = record.folderId || record.folder_id || null;

    let initialUrls: string[] = [];
    let initialNames: string[] = [];
    let openSettings = record.sessionOpenSettings || sessionLike?.sessionOpenSettings;

    const extractSessionUrlPayload = (entries: any[] | undefined | null) => {
      if (!Array.isArray(entries)) {
        return { urls: [] as string[], names: [] as string[] };
      }

      const urls: string[] = [];
      const names: string[] = [];

      entries.forEach((entry: any) => {
        const url = typeof entry === 'string' ? entry : entry?.url;
        if (!url) return;
        urls.push(url);
        names.push(typeof entry === 'string' ? '' : entry?.title || entry?.name || '');
      });

      return { urls, names };
    };

    try {
      const resolved = await resolveEntityById(String(sessionId));
      const sessionRecord = resolved?.entity as any;
      if (sessionRecord) {
        openSettings = sessionRecord.sessionOpenSettings || openSettings;
        const resolvedPayload = extractSessionUrlPayload(sessionRecord.urls);
        if (resolvedPayload.urls.length > 0) {
          initialUrls = resolvedPayload.urls;
          initialNames = resolvedPayload.names;
        }
      }
    } catch { }

    if (initialUrls.length === 0) {
      const recordPayload = extractSessionUrlPayload(record.urls);
      initialUrls = recordPayload.urls;
      initialNames = recordPayload.names;

      if (initialUrls.length === 0) {
        try {
          const parsed = typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
          if (Array.isArray(parsed)) {
            initialUrls = parsed.map((l: any) => l.url || l).filter(Boolean);
            initialNames = parsed.map((l: any) => l.name || l.title || '').filter((_: any, idx: number) => !!initialUrls[idx]);
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.urls)) initialUrls = parsed.urls.filter(Boolean);
            if (Array.isArray(parsed.names)) initialNames = parsed.names;
          }
        } catch { }

        if (initialUrls.length === 0) {
          initialUrls = extractUrlsFromValue(record.value);
        }
      }
    }

    const activeTabContext = await new Promise<{ currentTabId: number | null; currentWindowId: number | null; currentPageUrl: string }>((resolve) => {
      if (!chromeAny?.tabs?.query) {
        resolve({
          currentTabId: null,
          currentWindowId: null,
          currentPageUrl: window.location.href,
        });
        return;
      }

      chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        const activeTab = tabs?.[0];
        resolve({
          currentTabId: activeTab?.id ?? null,
          currentWindowId: activeTab?.windowId ?? null,
          currentPageUrl: activeTab?.url || window.location.href,
        });
      });
    });

    await new Promise<void>(resolve => {
      chromeAny.runtime.sendMessage(
        {
          action: 'start_session',
          sessionId,
          sessionName,
          workspaceId,
          folderId: folderId || null,
          teamId: 'local',
          storageMode: 'local',
          initialUrls,
          initialNames,
          openSettings,
          isInlineCreation: true,
          ...activeTabContext,
        },
        () => resolve(),
      );
    });
  };

  const executeTask = async (task: TodoItem, skipToggle = false) => {
    if (task.is_done && !skipToggle) return;

    const { category, value, snippet_id } = task;
    const cat = (category || (task as any).snippet_category || '').toLowerCase();

    // 1. If it's a custom/pure Todo, open the Todo itself as a note so its title & description render.
    const isCustom = cat === 'custom' || task.todo_id || (task.id && String(task.id).startsWith('todo_'));
    if (isCustom) {
      const triggerId = snippet_id || task.id || task.todo_id || (task as any).todoId;
      chrome.tabs.create({
        url: chrome.runtime.getURL(
          `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(triggerId)}`,
        ),
      });
    } else if (['tabgroup', 'tab session', 'session', 'sessions'].includes(cat)) {
      await startSessionFromTodoReference({
        data: {
          id: snippet_id || task.id || task.todo_id || (task as any).todoId,
          title: task.key || task.title || task.name || 'Untitled Tab Session',
          value,
          urls: task.urls,
          sessionOpenSettings: (task as any).sessionOpenSettings,
        },
        sessionOpenSettings: (task as any).sessionOpenSettings,
      });
    } else if (['link', 'collection', 'agent_collection'].includes(cat)) {
      extractUrlsFromValue(value).forEach(url => chrome.tabs.create({ url }));
    } else if (['note', 'snippet', 'prompt'].includes(cat)) {
      setInlineNoteId(snippet_id);
      return;
    } else if (['command', 'automation', 'agent', 'chat_agent'].includes(cat)) {
      const triggerId = value || snippet_id || task.id || task.todo_id || (task as any).todoId;
      chrome.tabs.create({
        url: chrome.runtime.getURL(
          `AltS_search_newtab/index.html?trigger_hotkey=true&type=${cat}&id=${encodeURIComponent(triggerId)}`,
        ),
      });
    }

    // 2. Open any attached references
    const configIds = task.config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      for (const cid of configIds) {
        const cidStr = String(cid);
        // Skip opening the Todo itself again
        if (cidStr === String(task.todo_id) || cidStr === String(task.id) || cidStr === String(snippet_id)) {
          continue;
        }

        const matched = finalConvertibleItems.find(item => {
          const itemIdStr = String(item.id);
          if (itemIdStr === cidStr) return true;
          const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
          const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');
          return strippedItemId === strippedCid;
        });

        if (matched) {
          const itemCat = (matched.category || '').toLowerCase();
          const itemId = matched.id;
          const itemVal = matched.data?.value || matched.data?.url || matched.data?.link || '';

          if (['tabgroup', 'tab session', 'session', 'sessions'].includes(itemCat)) {
            await startSessionFromTodoReference(matched);
          } else if (['link', 'collection', 'agent_collection'].includes(itemCat)) {
            let urls: string[] = [];
            if (Array.isArray(matched.data?.urls)) {
              urls = matched.data.urls.map((u: any) => u.url || u.link || u).filter(Boolean);
            } else {
              urls = extractUrlsFromValue(itemVal);
            }
            urls.forEach(url => chrome.tabs.create({ url }));
          } else if (['note', 'snippet', 'prompt', 'custom'].includes(itemCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else if (['command', 'automation', 'agent', 'chat_agent'].includes(itemCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `AltS_search_newtab/index.html?trigger_hotkey=true&type=${itemCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }
    }

    if (!skipToggle) {
      await handleToggleDone(task);
    }
  };

  const dbConvertibleItems = useConvertibleItems();
  const finalConvertibleItems = React.useMemo(() => [...dbConvertibleItems], [dbConvertibleItems]);

  const getTaskCategoryDisplay = (t: TodoItem) => {
    const configIds = t.config?.id;

    if (Array.isArray(configIds) && configIds.length > 1) {
      return 'Automation';
    }


    if (Array.isArray(configIds) && configIds.length === 1) {
      const cidStr = String(configIds[0]);
      const matched = finalConvertibleItems.find(item => {
        const itemIdStr = String(item.id);
        if (itemIdStr === cidStr) return true;
        return false;
      });

      if (matched) {
        const cat = (matched.category || '').toLowerCase();
        if (cat === 'command') return 'Command';
        if (cat === 'folder') return 'Folder';
        if (['tabgroup', 'Tab Session', 'agent_collection', 'collection'].includes(cat)) return 'Group';
        if (['link'].includes(cat)) return 'Link';
        if (cat === 'prompt') return 'AI Prompt';
        if (cat === 'note') return 'Note';
        if (cat === 'snippet') return 'Snippet';
        if (cat === 'chat_agent' || cat === 'agent') return 'Agent';
        if (cat === 'prompt') return 'AI Prompt';
        return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase().replace(/_/g, ' ');
      }
    }

    const catLower = (t.category || '').toLowerCase();
    if (catLower && !['note', 'snippet', 'custom'].includes(catLower)) {
      if (catLower === 'command') return 'Command';
      if (catLower === 'folder') return 'Folder';
      if (['tabgroup', 'Tab Session', 'agent_collection', 'collection'].includes(catLower)) return 'Group';
      if (['link'].includes(catLower)) return 'Link';
      if (catLower === 'prompt') return 'AI Prompt';
      if (catLower === 'chat_agent' || catLower === 'agent') return 'Agent';
      if (catLower === 'prompt') return 'AI Prompt';
    }

    return 'Task';
  };

  const handleCreateFromSelection = async (data: any) => {
    try {
      setIsLoading(true);
      let deadline = data.deadline || '';

      if (!deadline && data.date) {
        const [year, month, day] = data.date.split('-').map(Number);
        const [hour, minute] = data.time ? data.time.split(':').map(Number) : [23, 59];
        const dt = new Date(year, month - 1, day, hour, minute);
        if (!isNaN(dt.getTime())) {
          deadline = dt.toISOString();
        }
      }

      if (!deadline) {
        deadline = new Date().toISOString();
      }

      const scheduleTime = new Date(deadline).getTime();

      let references: any[] = [];
      if (Array.isArray(data.selectedItems)) {
        references = data.selectedItems.map((item: any) => ({
          type: item.category || 'snippet',
          id: item.id || item.snippet_id
        }));
      }

      console.log('[TodoList] handleCreateFromSelection called with:', { title: data.title, scheduleType: data.scheduleType, date: data.date, time: data.time });
      let newTodo;
      if (todoCreatePrefill?.todo_id) {
        await db.todos.update(String(todoCreatePrefill.todo_id), {
          name: data.title,
          description: data.description ?? '',
          references: references,
          scheduleType: data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
          recurringType: data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
          scheduleTime,
          updatedAt: Date.now()
        });
        newTodo = { id: String(todoCreatePrefill.todo_id) };
        console.log('[TodoList] updateTodo succeeded:', newTodo.id);
      } else {
        newTodo = await createTodo(
          data.title,
          references,
          data.scheduleType === 'recurring' ? 'recurring' : 'one-time',
          scheduleTime,
          data.scheduleType === 'recurring' ? data.recurringCycle : undefined,
          data.description
        );
        console.log('[TodoList] createTodo succeeded:', newTodo?.id);
      }

      try {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_newtodo_alarm',
            todoId: newTodo.id,
            scheduleTime: scheduleTime
          });
        }
      } catch (err) {
        console.error('Failed to schedule new dexie todo alarm', err);
      }

      // Let CreateTodoView handle its own onClose logic for animations and createMore
      if (!data.createMore) {
        if (onClose) onClose();
      }
    } catch (e) {
      console.error('Failed to create dexie todo', e);
    } finally {
      setIsLoading(false);
    }
  };

  const createViewFlatItems = React.useMemo(() => {
    const q = createSearchQuery.toLowerCase();
    return finalConvertibleItems.filter(item => (item.name || item.key || '').toLowerCase().includes(q));
  }, [finalConvertibleItems, activeSection, createSearchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    (window as any).isTodoDashboardOpen = true;
    useUIStore.getState().setHighlightedCommandId(null);
    const activeTag = document.activeElement?.tagName;
    if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      } else {
        containerRef.current?.focus();
      }
    }

    const blockEvents = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (inlineNoteId) {
        return;
      }

      if (isInput) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        } else {
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        let maxIndex = allOrderedTasks.length - 1;

        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, maxIndex));
        return;
      }
      if (e.key === 'ArrowUp') {

        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (isInput) return;
        const pillList = ['today', 'scheduled'] as const;
        const currentPillIndex = pillList.indexOf(activeSection as any);
        const nextIndex = e.key === 'ArrowRight' ? (currentPillIndex + 1) % pillList.length : (currentPillIndex - 1 + pillList.length) % pillList.length;

        setActiveSection(pillList[nextIndex]);
        setSelectedIndex(0);
        return;
      }
      if (e.key === ' ') {
        if (isInput) return;
        e.preventDefault();
        const task = allOrderedTasks[selectedIndex];
        if (task) executeTask(task, task.is_done);
        return;
      }
      if (e.key === 'Enter') {

        e.preventDefault();
        const task = allOrderedTasks[selectedIndex];
        if (task) {
          executeTask(task, task.is_done);
        }
        return;
      }
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', blockEvents, true);
    return () => {
      (window as any).isTodoDashboardOpen = false;
      window.removeEventListener('keydown', blockEvents, true);
    };
  }, [isOpen, activeSection, selectedIndex, allOrderedTasks, collapsedCategories, finalConvertibleItems, inlineNoteId]);
  useEffect(() => {
    if (!isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (inlineNoteId) {
        setInlineNoteId(null);
        return true;
      }
      // If no inline note, don't return true, let TodoWorkspace handle the Escape to close the workspace.
      return false;
    });
    return unregister;
  }, [isOpen, inlineNoteId]);

  const renderTaskRow = (task: TodoItem, globalIndex: number) => {
    const taskId = String(task.snippet_id || task.id);
    if (deletingIds.includes(taskId)) {
      return (
        <div
          key={taskId}
          className="w-full bg-red-500/[0.02] border border-red-500/20 rounded-xl py-2 px-3.5 mb-2 flex items-center justify-between transition-all duration-200"
        >
          <span className="flex items-center gap-2 text-xs text-neutral-300 font-medium select-none">
            <span className="text-emerald-500 text-[14px]">✓</span>
            <span>To-do deleted successfully.</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUndo(taskId);
            }}
            className="text-[#5e6ad2] dark:text-blue-400 hover:text-blue-300 font-semibold cursor-pointer select-none transition-all duration-150 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs border border-white/[0.06] hover:border-white/[0.1]"
          >
            Undo
          </button>
        </div>
      );
    }

    const deadlineDate = parseTaskDate(task.event_deadline);
    const isOverdue = !task.is_done && deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (task.event_deadline && task.event_deadline.includes(':')));
    let category = (task.category || 'snippet').toLowerCase();

    if ((task as any).automation_id && (category === 'snippet' || category === 'note')) {
      const isAgent = (task as any).is_agent || (task as any).type === 'agent' || (task as any).category === 'agent';
      category = isAgent ? 'agent' : 'automation';
    }
    const getTaskTitle = (t: TodoItem) => {
      const raw = t.key || t.title || 'Untitled Task';
      if (typeof raw === 'object' && raw !== null) {
        if ((raw as any).name) return String((raw as any).name);
        if ((raw as any).names) return Array.isArray((raw as any).names) ? (raw as any).names.join(', ') : String((raw as any).names);
        return JSON.stringify(raw);
      }
      return String(raw);
    };

    const taskTitle = getTaskTitle(task);
    const effectivelyIconHost =
      task.iconHost ||
      (task as any).icon_host ||
      (task as any).parent_icon_host ||
      (task.iconHosts && task.iconHosts[0]);

    const renderTypeIcon = (wrap = true) => {
      const iconSize = 18;

      const wrapIcon = (icon: React.ReactNode, extraClasses = '') => {
        return <div className={`flex items-center justify-center shrink-0 ${extraClasses}`}>{icon}</div>;
      };

      const configIds = task.config?.id;
      if (Array.isArray(configIds) && configIds.length > 1) {
        return wrapIcon(<FaLayerGroup size={iconSize - 2} className={wrap ? "text-[#38bdf8]" : ""} />);
      }
      if ((!configIds || configIds.length === 0) && (category === 'note' || category === 'snippet' || category === 'custom')) {
        return null;
      }

      let urls: string[] = [];
      try {
        const val = task.value || '';
        if (typeof val === 'object' && val !== null) {
          if ((val as any).urls) urls = (val as any).urls;
          else if ((val as any).url) urls = [(val as any).url];
        } else if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
          const parsed = JSON.parse(val || '{}');
          urls = parsed.urls || (val.startsWith('http') ? [val] : []);
        } else if (typeof val === 'string' && val.startsWith('http')) {
          urls = [val];
        }
      } catch (e) {
        if (task.value && typeof task.value === 'string' && task.value.startsWith('http')) {
          urls = [task.value];
        }
      }

      const BROWSER_ICONS: Record<string, React.ReactNode> = {
        history: <FaHistory size={14} />,
        downloads: <FaDownload size={14} />,
        settings: <FaCog size={14} />,
        extensions: <FaPuzzlePiece size={14} />,
        bookmarks: <FaBookmark size={14} />,
        flags: <FaFlag size={14} />,
        inspect: <FaCode size={14} />,
        version: <FaTag size={14} />,
        about: <FaInfoCircle size={14} />,
        tasks: <FaMemory size={14} />,
        gpu: <FaMicrochip size={14} />,
        dino: <FaGamepad size={14} />,
        passwords: <FaKey size={14} />,
        help: <FaQuestionCircle size={14} />,
        google: <FaSearch size={14} />,
      };

      switch ((category || '').toLowerCase()) {
        case 'note':
        case 'snippet':
          return wrapIcon(<NotesIcon size={iconSize} />);
        case 'link':
        case 'links':
          if (urls.length > 1) {
            return <StackedLinkIcon urls={urls} size={iconSize} fallback="link" />;
          }
          if (urls.length === 1) {
            return wrapIcon(
              <img src={getFaviconUrl(urls[0])} alt="" className="w-4 h-4 rounded-sm object-contain shadow-sm" />
            );
          }
          return wrapIcon(<FaLink size={iconSize - 2} className={wrap ? "text-blue-400" : ""} />);
        case 'automation':
        case 'agent':
        case 'chat agent':
        case 'chat_agent':
          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }

          const automations = useDbStore.getState().automations || [];
          const targetAutoId = String((task as any).automation_id || task.id || '');
          const enrichedAutomation = automations.find((a: any) => String(a.id) === targetAutoId) || null;

          return wrapIcon(
            <AutomationDynamicIcon
              automation={enrichedAutomation || task}
              size={iconSize}
              className="shrink-0"
            />,
          );
        case 'prompt':
          return wrapIcon(<LuSparkles size={iconSize} className={wrap ? "text-purple-500" : ""} />);
        case 'command':
          const cmdId = typeof task.value === 'string' ? task.value.toLowerCase() : '';

          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }
          if (BROWSER_ICONS[cmdId]) {
            return wrapIcon(BROWSER_ICONS[cmdId], wrap ? 'text-[var(--color-iconDefault)]' : '');
          }

          return wrapIcon(<CmdIcon size={18} height={12} fontSize={8} />);
        case 'tabgroup':
        case 'Tab Session':
        case 'collection':
        case 'agent_collection':
          return <StackedLinkIcon urls={urls} size={iconSize} fallback="tabgroup" />;
        case 'store':
        case 'catalog':
          return wrapIcon(<FaCloudDownloadAlt size={iconSize} className={wrap ? "text-blue-500" : ""} />);
        case 'analysis':
        case 'modification':
          return wrapIcon(<FaSyncAlt size={iconSize - 2} className={wrap ? "text-emerald-400" : ""} />);
        default:
          if (effectivelyIconHost) {
            return wrapIcon(
              <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center">
                <img src={getFaviconUrl(effectivelyIconHost)} alt="" className="w-4 h-4 object-cover" />
              </div>,
            );
          }
          return wrapIcon(<FiFileText size={iconSize} className={wrap ? "text-blue-400" : ""} />);
      }
    };

    const getDueStatus = () => {
      if (task.is_done) return { text: 'Completed', color: 'text-emerald-500 font-semibold' };

      const now = new Date();
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffMins = Math.abs(Math.floor(diffMs / (60 * 1000)));
      const diffHrs = Math.abs(Math.floor(diffMs / (60 * 60 * 1000)));
      const diffDays = Math.abs(Math.floor(diffMs / (24 * 60 * 60 * 1000)));

      if (isOverdue) {
        let text = '';
        if (diffMins < 60) text = `${diffMins}m overdue`;
        else if (diffHrs < 24) text = `${diffHrs}h overdue`;
        else text = `${diffDays}d overdue`;

        return { text, color: 'text-red-500 font-bold' };
      }

      if (diffMins < 60) {
        return {
          text: `${diffMins}m due`,
          color: 'text-amber-500 font-bold',
        };
      }

      if (diffHrs < 24) {
        return {
          text: `${diffHrs}h due`,
          color: 'text-amber-500 font-bold',
        };
      }

      return {
        text: `${diffDays}d due`,
        color: `${isDarkMode ? 'text-white/40' : 'text-slate-500'} font-bold`,
      };
    };

    const dueStatus = getDueStatus();

    const renderDescription = () => {
      let val = (task as any).automation_description || (task as any).automation_name || task.value || '';
      if (!val) return '';


      if (typeof val === 'object' && val !== null) {
        if ((val as any).urls && Array.isArray((val as any).urls)) {
          return (val as any).urls.join(', ');
        }
        if ((val as any).name) return String((val as any).name);
        if ((val as any).names) return Array.isArray((val as any).names) ? (val as any).names.join(', ') : String((val as any).names);
        return JSON.stringify(val);
      }

      if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.urls && Array.isArray(parsed.urls)) {
            return parsed.urls.join(', ');
          }
          if (parsed.name) return parsed.name;
          if (parsed.names) return Array.isArray(parsed.names) ? parsed.names.join(', ') : String(parsed.names);
        } catch (e) { }
      }

      if (typeof val === 'string') {
        return val.replace(/<[^>]*>?/gm, '');
      }
      return String(val);
    };

    return (
      <div
        key={taskId}
        data-index={globalIndex}
        onClick={() => executeTask(task, task.is_done)}
        style={{
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          paddingLeft: '0px',
          paddingRight: '0px',
        }}
        className={`group transition-all duration-200 cursor-pointer flex items-center justify-between w-full py-1.5 mb-1 rounded-lg ${task.is_done ? 'opacity-[0.6]' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            {task.is_done ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleDone(task);
                }}
                title="Completed"
                className="w-[15px] h-[15px] rounded-full bg-emerald-500 border border-emerald-500 text-white flex items-center justify-center shadow-sm cursor-pointer transition-all hover:bg-emerald-600 shrink-0"
              >
                <FaCheck size={8} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleDone(task);
                }}
                title="Mark Done"
                className="w-[15px] h-[15px] rounded-full border border-white/30 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all cursor-pointer shrink-0"
              >
                <FaCheck size={8} className="opacity-0 hover:opacity-50 text-emerald-500 transition-opacity" />
              </button>
            )}
            {!isSidebar && (
              <div className="flex items-center justify-center shrink-0">
                {renderTypeIcon()}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center min-w-0 flex-1">
            {isSidebar ? (
              <>
                <div className="flex items-center gap-1 min-w-0 w-full">
                  <div className="flex items-center justify-center scale-[0.75] opacity-80 shrink-0">
                    {renderTypeIcon(false)}
                  </div>
                  <span
                    className={`font-semibold truncate tracking-wide ${task.is_done ? 'text-white/50' : 'text-[#e4e5eb]'} flex-1 min-w-0`}
                    style={{ fontSize: '14px' }}
                    title={taskTitle}
                  >
                    {taskTitle}
                  </span>
                </div>
                {/* Description removed as requested */}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1 max-w-full">
                  <div className="flex items-center justify-center scale-[0.75] opacity-80 shrink-0">
                    {renderTypeIcon(false)}
                  </div>
                  <span
                    className={`font-medium truncate block tracking-wide ${task.is_done ? 'text-white/50' : 'text-[#e4e5eb]'} flex-1 min-w-0`}
                    style={{ fontSize: '14px' }}
                    title={taskTitle}
                  >
                    {taskTitle}
                  </span>
                </div>
                <div className={`flex items-center gap-1 mt-0.5 ${task.is_done ? 'text-white/30' : (theme.wallpaper ? 'text-[var(--color-textSecondary)]' : 'text-[#8b949e]')}`}>
                  <span className={`text-[11px] font-medium tracking-wide whitespace-nowrap ${Array.isArray(task.config?.id) && task.config.id.length > 1
                    ? 'text-white/40 dark:text-white/30 font-normal'
                    : ''
                    }`}>
                    {getTaskCategoryDisplay(task)}
                  </span>
                  {/* Description removed as requested */}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-right whitespace-nowrap ml-2">
          {isSidebar ? (
            <div className={`grid ${deadlineDate.getTime() !== 0 ? 'grid-cols-[70px_10px_90px]' : 'grid-cols-[170px]'} items-center justify-end text-[11px] font-medium text-[#8b949e]`}>
              <span className="text-right truncate">{getTaskCategoryDisplay(task)}</span>
              {deadlineDate.getTime() !== 0 && (
                <>
                  <span className="text-center opacity-50 shrink-0">•</span>
                  <span className="text-left truncate">
                    {isSameDay(deadlineDate, now)
                      ? deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      : `${isTomorrow(deadlineDate) ? 'Tomorrow' : format(deadlineDate, 'MMM d')}, ${deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                  </span>
                </>
              )}
            </div>
          ) : (
            <span className={`${task.is_done ? 'text-white/40' : 'text-[#8b949e]'} text-[12px] font-medium flex items-center gap-1.5`}>
              <span>
                {isSameDay(deadlineDate, now)
                  ? deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : `${isTomorrow(deadlineDate) ? 'Tomorrow, ' : deadlineDate.getTime() !== 0 ? `${format(deadlineDate, 'MMM d')}, ` : ''}${deadlineDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              </span>
              {task.is_recurring && <span>•</span>}
              {task.is_recurring && <span className="opacity-80">Daily</span>}
            </span>
          )}

          {!task.is_done && (
            <div
              className="flex items-center gap-0.5 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
            >
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleEditTask(task);
                }}
                className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/40 hover:text-white"
                title="Edit Task"
              >
                <FiEdit2 size={13} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(task);
                }}
                className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-white/40 hover:text-red-400"
                title="Delete Task"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCaughtUpState = (title = 'All caught up for today', subtitle = 'Enjoy your focus time.') => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none animate-fadeIn w-full">
      <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
        <div className="absolute top-1 left-2 text-neutral-500/40 text-xs">✦</div>
        <div className="absolute bottom-2 left-0 text-neutral-500/40 text-sm">✦</div>
        <div className="absolute top-2 right-1 text-neutral-500/40 text-sm">✦</div>
        <div className="absolute bottom-1 right-2 text-neutral-500/40 text-xs">✦</div>

        <div className="w-14 h-14 rounded-full border border-neutral-700/30 flex items-center justify-center bg-transparent">
          <div className="w-10 h-10 rounded-full border border-neutral-700/60 flex items-center justify-center bg-transparent">
            <FiCheck className="text-neutral-400 text-lg stroke-[3]" />
          </div>
        </div>
      </div>
      <h4 className="text-[13px] font-semibold text-neutral-300 tracking-wide mb-1">
        {title}
      </h4>
      <p className="text-[11px] text-neutral-500">
        {subtitle}
      </p>
    </div>
  );

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (todoDisplayMode === 'collapse' && isSidebar && !inlineNoteId) {
          onClose();
        }
      }}
      className={`flex max-h-full w-full relative bg-transparent items-start justify-center pt-0 ${isSidebar ? 'px-1 pb-1' : 'px-4 pb-4'}`}
      style={{ fontFamily: "'Inter', sans-serif", height: 'auto' }}>
      <div className={`flex flex-col w-full max-w-5xl bg-transparent ${isCreateModalOnly ? 'hidden' : ''} max-h-full`}>
        <div
          style={isSidebar ? { maxHeight: '100%', height: 'auto' } : { maxHeight: `${listHeight}px`, height: 'auto' }}
          className={`flex flex-col w-full overflow-hidden relative ${isSidebar ? 'bg-transparent border-0' : 'bg-[var(--color-editorBg)] border border-[#2f3142] rounded-xl shadow-2xl'}`}>
          <div className={`flex items-center justify-between px-2 shrink-0 w-full box-border border-b border-white/[0.06] group/header-tabs ${isSidebar ? 'py-2.5' : 'py-4'}`}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setActiveSection('today'); setSelectedIndex(0); }}
                className={`text-[12px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${activeSection === 'today' ? 'text-white font-bold' : 'text-[#8b949e] hover:text-[#e4e5eb]'}`}>
                <FiClock size={12} />
                <span>Today</span>
              </button>
              <button
                onClick={() => { setActiveSection('scheduled'); setSelectedIndex(0); }}
                className={`text-[12px] font-medium tracking-wide transition-all flex items-center gap-1.5 ${activeSection === 'scheduled'
                    ? 'text-white font-bold opacity-100 pointer-events-auto'
                    : 'text-[#8b949e] hover:text-[#e4e5eb] opacity-0 pointer-events-none group-hover/header-tabs:opacity-100 group-hover/header-tabs:pointer-events-auto'
                  } duration-200`}>
                <FiCalendar size={12} />
                <span>Scheduled</span>
              </button>
            </div>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLoggedIn === false && onRequireLogin) {
                    onRequireLogin();
                    return;
                  }
                  useUIStore.getState().setTodoCreatePrefill(null);
                  useUIStore.getState().setSidebar('todoSidebar', { open: false });
                  useUIStore.getState().openEditor({ type: 'todo', id: 'new' });
                }}
                className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-[#e4e5eb] cursor-pointer transition-all"
                title="Add Task"
              >
                <FiPlus size={14} />
              </button>
              {isSidebar && (
                <div className="relative flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModeDropdownOpen(prev => !prev);
                    }}
                    className={`w-7 h-7 flex items-center justify-center rounded-[6px] text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all ${isModeDropdownOpen ? 'bg-white/10 text-white' : ''}`}
                    title="Display Mode"
                  >
                    <BsPinAngleFill size={14} />
                  </button>

                  <AnimatePresence>
                    {isModeDropdownOpen && (
                      <>
                        <motion.div
                          ref={dropdownRef}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-md shadow-xl p-1.5 flex flex-col gap-0.5"
                        >
                          <div className="px-2 py-0.5 text-[8px] font-bold text-neutral-500 uppercase tracking-wider select-none">
                            Display Mode
                          </div>
                          <button
                            onClick={() => {
                              setTodoDisplayMode('pin');
                              setIsModeDropdownOpen(false);
                            }}
                            onMouseEnter={() => setHoveredMode('pin')}
                            onMouseLeave={() => setHoveredMode(null)}
                            className={`flex items-center justify-between px-2 py-1 rounded-lg text-left text-[11px] font-semibold cursor-pointer transition-colors ${todoDisplayMode === 'pin'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'text-neutral-300 hover:bg-white/5'
                              }`}
                          >
                            <span>Pin</span>
                            {todoDisplayMode === 'pin' && <FiCheck size={10} className="stroke-[3]" />}
                          </button>
                          <button
                            onClick={() => {
                              setTodoDisplayMode('data-blur');
                              setIsModeDropdownOpen(false);
                            }}
                            onMouseEnter={() => setHoveredMode('data-blur')}
                            onMouseLeave={() => setHoveredMode(null)}
                            className={`flex items-center justify-between px-2 py-1 rounded-lg text-left text-[11px] font-semibold cursor-pointer transition-colors ${todoDisplayMode === 'data-blur'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'text-neutral-300 hover:bg-white/5'
                              }`}
                          >
                            <span>Pin Summary</span>
                            {todoDisplayMode === 'data-blur' && <FiCheck size={10} className="stroke-[3]" />}
                          </button>
                          <button
                            onClick={() => {
                              setTodoDisplayMode('collapse');
                              setIsModeDropdownOpen(false);
                            }}
                            onMouseEnter={() => setHoveredMode('collapse')}
                            onMouseLeave={() => setHoveredMode(null)}
                            className={`flex items-center justify-between px-2 py-1 rounded-lg text-left text-[11px] font-semibold cursor-pointer transition-colors ${todoDisplayMode === 'collapse'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'text-neutral-300 hover:bg-white/5'
                              }`}
                          >
                            <span>Always close</span>
                            {todoDisplayMode === 'collapse' && <FiCheck size={10} className="stroke-[3]" />}
                          </button>
                        </motion.div>
                        {hoveredMode && createPortal(
                          <div className="fixed right-[216px] top-[calc(14vh+44px)] z-[55] w-[400px] rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <img
                              src={
                                hoveredMode === 'pin' ? pinTodoGif :
                                  hoveredMode === 'data-blur' ? todoDataBlurGif :
                                    unpinTodoGif
                              }
                              alt="Preview"
                              className="w-full block rounded-xl"
                              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                            />
                          </div>,
                          document.body
                        )}
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          <div
            ref={scrollableRef}
            className={`flex-1 w-full custom-scrollbar [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20 transition-all overflow-y-auto`}>
            <div className="pb-4 w-full">
              {isLoading && (
                <div className="absolute top-4 right-4 z-10 animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
              )}

              <div
                className="w-full text-[var(--color-textPrimary)] flex flex-col px-4 pt-4 transition-all duration-200"
              >
                {todoDisplayMode === 'data-blur' ? (
                  <div className="flex flex-col items-center justify-center py-10 w-full h-full text-center">
                    {activeTasks.length === 0 ? (
                      <span className="text-neutral-300 font-semibold text-sm tracking-wide">All done</span>
                    ) : (
                      <span className="text-neutral-300 font-medium text-sm tracking-wide">Pending ({activeTasks.length})</span>
                    )}
                  </div>
                ) : activeSection === 'today' ? (
                  <>
                    {(() => {
                      const overdueItems = activeTasks.filter(t => {
                        const deadlineDate = parseTaskDate(t.event_deadline);
                        return deadlineDate.getTime() < now.getTime() && (!isSameDay(deadlineDate, now) || (t.event_deadline && t.event_deadline.includes(':')));
                      });
                      const todayActiveItems = activeTasks.filter(t => !overdueItems.includes(t));
                      const todayDoneItems = doneTasks.filter(t => t.is_done && isToday(parseTaskDate(t.event_deadline)));

                      const rows: React.ReactNode[] = [];

                      const pushActive = () => {
                        rows.push(
                          <div key="active-header" className="group/header select-none cursor-pointer rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => toggleGroupCollapsed('active')}>
                            <div className="w-full py-2 flex items-center bg-transparent">
                              <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                {collapsedGroups.active ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                <FiClock size={12} className="text-blue-500 shrink-0" />
                                <span>Today</span>
                                <span className="opacity-50">•</span>
                                <span>{todayActiveItems.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                        if (!collapsedGroups.active) {
                          if (todayActiveItems.length > 0) {
                            todayActiveItems.forEach((task, index) => {
                              rows.push(renderTaskRow(task, index));
                            });
                          }
                        }
                      };

                      const pushOverdue = () => {
                        if (overdueItems.length === 0) return;
                        rows.push(
                          <div key="overdue-header" className="group/header select-none cursor-pointer rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => toggleGroupCollapsed('overdue')}>
                            <div className="w-full py-2 flex items-center bg-transparent">
                              <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                {collapsedGroups.overdue ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                <FiClock size={12} className="text-red-500 shrink-0" />
                                <span>Overdue</span>
                                <span className="opacity-50">•</span>
                                <span>{overdueItems.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                        if (!collapsedGroups.overdue) {
                          overdueItems.forEach((task, index) => {
                            rows.push(renderTaskRow(task, todayActiveItems.length + index));
                          });
                        }
                      };

                      const pushCompleted = () => {
                        rows.push(
                          <div key="completed-header" className="group/header select-none cursor-pointer rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2" onClick={() => toggleGroupCollapsed('completed')}>
                            <div className="w-full py-2 flex items-center bg-transparent">
                              <div className="flex items-center gap-1.5 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                                {collapsedGroups.completed ? <FiChevronRight size={12} className="opacity-70" /> : <FiChevronDown size={12} className="opacity-70" />}
                                <FiCheckCircle size={12} className="text-emerald-500 shrink-0" />
                                <span>Completed</span>
                                <span className="opacity-50">•</span>
                                <span>{todayDoneItems.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                        if (!collapsedGroups.completed) {
                          todayDoneItems.forEach((task, index) => {
                            rows.push(renderTaskRow(task, activeTasks.length + index));
                          });
                        }
                      };

                      const shouldShowOverdueFirst = todayActiveItems.length === 0 && overdueItems.length > 0;
                      if (shouldShowOverdueFirst) {
                        pushOverdue();
                        pushActive();
                        pushCompleted();
                      } else {
                        pushActive();
                        pushOverdue();
                        pushCompleted();
                      }

                      return <>{rows}</>;
                    })()}
                  </>
                ) : activeSection === 'calendar' ? (
                  <>
                    <div className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2">
                      <div className="w-full py-2 flex items-center bg-transparent">
                        <div className="flex items-center gap-2 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                          <span>Tasks for {format(selectedDate, 'MMMM d, yyyy')}</span>
                          <span className="opacity-50">•</span>
                          <span>{activeTasks.length}</span>
                        </div>
                      </div>
                    </div>
                    {activeTasks.length === 0 ? (
                      renderCaughtUpState('All caught up', 'No tasks for this day.')
                    ) : (
                      activeTasks.map((task, index) => renderTaskRow(task, index))
                    )}
                  </>
                ) : activeSection === 'scheduled' ? (
                  <>
                    <div className="group/header select-none cursor-pointer hover:bg-white/[0.02] rounded-lg transition-all duration-200 pr-2 pl-0 -mx-2">
                      <div className="w-full py-2 flex items-center bg-transparent">
                        <div className="flex items-center gap-2 font-bold text-[10px] tracking-[0.08em] text-[#8b949e]">
                          <span>Scheduled Tasks</span>
                          <span className="opacity-50">•</span>
                          <span>{activeTasks.length}</span>
                        </div>
                      </div>
                    </div>
                    {activeTasks.length === 0 ? (
                      renderCaughtUpState('No tasks scheduled', 'Create a new task to get started.')
                    ) : (
                      activeTasks.map((task, index) => renderTaskRow(task, index))
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {(!isSidebar) && (
            <div
              className="px-6 py-3 border-t flex items-center justify-end text-[11px] font-medium bg-[var(--color-editorBg)] border-white/[0.06] text-[#8b949e]">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <KeyHint keys={['Enter']} />
                  <span>Run / Mark Done</span>
                </div>
                <div className="flex items-center gap-2">
                  <KeyHint keys={['Esc']} />
                  <span>Back</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>



      {inlineNoteId && createPortal(
        <div className="fixed inset-0 z-[100001] bg-black/60 backdrop-blur-sm">
          <FullScreenNoteView
            noteId={inlineNoteId || undefined}
            onBack={() => {
              setInlineNoteId(null);
              useUIStore.getState().setSidebar('todoSidebar', { open: false });
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
});

TodoList.displayName = 'TodoList';

export default TodoList;
