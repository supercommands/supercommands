import { getCollection, createAcquiredElementClip } from '../../../src/allObjectFolder/src/createObject/collections/collectionData';
import { validateElementSnapshotDraft } from '../../../src/allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { ELEMENT_CLIP_RUNTIME_LIMITS } from '../../../src/allObjectFolder/src/createObject/collections/elementSnapshotLimits';
import { fields, object, requiredText, optionalText, collectionSourceUrl, invalid } from '../../../src/allObjectFolder/src/createObject/collections/collectionValidation';
import { isCollectionPageImageUrl } from '../../../src/shared-components/collections/collectionCaptureSource';
import { isNewTabPageSender } from '../all_PreBuilt_Commands/extraction/pageMessageTransport';
import { validateWebScrapingData } from '../../../src/allObjectFolder/src/createObject/collections/webScrapingValidation';
import { normalizeCollectionItemTagIds } from '../../../src/allObjectFolder/src/createObject/collections/collectionTagValidation';
import { assertCollectionItemTagOwnership } from '../../../src/allObjectFolder/src/createObject/collections/collectionTagData';
import { db } from '../../../src/storage/indexDB/dbConfig';
import { WEB_SCRAPING_LIMITS } from '../../../src/allObjectFolder/src/createObject/collections/webScrapingLimits';
import type { ExtractedWebScraping } from '../../../src/shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import type { WebScrapingSaveResult } from '../../../src/allObjectFolder/src/createObject/collections/collectionBridgeTypes';
import { createWebScrapingSourceCheck } from './collectionWebScrapingSource';
import { readWebScrapingPageImage } from './collectionWebScrapingPageImage';
import { decodeImageBytes } from './collectionScreenshotPayload';
import { normaliseCapturedImage } from './normaliseCapturedImage';
import { resolveAvailableElementClip } from '../../../src/shared-components/pageExtraction/webScraping/resolveAvailableElementClip';

const BYTE_LIMIT = ELEMENT_CLIP_RUNTIME_LIMITS.imageBytes;

