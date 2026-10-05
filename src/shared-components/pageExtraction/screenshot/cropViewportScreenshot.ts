export type ScreenshotCropRect = { x: number; y: number; width: number; height: number };

/** Display coordinates are scaled against actual PNG dimensions, independently of devicePixelRatio. */
export async function cropViewportScreenshot(
  dataUrl: string, rect: ScreenshotCropRect, viewport: { width: number; height: number },
): Promise<Blob> {
  if (![rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('Choose a non-empty screenshot area.');
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Unable to decode the screenshot.'));
    image.src = dataUrl;
  });
  const scaleX = image.naturalWidth / viewport.width;
  const scaleY = image.naturalHeight / viewport.height;
  const left = Math.max(0, Math.min(image.naturalWidth, Math.floor(rect.x * scaleX)));
  const top = Math.max(0, Math.min(image.naturalHeight, Math.floor(rect.y * scaleY)));
  const right = Math.max(left, Math.min(image.naturalWidth, Math.ceil((rect.x + rect.width) * scaleX)));
  const bottom = Math.max(top, Math.min(image.naturalHeight, Math.ceil((rect.y + rect.height) * scaleY)));
  if (right <= left || bottom <= top) throw new Error('Choose a non-empty screenshot area.');
  const canvas = document.createElement('canvas');
  canvas.width = right - left;
  canvas.height = bottom - top;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screenshot cropping is unavailable.');
    context.drawImage(image, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to prepare the selected screenshot.'));
    }, 'image/png'));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
