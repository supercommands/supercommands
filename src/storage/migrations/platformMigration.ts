import { convertOrganisationTables, convertOrganisationValue, type OrganisationIdMap } from './organisationMigration';
import { retireContainerTables, retireContainerFields } from './containerRetirement';
import { resetLegacyWidgetTables, retireWidgetSettings } from './widgetDashboardMigration';
import { replaceLegacyWorkspaceTables, validateWorkspaceTables } from './workspaceMigration';
import { validateWidgetOwnership } from '../../allObjectFolder/src/createObject/widgets/widgetTypes';

export const PLATFORM_DATABASE_VERSION = 32;
export const PLATFORM_MIGRATION_KEY = 'workspace-platform-v32';
export interface PlatformMigrationRecord {
  id: string;
  idMap: OrganisationIdMap;
  retiredIds: string[];
  settingsComplete?: boolean;
}

/** One deterministic conversion shared by the version upgrade and legacy database import. */
export function convertPlatformTables(snapshot: Record<string, any[]>, options?: {resetHome: boolean; originalSnapshot?: Record<string, any[]>; sourceVersion?: number}) {
  // Version determines the meaning of the physical workspaces store.
  if (options?.sourceVersion !== undefined && options.sourceVersion >= PLATFORM_DATABASE_VERSION) {
    validateWorkspaceTables(snapshot);
    validateWidgetOwnership(snapshot);
    if (snapshot.sessions || snapshot.widgetViews) throw new Error('Current database contains retired stores.');
    const previous = snapshot.migrationMetadata?.find(row => row.id === PLATFORM_MIGRATION_KEY);
    return {tables: snapshot, migration: previous || {id: PLATFORM_MIGRATION_KEY, idMap: {}, retiredIds: [], settingsComplete: true}};
  }
  const organisation = convertOrganisationTables(snapshot);
  const containers = retireContainerTables(organisation.tables);
  // Schema-30 Home dashboards are current data: never reset them on a later upgrade.
  const resetHome = options?.resetHome ?? !Object.prototype.hasOwnProperty.call(snapshot, 'widgetDashboards');
  const home = !resetHome
    ? {tables: containers.tables, retiredIds: [] as string[]}
    : resetLegacyWidgetTables(containers.tables);
  const workspaces = replaceLegacyWorkspaceTables(home.tables, options?.originalSnapshot || snapshot);
  validateWorkspaceTables(workspaces.tables);
  validateWidgetOwnership(workspaces.tables);
  const previous = snapshot.migrationMetadata || [];
  const idMap = Object.assign(Object.create(null), ...previous.map(row => row.idMap || {}), organisation.idMap, containers.referenceMap);
  const retiredIds = [...new Set([...previous.flatMap(row => row.retiredIds || []), ...home.retiredIds, ...workspaces.retiredIds])];
  return {tables: workspaces.tables, migration: {id: PLATFORM_MIGRATION_KEY, idMap, retiredIds} as PlatformMigrationRecord};
}

/** Preference cleanup is resumable; its only completion record lives in IndexedDB. */
export async function migratePlatformPreferences(migration: PlatformMigrationRecord): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const stored = await chrome.storage.local.get(null);
  const converted = retireWidgetSettings(convertOrganisationValue(retireContainerFields(stored), migration.idMap), migration.retiredIds);
  for (const key of Object.keys(converted)) {
    if (/active.?sessions|active_dashboard_view_session|dashboard.?sessions|pending.?session|unsaved_session_backup|last.?dashboard.?view|widget.*startup.*snapshot/i.test(key)) delete converted[key];
  }
  await chrome.storage.local.set(converted);
  const obsolete = Object.keys(stored).filter(key => !(key in converted));
  if (obsolete.length) await chrome.storage.local.remove(obsolete);
}
