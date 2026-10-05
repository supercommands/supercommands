import { db } from '../../../../storage/indexDB/dbConfig';
import { createTag, deleteTag } from './tagData';
export async function ensureDashboardViewTag(workspaceId: string, title: string) {
 return db.transaction('rw', [db.workspaces, db.tags], async () => {
   const workspace = await db.workspaces.get(workspaceId);
   if (!workspace) return null;
   const existing = await db.tags.where('workspaceId').equals(workspaceId).first();
   // Keep the ID (and every membership) when startup catches a stale tag name.
   if (existing) {
     if (existing.name !== workspace.workspaceName) {
       await db.tags.update(existing.id, {name: workspace.workspaceName, updatedAt: Date.now()});
       return {...existing, name: workspace.workspaceName};
     }
     return existing;
   }
   return createTag(workspace.workspaceName, workspaceId);
 });
}
export async function deleteDashboardViewTag(workspaceId: string) {
 for (const tag of await db.tags.where('workspaceId').equals(workspaceId).toArray()) await deleteTag(tag.id);
}
export async function reconcileDashboardViewTags() {
 for (const workspace of await db.workspaces.toArray()) await ensureDashboardViewTag(workspace.id, workspace.workspaceName);
}
