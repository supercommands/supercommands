import { ImageDownloader } from '../../contentScript/src/ImageDownloader';
import { COLLECTION_PAGE_SOURCE_ACTION, COLLECTION_PAGE_IMAGE_ACTION } from '../../../shared-components/collections/collectionPageCaptureContract';
import { isCollectionNewTabUrl, isCollectionPageImageUrl } from '../../../shared-components/collections/collectionCaptureSource';
import { readPageCaptureImage } from '../../../shared-components/pageExtraction/readPageCaptureImage';
import { showTableDownloadUi } from '../../../shared-components/pageExtraction/tableDownloadUi';
import { copyImageDataUrlToClipboard, prepareFullPageScreenshot, restoreFullPageScreenshot, } from '../../../shared-components/pageExtraction/pageScreenshotDom';
let imageDownloader: ImageDownloader | null = null;
const collectionDocumentToken = crypto.randomUUID();
export async function handleNewTabPageAction(message: any): Promise<any> {
    if (message?.type === COLLECTION_PAGE_SOURCE_ACTION) {
        return { ok: true, url: window.location.href, documentToken: collectionDocumentToken };
    }
    if (message?.type === COLLECTION_PAGE_IMAGE_ACTION) {
        if (typeof message.sourceUrl !== 'string' || !isCollectionNewTabUrl(message.sourceUrl)
            || message.sourceUrl !== window.location.href || typeof message.imageUrl !== 'string'
            || !isCollectionPageImageUrl(message.imageUrl, message.sourceUrl)) {
            return { ok: false, error: 'The image source does not belong to the current New Tab.' };
        }
        return readPageCaptureImage(message.sourceUrl, message.imageUrl, message.byteLimit, message.timeoutMs);
    }
    if (message?.action === 'execute_image_download') {
        imageDownloader ??= new ImageDownloader(false);
        await imageDownloader.start({ ...message.options, downloadType: message.downloadType });
        return { ok: true };
    }
    if (message?.action === 'execute_table_download') {
        const result = showTableDownloadUi();
        return { ok: result.success, results: [{ result }], error: result.error };
    }
    if (message?.type === 'supercommands:prepare-full-page-screenshot') {
        return { ok: true, dimensions: prepareFullPageScreenshot() };
    }
    if (message?.type === 'supercommands:scroll-full-page-screenshot') {
        window.scrollTo(0, Number(message.y || 0));
        return { ok: true };
    }
    if (message?.type === 'supercommands:restore-full-page-screenshot'
        || message?.type === 'cmdos:restore-full-page-screenshot') {
        restoreFullPageScreenshot();
        return { ok: true };
    }
    if (message?.type === 'supercommands:copy-image-to-clipboard') {
        await copyImageDataUrlToClipboard(String(message.dataUrl || ''));
        return { ok: true };
    }
    return { ok: false, error: 'Unsupported new tab page action.' };
}
