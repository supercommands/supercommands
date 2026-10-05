/** Shared, deterministic conversion for database upgrades and legacy backup imports. */
export const ORGANISATION_MIGRATION_KEY = 'workspace-to-organisation-v1';
export type OrganisationIdMap = Record<string, string>;

const FIELD_NAMES: Record<string, string> = {
  workspaceId: 'organisationId', workspace_id: 'organisation_id',
  workspaceName: 'organisationName', workspace_name: 'organisation_name',
  workspace: 'organisation', workspaces: 'organisations',
  workspace_snippets: 'organisation_snippets', workspace_agents: 'organisation_agents',
  workspace_chat_agents: 'organisation_chat_agents', workspace_automations: 'organisation_automations',
  workspace_ai_prompts: 'organisation_ai_prompts',
  lastUsedWorkspaceId: 'lastUsedOrganisationId', currentWorkspaceId: 'currentOrganisationId',
  selectedWorkspaceId: 'selectedOrganisationId', activeWorkspaceId: 'activeOrganisationId',
  last_active_workspace_id: 'last_active_organisation_id', active_workspace_id: 'active_organisation_id',
  last_used_workspace_id: 'last_used_organisation_id', has_cloud_workspaces: 'has_cloud_organisations',
  new_tab_collapsed_workspaces: 'new_tab_collapsed_organisations',
  new_tab_expanded_workspaces: 'new_tab_expanded_organisations',
  expandedWorkspaces: 'expandedOrganisations', collapsedWorkspaces: 'collapsedOrganisations',
};
const CONTENT_FIELDS = new Set(['body', 'content', 'value', 'title', 'name', 'workspaceName', 'organisationName',
  'workspace_name', 'organisation_name', 'description', 'prompt', 'url', 'href', 'text',
  'lastSavedText', 'delta', 'html', 'query', 'label', 'trigger', 'prefix']);

export function toOrganisationId(id: string): string {
  if (!id) throw new Error('Organisation migration: missing container ID.');
  if (id.startsWith('organisation_')) return id;
  return `organisation_${id.replace(/^(workspace_|ws_)/, '')}`;
}

export function createOrganisationIdMap(records: any[]): OrganisationIdMap {
  const map: OrganisationIdMap = Object.create(null);
  const targets = new Map<string, string>();
  for (const record of records) {
    const id = record?.id ?? record?.workspace_id ?? record?.organisation_id;
    if (typeof id !== 'string' || !id) throw new Error('Organisation migration: invalid container ID.');
    const target = toOrganisationId(id);
    const previous = targets.get(target);
    if (previous && previous !== id) throw new Error(`Organisation migration: ID collision at ${target}.`);
    targets.set(target, id);
    map[id] = target;
  }
  return map;
}

export function remapOrganisationReference(value: string, map: OrganisationIdMap): string {
  if (Object.prototype.hasOwnProperty.call(map, value)) return map[value];
  // Compound item IDs consist of a container ID followed by an item ID.
  for (const [oldId, newId] of Object.entries(map)) {
    if (oldId !== newId && value.startsWith(`${oldId}-`)) return newId + value.slice(oldId.length);
  }
  return value;
}

function isReferenceField(key: string): boolean {
  return /(^id$|Id$|Ids$|_id$|_ids$|^reference|^sourceId$)/.test(key)
    || /^(lastUsed|current|selected|active|last_active|last_used)/.test(key)
    || ['items', 'order', 'expandedWorkspaces', 'collapsedWorkspaces', 'expandedOrganisations',
      'collapsedOrganisations', 'new_tab_collapsed_workspaces', 'new_tab_expanded_workspaces',
      'new_tab_collapsed_organisations', 'new_tab_expanded_organisations'].includes(key);
}

function remapStorageKey(key: string, map: OrganisationIdMap): string {
  let target = FIELD_NAMES[key] || key;
  for (const [oldId, newId] of Object.entries(map)) {
    if (oldId !== newId) target = target.replaceAll(oldId, newId);
  }
  return target;
}

export function convertOrganisationValue<T>(value: T, map: OrganisationIdMap, field = ''): T {
  if (typeof value === 'string') return (isReferenceField(field) ? remapOrganisationReference(value, map) : value) as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => convertOrganisationValue(item, map, field)) as T;
  // Preserve binary assets and non-record objects.
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const newKey = remapStorageKey(key, map);
    const converted = CONTENT_FIELDS.has(key) ? item : convertOrganisationValue(item, map, key);
    if (Object.prototype.hasOwnProperty.call(output, newKey) && JSON.stringify(output[newKey]) !== JSON.stringify(converted)) {
      throw new Error(`Organisation migration: conflicting fields ${key} / ${newKey}.`);
    }
    Object.defineProperty(output, newKey, { value: converted, enumerable: true, writable: true, configurable: true });
  }
  const original = value as Record<string, unknown>;
  const reference = original.referenceId ?? original.reference_id;
  if (typeof reference === 'string' && Object.prototype.hasOwnProperty.call(map, reference)) {
    if (output.referenceType === 'workspace') output.referenceType = 'organisation';
    if (output.reference_type === 'workspace') output.reference_type = 'organisation';
  }
  return output as T;
}

export function convertOrganisationTables(tables: Record<string, any[]>): { tables: Record<string, any[]>; idMap: OrganisationIdMap } {
  const old = tables.workspaces || [];
  const current = tables.organisations || [];
  const idMap = createOrganisationIdMap([...old, ...current]);
  const converted: Record<string, any[]> = {};
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) throw new Error(`Organisation migration: invalid table ${table}.`);
    const target = table === 'workspaces' ? 'organisations' : table;
    const records = rows.map(row => {
      const record = convertOrganisationValue(row, idMap);
      if (table === 'commands' && record.scope === 'workspace') record.scope = 'organisation';
      return record;
    });
    converted[target] = [...(converted[target] || []), ...records];
  }
  for (const [table, rows] of Object.entries(converted)) {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row?.id && ids.has(row.id)) throw new Error(`Organisation migration: duplicate ID in ${table}: ${row.id}.`);
      if (row?.id) ids.add(row.id);
    }
  }
  for (const row of converted.organisations || []) {
    if (typeof row.organisationName !== 'string') throw new Error('Organisation migration: unsupported organisation record shape.');
  }
  validateOrganisationOwnership(converted);
  return { tables: converted, idMap };
}

export function validateOrganisationOwnership(tables: Record<string, any[]>): void {
  const owners = new Set((tables.organisations || []).map(row => row.id));
  for (const [table, rows] of Object.entries(tables)) {
    for (const row of rows) {
      const owner = row.organisationId ?? row.organisation_id;
      // 'default' is an existing dashboard bootstrap sentinel, not a persisted container ID.
      if (owner && owner !== 'default' && !owners.has(owner)) {
        throw new Error(`Organisation migration: unresolved owner ${owner} in ${table}.`);
      }
    }
  }
}

