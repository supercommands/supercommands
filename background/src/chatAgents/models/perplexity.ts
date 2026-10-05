/**
 * @file perplexity.ts
 * @description Handler for injecting and submitting prompts into Perplexity AI.
 */

import type { AutoSubmitRequest } from '../types';

/**
 * Injects a content script into the specified Perplexity tab to automatically fill
 * the chat input with the provided text/images and trigger the submission.
 * Includes heuristics to find Perplexity's dynamic input fields and submit buttons.
 *
 * @param tabId The ID of the tab where Perplexity is open.
 * @param request The auto-submit configuration detailing the prompt and optional images.
 */
export async function executePerplexitySubmit(tabId: number, request: AutoSubmitRequest) {
  if (!chrome.scripting?.executeScript) return;

  // Use calendar prompt if needed
  let promptToUse = request.prompt;
  if (request.kind === 'calendar') {
    promptToUse = `Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments. ${request.prompt}`;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: ['perplexity', promptToUse, request.images || null, tabId],
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

        let imageUploadAttempted = false;
        const filesInjected = false;
        let lastImageUpload = 0;
        const lastPlusBtnClick = 0;
        let lastTextUpdate = 0;
        const lastSubmitClick = 0;
        const lastReadyToSubmit = 0;
        const uploadState: 'idle' | 'opening' | 'menu-open' | 'waiting-input' | 'done' = 'idle';
        const textInjectedOnce = false;
        const firstUploadAttempt = 0;
        const lastUploadClick = 0;
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

        let lastPerplexitySubmitClick = 0;
        let perplexityTextSet = false;
        let perplexityPasteAttempted = false;

        const submitPerplexity = (stopMonitoring?: () => void): boolean => {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
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
                imageUploadAttempted = true;
                lastImageUpload = Date.now();
                return false;
              } catch (e) {
                console.error('[auto-submit][perplexity] ERROR: Image injection failed', e);
                imageUploadAttempted = true;
              }
            } else {
              imageUploadAttempted = true;
            }
          }

          const now = Date.now();
          const timeSinceImageUpload = now - lastImageUpload;

          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            timeSinceImageUpload < 3000
          ) {
            return false;
          }

          let inputEl: HTMLElement | null = null;
          let isTextarea = false;

          const askInput = document.getElementById('ask-input') as HTMLElement | null;
          if (askInput) {
            const pElement = askInput.querySelector('p') as HTMLElement | null;
            if (pElement && pElement.isContentEditable) {
              inputEl = pElement;
            }
          }

          if (!inputEl) {
            const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
            if (textarea) {
              inputEl = textarea;
              isTextarea = true;
            }
          }

          if (!inputEl) {
            const ce = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
            if (ce) {
              inputEl = ce;
            }
          }

          if (!inputEl) {
            return false;
          }

          const currentText = isTextarea ? (inputEl as HTMLTextAreaElement).value : inputEl.textContent || '';

          if (currentText.trim() !== resolvedPrompt && !(perplexityTextSet && now - lastTextUpdate < 3000)) {
            inputEl.focus();

            if (isTextarea) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value',
              )?.set;
              nativeInputValueSetter?.call(inputEl, resolvedPrompt);
              inputEl.dispatchEvent(new Event('input', { bubbles: true }));
              inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              if (!perplexityPasteAttempted) {
                try {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.setData('text/plain', resolvedPrompt);
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer,
                  });
                  inputEl.dispatchEvent(pasteEvent);
                } catch (e) {}
                perplexityPasteAttempted = true;
              } else {
                if (inputEl.textContent === '' || inputEl.textContent !== resolvedPrompt) {
                  inputEl.textContent = resolvedPrompt;
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }
            }

            perplexityTextSet = true;
            lastTextUpdate = now;
            return false;
          }

          const imageWaitThreshold = 2500;
          if (
            imagesFromExtension &&
            imagesFromExtension.length > 0 &&
            imageUploadAttempted &&
            now - lastImageUpload < imageWaitThreshold
          ) {
            return false;
          }

          const timeSinceTextUpdate = now - lastTextUpdate;
          if (timeSinceTextUpdate < 500) return false;

          const findPerplexitySendButton = (): HTMLButtonElement | null => {
            const allButtons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
            const scored = allButtons.map(btn => {
              let score = 0;
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const html = btn.innerHTML.toLowerCase();
              const rect = btn.getBoundingClientRect();

              if (rect.width === 0 || rect.height === 0) return { btn, score: -1 };

              const style = window.getComputedStyle(btn);
              if (style.display === 'none' || style.visibility === 'hidden') return { btn, score: -1 };

              if (rect.top > window.innerHeight * 0.5) score += 20;

              if (label.includes('submit')) score += 50;
              if (label.includes('send')) score += 40;
              if (label.includes('ask')) score += 30;
              if (html.includes('arrow-right') || html.includes('arrow')) score += 30;

              if (btn.classList.contains('bg-accentMain')) score += 20;

              if (label.includes('stop')) score -= 100;
              if (label.includes('attach') || label.includes('upload')) score -= 80;
              if (label.includes('menu') || label.includes('voice')) score -= 50;

              return { btn, score };
            });

            const best = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0];
            if (best) {
              return best.btn;
            }
            return null;
          };

          const isValidPerplexitySend = (btn: HTMLButtonElement): boolean => {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            const html = btn.innerHTML.toLowerCase();

            if (
              label.includes('stop') ||
              label.includes('remove') ||
              label.includes('attach') ||
              label.includes('upload') ||
              label.includes('menu') ||
              label.includes('voice')
            )
              return false;

            if (label.includes('send') || label.includes('submit') || label.includes('ask') || html.includes('arrow'))
              return true;

            return false;
          };

          const foundButton = findPerplexitySendButton();

          if (foundButton) {
            if (!isValidPerplexitySend(foundButton)) {
              console.warn('[perplexity] invalid button → retrying...');
              return false;
            }

            const isEnabled = !foundButton.disabled && foundButton.getAttribute('aria-disabled') !== 'true';

            if (isEnabled) {
              if (Date.now() - lastPerplexitySubmitClick < 1500) {
                return false;
              }
              const opts = { bubbles: true, cancelable: true, view: window };
              foundButton.dispatchEvent(new MouseEvent('mousedown', opts));
              foundButton.dispatchEvent(new MouseEvent('mouseup', opts));
              foundButton.click();

              lastPerplexitySubmitClick = Date.now();
              if (stopMonitoring) stopMonitoring();
              return true;
            }
          }

          const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
          if (now - lastTextUpdate > timeoutThreshold) {
            console.warn('[perplexity] Button click failed or stuck → forcing Enter key');
            inputEl?.focus();

            inputEl?.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              }),
            );

            if (stopMonitoring) stopMonitoring();
            return true;
          }

          if (!foundButton) {
            console.warn('[perplexity] No send button found → retrying...');
          } else {
            console.warn('[perplexity] Send button disabled → waiting...');
          }
          return false;
        };

        const attemptSubmission = (stopMonitoring?: () => void) => {
          const success = submitPerplexity(stopMonitoring);
          if (success) {
            (window as any)[markKey] = true;
            (window as any)[timestampKey] = Date.now();
          }
          return success;
        };

        const hasContent = () => {
          const textareaSelectors = ['#ask-input', 'textarea', 'form textarea'];
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
    console.error('[auto-submit] failed to execute script for Perplexity', error);
  }
}
