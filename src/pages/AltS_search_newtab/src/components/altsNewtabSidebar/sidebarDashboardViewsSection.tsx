import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { FaCaretDown, FaCaretRight } from 'react-icons/fa';
import { LuChevronDown, LuPencil, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { FiMoreVertical } from 'react-icons/fi';
import {
  createWidgetDashboardViewAsync,
  deleteWidgetDashboardViewAsync,
  loadWidgetDashboardStateAsync,
  renameWidgetDashboardViewAsync,
  switchWidgetDashboardViewAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
} from '../../../../../storage/localStorage/widgetDashboardStorage';
import {
  getViewsSectionCollapsed,
  setViewsSectionCollapsed,
  VIEWS_SECTION_COLLAPSED_STORAGE_KEY,
} from '../../../../../storage/localStorage/viewsSectionCollapseStorage';
import type { WidgetDashboardState } from '../widgets/widgetDashboard.types';

type ViewDialogState =
  | { mode: 'create'; title: string }
  | { mode: 'rename'; viewId: string; title: string }
  | { mode: 'delete'; viewId: string; title: string; widgetCount: number }
  | null;

export const SidebarDashboardViewsSection: React.FC = () => {
  const [isViewsExpanded, setIsViewsExpanded] = useState<boolean>(true);
  const [dashboardState, setDashboardState] = useState<WidgetDashboardState | null>(null);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [pendingViewActionId, setPendingViewActionId] = useState<string | null>(null);
  const [viewActionError, setViewActionError] = useState<string | null>(null);
  const [viewDialog, setViewDialog] = useState<ViewDialogState>(null);
  const viewSelectorRef = useRef<HTMLDivElement | null>(null);

  const fetchDashboardState = () => {
    loadWidgetDashboardStateAsync()
      .then(state => setDashboardState(state))
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchDashboardState();

    const loadCollapseState = async () => {
      const isCollapsed = await getViewsSectionCollapsed();
      setIsViewsExpanded(!isCollapsed);
    };
    loadCollapseState();

    const handleStorageChange = () => fetchDashboardState();
    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleStorageChange);

    const handleChromeStorageChange = (changes: { [key: string]: any }) => {
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

  const activeView = dashboardState?.views.find(v => v.id === dashboardState.activeViewId);

  const handleSwitchView = async (viewId: string) => {
    setIsViewDropdownOpen(false);
    setPendingViewActionId(viewId);
    setViewActionError(null);
    try {
      const nextState = await switchWidgetDashboardViewAsync(viewId);
      setDashboardState(nextState);
    } catch (error) {
      setViewActionError(error instanceof Error ? error.message : 'Could not switch view.');
    } finally {
      setPendingViewActionId(null);
    }
  };

  const handleCreateView = () => {
    setIsViewDropdownOpen(false);
    setViewActionError(null);
    setViewDialog({ mode: 'create', title: '' });
  };

  const handleRenameView = (viewId: string) => {
    if (!dashboardState) return;
    const view = dashboardState.views.find(v => v.id === viewId);
    if (!view) return;

    setIsViewDropdownOpen(false);
    setViewActionError(null);
    setViewDialog({ mode: 'rename', viewId, title: view.title });
  };

  const handleDeleteView = (viewId: string) => {
    if (!dashboardState || dashboardState.views.length <= 1) return;
    const view = dashboardState.views.find(v => v.id === viewId);
    if (!view) return;

    setIsViewDropdownOpen(false);
    const widgetCount = dashboardState.widgets.filter(w => w.viewId === viewId).length;
    setViewActionError(null);
    setViewDialog({ mode: 'delete', viewId, title: view.title, widgetCount });
  };

  const handleSubmitViewDialog = async () => {
    if (!viewDialog) return;
    setPendingViewActionId('action');
    setViewActionError(null);
    try {
      if (viewDialog.mode === 'create') {
        const nextState = await createWidgetDashboardViewAsync(viewDialog.title);
        setDashboardState(nextState);
      } else if (viewDialog.mode === 'rename') {
        const nextState = await renameWidgetDashboardViewAsync(viewDialog.viewId, viewDialog.title);
        setDashboardState(nextState);
      } else if (viewDialog.mode === 'delete') {
        const nextState = await deleteWidgetDashboardViewAsync(viewDialog.viewId);
        setDashboardState(nextState);
      }
      setViewDialog(null);
    } catch (error) {
      setViewActionError(error instanceof Error ? error.message : 'Could not update view.');
    } finally {
      setPendingViewActionId(null);
    }
  };

  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([]);
  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});
  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(
        ['sidebar_view_items_order', 'dashboard_views_items_order', 'sidebar_view_visible_items', 'customGroupNames'],
        (result: any) => {
          const order = result?.sidebar_view_items_order || result?.dashboard_views_items_order;
          if (order) {
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
        if (changes['sidebar_view_items_order'] || changes['dashboard_views_items_order']) {
          const newOrder = changes['sidebar_view_items_order']?.newValue || changes['dashboard_views_items_order']?.newValue || [];
          setViewItemsOrder(newOrder);
        }
        if (changes['sidebar_view_visible_items']) {
          setVisibleViewItems(changes['sidebar_view_visible_items'].newValue || {});
        }
        if (changes['customGroupNames']) {
          setCustomGroupNames(changes['customGroupNames'].newValue || {});
        }
      };
      chromeAny.storage.onChanged.addListener(handleStorageChange);
      return () => chromeAny.storage.onChanged.removeListener(handleStorageChange);
    }
    return undefined;
  }, []);

  return (
    <div className="group/workspaceViews flex flex-col select-none w-full">
      {/* Accordion Caret Header */}
      <div className={`px-3 pt-2 ${isViewsExpanded ? 'pb-1' : 'pb-0'}`}>
        <button
          type="button"
          aria-label={isViewsExpanded ? 'Collapse Workspace Views' : 'Expand Workspace Views'}
          aria-expanded={isViewsExpanded}
          onClick={handleToggleViewsExpanded}
          className="w-full flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors text-left cursor-pointer">
          <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
            Workspace Views
          </span>
          <span className="w-4 h-4 flex items-center justify-center text-[var(--color-textMuted)]">
            {isViewsExpanded ? <FaCaretDown size={12} /> : <FaCaretRight size={12} />}
          </span>
        </button>
      </div>

      {/* Expanded Direct Group & Item Content */}
      {isViewsExpanded && (
        <div ref={viewSelectorRef} className="flex flex-col px-3 pt-0.5 pb-2">
          {(() => {
            const viewsMap = new Map((dashboardState?.views || []).map(v => [v.id, v]));
            let hasSeenGroupHeader = false;

            // Determine order of items: custom ordered items if saved, else default view list
            const hasCustomHeaders = viewItemsOrder.some(id => id.startsWith('header-custom_'));
            const orderedItemIds = hasCustomHeaders
              ? viewItemsOrder
              : (dashboardState?.views || []).map(v => v.id);

            return (
              <div className="flex flex-col gap-1">
                {orderedItemIds.map((id, index) => {
                  if (id.startsWith('header-')) {
                    if (!id.startsWith('header-custom_')) return null;
                    const hasActiveChild = (() => {
                      for (let i = index + 1; i < orderedItemIds.length; i++) {
                        if (orderedItemIds[i].startsWith('header-')) break;
                        if (orderedItemIds[i] === dashboardState?.activeViewId) return true;
                      }
                      return false;
                    })();
                    if (visibleViewItems[id] === false && !hasActiveChild) return null;
                    const groupId = id.replace('header-', '');
                    const groupTitle = customGroupNames[groupId] || '';
                    if (!groupTitle.trim()) return null;

                    hasSeenGroupHeader = true;
                    return (
                      <div key={id} className="flex items-center gap-2 mt-2 mb-1 px-1.5 select-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                        <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
                          {groupTitle}
                        </span>
                      </div>
                    );
                  }

                  const view = viewsMap.get(id);
                  if (!view) return null;

                  const isActive = view.id === dashboardState?.activeViewId;
                  if (!isActive && visibleViewItems[id] === false) return null;
                  const isIndented = hasSeenGroupHeader;

                  return (
                    <div
                      key={view.id}
                      onClick={() => handleSwitchView(view.id)}
                      className={`group flex w-full items-center justify-between gap-2 rounded-md ${
                        isIndented ? 'pl-[38px] pr-2' : 'pl-[28px] pr-2'
                      } py-1 text-xs font-semibold cursor-pointer transition-colors ${
                        isActive
                          ? 'text-[var(--color-textPrimary)]'
                          : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                      }`}>
                      <span className="min-w-0 flex-1 truncate">
                        {view.title}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-textMuted)] hover:bg-black/10 dark:hover:bg-white/10 hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                          <LuPencil size={11} />
                        </button>
                        <button
                          type="button"
                          title={(dashboardState?.views.length || 0) <= 1 ? 'At least one view is required' : 'Delete view'}
                          aria-label={`Delete ${view.title}`}
                          disabled={(dashboardState?.views.length || 0) <= 1 || pendingViewActionId !== null}
                          onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteView(view.id);
                          }}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-textMuted)] hover:bg-[var(--color-dangerBg)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-30 transition-colors cursor-pointer">
                          <LuTrash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-center pt-1 opacity-0 group-hover/workspaceViews:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                  <button
                    type="button"
                    title="Create New View"
                    aria-label="Create New View"
                    onClick={handleCreateView}
                    disabled={pendingViewActionId !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-[11px] font-semibold text-[var(--color-textMuted)] transition-all hover:bg-[var(--color-bgHover)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                    <LuPlus size={15} />
                    <span>Create New View</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Side Popover for Create/Rename/Delete Dialog */}
      {viewDialog && (() => {
        const rect = viewSelectorRef.current?.getBoundingClientRect();
        const topPos = rect ? Math.max(16, rect.top) : 60;
        const leftPos = rect ? rect.right + 10 : 280;

        return ReactDOM.createPortal(
          <div
            className="fixed z-[999999] flex items-start justify-start pointer-events-auto animate-in fade-in duration-150"
            style={{ top: `${topPos}px`, left: `${leftPos}px` }}>
            <div
              className="flex flex-col w-[320px] rounded-2xl border shadow-2xl overflow-hidden p-5 transition-colors"
              style={{
                backgroundColor: 'var(--color-editorBg)',
                borderColor: 'var(--color-borderDefault)',
                color: 'var(--color-textPrimary)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
              }}>
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-borderDefault)]">
                <h3 className="text-sm font-bold tracking-wide text-[var(--color-textPrimary)]">
                  {viewDialog.mode === 'create'
                    ? 'Create View'
                    : viewDialog.mode === 'rename'
                      ? 'Rename View'
                      : 'Delete View'}
                </h3>
                <button
                  type="button"
                  onClick={() => setViewDialog(null)}
                  className="p-1 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors">
                  <LuX size={16} />
                </button>
              </div>

              {viewDialog.mode === 'delete' ? (
                <div className="py-4 text-xs font-medium leading-5 text-[var(--color-textSecondary)]">
                  Delete "{viewDialog.title}" and its {viewDialog.widgetCount} widget
                  {viewDialog.widgetCount === 1 ? '' : 's'}?
                </div>
              ) : (
                <div className="py-4 flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold tracking-wide text-[var(--color-textMuted)]">
                    View Name
                  </label>
                  <input
                    autoFocus
                    placeholder="Enter view title..."
                    value={viewDialog.title}
                    maxLength={40}
                    onChange={event => setViewDialog({ ...viewDialog, title: event.target.value })}
                    onKeyDown={event => {
                      if (event.key === 'Enter') handleSubmitViewDialog();
                      if (event.key === 'Escape') setViewDialog(null);
                    }}
                    className="w-full rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2.5 text-xs font-semibold text-[var(--color-textPrimary)] outline-none transition focus:border-[var(--color-borderActive)]"
                  />
                </div>
              )}

              {viewActionError && (
                <div className="pb-2 text-[11px] font-semibold text-[var(--color-danger)]">{viewActionError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-borderDefault)]">
                <button
                  type="button"
                  onClick={() => setViewDialog(null)}
                  disabled={pendingViewActionId !== null}
                  className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-bold text-[var(--color-textSecondary)] hover:bg-[var(--color-bgHover)] disabled:cursor-not-allowed disabled:opacity-60">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitViewDialog}
                  disabled={pendingViewActionId !== null}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold text-[var(--color-textPrimary)] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    viewDialog.mode === 'delete'
                      ? 'bg-[var(--color-danger)] hover:opacity-90'
                      : 'bg-[var(--color-borderActive)] hover:opacity-90'
                  }`}>
                  {viewDialog.mode === 'delete' ? 'Delete' : 'Save View'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </div>
  );
};
