import { createStorage, StorageEnum } from '../base/index.js';

const storage = createStorage<string>('theme-id-storage-key', 'midnight-stars', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceThemeStorage = storage;
