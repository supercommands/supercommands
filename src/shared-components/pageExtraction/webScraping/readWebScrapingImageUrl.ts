import { isCollectionPageImageUrl } from '../../collections/collectionCaptureSource';

/** One resolved-image policy shared by semantic and visual extraction. */
export function readWebScrapingImageUrl(image: HTMLImageElement, sourceUrl: string): string | null {
  const raw = image.currentSrc || image.getAttribute('src') || image.getAttribute('data-src') || image.getAttribute('data-lazy-src');
  try {
    const url = raw?.trim() ? new URL(raw, image.ownerDocument.baseURI).href : null;
    return url && isCollectionPageImageUrl(url, sourceUrl) ? url : null;
  } catch { return null; }
}
