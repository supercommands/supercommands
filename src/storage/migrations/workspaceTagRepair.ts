import { toOrganisationId } from './organisationMigration';

export const WORKSPACE_TAG_REPAIR_KEY = 'workspace-item-tag-repair-v1';
export const WORKSPACE_TAG_EVIDENCE_KEY = 'workspace-item-tag-evidence-v1';
export const TAGGABLE_TABLES = ['notes', 'links', 'snippets', 'todos', 'chatAgents', 'aiPrompts'] as const;
type Tables = Record<string, any[]>;
export interface WorkspaceTagBinding { table: string; entityId: string; organisationId: string; templateId: string }

/** Only recorded ownership and onboarding IDs count as evidence. Names never do. */
export function captureWorkspaceTagBindings(original: Tables): WorkspaceTagBinding[] {
  const bindings = new Map<string, WorkspaceTagBinding>();
  const entityFields: Record<string, string[]> = {
    notes: ['noteId', 'noteIds'], links: ['linkId', 'linkIds'], snippets: ['snippetId', 'snippetIds'],
    todos: ['todoId', 'todoIds'], chatAgents: ['chatAgentId', 'chatAgentIds', 'agentId', 'agentIds'],
    aiPrompts: ['aiPromptId', 'aiPromptIds'],
  };
  const widgetFields: Record<string, string[]> = {
    notes: ['selectedNoteIds'], links: ['selectedCollectionIds', 'selectedLinkIds'],
    snippets: ['selectedSnippetIds'], todos: ['selectedTodoIds'],
    chatAgents: ['selectedAgentIds'], aiPrompts: ['selectedPromptIds'],
  };
  const referenceTypes: Record<string, string[]> = {
    notes: ['note'], links: ['link'], snippets: ['snippet'], todos: ['todo'],
    chatAgents: ['chatAgent', 'agent'], aiPrompts: ['aiPrompt'],
  };
  for (const view of original.widgetViews || []) {
    const templateId = view.settings?.templateId;
    const owner = view.organisationId || view.workspaceId;
    if (typeof templateId !== 'string' || !templateId || typeof owner !== 'string' || !owner) continue;
    const organisationId = toOrganisationId(owner);
    const tagIds = new Set((original.tags || []).filter(tag => tag.dashboardViewId === view.id).map(tag => tag.id));
    const widgets = (original.widgets || []).filter(widget => widget.viewId === view.id);
    for (const table of TAGGABLE_TABLES) {
      const ids = new Set<string>();
      for (const field of entityFields[table]) {
        const value = view.settings?.onboardingEntityIds?.[field];
        for (const id of Array.isArray(value) ? value : [value]) if (typeof id === 'string') ids.add(id);
      }
      for (const widget of widgets) {
        if (referenceTypes[table].includes(widget.referenceType) && typeof widget.referenceId === 'string') ids.add(widget.referenceId);
        for (const field of widgetFields[table]) {
          const selected = widget.settings?.[field];
          if (Array.isArray(selected)) for (const id of selected) if (typeof id === 'string') ids.add(id);
        }
      }
      for (const entity of original[table] || []) {
        const entityOwner = entity.organisationId || entity.workspaceId;
        if (typeof entityOwner !== 'string' || toOrganisationId(entityOwner) !== organisationId) continue;
        if (typeof entity.id !== 'string') continue;
        if (!ids.has(entity.id) && !(Array.isArray(entity.tagIds) && entity.tagIds.some((id: string) => tagIds.has(id)))) continue;
        const binding = {table, entityId: entity.id, organisationId, templateId};
        bindings.set(JSON.stringify(binding), binding);
      }
    }
  }
  return [...bindings.values()];
}

