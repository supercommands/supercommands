import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../storage/store/useWidgetDashboardStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import ReactDOM from 'react-dom';
import { FaCaretDown, FaCaretRight } from 'react-icons/fa';
import { FiMoreVertical } from 'react-icons/fi';
import { LuCircleHelp, LuExternalLink, LuLayers, LuLayoutGrid, LuPencil, LuPin, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  loadWidgetDashboardStateAsync,
  createWidgetDashboardViewAsync,
  deleteWidgetDashboardViewAsync,
  deleteWidgetInstanceAsync,
  addWidgetInstanceAsync,
  getWidgetCountForDashboardViewAsync,
  isSingleInstanceWidgetType,
  renameWidgetDashboardViewAsync,
  setDefaultWidgetDashboardViewAsync,
  switchWidgetDashboardViewAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
  FIXED_SESSION_STRIP_SESSION_SETTING_KEY,
} from '../../../../../storage/localStorage/widgetDashboardStorage';
import { getCurrentDashboardWindowIdAsync } from '../../../../../storage/localStorage/widgetDashboardWindowViewStorage';
import type { WidgetDashboardState, WidgetInstance } from '../widgets/widgetDashboard.types';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import {
  getViewsSectionCollapsed,
  setViewsSectionCollapsed,
  VIEWS_SECTION_COLLAPSED_STORAGE_KEY,
} from '../../../../../storage/localStorage/viewsSectionCollapseStorage';
import { reconcileExistingOnboardingViews, normalizeDashboardViewsOrder } from '../../../../../storage/localStorage/widgetDashboardGroupStorage';

import { useShortcutValidation, saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import { clearHotkey, saveHotkey, useHotkeyValidation } from '../../../../../shared-components/hotkeys';
import { buildHotkeyString, normalizeHotkeyString } from '../../../../../shared-components/hotkeys/core/eventParser';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';

import {
  DASHBOARD_VIEW_ICONS,
  DashboardViewIcon,
  DEFAULT_VIEW_ICON_ID,
  normalizeDashboardViewIconId,
  type DashboardViewIconId,
} from './dashboardViewIcons';
import { getWidgetTypeLabel } from '../widgets/utils/widgetTypeLabel';
import { getWidgetHeaderIcon } from '../widgets/utils/widgetHeaderIcons';
import WidgetCatalogGrid from '../widgets/components/WidgetCatalogGrid';
import { WIDGET_CATALOG_CATEGORIES, type WidgetCatalogItem } from '../widgets/widgetCatalog';
import { updateSession, deleteSession } from '../../../../../allObjectFolder/src/createObject/session/sessionData';
import CreateCollectionDialog, {
  createEmptySessionDraft,
  type CreateCollectionDialogState,
  type CreateSessionDraft,
} from './CreateCollectionDialog';

const SessionEditorView = React.lazy(
  () => import('../../../../../allObjectFolder/src/createObject/session/ui/SessionEditorView'),
);

type ViewDialogState =
  | CreateCollectionDialogState
  | {
      mode: 'rename';
      viewId: string;
      title: string;
      shortcut?: string;
      hotkey?: string;
      hotkeyError?: string | null;
      isDefault: boolean;
      viewIconId: DashboardViewIconId;
      shortcutConflictId?: string | null;
      isShortcutOverrideable?: boolean;
      shortcutError?: string | null;
    }
  | { mode: 'delete'; viewId: string; title: string; widgetCount: number; hasLinkedSession: boolean; deleteLinkedSession: boolean; linkedSessionId: string | null }
  | null;

const ENABLE_SIDEBAR_VIEWS_PERF_LOGS = false;

const sidebarViewsPerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_SIDEBAR_VIEWS_PERF_LOGS) return;
  console.log('[SidebarPerf][ViewsSection]', label, JSON.stringify(data || {}));
};

const summarizeOrder = (order: readonly string[]) => ({
  length: order.length,
  headers: order.filter(id => id.startsWith('header-')).length,
  views: order.filter(id => !id.startsWith('header-')).length,
  firstItems: order.slice(0, 8),
});

const hasOnlyFastActiveViewPlaceholder = (views: readonly { settings?: Record<string, unknown> }[]) =>
  views.length === 1 && views[0]?.settings?.__fastActiveViewPlaceholder === true;

const getMappedValueForView = (map: Record<string, string>, viewId: string): string => {
  const directValue = map[viewId];
  if (directValue) return directValue;
  const matchingKey = Object.keys(map).find(key =>
    key === viewId ||
    key.endsWith(`-${viewId}`) ||
    key.endsWith(`:${viewId}`) ||
    key.endsWith(`_${viewId}`),
  );
  return matchingKey ? map[matchingKey] || '' : '';
};

const normalizeWidgetType = (value: unknown): string => String(value || '').toLowerCase().trim();

const getWidgetDisplayName = (widget: WidgetInstance): string =>
  String(widget.title || '').trim() ||
  getWidgetTypeLabel(widget.type) ||
  'Widget';

const getCatalogWidgetDisplayName = (item: WidgetCatalogItem): string =>
  String(item.title || '').trim() ||
  getWidgetTypeLabel(item.type) ||
  'Widget';

const getDefaultWidgetSettings = (type: string | undefined) =>
  type === 'link-library' ||
  type === 'ai-prompt-library' ||
  type === 'snippet-library' ||
  type === 'note-library'
    ? {
        sourceMode: 'all' as const,
        selectedCollectionIds: [],
        selectedPromptIds: [],
        selectedSnippetIds: [],
        selectedNoteIds: [],
        selectedTagIds: [],
        tagMatchMode: 'any' as const,
        sortBy: 'saved-order' as const,
        enableSearch: false,
      }
    : {};

const requiresExternalPicker = (item: WidgetCatalogItem): boolean =>
  item.type === 'note-item' || item.type === 'html' || item.type === 'session-item';

const getWidgetSessionId = (widget: WidgetInstance | undefined): string | null => {
  if (!widget) return null;
  if (widget.sessionId) return widget.sessionId;
  if (widget.referenceType === 'session' && widget.referenceId) return widget.referenceId;
  return null;
};

const getViewLinkedSession = (
  dashboardState: WidgetDashboardState | null | undefined,
  viewId: string | null | undefined,
): { sessionId: string; widgetId: string } | null => {
  if (!dashboardState || !viewId) return null;

  const view = dashboardState.views.find(candidate => candidate.id === viewId);
  const settingsSessionId = view?.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
  const fixedSessionId = typeof settingsSessionId === 'string' && settingsSessionId.trim() ? settingsSessionId : null;
  const sessionWidget = dashboardState.widgets.find(widget => {
    if (widget.viewId !== viewId) return false;
    return normalizeWidgetType(widget.type) === 'session-item';
  });
  const widgetSessionId = getWidgetSessionId(sessionWidget);
  const sessionId = fixedSessionId || widgetSessionId;
  if (!sessionId) return null;

  return {
    sessionId,
    widgetId: sessionWidget?.id || `view-session-${viewId}`,
  };
};

const SortableViewItem = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDragStart={e => e.preventDefault()}
      draggable="false"
      className={`relative w-full select-none ${isDragging ? 'grabbing opacity-0 pointer-events-none' : 'cursor-grab'}`}>
      {children}
    </div>
  );
};

const SortableHeader = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDragStart={e => e.preventDefault()}
      draggable="false"
      className={`w-full select-none ${isDragging ? 'opacity-0 pointer-events-none' : 'cursor-grab'}`}>
      {children}
    </div>
  );
};

interface SidebarDashboardViewsSectionProps {
  widthMode?: string;
  isCollapsed?: boolean;
}

type CurrentWindowSessionStatus = {
  sessionId: string;
  deepFocusMode: boolean;
} | null;

interface FocusedSessionHoverControlProps {
  enabled: boolean;
  sessionTitle: string;
  isUpdating: boolean;
  onTurnOff: () => Promise<void>;
  children: React.ReactNode;
}

