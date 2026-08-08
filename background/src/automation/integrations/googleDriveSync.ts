/**
 * @file googleDriveSync.ts
 * @description Specialized automation flows, particularly for Google Drive integration.
 *
 * This module includes logic for interacting with web elements via the Chrome
 * DevTools Protocol (CDP), such as picking elements by coordinates, and executing
 * complex, trusted file upload flows (e.g., silently injecting files into file inputs).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const CDP_PICKER_FUNCTION = /* js */ `
  function() {
    const el = this;
    const isPlaceholderNode = node => {
      if (!node || !node.getAttribute) return false;
      const placeholderText =
        node.getAttribute('data-empty-text') ||
        node.getAttribute('data-placeholder') ||
        node.getAttribute('aria-placeholder') ||
        '';
      const isPlaceholderClass = node.classList && node.classList.contains('editor-placeholder');
      return !!placeholderText || !!isPlaceholderClass;
    };

    const getInteractiveParent = node => {
      if (!node) return node;
      if (isPlaceholderNode(node)) {
        const editor = node.closest('[contenteditable="true"], [role="textbox"]');
        if (editor) return editor;
      }
      const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
      let current = node;
      while (current && current.tagName && current.tagName !== 'BODY') {
        if (
          interactiveTags.includes(current.tagName) ||
          current.getAttribute('role') === 'button' ||
          current.isContentEditable ||
          current.getAttribute('contenteditable') === 'true' ||
          current.getAttribute('role') === 'textbox' ||
          current.onclick
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return node;
    };

    const getElementName = node => {
      if (!node || !node.getAttribute) return '';
      const ariaLabel = node.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      const labelledBy = node.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
      }
      if (node.id) {
        const label = document.querySelector('label[for="' + node.id + '"]');
        if (label && label.textContent) return label.textContent.trim();
      }
      const parentLabel = node.closest && node.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        clone.querySelectorAll('input, textarea, select').forEach(c => c.remove());
        const text = clone.textContent && clone.textContent.trim();
        if (text) return text;
      }
      const nameAttr = node.getAttribute('name');
      if (nameAttr) return nameAttr;
      const placeholder =
        node.getAttribute('placeholder') ||
        node.getAttribute('data-empty-text') ||
        node.getAttribute('data-placeholder') ||
        node.getAttribute('aria-placeholder');
      if (placeholder) return placeholder;
      if (
        node.isContentEditable ||
        node.getAttribute('contenteditable') === 'true' ||
        node.getAttribute('role') === 'textbox'
      ) {
        const placeholderNode = node.querySelector(
          '[data-empty-text], [data-placeholder], [aria-placeholder], .editor-placeholder',
        );
        if (placeholderNode) {
          const derived =
            placeholderNode.getAttribute('data-empty-text') ||
            placeholderNode.getAttribute('data-placeholder') ||
            placeholderNode.getAttribute('aria-placeholder');
          if (derived) return derived;
        }
      }
      const titleAttr = node.getAttribute('title');
      if (titleAttr) return titleAttr;
      return '';
    };

    const getUniqueSelector = node => {
      if (!node) return '';
      if (node instanceof ShadowRoot) {
        const host = node.host;
        return host ? getUniqueSelector(host) + ' >>> ' : '';
      }

      const shouldSnap =
        ['SVG', 'PATH', 'SPAN', 'I', 'IMG'].includes(node.tagName) ||
        isPlaceholderNode(node);
      if (shouldSnap) {
        const snapped = getInteractiveParent(node);
        if (snapped && snapped !== node) {
          return getUniqueSelector(snapped);
        }
      }

      if (node.id && !/^\\d/.test(node.id) && !/[a-f0-9]{8,}/i.test(node.id)) {
        return '#' + node.id;
      }
      if (node.tagName === 'BODY') return 'body';

      const stableAttrs = ['data-testid', 'data-id', 'data-automation', 'data-qa', 'aria-label'];
      for (const attr of stableAttrs) {
        const val = node.getAttribute && node.getAttribute(attr);
        if (val) return '[' + attr + '=\"' + val + '\"]';
      }

      let selector = node.tagName.toLowerCase();
      const classes = Array.from(node.classList || []).filter(c => {
        if (c.includes(':') || c.includes('[') || c.includes('theme-')) return false;
        if (/^(sc-|css-|jss-|style-)/i.test(c)) return false;
        if (/[a-z0-0]{6,}/i.test(c)) return false;
        const stateKeywords = [
          'focus',
          'hover',
          'active',
          'select',
          'open',
          'close',
          'hide',
          'show',
          'visible',
          'hidden',
          'loading',
          'disabled',
          'expanded',
          'collapsed',
          'checked',
          'pressed',
          'current',
          'dragging',
          'dropping',
          'invalid',
          'valid',
          'required',
          'is-',
          'has-',
          '-',
        ];
        const low = c.toLowerCase();
        if (stateKeywords.some(k => low.includes(k))) {
          if (low.includes('focus') || low.includes('hover') || low.includes('active') || low.includes('is') || low.includes('has')) {
            return false;
          }
        }
        return true;
      });

      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }

      const parent = node.parentElement || (node.parentNode instanceof ShadowRoot ? node.parentNode : null);
      if (parent) {
        const siblings = Array.from(parent.children || []).filter(s => s.tagName === node.tagName);
        if (siblings.length > 1) {
          const index = Array.from(parent.children || []).indexOf(node) + 1;
          selector += ':nth-child(' + index + ')';
        }
        const parentSelector = getUniqueSelector(parent);
        if (parentSelector.endsWith(' >>> ')) {
          return parentSelector + selector;
        }
        return parentSelector + ' > ' + selector;
      }
      return selector;
    };

    const target = getInteractiveParent(el);
    const selector = getUniqueSelector(target);
    const elementName = getElementName(target);
    const nameFallback =
      (target.innerText || '').trim().split('\\n')[0].substring(0, 40) ||
      target.placeholder ||
      (target.getAttribute && target.getAttribute('data-empty-text')) ||
      (target.getAttribute && target.getAttribute('data-placeholder')) ||
      (target.getAttribute && target.getAttribute('aria-placeholder')) ||
      target.title ||
      target.id ||
      target.tagName.toLowerCase();

    return {
      selector,
      elementName,
      name: elementName || nameFallback,
    };
  }
`;

