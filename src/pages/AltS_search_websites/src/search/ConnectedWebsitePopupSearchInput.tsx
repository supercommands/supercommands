/**
 * Thin Zustand adapter for WebsitePopupSearchInput.
 *
 * It is the only search component that knows about the interaction store and
 * dispatches only QUERY_CHANGED; suggestions and execution remain disconnected.
 */
import { forwardRef } from 'react';
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupParsedIntent } from '../interaction/websitePopupQueryParser';
import { selectWebsitePopupQuery } from '../interaction/websitePopupInteractionSelectors';
import { WebsitePopupSearchInput, type WebsitePopupSearchInputProps, } from './WebsitePopupSearchInput';
export type ConnectedWebsitePopupSearchInputProps = Omit<WebsitePopupSearchInputProps, 'onValueChange' | 'value'> & {
    store: WebsitePopupInteractionStoreApi;
    parseIntent?: (inputValue: string) => WebsitePopupParsedIntent;
};
export const ConnectedWebsitePopupSearchInput = forwardRef<HTMLTextAreaElement, ConnectedWebsitePopupSearchInputProps>(function ConnectedWebsitePopupSearchInput({ store, parseIntent, ...inputProps }, ref) {
    const query = useStore(store, current => selectWebsitePopupQuery(current.state));
    const selectedIndex = useStore(store, current => current.state.selectedIndex);
    const suggestionCount = useStore(store, current => current.state.suggestionCount);
    const dispatch = useStore(store, current => current.dispatch);
    return (<WebsitePopupSearchInput {...inputProps} ref={ref} value={query} role="combobox" aria-autocomplete="list" aria-controls="website-popup-results" aria-expanded={suggestionCount > 0} aria-activedescendant={suggestionCount > 0
            ? `website-popup-result-${selectedIndex}`
            : undefined} onValueChange={value => dispatch({
            type: 'QUERY_CHANGED',
            query: value,
            parsedIntent: parseIntent?.(value),
        })}/>);
});
