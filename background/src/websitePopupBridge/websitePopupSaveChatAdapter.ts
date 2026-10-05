import { detectWebsitePopupChatConversation } from '../../../src/shared-components/websitePopup/websitePopupChatConversation';
import {
  DEFAULT_AI_PROMPT_MODELS,
  getExcludedAiPromptModelIdsAsync,
  resolveEnabledAiPromptModels,
} from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import { getAiPrompt, updateAiPrompt } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { getChatAgent, updateChatAgent } from '../../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { generateEntityId } from '../../../src/shared-components/utils/idGenerator';
import type { WebsitePopupPageReference } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';

export async function saveWebsitePopupChatToTarget(
  entity: 'prompt' | 'agent',
  targetId: string,
  page: WebsitePopupPageReference,
) {
  const conversation = detectWebsitePopupChatConversation(page.url);
  if (!conversation) throw new Error('This page is not a supported AI conversation.');
  const url = conversation.url;
  if (entity === 'agent') {
    const record = await getChatAgent(targetId);
    if (!record || record.deletedAt) throw new Error('The selected Chat Agent no longer exists.');
    const urls = record.urls || [];
    const changed = !urls.some(item => item.trim().toLowerCase() === url.toLowerCase());
    if (changed) await updateChatAgent(targetId, { expectedUpdatedAt: record.updatedAt, urls: [...urls, url] });
    return {
      entity,
      targetId,
      title: record.title || 'Untitled Agent',
      changed,
      changedTables: changed ? ['chatAgents' as const] : [],
    };
  }
  const record = await getAiPrompt(targetId);
  if (!record || record.deletedAt) throw new Error('The selected AI Prompt no longer exists.');
  const modelUrls = { ...(record.modelUrls || {}) };
  const customModels = [...(record.customModels || [])];
  const enabledModelIds = new Set(
    record.enabledModelIds ??
      resolveEnabledAiPromptModels(record, await getExcludedAiPromptModelIdsAsync()).map(model => model.id),
  );
  const provider = DEFAULT_AI_PROMPT_MODELS.find(model => model.id === conversation.providerId)!;
  const existing = Object.entries(modelUrls).find(([, value]) => value.trim() === url)?.[0];
  const modelId =
    existing ||
    (!String(modelUrls[provider.id] || '').trim() ? provider.id : generateEntityId(`${provider.id}CustomModel`));
  if (modelId !== provider.id && !customModels.some(model => model.id === modelId))
    customModels.push({ id: modelId, name: provider.name, host: provider.host });
  const changed =
    modelUrls[modelId] !== url ||
    !enabledModelIds.has(modelId) ||
    customModels.length !== (record.customModels || []).length;
  modelUrls[modelId] = url;
  enabledModelIds.add(modelId);
  if (changed)
    await updateAiPrompt(targetId, {
      expectedUpdatedAt: record.updatedAt,
      modelUrls,
      customModels,
      enabledModelIds: [...enabledModelIds],
    });
  return {
    entity,
    targetId,
    title: record.title || 'Untitled Prompt',
    changed,
    changedTables: changed ? ['aiPrompts' as const] : [],
  };
}
