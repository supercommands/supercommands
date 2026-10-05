/**
 * Pure DOM utilities used by the website-popup focus controller.
 *
 * Keep browser-specific focus and selection mechanics here so React surfaces
 * can consume the focus layer without duplicating DOM edge-case handling.
 */
import type { WebsiteFocusSnapshot } from './websitePopupFocusTypes';
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');
const isTextSelectionControl = (element: HTMLElement): element is HTMLInputElement | HTMLTextAreaElement => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
export function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
    let activeElement: Element | null = root.activeElement;
    while (activeElement instanceof HTMLElement && activeElement.shadowRoot?.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }
    return activeElement;
}
export function captureWebsiteFocus(documentRef: Document = document): WebsiteFocusSnapshot | null {
    const activeElement = getDeepActiveElement(documentRef);
    if (!(activeElement instanceof HTMLElement))
        return null;
    const snapshot: WebsiteFocusSnapshot = { element: activeElement };
    if (isTextSelectionControl(activeElement) &&
        activeElement.selectionStart !== null &&
        activeElement.selectionEnd !== null) {
        snapshot.textSelection = {
            start: activeElement.selectionStart,
            end: activeElement.selectionEnd,
            direction: activeElement.selectionDirection,
        };
    }
    if (activeElement.isContentEditable) {
        const selection = documentRef.getSelection();
        if (selection?.rangeCount) {
            const range = selection.getRangeAt(0);
            if (activeElement.contains(range.commonAncestorContainer)) {
                snapshot.contentEditableRange = range.cloneRange();
            }
        }
    }
    return snapshot;
}
export function focusWithoutScrolling(element: HTMLElement | null): boolean {
    if (!element?.isConnected)
        return false;
    try {
        element.focus({ preventScroll: true });
    }
    catch {
        element.focus();
    }
    const root = element.getRootNode();
    const activeElement = root instanceof ShadowRoot
        ? getDeepActiveElement(root)
        : getDeepActiveElement(element.ownerDocument);
    return activeElement === element || element.contains(activeElement);
}
export function restoreWebsiteFocus(snapshot: WebsiteFocusSnapshot | null, documentRef: Document = document): boolean {
    if (!snapshot?.element.isConnected)
        return false;
    if (!focusWithoutScrolling(snapshot.element))
        return false;
    if (snapshot.textSelection && isTextSelectionControl(snapshot.element)) {
        try {
            snapshot.element.setSelectionRange(snapshot.textSelection.start, snapshot.textSelection.end, snapshot.textSelection.direction);
        }
        catch {
            // Some input types do not support selection ranges; focus restoration is still valid.
        }
    }
    const range = snapshot.contentEditableRange;
    if (range?.startContainer.isConnected && range.endContainer.isConnected) {
        const selection = documentRef.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }
    return true;
}
export function isEventInsidePopup(event: Event, host: HTMLElement, shadowRoot: ShadowRoot): boolean {
    const path = event.composedPath();
    return path.includes(host) || path.includes(shadowRoot);
}
export function isFocusInsidePopup(host: HTMLElement, shadowRoot: ShadowRoot): boolean {
    const activeElement = getDeepActiveElement(shadowRoot);
    return Boolean(activeElement && (shadowRoot.contains(activeElement) || host === activeElement));
}
export function getFocusableElements(root: ParentNode): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(element => {
        if (!element.isConnected || element.tabIndex < 0 || element.getAttribute('aria-hidden') === 'true')
            return false;
        if (element.matches(':disabled'))
            return false;
        const ownerWindow = element.ownerDocument.defaultView;
        const style = ownerWindow?.getComputedStyle(element);
        if (style?.display === 'none' || style?.visibility === 'hidden')
            return false;
        return element.getClientRects().length > 0;
    });
}
