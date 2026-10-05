/**
 * Presentation-only wrapper for one Spotlight-style inline argument.
 *
 * Every Create field shares this label, baseline, width, and visual-state
 * contract. Field behavior and data remain owned by the connected composer.
 */
import type { ReactNode } from 'react';
export type WebsitePopupArgumentVisualKind = 'single-line-text' | 'multiline-text' | 'single-select' | 'multi-select' | 'property-prefix';
export type WebsitePopupArgumentSlotProps = {
    fieldId?: string;
    label: ReactNode;
    width?: 'short' | 'medium' | 'long';
    kind: WebsitePopupArgumentVisualKind;
    controlType?: 'text-command' | 'hotkey' | 'favorite';
    active?: boolean;
    onFocusCapture?: () => void;
    children: ReactNode;
};
export function WebsitePopupArgumentSlot({ fieldId, label, width = 'medium', kind, controlType, active = false, onFocusCapture, children, }: WebsitePopupArgumentSlotProps) {
    return (<div className="website-popup-create-composer__field website-popup-argument-slot" data-field-id={fieldId} data-width={width} data-argument-kind={kind} data-control-type={controlType} data-active={active ? 'true' : 'false'} onFocusCapture={onFocusCapture}>
      <span className="website-popup-create-composer__label website-popup-argument-slot__label" title={typeof label === 'string' ? label : undefined}>
        {label}
      </span>
      <span className="website-popup-argument-slot__control">{children}</span>
    </div>);
}
