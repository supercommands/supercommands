import { retireWidgetReferences, isRetiredReference } from '../../../../storage/migrations/widgetDashboardMigration';
import { db } from '../../../../storage/indexDB/dbConfig';
import { removeCollectionItemTagReferences } from '../collections/collectionTagData';
import type { Table } from 'dexie';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { normalizeSessionOpenSettings } from './sessionSettings';
import type { WorkspaceRecord, CreateWorkspaceInput, UpdateWorkspaceInput } from './workspaceTypes';
import { buildStarterWorkspaces } from '../../../../storage/migrations/workspaceProvisioning';
import { getRoleTemplates, generateLinkItems, mergePairedStarterPackLinks } from '../../../../welcomeGuide/DashboardviewTemplates';
import { deleteWorkspaceViewAppearance } from '../widgets/workspaceViewAppearance';
import type { CreateNoteInput } from '../notes/noteTypes';
import type { CreateLinkInput } from '../links/linkTypes';
import type { CreateAiPromptInput } from '../aiPrompt/aiPromptTypes';
import type { createTodo } from '../todos/todoData';

export interface WorkspaceStarterCreators {
  createNote: (input: CreateNoteInput) => Promise<{id: string}>;
  createLink: (input: CreateLinkInput) => Promise<{id: string}>;
  createAiPrompt: (input: CreateAiPromptInput) => Promise<{id: string}>;
  createTodo: typeof createTodo;
}

