/**
 * @file favoriteCategoryData.ts
 * @description Handles IndexedDB CRUD operations for Favorite Category / Group records.
 */

import { generateEntityId } from '../../../../shared-components/utils';
import { db } from '../../../../storage/indexDB/dbConfig';
import type { FavoriteCategoryRecord } from './favoriteCategoryTypes';

export const createFavoriteCategory = async (
  name: string,
  userId: string,
): Promise<FavoriteCategoryRecord> => {
  try {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name cannot be empty');

    const allCategories = await db.favoriteCategories.toArray();
    const existing = allCategories.find(
      c => c.userId === userId && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newCategory: FavoriteCategoryRecord = {
      id: generateEntityId('favcat'),
      user_id: userId,
      userId,
      name: trimmed,
      filterTagIds: [],
      filterUpdatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.favoriteCategories.add(newCategory);
    return newCategory;
  } catch (e) {
    console.error('Failed to create favorite category in Dexie', e);
    throw e;
  }
};

export const updateFavoriteCategory = async (
  categoryId: string,
  updates: Partial<FavoriteCategoryRecord>,
): Promise<void> => {
  try {
    if (categoryId) {
      await db.favoriteCategories.update(categoryId, {
        ...updates,
        updatedAt: Date.now(),
      });
    }
  } catch (e) {
    console.error('Failed to update favorite category in Dexie', e);
    throw e;
  }
};

export const deleteFavoriteCategory = async (categoryId: string): Promise<void> => {
  try {
    if (categoryId) {
      await db.favoriteCategories.delete(categoryId);
    }
  } catch (e) {
    console.error('Failed to delete favorite category in Dexie', e);
    throw e;
  }
};
