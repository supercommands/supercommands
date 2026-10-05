/** Typed popup execution bridge shared by content and background contexts. */
import { isTemporaryPromptComposition, type TemporaryPromptComposition } from '../../aiPromptComposer/temporaryPromptComposition';
import type { WebsitePopupEntityKind, WebsitePopupBaseCreateDraft, WebsitePopupBaseCreateEntity, WebsitePopupExecutionOutcome, WebsitePopupPageContext, WebsitePopupPageReference, WebsitePopupSaveTargetEntity, WebsitePopupTextCommandTargetEntity, WebsitePopupResultEditChanges, } from './websitePopupExecutionTypes';
export const WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION = 'website_popup:execute' as const;
export type WebsitePopupExecutionBridgeRequest = {
    action: typeof WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION;
    /** Optional correlation ID for website/background execution diagnostics. */
    requestId?: string;
    operation: {
        kind: 'open-web-collection';
        organisationId: string;
        collectionId: string;
    } | {
        kind: 'open-web-collection-item';
        organisationId: string;
        collectionId: string;
        itemId: string;
    } | {
        kind: 'save-chat-to-target';
        entity: 'prompt' | 'agent';
        targetId: string;
        page: WebsitePopupPageReference;
    } | {
        kind: 'open-entity';
        entity: WebsitePopupEntityKind;
        targetId: string;
    } | {
        kind: 'open-entity-editor';
        entity: Exclude<WebsitePopupEntityKind, 'bookmark'>;
        targetId: string;
    } | {
        kind: 'update-result-entity';
        entity: WebsitePopupEntityKind;
        targetId: string;
        expectedUpdatedAt?: number;
        expectedBookmark?: WebsitePopupPageReference;
        changes: WebsitePopupResultEditChanges;
    } | {
        kind: 'get-result-favorite' | 'set-result-favorite';
        entity: WebsitePopupEntityKind;
        targetId: string;
        favorite?: boolean;
    } | {
        kind: 'get-result-hotkey' | 'set-result-hotkey';
        entity: WebsitePopupTextCommandTargetEntity;
        targetId: string;
        value?: string;
        approval?: import('./websitePopupHotkeyBridgeContract').WebsitePopupHotkeyConflict;
    } | {
        kind: 'update-item-text-command';
        entity: WebsitePopupTextCommandTargetEntity;
        targetId: string;
        value: string;
        expectedValue: string;
        expectedReferenceId: string;
        approval?: import('./websitePopupTextCommandBridgeContract').WebsitePopupTextCommandConflict;
    } | {
        kind: 'execute-page-extraction';
        actionId: string;
    } | {
        kind: 'summarize-page';
        context: WebsitePopupPageContext;
    } | {
        kind: 'create-entity';
        entity: WebsitePopupBaseCreateEntity;
        draft: WebsitePopupBaseCreateDraft;
        createAnother: boolean;
    } | {
        kind: 'assign-created-text-command';
        entity: WebsitePopupBaseCreateEntity;
        entityId: string;
        title: string;
        value: string;
        approval?: WebsitePopupBaseCreateDraft['textCommandApproval'];
        hotkey?: string;
        hotkeyApproval?: WebsitePopupBaseCreateDraft['hotkeyApproval'];
        favorite?: boolean;
        createAnother: boolean;
    } | {
        kind: 'assign-created-favorite';
        entity: WebsitePopupBaseCreateEntity;
        entityId: string;
        title: string;
        createAnother: boolean;
    } | {
        kind: 'assign-created-hotkey';
        entity: WebsitePopupBaseCreateEntity;
        entityId: string;
        title: string;
        value: string;
        approval?: WebsitePopupBaseCreateDraft['hotkeyApproval'];
        favorite?: boolean;
        createAnother: boolean;
    } | {
        kind: 'complete-created-todo';
        entityId: string;
        title: string;
        isAnytime: boolean;
        textCommand?: string;
        approval?: WebsitePopupBaseCreateDraft['textCommandApproval'];
        hotkey?: string;
        hotkeyApproval?: WebsitePopupBaseCreateDraft['hotkeyApproval'];
        favorite?: boolean;
        createAnother: boolean;
    } | {
        kind: 'save-page-to-entity';
        entity: WebsitePopupSaveTargetEntity;
        targetId: string;
        page: WebsitePopupPageReference;
    } | {
        kind: 'send-to-agent';
        targetKind: 'prompt' | 'agent';
        targetId: string;
        context: WebsitePopupPageContext;
        composition?: never;
    } | {
        kind: 'send-to-agent';
        targetKind: 'prompt' | 'agent';
        targetId: string;
        composition: TemporaryPromptComposition;
        context?: never;
    };
};
export type WebsitePopupExecutionBridgeResponse = {
    success: true;
    outcome: WebsitePopupExecutionOutcome;
} | {
    success: false;
    error: string;
};
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown) => typeof value === 'string';
const isId = (value: unknown) => isString(value) && Boolean((value as string).trim());
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString);
const isStringMap = (value: unknown) => isObject(value) && Object.values(value).every(isString);
const entities = ['note', 'link', 'snippet', 'todo', 'bookmark', 'prompt', 'agent', 'collection'];
const creators = ['note', 'link', 'snippet', 'todo', 'agent'];
const optional = (object: Record<string, unknown>, key: string, check: (value: unknown) => boolean) => object[key] === undefined || check(object[key]);
const textApproval = (value: unknown) => isObject(value) && ['shortcut', 'command'].includes(String(value.kind)) && isId(value.id) && isString(value.label)
    && optional(value, 'referenceId', isString) && optional(value, 'referenceType', isString);
