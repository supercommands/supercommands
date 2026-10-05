import { createWorkspace, updateWorkspace, deleteWorkspace } from '../../allObjectFolder/src/createObject/session/workspaceClient';
import { saveWorkspaceViewAppearance } from '../../allObjectFolder/src/createObject/widgets/workspaceViewAppearance';
import { ensureHomeWidgetDashboard, getWidgetTargetsForOrganisation, getWidgetTarget, updateWidgetTarget } from '../../allObjectFolder/src/createObject/widgets/widgetData';
import { convertFineGridToLegacyPosition, createDefaultWidgetDashboardState, INITIAL_WIDGET_DASHBOARD_VIEW_TITLE, MAIN_DASHBOARD_SETTINGS_KEY, isMainDashboardView, getAllowedWidgetSizePresets, getAllowedWidgetColumns, inferPresetFromWidth, isWidgetSizePresetAllowed, normalizeWidgetCustomSize, snapManualWidgetSize, snapToAllowedColumn, snapToAllowedWidth, WIDGET_CONSTRAINTS, WIDGET_GRID_COLUMNS, WIDGET_SIZE_PRESETS, } from '../../allObjectFolder/src/createObject/widgets/widgetDashboardLogic';
import { compactLayoutVertically, findNextAvailableWidgetPosition, normalizeWidgetLayout, resolveWidgetLayout, } from '../../allObjectFolder/src/createObject/widgets/widgetLayoutEngine';
import { WIDGET_CATALOG_CATEGORIES } from '../../pages/AltS_search_newtab/src/components/widgets/widgetCatalog';
import { generateEntityId } from '../../shared-components/utils';
import { deleteHtmlWidgetContentIfUnreferencedAsync } from './htmlWidgetContentStorage';
import { createWidgetInOrganisation, saveOrganisationWidgetLayouts, getDashboardDataForOrganisation, createDefaultWidgetsForView, } from '../../allObjectFolder/src/createObject/widgets/widgetData';
import { normalizeCollectionLaunchSettings, type WidgetRecord, } from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { db } from '../indexDB/dbConfig';
import { deleteDashboardViewTag, ensureDashboardViewTag } from '../../allObjectFolder/src/createObject/tags';
import { StorageManager } from './storageManager';
import { getSmartDefaultOrganisation } from './lastUsedOrganisation';
import { getCurrentDashboardWindowIdAsync, getPreferredWidgetDashboardViewForCurrentWindowAsync, getLastRememberedWidgetDashboardViewForCurrentWindowAsync, getLastRememberedWidgetDashboardViewForOrganisationAsync, getFirstOrderedWidgetDashboardViewIdAsync, rememberWidgetDashboardViewForCurrentWindowAsync, clearRememberedWidgetDashboardViewForCurrentWindowAsync, resolveWidgetDashboardViewForCurrentWindowAsync, } from './widgetDashboardWindowViewStorage';
import type { WidgetCustomSize, WidgetDashboardState, WidgetDashboardView, WidgetGridPosition, WidgetInstance, WidgetSizePreset, WidgetType, } from '../../allObjectFolder/src/createObject/widgets/widgetDashboardRuntimeTypes';
export const WIDGET_DASHBOARD_STORAGE_KEY = 'widget-dashboard-layout-v2';
export const LEGACY_WIDGET_DASHBOARD_STORAGE_KEY = 'widget-dashboard-layout-v1';
export const WIDGET_DASHBOARD_STORAGE_EVENT = 'widget-dashboard-layout-change';
export const WIDGET_DASHBOARD_BROADCAST_CHANNEL = 'widget-dashboard-cross-tab-change';
const dashboardCrossTabChannel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(WIDGET_DASHBOARD_BROADCAST_CHANNEL)
    : null;
export const WIDGET_DASHBOARD_VIEW_SWITCH_EVENT = 'widget-dashboard-view-switch';
const getActiveWidgetViewStorageKey = (organisationId: string): string => `active_widget_view_${organisationId}`;
const WIDGET_DASHBOARD_LOCK_NAME = 'widget-dashboard-storage';
let widgetDashboardMutationQueue = Promise.resolve();
const ENABLE_WIDGET_DASHBOARD_STORAGE_LOGS = false;
const ENABLE_DASHBOARD_AUTO_RUN_STORAGE_LOGS = false;
const widgetDashboardPerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_WIDGET_DASHBOARD_STORAGE_LOGS)
        return;
    console.log('[NewTabPerf][WidgetDashboardStorage]', label, JSON.stringify(data || {}));
};
const dashboardAutoRunStorageDebug = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_DASHBOARD_AUTO_RUN_STORAGE_LOGS)
        return;
    console.log('[DashboardAutoRun][storage]', label, data || {});
};
const getExtensionChrome = (): any => (typeof globalThis === 'undefined' ? undefined : (globalThis as any).chrome);
const isChromeStorageAvailable = () => Boolean(getExtensionChrome()?.storage?.local);
const getStorageItemStrict = async <T = unknown>(key: string): Promise<T | null> => {
    if (!isChromeStorageAvailable())
        return null;
    const data = await getExtensionChrome().storage.local.get(key);
    return data[key] === undefined ? null : data[key];
};
const setStorageItemStrict = async (key: string, value: unknown): Promise<void> => {
    if (!isChromeStorageAvailable())
        return;
    await getExtensionChrome().storage.local.set({ [key]: value });
};
const dispatchWidgetDashboardChange = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_STORAGE_EVENT));
        dashboardCrossTabChannel?.postMessage(Date.now());
    }
};
const runWithDashboardLock = async <T>(operation: () => Promise<T>): Promise<T> => {
    const runQueued = () => {
        const queuedOperation = widgetDashboardMutationQueue.catch(() => undefined).then(operation);
        widgetDashboardMutationQueue = queuedOperation.then(() => undefined, () => undefined);
        return queuedOperation;
    };
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & {
        locks?: any;
    }).locks : undefined;
    if (!locks?.request)
        return runQueued();
    return locks.request(WIDGET_DASHBOARD_LOCK_NAME, () => runQueued());
};
const isWidgetSizePreset = (value: unknown): value is WidgetSizePreset => value === 'small' || value === 'medium' || value === 'large';
const isKnownWidgetType = (value: unknown): value is WidgetType => value === 'default-commands' ||
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
    value === 'year-progress' ||
    value === 'html' ||
    value === 'generic';
const isPlainRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const toSettings = (value: unknown): Record<string, unknown> => (isPlainRecord(value) ? value : {});
const getLinkedSessionIdForDashboardViewAsync = async (viewId: string, organisationId: string, settings: unknown): Promise<string | null> => { return await db.workspaces.get(viewId) ? viewId : null; };
const endPreviousDashboardViewSessionAsync = async (nextViewId: string, previousViewId: string, previousSessionId: string | null): Promise<void> => {
    const chromeAny = getExtensionChrome();
    if (!chromeAny?.runtime?.sendMessage)
        return;
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
const isUuidLikeEntityId = (value: unknown, entityType: string) => typeof value === 'string' &&
    new RegExp(`^${entityType}_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, 'i').test(value);
const getValidatedEntityId = (value: unknown, entityType: 'dashboardView' | 'widgetDashboard' | 'widget', idMap: Map<string, string>): string => {
    const originalId = typeof value === 'string' ? value : '';
    if (originalId && idMap.has(originalId))
        return idMap.get(originalId) as string;
    const nextId = isUuidLikeEntityId(originalId, entityType) ? originalId : generateEntityId(entityType);
    if (originalId)
        idMap.set(originalId, nextId);
    return nextId;
};
const widgetCategoryByType = new Map<WidgetType, string>();
WIDGET_CATALOG_CATEGORIES.forEach(category => {
    category.items.forEach(item => {
        widgetCategoryByType.set(item.type, category.id);
    });
});
const getWidgetCategoryId = (widgetType: WidgetType | undefined, fallback?: string): string | undefined => {
    if (fallback)
        return fallback;
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
const ensureLayoutForWidgets = (widgets: readonly WidgetInstance[], layout: readonly WidgetGridPosition[]): WidgetGridPosition[] => {
    const widgetIds = new Set(widgets.map(widget => widget.id));
    const nextLayout = layout.filter(position => widgetIds.has(position.i));
    const layoutByWidgetId = new Map(nextLayout.map(position => [position.i, position]));
    widgets.forEach(widget => {
        if (layoutByWidgetId.has(widget.id))
            return;
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
const persistRepairedViewLayoutAsync = async (organisationId: string, viewId: string, rawLayout: readonly WidgetGridPosition[], repairedLayout: readonly WidgetGridPosition[]): Promise<boolean> => {
    const previousById = new Map(rawLayout.map(position => [position.i, position]));
    const changed = repairedLayout.length !== rawLayout.length ||
        repairedLayout.some(position => {
            const previous = previousById.get(position.i);
            return (!previous ||
                ['x', 'y', 'w', 'h'].some(key => position[key as 'x' | 'y' | 'w' | 'h'] !== previous[key as 'x' | 'y' | 'w' | 'h']));
        });
    if (!changed)
        return false;
    await db.transaction('rw', [db.widgetLayouts, db.workspaceViews, db.widgetDashboards], async () => {
        const repairedIds = new Set(repairedLayout.map(position => position.i));
        const removedIds = rawLayout.filter(position => !repairedIds.has(position.i)).map(position => position.i);
        if (removedIds.length > 0)
            await db.widgetLayouts.bulkDelete(removedIds);
        await saveOrganisationWidgetLayouts(organisationId, viewId, repairedLayout.map(position => ({
            id: position.i,
            organisationId,
            viewId,
            widgetId: position.i,
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h,
            minW: position.minW,
            maxW: position.maxW,
            minH: position.minH,
            maxH: position.maxH,
            isDraggable: position.isDraggable,
            isResizable: position.isResizable,
            static: position.static,
            updatedAt: Date.now(),
        })));
    });
    return true;
};
const isCatalogOrStaticWidgetId = (id: string): boolean => /^widget-/.test(id) || WIDGET_CATALOG_CATEGORIES.some(category => category.items.some(item => item.id === id));
const inferWidgetSizePreset = (widget: Partial<WidgetInstance>, position?: Partial<WidgetGridPosition>): WidgetSizePreset => {
    if (isWidgetSizePreset(widget.sizePreset))
        return widget.sizePreset;
    const width = Number(position?.w) || 0;
    return inferPresetFromWidth(width);
};
const sanitizeLayoutPosition = (position: Partial<WidgetGridPosition>, widget: WidgetInstance): WidgetGridPosition | null => {
    if (!position.i)
        return null;
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
    const currentPos = basePosition.gridVersion === 2 ? convertFineGridToLegacyPosition(basePosition) : basePosition;
    const isFree = widget.expansionMode === 'free';
    const rawWidth = Number.isFinite(currentPos.w) && currentPos.w > 0 ? Math.round(currentPos.w) : WIDGET_CONSTRAINTS.minW;
    const rawHeight = Number.isFinite(currentPos.h) && currentPos.h > 0 ? Math.round(currentPos.h) : WIDGET_CONSTRAINTS.minH;
    let w: number;
    let h: number;
    let x: number;
    if (isFree) {
        const customSize = normalizeWidgetCustomSize(widget.customSize) ||
            snapManualWidgetSize(rawWidth, rawHeight, Number(currentPos.x) || 0);
        w = customSize.w;
        h = customSize.h;
        x = Math.min(Math.max(Number(currentPos.x) || 0, 0), WIDGET_GRID_COLUMNS - w);
    }
    else {
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
const sanitizeWidget = (widget: Partial<WidgetInstance>, position: Partial<WidgetGridPosition> | undefined, viewId: string | undefined, widgetIdMap: Map<string, string>, forceNewId = false): WidgetInstance | null => {
    if (!widget.title)
        return null;
    const originalId = typeof widget.id === 'string' ? widget.id : '';
    const type = normalizeWidgetType(widget.type);
    let sizePreset = inferWidgetSizePreset(widget, position);
    if (!isWidgetSizePresetAllowed(type, sizePreset)) {
        sizePreset = 'medium';
    }
    const expansionMode = widget.expansionMode === 'horizontal' || widget.expansionMode === 'vertical' || widget.expansionMode === 'free'
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
    id: generateEntityId('widgetDashboard'),
    title: INITIAL_WIDGET_DASHBOARD_VIEW_TITLE,
    collectionLaunchSettings: normalizeCollectionLaunchSettings(),
    settings: { [MAIN_DASHBOARD_SETTINGS_KEY]: true },
    createdAt: now,
    updatedAt: now,
});
const sanitizeView = (view: Partial<WidgetDashboardView>, viewIdMap: Map<string, string>): WidgetDashboardView | null => {
    if (!view.title)
        return null;
    const now = Date.now();
    return {
        id: getValidatedEntityId(view.id, isMainDashboardView(view) ? 'widgetDashboard' : 'dashboardView', viewIdMap),
        title: String(view.title).trim() || INITIAL_WIDGET_DASHBOARD_VIEW_TITLE,
        collectionLaunchSettings: normalizeCollectionLaunchSettings(view.collectionLaunchSettings),
        settings: toSettings(view.settings),
        createdAt: Number(view.createdAt) || now,
        updatedAt: Number(view.updatedAt) || now,
    };
};
const normalizeViews = (views: WidgetDashboardView[], now = Date.now()): WidgetDashboardView[] => views.length > 0 ? views : [createDefaultView(now)];
const migrateV1DashboardState = (candidate: any): WidgetDashboardState => {
    const now = Date.now();
    const initialView = createDefaultView(now);
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
        const sanitized = sanitizeWidget(widget, originalId ? rawLayoutByWidgetId.get(originalId) : undefined, initialView.id, widgetIdMap, forceNewId);
        if (sanitized && originalId)
            widgetIdMap.set(originalId, sanitized.id);
        return sanitized;
    })
        .filter((widget: WidgetInstance | null): widget is WidgetInstance => Boolean(widget))
        .filter((widget: WidgetInstance) => !isLegacyDummyWidget(widget))
        .filter((widget: WidgetInstance) => widget.type !== 'default-commands')
        .filter((widget: WidgetInstance) => {
        if (seenWidgetIds.has(widget.id))
            return false;
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
        activeViewId: initialView.id,
        views: [initialView],
        widgets,
        layout: ensureLayoutForWidgets(widgets, layout),
        updatedAt: Number(candidate.updatedAt) || now,
    };
};
const migrateLegacyLinkWidgets = (widgets: WidgetInstance[], layout: WidgetGridPosition[], viewIds: Set<string>): {
    widgets: WidgetInstance[];
    layout: WidgetGridPosition[];
} => {
    const hasLegacyLinkWidgets = widgets.some(w => (w.type as any) === 'link-item');
    if (!hasLegacyLinkWidgets)
        return { widgets, layout };
    const nextWidgets = [...widgets];
    const nextLayout = [...layout];
    for (const viewId of viewIds) {
        const legacyWidgetsInView = nextWidgets.filter(w => w.viewId === viewId && (w.type as any) === 'link-item');
        if (legacyWidgetsInView.length === 0)
            continue;
        const legacyLinkIds: string[] = [];
        for (const lw of legacyWidgetsInView) {
            const lid = lw.linkId || (typeof lw.settings?.linkId === 'string' ? lw.settings.linkId : undefined);
            if (lid && !legacyLinkIds.includes(lid)) {
                legacyLinkIds.push(lid);
            }
        }
        const existingLibraryWidgetIndex = nextWidgets.findIndex(w => w.viewId === viewId && w.type === 'link-library');
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
        }
        else if (legacyWidgetsInView.length > 0) {
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
        const legacyIdsToRemove = new Set(legacyWidgetsInView
            .filter(w => existingLibraryWidgetIndex >= 0 || w.id !== legacyWidgetsInView[0].id)
            .map(w => w.id));
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
    const candidate = raw as (Omit<Partial<WidgetDashboardState>, 'schemaVersion'> & {
        schemaVersion?: number;
    }) | null;
    if (!candidate || !Array.isArray(candidate.widgets) || !Array.isArray(candidate.layout)) {
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
            if (seenViewIds.has(view.id))
                return false;
            seenViewIds.add(view.id);
            return true;
        })
        : [];
    views = normalizeViews(views);
    const mappedActiveViewId = viewIdMap.get(String(candidate.activeViewId)) || String(candidate.activeViewId || '');
    const activeViewId = views.some(view => view.id === mappedActiveViewId) ? mappedActiveViewId : views[0].id;
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
        const sanitized = sanitizeWidget({ ...widget, viewId: mappedViewId }, originalId ? rawLayoutByWidgetId.get(originalId) : undefined, undefined, widgetIdMap, forceNewId);
        if (sanitized && originalId)
            widgetIdMap.set(originalId, sanitized.id);
        return sanitized;
    })
        .filter((widget): widget is WidgetInstance => Boolean(widget))
        .filter(widget => !isLegacyDummyWidget(widget))
        .filter(widget => widget.type !== 'default-commands')
        .filter(widget => viewIds.has(widget.viewId))
        .filter(widget => {
        if (seenWidgetIds.has(widget.id))
            return false;
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
export const resolveWidgetDashboardOrganisationIdAsync = async (inputOrganisationId?: string): Promise<string> => {
    if (inputOrganisationId && inputOrganisationId !== 'default')
        return inputOrganisationId;
    const smartOrganisation = await getSmartDefaultOrganisation();
    return smartOrganisation?.id || 'default';
};
const resolveOrganisationId = resolveWidgetDashboardOrganisationIdAsync;
const getActiveViewIdForOrganisation = (organisationId: string): string | null => {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage)
            return null;
        return window.sessionStorage.getItem(getActiveWidgetViewStorageKey(organisationId));
    }
    catch {
        return null;
    }
};
const setActiveViewIdForOrganisation = (organisationId: string, viewId: string): void => {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage)
            return;
        window.sessionStorage.setItem(getActiveWidgetViewStorageKey(organisationId), viewId);
    }
    catch (e) {
        console.error('Failed to set active view id:', e);
    }
};
const getMainDashboardViewIdForOrganisationAsync = async (organisationId: string, views?: WidgetDashboardView[]): Promise<string | null> => {
    return (await ensureHomeWidgetDashboard(organisationId)).id;
};
const ensureInitialWidgetViewForOrganisation = async (organisationId: string, _dashboardData?: unknown): Promise<void> => {
    await ensureHomeWidgetDashboard(organisationId);
};
const ensureMainDashboardViewFlagForOrganisationAsync = async <T extends { id: string; settings?: any },>(organisationId: string, views: T[]): Promise<T[]> => {
    const home = await ensureHomeWidgetDashboard(organisationId);
    const homeTarget = { id: home.id, organisationId, title: home.dashboardName,
        settings: { ...home.settings, [MAIN_DASHBOARD_SETTINGS_KEY]: true }, createdAt: home.createdAt, updatedAt: home.updatedAt };
    return [homeTarget as unknown as T, ...views.filter(view => view.id !== home.id && !isMainDashboardView(view))];
};
const mapDexieViewsToDashboardViews = (views: Awaited<ReturnType<typeof getDashboardDataForOrganisation>>['views']) => views.length > 0
    ? views.map(v => ({
        id: v.id,
        title: v.title,
        collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
        settings: v.settings || {},
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
    }))
    : [
        {
            id: 'default',
            title: INITIAL_WIDGET_DASHBOARD_VIEW_TITLE,
            settings: { [MAIN_DASHBOARD_SETTINGS_KEY]: true },
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }
    ];
const createFastActiveDashboardView = (viewId: string, viewRecord?: Partial<WidgetDashboardView>): WidgetDashboardView => {
    const now = Date.now();
    return {
        id: viewId,
        title: viewRecord?.title || '',
        collectionLaunchSettings: normalizeCollectionLaunchSettings(viewRecord?.collectionLaunchSettings),
        settings: viewRecord?.settings || { __fastActiveViewPlaceholder: true },
        createdAt: Number(viewRecord?.createdAt) || now,
        updatedAt: Number(viewRecord?.updatedAt) || now,
    };
};
const filterWidgetsWithExistingReferences = async <T extends {
    referenceType?: string;
    referenceId?: string;
}>(widgets: T[]): Promise<T[]> => {
    const noteIds = Array.from(new Set(widgets
        .map(w => (w.referenceType === 'note' ? w.referenceId : (w as any).noteId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)));
    const sessionIds = Array.from(new Set(widgets
        .map(w => (w.referenceType === 'session' ? w.referenceId : (w as any).sessionId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)));
    const linkIds = Array.from(new Set(widgets
        .map(w => (w.referenceType === 'link' ? w.referenceId : (w as any).linkId))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)));
    const [noteRecords, sessionRecords, linkRecords] = await Promise.all([
        noteIds.length > 0 ? db.notes.bulkGet(noteIds).catch(() => []) : [],
        sessionIds.length > 0 ? db.workspaceSessions.bulkGet(sessionIds).catch(() => []) : [],
        linkIds.length > 0 ? db.links.bulkGet(linkIds).catch(() => []) : []
    ]);
    const existingNoteIds = new Set(noteRecords.filter(Boolean).map(record => record!.id));
    const existingSessionIds = new Set(sessionRecords.filter(Boolean).map(record => record!.id));
    const existingLinkIds = new Set(linkRecords.filter(Boolean).map(record => record!.id));
    return widgets.filter(w => {
        const targetNoteId = w.referenceType === 'note' ? w.referenceId : (w as any).noteId;
        if (targetNoteId && !existingNoteIds.has(targetNoteId))
            return false;
        const targetSessionId = w.referenceType === 'session' ? w.referenceId : (w as any).sessionId;
        if (targetSessionId && !existingSessionIds.has(targetSessionId))
            return false;
        const targetLinkId = w.referenceType === 'link' ? w.referenceId : (w as any).linkId;
        if (targetLinkId && !existingLinkIds.has(targetLinkId))
            return false;
        return true;
    });
};
const mapDexieWidgetsToDashboardWidgets = (widgets: Awaited<ReturnType<typeof getDashboardDataForOrganisation>>['widgets']): WidgetInstance[] => widgets.map(w => ({
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
const mapDexieLayoutsToDashboardLayout = (layouts: Awaited<ReturnType<typeof getDashboardDataForOrganisation>>['layouts']): {
    rawLayout: WidgetGridPosition[];
    layoutsToPersist: Awaited<ReturnType<typeof getDashboardDataForOrganisation>>['layouts'];
} => {
    const layoutsToPersist: Awaited<ReturnType<typeof getDashboardDataForOrganisation>>['layouts'] = [];
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
const getScopedDashboardDataForView = async (organisationId: string, viewId: string) => {
    const home = await db.widgetDashboards.get(viewId);
    if (!home || home.organisationId !== organisationId) return {widgets: [], layouts: []};
    const [widgets, layouts] = await Promise.all([
        db.widgets.where('[organisationId+viewId]').equals([organisationId, viewId]).toArray(),
        db.widgetLayouts.where('[organisationId+viewId]').equals([organisationId, viewId]).toArray()
    ]);
    return { widgets, layouts };
};
export const loadWidgetDashboardViewsForOrganisationAsync = async (organisationId?: string): Promise<WidgetDashboardView[]> => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const viewsStartedAt = performance.now();
    const views = await ensureMainDashboardViewFlagForOrganisationAsync(effectiveOrganisationId, await getWidgetTargetsForOrganisation(effectiveOrganisationId));
    const dashboardViews = mapDexieViewsToDashboardViews(views);
    widgetDashboardPerf('loadViewsOnly:done', {
        durationMs: Math.round(performance.now() - viewsStartedAt),
        organisationId: effectiveOrganisationId,
        viewCount: dashboardViews.length,
    });
    return dashboardViews;
};
export const loadWidgetDashboardStateAsync = async (organisationId = 'default'): Promise<WidgetDashboardState> => {
    const loadStartedAt = performance.now();
    try {
        const effectiveOrganisationId = await resolveOrganisationId(organisationId);
        widgetDashboardPerf('loadFull:start', { organisationId: effectiveOrganisationId });
        let dexieData = await getDashboardDataForOrganisation(effectiveOrganisationId);
        if (dexieData.views.length === 0) {
            await ensureInitialWidgetViewForOrganisation(effectiveOrganisationId, dexieData);
            dexieData = await getDashboardDataForOrganisation(effectiveOrganisationId);
        }
        dexieData = {
            ...dexieData,
            views: await ensureMainDashboardViewFlagForOrganisationAsync(effectiveOrganisationId, dexieData.views),
        };
        const views: WidgetDashboardView[] = dexieData.views.length > 0
            ? dexieData.views.map(v => ({
                id: v.id,
                title: v.title,
                collectionLaunchSettings: normalizeCollectionLaunchSettings(v.collectionLaunchSettings),
                settings: v.settings || {},
                createdAt: v.createdAt,
                updatedAt: v.updatedAt,
            }))
            : [
                {
                    id: 'default',
                    title: INITIAL_WIDGET_DASHBOARD_VIEW_TITLE,
                    settings: { [MAIN_DASHBOARD_SETTINGS_KEY]: true },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                }
            ];
        const noteIds = Array.from(new Set(dexieData.widgets
            .map(w => (w.referenceType === 'note' ? w.referenceId : (w as any).noteId))
            .filter((id): id is string => typeof id === 'string' && id.length > 0)));
        const sessionIds = Array.from(new Set(dexieData.widgets
            .map(w => (w.referenceType === 'session' ? w.referenceId : (w as any).sessionId))
            .filter((id): id is string => typeof id === 'string' && id.length > 0)));
        const linkIds = Array.from(new Set(dexieData.widgets
            .map(w => (w.referenceType === 'link' ? w.referenceId : (w as any).linkId))
            .filter((id): id is string => typeof id === 'string' && id.length > 0)));
        const [noteRecords, sessionRecords, linkRecords] = await Promise.all([
            noteIds.length > 0 ? db.notes.bulkGet(noteIds).catch(() => []) : [],
            sessionIds.length > 0 ? db.workspaceSessions.bulkGet(sessionIds).catch(() => []) : [],
            linkIds.length > 0 ? db.links.bulkGet(linkIds).catch(() => []) : []
        ]);
        const existingNoteIds = new Set(noteRecords.filter(Boolean).map(record => record!.id));
        const existingSessionIds = new Set(sessionRecords.filter(Boolean).map(record => record!.id));
        const existingLinkIds = new Set(linkRecords.filter(Boolean).map(record => record!.id));
        const checkedDexieWidgets = dexieData.widgets.filter(w => {
            const targetNoteId = w.referenceType === 'note' ? w.referenceId : (w as any).noteId;
            if (targetNoteId && !existingNoteIds.has(targetNoteId))
                return false;
            const targetSessionId = w.referenceType === 'session' ? w.referenceId : (w as any).sessionId;
            if (targetSessionId && !existingSessionIds.has(targetSessionId))
                return false;
            const targetLinkId = w.referenceType === 'link' ? w.referenceId : (w as any).linkId;
            if (targetLinkId && !existingLinkIds.has(targetLinkId))
                return false;
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
        const layout = ensureLayoutForWidgets(widgets, rawLayout);
        const hasLayoutChanges = layout.some((pos, idx) => {
            const orig = rawLayout[idx];
            return !orig || pos.x !== orig.x || pos.y !== orig.y || pos.w !== orig.w || pos.h !== orig.h;
        });
        if (hasLayoutChanges) {
            const migratedDexieRecords = layout.map(pos => ({
                id: pos.i,
                organisationId: effectiveOrganisationId,
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
            await db.widgetLayouts.bulkPut(migratedDexieRecords);
        }
        else if (layoutsToPersist.length > 0) {
            await db.widgetLayouts.bulkPut(layoutsToPersist);
        }
        const mainDashboardViewId = await getMainDashboardViewIdForOrganisationAsync(effectiveOrganisationId, views);
        const rememberedView = mainDashboardViewId
            ? null
            : await getLastRememberedWidgetDashboardViewForCurrentWindowAsync(effectiveOrganisationId);
        const savedActiveViewId = await getActiveViewIdForOrganisation(effectiveOrganisationId);
        const activeViewId = (mainDashboardViewId && views.some(v => v.id === mainDashboardViewId) && mainDashboardViewId) ||
            (rememberedView?.viewId && views.some(v => v.id === rememberedView.viewId) && rememberedView.viewId) ||
            (!mainDashboardViewId && savedActiveViewId && views.some(v => v.id === savedActiveViewId) && savedActiveViewId) ||
            (await getFirstOrderedWidgetDashboardViewIdAsync(views)) ||
            views[0]?.id ||
            'default';
        const result: WidgetDashboardState = {
            schemaVersion: 2,
            revision: 1,
            activeViewId,
            views,
            widgets,
            layout,
            updatedAt: Date.now(),
        };
        widgetDashboardPerf('loadFull:done', {
            durationMs: Math.round(performance.now() - loadStartedAt),
            organisationId: effectiveOrganisationId,
            activeViewId: result.activeViewId,
            viewCount: result.views.length,
            widgetCount: result.widgets.length,
            layoutCount: result.layout.length,
        });
        return result;
    }
    catch (err) {
        console.warn('[Dexie] Failed to load dashboard state from Dexie:', err);
        widgetDashboardPerf('loadFull:error', {
            durationMs: Math.round(performance.now() - loadStartedAt),
            message: err instanceof Error ? err.message : String(err),
        });
        return createDefaultWidgetDashboardState({ includeStarterWidget: false });
    }
};
export const mutateWidgetDashboardStateAsync = async (mutator: (state: WidgetDashboardState) => WidgetDashboardState | null | undefined | Promise<WidgetDashboardState | null | undefined>, organisationId?: string): Promise<WidgetDashboardState> => runWithDashboardLock(async () => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
    const mutatedState = await mutator(currentState);
    if (!mutatedState)
        return currentState;
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
    if (!trimmedTitle)
        throw new Error('View name is required.');
    const titleExists = views.some(view => view.title.trim().replace(/\s+/g, ' ').toLowerCase() === trimmedTitle.toLowerCase());
    if (titleExists)
        throw new Error('A dashboard view with this name already exists.');
    return trimmedTitle;
};
export const createWidgetDashboardViewAsync = async (title: string, organisationId = 'default', options?: {
    viewIconId?: string;
    isCustomIconSelected?: boolean;
}): Promise<{
    state: WidgetDashboardState;
    createdNoteId: string;
    createdSessionId: string;
}> => {
 const effectiveOrganisationId = await resolveOrganisationId(organisationId);
 const workspace = await createWorkspace({organisationId: effectiveOrganisationId, workspaceName: title, urls: []});
 await saveWorkspaceViewAppearance(workspace.id, options);
 const state = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
 return {state: {...state, activeViewId: workspace.id}, createdNoteId: '', createdSessionId: workspace.id};
};
export const renameWidgetDashboardViewAsync = async (viewId: string, title: string, organisationId?: string, options?: {
    viewIconId?: string;
    isCustomIconSelected?: boolean;
}): Promise<WidgetDashboardState> => {
 await updateWorkspace(viewId, {workspaceName: title});
 await saveWorkspaceViewAppearance(viewId, options);
 return loadWidgetDashboardStateAsync(organisationId);
};
export const switchWidgetDashboardViewAsync = async (viewId: string, organisationId?: string, options: {
    trigger?: 'manual-click' | 'system';
    forceDispatch?: boolean;
} = {}): Promise<WidgetDashboardState> => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const views = await ensureMainDashboardViewFlagForOrganisationAsync(effectiveOrganisationId, await getWidgetTargetsForOrganisation(effectiveOrganisationId));
    const rememberedView = await getLastRememberedWidgetDashboardViewForCurrentWindowAsync(effectiveOrganisationId);
    const savedActiveViewId = await getActiveViewIdForOrganisation(effectiveOrganisationId);
    const didFindView = views.some(view => view.id === viewId);
    const currentActiveViewId = (rememberedView?.viewId && views.some(view => view.id === rememberedView.viewId) && rememberedView.viewId) ||
        (savedActiveViewId && views.some(view => view.id === savedActiveViewId) && savedActiveViewId) ||
        (await getFirstOrderedWidgetDashboardViewIdAsync(views)) ||
        views[0]?.id ||
        'default';
    const didSwitchView = didFindView && currentActiveViewId !== viewId;
    dashboardAutoRunStorageDebug('switch view check', {
        requestedViewId: viewId,
        effectiveOrganisationId,
        currentActiveViewId,
        viewExists: didFindView,
        isSameView: currentActiveViewId === viewId,
        trigger: options.trigger,
        forceDispatch: options.forceDispatch,
    });
    const shouldDispatch = didFindView && (didSwitchView || options.forceDispatch);
    if (shouldDispatch) {
        await rememberWidgetDashboardViewForCurrentWindowAsync(effectiveOrganisationId, viewId);
        await setActiveViewIdForOrganisation(effectiveOrganisationId, viewId);
        const previousView = views.find(view => view.id === currentActiveViewId);
        const previousSessionId = previousView
            ? await getLinkedSessionIdForDashboardViewAsync(previousView.id, effectiveOrganisationId, previousView.settings)
            : null;
        try {
            await endPreviousDashboardViewSessionAsync(viewId, currentActiveViewId, previousSessionId);
        }
        catch (error) {
            console.error('[WidgetDashboardStorage] failed to stop previous dashboard view session', error);
        }
    }
    if (shouldDispatch && typeof window !== 'undefined') {
        dashboardAutoRunStorageDebug('dispatch manual view switch', {
            viewId,
            effectiveOrganisationId,
            trigger: options.trigger,
            didSwitchView,
            forceDispatch: options.forceDispatch,
        });
        window.dispatchEvent(new CustomEvent(WIDGET_DASHBOARD_VIEW_SWITCH_EVENT, { detail: { viewId, trigger: options.trigger } }));
    }
    else {
        dashboardAutoRunStorageDebug('no manual dispatch', {
            viewId,
            effectiveOrganisationId,
            didSwitchView,
        });
    }
    return loadWidgetDashboardStateForCurrentWindowAsync(effectiveOrganisationId, {
        activeViewOnly: true,
        viewId: didFindView ? viewId : undefined,
    });
};
export const loadWidgetDashboardStateForCurrentWindowAsync = async (organisationId?: string, options: {
    activeViewOnly?: boolean;
    viewId?: string;
} = {}): Promise<WidgetDashboardState> => {
    const loadStartedAt = performance.now();
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    if (options.activeViewOnly) {
        widgetDashboardPerf('loadActiveView:start', { organisationId: effectiveOrganisationId });
        const preferredViewStartedAt = performance.now();
        const requestedViewId = typeof options.viewId === 'string' && options.viewId ? options.viewId : null;
        const mainDashboardViewId = requestedViewId
            ? null
            : await getMainDashboardViewIdForOrganisationAsync(effectiveOrganisationId);
        const sessionView = requestedViewId || mainDashboardViewId ? null : await getPreferredWidgetDashboardViewForCurrentWindowAsync();
        const rememberedView = requestedViewId || mainDashboardViewId || sessionView?.viewId
            ? null
            : await getLastRememberedWidgetDashboardViewForCurrentWindowAsync(effectiveOrganisationId);
        const organisationRememberedView = requestedViewId || mainDashboardViewId || sessionView?.viewId || rememberedView?.viewId
            ? null
            : await getLastRememberedWidgetDashboardViewForOrganisationAsync(effectiveOrganisationId);
        const preferredCandidate = requestedViewId
            ? { viewId: requestedViewId, source: 'tab' as const, windowId: null }
            : mainDashboardViewId
                ? { viewId: mainDashboardViewId, source: 'main-dashboard' as const, windowId: null }
                : sessionView || rememberedView || organisationRememberedView;
        const preferredRecord = preferredCandidate?.viewId ? await getWidgetTarget(preferredCandidate.viewId) : null;
        const preferredView = preferredRecord?.organisationId === effectiveOrganisationId ? preferredCandidate : null;
        if (preferredView?.source === 'session' && preferredView.viewId) {
            await rememberWidgetDashboardViewForCurrentWindowAsync(effectiveOrganisationId, preferredView.viewId);
        }
        widgetDashboardPerf('loadActiveView:preferredViewLoaded', {
            durationMs: Math.round(performance.now() - preferredViewStartedAt),
            organisationId: effectiveOrganisationId,
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
            const dexieData = await getScopedDashboardDataForView(effectiveOrganisationId, preferredView.viewId);
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
                organisationId: effectiveOrganisationId,
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
                }
                else {
                    runReferenceCheck();
                }
            }
            const repairedLayout = ensureLayoutForWidgets(widgets, rawLayout);
            const didRepairLayout = await persistRepairedViewLayoutAsync(effectiveOrganisationId, activeViewId, rawLayout, repairedLayout);
            if (layoutsToPersist.length > 0 && !didRepairLayout) {
                await db.widgetLayouts.bulkPut(layoutsToPersist);
            }
            const result: WidgetDashboardState = {
                schemaVersion: 2,
                revision: 1,
                activeViewId,
                views: [createFastActiveDashboardView(activeViewId, preferredRecord ?? undefined)],
                widgets,
                layout: repairedLayout,
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
        let views = await getWidgetTargetsForOrganisation(effectiveOrganisationId);
        views = await ensureMainDashboardViewFlagForOrganisationAsync(effectiveOrganisationId, views);
        widgetDashboardPerf('loadActiveView:viewsLoaded', {
            durationMs: Math.round(performance.now() - viewsStartedAt),
            viewCount: views.length,
            fastPath: false,
        });
        if (views.length === 0) {
            widgetDashboardPerf('loadActiveView:fallbackToFullLoad', {
                reason: 'no-widget-views',
            });
            const state = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
            const activeViewId = state.views[0]?.id || state.activeViewId;
            return {
                ...state,
                activeViewId,
            };
        }
        const dashboardViews = mapDexieViewsToDashboardViews(views);
        let activeViewId: string;
        const fallbackMainDashboardViewId = dashboardViews.find(isMainDashboardView)?.id;
        const fallbackActiveViewId = fallbackMainDashboardViewId || dashboardViews[0]?.id || 'default';
        const resolveStartedAt = performance.now();
        activeViewId =
            fallbackMainDashboardViewId ||
                (await resolveWidgetDashboardViewForCurrentWindowAsync(dashboardViews, fallbackActiveViewId, effectiveOrganisationId));
        widgetDashboardPerf('loadActiveView:activeViewResolved', {
            durationMs: Math.round(performance.now() - resolveStartedAt),
            activeViewId,
            fallbackActiveViewId,
            fastPath: false,
        });
        const scopedQueryStartedAt = performance.now();
        const dexieData = await getScopedDashboardDataForView(effectiveOrganisationId, activeViewId);
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
        const repairedLayout = ensureLayoutForWidgets(widgets, rawLayout);
        const didRepairLayout = await persistRepairedViewLayoutAsync(effectiveOrganisationId, activeViewId, rawLayout, repairedLayout);
        if (layoutsToPersist.length > 0 && !didRepairLayout) {
            await db.widgetLayouts.bulkPut(layoutsToPersist);
        }
        const result: WidgetDashboardState = {
            schemaVersion: 2,
            revision: 1,
            activeViewId,
            views: dashboardViews,
            widgets,
            layout: repairedLayout,
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
    const state = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
    // Home is the sole widget dashboard; remembered workspaces are not startup destinations.
    const requestedViewId = options.viewId;
    const activeViewId = requestedViewId && state.views.some(view => view.id === requestedViewId)
        ? requestedViewId
        : state.views.find(isMainDashboardView)?.id || state.activeViewId;
    return {
        ...state,
        activeViewId,
    };
};
export const getWidgetCountForDashboardViewAsync = async (viewId: string, organisationId?: string): Promise<number> => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    return db.widgets.where('[organisationId+viewId]').equals([effectiveOrganisationId, viewId]).count();
};
export const deleteWidgetDashboardViewAsync = async (viewId: string, organisationId?: string): Promise<WidgetDashboardState> => {
 await deleteWorkspace(viewId);
 return loadWidgetDashboardStateAsync(organisationId);
};
export const isSingleInstanceWidgetType = (type: unknown): boolean => {
    const norm = normalizeWidgetType(type);
    return norm === 'session-item';
};
const libraryWidgetForEntityType: Record<string, {
    type: string;
    title: string;
}> = {
    note: { type: 'note-library', title: 'Notes' },
    notes: { type: 'note-library', title: 'Notes' },
    link: { type: 'link-library', title: 'Links' },
    links: { type: 'link-library', title: 'Links' },
    snippet: { type: 'snippet-library', title: 'Text Expanders' },
    snippets: { type: 'snippet-library', title: 'Text Expanders' },
    aiprompt: { type: 'ai-prompt-library', title: 'Chat Agents' },
    'ai-prompt': { type: 'ai-prompt-library', title: 'Chat Agents' },
    'ai-prompts': { type: 'ai-prompt-library', title: 'Chat Agents' },
};
const defaultLibrarySettingsForTag = (tagId: string): Record<string, unknown> => ({
    sourceMode: 'tags',
    selectedCollectionIds: [],
    selectedPromptIds: [],
    selectedSnippetIds: [],
    selectedNoteIds: [],
    selectedTagIds: [tagId],
    tagMatchMode: 'all',
    sortBy: 'saved-order',
    enableSearch: false,
});
export const ensureLibraryWidgetForDashboardTagAsync = async ({ tagId, workspaceId, entityType, }: {
    tagId: string;
    workspaceId: string;
    entityType?: string;
}): Promise<void> => {
// Workspace tags organise content; they never create widget targets.
return;
};
export const addWidgetInstanceAsync = async (widgetInput: Pick<WidgetInstance, 'title' | 'type' | 'sizePreset'> & Partial<Pick<WidgetInstance, 'categoryId' | 'noteId' | 'noteTitle' | 'noteBody' | 'sessionId' | 'sessionTitle' | 'linkId' | 'settings'>>, layoutInput?: Omit<WidgetGridPosition, 'i' | 'viewId'>, requestedViewId?: string, organisationId?: string): Promise<{
    state: WidgetDashboardState;
    widgetId: string;
}> => runWithDashboardLock(async () => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
    const now = Date.now();
    const activeViewId = requestedViewId && currentState.views.some(view => view.id === requestedViewId)
        ? requestedViewId
        : currentState.activeViewId;
    const normalizedType = normalizeWidgetType(widgetInput.type);
    if (normalizedType === 'session-item' || widgetInput.sessionId) throw new Error('Home has no saved-session attachment.');
    if (!await db.widgetDashboards.get(activeViewId)) throw new Error('Widgets belong only to Home.');
    const instanceId = generateEntityId('widget');
    const catalogDefaultPreset = WIDGET_CATALOG_CATEGORIES.flatMap(category => category.items).find(item => normalizeWidgetType(item.type) === normalizedType)?.sizePreset;
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
    const nextPosition = findNextAvailableWidgetPosition(requestedPosition, activeLayout, layoutInput !== undefined);
    let referenceId: string | undefined = undefined;
    let referenceType: string | undefined = undefined;
    if (widgetInput.sessionId) {
        referenceId = widgetInput.sessionId;
        referenceType = 'session';
    }
    else if (widgetInput.noteId) {
        referenceId = widgetInput.noteId;
        referenceType = 'note';
    }
    else if (widgetInput.linkId) {
        referenceId = widgetInput.linkId;
        referenceType = 'link';
    }
    await createWidgetInOrganisation(effectiveOrganisationId, activeViewId, {
        id: instanceId,
        title: newWidget.title,
        type: newWidget.type,
        referenceId,
        referenceType,
        sizePreset: newWidget.sizePreset,
        expansionMode: newWidget.expansionMode,
        settings: newWidget.settings,
    }, nextPosition);
    const nextState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
    dispatchWidgetDashboardChange();
    return { state: nextState, widgetId: instanceId };
});
export const commitWidgetDashboardLayoutAsync = async (viewId: string, layout: WidgetGridPosition[], organisationId?: string): Promise<WidgetDashboardState> => mutateWidgetDashboardStateAsync(async (state) => {
    const targetOrganisationId = organisationId || 'default';
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId))
        return state;
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
        organisationId: targetOrganisationId,
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
    await saveOrganisationWidgetLayouts(targetOrganisationId, viewId, dexieRecords);
    return {
        ...state,
        layout: [...state.layout.filter(position => position.viewId !== viewId), ...normalizedLayout],
        updatedAt: Date.now(),
    };
}, organisationId);
export const commitWidgetDashboardResizeAsync = async (viewId: string, layout: WidgetGridPosition[], widgetId: string | undefined, organisationId?: string): Promise<WidgetDashboardState> => mutateWidgetDashboardStateAsync(async (state) => {
    const targetOrganisationId = organisationId || 'default';
    if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId))
        return state;
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
        organisationId: targetOrganisationId,
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
    const resizedPos = widgetId ? normalizedLayout.find(p => p.i === widgetId) : undefined;
    const targetWidget = state.widgets.find(w => w.id === widgetId);
    let newPreset = resizedPos ? inferPresetFromWidth(resizedPos.w) : undefined;
    if (newPreset && targetWidget && !isWidgetSizePresetAllowed(targetWidget.type, newPreset)) {
        newPreset = 'medium';
    }
    const customSize = resizedPos ? snapManualWidgetSize(resizedPos.w, resizedPos.h, resizedPos.x) : undefined;
    const now = Date.now();
    await db.transaction('rw', [db.widgets, db.widgetLayouts, db.workspaceViews, db.widgetDashboards], async () => {
        await saveOrganisationWidgetLayouts(targetOrganisationId, viewId, dexieRecords);
        if (widgetId && customSize) {
            await db.widgets.update(widgetId, {
                sizePreset: newPreset,
                expansionMode: 'free',
                customSize,
                updatedAt: now,
            });
        }
    });
    return {
        ...state,
        widgets: state.widgets.map(widget => widget.id === widgetId && widget.viewId === viewId
            ? {
                ...widget,
                sizePreset: newPreset || widget.sizePreset,
                expansionMode: 'free' as const,
                customSize: customSize || widget.customSize,
                updatedAt: now,
            }
            : widget),
        layout: [...state.layout.filter(position => position.viewId !== viewId), ...normalizedLayout],
        updatedAt: now,
    };
}, organisationId);
export const deleteWidgetInstanceAsync = async (viewId: string, widgetId: string, organisationId?: string): Promise<WidgetDashboardState> => runWithDashboardLock(async () => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const currentState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
    const widget = currentState.widgets.find(w => w.id === widgetId && w.viewId === viewId);
    if (!widget)
        return currentState;
    const compactedViewLayout = normalizeWidgetLayout(currentState.layout.filter(position => position.viewId === viewId && position.i !== widgetId));
    const now = Date.now();
    // Removal and repacking must commit together. The linked note is user content,
    // so removing its dashboard representation never deletes the note record.
    await db.transaction('rw', [db.widgets, db.widgetLayouts, db.workspaceViews, db.widgetDashboards], async () => {
        await db.widgets.delete(widgetId);
        await db.widgetLayouts.delete(widgetId);
        await db.widgetLayouts.bulkPut(compactedViewLayout.map(position => ({
            id: position.i,
            organisationId: effectiveOrganisationId,
            viewId,
            widgetId: position.i,
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h,
            minW: position.minW,
            maxW: position.maxW,
            minH: position.minH,
            maxH: position.maxH,
            isDraggable: position.isDraggable,
            isResizable: position.isResizable,
            static: position.static,
            updatedAt: now,
        })));
    });
    const nextWidgets = currentState.widgets.filter(w => w.id !== widgetId);
    const nextState: WidgetDashboardState = {
        ...currentState,
        widgets: nextWidgets,
        layout: [...currentState.layout.filter(position => position.viewId !== viewId), ...compactedViewLayout],
        revision: currentState.revision + 1,
        updatedAt: now,
    };
    // Dispatch change event ONLY AFTER IndexedDB deletion succeeds
    dispatchWidgetDashboardChange();
    return nextState;
});
export const updateWidgetSettingsAsync = async (viewId: string, widgetId: string, nextSettings: Record<string, unknown>): Promise<WidgetDashboardState> => mutateWidgetDashboardStateAsync(async (state) => {
    const widget = state.widgets.find(w => w.id === widgetId && w.viewId === viewId);
    if (!widget)
        return state;
    const now = Date.now();
    const mergedSettings = { ...widget.settings, ...nextSettings };
    await db.widgets.update(widgetId, {
        settings: mergedSettings,
        updatedAt: now,
    });
    return {
        ...state,
        widgets: state.widgets.map(w => w.id === widgetId && w.viewId === viewId
            ? {
                ...w,
                settings: mergedSettings,
                updatedAt: now,
            }
            : w),
        updatedAt: now,
    };
});
/**
 * Bind a newly created session ID to a widget that was placed without a
 * referenceId (e.g. a default session-item created at view init).
 * Patches both the Dexie record and in-memory state so the link survives
 * a page reload.
 */
export const updateWidgetReferenceAsync = async (widgetId: string, sessionId: string): Promise<void> => runWithDashboardLock(async () => {
throw new Error('Home has no saved-session attachment.');
});
export const purgeMissingNoteWidgetsAsync = async (validNoteIds: Set<string> | string[], organisationId?: string): Promise<WidgetDashboardState> => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const validSet = validNoteIds instanceof Set ? validNoteIds : new Set(validNoteIds);
    const currentState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
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
    if (orphanedWidgetIds.size === 0)
        return currentState;
    return mutateWidgetDashboardStateAsync(state => ({
        ...state,
        widgets: state.widgets.filter(widget => !orphanedWidgetIds.has(widget.id)),
        layout: state.layout.filter(position => !orphanedWidgetIds.has(position.i)),
        updatedAt: Date.now(),
    }), effectiveOrganisationId);
};
export const purgeMissingLinkWidgetsAsync = async (validLinkIds: Set<string> | string[], organisationId?: string): Promise<WidgetDashboardState> => {
    const effectiveOrganisationId = await resolveOrganisationId(organisationId);
    const validSet = validLinkIds instanceof Set ? validLinkIds : new Set(validLinkIds);
    const currentState = await loadWidgetDashboardStateAsync(effectiveOrganisationId);
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
    if (orphanedWidgetIds.size === 0)
        return currentState;
    return mutateWidgetDashboardStateAsync(state => ({
        ...state,
        widgets: state.widgets.filter(widget => !orphanedWidgetIds.has(widget.id)),
        layout: state.layout.filter(position => !orphanedWidgetIds.has(position.i)),
        updatedAt: Date.now(),
    }), effectiveOrganisationId);
};
export const applyWidgetSizePresetAsync = async (viewId: string, widgetId: string, preset: WidgetSizePreset, organisationId?: string): Promise<WidgetDashboardState> => {
    const targetOrganisationId = organisationId || (await resolveOrganisationId());
    return mutateWidgetDashboardStateAsync(async (state) => {
        const widget = state.widgets.find(currentWidget => currentWidget.id === widgetId);
        if (!widget || widget.viewId !== viewId)
            return state;
        if (!isWidgetSizePresetAllowed(widget.type, preset)) {
            return state;
        }
        const now = Date.now();
        const activeLayout = state.layout.filter(position => position.viewId === viewId);
        const resizedLayout = activeLayout.map(position => position.i === widgetId
            ? {
                ...position,
                x: Math.min(position.x, Math.max(WIDGET_GRID_COLUMNS - WIDGET_SIZE_PRESETS[preset].w, 0)),
                w: WIDGET_SIZE_PRESETS[preset].w,
                h: WIDGET_SIZE_PRESETS[preset].h,
                ...WIDGET_CONSTRAINTS,
            }
            : position);
        const normalizedLayout = resolveWidgetLayout(resizedLayout, widgetId).map(position => ({
            ...position,
            viewId,
            categoryId: position.categoryId || state.widgets.find(currentWidget => currentWidget.id === position.i)?.categoryId,
        }));
        const dexieRecords = normalizedLayout.map(pos => ({
            id: pos.i,
            organisationId: targetOrganisationId,
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
        await db.transaction('rw', [db.widgets, db.widgetLayouts, db.workspaceViews, db.widgetDashboards], async () => {
            await db.widgets.update(widgetId, {
                sizePreset: preset,
                expansionMode: 'preset',
                updatedAt: now,
            });
            await saveOrganisationWidgetLayouts(targetOrganisationId, viewId, dexieRecords);
        });
        return {
            ...state,
            widgets: state.widgets.map(currentWidget => currentWidget.id === widgetId
                ? {
                    ...currentWidget,
                    sizePreset: preset,
                    expansionMode: 'preset' as const,
                    customSize: currentWidget.customSize,
                    updatedAt: now,
                }
                : currentWidget),
            layout: [...state.layout.filter(position => position.viewId !== viewId), ...normalizedLayout],
            updatedAt: now,
        };
    }, targetOrganisationId);
};
export const applyWidgetCustomSizeAsync = async (viewId: string, widgetId: string, organisationId?: string): Promise<WidgetDashboardState> => {
    const targetOrganisationId = organisationId || (await resolveOrganisationId());
    return mutateWidgetDashboardStateAsync(async (state) => {
        if (state.activeViewId !== viewId || !state.views.some(view => view.id === viewId))
            return state;
        const widget = state.widgets.find(w => w.id === widgetId && w.viewId === viewId);
        if (!widget)
            return state;
        const customSize = normalizeWidgetCustomSize(widget.customSize);
        if (!customSize)
            return state;
        const now = Date.now();
        const activeLayout = state.layout.filter(position => position.viewId === viewId);
        const targetPosition = activeLayout.find(position => position.i === widgetId);
        if (!targetPosition)
            return state;
        const newX = Math.min(targetPosition.x, Math.max(WIDGET_GRID_COLUMNS - customSize.w, 0));
        const resizedLayout = activeLayout.map(position => position.i === widgetId
            ? {
                ...position,
                x: newX,
                w: customSize.w,
                h: customSize.h,
                ...WIDGET_CONSTRAINTS,
            }
            : position);
        const normalizedLayout = resolveWidgetLayout(resizedLayout, widgetId).map(position => ({
            ...position,
            viewId,
            categoryId: position.categoryId || widget.categoryId,
        }));
        let newPreset = inferPresetFromWidth(customSize.w);
        if (!isWidgetSizePresetAllowed(widget.type, newPreset)) {
            newPreset = 'medium';
        }
        const dexieRecords = normalizedLayout.map(pos => ({
            id: pos.i,
            organisationId: targetOrganisationId,
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
        await db.transaction('rw', [db.widgets, db.widgetLayouts, db.workspaceViews, db.widgetDashboards], async () => {
            await db.widgets.update(widgetId, {
                sizePreset: newPreset,
                expansionMode: 'free',
                updatedAt: now,
            });
            await saveOrganisationWidgetLayouts(targetOrganisationId, viewId, dexieRecords);
        });
        return {
            ...state,
            widgets: state.widgets.map(currentWidget => currentWidget.id === widgetId && currentWidget.viewId === viewId
                ? {
                    ...currentWidget,
                    sizePreset: newPreset,
                    expansionMode: 'free' as const,
                    updatedAt: now,
                }
                : currentWidget),
            layout: [...state.layout.filter(position => position.viewId !== viewId), ...normalizedLayout],
            updatedAt: now,
        };
    }, targetOrganisationId);
};
export const updateWidgetTitleAsync = async (viewId: string, widgetId: string, title: string): Promise<WidgetDashboardState> => mutateWidgetDashboardStateAsync(state => {
    const widget = state.widgets.find(w => w.id === widgetId);
    if (!widget || widget.viewId !== viewId)
        return state;
    const trimmed = title.trim();
    if (!trimmed)
        return state;
    const now = Date.now();
    void db.widgets
        .update(widgetId, {
        title: trimmed,
        updatedAt: now,
    })
        .catch(err => console.error('[Dexie] Failed to update widget title in IndexedDB:', err));
    return {
        ...state,
        widgets: state.widgets.map(w => w.id === widgetId
            ? {
                ...w,
                title: trimmed,
                updatedAt: now,
            }
            : w),
        updatedAt: now,
    };
});
