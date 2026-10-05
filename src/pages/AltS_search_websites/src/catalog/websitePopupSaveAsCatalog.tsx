import { getWebsitePopupEntityLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
import TextExpanderIcon from '../../../../shared-components/icons/TextExpanderIcon';
/**
 * Read-only adapter from shared website Save As definitions and live prefixes.
 *
 * The shared registry owns stable legacy identities and order. Category and
 * subcommand prefix settings determine whether a destination is available and
 * which command text popup displays.
 */
import type React from 'react';
import { BsCalendarCheck } from 'react-icons/bs';
import { FaLayerGroup, FaLink } from 'react-icons/fa';
import {
  WEBSITE_SAVE_AS_DEFINITIONS,
  type WebsiteSaveAsId,
} from '../../../../shared-components/commands/websiteSaveAs';
import NotesIcon from '../../../../shared-components/icons/notesIcon';
import { getWebsitePopupEntityIcon } from './websitePopupEntityIconCatalog';
import type { WebsitePopupDisplayRow } from '../display/websitePopupDisplayTypes';
import type { WebsitePopupActionGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
export const WEBSITE_POPUP_SAVE_AS_LABEL = 'Add to / Save to existing library';
export const WEBSITE_POPUP_SAVE_AS_DEFINITIONS = [
  ...WEBSITE_SAVE_AS_DEFINITIONS,
  { id: 'save_chat', fallbackLabel: 'Save to Agent', destinationCategory: 'agent' },
] as const;
const SAVE_AS_ICONS: Record<WebsiteSaveAsId, React.ReactNode> = {
  add_to_existing: <FaLayerGroup />,
  save_link: <FaLink />,
  todo_chain_save: <BsCalendarCheck />,
  save_note: <NotesIcon />,
  save_snippet: <TextExpanderIcon />,
};
export function buildWebsitePopupSaveAsRows(
  categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[],
  actionGrammar: readonly WebsitePopupActionGrammar[],
  selectedIndex = -1,
  canSaveChat = false,
): WebsitePopupDisplayRow[] {
  const commandPrefix = String(
    categoryPrefixSettings.find(row => row.type === 'category' && row.category === 'command')?.prefix || '',
  ).trim();
  const saveActionPrefix = actionGrammar.find(entry => entry.action === 'save')?.prefix || '';
  const visibleDefinitions = WEBSITE_POPUP_SAVE_AS_DEFINITIONS.flatMap(definition => {
    if (definition.id === 'save_chat' && !canSaveChat) return [];
    const setting = categoryPrefixSettings.find(
      row => row.type === 'category' && row.category === definition.destinationCategory,
    );
    return setting?.enabled ? [{ definition, setting }] : [];
  });
  return visibleDefinitions.map(({ definition, setting }, index) => ({
    id: definition.id,
    title: getWebsitePopupEntityLabel(
      definition.destinationCategory,
      definition.fallbackLabel.replace(/^Existing\s+/, ''),
    ),
    icon: definition.id === 'save_chat' ? getWebsitePopupEntityIcon('agent') : SAVE_AS_ICONS[definition.id],
    iconTone: 'save' as const,
    trailing: [commandPrefix, saveActionPrefix, String(setting.prefix || '').trim()].filter(Boolean).join(' '),
    trailingTone: 'key' as const,
    prefixEdit: {
      type: 'category' as const,
      category: definition.destinationCategory,
      value: String(setting.prefix || '').trim(),
      title: getWebsitePopupEntityLabel(
        definition.destinationCategory,
        String(setting.label || definition.fallbackLabel).trim(),
      ),
    },
    selected: index === selectedIndex,
  }));
}