export class WorkspaceConflictError extends Error {
  constructor(public remoteWorkspace: WorkspaceRecord) { super('This Workspace changed elsewhere. Reopen its editor.'); this.name = 'WorkspaceConflictError'; }
}
export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRecord> {
  const organisationId = input.organisationId || (await getSmartDefaultOrganisation())?.id;
  if (!organisationId) throw new Error('An organisation is required.');
  const id = input.id || generateEntityId('workspace');
  if (!id.startsWith('workspace_')) throw new Error('A retired session/view cannot be recreated as a Workspace.');
  const workspaceName = input.workspaceName.trim();
  if (!workspaceName) throw new Error('Workspace name is required.');
  const now = Date.now();
  const record: WorkspaceRecord = {id, organisationId, workspaceName, urls: input.urls || [],
    workspaceOpenSettings: normalizeSessionOpenSettings(input.workspaceOpenSettings), createdAt: now, updatedAt: now};
  await db.transaction('rw', [db.workspaces, db.tags, db.organisations], async () => {
    if (!await db.organisations.get(organisationId)) throw new Error('The organisation no longer exists.');
    await db.workspaces.add(record);
    await db.tags.add({id: generateEntityId('tag'), name: workspaceName, workspaceId: id, createdAt: now, updatedAt: now});
  });
  return record;
}
export async function updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceRecord> {
  return db.transaction('rw', [db.workspaces, db.tags, db.favorites], async () => {
    const current = await db.workspaces.get(id);
    if (!current) throw new Error('This Workspace no longer exists.');
    if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== current.updatedAt) throw new WorkspaceConflictError(current);
    const record = {...current,
      ...(input.workspaceName !== undefined ? {workspaceName: input.workspaceName.trim()} : {}),
      ...(input.urls !== undefined ? {urls: input.urls} : {}),
      ...(input.workspaceOpenSettings !== undefined ? {workspaceOpenSettings: normalizeSessionOpenSettings(input.workspaceOpenSettings)} : {}),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1)};
    if (!record.workspaceName) throw new Error('Workspace name is required.');
    if (input.organisationId !== undefined && input.organisationId !== current.organisationId) throw new Error('Workspace organisation cannot be changed here.');
    await db.workspaces.put(record);
    await db.tags.where('workspaceId').equals(id).modify({name: record.workspaceName, updatedAt: record.updatedAt});
    await db.favorites.filter(row => isRetiredReference(row.reference_id, new Set([id]))).modify({label: record.workspaceName, updatedAt: record.updatedAt});
    return record;
  });
}
export async function deleteWorkspace(id: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const ids = new Set((await db.tags.where('workspaceId').equals(id).toArray()).map(tag => tag.id));
    const entityTables: Table<any, string>[] = [db.notes, db.links, db.snippets, db.todos, db.aiPrompts, db.chatAgents];
    for (const table of entityTables) {
      await table.toCollection().modify((record: any) => {
        if (Array.isArray(record.tagIds)) record.tagIds = record.tagIds.filter((tag: string) => !ids.has(tag));
        if (Array.isArray(record.tags)) record.tags = record.tags.filter((tag: string) => !ids.has(tag));
      });
    }
    await removeCollectionItemTagReferences([...ids]);
    await db.tags.bulkDelete([...ids]);
    const retired = new Set([id, ...ids]);
    for (const table of [db.favorites, db.userShortcuts, db.userHotkeys]) {
      const rows = await table.toArray();
      await table.bulkDelete(rows.filter((row: any) => isRetiredReference(row.reference_id ?? row.referenceId, retired)).map(row => row.id));
    }
    for (const table of entityTables) {
      await table.toCollection().modify((row: any) => Object.assign(row, retireWidgetReferences(row, retired)));
    }
    await db.notifications.where('sourceId').equals(id).modify({status: 'dismissed', dismissedAt: Date.now()});
    await db.workspaces.delete(id);
    await deleteWorkspaceViewAppearance(id);
  });
}
export async function provisionWorkspaces(organisationId: string, role = 'founder', selectedIds?: string[], starterCreators?: WorkspaceStarterCreators) {
  const starter = buildStarterWorkspaces(organisationId, Date.now(), role, selectedIds);
  return db.transaction('rw', [db.workspaces, db.tags, db.migrationMetadata, db.organisations, ...(starterCreators ? [db.notes, db.links, db.aiPrompts, db.todos] : [])], async () => {
    if (!await db.organisations.get(organisationId)) throw new Error('The organisation no longer exists.');
    const previous: any = await db.migrationMetadata.get(starter.metadata.id);
    const templateIds = {...previous?.templateIds};
    const starterEntityIds = {...previous?.starterEntityIds};
    // Existing-profile upgrades must only repair links, never manufacture samples.
    const createStarterItems = starterCreators && !await db.migrationMetadata.get('workspace-platform-v32');
    if (previous?.completed) return Object.values(templateIds) as string[];
    const definitions = mergePairedStarterPackLinks(getRoleTemplates(role as any)
      .filter(template => template.id in starter.metadata.templateIds && !templateIds[template.id]));
    for (const [template, id] of Object.entries(starter.metadata.templateIds)) {
      if (templateIds[template]) continue;
      await db.workspaces.add(starter.workspaces.find(row => row.id === id)!);
      await db.tags.add(starter.tags.find(tag => tag.workspaceId === id)!);
      templateIds[template] = id;
      if (createStarterItems) {
        const definition = definitions.find(row => row.id === template)!;
        const tagIds = [starter.tags.find(tag => tag.workspaceId === id)!.id];
        const noteIds: string[] = [], linkIds: string[] = [], aiPromptIds: string[] = [], todoIds: string[] = [];
        for (const object of definition.objects) {
          if (object.type === 'note') noteIds.push((await starterCreators.createNote({organisationId,
            title: object.title, body: object.content, tagIds})).id);
          if (object.type === 'link' && object.urls?.length) linkIds.push((await starterCreators.createLink({organisationId,
            title: object.title, urls: generateLinkItems(object.urls), tagIds})).id);
          if (object.type === 'aiPrompt') aiPromptIds.push((await starterCreators.createAiPrompt({organisationId,
            title: object.title, prompt: object.content, modelUrls: {gpt: 'https://chatgpt.com'}, enabledModelIds: ['gpt'], tagIds})).id);
        }
        if (definition.todo) {
          // Preserve the previous onboarding reminder policy: five minutes to one day ahead.
          const scheduleTime = Date.now() + 5 * 60000 + Math.floor(Math.random() * 24 * 60 * 60000);
          todoIds.push((await starterCreators.createTodo(definition.todo.title, [], 'one-time', scheduleTime,
            undefined, definition.todo.description, tagIds, '', organisationId)).id);
        }
        starterEntityIds[template] = {noteIds, linkIds, aiPromptIds, todoIds};
      }
    }
    await db.migrationMetadata.put({...starter.metadata, templateIds, starterEntityIds} as any);
    return Object.values(templateIds) as string[];
  });
}
