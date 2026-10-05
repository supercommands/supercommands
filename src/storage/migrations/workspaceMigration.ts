import { retireWidgetReferences, isRetiredReference } from './widgetDashboardMigration';
import { buildStarterWorkspaces } from './workspaceProvisioning';
import { captureWorkspaceTagBindings, applyWorkspaceTagBindings, WORKSPACE_TAG_EVIDENCE_KEY } from './workspaceTagRepair';

/** Deliberate retirement of unused saved sessions/views, never a name-based merge. */
export function replaceLegacyWorkspaceTables(tables: Record<string, any[]>, original: Record<string, any[]> = tables) {
  const bindings = captureWorkspaceTagBindings(original);
  const retired = new Set<string>([...(original.sessions || []), ...(original.widgetViews || [])].map(row => row.id).filter(Boolean));
  const scopedTags = new Set((original.tags || []).filter(tag => tag.dashboardViewId != null).map(tag => tag.id));
  scopedTags.forEach(id => retired.add(id));
  const homes = new Set((tables.widgetDashboards || []).map(row => row.id));
  const widgets = (tables.widgets || []).filter(widget => homes.has(widget.viewId)
    && !['session', 'workspace'].includes(widget.referenceType)
    && widget.type !== 'session-item' && !widget.settings?.sessionId);
  const keptWidgets = new Set(widgets.map(row => row.id));
  for (const widget of tables.widgets || []) if (!keptWidgets.has(widget.id)) retired.add(widget.id);
  const result: Record<string, any[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    if (['sessions', 'widgetViews', 'workspaces'].includes(name)) continue;
    result[name] = rows.filter(row => ![row.referenceId, row.reference_id, row.sourceId, row.targetId].some(value => isRetiredReference(value, retired)) && !scopedTags.has(row.id))
      .map(row => retireWidgetReferences(row, retired));
  }
  result.widgets = widgets.map(row => retireWidgetReferences(row, retired));
  result.widgetLayouts = (tables.widgetLayouts || []).filter(row => keptWidgets.has(row.widgetId));
  result.widgetDashboards = (tables.widgetDashboards || []).map(row => {
    const settings = {...row.settings}; delete settings.fixedSessionStripSessionId; delete settings.retiredInternalSessionIds;
    return {...row, settings};
  });
  result.tags = (result.tags || []).map(tag => {const {dashboardViewId, ...kept} = tag; return {...kept, workspaceId: null};});
  result.workspaces = [];
  result.migrationMetadata = [...(result.migrationMetadata || [])];
  for (const organisation of result.organisations || []) {
    const starter = buildStarterWorkspaces(organisation.id, Number(organisation.createdAt) || 0);
    result.workspaces.push(...starter.workspaces); result.tags.push(...starter.tags);
    result.migrationMetadata = result.migrationMetadata.filter(row => row.id !== starter.metadata.id);
    result.migrationMetadata.push(starter.metadata);
  }
  // Capture provenance before views/widgets/scoped tags disappear. Legacy backup
  // normalization uses the same deterministic path and retains these memberships.
  result.migrationMetadata.push({id: WORKSPACE_TAG_EVIDENCE_KEY, idMap: {}, bindings});
  applyWorkspaceTagBindings(result, bindings);
  return {tables: result, retiredIds: [...retired]};
}

export function validateWorkspaceTables(tables: Record<string, any[]>): void {
  if (!Array.isArray(tables.workspaces)) throw new Error('Backup is missing Workspaces.');
  const organisations = new Set((tables.organisations || []).map(row => row.id));
  const ids = new Set<string>();
  for (const row of tables.workspaces) {
    if (!row.id?.startsWith('workspace_') || ids.has(row.id) || !organisations.has(row.organisationId)
      || typeof row.workspaceName !== 'string' || !Array.isArray(row.urls) || !row.workspaceOpenSettings) throw new Error('Invalid Workspace record.');
    if (Object.keys(row).some(key => !['id', 'organisationId', 'workspaceName', 'urls', 'workspaceOpenSettings', 'createdAt', 'updatedAt'].includes(key))) throw new Error('Workspace contains retired metadata.');
    ids.add(row.id);
  }
  for (const tag of tables.tags || []) if (tag.workspaceId != null && !ids.has(tag.workspaceId)) throw new Error('Invalid Workspace tag owner.');
}
