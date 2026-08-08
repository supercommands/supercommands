/**
 * @file screenshotExtractor.ts
 * @description Handles capture and extraction of webpage screenshots.
 */
import { nowUtc } from '../../../../src/shared-components/utils';
import { jsPDF } from 'jspdf';

export const handleScreenshotCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'CAPTURE_ELEMENT') {
    const { rect } = request;

    chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
      if (!dataUrl) {
        console.error('Failed to capture visible tab');
        return;
      }

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab');

        const croppedDataUrlResults = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (imgUrl: string, cropRect: any) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            const img = new Image();
            img.src = imgUrl;
            await new Promise(r => {
              img.onload = r;
            });

            canvas.width = cropRect.width * cropRect.dpr;
            canvas.height = cropRect.height * cropRect.dpr;

            ctx.drawImage(
              img,
              cropRect.x * cropRect.dpr,
              cropRect.y * cropRect.dpr,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
              0,
              0,
              cropRect.width * cropRect.dpr,
              cropRect.height * cropRect.dpr,
            );

            return canvas.toDataURL('image/png');
          },
          args: [dataUrl, rect],
        });

        const finalUrl = croppedDataUrlResults[0]?.result;
        if (!finalUrl) throw new Error('Failed to crop image');

        const timestamp = nowUtc().replace(/[:.]/g, '-');
        const filename = `cmdOS-element-${timestamp}.png`;

        chrome.downloads.download({
          url: finalUrl,
          filename: filename,
          saveAs: false,
        });
      } catch (err) {
        console.error('Element capture failed:', err);
      }
    });
    return true;
  }

  if (request.action === 'CAPTURE_VISIBLE_TAB' || request.action === 'CAPTURE_AND_CLIP_VISIBLE_TAB') {
    const isClipRequested = request.action === 'CAPTURE_AND_CLIP_VISIBLE_TAB';

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const activeTabId = sender?.tab?.id || tabs?.[0]?.id;

      chrome.tabs.captureVisibleTab({ format: 'png' }, async dataUrl => {
        if (!dataUrl) {
          try { sendResponse?.({ success: false, error: 'Failed to capture visible tab' }); } catch (_) {}
          return;
        }
        try {
          const timestamp = nowUtc().replace(/[:.]/g, '-');
          chrome.downloads.download({
            url: dataUrl,
            filename: `cmdOS-screenshot-${timestamp}.png`,
            saveAs: false,
          });

          if (isClipRequested && activeTabId) {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: activeTabId },
                func: async (dataUrlStr: string) => {
                  try {
                    window.focus();
                    const res = await fetch(dataUrlStr);
                    const arrayBuffer = await res.arrayBuffer();
                    const pngBlob = new Blob([arrayBuffer], { type: 'image/png' });
                    await navigator.clipboard.write([
                      new ClipboardItem({ 'image/png': pngBlob })
                    ]);
                    console.log('[ClipScreenshot] Successfully wrote screenshot to clipboard');
                  } catch (e) {
                    console.error('[ClipScreenshot] Clipboard write error:', e);
                  }
                },
                args: [dataUrl]
              });
            } catch (scriptErr) {
              console.warn('[ClipScreenshot] Failed to execute clipboard script on tab:', scriptErr);
            }
          }

          try { sendResponse?.({ success: true }); } catch (_) {}
        } catch (err: any) {
          try { sendResponse?.({ success: false, error: err.message }); } catch (_) {}
        }
      });
    });

    return true; // Keep message channel open for async response
  }

  if (typeof request?.action === 'string' && request.action.startsWith('CAPTURE_FULL_PAGE_')) {
    const formatStr = request.action.split('_').pop() as 'PNG' | 'JPG' | 'PDF';
    
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error('No active tab');

        // Hide scrollbars for cleaner capture
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          css: '::-webkit-scrollbar { display: none; } html { scrollbar-width: none; }'
        });

        const dimRes = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return {
              w: document.documentElement.scrollWidth,
              h: document.documentElement.scrollHeight,
              vw: window.innerWidth,
              vh: window.innerHeight,
              dpr: window.devicePixelRatio
            };
          }
        });
        const dims = dimRes[0]?.result;
        if (!dims) throw new Error('Failed to get page dimensions');

        let y = 0;
        const images: { dataUrl: string, y: number }[] = [];

        while (y < dims.h) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (yPos) => window.scrollTo(0, yPos),
            args: [y]
          });
          await new Promise(r => setTimeout(r, 400));
          
          const dataUrl = await new Promise<string>((resolve, reject) => {
             chrome.tabs.captureVisibleTab({ format: 'png' }, url => {
                if(chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve(url);
             });
          });
          images.push({ dataUrl, y });
          
          y += dims.vh;
        }

        // Restore scrollbars
        await chrome.scripting.removeCSS({
          target: { tabId: tab.id },
          css: '::-webkit-scrollbar { display: none; } html { scrollbar-width: none; }'
        });

        // Stitch
        const canvas = new OffscreenCanvas(dims.w * dims.dpr, dims.h * dims.dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        for (const imgInfo of images) {
          const blob = await fetch(imgInfo.dataUrl).then(r => r.blob());
          const bitmap = await createImageBitmap(blob);
          // Only draw up to remaining height to avoid stretching last image
          const sourceY = Math.max(0, imgInfo.y * dims.dpr + (dims.vh * dims.dpr) - (dims.h * dims.dpr));
          ctx.drawImage(
            bitmap, 
            0, sourceY, bitmap.width, bitmap.height - sourceY,
            0, imgInfo.y * dims.dpr, bitmap.width, bitmap.height - sourceY
          );
        }

        const timestamp = nowUtc().replace(/[:.]/g, '-');
        const fileExt = formatStr.toLowerCase();
        const filename = `cmdOS-fullpage-${timestamp}.${fileExt}`;

        if (formatStr === 'PDF') {
          const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
          const base64Data = await new Promise<string>((resolve) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.readAsDataURL(blob);
          });
          
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [dims.w, dims.h] });
          pdf.addImage(base64Data, 'JPEG', 0, 0, dims.w, dims.h);
          const pdfDataUrl = pdf.output('datauristring');
          
          chrome.downloads.download({ url: pdfDataUrl, filename, saveAs: false });
        } else {
          const mimeType = formatStr === 'JPG' ? 'image/jpeg' : 'image/png';
          const blob = await canvas.convertToBlob({ type: mimeType, quality: 1.0 });
          const dataUrl = await new Promise<string>((resolve) => {
             const reader = new FileReader();
             reader.onloadend = () => resolve(reader.result as string);
             reader.readAsDataURL(blob);
          });
          chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
        }

        sendResponse({ success: true });
      } catch (err: any) {
        console.error('Full page capture error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open
  }

  return undefined;
};