const isDebuggerAlreadyAttached = (message: string) =>
  message.includes('Another debugger is already attached') || message.includes('already attached');

/**
 * Attaches the Chrome debugger to resolve the DOM node at a given viewport coordinate (x, y)
 * and extracts its semantic context via `CDP_PICKER_FUNCTION`.
 *
 * @param tabId The ID of the target tab.
 * @param x The X coordinate relative to the viewport.
 * @param y The Y coordinate relative to the viewport.
 * @returns An object containing the unique selector and element name, or null if failed.
 */
export async function pickElementViaCdp(tabId: number, x: number, y: number) {
  const target = { tabId };
  let attachedHere = false;

  try {
    await chrome.debugger.attach(target, '1.3');
    attachedHere = true;
  } catch (err: any) {
    const message = err?.message || chrome.runtime.lastError?.message || String(err);
    if (!isDebuggerAlreadyAttached(message)) {
      throw err;
    }
  }

  try {
    await chrome.debugger.sendCommand(target, 'DOM.enable');
    await chrome.debugger.sendCommand(target, 'Runtime.enable');

    const nodeResult: any = await chrome.debugger.sendCommand(target, 'DOM.getNodeForLocation', {
      x,
      y,
      includeUserAgentShadowDOM: true,
      ignorePointerEventsNone: true,
    });

    const nodeId = nodeResult?.nodeId;
    if (!nodeId) throw new Error('cdp_node_not_found');

    const resolved: any = await chrome.debugger.sendCommand(target, 'DOM.resolveNode', { nodeId });
    const objectId = resolved?.object?.objectId;
    if (!objectId) throw new Error('cdp_object_not_found');

    const result: any = await chrome.debugger.sendCommand(target, 'Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: CDP_PICKER_FUNCTION,
      returnByValue: true,
    });

    return result?.result?.value || null;
  } finally {
    if (attachedHere) {
      chrome.debugger.detach(target).catch(() => {});
    }
  }
}

