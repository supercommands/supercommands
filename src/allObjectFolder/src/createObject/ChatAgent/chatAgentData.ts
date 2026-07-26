/**
 * @file chatAgentData.ts
 * @description Provides CRUD logic and IndexedDB querying functions for ChatAgent entities.
 * Supports retrieval at the root level, folders, or workspace scopes.
 * 
 * @usage
 * ```ts
 * import { createChatAgent, getChatAgent } from './chatAgentData';
 * const agent = await getChatAgent(id);
 * ```
 */

import Dexie from 'dexie';

import type { ChatAgentRecord, CreateChatAgentInput, UpdateChatAgentInput } from './chatAgentTypes';
import { generateEntityId } from '../../../../shared-components/utils';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';

/**
 * Creates a new chat agent record.
 */
export async function createChatAgent(input: CreateChatAgentInput): Promise<ChatAgentRecord> {
  const defaultWorkspace = input.workspaceId
    ? null
    : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;

  const chatAgent: ChatAgentRecord = {
    id: generateEntityId('agent'),
    workspaceId,
    folderId,

    title: input.title.trim() || 'Untitled Chat',
    urls: input.urls ?? [],
    tagIds: input.tagIds ?? [],

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  try {
    await db.chatAgents.add(chatAgent);
    return chatAgent;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[chatAgentData.createChatAgent] Failed:', message);
    throw error;
  }
}

/**
 * Updates an existing chat agent record.
 */
export async function updateChatAgent(agentId: string, input: UpdateChatAgentInput): Promise<ChatAgentRecord> {
  const changes: Partial<ChatAgentRecord> = {
    updatedAt: Date.now(),
  };

  if (input.title !== undefined) {
    changes.title = input.title.trim() || 'Untitled Chat';
  }

  if (input.urls !== undefined) {
    changes.urls = input.urls;
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
    const existing = await db.chatAgents.get(agentId);
    if (!existing) {
      throw new Error('ChatAgent not found.');
    }

    const updatedCount = await db.chatAgents.update(agentId, changes);
    if (updatedCount === 0) {
      throw new Error('ChatAgent could not be updated.');
    }

    return (await db.chatAgents.get(agentId)) as ChatAgentRecord;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[chatAgentData.updateChatAgent] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves a specific ChatAgent by its ID.
 */
export async function getChatAgent(id: string): Promise<ChatAgentRecord | undefined> {
  try {
    return await db.chatAgents.get(id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[chatAgentData.getChatAgent] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all ChatAgents inside a specific Workspace (regardless of folder).
 */
export async function getChatAgentsForWorkspace(workspaceId: string): Promise<ChatAgentRecord[]> {
  try {
    return await db.chatAgents
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[chatAgentData.getChatAgentsForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all ChatAgents that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getChatAgentsForWorkspaceRoot(workspaceId: string): Promise<ChatAgentRecord[]> {
  try {
    const allWorkspaceAgents = await getChatAgentsForWorkspace(workspaceId);
    return allWorkspaceAgents.filter(agent => agent.folderId == null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[chatAgentData.getChatAgentsForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all ChatAgents that belong to a specific Folder.
 */
export async function getChatAgentsForFolder(workspaceId: string, folderId: string): Promise<ChatAgentRecord[]> {
  try {
    const agents = await db.chatAgents
      .where('[workspaceId+folderId]')
      .equals([workspaceId, folderId])
      .toArray();
    return agents.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[chatAgentData.getChatAgentsForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes a ChatAgent from the Dexie database.
 */
export async function deleteChatAgent(agentId: string): Promise<void> {
  try {
    await deleteItemAssociations(agentId);
    await db.chatAgents.delete(agentId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[chatAgentData.deleteChatAgent] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves all chat agents across the entire database.
 */
export async function getAllChatAgents(): Promise<ChatAgentRecord[]> {
  try {
    return await db.chatAgents.orderBy('updatedAt').reverse().toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[chatAgentData.getAllChatAgents] Failed: ${message}`);
    throw error;
  }
}
