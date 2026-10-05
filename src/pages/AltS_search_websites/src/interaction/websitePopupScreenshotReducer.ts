import type { WebsitePopupInteractionEvent, WebsitePopupInteractionState } from './websitePopupInteractionTypes';
import { getWebsitePopupCollectionPresentation } from './websitePopupPresentation';
import { isValidWebsitePopupScreenshotViewport, isWebsitePopupScreenshotSuspended, reduceWebsitePopupScreenshotSession } from './websitePopupScreenshotSession';

/** Capture stays on the destination route until the image has been saved. */
export function reduceWebsitePopupScreenshotInteraction(
    state: WebsitePopupInteractionState, event: WebsitePopupInteractionEvent,
): WebsitePopupInteractionState | null {
    const collection = state.collectionSession;
    const capture = collection?.screenshot;
    if (event.type === 'BACK_REQUESTED' && capture && capture.status !== 'idle' && capture.status !== 'saved') {
        if (capture.status === 'saving') return state;
        return { ...state, collectionSession: { ...collection!, screenshot: { status: 'idle' }, pickerOpen: true } };
    }
    if (!event.type.startsWith('COLLECTION_SCREENSHOT_')) {
        // Hidden command controls cannot navigate or replace an in-flight capture.
        if (isWebsitePopupScreenshotSuspended(capture) && event.type !== 'RESET') return state;
        return null;
    }
    if (!collection || collection.captureType !== 'screenshot'
        || !collection.selectedCollectionId || state.route.kind !== 'submode'
        || state.route.submode.id !== 'collection-destination') return state;
    const currentCapture = collection.screenshot;
    if (event.type === 'COLLECTION_SCREENSHOT_PREPARED') {
        if (!event.operationId || event.captureRevision !== collection.captureRevision
            || event.sourceUrl !== collection.sourceUrl || !isValidWebsitePopupScreenshotViewport(event.viewport)
            || (currentCapture.status !== 'idle' && currentCapture.status !== 'error')
            || (currentCapture.status === 'error' && (currentCapture.failureStage === 'saving' || currentCapture.failureStage === 'preparing-image'))
            || (currentCapture.status === 'error' && currentCapture.operationId === event.operationId)) return state;
        return { ...state, collectionSession: { ...collection, pickerOpen: false, screenshot: {
            status: 'preparing', operationId: event.operationId, captureRevision: event.captureRevision,
            mode: event.mode || 'area',
            sourceUrl: event.sourceUrl, viewport: { ...event.viewport }, imageSize: null, rect: null,
        } } };
    }
    // The prefix check above is for routing; this property narrows to the typed capture events.
    if (!('operationId' in event)) return state;
    const screenshot = reduceWebsitePopupScreenshotSession(currentCapture, event);
    if (screenshot === currentCapture) return state;
    return {
        ...state,
        collectionSession: { ...collection, screenshot, pickerOpen: screenshot.status === 'idle' },
        ...(screenshot.status === 'saved' ? {
            route: { kind: 'submode' as const, submode: { id: 'collection-item-details' as const }, presentation: getWebsitePopupCollectionPresentation(state.route), query: '', returnTo: state.route.returnTo },
            inputValue: '', parsedIntent: { kind: 'none' as const }, selectedIndex: 0, suggestionCount: 0,
        } : {}),
    };
}
