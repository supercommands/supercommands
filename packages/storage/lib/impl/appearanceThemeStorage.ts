import { createStorage, StorageEnum } from '../base/index.js';

const storage = createStorage<string>('theme-id-storage-key', 'reflect-new-tab', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceThemeStorage = storage;
