import type { CommandSpaceParseState, CommandTerminalActionId, CommandTerminalCategory, CommandTerminalPrefixSettings, } from '../types';
import { buildCommandTerminalActionPrefixMap } from './actionPrefixes';
import { buildCommandTerminalCategoryRegistry, getCommandTerminalPrefix } from './categoryPrefixes';
import { normalizeCommandSpaceText } from './normalize';
/**
 * Parses command-space input without knowing which surface will consume it.
 *
 * Examples:
 * - `c n meeting` returns category `note` with query `meeting`
 * - `c screen` returns an exact action match when `screen` is the configured action prefix
 * - non-command-space input returns `isActive: false`
 */
export function parseCommandSpace(searchValue: string, prefixes?: CommandTerminalPrefixSettings | null, options: {
    allowedCategories?: readonly CommandTerminalCategory[];
    actionPrefixMap?: Partial<Record<CommandTerminalActionId, string>>;
} = {}): CommandSpaceParseState {
    const normalizedValue = String(searchValue || '').replace(/\u00A0/g, ' ');
    const commandPrefix = getCommandTerminalPrefix(prefixes);
    if (!commandPrefix) {
        return {
            isActive: false,
            commandPrefix,
            activeCategoryFilter: null,
            actualQuery: '',
            normalizedInput: normalizeCommandSpaceText(normalizedValue),
            exactActionId: null,
        };
    }
    if (!normalizedValue.toLowerCase().startsWith(`${commandPrefix} `)) {
        return {
            isActive: false,
            commandPrefix,
            activeCategoryFilter: null,
            actualQuery: '',
            normalizedInput: normalizeCommandSpaceText(normalizedValue),
            exactActionId: null,
        };
    }
    const queryAfterCommand = normalizedValue.slice(commandPrefix.length + 1);
    const queryAfterCommandLower = queryAfterCommand.toLowerCase();
    const nestedPrefixes = buildCommandTerminalCategoryRegistry(prefixes, {
        allowedCategories: options.allowedCategories,
    });
    let activeCategoryFilter: CommandTerminalCategory | null = null;
    let actualQuery = queryAfterCommand.trim();
    for (const { category, prefix } of nestedPrefixes) {
        if (queryAfterCommandLower.startsWith(`${prefix} `)) {
            activeCategoryFilter = category;
            actualQuery = queryAfterCommand.slice(prefix.length).trim();
            break;
        }
    }
    let exactActionId: CommandTerminalActionId | null = null;
    if (!activeCategoryFilter) {
        const normalizedShortcut = normalizeCommandSpaceText(queryAfterCommand);
        const actionPrefixMap = {
            ...buildCommandTerminalActionPrefixMap(prefixes),
            ...(options.actionPrefixMap || {}),
        };
        const exactMatchEntry = Object.entries(actionPrefixMap).find(([, shortcut]) => normalizeCommandSpaceText(shortcut) === normalizedShortcut);
        exactActionId = (exactMatchEntry?.[0] as CommandTerminalActionId | undefined);
    }
    return {
        isActive: true,
        commandPrefix,
        activeCategoryFilter,
        actualQuery,
        normalizedInput: normalizeCommandSpaceText(normalizedValue),
        exactActionId,
    };
}
