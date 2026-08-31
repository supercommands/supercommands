import type { WidgetDashboardView } from '../../pages/AltS_search_newtab/src/components/widgets/widgetDashboard.types';

let currentWindowIdLookup: Promise<number | null> | null = null;
let currentWindowId: number | null = null;
const ENABLE_DASHBOARD_SESSION_RESOLUTION_LOGS = false;

const resolveCurrentDashboardWindowIdAsync = async (): Promise<number | null> => {
  const chromeAny = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
  if (chromeAny?.tabs?.getCurrent) {
    const tabWindowId = await new Promise<number | null>(resolve => {
      chromeAny.tabs.getCurrent((tab: any) => {
        if (chromeAny.runtime?.lastError || typeof tab?.windowId !== 'number') {
          resolve(null);
          return;
        }
        resolve(tab.windowId);
      });
    });
    if (typeof tabWindowId === 'number') return tabWindowId;
  }

  if (!chromeAny?.windows?.getCurrent) return null;

  return new Promise(resolve => {
    chromeAny.windows.getCurrent({ populate: false }, (currentWindow: any) => {
      if (chromeAny.runtime?.lastError || typeof currentWindow?.id !== 'number') {
        resolve(null);
        return;
      }
      resolve(currentWindow.id);
    });
  });
};

export const getCurrentDashboardWindowIdAsync = async (): Promise<number | null> => {
  if (typeof currentWindowId === 'number') return currentWindowId;
  if (!currentWindowIdLookup) {
    currentWindowIdLookup = resolveCurrentDashboardWindowIdAsync()
      .then(windowId => {
        currentWindowId = windowId;
        return windowId;
      })
      .finally(() => {
        currentWindowIdLookup = null;
      });
  }
  return currentWindowIdLookup;
};

type PreferredWidgetDashboardView = {
  viewId: string;
  source: 'session';
  windowId: number;
};

const loadPreferredWidgetDashboardViewForCurrentWindowAsync = async (): Promise<PreferredWidgetDashboardView | null> => {
  const startedAt = performance.now();
  const windowId = await getCurrentDashboardWindowIdAsync();
  if (typeof windowId !== 'number') return null;
  const windowResolvedAt = performance.now();

  const chromeAny = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
  if (!chromeAny?.runtime?.sendMessage) return null;

  try {
    const response = await chromeAny.runtime.sendMessage({ action: 'get_active_sessions' });
    if (ENABLE_DASHBOARD_SESSION_RESOLUTION_LOGS) {
      console.log('[NewTabPerf][DashboardSessionResolution]', 'resolved', JSON.stringify({
        windowLookupMs: Math.round(windowResolvedAt - startedAt),
        sessionMessageMs: Math.round(performance.now() - windowResolvedAt),
        totalMs: Math.round(performance.now() - startedAt),
      }));
    }
    const activeSessions = Array.isArray(response?.active_sessions) ? response.active_sessions : [];
    const activeSession = activeSessions.find((session: any) => session?.windowId === windowId);
    const dashboardSession = response?.active_dashboard_view_session?.byWindow?.[String(windowId)];
    if (
      !activeSession?.sessionId ||
      String(dashboardSession?.sessionId || '') !== String(activeSession.sessionId) ||
      typeof dashboardSession?.viewId !== 'string' ||
      !dashboardSession.viewId
    ) {
      return null;
    }

    return {
      viewId: dashboardSession.viewId,
      source: 'session',
      windowId,
    };
  } catch {
    return null;
  }
};

// Start the one required session lookup during module evaluation so Chrome's
// background wake-up overlaps React and Dexie initialization.
let primedPreferredViewLookup: Promise<PreferredWidgetDashboardView | null> | null =
  typeof window !== 'undefined'
    ? loadPreferredWidgetDashboardViewForCurrentWindowAsync()
    : null;

export const getPreferredWidgetDashboardViewForCurrentWindowAsync = async (): Promise<PreferredWidgetDashboardView | null> => {
  const lookup = primedPreferredViewLookup || loadPreferredWidgetDashboardViewForCurrentWindowAsync();
  primedPreferredViewLookup = null;
  return lookup;
};

export const resolveWidgetDashboardViewForCurrentWindowAsync = async (
  views: readonly WidgetDashboardView[],
  fallbackViewId: string,
): Promise<string> => {
  const validViewIds = new Set(views.map(view => view.id));
  const fallback =
    validViewIds.has(fallbackViewId)
      ? fallbackViewId
      : views.find(view => view.isDefault)?.id || views[0]?.id || fallbackViewId;

  const sessionView = await getPreferredWidgetDashboardViewForCurrentWindowAsync();
  return sessionView && validViewIds.has(sessionView.viewId)
    ? sessionView.viewId
    : fallback;
};
