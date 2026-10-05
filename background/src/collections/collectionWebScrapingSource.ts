import { invalid } from '../../../src/allObjectFolder/src/createObject/collections/collectionValidation';
import { isCollectionSourceUrl, isCollectionNewTabUrl } from '../../../src/shared-components/collections/collectionCaptureSource';
import { COLLECTION_PAGE_SOURCE_ACTION, type CollectionPageSourceResponse } from '../../../src/shared-components/collections/collectionPageCaptureContract';
import { isNewTabPageSender, sendPageDomMessage } from '../all_PreBuilt_Commands/extraction/pageMessageTransport';

export function isCollectionCaptureSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && typeof sender.tab?.id === 'number'
    && typeof sender.tab.windowId === 'number'
    && (sender.frameId === 0 || (sender.frameId === undefined && isNewTabPageSender(sender)));
}

/** Message URL metadata is not the current location after every SPA navigation. */
export function createCollectionSourceCheck(sender: chrome.runtime.MessageSender, sourceUrl: string,
  feature: 'Web Scraping' | 'Screenshot capture'): () => Promise<void> {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (!isCollectionCaptureSender(sender) || tabId === undefined || !isCollectionSourceUrl(sourceUrl)) invalid(`${feature} requires the originating top-level tab.`);
  const newTab = isNewTabPageSender(sender);
  if (newTab !== isCollectionNewTabUrl(sourceUrl)) invalid('The capture source does not match the originating page.');
  let documentToken: string | null = null;
  let documentId = sender.documentId || null;
  const verifyNewTabDocument = async () => {
    if (!chrome.runtime.getContexts) invalid('This browser cannot verify the originating New Tab document.');
    const contexts = await chrome.runtime.getContexts({ tabIds: [tabId] });
    const context = contexts.find(context => typeof context.documentId === 'string'
      && isCollectionNewTabUrl(context.documentUrl || '')
      && (documentId === null || context.documentId === documentId));
    if (!context?.documentId) invalid('The source document changed. Capture content again.');
    documentId = context.documentId;
  };
  return async () => {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || (windowId !== undefined && tab.windowId !== windowId)) invalid('Return to the originating tab to continue.');
    if (newTab) {
      // Verify the extension document independently of the browser's New Tab URL metadata.
      await verifyNewTabDocument();
      const source = await sendPageDomMessage<CollectionPageSourceResponse>(tabId, { type: COLLECTION_PAGE_SOURCE_ACTION }, sender);
      if (source?.url !== sourceUrl || typeof source.documentToken !== 'string' || !source.documentToken
          || (documentToken !== null && source.documentToken !== documentToken)) invalid('The source document changed. Capture content again.');
      documentToken = source.documentToken;
    } else {
      // Website SPA navigation requires the live isolated-world location.
      const results = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func: () => window.location.href,
      });
      const frame = results.find(result => result.frameId === 0);
      if (!frame || frame.result !== sourceUrl
          || (sender.documentId && frame.documentId !== sender.documentId)) {
        invalid('The source page changed. Capture content again.');
      }
    }
    const currentTab = await chrome.tabs.get(tabId);
    if (!currentTab.active || (windowId !== undefined && currentTab.windowId !== windowId)) {
      invalid('Return to the originating tab to continue.');
    }
    if (newTab) await verifyNewTabDocument();
  };
}

/** Existing website callers retain the same API while sharing source validation. */
export const createCollectionWebsiteSourceCheck = createCollectionSourceCheck;

/** Compatibility entry point; all Collection capture types share the live-source guard. */
export function createWebScrapingSourceCheck(sender: chrome.runtime.MessageSender, sourceUrl: string): () => Promise<void> {
  return createCollectionSourceCheck(sender, sourceUrl, 'Web Scraping');
}
