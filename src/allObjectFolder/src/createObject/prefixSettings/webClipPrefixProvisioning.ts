/** Pure plan shared by database upgrades and startup provisioning; no singleton/browser storage. */
import { DEFAULT_PREFIX_ROWS, normalizePrefixSettingValue } from './prefixSettingDefaults';
import type { PrefixSettingRecord } from './prefixSettingTypes';
import { WEBSITE_COLLECTION_COMMAND, WEBSITE_COLLECTION_CAPTURE_CHOICES } from '../../../../shared-components/commands/websiteCollectionCommands';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS } from '../../../../shared-components/commands/websitePageExtraction';

const historical: Record<string, readonly string[]> = {
  prefix_collection_capture: ['collection'],
  prefix_action_collection_link: ['collectionlink', 'cl', 'weblink'],
  prefix_action_collection_article: ['collectionarticle', 'ca', 'webarticle'],
  prefix_action_collection_screenshot: ['collectionscreenshot', 'cs', 'webscreen'],
  prefix_action_collection_web_scraping: ['collectionscraping', 'cw', 'webelement'],
};
const historicalLabels: Record<string, readonly string[]> = {
  prefix_collection_capture: ['Collection', 'Webclip', 'Webclips', 'Web Clip', 'Web Clips'],
  prefix_action_collection_link: ['Collection Link', 'Web Collection Link', 'Webpage link', 'Link clip'],
  prefix_action_collection_article: ['Collection Article', 'Web Collection Article', 'Webpage Article', 'Article clip'],
  prefix_action_collection_screenshot: ['Collection Screenshot', 'Web Collection Screenshot', 'Webpage Screenshot', 'Screenshot clip'],
  prefix_action_collection_web_scraping: ['Collection Web Scraping', 'Web Collection Web Scraping', 'Webpage element', 'Element clip'],
};
export function isHistoricalWebClipPrefix(id: string, prefix: string): boolean {
  return historical[id]?.some(value => normalizePrefixSettingValue(value) === normalizePrefixSettingValue(prefix)) ?? false;
}
export function planWebClipPrefixDefaults(existingRows: readonly PrefixSettingRecord[], shortcuts: readonly { trigger: string }[],
  now: number): PrefixSettingRecord[] {
  const categories = new Set<string>([WEBSITE_COLLECTION_COMMAND.prefixKey, ...WEBSITE_COLLECTION_CAPTURE_CHOICES.map(choice => choice.id)]);
  const existing = new Map(existingRows.map(row => [row.id, row]));
  const defaults = DEFAULT_PREFIX_ROWS.filter(row => categories.has(row.category));
  const pending = defaults.filter(row => {
    const current = existing.get(row.id);
    return !current || (!current.releasedTextCommandPrefix && isHistoricalWebClipPrefix(row.id, current.prefix));
  });
  const pendingIds = new Set(pending.map(row => row.id));
  const occupied = new Set([
    ...existingRows.filter(row => row.enabled && !pendingIds.has(row.id)).map(row => normalizePrefixSettingValue(row.prefix)),
    ...shortcuts.map(row => normalizePrefixSettingValue(row.trigger)),
    ...WEBSITE_PAGE_EXTRACTION_DEFINITIONS.filter(row => !row.prefixSettingCategory).map(row => normalizePrefixSettingValue(row.fallbackPrefix)),
    ...DEFAULT_PREFIX_ROWS.filter(row => row.enabled && !pendingIds.has(row.id)).map(row => normalizePrefixSettingValue(row.prefix)),
  ]);
  return pending.map(row => {
    const current = existing.get(row.id);
    const base = normalizePrefixSettingValue(row.prefix);
    let prefix = base;
    let suffix = 2;
    while (occupied.has(prefix)) prefix = `${base}${suffix++}`;
    occupied.add(prefix);
    const knownLabel = historicalLabels[row.id]?.some(label => label.toLowerCase() === current?.label.trim().toLowerCase());
    return { ...row, ...(current || {}), prefix, label: !current || knownLabel || !current.label ? row.label : current.label,
      createdAt: current?.createdAt || now, updatedAt: now };
  });
}
