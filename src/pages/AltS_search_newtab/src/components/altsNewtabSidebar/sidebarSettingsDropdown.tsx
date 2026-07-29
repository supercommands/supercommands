import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { Reorder, useDragControls } from 'framer-motion';
import {
  getSidebarStorageData,
  setSidebarStorageData,
} from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import { FaCheck, FaRobot } from 'react-icons/fa';
import { FiMoreVertical, FiFileText, FiLink, FiCode, FiLayers, FiZap } from 'react-icons/fi';
import { HiArrowsUpDown } from 'react-icons/hi2';

import ReactDOM from 'react-dom';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { createFavoriteCategory } from '../../../../../allObjectFolder/src/createObject/favoriteCategory';

// ─── Drag Handle ────────────────────────────────────────────────────────────

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

// ─── Toggle Switch ───────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => (
  <div
    onClick={e => {
      e.stopPropagation();
      onToggle();
    }}
    className={`relative flex-shrink-0 w-7 h-4 rounded-full cursor-pointer transition-colors duration-200
      ${isOn ? 'bg-[#268bd2]' : 'bg-neutral-600'}`}>
    <div
      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200
        ${isOn ? 'translate-x-3.5' : 'translate-x-0.5'}`}
    />
  </div>
);

// ─── Sub-item row ────────────────────────────────────────────────────────────

interface DropdownReorderItemProps {
  option: any;
  visibleItems: Record<string, boolean>;
  toggleItemVisibility: (id: string) => void;
  dragControls?: any;
  isIndented?: boolean;
}

const DropdownReorderItem: React.FC<DropdownReorderItemProps> = ({
  option,
  visibleItems,
  toggleItemVisibility,
  dragControls: _ignoredDragControls,
  isIndented = false,
}) => {
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
        <div className="flex items-center gap-1.5 flex-1">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 dark:hover:text-neutral-200"
            onPointerDown={e => dragControls.start(e)}>
            <DragHandleIcon />
          </div>
          <span className="font-medium flex-1 py-0.5">{option.label}</span>
        </div>
      </div>
    </Reorder.Item>
  );
};

// ─── Favorite reorder item row ───────────────────────────────────────────────

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

// ─── Section header row ──────────────────────────────────────────────────────

interface SectionHeaderProps {
  id?: string;
  label: string;
  isOn: boolean;
  onToggle: () => void;
  dragControls?: any;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  useToggle?: boolean;
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
  useToggle,
  autoFocusEdit,
  onCancelEdit,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(autoFocusEdit || false);
  const [editValue, setEditValue] = useState(label);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  const dotsRef = useRef<HTMLDivElement>(null);
  const hasAppliedAutoFocusRef = useRef(false);
  const isSubmittingRef = useRef(false);

  const handleRenameSubmit = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
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

  useEffect(() => {
    if (!menuOpen) return;
    const handleClose = () => setMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [menuOpen]);

  useEffect(() => {
    if (autoFocusEdit && !hasAppliedAutoFocusRef.current) {
      setIsEditing(true);
      setEditValue(label);
      hasAppliedAutoFocusRef.current = true;
    }

    if (!autoFocusEdit) {
      hasAppliedAutoFocusRef.current = false;
    }
  }, [autoFocusEdit, label]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      isSubmittingRef.current = false;
      // Force focus to ensure search bar doesn't steal it
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isEditing]);

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
            ref={inputRef}
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleRenameSubmit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
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
        {useToggle ? (
          <ToggleSwitch isOn={isOn} onToggle={onToggle} />
        ) : (
          <div
            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer ${isOn ? 'bg-[#268bd2] border-[#268bd2] text-white' : 'border-neutral-600'}`}
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}>
            {isOn && <FaCheck size={7} />}
          </div>
        )}

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

// ─── Group Reorder Wrapper ───────────────────────────────────────────────────

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
// ─── Main component ──────────────────────────────────────────────────────────

interface SidebarSettingsDropdownProps {
  showFavoritesSection: boolean;
  onToggleFavoritesSection: (val: boolean) => void;
  showCreateSection: boolean;
  onToggleCreateSection: (val: boolean) => void;
  showViewSection: boolean;
  onToggleViewSection: (val: boolean) => void;
  sectionsOrder: string[];
  onSectionsReorder: (newOrder: string[]) => void;
  isHovered: boolean;
}

