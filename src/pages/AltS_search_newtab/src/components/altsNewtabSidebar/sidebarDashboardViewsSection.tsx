import { saveWorkspaceViewAppearance } from '../../../../../allObjectFolder/src/createObject/widgets/workspaceViewAppearance';
import type { ShortcutAssignmentApproval } from '../../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { getCollectionWidgetViews, useDbStore } from '../../../../../storage/store/useDbStore';
import { resolveWorkspaceViewTitles } from '../../../../../storage/indexDB/workspaceProjections';
import { useWidgetDashboardStore } from '../../../../../storage/store/useWidgetDashboardStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import ReactDOM from 'react-dom';
import { LuCircleHelp, LuExternalLink, LuLayers, LuLayoutGrid, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { loadWidgetDashboardStateAsync, createWidgetDashboardViewAsync, deleteWidgetDashboardViewAsync, deleteWidgetInstanceAsync, addWidgetInstanceAsync, getWidgetCountForDashboardViewAsync, isSingleInstanceWidgetType, renameWidgetDashboardViewAsync, switchWidgetDashboardViewAsync, WIDGET_DASHBOARD_STORAGE_EVENT, } from '../../../../../storage/localStorage/widgetDashboardStorage';
import { getCurrentDashboardWindowIdAsync } from '../../../../../storage/localStorage/widgetDashboardWindowViewStorage';
import type { WidgetDashboardState, WidgetInstance } from '../widgets/widgetDashboard.types';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import { DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT } from '../../../../../shared-components/dashboardCollections/dashboardCollectionEvents';
import { reconcileExistingOnboardingViews, normalizeDashboardViewsOrder } from '../../../../../storage/localStorage/widgetDashboardGroupStorage';
import { useShortcutValidation, saveShortcutGuarded, clearShortcut } from '../../../../../shared-components/shortcuts';
import { clearHotkey, saveHotkey, useHotkeyValidation } from '../../../../../shared-components/hotkeys';
import { buildHotkeyString, normalizeHotkeyString } from '../../../../../shared-components/hotkeys/core/eventParser';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';
import type { SelectedLink } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import { DASHBOARD_VIEW_ICONS, DashboardViewIcon, DEFAULT_VIEW_ICON_ID, normalizeDashboardViewIconId, type DashboardViewIconId, } from './dashboardViewIcons';
import { getWidgetTypeLabel } from '../widgets/utils/widgetTypeLabel';
import { getWidgetHeaderIcon } from '../widgets/utils/widgetHeaderIcons';
import WidgetCatalogGrid from '../widgets/components/WidgetCatalogGrid';
import { WIDGET_CATALOG_CATEGORIES, openEditorByCatalogType, type WidgetCatalogItem } from '../widgets/widgetCatalog';
import { updateSession, deleteSession } from '../../../../../allObjectFolder/src/createObject/session/sessionData';
import { editWorkspaceDestinations } from '../../../../../allObjectFolder/src/createObject/session/workspaceDestinationActions';
import type { SessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import { normalizeSessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import { saveSessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettingsRuntime';
import CreateCollectionDialog, { createEmptySessionDraft, type CollectionViewTableRow, type CreateCollectionDialogState, type CreateSessionDraft, } from './CreateCollectionDialog';
const SessionAddLinksModal = React.lazy(() => import('../../../../../allObjectFolder/src/createObject/session/ui/SessionAddLinksModal'));
type ViewDialogState = CreateCollectionDialogState | {
    mode: 'rename';
    viewId: string;
    tablePrimaryViewId?: string;
    title: string;
    shortcut?: string;
    hotkey?: string;
    hotkeyError?: string | null;
    viewIconId: DashboardViewIconId;
    isCustomIconSelected?: boolean;
    shortcutConflictId?: string | null;
    shortcutApproval?: ShortcutAssignmentApproval;
    shortcutApprovalValue?: string;
    isShortcutOverrideable?: boolean;
    shortcutError?: string | null;
} | {
    mode: 'delete';
    viewId: string;
    title: string;
    widgetCount: number;
    hasLinkedSession: boolean;
    deleteLinkedSession: boolean;
    linkedSessionId: string | null;
} | null;
const ENABLE_SIDEBAR_VIEWS_PERF_LOGS = false;
const sidebarViewsPerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_SIDEBAR_VIEWS_PERF_LOGS)
        return;
    console.log('[SidebarPerf][ViewsSection]', label, JSON.stringify(data || {}));
};
const summarizeOrder = (order: readonly string[]) => ({
    length: order.length,
    headers: order.filter(id => id.startsWith('header-')).length,
    views: order.filter(id => !id.startsWith('header-')).length,
    firstItems: order.slice(0, 8),
});
const hasOnlyFastActiveViewPlaceholder = (views: readonly {
    settings?: Record<string, unknown>;
}[]) => views.length === 1 && views[0]?.settings?.__fastActiveViewPlaceholder === true;
const getMappedValueForView = (map: Record<string, string>, viewId: string): string => {
    const directValue = map[viewId];
    if (directValue)
        return directValue;
    const matchingKey = Object.keys(map).find(key => key === viewId ||
        key.endsWith(`-${viewId}`) ||
        key.endsWith(`:${viewId}`) ||
        key.endsWith(`_${viewId}`));
    return matchingKey ? map[matchingKey] || '' : '';
};
const normalizeWidgetType = (value: unknown): string => String(value || '').toLowerCase().trim();
const getWidgetDisplayName = (widget: WidgetInstance): string => String(widget.title || '').trim() ||
    getWidgetTypeLabel(widget.type) ||
    'Widget';
const getCatalogWidgetDisplayName = (item: WidgetCatalogItem): string => String(item.title || '').trim() ||
    getWidgetTypeLabel(item.type) ||
    'Widget';
const getDefaultWidgetSettings = (type: string | undefined) => type === 'link-library' ||
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
const requiresExternalPicker = (item: WidgetCatalogItem): boolean => item.type === 'note-item' || item.type === 'html' || item.type === 'session-item';
const getWidgetSessionId = (widget: WidgetInstance | undefined): string | null => {
    if (!widget)
        return null;
    if (widget.sessionId)
        return widget.sessionId;
    if (widget.referenceType === 'session' && widget.referenceId)
        return widget.referenceId;
    return null;
};
const getViewLinkedSession = (dashboardState: WidgetDashboardState | null | undefined, viewId: string | null | undefined): {sessionId: string; widgetId: string} | null => {
  if (!viewId?.startsWith('workspace_') || !dashboardState?.views.some(view => view.id === viewId)) return null;
  return {sessionId: viewId, widgetId: ''};
};
const createEmptyCollectionDialogState = (): CreateCollectionDialogState => ({
    mode: 'create',
    presentation: 'table',
    title: '',
    shortcut: '',
    hotkey: '',
    viewIconId: DEFAULT_VIEW_ICON_ID,
});
const getHostname = (url?: string): string => {
    try {
        if (!url)
            return '';
        const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(safeUrl).hostname.replace(/^www\./i, '');
    }
    catch {
        return url || '';
    }
};
const getFaviconUrlForHost = (host: string): string => `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${host}`)}&size=128`;
const SortableViewItem = ({ id, children }: {
    id: string;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition,
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
    };
    return (<div ref={setNodeRef} style={style} {...attributes} {...listeners} onDragStart={e => e.preventDefault()} draggable="false" className={`relative w-full select-none ${isDragging ? 'grabbing opacity-0 pointer-events-none' : 'cursor-grab'}`}>
      {children}
    </div>);
};
const SortableHeader = ({ id, children }: {
    id: string;
    children: React.ReactNode;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition: transition,
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
    };
    return (<div ref={setNodeRef} style={style} {...attributes} {...listeners} onDragStart={e => e.preventDefault()} draggable="false" className={`w-full select-none ${isDragging ? 'opacity-0 pointer-events-none' : 'cursor-grab'}`}>
      {children}
    </div>);
};
interface SidebarDashboardViewsSectionProps {
    widthMode?: string;
    isCollapsed?: boolean;
    isIconOnly?: boolean;
}
type CurrentWindowSessionStatus = {
    sessionId: string;
    focusMode: boolean;
} | null;
interface FocusedSessionHoverControlProps {
    enabled: boolean;
    sessionTitle: string;
    isUpdating: boolean;
    onTurnOff: () => Promise<void>;
    children: React.ReactNode;
}
const FocusedSessionHoverControl: React.FC<FocusedSessionHoverControlProps> = ({ enabled, sessionTitle, isUpdating, onTurnOff, children, }) => {
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const closeTimeoutRef = useRef<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<{
        left: number;
        top: number;
        side: 'left' | 'right';
    }>({
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
        if (!enabled)
            return;
        cancelClose();
        setIsOpen(true);
    };
    const scheduleClose = () => {
        cancelClose();
        closeTimeoutRef.current = window.setTimeout(() => setIsOpen(false), 120);
    };
    useEffect(() => {
        if (!enabled)
            setIsOpen(false);
    }, [enabled]);
    React.useLayoutEffect(() => {
        if (!isOpen)
            return undefined;
        const updatePosition = () => {
            const rect = anchorRef.current?.getBoundingClientRect();
            if (!rect)
                return;
            const popoverWidth = 176;
            const popoverHeight = 44;
            const viewportMargin = 8;
            const anchorGap = 8;
            const preferredLeft = rect.right + anchorGap;
            const opensOnRight = preferredLeft + popoverWidth <= window.innerWidth - viewportMargin;
            const left = opensOnRight
                ? preferredLeft
                : Math.max(viewportMargin, rect.left - popoverWidth - anchorGap);
            const top = Math.max(viewportMargin, Math.min(rect.top + rect.height / 2 - popoverHeight / 2, window.innerHeight - popoverHeight - viewportMargin));
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
    return (<div ref={anchorRef} className="w-full" onMouseEnter={openPopover} onMouseLeave={scheduleClose} onFocusCapture={openPopover} onBlurCapture={scheduleClose}>
      {children}
      {enabled && isOpen && typeof document !== 'undefined' && ReactDOM.createPortal(<div role="dialog" aria-label={`${sessionTitle} focus mode`} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} className="fixed z-[10050] flex w-44 items-center justify-between gap-3 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg,var(--color-editorBg))] px-3 py-2 text-[var(--color-textPrimary)] shadow-lg" style={{ left: position.left, top: position.top }}>
          <span aria-hidden="true" className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-[var(--color-cardBg,var(--color-editorBg))] ${position.side === 'right'
                ? '-left-1.5 border-b border-l border-[var(--color-borderDefault)]'
                : '-right-1.5 border-r border-t border-[var(--color-borderDefault)]'}`}/>
          <span className="truncate text-xs font-semibold">Focus mode</span>
          <button type="button" role="switch" aria-checked={true} aria-label={`Turn off focus mode for ${sessionTitle}`} title="Turn off focus mode" disabled={isUpdating} onClick={() => void onTurnOff()} className="widget-settings-search-toggle relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing,var(--color-borderActive))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-cardBg,var(--color-editorBg))] disabled:cursor-wait disabled:opacity-60">
            <span aria-hidden="true" className="pointer-events-none block h-[16px] w-[16px] translate-x-[19px] rounded-full transition-transform duration-200"/>
          </button>
        </div>, document.body)}
    </div>);
};
export const SidebarDashboardViewsSection: React.FC<SidebarDashboardViewsSectionProps> = ({ widthMode, isCollapsed = false, isIconOnly = false }) => {
    const storedDashboardState = useWidgetDashboardStore(state => state.state);
    const workspaces = useDbStore(state => state.workspaces);
    const dashboardState = React.useMemo(() => storedDashboardState ? {...storedDashboardState,
        views: resolveWorkspaceViewTitles(storedDashboardState.views, workspaces)} : storedDashboardState, [storedDashboardState, workspaces]);
    const loadDashboard = useWidgetDashboardStore(state => state.load);
    const refreshDashboard = useWidgetDashboardStore(state => state.refresh);
    const setDashboardState = useWidgetDashboardStore(state => state.setDashboardState);
    const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
    const [pendingViewActionId, setPendingViewActionId] = useState<string | null>(null);
    const [viewActionError, setViewActionError] = useState<string | null>(null);
    const [viewDialog, setViewDialog] = useState<ViewDialogState>(null);
    const viewRowSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
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
    const newCollectionAnchorRef = useRef<HTMLDivElement | null>(null);
    const organisations = useDbStore(state => state.organisations);
    const isStoreInitialized = useDbStore(state => state.isInitialized);
    const shortcutsMap = useDbStore(state => state.shortcutsMap);
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const sessions = useDbStore(state => state.sessions);
    const notes = useDbStore(state => state.notes);
    const links = useDbStore(state => state.links);
    const snippets = useDbStore(state => state.snippets);
    const chatAgents = useDbStore(state => state.chatAgents);
    const aiPrompts = useDbStore(state => state.aiPrompts);
    const [addLinksViewId, setAddLinksViewId] = useState<string | null>(null);
    const [addLinksBrowserTabs, setAddLinksBrowserTabs] = useState<SelectedLink[]>([]);
    const [sessionAgentSuggestions, setSessionAgentSuggestions] = useState<any[]>([]);
    const activeOrganisationId = organisations[0]?.id || 'default';
    const { validateShortcut } = useShortcutValidation();
    const { validateHotkey } = useHotkeyValidation();
    const titleInputRef = useRef<HTMLInputElement>(null);
    const shortcutInputRef = useRef<HTMLInputElement>(null);
    const hotkeyInputRef = useRef<HTMLInputElement>(null);
    const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([]);
    const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
    const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({});
    const [isViewOrderStorageHydrated, setIsViewOrderStorageHydrated] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);
    const [currentWindowSessionStatus, setCurrentWindowSessionStatus] = useState<CurrentWindowSessionStatus>(null);
    const [focusModeUpdatingSessionId, setFocusModeUpdatingSessionId] = useState<string | null>(null);
    const lastDragOverLogKeyRef = useRef<string | null>(null);
    const reconciledOrganisationRef = useRef<string | null>(null);
    useEffect(() => {
        if (!addLinksViewId)
            return;
        let cancelled = false;
        setAddLinksBrowserTabs([]);
        const chromeApi = (window as typeof window & {
            chrome?: typeof chrome;
        }).chrome;
        if (chromeApi?.tabs?.query) {
            chromeApi.tabs.query({ currentWindow: true }, tabs => {
                if (cancelled)
                    return;
                setAddLinksBrowserTabs(tabs.filter(tab => /^https?:\/\//i.test(tab.url || '')).map(tab => ({
                    id: `tab-${tab.id}`,
                    title: tab.title || getHostname(tab.url || ''),
                    name: tab.title || getHostname(tab.url || ''),
                    url: tab.url || '',
                    favIconUrl: tab.favIconUrl,
                    source: 'tab',
                })));
            });
        }
        void import('../../../../../allObjectFolder/src/createObject/session/sessionAgentSnapshot')
            .then(module => {
            if (!cancelled) {
                setSessionAgentSuggestions(module.buildSessionAgentSuggestions({ chatAgents, aiPrompts }));
            }
        })
            .catch(() => {
            if (!cancelled)
                setSessionAgentSuggestions([]);
        });
        return () => {
            cancelled = true;
        };
    }, [addLinksViewId, aiPrompts, chatAgents]);
    useEffect(() => {
        if (!isStoreInitialized ||
            !activeOrganisationId ||
            activeOrganisationId === 'default' ||
            reconciledOrganisationRef.current === activeOrganisationId)
            return;
        reconciledOrganisationRef.current = activeOrganisationId;
        void reconcileExistingOnboardingViews(activeOrganisationId)
            .then(result => (result.changed ? refreshDashboard(activeOrganisationId, { activeViewOnly: false }) : null))
            .catch(error => {
            reconciledOrganisationRef.current = null;
            console.error('[SidebarDashboardViewsSection] Failed to reconcile onboarding groups:', error);
        });
    }, [activeOrganisationId, isStoreInitialized, refreshDashboard]);
    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }));
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
        if (!over)
            return;
        const activeId = String(active.id);
        const overId = String(over.id);
        if (activeId === overId)
            return;
        const oldIndex = viewItemsOrder.indexOf(activeId);
        const newIndex = viewItemsOrder.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1)
            return;
        // ── Dragging a GROUP HEADER: move header + its children as a single block ──
        if (activeId.startsWith('header-')) {
            const children: string[] = [];
            for (let i = oldIndex + 1; i < viewItemsOrder.length; i++) {
                if (viewItemsOrder[i].startsWith('header-'))
                    break;
                children.push(viewItemsOrder[i]);
            }
            const block = [activeId, ...children];
            // Strip the whole block from a copy of the order
            const withoutBlock = viewItemsOrder.filter(id => !block.includes(id));
            let insertAt = withoutBlock.indexOf(overId);
            if (insertAt === -1)
                insertAt = withoutBlock.length;
            // When moving DOWN onto another header, insert after that header's children
            if (overId.startsWith('header-') && oldIndex < newIndex) {
                let end = insertAt + 1;
                while (end < withoutBlock.length && !withoutBlock[end].startsWith('header-'))
                    end++;
                insertAt = end;
            }
            const newOrder = [
                ...withoutBlock.slice(0, insertAt),
                ...block,
                ...withoutBlock.slice(insertAt)
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
        }
        else {
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
            if (!viewDialog || viewDialog.mode === 'delete')
                return;
            const { shortcut } = viewDialog as any;
            const viewId = (viewDialog as any).viewId;
            if (shortcut) {
                const res = await validateShortcut(shortcut, viewId || 'new');
                if (active) {
                    setViewDialog(prev => prev && prev.mode !== 'delete'
                        ? {
                            ...prev,
                            shortcutError: !res.isValid ? res.errorMessage || 'This shortcut is already taken.' : null,
                            isShortcutOverrideable: !!res.isOverrideable,
                            shortcutConflictId: res.conflictId,
                            shortcutApproval: undefined,
                            shortcutApprovalValue: undefined,
                        }
                        : prev);
                }
            }
            else {
                if (active) {
                    setViewDialog(prev => prev && prev.mode !== 'delete'
                        ? {
                            ...prev,
                            shortcutError: null,
                            isShortcutOverrideable: false,
                            shortcutConflictId: null,
                        }
                        : prev);
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
        validateShortcut
    ]);
    useEffect(() => {
        let active = true;
        const checkHotkey = async () => {
            if (!viewDialog || viewDialog.mode === 'delete')
                return;
            const result = await validateHotkey(viewDialog.hotkey || '', viewDialog.mode === 'rename' ? viewDialog.viewId || '' : 'new');
            if (!active)
                return;
            setViewDialog(prev => prev && prev.mode !== 'delete'
                ? { ...prev, hotkeyError: result.isValid ? null : result.errorMessage || 'This hotkey is already taken.' }
                : prev);
        };
        void checkHotkey();
        return () => {
            active = false;
        };
    }, [activeDialogHotkey, viewDialog?.mode, viewDialog?.viewId, validateHotkey]);
    // Saved hotkeys hydrate on row selection; draft edits must not restore an old mapping.
    // Handle icon picker outside click and Escape key behavior
    useEffect(() => {
        if (!isIconPickerOpen)
            return undefined;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (iconPickerRef.current?.contains(target) ||
                iconTriggerRef.current?.contains(target)) {
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
        if (!isViewActionsMenuOpen)
            return undefined;
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (viewActionsMenuRef.current?.contains(target) ||
                viewActionsTriggerRef.current?.contains(target)) {
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
        if (!viewDialog || viewDialog.mode === 'delete')
            return;
        const result = await validateShortcut(viewDialog.shortcut || '', viewDialog.viewId || 'new');
        if (!result.assignmentConflict || !result.isOverrideable) return;
        const approval: ShortcutAssignmentApproval = {...result.assignmentConflict, mode: 'overwrite'};
        if (viewDialog.viewId) {
            try {
                await saveShortcutGuarded(viewDialog.viewId, viewDialog.shortcut || '', 'collection', approval);
                setViewActionError(null);
            }
            catch (error) {
                setViewActionError(error instanceof Error ? error.message : 'Could not assign text command.');
                return;
            }
        }
        // Keep owners intact until the guarded save accepts this exact approval.
        setViewDialog(prev => prev && prev.mode !== 'delete'
            && prev.shortcut === viewDialog.shortcut && prev.viewId === viewDialog.viewId
            ? {...prev, shortcutError: null, isShortcutOverrideable: false,
                shortcutConflictId: null, shortcutApproval: viewDialog.viewId ? undefined : approval,
                shortcutApprovalValue: prev.shortcut?.trim().toLowerCase()}
            : prev);
    };
    const fetchDashboardState = () => {
        sidebarViewsPerf('dashboard-load:request', {
            source: 'mount',
            activeOrganisationId,
        });
        loadDashboard(activeOrganisationId, { activeViewOnly: true })
            .catch(() => undefined);
    };
    useEffect(() => {
        if (!isStoreInitialized)
            return undefined;
        if (organisations.length === 0)
            return undefined;
        fetchDashboardState();
        const handleStorageChange = () => {
            sidebarViewsPerf('dashboard-event:received', {
                event: WIDGET_DASHBOARD_STORAGE_EVENT,
                activeOrganisationId,
            });
            void refreshDashboard(activeOrganisationId, { activeViewOnly: false });
        };
        window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleStorageChange);
        const handleChromeStorageChange = (changes: {
            [key: string]: any;
        }, areaName: string) => {
            sidebarViewsPerf('chrome-storage:changed', {
                areaName,
                keys: Object.keys(changes),
                relevantKeys: Object.keys(changes).filter(key => key === 'dashboard_views_items_order' ||
                    key === 'sidebar_view_visible_items' ||
                    key === 'customGroupNames'),
            });
        };
        const chromeAny = (window as any)?.chrome;
        chromeAny?.storage?.onChanged?.addListener(handleChromeStorageChange);
        return () => {
            window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleStorageChange);
            chromeAny?.storage?.onChanged?.removeListener(handleChromeStorageChange);
        };
    }, [activeOrganisationId, isStoreInitialized, loadDashboard, refreshDashboard, organisations.length]);
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.storage?.local || !chromeAny?.runtime?.sendMessage)
            return undefined;
        let mounted = true;
        const updateCurrentWindowSession = async () => {
            const windowId = await getCurrentDashboardWindowIdAsync();
            if (!mounted || typeof windowId !== 'number')
                return;
            const response = await chromeAny.runtime.sendMessage({
                action: 'get_active_session_status',
                windowId,
            }).catch(() => null);
            if (!mounted)
                return;
            const activeSession = response?.ok === true ? response.active_session : null;
            setCurrentWindowSessionStatus(activeSession?.sessionId
                ? {
                    sessionId: String(activeSession.sessionId),
                    focusMode: activeSession.focusMode === true,
                }
                : null);
        };
        void updateCurrentWindowSession();
        const handleActiveSessionChange = (changes: {
            [key: string]: any;
        }, areaName: string) => {
            if (areaName !== 'local' || !changes.active_sessions)
                return;
            void updateCurrentWindowSession();
        };
        chromeAny.storage.onChanged.addListener(handleActiveSessionChange);
        return () => {
            mounted = false;
            chromeAny.storage.onChanged.removeListener(handleActiveSessionChange);
        };
    }, []);
    useEffect(() => {
        if (!isViewDropdownOpen)
            return undefined;
        const handlePointerDown = (event: PointerEvent) => {
            if (!viewSelectorRef.current?.contains(event.target as Node)) {
                setIsViewDropdownOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setIsViewDropdownOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isViewDropdownOpen]);
    const handleSwitchView = async (viewId: string) => {
        setIsViewDropdownOpen(false);
        setViewActionError(null);
        setPendingViewActionId(viewId);
        try {
            const nextDashboardState = await switchWidgetDashboardViewAsync(viewId, activeOrganisationId, {
                trigger: 'manual-click',
            });
            useWidgetDashboardStore.getState().setDashboardState(currentDashboardState => ({
                ...nextDashboardState,
                views: currentDashboardState?.views && currentDashboardState.views.length > nextDashboardState.views.length
                    ? currentDashboardState.views
                    : nextDashboardState.views,
            }), activeOrganisationId);
            // Reveal Home only after the selected collection is active, so leaving an
            // editor cannot briefly mount and retain the main dashboard instead.
            const uiStore = useUIStore.getState();
            uiStore.closeSheet();
            uiStore.clearEditorStates();
            uiStore.setView({ type: 'home' });
        }
        catch (error) {
            console.error('[DashboardAutoRun][sidebar] switch failed', error);
            setViewActionError(error instanceof Error ? error.message : 'Could not switch view.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const handleOpenViewSession = async (viewId: string) => {
        setIsViewDropdownOpen(false);
        setPendingViewActionId(viewId);
        setViewActionError(null);
        try {
            const didLaunch = await launchDashboardCollectionView(viewId, {
                organisationId: activeOrganisationId,
                mode: 'open',
            });
            if (!didLaunch) {
                setViewActionError('Could not open this Workspace.');
            }
        }
        catch (error) {
            console.error('[DashboardAutoRun][sidebar] explicit open failed', error);
            setViewActionError(error instanceof Error ? error.message : 'Could not open this Workspace.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const handleTurnOffFocusMode = async (sessionId: string) => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.runtime?.sendMessage || focusModeUpdatingSessionId)
            return;
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
            setCurrentWindowSessionStatus(current => current?.sessionId === sessionId
                ? { ...current, focusMode: false }
                : current);
        }
        catch (error) {
            console.error('[SidebarDashboardViews] failed to turn off focus mode', error);
            setViewActionError(error instanceof Error ? error.message : 'Could not turn off focus mode.');
        }
        finally {
            setFocusModeUpdatingSessionId(null);
        }
    };
    const handleCreateView = () => {
        setIsViewDropdownOpen(false);
        setViewActionError(null);
        setStagedCreateWidgets([]);
        setStagedCreateSessionDraft(createEmptySessionDraft());
        setIsWidgetPickerOpen(false);
        setViewDialog({
            mode: 'create',
            presentation: 'table',
            title: '',
            shortcut: '',
            hotkey: '',
            viewIconId: DEFAULT_VIEW_ICON_ID,
        });
    };
    const handleRenameView = (viewId: string) => {
        if (!dashboardState)
            return;
        const view = dashboardState.views.find(v => v.id === viewId);
        if (!view)
            return;
        setIsViewDropdownOpen(false);
        setViewActionError(null);
        setIsWidgetPickerOpen(false);
        const existingShortcut = getMappedValueForView(shortcutsMap, viewId);
        const existingHotkey = getMappedValueForView(hotkeysMap, viewId);
        const viewIconId = normalizeDashboardViewIconId(view.settings?.viewIconId);
        setViewDialog({
            mode: 'rename',
            viewId,
            tablePrimaryViewId: viewId,
            title: view.title,
            shortcut: existingShortcut,
            hotkey: existingHotkey,
            viewIconId,
            isCustomIconSelected: Boolean(view.settings?.isCustomIconSelected),
        });
        // If we're editing a non-active view and widgets are scoped to activeViewId, load full workspace dashboard state
        if (viewId !== dashboardState.activeViewId) {
            void loadWidgetDashboardStateAsync(activeOrganisationId).then(fullState => {
                if (fullState && useWidgetDashboardStore.getState().organisationId === activeOrganisationId) {
                    // Hydrating settings rows must preserve the page's active collection.
                    setDashboardState(current => ({
                        ...fullState,
                        activeViewId: current?.activeViewId || fullState.activeViewId,
                    }), activeOrganisationId);
                }
            });
        }
    };
    useEffect(() => {
        const handleRenameRequest = (event: Event) => {
            const detail = (event as CustomEvent<{
                viewId?: string;
            }>).detail;
            if (detail?.viewId) {
                handleRenameView(detail.viewId);
            }
        };
        window.addEventListener(DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT, handleRenameRequest);
        return () => {
            window.removeEventListener(DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT, handleRenameRequest);
        };
    }, [handleRenameView]);
    const handleSelectViewTableRow = (viewId: string) => {
        if (!dashboardState)
            return;
        const view = dashboardState.views.find(candidate => candidate.id === viewId);
        if (!view)
            return;
        const existingShortcut = getMappedValueForView(shortcutsMap, viewId);
        const existingHotkey = getMappedValueForView(hotkeysMap, viewId);
        const viewIconId = normalizeDashboardViewIconId(view.settings?.viewIconId);
        setViewDialog(current => {
            if (!current || (current.mode !== 'rename' && current.mode !== 'create'))
                return current;
            if (current.mode === 'rename' && current.viewId === viewId)
                return current;
            return {
                mode: 'rename',
                presentation: 'table',
                viewId,
                title: view.title,
                shortcut: existingShortcut,
                hotkey: existingHotkey,
                hotkeyError: null,
                viewIconId,
                isCustomIconSelected: Boolean(view.settings?.isCustomIconSelected),
                shortcutConflictId: null,
                isShortcutOverrideable: false,
                shortcutError: null,
                tablePrimaryViewId: current.mode === 'rename'
                    ? current.tablePrimaryViewId || current.viewId || viewId
                    : viewId,
            };
        });
        if (viewId !== dashboardState.activeViewId) {
            void loadWidgetDashboardStateAsync(activeOrganisationId).then(fullState => {
                if (fullState && useWidgetDashboardStore.getState().organisationId === activeOrganisationId) {
                    // The full loader defaults to Home; selecting a row is not navigation.
                    setDashboardState(current => ({
                        ...fullState,
                        activeViewId: current?.activeViewId || fullState.activeViewId,
                    }), activeOrganisationId);
                }
            });
        }
    };
    const handleDeleteView = async (viewId: string) => {
        if (!dashboardState || dashboardState.views.length <= 1)
            return;
        const view = dashboardState.views.find(v => v.id === viewId);
        if (!view)
            return;
        setIsViewDropdownOpen(false);
        setIsWidgetPickerOpen(false);
        const widgetCount = await getWidgetCountForDashboardViewAsync(viewId, activeOrganisationId);
        setViewActionError(null);
        const linkedSession = getViewLinkedSession(dashboardState, viewId);
        setViewDialog({
            mode: 'delete',
            viewId,
            title: view.title,
            widgetCount,
            hasLinkedSession: false,
            deleteLinkedSession: false,
            linkedSessionId: null,
        });
    };
    const handleDeleteWidgetFromDialog = async (viewId: string, widgetId: string) => {
        if (!dashboardState || deletingWidgetId)
            return;
        setDeletingWidgetId(widgetId);
        try {
            const nextState = await deleteWidgetInstanceAsync(viewId, widgetId, activeOrganisationId);
            setDashboardState(nextState);
        }
        catch (error) {
            console.error('[SidebarDashboardViewsSection] Failed to delete widget from view dialog:', error);
        }
        finally {
            setDeletingWidgetId(null);
        }
    };
    const closeViewDialog = () => {
        setViewDialog(null);
        setAddLinksViewId(null);
        setEditingViewHeaderField(null);
        setIsIconPickerOpen(false);
        setIsViewActionsMenuOpen(false);
        setIsWidgetPickerOpen(false);
        setStagedCreateWidgets([]);
        setStagedCreateSessionDraft(createEmptySessionDraft());
    };
    const addWidgetToView = async (viewId: string, item: WidgetCatalogItem): Promise<WidgetDashboardState | null> => {
        if (item.isEditorAction && item.editorType) {
            openEditorByCatalogType(item.editorType);
            return null;
        }
        const itemType = normalizeWidgetType(item.type);
        const linkedSession = itemType === 'session-item' ? getViewLinkedSession(dashboardState, viewId) : null;
        if (requiresExternalPicker(item) && !linkedSession)
            return null;
        setPendingWidgetAddIds(prev => new Set(prev).add(item.id));
        try {
            const categoryId = WIDGET_CATALOG_CATEGORIES.find(category => category.items.some(categoryItem => categoryItem.id === item.id))?.id;
            const { state } = await addWidgetInstanceAsync({
                categoryId,
                title: linkedSession ? 'Session Widget' : item.title,
                type: item.type,
                sessionId: linkedSession?.sessionId,
                sessionTitle: linkedSession ? 'Session Widget' : undefined,
                settings: getDefaultWidgetSettings(item.type),
                sizePreset: item.sizePreset,
            }, item.layout, viewId, activeOrganisationId);
            return state;
        }
        catch (error) {
            console.error('[SidebarDashboardViewsSection] Failed to add widget from view dialog:', error);
            return null;
        }
        finally {
            setPendingWidgetAddIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };
    const handleAddWidgetFromDialog = async (viewId: string, item: WidgetCatalogItem) => {
        const state = await addWidgetToView(viewId, item);
        if (!state)
            return;
        setDashboardState(state);
        setIsWidgetPickerOpen(false);
    };
    const handleStageCreateWidget = (item: WidgetCatalogItem) => {
        if (pendingWidgetAddIds.has(item.id) || requiresExternalPicker(item))
            return;
        setStagedCreateWidgets(prev => [...prev, item]);
        setIsWidgetPickerOpen(false);
    };
    const handleRemoveStagedCreateWidget = (index: number) => {
        setStagedCreateWidgets(prev => prev.filter((_, itemIndex) => itemIndex !== index));
    };
    const submitCreateViewDraft = async (createDialog: CreateCollectionDialogState, options: {
        closeDialog: boolean;
    }) => {
        if (createDialog.shortcutError || createDialog.hotkeyError)
            return;
        const title = createDialog.title.trim();
        if (!title) {
            setViewActionError('Enter a workspace name.');
            return;
        }
        setPendingViewActionId('action');
        setViewActionError(null);
        try {
            const result = await createWidgetDashboardViewAsync(title, activeOrganisationId, {
                viewIconId: createDialog.viewIconId,
                isCustomIconSelected: createDialog.isCustomIconSelected,
            });
            let nextState = 'state' in result ? result.state : result;
            const newViewId = nextState.activeViewId;
            const shortcut = (createDialog as any).shortcut;
            if (shortcut && newViewId) {
                await saveShortcutGuarded(newViewId, shortcut, 'collection', createDialog.shortcutApprovalValue === shortcut.trim().toLowerCase() ? createDialog.shortcutApproval : undefined);
            }
            if (newViewId && createDialog.hotkey) {
                await saveHotkey(newViewId, newViewId, normalizeHotkeyString(createDialog.hotkey), 'collection');
            }
            const createdSessionId = 'createdSessionId' in result ? result.createdSessionId : null;
            const hasSessionDraftChanges = stagedCreateSessionDraft.urls.length > 0 || Boolean(stagedCreateSessionDraft.sessionOpenSettings);
            if (createdSessionId && hasSessionDraftChanges) {
                await updateSession(createdSessionId, {
                    title: title || stagedCreateSessionDraft.title || 'Untitled Workspace',
                    urls: stagedCreateSessionDraft.urls,
                    sessionOpenSettings: stagedCreateSessionDraft.sessionOpenSettings,
                    organisationId: activeOrganisationId,
                    tagIds: stagedCreateSessionDraft.tagIds,
                });
            }
            if (newViewId && stagedCreateWidgets.length > 0) {
                for (const item of stagedCreateWidgets) {
                    const state = await addWidgetToView(newViewId, item);
                    if (state)
                        nextState = state;
                }
            }
            setDashboardState(nextState, activeOrganisationId);
            if (options.closeDialog) {
                closeViewDialog();
            }
            else if (newViewId) {
                setStagedCreateWidgets([]);
                setStagedCreateSessionDraft(createEmptySessionDraft());
                setViewDialog({
                    mode: 'rename',
                    presentation: 'table',
                    viewId: newViewId,
                    tablePrimaryViewId: newViewId,
                    title,
                    shortcut: shortcut || '',
                    hotkey: createDialog.hotkey || '',
                    viewIconId: createDialog.viewIconId,
                    isCustomIconSelected: createDialog.isCustomIconSelected,
                });
            }
        }
        catch (error) {
            setViewActionError(error instanceof Error ? error.message : 'Could not update view.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const handleSubmitViewDialog = async (dialogOverride?: CreateCollectionDialogState) => {
        const activeDialog = dialogOverride || viewDialog;
        if (!activeDialog)
            return;
        if (activeDialog.mode !== 'delete' && (activeDialog.shortcutError || activeDialog.hotkeyError))
            return;
        if (activeDialog.mode === 'create') {
            await submitCreateViewDraft(activeDialog, { closeDialog: activeDialog.presentation !== 'table' });
            return;
        }
        setPendingViewActionId('action');
        setViewActionError(null);
        try {
            if (activeDialog.mode === 'rename' && activeDialog.viewId) {
                const targetViewId = activeDialog.viewId;
                let nextState = await renameWidgetDashboardViewAsync(targetViewId, activeDialog.title, activeOrganisationId, {
                    viewIconId: activeDialog.viewIconId,
                    isCustomIconSelected: activeDialog.isCustomIconSelected,
                });
                setDashboardState(nextState, activeOrganisationId);
                const shortcut = activeDialog.shortcut;
                if (shortcut) {
                    await saveShortcutGuarded(targetViewId, shortcut, 'collection', activeDialog.shortcutApprovalValue === shortcut.trim().toLowerCase() ? activeDialog.shortcutApproval : undefined);
                }
                else if (shortcut === '') {
                    await clearShortcut(targetViewId, targetViewId, 'collection');
                }
                if (activeDialog.hotkey) {
                    await saveHotkey(targetViewId, targetViewId, normalizeHotkeyString(activeDialog.hotkey), 'collection');
                }
                else {
                    await clearHotkey(targetViewId, targetViewId, 'collection');
                }
            }
            else if (activeDialog.mode === 'delete' && activeDialog.viewId) {
                const targetViewId = activeDialog.viewId;
                const nextState = await deleteWidgetDashboardViewAsync(targetViewId, activeOrganisationId);
                setDashboardState(nextState, activeOrganisationId);
                await clearShortcut(targetViewId, targetViewId, 'collection');
                await clearHotkey(targetViewId, targetViewId, 'collection');
                if (activeDialog.hasLinkedSession && activeDialog.deleteLinkedSession && activeDialog.linkedSessionId) {
                    try {
                        await deleteSession(activeDialog.linkedSessionId);
                    }
                    catch (e) {
                        console.error('[SidebarDashboardViewsSection] failed to delete linked session', e);
                    }
                }
            }
            closeViewDialog();
        }
        catch (error) {
            setViewActionError(error instanceof Error ? error.message : 'Could not update view.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const persistViewTableRow = async (viewId: string, updates: {
        viewIconId?: DashboardViewIconId;
        title?: string;
        shortcut?: string;
        hotkey?: string;
    }) => {
        if (!dashboardState)
            return;
        const view = dashboardState.views.find(candidate => candidate.id === viewId);
        if (!view)
            return;
        setPendingViewActionId(`row-${viewId}`);
        setViewActionError(null);
        try {
            if (typeof updates.title === 'string') {
                const nextTitle = updates.title.trim() || view.title;
                const nextState = await renameWidgetDashboardViewAsync(viewId, nextTitle, activeOrganisationId);
                setDashboardState(nextState, activeOrganisationId);
            }
            if (updates.viewIconId !== undefined) {
                await saveWorkspaceViewAppearance(viewId, { viewIconId: updates.viewIconId, isCustomIconSelected: true });
                setDashboardState(current => current ? {
                    ...current,
                    views: current.views.map(candidate => candidate.id === viewId ? {
                        ...candidate, settings: { ...candidate.settings, viewIconId: updates.viewIconId, isCustomIconSelected: true },
                    } : candidate),
                } : current, activeOrganisationId);
                setViewDialog(current => current?.mode === 'rename' && current.viewId === viewId
                    ? { ...current, viewIconId: updates.viewIconId!, isCustomIconSelected: true }
                    : current);
            }
            if (typeof updates.shortcut === 'string') {
                const nextShortcut = updates.shortcut.trim();
                if (nextShortcut) {
                    await saveShortcutGuarded(viewId, nextShortcut, 'collection', viewDialog?.mode !== 'delete' && viewDialog?.viewId === viewId && viewDialog.shortcutApprovalValue === nextShortcut.toLowerCase() ? viewDialog.shortcutApproval : undefined);
                }
                else {
                    await clearShortcut(viewId, viewId, 'collection');
                }
            }
            if (typeof updates.hotkey === 'string') {
                const nextHotkey = updates.hotkey.trim();
                if (nextHotkey) {
                    await saveHotkey(viewId, viewId, normalizeHotkeyString(nextHotkey), 'collection');
                }
                else {
                    await clearHotkey(viewId, viewId, 'collection');
                }
            }
        }
        catch (error) {
            setViewActionError(error instanceof Error ? error.message : 'Could not update view.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const handleSaveViewTableRow = (viewId: string, updates: {
        viewIconId?: DashboardViewIconId;
        title?: string;
        shortcut?: string;
        hotkey?: string;
    }) => {
        // Preserve input order when capture/clear or blur/Enter saves happen rapidly.
        const save = viewRowSaveQueueRef.current.then(() => persistViewTableRow(viewId, updates));
        viewRowSaveQueueRef.current = save.catch(() => undefined);
        return save;
    };
    const handleToggleViewTableSessionSetting = async (viewId: string, updates: Partial<SessionOpenSettings>) => {
        if (!dashboardState)
            return;
        const linkedSession = getViewLinkedSession(dashboardState, viewId);
        if (!linkedSession)
            return;
        setPendingViewActionId(`session-${viewId}`);
        setViewActionError(null);
        try {
            await saveSessionOpenSettings(linkedSession.sessionId, updates);
        }
        catch (error) {
            setViewActionError(error instanceof Error ? error.message : 'Could not update Workspace settings.');
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const saveViewTableLinks = async (viewId: string, operation: Parameters<typeof editWorkspaceDestinations>[1]): Promise<boolean> => {
        if (!dashboardState)
            return false;
        const linkedSession = getViewLinkedSession(dashboardState, viewId);
        if (!linkedSession)
            return false;
        setPendingViewActionId(`links-${viewId}`);
        setViewActionError(null);
        try {
            await editWorkspaceDestinations(linkedSession.sessionId, operation);
            return true;
        }
        catch (error) {
            setViewActionError(error instanceof Error ? error.message : 'Could not update links.');
            return false;
        }
        finally {
            setPendingViewActionId(null);
        }
    };
    const handleAddViewTableLinks = async (items: SelectedLink[]): Promise<boolean> => {
        if (!addLinksViewId)
            return false;
        const timestamp = Date.now();
        const nextItems = items
            .filter(item => Boolean(item.url))
            .map((item, index) => {
            const title = item.title || item.name || getHostname(item.url);
            return {
                ...item,
                id: item.id || `${item.source || 'session-link'}-${timestamp}-${index}`,
                title,
                name: item.name || title,
            };
        });
        if (nextItems.length === 0)
            return false;
        if (addLinksViewId === 'new-view' && viewDialog?.mode === 'create') {
            setStagedCreateSessionDraft(current => ({
                ...current,
                urls: [...current.urls, ...nextItems],
            }));
            setAddLinksViewId(null);
            return true;
        }
        if (!dashboardState)
            return false;
        const linkedSession = getViewLinkedSession(dashboardState, addLinksViewId);
        if (!linkedSession)
            return false;
        const didSave = await saveViewTableLinks(addLinksViewId, { type: 'add', items: nextItems });
        if (didSave)
            setAddLinksViewId(null);
        return didSave;
    };
    const handleAddViewTableCustomLink = async (url: string, name?: string): Promise<boolean> => {
        let normalizedUrl = url.trim();
        if (!normalizedUrl)
            return false;
        if (!/^https?:\/\//i.test(normalizedUrl)) {
            normalizedUrl = `https://${normalizedUrl}`;
        }
        try {
            new URL(normalizedUrl);
        }
        catch {
            return false;
        }
        const host = getHostname(normalizedUrl);
        const title = name?.trim() || host || normalizedUrl;
        return handleAddViewTableLinks([
            {
                id: `custom-${Date.now()}`,
                title,
                name: title,
                url: normalizedUrl,
                favIconUrl: host ? getFaviconUrlForHost(host) : undefined,
                source: 'custom',
            }
        ]);
    };
    const handleRemoveViewTableLink = async (viewId: string, item: SelectedLink, index: number) => {
        if (viewId === 'new-view' && viewDialog?.mode === 'create') {
            setStagedCreateSessionDraft(current => ({
                ...current,
                urls: current.urls.filter((candidate, candidateIndex) => {
                    if (item.id)
                        return candidate.id !== item.id;
                    return candidateIndex !== index;
                }),
            }));
            return;
        }
        if (!dashboardState)
            return;
        const linkedSession = getViewLinkedSession(dashboardState, viewId);
        if (!linkedSession)
            return;
        await saveViewTableLinks(viewId, { type: 'remove', item });
    };
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
            chromeAny.storage.local.get(['dashboard_views_items_order', 'sidebar_view_visible_items', 'customGroupNames'], (result: any) => {
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
                setIsViewOrderStorageHydrated(true);
            });
            const handleStorageChange = (changes: {
                [key: string]: any;
            }) => {
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
        setIsViewOrderStorageHydrated(true);
        return undefined;
    }, []);
    useEffect(() => {
        if (!isViewOrderStorageHydrated)
            return;
        if (!dashboardState?.views || dashboardState.views.length === 0)
            return;
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
            const isDifferent = nextOrder.length !== prevOrder.length ||
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
    }, [dashboardState?.views, customGroupNames, isViewOrderStorageHydrated, visibleViewItems]);
    return (<div className={`group/workspaceViews flex flex-col select-none w-auto bg-transparent ${isIconOnly || isCollapsed ? 'mx-1' : 'mx-2'}`}>
      {/* Direct Group & Item Content */}
        <div ref={viewSelectorRef} className={`flex flex-col ${isCollapsed || isIconOnly ? 'px-0.5' : 'px-2'} py-1.5`}>
          {(() => {
            // Home remains the new-tab landing dashboard but is not a
            // navigable workspace/collection in the sidebar.
            const allViews = getCollectionWidgetViews(dashboardState?.views);
            if (hasOnlyFastActiveViewPlaceholder(allViews)) {
                return null;
            }
            const validViewIds = new Set(allViews.map(v => v.id));
            const viewsMap = new Map(allViews.map(v => [v.id, v]));
            let orderedItemIds: string[] = viewItemsOrder.filter(id => {
                if (id.startsWith('header-'))
                    return true;
                return validViewIds.has(id);
            });
            orderedItemIds = orderedItemIds.filter(id => id !== 'header-custom_default');
            // Ensure all current views are present
            allViews.forEach(v => {
                if (!orderedItemIds.includes(v.id)) {
                    orderedItemIds.push(v.id);
                }
            });
            return (<DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedItemIds} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-0.5">
                    {orderedItemIds.map((id, index) => {
                    if (id.startsWith('header-')) {
                        if (isIconOnly)
                            return null;
                        const hasActiveChild = (() => {
                            for (let i = index + 1; i < orderedItemIds.length; i++) {
                                if (orderedItemIds[i].startsWith('header-'))
                                    break;
                                if (orderedItemIds[i] === dashboardState?.activeViewId)
                                    return true;
                            }
                            return false;
                        })();
                        if (visibleViewItems[id] === false && !hasActiveChild)
                            return null;
                        const groupId = id.replace('header-', '');
                        const defaultTitle = groupId === 'custom_work' ? 'Work' : groupId === 'custom_personal' ? 'Personal Workspace' : groupId === 'custom_college' ? 'College' : groupId.replace(/^custom_/, '');
                        const groupTitle = customGroupNames[groupId] || defaultTitle;
                        return (<SortableHeader key={id} id={id}>
                            <>
                              <div className={`flex items-center ${isCollapsed ? (index === 0 ? 'mt-1' : 'mt-2') : (index === 0 ? 'mt-1' : 'mt-2.5')} mb-0.5 ${isCollapsed ? 'pl-1.5 pr-1 gap-1.5 justify-start text-left' : 'px-2 gap-2'} select-none`}>
                                <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${isCollapsed ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-[var(--color-iconDefault)]`}>
                                  <LuLayers size={isCollapsed ? 11 : 15}/>
                                </span>
                                <span className={`${isCollapsed ? 'min-w-0 max-w-full truncate whitespace-nowrap text-left text-[8.5px] leading-none tracking-normal' : 'min-w-0 max-w-full truncate whitespace-nowrap text-[12px] tracking-normal'} font-medium capitalize text-[var(--color-textSecondary)]`} title={groupTitle}>
                                  {groupTitle}
                                </span>
                              </div>
                              <div className="mx-2 mb-1 h-px bg-[var(--color-borderDefault)]"/>
                            </>
                          </SortableHeader>);
                    }
                    const view = viewsMap.get(id);
                    if (!view)
                        return null;
                    const isEditingThisView = viewDialog?.mode === 'rename' && viewDialog.viewId === view.id;
                    const viewTitle = isEditingThisView
                        ? viewDialog.title || view.title || 'Untitled'
                        : view.title || 'Untitled';
                    const linkedSession = getViewLinkedSession(dashboardState, view.id);
                    const isLinkedSessionRunning = Boolean(linkedSession?.sessionId) &&
                        linkedSession?.sessionId === currentWindowSessionStatus?.sessionId;
                    const isLinkedSessionFocused = isLinkedSessionRunning && currentWindowSessionStatus?.focusMode === true;
                    const sessionStatusTitle = isLinkedSessionFocused
                        ? 'Session running in Focus Mode'
                        : 'Session running';
                    const isActive = view.id === dashboardState?.activeViewId;
                    if (!isActive && visibleViewItems[id] === false)
                        return null;
                    return (<SortableViewItem key={view.id} id={view.id}>
                          <FocusedSessionHoverControl enabled={isLinkedSessionFocused && activeDragId === null} sessionTitle={linkedSession?.sessionId ? viewTitle : 'Session'} isUpdating={focusModeUpdatingSessionId === linkedSession?.sessionId} onTurnOff={() => handleTurnOffFocusMode(linkedSession!.sessionId)}>
                            <div onClick={() => handleSwitchView(view.id)} onContextMenu={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRenameView(view.id);
                        }} aria-current={isActive ? 'page' : undefined} aria-label={viewTitle} title={viewTitle} className={`group/view-row relative w-full ${isIconOnly ? 'flex h-10 flex-col items-center justify-center gap-0.5' : isCollapsed ? 'grid h-7 grid-cols-[minmax(0,1fr)_14px] items-center text-left' : 'grid h-7 grid-cols-[minmax(0,1fr)_20px] items-center'} ${isIconOnly ? 'gap-0.5' : isCollapsed ? 'gap-0.5' : 'gap-2'} rounded-md ${isIconOnly
                            ? 'px-1'
                            : isCollapsed
                                ? 'pl-1.5 pr-0.5'
                                : 'h-7 pl-2 pr-1'} ${isIconOnly ? '' : isCollapsed ? 'text-[9px] font-medium' : 'text-[12.5px] font-medium'} cursor-pointer transition-colors ${isActive
                            ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                              {isIconOnly ? (<>
                                  <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center text-[var(--color-iconDefault)] opacity-80 group-hover/view-row:opacity-100">
                                    <DashboardViewIcon iconId={view.settings?.viewIconId} size={15}/>
                                  </span>
                                  <span className="w-full min-w-0 truncate whitespace-nowrap px-0.5 text-center text-[8px] font-medium leading-none">
                                    {viewTitle}
                                  </span>
                                  {isLinkedSessionRunning && (<span role="status" aria-label={sessionStatusTitle} className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${isLinkedSessionFocused
                                    ? 'bg-[var(--color-danger)]'
                                    : 'bg-[var(--color-success)]'}`}/>)}
                                </>) : isCollapsed ? (<>
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--color-iconDefault)]">
                                      <DashboardViewIcon iconId={view.settings?.viewIconId} size={11}/>
                                    </span>
                                    <span className="min-w-0 truncate whitespace-nowrap text-left text-[9px] font-medium leading-none tracking-normal">
                                      {viewTitle}
                                    </span>
                                  </div>
                                  <div className="relative flex h-5 w-3.5 shrink-0 items-center justify-center">
                                    {isLinkedSessionRunning && (<span role="status" aria-label={sessionStatusTitle} title={sessionStatusTitle} className={`absolute -left-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ${isLinkedSessionFocused
                                    ? 'bg-[var(--color-danger)]'
                                    : 'bg-[var(--color-success)]'}`}/>)}
                                    <button type="button" aria-label={`Open ${viewTitle} Workspace`} disabled={pendingViewActionId !== null} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleOpenViewSession(view.id);
                            }} className="inline-flex h-5 w-3.5 items-center justify-center rounded-sm text-[var(--color-textMuted)] opacity-0 transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] group-hover/view-row:opacity-100 group-focus-within/view-row:opacity-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30">
                                       <LuExternalLink size={10} className="shrink-0"/>
                                     </button>
                                  </div>
                                </>) : (<>
                                <div className="relative flex min-w-0 items-center gap-1.5 overflow-hidden pl-7">
                                  <span aria-hidden="true" className="absolute left-0 flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-iconDefault)]">
                                    <DashboardViewIcon iconId={view.settings?.viewIconId} size={15}/>
                                  </span>
                                  <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-none">
                                    {viewTitle}
                                  </span>
                                  {isLinkedSessionRunning && (<span role="status" aria-label={sessionStatusTitle} title={sessionStatusTitle} className={`h-1.5 w-1.5 shrink-0 rounded-full ${isLinkedSessionFocused
                                    ? 'bg-[var(--color-danger)]'
                                    : 'bg-[var(--color-success)]'}`}/>)}
                                </div>
                                <button type="button" aria-label={`Open ${viewTitle} Workspace`} disabled={pendingViewActionId !== null} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleOpenViewSession(view.id);
                            }} className="inline-flex h-5 w-5 items-center justify-center justify-self-center rounded-md text-[var(--color-textMuted)] opacity-0 transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] group-hover/view-row:opacity-100 group-focus-within/view-row:opacity-100 cursor-pointer">
                                   <LuExternalLink size={13} className="shrink-0"/>
                                 </button>
                                </>)}
                            </div>
                          </FocusedSessionHoverControl>
                        </SortableViewItem>);
                })}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragId && activeDragId.startsWith('header-') ? ((() => {
                    const groupId = activeDragId.replace('header-', '');
                    const defaultTitle = groupId === 'custom_work' ? 'Work' : groupId === 'custom_personal' ? 'Personal Workspace' : groupId === 'custom_college' ? 'College' : groupId.replace(/^custom_/, '');
                    const groupTitle = customGroupNames[groupId] || defaultTitle;
                    return (<div className={`scale-105 opacity-80 shadow-md rounded-md ${isCollapsed ? 'pl-1.5 pr-1 gap-1.5' : 'px-2 gap-3'} py-1.5 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[180px] text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)] flex items-center`}>
                          <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${isCollapsed ? 'h-3.5 w-3.5' : 'h-5 w-5'} text-[var(--color-iconDefault)]`}>
                            <LuLayers size={isCollapsed ? 11 : 15}/>
                          </span>
                          <span className="min-w-0 truncate">{groupTitle}</span>
                        </div>);
                })()) : activeDragId && viewsMap.get(activeDragId) ? (<div className="scale-105 opacity-80 shadow-md rounded-md p-1.5 bg-[var(--color-sidebarBg)] border border-white/10 pointer-events-none w-[180px] text-xs font-semibold text-[var(--color-textPrimary)] truncate flex items-center gap-2">
                      <DashboardViewIcon iconId={viewsMap.get(activeDragId)?.settings?.viewIconId} size={14}/>
                      <span className="truncate">{viewsMap.get(activeDragId)?.title}</span>
                    </div>) : null}
                </DragOverlay>
              </DndContext>);
        })()}

          {!isIconOnly && (<div ref={newCollectionAnchorRef} className="flex justify-center pt-3 opacity-0 group-hover/workspaceViews:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
              <button type="button" title="New workspace" aria-label="New workspace" onClick={handleCreateView} disabled={pendingViewActionId !== null} className="inline-flex items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-[var(--color-textSecondary)] transition-all hover:bg-[var(--color-bgHover)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                <LuPlus size={15}/>
                {!isCollapsed && <span>New workspace</span>}
              </button>
            </div>)}
        </div>

      {(viewDialog?.mode === 'create' || viewDialog?.mode === 'rename') && (() => {
            const linkedSession = viewDialog.mode === 'rename' ? getViewLinkedSession(dashboardState, viewDialog.viewId) : null;
            const nonSessionViewWidgets = viewDialog.mode === 'rename' && viewDialog.viewId && dashboardState
                ? dashboardState.widgets.filter(widget => widget.viewId === viewDialog.viewId && normalizeWidgetType(widget.type) !== 'session-item')
                : [];
            const existingCollectionRows: CollectionViewTableRow[] = getCollectionWidgetViews(dashboardState?.views).map(view => {
                const viewLinkedSession = getViewLinkedSession(dashboardState, view.id);
                const session = sessions.find(candidate => String(candidate.id) === String(viewLinkedSession?.sessionId || ''));
                const sessionSettings = normalizeSessionOpenSettings(session?.sessionOpenSettings);
                const sessionLinks = Array.isArray(session?.urls) ? session.urls : [];
                return {
                    id: view.id,
                    viewIconId: normalizeDashboardViewIconId(view.settings?.viewIconId),
                    title: view.title,
                    shortcut: getMappedValueForView(shortcutsMap, view.id),
                    hotkey: getMappedValueForView(hotkeysMap, view.id),
                    linkCount: sessionLinks.length,
                    links: sessionLinks,
                    canEditLinks: Boolean(viewLinkedSession?.sessionId),
                    focusMode: sessionSettings.focusMode === true,
                    autoSave: sessionSettings.autoSaveMode === 'auto_save',
                };
            }) || [];
            const primaryViewId = viewDialog.mode === 'rename' ? viewDialog.tablePrimaryViewId || viewDialog.viewId : null;
            const collectionViewRows: CollectionViewTableRow[] = viewDialog.mode === 'create'
                ? [
                    {
                        id: 'new-view',
                        title: viewDialog.title,
                        shortcut: viewDialog.shortcut || '',
                        hotkey: viewDialog.hotkey || '',
                        linkCount: stagedCreateSessionDraft.urls.length,
                        links: stagedCreateSessionDraft.urls,
                        canEditLinks: true,
                        focusMode: normalizeSessionOpenSettings(stagedCreateSessionDraft.sessionOpenSettings).focusMode,
                        autoSave: stagedCreateSessionDraft.sessionOpenSettings?.autoSaveMode === 'auto_save',
                        isDraft: true,
                    },
                    ...existingCollectionRows
                ]
                : [
                    ...existingCollectionRows.filter(row => row.id === primaryViewId),
                    ...existingCollectionRows.filter(row => row.id !== primaryViewId)
                ];
            return (<CreateCollectionDialog anchorRef={viewDialog.mode === 'create' ? newCollectionAnchorRef : viewSelectorRef} dialog={viewDialog} setDialog={setViewDialog} onClose={closeViewDialog} onSubmit={handleSubmitViewDialog} actionError={viewActionError} pendingActionId={pendingViewActionId} onOverrideShortcut={handleOverrideShortcut} onRequestDelete={() => {
                    if (viewDialog.mode === 'rename' && viewDialog.viewId) {
                        void handleDeleteView(viewDialog.viewId);
                    }
                }} viewRows={collectionViewRows} onSaveViewRow={handleSaveViewTableRow} onSelectViewRow={handleSelectViewTableRow} onDeleteViewRow={viewId => void handleDeleteView(viewId)} onToggleViewSessionSetting={handleToggleViewTableSessionSetting} onRequestAddViewLinks={viewId => setAddLinksViewId(viewId)} onRemoveViewRowLink={handleRemoveViewTableLink} linkedSessionId={linkedSession?.sessionId} linkedWidgetId={linkedSession?.widgetId} stagedWidgets={viewDialog.mode === 'rename'
                    ? nonSessionViewWidgets.map(widget => {
                        const catalogItem = WIDGET_CATALOG_CATEGORIES.flatMap(c => c.items).find(i => normalizeWidgetType(i.type) === normalizeWidgetType(widget.type));
                        return {
                            id: widget.id,
                            title: getWidgetDisplayName(widget),
                            type: widget.type || catalogItem?.type || 'session-item',
                            icon: catalogItem?.icon || LuLayers,
                            sizePreset: widget.sizePreset || catalogItem?.sizePreset || 'medium',
                            layout: catalogItem?.layout || { x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
                        };
                    })
                    : stagedCreateWidgets} pendingWidgetIds={pendingWidgetAddIds} draftSession={stagedCreateSessionDraft} onDraftSessionChange={setStagedCreateSessionDraft} onStageWidget={item => {
                    if (viewDialog.mode === 'rename' && viewDialog.viewId) {
                        void handleAddWidgetFromDialog(viewDialog.viewId, item);
                    }
                    else {
                        handleStageCreateWidget(item);
                    }
                }} onRemoveStagedWidget={index => {
                    if (viewDialog.mode === 'rename' && viewDialog.viewId && dashboardState) {
                        const widget = nonSessionViewWidgets[index];
                        if (widget) {
                            void handleDeleteWidgetFromDialog(viewDialog.viewId, widget.id);
                        }
                    }
                    else {
                        handleRemoveStagedCreateWidget(index);
                    }
                }} position="centered"/>);
        })()}

      {addLinksViewId && (<React.Suspense fallback={null}>
          <SessionAddLinksModal isOpen={true} availableTabs={addLinksBrowserTabs.filter(tab => {
                const linkedSession = getViewLinkedSession(dashboardState, addLinksViewId);
                const savedLinks = addLinksViewId === 'new-view'
                    ? stagedCreateSessionDraft.urls
                    : sessions.find(session => String(session.id) === String(linkedSession?.sessionId))?.urls || [];
                return !savedLinks.some(link => link.url === tab.url);
            })} onAddAvailableTab={item => handleAddViewTableLinks([item])} notes={notes} snippets={snippets} chatAgents={sessionAgentSuggestions} onAddCustomLink={handleAddViewTableCustomLink} onAddSessionLinks={handleAddViewTableLinks} onClose={() => setAddLinksViewId(null)}/>
        </React.Suspense>)}

      {/* Side Popover for Delete Dialog */}
      {viewDialog &&
            viewDialog.mode === 'delete' &&
            (() => {
                const rect = viewSelectorRef.current?.getBoundingClientRect();
                const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
                const viewportMargin = 16;
                const leftPos = rect ? rect.right + 10 : 280;
                const isOnlyOneView = (dashboardState?.views.length || 0) <= 1;
                return ReactDOM.createPortal(<div className="fixed z-[999999] flex items-start justify-start pointer-events-auto animate-in fade-in duration-150" style={{ top: `${Math.max(viewportMargin, rect ? rect.top : 100)}px`, left: `${leftPos}px` }}>
              <div className="flex w-[380px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border shadow-2xl p-4 transition-colors custom-scrollbar" style={{
                        backgroundColor: 'var(--color-editorBg)',
                        borderColor: 'var(--color-borderDefault)',
                        color: 'var(--color-textPrimary)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                    }}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-borderDefault)]">
                  <h3 className="min-w-0 flex-1 truncate text-sm font-bold tracking-wide text-[var(--color-textPrimary)]">
                    Delete View
                  </h3>
                  <button type="button" aria-label="Close" onClick={closeViewDialog} className="p-1 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                    <LuX size={16}/>
                  </button>
                </div>

                <div className="py-3 flex flex-col gap-2">
                  {isOnlyOneView ? (<span className="text-xs font-semibold text-[var(--color-danger)]">
                      Cannot delete the last workspace view. At least one view must remain.
                    </span>) : (<span className="text-xs font-semibold text-[var(--color-textPrimary)]">
                      Delete "{viewDialog.title}" and its {viewDialog.widgetCount} widget
                      {viewDialog.widgetCount === 1 ? '' : 's'}?
                    </span>)}
                  {viewDialog.hasLinkedSession && !isOnlyOneView && (<label className="flex items-center gap-2 mt-1 cursor-pointer w-fit text-[var(--color-textPrimary)] hover:text-[var(--color-brand)] transition-colors text-xs">
                      <input type="checkbox" checked={viewDialog.deleteLinkedSession} onChange={e => setViewDialog(prev => prev && prev.mode === 'delete'
                            ? { ...prev, deleteLinkedSession: e.target.checked }
                            : prev)} className="h-3.5 w-3.5 rounded border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-focusRing)] cursor-pointer"/>
                      <span>Delete linked session as well</span>
                    </label>)}
                </div>

                {viewActionError && (<div className="pb-2 text-[11px] font-semibold text-[var(--color-danger)]">{viewActionError}</div>)}

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-borderDefault)]">
                  <button type="button" onClick={closeViewDialog} disabled={pendingViewActionId !== null} className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-bold text-[var(--color-textSecondary)] hover:bg-[var(--color-bgHover)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                    Cancel
                  </button>
                  <button type="button" onClick={() => void handleSubmitViewDialog()} disabled={pendingViewActionId !== null || isOnlyOneView} className="rounded-lg bg-[var(--color-danger)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-textPrimary)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                    Delete
                  </button>
                </div>
              </div>
            </div>, document.body);
            })()}
    </div>);
};
export default SidebarDashboardViewsSection;
