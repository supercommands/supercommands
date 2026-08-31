import {
  convertFineGridToLegacyPosition,
  createDefaultWidgetDashboardState,
  DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
  getAllowedWidgetSizePresets,
  getAllowedWidgetColumns,
  inferPresetFromWidth,
  isWidgetSizePresetAllowed,
  normalizeWidgetCustomSize,
  snapManualWidgetSize,
  snapToAllowedColumn,
  snapToAllowedWidth,
  WIDGET_CONSTRAINTS,
  WIDGET_GRID_COLUMNS,
  WIDGET_SIZE_PRESETS,
} from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';
import {
  compactLayoutVertically,
  findNextAvailableWidgetPosition,
  normalizeWidgetLayout,
  resolveWidgetLayout,
} from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetLayoutEngine';
import { WIDGET_CATALOG_CATEGORIES } from '../../pages/AltS_search_newtab/src/components/widgets/widgetCatalog';
import { generateEntityId } from '../../shared-components/utils';
import { deleteHtmlWidgetContentIfUnreferencedAsync } from './htmlWidgetContentStorage';
import {
  createWidgetInWorkspace,
  saveWorkspaceWidgetLayouts,
  deleteWidgetFromWorkspace,
  getDashboardDataForWorkspace,
  createDefaultWidgetsForView,
} from '../../allObjectFolder/src/createObject/widgets/widgetData';
import { deleteNote } from '../../allObjectFolder/src/createObject/notes/noteData';
import { DEFAULT_SESSION_SETTINGS } from '../../allObjectFolder/src/createObject/session/sessionSettings';
import {
  normalizeCollectionLaunchSettings,
  type WidgetRecord,
} from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { db } from '../indexDB/dbConfig';
import { StorageManager } from './storageManager';
import { getSmartDefaultWorkspace } from './lastUsedWorkspace';
import {
  getCurrentDashboardWindowIdAsync,
  getPreferredWidgetDashboardViewForCurrentWindowAsync,
  resolveWidgetDashboardViewForCurrentWindowAsync,
} from './widgetDashboardWindowViewStorage';
import type {
  WidgetCustomSize,
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
export const WIDGET_DASHBOARD_VIEW_SWITCH_EVENT = 'widget-dashboard-view-switch';
export const FIXED_SESSION_STRIP_SESSION_SETTING_KEY = 'fixedSessionStripSessionId';
const getActiveWidgetViewStorageKey = (workspaceId: string): string => `active_widget_view_${workspaceId}`;
const DEFAULT_WIDGET_VIEW_CACHE_KEY = 'default_widget_view_by_workspace_v1';

const WIDGET_DASHBOARD_LOCK_NAME = 'widget-dashboard-storage';
let widgetDashboardMutationQueue = Promise.resolve();

const ENABLE_WIDGET_DASHBOARD_STORAGE_LOGS = false;
const ENABLE_DASHBOARD_AUTO_RUN_STORAGE_LOGS = false;

const widgetDashboardPerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_WIDGET_DASHBOARD_STORAGE_LOGS) return;
  console.log('[NewTabPerf][WidgetDashboardStorage]', label, JSON.stringify(data || {}));
};

const dashboardAutoRunStorageDebug = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_DASHBOARD_AUTO_RUN_STORAGE_LOGS) return;
  console.log('[DashboardAutoRun][storage]', label, data || {});
};

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
  value === 'note-library' ||
  value === 'session-item' ||
  value === 'link-item' ||
  value === 'link-library' ||
  value === 'ai-prompt-library' ||
  value === 'snippet-library' ||
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

const withFixedSessionStripSessionSetting = (
  settings: unknown,
  sessionId: string,
): Record<string, unknown> => ({
  ...toSettings(settings),
  [FIXED_SESSION_STRIP_SESSION_SETTING_KEY]: sessionId,
});

const getFixedSessionStripSessionIdFromSettings = (settings: unknown): string | null => {
  const sessionId = toSettings(settings)[FIXED_SESSION_STRIP_SESSION_SETTING_KEY];
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : null;
};

const getLinkedSessionIdForDashboardViewAsync = async (
  viewId: string,
  workspaceId: string,
  settings: unknown,
): Promise<string | null> => {
  const fixedSessionId = getFixedSessionStripSessionIdFromSettings(settings);
  if (fixedSessionId) return fixedSessionId;

  const widgets = await db.widgets.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray();
  const sessionWidget = widgets.find(widget => String(widget.type || '').toLowerCase().trim() === 'session-item');
  const legacySessionWidget = sessionWidget as (WidgetRecord & { sessionId?: string }) | undefined;
  const sessionId =
    legacySessionWidget?.sessionId ||
    (sessionWidget?.referenceType === 'session' ? sessionWidget.referenceId : null);
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : null;
};

const endPreviousDashboardViewSessionAsync = async (
  nextViewId: string,
  previousViewId: string,
  previousSessionId: string | null,
): Promise<void> => {
  const chromeAny = getExtensionChrome();
  if (!chromeAny?.runtime?.sendMessage) return;
  const windowId = await getCurrentDashboardWindowIdAsync();

  const response = await chromeAny.runtime.sendMessage({
    action: 'dashboard_view_navigated',
    nextViewId,
    previousViewId,
    previousSessionId,
    windowId,
  });
  if (response?.ok === false) {
    throw new Error(response.error || 'Could not stop the previous dashboard session.');
  }
};

export const updateFixedSessionStripSessionForViewAsync = async (
  viewId: string,
  sessionId: string,
): Promise<void> => {
  const normalizedViewId = String(viewId || '').trim();
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedViewId || !normalizedSessionId) return;

  const now = Date.now();
  await runWithDashboardLock(async () => {
    const view = await db.widgetViews.get(normalizedViewId);
    if (!view) return;
    const nextSettings = withFixedSessionStripSessionSetting(view.settings, normalizedSessionId);
    await db.widgetViews.update(normalizedViewId, {
      settings: nextSettings,
      updatedAt: now,
    });
  });
  dispatchWidgetDashboardChange();
};

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
  return inferPresetFromWidth(width);
};

