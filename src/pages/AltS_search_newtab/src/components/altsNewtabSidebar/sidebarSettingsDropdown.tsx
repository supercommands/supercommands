import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import { Reorder, useDragControls, motion } from 'framer-motion';
import {
  getSidebarStorageData,
  setSidebarStorageData,
} from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import { FaCheck } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiMoreVertical, FiFileText, FiLink, FiCode, FiLayers, FiZap, FiPlus } from 'react-icons/fi';
import { HiArrowsUpDown } from 'react-icons/hi2';

import ReactDOM from 'react-dom';
import { sanitizeAndMigrateCreateOrder } from './createMenuPanel';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../storage/store/useWidgetDashboardStore';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import {
  loadWidgetDashboardViewsForWorkspaceAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
} from '../../../../../storage/localStorage/widgetDashboardStorage';
import { normalizeDashboardViewsOrder } from '../../../../../storage/localStorage/widgetDashboardGroupStorage';

// ─── Drag Handle ────────────────────────────────────────────────────────────

const DragHandleIcon = ({ hidden = false }: { hidden?: boolean }) => (
  <svg
    width="8"
    height="12"
    viewBox="0 0 8 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={hidden ? 'opacity-0' : 'opacity-40 hover:opacity-100 transition-opacity'}>
    <circle cx="2" cy="2" r="1" fill="currentColor" />
    <circle cx="2" cy="6" r="1" fill="currentColor" />
    <circle cx="2" cy="10" r="1" fill="currentColor" />
    <circle cx="6" cy="2" r="1" fill="currentColor" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="10" r="1" fill="currentColor" />
  </svg>
);

const shouldIgnoreSidebarSettingsDrag = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest('button, input, textarea, select, [data-sidebar-settings-drag-ignore="true"]'));

const startSidebarSettingsRowDrag = (dragControls: any, e: React.PointerEvent) => {
  if (!dragControls || shouldIgnoreSidebarSettingsDrag(e.target)) return;
  dragControls.start(e);
};

// ─── Toggle Switch ───────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle }) => (
  <div
    data-sidebar-settings-drag-ignore="true"
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
      <div
        className="flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] font-medium cursor-grab active:cursor-grabbing"
        onPointerDown={e => startSidebarSettingsRowDrag(dragControls, e)}>
        <div className="flex items-center gap-1.5 flex-1">
          <div className="p-0.5 text-[var(--color-iconDefault)] shrink-0 pointer-events-none">
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
      <div
        className="flex items-center justify-between px-2 py-0.5 rounded-md text-[12px] transition-colors duration-150 select-none hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] font-medium cursor-grab active:cursor-grabbing"
        onPointerDown={e => startSidebarSettingsRowDrag(dragControls, e)}>
        <div className="flex items-center gap-1.5 flex-grow min-w-0">
          <div className="p-0.5 text-[var(--color-iconDefault)] shrink-0 pointer-events-none">
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

const ENABLE_SIDEBAR_SETTINGS_PERF_LOGS = false;

const sidebarSettingsPerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_SIDEBAR_SETTINGS_PERF_LOGS) return;
  console.log('[SidebarPerf][SettingsDropdown]', label, JSON.stringify(data || {}));
};

const summarizeOrder = (order: readonly string[]) => ({
  length: order.length,
  headers: order.filter(id => id.startsWith('header-')).length,
  items: order.filter(id => !id.startsWith('header-')).length,
  firstItems: order.slice(0, 8),
});

const hasOnlyFastActiveViewPlaceholder = (views: readonly { settings?: Record<string, unknown> }[]) =>
  views.length === 1 && views[0]?.settings?.__fastActiveViewPlaceholder === true;

