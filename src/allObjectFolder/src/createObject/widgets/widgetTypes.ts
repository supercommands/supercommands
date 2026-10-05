/**
 * @file widgetTypes.ts
 * @description Defines TypeScript interfaces and types for Widget entities,
 * spatial grid layouts, and dashboard view records in Dexie IndexedDB.
 */
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
export type WidgetSizePreset = 'small' | 'medium' | 'large';
export type WidgetExpansionMode = 'preset' | 'horizontal' | 'vertical' | 'free';
export type CollectionOpenBehavior = 'same_window' | 'focus_mode' | 'new_window' | 'respect_session';
export interface CollectionLaunchSettings {
    openBehavior: CollectionOpenBehavior;
}
export const DEFAULT_COLLECTION_LAUNCH_SETTINGS: CollectionLaunchSettings = {
    openBehavior: 'respect_session',
};
export const normalizeCollectionLaunchSettings = (value?: Partial<CollectionLaunchSettings> | null): CollectionLaunchSettings => {
    const openBehavior = value?.openBehavior;
    return {
        openBehavior: openBehavior === 'same_window' ||
            openBehavior === 'focus_mode' ||
            openBehavior === 'new_window' ||
            openBehavior === 'respect_session'
            ? openBehavior
            : DEFAULT_COLLECTION_LAUNCH_SETTINGS.openBehavior,
    };
};
export interface WidgetCustomSize {
    w: number;
    h: number;
}
export interface WidgetRecord {
    id: string;
    organisationId: string;
    viewId: string;
    categoryId?: string;
    title: string;
    type: string;
    referenceId?: string;
    referenceType?: string;
    settings?: Record<string, unknown>;
    sizePreset: WidgetSizePreset;
    expansionMode: WidgetExpansionMode;
    customSize?: WidgetCustomSize;
    createdAt: number;
    updatedAt: number;
}
export interface WidgetLayoutRecord {
    id: string;
    organisationId: string;
    viewId: string;
    widgetId: string;
    /** Backward-compatibility field retained to read and downgrade previously stored grid-v2 records. */
    gridVersion?: number;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    isDraggable?: boolean;
    isResizable?: boolean;
    static?: boolean;
    updatedAt: number;
}
export interface WidgetViewSettings {
    isMainDashboard?: boolean;
    source?: 'onboarding' | 'manual' | string;
    role?: 'founder' | string;
    viewGroup?: 'work' | 'personal' | string;
    templateId?: string;
    templateVersion?: number;
    viewIconId?: string;
    [key: string]: unknown;
}
export interface WidgetViewRecord {
    id: string;
    organisationId: string;
    title: string;
    collectionLaunchSettings?: CollectionLaunchSettings;
    settings?: WidgetViewSettings | Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

export const HOME_DASHBOARD_NAME = 'Home';
export const MAIN_DASHBOARD_SETTINGS_KEY = 'isMainDashboard';
export const HOME_SESSION_SETTING_KEY = 'fixedSessionStripSessionId';
export const isMainDashboardView = (value: { settings?: Record<string, unknown> } | null | undefined): boolean =>
  value?.settings?.[MAIN_DASHBOARD_SETTINGS_KEY] === true;

export interface WidgetDashboardRecord {
  id: string;
  organisationId: string;
  dashboardName: string;
  kind: 'home';
  settings: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export function createHomeDashboardRecord(organisationId: string, now = Date.now(), id = generateEntityId('widgetDashboard')): WidgetDashboardRecord {
  if (!organisationId) throw new Error('Home dashboard requires an organisation.');
  return { id, organisationId, dashboardName: HOME_DASHBOARD_NAME, kind: 'home', settings: {}, createdAt: now, updatedAt: now };
}

/** Private rendering adapter. This projection is never persisted to widgetViews. */
export function dashboardToWidgetTarget(record: WidgetDashboardRecord): WidgetViewRecord {
  return { id: record.id, organisationId: record.organisationId, title: record.dashboardName,
    settings: { ...record.settings, [MAIN_DASHBOARD_SETTINGS_KEY]: true }, createdAt: record.createdAt, updatedAt: record.updatedAt };
}

export function getInternalDashboardSessionIds(dashboards: readonly WidgetDashboardRecord[]): Set<string> {
  return new Set();
}

/** Validate imported widget ownership before restore clears any local data. */
export function validateWidgetOwnership(tables: Record<string, any[]>): void {
  if (!Array.isArray(tables.widgetDashboards)) throw new Error('Backup is missing widgetDashboards.');
  const targets = new Map<string, string>();
  const scopes = new Set<string>();
  for (const dashboard of tables.widgetDashboards) {
    const scope = dashboard.organisationId + ':home';
    if (dashboard.kind !== 'home' || typeof dashboard.dashboardName !== 'string' || typeof dashboard.id !== 'string' || !dashboard.id.startsWith('widgetDashboard_') || scopes.has(scope) || targets.has(dashboard.id)) {
      throw new Error('Invalid or duplicate Home dashboard.');
    }
    scopes.add(scope);
    targets.set(dashboard.id, dashboard.organisationId);
  }
  const widgets = new Map<string, WidgetRecord>();
  for (const widget of tables.widgets || []) {
    if (widget.type === 'session-item' || ['session', 'workspace'].includes(widget.referenceType || '')) throw new Error('Home does not support saved-session widgets.');
    if (!targets.has(widget.viewId) || targets.get(widget.viewId) !== widget.organisationId || widgets.has(widget.id)) throw new Error('Invalid widget owner.');
    widgets.set(widget.id, widget);
  }
  for (const layout of tables.widgetLayouts || []) {
    const widget = widgets.get(layout.widgetId);
    if (!widget || layout.id !== widget.id || layout.viewId !== widget.viewId || layout.organisationId !== widget.organisationId) throw new Error('Invalid widget layout owner.');
  }
}
