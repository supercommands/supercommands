import { StorageManager } from './storageManager';

export const FAVORITE_LABELS_KEY = 'alts_fav_labels';

export const getStoredFavoriteLabels = async (): Promise<Record<string, string>> => {
  const data = await StorageManager.getItem(FAVORITE_LABELS_KEY);
  return data || {};
};

export const setStoredFavoriteLabels = async (labels: Record<string, string>): Promise<void> => {
  await StorageManager.setItem(FAVORITE_LABELS_KEY, labels);
};
