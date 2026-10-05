import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import { captureWebsitePopupScreenshot, cancelWebsitePopupScreenshot } from '../bridge/websitePopupScreenshotBridge';
import type { WebsitePopupScreenshotCaptureMode } from '../../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
import { cropViewportScreenshot } from '../../../../shared-components/pageExtraction/screenshot/cropViewportScreenshot';
import { WebsitePopupScreenshotSaveController } from './WebsitePopupScreenshotSaveController';
import { WebsitePopupScreenshotCaptureError } from '../../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
import { collectionSourceLabel } from '../../../../shared-components/collections/collectionCaptureSource';
import { WebsitePopupScreenshotSound } from './WebsitePopupScreenshotSound';

export type WebsitePopupScreenshotDraft = {
  operationId: string;
  sourceUrl: string;
  dataUrl: string;
  imageSize: { width: number; height: number };
  title: string;
  fileName: string;
  croppedBlob?: Blob;
};

/** Runtime-owned bytes. Zustand owns lifecycle/metadata; the future overlay reads this draft. */
export class WebsitePopupScreenshotCaptureController {
  #store: WebsitePopupInteractionStoreApi;
  #draft: WebsitePopupScreenshotDraft | null = null;
  #disposed = false;
  #sound = new WebsitePopupScreenshotSound();
  #unsubscribe: () => void;
  #pendingCaptureId: string | null = null;
  readonly saveController: WebsitePopupScreenshotSaveController;
  constructor(store: WebsitePopupInteractionStoreApi) {
    this.#store = store;
    this.saveController = new WebsitePopupScreenshotSaveController(store, operationId => this.getDraft(operationId));
    this.#unsubscribe = store.subscribe(({ state }) => {
      const capture = state.collectionSession?.screenshot;
      if (this.#pendingCaptureId && (!capture || capture.status === 'idle' || capture.status === 'error'
          || capture.operationId !== this.#pendingCaptureId)) {
        void cancelWebsitePopupScreenshot(this.#pendingCaptureId);
        this.#pendingCaptureId = null;
      }
      const retryableSaveError = capture?.status === 'error' && capture.canRetry
        && (capture.failureStage === 'saving' || capture.failureStage === 'preparing-image');
      if (!capture || capture.status === 'idle' || capture.status === 'saved' || (capture.status === 'error' && !retryableSaveError)
          || capture.operationId !== this.#draft?.operationId) this.#draft = null;
      else if (capture.status === 'selecting' && this.#draft) this.#draft.croppedBlob = undefined;
    });
    window.addEventListener('resize', this.#contextChanged);
    window.addEventListener('pagehide', this.#invalidate);
    window.addEventListener('popstate', this.#contextChanged);
    window.addEventListener('hashchange', this.#contextChanged);
    document.addEventListener('visibilitychange', this.#visibilityChanged);
  }
  getDraft(operationId: string): WebsitePopupScreenshotDraft | null {
    return this.#draft?.operationId === operationId ? this.#draft : null;
  }
  async captureMode(mode: WebsitePopupScreenshotCaptureMode, organisationId: string | null): Promise<void> {
    const draft = await this.start(mode);
    if (draft?.croppedBlob) await this.saveController.save(organisationId, draft.operationId);
  }
  #current(operationId: string): boolean {
    const session = this.#store.getState().state.collectionSession;
    const capture = session?.screenshot;
    return !this.#disposed && Boolean(capture && capture.status !== 'idle'
      && capture.status !== 'error' && capture.status !== 'saved'
      && capture.operationId === operationId && session?.captureRevision === capture.captureRevision
      && capture.sourceUrl === window.location.href && capture.viewport.width === window.innerWidth
      && capture.viewport.height === window.innerHeight);
  }
  #visibilityChanged = () => { if (document.hidden) this.#invalidate(); };
  #contextChanged = () => {
    const capture = this.#store.getState().state.collectionSession?.screenshot;
    // Browsers/pages can dispatch resize or history events without changing capture coordinates.
    if (capture && capture.status !== 'idle' && (capture.sourceUrl !== window.location.href
        || capture.viewport.width !== window.innerWidth || capture.viewport.height !== window.innerHeight)) this.#invalidate();
  };
  #invalidateOperation(operationId: string) {
    const capture = this.#store.getState().state.collectionSession?.screenshot;
    if (!this.#disposed && capture && capture.status !== 'idle' && capture.operationId === operationId) this.#invalidate();
  }
  #invalidate = () => {
    const capture = this.#store.getState().state.collectionSession?.screenshot;
    if (!capture || capture.status === 'idle' || capture.status === 'saved' || capture.status === 'error'
        || capture.status === 'saving' || capture.status === 'ready' || capture.status === 'preparing-image') return;
    this.#draft = null;
    this.#store.getState().dispatch({ type: 'COLLECTION_SCREENSHOT_FAILED', operationId: capture.operationId,
      message: 'The page or viewport changed. Start capture again.' });
  };
  async start(mode: WebsitePopupScreenshotCaptureMode = 'area'): Promise<WebsitePopupScreenshotDraft | null> {
    if (this.#disposed) return null;
    const { state, dispatch } = this.#store.getState();
    const session = state.collectionSession;
    if (!session || session.captureType !== 'screenshot' || !session.selectedCollectionId
        || !session.sourceUrl || document.hidden
        || state.route.kind !== 'submode' || state.route.submode.id !== 'collection-destination') return null;
    this.#sound.prepare();
    const operationId = crypto.randomUUID();
    const title = `${session.sourceContext?.title || document.title.trim() || collectionSourceLabel(session.sourceUrl)} — Screenshot`;
    const fileName = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    dispatch({ type: 'COLLECTION_SCREENSHOT_PREPARED', operationId, captureRevision: session.captureRevision,
      sourceUrl: session.sourceUrl, mode, viewport: { width: window.innerWidth, height: window.innerHeight } });
    if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
    try {
      // Allow React to commit suspension, then allow the hidden surface to paint.
      await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
      const popupHost = document.querySelector<HTMLElement>('[data-website-popup-layer-host="true"]');
      const popupLayer = popupHost?.shadowRoot?.querySelector<HTMLElement>('.website-popup-layer');
      if (!popupLayer?.hidden) throw new Error('The popup has not finished hiding. Start capture again.');
      dispatch({ type: 'COLLECTION_SCREENSHOT_CAPTURING', operationId });
      this.#pendingCaptureId = operationId;
      const result = await captureWebsitePopupScreenshot({ operationId, sourceUrl: session.sourceUrl, mode });
      if (this.#pendingCaptureId === operationId) this.#pendingCaptureId = null;
      if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to decode the captured screenshot.'));
        image.src = result.dataUrl;
      });
      if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
      const imageSize = { width: image.naturalWidth, height: image.naturalHeight };
      if (!imageSize.width || !imageSize.height) throw new Error('The captured screenshot is empty.');
      const croppedBlob = mode === 'area' ? undefined : await fetch(result.dataUrl).then(response => response.blob());
      if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
      this.#draft = { ...result, imageSize, title, fileName, croppedBlob };
      dispatch({ type: 'COLLECTION_SCREENSHOT_CAPTURED', operationId, imageSize });
      if (mode !== 'area') this.#sound.play();
      return this.#draft;
    } catch (error) {
      if (this.#pendingCaptureId === operationId) this.#pendingCaptureId = null;
      const latest = this.#store.getState().state.collectionSession?.screenshot;
      if (!this.#disposed && latest?.status !== 'idle' && latest?.status !== 'error' && latest?.operationId === operationId) dispatch({ type: 'COLLECTION_SCREENSHOT_FAILED', operationId,
        message: error instanceof Error ? error.message : 'Screenshot capture failed.',
        ...(error instanceof WebsitePopupScreenshotCaptureError && error.code ? { code: error.code } : {}) });
      return null;
    }
  }
  async confirmSelection(operationId: string): Promise<Blob | null> {
    const { state, dispatch } = this.#store.getState();
    const capture = state.collectionSession?.screenshot;
    const draft = this.getDraft(operationId);
    if (!capture || capture.status !== 'confirming' || capture.operationId !== operationId
        || !capture.rect || !draft) return null;
    if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
    dispatch({ type: 'COLLECTION_SCREENSHOT_CONFIRMED', operationId });
    this.#sound.prepare();
    try {
      const blob = await cropViewportScreenshot(draft.dataUrl, capture.rect, capture.viewport);
      if (!this.#current(operationId)) { this.#invalidateOperation(operationId); return null; }
      const latest = this.#store.getState().state.collectionSession?.screenshot;
      if (latest?.status !== 'cropping' || latest.operationId !== operationId) return null;
      draft.croppedBlob = blob;
      dispatch({ type: 'COLLECTION_SCREENSHOT_CROPPED', operationId });
      this.#sound.play();
      return blob;
    } catch (error) {
      const latest = this.#store.getState().state.collectionSession?.screenshot;
      if (!this.#disposed && latest?.status !== 'idle' && latest?.status !== 'error' && latest?.operationId === operationId) dispatch({ type: 'COLLECTION_SCREENSHOT_FAILED', operationId,
        message: error instanceof Error ? error.message : 'Unable to crop the screenshot.' });
      return null;
    }
  }
  dispose(): void {
    if (this.#pendingCaptureId) void cancelWebsitePopupScreenshot(this.#pendingCaptureId);
    this.#pendingCaptureId = null;
    this.#disposed = true;
    this.#sound.dispose();
    this.saveController.dispose();
    this.#draft = null;
    this.#unsubscribe();
    window.removeEventListener('resize', this.#contextChanged);
    window.removeEventListener('pagehide', this.#invalidate);
    window.removeEventListener('popstate', this.#contextChanged);
    window.removeEventListener('hashchange', this.#contextChanged);
    document.removeEventListener('visibilitychange', this.#visibilityChanged);
  }
}
