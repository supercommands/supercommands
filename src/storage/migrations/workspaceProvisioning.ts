import { getRecommendedRoleTemplates, getRoleTemplates } from '../../welcomeGuide/DashboardviewTemplates';
import { normalizeSessionOpenSettings } from '../../allObjectFolder/src/createObject/session/sessionSettings';
import type { WorkspaceRecord } from '../../allObjectFolder/src/createObject/session/workspaceTypes';

/** Stable identities for upgrade/import previews; ordinary CRUD generates fresh IDs. */
export function buildStarterWorkspaces(organisationId: string, now: number, role = 'founder', selectedIds?: string[]) {
  const templates = selectedIds
    ? getRoleTemplates(role as any).filter(template => selectedIds.includes(template.id))
    : getRecommendedRoleTemplates(role as any, () => 0);
  const workspaces: WorkspaceRecord[] = [];
  const tags: any[] = [];
  const templateIds: Record<string, string> = {};
  for (const template of templates) {
    const id = `workspace_${organisationId.replace(/^organisation_/, '')}_${template.id}`;
    const session = template.objects.find(object => object.type === 'session');
    const resources = session && session.type === 'session' ? session.urls : [];
    workspaces.push({id, organisationId, workspaceName: template.title,
      urls: (resources || []).map((resource, index) => ({id: `link_item_${id}_${index}`, title: resource.title, name: resource.title, url: resource.url, source: 'custom' as const})),
      workspaceOpenSettings: normalizeSessionOpenSettings(), createdAt: now, updatedAt: now});
    tags.push({id: `tag_${id}`, name: template.title, workspaceId: id, createdAt: now, updatedAt: now});
    templateIds[template.id] = id;
  }
  return {workspaces, tags, metadata: {id: `workspace-provisioning:${organisationId}`, organisationId, idMap: {}, templateIds}};
}
