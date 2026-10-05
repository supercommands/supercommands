/** Saved-item field definitions reuse Create's capability registry; command prefixes do not limit editing. */
import { getCreateComposerFieldCapabilities, type CreateComposerEntity, } from '../../../../shared-components/commandTerminal/chaining/entityCreateFieldsRegistry';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupResultEditTarget } from '../display/websitePopupDisplayTypes';
import { sortWebsitePopupPropertyFields } from '../create/websitePopupCreatePropertyCommand';
export function getWebsitePopupResultPropertyGrammar(entity: WebsitePopupResultEditTarget['entity']): WebsitePopupCreateEntityGrammar {
    const base: CreateComposerEntity = entity === 'todo' || entity === 'link' || entity === 'snippet' || entity === 'agent' ? entity : 'note';
    const capabilities = getCreateComposerFieldCapabilities(base).filter(field => Boolean(field.source));
    if (entity === 'collection' || entity === 'bookmark') {
        capabilities.unshift(...getCreateComposerFieldCapabilities('link').filter(field => field.source === 'browserLinks'));
    }
    return {
        entity,
        fieldPrefixes: [],
        fields: sortWebsitePopupPropertyFields(entity, capabilities
            .filter(field => !['bookmark', 'collection'].includes(entity) || field.source !== 'tags')
            .map((field, sequence) => ({
            ...field,
            ...field.presentation,
            required: Boolean(field.required),
            mustCompleteWhenAdded: Boolean(field.mustCompleteWhenAdded),
            visibleInLeftComposer: field.visibleInLeftComposer !== false,
            tabCycle: true,
            allowSpaceInQuery: Boolean(field.allowSpaceInQuery),
            sequence,
            primaryPrefix: '',
            prefixes: [],
        }))),
    };
}
