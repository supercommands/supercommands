/**
 * Compact popup result row with one selected-only metadata line.
 * The selected row alone expands; selection remains centralized upstream.
 */
import { useLayoutEffect, useRef } from 'react';
import { FiCheck } from 'react-icons/fi';
import type { WebsitePopupDisplayRow, WebsitePopupPrefixEditTarget, WebsitePopupTextCommandEditTarget, WebsitePopupResultEditTarget } from './websitePopupDisplayTypes';
export type WebsitePopupResultRowProps = {
    row: WebsitePopupDisplayRow;
    index: number;
    onSelectionRequest?: (index: number) => void;
    onActivationRequest?: (index: number) => void;
    onTextCommandEditRequest?: (target: WebsitePopupTextCommandEditTarget, anchor: HTMLElement) => void;
    onPrefixEditRequest?: (target: WebsitePopupPrefixEditTarget, anchor: HTMLElement) => void;
    onResultEditRequest?: (target: WebsitePopupResultEditTarget) => void;
    showAllDetails?: boolean;
};
export function WebsitePopupResultRow({ row, index, onSelectionRequest, onActivationRequest, onTextCommandEditRequest, onPrefixEditRequest, onResultEditRequest, showAllDetails = false, }: WebsitePopupResultRowProps) {
    const rowRef = useRef<HTMLDivElement | null>(null);
    useLayoutEffect(() => {
        if (!row.selected)
            return;
        const rowElement = rowRef.current;
        const resultsViewport = rowElement?.closest<HTMLElement>('.website-popup-results');
        if (!rowElement || !resultsViewport)
            return;
        const rowBounds = rowElement.getBoundingClientRect();
        const viewportBounds = resultsViewport.getBoundingClientRect();
        const overflowBelow = rowBounds.bottom - viewportBounds.bottom;
        const overflowAbove = viewportBounds.top - rowBounds.top;
        if (overflowBelow > 0) {
            resultsViewport.scrollTop += overflowBelow;
        }
        else if (overflowAbove > 0) {
            resultsViewport.scrollTop -= overflowAbove;
        }
    }, [row.detail, row.selected]);
    const requestSelection = () => {
        if (!row.disabled)
            onSelectionRequest?.(index);
    };
    const trailingLabel = row.trailing || (row.selected && row.textCommandEdit ? 'Add Text Command' : null);
    const requestTrailingEdit = (anchor: HTMLElement) => {
        if (row.prefixEdit)
            onPrefixEditRequest?.(row.prefixEdit, anchor);
        else if (row.textCommandEdit)
            onTextCommandEditRequest?.(row.textCommandEdit, anchor);
    };
    return (<div ref={rowRef} className="website-popup-row" role="option" id={`website-popup-result-${index}`} aria-selected={Boolean(row.selected)} aria-checked={row.checkable ? Boolean(row.checked) : undefined} aria-disabled={row.disabled} data-selected={row.selected ? 'true' : 'false'} data-checkable={row.checkable ? 'true' : 'false'} data-checked={row.checked ? 'true' : 'false'} data-disabled={row.disabled ? 'true' : 'false'} data-icon-tone={row.iconTone} data-icon-layout={row.iconLayout || 'standard'} data-has-detail={row.detail ? 'true' : 'false'} data-show-all-details={showAllDetails ? 'true' : 'false'} data-trailing-tone={row.trailingTone || (row.selected && row.textCommandEdit ? 'key' : undefined)} data-has-trailing={trailingLabel ? 'true' : 'false'} onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            requestSelection();
            if (!row.disabled)
                onActivationRequest?.(index);
        }} onContextMenu={event => {
            if (!row.resultEdit || row.disabled)
                return;
            event.preventDefault();
            event.stopPropagation();
            onResultEditRequest?.(row.resultEdit);
        }}>
      {row.checkable ? (<span className="website-popup-row__check" aria-hidden="true">
          {row.checked ? <FiCheck /> : null}
        </span>) : null}
      <span className="website-popup-row__icon" aria-hidden="true">
        {row.icon}
      </span>
      <span className="website-popup-row__text">
        <span className="website-popup-row__title">{row.title}</span>
        {(row.selected || showAllDetails) && row.detail
            ? <span className="website-popup-row__detail">{row.detail}</span>
            : null}
      </span>
      {trailingLabel ? row.textCommandEdit || row.prefixEdit ? (<button type="button" className="website-popup-row__trailing website-popup-row__editable-trailing" aria-label={row.prefixEdit ? `Edit prefix for ${row.prefixEdit.title}`
                : `${row.textCommandEdit?.value ? 'Edit' : 'Add'} Text Command for ${row.textCommandEdit?.title}`} title={row.prefixEdit ? 'Click to edit prefix'
                : `Click to ${row.textCommandEdit?.value ? 'edit' : 'add'} Text Command`} onMouseDown={event => event.stopPropagation()} onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                requestTrailingEdit(event.currentTarget);
            }} onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ')
                    return;
                event.preventDefault();
                event.stopPropagation();
                requestTrailingEdit(event.currentTarget);
            }}>
          {trailingLabel}
        </button>) : <span className="website-popup-row__trailing">{trailingLabel}</span> : null}
    </div>);
}
