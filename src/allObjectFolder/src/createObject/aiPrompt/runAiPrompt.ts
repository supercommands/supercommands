import type { AiPromptRecord } from './aiPromptTypes';
import {
  getExcludedAiPromptModelIdsAsync,
  resolveEnabledAiPromptModels,
  type AiModelTarget,
} from './aiPromptModelHelpers';

type RunnableAiPrompt = Pick<AiPromptRecord, 'id' | 'prompt' | 'modelUrls' | 'customModels'>;

export interface RunAiPromptResult {
  prompt: string;
  tabIds: number[];
  models: string[];
}

export function getAiPromptExecutionText(
  prompt: Pick<RunnableAiPrompt, 'prompt'> | null | undefined,
  temporaryPrompt = '',
): string {
  const savedPrompt = String(prompt?.prompt || '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  const temporaryText = String(temporaryPrompt || '').trim();

  return [savedPrompt, temporaryText].filter(Boolean).join('\n\n');
}

export function hasRunnableAiPrompt(
  prompt: Pick<RunnableAiPrompt, 'prompt'> | null | undefined,
  temporaryPrompt = '',
): boolean {
  return getAiPromptExecutionText(prompt, temporaryPrompt).length > 0;
}

function getAutoSubmitKind(modelId: string): 'chatgpt' | 'claude' | 'gemini' | 'perplexity' {
  const normalizedId = modelId.toLowerCase();
  if (normalizedId.includes('claude')) return 'claude';
  if (normalizedId.includes('gemini')) return 'gemini';
  if (normalizedId.includes('perplexity')) return 'perplexity';
  return 'chatgpt';
}

function openModelTab(
  chromeApi: typeof chrome,
  model: AiModelTarget,
  targetUrl: string,
  prompt: string,
): Promise<number | null> {
  return new Promise(resolve => {
    chromeApi.runtime.sendMessage(
      {
        action: 'open_tab_with_auto_submit',
        url: targetUrl,
        autoSubmit: { kind: getAutoSubmitKind(model.id), prompt },
        forceNewTab: true,
      },
      (response: any) => {
        if (chromeApi.runtime.lastError) {
          console.error('[runAiPrompt] Failed to launch model:', model.id, chromeApi.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(typeof response?.tabId === 'number' ? response.tabId : null);
      },
    );
  });
}

/** Runs an AI Prompt using the same multi-model execution path used by Board View. */
export async function runAiPrompt(promptRecord: RunnableAiPrompt, temporaryPrompt = ''): Promise<RunAiPromptResult> {
  const prompt = getAiPromptExecutionText(promptRecord, temporaryPrompt);

  const chromeApi = globalThis.chrome;
  if (!chromeApi?.runtime?.sendMessage) {
    throw new Error('AI Prompt execution requires the browser extension runtime.');
  }

  const excludedModelIds = await getExcludedAiPromptModelIdsAsync();
  const models = resolveEnabledAiPromptModels(promptRecord, excludedModelIds);

  const openedTabs = await Promise.all(
    models.map(async model => {
      const targetUrl = promptRecord.modelUrls?.[model.id] || `https://${model.host}`;
      const tabId = await openModelTab(chromeApi, model, targetUrl, prompt);
      return tabId === null ? null : { tabId, modelId: model.id };
    }),
  );

  const successfulTabs = openedTabs.filter((entry): entry is { tabId: number; modelId: string } => entry !== null);
  const tabIds = successfulTabs.map(entry => entry.tabId);
  const modelIds = successfulTabs.map(entry => entry.modelId);

  if (tabIds.length > 0) {
    chromeApi.runtime.sendMessage({
      action: 'track_ai_session',
      prompt,
      tabIds,
      models: modelIds,
      aiPromptId: promptRecord.id,
    });
  }

  return { prompt, tabIds, models: modelIds };
}
