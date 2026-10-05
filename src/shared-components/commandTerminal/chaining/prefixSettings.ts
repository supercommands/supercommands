import type { CategoryCommandChainActionPrefixEntry, PrefixSettingRecordLike } from './types';
/**
 * Shared prefix-setting extraction for category command chains.
 *
 * This file reads existing prefix-setting rows and derives create-field tokens
 * from them. It intentionally stores setting category keys only; user-
 * customizable prefix values remain in the prefix settings table.
 */
/**
 * Prefix-setting categories that represent create-field tokens in a chain.
 *
 * The actual field prefixes, such as title or description markers, are read
 * from prefix-setting rows instead of being duplicated here.
 */
const CATEGORY_COMMAND_CHAIN_FIELD_SETTINGS = new Set([
    'field_title',
    'field_title_long',
    'field_title_alias_name',
    'field_title_alias_plain',
    'field_description',
    'field_description_long',
    'field_description_alias_desc',
    'field_description_alias_body',
    'field_url',
    'field_url_long',
    'field_tag',
    'field_tag_plural',
    'field_hotkey',
    'field_hotkey_long',
    'field_shortcut',
    'field_shortcut_long',
    'field_time',
    'field_recurring',
    'field_recurring_long',
    'field_reference',
    'field_reference_attach',
    'field_reference_attachment',
    'field_reference_long'
]);
const CATEGORY_COMMAND_CHAIN_ACTION_SETTINGS: Record<string, CategoryCommandChainActionPrefixEntry['action']> = {
    chain_action_save: 'save',
    chain_action_save_long: 'save',
    chain_action_filter: 'filter',
    chain_action_filter_long: 'filter',
    chain_action_filter_alias_plain: 'filter',
    chain_action_favorite: 'favorite',
    chain_action_favorite_long: 'favorite',
    chain_action_favorite_alias_plain: 'favorite',
    chain_action_unfavorite: 'unfavorite',
    chain_action_unfavorite_long: 'unfavorite',
    chain_action_unfavorite_alias_plain: 'unfavorite',
};
/**
 * Readable grammar aliases complement configured dash-prefixed action tokens.
 * They are enabled only when that action has at least one enabled settings row,
 * so prefix settings remain the authority for whether Save/Filter are usable.
 */
const CATEGORY_COMMAND_CHAIN_READABLE_ACTION_ALIASES: Record<'save' | 'filter', readonly string[]> = {
    save: ['save'],
    filter: ['filter', 'search'],
};
/**
 * Normalizes chain action and field prefixes before parser comparison.
 */
export const normalizeChainPrefix = (value: unknown) => String(value || '')
    .trim()
    .toLowerCase();
const isCurrentChainPrefix = (prefix: string) => {
    return prefix.startsWith('-') && !prefix.startsWith('--');
};
/**
 * Extracts configured chain field prefixes from existing prefix-setting rows.
 *
 * These are the markers used for create fields inside a chain. The parser only
 * needs the prefix strings; field-specific meaning remains with the caller.
 */
export function getCategoryCommandChainFieldPrefixes(prefixSettings?: PrefixSettingRecordLike[] | null): string[] {
    return Array.from(new Set((Array.isArray(prefixSettings) ? prefixSettings : [])
        .filter(row => row.enabled !== false && row.type === 'subcommand')
        .filter(row => CATEGORY_COMMAND_CHAIN_FIELD_SETTINGS.has(String(row.category || '')))
        .map(row => normalizeChainPrefix(row.prefix))
        .filter(prefix => prefix && isCurrentChainPrefix(prefix)))).sort((a, b) => b.length - a.length);
}
export function getCategoryCommandChainActionPrefixEntries(prefixSettings?: PrefixSettingRecordLike[] | null): CategoryCommandChainActionPrefixEntry[] {
    const configuredEntries = (Array.isArray(prefixSettings) ? prefixSettings : [])
        .filter(row => row.enabled !== false && row.type === 'subcommand')
        .map(row => ({
        action: CATEGORY_COMMAND_CHAIN_ACTION_SETTINGS[String(row.category || '')],
        prefix: normalizeChainPrefix(row.prefix),
    }))
        .filter((entry): entry is CategoryCommandChainActionPrefixEntry => Boolean(entry.action && entry.prefix && isCurrentChainPrefix(entry.prefix)));
    const enabledActions = new Set(configuredEntries.map(entry => entry.action));
    const seen = new Set<string>();
    return [
        ...configuredEntries,
        ...(['save', 'filter'] as const).flatMap(action => enabledActions.has(action)
            ? CATEGORY_COMMAND_CHAIN_READABLE_ACTION_ALIASES[action].map(prefix => ({ action, prefix }))
            : [])
    ]
        .filter(entry => {
        const key = `${entry.action}:${entry.prefix}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
