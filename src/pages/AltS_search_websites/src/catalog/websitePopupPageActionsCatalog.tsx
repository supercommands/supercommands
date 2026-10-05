/**
 * Read-only adapter from shared website Page Actions and live prefix settings.
 *
 * The shared registry owns the two allowed action identities and their order.
 * Prefix settings own enabled state and command text shown in popup. popup presents
 * Send to Agent with the concise label "AI"; other action labels stay live.
 */
import type React from 'react';
import { FiFileText, FiSend } from 'react-icons/fi';
import { WEBSITE_PAGE_ACTION_DEFINITIONS, type WebsitePageActionIcon, } from '../../../../shared-components/commands/websitePageActions';
import type { WebsitePopupDisplayRow } from '../display/websitePopupDisplayTypes';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
const PAGE_ACTION_ICONS: Record<WebsitePageActionIcon, React.ReactNode> = {
    send: <FiSend />,
    summarize: <FiFileText />,
};
export function buildWebsitePopupPageActionRows(categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[], actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[], selectedIndex = -1): WebsitePopupDisplayRow[] {
    const commandPrefix = String(categoryPrefixSettings.find(row => row.type === 'category' && row.category === 'command')?.prefix || '').trim();
    const enabledActions = WEBSITE_PAGE_ACTION_DEFINITIONS.flatMap(definition => {
        const setting = actionPrefixSettings.find(row => row.type === 'action' && row.category === definition.id);
        if (!setting?.enabled)
            return [];
        return [{ definition, setting }];
    });
    return enabledActions.map(({ definition, setting }, index) => {
        const title = definition.id === 'send_to_agent'
            ? 'AI'
            : String(setting.label || definition.fallbackLabel).trim();
        return {
            id: definition.id,
            title,
            icon: PAGE_ACTION_ICONS[definition.icon],
            iconTone: 'ai' as const,
            trailing: [commandPrefix, String(setting.prefix || '').trim()].filter(Boolean).join(' '),
            trailingTone: 'key' as const,
            prefixEdit: { type: 'action' as const, category: definition.id,
                value: String(setting.prefix || '').trim(), title },
            selected: index === selectedIndex,
        };
    });
}
