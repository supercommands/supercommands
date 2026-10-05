/**
 * Semantic contracts for the centralized popup results layer.
 *
 * Providers return neutral display rows plus typed future activation intents.
 * No intent is executed in the current display-only milestone.
 */
import type { WebsitePopupDisplayRow, WebsitePopupDisplaySection } from '../display/websitePopupDisplayTypes';
import type { WebsitePopupSuggestionRequest } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupCollectionSession } from '../interaction/websitePopupCollectionSession';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupExecutionIntent } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
export type WebsitePopupResultIntent = WebsitePopupExecutionIntent;
export type WebsitePopupResolvedRow = WebsitePopupDisplayRow & {
    intent: WebsitePopupResultIntent;
};
export type WebsitePopupResolvedSection = Omit<WebsitePopupDisplaySection, 'rows'> & {
    rows: WebsitePopupResolvedRow[];
};
export type WebsitePopupResultsContext = {
    surface?: 'website' | 'newtab';
    canSaveChat?: boolean;
    categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    subcommandPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    actionGrammar: readonly WebsitePopupActionGrammar[];
    searchSnapshot: WebsitePopupSearchSnapshot;
    selectedCollectionId?: string | null;
    collectionSession?: WebsitePopupCollectionSession | null;
};
export type WebsitePopupSectionProvider = {
    id: string;
    order: number;
    supports: (request: WebsitePopupSuggestionRequest) => boolean;
    provide: (request: WebsitePopupSuggestionRequest, context: WebsitePopupResultsContext) => WebsitePopupResolvedSection | WebsitePopupResolvedSection[] | null;
};
