/**
 * Lifecycle controller for focus ownership inside the popup website popup.
 *
 * The controller is intentionally UI-agnostic. A future popup surface supplies
 * live getters for its host, Shadow Root, and primary focus target, then calls
 * activate/deactivate as its own lifecycle changes.
 */
import type { WebsiteFocusSnapshot, WebsitePopupFocusControllerOptions, WebsitePopupFocusDeactivateOptions, } from './websitePopupFocusTypes';
import { captureWebsiteFocus, focusWithoutScrolling, getDeepActiveElement, getFocusableElements, isEventInsidePopup, isFocusInsidePopup, restoreWebsiteFocus, } from './websitePopupFocusUtils';
const DEFAULT_FOCUS_RETRY_FRAMES = 2;
export class WebsitePopupFocusController {
    readonly #options: WebsitePopupFocusControllerOptions;
    readonly #document: Document;
    readonly #window: Window;
    readonly #pendingFrames = new Set<number>();
    #active = false;
    #focusReclaimPaused = false;
    #websiteFocusSnapshot: WebsiteFocusSnapshot | null = null;
    #listeningShadowRoot: ShadowRoot | null = null;
    constructor(options: WebsitePopupFocusControllerOptions) {
        const documentRef = options.document ?? document;
        const windowRef = documentRef.defaultView;
        if (!windowRef)
            throw new Error('WebsitePopupFocusController requires a document with an active window.');
        this.#options = options;
        this.#document = documentRef;
        this.#window = windowRef;
    }
    get active(): boolean {
        return this.#active;
    }
    activate(): boolean {
        if (this.#active)
            return this.ownsFocus() || this.focusInitialTarget();
        const host = this.#options.getHost();
        const shadowRoot = this.#options.getShadowRoot();
        if (!host?.isConnected || !shadowRoot || shadowRoot.host !== host)
            return false;
        this.#websiteFocusSnapshot = captureWebsiteFocus(this.#document);
        this.#active = true;
        this.#focusReclaimPaused = false;
        this.#attachListeners(shadowRoot);
        this.#focusWithRetries();
        return true;
    }
    deactivate(options: WebsitePopupFocusDeactivateOptions = {}): void {
        const shouldRestore = options.restoreFocus ?? this.#options.restoreFocusOnDeactivate ?? true;
        this.#active = false;
        this.#focusReclaimPaused = true;
        this.#cancelPendingFrames();
        this.#detachListeners();
        if (shouldRestore)
            restoreWebsiteFocus(this.#websiteFocusSnapshot, this.#document);
        this.#websiteFocusSnapshot = null;
    }
    dispose(): void {
        this.deactivate({ restoreFocus: false });
    }
    pauseFocusReclaim(): void {
        this.#focusReclaimPaused = true;
        this.#cancelPendingFrames();
    }
    resumeFocusReclaim(): void {
        if (!this.#active)
            return;
        this.#focusReclaimPaused = false;
        this.#scheduleFocusAttempt();
    }
    ownsFocus(): boolean {
        const host = this.#options.getHost();
        const shadowRoot = this.#options.getShadowRoot();
        return Boolean(host && shadowRoot && isFocusInsidePopup(host, shadowRoot));
    }
    focusInitialTarget(): boolean {
        if (!this.#active || this.#focusReclaimPaused)
            return false;
        return focusWithoutScrolling(this.#options.getInitialFocusTarget());
    }
    #attachListeners(shadowRoot: ShadowRoot): void {
        this.#listeningShadowRoot = shadowRoot;
        this.#document.addEventListener('focusin', this.#handleDocumentFocusIn, true);
        shadowRoot.addEventListener('keydown', this.#handleShadowKeyDown);
        shadowRoot.addEventListener('keyup', this.#handleShadowKeyEvent);
        shadowRoot.addEventListener('keypress', this.#handleShadowKeyEvent);
    }
    #detachListeners(): void {
        this.#document.removeEventListener('focusin', this.#handleDocumentFocusIn, true);
        this.#listeningShadowRoot?.removeEventListener('keydown', this.#handleShadowKeyDown);
        this.#listeningShadowRoot?.removeEventListener('keyup', this.#handleShadowKeyEvent);
        this.#listeningShadowRoot?.removeEventListener('keypress', this.#handleShadowKeyEvent);
        this.#listeningShadowRoot = null;
    }
    #handleDocumentFocusIn = (event: FocusEvent): void => {
        if (!this.#active || this.#focusReclaimPaused || !this.#document.hasFocus())
            return;
        const host = this.#options.getHost();
        const shadowRoot = this.#options.getShadowRoot();
        if (!host || !shadowRoot || isEventInsidePopup(event, host, shadowRoot))
            return;
        this.#scheduleFocusAttempt();
    };
    #handleShadowKeyDown = (event: Event): void => {
        if (!(event instanceof KeyboardEvent) || !this.#active)
            return;
        if (event.defaultPrevented)
            return;
        event.stopPropagation();
        if (event.key === 'Escape') {
            event.preventDefault();
            this.#options.onRequestClose();
            return;
        }
        if (event.key !== 'Tab')
            return;
        const shadowRoot = this.#options.getShadowRoot();
        if (!shadowRoot)
            return;
        const focusableElements = getFocusableElements(shadowRoot);
        if (focusableElements.length === 0) {
            event.preventDefault();
            this.focusInitialTarget();
            return;
        }
        const activeElement = getDeepActiveElement(shadowRoot);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeIndex = activeElement instanceof HTMLElement
            ? focusableElements.indexOf(activeElement)
            : -1;
        const shouldWrapBackward = event.shiftKey && activeIndex <= 0;
        const shouldWrapForward = !event.shiftKey && (activeIndex < 0 || activeElement === lastElement);
        if (!shouldWrapBackward && !shouldWrapForward)
            return;
        event.preventDefault();
        focusWithoutScrolling(shouldWrapBackward ? lastElement : firstElement);
    };
    #handleShadowKeyEvent = (event: Event): void => {
        if (this.#active)
            event.stopPropagation();
    };
    #focusWithRetries(): void {
        this.#cancelPendingFrames();
        this.focusInitialTarget();
        const retryFrames = Math.max(0, this.#options.focusRetryFrames ?? DEFAULT_FOCUS_RETRY_FRAMES);
        const retry = (remaining: number) => {
            if (!this.#active || this.#focusReclaimPaused || this.ownsFocus() || remaining <= 0)
                return;
            this.focusInitialTarget();
            this.#scheduleFrame(() => retry(remaining - 1));
        };
        this.#scheduleFrame(() => retry(retryFrames));
    }
    #scheduleFocusAttempt(): void {
        if (!this.#active || this.#focusReclaimPaused || this.#pendingFrames.size > 0)
            return;
        this.#scheduleFrame(() => {
            if (!this.ownsFocus())
                this.focusInitialTarget();
        });
    }
    #scheduleFrame(callback: () => void): void {
        const frame = this.#window.requestAnimationFrame(() => {
            this.#pendingFrames.delete(frame);
            callback();
        });
        this.#pendingFrames.add(frame);
    }
    #cancelPendingFrames(): void {
        this.#pendingFrames.forEach(frame => this.#window.cancelAnimationFrame(frame));
        this.#pendingFrames.clear();
    }
}
