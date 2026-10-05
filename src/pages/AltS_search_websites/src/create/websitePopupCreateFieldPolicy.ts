import { isWebsitePopupCreateFieldRequired } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
/**
 * Create control and completion policy derived from the background grammar.
 * Field IDs remain domain identities; UI flow depends on kind and source.
 */
import type { WebsitePopupCreateEntityGrammar, WebsitePopupCreateFieldGrammar, WebsitePopupCreateFieldSource, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreateSession } from '../interaction/websitePopupInteractionTypes';
import { WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
export type WebsitePopupCreateControlKind = 'text' | 'textarea' | 'multi-select' | 'single-select' | 'hotkey' | 'text-command' | 'favorite' | 'unsupported';
const MULTI_SELECT_PRESENTATION: Partial<Record<WebsitePopupCreateFieldSource, {
    placeholder: string;
    addPlaceholder: string;
    itemLabel: string;
}>> = {
    browserLinks: { placeholder: 'Add URL or search', addPlaceholder: 'Add another URL', itemLabel: 'URL' },
    tags: { placeholder: 'Search tags', addPlaceholder: 'Add tag', itemLabel: 'tag' },
    attachments: { placeholder: 'Search saved items', addPlaceholder: 'Attach another', itemLabel: 'attachment' },
};
export function getWebsitePopupCreateControlKind(field: WebsitePopupCreateFieldGrammar): WebsitePopupCreateControlKind {
    if (field.kind === 'capture')
        return 'hotkey';
    if (field.kind === 'validatedUnique')
        return 'text-command';
    if (field.kind === 'boolean')
        return 'favorite';
    if (field.kind === 'multiSelect')
        return 'multi-select';
    if (field.kind === 'singleSelect')
        return 'single-select';
    if (field.kind === 'text')
        return field.control === 'textarea' ? 'textarea' : 'text';
    return 'unsupported';
}
export function getWebsitePopupMultiSelectPresentation(field: WebsitePopupCreateFieldGrammar) {
    return field.source ? getWebsitePopupMultiSelectSourcePresentation(field.source) : undefined;
}
export function getWebsitePopupMultiSelectSourcePresentation(source: WebsitePopupCreateFieldSource) {
    return MULTI_SELECT_PRESENTATION[source];
}
export function opensWebsitePopupCreateChildMode(field: WebsitePopupCreateFieldGrammar): boolean {
    return field.kind === 'capture' || field.kind === 'multiSelect' || field.kind === 'singleSelect';
}
export function isWebsitePopupCreateFieldComplete(field: WebsitePopupCreateFieldGrammar, session: WebsitePopupCreateSession | null): boolean {
    if (!session)
        return false;
    if (field.source === 'attachments') {
        return (session.selectedValuesByField[field.field] || []).some(selection => selection.kind === 'reference' && Boolean(selection.referenceType && selection.targetId)
            && WEBSITE_POPUP_TODO_ATTACHMENT_CATEGORIES.some(category => category.type === selection.referenceType));
    }
    return field.kind === 'multiSelect'
        ? (session.selectedValuesByField[field.field] || []).length > 0
        : Boolean(String(session.fieldValues[field.field] || '').trim());
}
export function getIncompleteWebsitePopupCreateField(grammar: WebsitePopupCreateEntityGrammar | null, session: WebsitePopupCreateSession | null): WebsitePopupCreateFieldGrammar | null {
    if (!grammar || !session)
        return null;
    return grammar.fields.find(field => (isWebsitePopupCreateFieldRequired(grammar.entity, field) || (field.mustCompleteWhenAdded
        && session.committedOptionalFieldOrder.includes(field.field)))
        && !isWebsitePopupCreateFieldComplete(field, session)) ?? null;
}
