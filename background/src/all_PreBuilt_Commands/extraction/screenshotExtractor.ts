/**
 * @file screenshotExtractor.ts
 * @description Handles capture and extraction of webpage screenshots.
 */
import { nowUtc } from '../../../../src/shared-components/utils';
import { PDFDocument } from 'pdf-lib';
import { BRAND } from '../../../../src/shared-components/brandingConfig';
import { sendPageDomMessage } from './pageMessageTransport';
import { captureVisiblePng } from './captureVisiblePng';
import { captureFullPageCanvas, screenshotBlobToDataUrl as blobToDataUrl } from './captureFullPageCanvas';

const getActiveTabId = async (sender: chrome.runtime.MessageSender) => {
  if (sender?.tab?.id) return sender.tab.id;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id;
};

const blobToBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const createPdfDataUrlFromJpeg = async (blob: Blob, width: number, height: number): Promise<string> => {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(await blobToBytes(blob));
  const page = pdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  const pdfBytes = await pdf.save();
  return blobToDataUrl(new Blob([pdfBytes], { type: 'application/pdf' }));
};

export const handleScreenshotCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'CAPTURE_ELEMENT') {
    (async () => {
      try {
        const tabId = await getActiveTabId(sender);
        if (!tabId) throw new Error('No active tab');

        const dataUrl = await captureVisiblePng();
        const cropped = await sendPageDomMessage<{ ok: true; dataUrl: string | null }>(tabId, {
          type: 'supercommands:crop-captured-visible-tab',
          dataUrl,
          rect: request.rect,
        }, sender);
        const finalUrl = cropped.dataUrl;
        if (!finalUrl) throw new Error('Failed to crop image');

        const timestamp = nowUtc().replace(/[:.]/g, '-');
        chrome.downloads.download({
          url: finalUrl,
          filename: `${BRAND.exports.screenshotElementPrefix}-${timestamp}.png`,
          saveAs: false,
        });
        sendResponse({ success: true });
      } catch (err: any) {
        console.error('Element capture failed:', err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  if (request.action === 'CAPTURE_VISIBLE_TAB' || request.action === 'CAPTURE_AND_CLIP_VISIBLE_TAB') {
    (async () => {
      try {
        const tabId = await getActiveTabId(sender);
        const dataUrl = await captureVisiblePng();
        const timestamp = nowUtc().replace(/[:.]/g, '-');
        chrome.downloads.download({
          url: dataUrl,
          filename: `${BRAND.exports.screenshotPrefix}-${timestamp}.png`,
          saveAs: false,
        });

        if (request.action === 'CAPTURE_AND_CLIP_VISIBLE_TAB' && tabId) {
          await sendPageDomMessage(tabId, { type: 'supercommands:copy-image-to-clipboard', dataUrl }, sender).catch(scriptErr => {
            console.warn('[ClipScreenshot] Failed to copy screenshot in content script:', scriptErr);
          });
        }

        sendResponse({ success: true });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();

    return true;
  }

  if (typeof request?.action === 'string' && request.action.startsWith('CAPTURE_FULL_PAGE_')) {
    const formatStr = request.action.split('_').pop() as 'PNG' | 'JPG' | 'PDF';

    (async () => {
      const tabId = await getActiveTabId(sender);
      if (!tabId) {
        sendResponse({ success: false, error: 'No active tab' });
        return;
      }

      try {
        const { canvas, dimensions: normalizedDims } = await captureFullPageCanvas(tabId, sender);

        const timestamp = nowUtc().replace(/[:.]/g, '-');
        const fileExt = formatStr.toLowerCase();
        const filename = `${BRAND.exports.screenshotFullPagePrefix}-${timestamp}.${fileExt}`;

        if (formatStr === 'PDF') {
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
          const pdfDataUrl = await createPdfDataUrlFromJpeg(blob, normalizedDims.w, normalizedDims.h);
          chrome.downloads.download({ url: pdfDataUrl, filename, saveAs: false });
        } else {
          const mimeType = formatStr === 'JPG' ? 'image/jpeg' : 'image/png';
          const blob = await canvas.convertToBlob({ type: mimeType, quality: 1.0 });
          const dataUrl = await blobToDataUrl(blob);
          chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
        }

        sendResponse({ success: true });
      } catch (err: any) {

        console.error('Full page capture error:', err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();
    return true;
  }

  return undefined;
};
