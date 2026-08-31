import { create } from 'zustand';
import {
  loadWidgetDashboardViewsForWorkspaceAsync,
  loadWidgetDashboardStateForCurrentWindowAsync,
  resolveWidgetDashboardWorkspaceIdAsync,
} from '../localStorage/widgetDashboardStorage';
import type { WidgetDashboardState } from '../../pages/AltS_search_newtab/src/components/widgets/widgetDashboard.types';

type DashboardLoadOptions = {
  activeViewOnly?: boolean;
  force?: boolean;
  viewId?: string | null;
};

type DashboardStateUpdate =
  | WidgetDashboardState
  | null
  | ((state: WidgetDashboardState | null) => WidgetDashboardState | null);

type WidgetDashboardStoreState = {
  state: WidgetDashboardState | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  load: (workspaceId: string, options?: DashboardLoadOptions) => Promise<WidgetDashboardState | null>;
  refresh: (workspaceId?: string, options?: DashboardLoadOptions) => Promise<WidgetDashboardState | null>;
  setDashboardState: (state: DashboardStateUpdate, workspaceId?: string | null) => void;
  setActiveViewId: (viewId: string) => void;
};

let inFlightLoad: Promise<WidgetDashboardState | null> | null = null;
let inFlightKey: string | null = null;
const WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY = 'cmdos_widget_dashboard_startup_snapshot_v3';
const WIDGET_DASHBOARD_STARTUP_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const getLoadKey = (workspaceId: string, options?: DashboardLoadOptions) =>
  `${workspaceId}:${options?.activeViewOnly !== false ? 'active' : 'full'}:${options?.viewId || 'resolved'}`;

const ENABLE_WIDGET_DASHBOARD_STORE_LOGS = false;

const dashboardStorePerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_WIDGET_DASHBOARD_STORE_LOGS) return;
  console.log('[NewTabPerf][WidgetDashboardStore]', label, JSON.stringify(data || {}));
};

const isWidgetDashboardState = (state: unknown): state is WidgetDashboardState =>
  Boolean(
    state &&
    typeof state === 'object' &&
    typeof (state as WidgetDashboardState).activeViewId === 'string' &&
    Array.isArray((state as WidgetDashboardState).views) &&
    Array.isArray((state as WidgetDashboardState).widgets) &&
    Array.isArray((state as WidgetDashboardState).layout),
  );

const areDashboardViewsEquivalent = (
  left: WidgetDashboardState['views'],
  right: WidgetDashboardState['views'],
): boolean => {
  if (left.length !== right.length) return false;
  return left.every((view, index) => {
    const other = right[index];
    return (
      other &&
      view.id === other.id &&
      view.title === other.title &&
      Boolean(view.isDefault) === Boolean(other.isDefault) &&
      JSON.stringify(view.settings || {}) === JSON.stringify(other.settings || {}) &&
      JSON.stringify(view.collectionLaunchSettings || {}) === JSON.stringify(other.collectionLaunchSettings || {})
    );
  });
};

type WidgetDashboardStartupSnapshot = {
  workspaceId: string;
  state: WidgetDashboardState;
  savedAt: number;
};

const readWidgetDashboardStartupSnapshot = (): WidgetDashboardStartupSnapshot | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WidgetDashboardStartupSnapshot>;
    if (
      !parsed ||
      typeof parsed.workspaceId !== 'string' ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > WIDGET_DASHBOARD_STARTUP_SNAPSHOT_MAX_AGE_MS ||
      !isWidgetDashboardState(parsed.state)
    ) {
      return null;
    }
    return {
      workspaceId: parsed.workspaceId,
      state: parsed.state,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
};

