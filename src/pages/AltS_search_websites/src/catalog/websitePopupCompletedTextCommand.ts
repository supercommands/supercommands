import { getMatchingShortcutAssignments } from '../../../../shared-components/triggers/shortcutRuntime';
import { buildPrefixMapFromSettings } from '../../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingRecord } from '../../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
/** Completion is the final Space, not an approximate search or a command with arguments. */
export function getWebsitePopupCompletedTextCommand(query: string, snapshot: WebsitePopupSearchSnapshot, settings: readonly WebsitePopupPrefixSettingLike[]) {
    const source = query.replace(/\u00a0/g, ' ');
    const prefixes = buildPrefixMapFromSettings(settings as PrefixSettingRecord[]);
    const prefix = prefixes.command;
    if (!prefix || !source.endsWith(' ') || !source.toLowerCase().startsWith(`${prefix.toLowerCase()} `))
        return null;
    const result = getMatchingShortcutAssignments(source, snapshot.shortcuts, prefixes);
    if (!result.invocation.trigger || result.invocation.remainingInput.trim() || !result.matches.length)
        return null;
    return result;
}
