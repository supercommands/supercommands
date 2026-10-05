import { buildWebsitePopupCollectionRows, buildWebsitePopupWebClipsCommandSection } from './websitePopupCollectionCatalog';
import { isCollectionCaptureSurface } from '../../../../shared-components/collections/collectionCaptureSource';
import type { WebsitePageActionId } from '../../../../shared-components/commands/websitePageActions';
import type { WebsitePageExtractionId } from '../../../../shared-components/commands/websitePageExtraction';
/** Search adapter for the centralized default command catalogs. */
import { buildWebsitePopupCreateRows } from './websitePopupCreateCatalog';
import { buildWebsitePopupPageActionRows } from './websitePopupPageActionsCatalog';
import { buildWebsitePopupPageExtractionRows } from './websitePopupPageExtractionCatalog';
import { buildWebsitePopupSaveAsRows, WEBSITE_POPUP_SAVE_AS_LABEL } from './websitePopupSaveAsCatalog';
import { buildWebsitePopupFilterChooserSection } from './websitePopupFilterCatalog';
import { WEBSITE_POPUP_SAVE_AS_DEFINITIONS } from './websitePopupSaveAsCatalog';
import type { WebsitePopupPrefixSettingLike } from './websitePopupCreateCatalog';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupResolvedRow, WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';
const normalizeSearchText = (value: unknown) => String(value || '').trim().toLowerCase();
export function buildWebsitePopupCommandSearchSections(query: string, categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[], actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[], createGrammar: readonly WebsitePopupCreateEntityGrammar[], actionGrammar: readonly WebsitePopupActionGrammar[], canSaveChat = false, surface?: 'website' | 'newtab'): WebsitePopupResolvedSection[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery)
        return [];
    const commandPrefix = String(categoryPrefixSettings.find(setting => setting.type === 'category' && setting.category === 'command')?.prefix || '').trim();
    const isCommandQuery = Boolean(commandPrefix)
        && normalizedQuery.startsWith(`${commandPrefix.toLowerCase()} `);
    const afterCommand = isCommandQuery ? normalizedQuery.slice(commandPrefix.length).trimStart() : '';
    const actionToken = afterCommand.split(/\s+/)[0];
    const scopedAction = isCommandQuery ? actionGrammar.find(entry => entry.prefix.toLowerCase() === actionToken) : undefined;
    const scopedQuery = scopedAction ? afterCommand.slice(actionToken.length).trimStart() : normalizedQuery;
    const saveEntries = actionGrammar.filter(entry => entry.action === 'save' && (!scopedAction || entry === scopedAction));
    // Ordinary text search never advertises Filter; explicitly typed Filter actions still resolve.
    const filterEntries = scopedAction?.action === 'filter' ? [scopedAction] : [];
    const saveRows = (isCommandQuery ? saveEntries : saveEntries.slice(0, 1)).flatMap(entry => buildWebsitePopupSaveAsRows(categoryPrefixSettings, [entry], -1, canSaveChat).map(row => ({
        ...row,
        id: `${row.id}:${entry.prefix}`,
        intent: {
            kind: 'enter-mode' as const,
            mode: 'save' as const,
            entity: WEBSITE_POPUP_SAVE_AS_DEFINITIONS.find(definition => definition.id === row.id)?.destinationCategory || row.id,
            query: '',
        },
    })));
    const filterRows = (isCommandQuery ? filterEntries : filterEntries.slice(0, 1)).flatMap(entry => (buildWebsitePopupFilterChooserSection(categoryPrefixSettings)?.rows || []).map(row => ({
        ...row,
        id: `${row.id}:${entry.prefix}`,
        trailing: [commandPrefix, entry.prefix, row.prefixEdit?.value].filter(Boolean).join(' '),
    })));
    const webClipsSection = buildWebsitePopupWebClipsCommandSection(categoryPrefixSettings, actionPrefixSettings, surface);
    const sections = [
        {
            id: 'create',
            label: 'Create',
            rows: [...buildWebsitePopupCreateRows(categoryPrefixSettings, createGrammar, -1).map(row => ({
                ...row,
                intent: {
                    kind: 'enter-mode' as const,
                    mode: 'create' as const,
                    entity: row.id.replace(/^create-/, ''),
                    query: '',
                    returnToCreateChooser: true,
                },
            })), ...(isCollectionCaptureSurface(surface) ? buildWebsitePopupCollectionRows(categoryPrefixSettings) : [])],
            keywords: 'create',
        },
        {
            id: 'page-actions',
            label: 'AI Chat Agents',
            rows: buildWebsitePopupPageActionRows(categoryPrefixSettings, actionPrefixSettings, -1).map(row => ({
                ...row,
                intent: { kind: 'page-action' as const, actionId: row.id as WebsitePageActionId },
            })),
            keywords: 'ai page actions action',
        },
        {
            id: 'page-extraction',
            label: 'Page Extraction',
            rows: [...buildWebsitePopupPageExtractionRows(categoryPrefixSettings, actionPrefixSettings, -1).map(row => ({
                ...row,
                intent: { kind: 'page-extraction' as const, actionId: row.id as WebsitePageExtractionId },
            }))],
            keywords: 'page extraction extract',
        },
        {
            id: 'save-as',
            label: WEBSITE_POPUP_SAVE_AS_LABEL,
            rows: saveRows,
            keywords: 'save saved save as add to existing library',
        },
        ...(webClipsSection ? [{ ...webClipsSection, keywords: 'web clips web clip clip capture' }] : []),
        {
            id: 'filter',
            label: 'Filter',
            rows: filterRows,
            keywords: 'filter',
        }
    ];
    return sections.flatMap(section => {
        if (scopedAction && section.id !== (scopedAction.action === 'save' ? 'save-as' : 'filter')) return [];
        const rows = section.rows.filter(row => [
            section.keywords,
            row.intent.kind === 'collection-mode' ? 'collection capture' : '',
            row.title,
            row.trailing
        ].map(normalizeSearchText).join(' ').includes(scopedQuery));
        return rows.length > 0 ? [{ id: `search-${section.id}`, label: section.label, rows }] : [];
    });
}
/** Match a fully typed configured command without depending on debounced search rows. */
export function findExactWebsitePopupCommandRow(query: string, categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[], actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[], createGrammar: readonly WebsitePopupCreateEntityGrammar[], actionGrammar: readonly WebsitePopupActionGrammar[], canSaveChat = false, surface?: 'website' | 'newtab'): WebsitePopupResolvedRow | null {
    const normalized = normalizeSearchText(query);
    const matches = buildWebsitePopupCommandSearchSections(query, categoryPrefixSettings, actionPrefixSettings, createGrammar, actionGrammar, canSaveChat, surface).flatMap(section => section.rows).filter(row => normalizeSearchText(row.trailing) === normalized);
    return matches.length === 1 ? matches[0] : null;
}
