/**
 * Presentational popup search input.
 *
 * This component owns input markup only. Query state and mode transitions are
 * supplied through value/onValueChange so it remains reusable and testable.
 */
import { forwardRef, useCallback, useState, type TextareaHTMLAttributes } from 'react';
import { useBoundedWebsitePopupSearchHeight } from './useBoundedWebsitePopupSearchHeight';
export type WebsitePopupSearchInputProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'rows'> & {
    value: string;
    onValueChange?: (value: string) => void;
};
export const WebsitePopupSearchInput = forwardRef<HTMLTextAreaElement, WebsitePopupSearchInputProps>(function WebsitePopupSearchInput({ value, onValueChange, className, placeholder = 'Search', 'aria-label': ariaLabel = 'Search website popup', ...inputProps }, ref) {
    const [element, setElement] = useState<HTMLTextAreaElement | null>(null);
    useBoundedWebsitePopupSearchHeight(element, value, 'normal');
    const inputClassName = [
        'website-popup-search-input',
        'website-popup-custom-scrollbar',
        className
    ].filter(Boolean).join(' ');
    const setRefs = useCallback((node: HTMLTextAreaElement | null) => {
        setElement(node);
        if (typeof ref === 'function')
            ref(node);
        else if (ref)
            ref.current = node;
    }, [ref]);
    return (<textarea {...inputProps} ref={setRefs} rows={1} value={value} placeholder={placeholder} aria-label={ariaLabel} autoComplete="off" spellCheck={false} className={inputClassName} onChange={event => onValueChange?.(event.currentTarget.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing)
                event.preventDefault();
            inputProps.onKeyDown?.(event);
        }}/>);
});
