import { generateEntityId } from '../../../shared-components/utils';
import type { WorkspaceData } from './workspaceTypes';
import { db } from '../../../storage/indexDB/dbConfig';

/**
 * Creates a new Workspace and saves it to the local Dexie store.
 */
export async function createWorkspace(name: string): Promise<WorkspaceData> {
  try {
    const newWorkspace = {
      id: generateEntityId('workspace'),
      workspaceName: name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Save to Dexie store
    await db.workspaces.put(newWorkspace);
    
    return newWorkspace;
  } catch (error: any) {
    console.error('[workspaceData.createWorkspace] Error:', error);
    throw new Error(error?.message || 'An error occurred while creating workspace.');
  }
}

/**
 * Retrieves all Workspaces from the local Dexie store.
 */
export async function getAllWorkspaces(): Promise<WorkspaceData[]> {
  try {
    // Returns all workspaces sorted by updatedAt (descending so newest is first)
    return await db.workspaces.orderBy('updatedAt').reverse().toArray();
  } catch (error: any) {
    console.error('[workspaceData.getAllWorkspaces] Error:', error);
    return [];
  }
}

/**
 * Retrieves a single Workspace by its ID.
 */
export async function getWorkspace(id: string): Promise<WorkspaceData | undefined> {
  try {
    return await db.workspaces.get(id);
  } catch (error: any) {
    console.error(`[workspaceData.getWorkspace] Error for id ${id}:`, error);
    return undefined;
  }
}

/**
 * Updates an existing Workspace with partial data.
 */
export async function updateWorkspace(id: string, updates: Partial<WorkspaceData>): Promise<void> {
  try {
    const changes = {
      ...updates,
      updatedAt: Date.now() // Always bump updatedAt when a change is made
    };
    
    await db.workspaces.update(id, changes);
  } catch (error: any) {
    console.error(`[workspaceData.updateWorkspace] Error for id ${id}:`, error);
    throw new Error('An error occurred while updating workspace.');
  }
}

/**
 * Deletes a Workspace and all its associated items (cascade delete) from the local Dexie store.
 */
export async function deleteWorkspace(id: string): Promise<void> {
  try {
    await Promise.all([
      db.folders.where({ workspaceId: id }).delete(),
      db.notes.where({ workspaceId: id }).delete(),
      db.links.where({ workspaceId: id }).delete(),
      db.snippets.where({ workspaceId: id }).delete(),
      db.automations.where({ workspaceId: id }).delete(),
      db.chatAgents.where({ workspaceId: id }).delete(),
      db.aiPrompts.where({ workspaceId: id }).delete(),
      db.tags.where({ workspaceId: id }).delete(),
      db.workspaces.delete(id),
    ]);
  } catch (error: any) {
    console.error(`[workspaceData.deleteWorkspace] Error for id ${id}:`, error);
    throw new Error('An error occurred while deleting workspace.');
  }
}
