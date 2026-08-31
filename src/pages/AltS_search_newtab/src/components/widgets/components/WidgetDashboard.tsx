import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import WidgetGrid from './WidgetGrid';
import { normalizeWidgetLayout } from '../engine/widgetLayoutEngine';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import { db } from '../../../../../../storage/indexDB/dbConfig';
import {
  applyWidgetCustomSizeAsync,
  applyWidgetSizePresetAsync,
  commitWidgetDashboardLayoutAsync,
  commitWidgetDashboardResizeAsync,
  deleteWidgetInstanceAsync,
  LEGACY_WIDGET_DASHBOARD_STORAGE_KEY,
  loadWidgetDashboardStateAsync,
  purgeMissingNoteWidgetsAsync,
  purgeMissingLinkWidgetsAsync,
  WIDGET_DASHBOARD_STORAGE_EVENT,
  WIDGET_DASHBOARD_STORAGE_KEY,
  WIDGET_DASHBOARD_VIEW_SWITCH_EVENT,
} from '../../../../../../storage/localStorage/widgetDashboardStorage';
import type { WidgetGridPosition, WidgetSizePreset } from '../widgetDashboard.types';
import type { CollectionOpenBehavior } from '../../../../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { launchSessionSmartWithReferences } from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';

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
  if (!ENABLE_WIDGET_DASHBOARD_LOGS) return;
  console.log('[NewTabPerf][WidgetDashboard]', label, JSON.stringify(data || {}));
};

const dashboardAutoRunDebug = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_DASHBOARD_AUTO_RUN_LOGS) return;
  console.log('[DashboardAutoRun][dashboard]', label, data || {});
};

const dashboardAutoRunWarn = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_DASHBOARD_AUTO_RUN_LOGS) return;
  console.warn('[DashboardAutoRun][dashboard]', label, data || {});
};

