/**
 * @file tagData.ts
 * @description Handles IndexedDB transactions (CRUD) for Tag records.
 * 
 * @usage
 * ```ts
 * import { createTag, updateTag } from './tagData';
 * const tag = await createTag('work', workspaceId);
 * ```
 */

import { generateEntityId } from '../../../../shared-components/utils';

import { db } from '../../../../storage/indexDB/dbConfig';
import type { TagRecord } from './tagTypes';

export const createTag = async (
  name: string,
  workspaceId: string
): Promise<TagRecord> => {
  try {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tag name cannot be empty');

    // Prevent duplicate tags in same workspace or globally
    const allTags = await db.tags.toArray();
    const existing = allTags.find(t => t.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newTag: TagRecord = {
      id: generateEntityId('tag'),
      name: trimmed,
      workspaceId,
      createdAt: now,
      updatedAt: now
    };

    await db.tags.add(newTag);
    return newTag;
  } catch (e) {
    console.error('Failed to create tag in Dexie', e);
    throw e;
  }
};

export const updateTag = async (
  tagId: string, 
  updates: Partial<TagRecord>
): Promise<void> => {
  try {
    if (tagId) {
      await db.tags.update(tagId, {
        ...updates,
        updatedAt: Date.now()
      });
    }
  } catch (e) {
    console.error('Failed to update tag in Dexie', e);
    throw e;
  }
};

export const deleteTag = async (tagId: string): Promise<void> => {
  try {
    if (tagId) {
      await db.tags.delete(tagId);
    }
  } catch (e) {
    console.error('Failed to delete tag in Dexie', e);
    throw e;
  }
};
