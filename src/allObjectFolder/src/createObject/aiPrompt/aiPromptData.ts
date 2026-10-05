import { assertRecordRevision } from '../../../../storage/indexDB/recordRevision';

import Dexie from 'dexie';
import type { AiPromptRecord, CreateAiPromptInput, UpdateAiPromptInput } from './aiPromptTypes';
import { sanitizeEnabledAiPromptModelIds } from './aiPromptModelHelpers';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { removeSessionReferencesForEntity } from '../session/sessionReferenceUtils';
export async function createAiPrompt(input: CreateAiPromptInput): Promise<AiPromptRecord> {
    const defaultOrganisation = input.organisationId
        ? null
        : await getSmartDefaultOrganisation();
    const organisationId = input.organisationId ?? defaultOrganisation?.id;
    if (!organisationId) {
        throw new Error('An organisation is required.');
    }
    const now = Date.now();
    const aiPrompt: AiPromptRecord = {
        id: generateEntityId('aiPrompt'),
        organisationId,
        title: input.title.trim() || 'Untitled Chat Agent',
        prompt: input.prompt,
        rules: input.rules,
        modelUrls: input.modelUrls,
        favIconUrl: input.favIconUrl,
        tagIds: input.tagIds ?? [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        customModels: input.customModels ?? [],
        ...(input.enabledModelIds !== undefined
            ? { enabledModelIds: sanitizeEnabledAiPromptModelIds(input.enabledModelIds) }
            : {}),
    };
    try {
        await db.aiPrompts.add(aiPrompt);
        return aiPrompt;
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[aiPromptData.createAiPrompt] Failed:', message);
        throw error;
    }
}
export async function updateAiPrompt(aiPromptId: string, input: UpdateAiPromptInput): Promise<AiPromptRecord> {
    const changes: Partial<AiPromptRecord> = {
        updatedAt: Date.now(),
    };
    if (input.title !== undefined)
        changes.title = input.title.trim() || 'Untitled Chat Agent';
    if (input.prompt !== undefined)
        changes.prompt = input.prompt;
    if (input.rules !== undefined)
        changes.rules = input.rules;
    if (input.modelUrls !== undefined)
        changes.modelUrls = input.modelUrls;
    if (input.favIconUrl !== undefined)
        changes.favIconUrl = input.favIconUrl;
    if (input.organisationId !== undefined)
        changes.organisationId = input.organisationId;
    if (input.tagIds !== undefined)
        changes.tagIds = input.tagIds;
    if (input.customModels !== undefined)
        changes.customModels = input.customModels;
    if (input.enabledModelIds !== undefined) {
        changes.enabledModelIds = sanitizeEnabledAiPromptModelIds(input.enabledModelIds) ?? [];
    }
    try {
        return await db.transaction('rw', db.aiPrompts, async () => {
            const existing = await db.aiPrompts.get(aiPromptId);
            if (!existing) {
                throw new Error('AiPrompt not found.');
            }
            assertRecordRevision(existing, input.expectedUpdatedAt);
            const updatedCount = await db.aiPrompts.update(aiPromptId, changes);
            if (updatedCount === 0) {
                throw new Error('AiPrompt could not be updated.');
            }
            return (await db.aiPrompts.get(aiPromptId)) as AiPromptRecord;
        });
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[aiPromptData.updateAiPrompt] Failed:', message);
        throw error;
    }
}
export async function getAiPrompt(id: string): Promise<AiPromptRecord | undefined> {
    try {
        return await db.aiPrompts.get(id);
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[aiPromptData.getAiPrompt] Failed: ${message}`);
        throw error;
    }
}
export async function getAiPromptsForOrganisation(organisationId: string): Promise<AiPromptRecord[]> {
    try {
        return await db.aiPrompts
            .where('[organisationId+updatedAt]')
            .between([organisationId, Dexie.minKey], [organisationId, Dexie.maxKey])
            .reverse()
            .toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[aiPromptData.getAiPromptsForWorkspace] Failed: ${message}`);
        throw error;
    }
}
export async function deleteAiPrompt(aiPromptId: string): Promise<void> {
    try {
        await deleteItemAssociations(aiPromptId);
        await db.aiPrompts.delete(aiPromptId);
        await removeSessionReferencesForEntity('agent', aiPromptId);
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[aiPromptData.deleteAiPrompt] Failed:', message);
        throw error;
    }
}
export async function getAllAiPrompts(): Promise<AiPromptRecord[]> {
    try {
        return await db.aiPrompts.orderBy('updatedAt').reverse().toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[aiPromptData.getAllAiPrompts] Failed: ${message}`);
        throw error;
    }
}
