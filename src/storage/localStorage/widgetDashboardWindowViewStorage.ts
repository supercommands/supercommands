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
        if (typeof tabWindowId === 'number')
            return tabWindowId;
    }
    if (!chromeAny?.windows?.getCurrent)
        return null;
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
    if (typeof currentWindowId === 'number')
        return currentWindowId;
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
    source: 'session' | 'last-window' | 'last-workspace';
    windowId: number | null;
};
export const LAST_DASHBOARD_VIEW_BY_WINDOW_KEY = 'last_dashboard_view_by_window_v1';
type LastDashboardViewByWindow = Record<string, {
    organisationId: string;
    viewId: string;
    updatedAt: number;
}>;
const getChromeStorageLocal = (): any => typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome?.storage?.local;
const readLastDashboardViewByWindowAsync = async (): Promise<LastDashboardViewByWindow> => {
    const storage = getChromeStorageLocal();
    if (!storage?.get)
        return {};
    try {
        const result = await storage.get(LAST_DASHBOARD_VIEW_BY_WINDOW_KEY);
        const value = result?.[LAST_DASHBOARD_VIEW_BY_WINDOW_KEY];
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    catch {
        return {};
    }
};
export const rememberWidgetDashboardViewForWindowAsync = async (windowId: number, organisationId: string, viewId: string): Promise<void> => {
    const storage = getChromeStorageLocal();
    if (typeof windowId !== 'number' || !storage?.set || !organisationId || !viewId)
        return;
    const existing = await readLastDashboardViewByWindowAsync();
    existing[String(windowId)] = { organisationId, viewId, updatedAt: Date.now() };
    try {
        await storage.set({ [LAST_DASHBOARD_VIEW_BY_WINDOW_KEY]: existing });
    }
    catch {
        // View activation remains valid for the current render even if persistence fails.
    }
};
export const rememberWidgetDashboardViewForCurrentWindowAsync = async (organisationId: string, viewId: string): Promise<void> => {
    const windowId = await getCurrentDashboardWindowIdAsync();
    if (typeof windowId !== 'number')
        return;
    await rememberWidgetDashboardViewForWindowAsync(windowId, organisationId, viewId);
};
export const clearRememberedWidgetDashboardViewForCurrentWindowAsync = async (organisationId: string, viewId: string): Promise<void> => {
    const windowId = await getCurrentDashboardWindowIdAsync();
    const storage = getChromeStorageLocal();
    if (typeof windowId !== 'number' || !storage?.set)
        return;
    const existing = await readLastDashboardViewByWindowAsync();
    const entry = existing[String(windowId)];
    if (!entry || entry.organisationId !== organisationId || entry.viewId !== viewId)
        return;
    delete existing[String(windowId)];
    try {
        await storage.set({ [LAST_DASHBOARD_VIEW_BY_WINDOW_KEY]: existing });
    }
    catch {
        // Ignore cleanup failures; the deleted view will be rejected during resolution.
    }
};
const loadPreferredWidgetDashboardViewForCurrentWindowAsync = async (): Promise<PreferredWidgetDashboardView | null> => {
    const startedAt = performance.now();
    const windowId = await getCurrentDashboardWindowIdAsync();
    if (typeof windowId !== 'number')
        return null;
    const windowResolvedAt = performance.now();
    const chromeAny = typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;
    if (!chromeAny?.runtime?.sendMessage)
        return null;
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
        if (!activeSession?.sessionId ||
            String(dashboardSession?.sessionId || '') !== String(activeSession.sessionId) ||
            typeof dashboardSession?.viewId !== 'string' ||
            !dashboardSession.viewId) {
            return null;
        }
        return {
            viewId: dashboardSession.viewId,
            source: 'session',
            windowId,
        };
    }
    catch {
        return null;
    }
};
// Start the one required session lookup during module evaluation so Chrome's
// background wake-up overlaps React and Dexie initialization.
let primedPreferredViewLookup: Promise<PreferredWidgetDashboardView | null> | null = typeof window !== 'undefined'
    ? loadPreferredWidgetDashboardViewForCurrentWindowAsync()
    : null;
export const getPreferredWidgetDashboardViewForCurrentWindowAsync = async (): Promise<PreferredWidgetDashboardView | null> => {
    const lookup = primedPreferredViewLookup || loadPreferredWidgetDashboardViewForCurrentWindowAsync();
    primedPreferredViewLookup = null;
    return lookup;
};
export const getLastRememberedWidgetDashboardViewForCurrentWindowAsync = async (organisationId: string): Promise<PreferredWidgetDashboardView | null> => {
    const windowId = await getCurrentDashboardWindowIdAsync();
    if (typeof windowId !== 'number')
        return null;
    const entry = (await readLastDashboardViewByWindowAsync())[String(windowId)];
    if (!entry || entry.organisationId !== organisationId || typeof entry.viewId !== 'string' || !entry.viewId)
        return null;
    return { viewId: entry.viewId, source: 'last-window', windowId };
};
export const getLastRememberedWidgetDashboardViewForOrganisationAsync = async (organisationId: string): Promise<PreferredWidgetDashboardView | null> => {
    const entries = await readLastDashboardViewByWindowAsync();
    const latestEntry = Object.entries(entries)
        .filter(([, entry]) => entry?.organisationId === organisationId &&
        typeof entry.viewId === 'string' &&
        Boolean(entry.viewId))
        .sort(([, left], [, right]) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))[0];
    if (!latestEntry)
        return null;
    const [windowId, entry] = latestEntry;
    const numericWindowId = Number(windowId);
    return {
        viewId: entry.viewId,
        source: 'last-workspace',
        windowId: Number.isFinite(numericWindowId) ? numericWindowId : null,
    };
};
export const getFirstOrderedWidgetDashboardViewIdAsync = async (views: readonly WidgetDashboardView[]): Promise<string | null> => {
    const validViewIds = new Set(views.map(view => view.id));
    const storage = getChromeStorageLocal();
    if (storage?.get) {
        try {
            const result = await storage.get('dashboard_views_items_order');
            const order = Array.isArray(result?.dashboard_views_items_order)
                ? result.dashboard_views_items_order
                : [];
            const orderedViewId = order.find((id: unknown) => typeof id === 'string' && validViewIds.has(id));
            if (orderedViewId)
                return orderedViewId;
        }
        catch {
            // Fall through to the view collection order.
        }
    }
    return views[0]?.id;
};
export const resolveWidgetDashboardViewForCurrentWindowAsync = async (views: readonly WidgetDashboardView[], fallbackViewId: string, organisationId?: string): Promise<string> => {
    const validViewIds = new Set(views.map(view => view.id));
    const sessionView = await getPreferredWidgetDashboardViewForCurrentWindowAsync();
    if (sessionView && validViewIds.has(sessionView.viewId))
        return sessionView.viewId;
    const lastView = organisationId
        ? await getLastRememberedWidgetDashboardViewForCurrentWindowAsync(organisationId)
        : null;
    if (lastView && validViewIds.has(lastView.viewId))
        return lastView.viewId;
    const lastOrganisationView = organisationId
        ? await getLastRememberedWidgetDashboardViewForOrganisationAsync(organisationId)
        : null;
    if (lastOrganisationView && validViewIds.has(lastOrganisationView.viewId))
        return lastOrganisationView.viewId;
    return (await getFirstOrderedWidgetDashboardViewIdAsync(views)) || (validViewIds.has(fallbackViewId) ? fallbackViewId : 'default');
};
