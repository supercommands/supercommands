import { db } from '../../../src/storage/indexDB/dbConfig';
import { createWorkspace, updateWorkspace, deleteWorkspace, WorkspaceConflictError } from '../../../src/allObjectFolder/src/createObject/session/workspaceData';
import { broadcastWebsitePopupEntityChanges } from '../websitePopupBridge/broadcastWebsitePopupChanges';

/** Canonical Workspace CRUD; no saved Session or dashboard-view mutations. */
export function handleWorkspaceMessage(message: any, sendResponse: (response: any) => void): boolean {
  if (!['workspace_get', 'workspace_create', 'workspace_update', 'workspace_delete'].includes(message?.action)) return false;
  void (async () => {
    try {
      await db.open();
      const payload = message.payload || {};
      let workspace;
      if (message.action === 'workspace_create') workspace = await createWorkspace(payload);
      else {
        if (typeof payload.id !== 'string' || !payload.id.startsWith('workspace_')) throw new Error('Retired Workspace identity.');
        if (message.action === 'workspace_update') workspace = await updateWorkspace(payload.id, payload.input || {});
        else if (message.action === 'workspace_delete') await deleteWorkspace(payload.id);
        else {workspace = await db.workspaces.get(payload.id); if (!workspace) throw new Error('This Workspace no longer exists.');}
      }
      sendResponse({ok: true, workspace});
      if (message.action !== 'workspace_get') void broadcastWebsitePopupEntityChanges([
        'workspaces', 'tags', 'favorites', 'userShortcuts', 'userHotkeys',
        ...(message.action === 'workspace_delete' ? ['collectionItems'] : []),
      ]).catch(() => undefined);
    } catch (error) {
      sendResponse({ok: false, error: error instanceof Error ? error.message : 'Workspace request failed.',
        ...(error instanceof WorkspaceConflictError ? {remoteWorkspace: error.remoteWorkspace} : {})});
    }
  })();
  return true;
}
