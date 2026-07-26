import React, { forwardRef, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useAppearance } from '@extension/ui';

import { AnimatePresence, motion, useDragControls, Reorder } from 'framer-motion';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  AI_GROUP,
  type CommandId,
} from '../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { getCommandKeywords } from '../../../../../shared-components/searchBarMain/commandConfigurations/commandKeywords';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
type Folder = any;
type Workspace = any;
type Snippet = any;
import DefaultContainer, {
  type CommandInteractiveItem,
  type DefaultContainerHandle,
  type DefaultContainerProps,
  type InteractiveSection,
  type SnippetInteractiveItem,
  type InteractiveItem,
} from './defaultContainer';
import {
  buildSnippetSuggestion,
  buildSuggestionKey,
  extractUrlsFromSnippet,
  getSnippetPreview,
  resolveSnippetIcon,
} from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type {
  SnippetActionDetail,
  SnippetSuggestion,
} from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type { LocalCommandId } from '../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { findCommandByAnyId } from '../../../../../shared-components/commands';
import type { CommandRecord } from '../../../../../allObjectFolder/src/createObject/commands/commandTypes';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import {
  createFavoriteCategory,
  deleteFavoriteCategory,
  updateFavoriteCategory,
} from '../../../../../allObjectFolder/src/createObject/favoriteCategory';

import { useChromeStorage } from '@extension/shared/lib/hooks';
import {
  FaRegFolder,
  FaFolderOpen,
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
  FaCheck,
  FaRobot,
} from 'react-icons/fa';
import { FiMoreHorizontal, FiLink, FiFileText, FiZap, FiLayers, FiMoreVertical, FiCode, FiEdit2 } from 'react-icons/fi';
import { UnifiedContextMenu } from '../../../../../shared-components/ui/UnifiedContextMenu';
import { HiOutlineStar } from 'react-icons/hi2';
import { LuBot } from 'react-icons/lu';
import { isSameDay } from 'date-fns';
import { BsCalendarCheck } from 'react-icons/bs';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';

interface HomeViewProps {
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections' | null) => void;
  onSnippetSelect: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestLinkEdit?: (suggestion: SnippetSuggestion) => void;
  onHighlightChange?: (item: InteractiveItem | null) => void;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  isCommandLocked?: boolean;
  isPromptMenuOpen?: boolean;
  isAtMenuOpen?: boolean;
  isSuggestionVisible?: boolean;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isLoggedIn: boolean;
  onOpenContextMenu?: (x: number, y: number, fav: any) => void;
}

export type HomeViewHandle = DefaultContainerHandle;

// Match AltS DefaultMainView: include local create-note/create-link commands as well
const COMMAND_SHORTLIST: Array<CommandId | LocalCommandId | 'ai' | 'collections'> = [
  'ai',
  // 'todo',
  'collections',
];
const NOTE_LIMIT = 6;
const LINK_LIMIT = 6;
const FAV_LIMIT = 6;

const SortableFavItem = ({
  id,
  children,
  onClick,
  onContextMenu,
  title,
}: {
  id: string;
  children: React.ReactNode;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  title: string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0 : 1,
    touchAction: 'none',
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={e => e.preventDefault()}
      draggable="false"
      className={`flex flex-col items-center gap-1 group/fav-item outline-none bg-transparent border-none p-0 cursor-pointer w-20 mx-auto transition-all duration-200 ${isDragging ? 'grabbing opacity-0 pointer-events-none' : ''}`}
      title={title}
    >
      {children}
    </button>
  );
};

const SortableHeader = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { setNodeRef } = useSortable({ id, disabled: true });

  return (
    <div ref={setNodeRef} className="col-span-full">
      {children}
    </div>
  );
};

const COMMAND_DESCRIPTIONS: Partial<Record<string, string>> = {
  gpt: 'Jump straight into a new ChatGPT conversation.',
  perplexity: 'Search with Perplexity AI assistant.',
  ai: 'Search across all AI assistants at once.',
  google: 'Search the web with Google.',
  event: 'Create a Google Calendar event quickly.',
  createnotes: 'Capture a reusable snippet right from search.',
  createlinks: 'Group your go-to websites and launch in a click.',
  createsession: 'Save and manage multiple tabs in a Tab Session.',
  agent: 'Open the AI agent interface.',
  todo: 'Manage your personal tasks and reminders.',
  collections: 'Access all your saved collections and snippets.',
} as const;

const useHomeSnippets = () => {
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);

  return useMemo(() => {
    const folderById = new Map(folders.map(folder => [folder.id, folder]));
    const workspaceById = new Map(workspaces.map(workspace => [workspace.id, workspace]));
    const visibleSnippets = selectedFolderId
      ? snippets.filter(snippet => String(snippet.folderId ?? '') === String(selectedFolderId))
      : snippets;

    return visibleSnippets
      .map(snippet => {
        const workspaceRecord = workspaceById.get(snippet.workspaceId);
        if (!workspaceRecord) return null;

        const folderRecord = snippet.folderId ? (folderById.get(snippet.folderId) ?? null) : null;
        const snippetDate = new Date(snippet.updatedAt || snippet.createdAt || Date.now()).toISOString();
        return {
          workspace: {
            workspace_id: workspaceRecord.id,
            workspace_name: workspaceRecord.workspaceName,
            folders: [],
            workspace_snippets: [],
            workspace_automations: [],
          } as Workspace,
          folder: folderRecord
            ? ({
              folder_id: folderRecord.id,
              folder_name: folderRecord.folderName,
              snippets: [],
              automations: [],
              folders: [],
            } as Folder)
            : null,
          snippet: {
            id: snippet.id,
            key: snippet.title,
            value: snippet.config,
            category: 'snippet',
            user_id: '',
            first_name: '',
            last_name: null,
            created_at: snippetDate,
            updated_at: snippetDate,
            tags: null,
            snippet_id: snippet.id,
            workspaceId: snippet.workspaceId,
            folderId: snippet.folderId,
            title: snippet.title,
            config: snippet.config,
            tagIds: snippet.tagIds,
          } as Snippet,
        };
      })
      .filter(Boolean) as Array<{ workspace: Workspace; folder: Folder | null; snippet: Snippet }>;
  }, [selectedFolderId, workspaces, folders, snippets]);
};

import ReactDOM from 'react-dom';

// ─── Settings Popover Helper Components ─────────────────────────────────────

const DragHandleIcon = () => (
  <svg
    width="8"
    height="12"
    viewBox="0 0 8 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="opacity-40 hover:opacity-100 transition-opacity">
    <circle cx="2" cy="2" r="1" fill="currentColor" />
    <circle cx="2" cy="6" r="1" fill="currentColor" />
    <circle cx="2" cy="10" r="1" fill="currentColor" />
    <circle cx="6" cy="2" r="1" fill="currentColor" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="10" r="1" fill="currentColor" />
  </svg>
);

interface SectionHeaderProps {
  id?: string;
  label: string;
  isOn: boolean;
  onToggle: () => void;
  dragControls?: any;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  autoFocusEdit?: boolean;
  onCancelEdit?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  id,
  label,
  isOn,
  onToggle,
  dragControls,
  onRename,
  onDelete,
  autoFocusEdit,
  onCancelEdit,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(autoFocusEdit || false);
  const [editValue, setEditValue] = React.useState(label);
  const [menuCoords, setMenuCoords] = React.useState({ top: 0, left: 0 });
  const dotsRef = React.useRef<HTMLDivElement>(null);

