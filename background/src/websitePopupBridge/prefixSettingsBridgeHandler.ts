import { broadcastWebsitePopupEntityChanges } from './broadcastWebsitePopupChanges';
import { updatePrefixShortcutAssignment } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
/**
 * Background authority for Website Popup prefix-setting requests.
 *
 * All IndexedDB-backed operations remain here. Successful writes reuse the
 * shared prefix-setting domain API and notify content scripts through the
 * established `db_changed` channel.
 */
import {
  getActionPrefixSettings,
  getCategoryPrefixSettings,
  getSubcommandPrefixSettings,
} from '../../../src/allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import {
  CREATE_COMPOSER_ENTITIES,
  WEBSITE_POPUP_CREATE_FIELD_OVERRIDES,
  getCategoryCommandChainActionPrefixEntries,
  getCreateComposerFieldCapabilities,
} from '../../../src/shared-components/commandTerminal';
import {
  getEnabledQuickCreatePrefixEntries,
  getQuickCreatePrefixEntries,
  getQuickCreatePrefixLabels,
} from '../../../src/shared-components/triggers/subcommandFieldParser';
import {
  isWebsitePopupPrefixSettingsBridgeRequest,
  type WebsitePopupPrefixSettingsBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';

type PrefixSettingsBridgeSendResponse = (response: WebsitePopupPrefixSettingsBridgeResponse) => void;

const buildWebsitePopupCreateGrammar = (
  categoryPrefixSettings: Awaited<ReturnType<typeof getCategoryPrefixSettings>>,
  subcommandPrefixSettings: Awaited<ReturnType<typeof getSubcommandPrefixSettings>>,
) => CREATE_COMPOSER_ENTITIES.flatMap(entity => {
    const categorySetting = categoryPrefixSettings.find(setting =>
      setting.type === 'category' && setting.category === entity && setting.enabled,
    );
    if (!categorySetting) return [];
    const compatibleFieldPrefixes = getQuickCreatePrefixEntries(entity, {
      prefixSettings: subcommandPrefixSettings,
    });
    const enabledFieldPrefixes = getEnabledQuickCreatePrefixEntries(entity, subcommandPrefixSettings);
    const capabilities = getCreateComposerFieldCapabilities(entity);
    const requiredFields = new Set(capabilities.filter(field => field.required).map(field => field.field));
    const fieldPrefixes = [
      ...compatibleFieldPrefixes.filter(entry => requiredFields.has(entry.field)),
      ...enabledFieldPrefixes.filter(entry => !requiredFields.has(entry.field)),
    ];
    const labels = getQuickCreatePrefixLabels(entity, {
      prefixSettings: subcommandPrefixSettings,
    });
    return [{
      entity,
      fieldPrefixes,
      fields: capabilities.map((field, sequence) => {
        const popupOverride = field.source ? WEBSITE_POPUP_CREATE_FIELD_OVERRIDES[field.source] : undefined;
        const prefixes = fieldPrefixes
          .filter(entry => entry.field === field.field)
          .map(entry => entry.prefix);
        const primaryPrefix = field.required || prefixes.includes(labels[field.field])
          ? labels[field.field]
          : prefixes[0] || '';
        return {
          field: field.field,
          label: field.label,
          required: Boolean(field.required),
          mustCompleteWhenAdded: Boolean(field.mustCompleteWhenAdded),
          kind: field.kind,
          description: field.description,
          sequence,
          visibleInLeftComposer: popupOverride?.visibleInLeftComposer ?? field.visibleInLeftComposer !== false,
          tabCycle: popupOverride?.tabCycle ?? field.tabCycle !== false,
          allowSpaceInQuery: Boolean(field.allowSpaceInQuery),
          source: field.source,
          control: field.presentation?.control,
          width: field.presentation?.width,
          maximumRows: field.presentation?.maximumRows,
          primaryPrefix,
          prefixes,
        };
      }),
    }];
  });

export function handleWebsitePopupPrefixSettingsBridgeMessage(
  message: unknown,
  sendResponse: PrefixSettingsBridgeSendResponse,
): boolean {
  if (!isWebsitePopupPrefixSettingsBridgeRequest(message)) return false;

  void (async () => {
    try {
      if (message.operation === 'update-prefix') {
        const value = message.value.trim().toLowerCase();
        if (!value) throw new Error('Enter a prefix before saving.');
        const settings = message.type === 'category' ? await getCategoryPrefixSettings()
          : message.type === 'action' ? await getActionPrefixSettings()
          : await getSubcommandPrefixSettings();
        const current = settings.find(setting => setting.type === message.type
          && setting.category === message.category);
        if (!current) throw new Error('This prefix is no longer available.');
        if (current.prefix !== message.expectedValue) {
          throw new Error('This prefix changed. Reopen the editor to review its current value.');
        }
        const updated = await updatePrefixShortcutAssignment(current.id, value, message.expectedValue, message.approval);
        void chrome.runtime.sendMessage({ action: 'INVALIDATE_OMNIBOX_CACHE' }).catch(() => undefined);
        await broadcastWebsitePopupEntityChanges(['prefixSettings', 'userShortcuts']);
        sendResponse({ success: true, updatedPrefix: updated.prefix });
        return;
      }
      const [categoryPrefixSettings, actionPrefixSettings, subcommandPrefixSettings] = await Promise.all([
        getCategoryPrefixSettings(),
        getActionPrefixSettings(),
        getSubcommandPrefixSettings(),
      ]);
      const createGrammar = buildWebsitePopupCreateGrammar(
        categoryPrefixSettings,
        subcommandPrefixSettings,
      );
      const actionGrammar = getCategoryCommandChainActionPrefixEntries(subcommandPrefixSettings)
        .filter((entry): entry is { action: 'save' | 'filter'; prefix: string } =>
          entry.action === 'save' || entry.action === 'filter',
        );
      sendResponse({
        success: true,
        categoryPrefixSettings,
        actionPrefixSettings,
        subcommandPrefixSettings,
        createGrammar,
        actionGrammar,
      });
    } catch (error: unknown) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
}
