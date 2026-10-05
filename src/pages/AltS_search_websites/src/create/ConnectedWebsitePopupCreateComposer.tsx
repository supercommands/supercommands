/** Renders the shared Create form in the composer or the existing panel hosts. */
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupCreateField } from './WebsitePopupCreateField';
import { useWebsitePopupCreateForm, type WebsitePopupCreateFormOptions } from './useWebsitePopupCreateForm';

export type ConnectedWebsitePopupCreateComposerProps = WebsitePopupCreateFormOptions & {
    additionalPanelProperties?: ReactNode;
};
export function ConnectedWebsitePopupCreateComposer({ additionalPanelProperties, ...options }: ConnectedWebsitePopupCreateComposerProps) {
    const form = useWebsitePopupCreateForm(options);
    if (!form)
        return null;
    const { grammar, createSession, standalone, requiredFields, optionalViews, propertyAdapter, composerRef, propertyCommandRef, isPropertyFieldVisible, propertyFocusTarget, activeField, markSurface, handleFieldKeyDown, dispatch } = form;
    const panelRequiredFields = standalone ? requiredFields : requiredFields.filter(field => field.source === 'browserLinks');
    return <div ref={composerRef} className="website-popup-create-composer website-popup-custom-scrollbar" data-entity={grammar.entity} data-presentation={standalone ? 'standalone' : 'inline'} onBlur={event => {
        const target = event.relatedTarget as Node | null;
        if (!target || (!event.currentTarget.contains(target) && !options.sidePanelPropertiesTarget?.contains(target)))
            dispatch({ type: 'CREATE_FIELD_FOCUSED', field: null });
    }}>
      {!standalone ? requiredFields.map((field, index) => <WebsitePopupCreateField key={`required:composer:${field.field}`} field={field} adapter={propertyAdapter} surface="composer" optional={false} primary={index === 0}/>) : null}
      {options.sidePanelPropertiesTarget && (standalone || options.sidePanelOpen) ? createPortal(<>
          {panelRequiredFields.map((field, index) => <WebsitePopupCreateField key={`required:panel:${field.field}`} field={field} adapter={propertyAdapter} surface="panel" optional={false} primary={standalone && index === 0}/>)}
          {standalone ? additionalPanelProperties : null}
          {optionalViews.filter(view => view.surface === 'panel').map(({ field }) => <WebsitePopupCreateField key={`option:panel:${field.field}`} field={field} adapter={propertyAdapter} surface="panel"/>)}
        </>, options.sidePanelPropertiesTarget, 'create:panel-fields') : null}
      {optionalViews.filter(view => view.surface === 'composer').map(({ field }) => <WebsitePopupCreateField key={`option:composer:${field.field}`} field={field} adapter={propertyAdapter} surface="composer"/>)}
      {!standalone && isPropertyFieldVisible ? <WebsitePopupArgumentSlot label="Option" width="medium" kind="property-prefix" active={activeField === propertyFocusTarget}>
          <WebsitePopupAutoWidthField ref={propertyCommandRef} className="website-popup-create-composer__input website-popup-create-composer__property-query" value={createSession?.propertyPrefixDraft || ''} placeholder="Filter options" aria-label={`Option for ${grammar.entity}`} autoComplete="off" spellCheck={false} onFocus={() => {
              markSurface('composer');
              dispatch({ type: 'CREATE_FIELD_FOCUSED', field: propertyFocusTarget });
          }} onChange={event => dispatch({ type: 'CREATE_PROPERTY_PREFIX_DRAFT_CHANGED', value: event.currentTarget.value })} onKeyDown={event => handleFieldKeyDown(event, propertyFocusTarget, createSession?.propertyPrefixDraft || '')} data-active={activeField === propertyFocusTarget ? 'true' : 'false'}/>
        </WebsitePopupArgumentSlot> : null}
    </div>;
}
