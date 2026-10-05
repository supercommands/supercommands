import type { WebsitePopupParsedIntent } from './websitePopupQueryParser';
import type { WebsitePopupSendAgentSession, WebsitePopupSendAgentEvent } from './websitePopupSendAgentSession';
import type { WebsitePopupCollectionSession } from './websitePopupCollectionSession';
import type { CollectionCaptureSource } from '../../../../shared-components/collections/collectionCaptureSource';
import type { WebsitePopupScreenshotEvent } from './websitePopupScreenshotSession';
import type { WebsitePopupPresentation } from './websitePopupPresentation';
import type { WebsiteCollectionCaptureType } from '../../../../shared-components/commands/websiteCollectionCommands';
import type { WebsitePopupCreateFieldSource } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupTodoAttachmentType } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import type { WebsitePopupTextCommandCheck, WebsitePopupTextCommandConflict, } from '../../../../shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
import type { WebsitePopupHotkeyCheck, WebsitePopupHotkeyConflict, } from '../../../../shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';
/**
 * Typed contracts for the lightweight popup interaction layer.
 *
 * The model covers root suggestions, create/save/filter modes, and nested
 * manual submodes. It contains no rendered rows or execution callbacks.
 */
export type WebsitePopupBaseRoute = {
    kind: 'default';
    query: '';
} | {
    kind: 'suggestions';
    query: string;
};
export type WebsitePopupSpecializedMode = 'create' | 'save' | 'filter';
/** Presentation belongs to the route, not the draft or background submission. */
export type WebsitePopupCreatePresentation = WebsitePopupPresentation;
export type WebsitePopupSpecializedRoute = {
    entity: string | null;
    query: string;
    returnTo: WebsitePopupBaseRoute;
    /** True only when a typed Create chooser should be restored on back. */
    returnToCreateChooser?: boolean;
} & ({ kind: 'create'; presentation: WebsitePopupCreatePresentation } | { kind: 'save' | 'filter' });
export type WebsitePopupSubmode = {
    id: 'collection-actions';
} | {
    id: 'collection-destination';
} | {
    id: 'collection-item-details';
} | {
    id: 'screenshot-tools';
} | {
    id: 'screenshot-format';
} | {
    id: 'send-agent';
} | {
    id: 'send-agent-compose';
};
export type WebsitePopupSubmodeRoute = {
    kind: 'submode';
    submode: WebsitePopupSubmode;
    query: string;
    returnTo: WebsitePopupRoute;
    /** Collection presentation is route-owned; absent on historical/manual entries means inline. */
    presentation?: WebsitePopupPresentation;
};
export type WebsitePopupRoute = WebsitePopupBaseRoute | WebsitePopupSpecializedRoute | WebsitePopupSubmodeRoute;
export type WebsitePopupInteractionState = {
    inputValue: string;
    collectionSession?: WebsitePopupCollectionSession | null;
    sendAgentSession?: WebsitePopupSendAgentSession | null;
    route: WebsitePopupRoute;
    parsedIntent: WebsitePopupParsedIntent;
    /**
     * Per-route Create UI state. The command-chain query is serialized only
     * while this route is active; leaving Create discards its unfinished draft.
     */
    createSession: WebsitePopupCreateSession | null;
    selectedIndex: number;
    suggestionCount: number;
};
export type WebsitePopupCreateSession = {
    entity: string;
    /** Right-panel configuration only; never serialized into composer fields. */
    modelSelection: import('../../../../shared-components/websitePopup/websitePopupModelSelection').WebsitePopupAiPromptModelValue | null;
    activeArgumentId: string | null;
    visibleFieldOrder: string[];
    fieldSources: Record<string, WebsitePopupCreateFieldSource>;
    fieldValues: Record<string, string>;
    fieldsHydrated: boolean;
    propertyEntryOpen: boolean;
    propertyPrefixDraft: string;
    childMode: string | null;
    /** The optional picker most recently exited with Backspace or Escape. */
    lastExitedChildField: string | null;
    argumentQueries: Record<string, string>;
    selectedValuesByField: Record<string, WebsitePopupCreateSelectedValue[]>;
    /** Ordered optional arguments explicitly added to the composer. */
    committedOptionalFieldOrder: string[];
    textCommandValidation: WebsitePopupTextCommandValidationState;
    textCommandPartial: {
        entityId: string;
        title: string;
        message: string;
        createAnother: boolean;
    } | null;
    favoritePartial: {
        entityId: string;
        title: string;
        message: string;
        createAnother: boolean;
    } | null;
    todoFollowupPartial: {
        entityId: string;
        title: string;
        message: string;
        isAnytime: boolean;
        createAnother: boolean;
    } | null;
    hotkeyValidation: WebsitePopupHotkeyValidationState;
    hotkeyCapture: {
        status: 'idle' | 'arming' | 'recording';
        token: string | null;
        error: string | null;
    };
    hotkeyPartial: {
        entityId: string;
        title: string;
        message: string;
        createAnother: boolean;
    } | null;
    focusRequest: {
        target: string;
        revision: number;
    } | null;
};
export type WebsitePopupTextCommandValidationState = {
    status: 'empty';
    value: '';
} | {
    status: 'checking';
    value: string;
} | WebsitePopupTextCommandCheck | {
    status: 'approved';
    value: string;
    conflict: WebsitePopupTextCommandConflict;
    message: string;
};
export type WebsitePopupHotkeyValidationState = {
    status: 'empty';
    value: '';
} | {
    status: 'checking';
    value: string;
} | WebsitePopupHotkeyCheck | {
    status: 'approved';
    value: string;
    conflict: WebsitePopupHotkeyConflict;
    message: string;
};
/** UI focus owner for the two views of one Create draft. */
export type WebsitePopupCreateSurface = 'composer' | 'panel';
export type WebsitePopupCreateSelectedValue = {
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
};
export type WebsitePopupInteractionEvent = WebsitePopupSendAgentEvent | WebsitePopupScreenshotEvent | {
    type: 'COLLECTION_PANEL_CONFIGURED'; itemType: WebsiteCollectionCaptureType; collectionId: string | null; collectionName: string | null; sourceContext: CollectionCaptureSource; hasRecord?: boolean;
} | {
    type: 'COLLECTION_PANEL_EXITED';
} | {
    type: 'COLLECTION_SELECTED'; id: string | null;
} | {
    type: 'COLLECTION_CAPTURE_STARTED'; itemType: WebsiteCollectionCaptureType; sourceUrl?: string; sourceContext?: CollectionCaptureSource;
} | {
    type: 'COLLECTION_WEB_SCRAPING_READY'; revision: number;
} | {
    type: 'COLLECTION_WEB_SCRAPING_SELECTION_REQUESTED'; revision: number;
} | {
    type: 'COLLECTION_DESTINATION_CHOSEN'; id: string; name: string;
} | {
    type: 'COLLECTION_PICKER_OPENED';
} | {
    type: 'COLLECTION_PICKER_CLOSED';
} | {
    type: 'QUERY_CHANGED';
    query: string;
    parsedIntent?: WebsitePopupParsedIntent;
} | {
    type: 'PARSED_INTENT_CHANGED';
    parsedIntent: WebsitePopupParsedIntent;
} | {
    type: 'MODE_ENTERED';
    mode: 'create';
    presentation: WebsitePopupCreatePresentation;
    entity?: string | null;
    query?: string;
    returnToCreateChooser?: boolean;
} | {
    type: 'MODE_ENTERED';
    mode: 'save' | 'filter';
    entity?: string | null;
    query?: string;
    returnToCreateChooser?: boolean;
} | {
    type: 'SUBMODE_ENTERED';
    submode: WebsitePopupSubmode;
    query?: string;
    presentation?: WebsitePopupPresentation;
} | {
    type: 'CREATE_FIELD_FOCUSED';
    field: string | null;
} | {
    type: 'CREATE_FIELDS_HYDRATED';
    values: Record<string, string>;
    visibleFieldOrder: string[];
    fieldSources: Record<string, WebsitePopupCreateFieldSource>;
    selectedValuesByField?: Record<string, WebsitePopupCreateSelectedValue[]>;
    committedOptionalFieldOrder?: string[];
} | {
    type: 'CREATE_FIELD_VALUE_CHANGED';
    field: string;
    value: string;
} | {
    type: 'CREATE_PROPERTY_ENTRY_CHANGED';
    open: boolean;
} | {
    type: 'CREATE_PROPERTY_PREFIX_DRAFT_CHANGED';
    value: string;
} | {
    type: 'CREATE_CHILD_MODE_CHANGED';
    mode: string | null;
} | {
    type: 'CREATE_ARGUMENT_QUERY_CHANGED';
    field: string;
    value: string;
} | {
    type: 'CREATE_FIELD_SELECTION_CHANGED';
    field: string;
    values: WebsitePopupCreateSelectedValue[];
} | {
    type: 'CREATE_OPTION_ADDED';
    field: string;
    preserveFocus?: boolean;
} | {
    type: 'CREATE_OPTION_PRESENCE_SYNCED';
    field: string;
    present: boolean;
} | {
    type: 'CREATE_OPTION_REMOVED';
    field: string;
} | {
    type: 'CREATE_TEXT_COMMAND_VALIDATION_CHANGED';
    check: WebsitePopupTextCommandCheck;
} | {
    type: 'CREATE_TEXT_COMMAND_OVERWRITE_APPROVED';
    mode?: 'add' | 'overwrite';
} | {
    type: 'CREATE_TEXT_COMMAND_PARTIAL_CHANGED';
    partial: WebsitePopupCreateSession['textCommandPartial'];
} | {
    type: 'CREATE_FAVORITE_PARTIAL_CHANGED';
    partial: WebsitePopupCreateSession['favoritePartial'];
} | {
    type: 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED';
    partial: WebsitePopupCreateSession['todoFollowupPartial'];
} | {
    type: 'CREATE_HOTKEY_VALIDATION_CHANGED';
    check: WebsitePopupHotkeyCheck;
} | {
    type: 'CREATE_HOTKEY_OVERWRITE_APPROVED';
} | {
    type: 'CREATE_HOTKEY_CAPTURE_CHANGED';
    capture: WebsitePopupCreateSession['hotkeyCapture'];
} | {
    type: 'CREATE_HOTKEY_PARTIAL_CHANGED';
    partial: WebsitePopupCreateSession['hotkeyPartial'];
} | {
    type: 'CREATE_FOCUS_REQUESTED';
    target: string;
} | {
    type: 'CREATE_MODEL_SELECTION_CHANGED';
    value: WebsitePopupCreateSession['modelSelection'];
} | {
    type: 'CREATE_RESET_FOR_ANOTHER';
} | {
    type: 'BACK_REQUESTED';
} | {
    type: 'SUGGESTION_COUNT_CHANGED';
    count: number;
} | {
    type: 'SELECTION_SET';
    index: number;
} | {
    type: 'RESET';
};
export type WebsitePopupSuggestionRequest = {
    source: 'default' | 'normal' | WebsitePopupSpecializedMode | 'submode';
    query: string;
    entity: string | null;
};
export type WebsitePopupInteractionStore = {
    state: WebsitePopupInteractionState;
    dispatch: (event: WebsitePopupInteractionEvent) => void;
};
