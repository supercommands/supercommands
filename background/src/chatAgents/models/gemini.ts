/**
 * @file gemini.ts
 * @description Handler for injecting and submitting prompts into Google Gemini.
 */

import type { AutoSubmitRequest } from '../types';

/**
 * Injects a content script into the specified Gemini tab to automatically fill
 * the chat input with the provided text/images and trigger the submission.
 * Includes advanced heuristics for identifying the correct upload buttons,
 * text areas, and send buttons within Gemini's dynamic DOM structure.
 *
 * @param tabId The ID of the tab where Gemini is open.
 * @param request The auto-submit configuration detailing the prompt and optional images.
 */
export async function executeGeminiSubmit(tabId: number, request: AutoSubmitRequest) {
  if (!chrome.scripting?.executeScript) return;

  // Use calendar prompt if needed
  let promptToUse = request.prompt;
  if (request.kind === 'calendar') {
    promptToUse = `Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments. ${request.prompt}`;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: ['gemini', promptToUse, request.images || null, tabId],
      world: 'MAIN',
      func: (
        kind: string,
        promptFromExtension: string,
        imagesFromExtension?: { base64: string; mimeType: string; filename: string }[] | null,
        currentTabId?: number,
      ) => {
        const getResolvedPrompt = (): string => {
          if (promptFromExtension && promptFromExtension.trim()) {
            return promptFromExtension.trim();
          }
          try {
            const url = new URL(window.location.href);
            const fromQuery = url.searchParams.get('q') || '';
            return fromQuery.trim();
          } catch (error) {
            console.warn('[auto-submit] failed to parse URL', error);
            return '';
          }
        };

        const markKey = `cmdosAutoSubmit-${kind}`;
        const timestampKey = `${markKey}-timestamp`;

        const stopMonitoring = () => {
          if ((window as any)[timestampKey + '-stopped']) return;
          (window as any)[timestampKey + '-stopped'] = true;

          if ((window as any)[timestampKey + '-interval']) {
            window.clearTimeout((window as any)[timestampKey + '-interval']);
            (window as any)[timestampKey + '-interval'] = null;
          }

          try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && currentTabId !== undefined) {
              chrome.runtime.sendMessage({ action: 'prompt_injected_success', tabId: currentTabId });
            }
          } catch (e) {
            console.warn('[auto-submit] failed to send completion signal', e);
          }
        };

        const resolvedPrompt = getResolvedPrompt();
        if (!resolvedPrompt && (!imagesFromExtension || imagesFromExtension.length === 0)) {
          stopMonitoring();
          return;
        }

        const dataURLtoFile = (dataurl: string, filename: string) => {
          const arr = dataurl.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          return new File([u8arr], filename, { type: mime });
        };

        const imageUploadAttempted = false;
        let filesInjected = false;
        const lastImageUpload = 0;
        let lastPlusBtnClick = 0;
        let lastTextUpdate = 0;
        let lastSubmitClick = 0;
        let lastReadyToSubmit = 0;
        let uploadState: 'idle' | 'opening' | 'menu-open' | 'waiting-input' | 'done' = 'idle';
        let textInjectedOnce = false;
        const firstUploadAttempt = 0;
        let lastUploadClick = 0;
        const lastReadyCheck = new WeakMap<HTMLButtonElement, number>();

        const wakeUpBackgroundTab = () => {
          Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
          Object.defineProperty(document, 'hidden', { value: false, writable: true });
          document.dispatchEvent(new Event('visibilitychange'));
          const _reflow = document.body.offsetHeight;
        };

        window.scrollTo(0, document.body.scrollHeight);

        const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value')?.set : undefined;
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            (element as any).value = value;
          }
        };

        const focusAndFill = (element: HTMLInputElement | HTMLTextAreaElement) => {
          element.focus();
          setNativeValue(element, '');
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          setNativeValue(element, resolvedPrompt);
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const clickAvailableButton = (
          selectors: string[],
          stopMonitoring?: () => void,
        ): { clicked: boolean; button: HTMLButtonElement | null } => {
          for (const selector of selectors) {
            const candidate = document.querySelector(selector) as HTMLButtonElement | null;
            if (candidate && !candidate.disabled) {
              const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
              };

              if (typeof PointerEvent !== 'undefined') {
                candidate.dispatchEvent(new PointerEvent('pointerdown', opts));
                candidate.dispatchEvent(new PointerEvent('mousedown', opts));
                candidate.dispatchEvent(new PointerEvent('pointerup', opts));
                candidate.dispatchEvent(new PointerEvent('mouseup', opts));
              } else {
                candidate.dispatchEvent(new MouseEvent('mousedown', opts));
                candidate.dispatchEvent(new MouseEvent('mouseup', opts));
              }

              candidate.click();

              if (stopMonitoring) {
                stopMonitoring();
              }

              return { clicked: true, button: candidate };
            }
          }
          return { clicked: false, button: null };
        };

        const submitGemini = (stopMonitoring?: () => void): boolean => {
          const findUploadButtonByScore = (): HTMLButtonElement | null => {
            const root = document.querySelector('input-area-v2') || document.body;
            const allButtons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];

            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            const scored = allButtons.map(btn => {
              let score = 0;
              const rect = btn.getBoundingClientRect();
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };
              if (btn.disabled) return { btn, score: -1 };

              if (textareaRect) {
                const verticallyNear =
                  Math.abs(rect.top - textareaRect.top) < 100 || Math.abs(rect.bottom - textareaRect.bottom) < 100;
                if (verticallyNear) score += 25;
                if (rect.left < textareaRect.left) score += 20;
              }

              if (rect.width < 56 && rect.height < 56) score += 20;

              if (label.includes('upload')) score += 30;
              if (label.includes('add') || label.includes('attach')) score += 20;
              if (label.includes('send') || label.includes('submit')) score -= 50;
              if (
                label.includes('menu') ||
                label.includes('settings') ||
                label.includes('profile') ||
                label.includes('account')
              )
                score -= 40;

              if (html.includes('add_2') || html.includes('add_circle')) score += 20;
              if (html.includes('upload') || html.includes('attach')) score += 20;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 40) {
              console.warn('[gemini-score] fallback triggered');
              return document.querySelector('button[aria-label*="upload"]') as HTMLButtonElement | null;
            }
            return best.btn;
          };

          const findSendButtonByScore = (): HTMLButtonElement | null => {
            const root = document.querySelector('input-area-v2') || document.body;
            const allButtons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];

            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            const scored = allButtons.map(btn => {
              let score = 0;
              const rect = btn.getBoundingClientRect();
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };
              if (btn.disabled) return { btn, score: -1 };

              if (btn.getAttribute('aria-disabled') === 'true') score -= 30;

              if (textareaRect) {
                const verticallyNear =
                  Math.abs(rect.top - textareaRect.top) < 100 || Math.abs(rect.bottom - textareaRect.bottom) < 100;
                if (verticallyNear) score += 25;
                if (rect.left > textareaRect.right - 100) score += 25;
              }

              if (rect.width < 56 && rect.height < 56) score += 20;

              if (label.includes('send')) score += 40;
              if (label.includes('submit')) score += 30;
              if (label.includes('message')) score += 15;

              if (label.includes('stop')) score -= 100;
              if (label.includes('remove')) score -= 80;
              if (label.includes('upload')) score -= 50;
              if (label.includes('attach')) score -= 50;
              if (label.includes('add') || label.includes('menu')) score -= 40;
              if (label.includes('microphone') || label.includes('voice')) score -= 40;
              if (label.includes('settings') || label.includes('profile')) score -= 40;

              if (html.includes('send') || html.includes('arrow_upward')) score += 30;
              if (html.includes('arrow_forward')) score += 20;
              if (html.includes('add_2') || html.includes('upload')) score -= 30;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 40) {
              console.warn('[gemini-send-score] fallback triggered');
              return document.querySelector(
                'button[aria-label="Send message"], button[data-testid="send-button"]',
              ) as HTMLButtonElement | null;
            }

            if (best.btn.getAttribute('aria-label')?.toLowerCase().includes('stop')) {
              console.warn('[gemini-send-score] STOP button detected, skipping');
              return null;
            }
            return best.btn;
          };

          const findTextInputByScore = (): { node: HTMLElement; isContentEditable: boolean } | null => {
            const root = document.querySelector('input-area-v2') || document.body;

            const candidates = Array.from(
              root.querySelectorAll('textarea, div[contenteditable="true"], rich-textarea .ql-editor, .ql-editor'),
            ) as HTMLElement[];

            const scored = candidates.map(el => {
              let score = 0;
              const rect = el.getBoundingClientRect();
              const tag = el.tagName.toLowerCase();
              const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
              const classList = el.className.toLowerCase();
              const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';

              if (rect.width === 0 || rect.height === 0) return { el, score: -1, isContentEditable };

              if (rect.top < 0 || rect.bottom > window.innerHeight + 50) return { el, score: -1, isContentEditable };

              if (el.getAttribute('disabled') !== null) return { el, score: -1, isContentEditable };
              if (el.getAttribute('aria-disabled') === 'true') return { el, score: -1, isContentEditable };

              if (rect.width > 200) score += 20;
              if (rect.height > 30) score += 15;
              if (rect.height > 100) score += 10;

              if (rect.top > window.innerHeight * 0.5) score += 25;

              if (tag === 'textarea') score += 30;
              if (isContentEditable) score += 25;

              if (classList.includes('ql-editor')) score += 30;
              if (classList.includes('input')) score += 15;
              if (classList.includes('textarea')) score += 15;
              if (classList.includes('chat')) score += 10;

              if (placeholder.includes('message')) score += 20;
              if (placeholder.includes('enter') || placeholder.includes('type')) score += 15;
              if (placeholder.includes('ask') || placeholder.includes('prompt')) score += 15;
              if (placeholder.includes('search')) score -= 20;

              let hasNearbySend = false;
              const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
              for (const btn of allButtons) {
                const btnRect = btn.getBoundingClientRect();
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                if (!label.includes('send')) continue;
                const distance = Math.abs(btnRect.top - rect.bottom) + Math.abs(btnRect.left - rect.right);
                if (distance < 200) {
                  hasNearbySend = true;
                  break;
                }
              }
              if (hasNearbySend) score += 10;

              if (classList.includes('title')) score -= 30;
              if (classList.includes('search')) score -= 20;
              if (classList.includes('label')) score -= 30;

              return { el, score, isContentEditable };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];

            if (!best || best.score < 30) {
              console.warn('[gemini-input-score] fallback triggered');
              const fallback =
                document.querySelector('input-area-v2 textarea') ||
                document.querySelector('rich-textarea .ql-editor') ||
                document.querySelector('.ql-editor[contenteditable="true"]') ||
                document.querySelector('div[contenteditable="true"]') ||
                document.querySelector('textarea:not([type="search"])');

              if (!fallback) return null;
              return {
                node: fallback as HTMLElement,
                isContentEditable: (fallback as HTMLElement).isContentEditable,
              };
            }
            return { node: best.el, isContentEditable: best.isContentEditable };
          };

          const isTrulySendButton = (btn: HTMLButtonElement): boolean => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();
            const rect = btn.getBoundingClientRect();

            if (btn.offsetParent === null) {
              console.warn('[gemini-verify] REJECTED: not visible');
              return false;
            }

            if (label.includes('stop')) return false;
            if (label.includes('remove')) return false;
            if (label.includes('menu')) return false;
            if (label.includes('upload') || label.includes('attach')) return false;
            if (label.includes('microphone') || label.includes('voice')) return false;

            const hasPositiveLabel = label.includes('send') || label.includes('submit');

            const hasPositiveIcon =
              html.includes('send') || html.includes('arrow_upward') || html.includes('arrow_forward');

            if (!hasPositiveLabel && !hasPositiveIcon) {
              console.warn('[gemini-verify] REJECTED: no positive signal');
              return false;
            }

            const textarea = document.querySelector('textarea, div[contenteditable="true"], rich-textarea');
            const textareaRect = textarea?.getBoundingClientRect();

            if (textareaRect && rect.left < textareaRect.right - 150) {
              console.warn('[gemini-verify] REJECTED: not right of input');
              return false;
            }
            return true;
          };

          const isTrulyReady = (btn: HTMLButtonElement): boolean => {
            if (btn.disabled) {
              console.warn('[gemini-ready] FAIL: btn.disabled');
              return false;
            }

            if (btn.getAttribute('aria-disabled') === 'true') {
              console.warn('[gemini-ready] FAIL: aria-disabled');
              return false;
            }

            const style = window.getComputedStyle(btn);
            if (parseFloat(style.opacity) < 0.7) {
              console.warn('[gemini-ready] FAIL: opacity', style.opacity);
              return false;
            }

            if (style.pointerEvents === 'none') {
              console.warn('[gemini-ready] FAIL: pointer-events none');
              return false;
            }

            const rect = btn.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
              console.warn('[gemini-ready] FAIL: zero size');
              return false;
            }

            const now = Date.now();
            const lastCheck = lastReadyCheck.get(btn) || 0;
            if (now - lastCheck < 150) {
              console.warn('[gemini-ready] waiting stability window...');
              return false;
            }
            lastReadyCheck.set(btn, now);
            return true;
          };

          wakeUpBackgroundTab();

          if (imagesFromExtension && imagesFromExtension.length > 0 && !filesInjected) {
            const now = Date.now();

            if (uploadState === 'idle' || uploadState === 'opening') {
              const addBtn = findUploadButtonByScore();

              if (addBtn && now - lastPlusBtnClick > 1500) {
                addBtn.click();
                lastPlusBtnClick = now;
                uploadState = 'opening';
              }

              const uploadMenu = document.querySelector('[aria-controls="upload-file-menu"]');
              const isExpanded =
                (uploadMenu && uploadMenu.getAttribute('aria-expanded') === 'true') ||
                (addBtn && addBtn.getAttribute('aria-expanded') === 'true');
              const hasUploadOption = document.querySelector(
                'button[data-test-id="local-images-files-uploader-button"]',
              );

              if (isExpanded || hasUploadOption) {
                uploadState = 'menu-open';
              }

              return false;
            }

            if (uploadState === 'menu-open') {
              const uploadBtn = document.querySelector(
                'button[data-test-id="local-images-files-uploader-button"]',
              ) as HTMLButtonElement;

              if (uploadBtn && now - lastUploadClick > 1500) {
                uploadBtn.click();
                lastUploadClick = now;
                uploadState = 'waiting-input';
              }

              return false;
            }

            if (uploadState === 'waiting-input') {
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

              if (fileInput) {
                try {
                  const dataTransfer = new DataTransfer();

                  for (const img of imagesFromExtension) {
                    const file = dataURLtoFile(img.base64, img.filename);
                    dataTransfer.items.add(file);
                  }

                  fileInput.files = dataTransfer.files;
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                  filesInjected = true;
                  uploadState = 'done';
                } catch (e) {
                  console.error('[gemini-upload] ❌ Injection failed', e);
                }
              }

              if (now - firstUploadAttempt > 8000) {
                console.warn('[gemini-upload] ⏱️ Timeout → fallback to text only');
                filesInjected = true;
                uploadState = 'done';
              }

              return false;
            }
          }

          const input = findTextInputByScore();
          if (!input) return false;

          const { node, isContentEditable } = input;

          if (!node) return false;

          const currentText = isContentEditable ? node.textContent || '' : (node as HTMLTextAreaElement).value || '';

          if (!textInjectedOnce) {
            node.focus();

            if (isContentEditable) {
              node.focus();
              node.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              document.execCommand('insertText', false, resolvedPrompt);
              node.dispatchEvent(new Event('compositionend', { bubbles: true }));
            } else {
              setNativeValue(node as HTMLTextAreaElement, resolvedPrompt);
            }

            node.dispatchEvent(new Event('input', { bubbles: true }));

            lastTextUpdate = Date.now();
            textInjectedOnce = true;

            return false;
          }

          if (Date.now() - lastTextUpdate < 1200) {
            return false;
          }

          const foundButton = findSendButtonByScore();

          if (foundButton) {
            const isEnabled = !foundButton.disabled && foundButton.getAttribute('aria-disabled') !== 'true';
            if (isEnabled) {
              if (!isTrulySendButton(foundButton)) return false;
              if (!isTrulyReady(foundButton)) return false;

              if (Date.now() - lastSubmitClick < 1500) return false;
              foundButton.click();
              lastSubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              if (Date.now() - lastTextUpdate < timeoutThreshold) {
                return false;
              }
            }
          } else {
            if (lastReadyToSubmit === 0) lastReadyToSubmit = Date.now();
            if (Date.now() - lastReadyToSubmit > 2000) {
              node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
              if (stopMonitoring) stopMonitoring();
              return true;
            }
          }

          return false;
        };

        const attemptSubmission = (stopMonitoring?: () => void) => {
          const success = submitGemini(stopMonitoring);
          if (success) {
            (window as any)[markKey] = true;
            (window as any)[timestampKey] = Date.now();
          }
          return success;
        };

        const hasContent = () => {
          const textareaSelectors = [
            '#app-root input-area-v2 textarea',
            'input-area-v2 textarea',
            '#app-root input-area-v2 div[contenteditable="true"]',
            'input-area-v2 div[contenteditable="true"]',
            'textarea[aria-label*="Message"]',
            'textarea',
          ];
          for (const selector of textareaSelectors) {
            const textarea = document.querySelector(selector) as HTMLTextAreaElement | HTMLElement | null;
            if (textarea) {
              if ((textarea as HTMLTextAreaElement).value !== undefined) {
                if ((textarea as HTMLTextAreaElement).value.trim().length > 0) return true;
              } else if (textarea.textContent && textarea.textContent.trim().length > 0) {
                return true;
              }
            }
          }
          return false;
        };

        const start = Date.now();
        const maxDuration = imagesFromExtension && imagesFromExtension.length > 0 ? 300000 : 60000;
        let attemptCount = 0;
        let textWasEverSet = false;

        let lastAttemptCountLog = 0;
        const scheduleNextAttempt = () => {
          attemptCount++;

          let delay = 100;
          if (attemptCount > 40) delay = 1000;
          else if (attemptCount > 20) delay = 500;

          if (attemptCount - lastAttemptCountLog >= 50) {
            lastAttemptCountLog = attemptCount;
          }

          (window as any)[timestampKey + '-interval'] = window.setTimeout(() => {
            if (textWasEverSet && !hasContent()) {
              stopMonitoring();
              return;
            }

            const requestIdle = window.requestIdleCallback || ((cb: Function) => window.setTimeout(cb, 1));
            requestIdle(() => {
              const result = attemptSubmission(stopMonitoring);

              if (!textWasEverSet && hasContent()) {
                textWasEverSet = true;
              }

              if (result) {
                stopMonitoring();
                return;
              }

              if (Date.now() - start > maxDuration) {
                stopMonitoring();
                return;
              }

              scheduleNextAttempt();
            });
          }, delay);
        };

        scheduleNextAttempt();

        window.setTimeout(() => {
          if (attemptSubmission(stopMonitoring)) {
            stopMonitoring();
          }
        }, 50);
      },
    });
  } catch (error) {
    console.error('[auto-submit] failed to execute script for Gemini', error);
  }
}
