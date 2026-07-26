/**
 * @file favoriteCategoryTypes.ts
 * @description Defines the TypeScript interface for Favorite Category entities,
 * including IDs, names, user IDs, and timestamps.
 *
 * @usage
 * ```ts
 * import type { FavoriteCategoryRecord } from './favoriteCategoryTypes';
 * ```
 */

export interface FavoriteCategoryRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}
