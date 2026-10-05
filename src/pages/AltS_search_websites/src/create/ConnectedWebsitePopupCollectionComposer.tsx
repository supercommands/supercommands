/** Shared destination field for all Collection capture types. */
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import { resolveWebsitePopupCreateKeyboardIntent } from '../interaction/websitePopupKeyboardIntentResolver';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupOptionalSingleControl } from './WebsitePopupOptionalSingleControl';

export function ConnectedWebsitePopupCollectionComposer({ store, snapshot, onInputRef }: {
    store: WebsitePopupInteractionStoreApi;
    snapshot: WebsitePopupSearchSnapshot;
    onInputRef: (element: HTMLInputElement | null) => void;
}) {
    const state = useStore(store, current => current.state);
    const dispatch = useStore(store, current => current.dispatch);
    const route = state.route.kind === 'submode' && state.route.submode.id === 'collection-destination'
        ? state.route : null;
    const session = state.collectionSession;
    if (!route || !session) return null;
    const selected = snapshot.newCollections.find(collection => collection.id === session.selectedCollectionId);
    const selectedName = selected?.name || session.selectedCollectionName || '';
    const query = route.query;
    const pickerOpen = session.pickerOpen;
    const value = pickerOpen ? query : selectedName;
    return <div className="website-popup-create-composer">
      <WebsitePopupArgumentSlot fieldId="collection" label="Web Clip" kind="single-select" width="medium" active={pickerOpen}>
        <WebsitePopupOptionalSingleControl removable={false} removeLabel="Clear Web Clip" onRemove={() => {}}>
          <WebsitePopupAutoWidthField
            ref={onInputRef}
            className="website-popup-create-composer__input website-popup-create-composer__property-query website-popup-create-option-control"
            value={value}
            stableValue={selectedName || 'Search Web Clips'}
            placeholder="Search Web Clips"
            aria-label="Search or create Web Clip"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="website-popup-results"
            aria-expanded={pickerOpen && state.suggestionCount > 0}
            aria-activedescendant={pickerOpen && state.suggestionCount > 0 ? `website-popup-result-${state.selectedIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            onFocus={() => dispatch({ type: 'COLLECTION_PICKER_OPENED' })}
            onClick={() => dispatch({ type: 'COLLECTION_PICKER_OPENED' })}
            onChange={event => dispatch({ type: 'QUERY_CHANGED', query: event.currentTarget.value })}
            onKeyDown={event => {
                if (event.key === 'Backspace' && !query) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (session.selectedCollectionId) {
                        dispatch({ type: 'COLLECTION_SELECTED', id: null });
                        dispatch({ type: 'COLLECTION_PICKER_OPENED' });
                    } else dispatch({ type: 'BACK_REQUESTED' });
                    return;
                }
                const intent = resolveWebsitePopupCreateKeyboardIntent({
                    key: event.key, shiftKey: event.shiftKey, field: 'argument-query:collection',
                    fieldOrder: ['collection'], isEmpty: !query, hasPropertyFields: false,
                    traverseVisibleFields: true, propertyEntryOpen: false,
                    childMode: pickerOpen ? 'collection' : null,
                });
                if (event.key === 'Escape' || event.key === 'Tab') {
                    event.preventDefault();
                    event.stopPropagation();
                    if ((event.key === 'Tab' && event.shiftKey) || intent.kind === 'back-requested')
                        dispatch({ type: 'BACK_REQUESTED' });
                    else dispatch({ type: 'COLLECTION_PICKER_CLOSED' });
                }
            }}
          />
        </WebsitePopupOptionalSingleControl>
      </WebsitePopupArgumentSlot>
    </div>;
}
