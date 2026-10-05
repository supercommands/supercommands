/**
 * Central registry of popup result-section providers.
 *
 * Create, AI Chat Agents, Page Extraction, Save As, and Web Clips providers register here.
 * Future routes add providers without changing the wrapper UI.
 */
import { websitePopupCollectionProvider, websitePopupCollectionDestinationProvider } from './websitePopupCollectionProvider';
import { buildWebsitePopupCollectionRows, buildWebsitePopupWebClipsCommandSection } from '../catalog/websitePopupCollectionCatalog';
import { isCollectionCaptureSurface } from '../../../../shared-components/collections/collectionCaptureSource';
import { buildWebsitePopupCreateRows } from '../catalog/websitePopupCreateCatalog';
import { buildWebsitePopupPageActionRows } from '../catalog/websitePopupPageActionsCatalog';
import { buildWebsitePopupPageExtractionRows } from '../catalog/websitePopupPageExtractionCatalog';
import { buildWebsitePopupSaveAsRows, WEBSITE_POPUP_SAVE_AS_LABEL } from '../catalog/websitePopupSaveAsCatalog';
import { buildWebsitePopupCommandSearchSections } from '../catalog/websitePopupCommandSearchCatalog';
import { buildWebsitePopupFilterChooserSection } from '../catalog/websitePopupFilterCatalog';
import { buildWebsitePopupSearchSections, buildWebsitePopupTitleSearchSections, } from '../catalog/websitePopupSearchCatalog';
import { WEBSITE_POPUP_SAVE_AS_DEFINITIONS } from '../catalog/websitePopupSaveAsCatalog';
import type { WebsitePageActionId } from '../../../../shared-components/commands/websitePageActions';
import type { WebsitePageExtractionId } from '../../../../shared-components/commands/websitePageExtraction';
import type { WebsitePopupSectionProvider } from './websitePopupResultsTypes';
import { getWebsitePopupCompletedTextCommand } from '../catalog/websitePopupCompletedTextCommand';
import { orderWebsitePopupSearchSections } from './websitePopupSearchSectionOrder';
const createSectionProvider: WebsitePopupSectionProvider = {
    id: 'create',
    order: 10,
    supports: request => request.source === 'default',
    provide: (_request, context) => {
        const rows = buildWebsitePopupCreateRows(context.categoryPrefixSettings, context.createGrammar, -1)
            .filter(row => row.id !== 'create-agent' && row.id !== 'create-snippet')
            .map(row => ({
            ...row,
            intent: {
                kind: 'enter-mode' as const,
                mode: 'create' as const,
                entity: row.id.replace(/^create-/, ''),
            },
        }));
        const collectionRows = isCollectionCaptureSurface(context.surface) ? buildWebsitePopupCollectionRows(context.categoryPrefixSettings) : [];
        return rows.length + collectionRows.length > 0 ? { id: 'create', label: 'Create', rows: [...rows, ...collectionRows] } : null;
    },
};
const pageActionsSectionProvider: WebsitePopupSectionProvider = {
    id: 'page-actions',
    order: 20,
    supports: request => request.source === 'default',
    provide: (_request, context) => {
        const rows = buildWebsitePopupPageActionRows(context.categoryPrefixSettings, context.actionPrefixSettings, -1).map(row => ({
            ...row,
            intent: { kind: 'page-action' as const, actionId: row.id as WebsitePageActionId },
        }));
        return rows.length > 0 ? { id: 'page-actions', label: 'AI Chat Agents', rows } : null;
    },
};
const pageExtractionSectionProvider: WebsitePopupSectionProvider = {
    id: 'page-extraction',
    order: 30,
    supports: request => request.source === 'default',
    provide: (_request, context) => {
        const rows = buildWebsitePopupPageExtractionRows(context.categoryPrefixSettings, context.actionPrefixSettings, -1).map(row => ({
            ...row,
            intent: { kind: 'page-extraction' as const, actionId: row.id as WebsitePageExtractionId },
        }));
        return rows.length > 0 ? { id: 'page-extraction', label: 'Page Extraction', rows } : null;
    },
};
const saveAsSectionProvider: WebsitePopupSectionProvider = {
    id: 'save-as',
    order: 40,
    supports: request => request.source === 'default',
    provide: (_request, context) => {
        const rows = buildWebsitePopupSaveAsRows(context.categoryPrefixSettings, context.actionGrammar, -1, context.canSaveChat).map(row => ({
            ...row,
            intent: {
                kind: 'enter-mode' as const,
                mode: 'save' as const,
                entity: WEBSITE_POPUP_SAVE_AS_DEFINITIONS.find(definition => definition.id === row.id)?.destinationCategory
                    || row.id,
            },
        }));
        return rows.length > 0 ? { id: 'save-as', label: WEBSITE_POPUP_SAVE_AS_LABEL, rows } : null;
    },
};
const webClipsSectionProvider: WebsitePopupSectionProvider = {
    id: 'web-clips-commands',
    order: 50,
    supports: request => request.source === 'default',
    provide: (_request, context) => buildWebsitePopupWebClipsCommandSection(context.categoryPrefixSettings,
        context.actionPrefixSettings, context.surface),
};
const normalSearchSectionProvider: WebsitePopupSectionProvider = {
    id: 'normal-search',
    order: 10,
    supports: request => request.source === 'normal',
    provide: (request, context) => {
        if (getWebsitePopupCompletedTextCommand(request.query, context.searchSnapshot, context.categoryPrefixSettings))
            return orderWebsitePopupSearchSections(buildWebsitePopupSearchSections(request.query, context.searchSnapshot, context.categoryPrefixSettings));
        return orderWebsitePopupSearchSections([
            ...buildWebsitePopupCommandSearchSections(request.query, context.categoryPrefixSettings, context.actionPrefixSettings, context.createGrammar, context.actionGrammar, context.canSaveChat, context.surface),
            ...buildWebsitePopupSearchSections(request.query, context.searchSnapshot, context.categoryPrefixSettings)
        ]);
    },
};
const specializedTitleSearchSectionProvider: WebsitePopupSectionProvider = {
    id: 'specialized-title-search',
    order: 10,
    supports: request => (request.source === 'save' || request.source === 'filter')
        && Boolean(request.entity),
    provide: (request, context) => request.source === 'save' && request.entity === 'agent'
        ? context.canSaveChat ? ['prompt', 'agent'].flatMap(entity => buildWebsitePopupTitleSearchSections('filter', entity, request.query, context.searchSnapshot, context.categoryPrefixSettings).map(section => ({ ...section, id: `save-chat-${entity}`, label: entity === 'prompt' ? 'AI Prompts' : 'Chat Agents',
            rows: section.rows.flatMap(row => row.intent.kind === 'open-entity' ? [{ ...row,
                    textCommandEdit: undefined, prefixEdit: undefined,
                    resultEdit: row.intent.kind === 'open-entity' ? { entity: row.intent.entity, targetId: row.intent.targetId } : undefined,
                    intent: { kind: 'stage-chat-save' as const, entity: entity as 'prompt' | 'agent', targetId: row.intent.targetId },
                }] : []),
        }))) : []
        : buildWebsitePopupTitleSearchSections(request.source === 'save' ? 'save' : 'filter', request.entity || '', request.query, context.searchSnapshot, context.categoryPrefixSettings),
};
const saveChooserSectionProvider: WebsitePopupSectionProvider = {
    id: 'save-chooser',
    order: 10,
    supports: request => request.source === 'save' && !request.entity,
    provide: (request, context) => {
        const query = request.query.trim().toLowerCase();
        const rows = buildWebsitePopupSaveAsRows(context.categoryPrefixSettings, context.actionGrammar, -1, context.canSaveChat).filter(row => !query || `${row.title} ${row.trailing}`.toLowerCase().includes(query))
            .map(row => ({
            ...row,
            intent: {
                kind: 'enter-mode' as const,
                mode: 'save' as const,
                entity: WEBSITE_POPUP_SAVE_AS_DEFINITIONS.find(definition => definition.id === row.id)?.destinationCategory || row.id,
                query: '',
            },
        }));
        return rows.length > 0 ? { id: 'save-chooser', label: WEBSITE_POPUP_SAVE_AS_LABEL, rows } : null;
    },
};
const filterChooserSectionProvider: WebsitePopupSectionProvider = {
    id: 'filter-chooser',
    order: 10,
    supports: request => request.source === 'filter' && !request.entity,
    provide: (request, context) => buildWebsitePopupFilterChooserSection(context.categoryPrefixSettings, request.query),
};
export const WEBSITE_POPUP_SECTION_PROVIDERS: readonly WebsitePopupSectionProvider[] = [
    websitePopupCollectionProvider,
    websitePopupCollectionDestinationProvider,
    normalSearchSectionProvider,
    saveChooserSectionProvider,
    specializedTitleSearchSectionProvider,
    filterChooserSectionProvider,
    createSectionProvider,
    pageActionsSectionProvider,
    pageExtractionSectionProvider,
    saveAsSectionProvider,
    webClipsSectionProvider
];
