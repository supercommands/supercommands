import type { CollectionPageImageResponse } from '../collections/collectionPageCaptureContract';

/** Self-contained for both script injection and our New Tab runtime handler. */
export async function readPageCaptureImage(source: string, url: string, limit: number, timeout: number): Promise<CollectionPageImageResponse> {
  let byteSize = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    if (!Number.isFinite(limit) || limit <= 0 || limit > 25 * 1024 * 1024
        || !Number.isFinite(timeout) || timeout <= 0 || timeout > 20000) throw new Error('Invalid image read limits.');
    if (window.location.href !== source) throw new Error('The source page changed.');
    const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: controller.signal });
    if (!response.body) throw new Error('Image response has no bytes.');
    reader = response.body.getReader();
    if (!response.ok) throw new Error(`Image request failed (HTTP ${response.status}).`);
    // Background validates signatures and rasterizes decodable formats before Asset adoption.
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
    const chunks: Uint8Array[] = [];
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteSize += chunk.value.byteLength;
      if (byteSize > limit) throw new Error('Captured images exceed the 25 MiB limit.');
      chunks.push(chunk.value);
    }
    if (!byteSize) throw new Error('Image is empty.');
    if (window.location.href !== source) throw new Error('The source page changed.');
    let binary = '';
    for (const chunk of chunks) {
      for (let offset = 0; offset < chunk.length; offset += 8192) binary += String.fromCharCode(...chunk.subarray(offset, offset + 8192));
    }
    return { base64: btoa(binary), mimeType, byteSize };
  } catch (error) {
    return { byteSize, error: error instanceof TypeError ? 'The page blocked the image request (CORS, redirect or network failure).' : error instanceof Error ? error.message : 'Image could not be read from the page.' };
  } finally {
    clearTimeout(timer);
    if (reader) { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
