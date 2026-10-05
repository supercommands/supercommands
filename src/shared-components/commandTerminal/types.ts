import type { CommandTerminalPrefixes } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingAction, PrefixSettingCategory } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
/**
 * Categories that command terminal text can target after the command-space prefix.
 *
 * Prefix-backed categories come from prefix settings. `session` is kept as a
 * command-terminal route category because sessions currently route separately
 * even though they share collection-style data in some older surfaces.
 */
export type CommandTerminalCategory = PrefixSettingCategory | 'session';
/**
 * Action command IDs that can be triggered by action prefixes inside command space.
 *
 * Action IDs are the prefix-setting action keys; this module should not repeat
 * the union or define separate action metadata.
 */
export type CommandTerminalActionId = PrefixSettingAction;
/**
 * Resolved prefix map used by the command terminal parsers.
 *
 * Callers should pass the map returned by the existing prefix-settings storage
 * API so user customizations from IndexedDB are respected.
 */
export type CommandTerminalPrefixSettings = Partial<CommandTerminalPrefixes>;
/**
 * Neutral parse result for command-space text such as "c n meeting" or "c screen".
 *
 * This describes what the input means; it intentionally does not execute
 * anything and does not know about website subcommand UI or omnibox behavior.
 */
export type CommandSpaceParseState = {
    isActive: boolean;
    commandPrefix: string;
    activeCategoryFilter: CommandTerminalCategory | null;
    actualQuery: string;
    normalizedInput: string;
    exactActionId: CommandTerminalActionId | null;
};
