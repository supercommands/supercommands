import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import WidgetGrid from './WidgetGrid';
import { normalizeWidgetLayout } from '../engine/widgetLayoutEngine';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import { db } from '../../../../../../storage/indexDB/dbConfig';
import { applyWidgetCustomSizeAsync, applyWidgetSizePresetAsync, commitWidgetDashboardLayoutAsync, commitWidgetDashboardResizeAsync, deleteWidgetInstanceAsync, LEGACY_WIDGET_DASHBOARD_STORAGE_KEY, loadWidgetDashboardStateAsync, purgeMissingNoteWidgetsAsync, purgeMissingLinkWidgetsAsync, WIDGET_DASHBOARD_BROADCAST_CHANNEL, WIDGET_DASHBOARD_STORAGE_EVENT, WIDGET_DASHBOARD_STORAGE_KEY, } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import type { WidgetGridPosition, WidgetSizePreset } from '../widgetDashboard.types';
import type { CollectionOpenBehavior } from '../../../../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { launchSessionSmartWithReferences } from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { normalizeSessionOpenSettings } from '../../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import { startupPerf } from '../../../startupPerf';
import { useInlineWidgetAddition } from './useInlineWidgetAddition';
interface WidgetDashboardProps {
    scrollContainerRef: RefObject<HTMLElement | null>;
    isEditMode?: boolean;
    onEnterWidgetEditMode?: (widgetId?: string) => void;
    onExitWidgetEditMode?: () => void;
    pendingSelectedWidgetId?: string | null;
    onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}
