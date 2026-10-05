/**
 * Typed message contract shared by the popup content client and background handler.
 *
 * The contract exposes domain operations rather than raw table access so the
 * extension background remains the only IndexedDB authority.
 */
import type { PrefixSettingRecord } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export const WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION = 'website_popup:prefix_settings' as const;
/**
 * Effective Create grammar is resolved in the background from prefix settings.
 * These behavioral values are copied from the shared field-capability registry
 * so future popup property providers never need entity-specific conditionals.
 */
export type WebsitePopupCreateFieldKind = 'text' | 'multiSelect' | 'singleSelect' | 'boolean' | 'capture' | 'validatedUnique';
export type WebsitePopupCreateFieldSource = 'tags' | 'browserLinks' | 'attachments' | 'recurring' | 'time' | 'favorite' | 'hotkey' | 'shortcut';
export type WebsitePopupCreateFieldGrammar = {
    field: string;
    label: string;
    required: boolean;
    mustCompleteWhenAdded: boolean;
    kind: WebsitePopupCreateFieldKind;
    description: string;
    sequence: number;
    visibleInLeftComposer: boolean;
    tabCycle: boolean;
    allowSpaceInQuery: boolean;
    source?: WebsitePopupCreateFieldSource;
    control?: 'input' | 'textarea';
    width?: 'short' | 'medium' | 'long';
    maximumRows?: number;
    primaryPrefix: string;
    prefixes: string[];
};
export type WebsitePopupCreateEntityGrammar = {
    entity: string;
    fieldPrefixes: Array<{
        field: string;
        prefix: string;
    }>;
    fields: WebsitePopupCreateFieldGrammar[];
};
export type WebsitePopupActionGrammar = {
    action: 'save' | 'filter';
    prefix: string;
};
export type WebsitePopupPrefixSettingsBridgeRequest = {
    action: typeof WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION;
    operation: 'list-default-prefixes';
} | {
    action: typeof WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION;
    operation: 'update-prefix';
    type: 'category' | 'action' | 'subcommand';
    category: string;
    value: string;
    expectedValue: string;
    approval?: import('../../shortcuts/core/shortcutAssignmentTypes').ShortcutAssignmentApproval;
};
export type WebsitePopupPrefixSettingsBridgeResponse = {
    success: true;
    updatedPrefix: string;
} | {
    success: true;
    categoryPrefixSettings: PrefixSettingRecord[];
    actionPrefixSettings: PrefixSettingRecord[];
    subcommandPrefixSettings: PrefixSettingRecord[];
    createGrammar: WebsitePopupCreateEntityGrammar[];
    actionGrammar: WebsitePopupActionGrammar[];
} | {
    success: false;
    error: string;
};
export function isWebsitePopupPrefixSettingsBridgeRequest(value: unknown): value is WebsitePopupPrefixSettingsBridgeRequest {
    if (!value || typeof value !== 'object')
        return false;
    const request = value as Record<string, unknown>;
    if (request.action !== WEBSITE_POPUP_PREFIX_SETTINGS_BRIDGE_ACTION)
        return false;
    return request.operation === 'list-default-prefixes'
        || (request.operation === 'update-prefix'
            && (request.type === 'category' || request.type === 'action' || request.type === 'subcommand')
            && typeof request.category === 'string'
            && typeof request.value === 'string' && typeof request.expectedValue === 'string');
}
