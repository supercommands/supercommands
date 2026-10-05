/** One field renderer for both Create presentations; actions come from the shared form controller. */
import type { ComponentProps } from 'react';
import type { WebsitePopupCreateFieldGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreateSurface } from '../interaction/websitePopupInteractionTypes';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupSpotlightTextareaField } from './WebsitePopupSpotlightTextareaField';
import { WebsitePopupPropertyField, type WebsitePopupPropertyDataAdapter } from './WebsitePopupPropertyField';
import { getWebsitePopupCreateControlKind } from './websitePopupCreateFieldPolicy';

export type WebsitePopupCreateFieldAdapter = WebsitePopupPropertyDataAdapter & {
    text: (field: WebsitePopupCreateFieldGrammar, surface: WebsitePopupCreateSurface, primary: boolean) => ComponentProps<typeof WebsitePopupAutoWidthField>;
    textarea: (field: WebsitePopupCreateFieldGrammar, surface: WebsitePopupCreateSurface, primary: boolean) => ComponentProps<typeof WebsitePopupSpotlightTextareaField>;
};
export function WebsitePopupCreateField({ field, adapter, surface, optional = !field.required, primary = false }: {
    field: WebsitePopupCreateFieldGrammar;
    adapter: WebsitePopupCreateFieldAdapter;
    surface: WebsitePopupCreateSurface;
    optional?: boolean;
    primary?: boolean;
}) {
    const kind = getWebsitePopupCreateControlKind(field);
    if (kind !== 'text' && kind !== 'textarea')
        return <WebsitePopupPropertyField field={field} adapter={adapter} surface={surface} optional={optional} primary={primary}/>;
    return <WebsitePopupArgumentSlot fieldId={field.field} label={field.label.replace(/\b\w/g, character => character.toUpperCase())} width={field.width || 'medium'} kind={kind === 'textarea' ? 'multiline-text' : 'single-line-text'} active={adapter.isActive(field, surface)} onFocusCapture={() => adapter.onSurfaceFocus(surface)}>
      {kind === 'textarea' ? <WebsitePopupSpotlightTextareaField {...adapter.textarea(field, surface, primary)}/> : <WebsitePopupAutoWidthField {...adapter.text(field, surface, primary)}/>}
    </WebsitePopupArgumentSlot>;
}
