/**
 * @file snippetData.ts
 * @description Handles CRUD database operations for Snippet records in IndexedDB.
 * Supports querying by workspace, folder, or root scopes.
 * 
 * @usage
 * ```ts
 * import { createSnippet, getSnippet } from './snippetData';
 * const newSnippet = await createSnippet({ title: 'My Code Snippet', config: '{}' });
 * ```
 */

import Dexie from 'dexie';

import type { SnippetRecord, CreateSnippetInput, UpdateSnippetInput, SnippetSnapshot } from './snippetTypes';
import { generateEntityId } from '../../../../shared-components/utils';
import { db } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import {
  createInitialHistory,
  normalizeHistory,
  upsertVersionForChange,
  deepCloneSnapshot,
} from '../../../../shared-components/versionHistory/structuredVersionHistory';

function extractSnippetSnapshot(snippet: SnippetRecord): SnippetSnapshot {
  return {
    title: snippet.title,
    config: deepCloneSnapshot(snippet.config),
    workspaceId: snippet.workspaceId,
    folderId: snippet.folderId,
    tagIds: snippet.tagIds || [],
    shortcut: snippet.shortcut || '',
  };
}

/**
 * Creates a new snippet record.
 */
export async function createSnippet(input: CreateSnippetInput): Promise<SnippetRecord> {
  const defaultWorkspace = input.workspaceId
    ? null
    : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;

  const snippet: SnippetRecord = {
    id: generateEntityId('snippet'),
    workspaceId,
    folderId,

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
  } catch (error: unknown) {
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

  if (input.workspaceId !== undefined) {
    changes.workspaceId = input.workspaceId;
  }

  if (input.folderId !== undefined) {
    changes.folderId = input.folderId;
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

      const nextRecord: SnippetRecord = {
        ...existing,
        ...changes,
        updatedAt: now,
      };

      const prevSnapshot = extractSnippetSnapshot(existing);
      const nextSnapshot = extractSnippetSnapshot(nextRecord);

      const { history: nextHistory } = upsertVersionForChange<SnippetSnapshot>(
        existing.versionHistory,
        prevSnapshot,
        nextSnapshot,
        now
      );

      nextRecord.versionHistory = nextHistory;
      await db.snippets.put(nextRecord);
      return nextRecord;
    });
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[snippetData.getSnippet] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Snippets inside a specific Workspace (regardless of folder).
 */
export async function getSnippetsForWorkspace(workspaceId: string): Promise<SnippetRecord[]> {
  try {
    return await db.snippets
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[snippetData.getSnippetsForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Snippets that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getSnippetsForWorkspaceRoot(workspaceId: string): Promise<SnippetRecord[]> {
  try {
    const allWorkspaceSnippets = await getSnippetsForWorkspace(workspaceId);
    return allWorkspaceSnippets.filter(snippet => snippet.folderId == null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[snippetData.getSnippetsForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Snippets that belong to a specific Folder.
 */
export async function getSnippetsForFolder(workspaceId: string, folderId: string): Promise<SnippetRecord[]> {
  try {
    const snippets = await db.snippets
      .where('[workspaceId+folderId]')
      .equals([workspaceId, folderId])
      .toArray();
    return snippets.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[snippetData.getSnippetsForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes a Snippet from the Dexie database.
 */
export async function deleteSnippet(snippetId: string): Promise<void> {
  try {
    await db.snippets.delete(snippetId);
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[snippetData.getAllSnippets] Failed: ${message}`);
    throw error;
  }
}
