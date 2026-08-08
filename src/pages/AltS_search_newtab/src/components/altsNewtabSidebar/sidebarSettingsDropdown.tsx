import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { Reorder, useDragControls } from 'framer-motion';
import {
  getSidebarStorageData,
  setSidebarStorageData,
} from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import { FaCheck, FaRobot } from 'react-icons/fa';
import { FiMoreVertical, FiFileText, FiLink, FiCode, FiLayers, FiZap, FiPlus } from 'react-icons/fi';
import { HiArrowsUpDown } from 'react-icons/hi2';

import ReactDOM from 'react-dom';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { createFavoriteCategory } from '../../../../../allObjectFolder/src/createObject/favoriteCategory';
import { loadWidgetDashboardStateAsync } from '../../../../../storage/localStorage/widgetDashboardStorage';
import type { WidgetDashboardState } from '../widgets/widgetDashboard.types';

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
      <div className="flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] font-medium">
        <div className="flex items-center gap-1.5 flex-1">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)]"
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
      <div className="flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] font-medium">
        <div className="flex items-center gap-1.5 flex-grow min-w-0">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] shrink-0"
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
    const trimmed = editValue.trim();
    if (trimmed && onRename) {
      onRename(trimmed);
    } else {
      if (onCancelEdit) {
        onCancelEdit();
      } else if (onDelete) {
        onDelete();
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
      setEditValue(''); // Start empty so user compulsorily types a name
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
    <div className="flex items-center justify-between px-1 py-1 mb-1 relative group rounded-md hover:bg-[var(--color-hoverBg)] transition-colors select-none">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div
          className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] shrink-0"
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
            placeholder="Enter Group Name..."
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
                else if (onDelete) onDelete();
              }
            }}
            onBlur={handleRenameSubmit}
            className="flex-1 bg-transparent border-b border-[var(--color-accent)] outline-none text-xs font-semibold text-[var(--color-textPrimary)] px-1 w-full"
          />
        ) : (
          <span className="text-[10px] font-bold tracking-wider uppercase truncate text-[var(--color-textMuted)]">{label}</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {useToggle ? (
          <ToggleSwitch isOn={isOn} onToggle={onToggle} />
        ) : (
          <div
            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer ${isOn ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' : 'border-[var(--color-borderDefault)] bg-[var(--color-inputBg)]'}`}
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
            className="relative group/dots cursor-pointer text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)]"
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
  const [dashboardState, setDashboardState] = useState<WidgetDashboardState | null>(null);

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
        'customGroupNames',
      ]);

      const namesMap: Record<string, string> = result.customGroupNames || customGroupNames || {};

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
        initialCreateOrder = initialCreateOrder.filter((id: string) => id !== 'header-others' && id !== 'header-shortcuts' && id !== 'agent' && id !== 'header-workspace' && id !== 'createfolder' && id !== 'createworkspace');

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
          ...stored,
        };
        delete merged['header-workspace'];
        delete merged['createfolder'];
        delete merged['createworkspace'];
        setVisibleCreateItems(merged);
      } else {
        const defaultVisible = {
          createnotes: true,
          createlinks: true,
          createsession: true,
          createtodo: true,
          ai: true,
          createsnippet: true,
          'header-knowledge': true,
          'header-workflows': true,
          'header-automations': true,
        };
        setVisibleCreateItems(defaultVisible);
        setSidebarStorageData({ favorites_create_visible_items: defaultVisible });
      }

      // Load real Dashboard Views state
      loadWidgetDashboardStateAsync()
        .then(dState => {
          setDashboardState(dState);
          const activeViews = dState?.views || [];
          const validViewIds = new Set(activeViews.map(v => v.id));

          let storedOrder: string[] = result.sidebar_view_items_order || result.dashboard_views_items_order || [];
          // Filter out legacy filter strings & un-named custom headers
          let sanitizedViewOrder = storedOrder.filter((id: string) => {
            if (id.startsWith('header-custom_')) {
              const groupId = id.replace('header-', '');
              return Boolean(namesMap[groupId] && namesMap[groupId].trim());
            }
            return validViewIds.has(id);
          });

          // Ensure all active dashboard views are present in viewItemsOrder
          activeViews.forEach(v => {
            if (!sanitizedViewOrder.includes(v.id)) {
              sanitizedViewOrder.push(v.id);
            }
          });

          setViewItemsOrder(sanitizedViewOrder);
          setSidebarStorageData({
            sidebar_view_items_order: sanitizedViewOrder,
            dashboard_views_items_order: sanitizedViewOrder,
          });
        })
        .catch(() => undefined);
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

    const isAnyChecked = itemsInGroup.length > 0 ? itemsInGroup.some(id => visibleItems[id]) : visibleItems[headerId];
    const newVisible = { ...visibleItems, [headerId]: !isAnyChecked };
    itemsInGroup.forEach(id => {
      newVisible[id] = !isAnyChecked;
    });

    setVisible(newVisible);
    setSidebarStorageData({ [storageKey]: newVisible });
  };

  const handleDeleteGroup = (headerId: string) => {
    const groupId = headerId.replace('header-', '');
    const isViewGroup = viewItemsOrder.includes(headerId);
    const sourceOrder = isViewGroup ? viewItemsOrder : createItemsOrder;

    const headerIndex = sourceOrder.indexOf(headerId);
    if (headerIndex === -1) return;

    const itemsInGroup: string[] = [];
    for (let i = headerIndex + 1; i < sourceOrder.length; i++) {
      if (sourceOrder[i].startsWith('header-')) break;
      itemsInGroup.push(sourceOrder[i]);
    }

    const remainingOrder = sourceOrder.filter(id => id !== headerId);
    const orderWithoutGroupItems = remainingOrder.filter(id => !itemsInGroup.includes(id));
    const newOrder = [...itemsInGroup, ...orderWithoutGroupItems];

    const newVisible = isViewGroup ? { ...visibleViewItems } : { ...visibleCreateItems };
    delete newVisible[headerId];

    const newNames = { ...customGroupNames };
    delete newNames[groupId];
    setCustomGroupNames(newNames);

    if (newlyCreatedGroupId === headerId) {
      setNewlyCreatedGroupId(null);
    }

    if (isViewGroup) {
      setViewItemsOrder(newOrder);
      setVisibleViewItems(newVisible);
      setSidebarStorageData({
        sidebar_view_items_order: newOrder,
        dashboard_views_items_order: newOrder,
        sidebar_view_visible_items: newVisible,
        customGroupNames: newNames,
      });
      return;
    }

    setCreateItemsOrder(newOrder);
    setVisibleCreateItems(newVisible);
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
      'header-knowledge': { id: 'header-knowledge', label: customGroupNames['knowledge'] || 'Knowledge' },
      'header-workflows': { id: 'header-workflows', label: customGroupNames['workflows'] || 'Workflows' },
      'header-automations': { id: 'header-automations', label: customGroupNames['automations'] || 'Automations' },
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
    const map: Record<string, { id: string; label: string }> = {};
    (dashboardState?.views || []).forEach(view => {
      map[view.id] = { id: view.id, label: view.title };
    });
    viewItemsOrder.forEach(id => {
      if (id.startsWith('header-') && !map[id]) {
        const groupId = id.replace('header-', '');
        const customTitle = customGroupNames[groupId];
        if (customTitle && customTitle.trim()) {
          map[id] = { id, label: customTitle.trim() };
        }
      }
    });
    return viewItemsOrder.map(id => map[id]).filter(Boolean);
  }, [viewItemsOrder, customGroupNames, dashboardState?.views]);

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
            className="fixed z-[9999] w-52 p-2 rounded-lg border shadow-xl flex flex-col select-none overflow-y-auto max-h-[80vh] custom-scrollbar bg-[var(--color-popupBg)] backdrop-blur-md border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] shadow-xl"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}>
            <div className="flex flex-col pb-2">
              <Reorder.Group
                axis="y"
                values={normalizedOrder}
                onReorder={onSectionsReorder}
                className="flex flex-col gap-1 pb-1">
                {normalizedOrder.map(sectionId => {
                  if (sectionId === 'view' && normalizedOrder[0] === 'view') {
                    return (
                      <Reorder.Item key="view" value="view" className="list-none mb-1">
                        <div className="flex items-center justify-between px-1 py-1 select-none">
                          <div className="flex items-center gap-1.5">
                            <div className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)]">
                              <DragHandleIcon />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase">Workspace Views</span>
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  }
                  if (sectionId === 'create') {
                    return (
                      <Reorder.Item key="create" value="create" className="list-none">
                        <div className="flex items-center justify-between px-1 py-1 select-none">
                          <div className="flex items-center gap-1.5">
                            <div className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)]">
                              <DragHandleIcon />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase">Create</span>
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  }
                  return null;
                })}
              </Reorder.Group>

              <div className="my-1 border-t border-[var(--color-borderDefault)]" />

              {/* Sub-items list for CREATE section */}
              <Reorder.Group
                axis="y"
                values={createItemsOrder}
                onReorder={reorderCreateItems}
                className="flex flex-col gap-0">
                {(() => {
                  let hasSeenHeader = false;
                  const optionsMap = new Map(createOptions.map(opt => [opt.id, opt]));

                  return createItemsOrder.map(id => {
                    if (id.startsWith('header-')) {
                      hasSeenHeader = true;
                      const groupId = id.replace('header-', '');
                      const defaultTitles: Record<string, string> = {
                        knowledge: 'Knowledge',
                        workflows: 'Workflows',
                        automations: 'Automations',
                        workspace: 'Workspace',
                      };
                      const title = customGroupNames[groupId] || defaultTitles[groupId] || groupId;

                      const headerIndex = createItemsOrder.indexOf(id);
                      let isOn = visibleCreateItems[id] ?? false;
                      for (let i = headerIndex + 1; i < createItemsOrder.length; i++) {
                        if (createItemsOrder[i].startsWith('header-')) break;
                        if (visibleCreateItems[createItemsOrder[i]]) {
                          isOn = true;
                          break;
                        }
                      }

                      return (
                        <GroupHeaderItem
                          key={id}
                          id={id}
                          title={title}
                          isOn={isOn}
                          onToggle={() =>
                            toggleGroup(
                              id,
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
                            if (newlyCreatedGroupId === id) {
                              setNewlyCreatedGroupId(null);
                            }
                          }}
                          onDelete={
                            id.startsWith('header-custom_')
                              ? () => handleDeleteGroup(id)
                              : undefined
                          }
                          autoFocusEdit={newlyCreatedGroupId === id}
                          onCancelEdit={() => {
                            if (newlyCreatedGroupId === id) {
                              handleDeleteGroup(id);
                            }
                          }}
                        />
                      );
                    } else {
                      const option = optionsMap.get(id);
                      if (!option) return null;
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

              {/* Add Custom Group Button for Create Section */}
              <div className="flex justify-start px-1 mt-1">
                <button
                  type="button"
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
                  className="py-1 px-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer bg-transparent border-none outline-none w-full"
                  title="Add Create Group">
                  <FiPlus size={13} />
                  <span>Add Group</span>
                </button>
              </div>

              {/* If DASHBOARD VIEWS is ordered after CREATE, render it at the very bottom after CREATE sub-items */}
              {normalizedOrder[normalizedOrder.length - 1] === 'view' && (
                <div className="mt-2.5 pt-2 border-t border-[var(--color-borderDefault)] flex flex-col gap-1.5">
                  <Reorder.Group
                    axis="y"
                    values={normalizedOrder}
                    onReorder={onSectionsReorder}>
                    <Reorder.Item key="view" value="view" className="list-none">
                      <div className="flex items-center justify-between px-1 py-1 select-none">
                        <div className="flex items-center gap-1.5">
                          <div className="cursor-grab active:cursor-grabbing p-0.5 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)]">
                            <DragHandleIcon />
                          </div>
                          <span className="text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase">Workspace Views</span>
                        </div>
                      </div>
                    </Reorder.Item>
                  </Reorder.Group>

                  {/* Sub-items list for DASHBOARD VIEWS section */}
                  <Reorder.Group
                    axis="y"
                    values={viewItemsOrder}
                    onReorder={reorderViewItems}
                    className="flex flex-col gap-0">
                    {(() => {
                      let hasSeenHeader = false;
                      const optionsMap = new Map(viewOptions.map(opt => [opt.id, opt]));

                      return viewItemsOrder.map(id => {
                        if (id.startsWith('header-')) {
                          if (!id.startsWith('header-custom_')) return null;
                          hasSeenHeader = true;
                          const groupId = id.replace('header-', '');
                          const title = customGroupNames[groupId] || '';
                          if (!title.trim() && newlyCreatedGroupId !== id) return null;

                          const headerIndex = viewItemsOrder.indexOf(id);
                          let isOn = visibleViewItems[id] ?? false;
                          for (let i = headerIndex + 1; i < viewItemsOrder.length; i++) {
                            if (viewItemsOrder[i].startsWith('header-')) break;
                            if (visibleViewItems[viewItemsOrder[i]]) {
                              isOn = true;
                              break;
                            }
                          }

                          return (
                            <GroupHeaderItem
                              key={id}
                              id={id}
                              title={title}
                              isOn={isOn}
                              onToggle={() =>
                                toggleGroup(
                                  id,
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
                                if (newlyCreatedGroupId === id) {
                                  setNewlyCreatedGroupId(null);
                                }
                              }}
                              onDelete={() => handleDeleteGroup(id)}
                              autoFocusEdit={newlyCreatedGroupId === id}
                              onCancelEdit={() => {
                                if (newlyCreatedGroupId === id) {
                                  handleDeleteGroup(id);
                                }
                              }}
                            />
                          );
                        } else {
                          const option = optionsMap.get(id);
                          if (!option) return null;
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

                  {/* Add Custom Group Button for Dashboard Views */}
                  <div className="flex justify-start px-1 mt-0.5">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const newId = `header-custom_${Date.now()}`;
                        const newOrder = [...viewItemsOrder, newId];
                        setViewItemsOrder(newOrder);

                        const newVisible = { ...visibleViewItems, [newId]: true };
                        setVisibleViewItems(newVisible);

                        const newNames = { ...customGroupNames, [newId.replace('header-', '')]: '' };
                        setCustomGroupNames(newNames);

                        setNewlyCreatedGroupId(newId);

                        setSidebarStorageData({
                          sidebar_view_items_order: newOrder,
                          sidebar_view_visible_items: newVisible,
                          customGroupNames: newNames,
                        });
                      }}
                      className="py-1 px-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer bg-transparent border-none outline-none w-full"
                      title="Add View Group">
                      <FiPlus size={13} />
                      <span>Add Group</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
