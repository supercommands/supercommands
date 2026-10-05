/**
 * Read-only adapter from shared create/prefix authorities to popup display rows.
 *
 * The background-supplied Create grammar owns the eligible entity identities.
 * Category settings provide the live visible label and command prefix only.
 */
import type React from 'react';
import type { PrefixSettingRecord, } from '../../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import { getWebsitePopupEntityLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
import type { WebsitePopupDisplayRow } from '../display/websitePopupDisplayTypes';
import { getWebsitePopupEntityIcon } from './websitePopupEntityIconCatalog';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
export type WebsitePopupPrefixSettingLike = Pick<PrefixSettingRecord, 'category' | 'enabled' | 'label' | 'prefix' | 'type'>;
export function buildWebsitePopupCreateRows(prefixSettings: readonly WebsitePopupPrefixSettingLike[], createGrammar: readonly WebsitePopupCreateEntityGrammar[], selectedIndex = 0): WebsitePopupDisplayRow[] {
    const commandPrefix = String(prefixSettings.find(row => row.type === 'category' && row.category === 'command')?.prefix || '').trim();
    const enabledEntities = createGrammar.flatMap(grammar => {
        const entity = grammar.entity;
        if (!grammar.fields.some(field => field.required))
            return [];
        const setting = prefixSettings.find(row => row.type === 'category' && row.category === entity);
        if (!setting?.enabled)
            return [];
        return [{ entity, setting }];
    });
    return enabledEntities.map(({ entity, setting }, index) => ({
        id: `create-${entity}`,
        title: getWebsitePopupEntityLabel(entity, setting.label),
        icon: getWebsitePopupEntityIcon(entity),
        iconTone: 'action' as const,
        trailing: [commandPrefix, String(setting.prefix || '').trim()].filter(Boolean).join(' '),
        trailingTone: 'key' as const,
        prefixEdit: { type: 'category' as const, category: entity,
            value: String(setting.prefix || '').trim(), title: getWebsitePopupEntityLabel(entity, setting.label) },
        selected: index === selectedIndex,
    }));
}