const applyCollectionOpenBehaviorToSessionSettings = (
  sessionOpenSettings: any,
  openBehavior?: CollectionOpenBehavior,
) => {
  const baseSettings = { ...(sessionOpenSettings || {}) };

  if (openBehavior === 'respect_session') {
    return baseSettings;
  }

  if (openBehavior === 'new_window') {
    return {
      ...baseSettings,
      openMode: 'new_window',
      focusWindow: false,
    };
  }

  if (openBehavior === 'focus_mode') {
    return {
      ...baseSettings,
      openMode: 'same_window',
      focusWindow: true,
    };
  }

  if (openBehavior === 'same_window') {
    return {
      ...baseSettings,
      openMode: 'same_window',
      focusWindow: false,
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
  const fallbackToCurrentWindow = () =>
    new Promise<{
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
  if (!chromeAny?.runtime?.sendMessage) return;
  try {
    const currentTabContext = await getCurrentExtensionTabContext();
    await chromeAny.runtime.sendMessage({
      action: 'set_active_dashboard_view_session',
      viewId,
      sessionId,
      windowId: currentTabContext.currentWindowId,
    });
  } catch (error) {
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
  dashboardViewId?: string | null;
};

const getActiveWindowSessionState = async (windowId?: number): Promise<ActiveWindowSessionState | null> => {
  const chromeAny = (window as any).chrome;
  if (!chromeAny?.runtime?.sendMessage || typeof windowId !== 'number') return null;
  try {
    const response = await chromeAny.runtime.sendMessage({ action: 'get_active_sessions' });
    const sessions = Array.isArray(response?.active_sessions) ? response.active_sessions : [];
    const activeSession = sessions.find((session: any) => session.windowId === windowId);
    if (!activeSession?.sessionId) return null;

    const dashboardEntry = response?.active_dashboard_view_session?.byWindow?.[String(windowId)];
    return {
      sessionId: String(activeSession.sessionId),
      pinnedTabId: typeof activeSession.pinnedTabId === 'number' ? activeSession.pinnedTabId : undefined,
      launchSource: activeSession.launchSource,
      dashboardViewId:
        String(dashboardEntry?.sessionId || '') === String(activeSession.sessionId) &&
        typeof dashboardEntry?.viewId === 'string'
          ? dashboardEntry.viewId
          : null,
    };
  } catch (error) {
    console.error('[DashboardAutoRun][dashboard] failed to read active sessions', error);
    return null;
  }
};

const endAnyActiveSessionForWindow = async (windowId?: number): Promise<void> => {
  if (typeof windowId !== 'number') return;
  const chromeAny = (window as any).chrome;
  if (!chromeAny?.runtime?.sendMessage) return;
  await chromeAny.runtime.sendMessage({ action: 'end_session', windowId });
};

const repairActiveSessionControlTab = async (
  activeSession: ActiveWindowSessionState,
): Promise<boolean> => {
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

const WidgetDashboard = ({
  scrollContainerRef,
  isEditMode = false,
  onEnterWidgetEditMode,
  onExitWidgetEditMode,
  pendingSelectedWidgetId,
  onQuickCommandSelect,
}: WidgetDashboardProps) => {
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
  const workspaces = useDbStore(state => state.workspaces);
  const activeWorkspaceId = workspaces[0]?.id || 'default';
  const workspaceLoadTargetId = activeWorkspaceId || 'default';
  const isStoreInitialized = useDbStore(state => state.isInitialized);
  const dashboardViewIntent = useUIStore(state => state.dashboardViewIntent);
  const clearDashboardViewIntent = useUIStore(state => state.clearDashboardViewIntent);
  const consumedDashboardViewIntentKeyRef = useRef<string | null>(null);
  const pendingAutoSaveLaunchViewKeysRef = useRef<Set<string>>(new Set());
  const inlineWidgetAddition = useInlineWidgetAddition({
    dashboardState,
    activeWorkspaceId,
    onDashboardStateChange: state => setDashboardState(state, activeWorkspaceId),
  });

  useEffect(() => {
    startupPerf('WidgetDashboard:commit', {
      renderCount: renderCountRef.current,
      hasDashboardState: Boolean(dashboardState),
      dashboardError: dashboardError || null,
      activeViewId: dashboardState?.activeViewId || null,
      viewCount: dashboardState?.views?.length || 0,
      widgetCount: dashboardState?.widgets?.length || 0,
      layoutCount: dashboardState?.layout?.length || 0,
      workspaceCount: workspaces.length,
      isStoreInitialized,
      isEditMode,
    });
  });

  const launchAutoSaveSessionsForView = useCallback(async (
    viewId: string,
    openBehavior?: CollectionOpenBehavior,
  ) => {
    const currentTabContext = await getCurrentExtensionTabContext();
    const launchKey = `${currentTabContext.currentWindowId ?? 'unknown'}:${viewId}:${openBehavior || 'default'}`;
    if (pendingAutoSaveLaunchViewKeysRef.current.has(launchKey)) {
      dashboardAutoRunDebug('launch already pending; skipping duplicate request', {
        viewId,
        launchKey,
      });
      return;
    }

    pendingAutoSaveLaunchViewKeysRef.current.add(launchKey);
    try {
      dashboardAutoRunDebug('launch requested', {
        viewId,
        activeWorkspaceId,
        openBehavior,
        currentWindowId: currentTabContext.currentWindowId,
      });
      const latestState = await loadWidgetDashboardStateAsync(activeWorkspaceId);
      const widgetsInView = latestState.widgets.filter(widget => widget.viewId === viewId);
      const sessionWidgetsInView = widgetsInView.filter(widget => widget.type === 'session-item');
      dashboardAutoRunDebug('loaded state', {
        viewId,
        activeWorkspaceId,
        activeViewId: latestState.activeViewId,
        widgetsInView: widgetsInView.length,
        sessionWidgetsInView: sessionWidgetsInView.map(widget => ({
          widgetId: widget.id,
          sessionId: widget.sessionId,
          referenceType: widget.referenceType,
          referenceId: widget.referenceId,
          title: widget.title,
        })),
      });
      const sessionIds = latestState.widgets
        .filter(widget => widget.type === 'session-item' && widget.viewId === viewId)
        .map(widget => widget.sessionId || (widget.referenceType === 'session' ? widget.referenceId : undefined))
        .filter((sessionId): sessionId is string => typeof sessionId === 'string' && sessionId.length > 0);

      if (sessionIds.length === 0) {
        dashboardAutoRunWarn('no linked session ids for view', {
          viewId,
          sessionWidgetCount: sessionWidgetsInView.length,
        });
        await setActiveDashboardViewSession(viewId, null);
        return;
      }

      const uniqueSessionIds = Array.from(new Set(sessionIds));
      const sessionsToRun = await db.sessions
        .filter((session: any) =>
          uniqueSessionIds.includes(session.id) &&
          session.sessionOpenSettings?.autoSaveMode === 'auto_save',
        )
        .toArray();

      const matchingSessions = await db.sessions
        .filter((session: any) => uniqueSessionIds.includes(session.id))
        .toArray();
      dashboardAutoRunDebug('session lookup result', {
        viewId,
        uniqueSessionIds,
        matchingSessions: matchingSessions.map((session: any) => ({
          id: session.id,
          title: session.title,
          urlCount: Array.isArray(session.urls) ? session.urls.length : 0,
          openMode: session.sessionOpenSettings?.openMode,
          focusWindow: session.sessionOpenSettings?.focusWindow,
          autoSaveMode: session.sessionOpenSettings?.autoSaveMode,
        })),
        sessionsToRunCount: sessionsToRun.length,
        openBehavior,
      });

      if (sessionsToRun.length === 0) {
        dashboardAutoRunWarn('no linked sessions have auto-save enabled', {
          viewId,
          uniqueSessionIds,
        });
        await setActiveDashboardViewSession(viewId, null);
        return;
      }

      const sessionsById = new Map(sessionsToRun.map((session: any) => [String(session.id), session]));
      const sessionToRun = uniqueSessionIds
        .map(sessionId => sessionsById.get(sessionId))
        .find(Boolean) as any;
      if (!sessionToRun) return;

      if (sessionsToRun.length > 1) {
        dashboardAutoRunWarn('multiple auto-save sessions are linked to one view; using the first', {
          viewId,
          selectedSessionId: sessionToRun.id,
          ignoredSessionIds: sessionsToRun
            .map((session: any) => session.id)
            .filter((sessionId: string) => sessionId !== sessionToRun.id),
        });
      }

      const launchOpenSettings = applyCollectionOpenBehaviorToSessionSettings(
        sessionToRun.sessionOpenSettings,
        openBehavior,
      );
      const activeWindowSession = await getActiveWindowSessionState(currentTabContext.currentWindowId);
      if (
        launchOpenSettings.openMode !== 'new_window' &&
        activeWindowSession?.sessionId === String(sessionToRun.id)
      ) {
        const controlTabReady = await repairActiveSessionControlTab(activeWindowSession);
        if (controlTabReady) {
          await setActiveDashboardViewSession(viewId, String(sessionToRun.id));
          dashboardAutoRunDebug('auto-save session already active; repaired control tab and skipping launch', {
            viewId,
            sessionId: sessionToRun.id,
            currentWindowId: currentTabContext.currentWindowId,
            pinnedTabId: activeWindowSession.pinnedTabId,
            shouldPin: true,
          });
          return;
        }

        dashboardAutoRunWarn('active session has no valid control tab; restarting launch', {
          viewId,
          sessionId: sessionToRun.id,
          currentWindowId: currentTabContext.currentWindowId,
          pinnedTabId: activeWindowSession.pinnedTabId,
        });
        await endAnyActiveSessionForWindow(currentTabContext.currentWindowId);
      }

      if (launchOpenSettings.openMode !== 'new_window') {
        await setActiveDashboardViewSession(viewId, null);
      }
      dashboardAutoRunDebug('current tab context', currentTabContext);
      const initialUrls = (sessionToRun.urls || []).map((link: any) => link.url);

      if ((window as any).chrome?.runtime?.sendMessage) {
        dashboardAutoRunDebug('sending start_session', {
          sessionId: sessionToRun.id,
          sessionName: sessionToRun.title,
          initialUrls,
          openSettings: launchOpenSettings,
          currentTabContext,
        });
        try {
          const response = await launchSessionSmartWithReferences(sessionToRun, {
            teamId: undefined,
            storageMode: 'local',
            openSettings: launchOpenSettings,
            source: 'dashboard_view',
            dashboardViewId: viewId,
            context: currentTabContext,
          });
          if (
            !response?.ok &&
            launchOpenSettings.openMode !== 'new_window' &&
            activeWindowSession?.dashboardViewId
          ) {
            await setActiveDashboardViewSession(
              activeWindowSession.dashboardViewId,
              activeWindowSession.sessionId,
            );
          }
          dashboardAutoRunDebug('start_session response', {
            sessionId: sessionToRun.id,
            response,
          });
        } catch (error) {
          if (
            launchOpenSettings.openMode !== 'new_window' &&
            activeWindowSession?.dashboardViewId
          ) {
            await setActiveDashboardViewSession(
              activeWindowSession.dashboardViewId,
              activeWindowSession.sessionId,
            );
          }
          console.error('[DashboardAutoRun][dashboard] start_session failed', {
            sessionId: sessionToRun.id,
            error,
          });
        }
      } else {
        dashboardAutoRunWarn('chrome.runtime.sendMessage unavailable');
      }
    } catch (error) {
      console.error('Failed to auto-run sessions for dashboard view:', error);
    } finally {
      pendingAutoSaveLaunchViewKeysRef.current.delete(launchKey);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!dashboardState || !isStoreInitialized) return undefined;

    const noteIds = Array.from(
      new Set(
        dashboardState.widgets
          .filter(widget => widget.type === 'note-item')
          .map(widget => widget.noteId || (typeof widget.settings?.noteId === 'string' ? widget.settings.noteId : undefined))
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const linkIds = Array.from(
      new Set(
        dashboardState.widgets
          .filter(widget => widget.type === 'link-item')
          .map(widget => widget.linkId || (typeof widget.settings?.linkId === 'string' ? widget.settings.linkId : undefined))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (noteIds.length === 0 && linkIds.length === 0) return undefined;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (noteIds.length > 0) {
          const existingNotes = await db.notes.bulkGet(noteIds);
          if (cancelled) return;
          const validNoteIds = new Set(existingNotes.filter(Boolean).map(note => note!.id));
          if (noteIds.some(id => !validNoteIds.has(id))) {
            const nextState = await purgeMissingNoteWidgetsAsync(validNoteIds, activeWorkspaceId);
            if (!cancelled) setDashboardState(nextState);
          }
        }

        if (linkIds.length > 0) {
          const existingLinks = await db.links.bulkGet(linkIds);
          if (cancelled) return;
          const validLinkIds = new Set(
            existingLinks
              .filter(link => link && link.deletedAt == null)
              .map(link => link!.id),
          );
          if (linkIds.some(id => !validLinkIds.has(id))) {
            const nextState = await purgeMissingLinkWidgetsAsync(validLinkIds, activeWorkspaceId);
            if (!cancelled) setDashboardState(nextState);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeWorkspaceId, dashboardState?.widgets, isStoreInitialized, setDashboardState]);

  useEffect(() => {
    if (!isStoreInitialized) return undefined;

    let mounted = true;
    const fetchState = async (force = false, source = 'mount', viewId?: string | null) => {
      const startedAt = performance.now();
      dashboardPerf('fetchState:start', {
        activeWorkspaceId: workspaceLoadTargetId,
        force,
        source,
        workspaceCount: workspaces.length,
      });
      const state = force
        ? await refreshDashboard(workspaceLoadTargetId, { activeViewOnly: true, viewId })
        : await loadDashboard(workspaceLoadTargetId, { activeViewOnly: true, viewId });
      if (!mounted || !state) return;
      dashboardPerf('fetchState:done', {
        durationMs: Math.round(performance.now() - startedAt),
        activeViewId: state.activeViewId,
        viewCount: state.views.length,
        widgetCount: state.widgets.length,
        layoutCount: state.layout.length,
      });
    };

    fetchState();

    const handleStorageChange = (changes: { [key: string]: any }, areaName: string) => {
      const changedKeys = Object.keys(changes);
      dashboardPerf('chrome-storage:changed', {
        areaName,
        keys: changedKeys,
        willRefresh: areaName === 'local' && Boolean(
          changes[WIDGET_DASHBOARD_STORAGE_KEY] ||
          changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY] ||
          changes.active_dashboard_view_session ||
          changes.active_sessions,
        ),
      });
      if (
        areaName === 'local' &&
        (
          changes[WIDGET_DASHBOARD_STORAGE_KEY] ||
          changes[LEGACY_WIDGET_DASHBOARD_STORAGE_KEY]
        )
      ) {
        fetchState(true, 'chrome-storage');
      } else if (
        areaName === 'local' &&
        (changes.active_dashboard_view_session || changes.active_sessions)
      ) {
        fetchState(true, 'active-session', null);
      }
    };
    const handleWidgetDashboardChange = () => {
      dashboardPerf('dashboard-event:received', {
        event: WIDGET_DASHBOARD_STORAGE_EVENT,
      });
      fetchState(true, 'dashboard-event');
    };
    const handleViewSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<WidgetDashboardViewSwitchDetail>;
      const newViewId = customEvent.detail?.viewId;
      dashboardAutoRunDebug('view switch event received', {
        detail: customEvent.detail,
        activeWorkspaceId: workspaceLoadTargetId,
      });
      if (newViewId) {
        const switchStartedAt = performance.now();
        setActiveDashboardViewId(newViewId);
        dashboardPerf('viewSwitch:stateUpdated', {
          durationMs: Math.round(performance.now() - switchStartedAt),
          viewId: newViewId,
          trigger: customEvent.detail?.trigger,
        });
        fetchState(true, 'view-switch', newViewId);
      }
    };
    const extensionChrome = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;

    window.addEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
    window.addEventListener(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, handleViewSwitch);

    if (extensionChrome?.storage?.onChanged) {
      extensionChrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      mounted = false;
      if (extensionChrome?.storage?.onChanged) {
        extensionChrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.removeEventListener(WIDGET_DASHBOARD_STORAGE_EVENT, handleWidgetDashboardChange);
      window.removeEventListener(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, handleViewSwitch);
    };
  }, [
    isStoreInitialized,
    launchAutoSaveSessionsForView,
    loadDashboard,
    refreshDashboard,
    setActiveDashboardViewId,
    workspaceLoadTargetId,
    workspaces.length,
  ]);

  useEffect(() => {
    if (!dashboardViewIntent) return;
    if (!isStoreInitialized) return;
    if (String(dashboardViewIntent.workspaceId) !== String(workspaceLoadTargetId)) return;

    const intentKey = `${dashboardViewIntent.workspaceId}:${dashboardViewIntent.viewId}:${dashboardViewIntent.mode}:${dashboardViewIntent.requestedAt}`;
    if (consumedDashboardViewIntentKeyRef.current === intentKey) return;
    consumedDashboardViewIntentKeyRef.current = intentKey;

    setActiveDashboardViewId(dashboardViewIntent.viewId);
    void refreshDashboard(workspaceLoadTargetId, {
      activeViewOnly: true,
      force: true,
      viewId: dashboardViewIntent.viewId,
    });

    if (dashboardViewIntent.mode === 'edit') {
      onEnterWidgetEditMode?.();
    } else {
      void launchAutoSaveSessionsForView(
        dashboardViewIntent.viewId,
        dashboardViewIntent.openBehavior,
      );
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
    workspaceLoadTargetId,
  ]);

  useEffect(() => {
    setSelectedWidgetId(null);
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [dashboardState?.activeViewId, dashboardState?.widgets?.length, scrollContainerRef]);

  const activeViewLayout = useMemo(
    () =>
      dashboardState && Array.isArray(dashboardState.layout)
        ? normalizeWidgetLayout(dashboardState.layout.filter(position => position.viewId === dashboardState.activeViewId))
        : [],
    [dashboardState],
  );

  const sortedWidgets = useMemo(
    () => {
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
      return widgetsForView;
    },
    [dashboardState],
  );

  const commitRevisionRef = useRef<number>(0);

  const handleCommitLayout = useCallback(
    async (layout: WidgetGridPosition[]) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const currentRevision = ++commitRevisionRef.current;

      setDashboardState(prev => {
        if (!prev) return prev;
        const nextViewLayout = layout.map(item => ({ ...item, viewId: activeViewId }));
        const viewLayoutMap = new Map(nextViewLayout.map(item => [item.i, item]));
        const updatedLayout = prev.layout.map(item =>
          item.viewId === activeViewId && viewLayoutMap.has(item.i)
            ? viewLayoutMap.get(item.i)!
            : item,
        );
        return {
          ...prev,
          layout: updatedLayout,
          updatedAt: Date.now(),
        };
      });

      try {
        const nextState = await commitWidgetDashboardLayoutAsync(activeViewId, layout, activeWorkspaceId);
        if (commitRevisionRef.current === currentRevision) {
          setDashboardState(nextState);
        }
      } catch (err) {
        console.error('[Dashboard] Failed to commit layout:', err);
      }
    },
    [dashboardState, isEditMode, activeWorkspaceId],
  );

  const handleCommitResize = useCallback(
    async (layout: WidgetGridPosition[], widgetId: string | undefined) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const currentRevision = ++commitRevisionRef.current;

      setDashboardState(prev => {
        if (!prev) return prev;
        const nextViewLayout = layout.map(item => ({ ...item, viewId: activeViewId }));
        const viewLayoutMap = new Map(nextViewLayout.map(item => [item.i, item]));
        const updatedLayout = prev.layout.map(item =>
          item.viewId === activeViewId && viewLayoutMap.has(item.i)
            ? viewLayoutMap.get(item.i)!
            : item,
        );
        return {
          ...prev,
          layout: updatedLayout,
          updatedAt: Date.now(),
        };
      });

      try {
        const nextState = await commitWidgetDashboardResizeAsync(activeViewId, layout, widgetId, activeWorkspaceId);
        if (commitRevisionRef.current === currentRevision) {
          setDashboardState(nextState);
        }
      } catch (err) {
        console.error('[Dashboard] Failed to commit resize:', err);
      }
    },
    [dashboardState, isEditMode, activeWorkspaceId],
  );

  const handleDeleteWidget = useCallback(
    async (widgetId: string) => {
      if (!dashboardState || !isEditMode || deletingWidgetIds.has(widgetId)) return;
      const activeViewId = dashboardState.activeViewId;
      setDeletingWidgetIds(prev => new Set(prev).add(widgetId));
      try {
        const nextState = await deleteWidgetInstanceAsync(activeViewId, widgetId, activeWorkspaceId);
        setSelectedWidgetId(null);
        setDashboardState(nextState);
      } catch (err) {
        console.error('[Dashboard] Failed to delete widget:', err);
      } finally {
        setDeletingWidgetIds(prev => {
          const next = new Set(prev);
          next.delete(widgetId);
          return next;
        });
      }
    },
    [dashboardState, isEditMode, activeWorkspaceId, deletingWidgetIds],
  );

  const handleApplyPreset = useCallback(
    async (widgetId: string, preset: WidgetSizePreset) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await applyWidgetSizePresetAsync(activeViewId, widgetId, preset, activeWorkspaceId);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode, activeWorkspaceId],
  );

  const handleApplyCustomSize = useCallback(
    async (widgetId: string) => {
      if (!dashboardState || !isEditMode) return;
      const activeViewId = dashboardState.activeViewId;
      const nextState = await applyWidgetCustomSizeAsync(activeViewId, widgetId, activeWorkspaceId);
      setDashboardState(nextState);
    },
    [dashboardState, isEditMode, activeWorkspaceId],
  );

  const handleSelectWidget = useCallback(
    (widgetId: string | null) => {
      if (!isEditMode) return;
      setSelectedWidgetId(widgetId);
    },
    [isEditMode],
  );

  useEffect(() => {
    if (!isEditMode) {
      setSelectedWidgetId(null);
    } else if (pendingSelectedWidgetId) {
      setSelectedWidgetId(pendingSelectedWidgetId);
    }
  }, [isEditMode, pendingSelectedWidgetId]);

  if (!dashboardState) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className={`text-sm font-semibold ${dashboardError ? 'text-[var(--color-danger)]' : 'text-[var(--color-textMuted)]'}`}>
          {dashboardError || 'Loading widgets...'}
        </div>
      </div>
    );
  }

  if (sortedWidgets.length === 0 && !isEditMode) {
    return (
      <div className="flex-1 w-full min-h-[300px] relative select-none pointer-events-none">
        <div className="absolute bottom-8 right-10 text-right">
          <div className="text-sm font-semibold text-[var(--color-textPrimary)]">No widgets added</div>
          <div className="mt-1 text-xs text-[var(--color-textMuted)]">Choose a widget from the right panel.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <WidgetGrid
        widgets={sortedWidgets}
        layout={activeViewLayout}
        scrollContainerRef={scrollContainerRef}
        isEditMode={isEditMode}
        onEnterWidgetEditMode={onEnterWidgetEditMode}
        onExitWidgetEditMode={onExitWidgetEditMode}
        selectedWidgetId={selectedWidgetId}
        onSelectWidget={handleSelectWidget}
        onCommitLayout={handleCommitLayout}
        onCommitResize={handleCommitResize}
        onDeleteWidget={handleDeleteWidget}
        onApplyPreset={handleApplyPreset}
        onApplyCustom={handleApplyCustomSize}
        pendingCatalogWidgetIds={inlineWidgetAddition.pendingWidgetIds}
        getCatalogWidgetCount={inlineWidgetAddition.getWidgetCount}
        isCatalogWidgetDisabled={inlineWidgetAddition.isWidgetDisabled}
        onAddWidgetFromSlot={inlineWidgetAddition.handleAddWidgetFromSlot}
        onQuickCommandSelect={onQuickCommandSelect}
      />
      {inlineWidgetAddition.modals}
    </>
  );
};

export default WidgetDashboard;
