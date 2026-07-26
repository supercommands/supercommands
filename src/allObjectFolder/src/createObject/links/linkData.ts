/**
 * @file linkData.ts
 * @description Provides IndexedDB database CRUD functions for link records.
 * Supports retrieval at the root level, folders, or workspace scopes.
 * 
 * @usage
 * ```ts
 * import { createLink, getLink } from './linkData';
 * const newLink = await createLink({ title: 'My link collection', urls: [] });
 * ```
 */

import Dexie from 'dexie';

import type { LinkRecord, CreateLinkInput, UpdateLinkInput } from './linkTypes';

import { generateEntityId } from '../../../../shared-components/utils';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';

/**
 * Creates a new link record.
 */
export async function createLink(input: CreateLinkInput): Promise<LinkRecord> {
  const defaultWorkspace = input.workspaceId
    ? null
    : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;

  const link: LinkRecord = {
    id: input.id || generateEntityId('link'),
    workspaceId,
    folderId,

    title: input.title.trim() || 'Untitled Link',
    urls: input.urls ?? [],
    tagIds: input.tagIds ?? [],

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  try {
    await db.links.add(link);
    return link;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[linkData.createLink] Failed:', message);
    throw error;
  }
}

export class ConflictError extends Error {
  remoteLink?: LinkRecord;

  constructor(message: string, remoteLink?: LinkRecord) {
    super(message);
    this.name = 'ConflictError';
    this.remoteLink = remoteLink;
  }
}

/**
 * Updates an existing link record.
 */
export async function updateLink(linkId: string, input: UpdateLinkInput): Promise<LinkRecord> {
  const changes: Partial<LinkRecord> = {
    updatedAt: Date.now(),
  };

  if (input.title !== undefined) {
    changes.title = input.title.trim() || 'Untitled Link';
  }

  if (input.urls !== undefined) {
    changes.urls = input.urls;
  }

  if (input.workspaceId !== undefined) changes.workspaceId = input.workspaceId;
  if (input.folderId !== undefined) changes.folderId = input.folderId;
  if (input.tagIds !== undefined) changes.tagIds = input.tagIds;

  try {
    return await db.transaction('rw', db.links, async () => {
      const existing = await db.links.get(linkId);
      if (!existing) {
        throw new Error('Link not found.');
      }

      if (input.expectedUpdatedAt !== undefined && existing.updatedAt !== input.expectedUpdatedAt) {
        throw new ConflictError('Link was modified in another tab.', existing);
      }

      await db.links.update(linkId, changes);
      return { ...existing, ...changes } as LinkRecord;
    });
  } catch (error: unknown) {
    if (error instanceof ConflictError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[linkData.updateLink] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves a specific Link by its ID.
 */
export async function getLink(id: string): Promise<LinkRecord | undefined> {
  try {
    return await db.links.get(id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[linkData.getLink] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Links inside a specific Workspace (regardless of folder).
 */
export async function getLinksForWorkspace(workspaceId: string): Promise<LinkRecord[]> {
  try {
    return await db.links
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[linkData.getLinksForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Links that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getLinksForWorkspaceRoot(workspaceId: string): Promise<LinkRecord[]> {
  try {
    const allWorkspaceLinks = await getLinksForWorkspace(workspaceId);
    return allWorkspaceLinks.filter(link => link.folderId == null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[linkData.getLinksForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Links that belong to a specific Folder.
 */
export async function getLinksForFolder(workspaceId: string, folderId: string): Promise<LinkRecord[]> {
  try {
    const links = await db.links
      .where('[workspaceId+folderId]')
      .equals([workspaceId, folderId])
      .toArray();
    return links.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[linkData.getLinksForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes a Link from the Dexie database.
 */
export async function deleteLink(linkId: string): Promise<void> {
  try {
    await deleteItemAssociations(linkId);
    await db.links.delete(linkId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[linkData.deleteLink] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves all links across the entire database.
 */
export async function getAllLinks(): Promise<LinkRecord[]> {
  try {
    return await db.links.orderBy('updatedAt').reverse().toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[linkData.getAllLinks] Failed: ${message}`);
    throw error;
  }
}