export const SidebarSettingsDropdown: React.FC<SidebarSettingsDropdownProps> = ({
  showFavoritesSection,
  onToggleFavoritesSection,
  showCreateSection,
  onToggleCreateSection,
  showViewSection,
  onToggleViewSection,
  sectionsOrder,
  onSectionsReorder,
  isHovered,
}) => {
  const { theme } = useAppearance();

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createtodo: true,
    createsession: true,
    createlinks: true,
    createnotes: true,
    ai: true,
    createsnippet: true,
    agent: true,
    'header-others': false,
    createfolder: false,
    createworkspace: false,
    'header-workflows': false,
    'header-shortcuts': false,
  });
  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>([
    'createtodo',
    'createsession',
    'createlinks',
    'createnotes',
    'ai',
    'createsnippet',
    'agent',
    'header-others',
    'createfolder',
    'createworkspace',
    'header-workflows',
    'header-shortcuts',
  ]);

  // ── View items state ──
  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({
    all: true,
    sessions: true,
    notes: true,
    todos: true,
    links: true,
    chat_agents: true,
    snippets: true,
    automations: true,
    folders: true,
    organizations: true,
    all_shortcuts: true,
    'header-workflows': false,
    'header-shortcuts': false,
    'header-others': false,
  });
  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([
    'all',
    'sessions',
    'notes',
    'todos',
    'links',
    'chat_agents',
    'snippets',
    'automations',
    'folders',
    'organizations',
    'all_shortcuts',
    'header-workflows',
    'header-shortcuts',
    'header-others',
  ]);

  const [newlyCreatedGroupId, setNewlyCreatedGroupId] = useState<string | null>(null);

  const { populatedFavorites, setFavoriteCategory } = useFavorites();
  const userId = useUser();
  const favoriteCategories = useDbStore(state => state.favoriteCategories);
  const [favoriteCategoryOrder, setFavoriteCategoryOrder] = useState<string[]>([]);
  const [draggedFavoriteId, setDraggedFavoriteId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [draftFavoriteCategoryId, setDraftFavoriteCategoryId] = useState<string | null>(null);

  useEffect(() => {
    const dbIds = favoriteCategories
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(category => category.id);

    setFavoriteCategoryOrder(prevOrder => {
      const filteredPrev = prevOrder.filter(id => dbIds.includes(id));
      const missing = dbIds.filter(id => !filteredPrev.includes(id));
      return filteredPrev.length > 0 ? [...filteredPrev, ...missing] : dbIds;
    });
  }, [favoriteCategories]);

  const favoriteGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; label: string; type?: string; originalItem?: any; favoriteCategoryId?: string | null }>;
    }> = [];

    const groupedItems = new Map<string, Array<{ id: string; label: string; type?: string; originalItem?: any; favoriteCategoryId?: string | null }>>();
    populatedFavorites.forEach(fav => {
      const item = {
        id: fav.compoundId,
        label: fav.label || (fav as any).key || (fav as any).name || 'Untitled',
        type: (fav as any).type,
        originalItem: fav,
        favoriteCategoryId: (fav as any).favoriteCategoryId || null,
      };
      const categoryId = item.favoriteCategoryId;
      if (categoryId) {
        const existing = groupedItems.get(categoryId) || [];
        existing.push(item);
        groupedItems.set(categoryId, existing);
      }
    });

    const orderedCategories = favoriteCategoryOrder.length
      ? favoriteCategoryOrder
      : favoriteCategories
          .slice()
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .map(category => category.id);

    orderedCategories.forEach(categoryId => {
      const category = favoriteCategories.find(item => item.id === categoryId);
      if (!category) return;
      groups.push({
        id: category.id,
        name: category.name,
        items: groupedItems.get(category.id) || [],
      });
    });

    return groups;
  }, [favoriteCategories, favoriteCategoryOrder, populatedFavorites]);

  const ungroupedFavoriteItems = useMemo(() => {
    return populatedFavorites
      .filter(fav => !((fav as any).favoriteCategoryId || null))
      .map(fav => ({
        id: fav.compoundId,
        label: fav.label || (fav as any).key || (fav as any).name || 'Untitled',
        type: (fav as any).type,
        originalItem: fav,
        favoriteCategoryId: null,
      }));
  }, [populatedFavorites]);

  const handleFavoriteDrop = async (categoryId: string | null) => {
    if (!draggedFavoriteId) return;
    const itemId = draggedFavoriteId;
    setDraggedFavoriteId(null);
    setDragOverCategoryId(null);
    await setFavoriteCategory(itemId, categoryId);
  };

  const handleStartFavoriteCategoryCreate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (draftFavoriteCategoryId) return;
    setDraftFavoriteCategoryId(`draft-favorite-category-${Date.now()}`);
  };

  const handleCancelFavoriteCategoryCreate = () => {
    setDraftFavoriteCategoryId(null);
  };

  const handleCreateFavoriteCategory = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName || !userId) {
      handleCancelFavoriteCategoryCreate();
      return;
    }

    const existingNames = new Set(favoriteCategories.map(category => category.name.trim().toLowerCase()));
    if (existingNames.has(trimmedName.toLowerCase())) {
      handleCancelFavoriteCategoryCreate();
      return;
    }

    await createFavoriteCategory(trimmedName, userId);
    handleCancelFavoriteCategoryCreate();
  };

  const renderedFavoriteGroups = useMemo(() => {
    if (!draftFavoriteCategoryId) return favoriteGroups;
    return [
      ...favoriteGroups,
      {
        id: draftFavoriteCategoryId,
        name: '',
        items: [],
        isDraft: true,
      },
    ];
  }, [draftFavoriteCategoryId, favoriteGroups]);

  useEffect(() => {
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local') {
        if (changes.favorites_create_items_order) {
          setCreateItemsOrder(changes.favorites_create_items_order.newValue || []);
        }
        if (changes.favorites_create_visible_items) {
          setVisibleCreateItems(changes.favorites_create_visible_items.newValue || {});
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // ── Shared group naming for create/view sections ──
  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadState = async () => {
      const result = await getSidebarStorageData(['customGroupNames']);
      if (result.customGroupNames) {
        setCustomGroupNames(result.customGroupNames);
      }
    };
    loadState();
  }, []);

  const createSectionDrag = useDragControls();
  const viewSectionDrag = useDragControls();
  const favoritesSectionDrag = useDragControls();

  // ── Load from storage ──
  useEffect(() => {
    const fetchStorage = async () => {
      const result = await getSidebarStorageData([
        'favorites_create_visible_items',
        'favorites_create_items_order',
        'sidebar_view_visible_items',
        'sidebar_view_items_order',
      ]);

      let initialCreateOrder = result.favorites_create_items_order;
      if (!initialCreateOrder) {
        initialCreateOrder = [
          'header-knowledge',
          'createnotes',
          'createlinks',
          'header-workflows',
          'createsession',
          'createtodo',
          'ai',
          'header-automations',
          'createsnippet',
          'header-workspace',
          'createfolder',
          'createworkspace',
        ];
        setSidebarStorageData({ favorites_create_items_order: initialCreateOrder });
      } else {
        if (initialCreateOrder.includes('header-others')) {
          initialCreateOrder = initialCreateOrder.map((id: string) => (id === 'header-others' ? 'header-workspace' : id));
        }
        if (!initialCreateOrder.includes('header-knowledge')) {
          const notesIdx = initialCreateOrder.indexOf('createnotes');
          if (notesIdx >= 0) {
            initialCreateOrder.splice(notesIdx, 0, 'header-knowledge');
          } else {
            initialCreateOrder = ['header-knowledge', ...initialCreateOrder];
          }
        }
        if (!initialCreateOrder.includes('header-automations')) {
          const snippetIdx = initialCreateOrder.indexOf('createsnippet');
          if (snippetIdx >= 0) {
            initialCreateOrder.splice(snippetIdx, 0, 'header-automations');
          } else {
            initialCreateOrder.push('header-automations');
          }
        }
        if (!initialCreateOrder.includes('createsnippet')) {
          const authIdx = initialCreateOrder.indexOf('header-automations');
          if (authIdx >= 0) {
            initialCreateOrder.splice(authIdx + 1, 0, 'createsnippet');
          } else {
            initialCreateOrder.push('createsnippet');
          }
        }
        if (!initialCreateOrder.includes('header-workflows')) {
          const sessionIdx = initialCreateOrder.indexOf('createsession');
          if (sessionIdx >= 0) {
            initialCreateOrder.splice(sessionIdx, 0, 'header-workflows');
          } else {
            initialCreateOrder.push('header-workflows');
          }
        }
        if (!initialCreateOrder.includes('header-workspace')) {
          const folderIdx = initialCreateOrder.indexOf('createfolder');
          if (folderIdx >= 0) {
            initialCreateOrder.splice(folderIdx, 0, 'header-workspace');
          } else {
            initialCreateOrder.push('header-workspace');
          }
        }
        initialCreateOrder = initialCreateOrder.filter((id: string) => id !== 'header-others' && id !== 'header-shortcuts' && id !== 'agent');

        const defaultAllIds = [
          'header-knowledge',
          'createnotes',
          'createlinks',
          'header-workflows',
          'createsession',
          'createtodo',
          'ai',
          'header-automations',
          'createsnippet',
          'header-workspace',
          'createfolder',
          'createworkspace',
        ];
        const missing = defaultAllIds.filter(id => !initialCreateOrder.includes(id));
        if (missing.length > 0) {
          initialCreateOrder = [...initialCreateOrder, ...missing];
        }
        const firstHeaderIdx = initialCreateOrder.findIndex((id: string) => id.startsWith('header-'));
        if (firstHeaderIdx > 0) {
          const headerId = initialCreateOrder.splice(firstHeaderIdx, 1)[0];
          initialCreateOrder.unshift(headerId);
        } else if (firstHeaderIdx === -1) {
          initialCreateOrder.unshift('header-knowledge');
        }
        setSidebarStorageData({ favorites_create_items_order: initialCreateOrder });
      }
      setCreateItemsOrder(initialCreateOrder);

      if (result.favorites_create_visible_items) {
        const stored = result.favorites_create_visible_items;
        const merged = {
          'header-knowledge': stored['header-knowledge'] ?? true,
          'header-workflows': stored['header-workflows'] ?? true,
          'header-automations': stored['header-automations'] ?? true,
          'header-workspace': stored['header-workspace'] ?? true,
          ...stored,
        };
        setVisibleCreateItems(merged);
      } else {
        const defaultVisible = {
          createnotes: true,
          createlinks: true,
          createsession: true,
          createtodo: true,
          ai: true,
          createsnippet: true,
          createfolder: false,
          createworkspace: false,
          'header-knowledge': true,
          'header-workflows': true,
          'header-automations': true,
          'header-workspace': true,
        };
        setVisibleCreateItems(defaultVisible);
        setSidebarStorageData({ favorites_create_visible_items: defaultVisible });
      }

      const hasFolders = result.sidebar_view_items_order?.includes('folders');
      const hasAllShortcuts = result.sidebar_view_items_order?.includes('all_shortcuts');
      const isOldDefault = result.sidebar_view_items_order?.[1] === 'notes';
      if (!result.sidebar_view_items_order || result.sidebar_view_items_order.length < 9 || !hasAllShortcuts || isOldDefault || !hasFolders) {
        const newOrder = [
          'sessions',
          'todos',
          'links',
          'notes',
          'chat_agents',
          'snippets',
          'automations',
          'folders',
          'organizations',
          'all',
          'all_shortcuts',
          'header-workflows',
          'header-shortcuts',
          'header-others',
        ];
        setViewItemsOrder(newOrder);
        setSidebarStorageData({ sidebar_view_items_order: newOrder });

        const newVisible = {
          ...result.sidebar_view_visible_items,
          sessions: result.sidebar_view_visible_items?.sessions ?? true,
          chat_agents: result.sidebar_view_visible_items?.chat_agents ?? true,
          folders: true,
          organizations: true,
          all_shortcuts: true,
          'header-workflows': result.sidebar_view_visible_items?.['header-workflows'] ?? false,
          'header-shortcuts': result.sidebar_view_visible_items?.['header-shortcuts'] ?? false,
          'header-others': result.sidebar_view_visible_items?.['header-others'] ?? false,
        };
        setVisibleViewItems(newVisible);
        setSidebarStorageData({ sidebar_view_visible_items: newVisible });
      } else {
        let existingViewOrder = result.sidebar_view_items_order;
        const hasViewHeaders = existingViewOrder.some((id: string) => id.startsWith('header-'));
        if (!hasViewHeaders) {
          existingViewOrder = [...existingViewOrder, 'header-workflows', 'header-shortcuts', 'header-others'];
          setSidebarStorageData({ sidebar_view_items_order: existingViewOrder });
        }
        if (result.sidebar_view_visible_items) {
          const stored = result.sidebar_view_visible_items;
          setVisibleViewItems({
            ...stored,
            'header-workflows': stored['header-workflows'] ?? false,
            'header-shortcuts': stored['header-shortcuts'] ?? false,
            'header-others': stored['header-others'] ?? false,
          });
        }
        setViewItemsOrder(existingViewOrder);
      }
    };
    fetchStorage();
  }, []);

  // ── Close on outside click ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-portal="true"]')) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers ──
  const toggleCreateItem = (id: string) => {
    const updated = { ...visibleCreateItems, [id]: !visibleCreateItems[id] };
    setVisibleCreateItems(updated);
    setSidebarStorageData({ favorites_create_visible_items: updated });
  };

  const reorderCreateItems = (newOrder: string[]) => {
    let sanitizedOrder = [...newOrder];
    const firstHeaderIdx = sanitizedOrder.findIndex(id => id.startsWith('header-'));
    if (firstHeaderIdx > 0) {
      const headerId = sanitizedOrder.splice(firstHeaderIdx, 1)[0];
      sanitizedOrder.unshift(headerId);
    } else if (firstHeaderIdx === -1) {
      sanitizedOrder.unshift('header-knowledge');
    }

    setCreateItemsOrder(sanitizedOrder);
    setSidebarStorageData({ favorites_create_items_order: sanitizedOrder });
  };

  const toggleViewItem = (id: string) => {
    const updated = { ...visibleViewItems, [id]: !visibleViewItems[id] };
    setVisibleViewItems(updated);
    setSidebarStorageData({ sidebar_view_visible_items: updated });
  };

  const reorderViewItems = (newOrder: string[]) => {
    setViewItemsOrder(newOrder);
    setSidebarStorageData({ sidebar_view_items_order: newOrder });
  };

  const toggleGroup = (
    headerId: string,
    order: string[],
    visibleItems: Record<string, boolean>,
    setVisible: any,
    storageKey: string,
  ) => {
    const headerIndex = order.indexOf(headerId);
    if (headerIndex === -1) return;

    const itemsInGroup: string[] = [];
    for (let i = headerIndex + 1; i < order.length; i++) {
      if (order[i].startsWith('header-')) break;
      itemsInGroup.push(order[i]);
    }

    if (itemsInGroup.length === 0) return;

    const isAnyChecked = itemsInGroup.some(id => visibleItems[id]);
    const newVisible = { ...visibleItems };
    itemsInGroup.forEach(id => {
      newVisible[id] = !isAnyChecked;
    });

    setVisible(newVisible);
    setSidebarStorageData({ [storageKey]: newVisible });
  };

  const handleDeleteGroup = (headerId: string) => {
    const groupId = headerId.replace('header-', '');

    const headerIndex = createItemsOrder.indexOf(headerId);
    if (headerIndex === -1) return;

    const itemsInGroup: string[] = [];
    for (let i = headerIndex + 1; i < createItemsOrder.length; i++) {
      if (createItemsOrder[i].startsWith('header-')) break;
      itemsInGroup.push(createItemsOrder[i]);
    }

    const remainingOrder = createItemsOrder.filter(id => id !== headerId);
    const orderWithoutGroupItems = remainingOrder.filter(id => !itemsInGroup.includes(id));
    const newOrder = [...itemsInGroup, ...orderWithoutGroupItems];
    setCreateItemsOrder(newOrder);

    const newVisible = { ...visibleCreateItems };
    delete newVisible[headerId];
    setVisibleCreateItems(newVisible);

    const newNames = { ...customGroupNames };
    delete newNames[groupId];
    setCustomGroupNames(newNames);

    if (newlyCreatedGroupId === headerId) {
      setNewlyCreatedGroupId(null);
    }

    setSidebarStorageData({
      favorites_create_items_order: newOrder,
      favorites_create_visible_items: newVisible,
      customGroupNames: newNames,
    });
  };

  const getFavoriteIcon = (item: any) => {
    const type = item.type || item.reference_type;
    switch (type) {
      case 'note':
        return <FiFileText size={12} className="text-neutral-500 shrink-0" />;
      case 'link': {
        const url = item.url || item.value;
        if (url && typeof url === 'string') {
          try {
            const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
            return <img src={getFaviconUrl(domain)} className="w-3.5 h-3.5 rounded-sm shrink-0" alt="" />;
          } catch {
            // ignore
          }
        }
        return <FiLink size={12} className="text-neutral-500 shrink-0" />;
      }
      case 'snippet':
        return <FiCode size={12} className="text-neutral-500 shrink-0" />;
      case 'session':
        return <FiLayers size={12} className="text-neutral-500 shrink-0" />;
      case 'chat_agent':
      case 'agent':
        return <FaRobot size={12} className="text-neutral-500 shrink-0" />;
      case 'automation':
        return <FiZap size={12} className="text-neutral-500 shrink-0" />;
      default:
        return <FiFileText size={12} className="text-neutral-500 shrink-0" />;
    }
  };

  // ── Options ──
  const createOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {
      createlinks: { id: 'createlinks', label: 'Link' },
      createsession: { id: 'createsession', label: 'Tab Session' },
      createnotes: { id: 'createnotes', label: 'Note' },
      ai: { id: 'ai', label: 'Chat Agent' },
      createtodo: { id: 'createtodo', label: 'Todo' },
      createsnippet: { id: 'createsnippet', label: 'Text Expander' },
      createfolder: { id: 'createfolder', label: 'Folder' },
      createworkspace: { id: 'createworkspace', label: 'Organization' },
      'header-knowledge': { id: 'header-knowledge', label: customGroupNames['knowledge'] || 'Knowledge' },
      'header-workflows': { id: 'header-workflows', label: customGroupNames['workflows'] || 'Workflows' },
      'header-automations': { id: 'header-automations', label: customGroupNames['automations'] || 'Automations' },
      'header-workspace': { id: 'header-workspace', label: customGroupNames['workspace'] || 'Workspace' },
    };
    createItemsOrder.forEach(id => {
      if (id.startsWith('header-') && !map[id]) {
        const groupId = id.replace('header-', '');
        map[id] = { id, label: customGroupNames[groupId] !== undefined ? customGroupNames[groupId] : groupId };
      }
    });
    return createItemsOrder.map(id => map[id]).filter(Boolean);
  }, [createItemsOrder, customGroupNames]);

  const viewOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {
      all: { id: 'all', label: 'All' },
      sessions: { id: 'sessions', label: 'Tab Sessions' },
      notes: { id: 'notes', label: 'Notes' },
      todos: { id: 'todos', label: 'Todos' },
      links: { id: 'links', label: 'Links' },
      chat_agents: { id: 'chat_agents', label: 'Chat Agents' },
      snippets: { id: 'snippets', label: 'Text Expanders' },
      folders: { id: 'folders', label: 'Folders' },
      organizations: { id: 'organizations', label: 'Organizations' },
      all_shortcuts: { id: 'all_shortcuts', label: 'All Shortcuts' },
      'header-workflows': { id: 'header-workflows', label: customGroupNames['workflows'] || 'Workflows' },
      'header-shortcuts': { id: 'header-shortcuts', label: customGroupNames['shortcuts'] || 'Shortcuts' },
      'header-others': { id: 'header-others', label: customGroupNames['others'] || 'Others' },
    };
    viewItemsOrder.forEach(id => {
      if (id.startsWith('header-') && !map[id]) {
        const groupId = id.replace('header-', '');
        map[id] = { id, label: customGroupNames[groupId] !== undefined ? customGroupNames[groupId] : groupId };
      }
    });
    return viewItemsOrder.map(id => map[id]).filter(Boolean);
  }, [viewItemsOrder, customGroupNames]);

  // ── Ensure all sections always appear in sectionsOrder ──
  const normalizedOrder = useMemo(() => {
    const order = [...sectionsOrder];
    if (!order.includes('favorites')) order.splice(1, 0, 'favorites');
    if (!order.includes('create')) order.unshift('create');
    if (!order.includes('view')) order.push('view');
    return order;
  }, [sectionsOrder]);

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Three-dots trigger */}
      <button
        onClick={e => {
          e.stopPropagation();
          if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setCoords({ top: rect.top, left: rect.right + 8 });
          }
          setIsOpen(!isOpen);
        }}
        className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-opacity duration-200 outline-none border-none cursor-pointer
          ${isHovered || isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <FiMoreVertical
          size={15}
          className="transition-colors duration-150 text-[var(--color-iconDefault)] hover:text-neutral-100"
        />
      </button>

      {/* Dropdown panel */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            data-portal="true"
            data-prevent-searchbar-capture="true"
            className="fixed z-[9999] w-52 p-2 rounded-lg border shadow-xl flex flex-col select-none overflow-y-auto max-h-[80vh] custom-scrollbar bg-[var(--color-sidebarBg)] backdrop-blur-md border-white/10 text-neutral-400 shadow-black/80"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}>
            <Reorder.Group
              axis="y"
              values={normalizedOrder}
              onReorder={onSectionsReorder}
              className="flex flex-col gap-0">
              {normalizedOrder.map((sectionId, idx) => {
                const isFirst = idx === 0;
                const sectionBorderClass = isFirst ? '' : 'pt-1.5 mt-1 border-t border-black/10 dark:border-white/10';

                if (sectionId === 'create') {
                  const groups = [
                    { title: 'Knowledge', items: ['createnotes', 'createlinks'] },
                    { title: 'Workflows', items: ['createsession', 'createtodo', 'ai'] },
                    { title: 'Automations', items: ['createsnippet'] },
                    { title: 'Workspace', items: ['createfolder', 'createworkspace'] },
                  ];
                  return (
                    <Reorder.Item
                      key="create"
                      value="create"
                      dragListener={false}
                      dragControls={createSectionDrag}
                      className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}>
                      <div className="flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300"
                            onPointerDown={e => createSectionDrag.start(e)}>
                            <DragHandleIcon />
                          </div>
                          <span className="text-[10px] font-bold tracking-wider text-neutral-500">Create</span>
                        </div>
                        <ToggleSwitch
                          isOn={showCreateSection}
                          onToggle={() => onToggleCreateSection(!showCreateSection)}
                        />
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={createItemsOrder}
                        onReorder={reorderCreateItems}
                        className="flex flex-col gap-0">
                        {(() => {
                          let hasSeenHeader = false;
                          return createOptions.map(option => {
                            if (option.id.startsWith('header-')) {
                              hasSeenHeader = true;
                              const groupId = option.id.replace('header-', '');

                              // Check if any items below it are visible
                              const headerIndex = createItemsOrder.indexOf(option.id);
                              let isOn = false;
                              for (let i = headerIndex + 1; i < createItemsOrder.length; i++) {
                                if (createItemsOrder[i].startsWith('header-')) break;
                                if (visibleCreateItems[createItemsOrder[i]]) {
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
                                  onToggle={() =>
                                    toggleGroup(
                                      option.id,
                                      createItemsOrder,
                                      visibleCreateItems,
                                      setVisibleCreateItems,
                                      'favorites_create_visible_items',
                                    )
                                  }
                                  onRename={newName => {
                                    const newNames = { ...customGroupNames, [groupId]: newName };
                                    setCustomGroupNames(newNames);
                                    setSidebarStorageData({ customGroupNames: newNames });
                                    if (newlyCreatedGroupId === option.id) {
                                      setNewlyCreatedGroupId(null);
                                    }
                                  }}
                                  onDelete={
                                    option.id.startsWith('header-custom_')
                                      ? () => handleDeleteGroup(option.id)
                                      : undefined
                                  }
                                  autoFocusEdit={newlyCreatedGroupId === option.id}
                                  onCancelEdit={() => {
                                    if (newlyCreatedGroupId === option.id) {
                                      handleDeleteGroup(option.id);
                                    }
                                  }}
                                />
                              );
                            } else {
                              return (
                                <DropdownReorderItem
                                  key={option.id}
                                  option={option}
                                  visibleItems={visibleCreateItems}
                                  toggleItemVisibility={toggleCreateItem}
                                  isIndented={hasSeenHeader}
                                />
                              );
                            }
                          });
                        })()}
                      </Reorder.Group>

                      {/* Add Custom Group Button */}
                      <div className="flex justify-center mt-2 px-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const newId = `header-custom_${Date.now()}`;
                            const newOrder = [...createItemsOrder, newId];
                            setCreateItemsOrder(newOrder);

                            const newVisible = { ...visibleCreateItems, [newId]: true };
                            setVisibleCreateItems(newVisible);

                            const newNames = { ...customGroupNames, [newId.replace('header-', '')]: '' };
                            setCustomGroupNames(newNames);

                            setNewlyCreatedGroupId(newId);

                            setSidebarStorageData({
                              favorites_create_items_order: newOrder,
                              favorites_create_visible_items: newVisible,
                              customGroupNames: newNames,
                            });
                          }}
                          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center cursor-pointer outline-none border-none bg-transparent"
                          title="Add Custom Group">
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
                    </Reorder.Item>
                  );
                }

                if (sectionId === 'view') {
                  const groups = [
                    { title: 'Workflows', items: ['sessions', 'todos'] },
                    { title: 'Shortcuts', items: ['links', 'notes', 'chat_agents', 'snippets', 'automations'] },
                    { title: 'Others', items: ['folders', 'organizations', 'all', 'all_shortcuts'] },
                  ];
                  return (
                    <Reorder.Item
                      key="view"
                      value="view"
                      dragListener={false}
                      dragControls={viewSectionDrag}
                      className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}>
                      <div className="flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300"
                            onPointerDown={e => viewSectionDrag.start(e)}>
                            <DragHandleIcon />
                          </div>
                          <span className="text-[10px] font-bold tracking-wider text-neutral-500">My Library</span>
                        </div>
                        <ToggleSwitch isOn={showViewSection} onToggle={() => onToggleViewSection(!showViewSection)} />
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={viewItemsOrder}
                        onReorder={reorderViewItems}
                        className="flex flex-col gap-0">
                        {(() => {
                          let hasSeenHeader = false;
                          return viewOptions.map(option => {
                            if (option.id.startsWith('header-')) {
                              hasSeenHeader = true;
                              const groupId = option.id.replace('header-', '');

                              const headerIndex = viewItemsOrder.indexOf(option.id);
                              let isOn = false;
                              for (let i = headerIndex + 1; i < viewItemsOrder.length; i++) {
                                if (viewItemsOrder[i].startsWith('header-')) break;
                                if (visibleViewItems[viewItemsOrder[i]]) {
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
                                  onToggle={() =>
                                    toggleGroup(
                                      option.id,
                                      viewItemsOrder,
                                      visibleViewItems,
                                      setVisibleViewItems,
                                      'sidebar_view_visible_items',
                                    )
                                  }
                                  onRename={newName => {
                                    const newNames = { ...customGroupNames, [groupId]: newName };
                                    setCustomGroupNames(newNames);
                                    setSidebarStorageData({ customGroupNames: newNames });
                                  }}
                                  onDelete={() => {}}
                                />
                              );
                            } else {
                              return (
                                <DropdownReorderItem
                                  key={option.id}
                                  option={option}
                                  visibleItems={visibleViewItems}
                                  toggleItemVisibility={toggleViewItem}
                                  isIndented={hasSeenHeader}
                                />
                              );
                            }
                          });
                        })()}
                      </Reorder.Group>
                    </Reorder.Item>
                  );
                }

                if (sectionId === 'favorites') {
                  return (
                    <Reorder.Item
                      key="favorites"
                      value="favorites"
                      dragListener={false}
                      dragControls={favoritesSectionDrag}
                      className={`list-none flex flex-col pb-2 ${sectionBorderClass}`}>
                      <div className="flex items-center justify-between px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300"
                            onPointerDown={e => favoritesSectionDrag.start(e)}>
                            <DragHandleIcon />
                          </div>
                          <span className="text-[10px] font-bold tracking-wider text-neutral-500">Favorites</span>
                        </div>
                        <ToggleSwitch
                          isOn={showFavoritesSection}
                          onToggle={() => onToggleFavoritesSection(!showFavoritesSection)}
                        />
                      </div>
                      {showFavoritesSection && (
                        <div className="flex flex-col gap-1 px-2 pb-1">
                          <Reorder.Group
                            axis="y"
                            values={renderedFavoriteGroups.map(group => group.id)}
                            onReorder={setFavoriteCategoryOrder}
                            className="flex flex-col gap-1">
                            {renderedFavoriteGroups.map(group => (
                              <Reorder.Item
                                key={group.id}
                                value={group.id}
                                dragListener={false}
                                dragControls={favoritesSectionDrag}
                                className={`list-none flex flex-col gap-0.5 rounded-md transition-colors ${dragOverCategoryId === group.id ? 'bg-white/5' : ''}`}
                                onDragEnter={(e: React.DragEvent) => {
                                  e.preventDefault();
                                  if (draggedFavoriteId) setDragOverCategoryId(group.id);
                                }}
                                onDragOver={(e: React.DragEvent) => {
                                  e.preventDefault();
                                  if (draggedFavoriteId) setDragOverCategoryId(group.id);
                                }}
                                onDragLeave={(e: React.DragEvent) => {
                                  const relatedTarget = e.relatedTarget as Node | null;
                                  if (!e.currentTarget.contains(relatedTarget) && dragOverCategoryId === group.id) {
                                    setDragOverCategoryId(null);
                                  }
                                }}
                                onDrop={async (e: React.DragEvent) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if ((group as any).isDraft) return;
                                  await handleFavoriteDrop(group.id);
                                }}>
                                {(group as any).isDraft ? (
                                  <SectionHeader
                                    id={group.id}
                                    label=""
                                    isOn
                                    onToggle={() => {}}
                                    dragControls={favoritesSectionDrag}
                                    onRename={newName => {
                                      void handleCreateFavoriteCategory(newName);
                                    }}
                                    autoFocusEdit
                                    onCancelEdit={handleCancelFavoriteCategoryCreate}
                                  />
                                ) : (
                                  <div
                                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-colors ${dragOverCategoryId === group.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                    onDragOver={e => {
                                      e.preventDefault();
                                      if (draggedFavoriteId) setDragOverCategoryId(group.id);
                                    }}>
                                    <div
                                      className="cursor-grab active:cursor-grabbing p-0.5 text-neutral-500 hover:text-neutral-300 shrink-0"
                                      onPointerDown={e => favoritesSectionDrag.start(e)}>
                                      <DragHandleIcon />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-500 truncate flex-1 min-w-0">
                                      {group.name}
                                    </span>
                                  </div>
                                )}
                                <div className="flex flex-col gap-0.5 pl-4 pr-1">
                                  {group.items.map(item => (
                                    <div
                                      key={item.id}
                                      draggable
                                      onDragStart={e => {
                                        e.stopPropagation();
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', item.id);
                                        setDraggedFavoriteId(item.id);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedFavoriteId(null);
                                        setDragOverCategoryId(null);
                                      }}
                                      className={`flex items-center gap-1.5 px-1 py-0.5 rounded-md text-[12px] text-neutral-300 cursor-grab active:cursor-grabbing ${draggedFavoriteId === item.id ? 'opacity-50' : 'hover:bg-white/5'}`}>
                                      {getFavoriteIcon(item.originalItem || item)}
                                      <span className="font-medium flex-1 py-0.5 truncate">{item.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>

                          {ungroupedFavoriteItems.length > 0 && (
                            <div
                              className={`flex flex-col gap-0.5 pt-1 rounded-md transition-colors ${dragOverCategoryId === '__root__' ? 'bg-white/5' : ''}`}
                              onDragEnter={e => {
                                e.preventDefault();
                                if (draggedFavoriteId) setDragOverCategoryId('__root__');
                              }}
                              onDragOver={e => {
                                e.preventDefault();
                                if (draggedFavoriteId) setDragOverCategoryId('__root__');
                              }}
                              onDragLeave={e => {
                                const relatedTarget = e.relatedTarget as Node | null;
                                if (!e.currentTarget.contains(relatedTarget) && dragOverCategoryId === '__root__') {
                                  setDragOverCategoryId(null);
                                }
                              }}
                              onDrop={async e => {
                                e.preventDefault();
                                e.stopPropagation();
                                await handleFavoriteDrop(null);
                              }}>
                              <div className="flex flex-col gap-0.5 pl-1">
                                {ungroupedFavoriteItems.map(item => (
                                  <div
                                    key={item.id}
                                    draggable
                                    onDragStart={e => {
                                      e.stopPropagation();
                                      e.dataTransfer.effectAllowed = 'move';
                                      e.dataTransfer.setData('text/plain', item.id);
                                      setDraggedFavoriteId(item.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggedFavoriteId(null);
                                      setDragOverCategoryId(null);
                                    }}
                                    className={`flex items-center gap-1.5 px-1 py-0.5 rounded-md text-[12px] text-neutral-300 cursor-grab active:cursor-grabbing ${draggedFavoriteId === item.id ? 'opacity-50' : 'hover:bg-white/5'}`}>
                                    {getFavoriteIcon(item.originalItem || item)}
                                    <span className="font-medium flex-1 py-0.5 truncate">{item.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="mt-2 px-2">
                            {!draftFavoriteCategoryId && (
                              <div className="flex justify-center">
                                <button
                                  type="button"
                                  onClick={handleStartFavoriteCategoryCreate}
                                  className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors flex items-center justify-center cursor-pointer outline-none border-none bg-transparent"
                                  title="Add Favorite Category">
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
                            )}
                          </div>
                        </div>
                      )}
                    </Reorder.Item>
                  );
                }

                return null;
              })}
            </Reorder.Group>
          </div>,
          document.body,
        )}
    </div>
  );
};
