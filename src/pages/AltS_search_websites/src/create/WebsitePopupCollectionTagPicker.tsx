/** Controlled Collection adapter over the existing Create tag catalog, chips and results. */
import type { TagRecord } from '../../../../allObjectFolder/src/createObject/tags/tagTypes';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupResolvedSection, WebsitePopupResultIntent } from '../results/websitePopupResultsTypes';
import { WebsitePopupResults } from '../display/WebsitePopupResults';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupMultiSelectArgument, type WebsitePopupMultiSelectArgumentProps } from './WebsitePopupMultiSelectArgument';
import { getWebsitePopupMultiSelectSourcePresentation } from './websitePopupCreateFieldPolicy';
import { buildWebsitePopupTagSections } from './websitePopupTagCatalog';

export const WEBSITE_POPUP_COLLECTION_TAG_FIELD = 'tags';

export function buildWebsitePopupCollectionTagSections({ snapshot, organisationId, query, selected, createdTags = [] }: {
    snapshot: WebsitePopupSearchSnapshot;
    organisationId: string | null;
    query: string;
    selected: readonly WebsitePopupCreateSelectedValue[];
    createdTags?: readonly TagRecord[];
}): WebsitePopupResolvedSection[] {
    // Snapshot tags are scoped to its default Organisation by the background.
    if (!organisationId || snapshot.defaultOrganisationId !== organisationId) return [];
    const tags = new Map(snapshot.tags.map(tag => [tag.id, tag]));
    // The existing create-tag bridge creates global tags only. Keep them available before refresh.
    for (const tag of createdTags) if (tag.workspaceId == null && !tags.has(tag.id)) tags.set(tag.id, tag);
    return buildWebsitePopupTagSections({ fieldId: WEBSITE_POPUP_COLLECTION_TAG_FIELD,
        query, tags: [...tags.values()], selected });
}

export function WebsitePopupCollectionTagField({ active = false, ...props }:
    Omit<WebsitePopupMultiSelectArgumentProps, 'placeholder' | 'addPlaceholder' | 'itemLabel'> & { active?: boolean }) {
    return <WebsitePopupArgumentSlot fieldId={WEBSITE_POPUP_COLLECTION_TAG_FIELD} label="Tags"
        kind="multi-select" width="medium" active={active}>
      <WebsitePopupMultiSelectArgument {...props} {...getWebsitePopupMultiSelectSourcePresentation('tags')!}/>
    </WebsitePopupArgumentSlot>;
}

/** The caller owns activation, focus and keyboard state; this adapter never dispatches Create events. */
export function WebsitePopupCollectionTagSuggestions({ sections, selectedIndex, onSelect, onActivate, statusMessage, showHeadings = true }: {
    sections: readonly WebsitePopupResolvedSection[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    onActivate: (intent: WebsitePopupResultIntent) => void;
    statusMessage?: string;
    showHeadings?: boolean;
}) {
    const rows = sections.flatMap(section => section.rows);
    let offset = 0;
    const displaySections = sections.map(section => ({ ...section, rows: section.rows.map(row => ({
        ...row, selected: offset++ === selectedIndex,
    })) }));
    return <WebsitePopupResults sections={displaySections} ariaLabel="Collection item tags" emptyState="No matching tags" showHeadings={showHeadings}
        onMouseDown={event => event.preventDefault()}
        statusMessage={statusMessage} onRowSelectionRequest={onSelect} onRowActivationRequest={index => {
            const row = rows[index];
            if (row && !row.disabled) onActivate(row.intent);
        }}/>;
}
