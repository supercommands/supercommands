/** Panel-only models; Chat Agents persist the existing selected URL format. */
import { DEFAULT_AI_PROMPT_MODELS, DEFAULT_AI_PROMPT_MODEL_URLS, DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS, } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import { appendCmdStatus, stripCmdStatus } from '../searchBarMain/utilityFunctions/utils';
import type { CustomModelConfig } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { requireHttpUrl } from '../utils/urlIdentity';
export type WebsitePopupAiPromptModelValue = {
    enabledModelIds: string[];
    modelUrls: Record<string, string>;
    customModels: CustomModelConfig[];
};
export const createWebsitePopupModelSelection = (): WebsitePopupAiPromptModelValue => ({
    enabledModelIds: [...DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS],
    modelUrls: { ...DEFAULT_AI_PROMPT_MODEL_URLS },
    customModels: [],
});
export function readWebsitePopupAgentModels(urls: readonly string[]): WebsitePopupAiPromptModelValue {
    const value = createWebsitePopupModelSelection();
    value.enabledModelIds = [];
    urls.forEach((raw, index) => {
        const url = stripCmdStatus(raw);
        let host: string;
        try {
            host = new URL(url).hostname;
        }
        catch {
            return;
        }
        const known = DEFAULT_AI_PROMPT_MODELS.find(model => host === model.host || host.endsWith(`.${model.host}`));
        const id = known && !value.enabledModelIds.includes(known.id) ? known.id : `agentModel${index}`;
        if (id !== known?.id)
            value.customModels.push({ id, name: known?.name || host, host });
        value.modelUrls[id] = url;
        // Preserve explicitly deselected legacy URLs in the editor without activating them.
        let selected = true;
        try {
            selected = new URL(raw).searchParams.get('cmd_select_status') !== 'false';
        }
        catch { /* Clean legacy URL remains selectable. */ }
        if (selected)
            value.enabledModelIds.push(id);
    });
    return value;
}
export function serializeWebsitePopupAgentModels(value: WebsitePopupAiPromptModelValue): string[] {
    if (!value.enabledModelIds.length)
        throw new Error('Select at least one model.');
    const ids = new Set([...DEFAULT_AI_PROMPT_MODELS, ...value.customModels].map(model => model.id));
    return value.enabledModelIds.map(id => {
        if (!ids.has(id))
            throw new Error('A selected model is no longer available.');
        const url = value.modelUrls[id] || DEFAULT_AI_PROMPT_MODEL_URLS[id] || '';
        requireHttpUrl(url);
        return appendCmdStatus(url, true);
    });
}
/** ChatGPT is preferred, but an explicitly disabled model is never selected. */
export function resolveWebsitePopupModelDestination(value: WebsitePopupAiPromptModelValue): string {
    const enabled = value.enabledModelIds.map(id => ({ id, url: value.modelUrls[id] || DEFAULT_AI_PROMPT_MODEL_URLS[id] || '' }));
    const selected = enabled.find(model => {
        try {
            const host = new URL(model.url).hostname;
            return host === 'chatgpt.com' || host.endsWith('.chatgpt.com');
        }
        catch {
            return false;
        }
    }) || enabled[0];
    if (!selected)
        throw new Error('The selected destination has no enabled model.');
    return requireHttpUrl(stripCmdStatus(selected.url));
}
