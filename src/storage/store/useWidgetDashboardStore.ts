import { create } from 'zustand';
import { loadWidgetDashboardViewsForOrganisationAsync, loadWidgetDashboardStateForCurrentWindowAsync, resolveWidgetDashboardOrganisationIdAsync, switchWidgetDashboardViewAsync, } from '../localStorage/widgetDashboardStorage';
import { isMainDashboardView } from '../../allObjectFolder/src/createObject/widgets/widgetDashboardLogic';
import type { WidgetDashboardState } from '../../allObjectFolder/src/createObject/widgets/widgetDashboardRuntimeTypes';
import { BRAND } from '../../shared-components/brandingConfig';
type DashboardLoadOptions = {
    activeViewOnly?: boolean;
    force?: boolean;
    viewId?: string | null;
};
type DashboardStateUpdate = WidgetDashboardState | null | ((state: WidgetDashboardState | null) => WidgetDashboardState | null);
type WidgetDashboardStoreState = {
    state: WidgetDashboardState | null;
    organisationId: string | null;
    isLoading: boolean;
    error: string | null;
    load: (organisationId: string, options?: DashboardLoadOptions) => Promise<WidgetDashboardState | null>;
    refresh: (organisationId?: string, options?: DashboardLoadOptions) => Promise<WidgetDashboardState | null>;
    setDashboardState: (state: DashboardStateUpdate, organisationId?: string | null) => void;
    setActiveViewId: (viewId: string) => void;
    returnToHomeView: () => void;
};
let inFlightLoad: Promise<WidgetDashboardState | null> | null = null;
let inFlightKey: string | null = null;
let stateEpoch = 0;
let inFlightEpoch = -1;
const WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY = BRAND.storageKeys.widgetDashboardStartupSnapshot;
const LEGACY_WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY = BRAND.legacyStorageKeys.widgetDashboardStartupSnapshot;
const WIDGET_DASHBOARD_STARTUP_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const getLoadKey = (organisationId: string, options?: DashboardLoadOptions) => `${organisationId}:${options?.activeViewOnly !== false ? 'active' : 'full'}:${options?.viewId || 'resolved'}`;
const ENABLE_WIDGET_DASHBOARD_STORE_LOGS = false;
const dashboardStorePerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_WIDGET_DASHBOARD_STORE_LOGS)
        return;
    console.log('[NewTabPerf][WidgetDashboardStore]', label, JSON.stringify(data || {}));
};
const isWidgetDashboardState = (state: unknown): state is WidgetDashboardState => Boolean(state &&
    typeof state === 'object' &&
    typeof (state as WidgetDashboardState).activeViewId === 'string' &&
    Array.isArray((state as WidgetDashboardState).views) &&
    Array.isArray((state as WidgetDashboardState).widgets) &&
    Array.isArray((state as WidgetDashboardState).layout));
