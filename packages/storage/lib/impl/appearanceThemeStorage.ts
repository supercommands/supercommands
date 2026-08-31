import { createStorage, StorageEnum } from '../base/index.js';

const storage = createStorage<string>('theme-id-storage-key', 'cloud-blue-dark', {
  storageEnum: StorageEnum.Local,
  liveUpdate: true,
});

export const appearanceThemeStorage = storage;
