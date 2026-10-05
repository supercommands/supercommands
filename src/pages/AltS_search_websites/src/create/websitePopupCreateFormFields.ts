/** Grammar-owned field placement; left-composer visibility never hides required standalone fields. */
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreatePresentation } from '../interaction/websitePopupInteractionTypes';

export function getWebsitePopupCreateRequiredFields(grammar: WebsitePopupCreateEntityGrammar | undefined, presentation: WebsitePopupCreatePresentation, visibleFieldOrder: readonly string[] = []) {
    const fields = (grammar?.fields || [])
        .filter(field => field.required && (presentation === 'standalone'
            || Boolean(field.primaryPrefix && field.visibleInLeftComposer !== false && field.tabCycle !== false)))
        .sort((left, right) => left.sequence - right.sequence);
    if (presentation === 'standalone' || visibleFieldOrder.length === 0)
        return fields;
    const fieldsById = new Map(fields.map(field => [field.field, field]));
    return visibleFieldOrder.flatMap(fieldId => {
        const field = fieldsById.get(fieldId);
        return field ? [field] : [];
    });
}
