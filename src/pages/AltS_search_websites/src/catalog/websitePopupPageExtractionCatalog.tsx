/**
 * Read-only adapter from shared Page Extraction definitions and live prefixes.
 *
 * The legacy seven-row identity/order comes from the shared registry. Prefix
 * settings provide configurable values for every direct action row.
 */
import type React from 'react';
import { FaCamera, FaClone, FaImages, FaObjectGroup, FaTable, FaVolumeMute, FaVolumeUp, } from 'react-icons/fa';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS, type WebsitePageExtractionIcon, type WebsitePageExtractionDefinition, } from '../../../../shared-components/commands/websitePageExtraction';
import type { WebsitePopupDisplayRow } from '../display/websitePopupDisplayTypes';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
const PAGE_EXTRACTION_ICONS: Record<WebsitePageExtractionIcon, React.ReactNode> = {
    capture: <FaCamera />,
    images: <FaImages />,
    tables: <FaTable />,
    merge: <FaObjectGroup />,
    duplicates: <FaClone />,
    mute: <FaVolumeMute />,
    unmute: <FaVolumeUp />,
};
export function buildWebsitePopupPageExtractionRows(categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[], actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[], selectedIndex = -1): WebsitePopupDisplayRow[] {
    const commandPrefix = String(categoryPrefixSettings.find(row => row.type === 'category' && row.category === 'command')?.prefix || '').trim();
    const visibleDefinitions = WEBSITE_PAGE_EXTRACTION_DEFINITIONS.flatMap<{
        definition: WebsitePageExtractionDefinition;
        setting: WebsitePopupPrefixSettingLike | null;
    }>(definition => {
        if (!definition.prefixSettingCategory)
            return [{ definition, setting: null }];
        const setting = actionPrefixSettings.find(row => row.type === 'action' && row.category === definition.prefixSettingCategory);
        return setting?.enabled ? [{ definition, setting }] : [];
    });
    return visibleDefinitions.map(({ definition, setting }, index) => ({
        id: definition.id,
        title: String(setting?.label || definition.fallbackLabel).trim(),
        icon: PAGE_EXTRACTION_ICONS[definition.icon],
        iconTone: definition.tone,
        trailing: [
            commandPrefix,
            String(setting?.prefix || definition.fallbackPrefix).trim()
        ].filter(Boolean).join(' '),
        trailingTone: 'key' as const,
        prefixEdit: setting && definition.prefixSettingCategory ? {
            type: 'action' as const, category: definition.prefixSettingCategory,
            value: String(setting.prefix || '').trim(), title: String(setting.label || definition.fallbackLabel).trim(),
        } : undefined,
        selected: index === selectedIndex,
    }));
}
