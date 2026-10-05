/** Keep inline and side-panel Create inputs on the same structured draft path. */
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import { serializeWebsitePopupCreateGrammarDraft } from './websitePopupCreateGrammarParser';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
export function writeWebsitePopupCreateField(store: WebsitePopupInteractionStoreApi, grammar: WebsitePopupCreateEntityGrammar, field: string, value: string) {
    const currentValues = store.getState().state.createSession?.fieldValues || {};
    const nextValues = { ...currentValues, [field]: value };
    const nextQuery = serializeWebsitePopupCreateGrammarDraft(nextValues, grammar);
    store.getState().dispatch({ type: 'CREATE_FIELD_VALUE_CHANGED', field, value });
    store.getState().dispatch({ type: 'QUERY_CHANGED', query: nextQuery, parsedIntent: { kind: 'none' } });
}
/** Selection, field text and command compatibility text have one write path. */
export function writeWebsitePopupCreateSelections(store: WebsitePopupInteractionStoreApi, grammar: WebsitePopupCreateEntityGrammar, field: string, values: WebsitePopupCreateSelectedValue[]) {
    const dispatch = store.getState().dispatch;
    if (!grammar.fields.find(candidate => candidate.field === field)?.required) {
        dispatch({ type: 'CREATE_OPTION_PRESENCE_SYNCED', field, present: values.length > 0 });
    }
    dispatch({ type: 'CREATE_FIELD_SELECTION_CHANGED', field, values });
    writeWebsitePopupCreateField(store, grammar, field, values.map(value => value.serializedValue).join(', '));
}
