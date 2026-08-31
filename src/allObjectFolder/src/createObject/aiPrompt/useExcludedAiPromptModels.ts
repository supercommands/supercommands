import { useState, useEffect } from 'react';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import {
  AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY,
  parseExcludedAiPromptModelIds,
} from './aiPromptModelHelpers';

export interface UseExcludedAiPromptModelsResult {
  excludedModelIds: string[];
  isLoading: boolean;
}

export function useExcludedAiPromptModels(): UseExcludedAiPromptModelsResult {
  const [excludedModelIds, setExcludedModelIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const stored = await StorageManager.getItem(AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY);
        if (isMounted) {
          setExcludedModelIds(parseExcludedAiPromptModelIds(stored));
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load excluded AI prompt models:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitial();

    const getChromeApi = () => (typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined);
    const chromeApi = getChromeApi();

    const handleStorageChange = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      areaName: string,
    ) => {
      if (areaName === 'local' && changes[AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY]) {
        const nextValue = parseExcludedAiPromptModelIds(changes[AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY].newValue);
        if (isMounted) {
          setExcludedModelIds(nextValue);
        }
      }
    };

    if (chromeApi?.storage?.onChanged) {
      chromeApi.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      isMounted = false;
      if (chromeApi?.storage?.onChanged) {
        chromeApi.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  return { excludedModelIds, isLoading };
}
