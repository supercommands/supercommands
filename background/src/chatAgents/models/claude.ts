/**
 * @file claude.ts
 * @description Handler for injecting and submitting prompts into Anthropic's Claude.
 */

import type { AutoSubmitRequest } from '../types';

/**
 * Injects a content script into the specified Claude tab to automatically fill
 * the chat input with the provided text/images and trigger the submission.
 * Specifically handles Claude's ProseMirror-based rich text editor and React
 * event listeners for content injection and form submission.
 *
 * @param tabId The ID of the tab where Claude is open.
 * @param request The auto-submit configuration detailing the prompt and optional images.
 */
export async function executeClaudeSubmit(tabId: number, request: AutoSubmitRequest) {
  if (!chrome.scripting?.executeScript) return;

  // Use calendar prompt if needed
  let promptToUse = request.prompt;
  if (request.kind === 'calendar') {
    promptToUse = `Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments. ${request.prompt}`;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: ['claude', promptToUse, request.images || null, tabId],
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

        const submitClaude = (stopMonitoring?: () => void): boolean => {
          if (imagesFromExtension && imagesFromExtension.length > 0 && !imageUploadAttempted) {
            const textareaSelectors = [
              'div[contenteditable="true"].ProseMirror',
              'div[contenteditable="true"][data-placeholder]',
              'textarea[data-testid="message-input"]',
              'fieldset textarea',
              'form textarea',
              'textarea',
            ];

            let targetElement: HTMLElement | null = null;
            for (const selector of textareaSelectors) {
              const found = document.querySelector(selector) as HTMLElement | null;
              if (found) {
                targetElement = found;
                break;
              }
            }

            if (targetElement) {
              targetElement.focus();

              try {
                const dataTransfer = new DataTransfer();
                for (const img of imagesFromExtension) {
                  const file = dataURLtoFile(img.base64, img.filename);
                  dataTransfer.items.add(file);
                }

                const pasteEvent = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: dataTransfer,
                });

                targetElement.dispatchEvent(pasteEvent);
              } catch (e) {}

              try {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
                if (fileInput) {
                  const dataTransfer = new DataTransfer();
                  for (const img of imagesFromExtension) {
                    const file = dataURLtoFile(img.base64, img.filename);
                    dataTransfer.items.add(file);
                  }
                  fileInput.files = dataTransfer.files;
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              } catch (e) {}

              imageUploadAttempted = true;
              lastImageUpload = Date.now();
              return false;
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

          const textareaSelectors = [
            'div[contenteditable="true"].ProseMirror',
            'div[contenteditable="true"][data-placeholder]',
            'textarea[data-testid="message-input"]',
            'textarea[aria-label*="Message"]',
            'textarea[placeholder*="Claude"]',
            'fieldset textarea',
            'form textarea',
            'textarea',
          ];

          let node: HTMLTextAreaElement | HTMLInputElement | HTMLElement | null = null;
          let isContentEditable = false;

          for (const selector of textareaSelectors) {
            const found = document.querySelector(selector) as HTMLElement | null;
            if (found) {
              node = found;
              isContentEditable = found.isContentEditable;
              break;
            }
          }

          if (!node) {
            return false;
          }

          const getCurrentValue = (): string => {
            if (isContentEditable) {
              return (node as HTMLElement).innerText || '';
            }
            return (node as HTMLTextAreaElement).value || '';
          };

          const setCurrentValue = (value: string) => {
            if (isContentEditable) {
              const el = node as HTMLElement;
              el.focus();
              el.dispatchEvent(new Event('compositionstart', { bubbles: true }));
              el.dispatchEvent(new Event('keydown', { bubbles: true }));
              el.dispatchEvent(new Event('keypress', { bubbles: true }));

              const success = document.execCommand('insertText', false, value);

              el.dispatchEvent(new Event('textInput', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('keyup', { bubbles: true }));
              el.dispatchEvent(new Event('compositionend', { bubbles: true }));

              if (!success || (el.innerText || '').trim() !== value) {
                el.innerText = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
              el.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              focusAndFill(node as HTMLTextAreaElement);
            }
          };

          const currentValue = getCurrentValue();

          if (currentValue.trim() !== resolvedPrompt) {
            setCurrentValue(resolvedPrompt);
            lastTextUpdate = Date.now();
            return false;
          }

          const timeSinceUpdate = Date.now() - lastTextUpdate;
          if (timeSinceUpdate < 400) {
            return false;
          }

          const buttonSelectors = [
            'button[data-testid="submit-button"]',
            'button[aria-label="Send Message"]',
            'button[aria-label*="Send"]',
            'button[type="submit"]',
            'fieldset button[type="button"]',
          ];

          let foundButton: HTMLButtonElement | null = null;
          for (const selector of buttonSelectors) {
            const btn = document.querySelector(selector) as HTMLButtonElement | null;
            if (btn) {
              foundButton = btn;
              break;
            }
          }

          if (foundButton) {
            if (!foundButton.disabled) {
              foundButton.click();
              if (stopMonitoring) stopMonitoring();
              return true;
            } else {
              const timeoutThreshold = imagesFromExtension && imagesFromExtension.length > 0 ? 12000 : 4000;
              if (Date.now() - lastTextUpdate < timeoutThreshold) {
                return false;
              }
            }
          }

          node.focus();
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          });
          node.dispatchEvent(enterEvent);
          node.dispatchEvent(
            new KeyboardEvent('keyup', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            }),
          );
          return true;
        };

        const attemptSubmission = (stopMonitoring?: () => void) => {
          const success = submitClaude(stopMonitoring);
          if (success) {
            (window as any)[markKey] = true;
            (window as any)[timestampKey] = Date.now();
          }
          return success;
        };

        const hasContent = () => {
          const textareaSelectors = [
            'textarea[data-testid="message-input"]',
            'textarea[aria-label*="Message"]',
            'form textarea',
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
    console.error('[auto-submit] failed to execute script for Claude', error);
  }
}