const areDashboardViewsEquivalent = (left: WidgetDashboardState['views'], right: WidgetDashboardState['views']): boolean => {
    if (left.length !== right.length)
        return false;
    return left.every((view, index) => {
        const other = right[index];
        return (other &&
            view.id === other.id &&
            view.title === other.title &&
            JSON.stringify(view.settings || {}) === JSON.stringify(other.settings || {}) &&
            JSON.stringify(view.collectionLaunchSettings || {}) === JSON.stringify(other.collectionLaunchSettings || {}));
    });
};
type WidgetDashboardStartupSnapshot = {
    organisationId: string;
    state: WidgetDashboardState;
    savedAt: number;
    targetSchema: 1;
};
const readWidgetDashboardStartupSnapshot = (): WidgetDashboardStartupSnapshot | null => {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage)
            return null;
        const raw = window.sessionStorage.getItem(WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY) ||
            window.sessionStorage.getItem(LEGACY_WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw) as Partial<WidgetDashboardStartupSnapshot>;
        if (!parsed || parsed.targetSchema !== 1 ||
            typeof parsed.organisationId !== 'string' ||
            typeof parsed.savedAt !== 'number' ||
            Date.now() - parsed.savedAt > WIDGET_DASHBOARD_STARTUP_SNAPSHOT_MAX_AGE_MS ||
            !isWidgetDashboardState(parsed.state)) {
            return null;
        }
        const activeView = parsed.state.views.find(view => view.id === parsed.state?.activeViewId);
        if (activeView && !isMainDashboardView(activeView))
            return null;
        return {
            organisationId: parsed.organisationId,
            state: parsed.state,
            savedAt: parsed.savedAt,
            targetSchema: 1,
        };
    }
    catch {
        return null;
    }
};
const writeWidgetDashboardStartupSnapshot = (organisationId: string | null, state: WidgetDashboardState | null) => {
    try {
        if (!organisationId || !state || !isWidgetDashboardState(state))
            return;
        if (typeof window === 'undefined' || !window.sessionStorage)
            return;
        const activeView = state.views.find(view => view.id === state.activeViewId);
        if (activeView && !isMainDashboardView(activeView)) {
            window.sessionStorage.removeItem(WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY);
            return;
        }
        const snapshot: WidgetDashboardStartupSnapshot = {
            organisationId,
            state,
            savedAt: Date.now(),
            targetSchema: 1,
        };
        window.sessionStorage.setItem(WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY, JSON.stringify(snapshot));
    }
    catch {
        // Startup snapshot is a render fast-path only; Dexie remains the source of truth.
    }
};
const startupSnapshot = readWidgetDashboardStartupSnapshot();
let didHydrateFromStartupSnapshot = Boolean(startupSnapshot);
export const useWidgetDashboardStore = create<WidgetDashboardStoreState>((set, get) => ({
    state: startupSnapshot?.state ?? null,
    organisationId: startupSnapshot?.organisationId ?? null,
    isLoading: false,
    error: null,
    load: async (organisationId: string, options: DashboardLoadOptions = { activeViewOnly: true }) => {
        const activeViewOnly = options.activeViewOnly !== false;
        const requestedOrganisationId = organisationId;
        const effectiveOrganisationId = await resolveWidgetDashboardOrganisationIdAsync(organisationId);
        const loadKey = getLoadKey(effectiveOrganisationId, {
            activeViewOnly,
            viewId: options.viewId,
        });
        const current = get();
        const currentState = isWidgetDashboardState(current.state) ? current.state : null;
        const hasRenderableCurrentState = Boolean(currentState && current.organisationId === effectiveOrganisationId);
        const hasRequestedViewState = options.viewId
            ? currentState?.activeViewId === options.viewId
            : isMainDashboardView(currentState?.views.find(view => view.id === currentState.activeViewId));
        if (inFlightLoad && inFlightKey === loadKey && inFlightEpoch === stateEpoch) {
            dashboardStorePerf('load:in-flight-hit', {
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                forced: Boolean(options.force),
            });
            return inFlightLoad;
        }
        if (!options.force && hasRenderableCurrentState && hasRequestedViewState && !didHydrateFromStartupSnapshot) {
            dashboardStorePerf('load:cache-hit', {
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                activeViewId: currentState!.activeViewId,
                widgetCount: currentState!.widgets.length,
            });
            return currentState;
        }
        if (current.state && current.organisationId === effectiveOrganisationId && !currentState) {
            dashboardStorePerf('load:cache-invalid', {
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                stateType: typeof current.state,
            });
        }
        if (hasRenderableCurrentState && didHydrateFromStartupSnapshot) {
            dashboardStorePerf('load:snapshot-refresh', {
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                activeViewId: currentState!.activeViewId,
                widgetCount: currentState!.widgets.length,
            });
        }
        const startedAt = performance.now();
        dashboardStorePerf('load:start', {
            organisationId: effectiveOrganisationId,
            requestedOrganisationId,
            activeViewOnly,
            forced: Boolean(options.force),
            hasRenderableState: hasRenderableCurrentState,
        });
        const requestEpoch = ++stateEpoch;
        set({ isLoading: !hasRenderableCurrentState, error: null, organisationId: effectiveOrganisationId });
        if (!hasRenderableCurrentState) {
            void loadWidgetDashboardViewsForOrganisationAsync(effectiveOrganisationId)
                .then(views => {
                const current = get();
                if (stateEpoch === requestEpoch && current.organisationId === effectiveOrganisationId && !current.state) {
                    set({
                        state: {
                            schemaVersion: 2,
                            revision: 1,
                            updatedAt: Date.now(),
                            activeViewId: '',
                            views,
                            widgets: [],
                            layout: [],
                        }
                    });
                }
            });
        }
        inFlightKey = loadKey;
        inFlightEpoch = requestEpoch;
        inFlightLoad = loadWidgetDashboardStateForCurrentWindowAsync(effectiveOrganisationId, {
            activeViewOnly,
            viewId: options.viewId,
        })
            .then(nextState => {
            const currentAfterLoad = get();
            if (stateEpoch !== requestEpoch || currentAfterLoad.organisationId !== effectiveOrganisationId)
                return null;
            const stateToSet = activeViewOnly &&
                currentAfterLoad.organisationId === effectiveOrganisationId &&
                isWidgetDashboardState(currentAfterLoad.state) &&
                currentAfterLoad.state.views.length > nextState.views.length
                ? {
                    ...nextState,
                    views: currentAfterLoad.state.views,
                }
                : nextState;
            dashboardStorePerf('load:done', {
                durationMs: Math.round(performance.now() - startedAt),
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                activeViewId: stateToSet.activeViewId,
                viewCount: stateToSet.views.length,
                loadedViewCount: nextState.views.length,
                widgetCount: stateToSet.widgets.length,
                layoutCount: stateToSet.layout.length,
            });
            writeWidgetDashboardStartupSnapshot(effectiveOrganisationId, stateToSet);
            didHydrateFromStartupSnapshot = false;
            set({
                state: stateToSet,
                organisationId: effectiveOrganisationId,
                isLoading: false,
                error: null,
            });
            if (activeViewOnly) {
                void loadWidgetDashboardViewsForOrganisationAsync(effectiveOrganisationId)
                    .then(views => {
                    const current = get();
                    if (stateEpoch !== requestEpoch ||
                        current.organisationId !== effectiveOrganisationId ||
                        !isWidgetDashboardState(current.state) ||
                        current.state.activeViewId !== stateToSet.activeViewId) {
                        return;
                    }
                    const hydratedState: WidgetDashboardState = {
                        ...current.state,
                        views,
                    };
                    if (areDashboardViewsEquivalent(current.state.views, hydratedState.views)) {
                        dashboardStorePerf('views-hydrate:skipped-unchanged', {
                            organisationId: effectiveOrganisationId,
                            activeViewId: stateToSet.activeViewId,
                            viewCount: views.length,
                        });
                        return;
                    }
                    dashboardStorePerf('views-hydrate:done', {
                        organisationId: effectiveOrganisationId,
                        activeViewId: stateToSet.activeViewId,
                        viewCount: views.length,
                    });
                    writeWidgetDashboardStartupSnapshot(effectiveOrganisationId, hydratedState);
                    set({ state: hydratedState });
                })
                    .catch(error => {
                    dashboardStorePerf('views-hydrate:error', {
                        organisationId: effectiveOrganisationId,
                        message: error instanceof Error ? error.message : String(error),
                    });
                });
            }
            return nextState;
        })
            .catch(error => {
            if (stateEpoch !== requestEpoch)
                return null;
            const message = error instanceof Error ? error.message : 'Could not load widgets.';
            dashboardStorePerf('load:error', {
                durationMs: Math.round(performance.now() - startedAt),
                organisationId: effectiveOrganisationId,
                requestedOrganisationId,
                activeViewOnly,
                message,
            });
            set({ isLoading: false, error: message });
            return null;
        })
            .finally(() => {
            if (inFlightKey === loadKey && inFlightEpoch === requestEpoch) {
                inFlightLoad = null;
                inFlightKey = null;
            }
        });
        return inFlightLoad;
    },
    refresh: async (organisationId?: string, options: DashboardLoadOptions = { activeViewOnly: true }) => {
        const targetOrganisationId = organisationId || get().organisationId || 'default';
        const shouldResolveView = options.viewId === null;
        return get().load(targetOrganisationId, {
            ...options,
            viewId: shouldResolveView ? undefined : options.viewId || get().state?.activeViewId,
            force: true,
        });
    },
    setDashboardState: (nextStateOrUpdater, organisationId) => {
        stateEpoch += 1;
        set(current => {
            const currentState = isWidgetDashboardState(current.state) ? current.state : null;
            const nextState = typeof nextStateOrUpdater === 'function'
                ? nextStateOrUpdater(currentState)
                : nextStateOrUpdater;
            const nextOrganisationId = organisationId && organisationId !== 'default'
                ? organisationId
                : current.organisationId ?? organisationId ?? null;
            writeWidgetDashboardStartupSnapshot(nextOrganisationId, nextState);
            didHydrateFromStartupSnapshot = false;
            return {
                state: nextState,
                organisationId: nextOrganisationId,
                isLoading: false,
                error: null,
            };
        });
    },
    setActiveViewId: (viewId: string) => {
        const current = get();
        if (!current.state || current.state.activeViewId === viewId)
            return;
        stateEpoch += 1;
        const effectiveOrganisationId = current.organisationId || 'default';
        const hasViewCached = Array.isArray(current.state.views) &&
            current.state.views.some(v => v.id === viewId) &&
            Array.isArray(current.state.layout) &&
            current.state.layout.some(pos => pos.viewId === viewId);
        if (hasViewCached) {
            // In-memory instant switch
            const nextState: WidgetDashboardState = {
                ...current.state,
                activeViewId: viewId,
            };
            writeWidgetDashboardStartupSnapshot(effectiveOrganisationId, nextState);
            set({ state: nextState });
            // Background asynchronous persistence without triggering store reload
            void switchWidgetDashboardViewAsync(viewId, effectiveOrganisationId, {
                trigger: 'manual-click',
            }).catch(err => {
                console.error('[WidgetDashboardStore] background view persistence failed', err);
            });
        }
        else {
            // Scoped load for the target view
            void get().load(effectiveOrganisationId, {
                activeViewOnly: true,
                viewId,
                force: true,
            }).then(loadedState => {
                if (!loadedState || get().organisationId !== effectiveOrganisationId || get().state?.activeViewId !== viewId)
                    return;
                void switchWidgetDashboardViewAsync(viewId, effectiveOrganisationId, {
                    trigger: 'manual-click',
                }).catch(err => {
                    console.error('[WidgetDashboardStore] background view persistence failed', err);
                });
            });
        }
    },
    returnToHomeView: () => {
        const current = get();
        const activateHome = (state: WidgetDashboardState | null) => {
            const homeViewId = state?.views.find(isMainDashboardView)?.id;
            if (homeViewId)
                get().setActiveViewId(homeViewId);
        };
        if (current.state?.views.some(isMainDashboardView)) {
            activateHome(current.state);
            return;
        }
        const organisationId = current.organisationId || 'default';
        void get().load(organisationId, { activeViewOnly: false, force: true }).then(activateHome);
    },
}));
