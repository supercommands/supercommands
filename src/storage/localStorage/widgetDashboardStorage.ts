import {
  createDefaultWidgetDashboardState,
  DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
  WIDGET_CONSTRAINTS,
  WIDGET_GRID_COLUMNS,
  WIDGET_SIZE_PRESETS,
} from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';
import { normalizeWidgetLayout, resolveWidgetLayout } from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetLayoutEngine';
import { WIDGET_CATALOG_CATEGORIES } from '../../pages/AltS_search_newtab/src/components/widgets/widgetCatalog';
import { generateEntityId } from '../../shared-components/utils';
import { deleteHtmlWidgetContentIfUnreferencedAsync } from './htmlWidgetContentStorage';
import type {
  WidgetDashboardState,
  WidgetDashboardView,
  WidgetGridPosition,
  WidgetInstance,
  WidgetSizePreset,
  WidgetType,
} from '../../pages/AltS_search_newtab/src/components/widgets/widgetDashboard.types';

export const WIDGET_DASHBOARD_STORAGE_KEY = 'widget-dashboard-layout-v2';
export const LEGACY_WIDGET_DASHBOARD_STORAGE_KEY = 'widget-dashboard-layout-v1';
export const WIDGET_DASHBOARD_STORAGE_EVENT = 'widget-dashboard-layout-change';

const WIDGET_DASHBOARD_LOCK_NAME = 'widget-dashboard-storage';
let widgetDashboardMutationQueue = Promise.resolve();

const getExtensionChrome = (): any =>
  typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome;

const isChromeStorageAvailable = () =>
  Boolean(getExtensionChrome()?.storage?.local);

const getStorageItemStrict = async <T = unknown>(key: string): Promise<T | null> => {
  if (!isChromeStorageAvailable()) return null;
  const data = await getExtensionChrome().storage.local.get(key);
  return data[key] === undefined ? null : data[key];
};

const setStorageItemStrict = async (key: string, value: unknown): Promise<void> => {
  if (!isChromeStorageAvailable()) return;
  await getExtensionChrome().storage.local.set({ [key]: value });
};

const dispatchWidgetDashboardChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_STORAGE_EVENT));
  }
};

const runWithDashboardLock = async <T>(operation: () => Promise<T>): Promise<T> => {
  const runQueued = () => {
    const queuedOperation = widgetDashboardMutationQueue
      .catch(() => undefined)
      .then(operation);
    widgetDashboardMutationQueue = queuedOperation.then(() => undefined, () => undefined);
    return queuedOperation;
  };

  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: any }).locks : undefined;
  if (!locks?.request) return runQueued();

  return locks.request(WIDGET_DASHBOARD_LOCK_NAME, () => runQueued());
};

const isWidgetSizePreset = (value: unknown): value is WidgetSizePreset =>
  value === 'small' || value === 'medium' || value === 'large';

const isKnownWidgetType = (value: unknown): value is WidgetType =>
  value === 'default-commands' ||
  value === 'note-item' ||
  value === 'time' ||
  value === 'news' ||
  value === 'weather' ||
  value === 'favorites' ||
  value === 'todo-list' ||
  value === 'quote-of-the-day' ||
  value === 'daily-quote' ||
  value === 'html' ||
  value === 'generic';

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const toSettings = (value: unknown): Record<string, unknown> => (isPlainRecord(value) ? value : {});

