import { createHomeDashboardRecord, HOME_SESSION_SETTING_KEY } from '../../allObjectFolder/src/createObject/widgets/widgetTypes';

export const WIDGET_DASHBOARD_MIGRATION_KEY = 'home-widget-dashboard-reset-v1';
export const WIDGET_DASHBOARD_DATABASE_VERSION = 30;
export function isRetiredReference(value: unknown, retired: Set<string>): boolean {
  return typeof value === 'string' && (retired.has(value) || [...retired].some(id => value.endsWith('-' + id)));
}
const CONTENT_FIELDS = new Set(['body', 'content', 'title', 'name', 'description', 'prompt', 'text', 'html', 'delta', 'url', 'lastSavedText']);

/** Remove retired IDs only in relationship fields; authored text is preserved. */
export function retireWidgetReferences<T>(value: T, retired: Set<string>, field = ''): T {
  if (typeof value === 'string') return ((/Id$|Ids$|_id$|_ids$|^reference|^active|^selected|^items$|^order$/.test(field) && isRetiredReference(value, retired)) ? null : value) as T;
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value
    .filter(item => !(item && typeof item === 'object' && !CONTENT_FIELDS.has(field)
      && isRetiredReference(item.id ?? item.referenceId ?? item.reference_id ?? item.targetId, retired)))
    .map(item => retireWidgetReferences(item, retired, field)).filter(item => item !== null) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (isRetiredReference(key, retired)) continue;
    result[key] = CONTENT_FIELDS.has(key) ? item : retireWidgetReferences(item, retired, key);
  }
  return result as T;
}

/** Legacy input conversion only. Never apply this to current-schema user data. */
export function resetLegacyWidgetTables(tables: Record<string, any[]>) {
  const retiredIds = [...(tables.widgetViews || []), ...(tables.widgets || []), ...(tables.widgetLayouts || [])]
    .map(row => row.id).filter((id): id is string => typeof id === 'string');
  const retired = new Set(retiredIds);
  const result: Record<string, any[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) throw new Error('Invalid widget migration table: ' + name);
    if (['widgetViews', 'widgets', 'widgetLayouts', 'widgetDashboards'].includes(name)) continue;
    result[name] = rows.filter(row => !retired.has(row.referenceId ?? row.reference_id))
      .map(row => retireWidgetReferences(row, retired));
  }
  result.widgetViews = [];
  result.widgets = [];
  result.widgetLayouts = [];
  result.widgetDashboards = (tables.organisations || []).map(owner => {
    // Stable legacy conversion IDs keep repeated backup comparisons deterministic.
    const record = createHomeDashboardRecord(owner.id, Number(owner.createdAt) || 0,
      `widgetDashboard_${String(owner.id).replace(/^organisation_/, '')}`);
    const ownerViews = (tables.widgetViews || []).filter(view => view.organisationId === owner.id);
    const flagged = ownerViews.filter(view => view.settings?.isMainDashboard === true);
    const legacyHome = [...ownerViews].filter(view => view.settings?.isMainDashboard === undefined)
      .sort((a, b) => Number(a.createdAt || a.updatedAt || 0) - Number(b.createdAt || b.updatedAt || 0))[0];
    const internalIds = (flagged.length ? flagged : legacyHome ? [legacyHome] : [])
      .map(view => view.settings?.[HOME_SESSION_SETTING_KEY]).filter((id): id is string => typeof id === 'string' && Boolean(id));
    record.settings = { retiredInternalSessionIds: internalIds };
    return record;
  });
  return { tables: result, retiredIds };
}

const LEGACY_WIDGET_KEYS = new Set(['widget-dashboard-layout-v2', 'widget-dashboard-layout-v1', 'widget_dashboard_v2', 'widget_dashboard']);
export function retireWidgetSettings(settings: Record<string, unknown>, retiredIds: readonly string[]): Record<string, unknown> {
  const result = retireWidgetReferences(settings, new Set(retiredIds));
  for (const key of Object.keys(result)) {
    if (LEGACY_WIDGET_KEYS.has(key) || /widget.*startup.*snapshot/i.test(key)) delete result[key];
  }
  return result;
}

