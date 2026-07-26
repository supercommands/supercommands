/**
 * @file favoriteCategoryData.ts
 * @description Dexie CRUD helpers for Favorite Category records.
 */

import { generateEntityId } from '../../../../shared-components/utils';
import { db } from '../../../../storage/indexDB/dbConfig';
import type { FavoriteCategoryRecord } from './favoriteCategoryTypes';
import { formatFavoriteCategoryName } from './favoriteCategoryHelpers';

export const createFavoriteCategory = async (
  name: string,
  userId: string,
): Promise<FavoriteCategoryRecord> => {
  try {
    const formattedName = formatFavoriteCategoryName(name);
    const existing = await db.favoriteCategories
      .where('userId')
      .equals(userId)
      .and(category => category.name.toLowerCase() === formattedName.toLowerCase())
      .first();

    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newFavoriteCategory: FavoriteCategoryRecord = {
      id: generateEntityId('favoriteCategory'),
      userId,
      name: formattedName,
      createdAt: now,
      updatedAt: now,
    };

    await db.favoriteCategories.add(newFavoriteCategory);
    return newFavoriteCategory;
  } catch (e) {
    console.error('Failed to create favorite category in Dexie', e);
    throw e;
  }
};

export const updateFavoriteCategory = async (
  favoriteCategoryId: string,
  updates: Partial<FavoriteCategoryRecord>,
): Promise<void> => {
  try {
    if (!favoriteCategoryId) return;
    await db.favoriteCategories.update(favoriteCategoryId, {
      ...updates,
      ...(updates.name !== undefined ? { name: formatFavoriteCategoryName(updates.name) } : {}),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('Failed to update favorite category in Dexie', e);
    throw e;
  }
};

export const deleteFavoriteCategory = async (favoriteCategoryId: string): Promise<void> => {
  try {
    if (!favoriteCategoryId) return;
    await db.favoriteCategories.delete(favoriteCategoryId);
  } catch (e) {
    console.error('Failed to delete favorite category in Dexie', e);
    throw e;
  }
};
