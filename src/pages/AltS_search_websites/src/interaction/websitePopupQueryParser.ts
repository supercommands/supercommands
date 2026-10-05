/**
 * popup adapter around the shared command-chain parser.
 *
 * It derives every grammar token from the live prefix-settings snapshot and
 * returns metadata only. Rendering and execution remain outside this module.
 */
import { parseCommandSpace } from '../../../../shared-components/commandTerminal';
import { parseCategoryCommandIntent, type CategoryCommandIntent } from '../../../../shared-components/commandTerminal';
import { WEBSITE_SAVE_AS_DEFINITIONS } from '../../../../shared-components/commands/websiteSaveAs';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import { WEBSITE_POPUP_FILTER_CATEGORIES } from '../catalog/websitePopupFilterCatalog';
export type WebsitePopupParsedIntent = CategoryCommandIntent | {
    kind: 'collection';
    mode: 'collection-actions';
    query: string;
} | {
    kind: 'save' | 'filter';
    entity: null;
    query: '';
    actionPrefix: string;
    categoryPrefix: '';
} | {
    kind: 'filter';
    entity: null;
    query: string;
    actionPrefix: '/';
    categoryPrefix: string;
};
/**
 * Temporary popup availability policy: retain the complete Create parser and
 * composer implementation while preventing every user-facing Create entry.
 */
export const IS_WEBSITE_POPUP_CREATE_ENTRY_ENABLED = true;
const ACTION_ENTITY_IDS = Array.from(new Set([
    ...WEBSITE_SAVE_AS_DEFINITIONS.map(definition => definition.destinationCategory),
    ...WEBSITE_POPUP_FILTER_CATEGORIES,
    'bookmark',
    'prompt'
]));
export function parseWebsitePopupQuery(inputValue: string, prefixSettings: {
    categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    subcommandPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    actionGrammar: readonly WebsitePopupActionGrammar[];
    canSaveChat?: boolean;
    canCaptureCollection?: boolean;
}): WebsitePopupParsedIntent {
    const normalizedInput = String(inputValue || '').replace(/\u00A0/g, ' ');
    if (normalizedInput.startsWith('/')) {
        const slashQuery = normalizedInput.slice(1).trimStart();
        const categoryToken = slashQuery.split(/\s+/)[0] || '';
        const matchedCategory = WEBSITE_POPUP_FILTER_CATEGORIES
            .map(entity => ({
            entity,
            setting: prefixSettings.categoryPrefixSettings.find(setting => setting.type === 'category' && setting.category === entity && setting.enabled),
        }))
            .find(candidate => candidate.setting && (String(candidate.setting.prefix || '').trim().toLowerCase() === categoryToken.toLowerCase()
            || (candidate.entity !== 'collection' && candidate.entity.toLowerCase() === categoryToken.toLowerCase())));
        if (!matchedCategory || slashQuery === categoryToken) {
            return {
                kind: 'filter', entity: null, query: slashQuery, actionPrefix: '/',
                categoryPrefix: String(matchedCategory?.setting?.prefix || '').trim(),
            };
        }
        return {
            kind: 'filter',
            entity: matchedCategory.entity,
            query: slashQuery.slice(categoryToken.length).trimStart(),
            actionPrefix: '/',
            categoryPrefix: String(matchedCategory.setting?.prefix || '').trim(),
        };
    }
    const commandPrefix = String(prefixSettings.categoryPrefixSettings.find(setting => setting.type === 'category' && setting.category === 'command')?.prefix || '').trim();
    const collectionSetting = prefixSettings.categoryPrefixSettings.find(row => row.category === 'collection_capture' && row.enabled);
    if (prefixSettings.canCaptureCollection && collectionSetting?.prefix.trim()) {
        const category = parseCommandSpace(normalizedInput, { command: commandPrefix, collection_capture: collectionSetting.prefix }, { allowedCategories: ['collection_capture'] });
        if (category.activeCategoryFilter === 'collection_capture') {
            return { kind: 'collection', mode: 'collection-actions', query: category.actualQuery };
        }
    }
    const actionPrefixes = prefixSettings.actionGrammar;
    const hasCommandHead = Boolean(commandPrefix)
        && normalizedInput.slice(0, commandPrefix.length).toLowerCase() === commandPrefix.toLowerCase()
        && /\s/.test(normalizedInput[commandPrefix.length] || '');
    const bareActionToken = hasCommandHead
        ? normalizedInput.slice(commandPrefix.length).trim().toLowerCase()
        : '';
    const bareAction = actionPrefixes.find(entry => Boolean(bareActionToken) && bareActionToken === entry.prefix.toLowerCase());
    if (bareAction) {
        // Bare Save/Filter stays editable search text, including its trailing space.
        // Choosing a destination still enters the existing entity-specific mode.
        return { kind: 'none' };
    }
    const entityIds = Array.from(new Set([
        ...ACTION_ENTITY_IDS,
        ...prefixSettings.createGrammar.map(grammar => grammar.entity)
    ]));
    const entities = entityIds.flatMap(entity => {
        const categorySetting = prefixSettings.categoryPrefixSettings.find(setting => setting.type === 'category' && setting.category === entity);
        if (!categorySetting?.enabled || !String(categorySetting.prefix || '').trim())
            return [];
        const createGrammar = prefixSettings.createGrammar.find(grammar => grammar.entity === entity);
        return [{
                entity,
                categoryPrefix: String(categorySetting.prefix).trim(),
                createFieldPrefixEntries: createGrammar?.fieldPrefixes,
            }];
    });
    const parsedIntent = parseCategoryCommandIntent(inputValue, {
        commandPrefix,
        entities,
        actionPrefixes,
    });
    if (parsedIntent.kind !== 'none') {
        if (parsedIntent.kind === 'save' && parsedIntent.entity === 'agent' && !prefixSettings.canSaveChat)
            return { kind: 'none' };
        if (parsedIntent.kind === 'create' && !IS_WEBSITE_POPUP_CREATE_ENTRY_ENABLED) {
            return { kind: 'none' };
        }
        return parsedIntent;
    }
    if (!IS_WEBSITE_POPUP_CREATE_ENTRY_ENABLED)
        return { kind: 'none' };
    const normalizedSource = normalizedInput.trim().toLowerCase();
    const chooserEntity = entities.find(entity => normalizedSource === `${commandPrefix} ${entity.categoryPrefix.toLowerCase()}`
        && Boolean(entity.createFieldPrefixEntries));
    return chooserEntity
        ? {
            kind: 'create',
            entity: chooserEntity.entity,
            query: '',
            phase: 'chooser',
            categoryPrefix: chooserEntity.categoryPrefix,
        }
        : { kind: 'none' };
}
