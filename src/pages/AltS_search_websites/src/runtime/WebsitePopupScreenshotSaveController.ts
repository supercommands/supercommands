import { CollectionClientError, createCollectionImage } from '../../../../allObjectFolder/src/createObject/collections/collectionClient';
import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupScreenshotDraft } from './WebsitePopupScreenshotCaptureController';

/** Saves a confirmed crop through the existing background/Assets owner boundary. */
export class WebsitePopupScreenshotSaveController {
  #store: WebsitePopupInteractionStoreApi;
  #readDraft: (operationId: string) => WebsitePopupScreenshotDraft | null;
  #unsubscribe: () => void;
  #abort: AbortController | null = null;
  #busy = false;
  #disposed = false;
  #target: { operationId: string; organisationId: string; collectionId: string } | null = null;
  #savedItem: CollectionItemRecord | null = null;
  #readMetadata: (() => { title: string; note: string; tagIds: string[] }) | null = null;
  setMetadataReader(reader: (() => { title: string; note: string; tagIds: string[] }) | null) { this.#readMetadata = reader; }
  constructor(store: WebsitePopupInteractionStoreApi, readDraft: (operationId: string) => WebsitePopupScreenshotDraft | null) {
    this.#store = store;
    this.#readDraft = readDraft;
    this.#unsubscribe = store.subscribe(({ state }) => {
      const capture = state.collectionSession?.screenshot;
      if (!capture || capture.status === 'idle' || capture.operationId !== this.#target?.operationId) {
        this.#abort?.abort();
        this.#savedItem = null;
        this.#target = null;
      } else if (capture.status !== 'preparing-image' && capture.status !== 'saving') this.#abort?.abort();
    });
  }
  getSavedItem(itemId: string): CollectionItemRecord | null {
    return this.#savedItem?.id === itemId ? this.#savedItem : null;
  }
  async save(organisationId: string | null, operationId: string): Promise<CollectionItemRecord | null> {
    if (this.#busy || this.#disposed) return null;
    const { state, dispatch } = this.#store.getState();
    const collection = state.collectionSession;
    const capture = collection?.screenshot;
    const draft = this.#readDraft(operationId);
    if (!capture || capture.status === 'idle' || capture.operationId !== operationId || !draft?.croppedBlob
        || !collection?.selectedCollectionId || (capture.status !== 'ready' && !(capture.status === 'error'
          && capture.canRetry && (capture.failureStage === 'saving' || capture.failureStage === 'preparing-image')))) return null;
    if (!organisationId) {
      dispatch({ type: 'COLLECTION_SCREENSHOT_FAILED', operationId, message: 'Choose an Organisation before saving.', canRetry: false });
      return null;
    }
    // A retry uses the original owner and destination, even if the search snapshot changes.
    const target = this.#target?.operationId === operationId ? this.#target
      : { operationId, organisationId, collectionId: collection.selectedCollectionId };
    if (target.collectionId !== collection.selectedCollectionId) return null;
    this.#target = target;
    this.#busy = true;
    const abort = new AbortController();
    this.#abort = abort;
    let submitted = false;
    dispatch({ type: 'COLLECTION_SCREENSHOT_SAVE_PREPARATION_STARTED', operationId });
    try {
      const current = this.#store.getState().state.collectionSession?.screenshot;
      if (current?.status !== 'preparing-image' || current.operationId !== operationId) return null;
      const metadata = this.#readMetadata?.();
      if (metadata && !metadata.title.trim()) throw new Error('Title is required.');
      const item = await createCollectionImage({
        organisationId: target.organisationId, collectionId: target.collectionId,
        title: metadata?.title.trim() || draft.title, note: metadata?.note, tagIds: metadata?.tagIds,
        url: draft.sourceUrl, fileName: draft.fileName, blob: draft.croppedBlob,
        signal: abort.signal,
        onSaveStarted: () => {
          const latest = this.#store.getState().state.collectionSession?.screenshot;
          if (this.#disposed || latest?.status !== 'preparing-image' || latest.operationId !== operationId) {
            throw new DOMException('Screenshot preparation cancelled.', 'AbortError');
          }
          dispatch({ type: 'COLLECTION_SCREENSHOT_SAVE_STARTED', operationId });
          submitted = true;
        },
      });
      if (item.type !== 'screenshot' || item.organisationId !== target.organisationId
          || item.collectionId !== target.collectionId || !item.data.assetId) {
        throw new CollectionClientError('TRANSPORT_ERROR', 'The saved screenshot response could not be confirmed.');
      }
      if (!this.#disposed) {
        const latest = this.#store.getState().state.collectionSession?.screenshot;
        if (latest?.status === 'saving' && latest.operationId === operationId) {
          this.#savedItem = item;
          dispatch({ type: 'COLLECTION_SCREENSHOT_SAVED', operationId, itemId: item.id });
        }
      }
      return item;
    } catch (error) {
      if (this.#disposed || abort.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return null;
      const unknownOutcome = submitted && (!(error instanceof CollectionClientError) || error.code === 'TRANSPORT_ERROR');
      dispatch({ type: 'COLLECTION_SCREENSHOT_FAILED', operationId, canRetry: !unknownOutcome,
        message: unknownOutcome ? 'Could not confirm the save. Check this Collection before capturing again.'
          : error instanceof Error ? error.message : 'Unable to save the screenshot.' });
      return null;
    } finally {
      this.#busy = false;
      if (this.#abort === abort) this.#abort = null;
    }
  }
  dispose(): void {
    this.#readMetadata = null;
    this.#disposed = true;
    this.#abort?.abort();
    this.#unsubscribe();
    this.#savedItem = null;
    this.#target = null;
  }
}
