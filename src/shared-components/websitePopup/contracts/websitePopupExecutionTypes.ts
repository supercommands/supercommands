/** Central semantic contracts for popup activation and execution. */
import type { WebsiteCollectionCaptureType } from '../../commands/websiteCollectionCommands';
import type { WebsitePopupTodoAttachmentType } from './websitePopupCreateOptionsBridgeContract';
export type WebsitePopupEntityKind = 'note' | 'link' | 'snippet' | 'todo' | 'bookmark' | 'prompt' | 'agent' | 'collection';
export type WebsitePopupBaseCreateEntity = 'note' | 'link' | 'todo' | 'snippet' | 'agent';
/** Assignment-only targets do not imply result editing, creation or favorite support. */
export type WebsitePopupTextCommandTargetEntity = WebsitePopupEntityKind | 'webCollection';
export type WebsitePopupResultEditChanges = {
    title: string;
    content?: string;
    rules?: string;
    urls?: Array<{
        id: string;
        title?: string;
        url: string;
        source?: string;
        favIconUrl?: string;
    }>;
    tagIds?: string[];
    scheduleType?: 'one-time' | 'recurring';
    recurringType?: 'daily' | 'weekly' | 'monthly';
    scheduleTime?: number;
    isDone?: boolean;
    references?: Array<{
        type: string;
        id: string;
        name?: string;
    }>;
    modelUrls?: Record<string, string>;
    customModels?: Array<{
        id: string;
        name: string;
        host: string;
    }>;
    enabledModelIds?: string[];
};
export type WebsitePopupSaveTargetEntity = 'note' | 'link' | 'todo' | 'snippet' | 'prompt' | 'collection';
/** Minimal current-page data passed from the content surface to Save adapters. */
export type WebsitePopupPageReference = {
    url: string;
    title: string;
};
export type WebsitePopupBaseCreateDraft = {
    fieldValues: Record<string, string>;
    modelSelection?: import('../websitePopupModelSelection').WebsitePopupAiPromptModelValue;
    /** Exact conflict approved by an explicit Overwrite click, never inferred from typing. */
    textCommandApproval?: import('./websitePopupTextCommandBridgeContract').WebsitePopupTextCommandConflict;
    /** Exact Hotkey owner approved by an explicit Overwrite click. */
    hotkeyApproval?: import('./websitePopupHotkeyBridgeContract').WebsitePopupHotkeyConflict;
    /**
     * Structured selections are kept separate from the compatibility text
     * serialization in fieldValues. The background uses them when a creator
     * requires source metadata, such as Link URLs selected from Chrome tabs.
     */
    selectedValuesByField?: Record<string, Array<{
        id: string;
        label: string;
        serializedValue: string;
        kind?: 'url' | 'tag' | 'reference';
        referenceType?: WebsitePopupTodoAttachmentType;
        targetId?: string;
        url?: string;
        source?: 'tab' | 'custom';
        favIconUrl?: string;
        workspaceId?: string | null;
    }>>;
};
export type WebsitePopupExecutionIntent = {
    kind: 'open-web-collection';
    organisationId: string;
    collectionId: string;
} | {
    kind: 'select-collection';
    collectionId: string;
} | {
    kind: 'collection-capture-start';
    itemType: WebsiteCollectionCaptureType;
    entry?: 'direct';
} | {
    kind: 'collection-destination-select';
    collectionId: string;
    collectionName: string;
} | {
    kind: 'collection-destination-create';
    name: string;
} | {
    kind: 'open-web-collection-item';
    organisationId: string;
    collectionId: string;
    itemId: string;
} | {
    kind: 'collection-mode';
    mode: 'collection-actions';
} | {
    kind: 'stage-chat-save';
    entity: 'prompt' | 'agent';
    targetId: string;
} | {
    kind: 'open-entity';
    entity: WebsitePopupEntityKind;
    targetId: string;
} | {
    kind: 'page-action';
    actionId: 'send_to_agent' | 'summarize_page';
} | {
    kind: 'send-to-agent-target';
    targetKind: 'prompt' | 'agent';
    targetId: string;
} | {
    kind: 'page-extraction';
    actionId: 'capture_screenshot_tools' | 'capture_visible_screenshot' | 'capture_clip_screenshot' | 'capture_full_page_png' | 'capture_full_page_jpg' | 'capture_full_page_pdf' | 'downloadallimages' | 'downloadalltables' | 'merge_windows' | 'close_duplicate_tabs' | 'mute_all_tabs' | 'unmute_all_tabs';
} | {
    kind: 'enter-mode';
    mode: 'create' | 'save' | 'filter';
    entity?: string;
    query?: string;
    returnToCreateChooser?: boolean;
} | {
    /** Local Create-draft commitment; never reaches background execution. */
    kind: 'create-property-select';
    field: string;
    optionId: string;
    label: string;
    serializedValue: string;
    multiple: boolean;
    selection?: {
        kind: 'url';
        url: string;
        source: 'tab' | 'custom';
        favIconUrl?: string;
    } | {
        kind: 'tag';
        workspaceId: string | null;
    } | {
        kind: 'reference';
        referenceType: WebsitePopupTodoAttachmentType;
        targetId: string;
    };
} | {
    /** Local Create composer action; never reaches background execution. */
    kind: 'create-option-add';
    field: string;
} | {
    /** Creates a global tag and commits its returned ID to the local draft. */
    kind: 'create-tag';
    name: string;
} | {
    /** Explicit Save destination action; execution remains background-owned. */
    kind: 'save-page-to-entity';
    entity: WebsitePopupSaveTargetEntity;
    targetId: string;
};
export type WebsitePopupActivationRequest = {
    /** Committing Space is distinct from Enter so Create can select its presentation. */
    source: 'click' | 'keyboard-enter' | 'keyboard-space';
    intent: WebsitePopupExecutionIntent;
    rowId: string;
    requestId: string;
};
export type WebsitePopupExecutionOutcome = {
    status: 'chat-saved';
    entity: 'prompt' | 'agent';
    targetId: string;
    title: string;
    changed: boolean;
} | {
    status: 'entity-opened';
    entity: WebsitePopupEntityKind;
    targetId: string;
} | {
    status: 'entity-updated';
    entity: WebsitePopupEntityKind;
    targetId: string;
} | {
    status: 'favorite-state' | 'favorite-updated';
    entity: WebsitePopupEntityKind;
    targetId: string;
    favorite: boolean;
} | {
    status: 'hotkey-state' | 'hotkey-updated';
    entity: WebsitePopupTextCommandTargetEntity;
    targetId: string;
    value: string;
} | {
    status: 'text-command-updated';
    entity: WebsitePopupTextCommandTargetEntity;
    targetId: string;
    value: string;
    /** Persisted identity for repeated edits without reopening the assignment popup. */
    referenceId?: string;
} | {
    status: 'action-executed';
    actionId: string;
} | {
    status: 'manual-surface-opened';
    actionId: string;
} | {
    status: 'mode-entered';
    mode: 'create' | 'save' | 'filter';
} | {
    status: 'entity-created';
    entity: WebsitePopupBaseCreateEntity;
    entityId: string;
    title: string;
    createAnother: boolean;
} | {
    status: 'entity-created-shortcut-pending';
    entity: WebsitePopupBaseCreateEntity;
    entityId: string;
    title: string;
    message: string;
    createAnother: boolean;
} | {
    status: 'entity-created-favorite-pending';
    entity: WebsitePopupBaseCreateEntity;
    entityId: string;
    title: string;
    message: string;
    createAnother: boolean;
} | {
    status: 'entity-created-hotkey-pending';
    entity: WebsitePopupBaseCreateEntity;
    entityId: string;
    title: string;
    message: string;
    createAnother: boolean;
} | {
    status: 'entity-created-todo-followup-pending';
    entityId: string;
    title: string;
    message: string;
    isAnytime: boolean;
    createAnother: boolean;
} | {
    status: 'page-saved';
    entity: WebsitePopupSaveTargetEntity;
    targetId: string;
    title: string;
    changed: boolean;
} | {
    status: 'cancelled';
} | {
    status: 'failed';
    message: string;
};
export type WebsitePopupPageContext = {
    url: string;
    title: string;
    text: string;
};

/** popup save requirements are separate from the fields shown in the composer. */
export function isWebsitePopupCreateFieldRequired(entity: string, field: { field: string; required?: boolean }): boolean {
    return Boolean(field.required) && !(entity === 'note' && field.field === 'description');
}
