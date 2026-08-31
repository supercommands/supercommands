import { createStorage, StorageEnum } from '../base/index.js';

export const MIN_WARM_TINT_STRENGTH = 0;
export const DEFAULT_WARM_TINT_STRENGTH = 10;
export const MAX_WARM_TINT_STRENGTH = 100;

export function normalizeWarmTintStrength(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return DEFAULT_WARM_TINT_STRENGTH;
  }
  const rounded = Math.round(value);
  return Math.min(MAX_WARM_TINT_STRENGTH, Math.max(MIN_WARM_TINT_STRENGTH, rounded));
}

const storage = createStorage<number>('appearance-warm-tint-strength-storage-key', DEFAULT_WARM_TINT_STRENGTH, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceWarmTintStrengthStorage = storage;
