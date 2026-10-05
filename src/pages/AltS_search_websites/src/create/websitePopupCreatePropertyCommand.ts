/**
 * Background-grammar-only Create optional-field lookup.
 *
 * The Option chooser and future value providers share this filter so enabled
 * fields, configured prefixes, and registry order remain centralized.
 */
import type { WebsitePopupCreateEntityGrammar, WebsitePopupCreateFieldGrammar, WebsitePopupCreateFieldSource, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
const TODO_PROPERTY_ORDER: readonly WebsitePopupCreateFieldSource[] = [
    'recurring',
    'time',
    'attachments',
    'tags',
    'favorite',
    'shortcut',
    'hotkey'
];
const todoPropertyRank = (field: WebsitePopupCreateFieldGrammar) => {
    const index = field.source ? TODO_PROPERTY_ORDER.indexOf(field.source) : -1;
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
};
/** Shared presentation order for Create and saved-item property adapters. */
export function sortWebsitePopupPropertyFields(entity: string, fields: readonly WebsitePopupCreateFieldGrammar[]): WebsitePopupCreateFieldGrammar[] {
    return [...fields].sort((left, right) => entity === 'todo'
        ? todoPropertyRank(left) - todoPropertyRank(right) || left.sequence - right.sequence
        : left.sequence - right.sequence);
}
/** Use the background grammar to populate the inline Option input and chooser. */
export function getWebsitePopupCreatePropertyFields(grammar: WebsitePopupCreateEntityGrammar): WebsitePopupCreateFieldGrammar[] {
    return sortWebsitePopupPropertyFields(grammar.entity, grammar.fields.filter(field => !field.required && field.primaryPrefix && field.prefixes.length > 0 && field.tabCycle !== false));
}
