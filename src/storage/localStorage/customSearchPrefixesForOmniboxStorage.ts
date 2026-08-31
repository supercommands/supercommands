export {
  DEFAULT_OMNIBOX_PREFIXES,
  getEnabledPrefixSettings,
  getActionPrefixSettings,
  getCategoryPrefixSettings,
  getSubcommandPrefixSettings,
  getPrefixes,
  getPrefixSettings,
  setPrefixes,
  syncPrefixSettingsFromSource,
  updatePrefixSetting,
  type CustomOmniboxPrefixes,
} from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';

import {
  getEnabledPrefixSettings,
  getActionPrefixSettings,
  getCategoryPrefixSettings,
  getSubcommandPrefixSettings,
  getPrefixes,
  getPrefixSettings,
  setPrefixes,
  syncPrefixSettingsFromSource,
  updatePrefixSetting,
} from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';

export const CustomSearchPrefixesForOmniboxStorage = {
  getPrefixes,
  setPrefixes,
  getPrefixSettings,
  getEnabledPrefixSettings,
  getCategoryPrefixSettings,
  getActionPrefixSettings,
  getSubcommandPrefixSettings,
  updatePrefixSetting,
  syncPrefixSettingsFromSource,
};