const getDashboardViewGroupTitle = (groupId: string, customGroupNames: Record<string, string>) => {
  const defaultTitles: Record<string, string> = {
    custom_work: 'Work',
    custom_personal: 'Personal',
    custom_college: 'College',
    custom_default: 'Default',
    work: 'Work',
    personal: 'Personal',
    college: 'College',
  };

  return (customGroupNames[groupId] || defaultTitles[groupId] || groupId.replace(/^custom_/, '')).trim();
};

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
    <div
      className="flex items-center justify-between px-1 py-1 mb-1 relative group rounded-md hover:bg-[var(--color-hoverBg)] transition-colors select-none cursor-grab active:cursor-grabbing"
      onPointerDown={e => startSidebarSettingsRowDrag(dragControls, e)}>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div className="p-0.5 text-[var(--color-iconDefault)] shrink-0 pointer-events-none">
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
            data-sidebar-settings-drag-ignore="true"
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
            data-sidebar-settings-drag-ignore="true"
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

  const workspaces = useDbStore(state => state.workspaces);
  const isStoreInitialized = useDbStore(state => state.isInitialized);
  const activeWorkspaceId = workspaces[0]?.id || 'default';

  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const [visibleCreateItems, setVisibleCreateItems] = useState<Record<string, boolean>>({
    createnotes: true,
    createlinks: true,
    ai: true,
    createsnippet: true,
    createtodo: true,
  });
  const [createItemsOrder, setCreateItemsOrder] = useState<string[]>([
    'createnotes',
    'createlinks',
    'ai',
    'createsnippet',
    'createtodo',
  ]);

  // ── View items state ──
  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({});
  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([]);
  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
  const dashboardState = useWidgetDashboardStore(state => state.state);
  const refreshDashboard = useWidgetDashboardStore(state => state.refresh);

  const [newlyCreatedGroupId, setNewlyCreatedGroupId] = useState<string | null>(null);
  // Ref mirror avoids stale closures inside refreshCollectionConfiguration
  const newlyCreatedGroupIdRef = useRef<string | null>(null);
  useEffect(() => {
    newlyCreatedGroupIdRef.current = newlyCreatedGroupId;
  }, [newlyCreatedGroupId]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const createSectionDrag = useDragControls();
  const viewSectionDrag = useDragControls();
  const favoritesSectionDrag = useDragControls();

  const refreshCollectionConfiguration = React.useCallback(
    async (targetWorkspaceId: string) => {
      const startedAt = performance.now();
      try {
        sidebarSettingsPerf('refresh-config:start', {
          targetWorkspaceId,
          hasDashboardState: Boolean(dashboardState),
          willRefreshDashboard: !dashboardState,
          newlyCreatedGroupId,
        });
        const dState = dashboardState ?? (await refreshDashboard(targetWorkspaceId, { activeViewOnly: true }));

        if (!isMountedRef.current) return;

        const result = await getSidebarStorageData([
          'favorites_create_visible_items',
          'favorites_create_items_order',
          'sidebar_view_visible_items',
          'dashboard_views_items_order',
          'customGroupNames',
        ]);

        if (!isMountedRef.current) return;

        const namesMap: Record<string, string> = result.customGroupNames || {};
        setCustomGroupNames(namesMap);

        const migratedCreateOrder = sanitizeAndMigrateCreateOrder(result.favorites_create_items_order);
        setCreateItemsOrder(migratedCreateOrder);
        if (JSON.stringify(result.favorites_create_items_order || []) !== JSON.stringify(migratedCreateOrder)) {
          setSidebarStorageData({ favorites_create_items_order: migratedCreateOrder });
        }

        if (result.favorites_create_visible_items) {
          const stored = result.favorites_create_visible_items;
          const merged = {
            ...stored,
          };
          delete merged['createsession'];
          delete merged['header-shortcuts'];
          delete merged['header-automations'];
          delete merged['header-workspace'];
          delete merged['createfolder'];
          delete merged['createworkspace'];
          delete merged['header-knowledge'];
          delete merged['header-workflows'];
          setVisibleCreateItems(merged);
        } else {
          const defaultVisible = {
            createnotes: true,
            createlinks: true,
            ai: true,
            createsnippet: true,
            createtodo: true,
          };
          setVisibleCreateItems(defaultVisible);
        }

        const activeViews = hasOnlyFastActiveViewPlaceholder(dState?.views || [])
          ? await loadWidgetDashboardViewsForWorkspaceAsync(targetWorkspaceId)
          : dState?.views || [];
        if (!isMountedRef.current) return;
        let storedOrder: string[] = result.dashboard_views_items_order || [];
        const normalizedViewsOrder = normalizeDashboardViewsOrder({
          workspaceId: targetWorkspaceId,
          views: activeViews,
          currentOrder: storedOrder,
          customGroupNames: namesMap,
          visibleItems: result.sidebar_view_visible_items || {},
        });
        let sanitizedViewOrder = normalizedViewsOrder.order;

        if (newlyCreatedGroupIdRef.current && !sanitizedViewOrder.includes(newlyCreatedGroupIdRef.current)) {
          sanitizedViewOrder = [...sanitizedViewOrder, newlyCreatedGroupIdRef.current];
        }

        setViewItemsOrder(sanitizedViewOrder);
        setCustomGroupNames(normalizedViewsOrder.customGroupNames);
        setVisibleViewItems(normalizedViewsOrder.visibleItems);
        sidebarSettingsPerf('refresh-config:done', {
          durationMs: Math.round(performance.now() - startedAt),
          targetWorkspaceId,
          viewCount: activeViews.length,
          order: summarizeOrder(sanitizedViewOrder),
          storageKeys: Object.keys(result),
        });

        if (normalizedViewsOrder.isChanged) {
          setSidebarStorageData({
            dashboard_views_items_order: sanitizedViewOrder,
            sidebar_view_visible_items: normalizedViewsOrder.visibleItems,
            customGroupNames: normalizedViewsOrder.customGroupNames,
          });
        }
      } catch (err) {
        sidebarSettingsPerf('refresh-config:error', {
          durationMs: Math.round(performance.now() - startedAt),
          message: err instanceof Error ? err.message : String(err),
        });
        console.error('[sidebarSettingsDropdown] Failed to refresh collection configuration:', err);
      }
    },
    [dashboardState, refreshDashboard],
  );

  // Refresh configuration whenever the dropdown opens
  useEffect(() => {
    if (isOpen && isStoreInitialized && workspaces.length > 0) {
      sidebarSettingsPerf('dropdown-open:refresh-config', {
        activeWorkspaceId,
        hasDashboardState: Boolean(dashboardState),
      });
      void refreshCollectionConfiguration(activeWorkspaceId);
    }
  }, [isOpen, isStoreInitialized, activeWorkspaceId, dashboardState, refreshCollectionConfiguration, workspaces.length]);

  // Listen to chrome storage changes and WIDGET_DASHBOARD_STORAGE_EVENT
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      if (!isOpen) return;
      if (!isStoreInitialized) return;
      if (workspaces.length === 0) return;
      const keys = Object.keys(changes);
      sidebarSettingsPerf('chrome-storage:changed', {
        areaName,
        keys,
        relevantKeys: keys.filter(key =>
          key === 'favorites_create_items_order' ||
          key === 'favorites_create_visible_items' ||
          key === 'sidebar_view_items_order' ||
          key === 'dashboard_views_items_order' ||
          key === 'sidebar_view_visible_items' ||
          key === 'customGroupNames'
        ),
      });
      if (areaName === 'local') {
        if (
          changes.favorites_create_items_order ||
          changes.favorites_create_visible_items ||
          changes.sidebar_view_items_order ||
          changes.dashboard_views_items_order ||
          changes.sidebar_view_visible_items ||
          changes.customGroupNames
        ) {
          void refreshCollectionConfiguration(activeWorkspaceId);
        }
      }
    };

    const handleDashboardChange = () => {
      if (!isOpen) return;
      if (!isStoreInitialized) return;
      if (workspaces.length === 0) return;
      sidebarSettingsPerf('dashboard-event:received', {
        event: WIDGET_DASHBOARD_STORAGE_EVENT,
        activeWorkspaceId,
      });
      void refreshCollectionConfiguration(activeWorkspaceId);
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleDashboardChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleDashboardChange);
    };
  }, [activeWorkspaceId, isOpen, isStoreInitialized, refreshCollectionConfiguration, workspaces.length]);

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
    sidebarSettingsPerf('create-visible:toggle', {
      id,
      nextValue: updated[id],
    });
    setVisibleCreateItems(updated);
    setSidebarStorageData({ favorites_create_visible_items: updated });
  };

  const reorderCreateItems = (newOrder: string[]) => {
    const sanitizedOrder = sanitizeAndMigrateCreateOrder(newOrder);

    setCreateItemsOrder(sanitizedOrder);
    sidebarSettingsPerf('create-order:save', {
      order: summarizeOrder(sanitizedOrder),
    });
    setSidebarStorageData({ favorites_create_items_order: sanitizedOrder });
  };

  const toggleViewItem = (id: string) => {
    const updated = { ...visibleViewItems, [id]: !visibleViewItems[id] };
    sidebarSettingsPerf('view-visible:toggle', {
      id,
      nextValue: updated[id],
    });
    setVisibleViewItems(updated);
    setSidebarStorageData({ sidebar_view_visible_items: updated });
  };

  const reorderViewItems = (newOrder: string[]) => {
    sidebarSettingsPerf('view-order:save', {
      previous: summarizeOrder(viewItemsOrder),
      next: summarizeOrder(newOrder),
    });
    setViewItemsOrder(newOrder);
    setSidebarStorageData({ dashboard_views_items_order: newOrder });
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
    sidebarSettingsPerf('group:toggle', {
      headerId,
      storageKey,
      itemCount: itemsInGroup.length,
      nextValue: !isAnyChecked,
    });
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
    const isNewUnnamedGroup = newlyCreatedGroupId === headerId;

    if (newlyCreatedGroupId === headerId) {
      setNewlyCreatedGroupId(null);
    }

    if (isViewGroup) {
      sidebarSettingsPerf('view-group:delete', {
        headerId,
        itemCount: itemsInGroup.length,
        nextOrder: summarizeOrder(newOrder),
      });
      setViewItemsOrder(newOrder);
      setVisibleViewItems(newVisible);
      if (!isNewUnnamedGroup) {
        setSidebarStorageData({
          dashboard_views_items_order: newOrder,
          sidebar_view_visible_items: newVisible,
          customGroupNames: newNames,
        });
      }
      return;
    }

    sidebarSettingsPerf('create-group:delete', {
      headerId,
      itemCount: itemsInGroup.length,
      nextOrder: summarizeOrder(newOrder),
    });
    setCreateItemsOrder(newOrder);
    setVisibleCreateItems(newVisible);
    if (!isNewUnnamedGroup) {
      setSidebarStorageData({
        favorites_create_items_order: newOrder,
        favorites_create_visible_items: newVisible,
        customGroupNames: newNames,
      });
    }
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
        return <LuSparkles size={12} className="text-neutral-500 shrink-0" />;
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
      createnotes: { id: 'createnotes', label: 'Note' },
      ai: { id: 'ai', label: 'Chat Agent' },
      createtodo: { id: 'createtodo', label: 'Todo' },
      createsnippet: { id: 'createsnippet', label: 'Text Expander' },
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
        const customTitle = getDashboardViewGroupTitle(groupId, customGroupNames);
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
          <motion.div
            layoutScroll
            data-portal="true"
            data-prevent-searchbar-capture="true"
            className="fixed z-[9999] w-64 p-3 rounded-xl border flex flex-col select-none overflow-y-auto max-h-[85vh] custom-scrollbar bg-[var(--color-popupBg,#141416)] backdrop-blur-xl border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] shadow-2xl"
            style={{ top: `${coords.top}px`, left: `${coords.left}px` }}>
            {/* Top Title & Subtitle Header */}
            <div className="flex flex-col gap-0.5 px-1 pb-2.5 mb-2.5 border-b border-white/10 dark:border-white/10 shrink-0">
              <h3 className="text-sm font-bold text-[var(--color-textPrimary)] tracking-tight">Grouping</h3>
              <p className="text-[11px] text-[var(--color-textMuted)] leading-snug">Group items in Create and Collections.</p>
            </div>

            <div className="flex flex-col gap-3">
              {/* BOX 1: CREATE SECTION */}
              <div className="rounded-xl border border-white/10 dark:border-white/10 bg-white/[0.02] dark:bg-white/[0.03] p-2.5 flex flex-col gap-1">
                {/* Header & Subtitle */}
                <div className="flex flex-col gap-0.5 pb-2 mb-1 border-b border-white/10 dark:border-white/10">
                  <span className="text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase">CREATE</span>
                  <span className="text-[10px] text-[var(--color-textMuted)] opacity-80">Organize items in the Create menu.</span>
                </div>

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
                          shortcuts: 'Shortcuts',
                          automations: 'Automations',
                          knowledge: 'Knowledge',
                          workflows: 'Workflows',
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
                              sidebarSettingsPerf('create-group:rename', {
                                headerId: id,
                                groupId,
                                newName,
                              });
                              setCustomGroupNames(newNames);
                              if (newlyCreatedGroupId === id) {
                                setNewlyCreatedGroupId(null);
                                setSidebarStorageData({
                                  favorites_create_items_order: createItemsOrder,
                                  favorites_create_visible_items: visibleCreateItems,
                                  customGroupNames: newNames,
                                });
                              } else {
                                setSidebarStorageData({ customGroupNames: newNames });
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
                <div className="flex justify-start px-1 mt-1 pt-1 border-t border-white/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const newId = `header-${generateEntityId('customSidebarGroup')}`;
                      const newOrder = [...createItemsOrder, newId];
                      sidebarSettingsPerf('create-group:add', {
                        headerId: newId,
                        nextOrder: summarizeOrder(newOrder),
                      });
                      setCreateItemsOrder(newOrder);

                      const newVisible = { ...visibleCreateItems, [newId]: true };
                      setVisibleCreateItems(newVisible);

                      const newNames = { ...customGroupNames, [newId.replace('header-', '')]: '' };
                      setCustomGroupNames(newNames);

                      setNewlyCreatedGroupId(newId);
                    }}
                    className="py-1 px-1.5 flex items-center justify-start gap-1.5 text-[11px] font-medium text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer bg-transparent border-none outline-none w-full rounded hover:bg-[var(--color-hoverBg)]"
                    title="Add Create Group">
                    <FiPlus size={13} />
                    <span>Add Group</span>
                  </button>
                </div>
              </div>

              {/* BOX 2: COLLECTIONS SECTION */}
              <div className="rounded-xl border border-white/10 dark:border-white/10 bg-white/[0.02] dark:bg-white/[0.03] p-2.5 flex flex-col gap-1">
                {/* Header & Subtitle */}
                <div className="flex flex-col gap-0.5 pb-2 mb-1 border-b border-white/10 dark:border-white/10">
                  <span className="text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase">COLLECTIONS</span>
                  <span className="text-[10px] text-[var(--color-textMuted)] opacity-80">Organize your collections items</span>
                </div>

                {/* Sub-items list for COLLECTIONS section */}
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
                        hasSeenHeader = true;
                        const groupId = id.replace('header-', '');
                        const title = getDashboardViewGroupTitle(groupId, customGroupNames);
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
                              sidebarSettingsPerf('view-group:rename', {
                                headerId: id,
                                groupId,
                                newName,
                              });
                              setCustomGroupNames(newNames);
                              if (newlyCreatedGroupId === id) {
                                setNewlyCreatedGroupId(null);
                                setSidebarStorageData({
                                  dashboard_views_items_order: viewItemsOrder,
                                  sidebar_view_visible_items: visibleViewItems,
                                  customGroupNames: newNames,
                                });
                              } else {
                                setSidebarStorageData({ customGroupNames: newNames });
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

                {/* Add Custom Group Button for COLLECTIONS Section */}
                <div className="flex justify-start px-1 mt-1 pt-1 border-t border-white/10 dark:border-white/10">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const newId = `header-${generateEntityId('customSidebarGroup')}`;
                      const newOrder = [...viewItemsOrder, newId];
                      sidebarSettingsPerf('view-group:add', {
                        headerId: newId,
                        nextOrder: summarizeOrder(newOrder),
                      });
                      setViewItemsOrder(newOrder);

                      const newVisible = { ...visibleViewItems, [newId]: true };
                      setVisibleViewItems(newVisible);

                      const newNames = { ...customGroupNames, [newId.replace('header-', '')]: '' };
                      setCustomGroupNames(newNames);

                      setNewlyCreatedGroupId(newId);
                    }}
                    className="py-1 px-1.5 flex items-center justify-start gap-1.5 text-[11px] font-medium text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer bg-transparent border-none outline-none w-full rounded hover:bg-[var(--color-hoverBg)]"
                    title="Add View Group">
                    <FiPlus size={13} />
                    <span>Add Group</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>,
          document.body,
        )}
    </div>
  );
};