  const handleRenameSubmit = () => {
    if (editValue.trim() && onRename) {
      onRename(editValue.trim());
    } else {
      if (onCancelEdit) {
        onCancelEdit();
      }
    }
    setIsEditing(false);
    setMenuOpen(false);
  };

  const handleDotsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dotsRef.current) {
      const rect = dotsRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.top - 8,
        left: rect.right + 6,
      });
    }
    setMenuOpen(!menuOpen);
  };

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menuOpen]);

  React.useEffect(() => {
    if (autoFocusEdit) {
      setIsEditing(true);
      setEditValue(label);
    }
  }, [autoFocusEdit, label]);

  return (
    <div className="flex items-center justify-between px-2 py-1 mb-1.5 relative group rounded border bg-white/[0.04] border-white/5">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div
          className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 shrink-0"
          onPointerDown={e => {
            if (dragControls) dragControls.start(e);
            else e.stopPropagation();
          }}>
          <DragHandleIcon />
        </div>
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleRenameSubmit();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
                if (onCancelEdit) onCancelEdit();
              }
            }}
            onBlur={handleRenameSubmit}
            className="flex-1 bg-transparent border-b border-[#268bd2] outline-none text-[10px] font-bold tracking-wider uppercase text-neutral-300 px-1 w-full"
          />
        ) : (
          <span className="text-[10px] font-bold tracking-wider uppercase truncate text-neutral-400">{label}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer ${isOn ? 'bg-[#268bd2] border-[#268bd2] text-white' : 'border-neutral-600'}`}
          onClick={e => {
            e.stopPropagation();
            onToggle();
          }}>
          {isOn && <FaCheck size={7} />}
        </div>

        {onRename && (
          <div
            ref={dotsRef}
            className="relative group/dots cursor-pointer text-neutral-500 hover:text-neutral-300"
            onClick={handleDotsClick}>
            <FiMoreVertical size={12} />
            {menuOpen &&
              ReactDOM.createPortal(
                <div
                  data-portal="true"
                  className="fixed w-24 flex flex-col bg-[var(--color-popupBg)] border border-white/10 rounded shadow-lg z-[99999] overflow-hidden"
                  style={{ top: `${menuCoords.top}px`, left: `${menuCoords.left}px` }}>
                  <button
                    className="px-2 py-1.5 text-[10px] text-left hover:bg-white/5 text-neutral-300 w-full outline-none border-none cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      setIsEditing(true);
                      setMenuOpen(false);
                    }}>
                    Rename
                  </button>
                  {onDelete && (
                    <button
                      className="px-2 py-1.5 text-[10px] text-left hover:bg-white/5 text-red-400 w-full outline-none border-none cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        onDelete();
                        setMenuOpen(false);
                      }}>
                      Delete
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </div>
        )}
      </div>
    </div>
  );
};

interface GroupHeaderItemProps {
  id: string;
  title: string;
  isOn: boolean;
  onToggle: () => void;
  onRename: (newName: string) => void;
  onDelete?: () => void;
  autoFocusEdit?: boolean;
  onCancelEdit?: () => void;
  dragControls?: any;
}

const GroupHeaderItem: React.FC<GroupHeaderItemProps> = ({
  id,
  title,
  isOn,
  onToggle,
  onRename,
  onDelete,
  autoFocusEdit,
  onCancelEdit,
  dragControls: _ignoredDragControls,
}) => {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={dragControls}
      className="list-none flex flex-col mt-2 mb-1">
      <SectionHeader
        id={id}
        label={title}
        isOn={isOn}
        onToggle={onToggle}
        dragControls={dragControls}
        onRename={onRename}
        onDelete={onDelete}
        autoFocusEdit={autoFocusEdit}
        onCancelEdit={onCancelEdit}
      />
    </Reorder.Item>
  );
};

interface FavoriteReorderItemProps {
  option: any;
  isIndented?: boolean;
  getFavoriteIcon: (item: any) => React.ReactNode;
}

const FavoriteReorderItem: React.FC<FavoriteReorderItemProps> = ({ option, isIndented = false, getFavoriteIcon }) => {
  const dragControls = useDragControls();
  const paddingClass = isIndented ? 'pl-5' : 'pl-3';
  return (
    <Reorder.Item
      value={option.id}
      id={option.id}
      dragListener={false}
      dragControls={dragControls}
      className={`${paddingClass} list-none`}>
      <div className="flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none hover:bg-white/5 text-neutral-300 hover:text-white">
        <div className="flex items-center gap-1.5 flex-grow min-w-0">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-200 shrink-0"
            onPointerDown={e => dragControls.start(e)}>
            <DragHandleIcon />
          </div>
          {getFavoriteIcon(option.originalItem || option)}
          <span className="font-medium flex-1 py-0.5 truncate">{option.label}</span>
        </div>
      </div>
    </Reorder.Item>
  );
};

const HomeView = React.memo(
  forwardRef<HomeViewHandle, HomeViewProps>(
    (
      {
        onQuickCommandSelect,
        onCommandPreview,
        onSnippetSelect,
        onRequestSnippetDelete,
        onRequestFocusSearch,
        onRequestOpenUrls,
        onRequestLinkEdit,
        onHighlightChange,
        inlineNotification,
        isCommandLocked,
        isAtMenuOpen,
        isSuggestionVisible,
        onNavigateToListView,
        isLoggedIn,
        onOpenContextMenu,
      },
      ref,
    ) => {
      const teamSnippets = useHomeSnippets();
      const { theme, wallpaperId } = useAppearance();
      const isDark = theme.isDark;
      const isCarRace = wallpaperId === 'Car Race.png' || wallpaperId === 'car-race.png';
      const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
      const commandStatus = useUIStore((s: any) => s.commandStatus);
      const selectedFolderRecord = useDbStore(state =>
        selectedFolderId ? (state.folders.find(folder => folder.id === selectedFolderId) ?? null) : null,
      );

      const [todoCounts, setTodoCounts] = useState<{ overdue: number; done: number; total: number }>({
        overdue: 0,
        done: 0,
        total: 0,
      });

      // Helper to parse task dates safely
      const parseTaskDate = (d: string | undefined) => {
        if (!d) return new Date(0);
        return new Date(String(d).replace(' ', 'T'));
      };

      // Unified Todo Synchronization for HomeView (matches SideBar)
      useEffect(() => {
        const chromeAny = (window as any).chrome;

        const updateTodoMetrics = async () => {
          if (!chromeAny?.storage?.local) return;

          try {
            const result = await new Promise<any>(resolve =>
              chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
            );
            const allTasks = [...(result.cached_todos || []), ...(result.local_todos || [])];

            // 1. Deduplicate by ID
            const uniqueTasks = Array.from(new Map(allTasks.map(t => [String(t.id || t.snippet_id), t])).values());
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

            // 2. Calculate Counts & Stats
            const metrics = uniqueTasks.reduce(
              (acc: any, t: any) => {
                const deadline = parseTaskDate(t.event_deadline);
                if (isNaN(deadline.getTime())) return acc;

                const isAnytime = !!(
                  t.is_anytime ||
                  (t.event_deadline && String(t.event_deadline).substring(0, 4) >= '2035')
                );
                const isFutureDay = !isSameDay(deadline, now) && deadline > now;

                const isActiveToday =
                  !t.is_done && !isFutureDay && (isSameDay(deadline, now) || deadline < now || isAnytime);
                const isDoneToday = t.is_done && isSameDay(deadline, now);
                const isPast = deadline < now && !isAnytime;

                if (isActiveToday || isDoneToday) {
                  acc.todayTotal++;
                  if (t.is_done) {
                    acc.todayDone++;
                  } else if (isPast) {
                    acc.overdue++;
                  }
                } else if (!t.is_done && deadline < startOfToday && !isAnytime) {
                  acc.overdue++;
                }
                return acc;
              },
              { overdue: 0, todayTotal: 0, todayDone: 0 },
            );

            setTodoCounts({ overdue: metrics.overdue, done: metrics.todayDone, total: metrics.todayTotal });
          } catch (e) {
            console.error('[HomeView] Failed to update todo metrics:', e);
          }
        };

        updateTodoMetrics();
        window.addEventListener('todosUpdated', updateTodoMetrics);

        const handleStorageChange = (changes: any, area: string) => {
          if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
            updateTodoMetrics();
          }
        };
        chromeAny.storage.onChanged.addListener(handleStorageChange);

        return () => {
          window.removeEventListener('todosUpdated', updateTodoMetrics);
          chromeAny.storage.onChanged.removeListener(handleStorageChange);
        };
      }, []);

      const { favorites, toggleFavorite, populatedFavorites, setFavoriteCategory } = useFavorites();
      const userId = useUser();
      const favoriteCategories = useDbStore(state => state.favoriteCategories);

      // --- Favorites grid card and popover state ---
      const [favGridOrder, setFavGridOrder] = useState<string[]>([]);
      const [activeDragId, setActiveDragId] = useState<string | null>(null);

      const sensors = useSensors(
        useSensor(PointerSensor, {
          activationConstraint: {
            distance: 8,
          },
        })
      );

      const handleDragStart = (event: any) => {
        setActiveDragId(String(event.active.id));
      };

      const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        if (activeId === overId) return;

        const oldIndex = favGridOrder.indexOf(activeId);
        const newIndex = favGridOrder.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = [...favGridOrder];
          newOrder.splice(oldIndex, 1);
          const adjustedNewIndex = newOrder.indexOf(overId);

          if (overId.startsWith('header-') && oldIndex < newIndex) {
            newOrder.splice(adjustedNewIndex + 1, 0, activeId);
          } else {
            newOrder.splice(adjustedNewIndex, 0, activeId);
          }

          setFavGridOrder(newOrder); // Update React layout in real-time
        }
      };

      const persistCategoryChanges = (order: string[]) => {
        let currentCategoryId: string | null = null;
        order.forEach((id) => {
          if (id.startsWith('header-')) {
            currentCategoryId = id.replace('header-', '');
          } else {
            const fav = favByCompoundId[id];
            const existingCat = fav?.favoriteCategoryId || null;
            if (fav && existingCat !== currentCategoryId) {
              const refId = fav.reference_id || fav.id || fav.snippet_id;
              if (refId && setFavoriteCategory) {
                setFavoriteCategory(refId, currentCategoryId);
                fav.favoriteCategoryId = currentCategoryId;
              }
            }
          }
        });
      };

      const handleDragEnd = (event: any) => {
        setActiveDragId(null);
        // Persist final order to storage
        setFavStorage({ favorites_items_order: favGridOrder });
        persistCategoryChanges(favGridOrder);
      };
      const [favGridVisible, setFavGridVisible] = useState<Record<string, boolean>>({});
      const [favCustomGroupNames, setFavCustomGroupNames] = useState<Record<string, string>>({});

      const [isSettingsOpen, setIsSettingsOpen] = useState(false);
      const [settingsCoords, setSettingsCoords] = useState({ top: 0, left: 0 });
      const [newlyCreatedFavGroupId, setNewlyCreatedFavGroupId] = useState<string | null>(null);
      const settingsButtonRef = useRef<HTMLButtonElement>(null);
      const popoverRef = useRef<HTMLDivElement>(null);
      const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

      useEffect(() => {
        const orderedCategories = favoriteCategories
          .slice()
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        const nextOrder: string[] = [];
        orderedCategories.forEach(category => {
          nextOrder.push(`header-${category.id}`);
          populatedFavorites.forEach(fav => {
            if ((fav as any).favoriteCategoryId === category.id) {
              nextOrder.push(fav.compoundId);
            }
          });
        });

        populatedFavorites.forEach(fav => {
          if (!(fav as any).favoriteCategoryId) {
            nextOrder.push(fav.compoundId);
          }
        });

        setFavGridOrder(nextOrder);
        setHasLoadedStorage(true);
      }, [favoriteCategories, populatedFavorites]);

      // Close popover when clicked outside
      useEffect(() => {
        if (!isSettingsOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-portal="true"]')) return;
          if (popoverRef.current?.contains(target)) return;
          if (settingsButtonRef.current?.contains(target)) return;
          setIsSettingsOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
      }, [isSettingsOpen]);

      // Build a lookup map from compoundId → populated favorite item
      const favByCompoundId = useMemo(() => {
        const map: Record<string, any> = {};
        populatedFavorites.forEach(f => {
          if (f.compoundId) map[f.compoundId] = f;
        });
        return map;
      }, [populatedFavorites]);

      // Helper to save to chrome.storage
      const setFavStorage = (updatedData: Record<string, any>) => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set(updatedData);
        }
      };

      const reorderFavoritesItems = (newOrder: string[]) => {
        setFavGridOrder(newOrder);
        setFavStorage({ favorites_items_order: newOrder });
        persistCategoryChanges(newOrder);
      };

      const toggleGroup = (headerId: string) => {
        const headerIndex = favGridOrder.indexOf(headerId);
        if (headerIndex === -1) return;

        const itemsInGroup: string[] = [];
        for (let i = headerIndex + 1; i < favGridOrder.length; i++) {
          if (favGridOrder[i].startsWith('header-')) break;
          itemsInGroup.push(favGridOrder[i]);
        }

        if (itemsInGroup.length === 0) return;

        const isAnyChecked = itemsInGroup.some(id => favGridVisible[id] !== false);
        const newVisible = { ...favGridVisible };
        itemsInGroup.forEach(id => {
          newVisible[id] = !isAnyChecked;
        });

        setFavGridVisible(newVisible);
        setFavStorage({ favorites_visible_items: newVisible });
      };

      const handleDeleteFavGroup = (headerId: string) => {
        const groupId = headerId.replace('header-', '');
        const headerIndex = favGridOrder.indexOf(headerId);
        if (headerIndex === -1) return;

        // Identify all items belonging to this group
        const itemsInGroup: string[] = [];
        for (let i = headerIndex + 1; i < favGridOrder.length; i++) {
          if (favGridOrder[i].startsWith('header-')) break;
          itemsInGroup.push(favGridOrder[i]);
        }

        const remainingOrder = favGridOrder.filter(id => id !== headerId);
        const orderWithoutGroupItems = remainingOrder.filter(id => !itemsInGroup.includes(id));
        const newOrder = [...itemsInGroup, ...orderWithoutGroupItems];

        setFavGridOrder(newOrder);

        const newVisible = { ...favGridVisible };
        delete newVisible[headerId];
        setFavGridVisible(newVisible);

        const newNames = { ...favCustomGroupNames };
        delete newNames[groupId];
        setFavCustomGroupNames(newNames);

        if (newlyCreatedFavGroupId === headerId) {
          setNewlyCreatedFavGroupId(null);
        }

        setFavStorage({
          favorites_items_order: newOrder,
          favorites_visible_items: newVisible,
          favorites_custom_group_names: newNames,
        });
      };

      // Construct ordered list of favorites (including custom headers) for settings popover
      const favoritesOptions = useMemo(() => {
        const map: Record<string, { id: string; label: string; type?: string; originalItem?: any }> = {};

        populatedFavorites.forEach(f => {
          map[f.compoundId] = {
            id: f.compoundId,
            label: f.title || f.label || f.key || f.name || 'Untitled',
            type: f.type,
            originalItem: f,
          };
        });

        const order = [...favGridOrder];
        // Append missing populated favorites to the order array dynamically
        populatedFavorites.forEach(f => {
          if (f.compoundId && !order.includes(f.compoundId)) {
            order.push(f.compoundId);
          }
        });

        order.forEach(id => {
          if (id.startsWith('header-') && !map[id]) {
            const groupId = id.replace('header-', '');
            const categoryName = favoriteCategories.find(category => category.id === groupId)?.name;
            map[id] = {
              id,
              label: categoryName || groupId,
            };
          }
        });

        return order.map(id => map[id]).filter(Boolean);
      }, [favGridOrder, populatedFavorites, favoriteCategories]);

      // Grouped list of favorites for rendering in Home View
      const groupedFavs = useMemo(() => {
        const groupsList: Array<{ id: string; title: string | null; items: any[] }> = [];
        let currentGroup: { id: string; title: string | null; items: any[] } = {
          id: 'root',
          title: null,
          items: [],
        };

        const processedItemIds = new Set<string>();

        favGridOrder.forEach(id => {
          if (id.startsWith('header-')) {
            if (currentGroup.items.length > 0 || (activeDragId !== null && currentGroup.id.startsWith('header-'))) {
              groupsList.push(currentGroup);
            }
            const groupId = id.replace('header-', '');
            const groupTitle = favoriteCategories.find(category => category.id === groupId)?.name || groupId;
            const isGroupVisible = favGridVisible[id] !== false;

            currentGroup = {
              id: id,
              title: (isGroupVisible || activeDragId !== null) ? groupTitle : null,
              items: [],
            };
          } else {
            const isRootGroup = currentGroup.id === 'root';
            const isVisible = isRootGroup ? true : (favGridVisible[id] !== false || activeDragId !== null);
            // Only add if group is visible (title is not null) or it's root group
            if (isVisible) {
              const fav = favByCompoundId[id];
              if (fav) {
                // If group is hidden (title is null), don't show the item
                if (currentGroup.id === 'root' || currentGroup.title !== null) {
                  currentGroup.items.push(fav);
                }
                processedItemIds.add(id);
              }
            }
          }
        });

        if (currentGroup.items.length > 0 || (activeDragId !== null && currentGroup.id.startsWith('header-'))) {
          groupsList.push(currentGroup);
        }

        // Add remaining items to root group
        const missingItems: any[] = [];
        populatedFavorites.forEach(fav => {
          if (fav.compoundId && !processedItemIds.has(fav.compoundId)) {
            missingItems.push(fav);
          }
        });

        if (missingItems.length > 0) {
          const rootGroup = groupsList.find(g => g.id === 'root');
          if (rootGroup) {
            rootGroup.items.push(...missingItems);
          } else {
            groupsList.unshift({
              id: 'root',
              title: null,
              items: missingItems,
            });
          }
        }
        return groupsList.filter(g => g.items.length > 0 || (activeDragId !== null && g.id.startsWith('header-')));
      }, [favGridOrder, favGridVisible, favByCompoundId, populatedFavorites, activeDragId, favoriteCategories]);

      const hasAnyFavoriteItems = useMemo(() => {
        return (groupedFavs as any[]).some((group: any) => group.items.length > 0);
      }, [groupedFavs]);

      // Helper: extract the primary URL from a favorite item
      const getFavPrimaryUrl = (fav: any): string => {
        const val = fav.value || fav.config || '';
        if (val) {
          try {
            if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed.startsWith('{')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed.urls) && parsed.urls.length > 0) return parsed.urls[0];
              }
              if (trimmed.startsWith('http') || trimmed.startsWith('//')) return trimmed;
            }
            if (typeof val === 'object' && Array.isArray(val.urls) && val.urls.length > 0) return val.urls[0];
          } catch { }
        }
        // Try urls array on the item directly (e.g. populated Link items)
        if (Array.isArray(fav.urls) && fav.urls.length > 0) {
          const first = fav.urls[0];
          return typeof first === 'string' ? first : first?.url || '';
        }
        return '';
      };

      // Helper: get the number of URLs in a favorite item
      const getFavUrlsCount = (fav: any): number => {
        const val = fav.value || fav.config || '';
        if (val) {
          try {
            if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed.startsWith('{')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed.urls)) return parsed.urls.length;
              }
              if (trimmed.startsWith('http') || trimmed.startsWith('//')) return 1;
            }
            if (typeof val === 'object' && Array.isArray(val.urls)) return val.urls.length;
          } catch { }
        }
        if (Array.isArray(fav.urls)) return fav.urls.length;
        return 0;
      };

      // Helper: format the type label for the favorite item
      const getFavDisplayType = (fav: any): string => {
        const type = (fav.type || fav.category || fav.kind || '').toLowerCase();
        switch (type) {
          case 'note':
            return 'Note';
          case 'snippet':
            return 'Snippet';
          case 'link':
          case 'bulk_link':
          case 'tabgroup':
            return 'Link';
          case 'session':
          case 'sessions':
            return 'Tab Session';
          case 'prompt':
          case 'aiprompt':
          case 'ai_prompt':
            return 'AI Prompt';
          case 'automation':
          case 'automations':
            return 'Automation';
          case 'chat_agent':
          case 'chatagent':
          case 'agent':
            return 'AI Agent';
          case 'todo':
          case 'todos':
            return 'To-Do';
          case 'command':
            return 'Command';
          default:
            return 'Item';
        }
      };

      // Helper: extract all URLs from a favorite item
      const getFavAllUrls = (fav: any): string[] => {
        const val = fav.value || fav.config || '';
        const urls: string[] = [];
        if (val) {
          try {
            if (typeof val === 'string') {
              const trimmed = val.trim();
              if (trimmed.startsWith('{')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed.urls)) {
                  parsed.urls.forEach((u: any) => {
                    const urlStr = typeof u === 'string' ? u : u?.url || '';
                    if (urlStr) urls.push(urlStr);
                  });
                }
              } else if (trimmed.startsWith('http') || trimmed.startsWith('//')) {
                urls.push(trimmed);
              }
            } else if (typeof val === 'object' && Array.isArray(val.urls)) {
              val.urls.forEach((u: any) => {
                const urlStr = typeof u === 'string' ? u : u?.url || '';
                if (urlStr) urls.push(urlStr);
              });
            }
          } catch { }
        }
        if (urls.length === 0 && Array.isArray(fav.urls)) {
          fav.urls.forEach((u: any) => {
            const urlStr = typeof u === 'string' ? u : u?.url || '';
            if (urlStr) urls.push(urlStr);
          });
        }
        return urls;
      };

      const handleFavGridClick = useCallback(
        (fav: any) => {
          const chromeAny = (window as any)?.chrome;
          const type = (fav.type || fav.category || '').toLowerCase();
          if (type === 'link' || type === 'snippet' || type === 'session') {
            const urls = getFavAllUrls(fav);
            if (urls.length > 0) {
              urls.forEach((url, idx) => {
                const cleanUrl = url.startsWith('//') ? `https:${url}` : url;
                if (chromeAny?.tabs?.create) {
                  chromeAny.tabs.create({ url: cleanUrl, active: idx === 0 });
                } else {
                  window.open(cleanUrl, '_blank', 'noopener');
                }
              });
              return;
            }
            // fallback: open editor
            if (fav.id) {
              if (type === 'snippet') {
                const baseUrl = chromeAny?.runtime?.getURL ? chromeAny.runtime.getURL('AltS_search_newtab/index.html') : '/AltS_search_newtab/index.html';
                const url = new URL(baseUrl);
                url.searchParams.set('alts_action', 'true');
                url.searchParams.set('type', 'snippet');
                url.searchParams.set('entityId', fav.id);
                url.searchParams.set('edit_mode', 'true');
                const mergedSnippet = {
                  ...fav,
                  category: 'snippet',
                };
                const editorPropsObj = { props: { item: mergedSnippet, snippet: mergedSnippet, category: 'snippet' } };
                url.searchParams.set('editorProps', JSON.stringify(editorPropsObj));

                const finalUrl = url.toString();
                if (chromeAny?.tabs?.create) {
                  chromeAny.tabs.create({ url: finalUrl, active: true });
                } else {
                  window.open(finalUrl, '_blank', 'noopener');
                }
              } else if (type === 'session') {
                useUIStore.getState().openEditor({ type: 'session', id: fav.id, props: { item: fav, session: fav } });
              } else {
                useUIStore.getState().openEditor({ type: 'link', id: fav.id, props: { item: fav } });
              }
            }
          } else if (type === 'note') {
            if (fav.id)
              useUIStore
                .getState()
                .openEditor({ type: 'note', id: fav.id, props: { category: 'note', item: fav, snippet: fav } });
          } else if (type === 'todo') {
            if (fav.id) {
              const baseUrl = chromeAny?.runtime?.getURL ? chromeAny.runtime.getURL('AltS_search_newtab/index.html') : '/AltS_search_newtab/index.html';
              const url = new URL(baseUrl);
              url.searchParams.set('alts_action', 'true');
              url.searchParams.set('type', 'todo');
              url.searchParams.set('entityId', fav.id);
              url.searchParams.set('edit_mode', 'true');
              const prefill = {
                ...fav,
                todo_id: fav.id,
                is_todo_type: true,
              };
              const editorPropsObj = { props: { prefill, item: prefill, snippet: prefill } };
              url.searchParams.set('editorProps', JSON.stringify(editorPropsObj));

              const finalUrl = url.toString();
              if (chromeAny?.tabs?.create) {
                chromeAny.tabs.create({ url: finalUrl, active: true });
              } else {
                window.open(finalUrl, '_blank', 'noopener');
              }
            }
          } else if (type === 'aiprompt' || type === 'prompt') {
            if (fav.id) useUIStore.getState().openEditor({ type: 'aiPrompt', id: fav.id, props: { item: fav } });
          } else if (type === 'agent' || type === 'chat_agent') {
            if (fav.id) useUIStore.getState().openEditor({ type: 'agent', id: fav.id, props: { item: fav } });
          } else if (type === 'command') {
            // commands: bubble up as quick command
            const cmdId = fav.id || fav.commandId;
            if (cmdId && onQuickCommandSelect) onQuickCommandSelect(cmdId as any);
          } else {
            const urls = getFavAllUrls(fav);
            if (urls.length > 0) {
              const chromeAny = (window as any)?.chrome;
              urls.forEach((url, idx) => {
                const cleanUrl = url.startsWith('//') ? `https:${url}` : url;
                if (chromeAny?.tabs?.create) {
                  chromeAny.tabs.create({ url: cleanUrl, active: idx === 0 });
                } else {
                  window.open(cleanUrl, '_blank', 'noopener');
                }
              });
            }
          }
        },
        [onQuickCommandSelect],
      );

      // Helper: render the icon inside a favorite card
      const FavGridIcon = ({ fav }: { fav: any }) => {
        const type = (fav.type || fav.category || fav.kind || '').toLowerCase();
        const urls = getFavAllUrls(fav);
        const [imgFailed, setImgFailed] = useState(false);

        // Resolve hostnames for all URLs
        const hostnames = useMemo(() => {
          return urls
            .map(url => {
              try {
                return new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
              } catch {
                return '';
              }
            })
            .filter(Boolean);
        }, [urls]);

        const iconClass = 'w-6 h-6';

        // Only render favicon for single links/sessions (length === 1)
        if (
          (type === 'link' || type === 'bulk_link' || type === 'tabgroup' || type === 'session') &&
          hostnames.length === 1 &&
          !imgFailed
        ) {
          return (
            <img
              src={getFaviconUrl(hostnames[0])}
              alt=""
              className={`${iconClass} object-contain`}
              onError={() => setImgFailed(true)}
              draggable="false"
            />
          );
        }

        // Render overlapping circular favicons for multiple links/sessions (length >= 2) horizontally
        if (
          (type === 'link' || type === 'bulk_link' || type === 'tabgroup' || type === 'session') &&
          hostnames.length >= 2
        ) {
          return (
            <div className="flex items-center shrink-0">
              {hostnames.slice(0, 3).map((hostname, idx) => (
                <img
                  key={idx}
                  src={getFaviconUrl(hostname)}
                  alt=""
                  style={{ zIndex: 10 - idx }}
                  className={`w-5 h-5 rounded-full object-contain bg-white dark:bg-neutral-800 border border-black/15 dark:border-white/20 shadow-sm ${idx > 0 ? '-ml-2' : ''}`}
                  draggable="false"
                />
              ))}
            </div>
          );
        }

        if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(type)) {
          return <FaRobot className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'automation' || type === 'automations') {
          return <FiZap className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'todo' || type === 'todos') {
          return <BsCalendarCheck className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'snippet' || type === 'snippets') {
          return <FaCode className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'session' || type === 'sessions') {
          return <FiLayers className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'command') {
          return <FiLayers className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        if (type === 'link' || type === 'bulk_link' || type === 'tabgroup') {
          return <FiLink className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        return <NotesIcon className="w-6 h-6 shrink-0 text-[var(--color-iconDefault)]" />;
      };

      const [favCardHovered, setFavCardHovered] = useState(false);
      const commands = useDbStore(state => state.commands);

      const userCommandsMap = useMemo(() => {
        const map: Record<string, CommandRecord> = {};
        commands.forEach(c => {
          map[c.id] = c;
        });
        return map;
      }, [commands]);

      const favoriteIdSet = useMemo(() => {
        const set = new Set<string>();
        favorites.forEach(fav => {
          if (fav.reference_id) set.add(fav.reference_id);
        });
        return set;
      }, [favorites]);

      const sortedSnippets = useMemo(() => {
        return [...teamSnippets].sort((a, b) => {
          const aTime = new Date(a.snippet.updated_at || a.snippet.created_at || 0).getTime();
          const bTime = new Date(b.snippet.updated_at || b.snippet.created_at || 0).getTime();
          return bTime - aTime;
        });
      }, [teamSnippets]);

      const noteItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(
            entry =>
              entry.snippet.category !== 'link' &&
              entry.snippet.category !== 'session' &&
              entry.snippet.category !== 'bulk_link',
          )
          .slice(0, NOTE_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category?.toLowerCase() || '';
            let kind: 'note' | 'link' = 'note';
            if (category === 'link' || category === 'session' || category === 'bulk_link') kind = 'link';

            return {
              context,
              kind,
              id,
              title: entry.snippet.key || (kind === 'link' ? 'Untitled link' : 'Untitled note'),
              preview: getSnippetPreview(entry.snippet),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      const linkItems = useMemo<SnippetInteractiveItem[]>(() => {
        return sortedSnippets
          .filter(
            entry =>
              entry.snippet.category === 'link' ||
              entry.snippet.category === 'session' ||
              entry.snippet.category === 'bulk_link',
          )
          .slice(0, LINK_LIMIT)
          .map((entry, index) => {
            const id = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const snippetId = entry.snippet.id || entry.snippet.snippet_id || '';
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category?.toLowerCase() || '';
            return {
              kind: 'link' as const,
              id,
              title: entry.snippet.key || 'Untitled link',
              context,
              preview: getSnippetPreview(entry.snippet) || (category === 'session' ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: snippetId ? favoriteIdSet.has(snippetId) : false,
              urls: extractUrlsFromSnippet(entry.snippet),
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // AI selection state for dynamic icons (Migrated to chrome.storage.local)
      const [selectedAIs, setSelectedAIs] = useChromeStorage<string[]>('selectedAIs', AI_GROUP.members);
      const AI_ICON_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];

      const handleToggleAI = useCallback(
        (aiId: string) => {
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            return newSelection;
          });
        },
        [setSelectedAIs],
      );

      const commandItems = useMemo<CommandInteractiveItem[]>(() => {
        return COMMAND_SHORTLIST.map(id => {
          if (id === 'ai') {
            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id,
              label: AI_GROUP.label,
              description: COMMAND_DESCRIPTIONS[id] ?? 'Run this command.',
              iconHosts: AI_ICON_HOSTS,
              keywords: ['ai', 'assistants', 'all ai'],
              iconStack: true,
              isFavorite: favoriteIdSet.has(id),
              shortcut: undefined,
            };
          }

          // Local commands (createnotes / createlinks)
          const localDef = findCommandByAnyId(commands, id);
          if (localDef && localDef.surface !== 'website') {
            const stored = userCommandsMap[id];
            const shortcut = stored ? stored.prefix : localDef.prefix.replace(/^\//, '');

            return {
              kind: 'command' as const,
              id: `command-${id}`,
              commandId: id as LocalCommandId,
              label: localDef.label,
              description: COMMAND_DESCRIPTIONS[id] ?? `Run ${localDef.label}.`,
              iconHosts: [], // indicates local command; DefaultContainer will use TerminalIcon
              icon: localDef.icon,
              keywords: [localDef.prefix.replace('/', ''), localDef.label.toLowerCase()],
              iconStack: false,
              isFavorite: favoriteIdSet.has(id),
              shortcut: stored ? stored.prefix : undefined,
            };
          }

          const def = findCommandByAnyId(commands, id);
          if (!def && id !== 'collections') return null;

          const stored = userCommandsMap[id];

          // Try to find the specific BROWSER_ICON for this command if it's a browser command
          let customIcon = def?.icon;
          if (!customIcon && id === 'todo') customIcon = BsCalendarCheck;
          else if (!customIcon && id === 'collections')
            customIcon = (
              <svg
                className={'w-4 h-4 shrink-0 transition-colors text-neutral-400 group-hover:text-neutral-200'}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            );
          else if (!customIcon && def?.category === 'browser') {
            const iconMap: Record<string, React.ReactNode> = {
              history: <FaHistory size={14} className="text-[var(--color-iconDefault)]" />,
              downloads: <FaDownload size={14} className="text-[var(--color-iconDefault)]" />,
              settings: <FaCog size={14} className="text-[var(--color-iconDefault)]" />,
              extensions: <FaPuzzlePiece size={14} className="text-[var(--color-iconDefault)]" />,
              bookmarks: <FaBookmark size={14} className="text-[var(--color-iconDefault)]" />,
              flags: <FaFlag size={14} className="text-[var(--color-iconDefault)]" />,
              inspect: <FaCode size={14} className="text-[var(--color-iconDefault)]" />,
              version: <FaTag size={14} className="text-[var(--color-iconDefault)]" />,
              about: <FaInfoCircle size={14} className="text-[var(--color-iconDefault)]" />,
              tasks: <FaMemory size={14} className="text-[var(--color-iconDefault)]" />,
              gpu: <FaMicrochip size={14} className="text-[var(--color-iconDefault)]" />,
              dino: <FaGamepad size={14} className="text-[var(--color-iconDefault)]" />,
              passwords: <FaKey size={14} className="text-[var(--color-iconDefault)]" />,
              help: <FaQuestionCircle size={14} className="text-[var(--color-iconDefault)]" />,
            };
            customIcon = iconMap[id];
          }

          return {
            kind: 'command' as const,
            id: `command-${id}`,
            commandId: id,
            label: id === 'todo' ? 'My To-Do' : id === 'collections' ? 'All Command Shortcuts' : def?.label || '',
            description: COMMAND_DESCRIPTIONS[id] ?? `Open ${def?.label || ''}.`,
            iconHosts: id === 'collections' ? [] : [def?.iconHost].filter(Boolean),
            icon: customIcon,
            keywords: id === 'collections' ? ['collections', 'all', 'folders'] : getCommandKeywords(id as CommandId),
            iconStack: false,
            isFavorite: favoriteIdSet.has(id),
            shortcut: id === 'collections' ? undefined : id === 'todo' ? 'Alt+C' : stored ? stored.prefix : undefined,
          };
        }).filter(Boolean) as CommandInteractiveItem[];
      }, [selectedAIs, favoriteIdSet, userCommandsMap]);

      const favoriteItems = useMemo<SnippetInteractiveItem[]>(() => {
        if (!favoriteIdSet.size) return [];
        return sortedSnippets
          .filter(entry => {
            const id = entry.snippet.id || entry.snippet.snippet_id || '';
            return Boolean(id) && favoriteIdSet.has(id);
          })
          .slice(0, FAV_LIMIT)
          .map((entry, index) => {
            const baseId = buildSuggestionKey(entry.workspace, entry.folder, entry.snippet, index);
            const id = `favorite-${baseId}`;
            const context = entry.folder
              ? `${entry.workspace.workspace_name} • ${entry.folder.folder_name}`
              : entry.workspace.workspace_name;

            const category = entry.snippet.category?.toLowerCase() || '';
            const isLink = category === 'link' || category === 'session' || category === 'bulk_link';

            let kind: 'note' | 'link' = 'note';
            if (isLink) kind = 'link';

            return {
              context,
              kind,
              id,
              title: entry.snippet.key || (kind === 'link' ? 'Untitled link' : 'Untitled note'),
              preview: getSnippetPreview(entry.snippet) || (category === 'session' ? 'Multiple URLs saved' : ''),
              icon: resolveSnippetIcon(category),
              suggestion: buildSnippetSuggestion(entry.workspace, entry.folder, entry.snippet),
              isFavorite: true,
              urls: isLink ? extractUrlsFromSnippet(entry.snippet) : undefined,
            };
          });
      }, [sortedSnippets, favoriteIdSet]);

      // ... inside toggleFavoriteForItem ...

      // ... inside component ...

      const toggleFavoriteForItem = useCallback(
        async (item: InteractiveItem) => {
          try {
            function showToast(msg: string) {
              useUIStore.getState().setCommandStatus({ status: 'success', message: msg });
              setTimeout(() => {
                useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
              }, 2000);
            }

            try {
              let itemId: string;
              let itemType: string;

              if (item.kind === 'command') {
                itemType = 'command';
                itemId = item.commandId;
              } else {
                const snippet: any = (item.suggestion as any).item || (item.suggestion as any).snippet;
                itemType = snippet.category || 'snippet';
                itemId = snippet?.id || snippet?.snippet_id;
              }

              const isNowFav = !favoriteIdSet.has(itemId);
              await toggleFavorite(
                itemId,
                itemType,
                item.kind === 'command'
                  ? item.label
                  : (item.suggestion as any).item?.title || (item.suggestion as any).snippet?.key,
              );

              if (isNowFav) {
                showToast(`Added to favorites`);
              } else {
                showToast(`Removed from favorites`);
              }
            } catch (err) {
              console.error('[HomeView] Toggle Error', err);
            }
          } catch (outerErr) {
            console.error(outerErr);
          }
        },
        [favoriteIdSet, toggleFavorite],
      );

      const sections = useMemo<InteractiveSection[]>(() => {
        const list: InteractiveSection[] = [];

        // Recommended section - combines commands, notes and links (like AltS)
        const recommendedItems: InteractiveItem[] = [];
        recommendedItems.push(...commandItems);
        // only homeview allow 3 options remaining not sending uncomment to send it

        // recommendedItems.push(...noteItems.slice(0, 4));
        // recommendedItems.push(...linkItems.slice(0, 4));
        if (recommendedItems.length > 0) {
          list.push({
            key: 'recommended',
            title: '',
            items: recommendedItems,
            emptyMessage: 'No suggestions yet. Try creating or saving items.',
          });
        }

        // Empty state if no items
        if (!list.length) {
          list.push({
            key: 'empty',
            title: 'Results',
            items: [],
            emptyMessage: 'Nothing here yet. Try creating a note or saving a link.',
          });
        }

        return list;
      }, [commandItems, noteItems, linkItems]);

      // Track focused item kind for dynamic label
      const [focusedItemKind, setFocusedItemKind] = useState<'link' | 'note' | 'command' | 'folder' | 'session' | null>(
        null,
      );
      const handleHighlightChange = useCallback(
        (item: InteractiveItem | null) => {
          if (onHighlightChange) {
            onHighlightChange(item);
          }
          if (item) {
            setFocusedItemKind(item.kind);
          } else {
            setFocusedItemKind(null);
          }
        },
        [onHighlightChange],
      );

      const handleSnippetOpen = useCallback(
        (item: SnippetSuggestion) => {
          const snippet: any = (item as any).item || (item as any).snippet;
          const category = (snippet?.category || '').toLowerCase();
          const snippetId = snippet?.snippet_id || snippet?.id || '';

          if (category === 'link' || category === 'session' || category === 'bulk_link') {
            const urls = extractUrlsFromSnippet(snippet);
          } else {
          }

          onSnippetSelect(item);
        },
        [onSnippetSelect],
      );

      const handleOpenUrls = useCallback(
        (urls: string[], title?: string) => {
          if (urls?.length) {
          }
          onRequestOpenUrls?.(urls, title);
        },
        [onRequestOpenUrls],
      );

      const getDynamicActionLabel = () => {
        return 'Options';
      };

      if (isCommandLocked || isAtMenuOpen) {
        return null;
      }

      return (
        <div className="w-full flex flex-col relative">
          <DefaultContainer
            ref={ref}
            sections={sections}
            todoCounts={todoCounts}
            onQuickCommandSelect={onQuickCommandSelect}
            onCommandPreview={onCommandPreview}
            onSnippetSelect={handleSnippetOpen}
            onRequestSnippetDelete={onRequestSnippetDelete}
            onRequestFocusSearch={onRequestFocusSearch}
            onHighlightChange={handleHighlightChange}
            actionsButtonLabel={getDynamicActionLabel()}
            onToggleFavorite={toggleFavoriteForItem}
            onRequestEditLink={onRequestLinkEdit}
            selectedAIs={selectedAIs}
            onToggleAI={handleToggleAI}
            inlineNotification={inlineNotification}
            isCommandLocked={isCommandLocked}
            isAtMenuOpen={isAtMenuOpen}
            isSuggestionVisible={isSuggestionVisible}
            onNavigateToListView={onNavigateToListView}
            isLoggedIn={isLoggedIn}
            status={commandStatus}
            onRequestOpenUrls={handleOpenUrls}
            folderInfo={
              selectedFolderRecord
                ? {
                  name: selectedFolderRecord.folderName,
                  notesCount: teamSnippets.filter(
                    s =>
                      s.snippet.category !== 'link' &&
                      s.snippet.category !== 'session' &&
                      s.snippet.category !== 'bulk_link',
                  ).length,
                  linksCount: teamSnippets.filter(
                    s =>
                      s.snippet.category === 'link' ||
                      s.snippet.category === 'session' ||
                      s.snippet.category === 'bulk_link',
                  ).length,
                }
                : null
            }
          />

          {/* ── Favorites Transparent Grouped View ──────────────────── */}
          {hasAnyFavoriteItems && (
            <div className="w-full max-w-[500px] mx-auto mt-8 relative flex flex-col px-4 group/fav-container">
              {/* Header row */}
              <div className="flex items-center justify-end mb-3 h-5">
                {/* 3-dots (Visible on hover of container or when settings menu is open) */}
                <button
                  ref={settingsButtonRef}
                  className={`p-1 rounded-md text-neutral-300 hover:text-neutral-100 hover:bg-white/10 transition-all duration-200 cursor-pointer outline-none border-none bg-transparent ${isSettingsOpen ? 'opacity-100' : 'opacity-0 group-hover/fav-container:opacity-100'}`}
                  title="Options"
                  onClick={e => {
                    e.stopPropagation();
                    if (settingsButtonRef.current) {
                      const rect = settingsButtonRef.current.getBoundingClientRect();
                      setSettingsCoords({
                        top: rect.bottom + window.scrollY + 6,
                        left: rect.right + 20 + window.scrollX,
                      });
                    }
                    setIsSettingsOpen(!isSettingsOpen);
                  }}>
                  <FiMoreHorizontal
                    className="w-3.5 h-3.5"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
                  />
                </button>
              </div>

              {/* Grouped Rows — Scrollable Container */}
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={favGridOrder} strategy={rectSortingStrategy}>
                  <div
                    className={`grid grid-cols-4 sm:grid-cols-5 gap-x-4 gap-y-3 w-full max-h-[calc(100vh-420px)] min-h-[120px] overflow-y-auto clean-scrollbar pr-1.5 pb-6 ${favCardHovered || isSettingsOpen ? 'scrollbar-visible' : 'scrollbar-hidden'}`}
                    onMouseEnter={() => setFavCardHovered(true)}
                    onMouseLeave={() => setFavCardHovered(false)}
                  >
                    {(groupedFavs as any[]).flatMap((group: any) => [
                      ...(group.title ? [
                        <SortableHeader key={group.id} id={group.id}>
                          <div className={`flex items-center gap-2 mt-3 mb-1.5 px-2 py-1 rounded-md select-none transition-all duration-200 ${activeDragId ? 'bg-white/10 border border-white/20 border-dashed animate-pulse' : ''}`}>
                            <span
                              className={`text-xs font-bold tracking-wider capitalize ${
                                isCarRace ? 'text-white opacity-100' : 'text-neutral-300 dark:text-neutral-300 opacity-90'
                              }`}
                              style={{ textShadow: isCarRace ? '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)' : '0 1px 3px rgba(0,0,0,0.5)' }}
                            >
                              {group.title}
                            </span>
                            {activeDragId && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                                Drop to move
                              </span>
                            )}
                          </div>
                        </SortableHeader>
                      ] : []),
                      ...(group.items as any[]).map((fav: any, idx: number) => {
                        const label = fav.title || fav.key || fav.label || fav.name || 'Untitled';
                        return (
                          <SortableFavItem
                            key={fav.compoundId}
                            id={fav.compoundId}
                            onClick={() => handleFavGridClick(fav)}
                            onContextMenu={e => {
                              e.preventDefault();
                              if (onOpenContextMenu) {
                                onOpenContextMenu(e.clientX, e.clientY, fav);
                              }
                            }}
                            title={label}
                          >
                            {/* Circular icon (fully transparent & compact) */}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group-hover/fav-item:scale-105">
                              <FavGridIcon fav={fav} />
                            </div>
                            {/* Label */}
                            <span
                              className={`text-[13px] group-hover/fav-item:text-white transition-all duration-200 w-full text-center truncate px-1 select-none ${
                                isCarRace ? 'text-white font-semibold opacity-100' : 'text-neutral-300 dark:text-neutral-400 font-medium opacity-85'
                              }`}
                              style={{ textShadow: isCarRace ? '0 2px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)' : '0 1px 3px rgba(0,0,0,0.5)' }}
                            >
                              {label}
                            </span>
                            {/* Type Subtitle */}
                            <span
                              style={{
                                opacity: isCarRace ? 0.95 : 0.5,
                                textShadow: isCarRace ? '0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)' : '0 1px 2px rgba(0,0,0,0.5)',
                                marginTop: '-2px',
                              }}
                              className={`text-[10px] w-full text-center truncate px-1 select-none capitalize ${
                                isCarRace ? 'text-neutral-100 font-semibold' : 'text-neutral-300 dark:text-neutral-300 font-medium'
                              }`}
                            >
                              {getFavDisplayType(fav)}
                            </span>
                          </SortableFavItem>
                        );
                      })
                    ])}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragId ? (() => {
                    const draggingFav = favByCompoundId[activeDragId];
                    if (!draggingFav) return null;
                    const label = draggingFav.title || draggingFav.key || draggingFav.label || draggingFav.name || 'Untitled';
                    return (
                      <div className="flex flex-col items-center gap-1 group/fav-item outline-none bg-transparent border-none p-0 w-20 mx-auto scale-105 opacity-80 shadow-2xl rounded-xl p-1 pointer-events-none">
                        {/* Circular icon */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                          <FavGridIcon fav={draggingFav} />
                        </div>
                        {/* Label */}
                        <span
                          className={`text-[13px] w-full text-center truncate px-1 ${
                            isCarRace ? 'text-white font-semibold opacity-100' : 'text-neutral-300 dark:text-neutral-400 font-medium opacity-85'
                          }`}
                          style={{ textShadow: isCarRace ? '0 2px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)' : '0 1px 3px rgba(0,0,0,0.5)' }}
                        >
                          {label}
                        </span>
                        {/* Type Subtitle */}
                        <span
                          style={{
                            opacity: isCarRace ? 0.95 : 0.5,
                            textShadow: isCarRace ? '0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)' : '0 1px 2px rgba(0,0,0,0.5)',
                            marginTop: '-2px',
                          }}
                          className={`text-[10px] w-full text-center truncate px-1 capitalize ${
                            isCarRace ? 'text-neutral-100 font-semibold' : 'text-neutral-300 dark:text-neutral-300 font-medium'
                          }`}
                        >
                          {getFavDisplayType(draggingFav)}
                        </span>
                      </div>
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}

          {/* ── Settings Popover Portal ─────────────────────────────── */}
          {isSettingsOpen &&
            ReactDOM.createPortal(
              <div
                ref={popoverRef}
                data-portal="true"
                className="fixed z-[99999] w-52 p-2 rounded-lg border shadow-xl flex flex-col select-none overflow-y-auto max-h-[50vh] custom-scrollbar bg-[var(--color-sidebarBg)] backdrop-blur-md border-white/10 text-neutral-400 shadow-black/80"
                style={{ top: `${settingsCoords.top}px`, left: `${settingsCoords.left}px` }}>
                <div className="text-[10px] font-bold tracking-wider uppercase text-neutral-500 px-2 py-1 select-none">
                  CREATE A FAVORITE GROUP
                </div>
                <Reorder.Group
                  axis="y"
                  values={favGridOrder}
                  onReorder={reorderFavoritesItems}
                  className="flex flex-col gap-0">
                  {(() => {
                    let hasSeenHeader = false;
                    return favoritesOptions.map((option: any) => {
                      if (option.id.startsWith('header-')) {
                        hasSeenHeader = true;
                        const groupId = option.id.replace('header-', '');
                        const headerIndex = favGridOrder.indexOf(option.id);
                        let isOn = false;
                        for (let i = headerIndex + 1; i < favGridOrder.length; i++) {
                          if (favGridOrder[i].startsWith('header-')) break;
                          if (favGridVisible[favGridOrder[i]] !== false) {
                            isOn = true;
                            break;
                          }
                        }

                        return (
                          <GroupHeaderItem
                            key={option.id}
                            id={option.id}
                            title={option.label}
                            isOn={isOn}
                            onToggle={() => toggleGroup(option.id)}
                            onRename={newName => {
                              void updateFavoriteCategory(groupId, { name: newName });
                              if (newlyCreatedFavGroupId === option.id) {
                                setNewlyCreatedFavGroupId(null);
                              }
                            }}
                            onDelete={() => {
                              void deleteFavoriteCategory(groupId);
                              if (newlyCreatedFavGroupId === option.id) {
                                setNewlyCreatedFavGroupId(null);
                              }
                            }}
                            autoFocusEdit={newlyCreatedFavGroupId === option.id}
                            onCancelEdit={() => {
                              if (newlyCreatedFavGroupId === option.id) {
                                void deleteFavoriteCategory(groupId);
                                setNewlyCreatedFavGroupId(null);
                              }
                            }}
                          />
                        );
                      } else {
                        const isVisible = favGridVisible[option.id] !== false;
                        if (!isVisible) return null;
                        return (
                          <FavoriteReorderItem
                            key={option.id}
                            option={option}
                            isIndented={hasSeenHeader}
                            getFavoriteIcon={(item: any) => {
                              const type = (item.type || item.reference_type || '').toLowerCase();
                              switch (type) {
                                case 'note':
                                  return <FiFileText size={12} className="text-neutral-500 shrink-0" />;
                                case 'link': {
                                  const url = item.url || item.value;
                                  if (url && typeof url === 'string') {
                                    try {
                                      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
                                      return (
                                        <img
                                          src={getFaviconUrl(domain)}
                                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                                          alt=""
                                        />
                                      );
                                    } catch { }
                                  }
                                  return <FiLink size={12} className="text-neutral-500 shrink-0" />;
                                }
                                case 'snippet':
                                  return <FiCode size={12} className="text-neutral-500 shrink-0" />;
                                case 'session':
                                  return <FiLayers size={12} className="text-neutral-500 shrink-0" />;
                                case 'chat_agent':
                                case 'agent':
                                  return <LuBot size={12} className="text-neutral-500 shrink-0" />;
                                case 'automation':
                                  return <FiZap size={12} className="text-neutral-500 shrink-0" />;
                                default:
                                  return <FiFileText size={12} className="text-neutral-500 shrink-0" />;
                              }
                            }}
                          />
                        );
                      }
                    });
                  })()}
                </Reorder.Group>

                {/* Add Custom favorites Group Button */}
                <div className="flex justify-center mt-2 px-2">
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      if (!userId) return;
                      const existingNames = new Set(favoriteCategories.map(category => category.name.toLowerCase()));
                      const base = 'New category';
                      let candidate = base;
                      let index = 2;
                      while (existingNames.has(candidate.toLowerCase())) {
                        candidate = `${base} ${index}`;
                        index += 1;
                      }
                      const created = await createFavoriteCategory(candidate, userId);
                      setNewlyCreatedFavGroupId(`header-${created.id}`);
                    }}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center cursor-pointer outline-none border-none bg-transparent"
                    title="Add Custom Group for Favorites">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>,
              document.body,
            )}
        </div>
      );
    },
  ),
);

HomeView.displayName = 'HomeView';

export default HomeView;
