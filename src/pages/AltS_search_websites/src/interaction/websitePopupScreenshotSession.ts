/** Transient capture metadata only. Image bytes and object URLs belong to the controller. */
import type { WebsitePopupScreenshotCaptureMode, WebsitePopupScreenshotErrorCode } from '../../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
export type WebsitePopupScreenshotRect = { x: number; y: number; width: number; height: number };
export type WebsitePopupScreenshotViewport = { width: number; height: number };
export type WebsitePopupScreenshotStage = 'preparing' | 'capturing' | 'selecting' | 'confirming' | 'cropping' | 'ready' | 'preparing-image' | 'saving';
type CaptureContext = {
    mode: WebsitePopupScreenshotCaptureMode;
    operationId: string;
    captureRevision: number;
    sourceUrl: string;
    viewport: WebsitePopupScreenshotViewport;
    imageSize: WebsitePopupScreenshotViewport | null;
    rect: WebsitePopupScreenshotRect | null;
};
export type WebsitePopupScreenshotSession = { status: 'idle' }
    | (CaptureContext & { status: WebsitePopupScreenshotStage })
    | (CaptureContext & { status: 'saved'; itemId: string })
    | (CaptureContext & { status: 'error'; failureStage: WebsitePopupScreenshotStage; message: string; canRetry: boolean; code?: WebsitePopupScreenshotErrorCode });
export type WebsitePopupScreenshotEvent = {
    type: 'COLLECTION_SCREENSHOT_PREPARED'; operationId: string; captureRevision: number;
    sourceUrl: string; viewport: WebsitePopupScreenshotViewport;
    mode?: WebsitePopupScreenshotCaptureMode;
} | { type: 'COLLECTION_SCREENSHOT_CAPTURING'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_CAPTURED'; operationId: string; imageSize: WebsitePopupScreenshotViewport }
    | { type: 'COLLECTION_SCREENSHOT_SELECTED'; operationId: string; rect: WebsitePopupScreenshotRect }
    | { type: 'COLLECTION_SCREENSHOT_RESELECTED'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_CONFIRMED'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_CROPPED'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_SAVE_PREPARATION_STARTED'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_SAVE_STARTED'; operationId: string }
    | { type: 'COLLECTION_SCREENSHOT_SAVED'; operationId: string; itemId: string }
    | { type: 'COLLECTION_SCREENSHOT_FAILED'; operationId: string; message: string; canRetry?: boolean; code?: WebsitePopupScreenshotErrorCode }
    | { type: 'COLLECTION_SCREENSHOT_CANCELLED'; operationId: string };

export function isWebsitePopupScreenshotSuspended(session?: WebsitePopupScreenshotSession): boolean {
    return Boolean(session && session.status !== 'idle' && session.status !== 'saved' && session.status !== 'error');
}

const validSize = (size: WebsitePopupScreenshotViewport) => Number.isFinite(size.width)
    && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

/** Invalid/out-of-order events and completions from older operations are ignored. */
export function reduceWebsitePopupScreenshotSession(
    session: WebsitePopupScreenshotSession, event: Exclude<WebsitePopupScreenshotEvent, { type: 'COLLECTION_SCREENSHOT_PREPARED' }>,
): WebsitePopupScreenshotSession {
    if (session.status === 'idle' || session.operationId !== event.operationId) return session;
    switch (event.type) {
        case 'COLLECTION_SCREENSHOT_CAPTURING':
            return session.status === 'preparing' ? { ...session, status: 'capturing' } : session;
        case 'COLLECTION_SCREENSHOT_CAPTURED':
            return session.status === 'capturing' && validSize(event.imageSize)
                ? { ...session, status: session.mode === 'area' ? 'selecting' : 'ready', imageSize: { ...event.imageSize } } : session;
        case 'COLLECTION_SCREENSHOT_SELECTED': {
            const rect = event.rect;
            return session.status === 'selecting' && validSize(rect)
                && Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.x >= 0 && rect.y >= 0
                && rect.x + rect.width <= session.viewport.width && rect.y + rect.height <= session.viewport.height
                ? { ...session, status: 'confirming', rect: { ...rect } } : session;
        }
        case 'COLLECTION_SCREENSHOT_RESELECTED':
            return session.status === 'confirming' || session.status === 'ready' ? { ...session, status: 'selecting', rect: null } : session;
        case 'COLLECTION_SCREENSHOT_CONFIRMED':
            return session.status === 'confirming' && session.rect ? { ...session, status: 'cropping' } : session;
        case 'COLLECTION_SCREENSHOT_CROPPED':
            return session.status === 'cropping' ? { ...session, status: 'ready' } : session;
        case 'COLLECTION_SCREENSHOT_SAVE_PREPARATION_STARTED':
            return session.status === 'ready' || (session.status === 'error' && session.canRetry
                && (session.failureStage === 'saving' || session.failureStage === 'preparing-image'))
                ? { ...session, status: 'preparing-image' } : session;
        case 'COLLECTION_SCREENSHOT_SAVE_STARTED':
            return session.status === 'preparing-image' ? { ...session, status: 'saving' } : session;
        case 'COLLECTION_SCREENSHOT_SAVED':
            return session.status === 'saving' && event.itemId ? { ...session, status: 'saved', itemId: event.itemId } : session;
        case 'COLLECTION_SCREENSHOT_FAILED':
            return session.status !== 'saved' && session.status !== 'error'
                ? { ...session, status: 'error', failureStage: session.status, message: event.message, canRetry: event.canRetry ?? true, code: event.code } : session;
        case 'COLLECTION_SCREENSHOT_CANCELLED':
            return session.status !== 'saving' && session.status !== 'saved' ? { status: 'idle' } : session;
    }
}

export const isValidWebsitePopupScreenshotViewport = validSize;
