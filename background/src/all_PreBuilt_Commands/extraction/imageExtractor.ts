/**
 * @file imageExtractor.ts
 * @description Handles extraction and downloading of images from the webpage.
 */
import { nowUtc } from '../../../../src/shared-components/utils';

export const handleImagesCommand = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'TASKLABS_DOWNLOAD_IMAGE' || request.type === 'IMAGE_DOWNLOAD') {
    const url = request.url || request.payload?.url;
    const filename = request.filename;
    console.log('[Background] Received TASKLABS_DOWNLOAD_IMAGE request:', {
      filename,
      urlPrefix: url?.substring(0, 100),
    });

    if (!url) {
      sendResponse({ ok: false, error: 'No URL provided' });
      return false;
    }

    if (!chrome.downloads?.download) {
      sendResponse({ ok: false, error: 'Downloads API unavailable' });
      return false;
    }

    try {
      chrome.downloads.download(
        {
          url: url,
          filename: filename,
          conflictAction: 'uniquify',
          saveAs: false,
        },
        downloadId => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.error('[Background] Download failed:', lastError.message, url);
            sendResponse({ ok: false, error: lastError.message });
          } else {
            sendResponse({ ok: true, downloadId });
          }
        },
      );
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
    return true; // async
  }

  // Image download script injection
  if (request.action === 'execute_image_download') {
    (async () => {
      const { tabId, downloadType, options } = request;
      console.log('[Background] execute_image_download message received:', { tabId, downloadType, options });

      let targetTabId = tabId;
      if (!targetTabId && sender?.tab?.id) {
        targetTabId = sender.tab.id;
      }
      if (!targetTabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          targetTabId = activeTab.id;
        }
      }

      if (!chrome.scripting?.executeScript) {
        console.error('[Background] ✗ Scripting API not available');
        sendResponse({ ok: false, error: 'scripting_api_unavailable' });
        return;
      }

      if (typeof targetTabId !== 'number' || targetTabId <= 0) {
        console.error('[Background] ✗ Invalid tab ID:', targetTabId);
        sendResponse({ ok: false, error: 'invalid_tab_id' });
        return;
      }
      try {
        if (downloadType === 'all' || downloadType === 'limit' || downloadType === 'selected') {
          chrome.scripting.executeScript(
            {
              target: { tabId: targetTabId },
              func: async (opts: any) => {
                console.log('[Injected Script] Initializing image extraction on page...');
                let validImages: HTMLImageElement[] = [];

                try {
                  const { limit, downloadType } = opts || {};

                  const loadLazyImages = (images: NodeListOf<HTMLImageElement>): void => {
                    images.forEach(img => {
                      const dataSrc =
                        img.getAttribute('data-src') ||
                        img.getAttribute('data-lazy-src') ||
                        img.getAttribute('data-original');
                      if (dataSrc && !img.src) {
                        img.src = dataSrc;
                      }
                      const dataSrcset = img.getAttribute('data-srcset');
                      if (dataSrcset && !img.srcset) {
                        img.srcset = dataSrcset;
                      }
                    });
                  };

                  const waitForImagesToLoad = async (
                    images: NodeListOf<HTMLImageElement>,
                    maxWait: number = 3000,
                  ): Promise<void> => {
                    const startTime = Date.now();

                    loadLazyImages(images);

                    await new Promise(resolve => setTimeout(resolve, 200));

                    const updatedImages = document.querySelectorAll('img');
                    const imagesArray = Array.from(updatedImages);
                    const incompleteImages = imagesArray.filter(img => {
                      const hasSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                      return hasSrc && !img.complete;
                    });

                    if (incompleteImages.length === 0) {
                      return;
                    }
                    const loadPromises = incompleteImages.map(img => {
                      return new Promise<void>(resolve => {
                        if (img.complete) {
                          resolve();
                          return;
                        }

                        const timeout = setTimeout(() => {
                          console.warn(
                            `[Image Download] Timeout waiting for image: ${img.src?.substring(0, 50) || 'no-src'}`,
                          );
                          resolve();
                        }, maxWait);

                        const onLoad = () => {
                          clearTimeout(timeout);
                          img.removeEventListener('load', onLoad);
                          img.removeEventListener('error', onError);
                          resolve();
                        };

                        const onError = () => {
                          clearTimeout(timeout);
                          img.removeEventListener('load', onLoad);
                          img.removeEventListener('error', onError);
                          resolve();
                        };

                        img.addEventListener('load', onLoad);
                        img.addEventListener('error', onError);

                        const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                        if (lazySrc && !img.src) {
                          img.src = lazySrc;
                        }
                      });
                    });

                    await Promise.all(loadPromises);
                  };

                  let images = document.querySelectorAll('img');
                  const pictureSources = document.querySelectorAll('picture source[srcset], picture source[src]');
                  const elementsWithBgImages: HTMLImageElement[] = [];
                  const allElements = document.querySelectorAll('*');
                  allElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const bgImage = style.backgroundImage;
                    if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
                      const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
                        const tempImg = document.createElement('img');
                        tempImg.src = urlMatch[1];
                        tempImg.style.display = 'none';
                        elementsWithBgImages.push(tempImg);
                      }
                    }
                  });
                  const allImageElements: HTMLImageElement[] = [];

                  Array.from(images).forEach(img => {
                    allImageElements.push(img as HTMLImageElement);
                  });

                  pictureSources.forEach(source => {
                    const srcset = source.getAttribute('srcset');
                    const src = source.getAttribute('src');
                    if (srcset || src) {
                      const url = srcset ? srcset.split(',')[0].trim().split(' ')[0] : src;
                      if (url && !url.startsWith('data:')) {
                        const tempImg = document.createElement('img');
                        tempImg.src = url;
                        tempImg.style.display = 'none';
                        allImageElements.push(tempImg);
                      }
                    }
                  });

                  elementsWithBgImages.forEach(img => {
                    allImageElements.push(img);
                  });

                  const imagesNodeList = images as NodeListOf<HTMLImageElement>;
                  await waitForImagesToLoad(imagesNodeList);

                  await new Promise(resolve => setTimeout(resolve, 100));

                  images = document.querySelectorAll('img');
                  allImageElements.length = 0;
                  Array.from(images).forEach(img => {
                    allImageElements.push(img as HTMLImageElement);
                  });

                  const selectedImages = new Set<number>();

                  validImages = [];
                  let filteredCount = 0;
                  const skippedReasons = {
                    notComplete: 0,
                    noWidth: 0,
                    tooSmall: 0,
                    noSrc: 0,
                    dataUrl: 0,
                    error: 0,
                  };

                  if (allImageElements && allImageElements.length > 0) {
                    validImages = allImageElements.filter((img, idx) => {
                      try {
                        const imgEl = img as HTMLImageElement;

                        if (!imgEl) {
                          skippedReasons.error++;
                          return false;
                        }

                        const hasSrc =
                          imgEl.src ||
                          imgEl.getAttribute('data-src') ||
                          imgEl.getAttribute('data-lazy-src') ||
                          imgEl.srcset;

                        if (!hasSrc) {
                          skippedReasons.noSrc++;
                          return false;
                        }

                        const actualSrc =
                          imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                        if (actualSrc && actualSrc.startsWith('data:')) {
                          try {
                            const base64Data = actualSrc.split(',')[1];
                            if (base64Data) {
                              const sizeInBytes = (base64Data.length * 3) / 4;
                              const sizeInKB = sizeInBytes / 1024;
                              if (sizeInKB < 0.5) {
                                skippedReasons.dataUrl++;
                                return false;
                              }
                            }
                          } catch (e) {}
                        }

                        const hasAnyWidth = imgEl.naturalWidth > 0 || imgEl.width > 0 || imgEl.offsetWidth > 0;
                        const hasAnyHeight = imgEl.naturalHeight > 0 || imgEl.height > 0 || imgEl.offsetHeight > 0;

                        const style = window.getComputedStyle(imgEl);
                        const isVisible =
                          style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';

                        const minSize = 10;
                        const width = imgEl.naturalWidth || imgEl.width || imgEl.offsetWidth || 0;
                        const height = imgEl.naturalHeight || imgEl.height || imgEl.offsetHeight || 0;

                        if (!hasAnyWidth && !hasAnyHeight && !isVisible) {
                          skippedReasons.noWidth++;
                          return false;
                        }

                        if (width > 0 && height > 0 && width < minSize && height < minSize && images.length > 5) {
                          skippedReasons.tooSmall++;
                          return false;
                        }

                        filteredCount++;
                        return true;
                      } catch (e) {
                        skippedReasons.error++;
                        console.error(`[Image ${idx}] Error filtering:`, e);
                        return false;
                      }
                    }) as HTMLImageElement[];
                  }
                  if (!Array.isArray(validImages)) {
                    validImages = [];
                  }
                  console.log('[Injected Script] Scraped valid page images:', {
                    totalScraped: allImageElements?.length || 0,
                    validCount: validImages.length,
                    skippedReasons,
                  });

                  if (downloadType === 'limit' && limit && limit > 0 && validImages && validImages.length > 0) {
                    validImages = validImages.slice(0, limit);
                  }

                  if (!Array.isArray(validImages)) {
                    validImages = [];
                  }

                  const existingDialog = document.getElementById('tasklabs-image-dialog');
                  if (existingDialog) {
                    existingDialog.parentElement?.removeChild(existingDialog);
                  }

                  const mainContainer = document.createElement('div');
                  mainContainer.id = 'tasklabs-image-main-container';
                  mainContainer.style.cssText = `
                  position: fixed;
                  top: 0;
                  left: 0;
                  width: 100vw;
                  height: 100vh;
                  background: rgba(0, 0, 0, 0.1);
                  z-index: 2147483647;
                  display: flex;
                  align-items: center;
                  justify-content: flex-end;
                  font-family: system-ui, -apple-system, sans-serif;
                  padding-right: 20px;
                  box-sizing: border-box;
                `;

                  const dialogBox = document.createElement('div');
                  dialogBox.id = 'tasklabs-image-dialog';
                  dialogBox.style.cssText = `
                  width: 400px;
                  max-width: 90vw;
                  height: 90vh;
                  max-height: 90vh;
                  background: rgb(235 235 235 / 75%);
                  backdrop-filter: blur(30px) saturate(180%);
                  -webkit-backdrop-filter: blur(30px) saturate(180%);
                  border: 1px solid rgba(255, 255, 255, 0.4);
                  border-left: 1px solid rgba(255, 255, 255, 0.5);
                  border-radius: 16px;
                  display: flex;
                  flex-direction: column;
                  box-shadow: -10px 0 40px -10px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
                  color: #1f2937;
                  overflow: hidden;
                  animation: tasklabs-slide-in 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                `;

                  const style = document.createElement('style');
                  style.innerHTML = `
                @keyframes tasklabs-slide-in {
                  from { opacity: 0; transform: translateX(40px) scale(0.98); }
                  to { opacity: 1; transform: translateX(0) scale(1); }
                }
                .tasklabs-header {
                  padding: 20px 24px;
                  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  background: rgba(255, 255, 255, 0.3);
                }
                .tasklabs-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #111827;
                  letter-spacing: -0.01em;
                }
                .tasklabs-close-button {
                  background: rgba(0, 0, 0, 0.05);
                  color: #4b5563;
                  border: none;
                  border-radius: 8px;
                  width: 32px;
                  height: 32px;
                  font-size: 18px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s;
                }
                .tasklabs-close-button:hover { 
                  background: rgba(0, 0, 0, 0.1);
                  color: #111827;
                }
                .tasklabs-subheader {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 16px 24px;
                  background: rgba(255, 255, 255, 0.2);
                  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                }
                .tasklabs-select-all-container {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  font-size: 13px;
                  color: #374151;
                  cursor: pointer;
                }
                .tasklabs-clear-all {
                  font-size: 13px;
                  color: #ef4444;
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 4px;
                  transition: background 0.2s;
                }
                .tasklabs-clear-all:hover {
                  background: rgba(239, 68, 68, 0.1);
                }
                #tasklabs-image-list {
                  flex: 1;
                  overflow-y: auto;
                  padding: 16px 24px;
                }
                .tasklabs-image-item {
                  display: flex;
                  align-items: center;
                  padding: 12px;
                  border-radius: 12px;
                  margin-bottom: 8px;
                  background: rgba(255, 255, 255, 0.4);
                  border: 1px solid rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  transition: all 0.2s;
                }
                .tasklabs-image-item:hover {
                  background: rgba(255, 255, 255, 0.7);
                  border-color: rgba(255, 255, 255, 0.9);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .tasklabs-image-item.selected { 
                  background: rgba(139, 92, 246, 0.1);
                  border-color: rgba(139, 92, 246, 0.3);
                }
                .tasklabs-image-checkbox {
                  margin-right: 16px;
                  width: 18px;
                  height: 18px;
                  accent-color: #8b5cf6;
                  cursor: pointer;
                }
                .tasklabs-image-preview {
                  width: 48px;
                  height: 48px;
                  object-fit: cover;
                  border-radius: 8px;
                  margin-right: 16px;
                  background: rgba(0,0,0,0.2);
                }
                .tasklabs-image-info {
                  display: flex;
                  flex-direction: column;
                  flex-grow: 1;
                }
                .tasklabs-image-label {
                  font-weight: 500;
                  color: #111827;
                  margin-bottom: 4px;
                  font-size: 14px;
                }
                .tasklabs-image-dimensions {
                  font-size: 12px;
                  color: #6b7280;
                }
                .tasklabs-download-options {
                  display: flex;
                  gap: 12px;
                  padding: 20px 24px;
                  background: rgba(255, 255, 255, 0.3);
                  border-top: 1px solid rgba(0, 0, 0, 0.05);
                }
                .tasklabs-download-button {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 12px 20px;
                  border: 1px solid rgba(0, 0, 0, 0.05);
                  border-radius: 10px;
                  font-size: 14px;
                  font-weight: 600;
                  color: #111827;
                  background: rgba(255, 255, 255, 0.6);
                  cursor: pointer;
                  flex: 1;
                  transition: all 0.2s;
                  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                .tasklabs-download-button:hover {
                  background: rgba(255, 255, 255, 0.9);
                  transform: translateY(-1px);
                  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                }
                .tasklabs-download-button.disabled {
                  opacity: 0.5;
                  pointer-events: none;
                }
                #tasklabs-image-list::-webkit-scrollbar {
                  width: 8px;
                }
                #tasklabs-image-list::-webkit-scrollbar-track {
                  background: transparent;
                }
                #tasklabs-image-list::-webkit-scrollbar-thumb {
                  background: rgba(255, 255, 255, 0.1);
                  border-radius: 4px;
                }
                #tasklabs-image-list::-webkit-scrollbar-thumb:hover {
                  background: rgba(255, 255, 255, 0.2);
                }
                `;
                  document.head.appendChild(style);

                  const closeDialog = () => {
                    if (document.body.contains(mainContainer)) {
                      document.body.removeChild(mainContainer);
                    }
                    if (document.head.contains(style)) {
                      document.head.removeChild(style);
                    }
                  };

                  mainContainer.onclick = e => {
                    if (e.target === mainContainer) {
                      closeDialog();
                    }
                  };

                  const handleEsc = (e: KeyboardEvent) => {
                    if (e.key === 'Escape') {
                      closeDialog();
                      document.removeEventListener('keydown', handleEsc);
                    }
                  };
                  document.addEventListener('keydown', handleEsc);

                  const header = document.createElement('div');
                  header.classList.add('tasklabs-header');
                  const title = document.createElement('span');
                  title.classList.add('tasklabs-title');
                  const totalImages = document.querySelectorAll('img').length;
                  const validCount = validImages && validImages.length ? validImages.length : 0;
                  if (downloadType === 'limit' && limit) {
                    title.textContent = `Export Images (${validCount} of ${totalImages}, limit: ${limit})`;
                  } else {
                    title.textContent = `Export Images (${validCount})`;
                  }
                  const closeButton = document.createElement('button');
                  closeButton.classList.add('tasklabs-close-button');
                  closeButton.innerHTML = '✕';
                  closeButton.onclick = closeDialog;

                  header.appendChild(title);
                  header.appendChild(closeButton);
                  dialogBox.appendChild(header);

                  const subheader = document.createElement('div');
                  subheader.classList.add('tasklabs-subheader');
                  const selectAllContainer = document.createElement('div');
                  selectAllContainer.classList.add('tasklabs-select-all-container');
                  const selectAllCheckbox = document.createElement('input');
                  selectAllCheckbox.type = 'checkbox';
                  selectAllCheckbox.classList.add('tasklabs-image-checkbox');
                  selectAllCheckbox.onchange = () => {
                    const isChecked = selectAllCheckbox.checked;
                    if (!validImages || !Array.isArray(validImages) || validImages.length === 0) {
                      return;
                    }
                    validImages.forEach((_, index) => {
                      if (!validImages || !validImages[index]) return;
                      const checkbox = document.getElementById(`tasklabs-checkbox-${index}`) as HTMLInputElement;
                      if (checkbox) {
                        checkbox.checked = isChecked;
                        if (isChecked) {
                          selectedImages.add(index);
                          const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                          imageItem?.classList.add('selected');
                          const imgEl = validImages[index] as HTMLImageElement;
                          if (imgEl) {
                            imgEl.style.border = '3px solid #dc2626';
                            imgEl.style.borderRadius = '4px';
                          }
                        } else {
                          selectedImages.delete(index);
                          const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                          imageItem?.classList.remove('selected');
                          const imgEl = validImages[index] as HTMLImageElement;
                          if (imgEl) {
                            imgEl.style.border = '';
                            imgEl.style.borderRadius = '';
                          }
                        }
                      }
                    });
                    updateButtonStates();
                  };
                  const selectAllLabel = document.createElement('span');
                  selectAllLabel.textContent = 'Select All';
                  selectAllContainer.appendChild(selectAllCheckbox);
                  selectAllContainer.appendChild(selectAllLabel);

                  const clearAll = document.createElement('span');
                  clearAll.classList.add('tasklabs-clear-all');
                  clearAll.textContent = 'Clear All';
                  clearAll.onclick = () => {
                    selectedImages.clear();
                    selectAllCheckbox.checked = false;
                    if (!validImages || !Array.isArray(validImages) || validImages.length === 0) {
                      updateButtonStates();
                      return;
                    }
                    validImages.forEach((_, index) => {
                      if (!Array.isArray(validImages) || index < 0 || index >= validImages.length) {
                        return;
                      }
                      if (!validImages[index]) {
                        return;
                      }
                      const checkbox = document.getElementById(`tasklabs-checkbox-${index}`) as HTMLInputElement;
                      if (checkbox) checkbox.checked = false;
                      const imageItem = document.querySelector(`.tasklabs-image-item:nth-child(${index + 1})`);
                      imageItem?.classList.remove('selected');
                      const imgEl = validImages[index] as HTMLImageElement;
                      if (imgEl) {
                        imgEl.style.border = '';
                        imgEl.style.borderRadius = '';
                      }
                    });
                    updateButtonStates();
                  };
                  subheader.appendChild(selectAllContainer);
                  subheader.appendChild(clearAll);
                  dialogBox.appendChild(subheader);

                  const addedImageSources = new Set<string>();

                  const imageList = document.createElement('div');
                  imageList.id = 'tasklabs-image-list';

                  if (!validImages || validImages.length === 0) {
                    const noImagesMessage = document.createElement('div');
                    noImagesMessage.textContent = 'No images found on this page';
                    noImagesMessage.style.textAlign = 'center';
                    noImagesMessage.style.padding = '40px 20px';
                    noImagesMessage.style.color = '#6b7280';
                    imageList.appendChild(noImagesMessage);
                  } else {
                    if (!validImages || !Array.isArray(validImages)) {
                      const noImagesMessage = document.createElement('div');
                      noImagesMessage.textContent = 'No images found on this page';
                      noImagesMessage.style.textAlign = 'center';
                      noImagesMessage.style.padding = '40px 20px';
                      noImagesMessage.style.color = '#6b7280';
                      imageList.appendChild(noImagesMessage);
                    } else {
                      validImages.forEach((img, index) => {
                        if (!img) return;

                        const imgEl = img as HTMLImageElement;
                        const imgSrc =
                          imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                        if (imgSrc) {
                          addedImageSources.add(imgSrc);
                        }

                        const imageItem = document.createElement('div');
                        imageItem.classList.add('tasklabs-image-item');

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.classList.add('tasklabs-image-checkbox');
                        checkbox.id = `tasklabs-checkbox-${index}`;

                        const preview = document.createElement('img');
                        preview.classList.add('tasklabs-image-preview');
                        const previewSrc =
                          imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src') || '';
                        preview.src = previewSrc;
                        preview.alt = `Preview ${index + 1}`;
                        preview.onerror = () => {
                          const fallbackSrc = imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy-src');
                          if (fallbackSrc && preview.src !== fallbackSrc) {
                            preview.src = fallbackSrc;
                          } else {
                            preview.style.display = 'none';
                          }
                        };

                        const imageInfo = document.createElement('div');
                        imageInfo.classList.add('tasklabs-image-info');
                        const imageLabel = document.createElement('div');
                        imageLabel.classList.add('tasklabs-image-label');
                        imageLabel.textContent = `Image ${index + 1}`;
                        const imageDimensions = document.createElement('div');
                        imageDimensions.classList.add('tasklabs-image-dimensions');
                        if (imgEl.naturalWidth && imgEl.naturalHeight) {
                          imageDimensions.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
                        } else {
                          imageDimensions.textContent = 'Loading...';
                          imgEl.onload = () => {
                            imageDimensions.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
                          };
                        }
                        imageInfo.appendChild(imageLabel);
                        imageInfo.appendChild(imageDimensions);

                        checkbox.addEventListener('change', () => {
                          if (checkbox.checked) {
                            selectedImages.add(index);
                            imageItem.classList.add('selected');
                            imgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            imgEl.style.border = '3px solid #dc2626';
                            imgEl.style.borderRadius = '4px';
                          } else {
                            selectedImages.delete(index);
                            imageItem.classList.remove('selected');
                            imgEl.style.border = '';
                            imgEl.style.borderRadius = '';
                          }
                          updateButtonStates();
                        });

                        imageItem.addEventListener('click', e => {
                          if (e.target !== checkbox) {
                            checkbox.click();
                          }
                        });

                        imageItem.appendChild(checkbox);
                        imageItem.appendChild(preview);
                        imageItem.appendChild(imageInfo);
                        imageList.appendChild(imageItem);
                      });
                    }
                  }
                  dialogBox.appendChild(imageList);

                  const getImageExtension = (url: string): string => {
                    if (url.startsWith('data:image/')) {
                      const match = url.match(/data:image\/([a-zA-Z]+);/);
                      return match ? match[1] : 'png';
                    }
                    const match = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                    return match ? match[1] : 'jpg';
                  };

                  const downloadSelectedImages = async (format: string) => {
                    if (selectedImages.size === 0) {
                      return;
                    }

                    const hostname = window.location.hostname.replace(/[^a-zA-Z0-9]/g, '_');
                    const date = new Date().toISOString().split('T')[0];
                    const folderName = `CMDOS_Downloads/${hostname}_${date}`;

                    let downloadIndex = 1;
                    for (const index of Array.from(selectedImages).sort((a, b) => a - b)) {
                      if (!validImages || !validImages[index]) {
                        continue;
                      }
                      const img = validImages[index] as HTMLImageElement;
                      if (!img) {
                        continue;
                      }
                      const imgSrc = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
                      if (!imgSrc) {
                        continue;
                      }

                      try {
                        let dataUrl = imgSrc;
                        if (!imgSrc.startsWith('data:')) {
                          const response = await fetch(imgSrc);
                          const blob = await response.blob();
                          dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                          });
                        }

                        const extension =
                          format === 'png' ? 'png' : format === 'jpg' ? 'jpg' : getImageExtension(imgSrc);
                        const filename = `${folderName}/image_${downloadIndex}.${extension}`;

                        window.postMessage(
                          {
                            type: 'TASKLABS_DOWNLOAD_IMAGE',
                            dataUrl: dataUrl,
                            filename: filename,
                          },
                          '*',
                        );

                        downloadIndex++;
                        await new Promise(resolve => setTimeout(resolve, 300));
                      } catch (error) {
                        console.error(`Error downloading image ${index + 1}:`, error);
                      }
                    }

                    setTimeout(() => {
                      if (validImages && validImages.length > 0) {
                        validImages.forEach(img => {
                          (img as HTMLImageElement).style.border = '';
                          (img as HTMLImageElement).style.borderRadius = '';
                        });
                      }
                      if (document.body.contains(mainContainer)) {
                        document.body.removeChild(mainContainer);
                      }
                      if (document.head.contains(style)) {
                        document.head.removeChild(style);
                      }
                    }, 1000);
                  };

                  const downloadOptionsContainer = document.createElement('div');
                  downloadOptionsContainer.classList.add('tasklabs-download-options');

                  const jpgButton = document.createElement('button');
                  jpgButton.textContent = '📥 JPG';
                  jpgButton.classList.add('tasklabs-download-button');
                  jpgButton.onclick = () => downloadSelectedImages('jpg');

                  const pngButton = document.createElement('button');
                  pngButton.textContent = '📥 PNG';
                  pngButton.classList.add('tasklabs-download-button');
                  pngButton.onclick = () => downloadSelectedImages('png');

                  const updateButtonStates = () => {
                    const disabled = selectedImages.size === 0;
                    [jpgButton, pngButton].forEach(btn => {
                      btn.disabled = disabled;
                      if (disabled) {
                        btn.classList.add('disabled');
                      } else {
                        btn.classList.remove('disabled');
                      }
                    });
                  };
                  updateButtonStates();

                  downloadOptionsContainer.appendChild(jpgButton);
                  downloadOptionsContainer.appendChild(pngButton);
                  dialogBox.appendChild(downloadOptionsContainer);

                  mainContainer.appendChild(dialogBox);

                  if (!document.body) {
                    return;
                  }

                  document.body.appendChild(mainContainer);
                } catch (err) {
                  console.error('[Image UI Dialog] Error:', err);
                }
              },
              args: [options],
            },
            () => {},
          );
        }
      } catch (err) {
        console.error('[Image Download] Error executing scripting:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }
  return undefined;
};
