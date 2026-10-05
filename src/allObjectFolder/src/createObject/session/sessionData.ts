/** Compatibility API for reusable tab-launch/editor code. Persistence is Workspace-only. */
import { db } from '../../../../storage/indexDB/dbConfig';
import { workspaceToSession } from '../../../../storage/indexDB/workspaceProjections';
import { createWorkspace, updateWorkspace, deleteWorkspace, WorkspaceConflictError } from './workspaceClient';
import type { CreateSessionInput, UpdateSessionInput, SessionRecord } from './sessionTypes';
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  return workspaceToSession(await createWorkspace({id: input.id, organisationId: input.organisationId,
    workspaceName: input.title, urls: input.urls, workspaceOpenSettings: input.sessionOpenSettings}));
}
export async function updateSession(id: string, input: UpdateSessionInput): Promise<SessionRecord> {
  try { return workspaceToSession(await updateWorkspace(id, {
    ...(input.title !== undefined ? {workspaceName: input.title} : {}),
    ...(input.urls !== undefined ? {urls: input.urls} : {}),
    ...(input.sessionOpenSettings !== undefined ? {workspaceOpenSettings: input.sessionOpenSettings} : {}),
    ...(input.organisationId !== undefined ? {organisationId: input.organisationId} : {}),
    expectedUpdatedAt: input.expectedUpdatedAt,
  })); } catch (error) {
    if (error instanceof WorkspaceConflictError) throw new ConflictError(workspaceToSession(error.remoteWorkspace));
    throw error;
  }
}
export const getSession = (id: string) => db.workspaceSessions.get(id);
export const getSessionsForOrganisation = (id: string) => db.workspaceSessions.where('organisationId').equals(id).toArray();
export const deleteSession = deleteWorkspace;
export const getAllSessions = () => db.workspaceSessions.orderBy('updatedAt').reverse().toArray();
export class ConflictError extends Error {
  constructor(public remoteSession: SessionRecord) {super('This Workspace changed elsewhere.'); this.name = 'ConflictError';}
}