const sanitizeLayoutPosition = (
  position: Partial<WidgetGridPosition>,
  widget: WidgetInstance,
): WidgetGridPosition | null => {
  if (!position.i) return null;

  const basePosition: WidgetGridPosition = {
    i: String(position.i),
    viewId: String(widget.viewId),
    categoryId: widget.categoryId,
    gridVersion: position.gridVersion,
    x: Number(position.x) || 0,
    y: Number(position.y) || 0,
    w: Number(position.w) || 4,
    h: Number(position.h) || 5,
    minW: position.minW,
    maxW: position.maxW,
    minH: position.minH,
    maxH: position.maxH,
    isDraggable: position.isDraggable,
    isResizable: position.isResizable,
    static: position.static,
  };

  const currentPos = basePosition.gridVersion === 2
    ? convertFineGridToLegacyPosition(basePosition)
    : basePosition;

  const isFree = widget.expansionMode === 'free';
  const rawWidth = Number.isFinite(currentPos.w) && currentPos.w > 0 ? Math.round(currentPos.w) : WIDGET_CONSTRAINTS.minW;
  const rawHeight = Number.isFinite(currentPos.h) && currentPos.h > 0 ? Math.round(currentPos.h) : WIDGET_CONSTRAINTS.minH;

  let w: number;
  let h: number;
  let x: number;

  if (isFree) {
    const customSize = normalizeWidgetCustomSize(widget.customSize) || snapManualWidgetSize(rawWidth, rawHeight, Number(currentPos.x) || 0);
    w = customSize.w;
    h = customSize.h;
    x = Math.min(Math.max(Number(currentPos.x) || 0, 0), WIDGET_GRID_COLUMNS - w);
  } else {
    const presetSize = WIDGET_SIZE_PRESETS[widget.sizePreset] || WIDGET_SIZE_PRESETS.medium;
    w = presetSize.w;
    h = presetSize.h;
    x = snapToAllowedColumn(Number(currentPos.x) || 0, w);
  }

  const y = Math.max(Number(currentPos.y) || 0, 0);
  const { gridVersion, ...rest } = currentPos;

  return {
    ...rest,
    i: widget.id,
    viewId: widget.viewId,
    categoryId: widget.categoryId,
    x,
    y,
    w,
    h,
    minW: WIDGET_CONSTRAINTS.minW,
    maxW: WIDGET_CONSTRAINTS.maxW,
    minH: WIDGET_CONSTRAINTS.minH,
    maxH: WIDGET_CONSTRAINTS.maxH,
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
  const type = normalizeWidgetType(widget.type);
  let sizePreset = inferWidgetSizePreset(widget, position);
  if (!isWidgetSizePresetAllowed(type, sizePreset)) {
    sizePreset = 'medium';
  }
  const expansionMode =
    widget.expansionMode === 'horizontal' || widget.expansionMode === 'vertical' || widget.expansionMode === 'free'
      ? widget.expansionMode
      : 'preset';

  let customSize = normalizeWidgetCustomSize(widget.customSize);
  if (!customSize && expansionMode === 'free' && position?.w && position?.h) {
    customSize = snapManualWidgetSize(Number(position.w), Number(position.h), Number(position.x) || 0);
  }

  return {
    id: forceNewId ? generateEntityId('widget') : getValidatedEntityId(originalId, 'widget', widgetIdMap),
    viewId: String(widget.viewId || viewId || ''),
    categoryId: getWidgetCategoryId(type, widget.categoryId),
    title: String(widget.title),
    type,
    noteId: widget.noteId ? String(widget.noteId) : undefined,
    noteTitle: widget.noteTitle ? String(widget.noteTitle) : undefined,
    noteBody: widget.noteBody ? String(widget.noteBody) : undefined,
    sessionId: widget.sessionId ? String(widget.sessionId) : undefined,
    sessionTitle: widget.sessionTitle ? String(widget.sessionTitle) : undefined,
    linkId: widget.linkId ? String(widget.linkId) : undefined,
    settings: toSettings(widget.settings),
    sizePreset,
    expansionMode,
    customSize,
    createdAt: Number(widget.createdAt) || Date.now(),
    updatedAt: Number(widget.updatedAt) || Date.now(),
  };
};

const createDefaultView = (now = Date.now()): WidgetDashboardView => ({
  id: generateEntityId('dashboardView'),
  title: DEFAULT_WIDGET_DASHBOARD_VIEW_TITLE,
  isDefault: true,
  collectionLaunchSettings: normalizeCollectionLaunchSettings(),
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
    collectionLaunchSettings: normalizeCollectionLaunchSettings(view.collectionLaunchSettings),
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

const migrateLegacyLinkWidgets = (
  widgets: WidgetInstance[],
  layout: WidgetGridPosition[],
  viewIds: Set<string>,
): { widgets: WidgetInstance[]; layout: WidgetGridPosition[] } => {
  const hasLegacyLinkWidgets = widgets.some(w => (w.type as any) === 'link-item');
  if (!hasLegacyLinkWidgets) return { widgets, layout };

  const nextWidgets = [...widgets];
  const nextLayout = [...layout];

  for (const viewId of viewIds) {
    const legacyWidgetsInView = nextWidgets.filter(
      w => w.viewId === viewId && (w.type as any) === 'link-item',
    );
    if (legacyWidgetsInView.length === 0) continue;

    const legacyLinkIds: string[] = [];
    for (const lw of legacyWidgetsInView) {
      const lid = lw.linkId || (typeof lw.settings?.linkId === 'string' ? lw.settings.linkId : undefined);
      if (lid && !legacyLinkIds.includes(lid)) {
        legacyLinkIds.push(lid);
      }
    }

    const existingLibraryWidgetIndex = nextWidgets.findIndex(
      w => w.viewId === viewId && w.type === 'link-library',
    );

    if (existingLibraryWidgetIndex >= 0) {
      const libraryWidget = nextWidgets[existingLibraryWidgetIndex];
      const existingSettings = (libraryWidget.settings || {}) as Record<string, any>;
      const existingSelectedIds: string[] = Array.isArray(existingSettings.selectedCollectionIds)
        ? existingSettings.selectedCollectionIds
        : [];
      const mergedSelectedIds = Array.from(new Set([...existingSelectedIds, ...legacyLinkIds]));

      nextWidgets[existingLibraryWidgetIndex] = {
        ...libraryWidget,
        settings: {
          ...existingSettings,
          selectedCollectionIds: mergedSelectedIds,
        },
        updatedAt: Date.now(),
      };
    } else if (legacyWidgetsInView.length > 0) {
      const firstLegacy = legacyWidgetsInView[0];
      const convertedWidget: WidgetInstance = {
        ...firstLegacy,
        type: 'link-library',
        title: 'Links',
        settings: {
          sourceMode: 'manual',
          selectedCollectionIds: legacyLinkIds,
          selectedTagIds: [],
          tagMatchMode: 'any',
          sortBy: 'saved-order',
        },
        updatedAt: Date.now(),
      };
      const firstIndex = nextWidgets.findIndex(w => w.id === firstLegacy.id);
      if (firstIndex >= 0) {
        nextWidgets[firstIndex] = convertedWidget;
      }
    }

    const legacyIdsToRemove = new Set(
      legacyWidgetsInView
        .filter(w => existingLibraryWidgetIndex >= 0 || w.id !== legacyWidgetsInView[0].id)
        .map(w => w.id),
    );

    if (legacyIdsToRemove.size > 0) {
      for (let i = nextWidgets.length - 1; i >= 0; i--) {
        if (legacyIdsToRemove.has(nextWidgets[i].id)) {
          nextWidgets.splice(i, 1);
        }
      }
      for (let i = nextLayout.length - 1; i >= 0; i--) {
        if (legacyIdsToRemove.has(nextLayout[i].i)) {
          nextLayout.splice(i, 1);
        }
      }
    }
  }

  return { widgets: nextWidgets, layout: nextLayout };
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
  const rawWidgets: WidgetInstance[] = candidate.widgets
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

  const widgetById = new Map(rawWidgets.map(widget => [widget.id, widget]));
  const rawLayout = candidate.layout
    .map(position => {
      const mappedWidgetId = position?.i ? widgetIdMap.get(String(position.i)) || String(position.i) : '';
      const widget = widgetById.get(mappedWidgetId);
      return widget ? sanitizeLayoutPosition({ ...position, i: mappedWidgetId }, widget) : null;
    })
    .filter((position): position is WidgetGridPosition => position !== null)
    .filter(position => widgetById.has(position.i));

  const migrated = migrateLegacyLinkWidgets(rawWidgets, rawLayout, viewIds);

  return {
    schemaVersion: 2,
    revision: Math.max(1, Number(candidate.revision) || 1),
    activeViewId,
    views,
    widgets: migrated.widgets,
    layout: compactLayoutVertically(ensureLayoutForWidgets(migrated.widgets, migrated.layout)),
    updatedAt: Number(candidate.updatedAt) || Date.now(),
  };
};

const persistWidgetDashboardStateAsync = async (state: WidgetDashboardState): Promise<WidgetDashboardState> => {
  dispatchWidgetDashboardChange();
  return state;
};

export const resolveWidgetDashboardWorkspaceIdAsync = async (inputWorkspaceId?: string): Promise<string> => {
  if (inputWorkspaceId && inputWorkspaceId !== 'default') return inputWorkspaceId;
  const smartWorkspace = await getSmartDefaultWorkspace();
  return smartWorkspace?.id || 'default';
};

const resolveWorkspaceId = resolveWidgetDashboardWorkspaceIdAsync;

const getActiveViewIdForWorkspace = (workspaceId: string): string | null => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(getActiveWidgetViewStorageKey(workspaceId));
  } catch {
    return null;
  }
};

const setActiveViewIdForWorkspace = (workspaceId: string, viewId: string): void => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(getActiveWidgetViewStorageKey(workspaceId), viewId);
  } catch (e) {
    console.error('Failed to set active view id:', e);
  }
};

const readDefaultViewCache = (): Record<string, { viewId: string; updatedAt: number }> => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(DEFAULT_WIDGET_VIEW_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const getCachedDefaultViewIdForWorkspace = (workspaceId: string): string | null => {
  const cached = readDefaultViewCache()[workspaceId];
  return typeof cached?.viewId === 'string' && cached.viewId ? cached.viewId : null;
};

const setCachedDefaultViewIdForWorkspace = (workspaceId: string, viewId: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !workspaceId || !viewId) return;
    const cache = readDefaultViewCache();
    cache[workspaceId] = { viewId, updatedAt: Date.now() };
    window.localStorage.setItem(DEFAULT_WIDGET_VIEW_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Dexie remains the source of truth; this cache only speeds up startup fallback.
  }
};

const clearCachedDefaultViewIdForWorkspace = (workspaceId: string): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !workspaceId) return;
    const cache = readDefaultViewCache();
    if (!cache[workspaceId]) return;
    delete cache[workspaceId];
    window.localStorage.setItem(DEFAULT_WIDGET_VIEW_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache cleanup failures.
  }
};

const ensureDefaultWidgetViewForWorkspace = async (
  workspaceId: string,
  dashboardData?: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>,
): Promise<void> => {
  const existingViewCount = await db.widgetViews.where('workspaceId').equals(workspaceId).count();
  if (existingViewCount > 0) return;

  const now = Date.now();
  const existingViewIds = Array.from(
    new Set([
      ...(dashboardData?.widgets || []).map(widget => widget.viewId).filter(Boolean),
      ...(dashboardData?.layouts || []).map(layout => layout.viewId).filter(Boolean),
    ]),
  );
  const viewIds = existingViewIds.length > 0 ? existingViewIds : [`dashboardView_default_${workspaceId}`];
  const defaultViewId = viewIds[0];

  await db.widgetViews.bulkPut(
    viewIds.map((viewId, index) => ({
      id: viewId,
      workspaceId,
      title: index === 0 ? 'Main Dashboard' : `Dashboard View ${index + 1}`,
      isDefault: index === 0,
      collectionLaunchSettings: normalizeCollectionLaunchSettings(),
      settings: {},
      createdAt: now,
      updatedAt: now,
    })),
  );
  await setActiveViewIdForWorkspace(workspaceId, defaultViewId);
  setCachedDefaultViewIdForWorkspace(workspaceId, defaultViewId);
};

const mapDexieViewsToDashboardViews = (views: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>['views']) =>
  views.length > 0
    ? views.map(v => ({
        id: v.id,
        title: v.title,
        isDefault: v.isDefault,
        collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
        settings: v.settings || {},
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }))
    : [{ id: 'default', title: 'Main Dashboard', isDefault: true, createdAt: Date.now(), updatedAt: Date.now() }];

