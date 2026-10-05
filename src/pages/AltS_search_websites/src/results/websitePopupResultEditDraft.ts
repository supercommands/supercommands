import { requireHttpUrl } from '../../../../shared-components/utils/urlIdentity';
/** Pure snapshot-to-draft mapping; no React, Chrome or persistence. */
import type { WebsitePopupEntityKind, WebsitePopupResultEditChanges, } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import { getWebsitePopupSnapshotRecord } from '../../../../shared-components/websitePopup/websitePopupEntityRecords';
import { DEFAULT_AI_PROMPT_MODEL_URLS, DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS, } from '../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import { readWebsitePopupAgentModels, serializeWebsitePopupAgentModels, type WebsitePopupAiPromptModelValue, } from '../../../../shared-components/websitePopup/websitePopupModelSelection';
type UrlRow = {
    id?: string;
    title?: string;
    name?: string;
    url: string;
    source?: string;
    favIconUrl?: string;
};
type EditableRecord = {
    id: string;
    updatedAt?: number;
    title?: string;
    name?: string;
    body?: string;
    config?: string | Record<string, unknown>;
    prompt?: string;
    description?: string;
    rules?: string;
    url?: string;
    urls?: Array<string | UrlRow>;
    tagIds?: string[];
    scheduleType?: EditDraft['scheduleType'];
    recurringType?: EditDraft['recurringType'];
    scheduleTime?: number;
    isDone?: boolean;
    references?: Array<{
        type: string;
        id: string;
        name?: string;
    }>;
    modelUrls?: Record<string, string>;
    customModels?: WebsitePopupAiPromptModelValue['customModels'];
    enabledModelIds?: string[];
};
export type EditDraft = Omit<WebsitePopupResultEditChanges, 'modelUrls' | 'customModels' | 'enabledModelIds'> & WebsitePopupAiPromptModelValue;
export const getRecord = (snapshot: WebsitePopupSearchSnapshot, target: {
    entity: WebsitePopupEntityKind;
    targetId: string;
}): EditableRecord | undefined => getWebsitePopupSnapshotRecord(snapshot, target.entity, target.targetId);
const toUrlRows = (record: EditableRecord, entity: WebsitePopupEntityKind) => {
    if (entity === 'bookmark')
        return [{ id: record.id, title: record.title, url: String(record.url || '') }];
    if (entity === 'agent')
        return (record.urls || [])
            .filter((url): url is string => typeof url === 'string')
            .map((url, index: number) => ({
            id: `agent-url-${index}`,
            title: '',
            url,
        }));
    return (record.urls || [])
        .filter((item): item is UrlRow => typeof item !== 'string')
        .map(item => ({
        id: String(item.id || ''),
        title: String(item.title || item.name || ''),
        url: String(item.url || ''),
        source: item.source,
        favIconUrl: item.favIconUrl,
    }));
};
export const buildDraft = (record: EditableRecord, entity: WebsitePopupEntityKind): EditDraft => ({
    title: String(record.title || record.name || ''),
    content: entity === 'note'
        ? String(record.body || '')
        : entity === 'snippet'
            ? typeof record.config === 'string'
                ? record.config
                : JSON.stringify(record.config ?? {}, null, 2)
            : entity === 'prompt' || entity === 'agent'
                ? String(record.prompt || '')
                : String(record.description || ''),
    rules: String(record.rules || ''),
    urls: entity === 'link' || entity === 'collection' || entity === 'agent' || entity === 'bookmark'
        ? toUrlRows(record, entity)
        : undefined,
    tagIds: Array.isArray(record.tagIds) ? [...record.tagIds] : [],
    scheduleType: record.scheduleType || 'one-time',
    recurringType: record.recurringType || 'daily',
    scheduleTime: Number(record.scheduleTime || 0),
    isDone: Boolean(record.isDone),
    references: Array.isArray(record.references)
        ? record.references.map(reference => ({
            type: String(reference.type),
            id: String(reference.id),
            name: String(reference.name || ''),
        }))
        : [],
    modelUrls: entity === 'prompt' ? { ...DEFAULT_AI_PROMPT_MODEL_URLS, ...(record.modelUrls || {}) } : {},
    customModels: entity === 'prompt' && Array.isArray(record.customModels) ? [...record.customModels] : [],
    enabledModelIds: entity === 'prompt'
        ? Array.isArray(record.enabledModelIds)
            ? [...record.enabledModelIds]
            : Object.keys(record.modelUrls || {}).length
                ? Object.keys(record.modelUrls)
                : [...DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS]
        : [],
    ...(entity === 'agent'
        ? readWebsitePopupAgentModels((record.urls || []).filter((url): url is string => typeof url === 'string'))
        : {}),
});
export function buildWebsitePopupResultEditChanges(initial: EditDraft, draft: EditDraft, entity: WebsitePopupEntityKind): WebsitePopupResultEditChanges {
    const changed = (key: keyof EditDraft) => JSON.stringify(draft[key]) !== JSON.stringify(initial[key]);
    const changes: WebsitePopupResultEditChanges = { title: draft.title };
    if (entity !== 'collection' && changed('content'))
        changes.content = draft.content;
    if (changed('rules'))
        changes.rules = draft.rules;
    if (changed('urls'))
        changes.urls = draft.urls;
    if (entity !== 'collection' && changed('tagIds'))
        changes.tagIds = draft.tagIds;
    if (changed('scheduleType') || changed('recurringType')) {
        changes.scheduleType = draft.scheduleType;
        changes.recurringType = draft.recurringType;
    }
    if (changed('scheduleTime'))
        changes.scheduleTime = draft.scheduleTime;
    if (changed('isDone'))
        changes.isDone = draft.isDone;
    if (changed('references'))
        changes.references = draft.references;
    if (entity === 'prompt' && (changed('modelUrls') || changed('customModels') || changed('enabledModelIds'))) {
        if (!draft.enabledModelIds.length) {
            throw new Error('Select at least one model.');
        }
        for (const id of draft.enabledModelIds) {
            try {
                const url = new URL(draft.modelUrls[id] || '');
                if (url.protocol !== 'http:' && url.protocol !== 'https:')
                    throw new Error();
            }
            catch {
                throw new Error('Each selected model needs a valid HTTP or HTTPS URL.');
            }
        }
        changes.modelUrls = draft.modelUrls;
        changes.customModels = draft.customModels;
        changes.enabledModelIds = draft.enabledModelIds;
    }
    if (entity === 'agent' && (changed('modelUrls') || changed('customModels') || changed('enabledModelIds'))) {
        try {
            changes.urls = serializeWebsitePopupAgentModels(draft).map((url, index) => ({ id: `agent-model-${index}`, url }));
        }
        catch (failure) {
            throw failure;
        }
    }
    return changes;
}