type WidgetDashboardViewSwitchDetail = {
    viewId?: string;
    trigger?: 'manual-click' | 'system';
};
const ENABLE_WIDGET_DASHBOARD_LOGS = false;
const ENABLE_DASHBOARD_AUTO_RUN_LOGS = false;
const dashboardPerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_WIDGET_DASHBOARD_LOGS)
        return;
    console.log('[NewTabPerf][WidgetDashboard]', label, JSON.stringify(data || {}));
};
const dashboardAutoRunDebug = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_DASHBOARD_AUTO_RUN_LOGS)
        return;
    console.log('[DashboardAutoRun][dashboard]', label, data || {});
};
const dashboardAutoRunWarn = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_DASHBOARD_AUTO_RUN_LOGS)
        return;
    console.warn('[DashboardAutoRun][dashboard]', label, data || {});
};
const applyCollectionOpenBehaviorToSessionSettings = (sessionOpenSettings: any, openBehavior?: CollectionOpenBehavior) => {
    const baseSettings = { ...(sessionOpenSettings || {}) };
    if (openBehavior === 'respect_session') {
        return baseSettings;
    }
    if (openBehavior === 'new_window') {
        return {
            ...baseSettings,
            openMode: 'new_window',
            focusMode: false,
        };
    }
    if (openBehavior === 'focus_mode') {
        return {
            ...baseSettings,
            openMode: 'same_window',
            focusMode: true,
        };
    }
    if (openBehavior === 'same_window') {
        return {
            ...baseSettings,
            openMode: 'same_window',
            focusMode: false,
        };
    }
    return baseSettings;
};
const getCurrentExtensionTabContext = async (): Promise<{
    currentTabId?: number;
    currentWindowId?: number;
    currentPageUrl?: string;
}> => {
    const chromeAny = (window as any).chrome;
    const fallbackToCurrentWindow = () => new Promise<{
        currentTabId?: number;
        currentWindowId?: number;
        currentPageUrl?: string;
    }>(resolve => {
        if (!chromeAny?.windows?.getCurrent) {
            resolve({ currentPageUrl: window.location.href });
            return;
        }
        chromeAny.windows.getCurrent((win: any) => {
            resolve({
                currentWindowId: win?.id,
                currentPageUrl: window.location.href,
            });
        });
    });
    if (!chromeAny?.tabs?.getCurrent) {
        return fallbackToCurrentWindow();
    }
    return new Promise(resolve => {
        chromeAny.tabs.getCurrent((tab: any) => {
            if (typeof tab?.windowId !== 'number') {
                fallbackToCurrentWindow().then(resolve);
                return;
            }
            resolve({
                currentTabId: tab?.id,
                currentWindowId: tab?.windowId,
                currentPageUrl: tab?.url || window.location.href,
            });
        });
    });
};
const setActiveDashboardViewSession = async (viewId: string, sessionId: string | null) => {
    const chromeAny = (window as any).chrome;
    if (!chromeAny?.runtime?.sendMessage)
        return;
    try {
        const currentTabContext = await getCurrentExtensionTabContext();
        await chromeAny.runtime.sendMessage({
            action: 'set_active_dashboard_view_session',
            viewId,
            sessionId,
            windowId: currentTabContext.currentWindowId,
        });
    }
    catch (error) {
        console.error('[DashboardAutoRun][dashboard] failed to set active dashboard view session', {
            viewId,
            sessionId,
            error,
        });
    }
};
type ActiveWindowSessionState = {
    sessionId: string;
    pinnedTabId?: number;
    launchSource?: 'session_editor' | 'dashboard_view' | 'autosave_tracking';
    workspaceId?: string | null;
};
const getActiveWindowSessionState = async (windowId?: number): Promise<ActiveWindowSessionState | null> => {
    const chromeAny = (window as any).chrome;
    if (!chromeAny?.runtime?.sendMessage || typeof windowId !== 'number')
        return null;
    try {
        const response = await chromeAny.runtime.sendMessage({ action: 'get_active_sessions' });
        const sessions = Array.isArray(response?.active_sessions) ? response.active_sessions : [];
        const activeSession = sessions.find((session: any) => session.windowId === windowId);
        if (!activeSession?.sessionId)
            return null;
        const dashboardEntry = response?.active_dashboard_view_session?.byWindow?.[String(windowId)];
        return {
            sessionId: String(activeSession.sessionId),
            pinnedTabId: typeof activeSession.pinnedTabId === 'number' ? activeSession.pinnedTabId : undefined,
            launchSource: activeSession.launchSource,
            workspaceId: String(dashboardEntry?.sessionId || '') === String(activeSession.sessionId) &&
                typeof dashboardEntry?.viewId === 'string'
                ? dashboardEntry.viewId
                : null,
        };
    }
    catch (error) {
        console.error('[DashboardAutoRun][dashboard] failed to read active sessions', error);
        return null;
    }
};
const endAnyActiveSessionForWindow = async (windowId?: number): Promise<void> => {
    if (typeof windowId !== 'number')
        return;
    const chromeAny = (window as any).chrome;
    if (!chromeAny?.runtime?.sendMessage)
        return;
    await chromeAny.runtime.sendMessage({ action: 'end_session', windowId });
};
const repairActiveSessionControlTab = async (activeSession: ActiveWindowSessionState): Promise<boolean> => {
    const chromeAny = (window as any).chrome;
    const pinnedTabId = activeSession.pinnedTabId;
    if (!chromeAny?.tabs?.update || typeof pinnedTabId !== 'number' || pinnedTabId <= 0) {
        return false;
    }
    return new Promise(resolve => {
        chromeAny.tabs.update(pinnedTabId, { pinned: true, active: true }, (tab: any) => {
            if (chromeAny.runtime?.lastError || !tab?.id || tab.pinned !== true) {
                resolve(false);
                return;
            }
            resolve(true);
        });
    });
};
const WidgetDashboard = ({ scrollContainerRef, isEditMode = false, onEnterWidgetEditMode, onExitWidgetEditMode, pendingSelectedWidgetId, onQuickCommandSelect, }: WidgetDashboardProps) => {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const dashboardError = useWidgetDashboardStore(state => state.error);
    const loadDashboard = useWidgetDashboardStore(state => state.load);
    const refreshDashboard = useWidgetDashboardStore(state => state.refresh);
    const setDashboardState = useWidgetDashboardStore(state => state.setDashboardState);
    const setActiveDashboardViewId = useWidgetDashboardStore(state => state.setActiveViewId);
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
    const [deletingWidgetIds, setDeletingWidgetIds] = useState<Set<string>>(new Set());
    const organisations = useDbStore(state => state.organisations);
    const activeOrganisationId = organisations[0]?.id || 'default';
    const organisationLoadTargetId = activeOrganisationId || 'default';
    const isStoreInitialized = useDbStore(state => state.isInitialized);
    const dashboardViewIntent = useUIStore(state => state.dashboardViewIntent);
    const clearDashboardViewIntent = useUIStore(state => state.clearDashboardViewIntent);
    const consumedDashboardViewIntentKeyRef = useRef<string | null>(null);
    const pendingAutoSaveLaunchViewKeysRef = useRef<Set<string>>(new Set());
    const inlineWidgetAddition = useInlineWidgetAddition({
        dashboardState,
        activeOrganisationId,
        onDashboardStateChange: state => setDashboardState(state, activeOrganisationId),
    });
    useEffect(() => {
        startupPerf('WidgetDashboard:commit', {
            renderCount: renderCountRef.current,
            hasDashboardState: Boolean(dashboardState),
            dashboardError: dashboardError,
            activeViewId: dashboardState?.activeViewId,
            viewCount: dashboardState?.views?.length || 0,
            widgetCount: dashboardState?.widgets?.length || 0,
            layoutCount: dashboardState?.layout?.length || 0,
            organisationCount: organisations.length,
            isStoreInitialized,
            isEditMode,
        });
    });
    const launchAutoSaveSessionsForView = useCallback(async (viewId: string, openBehavior?: CollectionOpenBehavior) => {
// Home never launches or attaches saved Workspaces.
return;
}, [activeOrganisationId]);
    useEffect(() => {
        if (!dashboardState || !isStoreInitialized)
            return undefined;
        const noteIds = Array.from(new Set(dashboardState.widgets
            .filter(widget => widget.type === 'note-item')
            .map(widget => widget.noteId || (typeof widget.settings?.noteId === 'string' ? widget.settings.noteId : undefined))
            .filter((id): id is string => Boolean(id))));
        const linkIds = Array.from(new Set(dashboardState.widgets
            .filter(widget => widget.type === 'link-item')
            .map(widget => widget.linkId || (typeof widget.settings?.linkId === 'string' ? widget.settings.linkId : undefined))
            .filter((id): id is string => Boolean(id))));
        if (noteIds.length === 0 && linkIds.length === 0)
            return undefined;
        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                if (noteIds.length > 0) {
                    const existingNotes = await db.notes.bulkGet(noteIds);
                    if (cancelled)
                        return;
                    const validNoteIds = new Set(existingNotes.filter(Boolean).map(note => note!.id));
                    if (noteIds.some(id => !validNoteIds.has(id))) {
                        const nextState = await purgeMissingNoteWidgetsAsync(validNoteIds, activeOrganisationId);
                        if (!cancelled)
                            setDashboardState(nextState);
                    }
                }
                if (linkIds.length > 0) {
                    const existingLinks = await db.links.bulkGet(linkIds);
                    if (cancelled)
                        return;
                    const validLinkIds = new Set(existingLinks
                        .filter(link => link && link.deletedAt == null)
                        .map(link => link!.id));
                    if (linkIds.some(id => !validLinkIds.has(id))) {
                        const nextState = await purgeMissingLinkWidgetsAsync(validLinkIds, activeOrganisationId);
                        if (!cancelled)
                            setDashboardState(nextState);
                    }
                }
            })();
        }, 250);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [activeOrganisationId, dashboardState?.widgets, isStoreInitialized, setDashboardState]);
    useEffect(() => {
        if (!isStoreInitialized)
            return undefined;
        let mounted = true;
        const fetchState = async (force = false, source = 'mount', viewId?: string | null) => {
            const startedAt = performance.now();
            dashboardPerf('fetchState:start', {
                activeOrganisationId: organisationLoadTargetId,
                force,
                source,
                organisationCount: organisations.length,
            });
            const state = force
                ? await refreshDashboard(organisationLoadTargetId, { activeViewOnly: true, viewId })
                : await loadDashboard(organisationLoadTargetId, { activeViewOnly: true, viewId });
            if (!mounted || !state)
                return;
            dashboardPerf('fetchState:done', {
                durationMs: Math.round(performance.now() - startedAt),
                activeViewId: state.activeViewId,
                viewCount: state.views.length,
                widgetCount: state.widgets.length,
                layoutCount: state.layout.length,
            });
        };
        fetchState();
        const handleStorageChange = (changes: {
            [key: string]: any;
        }, areaName: string) => {
            const changedKeys = Object.keys(changes);
            dashboardPerf('chrome-storage:changed', {
                areaName,
                keys: changedKeys,
                willRefresh: areaName === 'local' && Boolean(changes[WIDGET_DASHBOARD_STORAGE_KEY] ||
                    changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY] ||
                    changes.active_dashboard_view_session ||
                    changes.active_sessions),
            });
            if (areaName === 'local' &&
                (changes[WIDGET_DASHBOARD_STORAGE_KEY] ||
                    changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY])) {
                fetchState(true, 'chrome-storage');
            }
            else if (areaName === 'local' &&
                (changes.active_dashboard_view_session || changes.active_sessions)) {
                fetchState(true, 'active-session', null);
            }
        };
        const handleWidgetDashboardChange = () => {
            dashboardPerf('dashboard-event:received', {
                event: WIDGET_DASHBOARD_STORAGE_EVENT,
            });
            fetchState(true, 'dashboard-event');
        };
        const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
        window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
        const crossTabChannel = typeof BroadcastChannel !== 'undefined'
            ? new BroadcastChannel(WIDGET_DASHBOARD_BROADCAST_CHANNEL)
            : null;
        crossTabChannel?.addEventListener('message', handleWidgetDashboardChange);
        if (extensionChrome?.storage?.onChanged) {
            extensionChrome.storage.onChanged.addListener(handleStorageChange);
        }
        return () => {
            mounted = false;
            if (extensionChrome?.storage?.onChanged) {
                extensionChrome.storage.onChanged.removeListener(handleStorageChange);
            }
            window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
            crossTabChannel?.removeEventListener('message', handleWidgetDashboardChange);
            crossTabChannel?.close();
        };
    }, [
        isStoreInitialized,
        launchAutoSaveSessionsForView,
        loadDashboard,
        refreshDashboard,
        organisationLoadTargetId,
        organisations.length
    ]);
    useEffect(() => {
        if (!dashboardViewIntent)
            return;
        if (!isStoreInitialized)
            return;
        if (String(dashboardViewIntent.organisationId) !== String(organisationLoadTargetId))
            return;
        const intentKey = `${dashboardViewIntent.organisationId}:${dashboardViewIntent.viewId}:${dashboardViewIntent.mode}:${dashboardViewIntent.requestedAt}`;
        if (consumedDashboardViewIntentKeyRef.current === intentKey)
            return;
        consumedDashboardViewIntentKeyRef.current = intentKey;
        setActiveDashboardViewId(dashboardViewIntent.viewId);
        void refreshDashboard(organisationLoadTargetId, {
            activeViewOnly: true,
            force: true,
            viewId: dashboardViewIntent.viewId,
        });
        if (dashboardViewIntent.mode === 'edit') {
            onEnterWidgetEditMode?.();
        }
        else {
            void launchAutoSaveSessionsForView(dashboardViewIntent.viewId, dashboardViewIntent.openBehavior);
        }
        clearDashboardViewIntent();
    }, [
        clearDashboardViewIntent,
        dashboardViewIntent,
        isStoreInitialized,
        launchAutoSaveSessionsForView,
        onEnterWidgetEditMode,
        refreshDashboard,
        setActiveDashboardViewId,
        organisationLoadTargetId
    ]);
    const prevActiveViewIdRef = useRef<string | null>(null);
    useEffect(() => {
        const currentViewId = dashboardState?.activeViewId ?? null;
        if (prevActiveViewIdRef.current !== null && prevActiveViewIdRef.current !== currentViewId) {
            setSelectedWidgetId(null);
            if (scrollContainerRef?.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
        }
        prevActiveViewIdRef.current = currentViewId;
    }, [dashboardState?.activeViewId, scrollContainerRef]);
    const activeViewLayout = useMemo(() => dashboardState && Array.isArray(dashboardState.layout)
        ? normalizeWidgetLayout(dashboardState.layout.filter(position => position.viewId === dashboardState.activeViewId))
        : [], [dashboardState?.activeViewId, dashboardState?.layout]);
    const sortedWidgets = useMemo(() => {
        const widgetsForView = dashboardState
            ? (Array.isArray(dashboardState.widgets) ? dashboardState.widgets : []).filter(widget => widget.viewId === dashboardState.activeViewId)
            : [];
        const sessionWidgets = widgetsForView
            .filter(widget => widget.type === 'session-item')
            .map(widget => ({
            widgetId: widget.id,
            viewId: widget.viewId,
            sessionId: widget.sessionId,
            referenceId: widget.referenceId,
            referenceType: widget.referenceType,
        }));
        if (sessionWidgets.length > 0) {
            dashboardAutoRunDebug('render widgets for active view', {
                activeViewId: dashboardState?.activeViewId,
                sessionWidgets,
            });
        }
        const positions = new Map(activeViewLayout.map(position => [position.i, position]));
        return widgetsForView.sort((first, second) => {
            const firstPosition = positions.get(first.id);
            const secondPosition = positions.get(second.id);
            if (!firstPosition || !secondPosition)
                return firstPosition ? -1 : secondPosition ? 1 : 0;
            return firstPosition.y - secondPosition.y || firstPosition.x - secondPosition.x;
        });
    }, [dashboardState?.activeViewId, dashboardState?.widgets, activeViewLayout]);
    const commitRevisionRef = useRef<number>(0);
    const applyCurrentMutation = useCallback((nextState: typeof dashboardState, viewId: string, revision: number) => {
        if (!nextState || commitRevisionRef.current !== revision)
            return;
        if (useWidgetDashboardStore.getState().organisationId !== activeOrganisationId)
            return;
        setDashboardState(previous => previous?.activeViewId === viewId ? nextState : previous);
    }, [activeOrganisationId, setDashboardState]);
    const handleCommitLayout = useCallback(async (layout: WidgetGridPosition[]) => {
        if (!dashboardState || !isEditMode)
            return;
        const activeViewId = dashboardState.activeViewId;
        const currentRevision = ++commitRevisionRef.current;
        setDashboardState(prev => {
            if (!prev)
                return prev;
            const nextViewLayout = layout.map(item => ({ ...item, viewId: activeViewId }));
            const viewLayoutMap = new Map(nextViewLayout.map(item => [item.i, item]));
            const updatedLayout = prev.layout.map(item => item.viewId === activeViewId && viewLayoutMap.has(item.i)
                ? viewLayoutMap.get(item.i)!
                : item);
            return {
                ...prev,
                layout: updatedLayout,
                updatedAt: Date.now(),
            };
        });
        try {
            const nextState = await commitWidgetDashboardLayoutAsync(activeViewId, layout, activeOrganisationId);
            applyCurrentMutation(nextState, activeViewId, currentRevision);
        }
        catch (err) {
            console.error('[Dashboard] Failed to commit layout:', err);
            if (commitRevisionRef.current === currentRevision && useWidgetDashboardStore.getState().state?.activeViewId === activeViewId) {
                void refreshDashboard(activeOrganisationId, { activeViewOnly: true, force: true, viewId: activeViewId });
            }
        }
    }, [dashboardState, isEditMode, activeOrganisationId, applyCurrentMutation, refreshDashboard]);
    const handleCommitResize = useCallback(async (layout: WidgetGridPosition[], widgetId: string | undefined) => {
        if (!dashboardState || !isEditMode)
            return;
        const activeViewId = dashboardState.activeViewId;
        const currentRevision = ++commitRevisionRef.current;
        setDashboardState(prev => {
            if (!prev)
                return prev;
            const nextViewLayout = layout.map(item => ({ ...item, viewId: activeViewId }));
            const viewLayoutMap = new Map(nextViewLayout.map(item => [item.i, item]));
            const updatedLayout = prev.layout.map(item => item.viewId === activeViewId && viewLayoutMap.has(item.i)
                ? viewLayoutMap.get(item.i)!
                : item);
            return {
                ...prev,
                layout: updatedLayout,
                updatedAt: Date.now(),
            };
        });
        try {
            const nextState = await commitWidgetDashboardResizeAsync(activeViewId, layout, widgetId, activeOrganisationId);
            applyCurrentMutation(nextState, activeViewId, currentRevision);
        }
        catch (err) {
            console.error('[Dashboard] Failed to commit resize:', err);
            if (commitRevisionRef.current === currentRevision && useWidgetDashboardStore.getState().state?.activeViewId === activeViewId) {
                void refreshDashboard(activeOrganisationId, { activeViewOnly: true, force: true, viewId: activeViewId });
            }
        }
    }, [dashboardState, isEditMode, activeOrganisationId, applyCurrentMutation, refreshDashboard]);
    const handleDeleteWidget = useCallback(async (widgetId: string) => {
        if (!dashboardState || !isEditMode || deletingWidgetIds.has(widgetId))
            return;
        const activeViewId = dashboardState.activeViewId;
        const currentRevision = ++commitRevisionRef.current;
        setDeletingWidgetIds(prev => new Set(prev).add(widgetId));
        try {
            const nextState = await deleteWidgetInstanceAsync(activeViewId, widgetId, activeOrganisationId);
            if (commitRevisionRef.current === currentRevision)
                setSelectedWidgetId(null);
            applyCurrentMutation(nextState, activeViewId, currentRevision);
        }
        catch (err) {
            console.error('[Dashboard] Failed to delete widget:', err);
        }
        finally {
            setDeletingWidgetIds(prev => {
                const next = new Set(prev);
                next.delete(widgetId);
                return next;
            });
        }
    }, [dashboardState, isEditMode, activeOrganisationId, deletingWidgetIds, applyCurrentMutation]);
    const handleApplyPreset = useCallback(async (widgetId: string, preset: WidgetSizePreset) => {
        if (!dashboardState || !isEditMode)
            return;
        const activeViewId = dashboardState.activeViewId;
        const currentRevision = ++commitRevisionRef.current;
        try {
            const nextState = await applyWidgetSizePresetAsync(activeViewId, widgetId, preset, activeOrganisationId);
            applyCurrentMutation(nextState, activeViewId, currentRevision);
        }
        catch (error) {
            console.error('[Dashboard] Failed to apply widget size:', error);
        }
    }, [dashboardState, isEditMode, activeOrganisationId, applyCurrentMutation]);
    const handleApplyCustomSize = useCallback(async (widgetId: string) => {
        if (!dashboardState || !isEditMode)
            return;
        const activeViewId = dashboardState.activeViewId;
        const currentRevision = ++commitRevisionRef.current;
        try {
            const nextState = await applyWidgetCustomSizeAsync(activeViewId, widgetId, activeOrganisationId);
            applyCurrentMutation(nextState, activeViewId, currentRevision);
        }
        catch (error) {
            console.error('[Dashboard] Failed to restore custom size:', error);
        }
    }, [dashboardState, isEditMode, activeOrganisationId, applyCurrentMutation]);
    const handleSelectWidget = useCallback((widgetId: string | null) => {
        if (!isEditMode)
            return;
        setSelectedWidgetId(widgetId);
    }, [isEditMode]);
    useEffect(() => {
        if (!isEditMode) {
            setSelectedWidgetId(null);
        }
        else if (pendingSelectedWidgetId) {
            setSelectedWidgetId(pendingSelectedWidgetId);
        }
    }, [isEditMode, pendingSelectedWidgetId]);
    if (!dashboardState) {
        return (<div className="flex h-full w-full items-center justify-center">
        <div className={`text-sm font-semibold ${dashboardError ? 'text-[var(--color-danger)]' : 'text-[var(--color-textMuted)]'}`}>
          {dashboardError || 'Loading widgets...'}
        </div>
      </div>);
    }
    if (sortedWidgets.length === 0 && !isEditMode) {
        return (<div className="flex-1 w-full min-h-[300px] relative select-none pointer-events-none">
        <div className="absolute bottom-8 right-10 text-right">
          <div className="text-sm font-semibold text-[var(--color-textPrimary)]">No widgets added</div>
          <div className="mt-1 text-xs text-[var(--color-textMuted)]">Choose a widget from the right panel.</div>
        </div>
      </div>);
    }
    return (<>
      <WidgetGrid widgets={sortedWidgets} layout={activeViewLayout} scrollContainerRef={scrollContainerRef} isEditMode={isEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} selectedWidgetId={selectedWidgetId} onSelectWidget={handleSelectWidget} onCommitLayout={handleCommitLayout} onCommitResize={handleCommitResize} onDeleteWidget={handleDeleteWidget} onApplyPreset={handleApplyPreset} onApplyCustom={handleApplyCustomSize} pendingCatalogWidgetIds={inlineWidgetAddition.pendingWidgetIds} getCatalogWidgetCount={inlineWidgetAddition.getWidgetCount} isCatalogWidgetDisabled={inlineWidgetAddition.isWidgetDisabled} onAddWidgetFromSlot={inlineWidgetAddition.handleAddWidgetFromSlot} onQuickCommandSelect={onQuickCommandSelect}/>
      {inlineWidgetAddition.modals}
    </>);
};
export default WidgetDashboard;
