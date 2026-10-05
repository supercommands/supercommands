/**
 * Controlled multiline argument for the popup Spotlight-style Create composer.
 *
 * The field grows horizontally with content, then downward to its configured
 * row cap once its inline limit is reached. Content height remains visible
 * after blur and when a populated draft is restored.
 * It owns height measurement only;
 * route, draft, focus order, and persistence remain in the Create controller.
 */
import { useCallback, useRef, useState, type FocusEventHandler, type TextareaHTMLAttributes, } from 'react';
import { useWebsitePopupTextareaSize } from '../search/useWebsitePopupTextareaSize';
export type WebsitePopupSpotlightTextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'rows'> & {
    value: string;
    maximumRows: number;
    active?: boolean;
    inputRef?: (element: HTMLTextAreaElement | null) => void;
};
export function WebsitePopupSpotlightTextareaField({ value, maximumRows, active = false, inputRef, className, onFocus, onBlur, ...textareaProps }: WebsitePopupSpotlightTextareaFieldProps) {
    const [element, setElement] = useState<HTMLTextAreaElement | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRefRef = useRef(inputRef);
    inputRefRef.current = inputRef;
    const setRef = useCallback((next: HTMLTextAreaElement | null) => {
        setElement(next);
        inputRefRef.current?.(next);
    }, []);
    const onMeasured = useCallback((height: number, minimumHeight: number) => {
        setExpanded(height > minimumHeight + 1);
        if (!element?.matches(':focus')) return;
        const composer = element.closest<HTMLElement>('.website-popup-create-composer');
        if (!composer) return;
        const fieldRect = element.getBoundingClientRect();
        const composerRect = composer.getBoundingClientRect();
        if (fieldRect.bottom > composerRect.bottom) composer.scrollTop += fieldRect.bottom - composerRect.bottom;
    }, [element]);
    useWebsitePopupTextareaSize(element, value, {
        maximumRows, maximumRowsToken: '--website-popup-composer-textarea-max-rows',
        minimumHeightToken: '--website-popup-composer-control-height', onMeasured,
    });
    const handleFocus: FocusEventHandler<HTMLTextAreaElement> = event => {
        setFocused(true);
        onFocus?.(event);
    };
    const handleBlur: FocusEventHandler<HTMLTextAreaElement> = event => {
        setFocused(false);
        event.currentTarget.scrollTop = 0;
        onBlur?.(event);
    };
    return (<textarea {...textareaProps} ref={setRef} rows={1} value={value} style={textareaProps.style} className={className} data-active={active && focused ? 'true' : 'false'} data-expanded={expanded ? 'true' : 'false'} onFocus={handleFocus} onBlur={handleBlur}/>);
}
