import { db } from '../../storage/indexDB/dbConfig';
import { generateEntityId } from '../utils';
import type { FavoriteRecord } from './favoriteTypes';

export async function addFavoriteRecord(
  userId: string,
  referenceId: string,
  referenceType: string,
  label?: string,
  favoriteCategoryId?: string | null,
): Promise<FavoriteRecord> {
  const existing = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (existing) {
    if (favoriteCategoryId !== undefined && existing.favoriteCategoryId !== favoriteCategoryId) {
      await db.favorites.update(existing.id, {
        favoriteCategoryId,
        updatedAt: Date.now(),
      });
      return (await db.favorites.get(existing.id)) as FavoriteRecord;
    }
    return existing;
  }

  const now = Date.now();
  const id = generateEntityId('fav');
  const record: FavoriteRecord = {
    id,
    favourite_id: '',
    user_id: userId,
    reference_id: referenceId,
    reference_type: referenceType,
    favoriteCategoryId: favoriteCategoryId ?? null,
    label,
    updatedAt: now,
  };

  await db.favorites.add(record);
  return record;
}

export async function removeFavoriteRecord(userId: string, referenceId: string): Promise<void> {
  const record = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (record) {
    await db.favorites.delete(record.id);
  }
}

export async function updateFavoriteRecordCategory(
  userId: string,
  referenceId: string,
  favoriteCategoryId: string | null,
): Promise<FavoriteRecord | null> {
  const record = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (!record) return null;

  await db.favorites.update(record.id, {
    favoriteCategoryId,
    updatedAt: Date.now(),
  });

  return (await db.favorites.get(record.id)) as FavoriteRecord;
}

export async function toggleFavoriteRecord(
  userId: string,
  referenceId: string,
  referenceType: string,
  label?: string,
  favoriteCategoryId?: string | null,
): Promise<boolean> {
  const existing = await db.favorites.where('[user_id+reference_id]').equals([userId, referenceId]).first();
  if (existing) {
    await db.favorites.delete(existing.id);
    return false; // Not favorited anymore
  } else {
    await addFavoriteRecord(userId, referenceId, referenceType, label, favoriteCategoryId);
    return true; // Is favorited now
  }
}
