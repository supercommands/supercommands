/**
 * @file favoriteCategoryHooks.ts
 * @description React hooks for reading Favorite Category records from the shared store.
 */

import { useMemo } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';

export const useFavoriteCategories = (userId?: string) => {
  const allFavoriteCategories = useDbStore(state => state.favoriteCategories);

  return useMemo(() => {
    if (!userId) return allFavoriteCategories;
    return allFavoriteCategories.filter(category => category.userId === userId);
  }, [allFavoriteCategories, userId]);
};
