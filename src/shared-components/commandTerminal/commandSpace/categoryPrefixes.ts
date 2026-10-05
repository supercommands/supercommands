import type { CommandTerminalCategory, CommandTerminalPrefixSettings } from '../types';
import { PREFIX_SETTING_CATEGORIES } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import { normalizeCommandTerminalPrefix } from './normalize';
/**
 * Categories that can be recognized inside command-space parsing.
 *
 * This list controls supported intent categories only. Prefix values are supplied
 * by existing prefix settings, so this file does not duplicate configurable keys.
 */
export const SUPPORTED_COMMAND_TERMINAL_CATEGORIES: readonly CommandTerminalCategory[] = [
    ...PREFIX_SETTING_CATEGORIES,
    'session'
] as const;
/**
 * Resolves the top-level command-space prefix from the provided prefix map.
 *
 * The returned value is empty when the caller has not supplied prefix settings.
 * This prevents the shared module from inventing fallback prefixes.
 */
export function getCommandTerminalPrefix(prefixes?: CommandTerminalPrefixSettings | string | null): string {
    if (typeof prefixes === 'string') {
        return normalizeCommandTerminalPrefix(prefixes);
    }
    return normalizeCommandTerminalPrefix(prefixes?.command);
}
/**
 * Builds a prefix to category registry from the caller-provided prefix settings.
 *
 * This is the command-terminal equivalent of category lookup. It accepts already
 * resolved settings, so custom prefixes from IndexedDB flow through unchanged.
 */
export function buildCommandTerminalPrefixRegistry(prefixes?: CommandTerminalPrefixSettings | string | null): Record<string, CommandTerminalCategory> {
    const providedPrefixes = typeof prefixes === 'string' ? { command: prefixes } : prefixes || {};
    const entries = SUPPORTED_COMMAND_TERMINAL_CATEGORIES.map(category => [category, providedPrefixes[category]] as [
        CommandTerminalCategory,
        string | undefined
    ]);
    const registry = entries.reduce<Record<string, CommandTerminalCategory>>((acc, [category, prefix]) => {
        const normalized = normalizeCommandTerminalPrefix(prefix);
        if (normalized && !acc[normalized])
            acc[normalized] = category;
        return acc;
    }, {});
    return registry;
}
/**
 * Returns category registry entries sorted for longest-prefix-first parsing.
 *
 * Longest-first sorting avoids short prefixes winning before more specific
 * prefixes when users customize values.
 */
export function buildCommandTerminalCategoryRegistry(prefixes?: CommandTerminalPrefixSettings | string | null, options: {
    allowedCategories?: readonly CommandTerminalCategory[];
} = {}): Array<{
    prefix: string;
    category: CommandTerminalCategory;
}> {
    const allowed = new Set(options.allowedCategories || SUPPORTED_COMMAND_TERMINAL_CATEGORIES);
    return Object.entries(buildCommandTerminalPrefixRegistry(prefixes))
        .filter(([, category]) => allowed.has(category as CommandTerminalCategory))
        .map(([prefix, category]) => ({ prefix, category: category as CommandTerminalCategory }))
        .sort((a, b) => b.prefix.length - a.prefix.length);
}