/**
 * Injects a script to block the OS file picker dialog, waits for a file input to become available,
 * and automatically populates it with provided base64 files.
 * Intended to be executed within the target page context.
 *
 * @param filesToUpload An array of files (base64, filename, mimeType) to upload.
 */
export function startSilentInjection(filesToUpload: any[]) {
  const blockOSPicker = (e: any) => {
    if (e.target.type === 'file') {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('click', blockOSPicker, { capture: true, once: true });

  const notify = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText =
      'position:fixed;top:20px;right:20px;background:#1a73e8;color:white;padding:12px 24px;border-radius:24px;z-index:999999;font-family:Arial;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }, 3000);
  };

  let attempts = 0;
  const hunt = setInterval(() => {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      clearInterval(hunt);
      try {
        const dataTransfer = new DataTransfer();
        filesToUpload.forEach(f => {
          const parts = f.base64.split(',');
          const base64Data = parts.length > 1 ? parts[1] : parts[0];
          const binary = atob(base64Data);

          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          let mimeType = 'text/plain';
          if (parts.length > 1) {
            const match = parts[0].match(/:(.*?);/);
            if (match) mimeType = match[1];
          }

          dataTransfer.items.add(new File([bytes], f.filename, { type: mimeType }));
        });

        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        notify('🚀 AI Upload Started!');
      } catch (err) {
        console.error('[AI-Drive] Injection error:', err);
      }
    }
    if (attempts++ > 60) {
      clearInterval(hunt);
    }
  }, 100);
}

/**
 * Uses the Chrome DevTools Protocol to simulate trusted keyboard inputs (e.g., U)
 * to open a file picker menu and initiates \`startSilentInjection\` to upload files silently.
 *
 * @param tabId The ID of the tab to perform the upload in.
 * @param files An array of files to upload.
 * @returns An object containing \`success\` boolean, and optionally \`error\` if it failed.
 */
export async function executeTrustedDriveFlow(tabId: number, files: any[]) {
  try {
    await chrome.debugger.attach({ tabId }, '1.3');

    const sendKey = async (key: string, modifiers = 0) => {
      const params = { windowsVirtualKeyCode: key.charCodeAt(0), modifiers, type: 'rawKeyDown' };
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', params);
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
    };

    await sendKey('C', 1); // 1 = Alt
    await new Promise(r => setTimeout(r, 600));

    await chrome.scripting.executeScript({
      target: { tabId },
      func: startSilentInjection,
      args: [files],
      world: 'MAIN',
    });

    await sendKey('U', 0);

    setTimeout(() => {
      chrome.debugger.detach({ tabId });
    }, 1500);

    return { success: true };
  } catch (e: any) {
    console.error('[Background] Automation failed:', e);
    chrome.debugger.detach({ tabId });
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * Background message handler specifically for Google Drive sync logic and CDP picking.
 * Listens for \`cdp_pick_element\` messages from the content script and resolves them.
 *
 * @param request The message payload from the content script.
 * @param sender Information about the message sender.
 * @param sendResponse Callback function to send the response back.
 * @returns \`true\` if responding asynchronously, otherwise undefined.
 */
export function handleDriveMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
  if (request.action === 'cdp_pick_element') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'no_tab' });
      return true;
    }
    const { x, y } = request;
    pickElementViaCdp(tabId, Number(x), Number(y))
      .then(result => {
        if (!result?.selector) {
          sendResponse({ ok: false, error: 'no_selector' });
          return;
        }
        sendResponse({ ok: true, ...result });
      })
      .catch(error => {
        console.error('[Background] cdp_pick_element error:', error);
        sendResponse({ ok: false, error: String(error) });
      });
    return true; // Keep channel open
  }

  return undefined;
}