const hotkeyApproval = (value: unknown) => isObject(value) && isId(value.id) && isString(value.label) && isString(value.referenceId) && isString(value.referenceType);
const page = (value: unknown) => isObject(value) && isString(value.url) && isString(value.title);
const context = (value: unknown) => page(value) && isObject(value) && isString(value.text);
const models = (value: unknown) => isObject(value) && isStringArray(value.enabledModelIds) && isStringMap(value.modelUrls)
    && Array.isArray(value.customModels) && value.customModels.every(model => isObject(model) && isId(model.id) && isString(model.name) && isString(model.host));
const selection = (value: unknown) => isObject(value) && isId(value.id) && isString(value.label) && isString(value.serializedValue)
    && optional(value, 'kind', kind => ['url', 'tag', 'reference'].includes(String(kind)))
    && ['referenceType', 'targetId', 'url', 'favIconUrl'].every(key => optional(value, key, isString))
    && optional(value, 'source', source => source === 'tab' || source === 'custom')
    && optional(value, 'workspaceId', id => id === null || isString(id));
const draft = (value: unknown) => isObject(value) && isStringMap(value.fieldValues)
    && optional(value, 'modelSelection', models) && optional(value, 'textCommandApproval', textApproval) && optional(value, 'hotkeyApproval', hotkeyApproval)
    && optional(value, 'selectedValuesByField', values => isObject(values) && Object.values(values).every(items => Array.isArray(items) && items.every(selection)));
const changes = (value: unknown) => isObject(value) && isString(value.title)
    && ['content', 'rules'].every(key => optional(value, key, isString))
    && ['tagIds', 'enabledModelIds'].every(key => optional(value, key, isStringArray))
    && optional(value, 'modelUrls', isStringMap)
    && optional(value, 'customModels', items => Array.isArray(items) && items.every(item => isObject(item) && isId(item.id) && isString(item.name) && isString(item.host)))
    && optional(value, 'urls', items => Array.isArray(items) && items.every(item => isObject(item) && isString(item.id) && isString(item.url)
        && ['title', 'source', 'favIconUrl'].every(key => optional(item, key, isString))))
    && optional(value, 'references', items => Array.isArray(items) && items.every(item => isObject(item) && isString(item.type) && isId(item.id) && optional(item, 'name', isString)))
    && optional(value, 'scheduleType', type => type === 'one-time' || type === 'recurring')
    && optional(value, 'recurringType', type => ['daily', 'weekly', 'monthly'].includes(String(type)))
    && optional(value, 'scheduleTime', time => typeof time === 'number' && Number.isFinite(time))
    && optional(value, 'isDone', done => typeof done === 'boolean');
