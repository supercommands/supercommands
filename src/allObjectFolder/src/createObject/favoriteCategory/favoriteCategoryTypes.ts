/**
 * @file favoriteCategoryTypes.ts
 * @description Defines the TypeScript interface for Favorite Category / Group records.
 */

export interface FavoriteCategoryRecord {
  id: string;
  user_id?: string;
  userId: string;
  name: string;
  filterTagIds?: string[];
  filterUpdatedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export const FAVORITE_CATEGORY_COMPARISON_FIELDS = ['id', 'user_id', 'userId', 'name', 'filterTagIds', 'filterUpdatedAt'] as const satisfies readonly (keyof FavoriteCategoryRecord)[];
