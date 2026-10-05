import { assertRecordRevision } from '../../../../storage/indexDB/recordRevision';

import Dexie from 'dexie';
import type { SnippetRecord, CreateSnippetInput, UpdateSnippetInput, SnippetSnapshot } from './snippetTypes';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { db } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { createInitialHistory, normalizeHistory, upsertVersionForChange, deepCloneSnapshot, } from '../../../../shared-components/versionHistory/structuredVersionHistory';
import { removeSessionReferencesForEntity } from '../session/sessionReferenceUtils';
function extractSnippetSnapshot(snippet: SnippetRecord): SnippetSnapshot {
    return {
        title: snippet.title,
        config: deepCloneSnapshot(snippet.config),
        organisationId: snippet.organisationId,
        tagIds: snippet.tagIds || [],
        shortcut: snippet.shortcut || '',
    };
}
/**
 * Creates a new snippet record.
 */
export async function createSnippet(input: CreateSnippetInput): Promise<SnippetRecord> {
    const defaultOrganisation = input.organisationId
        ? null
        : await getSmartDefaultOrganisation();
    const organisationId = input.organisationId ?? defaultOrganisation?.id;
    if (!organisationId) {
        throw new Error('An organisation is required.');
    }
    const now = Date.now();
    const snippet: SnippetRecord = {
        id: generateEntityId('snippet'),
        organisationId,
        title: input.title.trim() || 'Untitled Snippet',
        config: input.config,
        tagIds: input.tagIds ?? [],
        shortcut: input.shortcut || '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        versionHistory: undefined as any,
    };
    const initialSnapshot = extractSnippetSnapshot(snippet);
    snippet.versionHistory = createInitialHistory<SnippetSnapshot>(initialSnapshot, now);
    try {
        await db.snippets.add(snippet);
        return snippet;
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[snippetData.createSnippet] Failed:', message);
        throw error;
    }
}
/**
 * Updates an existing snippet record.
 */
export async function updateSnippet(snippetId: string, input: UpdateSnippetInput): Promise<SnippetRecord> {
    const now = Date.now();
    const changes: Partial<SnippetRecord> = {
        updatedAt: now,
    };
    if (input.title !== undefined) {
        changes.title = input.title.trim() || 'Untitled Snippet';
    }
    if (input.config !== undefined) {
        changes.config = input.config;
    }
    if (input.organisationId !== undefined) {
        changes.organisationId = input.organisationId;
    }
    if (input.tagIds !== undefined) {
        changes.tagIds = input.tagIds;
    }
    if (input.shortcut !== undefined) {
        changes.shortcut = input.shortcut;
    }
    try {
        return await db.transaction('rw', db.snippets, async () => {
            const existing = await db.snippets.get(snippetId);
            if (!existing) {
                throw new Error('Snippet not found.');
            }
            assertRecordRevision(existing, input.expectedUpdatedAt);
            const nextRecord: SnippetRecord = {
                ...existing,
                ...changes,
                updatedAt: now,
            };
            const prevSnapshot = extractSnippetSnapshot(existing);
            const nextSnapshot = extractSnippetSnapshot(nextRecord);
            const { history: nextHistory } = upsertVersionForChange<SnippetSnapshot>(existing.versionHistory, prevSnapshot, nextSnapshot, now);
            nextRecord.versionHistory = nextHistory;
            await db.snippets.put(nextRecord);
            return nextRecord;
        });
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[snippetData.updateSnippet] Failed:', message);
        throw error;
    }
}
/**
 * Retrieves a specific Snippet by its ID.
 */
export async function getSnippet(id: string): Promise<SnippetRecord | undefined> {
    try {
        return await db.snippets.get(id);
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[snippetData.getSnippet] Failed: ${message}`);
        throw error;
    }
}

export async function getSnippetsForOrganisation(organisationId: string): Promise<SnippetRecord[]> {
    try {
        return await db.snippets
            .where('[organisationId+updatedAt]')
            .between([organisationId, Dexie.minKey], [organisationId, Dexie.maxKey])
            .reverse()
            .toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[snippetData.getSnippetsForWorkspace] Failed: ${message}`);
        throw error;
    }
}
/**
 * Deletes a Snippet from the Dexie database.
 */
export async function deleteSnippet(snippetId: string): Promise<void> {
    try {
        await db.snippets.delete(snippetId);
        await removeSessionReferencesForEntity('snippet', snippetId);
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[snippetData.deleteSnippet] Failed:', message);
        throw error;
    }
}
/**
 * Retrieves all snippets across the entire database.
 */
export async function getAllSnippets(): Promise<SnippetRecord[]> {
    try {
        return await db.snippets.orderBy('updatedAt').reverse().toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[snippetData.getAllSnippets] Failed: ${message}`);
        throw error;
    }
}
