/**
 * @file favoriteCategoryHooks.ts
 * @description Provides React hook (`useFavoriteCategories`) for retrieving favorite categories from the DB store.
 */

import { useMemo } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';

export const useFavoriteCategories = (userId?: string) => {
  const allCategories = useDbStore(state => state.favoriteCategories);

  return useMemo(() => {
    if (!userId) {
      return allCategories;
    }
    return allCategories.filter(category => category.userId === userId || category.user_id === userId);
  }, [allCategories, userId]);
};
