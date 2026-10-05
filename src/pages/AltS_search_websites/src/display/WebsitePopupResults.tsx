/**
 * Scrollable, grouped popup results viewport.
 * Row data is supplied as a neutral display model and is never persisted here.
 */
import type React from 'react';
import type { WebsitePopupDisplaySection } from './websitePopupDisplayTypes';
import type { WebsitePopupPrefixEditTarget, WebsitePopupTextCommandEditTarget, WebsitePopupResultEditTarget } from './websitePopupDisplayTypes';
import { WebsitePopupSection } from './WebsitePopupSection';
export type WebsitePopupResultsProps = {
    sections: WebsitePopupDisplaySection[];
    emptyState?: React.ReactNode;
    children?: React.ReactNode;
    ariaLabel?: string;
    statusMessage?: React.ReactNode;
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    onRowSelectionRequest?: (index: number) => void;
    onRowActivationRequest?: (index: number) => void;
    onTextCommandEditRequest?: (target: WebsitePopupTextCommandEditTarget, anchor: HTMLElement) => void;
    onPrefixEditRequest?: (target: WebsitePopupPrefixEditTarget, anchor: HTMLElement) => void;
    onResultEditRequest?: (target: WebsitePopupResultEditTarget) => void;
    showAllDetails?: boolean;
    showHeadings?: boolean;
};
export function WebsitePopupResults({ sections, emptyState, children, ariaLabel = 'Website popup results', statusMessage, onMouseDown, onRowSelectionRequest, onRowActivationRequest, onTextCommandEditRequest, onPrefixEditRequest, onResultEditRequest, showAllDetails = false, showHeadings = true, }: WebsitePopupResultsProps) {
    let rowIndexOffset = 0;
    return (<div id="website-popup-results" className="website-popup-results website-popup-custom-scrollbar" role="listbox" aria-label={ariaLabel} aria-multiselectable={sections.some(section => section.rows.some(row => row.checkable))} onMouseDown={onMouseDown}>
      {statusMessage ? (<div className="website-popup-results__status" role="status" aria-live="polite">
          {statusMessage}
        </div>) : null}
      {children ?? (sections.length > 0
            ? sections.map(section => {
                const sectionOffset = rowIndexOffset;
                rowIndexOffset += section.rows.length;
                return (<WebsitePopupSection key={section.id} section={section} rowIndexOffset={sectionOffset} onRowSelectionRequest={onRowSelectionRequest} onRowActivationRequest={onRowActivationRequest} onTextCommandEditRequest={onTextCommandEditRequest} onPrefixEditRequest={onPrefixEditRequest} onResultEditRequest={onResultEditRequest} showAllDetails={showAllDetails} showHeading={showHeadings}/>);
            })
            : <div className="website-popup-results__empty">{emptyState}</div>)}
    </div>);
}