/** Fetch using existing access only. No credentials, redirect following, or permission requests. */
export async function acquireAndSaveWebScraping(value: unknown, sender: chrome.runtime.MessageSender): Promise<WebScrapingSaveResult> {
  const payload = object(value, 'Web Scraping input');
  fields(payload, ['organisationId', 'collectionId', 'title', 'note', 'tagIds', 'draft']);
  const organisationId = requiredText(payload.organisationId, 'Organisation ID');
  const collectionId = requiredText(payload.collectionId, 'Collection ID');
  const title = requiredText(payload.title, 'Title');
  const note = optionalText(payload.note, 'Note');
  const tagIds = normalizeCollectionItemTagIds(payload.tagIds);
  const input = object(payload.draft, 'Capture draft'); fields(input, ['title', 'url', 'blocks', 'images', 'style', 'snapshot', 'snapshotImages']);
  const url = collectionSourceUrl(input.url);
  requiredText(input.title, 'Captured title');
  const checkSource = createWebScrapingSourceCheck(sender, url);
  const snapshot = validateElementSnapshotDraft(input.snapshot);
  if (!Array.isArray(input.snapshotImages) || input.snapshotImages.length > WEB_SCRAPING_LIMITS.images) invalid('Invalid visual image candidates.');
  if (!Array.isArray(input.images) || input.images.length > WEB_SCRAPING_LIMITS.images) invalid('Invalid image candidates.');
  const readCandidate = (value: unknown) => {
    const candidate = object(value, 'Image candidate'); fields(candidate, ['id', 'downloadUrl']);
    const downloadUrl = candidate.downloadUrl === null ? null : requiredText(candidate.downloadUrl, 'Image download URL');
    if (downloadUrl !== null && !isCollectionPageImageUrl(downloadUrl, url)) invalid('Unsupported image download URL.');
    return { id: requiredText(candidate.id, 'Image candidate ID'), downloadUrl };
  };
  const images = input.images.map(readCandidate);
  const visualImages = input.snapshotImages.map(readCandidate);
  if (new TextEncoder().encode(JSON.stringify(visualImages)).byteLength > WEB_SCRAPING_LIMITS.bytes) invalid('Visual image candidate URLs exceed 1 MiB.');
  const candidates = [...images, ...visualImages];
  const ids = new Set(candidates.map(image => image.id));
  if (ids.size !== candidates.length || candidates.length > WEB_SCRAPING_LIMITS.images) invalid('Duplicate or excessive image candidates.');
  const snapshotIds = new Set(snapshot.resources.map(resource => resource.id));
  if (snapshot.resources.some(resource => !ids.has(resource.id)) || visualImages.some(image => !snapshotIds.has(image.id))) invalid('Visual image references do not match capture candidates.');
  const content = validateWebScrapingData({ version: 1, blocks: input.blocks, images: images.map(image => ({ id: image.id, assetId: image.id })),
    ...(input.style !== undefined ? { style: input.style } : {}) });
  const draft = { title: input.title, url, blocks: content.blocks, images, ...(content.style ? { style: content.style } : {}) } as ExtractedWebScraping;
  if (new TextEncoder().encode(JSON.stringify(draft)).byteLength > WEB_SCRAPING_LIMITS.bytes) invalid('Capture draft exceeds 1 MiB.');
  await getCollection(organisationId, collectionId);
  // Reject unavailable/foreign tags before acquiring images; persistence rechecks at commit.
  await db.transaction('r', [db.tags, db.workspaces], () => assertCollectionItemTagOwnership(organisationId, tagIds));
  await checkSource();
  const acquired = new Map<string, Blob>();
  let totalBytes = 0;
  const abort = new AbortController();
  const deadline = Date.now() + ELEMENT_CLIP_RUNTIME_LIMITS.acquisitionMs;
  const timer = setTimeout(() => abort.abort(), ELEMENT_CLIP_RUNTIME_LIMITS.acquisitionMs);
  try {
    // Sequential reads enforce one shared byte budget before allocating the next image.
    const byUrl = new Map<string, Blob>();
    for (const image of candidates) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        if (abort.signal.aborted) throw new Error('Image acquisition timed out.');
        if (!image.downloadUrl) throw new Error('Image has no supported download URL.');
        const cached = byUrl.get(image.downloadUrl);
        if (cached) { acquired.set(image.id, cached); continue; }
        if (totalBytes >= BYTE_LIMIT) throw new Error('Captured images exceed the 25 MiB limit.');
        const target = new URL(image.downloadUrl);
        if (!['http:', 'https:'].includes(target.protocol) || isNewTabPageSender(sender) || !await chrome.permissions.contains({ origins: [`${target.protocol}//${target.hostname}/*`] })) {
          const pageImage = await readWebScrapingPageImage(sender, url, target.href, BYTE_LIMIT - totalBytes, Math.max(1, deadline - Date.now()));
          totalBytes += pageImage.byteSize;
          if (totalBytes > BYTE_LIMIT) throw new Error('Captured images exceed the 25 MiB limit.');
          if (pageImage.error) throw new Error(pageImage.error);
          const bytes = decodeImageBytes(pageImage.base64);
          if (bytes.byteLength !== pageImage.byteSize) throw new Error('Page image byte size changed.');
          const raw = new Blob([bytes], { type: pageImage.mimeType || 'application/octet-stream' });
          const blob = await normaliseCapturedImage(raw);
          totalBytes += Math.max(0, blob.size - raw.size);
          if (abort.signal.aborted || totalBytes > BYTE_LIMIT) throw new Error('Image acquisition limit reached.');
          acquired.set(image.id, blob);
          byUrl.set(image.downloadUrl, blob);
          continue;
        }
        const response = await fetch(target.href, { credentials: 'omit', redirect: 'error', signal: abort.signal });
        if (!response.ok || !response.body) { await response.body?.cancel().catch(() => undefined); throw new Error('Image could not be downloaded.'); }
        reader = response.body.getReader();
        const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
        const chunks: ArrayBuffer[] = [];
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          totalBytes += chunk.value.byteLength;
          if (totalBytes > BYTE_LIMIT) throw new Error('Captured images exceed the 25 MiB limit.');
          chunks.push(new Uint8Array(chunk.value).buffer);
        }
        const raw = new Blob(chunks, { type: mimeType });
        const blob = await normaliseCapturedImage(raw);
        totalBytes += Math.max(0, blob.size - raw.size);
        if (abort.signal.aborted || totalBytes > BYTE_LIMIT) throw new Error('Image acquisition limit reached.');
        acquired.set(image.id, blob);
        byUrl.set(image.downloadUrl, blob);
      } catch {
        // Unreadable formats/bytes are omitted from both representations; usable content still saves.
      } finally { if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); } }
    }
  } finally { clearTimeout(timer); }
  await checkSource();
  const available = resolveAvailableElementClip(draft, snapshot, new Set(acquired.keys()));
  if (!available) return { status: 'skipped' };
  const item = await createAcquiredElementClip({ organisationId, collectionId, title, tagIds, ...(note ? { note } : {}) }, available.draft, available.snapshot, acquired);
  return { status: 'saved', item };
}
