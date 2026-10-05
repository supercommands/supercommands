/**
 * Public contracts for the standalone website-popup focus layer.
 *
 * These types contain no React, Chrome, storage, or popup-UI dependencies so
 * the controller can be connected to any future popup interface.
 */
export type TextControlSelectionSnapshot = {
    start: number;
    end: number;
    direction: 'forward' | 'backward' | 'none' | null;
};
export type WebsiteFocusSnapshot = {
    element: HTMLElement;
    textSelection?: TextControlSelectionSnapshot;
    contentEditableRange?: Range;
};
export type WebsitePopupFocusControllerOptions = {
    getHost: () => HTMLElement | null;
    getShadowRoot: () => ShadowRoot | null;
    getInitialFocusTarget: () => HTMLElement | null;
    onRequestClose: () => void;
    restoreFocusOnDeactivate?: boolean;
    focusRetryFrames?: number;
    document?: Document;
};
export type WebsitePopupFocusDeactivateOptions = {
    restoreFocus?: boolean;
};