const createFastActiveDashboardView = (
  viewId: string,
  viewRecord?: Partial<WidgetDashboardView>,
): WidgetDashboardView => {
  const now = Date.now();
  return {
    id: viewId,
    title: viewRecord?.title || '',
    isDefault: Boolean(viewRecord?.isDefault),
    collectionLaunchSettings: normalizeCollectionLaunchSettings(viewRecord?.collectionLaunchSettings),
    settings: viewRecord?.settings || { __fastActiveViewPlaceholder: true },
    createdAt: Number(viewRecord?.createdAt) || now,
    updatedAt: Number(viewRecord?.updatedAt) || now,
  };
};

const filterWidgetsWithExistingReferences = async <T extends { referenceType?: string; referenceId?: string }>(
  widgets: T[],
): Promise<T[]> => {
  const noteIds = Array.from(
    new Set(
      widgets
        .map(w => (w.referenceType === 'note' ? w.referenceId : (w as any).noteId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  const sessionIds = Array.from(
    new Set(
      widgets
        .map(w => (w.referenceType === 'session' ? w.referenceId : (w as any).sessionId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  const linkIds = Array.from(
    new Set(
      widgets
        .map(w => (w.referenceType === 'link' ? w.referenceId : (w as any).linkId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  const [noteRecords, sessionRecords, linkRecords] = await Promise.all([
    noteIds.length > 0 ? db.notes.bulkGet(noteIds).catch(() => []) : [],
    sessionIds.length > 0 ? db.sessions.bulkGet(sessionIds).catch(() => []) : [],
    linkIds.length > 0 ? db.links.bulkGet(linkIds).catch(() => []) : [],
  ]);
  const existingNoteIds = new Set(noteRecords.filter(Boolean).map(record => record!.id));
  const existingSessionIds = new Set(sessionRecords.filter(Boolean).map(record => record!.id));
  const existingLinkIds = new Set(linkRecords.filter(Boolean).map(record => record!.id));

  return widgets.filter(w => {
    const targetNoteId = w.referenceType === 'note' ? w.referenceId : (w as any).noteId;
    if (targetNoteId && !existingNoteIds.has(targetNoteId)) return false;

    const targetSessionId = w.referenceType === 'session' ? w.referenceId : (w as any).sessionId;
    if (targetSessionId && !existingSessionIds.has(targetSessionId)) return false;

    const targetLinkId = w.referenceType === 'link' ? w.referenceId : (w as any).linkId;
    if (targetLinkId && !existingLinkIds.has(targetLinkId)) return false;

    return true;
  });
};

const mapDexieWidgetsToDashboardWidgets = (
  widgets: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>['widgets'],
): WidgetInstance[] =>
  widgets.map(w => ({
    id: w.id,
    viewId: w.viewId,
    categoryId: w.categoryId || 'core-widgets',
    title: w.title,
    type: w.type as any,
    referenceId: w.referenceId,
    referenceType: w.referenceType,
    sessionId: w.referenceType === 'session' ? w.referenceId : undefined,
    noteId: w.referenceType === 'note' ? w.referenceId : undefined,
    linkId: w.referenceType === 'link' ? w.referenceId : undefined,
    settings: w.settings || {},
    sizePreset: w.sizePreset || 'medium',
    expansionMode: w.expansionMode || 'preset',
    customSize: normalizeWidgetCustomSize(w.customSize),
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }));

const mapDexieLayoutsToDashboardLayout = (
  layouts: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>['layouts'],
): {
  rawLayout: WidgetGridPosition[];
  layoutsToPersist: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>['layouts'];
} => {
  const layoutsToPersist: Awaited<ReturnType<typeof getDashboardDataForWorkspace>>['layouts'] = [];
  const rawLayout: WidgetGridPosition[] = layouts.map(l => {
    const pos: WidgetGridPosition = {
      i: l.widgetId,
      viewId: l.viewId,
      gridVersion: l.gridVersion,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      minW: l.minW,
      maxW: l.maxW,
      minH: l.minH,
      maxH: l.maxH,
      isDraggable: l.isDraggable,
      isResizable: l.isResizable,
      static: l.static,
    };
    if (l.gridVersion === 2) {
      const downgraded = convertFineGridToLegacyPosition(pos);
      layoutsToPersist.push({
        ...l,
        x: downgraded.x,
        y: downgraded.y,
        w: downgraded.w,
        h: downgraded.h,
        minW: downgraded.minW,
        maxW: downgraded.maxW,
        minH: downgraded.minH,
        maxH: downgraded.maxH,
        gridVersion: undefined,
        updatedAt: Date.now(),
      });
      return downgraded;
    }
    return pos;
  });

  return { rawLayout, layoutsToPersist };
};

const getScopedDashboardDataForView = async (workspaceId: string, viewId: string) => {
  const [widgets, layouts] = await Promise.all([
    db.widgets.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray(),
    db.widgetLayouts.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray(),
  ]);

  return { widgets, layouts };
};

export const loadWidgetDashboardViewsForWorkspaceAsync = async (
  workspaceId?: string,
): Promise<WidgetDashboardView[]> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const viewsStartedAt = performance.now();
  const views = await db.widgetViews.where('workspaceId').equals(effectiveWorkspaceId).toArray();
  const dashboardViews = mapDexieViewsToDashboardViews(views);
  widgetDashboardPerf('loadViewsOnly:done', {
    durationMs: Math.round(performance.now() - viewsStartedAt),
    workspaceId: effectiveWorkspaceId,
    viewCount: dashboardViews.length,
  });
  return dashboardViews;
};

export const loadWidgetDashboardStateAsync = async (workspaceId = 'default'): Promise<WidgetDashboardState> => {
  const loadStartedAt = performance.now();
  try {
    const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
    widgetDashboardPerf('loadFull:start', { workspaceId: effectiveWorkspaceId });
    let dexieData = await getDashboardDataForWorkspace(effectiveWorkspaceId);
    
    // 1. Fallback: If no widgets AND no views found in effectiveWorkspaceId, try 'default' workspace
    if (dexieData.widgets.length === 0 && dexieData.views.length === 0 && effectiveWorkspaceId !== 'default') {
      const defaultData = await getDashboardDataForWorkspace('default');
      if (defaultData.widgets.length > 0) {
        // Copy 'default' workspace data into effectiveWorkspaceId so future edits are strictly isolated
        await db.transaction('rw', [db.widgets, db.widgetLayouts, db.widgetViews], async () => {
          const now = Date.now();
          for (const v of defaultData.views) {
            await db.widgetViews.put({
              ...v,
              workspaceId: effectiveWorkspaceId,
              collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
              updatedAt: now,
            });
          }
          for (const w of defaultData.widgets) {
            await db.widgets.put({ ...w, workspaceId: effectiveWorkspaceId, updatedAt: now });
          }
          for (const l of defaultData.layouts) {
            await db.widgetLayouts.put({ ...l, workspaceId: effectiveWorkspaceId, updatedAt: now });
          }
        });
        dexieData = await getDashboardDataForWorkspace(effectiveWorkspaceId);
      }
    }

    // 2. Fallback: If still no widgets, check chrome.storage.local legacy blob
    if (dexieData.widgets.length === 0 && dexieData.views.length === 0) {
      const legacyBlob = await getStorageItemStrict<any>(WIDGET_DASHBOARD_STORAGE_KEY) ||
                         await getStorageItemStrict<any>(LEGACY_WIDGET_DASHBOARD_STORAGE_KEY);
      if (legacyBlob && typeof legacyBlob === 'object') {
        const validated = validateWidgetDashboardState(legacyBlob);
        if (validated.widgets.length > 0 || validated.views.length > 0) {
          // Persist legacy blob records into Dexie under effectiveWorkspaceId
          await db.transaction('rw', [db.widgets, db.widgetLayouts, db.widgetViews], async () => {
            const now = Date.now();
            for (const v of validated.views) {
              await db.widgetViews.put({
                id: String(v.id || 'default'),
                workspaceId: effectiveWorkspaceId,
                title: String(v.title || 'Main Dashboard'),
                isDefault: Boolean(v.isDefault),
                collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
                settings: (v.settings && typeof v.settings === 'object') ? (v.settings as Record<string, unknown>) : {},
                createdAt: Number(v.createdAt) || now,
                updatedAt: Number(v.updatedAt) || now,
              });
            }
            for (const w of validated.widgets) {
              const refId = w.referenceId || w.noteId || w.sessionId || w.linkId;
              const refType = w.referenceType || (w.noteId ? 'note' : w.sessionId ? 'session' : w.linkId ? 'link' : undefined);
              const widgetRec: WidgetRecord = {
                id: String(w.id || generateEntityId('widget')),
                workspaceId: effectiveWorkspaceId,
                viewId: String(w.viewId || 'default'),
                categoryId: w.categoryId || 'core-widgets',
                title: String(w.title || 'Widget'),
                type: String(w.type || 'generic'),
                referenceId: refId ? String(refId) : undefined,
                referenceType: refType ? String(refType) : undefined,
                settings: (w.settings && typeof w.settings === 'object') ? (w.settings as Record<string, unknown>) : {},
                sizePreset: w.sizePreset || 'medium',
                expansionMode: w.expansionMode || 'preset',
                createdAt: Number(w.createdAt) || now,
                updatedAt: Number(w.updatedAt) || now,
              };
              await db.widgets.put(widgetRec);
            }
            for (const l of validated.layout) {
              await db.widgetLayouts.put({
                id: String(l.i || generateEntityId('widget')),
                workspaceId: effectiveWorkspaceId,
                viewId: String(l.viewId || 'default'),
                widgetId: String(l.i || ''),
                x: Number(l.x) || 0,
                y: Number(l.y) || 0,
                w: Number(l.w) || 4,
                h: Number(l.h) || 4,
                minW: l.minW ? Number(l.minW) : undefined,
                maxW: l.maxW ? Number(l.maxW) : undefined,
                minH: l.minH ? Number(l.minH) : undefined,
                maxH: l.maxH ? Number(l.maxH) : undefined,
                isDraggable: l.isDraggable ?? true,
                isResizable: l.isResizable ?? true,
                static: l.static ?? false,
                updatedAt: now,
              });
            }
          });
          dexieData = await getDashboardDataForWorkspace(effectiveWorkspaceId);
        }
      }
    }

    if (dexieData.views.length === 0) {
      await ensureDefaultWidgetViewForWorkspace(effectiveWorkspaceId, dexieData);
      dexieData = await getDashboardDataForWorkspace(effectiveWorkspaceId);
    }

    const views: WidgetDashboardView[] = dexieData.views.length > 0
      ? dexieData.views.map(v => ({
          id: v.id,
          title: v.title,
          isDefault: v.isDefault,
          collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
          settings: v.settings || {},
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        }))
      : [{ id: 'default', title: 'Main Dashboard', isDefault: true, createdAt: Date.now(), updatedAt: Date.now() }];

    const noteIds = Array.from(
      new Set(
        dexieData.widgets
          .map(w => (w.referenceType === 'note' ? w.referenceId : (w as any).noteId))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const sessionIds = Array.from(
      new Set(
        dexieData.widgets
          .map(w => (w.referenceType === 'session' ? w.referenceId : (w as any).sessionId))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const linkIds = Array.from(
      new Set(
        dexieData.widgets
          .map(w => (w.referenceType === 'link' ? w.referenceId : (w as any).linkId))
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const [noteRecords, sessionRecords, linkRecords] = await Promise.all([
      noteIds.length > 0 ? db.notes.bulkGet(noteIds).catch(() => []) : [],
      sessionIds.length > 0 ? db.sessions.bulkGet(sessionIds).catch(() => []) : [],
      linkIds.length > 0 ? db.links.bulkGet(linkIds).catch(() => []) : [],
    ]);
    const existingNoteIds = new Set(noteRecords.filter(Boolean).map(record => record!.id));
    const existingSessionIds = new Set(sessionRecords.filter(Boolean).map(record => record!.id));
    const existingLinkIds = new Set(linkRecords.filter(Boolean).map(record => record!.id));

    const checkedDexieWidgets = dexieData.widgets.filter(w => {
      const targetNoteId = w.referenceType === 'note' ? w.referenceId : (w as any).noteId;
      if (targetNoteId && !existingNoteIds.has(targetNoteId)) return false;

      const targetSessionId = w.referenceType === 'session' ? w.referenceId : (w as any).sessionId;
      if (targetSessionId && !existingSessionIds.has(targetSessionId)) return false;

      const targetLinkId = w.referenceType === 'link' ? w.referenceId : (w as any).linkId;
      if (targetLinkId && !existingLinkIds.has(targetLinkId)) return false;

      return true;
    });

    const widgets: WidgetInstance[] = checkedDexieWidgets.map(w => ({
      id: w.id,
      viewId: w.viewId,
      categoryId: w.categoryId || 'core-widgets',
      title: w.title,
      type: w.type as any,
      referenceId: w.referenceId,
      referenceType: w.referenceType,
      sessionId: w.referenceType === 'session' ? w.referenceId : undefined,
      noteId: w.referenceType === 'note' ? w.referenceId : undefined,
      linkId: w.referenceType === 'link' ? w.referenceId : undefined,
      settings: w.settings || {},
      sizePreset: w.sizePreset || 'medium',
      expansionMode: w.expansionMode || 'preset',
      customSize: normalizeWidgetCustomSize(w.customSize),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));

    const layoutsToPersist: typeof dexieData.layouts = [];
    const rawLayout: WidgetGridPosition[] = dexieData.layouts.map(l => {
      const pos: WidgetGridPosition = {
        i: l.widgetId,
        viewId: l.viewId,
        gridVersion: l.gridVersion,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: l.minW,
        maxW: l.maxW,
        minH: l.minH,
        maxH: l.maxH,
        isDraggable: l.isDraggable,
        isResizable: l.isResizable,
        static: l.static,
      };
      if (l.gridVersion === 2) {
        const downgraded = convertFineGridToLegacyPosition(pos);
        layoutsToPersist.push({
          ...l,
          x: downgraded.x,
          y: downgraded.y,
          w: downgraded.w,
          h: downgraded.h,
          minW: downgraded.minW,
          maxW: downgraded.maxW,
          minH: downgraded.minH,
          maxH: downgraded.maxH,
          gridVersion: undefined,
          updatedAt: Date.now(),
        });
        return downgraded;
      }
      return pos;
    });

    if (layoutsToPersist.length > 0) {
      void db.widgetLayouts.bulkPut(layoutsToPersist).catch(err =>
        console.error('[Dexie] Failed to persist downgraded layouts:', err),
      );
    }

    const layout = ensureLayoutForWidgets(widgets, rawLayout);

    const hasLayoutChanges = layout.some((pos, idx) => {
      const orig = rawLayout[idx];
      return !orig || pos.x !== orig.x || pos.y !== orig.y || pos.w !== orig.w || pos.h !== orig.h;
    });

    if (hasLayoutChanges) {
      const migratedDexieRecords = layout.map(pos => ({
        id: pos.i,
        workspaceId: effectiveWorkspaceId,
        viewId: pos.viewId,
        widgetId: pos.i,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        minW: pos.minW,
        maxW: pos.maxW,
        minH: pos.minH,
        maxH: pos.maxH,
        isDraggable: pos.isDraggable,
        isResizable: pos.isResizable,
        static: pos.static,
        updatedAt: Date.now(),
      }));
      void db.widgetLayouts.bulkPut(migratedDexieRecords).catch(err =>
        console.error('[Dexie] Failed to persist migrated layout records:', err),
      );
    }

    const savedActiveViewId = await getActiveViewIdForWorkspace(effectiveWorkspaceId);
    const activeView = (savedActiveViewId && views.find(v => v.id === savedActiveViewId))
      || views.find(v => v.isDefault)
      || views[0];
    const defaultView = views.find(v => v.isDefault);
    if (defaultView?.id) {
      setCachedDefaultViewIdForWorkspace(effectiveWorkspaceId, defaultView.id);
    }

    const result: WidgetDashboardState = {
      schemaVersion: 2,
      revision: 1,
      activeViewId: activeView ? activeView.id : 'default',
      views,
      widgets,
      layout,
      updatedAt: Date.now(),
    };
    widgetDashboardPerf('loadFull:done', {
      durationMs: Math.round(performance.now() - loadStartedAt),
      workspaceId: effectiveWorkspaceId,
      activeViewId: result.activeViewId,
      viewCount: result.views.length,
      widgetCount: result.widgets.length,
      layoutCount: result.layout.length,
    });
    return result;
  } catch (err) {
    console.warn('[Dexie] Failed to load dashboard state from Dexie:', err);
    widgetDashboardPerf('loadFull:error', {
      durationMs: Math.round(performance.now() - loadStartedAt),
      message: err instanceof Error ? err.message : String(err),
    });
    return createDefaultWidgetDashboardState({ includeStarterWidget: false });
  }
};

export const mutateWidgetDashboardStateAsync = async (
  mutator: (state: WidgetDashboardState) => WidgetDashboardState | null | undefined | Promise<WidgetDashboardState | null | undefined>,
  workspaceId?: string,
): Promise<WidgetDashboardState> =>
  runWithDashboardLock(async () => {
    const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
    const mutatedState = await mutator(currentState);
    if (!mutatedState) return currentState;
    const now = Date.now();
    dispatchWidgetDashboardChange();
    return {
      ...mutatedState,
      revision: currentState.revision + 1,
      updatedAt: now,
    };
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

export const createWidgetDashboardViewAsync = async (
  title: string,
  workspaceId = 'default',
  options?: { viewIconId?: string }
): Promise<{ state: WidgetDashboardState; createdNoteId: string; createdSessionId: string; sessionWidgetId: string }> => {
  const now = Date.now();
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
  const viewTitle = getUniqueViewTitle(currentState.views, title);
  const viewId = generateEntityId('dashboardView');

  // 1. Save view record to Dexie db.widgetViews
  await db.widgetViews.put({
    id: viewId,
    workspaceId: effectiveWorkspaceId,
    title: viewTitle,
    isDefault: false,
    collectionLaunchSettings: normalizeCollectionLaunchSettings(),
    settings: options?.viewIconId ? { viewIconId: options.viewIconId } : {},
    createdAt: now,
    updatedAt: now,
  });

  // 2. Auto-create default note widget and Large session-item widget.
  const defaultNoteTitle = 'Untitled Note';
  const { noteId: createdNoteId, sessionId: createdSessionId, sessionWidgetId } = await createDefaultWidgetsForView(
    effectiveWorkspaceId,
    viewId,
    defaultNoteTitle,
    viewTitle,
  );

  await db.widgetViews.update(viewId, {
    settings: withFixedSessionStripSessionSetting(options?.viewIconId ? { viewIconId: options.viewIconId } : {}, createdSessionId),
    updatedAt: Date.now(),
  });

  // 3. Select the new view only for this tab.
  await setActiveViewIdForWorkspace(effectiveWorkspaceId, viewId);

  // 4. Re-query fresh dashboard state
  const updatedState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
  dispatchWidgetDashboardChange();
  // Notify all dashboard consumers to switch to the new view
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, { detail: { viewId } }));
  }

  return {
    state: {
      ...updatedState,
      activeViewId: viewId,
    },
    createdNoteId,
    createdSessionId,
    sessionWidgetId,
  };
};

export const renameWidgetDashboardViewAsync = async (
  viewId: string,
  title: string,
  workspaceId?: string,
  options?: { viewIconId?: string }
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const existingView = state.views.find(view => view.id === viewId);
    if (!existingView) return state;
    const otherViews = state.views.filter(view => view.id !== viewId);
    const viewTitle = getUniqueViewTitle(otherViews, title);
    const now = Date.now();

    const updatedSettings = {
      ...toSettings(existingView.settings),
      ...(options?.viewIconId ? { viewIconId: options.viewIconId } : {}),
    };

    void db.widgetViews.update(viewId, { title: viewTitle, settings: updatedSettings, updatedAt: now }).catch(err => console.error('[Dexie] Failed to update view title in IndexedDB:', err));

    return {
      ...state,
      views: state.views.map(view => view.id === viewId ? { ...view, title: viewTitle, settings: updatedSettings, updatedAt: now } : view),
      updatedAt: now,
    };
  }, workspaceId);

/**
 * Makes one view the sole default for its workspace. View IDs remain database
 * references only; `isDefault` is the source of truth for default recognition.
 */
export const setDefaultWidgetDashboardViewAsync = async (
  viewId: string,
  workspaceId?: string,
): Promise<WidgetDashboardState> =>
  runWithDashboardLock(async () => {
    const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
    const targetView = await db.widgetViews.get(viewId);
    if (!targetView || targetView.workspaceId !== effectiveWorkspaceId) {
      throw new Error('The selected dashboard view does not exist in this workspace.');
    }

    const now = Date.now();
    await db.transaction('rw', db.widgetViews, async () => {
      await db.widgetViews
        .where('workspaceId')
        .equals(effectiveWorkspaceId)
        .modify(view => {
          const shouldBeDefault = view.id === viewId;
          if (view.isDefault !== shouldBeDefault) {
            view.isDefault = shouldBeDefault;
            view.updatedAt = now;
          }
        });
    });
    setCachedDefaultViewIdForWorkspace(effectiveWorkspaceId, viewId);

    const nextState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
    dispatchWidgetDashboardChange();
    return nextState;
  });

export const switchWidgetDashboardViewAsync = async (
  viewId: string,
  workspaceId?: string,
  options: { trigger?: 'manual-click' | 'system'; forceDispatch?: boolean } = {},
): Promise<WidgetDashboardState> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const views = await db.widgetViews.where('workspaceId').equals(effectiveWorkspaceId).toArray();
  const savedActiveViewId = await getActiveViewIdForWorkspace(effectiveWorkspaceId);
  const didFindView = views.some(view => view.id === viewId);
  const currentActiveViewId =
    (savedActiveViewId && views.some(view => view.id === savedActiveViewId) && savedActiveViewId) ||
    views.find(view => view.isDefault)?.id ||
    views[0]?.id ||
    'default';
  const didSwitchView = didFindView && currentActiveViewId !== viewId;

  dashboardAutoRunStorageDebug('switch view check', {
    requestedViewId: viewId,
    effectiveWorkspaceId,
    currentActiveViewId,
    viewExists: didFindView,
    isSameView: currentActiveViewId === viewId,
    trigger: options.trigger,
    forceDispatch: options.forceDispatch,
  });

  const shouldDispatch = didFindView && (didSwitchView || options.forceDispatch);
  if (shouldDispatch) {
    const previousView = views.find(view => view.id === currentActiveViewId);
    const previousSessionId = previousView
      ? await getLinkedSessionIdForDashboardViewAsync(
          previousView.id,
          effectiveWorkspaceId,
          previousView.settings,
        )
      : null;
    await endPreviousDashboardViewSessionAsync(viewId, currentActiveViewId, previousSessionId);
  }
  if (shouldDispatch) {
    await setActiveViewIdForWorkspace(effectiveWorkspaceId, viewId);
  }
  if (shouldDispatch && typeof window !== 'undefined') {
    dashboardAutoRunStorageDebug('dispatch manual view switch', {
      viewId,
      effectiveWorkspaceId,
      trigger: options.trigger,
      didSwitchView,
      forceDispatch: options.forceDispatch,
    });
    window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, { detail: { viewId, trigger: options.trigger } }));
  } else {
    dashboardAutoRunStorageDebug('no manual dispatch', {
      viewId,
      effectiveWorkspaceId,
      didSwitchView,
    });
  }
  return loadWidgetDashboardStateForCurrentWindowAsync(effectiveWorkspaceId, {
    activeViewOnly: true,
    viewId: didFindView ? viewId : undefined,
  });
};

export const loadWidgetDashboardStateForCurrentWindowAsync = async (
  workspaceId?: string,
  options: { activeViewOnly?: boolean; viewId?: string } = {},
): Promise<WidgetDashboardState> => {
  const loadStartedAt = performance.now();
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  if (options.activeViewOnly) {
    widgetDashboardPerf('loadActiveView:start', { workspaceId: effectiveWorkspaceId });
    const preferredViewStartedAt = performance.now();
    const requestedViewId = typeof options.viewId === 'string' && options.viewId
      ? options.viewId
      : null;
    const sessionView = requestedViewId
      ? null
      : await getPreferredWidgetDashboardViewForCurrentWindowAsync();
    const tabViewId = requestedViewId || sessionView?.viewId
      ? null
      : await getActiveViewIdForWorkspace(effectiveWorkspaceId);
    const cachedDefaultViewId = requestedViewId || sessionView?.viewId || tabViewId
      ? null
      : getCachedDefaultViewIdForWorkspace(effectiveWorkspaceId);
    const preferredCandidate = requestedViewId
      ? { viewId: requestedViewId, source: 'tab' as const, windowId: null }
      : sessionView ||
        (tabViewId
          ? { viewId: tabViewId, source: 'tab' as const, windowId: null }
          : cachedDefaultViewId
            ? { viewId: cachedDefaultViewId, source: 'default-cache' as const, windowId: null }
            : null);
    const preferredRecord = preferredCandidate?.viewId
      ? await db.widgetViews.get(preferredCandidate.viewId)
      : null;
    const preferredView = preferredRecord?.workspaceId === effectiveWorkspaceId &&
      (preferredCandidate?.source !== 'default-cache' || preferredRecord.isDefault === true)
      ? preferredCandidate
      : null;
    if (preferredCandidate?.source === 'default-cache' && !preferredView) {
      clearCachedDefaultViewIdForWorkspace(effectiveWorkspaceId);
    }
    widgetDashboardPerf('loadActiveView:preferredViewLoaded', {
      durationMs: Math.round(performance.now() - preferredViewStartedAt),
      workspaceId: effectiveWorkspaceId,
      viewId: preferredView?.viewId,
      source: preferredView?.source,
      windowId: preferredView?.windowId,
    });

    if (preferredView?.viewId) {
      const preferredScopedStartedAt = performance.now();
      widgetDashboardPerf('loadActiveView:preferredScopedDataStarted', {
        viewId: preferredView.viewId,
        source: preferredView.source,
      });
      const dexieData = await getScopedDashboardDataForView(effectiveWorkspaceId, preferredView.viewId);
      widgetDashboardPerf('loadActiveView:scopedDataLoaded', {
        durationMs: Math.round(performance.now() - preferredScopedStartedAt),
        activeViewId: preferredView.viewId,
        widgetCount: dexieData.widgets.length,
        layoutCount: dexieData.layouts.length,
        overlapped: false,
      });
      widgetDashboardPerf('loadActiveView:viewValidated', {
        activeViewId: preferredView.viewId,
        source: preferredView.source,
        workspaceId: effectiveWorkspaceId,
      });

      const activeViewId = preferredView.viewId;
      widgetDashboardPerf('loadActiveView:activeViewResolved', {
        durationMs: 0,
        activeViewId,
        source: preferredView.source,
        fastPath: true,
        viewsBlocked: false,
      });
      const mapStartedAt = performance.now();
      const widgets = mapDexieWidgetsToDashboardWidgets(dexieData.widgets);
      const { rawLayout, layoutsToPersist } = mapDexieLayoutsToDashboardLayout(dexieData.layouts);
      widgetDashboardPerf('loadActiveView:mapped', {
        durationMs: Math.round(performance.now() - mapStartedAt),
        widgetCount: widgets.length,
        layoutCount: rawLayout.length,
        downgradedLayoutCount: layoutsToPersist.length,
        fastPath: true,
      });

      if (dexieData.widgets.length > 0) {
        const runReferenceCheck = () => {
          const referenceCheckStartedAt = performance.now();
          void filterWidgetsWithExistingReferences(dexieData.widgets)
            .then(checkedDexieWidgets => {
              widgetDashboardPerf('loadActiveView:referencesCheckedBackground', {
                durationMs: Math.round(performance.now() - referenceCheckStartedAt),
                beforeCount: dexieData.widgets.length,
                afterCount: checkedDexieWidgets.length,
              });
            })
            .catch(error => {
              widgetDashboardPerf('loadActiveView:referencesCheckedBackground:error', {
                message: error instanceof Error ? error.message : String(error),
              });
            });
        };
        widgetDashboardPerf('loadActiveView:referencesCheckDeferred', {
          beforeCount: dexieData.widgets.length,
        });
        if (typeof window !== 'undefined') {
          window.setTimeout(runReferenceCheck, 0);
        } else {
          runReferenceCheck();
        }
      }

      if (layoutsToPersist.length > 0) {
        void db.widgetLayouts.bulkPut(layoutsToPersist).catch(err =>
          console.error('[Dexie] Failed to persist downgraded layouts:', err),
        );
      }

      const result: WidgetDashboardState = {
        schemaVersion: 2,
        revision: 1,
        activeViewId,
        views: [createFastActiveDashboardView(activeViewId, preferredRecord || undefined)],
        widgets,
        layout: ensureLayoutForWidgets(widgets, rawLayout),
        updatedAt: Date.now(),
      };
      widgetDashboardPerf('loadActiveView:done', {
        durationMs: Math.round(performance.now() - loadStartedAt),
        activeViewId,
        viewCount: result.views.length,
        widgetCount: result.widgets.length,
        layoutCount: result.layout.length,
        fastPath: true,
        viewsBlocked: false,
        referencesBlocked: false,
        viewValidationBlocked: false,
      });
      return result;
    }

    const viewsStartedAt = performance.now();
    let views = await db.widgetViews.where('workspaceId').equals(effectiveWorkspaceId).toArray();
    widgetDashboardPerf('loadActiveView:viewsLoaded', {
      durationMs: Math.round(performance.now() - viewsStartedAt),
      viewCount: views.length,
      fastPath: false,
    });
    if (views.length === 0) {
      widgetDashboardPerf('loadActiveView:fallbackToFullLoad', {
        reason: 'no-widget-views',
      });
      const state = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
      const activeViewId = state.views.find(view => view.isDefault)?.id || state.views[0]?.id || state.activeViewId;
      return {
        ...state,
        activeViewId,
      };
    }

    const dashboardViews = mapDexieViewsToDashboardViews(views);
    let activeViewId: string;
    const defaultDashboardView = dashboardViews.find(view => view.isDefault);
    const fallbackActiveViewId =
      defaultDashboardView?.id ||
      dashboardViews[0]?.id ||
      'default';
    if (defaultDashboardView?.id) {
      setCachedDefaultViewIdForWorkspace(effectiveWorkspaceId, defaultDashboardView.id);
    }
    const resolveStartedAt = performance.now();
    activeViewId = fallbackActiveViewId;
    widgetDashboardPerf('loadActiveView:activeViewResolved', {
      durationMs: Math.round(performance.now() - resolveStartedAt),
      activeViewId,
      fallbackActiveViewId,
      fastPath: false,
    });
    const scopedQueryStartedAt = performance.now();
    const dexieData = await getScopedDashboardDataForView(effectiveWorkspaceId, activeViewId);
    widgetDashboardPerf('loadActiveView:scopedDataLoaded', {
      durationMs: Math.round(performance.now() - scopedQueryStartedAt),
      activeViewId,
      widgetCount: dexieData.widgets.length,
      layoutCount: dexieData.layouts.length,
      overlapped: false,
    });
    const referenceCheckStartedAt = performance.now();
    const checkedDexieWidgets = await filterWidgetsWithExistingReferences(dexieData.widgets);
    widgetDashboardPerf('loadActiveView:referencesChecked', {
      durationMs: Math.round(performance.now() - referenceCheckStartedAt),
      beforeCount: dexieData.widgets.length,
      afterCount: checkedDexieWidgets.length,
      overlapped: false,
    });
    const mapStartedAt = performance.now();
    const widgets = mapDexieWidgetsToDashboardWidgets(checkedDexieWidgets);
    const { rawLayout, layoutsToPersist } = mapDexieLayoutsToDashboardLayout(dexieData.layouts);
    widgetDashboardPerf('loadActiveView:mapped', {
      durationMs: Math.round(performance.now() - mapStartedAt),
      widgetCount: widgets.length,
      layoutCount: rawLayout.length,
      downgradedLayoutCount: layoutsToPersist.length,
    });

    if (layoutsToPersist.length > 0) {
      void db.widgetLayouts.bulkPut(layoutsToPersist).catch(err =>
        console.error('[Dexie] Failed to persist downgraded layouts:', err),
      );
    }

    const result: WidgetDashboardState = {
      schemaVersion: 2,
      revision: 1,
      activeViewId,
      views: dashboardViews,
      widgets,
      layout: ensureLayoutForWidgets(widgets, rawLayout),
      updatedAt: Date.now(),
    };
    widgetDashboardPerf('loadActiveView:done', {
      durationMs: Math.round(performance.now() - loadStartedAt),
      activeViewId,
      viewCount: result.views.length,
      widgetCount: result.widgets.length,
      layoutCount: result.layout.length,
    });
    return result;
  }

  const state = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
  const activeViewId = await resolveWidgetDashboardViewForCurrentWindowAsync(
    state.views,
    state.activeViewId,
  );

  return {
    ...state,
    activeViewId,
  };
};

export const getWidgetCountForDashboardViewAsync = async (
  viewId: string,
  workspaceId?: string,
): Promise<number> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  return db.widgets.where('[workspaceId+viewId]').equals([effectiveWorkspaceId, viewId]).count();
};

export const deleteWidgetDashboardViewAsync = async (viewId: string, workspaceId?: string): Promise<WidgetDashboardState> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const deletedHtmlContentIds = new Set<string>();

  try {
    await db.transaction('rw', [db.widgetViews, db.widgets, db.widgetLayouts], async () => {
      await db.widgets.where('viewId').equals(viewId).delete();
      await db.widgetLayouts.where('viewId').equals(viewId).delete();
      await db.widgetViews.delete(viewId);
    });
  } catch (err) {
    console.error('[Dexie] Failed to cleanup view records from IndexedDB:', err);
  }

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
      void db.widgetViews.update(promotedViewId, { isDefault: true, updatedAt: now }).catch(() => {});
      setCachedDefaultViewIdForWorkspace(effectiveWorkspaceId, promotedViewId);
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
  }, effectiveWorkspaceId);

  await Promise.all(
    Array.from(deletedHtmlContentIds).map(contentId =>
      deleteHtmlWidgetContentIfUnreferencedAsync(contentId, nextState.widgets),
    ),
  );

  if (nextState.activeViewId) {
    await setActiveViewIdForWorkspace(effectiveWorkspaceId, nextState.activeViewId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, { detail: { viewId: nextState.activeViewId } }));
    }
  }

  return nextState;
};

export const isSingleInstanceWidgetType = (type: unknown): boolean => {
  const norm = normalizeWidgetType(type);
  return norm === 'session-item';
};

export const addWidgetInstanceAsync = async (
  widgetInput: Pick<WidgetInstance, 'title' | 'type' | 'sizePreset'> &
    Partial<Pick<WidgetInstance, 'categoryId' | 'noteId' | 'noteTitle' | 'noteBody' | 'sessionId' | 'sessionTitle' | 'linkId' | 'settings'>>,
  layoutInput?: Omit<WidgetGridPosition, 'i' | 'viewId'>,
  requestedViewId?: string,
  workspaceId?: string,
): Promise<{ state: WidgetDashboardState; widgetId: string }> =>
  runWithDashboardLock(async () => {
    const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
    const now = Date.now();
    const activeViewId = requestedViewId && currentState.views.some(view => view.id === requestedViewId)
      ? requestedViewId
      : currentState.activeViewId;
    const normalizedType = normalizeWidgetType(widgetInput.type);

    if (isSingleInstanceWidgetType(normalizedType)) {
      const existingWidget = currentState.widgets.find(
        w => w.viewId === activeViewId && normalizeWidgetType(w.type) === normalizedType,
      );
      if (existingWidget) {
        if (normalizedType === 'session-item' && widgetInput.sessionId) {
          const sessionTitle = widgetInput.sessionTitle || widgetInput.title || existingWidget.title;
          const incomingSettings = toSettings(widgetInput.settings);
          await db.widgets.update(existingWidget.id, {
            title: sessionTitle,
            referenceId: widgetInput.sessionId,
            referenceType: 'session',
            settings: Object.keys(incomingSettings).length > 0 ? incomingSettings : toSettings(existingWidget.settings),
            updatedAt: now,
          });
          const existingView = currentState.views.find(view => view.id === activeViewId);
          await db.widgetViews.update(activeViewId, {
            settings: withFixedSessionStripSessionSetting(existingView?.settings, widgetInput.sessionId),
            updatedAt: now,
          });
          const nextState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
          dispatchWidgetDashboardChange();
          return { state: nextState, widgetId: existingWidget.id };
        }
        return { state: currentState, widgetId: existingWidget.id };
      }
    }

    const instanceId = generateEntityId('widget');
    const catalogDefaultPreset = WIDGET_CATALOG_CATEGORIES
      .flatMap(category => category.items)
      .find(item => normalizeWidgetType(item.type) === normalizedType)?.sizePreset;
    const sizePreset = isWidgetSizePresetAllowed(normalizedType, widgetInput.sizePreset)
      ? widgetInput.sizePreset
      : catalogDefaultPreset && isWidgetSizePresetAllowed(normalizedType, catalogDefaultPreset)
        ? catalogDefaultPreset
        : getAllowedWidgetSizePresets(normalizedType)[0];
    const newWidget: WidgetInstance = {
      id: instanceId,
      viewId: activeViewId,
      categoryId: widgetInput.categoryId || getWidgetCategoryId(widgetInput.type),
      title: widgetInput.title,
      type: normalizedType,
      noteId: widgetInput.noteId,
      noteTitle: widgetInput.noteTitle,
      noteBody: widgetInput.noteBody,
      sessionId: widgetInput.sessionId,
      sessionTitle: widgetInput.sessionTitle,
      linkId: widgetInput.linkId,

      settings: toSettings(widgetInput.settings),
      sizePreset,
      expansionMode: 'preset',
      createdAt: now,
      updatedAt: now,
    };
    const activeLayout = currentState.layout.filter(position => position.viewId === activeViewId);
    const requestedPosition: WidgetGridPosition = {
      i: instanceId,
      viewId: activeViewId,
      categoryId: newWidget.categoryId,
      ...(layoutInput || {
        x: 0,
        y: Number.MAX_SAFE_INTEGER,
        ...WIDGET_CONSTRAINTS,
      }),
      ...WIDGET_SIZE_PRESETS[newWidget.sizePreset],
    };
    const nextPosition = findNextAvailableWidgetPosition(requestedPosition, activeLayout);

    let referenceId: string | undefined = undefined;
    let referenceType: string | undefined = undefined;
    if (widgetInput.sessionId) {
      referenceId = widgetInput.sessionId;
      referenceType = 'session';
    } else if (widgetInput.noteId) {
      referenceId = widgetInput.noteId;
      referenceType = 'note';
    } else if (widgetInput.linkId) {
      referenceId = widgetInput.linkId;
      referenceType = 'link';
    }

    await createWidgetInWorkspace(
      effectiveWorkspaceId,
      activeViewId,
      {
        id: instanceId,
        title: newWidget.title,
        type: newWidget.type,
        referenceId,
        referenceType,
        sizePreset: newWidget.sizePreset,
        expansionMode: newWidget.expansionMode,
        settings: newWidget.settings,
      },
      nextPosition,
    );

    if (normalizedType === 'session-item' && referenceId) {
      const existingView = currentState.views.find(view => view.id === activeViewId);
      await db.widgetViews.update(activeViewId, {
        settings: withFixedSessionStripSessionSetting(existingView?.settings, referenceId),
        updatedAt: now,
      });
    }

    const nextState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
    dispatchWidgetDashboardChange();

    return { state: nextState, widgetId: instanceId };
  });

export const commitWidgetDashboardLayoutAsync = async (
  viewId: string,
  layout: WidgetGridPosition[],
  workspaceId?: string,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const targetWorkspaceId = workspaceId || 'default';
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId)) return state;
    const widgetById = new Map(state.widgets.filter(widget => widget.viewId === viewId).map(widget => [widget.id, widget]));
    const normalizedLayout = normalizeWidgetLayout(layout)
      .filter(position => widgetById.has(position.i))
      .map(position => ({
        ...position,
        viewId,
        categoryId: position.categoryId || widgetById.get(position.i)?.categoryId,
      }));

    const dexieRecords = normalizedLayout.map(pos => ({
      id: pos.i,
      workspaceId: targetWorkspaceId,
      viewId,
      widgetId: pos.i,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: pos.minW,
      maxW: pos.maxW,
      minH: pos.minH,
      maxH: pos.maxH,
      isDraggable: pos.isDraggable,
      isResizable: pos.isResizable,
      static: pos.static,
      updatedAt: Date.now(),
    }));
    void saveWorkspaceWidgetLayouts(targetWorkspaceId, viewId, dexieRecords).catch(err =>
      console.error('[Dexie] Failed to commit layout to IndexedDB:', err),
    );

    return {
      ...state,
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...normalizedLayout,
      ],
      updatedAt: Date.now(),
    };
  }, workspaceId);

export const commitWidgetDashboardResizeAsync = async (
  viewId: string,
  layout: WidgetGridPosition[],
  widgetId: string | undefined,
  workspaceId?: string,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(async state => {
    const targetWorkspaceId = workspaceId || 'default';
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId)) return state;
    const widgetById = new Map(state.widgets.filter(widget => widget.viewId === viewId).map(widget => [widget.id, widget]));
    const normalizedLayout = normalizeWidgetLayout(layout, widgetId)
      .filter(position => widgetById.has(position.i))
      .map(position => ({
        ...position,
        viewId,
        categoryId: position.categoryId || widgetById.get(position.i)?.categoryId,
      }));

    const dexieRecords = normalizedLayout.map(pos => ({
      id: pos.i,
      workspaceId: targetWorkspaceId,
      viewId,
      widgetId: pos.i,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: pos.minW,
      maxW: pos.maxW,
      minH: pos.minH,
      maxH: pos.maxH,
      isDraggable: pos.isDraggable,
      isResizable: pos.isResizable,
      static: pos.static,
      updatedAt: Date.now(),
    }));
    await saveWorkspaceWidgetLayouts(targetWorkspaceId, viewId, dexieRecords).catch(err =>
      console.error('[Dexie] Failed to commit layout resize to IndexedDB:', err),
    );
    const resizedPos = widgetId ? normalizedLayout.find(p => p.i === widgetId) : undefined;
    const targetWidget = state.widgets.find(w => w.id === widgetId);
    let newPreset = resizedPos ? inferPresetFromWidth(resizedPos.w) : undefined;
    if (newPreset && targetWidget && !isWidgetSizePresetAllowed(targetWidget.type, newPreset)) {
      newPreset = 'medium';
    }
    const customSize = resizedPos ? snapManualWidgetSize(resizedPos.w, resizedPos.h, resizedPos.x) : undefined;
    const now = Date.now();

    if (widgetId && customSize) {
      await db.widgets.update(widgetId, {
        sizePreset: newPreset,
        expansionMode: 'free',
        customSize,
        updatedAt: now,
      }).catch(err => console.error('[Dexie] Failed to update widget customSize on resize:', err));
    }

    return {
      ...state,
      widgets: state.widgets.map(widget =>
        widget.id === widgetId && widget.viewId === viewId
          ? {
              ...widget,
              sizePreset: newPreset || widget.sizePreset,
              expansionMode: 'free' as const,
              customSize: customSize || widget.customSize,
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
  }, workspaceId);

export const deleteWidgetInstanceAsync = async (
  viewId: string,
  widgetId: string,
  workspaceId?: string,
): Promise<WidgetDashboardState> =>
  runWithDashboardLock(async () => {
    const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);

    const widget = currentState.widgets.find(w => w.id === widgetId && w.viewId === viewId);
    if (!widget) return currentState;

    let deletedHtmlContentId: string | undefined;
    if (widget.type === 'html' && typeof widget.settings?.contentId === 'string') {
      deletedHtmlContentId = widget.settings.contentId;
    }

    const targetNoteId = widget.noteId || (widget.referenceType === 'note' ? widget.referenceId : undefined);
    if (targetNoteId) {
      await deleteNote(targetNoteId).catch(err => console.error('[Dexie] Failed to delete note linked to widget:', err));
    }

    // Await IndexedDB widget & layout deletion before notifying dashboard listeners
    await deleteWidgetFromWorkspace(widgetId);

    const nextWidgets = currentState.widgets.filter(w => w.id !== widgetId);

    const targetSessionId = widget.sessionId || (widget.referenceType === 'session' ? widget.referenceId : undefined);
    if (targetSessionId) {
      const isStillReferenced = nextWidgets.some(
        w => w.sessionId === targetSessionId || (w.referenceType === 'session' && w.referenceId === targetSessionId)
      );
      const isStillFixedStripReferenced = currentState.views.some(
        view => getFixedSessionStripSessionIdFromSettings(view.settings) === targetSessionId,
      );
      if (!isStillReferenced && !isStillFixedStripReferenced) {
        try {
          const session = await db.sessions.get(targetSessionId);
          if (session && (!session.urls || session.urls.length === 0)) {
            const hasDefaultSettings = !session.sessionOpenSettings ||
              JSON.stringify(session.sessionOpenSettings) === JSON.stringify(DEFAULT_SESSION_SETTINGS);

            if (hasDefaultSettings) {
              await db.sessions.delete(targetSessionId);
            }
          }
        } catch (err) {
          console.error('[Dexie] Failed to smart delete session linked to widget:', err);
        }
      }
    }

    await deleteHtmlWidgetContentIfUnreferencedAsync(deletedHtmlContentId, nextWidgets);

    const now = Date.now();
    const nextState: WidgetDashboardState = {
      ...currentState,
      widgets: nextWidgets,
      layout: currentState.layout.filter(position => position.i !== widgetId),
      revision: currentState.revision + 1,
      updatedAt: now,
    };

    // Dispatch change event ONLY AFTER IndexedDB deletion succeeds
    dispatchWidgetDashboardChange();
    return nextState;
  });

export const updateWidgetSettingsAsync = async (
  viewId: string,
  widgetId: string,
  nextSettings: Record<string, unknown>,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const widget = state.widgets.find(w => w.id === widgetId && w.viewId === viewId);
    if (!widget) return state;

    const now = Date.now();
    const mergedSettings = { ...widget.settings, ...nextSettings };
    void db.widgets.update(widgetId, {
      settings: mergedSettings,
      updatedAt: now,
    }).catch(err => console.error('[Dexie] Failed to update widget settings in IndexedDB:', err));

    return {
      ...state,
      widgets: state.widgets.map(w =>
        w.id === widgetId && w.viewId === viewId
          ? {
              ...w,
              settings: mergedSettings,
              updatedAt: now,
            }
          : w,
      ),
      updatedAt: now,
    };
  });

/**
 * Bind a newly created session ID to a widget that was placed without a
 * referenceId (e.g. a default session-item created at view init).
 * Patches both the Dexie record and in-memory state so the link survives
 * a page reload.
 */
export const updateWidgetReferenceAsync = async (
  widgetId: string,
  sessionId: string,
): Promise<void> => {
  const now = Date.now();
  const existingWidget = await db.widgets.get(widgetId).catch(() => null);
  await db.widgets.update(widgetId, {
    referenceId: sessionId,
    referenceType: 'session',
    updatedAt: now,
  }).catch(err => console.error('[Dexie] Failed to update widget reference in IndexedDB:', err));

  if (existingWidget?.viewId) {
    const existingView = await db.widgetViews.get(existingWidget.viewId).catch(() => null);
    await db.widgetViews.update(existingWidget.viewId, {
      settings: withFixedSessionStripSessionSetting(existingView?.settings, sessionId),
      updatedAt: now,
    }).catch(err => console.error('[Dexie] Failed to update fixed strip session in IndexedDB:', err));
  }

  await mutateWidgetDashboardStateAsync(state => ({
    ...state,
    views: state.views.map(view =>
      view.id === existingWidget?.viewId
        ? {
            ...view,
            settings: withFixedSessionStripSessionSetting(view.settings, sessionId),
            updatedAt: now,
          }
        : view,
    ),
    widgets: state.widgets.map(w =>
      w.id === widgetId
        ? { ...w, sessionId, referenceId: sessionId, referenceType: 'session' as const, updatedAt: now }
        : w,
    ),
    updatedAt: now,
  }));
};

export const purgeMissingNoteWidgetsAsync = async (validNoteIds: Set<string> | string[], workspaceId?: string): Promise<WidgetDashboardState> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const validSet = validNoteIds instanceof Set ? validNoteIds : new Set(validNoteIds);
  const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
  const orphanedWidgetIds = new Set<string>();

  for (const widget of currentState.widgets) {
    if (widget.type === 'note-item') {
      const targetNoteId = widget.noteId || (typeof widget.settings?.noteId === 'string' ? widget.settings.noteId : undefined);
      if (targetNoteId && !validSet.has(targetNoteId)) {
        const dbNote = await db.notes.get(targetNoteId).catch(() => null);
        if (!dbNote) {
          orphanedWidgetIds.add(widget.id);
        }
      }
    }
  }

  if (orphanedWidgetIds.size === 0) return currentState;

  return mutateWidgetDashboardStateAsync(state => ({
    ...state,
    widgets: state.widgets.filter(widget => !orphanedWidgetIds.has(widget.id)),
    layout: state.layout.filter(position => !orphanedWidgetIds.has(position.i)),
    updatedAt: Date.now(),
  }), effectiveWorkspaceId);
};

export const purgeMissingLinkWidgetsAsync = async (validLinkIds: Set<string> | string[], workspaceId?: string): Promise<WidgetDashboardState> => {
  const effectiveWorkspaceId = await resolveWorkspaceId(workspaceId);
  const validSet = validLinkIds instanceof Set ? validLinkIds : new Set(validLinkIds);
  const currentState = await loadWidgetDashboardStateAsync(effectiveWorkspaceId);
  const orphanedWidgetIds = new Set<string>();

  for (const widget of currentState.widgets) {
    if (widget.type === 'link-item') {
      const targetLinkId = widget.linkId || (typeof widget.settings?.linkId === 'string' ? widget.settings.linkId : undefined);
      if (targetLinkId && !validSet.has(targetLinkId)) {
        const dbLink = await db.links.get(targetLinkId).catch(() => null);
        if (!dbLink) {
          orphanedWidgetIds.add(widget.id);
        }
      }
    }
  }

  if (orphanedWidgetIds.size === 0) return currentState;

  return mutateWidgetDashboardStateAsync(state => ({
    ...state,
    widgets: state.widgets.filter(widget => !orphanedWidgetIds.has(widget.id)),
    layout: state.layout.filter(position => !orphanedWidgetIds.has(position.i)),
    updatedAt: Date.now(),
  }), effectiveWorkspaceId);
};

export const applyWidgetSizePresetAsync = async (
  viewId: string,
  widgetId: string,
  preset: WidgetSizePreset,
  workspaceId?: string,
): Promise<WidgetDashboardState> => {
  const targetWorkspaceId = workspaceId || (await resolveWorkspaceId());

  return mutateWidgetDashboardStateAsync(async state => {
    const widget = state.widgets.find(currentWidget => currentWidget.id === widgetId);
    if (!widget || widget.viewId !== viewId) return state;

    if (!isWidgetSizePresetAllowed(widget.type, preset)) {
      return state;
    }

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

    const normalizedLayout = resolveWidgetLayout(resizedLayout, widgetId).map(position => ({
      ...position,
      viewId,
      categoryId: position.categoryId || state.widgets.find(currentWidget => currentWidget.id === position.i)?.categoryId,
    }));

    await db.widgets.update(widgetId, {
      sizePreset: preset,
      expansionMode: 'preset',
      updatedAt: now,
    }).catch(err => console.error('[Dexie] Failed to update widget sizePreset:', err));

    const dexieRecords = normalizedLayout.map(pos => ({
      id: pos.i,
      workspaceId: targetWorkspaceId,
      viewId,
      widgetId: pos.i,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: pos.minW,
      maxW: pos.maxW,
      minH: pos.minH,
      maxH: pos.maxH,
      isDraggable: pos.isDraggable,
      isResizable: pos.isResizable,
      static: pos.static,
      updatedAt: now,
    }));

    await saveWorkspaceWidgetLayouts(targetWorkspaceId, viewId, dexieRecords).catch(err =>
      console.error('[Dexie] Failed to commit preset layout to Dexie:', err),
    );

    return {
      ...state,
      widgets: state.widgets.map(currentWidget =>
        currentWidget.id === widgetId
          ? {
              ...currentWidget,
              sizePreset: preset,
              expansionMode: 'preset' as const,
              customSize: currentWidget.customSize,
              updatedAt: now,
            }
          : currentWidget,
      ),
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...normalizedLayout,
      ],
      updatedAt: now,
    };
  }, targetWorkspaceId);
};

export const applyWidgetCustomSizeAsync = async (
  viewId: string,
  widgetId: string,
  workspaceId?: string,
): Promise<WidgetDashboardState> => {
  const targetWorkspaceId = workspaceId || (await resolveWorkspaceId());

  return mutateWidgetDashboardStateAsync(async state => {
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId)) return state;
    const widget = state.widgets.find(w => w.id === widgetId && w.viewId === viewId);
    if (!widget) return state;

    const customSize = normalizeWidgetCustomSize(widget.customSize);
    if (!customSize) return state;

    const now = Date.now();
    const activeLayout = state.layout.filter(position => position.viewId === viewId);
    const targetPosition = activeLayout.find(position => position.i === widgetId);
    if (!targetPosition) return state;

    const newX = Math.min(targetPosition.x, Math.max(WIDGET_GRID_COLUMNS - customSize.w, 0));
    const resizedLayout = activeLayout.map(position =>
      position.i === widgetId
        ? {
            ...position,
            x: newX,
            w: customSize.w,
            h: customSize.h,
            ...WIDGET_CONSTRAINTS,
          }
        : position,
    );

    const normalizedLayout = resolveWidgetLayout(resizedLayout, widgetId).map(position => ({
      ...position,
      viewId,
      categoryId: position.categoryId || widget.categoryId,
    }));

    let newPreset = inferPresetFromWidth(customSize.w);
    if (!isWidgetSizePresetAllowed(widget.type, newPreset)) {
      newPreset = 'medium';
    }

    await db.widgets.update(widgetId, {
      sizePreset: newPreset,
      expansionMode: 'free',
      updatedAt: now,
    }).catch(err => console.error('[Dexie] Failed to update widget on apply custom size:', err));

    const dexieRecords = normalizedLayout.map(pos => ({
      id: pos.i,
      workspaceId: targetWorkspaceId,
      viewId,
      widgetId: pos.i,
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
      minW: pos.minW,
      maxW: pos.maxW,
      minH: pos.minH,
      maxH: pos.maxH,
      isDraggable: pos.isDraggable,
      isResizable: pos.isResizable,
      static: pos.static,
      updatedAt: now,
    }));

    await saveWorkspaceWidgetLayouts(targetWorkspaceId, viewId, dexieRecords).catch(err =>
      console.error('[Dexie] Failed to commit layout to Dexie:', err),
    );

    return {
      ...state,
      widgets: state.widgets.map(currentWidget =>
        currentWidget.id === widgetId && currentWidget.viewId === viewId
          ? {
              ...currentWidget,
              sizePreset: newPreset,
              expansionMode: 'free' as const,
              updatedAt: now,
            }
          : currentWidget,
      ),
      layout: [
        ...state.layout.filter(position => position.viewId !== viewId),
        ...normalizedLayout,
      ],
      updatedAt: now,
    };
  }, targetWorkspaceId);
};

export const updateWidgetTitleAsync = async (
  viewId: string,
  widgetId: string,
  title: string,
): Promise<WidgetDashboardState> =>
  mutateWidgetDashboardStateAsync(state => {
    const widget = state.widgets.find(w => w.id === widgetId);
    if (!widget || widget.viewId !== viewId) return state;

    const trimmed = title.trim();
    if (!trimmed) return state;

    const now = Date.now();
    void db.widgets.update(widgetId, {
      title: trimmed,
      updatedAt: now,
    }).catch(err => console.error('[Dexie] Failed to update widget title in IndexedDB:', err));

    return {
      ...state,
      widgets: state.widgets.map(w =>
        w.id === widgetId
          ? {
              ...w,
              title: trimmed,
              updatedAt: now,
            }
          : w,
      ),
      updatedAt: now,
    };
  });
