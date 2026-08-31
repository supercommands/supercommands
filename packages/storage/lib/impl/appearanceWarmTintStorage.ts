import { createStorage, StorageEnum } from '../base/index.js';

const storage = createStorage<boolean>('appearance-warm-tint-storage-key', true, {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceWarmTintStorage = storage;
