import { createStorage, StorageEnum } from '../base/index.js';

export const MIN_APPEARANCE_BRIGHTNESS = 0;
export const DEFAULT_APPEARANCE_BRIGHTNESS = 70;
export const MAX_APPEARANCE_BRIGHTNESS = 100;

export function normalizeBrightness(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return DEFAULT_APPEARANCE_BRIGHTNESS;
  }
  const rounded = Math.round(value);
  return Math.min(MAX_APPEARANCE_BRIGHTNESS, Math.max(MIN_APPEARANCE_BRIGHTNESS, rounded));
}

const storage = createStorage<number>('appearance-brightness-storage-key', DEFAULT_APPEARANCE_BRIGHTNESS, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceBrightnessStorage = storage;
