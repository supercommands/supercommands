import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { motion, useDragControls, Reorder } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import { saveHotkey, useKeystrokeRecording } from '../../../../../shared-components/hotkeys';
import { saveShortcut } from '../../../../../shared-components/shortcuts';
import {
  createFavoriteCategory,
  deleteFavoriteCategory,
  updateFavoriteCategory,
  useFavoriteCategories,
} from '../../../../../allObjectFolder/src/createObject/favoriteCategory';
import { FavoriteGroupTagFilterPopover } from '../../../../../shared-components/favoriteCategories';
import { useWidgetPopoverPosition } from '../../components/widgets/engine/useWidgetPopoverPosition';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';

export function getFavoriteTagIds(favorite: any, allTags: any[] = []): string[] {
  const rawTags = Array.isArray(favorite?.tagIds)
    ? favorite.tagIds
    : Array.isArray(favorite?.tags)
      ? favorite.tags
      : Array.isArray(favorite?.tag_ids)
        ? favorite.tag_ids
        : [];

  const tagIdSet = new Set<string>();

  rawTags.forEach((tag: any) => {
    if (typeof tag === 'string') {
      tagIdSet.add(tag);
      const matchedByName = allTags.find(t => t.name === tag || t.id === tag);
      if (matchedByName?.id) tagIdSet.add(matchedByName.id);
    } else if (tag && typeof tag === 'object') {
      if (tag.id) tagIdSet.add(String(tag.id));
      if (tag.tag_id) tagIdSet.add(String(tag.tag_id));
      if (tag._id) tagIdSet.add(String(tag._id));
      if (tag.name) {
        const matchedByName = allTags.find(t => t.name === tag.name || t.id === tag.name);
        if (matchedByName?.id) tagIdSet.add(matchedByName.id);
      }
    }
  });

  return Array.from(tagIdSet);
}

import { UnifiedContextMenu, type MenuAction } from '../../../../../shared-components/ui/UnifiedContextMenu';
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
  FaStar,
} from 'react-icons/fa';
import { FiMoreHorizontal, FiLink, FiFileText, FiZap, FiLayers, FiMoreVertical, FiCode, FiEdit2, FiExternalLink, FiPlay, FiTrash2, FiStar, FiFilter } from 'react-icons/fi';
import type { WidgetSizePreset } from '../../components/widgets/widgetDashboard.types';
import { LuBot, LuStar, LuSparkles } from 'react-icons/lu';
import { BsCalendarCheck, BsKeyboard } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { db } from '../../../../../storage/indexDB/dbConfig';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';


const SortableFavItem = ({
  id,
  children,
  onClick,
  onContextMenu,
  title,
  disabled = false,
}: {
  id: string;
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  title: string;
  disabled?: boolean;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

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
      {...(disabled ? {} : attributes)}
      {...(disabled ? {} : listeners)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={e => e.preventDefault()}
      draggable="false"
      className={`flex flex-col items-center justify-start gap-0.5 group/fav-item outline-none bg-transparent border-none p-1 rounded-lg cursor-pointer w-full min-w-0 mx-0 hover:bg-[var(--color-hoverBg)] transition-all duration-200 ${isDragging ? 'grabbing opacity-0 pointer-events-none' : ''}`}
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
  onOpenFilterTags?: (e: React.MouseEvent) => void;
  autoFocusEdit?: boolean;
  onCancelEdit?: () => void;
  validationError?: string | null;
  editInputRef?: React.RefObject<HTMLInputElement | null>;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  id,
  label,
  isOn,
  onToggle,
  dragControls,
  onRename,
  onDelete,
  onOpenFilterTags,
  autoFocusEdit,
  onCancelEdit,
  validationError,
  editInputRef,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(autoFocusEdit || false);
  const isDraftRow = Boolean(id?.includes('draft-') || autoFocusEdit);
  const [editValue, setEditValue] = React.useState(isDraftRow ? '' : (label.startsWith('custom_') ? '' : label));
  const [menuCoords, setMenuCoords] = React.useState({ top: 0, left: 0 });
  const dotsRef = React.useRef<HTMLDivElement>(null);
  const internalInputRef = React.useRef<HTMLInputElement>(null);
  const activeInputRef = editInputRef || internalInputRef;
  const isSubmittingRef = React.useRef(false);

  const handleRenameSubmit = () => {
    if (isSubmittingRef.current) return;
    const trimmed = editValue.trim();
    if (!trimmed) return; // keep input open if empty
    if (onRename) {
      isSubmittingRef.current = true;
      onRename(trimmed);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
      setIsEditing(false);
      setMenuOpen(false);
    }
  };

  const handleCancelEdit = () => {
    if (isDraftRow && onCancelEdit) {
      onCancelEdit();
    } else {
      setEditValue(label.startsWith('custom_') ? '' : label);
      setIsEditing(false);
    }
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
      if (id?.includes('draft-') || label.startsWith('custom_')) {
        setEditValue('');
      } else {
        setEditValue(label);
      }
      requestAnimationFrame(() => {
        activeInputRef.current?.focus();
        activeInputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  }, [autoFocusEdit, id, label]);

  const displayLabel = (label.startsWith('draft-') || label.startsWith('custom_')) ? '' : label;

  return (
    <div className="flex flex-col mb-1.5">
      <div className="flex items-center justify-between px-2 py-1 relative group rounded border bg-white/[0.04] border-white/5">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {!isDraftRow && (
            <div
              className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 shrink-0"
              onPointerDown={e => {
                if (dragControls) dragControls.start(e);
                else e.stopPropagation();
              }}>
              <DragHandleIcon />
            </div>
          )}
          {isEditing || autoFocusEdit ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                ref={activeInputRef}
                autoFocus
                value={editValue}
                placeholder="Enter group name"
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRenameSubmit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelEdit();
                  }
                }}
                className="flex-1 bg-transparent border-b border-[#268bd2] outline-none text-[10px] font-bold tracking-wider normal-case placeholder:normal-case text-neutral-300 px-1 min-w-0"
              />
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleRenameSubmit(); }}
                className="text-[#268bd2] text-[9px] font-bold px-1 py-0.5 rounded hover:bg-[#268bd2]/20 shrink-0 leading-none"
              >✓</button>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleCancelEdit(); }}
                className="text-neutral-500 text-[9px] font-bold px-1 py-0.5 rounded hover:bg-white/10 shrink-0 leading-none"
              >✕</button>
            </div>
          ) : (
            <span className="text-[10px] font-bold tracking-wider uppercase truncate text-neutral-400">{displayLabel}</span>
          )}
        </div>

        {!isDraftRow && (
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
                      {onOpenFilterTags && (
                        <button
                          className="px-2 py-1.5 text-[10px] text-left hover:bg-white/5 text-neutral-300 w-full outline-none border-none cursor-pointer flex items-center gap-1"
                          onClick={e => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            if (onOpenFilterTags) onOpenFilterTags(e);
                          }}>
                          Filter by tags
                        </button>
                      )}
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
        )}
      </div>
      {validationError && (
        <span className="text-[9px] text-red-400 font-normal normal-case block mt-0.5 px-2">
          {validationError}
        </span>
      )}
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
  onOpenFilterTags?: (e: React.MouseEvent) => void;
  autoFocusEdit?: boolean;
  onCancelEdit?: () => void;
  validationError?: string | null;
  editInputRef?: React.RefObject<HTMLInputElement | null>;
  dragControls?: any;
}