const FocusedSessionHoverControl: React.FC<FocusedSessionHoverControlProps> = ({
  enabled,
  sessionTitle,
  isUpdating,
  onTurnOff,
  children,
}) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; side: 'left' | 'right' }>({
    left: 0,
    top: 0,
    side: 'right',
  });

  const cancelClose = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const openPopover = () => {
    if (!enabled) return;
    cancelClose();
    setIsOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 120);
  };

  useEffect(() => {
    if (!enabled) setIsOpen(false);
  }, [enabled]);

  React.useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popoverWidth = 176;
      const popoverHeight = 44;
      const viewportMargin = 8;
      const anchorGap = 8;
      const preferredLeft = rect.right + anchorGap;
      const opensOnRight = preferredLeft + popoverWidth <= window.innerWidth - viewportMargin;
      const left = opensOnRight
        ? preferredLeft
        : Math.max(viewportMargin, rect.left - popoverWidth - anchorGap);
      const top = Math.max(
        viewportMargin,
        Math.min(rect.top + rect.height / 2 - popoverHeight / 2, window.innerHeight - popoverHeight - viewportMargin),
      );
      setPosition({ left, top, side: opensOnRight ? 'right' : 'left' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => () => cancelClose(), []);

  return (
    <div
      ref={anchorRef}
      className="w-full"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
      onFocusCapture={openPopover}
      onBlurCapture={scheduleClose}>
      {children}
      {enabled && isOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          role="dialog"
          aria-label={`${sessionTitle} focus mode`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          className="fixed z-[10050] flex w-44 items-center justify-between gap-3 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,var(--color-editorBg))] px-3 py-2 text-[var(--color-textPrimary)] shadow-lg"
          style={{ left: position.left, top: position.top }}>
          <span
            aria-hidden="true"
            className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-[var(--color-cardBg,var(--color-editorBg))] ${
              position.side === 'right'
                ? '-left-1.5 border-b border-l border-[var(--color-borderDefault)]'
                : '-right-1.5 border-r border-t border-[var(--color-borderDefault)]'
            }`}
          />
          <span className="truncate text-xs font-semibold">Focus mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={true}
            aria-label={`Turn off focus mode for ${sessionTitle}`}
            title="Turn off focus mode"
            disabled={isUpdating}
            onClick={() => void onTurnOff()}
            className="widget-settings-search-toggle relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing,var(--color-borderActive))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-cardBg,var(--color-editorBg))] disabled:cursor-wait disabled:opacity-60">
            <span
              aria-hidden="true"
              className="pointer-events-none block h-[16px] w-[16px] translate-x-[19px] rounded-full transition-transform duration-200"
            />
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

export const SidebarDashboardViewsSection: React.FC<SidebarDashboardViewsSectionProps> = ({ widthMode, isCollapsed = false }) => {
  const [isViewsExpanded, setIsViewsExpanded] = useState<boolean>(true);
  const isShrunk = false;
  const dashboardState = useWidgetDashboardStore(state => state.state);
  const loadDashboard = useWidgetDashboardStore(state => state.load);
  const refreshDashboard = useWidgetDashboardStore(state => state.refresh);
  const setDashboardState = useWidgetDashboardStore(state => state.setDashboardState);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [pendingViewActionId, setPendingViewActionId] = useState<string | null>(null);
  const [viewActionError, setViewActionError] = useState<string | null>(null);
  const [viewDialog, setViewDialog] = useState<ViewDialogState>(null);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState<boolean>(false);
  const [isViewActionsMenuOpen, setIsViewActionsMenuOpen] = useState(false);
  const [editingViewHeaderField, setEditingViewHeaderField] = useState<'title' | 'shortcut' | 'hotkey' | null>(null);
  const [deletingWidgetId, setDeletingWidgetId] = useState<string | null>(null);
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = useState(false);
  const [pendingWidgetAddIds, setPendingWidgetAddIds] = useState<Set<string>>(new Set());
  const [stagedCreateWidgets, setStagedCreateWidgets] = useState<WidgetCatalogItem[]>([]);
  const [stagedCreateSessionDraft, setStagedCreateSessionDraft] = useState<CreateSessionDraft>(createEmptySessionDraft);
  const iconTriggerRef = useRef<HTMLButtonElement | null>(null);
  const iconPickerRef = useRef<HTMLDivElement | null>(null);
  const viewActionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewActionsMenuRef = useRef<HTMLDivElement | null>(null);
  const viewSelectorRef = useRef<HTMLDivElement | null>(null);

  const workspaces = useDbStore(state => state.workspaces);
  const isStoreInitialized = useDbStore(state => state.isInitialized);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const activeWorkspaceId = workspaces[0]?.id || 'default';
  const { validateShortcut } = useShortcutValidation();
  const { validateHotkey } = useHotkeyValidation();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const hotkeyInputRef = useRef<HTMLInputElement>(null);

  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([]);
  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({});
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [currentWindowSessionStatus, setCurrentWindowSessionStatus] = useState<CurrentWindowSessionStatus>(null);
  const [focusModeUpdatingSessionId, setFocusModeUpdatingSessionId] = useState<string | null>(null);
  const lastDragOverLogKeyRef = useRef<string | null>(null);
  const reconciledWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isStoreInitialized ||
      !activeWorkspaceId ||
      activeWorkspaceId === 'default' ||
      reconciledWorkspaceRef.current === activeWorkspaceId
    ) return;
    reconciledWorkspaceRef.current = activeWorkspaceId;
    void reconcileExistingOnboardingViews(activeWorkspaceId)
      .then(result => (result.changed ? refreshDashboard(activeWorkspaceId, { activeViewOnly: false }) : null))
      .catch(error => {
        reconciledWorkspaceRef.current = null;
        console.error('[SidebarDashboardViewsSection] Failed to reconcile onboarding groups:', error);
      });
  }, [activeWorkspaceId, isStoreInitialized, refreshDashboard]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = (event: any) => {
    const activeId = String(event.active.id);
    sidebarViewsPerf('drag:start', {
      activeId,
      order: summarizeOrder(viewItemsOrder),
    });
    lastDragOverLogKeyRef.current = null;
    setActiveDragId(activeId);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const oldIndex = viewItemsOrder.indexOf(activeId);
    const newIndex = viewItemsOrder.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) return;

    // ── Dragging a GROUP HEADER: move header + its children as a single block ──
    if (activeId.startsWith('header-')) {
      const children: string[] = [];
      for (let i = oldIndex + 1; i < viewItemsOrder.length; i++) {
        if (viewItemsOrder[i].startsWith('header-')) break;
        children.push(viewItemsOrder[i]);
      }
      const block = [activeId, ...children];

      // Strip the whole block from a copy of the order
      const withoutBlock = viewItemsOrder.filter(id => !block.includes(id));

      let insertAt = withoutBlock.indexOf(overId);
      if (insertAt === -1) insertAt = withoutBlock.length;

      // When moving DOWN onto another header, insert after that header's children
      if (overId.startsWith('header-') && oldIndex < newIndex) {
        let end = insertAt + 1;
        while (end < withoutBlock.length && !withoutBlock[end].startsWith('header-')) end++;
        insertAt = end;
      }

      const newOrder = [
        ...withoutBlock.slice(0, insertAt),
        ...block,
        ...withoutBlock.slice(insertAt),
      ];

      const logKey = `${activeId}:${overId}:${oldIndex}:${insertAt}`;
      if (lastDragOverLogKeyRef.current !== logKey) {
        lastDragOverLogKeyRef.current = logKey;
        sidebarViewsPerf('drag:order-preview:header', {
          activeId,
          overId,
          oldIndex,
          insertAt,
          blockSize: block.length,
          order: summarizeOrder(newOrder),
        });
      }
      setViewItemsOrder(newOrder);
      return;
    }

    // ── Dragging a VIEW: standard logic, prevent going above first group header ──
    const newOrder = [...viewItemsOrder];
    newOrder.splice(oldIndex, 1);
    const adjustedNewIndex = newOrder.indexOf(overId);

    let targetIndex: number;
    if (overId.startsWith('header-') && oldIndex < newIndex) {
      targetIndex = adjustedNewIndex + 1;
    } else {
      targetIndex = adjustedNewIndex;
    }

    const firstHeaderIndex = newOrder.findIndex(id => id.startsWith('header-'));
    if (firstHeaderIndex !== -1 && targetIndex <= firstHeaderIndex) {
      targetIndex = firstHeaderIndex + 1;
    }

    newOrder.splice(targetIndex, 0, activeId);
    const logKey = `${activeId}:${overId}:${oldIndex}:${targetIndex}`;
    if (lastDragOverLogKeyRef.current !== logKey) {
      lastDragOverLogKeyRef.current = logKey;
      sidebarViewsPerf('drag:order-preview', {
        activeId,
        overId,
        oldIndex,
        newIndex,
        targetIndex,
        order: summarizeOrder(newOrder),
      });
    }
    setViewItemsOrder(newOrder);
  };
  const handleDragEnd = async () => {
    sidebarViewsPerf('drag:end', {
      activeDragId,
      order: summarizeOrder(viewItemsOrder),
      writesStorage: true,
      dispatchesDashboardEvent: false,
    });

    const dragId = activeDragId;
    lastDragOverLogKeyRef.current = null;
    setActiveDragId(null);

    // Check if the dragged item was placed under the Personal header
    let draggedIntoPersonal = false;
    let draggedOutOfPersonal = false;

    if (dragId && !dragId.startsWith('header-')) {
      const view = dashboardState?.views?.find(v => v.id === dragId);
      const personalHeaderIndex = viewItemsOrder.indexOf('header-custom_personal');
      
      if (personalHeaderIndex !== -1) {
        let inPersonal = false;
        for (let i = personalHeaderIndex + 1; i < viewItemsOrder.length; i++) {
          if (viewItemsOrder[i].startsWith('header-')) break;
          if (viewItemsOrder[i] === dragId) {
            inPersonal = true;
            break;
          }
        }
        
        if (inPersonal) {
          draggedIntoPersonal = true;
        } else if (view && view.isDefault) {
          draggedOutOfPersonal = true;
        }
      }
    }

    if (draggedIntoPersonal && dragId) {
      const view = dashboardState?.views?.find(v => v.id === dragId);
      if (view && !view.isDefault) {
        try {
          const nextState = await setDefaultWidgetDashboardViewAsync(dragId, activeWorkspaceId);
          setDashboardState(nextState, activeWorkspaceId);
          return;
        } catch (error) {
          console.error('[Sidebar] Failed to set default view on drag end:', error);
        }
      }
    }

    if (draggedOutOfPersonal && dragId) {
      const firstValidViewId = viewItemsOrder.find(id => !id.startsWith('header-') && id !== dragId);
      if (firstValidViewId) {
        try {
          const nextState = await setDefaultWidgetDashboardViewAsync(firstValidViewId, activeWorkspaceId);
          setDashboardState(nextState, activeWorkspaceId);
          return;
        } catch (error) {
          console.error('[Sidebar] Failed to promote new default view on drag out:', error);
        }
      }
    }

    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({
        dashboard_views_items_order: viewItemsOrder,
      });
    }
  };

  const activeDialogHotkey = viewDialog && viewDialog.mode !== 'delete' ? viewDialog.hotkey : null;

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (!viewDialog || viewDialog.mode === 'delete') return;
      const { shortcut } = viewDialog as any;
      const viewId = (viewDialog as any).viewId;
      if (shortcut) {
        const res = await validateShortcut(shortcut, viewId || 'new');
        if (active) {
          setViewDialog(prev =>
            prev && prev.mode !== 'delete'
              ? {
                  ...prev,
                  shortcutError: !res.isValid ? res.errorMessage || 'This shortcut is already taken.' : null,
                  isShortcutOverrideable: !!res.isOverrideable,
                  shortcutConflictId: res.conflictId || null,
                }
              : prev,
          );
        }
      } else {
        if (active) {
          setViewDialog(prev =>
            prev && prev.mode !== 'delete'
              ? {
                  ...prev,
                  shortcutError: null,
                  isShortcutOverrideable: false,
                  shortcutConflictId: null,
                }
              : prev,
          );
        }
      }
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [
    viewDialog?.mode === 'delete' ? null : (viewDialog as any)?.shortcut,
    viewDialog?.mode,
    viewDialog?.mode === 'delete' ? null : (viewDialog as any)?.viewId,
    validateShortcut,
  ]);

  useEffect(() => {
    let active = true;
    const checkHotkey = async () => {
      if (!viewDialog || viewDialog.mode === 'delete') return;
      const result = await validateHotkey(viewDialog.hotkey || '', viewDialog.mode === 'rename' ? viewDialog.viewId || '' : 'new');
      if (!active) return;
      setViewDialog(prev =>
        prev && prev.mode !== 'delete'
          ? { ...prev, hotkeyError: result.isValid ? null : result.errorMessage || 'This hotkey is already taken.' }
          : prev,
      );
    };
    void checkHotkey();
    return () => {
      active = false;
    };
  }, [activeDialogHotkey, viewDialog?.mode, validateHotkey]);

  useEffect(() => {
    if (!viewDialog || viewDialog.mode !== 'rename') return;
    if (editingViewHeaderField === 'hotkey') return;
    const mappedHotkey = getMappedValueForView(hotkeysMap, viewDialog.viewId || '');
    if (mappedHotkey && mappedHotkey !== viewDialog.hotkey) {
      setViewDialog(prev =>
        prev && prev.mode === 'rename' ? { ...prev, hotkey: mappedHotkey, hotkeyError: null } : prev,
      );
    }
  }, [editingViewHeaderField, hotkeysMap, viewDialog]);

  // Handle icon picker outside click and Escape key behavior
  useEffect(() => {
    if (!isIconPickerOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        iconPickerRef.current?.contains(target) ||
        iconTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setIsIconPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsIconPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isIconPickerOpen]);

  useEffect(() => {
    if (!isViewActionsMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        viewActionsMenuRef.current?.contains(target) ||
        viewActionsTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setIsViewActionsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsViewActionsMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isViewActionsMenuOpen]);

  // Close icon picker whenever main viewDialog closes or changes mode
  useEffect(() => {
    setIsIconPickerOpen(false);
    setIsViewActionsMenuOpen(false);
    setEditingViewHeaderField(null);
  }, [viewDialog?.mode]);

  const handleOverrideShortcut = async () => {
    if (!viewDialog || viewDialog.mode === 'delete') return;
    const { shortcutConflictId } = viewDialog as any;
    if (shortcutConflictId) {
      await clearShortcut(shortcutConflictId, shortcutConflictId, 'collection');
    }
    setViewDialog(prev =>
      prev && prev.mode !== 'delete'
        ? {
            ...prev,
            shortcutError: null,
            isShortcutOverrideable: false,
            shortcutConflictId: null,
          }
        : prev,
    );
  };

  const fetchDashboardState = () => {
    sidebarViewsPerf('dashboard-load:request', {
      source: 'mount',
      activeWorkspaceId,
    });
    loadDashboard(activeWorkspaceId, { activeViewOnly: true })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!isStoreInitialized) return undefined;
    if (workspaces.length === 0) return undefined;

    fetchDashboardState();

    const loadCollapseState = async () => {
      const isCollapsed = await getViewsSectionCollapsed();
      setIsViewsExpanded(!isCollapsed);
    };
    loadCollapseState();
    const handleStorageChange = () => {
      sidebarViewsPerf('dashboard-event:received', {
        event: WIDGET_DASHBOARD_STORAGE_EVENT,
        activeWorkspaceId,
      });
      void refreshDashboard(activeWorkspaceId, { activeViewOnly: false });
    };

    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleStorageChange);

    const handleChromeStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      sidebarViewsPerf('chrome-storage:changed', {
        areaName,
        keys: Object.keys(changes),
        relevantKeys: Object.keys(changes).filter(key =>
          key === 'dashboard_views_items_order' ||
          key === 'sidebar_view_visible_items' ||
          key === 'customGroupNames' ||
          key === VIEWS_SECTION_COLLAPSED_STORAGE_KEY
        ),
      });
      if (changes[VIEWS_SECTION_COLLAPSED_STORAGE_KEY]) {
        setIsViewsExpanded(changes[VIEWS_SECTION_COLLAPSED_STORAGE_KEY].newValue !== true);
      }
    };

    const chromeAny = (window as any)?.chrome;
    chromeAny?.storage?.onChanged?.addListener(handleChromeStorageChange);

    return () => {
      window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleStorageChange);
      chromeAny?.storage?.onChanged?.removeListener(handleChromeStorageChange);
    };
  }, [activeWorkspaceId, isStoreInitialized, loadDashboard, refreshDashboard, workspaces.length]);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local || !chromeAny?.runtime?.sendMessage) return undefined;

    let mounted = true;
    const updateCurrentWindowSession = async () => {
      const windowId = await getCurrentDashboardWindowIdAsync();
      if (!mounted || typeof windowId !== 'number') return;

      const response = await chromeAny.runtime.sendMessage({
        action: 'get_active_session_status',
        windowId,
      }).catch(() => null);
      if (!mounted) return;
      const activeSession = response?.ok === true ? response.active_session : null;

      setCurrentWindowSessionStatus(
        activeSession?.sessionId
          ? {
              sessionId: String(activeSession.sessionId),
              deepFocusMode: activeSession.deepFocusMode === true,
            }
          : null,
      );
    };

    void updateCurrentWindowSession();
    const handleActiveSessionChange = (changes: { [key: string]: any }, areaName: string) => {
      if (areaName !== 'local' || !changes.active_sessions) return;
      void updateCurrentWindowSession();
    };

    chromeAny.storage.onChanged.addListener(handleActiveSessionChange);
    return () => {
      mounted = false;
      chromeAny.storage.onChanged.removeListener(handleActiveSessionChange);
    };
  }, []);

  useEffect(() => {
    if (!isViewDropdownOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!viewSelectorRef.current?.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsViewDropdownOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isViewDropdownOpen]);

  const handleToggleViewsExpanded = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsViewsExpanded(prev => {
      const next = !prev;
      setViewsSectionCollapsed(!next);
      return next;
    });
  };

  const handleSwitchView = async (viewId: string) => {
    setIsViewDropdownOpen(false);
    setViewActionError(null);

    // Explicitly wipe reader and editor states on navigation to guarantee a clean view
    useUIStore.getState().closeSheet();
    useUIStore.getState().clearEditorStates();
    useUIStore.getState().setView({ type: 'home' });

    setPendingViewActionId(viewId);
    try {
      const nextState = await switchWidgetDashboardViewAsync(viewId, activeWorkspaceId, {
        trigger: 'manual-click',
        forceDispatch: true,
      });
      setDashboardState(nextState, activeWorkspaceId);
    } catch (error) {
      console.error('[DashboardAutoRun][sidebar] switch failed', error);
      setViewActionError(error instanceof Error ? error.message : 'Could not switch view.');
    } finally {
      setPendingViewActionId(null);
    }
  };

  const handleOpenViewSession = async (viewId: string) => {
    setIsViewDropdownOpen(false);
    setPendingViewActionId(viewId);
    setViewActionError(null);

    try {
      const didLaunch = await launchDashboardCollectionView(viewId, {
        workspaceId: activeWorkspaceId,
        mode: 'open',
      });
      if (!didLaunch) {
        setViewActionError('Could not open this session view.');
      }
    } catch (error) {
      console.error('[DashboardAutoRun][sidebar] explicit open failed', error);
      setViewActionError(error instanceof Error ? error.message : 'Could not open this session view.');
    } finally {
      setPendingViewActionId(null);
    }
  };

  const handleTurnOffFocusMode = async (sessionId: string) => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.runtime?.sendMessage || focusModeUpdatingSessionId) return;

    setFocusModeUpdatingSessionId(sessionId);
    setViewActionError(null);
    try {
      const response = await chromeAny.runtime.sendMessage({
        action: 'deep_focus_turn_off',
        sessionId,
      });
      if (response?.ok !== true) {
        throw new Error(response?.error || 'Could not turn off focus mode.');
      }
      setCurrentWindowSessionStatus(current =>
        current?.sessionId === sessionId
          ? { ...current, deepFocusMode: false }
          : current,
      );
    } catch (error) {
      console.error('[SidebarDashboardViews] failed to turn off focus mode', error);
      setViewActionError(error instanceof Error ? error.message : 'Could not turn off focus mode.');
    } finally {
      setFocusModeUpdatingSessionId(null);
    }
  };

  const handleCreateView = () => {
    setIsViewDropdownOpen(false);
    setViewActionError(null);
    setStagedCreateWidgets([]);
    setStagedCreateSessionDraft(createEmptySessionDraft());
    setIsWidgetPickerOpen(false);
    setViewDialog({ mode: 'create', title: '', shortcut: '', hotkey: '', viewIconId: DEFAULT_VIEW_ICON_ID });
  };

  const handleRenameView = (viewId: string) => {
    if (!dashboardState) return;
    const view = dashboardState.views.find(v => v.id === viewId);
    if (!view) return;

    setIsViewDropdownOpen(false);
    setViewActionError(null);
    setIsWidgetPickerOpen(false);
    const existingShortcut = getMappedValueForView(shortcutsMap, viewId);
    const existingHotkey = getMappedValueForView(hotkeysMap, viewId);
    const viewIconId = normalizeDashboardViewIconId(view.settings?.viewIconId);
    setViewDialog({
      mode: 'rename',
      viewId,
      title: view.title,
      shortcut: existingShortcut,
      hotkey: existingHotkey,
      isDefault: Boolean(view.isDefault),
      viewIconId,
    });
    // If we're editing a non-active view and widgets are scoped to activeViewId, load full workspace dashboard state
    if (viewId !== dashboardState.activeViewId) {
      void loadWidgetDashboardStateAsync(activeWorkspaceId).then(fullState => {
        if (fullState) setDashboardState(fullState, activeWorkspaceId);
      });
    }
  };

  const handleDeleteView = async (viewId: string) => {
    if (!dashboardState || dashboardState.views.length <= 1) return;
    const view = dashboardState.views.find(v => v.id === viewId);
    if (!view) return;

    setIsViewDropdownOpen(false);
    setIsWidgetPickerOpen(false);
    const widgetCount = await getWidgetCountForDashboardViewAsync(viewId, activeWorkspaceId);
    setViewActionError(null);
    const linkedSession = getViewLinkedSession(dashboardState, viewId);
    setViewDialog({
      mode: 'delete',
      viewId,
      title: view.title,
      widgetCount,
      hasLinkedSession: !!linkedSession,
      deleteLinkedSession: !!linkedSession,
      linkedSessionId: linkedSession?.sessionId || null,
    });
  };

  const handleDeleteWidgetFromDialog = async (viewId: string, widgetId: string) => {
    if (!dashboardState || deletingWidgetId) return;
    setDeletingWidgetId(widgetId);
    try {
      const nextState = await deleteWidgetInstanceAsync(viewId, widgetId, activeWorkspaceId);
      setDashboardState(nextState);
    } catch (error) {
      console.error('[SidebarDashboardViewsSection] Failed to delete widget from view dialog:', error);
    } finally {
      setDeletingWidgetId(null);
    }
  };

  const closeViewDialog = () => {
    setViewDialog(null);
    setEditingViewHeaderField(null);
    setIsIconPickerOpen(false);
    setIsViewActionsMenuOpen(false);
    setIsWidgetPickerOpen(false);
    setStagedCreateWidgets([]);
    setStagedCreateSessionDraft(createEmptySessionDraft());
  };

  const addWidgetToView = async (viewId: string, item: WidgetCatalogItem): Promise<WidgetDashboardState | null> => {
    if (!dashboardState || pendingWidgetAddIds.has(item.id)) return null;

    const itemType = normalizeWidgetType(item.type);
    const linkedSession =
      itemType === 'session-item' ? getViewLinkedSession(dashboardState, viewId) : null;
    if (requiresExternalPicker(item) && !linkedSession) return null;

    setPendingWidgetAddIds(prev => new Set(prev).add(item.id));
    try {
      const categoryId = WIDGET_CATALOG_CATEGORIES.find(category =>
        category.items.some(categoryItem => categoryItem.id === item.id),
      )?.id;
      const { state } = await addWidgetInstanceAsync(
        {
          categoryId,
          title: linkedSession ? 'Session Widget' : item.title,
          type: item.type,
          sessionId: linkedSession?.sessionId,
          sessionTitle: linkedSession ? 'Session Widget' : undefined,
          settings: getDefaultWidgetSettings(item.type),
          sizePreset: item.sizePreset,
        },
        item.layout,
        viewId,
        activeWorkspaceId,
      );
      return state;
    } catch (error) {
      console.error('[SidebarDashboardViewsSection] Failed to add widget from view dialog:', error);
      return null;
    } finally {
      setPendingWidgetAddIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleAddWidgetFromDialog = async (viewId: string, item: WidgetCatalogItem) => {
    const state = await addWidgetToView(viewId, item);
    if (!state) return;
    setDashboardState(state);
    setIsWidgetPickerOpen(false);
  };

  const handleStageCreateWidget = (item: WidgetCatalogItem) => {
    if (pendingWidgetAddIds.has(item.id) || requiresExternalPicker(item)) return;
    setStagedCreateWidgets(prev => [...prev, item]);
    setIsWidgetPickerOpen(false);
  };

  const handleRemoveStagedCreateWidget = (index: number) => {
    setStagedCreateWidgets(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmitViewDialog = async () => {
    if (!viewDialog) return;
    if (viewDialog.mode !== 'delete' && (viewDialog.shortcutError || viewDialog.hotkeyError)) return;

    setPendingViewActionId('action');
    setViewActionError(null);
    try {
      if (viewDialog.mode === 'create') {
        const result = await createWidgetDashboardViewAsync(viewDialog.title, activeWorkspaceId, {
          viewIconId: viewDialog.viewIconId,
        });
        let nextState = 'state' in result ? result.state : result;
        const newViewId = nextState.activeViewId;
        const shortcut = (viewDialog as any).shortcut;
        if (shortcut && newViewId) {
          await saveShortcut(newViewId, newViewId, shortcut, viewDialog.title || 'View', 'collection');
        }
        if (newViewId && viewDialog.hotkey) {
          await saveHotkey(newViewId, newViewId, normalizeHotkeyString(viewDialog.hotkey), 'collection');
        }
        const createdSessionId = 'createdSessionId' in result ? result.createdSessionId : null;
        const hasSessionDraftChanges =
          stagedCreateSessionDraft.urls.length > 0 || Boolean(stagedCreateSessionDraft.sessionOpenSettings);
        if (createdSessionId && hasSessionDraftChanges) {
          await updateSession(createdSessionId, {
            title: viewDialog.title || stagedCreateSessionDraft.title || 'Untitled Tab Session',
            urls: stagedCreateSessionDraft.urls,
            sessionOpenSettings: stagedCreateSessionDraft.sessionOpenSettings,
            workspaceId: stagedCreateSessionDraft.workspaceId || undefined,
            folderId: stagedCreateSessionDraft.folderId,
            tagIds: stagedCreateSessionDraft.tagIds,
          });
        }
        if (newViewId && stagedCreateWidgets.length > 0) {
          for (const item of stagedCreateWidgets) {
            const state = await addWidgetToView(newViewId, item);
            if (state) nextState = state;
          }
        }
        setDashboardState(nextState, activeWorkspaceId);
      } else if (viewDialog.mode === 'rename' && viewDialog.viewId) {
        const targetViewId = viewDialog.viewId;
        let nextState = await renameWidgetDashboardViewAsync(targetViewId, viewDialog.title, activeWorkspaceId, {
          viewIconId: viewDialog.viewIconId,
        });
        if (viewDialog.isDefault && !nextState.views.find(view => view.id === targetViewId)?.isDefault) {
          nextState = await setDefaultWidgetDashboardViewAsync(targetViewId, activeWorkspaceId);
        }
        setDashboardState(nextState, activeWorkspaceId);
        const shortcut = (viewDialog as any).shortcut;
        if (shortcut) {
          await saveShortcut(targetViewId, targetViewId, shortcut, viewDialog.title || 'View', 'collection');
        } else if (shortcut === '') {
          await clearShortcut(targetViewId, targetViewId, 'collection');
        }
        if (viewDialog.hotkey) {
          await saveHotkey(targetViewId, targetViewId, normalizeHotkeyString(viewDialog.hotkey), 'collection');
        } else {
          await clearHotkey(targetViewId, targetViewId, 'collection');
        }
      } else if (viewDialog.mode === 'delete' && viewDialog.viewId) {
        const targetViewId = viewDialog.viewId;
        const nextState = await deleteWidgetDashboardViewAsync(targetViewId, activeWorkspaceId);
        setDashboardState(nextState, activeWorkspaceId);
        await clearShortcut(targetViewId, targetViewId, 'collection');
        await clearHotkey(targetViewId, targetViewId, 'collection');

        if (viewDialog.hasLinkedSession && viewDialog.deleteLinkedSession && viewDialog.linkedSessionId) {
          try {
            await deleteSession(viewDialog.linkedSessionId);
          } catch (e) {
            console.error('[SidebarDashboardViewsSection] failed to delete linked session', e);
          }
        }
      }
      closeViewDialog();
    } catch (error) {
      setViewActionError(error instanceof Error ? error.message : 'Could not update view.');
    } finally {
      setPendingViewActionId(null);
    }
  };

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(
        ['dashboard_views_items_order', 'sidebar_view_visible_items', 'customGroupNames'],
        (result: any) => {
          const order = result?.dashboard_views_items_order;
          sidebarViewsPerf('storage:init', {
            hasOrder: Array.isArray(order),
            order: Array.isArray(order) ? summarizeOrder(order) : undefined,
            hasVisibleItems: Boolean(result?.sidebar_view_visible_items),
            hasCustomGroupNames: Boolean(result?.customGroupNames),
          });
          if (order && Array.isArray(order) && order.length > 0) {
            setViewItemsOrder(order);
          }
          if (result?.sidebar_view_visible_items) {
            setVisibleViewItems(result.sidebar_view_visible_items);
          }
          if (result?.customGroupNames) {
            setCustomGroupNames(result.customGroupNames);
          }
        },
      );

      const handleStorageChange = (changes: { [key: string]: any }) => {
        if (changes['dashboard_views_items_order']) {
          const newOrder = changes['dashboard_views_items_order']?.newValue || [];
          sidebarViewsPerf('order-storage:changed', {
            order: summarizeOrder(newOrder),
          });
          if (newOrder.length > 0) {
            setViewItemsOrder(newOrder);
          }
        }
        if (changes['sidebar_view_visible_items']) {
          sidebarViewsPerf('visible-storage:changed', {
            visibleCount: Object.keys(changes['sidebar_view_visible_items'].newValue || {}).length,
          });
          setVisibleViewItems(changes['sidebar_view_visible_items'].newValue || {});
        }
        if (changes['customGroupNames']) {
          sidebarViewsPerf('group-names-storage:changed', {
            groupCount: Object.keys(changes['customGroupNames'].newValue || {}).length,
          });
          setCustomGroupNames(changes['customGroupNames'].newValue || {});
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => chromeAny.storage.onChanged.removeListener(handleStorageChange);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!dashboardState?.views || dashboardState.views.length === 0) return;
    const allViews = dashboardState.views;
    if (hasOnlyFastActiveViewPlaceholder(allViews)) {
      sidebarViewsPerf('order:skip-fast-placeholder', {
        activeViewId: dashboardState.activeViewId,
        viewCount: allViews.length,
      });
      return;
    }
    const validViewIds = new Set(allViews.map(v => v.id));
    setViewItemsOrder(prevOrder => {
      const normalizedResult = normalizeDashboardViewsOrder({
        views: allViews,
        currentOrder: prevOrder,
        customGroupNames,
        visibleItems: visibleViewItems,
      });

      const nextOrder = normalizedResult.order;
      const isDifferent =
        nextOrder.length !== prevOrder.length ||
        nextOrder.some((val, idx) => val !== prevOrder[idx]);

      if (isDifferent) {
        sidebarViewsPerf('order:normalized-from-dashboard-state', {
          previous: summarizeOrder(prevOrder),
          next: summarizeOrder(nextOrder),
          viewCount: allViews.length,
        });

        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set({
            dashboard_views_items_order: nextOrder,
            sidebar_view_visible_items: normalizedResult.visibleItems,
            customGroupNames: normalizedResult.customGroupNames,
          });
        }

        // Also update local state for visible items and custom group names if they changed
        setVisibleViewItems(normalizedResult.visibleItems);
        setCustomGroupNames(normalizedResult.customGroupNames);

        return nextOrder;
      }
      return prevOrder;
    });
  }, [dashboardState?.views, customGroupNames, visibleViewItems]);

  return (
    <div className="group/workspaceViews flex flex-col select-none w-full mt-2.5">
      {/* Accordion Caret Header */}
      <div className={`${isCollapsed ? 'px-0.5' : 'px-2'} pt-1.5 pb-1 flex flex-col`}>
        <button
          type="button"
          aria-label={isViewsExpanded ? 'Collapse Workspace Collection' : 'Expand Workspace Collection'}
          aria-expanded={isViewsExpanded}
          onClick={handleToggleViewsExpanded}
          className={`w-full ${isCollapsed ? 'grid grid-cols-[10px_minmax(0,1fr)] items-center gap-0.5 px-1' : 'relative flex h-7 items-center gap-2 pl-2 pr-10'} py-1 rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors text-left cursor-pointer`}>
          <LuLayers
            size={isCollapsed ? 10 : 14}
            className="shrink-0 text-[var(--color-accent)]"
            fill="currentColor"
            fillOpacity={0.18}
          />
          <span className={`${isCollapsed ? 'min-w-0 truncate whitespace-nowrap text-left text-[8px] leading-none tracking-normal' : 'min-w-0 flex-1 truncate whitespace-nowrap text-[12.5px] tracking-normal'} font-medium capitalize text-[var(--color-textMuted)]`}>
            {isCollapsed ? 'Collection' : 'Workspace Collection'}
          </span>
          {!isCollapsed && (
            <span className="absolute right-8 flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-textMuted)]">
              {isViewsExpanded ? <FaCaretDown size={12} /> : <FaCaretRight size={12} />}
            </span>
          )}
        </button>
        <div className={`${isCollapsed ? 'w-[calc(100%+0.25rem)] -mx-0.5' : 'w-full'} border-b border-[var(--color-borderDefault)] mt-1`} />
      </div>

      {/* Expanded Direct Group & Item Content */}
      {isViewsExpanded && (
        <div ref={viewSelectorRef} className={`flex flex-col ${isCollapsed ? 'px-0.5' : 'px-2'} pt-0 pb-1`}>
          {(() => {
            const allViews = dashboardState?.views || [];
            if (hasOnlyFastActiveViewPlaceholder(allViews)) {
              return null;
            }
            const validViewIds = new Set(allViews.map(v => v.id));
            const viewsMap = new Map(allViews.map(v => [v.id, v]));

            // Filter out non-view IDs (like legacy notes, folders)
            let orderedItemIds: string[] = viewItemsOrder.filter(id => {
              if (id.startsWith('header-')) return true;
              return validViewIds.has(id);
            });

            orderedItemIds = orderedItemIds.filter(id => id !== 'header-custom_default');

            // Ensure all current views are present
            allViews.forEach(v => {
              if (!orderedItemIds.includes(v.id)) {
                orderedItemIds.push(v.id);
              }
            });

            return (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}>
                <SortableContext items={orderedItemIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-0.5">
                    {orderedItemIds.map((id, index) => {
                      if (id.startsWith('header-')) {
                        const hasActiveChild = (() => {
                          for (let i = index + 1; i < orderedItemIds.length; i++) {
                            if (orderedItemIds[i].startsWith('header-')) break;
                            if (orderedItemIds[i] === dashboardState?.activeViewId) return true;
                          }
                          return false;
                        })();
                        if (visibleViewItems[id] === false && !hasActiveChild) return null;
                        const groupId = id.replace('header-', '');
                        const defaultTitle = groupId === 'custom_work' ? 'Work' : groupId === 'custom_personal' ? 'Personal' : groupId === 'custom_college' ? 'College' : groupId.replace(/^custom_/, '');
                        const groupTitle = customGroupNames[groupId] || defaultTitle;

                        return (
                          <SortableHeader key={id} id={id}>
                            <div
                              className={`flex items-center ${isCollapsed ? (index === 0 ? 'mt-1' : 'mt-2') : (index === 0 ? 'mt-1' : 'mt-2.5')} mb-0.5 ${isCollapsed ? 'pl-2 pr-1 justify-start text-left' : 'px-2'} select-none`}>
                              <span
                                className={`${isCollapsed ? 'min-w-0 max-w-full whitespace-nowrap text-left text-[8px] leading-none tracking-normal' : 'min-w-0 max-w-full truncate whitespace-nowrap text-[12px] tracking-normal'} font-medium capitalize text-[var(--color-textMuted)]`}
                                title={groupTitle}>
                                {groupTitle}
                              </span>
                            </div>
                          </SortableHeader>
                        );
                      }

                      const view = viewsMap.get(id);
                      if (!view) return null;

                      const viewTitle = view.title || 'Untitled';
                      const viewShortcut = getMappedValueForView(shortcutsMap, view.id);
                      const viewHotkey = getMappedValueForView(hotkeysMap, view.id);
                      const linkedSession = getViewLinkedSession(dashboardState, view.id);
                      const isLinkedSessionRunning =
                        Boolean(linkedSession?.sessionId) &&
                        linkedSession?.sessionId === currentWindowSessionStatus?.sessionId;
                      const isLinkedSessionFocused =
                        isLinkedSessionRunning && currentWindowSessionStatus?.deepFocusMode === true;
                      const sessionStatusTitle = isLinkedSessionFocused
                        ? 'Session running in Focus Mode'
                        : 'Session running';

                      const isActive = view.id === dashboardState?.activeViewId;
                      if (!isActive && visibleViewItems[id] === false) return null;
                      return (
                        <SortableViewItem key={view.id} id={view.id}>
                          <FocusedSessionHoverControl
                            enabled={isLinkedSessionFocused && activeDragId === null}
                            sessionTitle={linkedSession?.sessionId ? viewTitle : 'Session'}
                            isUpdating={focusModeUpdatingSessionId === linkedSession?.sessionId}
                            onTurnOff={() => handleTurnOffFocusMode(linkedSession!.sessionId)}>
                            <div
                              onClick={() => handleSwitchView(view.id)}
                              onContextMenu={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRenameView(view.id);
                              }}
                              aria-current={isActive ? 'page' : undefined}
                              className={`group/view-row relative flex w-full ${
                                isCollapsed ? 'min-h-9 flex-col items-center justify-center text-center' : 'items-center justify-between'
                              } ${
                                isCollapsed ? 'gap-0.5' : 'gap-2'
                                } rounded-md ${
                                isCollapsed
                                  ? 'pl-1 pr-5'
                                  : 'h-7 pl-2 pr-1'
                              } ${isCollapsed ? 'py-1 text-[9px] font-medium' : 'text-[12.5px] font-medium'} cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-[var(--color-selectedBg)] text-[var(--color-textMuted)]'
                                  : 'text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)]'
                              }`}>
                            <div className={`flex min-w-0 flex-1 ${isCollapsed ? 'w-full flex-col items-center justify-center gap-0.5' : 'items-center gap-3 overflow-hidden'}`}>
                              <div className={`${isCollapsed ? 'h-4 w-4 justify-center text-[var(--color-textMuted)]' : 'h-5 w-5 justify-center text-[var(--color-textMuted)]'} flex items-center shrink-0`}>
                                <DashboardViewIcon iconId={view.settings?.viewIconId} size={isCollapsed ? 13 : 15} />
                              </div>
                              <span
                                className={isCollapsed ? 'w-full truncate whitespace-nowrap text-center leading-tight' : 'min-w-0 flex-1 truncate whitespace-nowrap leading-none'}
                                title={viewTitle}>
                                {viewTitle}
                              </span>
                              {isCollapsed && (
                                <div className="absolute right-0.5 top-1/2 flex h-5 -translate-y-1/2 items-center gap-0.5">
                                  {isLinkedSessionRunning && (
                                    <span
                                      role="status"
                                      aria-label={sessionStatusTitle}
                                      title={sessionStatusTitle}
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                        isLinkedSessionFocused
                                          ? 'bg-[var(--color-danger)]'
                                          : 'bg-[var(--color-success)]'
                                      }`}
                                    />
                                  )}
                                  <button
                                     type="button"
                                     title="Open session view"
                                     aria-label={`Open ${view.title} session view`}
                                     disabled={pendingViewActionId !== null}
                                     onClick={event => {
                                       event.preventDefault();
                                       event.stopPropagation();
                                       void handleOpenViewSession(view.id);
                                     }}
                                     className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-white dark:text-white opacity-0 transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-white group-hover/view-row:opacity-100 group-focus-within/view-row:opacity-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30">
                                     <LuExternalLink size={11} className="text-white dark:text-white shrink-0" />
                                   </button>
                                </div>
                              )}
                              {!isCollapsed && (
                                <div className="flex shrink-0 items-center gap-1">
                                  {isLinkedSessionRunning && (
                                    <span
                                      role="status"
                                      aria-label={sessionStatusTitle}
                                      title={sessionStatusTitle}
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                        isLinkedSessionFocused
                                          ? 'bg-[var(--color-danger)]'
                                          : 'bg-[var(--color-success)]'
                                      }`}
                                    />
                                  )}
                                  <button
                                     type="button"
                                     title="Open session view"
                                     aria-label={`Open ${view.title} session view`}
                                     disabled={pendingViewActionId !== null}
                                     onClick={event => {
                                       event.preventDefault();
                                       event.stopPropagation();
                                       void handleOpenViewSession(view.id);
                                     }}
                                     className="inline-flex h-5 w-5 items-center justify-center rounded-md text-white dark:text-white opacity-0 transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-white group-hover/view-row:opacity-100 group-focus-within/view-row:opacity-100 cursor-pointer">
                                     <LuExternalLink size={13} className="text-white dark:text-white shrink-0" />
                                   </button>
                                </div>
                              )}
                              {!isCollapsed && !isShrunk && (viewHotkey || viewShortcut) && (
                                <span className="inline-flex min-w-0 max-w-[56px] shrink-0 items-center overflow-hidden">
                                  {viewHotkey && (
                                    <span
                                      className={`min-w-0 max-w-full shrink-0 items-center truncate text-[9px] px-1 py-0.5 rounded border border-[var(--color-borderDefault)] text-[var(--color-textMuted)] font-mono font-medium leading-none ${
                                        viewShortcut ? 'inline-flex group-hover/view-row:hidden group-focus-within/view-row:hidden' : 'inline-flex'
                                      }`}>
                                      {viewHotkey}
                                    </span>
                                  )}
                                  {viewShortcut && (
                                    <span
                                      className={`min-w-0 max-w-full shrink-0 items-center truncate text-[9px] px-1 py-0.5 rounded border border-[var(--color-borderDefault)] text-[var(--color-textMuted)] font-mono font-medium leading-none ${
                                        viewHotkey
                                          ? 'hidden group-hover/view-row:inline-flex group-focus-within/view-row:inline-flex'
                                          : 'inline-flex'
                                      }`}
                                      title={`c ${viewShortcut}`}>
                                      c {viewShortcut}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {!isCollapsed && (
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/view-row:opacity-100 group-focus-within/view-row:opacity-100">
                              <button
                                type="button"
                                title="Rename view"
                                aria-label={`Rename ${view.title}`}
                                disabled={pendingViewActionId !== null}
                                onClick={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleRenameView(view.id);
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                                <LuPencil size={11} />
                              </button>
                            </div>
                            )}
                            </div>
                          </FocusedSessionHoverControl>
                        </SortableViewItem>
                      );
                    })}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragId && activeDragId.startsWith('header-') ? (
                    (() => {
                      const groupId = activeDragId.replace('header-', '');
                      const defaultTitle = groupId === 'custom_work' ? 'Work' : groupId === 'custom_personal' ? 'Personal' : groupId === 'custom_college' ? 'College' : groupId.replace(/^custom_/, '');
                      const groupTitle = customGroupNames[groupId] || defaultTitle;
                      return (
                        <div className="scale-105 opacity-80 shadow-md rounded-md px-2 py-1.5 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[180px] text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)] flex items-center gap-1.5">
                          <span>{groupTitle}</span>
                        </div>
                      );
                    })()
                  ) : activeDragId && viewsMap.get(activeDragId) ? (
                    <div className="scale-105 opacity-80 shadow-md rounded-md p-1.5 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[180px] text-xs font-semibold text-[var(--color-textPrimary)] truncate flex items-center gap-2">
                      <DashboardViewIcon iconId={viewsMap.get(activeDragId)?.settings?.viewIconId} size={14} />
                      <span className="truncate">{viewsMap.get(activeDragId)?.title}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            );
          })()}

          <div className="flex justify-center pt-1 opacity-0 group-hover/workspaceViews:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              title="New collection"
              aria-label="New collection"
              onClick={handleCreateView}
              disabled={pendingViewActionId !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-[var(--color-textMuted)] transition-all hover:bg-[var(--color-bgHover)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
              <LuPlus size={15} />
              {!isCollapsed && <span>New collection</span>}
            </button>
          </div>
        </div>
      )}

      {(viewDialog?.mode === 'create' || viewDialog?.mode === 'rename') && (() => {
        const linkedSession =
          viewDialog.mode === 'rename' ? getViewLinkedSession(dashboardState, viewDialog.viewId) : null;
        const nonSessionViewWidgets =
          viewDialog.mode === 'rename' && viewDialog.viewId && dashboardState
            ? dashboardState.widgets.filter(
                widget => widget.viewId === viewDialog.viewId && normalizeWidgetType(widget.type) !== 'session-item',
              )
            : [];

        return (
          <CreateCollectionDialog
            anchorRef={viewSelectorRef}
            dialog={viewDialog}
            setDialog={setViewDialog}
            onClose={closeViewDialog}
            onSubmit={handleSubmitViewDialog}
            actionError={viewActionError}
            pendingActionId={pendingViewActionId}
            onOverrideShortcut={handleOverrideShortcut}
            linkedSessionId={linkedSession?.sessionId}
            linkedWidgetId={linkedSession?.widgetId}
            stagedWidgets={
              viewDialog.mode === 'rename'
                ? nonSessionViewWidgets.map(widget => {
                    const catalogItem = WIDGET_CATALOG_CATEGORIES.flatMap(c => c.items).find(
                      i => normalizeWidgetType(i.type) === normalizeWidgetType(widget.type),
                    );
                    return {
                      id: widget.id,
                      title: getWidgetDisplayName(widget),
                      type: widget.type || catalogItem?.type || 'session-item',
                      icon: catalogItem?.icon || LuLayers,
                      sizePreset: widget.sizePreset || catalogItem?.sizePreset || 'medium',
                      layout: catalogItem?.layout || { x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
                    };
                  })
                : stagedCreateWidgets
            }
            pendingWidgetIds={pendingWidgetAddIds}
            draftSession={stagedCreateSessionDraft}
            onDraftSessionChange={setStagedCreateSessionDraft}
            onStageWidget={item => {
              if (viewDialog.mode === 'rename' && viewDialog.viewId) {
                void handleAddWidgetFromDialog(viewDialog.viewId, item);
              } else {
                handleStageCreateWidget(item);
              }
            }}
            onRemoveStagedWidget={index => {
              if (viewDialog.mode === 'rename' && viewDialog.viewId && dashboardState) {
                const widget = nonSessionViewWidgets[index];
                if (widget) {
                  void handleDeleteWidgetFromDialog(viewDialog.viewId, widget.id);
                }
              } else {
                handleRemoveStagedCreateWidget(index);
              }
            }}
          />
        );
      })()}

      {/* Side Popover for Delete Dialog */}
      {viewDialog &&
        (viewDialog as any).mode === 'delete' &&
        (() => {
          const rect = viewSelectorRef.current?.getBoundingClientRect();
          const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
          const viewportMargin = 16;
          const leftPos = rect ? rect.right + 10 : 280;
          const isOnlyOneView = (dashboardState?.views.length || 0) <= 1;
          const isCreatingView = viewDialog.mode === 'create';
          const isEditingTitle = isCreatingView || editingViewHeaderField === 'title';
          const isEditingShortcut = isCreatingView || editingViewHeaderField === 'shortcut';
          const isEditingHotkey = isCreatingView || editingViewHeaderField === 'hotkey';
          const linkedSession =
            viewDialog.mode === 'rename'
              ? getViewLinkedSession(dashboardState, viewDialog.viewId)
              : null;
          const viewWidgets =
            viewDialog.mode === 'rename' && dashboardState
              ? dashboardState.widgets.filter(widget => widget.viewId === viewDialog.viewId)
              : [];
          const hasDialogWidgets = viewDialog.mode === 'create' ? true : viewWidgets.length > 0;
          const desiredPopoverHeight =
            viewDialog.mode === 'delete'
              ? 180
              : viewportHeight - viewportMargin * 2;
          const availableBelow = rect ? viewportHeight - rect.top - viewportMargin : viewportHeight - 60 - viewportMargin;
          const availableAbove = rect ? rect.bottom - viewportMargin : 0;
          const popoverMaxHeight = Math.min(desiredPopoverHeight, viewportHeight - viewportMargin * 2);
          const topPos = (() => {
            if (!rect) return Math.max(viewportMargin, Math.min(60, viewportHeight - popoverMaxHeight - viewportMargin));
            if (desiredPopoverHeight <= availableBelow) return Math.max(viewportMargin, rect.top);
            if (desiredPopoverHeight <= availableAbove) {
              return Math.max(viewportMargin, rect.bottom - desiredPopoverHeight);
            }
            return viewportMargin;
          })();
          const focusViewHeaderField = (field: 'title' | 'shortcut' | 'hotkey') => {
            setEditingViewHeaderField(field);
            window.setTimeout(() => {
              if (field === 'title') titleInputRef.current?.focus();
              if (field === 'shortcut') shortcutInputRef.current?.focus();
              if (field === 'hotkey') hotkeyInputRef.current?.focus();
            }, 0);
          };

          return ReactDOM.createPortal(
            <div
              className="fixed z-[999999] flex items-start justify-start pointer-events-auto animate-in fade-in duration-150"
              style={{ top: `${topPos}px`, left: `${leftPos}px` }}>
              <div
                className="flex w-[620px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border shadow-2xl overflow-y-auto overflow-x-hidden p-4 transition-colors custom-scrollbar"
                style={{
                  backgroundColor: 'var(--color-editorBg)',
                  borderColor: 'var(--color-borderDefault)',
                  color: 'var(--color-textPrimary)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                  maxHeight: `${popoverMaxHeight}px`,
                }}>
                <div className="flex flex-col gap-2 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    {viewDialog.mode !== 'delete' ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button
                          ref={iconTriggerRef}
                          type="button"
                          aria-label="Choose view icon"
                          aria-expanded={isIconPickerOpen}
                          aria-haspopup="dialog"
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsIconPickerOpen(prev => !prev);
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                          <DashboardViewIcon iconId={viewDialog.viewIconId} size={16} />
                        </button>
                        {isEditingTitle ? (
                          <input
                            ref={titleInputRef}
                            value={viewDialog.title}
                            onBlur={() => !isCreatingView && setEditingViewHeaderField(null)}
                            onChange={event =>
                              setViewDialog(prev => (prev && prev.mode !== 'delete' ? { ...prev, title: event.target.value } : prev))
                            }
                            onKeyDown={event => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                if (!(viewDialog as any).shortcutError && !viewDialog.hotkeyError) {
                                  setEditingViewHeaderField(null);
                                  handleSubmitViewDialog();
                                }
                              }
                            }}
                            type="text"
                            placeholder="Enter view name..."
                            aria-label="View title"
                            className="w-[205px] shrink-0 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-sm font-bold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              focusViewHeaderField('title');
                            }}
                            className="group/header-field flex h-8 w-[160px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 text-left text-sm font-bold text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                            <span className="min-w-0 flex-1 truncate">{viewDialog.title || 'Untitled View'}</span>
                            <LuPencil size={12} className="shrink-0 text-[var(--color-textMuted)] opacity-0 transition-opacity group-hover/header-field:opacity-100" />
                          </button>
                        )}
                        {isEditingShortcut ? (
                          <div className="relative w-[130px] shrink-0">
                            <CUnderscoreIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none" />
                            <input
                              ref={shortcutInputRef}
                              value={(viewDialog as any).shortcut || ''}
                              onBlur={() => !isCreatingView && setEditingViewHeaderField(null)}
                              onChange={event => {
                                const val = event.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                                setViewDialog(prev => (prev && prev.mode !== 'delete' ? { ...prev, shortcut: val } : prev));
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  if (!(viewDialog as any).shortcutError && !viewDialog.hotkeyError) {
                                    setEditingViewHeaderField(null);
                                    handleSubmitViewDialog();
                                  }
                                }
                              }}
                              type="text"
                              placeholder="Command"
                              aria-label="View text command"
                              className="min-w-0 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] py-1.5 pl-8 pr-3 text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              focusViewHeaderField('shortcut');
                            }}
                            className="group/header-field flex h-8 w-[130px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 text-left text-sm font-semibold text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                            <CUnderscoreIcon size={15} className="shrink-0 text-[var(--color-iconDefault)]" />
                            <span className={`min-w-0 flex-1 truncate ${(viewDialog as any).shortcut ? '' : 'text-[var(--color-textPlaceholder)]'}`}>
                              {(viewDialog as any).shortcut || 'Command'}
                            </span>
                            <LuPencil size={12} className="shrink-0 text-[var(--color-textMuted)] opacity-0 transition-opacity group-hover/header-field:opacity-100" />
                          </button>
                        )}
                        {isEditingHotkey ? (
                          <input
                            ref={hotkeyInputRef}
                            value={viewDialog.hotkey || ''}
                            readOnly
                            onBlur={() => !isCreatingView && setEditingViewHeaderField(null)}
                            onKeyDown={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              if (event.key === 'Backspace' || event.key === 'Delete') {
                                setViewDialog(prev =>
                                  prev && prev.mode !== 'delete' ? { ...prev, hotkey: '', hotkeyError: null } : prev,
                                );
                                return;
                              }
                              const captured = buildHotkeyString(
                                event.nativeEvent,
                                typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform),
                              );
                              if (!captured || captured === 'CANCEL') return;
                              setViewDialog(prev =>
                                prev && prev.mode !== 'delete'
                                  ? { ...prev, hotkey: normalizeHotkeyString(captured), hotkeyError: null }
                                  : prev,
                              );
                            }}
                            type="text"
                            placeholder="Hotkey"
                            aria-label="View hotkey"
                            className="w-[110px] shrink-0 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-sm font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none shadow-sm focus:ring-2 focus:ring-[var(--color-focusRing)]"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              focusViewHeaderField('hotkey');
                            }}
                            className="group/header-field flex h-8 w-[95px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 text-left text-sm font-semibold text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                            <span className={`min-w-0 flex-1 truncate ${viewDialog.hotkey ? '' : 'text-[var(--color-textPlaceholder)]'}`}>
                              {viewDialog.hotkey || 'Hotkey'}
                            </span>
                            <LuPencil size={12} className="shrink-0 text-[var(--color-textMuted)] opacity-0 transition-opacity group-hover/header-field:opacity-100" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <h3 className="min-w-0 flex-1 truncate text-sm font-bold tracking-wide text-[var(--color-textPrimary)]">
                        Delete View
                      </h3>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      {viewDialog.mode === 'rename' && (
                        <button
                          type="button"
                          aria-label={viewDialog.isDefault ? 'Default view' : 'Set as default view'}
                          onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            setViewDialog(prev => (prev && prev.mode === 'rename' ? { ...prev, isDefault: !prev.isDefault } : prev));
                          }}
                          className="p-1 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer"
                          title={viewDialog.isDefault ? 'Default view' : 'Set as default view'}>
                          <LuPin size={16} className={viewDialog.isDefault ? 'fill-current text-[var(--color-textPrimary)]' : 'text-[var(--color-textMuted)]'} />
                        </button>
                      )}
                      <button
                        ref={viewActionsTriggerRef}
                        type="button"
                        aria-label="More view actions"
                        aria-expanded={isViewActionsMenuOpen}
                        aria-haspopup="menu"
                        onClick={event => {
                          event.preventDefault();
                          event.stopPropagation();
                          setIsViewActionsMenuOpen(prev => !prev);
                        }}
                        className="p-1 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer">
                        <FiMoreVertical size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={closeViewDialog}
                        className="p-1 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                        <LuX size={16} />
                      </button>
                    </div>
                  </div>
                  {viewDialog.mode !== 'delete' && ((viewDialog as any).shortcutError || viewDialog.hotkeyError) && (
                    <div className="flex min-w-0 items-center gap-2">
                      {(viewDialog as any).shortcutError && (
                        <span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                          {(viewDialog as any).shortcutError}
                        </span>
                      )}
                      {(viewDialog as any).shortcutError && (viewDialog as any).isShortcutOverrideable && handleOverrideShortcut && (
                        <button
                          type="button"
                          onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOverrideShortcut();
                          }}
                          className="shrink-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-colors cursor-pointer"
                          title="Reassign shortcut to this item">
                          Override
                        </button>
                      )}
                      {viewDialog.hotkeyError && (
                        <span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                          {viewDialog.hotkeyError}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {viewDialog.mode === 'delete' ? (
                  <div className="py-4 flex flex-col gap-3 text-xs font-medium leading-5 text-[var(--color-textSecondary)]">
                    <span>
                      Delete "{viewDialog.title}" and its {viewDialog.widgetCount} widget
                      {viewDialog.widgetCount === 1 ? '' : 's'}?
                    </span>
                    {viewDialog.hasLinkedSession && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer w-fit text-[var(--color-textPrimary)] hover:text-[var(--color-brand)] transition-colors">
                        <input
                          type="checkbox"
                          checked={viewDialog.deleteLinkedSession}
                          onChange={e =>
                            setViewDialog(prev =>
                              prev && prev.mode === 'delete'
                                ? { ...prev, deleteLinkedSession: e.target.checked }
                                : prev
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-focusRing)] cursor-pointer"
                        />
                        <span>Delete linked session as well</span>
                      </label>
                    )}
                  </div>
                 ) : null}

                {viewActionError && (
                  <div className="pb-2 text-[11px] font-semibold text-[var(--color-danger)]">{viewActionError}</div>
                )}

                {viewDialog.mode !== 'delete' && (linkedSession || viewDialog.mode === 'create') && (
                  <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-3 mb-3">
                    <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-[var(--color-textPrimary)]">
                      <LuLayers size={14} className="text-[var(--color-textMuted)]" />
                      <span>Session (optional)</span>
                    </div>
                    <div
                      data-session-widget-root
                      className="max-h-[220px] min-h-[120px] w-full min-w-0 overflow-y-auto overflow-x-hidden pb-1 custom-scrollbar">
                      <React.Suspense fallback={null}>
                        {viewDialog.mode === 'create' ? (
                          <SessionEditorView
                            key="create-session-draft"
                            isOpen={true}
                            sessionId={null}
                            session={null}
                            isWidgetMode={true}
                            isFullScreenMode={false}
                            isEditMode={true}
                            widgetId="create-session-draft"
                            viewId={undefined}
                            widgetTitle="Session"
                            viewPopoverMode={true}
                            draftMode={true}
                            draftSession={stagedCreateSessionDraft}
                            onDraftSessionChange={setStagedCreateSessionDraft}
                          />
                        ) : linkedSession ? (
                          <SessionEditorView
                            key={`${viewDialog.mode}-${linkedSession.widgetId}-${linkedSession.sessionId}`}
                            isOpen={true}
                            sessionId={linkedSession.sessionId}
                            session={{ id: linkedSession.sessionId }}
                            isWidgetMode={true}
                            isFullScreenMode={false}
                            isEditMode={true}
                            widgetId={linkedSession.widgetId}
                            viewId={viewDialog.mode === 'rename' ? viewDialog.viewId : undefined}
                            widgetTitle="Session"
                            viewPopoverMode={true}
                          />
                        ) : null}
                      </React.Suspense>
                    </div>
                  </div>
                )}

                {viewDialog.mode !== 'delete' && (
                  <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] p-3 mb-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-[var(--color-textPrimary)]">
                      <LuLayoutGrid size={14} className="text-[var(--color-textMuted)]" />
                      <span>Widgets (optional)</span>
                    </div>

                    {viewDialog.mode === 'create' && stagedCreateWidgets.length > 0 && (
                      <div className="max-h-28 overflow-y-auto overflow-x-hidden py-0.5 custom-scrollbar">
                        {stagedCreateWidgets.map((item, index) => (
                          <div
                            key={`${item.id}-${index}`}
                            className="group/widget-row flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                              {getWidgetHeaderIcon(item.type)}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{getCatalogWidgetDisplayName(item)}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${getCatalogWidgetDisplayName(item)}`}
                              title="Remove widget"
                              disabled={pendingViewActionId !== null}
                              onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveStagedCreateWidget(index);
                              }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover/widget-row:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40">
                              <LuTrash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {viewDialog.mode === 'rename' && viewWidgets.length > 0 && (
                      <div className="max-h-28 overflow-y-auto overflow-x-hidden py-0.5 custom-scrollbar">
                        {viewWidgets.map(widget => {
                          const isDeleting = deletingWidgetId === widget.id;
                          return (
                            <div
                              key={widget.id}
                              className="group/widget-row flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                                {getWidgetHeaderIcon(widget.type)}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{getWidgetDisplayName(widget)}</span>
                              <button
                                type="button"
                                aria-label={`Delete ${getWidgetDisplayName(widget)}`}
                                title="Delete widget"
                                disabled={isDeleting || deletingWidgetId !== null || pendingViewActionId !== null}
                                onClick={event => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (viewDialog.viewId) {
                                    void handleDeleteWidgetFromDialog(viewDialog.viewId, widget.id);
                                  }
                                }}
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover/widget-row:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40">
                                <LuTrash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsWidgetPickerOpen(true);
                      }}
                      disabled={pendingViewActionId !== null}
                      className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50">
                      <LuPlus size={14} />
                      <span>Add widget</span>
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={closeViewDialog}
                    disabled={pendingViewActionId !== null}
                    className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-bold text-[var(--color-textSecondary)] hover:bg-[var(--color-bgHover)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitViewDialog}
                    disabled={
                      pendingViewActionId !== null ||
                      (viewDialog.mode !== 'delete' && (!!viewDialog.shortcutError || !!viewDialog.hotkeyError))
                    }
                    className={`rounded-lg px-3.5 py-2 text-xs font-bold text-[var(--color-textPrimary)] transition-all disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${
                      viewDialog.mode === 'delete'
                        ? 'bg-[var(--color-danger)] hover:opacity-90'
                        : 'bg-[var(--color-borderActive)] hover:opacity-90'
                    }`}>
                    {viewDialog.mode === 'delete' ? 'Delete' : 'Save View'}
                  </button>
                </div>
              </div>

              {isWidgetPickerOpen &&
                viewDialog.mode !== 'delete' &&
                ReactDOM.createPortal(
                  <div className="fixed inset-0 z-[10000000] flex items-center justify-center p-4">
                    <button
                      type="button"
                      aria-label="Close add widget"
                      className="absolute inset-0 h-full w-full bg-[var(--color-overlayBg)]"
                      onClick={() => setIsWidgetPickerOpen(false)}
                    />
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-label="Add widget"
                      className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] shadow-2xl">
                      <header className="flex items-center justify-between border-b border-[var(--color-borderDefault)] px-4 py-3">
                        <h2 className="text-sm font-semibold">Add widget</h2>
                        <button
                          type="button"
                          onClick={() => setIsWidgetPickerOpen(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]"
                          title="Close add widget">
                          <LuX size={16} />
                        </button>
                      </header>
                      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
                        <WidgetCatalogGrid
                          variant="sidebar"
                          pendingWidgetIds={pendingWidgetAddIds}
                          getWidgetCount={item => {
                            const itemType = normalizeWidgetType(item.type);
                            if (viewDialog.mode === 'create' && itemType === 'session-item') return 1;
                            return viewDialog.mode === 'create'
                              ? stagedCreateWidgets.filter(stagedItem => normalizeWidgetType(stagedItem.type) === itemType).length
                              : viewWidgets.filter(widget => normalizeWidgetType(widget.type) === itemType).length;
                          }}
                          isWidgetDisabled={(item, count) => {
                            const itemType = normalizeWidgetType(item.type);
                            const canUseLinkedSession =
                              viewDialog.mode === 'rename' &&
                              itemType === 'session-item' &&
                              Boolean(getViewLinkedSession(dashboardState, viewDialog.viewId));
                            return (
                              (requiresExternalPicker(item) && !canUseLinkedSession) ||
                              (isSingleInstanceWidgetType(itemType) && count >= 1)
                            );
                          }}
                          onSelectWidget={item => {
                            if (viewDialog.mode === 'create') {
                              handleStageCreateWidget(item);
                              return;
                            }
                            if (viewDialog.viewId) {
                              void handleAddWidgetFromDialog(viewDialog.viewId, item);
                            }
                          }}
                        />
                      </div>
                    </section>
                  </div>,
                  document.body,
                )}

              {isViewActionsMenuOpen &&
                viewDialog.mode === 'rename' &&
                (() => {
                  const triggerRect = viewActionsTriggerRef.current?.getBoundingClientRect();
                  const menuTop = triggerRect ? triggerRect.bottom + 6 : topPos + 42;
                  const menuRight = triggerRect ? window.innerWidth - triggerRect.right : window.innerWidth - (leftPos + 300);

                  return ReactDOM.createPortal(
                    <div
                      ref={viewActionsMenuRef}
                      role="menu"
                      aria-label="View actions"
                      className="fixed z-[9999999] w-[260px] rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] p-1.5 shadow-2xl"
                      style={{
                        top: `${menuTop}px`,
                        right: `${Math.max(12, menuRight)}px`,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                      }}>
                      <a
                        href="https://www.cmdos.app/docs/hotkeys"
                        target="_blank"
                        rel="noreferrer"
                        role="menuitem"
                        onClick={() => setIsViewActionsMenuOpen(false)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                        <LuCircleHelp size={16} className="mt-0.5 shrink-0 text-[var(--color-textMuted)]" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-semibold text-[var(--color-textPrimary)]">Docs</span>
                          <span className="truncate text-xs font-medium text-[var(--color-textMuted)]">
                            Open documentation.
                          </span>
                        </span>
                      </a>
                      {viewDialog.mode === 'rename' && (
                        <>
                          <div className="my-1 h-px bg-[var(--color-borderDefault)]" />
                          <button
                            type="button"
                            role="menuitem"
                            disabled={isOnlyOneView || viewDialog.isDefault || pendingViewActionId !== null}
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              setIsViewActionsMenuOpen(false);
                              if (viewDialog.viewId) {
                                handleDeleteView(viewDialog.viewId);
                              }
                            }}
                            className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-dangerBg)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                            <LuTrash2 size={16} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="truncate text-sm font-semibold text-[var(--color-danger)]">Delete</span>
                              <span className="truncate text-xs font-medium text-[var(--color-textMuted)]">
                                Permanently remove this view.
                              </span>
                            </span>
                          </button>
                        </>
                      )}
                    </div>,
                    document.body,
                  );
                })()}

              {/* Icon Picker Popover */}
              {isIconPickerOpen &&
                viewDialog.mode !== 'delete' &&
                (() => {
                  const triggerRect = iconTriggerRef.current?.getBoundingClientRect();
                  const pickerTop = triggerRect ? triggerRect.bottom + 6 : topPos + 90;
                  const pickerLeft = triggerRect ? triggerRect.left : leftPos + 20;

                  return ReactDOM.createPortal(
                    <div
                      ref={iconPickerRef}
                      aria-label="View icon selector"
                      role="dialog"
                      className="fixed z-[9999999] p-3 rounded-xl border shadow-2xl bg-[var(--color-editorBg)] border-[var(--color-borderDefault)] grid grid-cols-5 gap-2 animate-in fade-in duration-150"
                      style={{
                        top: `${pickerTop}px`,
                        left: `${pickerLeft}px`,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
                      }}>
                      {DASHBOARD_VIEW_ICONS.map(iconDef => {
                        const isSelected = viewDialog.viewIconId === iconDef.id;
                        const IconComp = iconDef.icon;
                        return (
                          <button
                            key={iconDef.id}
                            type="button"
                            title={iconDef.label}
                            aria-label={iconDef.label}
                            aria-selected={isSelected}
                            onClick={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewDialog(prev => (prev && prev.mode !== 'delete' ? { ...prev, viewIconId: iconDef.id } : prev));
                              setIsIconPickerOpen(false);
                            }}
                            className={`p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-[var(--color-selectedBg)] border-[var(--color-borderActive)] text-[var(--color-textPrimary)] shadow-sm'
                                : 'bg-[var(--color-inputBg)] border-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'
                            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]`}>
                            <IconComp size={16} />
                          </button>
                        );
                      })}
                    </div>,
                    document.body,
                  );
                })()}
            </div>,
            document.body,
          );
        })()}
    </div>
  );
};

export default SidebarDashboardViewsSection;
