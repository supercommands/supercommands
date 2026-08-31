import { StorageManager } from '../../../../storage/localStorage/storageManager';
import type { AiPromptRecord, CustomModelConfig } from './aiPromptTypes';

export const AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY = 'aiPrompt_excludedModels';

export interface AiModelTarget extends CustomModelConfig {
  id: string;
  name: string;
  host: string;
}

export const DEFAULT_AI_PROMPT_MODELS: AiModelTarget[] = [
  { id: 'gpt', name: 'ChatGPT', host: 'chatgpt.com' },
  { id: 'claude', name: 'Claude', host: 'claude.ai' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' },
  { id: 'perplexity', name: 'Perplexity', host: 'perplexity.ai' },
];

export function parseExcludedAiPromptModelIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function sanitizeEnabledAiPromptModelIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const validStrings = value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const id of validStrings) {
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(id);
      }
    }
    return unique;
  }

  return undefined;
}

export function resolveEnabledAiPromptModels(
  prompt: Pick<AiPromptRecord, 'enabledModelIds' | 'customModels'>,
  legacyExcludedModelIds?: readonly string[],
): AiModelTarget[] {
  const allModels: AiModelTarget[] = [
    ...DEFAULT_AI_PROMPT_MODELS,
    ...(prompt.customModels || [])
      .filter((m): m is CustomModelConfig => Boolean(m && typeof m.id === 'string' && m.id.length > 0))
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        host: m.host || '',
      })),
  ];

  const seenIds = new Set<string>();
  const uniqueModels: AiModelTarget[] = [];
  for (const model of allModels) {
    if (!seenIds.has(model.id)) {
      seenIds.add(model.id);
      uniqueModels.push(model);
    }
  }

  const sanitizedIds = sanitizeEnabledAiPromptModelIds(prompt.enabledModelIds);
  if (sanitizedIds !== undefined) {
    const enabledSet = new Set(sanitizedIds);
    return uniqueModels.filter(model => enabledSet.has(model.id));
  }

  const excludedSet = new Set(legacyExcludedModelIds || []);
  return uniqueModels.filter(model => !excludedSet.has(model.id));
}

export async function getExcludedAiPromptModelIdsAsync(): Promise<string[]> {
  const stored = await StorageManager.getItem(AI_PROMPT_EXCLUDED_MODELS_STORAGE_KEY);
  return parseExcludedAiPromptModelIds(stored);
}
