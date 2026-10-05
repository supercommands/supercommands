/** Shared popup form shell: visual slots and picker geometry, without entity or persistence logic. */
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import type { WebsitePopupPresentation } from '../interaction/websitePopupPresentation';
export type WebsitePopupFormPanelProps = {
    children?: ReactNode;
    contentBeforeFields?: ReactNode;
    contentAfterFields?: ReactNode;
    fields?: ReactNode;
    picker?: ReactNode;
    footer?: ReactNode;
    presentation?: WebsitePopupPresentation;
    label: string;
    headerContent?: ReactNode;
    onPanelMount?: (element: HTMLElement | null) => void;
    onEscape: () => void;
    onFieldsMount?: (element: HTMLDivElement | null) => void;
    onPickerMount?: (element: HTMLDivElement | null) => void;
    activePickerFieldId?: string | null;
    onFooterMount?: (element: HTMLDivElement | null) => void;
    onPickerClose?: () => void;
    pickerCloseLabel?: string;
    pickerCloseInField?: boolean;
    onPickerDismiss?: () => void;
};
export function WebsitePopupFormPanel({ children, contentBeforeFields, contentAfterFields, fields, picker, footer, presentation = 'inline', label, headerContent, onPanelMount, onEscape, onFieldsMount, onPickerMount, activePickerFieldId = null, onFooterMount, onPickerClose, pickerCloseLabel = 'Close dropdown', pickerCloseInField = false, onPickerDismiss, }: WebsitePopupFormPanelProps) {
    const panelRef = useRef<HTMLElement | null>(null);
    const mountPanel = useCallback((element: HTMLElement | null) => {
        panelRef.current = element;
        onPanelMount?.(element);
    }, [onPanelMount]);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const mountPicker = useCallback((element: HTMLDivElement | null) => {
        pickerRef.current = element;
        onPickerMount?.(element);
    }, [onPickerMount]);
    const pickerFieldId = activePickerFieldId;
    useEffect(() => {
        if (!pickerFieldId || !onPickerDismiss) return;
        const panel = panelRef.current;
        const field = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-field-id]') || [])
            .find(element => element.dataset.fieldId === pickerFieldId);
        const documentOwner = panel?.ownerDocument;
        if (!documentOwner) return;
        const dismissOutside = (event: PointerEvent) => {
            // composedPath reaches the actual control through the extension's Shadow DOM.
            const path = event.composedPath();
            if (path.includes(pickerRef.current!) || (field && path.includes(field))) return;
            onPickerDismiss(); // Do not steal focus or consume the outside click.
        };
        documentOwner.addEventListener('pointerdown', dismissOutside, true);
        return () => documentOwner.removeEventListener('pointerdown', dismissOutside, true);
    }, [pickerFieldId, onPickerDismiss]);
    useLayoutEffect(() => {
        const panel = panelRef.current;
        const content = contentRef.current;
        const picker = pickerRef.current;
        const field = pickerFieldId
            ? Array.from(content?.querySelectorAll<HTMLElement>('[data-field-id]') || []).find(element => element.dataset.fieldId === pickerFieldId)
            : undefined;
        const anchor = field?.querySelector<HTMLElement>('.website-popup-argument-slot__control');
        if (!panel || !content || !picker || !anchor)
            return;
        const previousPaddingBottom = content.style.paddingBottom;
        content.style.paddingBottom =
            'calc(var(--website-popup-header-padding-x) + var(--website-popup-tab-picker-height))';
        const positionPicker = () => {
            const panelRect = panel.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            const styles = getComputedStyle(panel);
            const preferredHeight = Number.parseFloat(styles.getPropertyValue('--website-popup-tab-picker-height')) || contentRect.height;
            const gap = Number.parseFloat(styles.getPropertyValue('--website-popup-results-padding-y')) || 0;
            const desiredHeight = Math.min(preferredHeight, Math.max(0, contentRect.height - gap));
            let anchorRect = anchor.getBoundingClientRect();
            const below = Math.max(0, contentRect.bottom - anchorRect.bottom - gap);
            if (below < desiredHeight) {
                content.scrollTop += desiredHeight - below;
                anchorRect = anchor.getBoundingClientRect();
            }
            const availableHeight = Math.min(desiredHeight, Math.max(0, contentRect.bottom - anchorRect.bottom - gap));
            const left = Math.max(0, anchorRect.left - panelRect.left);
            picker.style.left = `${left}px`;
            picker.style.width = `${Math.min(anchorRect.width, panelRect.width - left)}px`;
            picker.style.maxHeight = `${availableHeight}px`;
            const results = picker.querySelector<HTMLElement>('.website-popup-results');
            if (results) {
                const toolbarHeight = picker.querySelector<HTMLElement>('[data-picker-toolbar]')?.getBoundingClientRect().height || 0;
                results.style.maxHeight = `${Math.max(0, availableHeight - toolbarHeight)}px`;
            }
            picker.style.top = `${anchorRect.bottom - panelRect.top + gap}px`;
            picker.style.bottom = '';
            picker.dataset.placement = 'below';
        };
        positionPicker();
        content.addEventListener('scroll', positionPicker);
        window.addEventListener('resize', positionPicker);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(positionPicker);
        observer?.observe(panel);
        observer?.observe(anchor);
        const contentsObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(positionPicker);
        contentsObserver?.observe(picker, { childList: true, subtree: true });
        return () => {
            content.removeEventListener('scroll', positionPicker);
            window.removeEventListener('resize', positionPicker);
            observer?.disconnect();
            contentsObserver?.disconnect();
            content.style.paddingBottom = previousPaddingBottom;
        };
    }, [pickerFieldId]);

    return (<aside ref={mountPanel} className="website-popup-create-side-panel" data-presentation={presentation} aria-label={`${label} details`} onKeyDown={event => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            event.stopPropagation();
            onEscape();
        }}>
      <header className="website-popup-create-side-panel__header">
        {headerContent ?? <span>{label}</span>}
      </header>
      <div ref={contentRef} className="website-popup-create-side-panel__content website-popup-custom-scrollbar">
        {contentBeforeFields}
        <div ref={onFieldsMount} className="website-popup-create-side-panel__selected-properties">{fields}</div>
        {contentAfterFields}
      </div>
      <div ref={mountPicker} className="website-popup-create-side-panel__picker-target" data-active={pickerFieldId ? 'true' : 'false'} data-dismissible={onPickerClose ? 'true' : undefined}>
        {onPickerClose && pickerFieldId && !pickerCloseInField ? <div className="website-popup-collection-picker__toolbar" data-picker-toolbar>
          <button type="button" className="website-popup-create-footer__expand-details" aria-label={pickerCloseLabel} title={pickerCloseLabel}
            onMouseDown={event => event.preventDefault()} onClick={onPickerClose}><FiX aria-hidden="true"/></button>
        </div> : null}
        {picker}
      </div>
      <div className="website-popup-create-side-panel__footer">
        <div ref={onFooterMount} className="website-popup-create-side-panel__save-target">{footer}</div>
      </div>
      {children}
    </aside>);
}
