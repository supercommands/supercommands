import type { CommandTerminalActionId, CommandTerminalPrefixSettings } from '../types';
import { PREFIX_SETTING_ACTIONS } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import { normalizeCommandTerminalPrefix } from './normalize';
/**
 * Action IDs supported by command-space action matching.
 *
 * This list names the action fields only. The prefix values are read from the
 * prefix settings map passed by the caller, so this file does not duplicate
 * configurable prefix strings.
 */
export const COMMAND_TERMINAL_ACTION_IDS: readonly CommandTerminalActionId[] = [
    ...PREFIX_SETTING_ACTIONS
] as readonly CommandTerminalActionId[];
/**
 * Builds an action ID to prefix map from the resolved prefix settings object.
 *
 * Missing or disabled action prefixes are omitted. No default prefix values live
 * here; callers should pass the resolved map from the existing prefix-settings
 * API when fallbacks to default settings are needed.
 */
export function buildCommandTerminalActionPrefixMap(prefixes?: CommandTerminalPrefixSettings | null): Partial<Record<CommandTerminalActionId, string>> {
    return COMMAND_TERMINAL_ACTION_IDS.reduce((acc, actionId) => {
        const prefix = normalizeCommandTerminalPrefix(prefixes?.[actionId]);
        if (prefix)
            acc[actionId] = prefix;
        return acc;
    }, {} as Partial<Record<CommandTerminalActionId, string>>);
}
