import { getWebsitePopupEntityLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
import { getWebsitePopupEntityIcon } from './websitePopupEntityIconCatalog';
import type { WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
export const WEBSITE_POPUP_FILTER_CATEGORIES = [
    'note',
    'link',
    'todo',
    'snippet',
    'collection',
    'bookmark',
    'prompt',
    'agent'
] as const;
/** Visibility is separate from parser recognition; existing typed aliases are not deleted. */
const VISIBLE_FILTER_CATEGORIES = WEBSITE_POPUP_FILTER_CATEGORIES.filter(entity => entity !== 'agent');
export function buildWebsitePopupFilterChooserSection(categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[], query = ''): WebsitePopupResolvedSection | null {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = VISIBLE_FILTER_CATEGORIES.flatMap(entity => {
        const setting = categoryPrefixSettings.find(row => row.type === 'category' && row.category === entity);
        if (!setting?.enabled)
            return [];
        const title = getWebsitePopupEntityLabel(entity);
        const prefix = String(setting.prefix || '').trim();
        const matchesQuery = !normalizedQuery || [title, entity, prefix]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);
        if (!matchesQuery)
            return [];
        return [{
                id: `filter-${entity}`,
                title,
                icon: getWebsitePopupEntityIcon(entity),
                iconTone: 'action' as const,
                trailing: `/${prefix}`,
                trailingTone: 'key' as const,
                prefixEdit: { type: 'category' as const, category: entity,
                    value: prefix, title },
                intent: {
                    kind: 'enter-mode' as const,
                    mode: 'filter' as const,
                    entity,
                    query: '',
                },
            }];
    });
    return rows.length > 0 ? { id: 'filter-chooser', label: '', rows } : null;
}
