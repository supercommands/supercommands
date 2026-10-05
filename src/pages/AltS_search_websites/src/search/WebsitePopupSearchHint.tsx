/**
 * Fixed right-side search shortcut. The shortcut stays visible while its
 * action label appears in a centered tooltip on hover or keyboard focus.
 */
import type React from 'react';
export type WebsitePopupSearchHintProps = {
    label: React.ReactNode;
    shortcut?: React.ReactNode;
    showLabel?: boolean;
    onActivate?: () => void;
    disabled?: boolean;
};
export function WebsitePopupSearchHint({ label, shortcut, showLabel = false, onActivate, disabled = false, }: WebsitePopupSearchHintProps) {
    const tooltipLabel = typeof label === 'string' || typeof label === 'number' ? String(label) : undefined;
    return (<span className="website-popup-search-hint">
      {showLabel ? <span className="website-popup-search-hint__label">{label}</span> : null}
      {shortcut && onActivate ? (<button type="button" className="website-popup-search-hint__key website-popup-search-hint__action" aria-label={tooltipLabel} title={tooltipLabel} data-tooltip={tooltipLabel} disabled={disabled} onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onActivate();
            }}>
          {shortcut}
        </button>) : shortcut ? (<kbd className="website-popup-search-hint__key" data-tooltip={tooltipLabel} title={tooltipLabel}>
          {shortcut}
        </kbd>) : null}
    </span>);
}
