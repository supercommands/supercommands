import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupScreenshotCaptureController } from '../runtime/WebsitePopupScreenshotCaptureController';
import { ScreenshotAreaSelection } from '../../../../shared-components/pageExtraction/screenshot/ScreenshotAreaSelection';

export function ConnectedWebsitePopupScreenshotCapture({ store, controller, enabled, organisationId }: {
  store: WebsitePopupInteractionStoreApi;
  controller: WebsitePopupScreenshotCaptureController | null;
  enabled: boolean;
  organisationId: string | null;
}) {
  const state = useStore(store, value => value.state);
  const session = state.collectionSession;
  const capture = session?.screenshot;
  if (!enabled || !controller || !capture || capture.status === 'idle' || capture.status === 'error'
      || capture.status === 'saved' || capture.status === 'preparing' || capture.status === 'capturing') return null;
  if (capture.mode !== 'area') return null;
  const draft = controller.getDraft(capture.operationId);
  if (!draft) return null;
  const dispatch = store.getState().dispatch;
  return <ScreenshotAreaSelection dataUrl={draft.dataUrl} viewport={capture.viewport} rect={capture.rect} status={capture.status}
    onSelect={rect => dispatch({ type: 'COLLECTION_SCREENSHOT_SELECTED', operationId: capture.operationId, rect })}
    onConfirm={() => { void (async () => {
      const blob = await controller.confirmSelection(capture.operationId);
      if (blob) await controller.saveController.save(organisationId, capture.operationId);
    })(); }}
    onReselect={() => dispatch({ type: 'COLLECTION_SCREENSHOT_RESELECTED', operationId: capture.operationId })}
    onCancel={() => dispatch({ type: 'COLLECTION_SCREENSHOT_CANCELLED', operationId: capture.operationId })}/>;
}
