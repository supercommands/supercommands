import { useMemo } from 'react';
import { useDbStore } from '../../../../storage/store/useDbStore';
import type { PrefixSettingCategory, PrefixSettingRecord } from './prefixSettingTypes';

export function usePrefixSettings(): PrefixSettingRecord[] {
  return useDbStore(state => state.prefixSettings);
}

export function usePrefixSettingByCategory(category: PrefixSettingCategory): PrefixSettingRecord | null {
  const prefixSettings = usePrefixSettings();
  return useMemo(
    () => prefixSettings.find(setting => setting.category === category) ?? null,
    [category, prefixSettings],
  );
}
