/**
 * Generic grouped-results section.
 * Labels such as Recent, History, or Suggestions are supplied by the caller.
 */
import { useId } from 'react';
import type { WebsitePopupDisplaySection } from './websitePopupDisplayTypes';
import type { WebsitePopupPrefixEditTarget, WebsitePopupTextCommandEditTarget, WebsitePopupResultEditTarget } from './websitePopupDisplayTypes';
import { WebsitePopupResultRow } from './WebsitePopupResultRow';
export type WebsitePopupSectionProps = {
    section: WebsitePopupDisplaySection;
    rowIndexOffset?: number;
    onRowSelectionRequest?: (index: number) => void;
    onRowActivationRequest?: (index: number) => void;
    onTextCommandEditRequest?: (target: WebsitePopupTextCommandEditTarget, anchor: HTMLElement) => void;
    onPrefixEditRequest?: (target: WebsitePopupPrefixEditTarget, anchor: HTMLElement) => void;
    onResultEditRequest?: (target: WebsitePopupResultEditTarget) => void;
    showAllDetails?: boolean;
    showHeading?: boolean;
};
export function WebsitePopupSection({ section, rowIndexOffset = 0, onRowSelectionRequest, onRowActivationRequest, onTextCommandEditRequest, onPrefixEditRequest, onResultEditRequest, showAllDetails = false, showHeading = true, }: WebsitePopupSectionProps) {
    const headingId = useId();
    return (<section className="website-popup-section" role="group" aria-label={section.label || 'Results'} aria-labelledby={showHeading && section.label ? headingId : undefined}>
      {showHeading && section.label ? (<div className="website-popup-section__heading" id={headingId}>
          <span>{section.label}</span>
          {section.trailing ? <span>{section.trailing}</span> : null}
        </div>) : null}
      {section.rows.map((row, index) => (<WebsitePopupResultRow key={row.id} row={row} index={rowIndexOffset + index} onSelectionRequest={onRowSelectionRequest} onActivationRequest={onRowActivationRequest} onTextCommandEditRequest={onTextCommandEditRequest} onPrefixEditRequest={onPrefixEditRequest} onResultEditRequest={onResultEditRequest} showAllDetails={showAllDetails}/>))}
    </section>);
}
