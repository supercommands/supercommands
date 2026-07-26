/**
 * @file automationData.ts
 * @description Implements IndexedDB database operations (CRUD) for automation records.
 * Supports retrieval at the root level, within specific folders, or across entire workspaces.
 * 
 * @usage
 * ```ts
 * import { createAutomation, getAutomation } from './automationData';
 * const automation = await getAutomation(id);
 * ```
 */

import Dexie from 'dexie';

import type { AutomationRecord, CreateAutomationInput, UpdateAutomationInput } from './automationTypes';
import { generateEntityId } from '../../../../shared-components/utils';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';

/**
 * Creates a new automation record.
 */
export async function createAutomation(input: CreateAutomationInput): Promise<AutomationRecord> {
  const defaultWorkspace = input.workspaceId
    ? null
    : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;

  const automation: AutomationRecord = {
    id: generateEntityId('automation'),
    workspaceId,
    folderId,

    name: input.name.trim() || 'Untitled Automation',
    steps: input.steps ?? [],
    inputs: input.inputs ?? [],
    tagIds: input.tagIds ?? [],

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  try {
    await db.automations.add(automation);
    return automation;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[automationData.createAutomation] Failed:', message);
    throw error;
  }
}

/**
 * Updates an existing automation record.
 */
export async function updateAutomation(automationId: string, input: UpdateAutomationInput): Promise<AutomationRecord> {
  const changes: Partial<AutomationRecord> = {
    updatedAt: Date.now(),
  };

  if (input.name !== undefined) {
    changes.name = input.name.trim() || 'Untitled Automation';
  }

  if (input.steps !== undefined) {
    changes.steps = input.steps;
  }

  if (input.inputs !== undefined) {
    changes.inputs = input.inputs;
  }

  if (input.workspaceId !== undefined) {
    changes.workspaceId = input.workspaceId;
  }

  if (input.folderId !== undefined) {
    changes.folderId = input.folderId;
  }

  if (input.tagIds !== undefined) {
    changes.tagIds = input.tagIds;
  }

  try {
    const existing = await db.automations.get(automationId);
    if (!existing) {
      throw new Error('Automation not found.');
    }

    // @ts-ignore - Dexie's deep KeyPaths inference issue with recursive AutomationStep type
    const updatedCount = await db.automations.update(automationId, changes as any);
    if (updatedCount === 0) {
      throw new Error('Automation could not be updated.');
    }

    return (await db.automations.get(automationId)) as AutomationRecord;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[automationData.updateAutomation] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves a specific Automation by its ID.
 */
export async function getAutomation(id: string): Promise<AutomationRecord | undefined> {
  try {
    return await db.automations.get(id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[automationData.getAutomation] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Automations inside a specific Workspace (regardless of folder).
 */
export async function getAutomationsForWorkspace(workspaceId: string): Promise<AutomationRecord[]> {
  try {
    return await db.automations
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[automationData.getAutomationsForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Automations that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getAutomationsForWorkspaceRoot(workspaceId: string): Promise<AutomationRecord[]> {
  try {
    const allWorkspaceAutomations = await getAutomationsForWorkspace(workspaceId);
    return allWorkspaceAutomations.filter(automation => automation.folderId == null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[automationData.getAutomationsForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Automations that belong to a specific Folder.
 */
export async function getAutomationsForFolder(workspaceId: string, folderId: string): Promise<AutomationRecord[]> {
  try {
    const automations = await db.automations
      .where('[workspaceId+folderId]')
      .equals([workspaceId, folderId])
      .toArray();
    return automations.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[automationData.getAutomationsForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes an Automation from the Dexie database.
 */
export async function deleteAutomation(automationId: string): Promise<void> {
  try {
    await deleteItemAssociations(automationId);
    await db.automations.delete(automationId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[automationData.deleteAutomation] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves all automations across the entire database.
 */
export async function getAllAutomations(): Promise<AutomationRecord[]> {
  try {
    return await db.automations.orderBy('updatedAt').reverse().toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[automationData.getAllAutomations] Failed: ${message}`);
    throw error;
  }
}
