import { captureVisiblePng } from './captureVisiblePng';
import { sendPageDomMessage } from './pageMessageTransport';
const activeCaptures = new Set<number>();
export const isFullPageCaptureRunning = (tabId: number) => activeCaptures.has(tabId);
export const screenshotBlobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error('Unable to encode the screenshot.'));
  reader.readAsDataURL(blob);
});

/** Shared scroll/tile/stitch implementation for downloads and Collection images. */
export async function captureFullPageCanvas(tabId: number, sender: chrome.runtime.MessageSender,
  verify?: () => Promise<void>) {
  const tab = await chrome.tabs.get(tabId);
  if (activeCaptures.has(tabId)) throw new Error('A full-page capture is already running in this tab.');
  activeCaptures.add(tabId);
  let prepared = false;
  let output: OffscreenCanvas | null = null;
  let complete = false;
  try {
    await verify?.();
    prepared = true;
    const response = await sendPageDomMessage<{ dimensions: { w: number; h: number; vw: number; vh: number; dpr: number } }>(
      tabId, { type: 'supercommands:prepare-full-page-screenshot' }, sender);
    const dims = response?.dimensions;
    if (!dims || ![dims.w, dims.h, dims.vw, dims.vh, dims.dpr].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error('Invalid full-page screenshot dimensions.');
    }
    const canvasWidth = Math.ceil(dims.w * dims.dpr);
    const canvasHeight = Math.ceil(dims.h * dims.dpr);
    // Refuse unbounded allocations before scrolling/capturing a long page.
    if (canvasWidth > 32767 || canvasHeight > 32767 || canvasWidth * canvasHeight > 64 * 1024 * 1024) {
      throw new Error('This page is too large for a full-page screenshot. Choose Visible page or Selected area.');
    }
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    output = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get screenshot canvas context.');
    // Stitch each tile immediately, rather than retaining every full PNG in memory.
    for (let y = 0; y < dims.h; y += dims.vh) {
      await verify?.();
      await sendPageDomMessage(tabId, { type: 'supercommands:scroll-full-page-screenshot', y }, sender);
      await new Promise<void>(resolve => setTimeout(resolve, 400));
      const dataUrl = await captureVisiblePng(tab.windowId, verify);
      const bitmap = await createImageBitmap(await fetch(dataUrl).then(value => value.blob()));
      try {
        const sourceY = Math.max(0, (y + dims.vh - dims.h) * dims.dpr);
        const destinationY = Math.round(y * dims.dpr);
        const sourceWidth = Math.min(bitmap.width, canvasWidth);
        const sourceHeight = Math.min(bitmap.height - sourceY, canvasHeight - destinationY);
        if (sourceWidth > 0 && sourceHeight > 0) ctx.drawImage(bitmap, 0, sourceY, sourceWidth, sourceHeight,
          0, destinationY, sourceWidth, sourceHeight);
      } finally { bitmap.close(); }
    }
    await verify?.();
    complete = true;
    return { canvas, dimensions: dims };
  } finally {
    if (!complete && output) { output.width = 0; output.height = 0; }
    if (prepared) await sendPageDomMessage(tabId, { type: 'supercommands:restore-full-page-screenshot' }, sender).catch(() => undefined);
    activeCaptures.delete(tabId);
  }
}
