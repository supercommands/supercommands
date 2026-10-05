import type { Table } from 'dexie';
import type { WorkspaceRecord } from '../../allObjectFolder/src/createObject/session/workspaceTypes';
import { normalizeSessionOpenSettings } from '../../allObjectFolder/src/createObject/session/sessionSettings';

/** In-memory compatibility for reusable session/view consumers. No legacy table exists. */
export const workspaceToSession = (row: WorkspaceRecord): any => ({...row, title: row.workspaceName,
  sessionOpenSettings: row.workspaceOpenSettings, description: '', tagIds: [], shortcut: '', deletedAt: null});
export const workspaceToView = (row: WorkspaceRecord): any => ({...row, title: row.workspaceName, settings: {}, collectionLaunchSettings: {openBehavior: 'respect_session'}});
/** Cached view titles are presentation data; canonical Workspace names win after hydration. */
export function resolveWorkspaceViewTitles<T extends {id: string; title: string}>(views: T[], workspaces: WorkspaceRecord[]): T[] {
  const names = new Map(workspaces.map(row => [row.id, row.workspaceName]));
  return views.map(view => {
    const title = names.get(view.id);
    return title?.trim() && title !== view.title ? {...view, title} : view;
  });
}
export function canonicalWorkspace(row: any): WorkspaceRecord {
  if (!String(row.id || '').startsWith('workspace_')) throw new Error('Retired session/view identity.');
  return {id: row.id, organisationId: row.organisationId, workspaceName: row.title ?? row.workspaceName,
    urls: row.urls || [], workspaceOpenSettings: normalizeSessionOpenSettings(row.sessionOpenSettings ?? row.workspaceOpenSettings),
    createdAt: row.createdAt ?? Date.now(), updatedAt: row.updatedAt ?? Date.now()};
}
const patchWorkspace = (patch: any) => {
  const next: any = {};
  for (const key of ['organisationId', 'urls', 'createdAt', 'updatedAt']) if (key in patch) next[key] = patch[key];
  if ('title' in patch || 'workspaceName' in patch) next.workspaceName = patch.title ?? patch.workspaceName;
  if ('sessionOpenSettings' in patch || 'workspaceOpenSettings' in patch) next.workspaceOpenSettings = normalizeSessionOpenSettings(patch.sessionOpenSettings ?? patch.workspaceOpenSettings);
  return next;
};
export function projectWorkspaceTable<T>(table: Table<WorkspaceRecord, string>, project: (row: WorkspaceRecord) => T): Table<T, string> {
  const one = (row: any) => row === undefined ? undefined : project(row);
  const wrap = (target: any): any => new Proxy(target, {get(object, key) {
    const original = object[key];
    if (typeof original !== 'function') return original;
    if (key === 'get' || key === 'first' || key === 'last') return (...args: any[]) => original.apply(object, args).then(one);
    if (key === 'toArray' || key === 'bulkGet') return (...args: any[]) => original.apply(object, args).then((rows: any[]) => rows.map(one));
    if (key === 'add' || key === 'put') return (row: any, ...args: any[]) => original.call(object, canonicalWorkspace(row), ...args);
    if (key === 'bulkAdd' || key === 'bulkPut') return (rows: any[], ...args: any[]) => original.call(object, rows.map(canonicalWorkspace), ...args);
    if (key === 'update') return (id: string, patch: any) => original.call(object, id, patchWorkspace(patch));
    if (key === 'modify') return (patch: any) => original.call(object, typeof patch === 'function' ? (row: any) => {
      const projected = project(row); patch(projected); Object.assign(row, patchWorkspace(projected));
    } : patchWorkspace(patch));
    if (key === 'filter' || key === 'and') return (predicate: any) => wrap(original.call(object, (row: WorkspaceRecord) => predicate(project(row))));
    if (key === 'each') return (callback: any) => original.call(object, (row: WorkspaceRecord, cursor: any) => callback(project(row), cursor));
    return (...args: any[]) => {
      const result = original.apply(object, args);
      return result && (typeof result.toArray === 'function' || typeof result.equals === 'function') ? wrap(result) : result;
    };
  }});
  return wrap(table);
}
