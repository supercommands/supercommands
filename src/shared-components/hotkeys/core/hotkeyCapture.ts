/** Detect recording before global shortcut listeners dispatch, including inside Shadow DOM. */
export const isHotkeyRecordingActive = (event?: Event): boolean => {
    const selector = '[data-is-hotkey-input="true"], [data-hotkey-capture]';
    const activeSelector = '[data-hotkey-capture-active="true"]';
    const isCaptureElement = (element: unknown) => element instanceof Element && Boolean(element.closest(selector));
    const hasActiveCaptureMarker = (root: Document | ShadowRoot): boolean => {
        if (root.querySelector(activeSelector))
            return true;
        const elements = Array.from(root.querySelectorAll('*'));
        return elements.some(element => element.shadowRoot ? hasActiveCaptureMarker(element.shadowRoot) : false);
    };
    if (event?.composedPath().some(isCaptureElement))
        return true;
    let active = document.activeElement;
    while (active) {
        if (isCaptureElement(active))
            return true;
        if (active instanceof HTMLInputElement && active.readOnly && active.classList.contains('opacity-0'))
            return true;
        active = active.shadowRoot?.activeElement ?? null;
    }
    if (hasActiveCaptureMarker(document))
        return true;
    return Boolean((window as any).__cmdosKeystrokeRecordingActive);
};
