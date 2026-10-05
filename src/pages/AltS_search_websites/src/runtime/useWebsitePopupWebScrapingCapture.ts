import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import { getWebsitePopupClipLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
import { captureElementClip } from '../../../../shared-components/pageExtraction/webScraping/captureElementClip';
import type { ExtractedElementClip } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';

/** Transient extracted content stays outside the interaction store and database. */
export function useWebsitePopupWebScrapingCapture(store: WebsitePopupInteractionStoreApi, enabled: boolean, manualSelection = false) {
  const session = useStore(store, value => value.state.collectionSession);
  const route = useStore(store, value => value.state.route);
  const revision = session?.captureRevision || 0;
  const [receipt, setReceipt] = useState<{ revision: number; draft: ExtractedElementClip } | null>(null);
  const [failure, setFailure] = useState<{ revision: number; message: string } | null>(null);
  const [requestedRevision, setRequestedRevision] = useState<number | null>(null);
  const operation = useRef<AbortController | null>(null);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    setReceipt(null); setFailure(null); setProcessing(false);
    return () => { operation.current?.abort(); operation.current = null; };
  }, [revision, enabled]);
  const active = enabled && session?.captureType === 'web-scraping';
  useEffect(() => {
    if (!active || session?.pickerOpen || route.kind !== 'submode' || route.submode.id !== 'collection-destination') {
      operation.current?.abort(); operation.current = null; setProcessing(false);
    }
  }, [active, session?.pickerOpen, route]);
  const error = active && failure?.revision === revision ? failure.message : null;
  const selecting = Boolean(active && route.kind === 'submode' && route.submode.id === 'collection-destination'
    && session?.selectedCollectionId && !session.pickerOpen && !error && (!manualSelection || requestedRevision === revision));
  const cancel = useCallback(() => {
    operation.current?.abort(); operation.current = null; setProcessing(false);
    setReceipt(null); setFailure(null); setRequestedRevision(null);
    store.getState().dispatch({ type: 'COLLECTION_PICKER_OPENED' });
  }, [store]);
  const retry = useCallback(() => {
    operation.current?.abort(); operation.current = null; setProcessing(false);
    setReceipt(null); setFailure(null); setRequestedRevision(revision);
    store.getState().dispatch({ type: 'COLLECTION_WEB_SCRAPING_SELECTION_REQUESTED', revision });
  }, [revision, store]);
  const confirm = useCallback(async (element: Element) => {
    const current = store.getState().state;
    if (operation.current || !enabled || current.collectionSession?.captureRevision !== revision || current.collectionSession.captureType !== 'web-scraping'
        || current.route.kind !== 'submode' || current.route.submode.id !== 'collection-destination' || current.collectionSession.pickerOpen) return;
    const controller = new AbortController(); operation.current = controller; setProcessing(true);
    try {
      if (element.ownerDocument.location.href !== current.collectionSession.sourceUrl) throw new Error(`The page changed. Choose ${getWebsitePopupClipLabel('web-scraping')} again.`);
      const draft = await captureElementClip(element, controller.signal);
      const latest = store.getState().state;
      if (controller.signal.aborted || operation.current !== controller || latest.collectionSession?.captureRevision !== revision
          || latest.collectionSession.captureType !== 'web-scraping' || latest.collectionSession.pickerOpen
          || latest.collectionSession.sourceUrl !== draft.url || latest.route.kind !== 'submode'
          || latest.route.submode.id !== 'collection-destination') return;
      setReceipt({ revision, draft });
      store.getState().dispatch({ type: 'COLLECTION_WEB_SCRAPING_READY', revision });
    } catch (error) {
      if (!controller.signal.aborted && operation.current === controller) setFailure({ revision, message: error instanceof Error ? error.message : 'Could not capture the selected content.' });
    } finally { if (operation.current === controller) { operation.current = null; setProcessing(false); } }
  }, [enabled, revision, store]);
  const draft = active && receipt?.revision === revision && route.kind === 'submode' && route.submode.id === 'collection-item-details' ? receipt.draft : null;
  return { selecting, processing, draft, error, confirm, cancel, retry, start: retry };
}