const GroupHeaderItem: React.FC<GroupHeaderItemProps> = ({
  id,
  title,
  isOn,
  onToggle,
  onRename,
  onDelete,
  onOpenFilterTags,
  autoFocusEdit,
  onCancelEdit,
  validationError,
  editInputRef,
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
        onOpenFilterTags={onOpenFilterTags}
        autoFocusEdit={autoFocusEdit}
        onCancelEdit={onCancelEdit}
        validationError={validationError}
        editInputRef={editInputRef}
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



export interface FavoritesGridProps {
  onOpenContextMenu?: (x: number, y: number, fav: any) => void;
  onExecuteFavorite?: (fav: any, e?: React.MouseEvent) => void;
  isCarRace?: boolean;
  variant?: 'page' | 'widget';
  sizePreset?: WidgetSizePreset;
  isWidgetEditMode?: boolean;
}

export const FavoritesGrid: React.FC<FavoritesGridProps> = ({
  onOpenContextMenu,
  onExecuteFavorite,
  isCarRace = false,
  variant = 'page',
  sizePreset = 'medium',
  isWidgetEditMode = false,
}) => {
  const { favorites, toggleFavorite, populatedFavorites, setFavoriteCategory } = useFavorites();
  const userId = useUser();
  const favoriteCategories = useDbStore(state => state.favoriteCategories);
  const allTags = useDbStore(state => state.tags);
  const { computeFromEvent: computePopoverCoords } = useWidgetPopoverPosition();

  const [activeTagFilterGroupId, setActiveTagFilterGroupId] = useState<string | null>(null);
  const [tagFilterTriggerCoords, setTagFilterTriggerCoords] = useState<{ top: number; left: number } | null>(null);
  const [validationErrorGroupId, setValidationErrorGroupId] = useState<string | null>(null);
  const [validationErrorMessage, setValidationErrorMessage] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const handleStartFavoriteGroupCreation = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const draftGroupId = generateEntityId('favoriteGroupDraft');
    const draftHeaderId = `header-${draftGroupId}`;

    setFavGridOrder(prev => [...prev, draftHeaderId]);
    setFavCustomGroupNames(prev => ({
      ...prev,
      [draftGroupId]: '',
    }));
    setFavGridVisible(prev => ({
      ...prev,
      [draftHeaderId]: true,
    }));
    setNewlyCreatedFavGroupId(draftHeaderId);
    setValidationErrorGroupId(null);
    setValidationErrorMessage(null);

    requestAnimationFrame(() => {
      if (popoverRef.current) {
        popoverRef.current.scrollTop = popoverRef.current.scrollHeight;
      }
    });
  };

  const handleCancelFavoriteGroupDraft = (draftHeaderId: string) => {
    const draftGroupId = draftHeaderId.replace('header-', '');

    setFavGridOrder(prev => prev.filter(id => id !== draftHeaderId));
    setFavCustomGroupNames(prev => {
      const next = { ...prev };
      delete next[draftGroupId];
      return next;
    });
    setFavGridVisible(prev => {
      const next = { ...prev };
      delete next[draftHeaderId];
      return next;
    });

    if (newlyCreatedFavGroupId === draftHeaderId) {
      setNewlyCreatedFavGroupId(null);
    }
    setValidationErrorGroupId(null);
    setValidationErrorMessage(null);
  };

  const handleCommitFavoriteGroupName = async (
    headerId: string,
    submittedName: string,
  ) => {
    const trimmed = submittedName.trim();
    const groupId = headerId.replace('header-', '');
    const isDraft = headerId.includes('draft-') || headerId.startsWith('header-custom_');

    if (!trimmed) {
      if (isDraft) {
        handleCancelFavoriteGroupDraft(headerId);
      }
      return;
    }

    const isDuplicate = favoriteCategories.some(
      c => c.id !== groupId && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );

    if (isDuplicate) {
      setValidationErrorGroupId(headerId);
      setValidationErrorMessage('A group with this name already exists.');
      return;
    }

    setValidationErrorGroupId(null);
    setValidationErrorMessage(null);

    if (isDraft) {
      const created = await createFavoriteCategory(trimmed, userId || 'local_user');
      const realHeaderId = `header-${created.id}`;

      const newOrder = favGridOrder.map(id => (id === headerId ? realHeaderId : id));
      setFavGridOrder(newOrder);

      const newNames = { ...favCustomGroupNames, [created.id]: trimmed };
      delete newNames[groupId];
      setFavCustomGroupNames(newNames);

      const newVisible = { ...favGridVisible };
      if (newVisible[headerId] !== undefined) {
        newVisible[realHeaderId] = newVisible[headerId];
        delete newVisible[headerId];
        setFavGridVisible(newVisible);
      }

      setNewlyCreatedFavGroupId(null);

      setFavStorage({
        favorites_items_order: newOrder,
        favorites_custom_group_names: newNames,
        favorites_visible_items: newVisible,
      });
    } else {
      const newNames = { ...favCustomGroupNames, [groupId]: trimmed };
      setFavCustomGroupNames(newNames);
      setFavStorage({ favorites_custom_group_names: newNames });

      let category = favoriteCategories.find(c => c.id === groupId);
      if (!category) {
        category = await createFavoriteCategory(trimmed, userId || 'local_user');
      } else {
        await updateFavoriteCategory(groupId, { name: trimmed });
      }

      if (newlyCreatedFavGroupId === headerId) {
        setNewlyCreatedFavGroupId(null);
      }
    }
  };

  const handleOpenFilterTagsForGroup = async (groupOptionId: string, e?: React.MouseEvent) => {
    const gId = groupOptionId.replace('header-', '');
    let category = favoriteCategories.find(c => c.id === gId);
    if (!category) {
      const categoryName = favCustomGroupNames[gId] || 'Group';
      await createFavoriteCategory(categoryName, userId || 'local_user');
    }

    // Compute position from the trigger element so the popover always
    // appears beside the Favorites widget, wherever it is on the grid.
    if (e) {
      setTagFilterTriggerCoords(computePopoverCoords(e, { width: 240, height: 340 }));
    } else {
      setTagFilterTriggerCoords(null);
    }

    setActiveTagFilterGroupId(groupOptionId);
  };

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
            const rawFavId = id.includes('::') ? id.split('::').pop()! : id;
            const fav = favByCompoundId[rawFavId] || favByCompoundId[id] || populatedFavorites.find(f => f.compoundId === id || f.id === id);
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

      // Load saved favorites layout order & custom group names from chrome.storage.local on mount
      useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get(
            ['favorites_items_order', 'favorites_visible_items', 'favorites_custom_group_names'],
            (result: any) => {
              if (result?.favorites_visible_items) {
                setFavGridVisible(result.favorites_visible_items);
              }
              if (result?.favorites_custom_group_names) {
                setFavCustomGroupNames(result.favorites_custom_group_names);
              }
              if (Array.isArray(result?.favorites_items_order) && result.favorites_items_order.length > 0) {
                setFavGridOrder(result.favorites_items_order);
              }
              setHasLoadedStorage(true);
            }
          );
        } else {
          setHasLoadedStorage(true);
        }
      }, []);

      // Sync populated favorites & DB favorite categories with favGridOrder after storage load
      useEffect(() => {
        if (!hasLoadedStorage) return;

        setFavGridOrder(prevOrder => {
          const currentFavIds = new Set(populatedFavorites.map(f => f.compoundId));
          const currentCategoryIds = new Set(favoriteCategories.map(c => `header-${c.id}`));

          const nextOrder = prevOrder.filter(id => {
            if (id.startsWith('header-')) {
              const catId = id.replace('header-', '');
              // Always keep draft groups (name can be empty during creation)
              if (catId.includes('draft-')) return true;
              return currentCategoryIds.has(id) || Boolean(favCustomGroupNames[catId]);
            }
            return currentFavIds.has(id);
          });

          // Add missing category headers from DB
          favoriteCategories.forEach(cat => {
            const headerId = `header-${cat.id}`;
            if (!nextOrder.includes(headerId)) {
              nextOrder.push(headerId);
            }
          });

          // Add missing favorite items
          populatedFavorites.forEach(fav => {
            if (!nextOrder.includes(fav.compoundId)) {
              nextOrder.push(fav.compoundId);
            }
          });

          return nextOrder;
        });
      }, [populatedFavorites, favoriteCategories, favCustomGroupNames, hasLoadedStorage]);

      // Close popover when clicked outside or Escape key pressed
      useEffect(() => {
        if (!isSettingsOpen) return;
        const handleOutsideClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-portal="true"]')) return;
          if (popoverRef.current?.contains(target)) return;
          if (settingsButtonRef.current?.contains(target)) return;
          setIsSettingsOpen(false);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setIsSettingsOpen(false);
          }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
          document.removeEventListener('mousedown', handleOutsideClick);
          document.removeEventListener('keydown', handleKeyDown, true);
        };
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
        const currentlyVisible = favGridVisible[headerId] !== false;
        const newVisible = { ...favGridVisible, [headerId]: !currentlyVisible };
        setFavGridVisible(newVisible);
        setFavStorage({ favorites_visible_items: newVisible });
      };

      const handleDeleteFavGroup = (headerId: string) => {
        const groupId = headerId.replace('header-', '');

        const remainingOrder = favGridOrder.filter(id => id !== headerId);
        setFavGridOrder(remainingOrder);

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
          favorites_items_order: remainingOrder,
          favorites_visible_items: newVisible,
          favorites_custom_group_names: newNames,
        });
      };

      const favoriteUsageCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        populatedFavorites.forEach(fav => {
          const tIds = getFavoriteTagIds(fav, allTags);
          tIds.forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
          });
        });
        return counts;
      }, [populatedFavorites, allTags]);

      // Calculate exclusive filtered destination for each favorite
      const exclusiveFilteredGroupByFavoriteId = useMemo(() => {
        const map = new Map<string, string>();

        const filterGroups = favoriteCategories.filter(
          c => Array.isArray(c.filterTagIds) && c.filterTagIds.length > 0,
        );
        if (filterGroups.length === 0) return map;

        populatedFavorites.forEach(fav => {
          const favTags = getFavoriteTagIds(fav, allTags);
          if (favTags.length === 0) return;

          const matchingGroups = filterGroups.filter(cat =>
            cat.filterTagIds!.some(tId => favTags.includes(tId)),
          );

          if (matchingGroups.length === 0) return;

          // Conflict resolution: highest filterUpdatedAt (or updatedAt) wins, tie-breaker header order
          matchingGroups.sort((a, b) => {
            const timeA = a.filterUpdatedAt ?? a.updatedAt ?? 0;
            const timeB = b.filterUpdatedAt ?? b.updatedAt ?? 0;
            if (timeA !== timeB) {
              return timeB - timeA;
            }
            const orderA = favGridOrder.indexOf(`header-${a.id}`);
            const orderB = favGridOrder.indexOf(`header-${b.id}`);
            if (orderA !== -1 && orderB !== -1) {
              return orderA - orderB;
            }
            return 0;
          });

          const winningCat = matchingGroups[0];
          map.set(fav.compoundId, `header-${winningCat.id}`);
        });

        return map;
      }, [favoriteCategories, populatedFavorites, favGridOrder]);

      // Derived list of favorites for rendering in settings popover matching effective grid placement
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
        populatedFavorites.forEach(f => {
          if (f.compoundId && !order.includes(f.compoundId)) {
            order.push(f.compoundId);
          }
        });

        order.forEach(id => {
          if (id.startsWith('header-') && !map[id]) {
            const groupId = id.replace('header-', '');
            const category = favoriteCategories.find(c => c.id === groupId);
            const categoryName = category?.name || favCustomGroupNames[groupId];
            const displayTitle = (categoryName !== undefined && categoryName.trim())
              ? categoryName.trim()
              : (groupId.startsWith('custom_') || groupId.includes('draft-') ? '' : groupId);
            map[id] = {
              id,
              label: displayTitle,
            };
          }
        });

        return order.map(id => map[id]).filter(Boolean);
      }, [favGridOrder, populatedFavorites, favCustomGroupNames, favoriteCategories, favByCompoundId]);

      // Grouped list of favorites for rendering in Home View (exclusive placement)
      const groupedFavs = useMemo(() => {
        const groupsList: Array<{ id: string; title: string | null; items: any[]; filterTagIds?: string[] }> = [];
        const processedItemIds = new Set<string>();
        const groupsMap = new Map<string, { id: string; title: string | null; items: any[]; filterTagIds?: string[] }>();

        // Step 1: Walk favGridOrder sequentially — position-based group assignment
        // This mirrors exactly what the popover shows
        let currentGroup: { id: string; title: string | null; items: any[]; filterTagIds?: string[] } | null = null;

        favGridOrder.forEach(id => {
          if (id.startsWith('header-')) {
            const groupId = id.replace('header-', '');
            const category = favoriteCategories.find(c => c.id === groupId);
            const rawTitle = category?.name || favCustomGroupNames[groupId];
            const groupTitle = (rawTitle !== undefined && rawTitle.trim())
              ? rawTitle.trim()
              : (groupId.startsWith('custom_') || groupId.includes('draft-') ? 'New Group' : groupId);
            const filterTagIds = category?.filterTagIds || [];

            currentGroup = {
              id: id,
              title: groupTitle,
              items: [],
              filterTagIds,
            };
            groupsList.push(currentGroup);
            groupsMap.set(id, currentGroup);
          } else {
            const fav = favByCompoundId[id] || populatedFavorites.find(f => f.compoundId === id);
            if (fav) {
              if (currentGroup) {
                currentGroup.items.push({ favorite: fav, isAutoMatched: false });
                processedItemIds.add(fav.compoundId);
              }
            }
          }
        });

        // Step 2: Items NOT yet in favGridOrder — route by their favoriteCategoryId from DB
        populatedFavorites.forEach(fav => {
          if (processedItemIds.has(fav.compoundId)) return;
          if (fav.favoriteCategoryId) {
            const targetGroup = groupsMap.get(`header-${fav.favoriteCategoryId}`);
            if (targetGroup) {
              targetGroup.items.push({ favorite: fav, isAutoMatched: false });
              processedItemIds.add(fav.compoundId);
            }
          }
        });

        // Step 3: Items with neither explicit position nor category — route by tag filter
        populatedFavorites.forEach(fav => {
          if (processedItemIds.has(fav.compoundId)) return;
          const exclusiveGroupHeaderId = exclusiveFilteredGroupByFavoriteId.get(fav.compoundId);
          if (exclusiveGroupHeaderId && groupsMap.has(exclusiveGroupHeaderId)) {
            const targetGroup = groupsMap.get(exclusiveGroupHeaderId)!;
            targetGroup.items.push({ favorite: fav, isAutoMatched: true });
            processedItemIds.add(fav.compoundId);
          }
        });

        // Step 4: Root items (no group, no category, no tag filter match)
        const rootItems: any[] = [];
        populatedFavorites.forEach(fav => {
          if (!processedItemIds.has(fav.compoundId)) {
            rootItems.push({ favorite: fav, isAutoMatched: false });
          }
        });

        if (rootItems.length > 0) {
          groupsList.unshift({
            id: 'root',
            title: null,
            items: rootItems,
            filterTagIds: [],
          });
        }

        return groupsList
          .map(group => ({
            ...group,
            items: group.items.filter(itemWrap => {
              const fav = itemWrap.favorite || itemWrap;
              return favGridVisible[fav.compoundId] !== false;
            }),
          }))
          .filter(group => group.items.length > 0);
      }, [favGridOrder, favGridVisible, favByCompoundId, populatedFavorites, favCustomGroupNames, favoriteCategories, exclusiveFilteredGroupByFavoriteId]);

      const groupItemCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        groupedFavs.forEach(group => {
          counts[group.id] = group.items.length;
        });
        return counts;
      }, [groupedFavs]);

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
          case 'tabgroup':
            return 'Link';
          case 'session':
          case 'sessions':
            return 'Tab Session';
          case 'prompt':
          case 'aiprompt':
          case 'ai_prompt':
            return 'Chat Agent';
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

      // Helper: extract all URLs from a favorite item (links or tab sessions)
      const getFavAllUrls = useCallback((fav: any): string[] => {
        const urls: string[] = [];
        const addUrl = (u: any) => {
          if (!u) return;
          const urlStr = typeof u === 'string' ? u : u?.url || u?.link || u?.href || '';
          if (urlStr && typeof urlStr === 'string') {
            const clean = urlStr.trim();
            if (clean && !urls.includes(clean)) {
              urls.push(clean);
            }
          }
        };

        if (Array.isArray(fav.tabs)) fav.tabs.forEach(addUrl);
        if (Array.isArray(fav.urls)) fav.urls.forEach(addUrl);

        const rawVal = fav.value || fav.config || fav.sessionData || fav.tabsData || '';
        if (rawVal) {
          try {
            if (typeof rawVal === 'string') {
              const trimmed = rawVal.trim();
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                  parsed.forEach(addUrl);
                } else if (typeof parsed === 'object' && parsed !== null) {
                  if (Array.isArray(parsed.urls)) parsed.urls.forEach(addUrl);
                  if (Array.isArray(parsed.tabs)) parsed.tabs.forEach(addUrl);
                }
              } else if (trimmed.startsWith('http') || trimmed.startsWith('//')) {
                addUrl(trimmed);
              }
            } else if (typeof rawVal === 'object' && rawVal !== null) {
              if (Array.isArray(rawVal)) {
                rawVal.forEach(addUrl);
              } else {
                if (Array.isArray(rawVal.urls)) rawVal.urls.forEach(addUrl);
                if (Array.isArray(rawVal.tabs)) rawVal.tabs.forEach(addUrl);
              }
            }
          } catch { }
        }
        return urls;
      }, []);

      const handleFavGridClick = useCallback(
        (fav: any, e?: React.MouseEvent) => {
          if (isWidgetEditMode) return;
          if (onExecuteFavorite) {
            onExecuteFavorite(fav, e);
            return;
          }

          const chromeAny = (window as any)?.chrome;
          const type = (fav.type || fav.category || fav.reference_type || '').toLowerCase();
          const itemId = fav.id || fav.reference_id || fav.snippet_id;
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

          if (!itemId) return;

          if (type === 'note') {
            useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { category: 'note', item: fav, snippet: fav } });
          } else if (type === 'snippet') {
            useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { category: 'snippet', item: fav, snippet: { ...fav, category: 'snippet' } } });
          } else if (type === 'link') {
            useUIStore.getState().openEditor({ type: 'link', id: itemId, props: { category: 'link', item: fav, snippet: fav } });
          } else if (type === 'session') {
            useUIStore.getState().openEditor({ type: 'session', id: itemId, props: { category: 'session', item: fav, snippet: fav } });
          } else if (type === 'aiprompt' || type === 'ai_prompt' || type === 'prompt') {
            useUIStore.getState().openEditor({ type: 'aiPrompt', id: itemId, props: { item: fav, snippet: fav } });
          } else if (type === 'chat_agent' || type === 'chatagent' || type === 'agent') {
            useUIStore.getState().openEditor({ type: 'ai', id: itemId });
          } else if (type === 'todo' || type === 'todos') {
            useUIStore.getState().openEditor({ type: 'todo', id: itemId });
          } else {
            useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { item: fav, snippet: fav } });
          }
        },
        [onExecuteFavorite, isWidgetEditMode, getFavAllUrls],
      );

      const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; fav: any } | null>(null);
      const [editingShortcutFor, setEditingShortcutFor] = useState<string | null>(null);
      const [editingHotkeyFor, setEditingHotkeyFor] = useState<string | null>(null);
      const [editValue, setEditValue] = useState<string>('');

      const isMac = typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
      const { captureHotkey } = useKeystrokeRecording(editValue, isMac);
      const hotkeysMap = useDbStore(state => state.hotkeysMap);
      const shortcutsMap = useDbStore(state => state.shortcutsMap);
      const { removeFavorite } = useFavorites();

      const handleCancelEdit = useCallback(() => {
        setEditingShortcutFor(null);
        setEditingHotkeyFor(null);
        setEditValue('');
      }, []);

      const handleSaveHotkey = useCallback(async (fav: any, hotkeyValue: string) => {
        const compoundId = fav.compoundId || fav.id;
        const itemId = fav.id || fav.reference_id || fav.snippet_id;
        const rawType = fav.type || fav.category || fav.reference_type || 'snippet';
        const type = ['session', 'sessions', 'tabgroup', 'tab session'].includes(String(rawType).toLowerCase()) ? 'collection' : rawType;
        await saveHotkey(itemId || compoundId, compoundId, hotkeyValue, type);
        setEditingHotkeyFor(null);
        setEditValue('');
      }, []);

      const handleSaveShortcut = useCallback(async (fav: any, shortcutValue: string) => {
        const compoundId = fav.compoundId || fav.id;
        const itemId = fav.id || fav.reference_id || fav.snippet_id;
        const rawType = fav.type || fav.category || fav.reference_type || 'snippet';
        const type = ['session', 'sessions', 'tabgroup', 'tab session'].includes(String(rawType).toLowerCase()) ? 'collection' : rawType;
        await saveShortcut(itemId || compoundId, compoundId, shortcutValue, type);
        setEditingShortcutFor(null);
        setEditValue('');
      }, []);

      const buildWidgetContextMenuActions = useCallback(
        (fav: any): MenuAction[] => {
          const type = (fav.type || fav.category || fav.reference_type || '').toLowerCase();
          const itemId = fav.id || fav.reference_id || fav.snippet_id;
          const label = fav.title || fav.key || fav.label || fav.name || 'Untitled';
          const urls = getFavAllUrls(fav);

          const isNote = type === 'note';
          const isSnippet = type === 'snippet';
          const isLink = type === 'link';
          const isSession = type === 'session';
          const isPrompt = type === 'aiprompt' || type === 'ai_prompt' || type === 'prompt';
          const isAgent = type === 'chat_agent' || type === 'chatagent' || type === 'agent';
          const isTodo = type === 'todo' || type === 'todos';

          const actions: MenuAction[] = [];

          // 1. Open
          actions.push({
            key: 'open',
            label: urls.length > 0 ? (urls.length > 1 ? `Open All Tabs (${urls.length})` : 'Open Link') : 'Open',
            icon: <FiPlay size={14} />,
            onSelect: () => {
              handleFavGridClick(fav);
            },
          });

          // 2. Open in full screen (for notes and snippets)
          if (isNote || isSnippet) {
            actions.push({
              key: 'open-fullscreen',
              label: 'Open in full screen (Ctrl+Enter)',
              icon: <FiExternalLink size={14} />,
              onSelect: () => {
                const chromeAny = (window as any)?.chrome;
                if (chromeAny?.tabs?.create && itemId) {
                  const url = chromeAny.runtime?.getURL
                    ? chromeAny.runtime.getURL(`src/pages/AltS_search_newtab/index.html#/editor/${itemId}`)
                    : `/editor/${itemId}`;
                  chromeAny.tabs.create({ url, active: true });
                } else if (itemId) {
                  useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { category: isSnippet ? 'snippet' : 'note', item: fav, snippet: isSnippet ? { ...fav, category: 'snippet' } : fav } });
                }
              },
            });
          }

          // 3. Edit item
          if (itemId) {
            const editLabel = isSession
              ? 'Edit routine'
              : isLink
                ? 'Edit link'
                : isSnippet
                  ? 'Edit snippet'
                  : isPrompt
                    ? 'Edit prompt'
                    : isAgent
                      ? 'Edit agent'
                      : isTodo
                        ? 'Edit task'
                        : 'Edit note';

            actions.push({
              key: 'edit',
              label: `${editLabel} (Alt+Shift+E)`,
              icon: <FiEdit2 size={14} />,
              onSelect: () => {
                if (isNote) {
                  useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { category: 'note', item: fav, snippet: fav } });
                } else if (isSnippet) {
                  useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { category: 'snippet', item: fav, snippet: { ...fav, category: 'snippet' } } });
                } else if (isLink) {
                  useUIStore.getState().openEditor({ type: 'link', id: itemId, props: { category: 'link', item: fav, snippet: fav } });
                } else if (isSession) {
                  useUIStore.getState().openEditor({ type: 'session', id: itemId, props: { category: 'session', item: fav, snippet: fav } });
                } else if (isPrompt) {
                  useUIStore.getState().openEditor({ type: 'aiPrompt', id: itemId, props: { item: fav, snippet: fav } });
                } else if (isAgent) {
                  useUIStore.getState().openEditor({ type: 'ai', id: itemId });
                } else if (isTodo) {
                  useUIStore.getState().openEditor({ type: 'todo', id: itemId });
                } else {
                  useUIStore.getState().openEditor({ type: 'note', id: itemId, props: { item: fav, snippet: fav } });
                }
              },
            });
          }

          // 4. Create Todo
          actions.push({
            key: 'create-todo',
            label: 'Create Todo',
            icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
            onSelect: () => {
              useUIStore.getState().setTodoCreatePrefill({
                snippet_id: itemId || fav.reference_id,
                key: label,
                value: typeof fav.value === 'string' ? fav.value : JSON.stringify(fav.value || fav.config || ''),
                category: type || 'note',
              });
              useUIStore.getState().setSidebar('todoSidebar', { open: true });
              window.dispatchEvent(new CustomEvent('close-searchbar'));
            },
          });

          // 5. Delete item
          actions.push({
            key: 'delete',
            label: 'Delete',
            icon: <FiTrash2 size={14} />,
            className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
            onSelect: async () => {
              const refId = fav.reference_id || fav.id || fav.snippet_id;
              if (refId && removeFavorite) {
                await removeFavorite(refId);
              }
              if (itemId) {
                try {
                  if (isNote) await db.notes.delete(itemId);
                  else if (isSnippet) await db.snippets.delete(itemId);
                  else if (isLink) await db.links.delete(itemId);
                  else if (isSession) await db.sessions.delete(itemId);
                  else if (isTodo) await db.todos.delete(itemId);
                  else if (isPrompt) await db.aiPrompts.delete(itemId);
                } catch { }
              }
            },
          });

          // 6. Divider
          actions.push({ divider: true, key: 'div-0' });

          // 7. Remove from Favorites
          actions.push({
            key: 'unfavorite',
            label: 'Remove from favourites',
            icon: <FaStar size={14} className="text-amber-400" />,
            onSelect: () => {
              const refId = fav.reference_id || fav.id || fav.snippet_id;
              if (refId && removeFavorite) {
                removeFavorite(refId);
              }
            },
          });

          // 8. Divider
          actions.push({ divider: true, key: 'div-1' });

          // 9. Assign command
          const compoundId = fav.compoundId || itemId;
          const currentShortcut = shortcutsMap[compoundId];
          actions.push({
            key: 'assign-shortcut',
            label: currentShortcut ? `Assign command (${currentShortcut})` : 'Assign command',
            icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
            className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
            closeOnExecute: false,
            onSelect: () => {
              const displayVal = currentShortcut ? currentShortcut.replace(/^\//, '') : '';
              setEditingShortcutFor(compoundId);
              setEditingHotkeyFor(null);
              setEditValue(displayVal);
            },
          });

          // 10. Assign hotkey
          const currentHotkey = hotkeysMap[compoundId];
          actions.push({
            key: 'assign-hotkey',
            label: currentHotkey ? `Assign hotkey (${currentHotkey})` : 'Assign hotkey',
            icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
            className: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-neutral-700 dark:text-neutral-300',
            closeOnExecute: false,
            onSelect: () => {
              setEditingHotkeyFor(compoundId);
              setEditingShortcutFor(null);
              setEditValue(currentHotkey || '');
            },
          });

          return actions;
        },
        [getFavAllUrls, handleFavGridClick, removeFavorite, hotkeysMap, shortcutsMap],
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
          (type === 'link' || type === 'tabgroup' || type === 'session') &&
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
          (type === 'link' || type === 'tabgroup' || type === 'session') &&
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
          return <LuSparkles className={`${iconClass} text-[var(--color-iconDefault)]`} />;
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
        if (type === 'link' || type === 'tabgroup') {
          return <FiLink className={`${iconClass} text-[var(--color-iconDefault)]`} />;
        }
        return <NotesIcon className="w-6 h-6 shrink-0 text-[var(--color-iconDefault)]" />;
      };

      const [favCardHovered, setFavCardHovered] = useState(false);
      const isWidget = variant === 'widget';

  const renderWidgetHeader = () => (
    <div className="flex items-center justify-between pl-1 pr-1 mb-2 shrink-0 select-none">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-textMuted)]">
        Favorites
      </div>
      <button
        ref={settingsButtonRef}
        type="button"
        title="Favorites settings"
        aria-label="Open Favorites settings"
        aria-haspopup="menu"
        aria-expanded={isSettingsOpen}
        onClick={(e) => {
          e.stopPropagation();
          if (settingsButtonRef.current) {
            const rect = settingsButtonRef.current.getBoundingClientRect();
            const popoverWidth = 208;
            let left = rect.right - popoverWidth;
            if (left < 12) left = Math.max(12, rect.left);

            const popoverMaxHeight = Math.min(window.innerHeight * 0.5, 300);
            let top = rect.bottom + 6;
            if (top + popoverMaxHeight > window.innerHeight - 12) {
              top = Math.max(12, rect.top - popoverMaxHeight - 6);
            }

            setSettingsCoords({ top, left });
          }
          setIsSettingsOpen(prev => !prev);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className={`p-1 rounded-md text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-bgHover)] cursor-pointer transition-all border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${
          isSettingsOpen || isWidgetEditMode
            ? 'opacity-100 bg-[var(--color-bgHover)] text-[var(--color-textPrimary)]'
            : 'opacity-0 group-hover/fav-container:opacity-100'
        }`}
      >
        <FiMoreHorizontal size={16} />
      </button>
    </div>
  );

  const renderSettingsPortal = () =>
    isSettingsOpen &&
    ReactDOM.createPortal(
      <div
        ref={popoverRef}
        data-portal="true"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="fixed z-[999999] w-52 p-2 rounded-xl border shadow-2xl flex flex-col select-none overflow-y-auto max-h-[50vh] custom-scrollbar bg-[var(--color-cardBg)] backdrop-blur-md border-[var(--color-borderDefault)] text-[var(--color-textPrimary)]"
        style={{ top: `${settingsCoords.top}px`, left: `${settingsCoords.left}px` }}>
        <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--color-textMuted)] px-2 py-1 select-none">
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
                const isOn = favGridVisible[option.id] !== false;

                return (
                  <GroupHeaderItem
                    key={option.id}
                    id={option.id}
                    title={option.label}
                    isOn={isOn}
                    onToggle={() => toggleGroup(option.id)}
                    onOpenFilterTags={(e) => handleOpenFilterTagsForGroup(option.id, e)}
                    onRename={async newName => {
                      await handleCommitFavoriteGroupName(option.id, newName);
                    }}
                    onDelete={async () => {
                      if (option.id.includes('draft-')) {
                        handleCancelFavoriteGroupDraft(option.id);
                      } else {
                        const gId = option.id.replace('header-', '');
                        await deleteFavoriteCategory(gId);
                        handleDeleteFavGroup(option.id);
                      }
                    }}
                    autoFocusEdit={newlyCreatedFavGroupId === option.id}
                    validationError={
                      validationErrorGroupId === option.id ? validationErrorMessage : null
                    }
                    onCancelEdit={() => {
                      if (option.id.includes('draft-') || newlyCreatedFavGroupId === option.id) {
                        handleCancelFavoriteGroupDraft(option.id);
                      }
                    }}
                    editInputRef={newlyCreatedFavGroupId === option.id ? editInputRef : undefined}
                  />
                );
              } else {
                return (
                  <FavoriteReorderItem
                    key={option.id}
                    option={option}
                    isIndented={hasSeenHeader}
                    getFavoriteIcon={(item: any) => {
                      const type = (item.type || item.reference_type || '').toLowerCase();
                      switch (type) {
                        case 'note':
                          return <FiFileText size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
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
                          return <FiLink size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
                        }
                        case 'snippet':
                          return <FiCode size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
                        case 'session':
                          return <FiLayers size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
                        case 'chat_agent':
                        case 'agent':
                          return <LuBot size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
                        case 'automation':
                          return <FiZap size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
                        default:
                          return <FiFileText size={12} className="text-[var(--color-iconDefault)] shrink-0" />;
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
            type="button"
            onClick={handleStartFavoriteGroupCreation}
            className="p-1 rounded-md hover:bg-[var(--color-bgHover)] text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] transition-colors flex items-center justify-center cursor-pointer outline-none border-none bg-transparent"
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
    );

  if (!hasAnyFavoriteItems) {
    if (isWidget) {
      return (
        <>
          <div className="w-full h-full flex flex-col relative group/fav-container select-none">
            {renderWidgetHeader()}
            <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-inputBg)] text-[var(--color-iconDefault)] border border-[var(--color-borderDefault)]">
                <LuStar size={20} />
              </div>
              <div className="text-xs font-semibold text-[var(--color-textPrimary)]">No favorites yet</div>
              <div className="mt-0.5 text-[11px] text-[var(--color-textMuted)]">Favorite an item to see it here.</div>
            </div>
          </div>
          {renderSettingsPortal()}
        </>
      );
    }
    return null;
  }

  const gridColumnsClass = isWidget
    ? sizePreset === 'small'
      ? 'grid-cols-2 gap-1.5'
      : sizePreset === 'medium'
        ? 'grid-cols-3 sm:grid-cols-4 gap-2'
        : 'grid-cols-4 sm:grid-cols-5 gap-2.5'
    : 'grid-cols-4 sm:grid-cols-5 gap-x-4 gap-y-3';

  const outerContainerClass = isWidget
    ? 'w-full h-full flex flex-col relative group/fav-container select-none'
    : 'w-full max-w-[500px] mx-auto mt-8 relative flex flex-col px-4 group/fav-container';

  const innerGridScrollClass = isWidget
    ? `favorites-widget-scroll flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden ${isWidgetEditMode ? 'pb-20' : 'pb-2'}`
    : 'w-full max-h-[calc(100vh-420px)] min-h-[120px] overflow-y-auto clean-scrollbar pr-1.5 pb-6';

  const iconSizeClass = isWidget
    ? sizePreset === 'small'
      ? 'w-7 h-7'
      : sizePreset === 'medium'
        ? 'w-8 h-8'
        : 'w-8.5 h-8.5'
    : 'w-10 h-10';

  const titleTextClass = isWidget
    ? sizePreset === 'small'
      ? 'text-[10.5px] leading-tight font-medium'
      : sizePreset === 'medium'
        ? 'text-[11.5px] leading-tight font-semibold'
        : 'text-xs leading-tight font-semibold'
    : 'text-[13px] font-semibold';

  return (
    <>
      {/* ── Favorites View ──────────────────── */}
{hasAnyFavoriteItems && (
        <div className={outerContainerClass}>
          {renderWidgetHeader()}
          {/* Grouped Rows — Scrollable Container */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={favGridOrder} strategy={rectSortingStrategy} disabled={isWidgetEditMode}>
              {isWidget ? (
                <div className={innerGridScrollClass}>
                  {(groupedFavs as any[]).map((group: any, groupIdx: number) => {
                    if (!group.items || group.items.length === 0) return null;
                    return (
                      <section key={group.id || group.title || groupIdx} className={`flex flex-col gap-1.5 ${groupIdx > 0 ? 'mt-3' : 'mt-0'}`}>
                        {group.title && (
                          <SortableHeader id={group.id}>
                            <div className="flex items-center gap-2 px-0.5 py-0.5 select-none">
                              <span className="text-[10px] font-bold tracking-wider capitalize text-[var(--color-textSecondary)]">
                                {group.title}
                              </span>
                            </div>
                          </SortableHeader>
                        )}
                        <div className={`grid ${gridColumnsClass} w-full items-start justify-start content-start auto-rows-max`}>
                          {(group.items as any[]).map((itemWrap: any) => {
                            const fav = itemWrap.favorite || itemWrap;
                            const isAutoMatched = itemWrap.isAutoMatched || false;
                            const renderId = `${group.id}::${fav.compoundId}`;
                            const label = fav.title || fav.key || fav.label || fav.name || 'Untitled';
                            return (
                              <SortableFavItem
                                key={renderId}
                                id={renderId}
                                disabled={isAutoMatched || isWidgetEditMode}
                                onClick={(e) => handleFavGridClick(fav, e)}
                                onContextMenu={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isWidgetEditMode) return;
                                  if (onOpenContextMenu) {
                                    onOpenContextMenu(e.clientX, e.clientY, fav);
                                  } else {
                                    setContextMenuState({ x: e.clientX, y: e.clientY, fav });
                                  }
                                }}
                                title={label}
                              >
                                {/* Circular icon */}
                                <div className={`${iconSizeClass} rounded-full flex items-center justify-center shrink-0 transition-all duration-200 group-hover/fav-item:scale-105`}>
                                  <FavGridIcon fav={fav} />
                                </div>
                                {/* Label */}
                                <span
                                  className={`${titleTextClass} group-hover/fav-item:text-[var(--color-textPrimary)] transition-all duration-200 w-full text-center truncate px-0.5 select-none ${
                                    isCarRace ? 'text-white opacity-100' : 'text-[var(--color-textPrimary)]'
                                  }`}
                                  style={{ textShadow: isCarRace ? '0 2px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)' : undefined }}
                                >
                                  {label}
                                </span>
                                {/* Type Subtitle (Hidden in Small preset) */}
                                {sizePreset !== 'small' && (
                                  <span
                                    style={{
                                      opacity: isCarRace ? 0.95 : 0.85,
                                      textShadow: isCarRace ? '0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)' : undefined,
                                      marginTop: '-2px',
                                    }}
                                    className={`text-[9.5px] w-full text-center truncate px-0.5 select-none capitalize ${
                                      isCarRace ? 'text-neutral-100 font-semibold' : 'text-[var(--color-textSecondary)] font-medium'
                                    }`}
                                  >
                                    {getFavDisplayType(fav)}
                                  </span>
                                )}
                              </SortableFavItem>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`grid ${gridColumnsClass} w-full ${innerGridScrollClass} ${favCardHovered || isSettingsOpen ? 'scrollbar-visible' : 'scrollbar-hidden'}`}
                  onMouseEnter={() => setFavCardHovered(true)}
                  onMouseLeave={() => setFavCardHovered(false)}
                >
                  {(groupedFavs as any[]).flatMap((group: any) => [
                    ...(group.title ? [
                      <SortableHeader key={group.id} id={group.id}>
                        <div className={`flex items-center gap-2 mt-3 mb-1.5 px-2 py-1 rounded-md select-none transition-all duration-200 ${activeDragId ? 'bg-white/10 border border-white/20 border-dashed animate-pulse' : ''}`}>
                          <span
                            className={`text-xs font-bold tracking-wider capitalize ${
                              isCarRace ? 'text-white opacity-100' : 'text-[var(--color-textMuted)]'
                            }`}
                            style={{ textShadow: isCarRace ? '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.8)' : undefined }}
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
                    ...(group.items as any[]).map((itemWrap: any) => {
                      const fav = itemWrap.favorite || itemWrap;
                      const isAutoMatched = itemWrap.isAutoMatched || false;
                      const renderId = `${group.id}::${fav.compoundId}`;
                      const label = fav.title || fav.key || fav.label || fav.name || 'Untitled';
                      return (
                        <SortableFavItem
                          key={renderId}
                          id={renderId}
                          disabled={isAutoMatched || isWidgetEditMode}
                          onClick={(e) => handleFavGridClick(fav, e)}
                          onContextMenu={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isWidgetEditMode) return;
                            if (onOpenContextMenu) {
                              onOpenContextMenu(e.clientX, e.clientY, fav);
                            } else {
                              setContextMenuState({ x: e.clientX, y: e.clientY, fav });
                            }
                          }}
                          title={label}
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 group-hover/fav-item:scale-105">
                            <FavGridIcon fav={fav} />
                          </div>
                          <span
                            className={`text-[13px] group-hover/fav-item:text-[var(--color-textPrimary)] transition-all duration-200 w-full text-center truncate px-1 select-none ${
                              isCarRace ? 'text-white font-semibold opacity-100' : 'text-[var(--color-textPrimary)] font-semibold'
                            }`}
                            style={{ textShadow: isCarRace ? '0 2px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8)' : undefined }}
                          >
                            {label}
                          </span>
                          <span
                            style={{
                              opacity: isCarRace ? 0.95 : 0.85,
                              textShadow: isCarRace ? '0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)' : undefined,
                              marginTop: '-2px',
                            }}
                            className={`text-[10px] w-full text-center truncate px-1 select-none capitalize ${
                              isCarRace ? 'text-neutral-100 font-semibold' : 'text-[var(--color-textSecondary)] font-medium'
                            }`}
                          >
                            {getFavDisplayType(fav)}
                          </span>
                        </SortableFavItem>
                      );
                    })
                  ])}
                </div>
              )}
            </SortableContext>
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
                              const newNames = { ...favCustomGroupNames, [groupId]: newName };
                              setFavCustomGroupNames(newNames);
                              setFavStorage({ favorites_custom_group_names: newNames });
                              if (newlyCreatedFavGroupId === option.id) {
                                setNewlyCreatedFavGroupId(null);
                              }
                            }}
                            onDelete={() => {
                              handleDeleteFavGroup(option.id);
                            }}
                            onOpenFilterTags={(e) => {
                              handleOpenFilterTagsForGroup(option.id, e);
                            }}
                            autoFocusEdit={newlyCreatedFavGroupId === option.id}
                            onCancelEdit={() => {
                              if (newlyCreatedFavGroupId === option.id) {
                                handleDeleteFavGroup(option.id);
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
                    onClick={e => {
                      e.stopPropagation();
                      const newGroupId = generateEntityId('favoriteGroup');
                      const newHeaderId = `header-${newGroupId}`;
                      const newOrder = [...favGridOrder, newHeaderId];
                      setFavGridOrder(newOrder);
                      const newNames = { ...favCustomGroupNames, [newGroupId]: '' };
                      setFavCustomGroupNames(newNames);
                      setNewlyCreatedFavGroupId(newHeaderId);
                      setFavStorage({
                        favorites_items_order: newOrder,
                        favorites_custom_group_names: newNames,
                      });
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

          {/* Unified Context Menu for Favorite Items */}
          {contextMenuState && (
            <UnifiedContextMenu
              x={contextMenuState.x}
              y={contextMenuState.y}
              onClose={() => {
                setContextMenuState(null);
                setEditingShortcutFor(null);
                setEditingHotkeyFor(null);
                setEditValue('');
              }}
              actions={buildWidgetContextMenuActions(contextMenuState.fav)}
              itemId={contextMenuState.fav.compoundId || contextMenuState.fav.id}
              hotkeyInput={
                editingHotkeyFor === (contextMenuState.fav.compoundId || contextMenuState.fav.id)
                  ? {
                      value: editValue,
                      onChange: (e: React.KeyboardEvent<HTMLInputElement>) => {
                        const result = captureHotkey(e);
                        if (result === 'CANCEL') {
                          handleCancelEdit();
                        } else if (result) {
                          setEditValue(result as string);
                        }
                      },
                      onSave: () => handleSaveHotkey(contextMenuState.fav, editValue),
                      onCancel: handleCancelEdit,
                      onClear: () => handleSaveHotkey(contextMenuState.fav, ''),
                      isSaving: false,
                    }
                  : undefined
              }
              shortcutInput={
                editingShortcutFor === (contextMenuState.fav.compoundId || contextMenuState.fav.id)
                  ? {
                      value: editValue,
                      onChange: setEditValue,
                      onSave: () => handleSaveShortcut(contextMenuState.fav, editValue),
                      onCancel: handleCancelEdit,
                      isSaving: false,
                    }
                  : undefined
              }
            />
          )}
          {renderSettingsPortal()}
      <FavoriteGroupTagFilterPopover
        isOpen={Boolean(activeTagFilterGroupId)}
        onClose={() => {
          setActiveTagFilterGroupId(null);
          setTagFilterTriggerCoords(null);
        }}
        popoverCoords={tagFilterTriggerCoords}
        initialSelectedTagIds={
          activeTagFilterGroupId
            ? favoriteCategories.find(c => c.id === activeTagFilterGroupId.replace('header-', ''))?.filterTagIds || []
            : []
        }
        availableTags={allTags}
        favoriteUsageCounts={favoriteUsageCounts}
        onApply={async (selectedTagIds) => {
          if (!activeTagFilterGroupId) return;
          const gId = activeTagFilterGroupId.replace('header-', '');
          let category = favoriteCategories.find(c => c.id === gId);
          if (!category) {
            const categoryName = favCustomGroupNames[gId] || 'Group';
            category = await createFavoriteCategory(categoryName, userId || 'local_user');
          }
          if (category?.id) {
            await updateFavoriteCategory(category.id, {
              filterTagIds: selectedTagIds,
              filterUpdatedAt: Date.now(),
            });

            if (selectedTagIds.length > 0) {
              const matchingFavs = populatedFavorites.filter(fav => {
                const favTags = getFavoriteTagIds(fav, allTags);
                return favTags.some(tId => selectedTagIds.includes(tId));
              });

              for (const fav of matchingFavs) {
                const refId = fav.reference_id || fav.id || fav.snippet_id;
                if (refId && setFavoriteCategory) {
                  await setFavoriteCategory(refId, category.id);
                  fav.favoriteCategoryId = category.id;
                }
              }

              const matchingCompoundIds = new Set(matchingFavs.map(f => f.compoundId));
              const newOrder = favGridOrder.filter(id => !matchingCompoundIds.has(id));
              const headerIndex = newOrder.indexOf(activeTagFilterGroupId);
              if (headerIndex !== -1) {
                newOrder.splice(headerIndex + 1, 0, ...Array.from(matchingCompoundIds));
              }

              setFavGridOrder(newOrder);

              const newVisible = { ...favGridVisible, [activeTagFilterGroupId]: true };
              setFavGridVisible(newVisible);

              setFavStorage({
                favorites_items_order: newOrder,
                favorites_visible_items: newVisible,
              });
            }
          }
        }}
      />
    </>
  );
};
