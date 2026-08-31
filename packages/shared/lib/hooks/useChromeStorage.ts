import { useCallback, useRef, useSyncExternalStore } from 'react';
import { createStorage, StorageEnum } from '@extension/storage';
import type { BaseStorage } from '@extension/storage';

const storageInstances = new Map<string, BaseStorage<any>>();

export function useChromeStorage<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => Promise<void>] {
  const defaultValueRef = useRef(defaultValue);
  let storage = storageInstances.get(key) as BaseStorage<T>;
  if (!storage) {
    storage = createStorage<T>(key, defaultValue, {
      storageEnum: StorageEnum.Local,
      liveUpdate: true,
    });
    storageInstances.set(key, storage);
  }

  const value = useSyncExternalStore<T | null>(storage.subscribe, storage.getSnapshot);

  const setValue = useCallback(
    async (newValue: T | ((val: T) => T)) => {
      await storage.set(newValue);
    },
    [storage],
  );

  return [value ?? defaultValueRef.current, setValue];
}
