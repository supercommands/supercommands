import { assertRecordRevision } from '../../../../storage/indexDB/recordRevision';

import Dexie from 'dexie';
import type { ChatAgentRecord, CreateChatAgentInput, UpdateChatAgentInput } from './chatAgentTypes';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { removeSessionReferencesForEntity } from '../session/sessionReferenceUtils';
/**
 * Creates a new chat agent record.
 */
export async function createChatAgent(input: CreateChatAgentInput): Promise<ChatAgentRecord> {
    const defaultOrganisation = input.organisationId
        ? null
        : await getSmartDefaultOrganisation();
    const organisationId = input.organisationId ?? defaultOrganisation?.id;
    if (!organisationId) {
        throw new Error('An organisation is required.');
    }
    const now = Date.now();
    const chatAgent: ChatAgentRecord = {
        id: generateEntityId('agent'),
        organisationId,
        title: input.title.trim() || 'Untitled Chat',
        prompt: String(input.prompt || '').trim(),
        urls: input.urls ?? [],
        tagIds: input.tagIds ?? [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
    };
    try {
        await db.chatAgents.add(chatAgent);
        return chatAgent;
    }
    catch (error: unknown) {
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
    if (input.prompt !== undefined) {
        changes.prompt = String(input.prompt || '').trim();
    }
    if (input.urls !== undefined) {
        changes.urls = input.urls;
    }
    if (input.organisationId !== undefined) {
        changes.organisationId = input.organisationId;
    }
    if (input.tagIds !== undefined) {
        changes.tagIds = input.tagIds;
    }
    try {
        return await db.transaction('rw', db.chatAgents, async () => {
            const existing = await db.chatAgents.get(agentId);
            if (!existing) {
                throw new Error('ChatAgent not found.');
            }
            assertRecordRevision(existing, input.expectedUpdatedAt);
            const updatedCount = await db.chatAgents.update(agentId, changes);
            if (updatedCount === 0) {
                throw new Error('ChatAgent could not be updated.');
            }
            return (await db.chatAgents.get(agentId)) as ChatAgentRecord;
        });
    }
    catch (error: unknown) {
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
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[chatAgentData.getChatAgent] Failed: ${message}`);
        throw error;
    }
}

export async function getChatAgentsForOrganisation(organisationId: string): Promise<ChatAgentRecord[]> {
    try {
        return await db.chatAgents
            .where('[organisationId+updatedAt]')
            .between([organisationId, Dexie.minKey], [organisationId, Dexie.maxKey])
            .reverse()
            .toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[chatAgentData.getChatAgentsForWorkspace] Failed: ${message}`);
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
        await removeSessionReferencesForEntity('agent', agentId);
    }
    catch (error: unknown) {
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
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[chatAgentData.getAllChatAgents] Failed: ${message}`);
        throw error;
    }
}
