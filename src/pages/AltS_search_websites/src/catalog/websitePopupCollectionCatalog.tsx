import { FiBookOpen, FiCamera, FiLink } from 'react-icons/fi';
import { FaFolder } from 'react-icons/fa';
import WebCollectionIcon from '../../../../shared-components/icons/webCollectionIcon';
import { WEBSITE_COLLECTION_COMMAND, WEBSITE_COLLECTION_CAPTURE_CHOICES } from '../../../../shared-components/commands/websiteCollectionCommands';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
import type { WebsitePopupResolvedRow, WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
import { isCollectionCaptureSurface } from '../../../../shared-components/collections/collectionCaptureSource';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS } from '../../../../shared-components/commands/websitePageExtraction';

export function buildWebsitePopupCollectionRows(categories: readonly WebsitePopupPrefixSettingLike[]): WebsitePopupResolvedRow[] {
  const category = categories.find(row => row.category === WEBSITE_COLLECTION_COMMAND.prefixKey && row.enabled && row.prefix.trim());
  const command = categories.find(row => row.category === 'command' && row.enabled && row.prefix.trim());
  if (!category || !command) return [];
  return [{
    id: WEBSITE_COLLECTION_COMMAND.id,
    title: WEBSITE_COLLECTION_COMMAND.label,
    icon: <WebCollectionIcon />, iconTone: 'action',
    trailing: `${command.prefix} ${category.prefix}`, trailingTone: 'key',
    prefixEdit: { type: 'category', category: category.category, value: category.prefix, title: WEBSITE_COLLECTION_COMMAND.label },
    intent: { kind: 'collection-mode', mode: 'collection-actions' },
  }];
}

const CHOICE_ICONS = {
  link: <FiLink />,
  article: <FiBookOpen />,
  screenshot: <FiCamera />,
  'web-scraping': <FiBookOpen />,
};

/** Direct webpage capture commands retain their configured prefixes and capture intents. */
export function buildWebsitePopupCollectionCommandRows(categories: readonly WebsitePopupPrefixSettingLike[], actions: readonly WebsitePopupPrefixSettingLike[]): WebsitePopupResolvedRow[] {
  const command = categories.find(row => row.category === 'command' && row.enabled && row.prefix.trim());
  if (!command) return [];
  const allPrefixes = [...categories, ...actions];
  const fixedPrefixes = WEBSITE_PAGE_EXTRACTION_DEFINITIONS.filter(row => !row.prefixSettingCategory).map(row => row.fallbackPrefix.toLowerCase());
  return WEBSITE_COLLECTION_CAPTURE_CHOICES.flatMap(choice => {
    const setting = actions.find(row => row.type === 'action' && row.category === choice.id && row.enabled && row.prefix.trim());
    if (!setting) return [];
    const prefix = setting.prefix.trim().toLowerCase();
    // Legacy/restored conflicting settings must not produce ambiguous command rows.
    if (fixedPrefixes.includes(prefix) || allPrefixes.filter(row => row.enabled && row.prefix.trim().toLowerCase() === prefix).length !== 1) return [];
    const displayLabel = choice.displayLabel;
    return [{
      id: `${choice.id}-command`, title: displayLabel,
      icon: <FaFolder/>, iconTone: 'collection' as const,
      trailing: `${command.prefix.trim()} ${setting.prefix.trim()}`, trailingTone: 'key' as const,
      prefixEdit: { type: 'action' as const, category: setting.category, value: setting.prefix, title: displayLabel },
      intent: { kind: 'collection-capture-start' as const, itemType: choice.type, entry: 'direct' as const },
    }];
  });
}

/** Default listing and command search share this section without changing row presentation. */
export function buildWebsitePopupWebClipsCommandSection(categories: readonly WebsitePopupPrefixSettingLike[],
  actions: readonly WebsitePopupPrefixSettingLike[], surface?: 'website' | 'newtab'): WebsitePopupResolvedSection | null {
  if (!isCollectionCaptureSurface(surface)) return null;
  const rows = buildWebsitePopupCollectionCommandRows(categories, actions);
  return rows.length ? { id: 'web-clips-commands', label: WEBSITE_COLLECTION_COMMAND.label, rows } : null;
}

/** Capture choices retain the same commands inside the Web Clips submenu. */
export function buildWebsitePopupCollectionChoiceRows(query = ''): WebsitePopupResolvedRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  return WEBSITE_COLLECTION_CAPTURE_CHOICES
    .filter(choice => !normalizedQuery || `${choice.label} ${choice.displayLabel}`.toLowerCase().includes(normalizedQuery))
    .map(choice => ({
      id: choice.id,
      title: choice.displayLabel,
      trailing: 'Choose Web Clip',
      icon: CHOICE_ICONS[choice.type],
      iconTone: 'collection' as const,
      intent: { kind: 'collection-capture-start' as const, itemType: choice.type },
    }));
}
