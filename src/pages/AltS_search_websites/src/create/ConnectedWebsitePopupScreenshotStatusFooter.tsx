import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupScreenshotCaptureController } from '../runtime/WebsitePopupScreenshotCaptureController';
import { WebsitePopupCollectionItemStatusFooter } from './WebsitePopupCollectionItemStatusFooter';

/** Reuses the shared Collection footer for capture failures and the saved receipt. */
export function ConnectedWebsitePopupScreenshotStatusFooter({ store, controller, organisationId, presentation = 'inline' }: {
  store: WebsitePopupInteractionStoreApi;
  controller: WebsitePopupScreenshotCaptureController | null;
  organisationId: string | null;
  presentation?: 'inline' | 'standalone';
}) {
  const session = useStore(store, value => value.state.collectionSession);
  const capture = session?.screenshot;
  if (!capture || (capture.status !== 'saved' && capture.status !== 'error'))
    return presentation === 'standalone' ? <WebsitePopupCollectionItemStatusFooter state={null} presentation={presentation}/> : null;
  const saveError = capture.status === 'error'
    && (capture.failureStage === 'saving' || capture.failureStage === 'preparing-image');
  const canRetry = capture.status === 'error' && capture.canRetry && Boolean(controller)
    && (saveError ? Boolean(controller?.getDraft(capture.operationId)?.croppedBlob)
      : capture.sourceUrl === window.location.href);
  return <WebsitePopupCollectionItemStatusFooter presentation={presentation} state={{
    revision: session!.captureRevision,
    status: capture.status === 'saved' ? 'saved' : 'error',
    ...(capture.status === 'saved' ? { itemId: capture.itemId,
      lastSavedAt: controller?.saveController.getSavedItem(capture.itemId)?.updatedAt } : {}),
    error: capture.status === 'error' ? capture.message : null,
    canRetry,
    retry: () => {
      if (!controller || capture.status !== 'error') return;
      if (saveError) void controller.saveController.save(organisationId, capture.operationId);
      else void controller.captureMode(capture.mode, organisationId);
    },
  }}/>;
}
