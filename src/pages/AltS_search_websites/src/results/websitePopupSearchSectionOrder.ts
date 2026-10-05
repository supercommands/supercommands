import type { WebsitePopupResolvedSection } from './websitePopupResultsTypes';

/** Normal-search presentation priority only; default/provider order and row ranking stay separate. */
const SEARCH_SECTION_PRIORITY = ['search-web-clips-commands'] as const;
const priorities = new Map<string, number>(SEARCH_SECTION_PRIORITY.map((id, index) => [id, index]));

export function orderWebsitePopupSearchSections(sections: readonly WebsitePopupResolvedSection[]): WebsitePopupResolvedSection[] {
  return sections.map((section, index) => ({ section, index }))
    .sort((left, right) => (priorities.get(left.section.id) ?? SEARCH_SECTION_PRIORITY.length)
      - (priorities.get(right.section.id) ?? SEARCH_SECTION_PRIORITY.length) || left.index - right.index)
    .map(entry => entry.section);
}
