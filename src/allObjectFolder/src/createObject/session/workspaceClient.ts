import type { CreateWorkspaceInput, UpdateWorkspaceInput, WorkspaceRecord } from './workspaceTypes';
import * as persistence from './workspaceData';

/** UI writes go through MV3 messaging; background callers use the same domain layer. */
async function request(action: string, payload: unknown): Promise<WorkspaceRecord | undefined> {
  const response = await chrome.runtime.sendMessage({action, payload});
  if (!response?.ok) {
    if (response?.remoteWorkspace) throw new persistence.WorkspaceConflictError(response.remoteWorkspace);
    throw new Error(response?.error || 'The Workspace background request failed.');
  }
  return response.workspace;
}
const isUi = () => typeof document !== 'undefined' && typeof chrome !== 'undefined' && Boolean(chrome.runtime?.sendMessage);
export const createWorkspace = (input: CreateWorkspaceInput) => isUi()
  ? request('workspace_create', input).then(row => row!) : persistence.createWorkspace(input);
export const updateWorkspace = (id: string, input: UpdateWorkspaceInput) => isUi()
  ? request('workspace_update', {id, input}).then(row => row!) : persistence.updateWorkspace(id, input);
export const deleteWorkspace = async (id: string): Promise<void> => {
  if (isUi()) await request('workspace_delete', {id}); else await persistence.deleteWorkspace(id);
};
export { WorkspaceConflictError } from './workspaceData';
