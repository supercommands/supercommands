import { DEFAULT_COMMAND_TERMINAL_PREFIXES, DEFAULT_PREFIX_ROWS, PREFIX_SETTING_ACTIONS, PREFIX_SETTING_CATEGORIES, type CommandTerminalPrefixes, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingCategory } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import { getEntityCategoryForReferenceType, isReferenceTypeInEntityCategory, } from '../utils/idGenerator';
import type { TriggerSource } from './types';
export type ShortcutCategoryFilter = PrefixSettingCategory;
export type ParsedShortcutInvocation = {
    trigger: string;
    remainingInput: string;
    triggerSource: TriggerSource;
    categoryFilter: ShortcutCategoryFilter | null;
};
export type ShortcutPrefixConfig = Partial<CommandTerminalPrefixes> | string | null | undefined;
export type ShortcutPrefixKey = keyof Required<CommandTerminalPrefixes>;
export type ShortcutFilterMeta = Record<string, {
    label: string;
}>;
export const ACTION_SHORTCUT_PREFIX_KEYS: ShortcutPrefixKey[] = [
    ...PREFIX_SETTING_ACTIONS
] as ShortcutPrefixKey[];
const SHORTCUT_CATEGORY_FILTERS = PREFIX_SETTING_CATEGORIES as readonly ShortcutCategoryFilter[];
const PREFIX_CATEGORY_LABELS: Partial<Record<ShortcutCategoryFilter, string>> = DEFAULT_PREFIX_ROWS
    .filter(row => row.type === 'category')
    .reduce<Partial<Record<ShortcutCategoryFilter, string>>>((labels, row) => {
    labels[row.category as ShortcutCategoryFilter] = row.label;
    return labels;
}, {});
const normalizePrefix = (value: string | null | undefined) => String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
const normalizeShortcutTrigger = (trigger: string) => trigger.trim().toLowerCase();
const getPrefixConfig = (prefixes?: ShortcutPrefixConfig): Required<CommandTerminalPrefixes> => {
    if (typeof prefixes === 'string') {
        return { ...DEFAULT_COMMAND_TERMINAL_PREFIXES, command: normalizePrefix(prefixes) || DEFAULT_COMMAND_TERMINAL_PREFIXES.command };
    }
    return { ...DEFAULT_COMMAND_TERMINAL_PREFIXES, ...(prefixes || {}) };
};
/** Resolve one prefix key from the current custom-prefix snapshot, with defaults supplied by prefix settings. */
export function resolveShortcutPrefix(prefixes: ShortcutPrefixConfig, key: ShortcutPrefixKey): string {
    return normalizePrefix(getPrefixConfig(prefixes)[key]);
}
/** Resolve the system-command prefix without duplicating its default outside prefix settings. */
export function getSystemCommandPrefix(prefixes?: ShortcutPrefixConfig): string {
    return resolveShortcutPrefix(prefixes, 'system_command');
}
/** Convert a saved item/reference type such as `notes`, `chat_agents`, or `ai_prompt` to its prefix-setting key. */
export function getShortcutPrefixKeyForReferenceType(referenceType: string): ShortcutCategoryFilter | null {
    return getEntityCategoryForReferenceType(referenceType);
}
/** Resolve the user-facing category prefix for an item/reference type from the same prefix settings snapshot. */
export function getShortcutCategoryPrefix(prefixes: ShortcutPrefixConfig, referenceType: string): string {
    const prefixKey = getShortcutPrefixKeyForReferenceType(referenceType);
    return prefixKey ? resolveShortcutPrefix(prefixes, prefixKey) : '';
}
/** Return the display label associated with a supported shortcut category/reference type. */
export function getShortcutCategoryLabel(referenceType: string): string {
    const prefixKey = getShortcutPrefixKeyForReferenceType(referenceType);
    return (prefixKey && PREFIX_CATEGORY_LABELS[prefixKey]) || referenceType;
}
/** Build the website/command action-prefix map directly from configurable prefix keys. */
export function buildActionShortcutPrefixMap(prefixes: ShortcutPrefixConfig): Record<string, string> {
    return ACTION_SHORTCUT_PREFIX_KEYS.reduce<Record<string, string>>((map, key) => {
        const prefix = resolveShortcutPrefix(prefixes, key);
        if (prefix)
            map[key] = prefix;
        return map;
    }, {});
}
/** Build a lookup from typed prefix text to command-search category using the current prefix settings. */
export function buildShortcutPrefixRegistry(prefixes?: ShortcutPrefixConfig): Record<string, ShortcutCategoryFilter> {
    const merged = getPrefixConfig(prefixes);
    const entries = SHORTCUT_CATEGORY_FILTERS.map(category => [category, merged[category]] as [
        ShortcutCategoryFilter,
        string | undefined
    ]);
    const registry = entries.reduce<Record<string, ShortcutCategoryFilter>>((acc, [category, prefix]) => {
        const normalized = normalizePrefix(prefix);
        if (normalized && !acc[normalized])
            acc[normalized] = category;
        return acc;
    }, {});
    return registry;
}
/** Build the slash/filter chip metadata from the current prefix registry and display labels. */
export function buildShortcutFilterMeta(prefixes?: ShortcutPrefixConfig): ShortcutFilterMeta {
    const registry = buildShortcutPrefixRegistry(prefixes);
    const meta: ShortcutFilterMeta = { a: { label: 'All' } };
    Object.entries(registry).forEach(([alias, category]) => {
        const label = PREFIX_CATEGORY_LABELS[category] || category;
        if (!meta[alias])
            meta[alias] = { label };
    });
    return meta;
}
/** Resolve the command-space prefix used before nested commands, such as `c n test`. */
export function getCommandSpacePrefix(prefixes?: ShortcutPrefixConfig): string {
    return normalizePrefix(getPrefixConfig(prefixes).command) || DEFAULT_COMMAND_TERMINAL_PREFIXES.command;
}
/** Parse direct shortcut input or command-space input into the trigger and optional category filter. */
export function parseShortcutInvocation(value: string, prefixes?: ShortcutPrefixConfig): ParsedShortcutInvocation {
    const source = String(value || '').replace(/\u00A0/g, ' ').trim().replace(/^\/+/, '');
    const commandPrefix = getCommandSpacePrefix(prefixes);
    const commandSpace = source.toLowerCase() === commandPrefix || source.toLowerCase().startsWith(commandPrefix + ' ');
    const rest = commandSpace ? source.slice(commandPrefix.length).trimStart() : source;
    const head = rest.match(/^(\S+)(?:\s+([\s\S]*))?$/);
    const token = head?.[1] || '';
    const remainder = head?.[2] || '';
    const category = commandSpace ? buildShortcutPrefixRegistry(prefixes)[normalizePrefix(token)] : null;
    if (category && remainder) {
        const nested = remainder.match(/^(\S+)(?:\s+([\s\S]*))?$/);
        return { trigger: normalizeShortcutTrigger(nested?.[1] || ''), remainingInput: nested?.[2] || '',
            triggerSource: 'command_space', categoryFilter: category };
    }
    return { trigger: normalizeShortcutTrigger(token), remainingInput: remainder,
        triggerSource: commandSpace ? 'command_space' : 'direct_search', categoryFilter: null };
}
/** Check whether a search result type belongs to the active category filter. */
export function matchesShortcutCategory(referenceType: string, categoryFilter: string | null): boolean {
    return isReferenceTypeInEntityCategory(referenceType, categoryFilter);
}
/** Return all owners of an exact trigger. Callers render identities rather than choosing the first record. */
export function getMatchingShortcutAssignments<T extends {
    trigger: string;
    referenceId: string;
    referenceType: string;
}>(value: string, assignments: readonly T[], prefixes?: ShortcutPrefixConfig): {
    invocation: ParsedShortcutInvocation;
    matches: T[];
} {
    const invocation = parseShortcutInvocation(value, prefixes);
    const seen = new Set<string>();
    const matches = assignments.filter(record => {
        if (normalizeShortcutTrigger(record.trigger).replace(/^\/+/, '') !== invocation.trigger
            || !matchesShortcutCategory(record.referenceType, invocation.categoryFilter))
            return false;
        const key = `${record.referenceType}:${record.referenceId}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    return { invocation, matches };
}
