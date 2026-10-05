import { hasImageSignature, validateImageAsset } from '../assets/assetPolicy';

/** Read and validate a bundled starter image before adopting it into asset storage. */
export async function loadInspirationImage(fileName: string) {
  const response = await fetch(chrome.runtime.getURL(`starter-content/inspiration/${fileName}`));
  if (!response.ok) throw new Error('Could not load the Inspiration starter images. Please try again.');
  const blob = await response.blob();
  validateImageAsset(blob);
  if (
    blob.type !== 'image/jpeg' ||
    !hasImageSignature(new Uint8Array(await blob.slice(0, 12).arrayBuffer()), blob.type)
  ) {
    throw new Error('An Inspiration starter image is invalid. Please reload the extension and try again.');
  }
  return { blob, mimeType: blob.type };
}
