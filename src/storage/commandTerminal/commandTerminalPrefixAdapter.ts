export { DEFAULT_COMMAND_TERMINAL_PREFIXES, buildPrefixMapFromSettings, type CommandTerminalPrefixes, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
export { getEnabledPrefixSettings, getActionPrefixSettings, getCategoryPrefixSettings, getSubcommandPrefixSettings, getPrefixes, getPrefixSettings, setPrefixes, syncPrefixSettingsFromSource, updatePrefixSetting, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import { getEnabledPrefixSettings, getActionPrefixSettings, getCategoryPrefixSettings, getSubcommandPrefixSettings, getPrefixes, getPrefixSettings, setPrefixes, syncPrefixSettingsFromSource, updatePrefixSetting, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import { buildPrefixMapFromSettings, } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
/**
 * Backward-compatible object facade for callers that expect a storage service.
 *
 * The methods still delegate to the prefix settings IndexedDB implementation;
 * this object does not use chrome.storage/localStorage as a source of truth.
 */
export const CommandTerminalPrefixStorage = {
    getPrefixes,
    setPrefixes,
    getPrefixSettings,
    getEnabledPrefixSettings,
    getCategoryPrefixSettings,
    getActionPrefixSettings,
    getSubcommandPrefixSettings,
    updatePrefixSetting,
    buildPrefixMapFromSettings,
    syncPrefixSettingsFromSource,
};
