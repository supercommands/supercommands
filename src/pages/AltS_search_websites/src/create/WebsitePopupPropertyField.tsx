/** Shared Create controls. Adapters supply state and actions, never alternate control markup. */
import type { ComponentProps } from 'react';
import { FiStar, FiX } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import type { WebsitePopupCreateFieldGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import type { WebsitePopupCreateSurface } from '../interaction/websitePopupInteractionTypes';
import { WebsitePopupArgumentSlot } from './WebsitePopupArgumentSlot';
import { WebsitePopupAutoWidthField } from './WebsitePopupAutoWidthField';
import { WebsitePopupHotkeyCapture } from './WebsitePopupHotkeyCapture';
import { WebsitePopupMultiSelectArgument } from './WebsitePopupMultiSelectArgument';
import { WebsitePopupOptionalSingleControl } from './WebsitePopupOptionalSingleControl';
import { getWebsitePopupCreateControlKind, getWebsitePopupMultiSelectPresentation, } from './websitePopupCreateFieldPolicy';
type Field = WebsitePopupCreateFieldGrammar;
type Surface = WebsitePopupCreateSurface;
export type WebsitePopupPropertyDataAdapter = {
    isActive: (field: Field, surface: Surface) => boolean;
    onSurfaceFocus: (surface: Surface) => void;
    multiSelect: (field: Field, optional: boolean, surface: Surface, primary?: boolean) => ComponentProps<typeof WebsitePopupMultiSelectArgument>;
    hotkey: (field: Field, surface: Surface) => ComponentProps<typeof WebsitePopupHotkeyCapture>;
    input: (field: Field, surface: Surface) => ComponentProps<typeof WebsitePopupAutoWidthField>;
    optional: (field: Field, surface: Surface) => Omit<ComponentProps<typeof WebsitePopupOptionalSingleControl>, 'children'>;
    favorite: (field: Field, surface: Surface) => ComponentProps<'button'>;
    onRemove: (field: Field, surface: Surface) => void;
};
const titleCase = (value: string) => value.replace(/\b\w/g, character => character.toUpperCase());
export function WebsitePopupPropertyField({ field, adapter, surface = 'panel', optional = !field.required, primary = false, }: {
    field: Field;
    adapter: WebsitePopupPropertyDataAdapter;
    surface?: Surface;
    optional?: boolean;
    primary?: boolean;
}) {
    const kind = getWebsitePopupCreateControlKind(field);
    const active = adapter.isActive(field, surface);
    const favorite = kind === 'favorite' && surface === 'panel' ? adapter.favorite(field, surface) : null;
    const input = kind === 'text-command' || kind === 'single-select' ? adapter.input(field, surface) : null;
    const recurring = field.source === 'recurring';
    const placeholder = kind === 'text-command'
        ? 'Enter command'
        : recurring
            ? 'Choose Recurring'
            : field.source === 'time'
                ? 'Enter date or time'
                : `Search ${titleCase(field.label)}`;
    const presentation = getWebsitePopupMultiSelectPresentation(field);
    return (<WebsitePopupArgumentSlot fieldId={field.field} label={titleCase(field.label)} width={optional ? 'medium' : field.width || 'medium'} kind={kind === 'multi-select' ? 'multi-select' : 'single-select'} controlType={kind === 'text-command' || kind === 'hotkey' || kind === 'favorite' ? kind : undefined} active={active} onFocusCapture={() => adapter.onSurfaceFocus(surface)}>
      {kind === 'hotkey' ? (<WebsitePopupHotkeyCapture {...adapter.hotkey(field, surface)} removable={surface === 'composer'}/>) : input ? (<WebsitePopupOptionalSingleControl {...adapter.optional(field, surface)} removable={surface === 'composer'}>
          <WebsitePopupAutoWidthField {...input} className={kind === 'text-command'
                ? 'website-popup-create-composer__input'
                : 'website-popup-create-composer__input website-popup-create-composer__property-query website-popup-create-option-control'} placeholder={placeholder} stableValue={input.stableValue ?? (kind === 'text-command' ? input.value : placeholder)} aria-label={kind === 'text-command'
                ? 'Text Command'
                : recurring
                    ? 'Choose Recurring'
                    : `Search ${field.label} options`} readOnly={recurring} autoComplete="off" spellCheck={false} data-active={active ? 'true' : 'false'}/>
        </WebsitePopupOptionalSingleControl>) : kind === 'multi-select' && presentation ? (<WebsitePopupMultiSelectArgument {...adapter.multiSelect(field, optional, surface, primary)} {...presentation} removable={surface === 'composer'} trailing={optional && surface === 'composer' ? (<button type="button" className="website-popup-multi-select-argument__token-remove" aria-label={`Remove ${titleCase(field.label)} option`} onMouseDown={event => event.preventDefault()} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    adapter.onRemove(field, surface);
                }}>
                <FiX aria-hidden="true"/>
              </button>) : undefined}/>) : favorite ? (<button {...favorite} type="button" className="website-popup-create-side-panel__favorite-button">
          {favorite['aria-pressed'] ? <FaStar aria-hidden="true"/> : <FiStar aria-hidden="true"/>}
        </button>) : kind === 'favorite' ? (<WebsitePopupOptionalSingleControl {...adapter.optional(field, surface)} removable={surface === 'composer'}>
          <span className="website-popup-create-composer__input website-popup-create-option-placeholder__readonly">
            Added to Favorites
          </span>
        </WebsitePopupOptionalSingleControl>) : (<span className="website-popup-create-option-placeholder">
          <kbd>{field.primaryPrefix}</kbd>
          {surface === 'composer' ? (<button type="button" aria-label={`Remove ${field.label} option`} onClick={() => adapter.onRemove(field, surface)}>
              <FiX aria-hidden="true"/>
            </button>) : null}
        </span>)}
    </WebsitePopupArgumentSlot>);
}