/** Add memberships only to surviving items and already-provisioned Workspaces. */
export function applyWorkspaceTagBindings(tables: Tables, bindings: WorkspaceTagBinding[]): number {
  let added = 0;
  for (const binding of bindings) {
    if (!TAGGABLE_TABLES.includes(binding.table as any)) continue;
    const provisioning = (tables.migrationMetadata || []).find(row => row.id === `workspace-provisioning:${binding.organisationId}`);
    const workspaceId = provisioning?.templateIds?.[binding.templateId];
    const workspace = (tables.workspaces || []).find(row => row.id === workspaceId && row.organisationId === binding.organisationId);
    const entity = (tables[binding.table] || []).find(row => row.id === binding.entityId && row.organisationId === binding.organisationId && !row.deletedAt);
    if (!workspace || !entity) continue;
    let tag = (tables.tags || []).find(row => row.workspaceId === workspace.id);
    if (!tag) {
      tag = {id: `tag_${workspace.id}`, name: workspace.workspaceName, workspaceId: workspace.id,
        createdAt: workspace.createdAt, updatedAt: workspace.updatedAt};
      (tables.tags ||= []).push(tag);
    }
    const tagIds = Array.isArray(entity.tagIds) ? entity.tagIds : [];
    if (!tagIds.includes(tag.id)) { entity.tagIds = [...tagIds, tag.id]; added++; }
  }
  return added;
}

/** Retained legacy IndexedDB is recovery evidence, never an import or a reset. */
async function readLegacyEvidence(name: string): Promise<WorkspaceTagBinding[]> {
  const legacy = await new Promise<IDBDatabase | null>((resolve, reject) => {
    let absent = false;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => { absent = true; request.transaction?.abort(); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => absent ? resolve(null) : reject(request.error);
    request.onblocked = () => reject(new Error('Workspace tag recovery database is blocked.'));
  });
  if (!legacy) return [];
  try {
    // A current-format database has no old view provenance to recover.
    if (!legacy.objectStoreNames.contains('widgetViews')) return [];
    const names = ['widgetViews', 'widgets', 'tags', ...TAGGABLE_TABLES].filter(name => legacy.objectStoreNames.contains(name));
    const snapshot = await new Promise<Tables>((resolve, reject) => {
      const tx = legacy.transaction(names, 'readonly');
      const rows: Tables = {};
      for (const name of names) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { rows[name] = request.result; };
      }
      tx.oncomplete = () => resolve(rows);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Workspace tag recovery read failed.'));
    });
    return captureWorkspaceTagBindings(snapshot);
  } finally { legacy.close(); }
}

/** Completion and membership writes share one transaction; concurrent opens recheck it. */
export async function repairWorkspaceItemTags(database: any, legacyName: string): Promise<void> {
  if (await database.migrationMetadata.get(WORKSPACE_TAG_REPAIR_KEY)) return;
  const evidence = await database.migrationMetadata.get(WORKSPACE_TAG_EVIDENCE_KEY);
  const recovered = legacyName !== database.name ? await readLegacyEvidence(legacyName) : [];
  const bindings: WorkspaceTagBinding[] = [...(evidence?.bindings || []), ...recovered];
  const names = [...TAGGABLE_TABLES, 'workspaces', 'tags', 'migrationMetadata'];
  await database.transaction('rw', names.map(name => database.table(name)), async () => {
    if (await database.migrationMetadata.get(WORKSPACE_TAG_REPAIR_KEY)) return;
    const tables: Tables = {};
    for (const name of names) tables[name] = await database.table(name).toArray();
    const before = new Map(TAGGABLE_TABLES.flatMap(name => tables[name].map(row => [`${name}:${row.id}`, JSON.stringify(row.tagIds)])));
    const existingTags = new Set(tables.tags.map(row => row.id));
    const added = applyWorkspaceTagBindings(tables, bindings);
    for (const name of TAGGABLE_TABLES) for (const row of tables[name]) {
      if (before.get(`${name}:${row.id}`) !== JSON.stringify(row.tagIds)) await database.table(name).update(row.id, {tagIds: row.tagIds});
    }
    for (const tag of tables.tags) if (!existingTags.has(tag.id)) await database.tags.add(tag);
    await database.migrationMetadata.put({id: WORKSPACE_TAG_REPAIR_KEY, idMap: {}, completed: true, addedMemberships: added,
      evidenceCount: bindings.length});
  });
}
