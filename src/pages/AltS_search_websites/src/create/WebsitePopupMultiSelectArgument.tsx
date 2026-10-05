/** Presentation-only popup multi-select that keeps its active input visible inside the chip scroller. */
import { useCallback, useLayoutEffect, useRef, type KeyboardEventHandler, type ReactNode } from 'react';
import { FiGrid, FiTag, FiX } from 'react-icons/fi';
import { WebsitePopupUrlToken } from './WebsitePopupUrlToken';
import { WebsitePopupAttachmentIcon } from './WebsitePopupAttachmentIcon';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
export type WebsitePopupMultiSelectArgumentProps = {
    values: readonly WebsitePopupCreateSelectedValue[];
    query: string;
    placeholder: string;
    addPlaceholder: string;
    itemLabel: string;
    inputRef?: (element: HTMLInputElement | null) => void;
    onFocus: () => void;
    onQueryChange: (value: string) => void;
    onKeyDown: KeyboardEventHandler<HTMLInputElement>;
    onRemove: (id: string) => void;
    removable?: boolean;
    trailing?: ReactNode;
    leading?: ReactNode;
};
export function WebsitePopupMultiSelectArgument({ values, query, placeholder, addPlaceholder, itemLabel, inputRef, onFocus, onQueryChange, onKeyDown, onRemove, removable = true, trailing, leading, }: WebsitePopupMultiSelectArgumentProps) {
    const inputElementRef = useRef<HTMLInputElement | null>(null);
    const revealInput = useCallback(() => {
        const input = inputElementRef.current;
        const viewport = input?.closest<HTMLElement>('.website-popup-argument-slot__control');
        const composer = input?.closest<HTMLElement>('.website-popup-create-composer');
        const sidePanelBody = input?.closest<HTMLElement>('.website-popup-create-side-panel__content');
        if (!input || !viewport)
            return;
        const inputRect = input.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        if (inputRect.bottom > viewportRect.bottom) {
            viewport.scrollTop += inputRect.bottom - viewportRect.bottom;
        }
        else if (inputRect.top < viewportRect.top) {
            viewport.scrollTop -= viewportRect.top - inputRect.top;
        }
        if (composer) {
            const composerRect = composer.getBoundingClientRect();
            if (inputRect.bottom > composerRect.bottom)
                composer.scrollTop += inputRect.bottom - composerRect.bottom;
            else if (inputRect.top < composerRect.top)
                composer.scrollTop -= composerRect.top - inputRect.top;
        }
        if (sidePanelBody) {
            const bodyRect = sidePanelBody.getBoundingClientRect();
            if (inputRect.bottom > bodyRect.bottom)
                sidePanelBody.scrollTop += inputRect.bottom - bodyRect.bottom;
            else if (inputRect.top < bodyRect.top)
                sidePanelBody.scrollTop -= bodyRect.top - inputRect.top;
        }
    }, []);
    useLayoutEffect(() => {
        const input = inputElementRef.current;
        const root = input?.getRootNode();
        const activeElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
        if (input && activeElement === input)
            revealInput();
    }, [query, revealInput, values]);
    return (<span className="website-popup-multi-select-argument">
      {leading}
      {values.map(value => value.kind === 'url' && (value.url || value.serializedValue)
        ? <WebsitePopupUrlToken key={value.id} url={value.url || value.serializedValue} label={value.label} removeLabel={`Remove ${itemLabel} "${value.label}"`} onRemove={removable ? () => {
            onRemove(value.id);
            inputElementRef.current?.focus({ preventScroll: true });
            window.requestAnimationFrame(revealInput);
        } : undefined}/>
        : <span className="website-popup-multi-select-argument__token" key={value.id} title={value.serializedValue || value.label}>
          {value.kind === 'tag' ? (value.workspaceId
                ? <FiGrid className="website-popup-multi-select-argument__token-mark" aria-hidden="true"/>
                : <FiTag className="website-popup-multi-select-argument__token-mark" aria-hidden="true"/>) : value.kind === 'reference' && value.referenceType ? (<WebsitePopupAttachmentIcon type={value.referenceType} className="website-popup-multi-select-argument__token-mark"/>) : null}
          <span className="website-popup-multi-select-argument__token-label">{value.label}</span>
          {removable ? <button type="button" className="website-popup-multi-select-argument__token-remove" aria-label={`Remove ${itemLabel} "${value.label}"`} onMouseDown={event => event.preventDefault()} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove(value.id);
                    inputElementRef.current?.focus({ preventScroll: true });
                    window.requestAnimationFrame(revealInput);
                }}>
            <FiX aria-hidden="true"/>
          </button> : null}
        </span>)}
      <input ref={element => {
            inputElementRef.current = element;
            inputRef?.(element);
        }} className="website-popup-create-composer__input website-popup-create-composer__property-query website-popup-multi-select-argument__input" value={query} placeholder={values.length > 0 ? addPlaceholder : placeholder} aria-label={placeholder} autoComplete="off" spellCheck={false} onFocus={() => {
            onFocus();
            window.requestAnimationFrame(revealInput);
        }} onChange={event => onQueryChange(event.currentTarget.value)} onKeyDown={onKeyDown}/>
      {trailing}
    </span>);
}
