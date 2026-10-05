/** Shared surface and whole-option removal for single-value Create options. */
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FiX } from 'react-icons/fi';
export type WebsitePopupOptionalSingleControlProps = {
    children: ReactNode;
    removeLabel: string;
    onRemove: () => void;
    onNavigateBack?: () => void;
    onNavigateKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
    onControlFocus?: () => void;
    disabled?: boolean;
    removable?: boolean;
};
export function WebsitePopupOptionalSingleControl({ children, removeLabel, onRemove, onNavigateBack, onNavigateKeyDown, onControlFocus, disabled = false, removable = true, }: WebsitePopupOptionalSingleControlProps) {
    return (<span className="website-popup-create-option-placeholder website-popup-create-option-placeholder--input">
      {children}
      {removable ? <button type="button" data-create-option-remove="true" aria-label={removeLabel} title={removeLabel} disabled={disabled} onMouseDown={event => event.preventDefault()} onFocus={onControlFocus} onKeyDown={event => {
                if (onNavigateKeyDown && (event.key === 'Tab' || event.key === 'Backspace')) {
                    onNavigateKeyDown(event);
                    return;
                }
                if (event.key !== 'Backspace' || !onNavigateBack)
                    return;
                event.preventDefault();
                event.stopPropagation();
                onNavigateBack();
            }} onClick={onRemove}>
        <FiX aria-hidden="true"/>
      </button> : null}
    </span>);
}