const writeWidgetDashboardStartupSnapshot = (workspaceId: string | null, state: WidgetDashboardState | null) => {
  try {
    if (!workspaceId || !state || !isWidgetDashboardState(state)) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const snapshot: WidgetDashboardStartupSnapshot = {
      workspaceId,
      state,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(WIDGET_DASHBOARD_STARTUP_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup snapshot is a render fast-path only; Dexie remains the source of truth.
  }
};

const startupSnapshot = readWidgetDashboardStartupSnapshot();
let didHydrateFromStartupSnapshot = Boolean(startupSnapshot);

export const useWidgetDashboardStore = create<WidgetDashboardStoreState>((set, get) => ({
  state: startupSnapshot?.state ?? null,
  workspaceId: startupSnapshot?.workspaceId ?? null,
  isLoading: false,
  error: null,

  load: async (workspaceId: string, options: DashboardLoadOptions = { activeViewOnly: true }) => {
    const activeViewOnly = options.activeViewOnly !== false;
    const requestedWorkspaceId = workspaceId;
    const effectiveWorkspaceId = await resolveWidgetDashboardWorkspaceIdAsync(workspaceId);
    const loadKey = getLoadKey(effectiveWorkspaceId, {
      activeViewOnly,
      viewId: options.viewId,
    });
    const current = get();
    const currentState = isWidgetDashboardState(current.state) ? current.state : null;
    const hasRenderableCurrentState = Boolean(currentState && current.workspaceId === effectiveWorkspaceId);
    const hasRequestedViewState = !options.viewId || currentState?.activeViewId === options.viewId;

    if (inFlightLoad && inFlightKey === loadKey) {
      dashboardStorePerf('load:in-flight-hit', {
        workspaceId: effectiveWorkspaceId,
        requestedWorkspaceId,
        activeViewOnly,
        forced: Boolean(options.force),
      });
      return inFlightLoad;
    }

    if (!options.force && hasRenderableCurrentState && hasRequestedViewState && !didHydrateFromStartupSnapshot) {
      dashboardStorePerf('load:cache-hit', {
        workspaceId: effectiveWorkspaceId,
        requestedWorkspaceId,
        activeViewOnly,
        activeViewId: currentState!.activeViewId,
        widgetCount: currentState!.widgets.length,
      });
      return currentState;
    }
    if (current.state && current.workspaceId === effectiveWorkspaceId && !currentState) {
      dashboardStorePerf('load:cache-invalid', {
        workspaceId: effectiveWorkspaceId,
        requestedWorkspaceId,
        activeViewOnly,
        stateType: typeof current.state,
      });
    }
    if (hasRenderableCurrentState && didHydrateFromStartupSnapshot) {
      dashboardStorePerf('load:snapshot-refresh', {
        workspaceId: effectiveWorkspaceId,
        requestedWorkspaceId,
        activeViewOnly,
        activeViewId: currentState!.activeViewId,
        widgetCount: currentState!.widgets.length,
      });
    }

    const startedAt = performance.now();
    dashboardStorePerf('load:start', {
      workspaceId: effectiveWorkspaceId,
      requestedWorkspaceId,
      activeViewOnly,
      forced: Boolean(options.force),
      hasRenderableState: hasRenderableCurrentState,
    });
    set({ isLoading: !hasRenderableCurrentState, error: null, workspaceId: effectiveWorkspaceId });

    if (!hasRenderableCurrentState) {
      void loadWidgetDashboardViewsForWorkspaceAsync(effectiveWorkspaceId)
        .then(views => {
          const current = get();
          if (current.workspaceId === effectiveWorkspaceId && !current.state) {
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
    inFlightLoad = loadWidgetDashboardStateForCurrentWindowAsync(effectiveWorkspaceId, {
      activeViewOnly,
      viewId: options.viewId || undefined,
    })
      .then(nextState => {
        const currentAfterLoad = get();
        const stateToSet =
          activeViewOnly &&
          currentAfterLoad.workspaceId === effectiveWorkspaceId &&
          isWidgetDashboardState(currentAfterLoad.state) &&
          currentAfterLoad.state.views.length > nextState.views.length
            ? {
                ...nextState,
                views: currentAfterLoad.state.views,
              }
            : nextState;
        dashboardStorePerf('load:done', {
          durationMs: Math.round(performance.now() - startedAt),
          workspaceId: effectiveWorkspaceId,
          requestedWorkspaceId,
          activeViewOnly,
          activeViewId: stateToSet.activeViewId,
          viewCount: stateToSet.views.length,
          loadedViewCount: nextState.views.length,
          widgetCount: stateToSet.widgets.length,
          layoutCount: stateToSet.layout.length,
        });
        writeWidgetDashboardStartupSnapshot(effectiveWorkspaceId, stateToSet);
        didHydrateFromStartupSnapshot = false;
        set({
          state: stateToSet,
          workspaceId: effectiveWorkspaceId,
          isLoading: false,
          error: null,
        });
        if (activeViewOnly) {
          void loadWidgetDashboardViewsForWorkspaceAsync(effectiveWorkspaceId)
            .then(views => {
              const current = get();
              if (
                current.workspaceId !== effectiveWorkspaceId ||
                !isWidgetDashboardState(current.state) ||
                current.state.activeViewId !== stateToSet.activeViewId
              ) {
                return;
              }
              const hydratedState: WidgetDashboardState = {
                ...current.state,
                views,
              };
              if (areDashboardViewsEquivalent(current.state.views, hydratedState.views)) {
                dashboardStorePerf('views-hydrate:skipped-unchanged', {
                  workspaceId: effectiveWorkspaceId,
                  activeViewId: stateToSet.activeViewId,
                  viewCount: views.length,
                });
                return;
              }
              dashboardStorePerf('views-hydrate:done', {
                workspaceId: effectiveWorkspaceId,
                activeViewId: stateToSet.activeViewId,
                viewCount: views.length,
              });
              writeWidgetDashboardStartupSnapshot(effectiveWorkspaceId, hydratedState);
              set({ state: hydratedState });
            })
            .catch(error => {
              dashboardStorePerf('views-hydrate:error', {
                workspaceId: effectiveWorkspaceId,
                message: error instanceof Error ? error.message : String(error),
              });
            });
        }
        return nextState;
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : 'Could not load widgets.';
        dashboardStorePerf('load:error', {
          durationMs: Math.round(performance.now() - startedAt),
          workspaceId: effectiveWorkspaceId,
          requestedWorkspaceId,
          activeViewOnly,
          message,
        });
        set({ isLoading: false, error: message });
        return null;
      })
      .finally(() => {
        if (inFlightKey === loadKey) {
          inFlightLoad = null;
          inFlightKey = null;
        }
      });

    return inFlightLoad;
  },

  refresh: async (workspaceId?: string, options: DashboardLoadOptions = { activeViewOnly: true }) => {
    const targetWorkspaceId = workspaceId || get().workspaceId || 'default';
    const shouldResolveView = options.viewId === null;
    return get().load(targetWorkspaceId, {
      ...options,
      viewId: shouldResolveView ? undefined : options.viewId || get().state?.activeViewId,
      force: true,
    });
  },

  setDashboardState: (nextStateOrUpdater, workspaceId) => {
    set(current => {
      const currentState = isWidgetDashboardState(current.state) ? current.state : null;
      const nextState =
        typeof nextStateOrUpdater === 'function'
          ? nextStateOrUpdater(currentState)
          : nextStateOrUpdater;
      const nextWorkspaceId = workspaceId && workspaceId !== 'default'
        ? workspaceId
        : current.workspaceId ?? workspaceId ?? null;

      writeWidgetDashboardStartupSnapshot(nextWorkspaceId, nextState);
      didHydrateFromStartupSnapshot = false;

      return {
        state: nextState,
        workspaceId: nextWorkspaceId,
        isLoading: false,
        error: null,
      };
    });
  },

  setActiveViewId: viewId => {
    set(current => (
      current.state
        ? {
            state: {
              ...current.state,
              activeViewId: viewId,
            },
          }
        : current
    ));
  },
}));