const isUuidLikeEntityId = (value: unknown, entityType: string) =>
  typeof value === 'string' &&
  new RegExp(`^${entityType}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, 'i').test(value);

const getValidatedEntityId = (
  value: unknown,
  entityType: 'dashboardView' | 'widget',
  idMap: Map<string, string>,
): string => {
  const originalId = typeof value === 'string' ? value : '';
  if (originalId && idMap.has(originalId)) return idMap.get(originalId) as string;

  const nextId = isUuidLikeEntityId(originalId, entityType) ? originalId : generateEntityId(entityType);
  if (originalId) idMap.set(originalId, nextId);
  return nextId;
};

const widgetCategoryByType = new Map<WidgetType, string>();
WIDGET_CATALOG_CATEGORIES.forEach(category => {
  category.items.forEach(item => {
    widgetCategoryByType.set(item.type, category.id);
  });
});

const getWidgetCategoryId = (widgetType: WidgetType | undefined, fallback?: string): string | undefined => {
  if (fallback) return fallback;
  return widgetType ? widgetCategoryByType.get(widgetType) : undefined;
};

const normalizeWidgetType = (type: unknown): WidgetType | undefined => {
  const nextType = type === 'daily-quote' ? 'quote-of-the-day' : type;
  return isKnownWidgetType(nextType) ? nextType : undefined;
};

const normalizeLayoutsByView = (layout: readonly WidgetGridPosition[]): WidgetGridPosition[] => {
  const layoutByView = new Map<string, WidgetGridPosition[]>();
  layout.forEach(position => {
    const viewLayout = layoutByView.get(position.viewId) ?? [];
    viewLayout.push(position);
    layoutByView.set(position.viewId, viewLayout);
  });

  return Array.from(layoutByView.values()).flatMap(viewLayout => normalizeWidgetLayout(viewLayout));
};

const ensureLayoutForWidgets = (
  widgets: readonly WidgetInstance[],
  layout: readonly WidgetGridPosition[],
): WidgetGridPosition[] => {
  const layoutByWidgetId = new Map(layout.map(position => [position.i, position]));
  const nextLayout = [...layout];

  widgets.forEach(widget => {
    if (layoutByWidgetId.has(widget.id)) return;
    const presetSize = WIDGET_SIZE_PRESETS[widget.sizePreset];
    nextLayout.push({
      i: widget.id,
      viewId: widget.viewId,
      categoryId: widget.categoryId,
      x: 0,
      y: Number.MAX_SAFE_INTEGER,
      w: presetSize.w,
      h: presetSize.h,
      ...WIDGET_CONSTRAINTS,
    });
  });

  return normalizeLayoutsByView(nextLayout);
};

const isCatalogOrStaticWidgetId = (id: string): boolean =>
  /^widget-/.test(id) || WIDGET_CATALOG_CATEGORIES.some(category => category.items.some(item => item.id === id));

const inferWidgetSizePreset = (
  widget: Partial<WidgetInstance>,
  position?: Partial<WidgetGridPosition>,
): WidgetSizePreset => {
  if (isWidgetSizePreset(widget.sizePreset)) return widget.sizePreset;

  const width = Number(position?.w) || 0;
  if (width <= WIDGET_SIZE_PRESETS.small.w) return 'small';
  if (width <= WIDGET_SIZE_PRESETS.medium.w) return 'medium';
  return 'large';
};

const sanitizeLayoutPosition = (
  position: Partial<WidgetGridPosition>,
  widget: WidgetInstance,
): WidgetGridPosition | null => {
  if (!position.i) return null;

  const presetSize = WIDGET_SIZE_PRESETS[widget.sizePreset];
  const rawWidth = Number(position.w);
  const rawHeight = Number(position.h);
  const nextWidth = Number.isFinite(rawWidth) ? Math.round(rawWidth) : presetSize.w;
  const nextHeight = Number.isFinite(rawHeight) ? Math.round(rawHeight) : presetSize.h;
  const w = Math.min(Math.max(nextWidth, WIDGET_CONSTRAINTS.minW), WIDGET_CONSTRAINTS.maxW, WIDGET_GRID_COLUMNS);
  const h = Math.min(Math.max(nextHeight, WIDGET_CONSTRAINTS.minH), WIDGET_CONSTRAINTS.maxH);
  const x = Math.min(Math.max(Number(position.x) || 0, 0), Math.max(WIDGET_GRID_COLUMNS - w, 0));
  const y = Math.max(Number(position.y) || 0, 0);

  return {
    i: widget.id,
    viewId: widget.viewId,
    categoryId: widget.categoryId,
    x,
    y,
    w,
    h,
    ...WIDGET_CONSTRAINTS,
  };
};

const isLegacyDummyWidget = (widget: WidgetInstance): boolean => {
  const isGeneric = widget.type === 'generic';
  const isDummyTitle = /^Widget [1-4]$/i.test(widget.title);
  const isDummyId = /^widget-[1-4]$/i.test(widget.id);
  return isGeneric && (isDummyTitle || isDummyId);
};

const sanitizeWidget = (
  widget: Partial<WidgetInstance>,
  position: Partial<WidgetGridPosition> | undefined,
  viewId: string | undefined,
  widgetIdMap: Map<string, string>,
  forceNewId = false,
): WidgetInstance | null => {
  if (!widget.title) return null;

  const originalId = typeof widget.id === 'string' ? widget.id : '';
  const sizePreset = inferWidgetSizePreset(widget, position);
  const type = normalizeWidgetType(widget.type);
  const expansionMode =
    widget.expansionMode === 'horizontal' || widget.expansionMode === 'vertical' || widget.expansionMode === 'free'
      ? widget.expansionMode
      : 'preset';

  return {
    id: forceNewId ? generateEntityId('widget') : getValidatedEntityId(originalId, 'widget', widgetIdMap),
    viewId: String(widget.viewId || viewId || ''),
    categoryId: getWidgetCategoryId(type, widget.categoryId),
    title: String(widget.title),
    type,
    noteId: widget.noteId ? String(widget.noteId) : undefined,
    noteTitle: widget.noteTitle ? String(widget.noteTitle) : undefined,
    noteBody: widget.noteBody ? String(widget.noteBody) : undefined,
    settings: toSettings(widget.settings),
    sizePreset,
    expansionMode,
    createdAt: Number(widget.createdAt) || Date.now(),
    updatedAt: Number(widget.updatedAt) || Date.now(),
  };
};

const createDefaultView = (now = Date.now()): WidgetDashboardView => ({
  id: generateEntityId('dashboardView'),
  title: DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
  isDefault: true,
  settings: {},
  createdAt: now,
  updatedAt: now,
});

const sanitizeView = (
  view: Partial<WidgetDashboardView>,
  viewIdMap: Map<string, string>,
): WidgetDashboardView | null => {
  if (!view.title) return null;
  const now = Date.now();
  return {
    id: getValidatedEntityId(view.id, 'dashboardView', viewIdMap),
    title: String(view.title).trim() || DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
    isDefault: Boolean(view.isDefault),
    settings: toSettings(view.settings),
    createdAt: Number(view.createdAt) || now,
    updatedAt: Number(view.updatedAt) || now,
  };
};

const normalizeDefaultView = (views: WidgetDashboardView[], now = Date.now()): WidgetDashboardView[] => {
  if (views.length === 0) return [createDefaultView(now)];

  const defaultIndex = views.findIndex(view => view.isDefault);
  const targetDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  return views.map((view, index) => ({
    ...view,
    isDefault: index === targetDefaultIndex,
    updatedAt: index === targetDefaultIndex && !view.isDefault ? now : view.updatedAt,
  }));
};

const migrateV1DashboardState = (candidate: any): WidgetDashboardState => {
  const now = Date.now();
  const defaultView = createDefaultView(now);
  const widgetIdMap = new Map<string, string>();

  if (!Array.isArray(candidate?.widgets) || !Array.isArray(candidate?.layout)) {
    return createDefaultWidgetDashboardState({ includeStarterWidget: true });
  }

  const rawLayoutByWidgetId = new Map<string, Partial<WidgetGridPosition>>();
  candidate.layout.forEach((position: Partial<WidgetGridPosition>) => {
    if (position?.i && !rawLayoutByWidgetId.has(String(position.i))) {
      rawLayoutByWidgetId.set(String(position.i), position);
    }
  });

  const seenWidgetIds = new Set<string>();
  const widgets: WidgetInstance[] = candidate.widgets
    .map((widget: Partial<WidgetInstance>) => {
      const originalId = widget.id ? String(widget.id) : '';
      const forceNewId = !originalId || isCatalogOrStaticWidgetId(originalId) || seenWidgetIds.has(originalId);
      const sanitized = sanitizeWidget(
        widget,
        originalId ? rawLayoutByWidgetId.get(originalId) : undefined,
        defaultView.id,
        widgetIdMap,
        forceNewId,
      );
      if (sanitized && originalId) widgetIdMap.set(originalId, sanitized.id);
      return sanitized;
    })
    .filter((widget: WidgetInstance | null): widget is WidgetInstance => Boolean(widget))
    .filter((widget: WidgetInstance) => !isLegacyDummyWidget(widget))
    .filter((widget: WidgetInstance) => widget.type !== 'default-commands')
    .filter((widget: WidgetInstance) => {
      if (seenWidgetIds.has(widget.id)) return false;
      seenWidgetIds.add(widget.id);
      return true;
    });

  const widgetById = new Map(widgets.map(widget => [widget.id, widget]));
  const layout = candidate.layout
    .map((position: Partial<WidgetGridPosition>) => {
      const mappedId = position?.i ? widgetIdMap.get(String(position.i)) || String(position.i) : '';
      const widget = widgetById.get(mappedId);
      return widget ? sanitizeLayoutPosition({ ...position, i: mappedId }, widget) : null;
    })
    .filter((position: WidgetGridPosition | null): position is WidgetGridPosition => position !== null);

  return {
    schemaVersion: 2,
    revision: 1,
    activeViewId: defaultView.id,
    views: [defaultView],
    widgets,
    layout: ensureLayoutForWidgets(widgets, layout),
    updatedAt: Number(candidate.updatedAt) || now,
  };
};

export const validateWidgetDashboardState = (raw: unknown): WidgetDashboardState => {
  const candidate = raw as (Omit<Partial<WidgetDashboardState>, 'schemaVersion'> & { schemaVersion?: number }) | null;

  if (
    !candidate ||
    !Array.isArray(candidate.widgets) ||
    !Array.isArray(candidate.layout)
  ) {
    return createDefaultWidgetDashboardState({ includeStarterWidget: false });
  }

  if (candidate.schemaVersion === undefined || candidate.schemaVersion === 1) {
    return migrateV1DashboardState(candidate);
  }

  if (candidate.schemaVersion !== 2) {
    throw new Error(`Unsupported widget dashboard schema version: ${String(candidate.schemaVersion)}`);
  }

  const viewIdMap = new Map<string, string>();
  const widgetIdMap = new Map<string, string>();
  const seenViewIds = new Set<string>();
  let views = Array.isArray(candidate.views)
    ? candidate.views
        .map(view => sanitizeView(view, viewIdMap))
        .filter((view): view is WidgetDashboardView => Boolean(view))
        .filter(view => {
          if (seenViewIds.has(view.id)) return false;
          seenViewIds.add(view.id);
          return true;
        })
    : [];

  views = normalizeDefaultView(views);

  const mappedActiveViewId = viewIdMap.get(String(candidate.activeViewId)) || String(candidate.activeViewId || '');
  const activeViewId = views.some(view => view.id === mappedActiveViewId)
    ? mappedActiveViewId
    : views.find(view => view.isDefault)?.id || views[0].id;
  const viewIds = new Set(views.map(view => view.id));

  const rawLayoutByWidgetId = new Map<string, Partial<WidgetGridPosition>>();
  candidate.layout.forEach(position => {
    if (position?.i && !rawLayoutByWidgetId.has(String(position.i))) {
      rawLayoutByWidgetId.set(String(position.i), position);
    }
  });

  const seenWidgetIds = new Set<string>();
  const widgets: WidgetInstance[] = candidate.widgets
    .map(widget => {
      const originalId = widget.id ? String(widget.id) : '';
      const mappedViewId = viewIdMap.get(String(widget.viewId)) || String(widget.viewId || '');
      const forceNewId = originalId ? seenWidgetIds.has(originalId) : true;
      const sanitized = sanitizeWidget(
        { ...widget, viewId: mappedViewId },
        originalId ? rawLayoutByWidgetId.get(originalId) : undefined,
        undefined,
        widgetIdMap,
        forceNewId,
      );
      if (sanitized && originalId) widgetIdMap.set(originalId, sanitized.id);
      return sanitized;
    })
    .filter((widget): widget is WidgetInstance => Boolean(widget))
    .filter(widget => !isLegacyDummyWidget(widget))
    .filter(widget => widget.type !== 'default-commands')
    .filter(widget => viewIds.has(widget.viewId))
    .filter(widget => {
      if (seenWidgetIds.has(widget.id)) return false;
      seenWidgetIds.add(widget.id);
      return true;
    });

  const widgetById = new Map(widgets.map(widget => [widget.id, widget]));
  const layout = candidate.layout
    .map(position => {
      const mappedWidgetId = position?.i ? widgetIdMap.get(String(position.i)) || String(position.i) : '';
      const widget = widgetById.get(mappedWidgetId);
      return widget ? sanitizeLayoutPosition({ ...position, i: mappedWidgetId }, widget) : null;
    })
    .filter((position): position is WidgetGridPosition => position !== null)
    .filter(position => widgetById.has(position.i));

  return {
    schemaVersion: 2,
    revision: Math.max(1, Number(candidate.revision) || 1),
    activeViewId,
    views,
    widgets,
    layout: ensureLayoutForWidgets(widgets, layout),
    updatedAt: Number(candidate.updatedAt) || Date.now(),
  };
};

const persistWidgetDashboardStateAsync = async (state: WidgetDashboardState): Promise<WidgetDashboardState> => {
  const persistedState = validateWidgetDashboardState({
    ...state,
    revision: Math.max(1, Number(state.revision) || 1),
    layout: normalizeLayoutsByView(state.layout),
    updatedAt: Date.now(),
  });

  await setStorageItemStrict(WIDGET_DASHBOARD_STORAGE_KEY, persistedState);
  dispatchWidgetDashboardChange();
  return persistedState;
};

export const loadWidgetDashboardStateAsync = async (): Promise<WidgetDashboardState> =>
  runWithDashboardLock(async () => {
    const rawV2 = await getStorageItemStrict(WIDGET_DASHBOARD_STORAGE_KEY);
    if (rawV2) return validateWidgetDashboardState(rawV2);

    const rawLegacy = await getStorageItemStrict(LEGACY_WIDGET_DASHBOARD_STORAGE_KEY);
    const nextState = rawLegacy
      ? validateWidgetDashboardState(rawLegacy)
      : createDefaultWidgetDashboardState({ includeStarterWidget: true });

    await persistWidgetDashboardStateAsync(nextState);
    return nextState;
  });

export const mutateWidgetDashboardStateAsync = async (
  mutator: (state: WidgetDashboardState) => WidgetDashboardState | null | undefined,
): Promise<WidgetDashboardState> =>
  runWithDashboardLock(async () => {
    const rawV2 = await getStorageItemStrict(WIDGET_DASHBOARD_STORAGE_KEY);
    const rawLegacy = rawV2 ? null : await getStorageItemStrict(LEGACY_WIDGET_DASHBOARD_STORAGE_KEY);
    const currentState = rawV2
      ? validateWidgetDashboardState(rawV2)
      : rawLegacy
        ? validateWidgetDashboardState(rawLegacy)
        : createDefaultWidgetDashboardState({ includeStarterWidget: true });
    const mutatedState = mutator(currentState);
    if (!mutatedState) return currentState;
    const now = Date.now();
    return persistWidgetDashboardStateAsync({
      ...mutatedState,
      revision: currentState.revision + 1,
      updatedAt: now,
    });
  });

export const saveWidgetDashboardStateAsync = async (state: WidgetDashboardState): Promise<void> => {
  await mutateWidgetDashboardStateAsync(() => state);
};

const getUniqueViewTitle = (views: readonly WidgetDashboardView[], requestedTitle: string): string => {
  const trimmedTitle = requestedTitle.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!trimmedTitle) throw new Error('View name is required.');
  const titleExists = views.some(view => view.title.trim().toLowerCase() === trimmedTitle.toLowerCase());
  if (titleExists) throw new Error('A dashboard view with this name already exists.');
  return trimmedTitle;
};

export const createWidgetDashboardViewAsync = async (title: string): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const now = Date.now();
    const viewTitle = getUniqueViewTitle(state.views, title);
    const view: WidgetDashboardView = {
      id: generateEntityId('dashboardView'),
      title: viewTitle,
      settings: {},
      createdAt: now,
      updatedAt: now,
    };

    return {
      ...state,
      activeViewId: view.id,
      views: [...state.views, view],
      updatedAt: now,
    };
  });

export const renameWidgetDashboardViewAsync = async (viewId: string, title: string): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const existingView = state.views.find(view => view.id === viewId);
    if (!existingView) return state;
    const otherViews = state.views.filter(view => view.id !== viewId);
    const viewTitle = getUniqueViewTitle(otherViews, title);
    const now = Date.now();

    return {
      ...state,
      views: state.views.map(view => view.id === viewId ? { ...view, title: viewTitle, updatedAt: now } : view),
      updatedAt: now,
    };
  });

export const switchWidgetDashboardViewAsync = async (viewId: string): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    if (!state.views.some(view => view.id === viewId) || state.activeViewId === viewId) return state;
    return {
      ...state,
      activeViewId: viewId,
      updatedAt: Date.now(),
    };
  });

export const deleteWidgetDashboardViewAsync = async (viewId: string): Promise<WidgetDashboardState> => {
  const deletedHtmlContentIds = new Set<string>();
  const nextState = await mutateWidgetDashboardStateAsync(state => {
    if (state.views.length <= 1 || !state.views.some(view => view.id === viewId)) return state;

    const now = Date.now();
    const deletedView = state.views.find(view => view.id === viewId);
    state.widgets
      .filter(widget => widget.viewId === viewId && widget.type === 'html')
      .forEach(widget => {
        const contentId = widget.settings?.contentId;
        if (typeof contentId === 'string') deletedHtmlContentIds.add(contentId);
      });
    const remainingViews = state.views
      .filter(view => view.id !== viewId)
      .sort((first, second) => first.createdAt - second.createdAt || first.id.localeCompare(second.id));

    let views = state.views.filter(view => view.id !== viewId);
    if (deletedView?.isDefault || !views.some(view => view.isDefault)) {
      const promotedViewId = remainingViews[0].id;
      views = views.map(view => ({
        ...view,
        isDefault: view.id === promotedViewId,
        updatedAt: view.id === promotedViewId ? now : view.updatedAt,
      }));
    }

    const nextActiveViewId =
      state.activeViewId === viewId
        ? views.find(view => view.isDefault)?.id || views[0].id
        : state.activeViewId;

    return {
      ...state,
      activeViewId: nextActiveViewId,
      views,
      widgets: state.widgets.filter(widget => widget.viewId !== viewId),
      layout: state.layout.filter(position => position.viewId !== viewId),
      updatedAt: now,
    };
  });

  await Promise.all(
    Array.from(deletedHtmlContentIds).map(contentId =>
      deleteHtmlWidgetContentIfUnreferencedAsync(contentId, nextState.widgets),
    ),
  );
  return nextState;
};

export const addWidgetInstanceAsync = async (
  widgetInput: Pick<WidgetInstance, 'title' | 'type' | 'sizePreset'> &
    Partial<Pick<WidgetInstance, 'categoryId' | 'noteId' | 'noteTitle' | 'noteBody' | 'settings'>>,
  layoutInput?: Omit<WidgetGridPosition, 'i' | 'viewId'>,
  requestedViewId?: string,
): Promise<{ state: WidgetDashboardState; widgetId: string }> => {
  let createdWidgetId = '';
  const state = await mutateWidgetDashboardStateAsync(currentState => {
    const now = Date.now();
    const activeViewId = requestedViewId && currentState.views.some(view => view.id === requestedViewId)
      ? requestedViewId
      : currentState.activeViewId;
    const instanceId = generateEntityId('widget');
    createdWidgetId = instanceId;
    const newWidget: WidgetInstance = {
      id: instanceId,
      viewId: activeViewId,
      categoryId: widgetInput.categoryId || getWidgetCategoryId(widgetInput.type),
      title: widgetInput.title,
      type: normalizeWidgetType(widgetInput.type),
      noteId: widgetInput.noteId,
      noteTitle: widgetInput.noteTitle,
      noteBody: widgetInput.noteBody,
      settings: toSettings(widgetInput.settings),
      sizePreset: widgetInput.sizePreset,
      expansionMode: 'preset',
      createdAt: now,
      updatedAt: now,
    };
    const activeLayout = currentState.layout.filter(position => position.viewId === activeViewId);
    const nextPosition: WidgetGridPosition = {
      i: instanceId,
      viewId: activeViewId,
      categoryId: newWidget.categoryId,
      ...(layoutInput || {
        x: 0,
        y: Number.MAX_SAFE_INTEGER,
        ...WIDGET_SIZE_PRESETS[newWidget.sizePreset],
        ...WIDGET_CONSTRAINTS,
      }),
    };

    return {
      ...currentState,
      activeViewId,
      widgets: [...currentState.widgets, newWidget],
      layout: [
        ...currentState.layout.filter(position => position.viewId !== activeViewId),
        ...normalizeWidgetLayout([...activeLayout, nextPosition], instanceId),
      ],
      updatedAt: now,
    };
  });

  return { state, widgetId: createdWidgetId };
};

export const commitWidgetDashboardLayoutAsync = async (
  viewId: string,
  layout: WidgetGridPosition[],
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId)) return state;
    const widgetById = new Map(state.widgets.filter(widget => widget.viewId === viewId).map(widget => [widget.id, widget]));
    const normalizedLayout = normalizeWidgetLayout(layout)
      .filter(position => widgetById.has(position.i))
      .map(position => ({
        ...position,
        viewId,
        categoryId: position.categoryId || widgetById.get(position.i)?.categoryId,
      }));

    return {
      ...state,
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...normalizedLayout,
      ],
      updatedAt: Date.now(),
    };
  });

export const commitWidgetDashboardResizeAsync = async (
  viewId: string,
  layout: WidgetGridPosition[],
  widgetId: string | undefined,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId)) return state;
    const widgetById = new Map(state.widgets.filter(widget => widget.viewId === viewId).map(widget => [widget.id, widget]));
    const normalizedLayout = normalizeWidgetLayout(layout, widgetId)
      .filter(position => widgetById.has(position.i))
      .map(position => ({
        ...position,
        viewId,
        categoryId: position.categoryId || widgetById.get(position.i)?.categoryId,
      }));
    const now = Date.now();

    return {
      ...state,
      widgets: state.widgets.map(widget =>
        widget.id === widgetId && widget.viewId === viewId
          ? {
              ...widget,
              expansionMode: 'free' as const,
              updatedAt: now,
            }
          : widget,
      ),
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...normalizedLayout,
      ],
      updatedAt: now,
    };
  });

export const deleteWidgetInstanceAsync = async (viewId: string, widgetId: string): Promise<WidgetDashboardState> => {
  let deletedHtmlContentId: string | undefined;
  const nextState = await mutateWidgetDashboardStateAsync(state => {
    const widget = state.widgets.find(currentWidget => currentWidget.id === widgetId);
    if (!widget || widget.viewId !== viewId) return state;
    if (widget.type === 'html' && typeof widget.settings?.contentId === 'string') {
      deletedHtmlContentId = widget.settings.contentId;
    }
    return {
      ...state,
      widgets: state.widgets.filter(currentWidget => currentWidget.id !== widgetId),
      layout: state.layout.filter(position => position.i !== widgetId),
      updatedAt: Date.now(),
    };
  });

  await deleteHtmlWidgetContentIfUnreferencedAsync(deletedHtmlContentId, nextState.widgets);
  return nextState;
};

export const purgeMissingNoteWidgetsAsync = async (validNoteIds: Set<string> | string[]): Promise<WidgetDashboardState> => {
  const validSet = validNoteIds instanceof Set ? validNoteIds : new Set(validNoteIds);
  return mutateWidgetDashboardStateAsync(state => {
    const orphanedWidgetIds = new Set<string>();

    for (const widget of state.widgets) {
      if (widget.type === 'note-item') {
        const targetNoteId = widget.noteId || (typeof widget.settings?.noteId === 'string' ? widget.settings.noteId : undefined);
        if (targetNoteId && !validSet.has(targetNoteId)) {
          orphanedWidgetIds.add(widget.id);
        }
      }
    }

    if (orphanedWidgetIds.size === 0) return state;

    return {
      ...state,
      widgets: state.widgets.filter(widget => !orphanedWidgetIds.has(widget.id)),
      layout: state.layout.filter(position => !orphanedWidgetIds.has(position.i)),
      updatedAt: Date.now(),
    };
  });
};

export const applyWidgetSizePresetAsync = async (
  viewId: string,
  widgetId: string,
  preset: WidgetSizePreset,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const widget = state.widgets.find(currentWidget => currentWidget.id === widgetId);
    if (!widget || widget.viewId !== viewId) return state;

    const now = Date.now();
    const activeLayout = state.layout.filter(position => position.viewId === viewId);
    const resizedLayout = activeLayout.map(position =>
      position.i === widgetId
        ? {
            ...position,
            x: Math.min(position.x, Math.max(WIDGET_GRID_COLUMNS - WIDGET_SIZE_PRESETS[preset].w, 0)),
            w: WIDGET_SIZE_PRESETS[preset].w,
            h: WIDGET_SIZE_PRESETS[preset].h,
            ...WIDGET_CONSTRAINTS,
          }
        : position,
    );

    return {
      ...state,
      widgets: state.widgets.map(currentWidget =>
        currentWidget.id === widgetId
          ? {
              ...currentWidget,
              sizePreset: preset,
              expansionMode: 'preset' as const,
              updatedAt: now,
            }
          : currentWidget,
      ),
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...resolveWidgetLayout(resizedLayout, widgetId).map(position => ({
          ...position,
          viewId,
          categoryId: position.categoryId || state.widgets.find(currentWidget => currentWidget.id === position.i)?.categoryId,
        })),
      ],
      updatedAt: now,
    };
  });
