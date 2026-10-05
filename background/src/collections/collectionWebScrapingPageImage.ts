import { readPageCaptureImage } from '../../../src/shared-components/pageExtraction/readPageCaptureImage';
import { isCollectionPageImageUrl } from '../../../src/shared-components/collections/collectionCaptureSource';
import { COLLECTION_PAGE_IMAGE_ACTION, type CollectionPageImageResponse } from '../../../src/shared-components/collections/collectionPageCaptureContract';
import { isNewTabPageSender, sendPageDomMessage } from '../all_PreBuilt_Commands/extraction/pageMessageTransport';

/** Page-context fetch uses existing access and the shared byte/time limits. */
export async function readWebScrapingPageImage(sender: chrome.runtime.MessageSender, sourceUrl: string, imageUrl: string,
  byteLimit: number, timeoutMs: number): Promise<CollectionPageImageResponse> {
  if (!isCollectionPageImageUrl(imageUrl, sourceUrl)) throw new Error('Unsupported image source.');
  if (isNewTabPageSender(sender)) {
    const response = await sendPageDomMessage<CollectionPageImageResponse>(sender.tab!.id!,
      { type: COLLECTION_PAGE_IMAGE_ACTION, sourceUrl, imageUrl, byteLimit, timeoutMs }, sender);
    if (!response || !Number.isFinite(response.byteSize) || response.byteSize < 0) throw new Error('Invalid page image response.');
    return response;
  }
  const results = await chrome.scripting.executeScript({
    target: sender.documentId ? { tabId: sender.tab!.id!, documentIds: [sender.documentId] } : { tabId: sender.tab!.id!, frameIds: [0] },
    args: [sourceUrl, imageUrl, byteLimit, timeoutMs],
    func: readPageCaptureImage,
  });
  const result = results.find(value => value.frameId === 0);
  if (!result?.result || (sender.documentId && result.documentId !== sender.documentId)) throw new Error('The source document changed.');
  return result.result;
}