export function isWebsitePopupExecutionBridgeRequest(value: unknown): value is WebsitePopupExecutionBridgeRequest {
    if (!isObject(value) || value.action !== WEBSITE_POPUP_EXECUTION_BRIDGE_ACTION || !isObject(value.operation))
        return false;
    const operation = value.operation;
    const entityTarget = () => entities.includes(String(operation.entity)) && isId(operation.targetId);
    const assignmentTarget = () => (operation.entity === 'webCollection' || entities.includes(String(operation.entity))) && isId(operation.targetId);
    const followup = () => creators.includes(String(operation.entity)) && isId(operation.entityId) && isString(operation.title) && typeof operation.createAnother === 'boolean';
    const remaining = () => optional(operation, 'hotkey', isString) && optional(operation, 'hotkeyApproval', hotkeyApproval) && optional(operation, 'favorite', flag => typeof flag === 'boolean');
    switch (operation.kind) {
        case 'open-web-collection': return isId(operation.organisationId) && isId(operation.collectionId);
        case 'open-web-collection-item': return isId(operation.organisationId) && isId(operation.collectionId) && isId(operation.itemId);
        case 'save-chat-to-target': return ['prompt', 'agent'].includes(String(operation.entity)) && isId(operation.targetId) && page(operation.page);
        case 'open-entity-editor': return entityTarget() && operation.entity !== 'bookmark';
        case 'open-entity':
        case 'get-result-favorite': return entityTarget();
        case 'get-result-hotkey': return assignmentTarget();
        case 'set-result-favorite': return entityTarget() && typeof operation.favorite === 'boolean';
        case 'set-result-hotkey': return assignmentTarget() && isString(operation.value) && optional(operation, 'approval', hotkeyApproval);
        case 'update-result-entity': return entityTarget() && changes(operation.changes) && optional(operation, 'expectedBookmark', page)
            && optional(operation, 'expectedUpdatedAt', time => typeof time === 'number' && Number.isFinite(time));
        case 'update-item-text-command': return assignmentTarget() && isString(operation.value) && isString(operation.expectedValue)
            && isString(operation.expectedReferenceId) && optional(operation, 'approval', textApproval);
        case 'execute-page-extraction': return isId(operation.actionId);
        case 'summarize-page': return context(operation.context);
        case 'send-to-agent': return ['prompt', 'agent'].includes(String(operation.targetKind)) && isId(operation.targetId)
            && (operation.composition === undefined ? context(operation.context)
                : operation.context === undefined && isTemporaryPromptComposition(operation.composition));
        case 'create-entity': return creators.includes(String(operation.entity)) && draft(operation.draft) && typeof operation.createAnother === 'boolean';
        case 'assign-created-text-command': return followup() && isString(operation.value) && optional(operation, 'approval', textApproval) && remaining();
        case 'assign-created-hotkey': return followup() && isString(operation.value) && optional(operation, 'approval', hotkeyApproval) && remaining();
        case 'assign-created-favorite': return followup();
        case 'complete-created-todo': return isId(operation.entityId) && isString(operation.title) && typeof operation.isAnytime === 'boolean'
            && typeof operation.createAnother === 'boolean' && optional(operation, 'textCommand', isString) && optional(operation, 'approval', textApproval) && remaining();
        case 'save-page-to-entity': return ['note', 'link', 'todo', 'snippet', 'prompt', 'collection'].includes(String(operation.entity)) && isId(operation.targetId) && page(operation.page);
        default: return false;
    }
}
