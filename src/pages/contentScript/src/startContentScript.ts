import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebsiteSnippetInjector } from './website-snippet-injection/ListenForSnippetSlashCommand';
import { ImageDownloader } from './ImageDownloader';
import type { NoteItem, PopupPosition, SupportedInputElement } from './types';
import { buildHotkeyString, normalizeHotkeyString } from '../../../shared-components/hotkeys';
import {
  evaluateAst,
  RuntimeContext,
  scanAstForFields,
  type FieldNode,
  type DropdownFieldConfig,
  type ToggleFieldConfig,
  type ASTNode,
} from '@extension/shared';

let hasStarted = false;
export function startContentScript() {
  if (hasStarted) return;
  hasStarted = true;







let currentTabId: number | undefined;
chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, id => {
  currentTabId = id;
});

// Listen for messages from the web application (e.g. login success)
window.addEventListener('message', event => {
  if (event.source !== window) return;

  if (event.data && event.data.type === 'CMDOS_LOGIN_SUCCESS') {
    const token = event.data.token;
    chrome.runtime.sendMessage({ action: 'login_success', token }, response => {
      console.log('[Content Script] Forwarded login token to extension background', response);
    });
  }

  if (event.data && event.data.type === 'TASKLABS_DOWNLOAD_IMAGE') {
    const { dataUrl, filename } = event.data;
    console.log('[Content Script] Bridge intercepted TASKLABS_DOWNLOAD_IMAGE event:', { filename, dataUrlPrefix: dataUrl?.substring(0, 100) });
    chrome.runtime.sendMessage({
      action: 'TASKLABS_DOWNLOAD_IMAGE',
      url: dataUrl,
      filename: filename
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('[Content Script] Forwarding TASKLABS_DOWNLOAD_IMAGE failed:', chrome.runtime.lastError);
      } else {
        console.log('[Content Script] Forwarded TASKLABS_DOWNLOAD_IMAGE response:', response);
      }
    });
  }
});

// Initialize global hotkey controller

new WebsiteSnippetInjector();



// Initialize image downloader

new ImageDownloader();

/**
 * Visual Element Picker for Automation
 *
 * Robust selector generation — NO CDP debugger needed for selection.
 * Uses content-script introspection with uniqueness validation.
 * CDP is only used during automation execution.
 */
class ElementPicker {
  private active = false;
  private overlay: HTMLDivElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private hoveredElement: HTMLElement | null = null;
  private isReadyForCapture = false;
  private discoveredElements: HTMLElement[] = [];
  private labelsContainer: HTMLDivElement | null = null;
  private inputBuffer = '';
  private inputTimeout: any = null;
  private labelColors = ['#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];
  private recordingType: 'click' | 'paste' | null = null;

  start() {
    if (this.active) return;
    this.active = true;
    this.isReadyForCapture = false;

    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('pointerdown', this.handlePointerDown, true);
    document.addEventListener('click', this.handleClick, true);
    window.addEventListener('scroll', this.handleScroll, true);
    window.addEventListener('resize', this.handleResize, true);

    this.createOverlay();
    // this.createHighlightOverlay(); // Disable mouse-following highlight to reduce clutter

    // Fetch recording type from storage
    chrome.storage.local.get('automation_recording_state', res => {
      this.recordingType = res.automation_recording_state?.type || 'click';
      this.discoverElements();
      this.updateOverlayInstructions();
    });
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('scroll', this.handleScroll, true);
    window.removeEventListener('resize', this.handleResize, true);
    this.hoveredElement = null;
    this.removeOverlay();
    this.removeHighlightOverlay();
    this.clearLabels();
    this.inputBuffer = '';
    if (this.inputTimeout) clearTimeout(this.inputTimeout);
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.isReadyForCapture = true;
  };

  private handleScroll = () => {
    this.updateLabelPositions();
  };

  private handleResize = () => {
    this.discoverElements();
  };

  private clearLabels() {
    if (this.labelsContainer) {
      this.labelsContainer.remove();
      this.labelsContainer = null;
    }
  }

  private discoverElements() {
    this.clearLabels();
    this.discoveredElements = [];

    let selector = '';
    if (this.recordingType === 'paste') {
      // Filter for typeable areas: inputs, textareas, contenteditables
      const typeableTags = [
        'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"])',
        'textarea',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '[role="combobox"]',
      ];
      selector = typeableTags.join(',');
    } else {
      // Default: all interactive elements
      const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'label', 'summary', 'details'];
      const interactiveRoles = [
        'button',
        'link',
        'textbox',
        'combobox',
        'option',
        'menuitem',
        'tab',
        'checkbox',
        'radio',
      ];
      selector = interactiveTags.join(',') + ',' + interactiveRoles.map(r => `[role="${r}"]`).join(',');
    }

    const potentials = document.querySelectorAll(selector);

    const visibleResults: HTMLElement[] = [];
    potentials.forEach(el => {
      const htmlEl = el as HTMLElement;
      // Skip our own interface
      if (this.overlay?.contains(htmlEl) || this.labelsContainer?.contains(htmlEl)) return;

      const rect = htmlEl.getBoundingClientRect();
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth
      ) {
        // Final check for visibility
        const style = window.getComputedStyle(htmlEl);
        if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1) {
          visibleResults.push(htmlEl);
        }
      }
    });

    // Sort: top to bottom, then left to right
    this.discoveredElements = visibleResults
      .sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        if (Math.abs(ra.top - rb.top) < 10) return ra.left - rb.left;
        return ra.top - rb.top;
      })
      .slice(0, 99); // Limit to 99 elements for multi-digit sanity

    this.renderLabels();
  }

  private renderLabels() {
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.id = 'tasklabs-labels-container';
    Object.assign(this.labelsContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483645',
    });
    document.body.appendChild(this.labelsContainer);

    this.discoveredElements.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const label = document.createElement('div');
      const color = this.labelColors[i % this.labelColors.length];

      label.className = 'tasklabs-element-label';
      label.dataset.index = (i + 1).toString();
      Object.assign(label.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        padding: '2px 4px',
        backgroundColor: color,
        color: 'black',
        borderRadius: '5px',
        fontSize: '11px',
        lineHeight: '1',
        fontWeight: '900',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        zIndex: '2147483646',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '18px',
        border: '1px solid rgba(0,0,0,0.2)',
        pointerEvents: 'auto', // Allow clicking the label
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
      });
      label.textContent = (i + 1).toString();
      label.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.selectElement(el);
      };
      this.labelsContainer?.appendChild(label);

      // Add a border around the interactive element as well
      const border = document.createElement('div');
      border.className = 'tasklabs-element-border';
      border.dataset.index = (i + 1).toString();
      Object.assign(border.style, {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `2px solid ${color}`,
        backgroundColor: `${color}0D`, // Very light overlay (~5% opacity)
        borderRadius: '5px',
        zIndex: '2147483645',
        pointerEvents: 'none',
        transition: 'transform 0.1s, border-width 0.1s, box-shadow 0.1s',
      });
      this.labelsContainer?.appendChild(border);
    });
  }

  private updateLabelPositions() {
    if (!this.labelsContainer) return;
    const labels = this.labelsContainer.querySelectorAll('.tasklabs-element-label');
    labels.forEach(l => {
      const label = l as HTMLDivElement;
      const idx = parseInt(label.dataset.index || '1', 10);
      const el = this.discoveredElements[idx - 1];
      if (el) {
        const rect = el.getBoundingClientRect();
        // Check if still visible
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          label.style.top = `${rect.top}px`;
          label.style.left = `${rect.left}px`;
          label.style.display = 'flex';
        } else {
          label.style.display = 'none';
        }
      }
    });

    const borders = this.labelsContainer.querySelectorAll('.tasklabs-element-border');
    borders.forEach(b => {
      const border = b as HTMLDivElement;
      const idx = parseInt(border.dataset.index || '1', 10);
      const el = this.discoveredElements[idx - 1];
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          Object.assign(border.style, {
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            display: 'block',
          });
        } else {
          border.style.display = 'none';
        }
      }
    });
  }

  private createOverlay() {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      padding: '16px 24px',
      backgroundColor: '#1f2937',
      color: 'white',
      borderRadius: '12px',
      zIndex: '2147483647',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
      border: '1px solid #374151',
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      animation: 'tasklabs-slide-up 0.3s ease-out',
    });

    const style = document.createElement('style');
    style.id = 'tasklabs-picker-styles';
    style.textContent = `
      @keyframes tasklabs-slide-up {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes tasklabs-pulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    this.updateOverlayInstructions();
    document.body.appendChild(this.overlay);
  }

  private updateOverlayInstructions() {
    if (!this.overlay) return;
    const bufferText = this.inputBuffer
      ? `<div style="color: #fbbf24; font-weight: 800; font-family: monospace; font-size: 18px; margin-top: 4px;">Selecting: ${this.inputBuffer}_</div>`
      : '';

    const actionText =
      this.recordingType === 'paste' ? 'Select a <b>Text Field</b> to Paste' : 'Select an <b>Element</b> to Click';

    this.overlay.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 8px; height: 8px; background-color: #ef4444; border-radius: 50%; animation: tasklabs-pulse 1.5s infinite;"></div>
        <div>${actionText}.</div>
      </div>
      <div>Type <b>Number</b> or <b>Click</b> the target.</div>
      <div>Press <span style="background: #374151; padding: 2px 6px; border-radius: 4px; font-family: monospace;">Esc</span> to cancel.</div>
      ${bufferText}
    `;
  }

  private createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'tasklabs-picker-highlight';
    Object.assign(this.highlightOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      border: '2px solid #8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.08)',
      borderRadius: '4px',
      zIndex: '2147483646',
      transition: 'top 0.05s, left 0.05s, width 0.05s, height 0.05s',
      display: 'none',
    });
    document.body.appendChild(this.highlightOverlay);
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    const style = document.getElementById('tasklabs-picker-styles');
    if (style) style.remove();
  }

  private removeHighlightOverlay() {
    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }
  }

  /**
   * Use mousemove instead of mouseover for more reliable element detection.
   * mouseover can be stopped by stopPropagation in the page's own handlers,
   * but mousemove with document.elementFromPoint bypasses that.
   */
  private handleMouseMove = (e: MouseEvent) => {
    // Use elementFromPoint to get the actual element under the cursor,
    // bypassing any event.stopPropagation() the page might do.
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    if (!target) return;
    if (target === this.overlay || this.overlay?.contains(target)) return;
    if (target === this.highlightOverlay) return;
    if (target === this.hoveredElement) return;

    this.hoveredElement = target;

    // Mouse-following highlight is disabled in hint mode to prevent clutter
    /*
    if (this.highlightOverlay) {
      const resolved = this.getInteractiveParent(target);
      const rect = resolved.getBoundingClientRect();
      Object.assign(this.highlightOverlay.style, {
        display: 'block',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }
    */
  };

  private getElementName(el: HTMLElement): string {
    // 1. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 2. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelEl = document.getElementById(labelledBy);
      if (labelEl?.textContent) return labelEl.textContent.trim();
    }

    // 3. Associated <label> via for/id
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label?.textContent) return label.textContent.trim();
    }

    // 4. Wrapping <label>
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, textarea, select').forEach(c => c.remove());
      const text = clone.textContent?.trim();
      if (text) return text;
    }

    // 5. name attribute
    const nameAttr = el.getAttribute('name');
    if (nameAttr) return nameAttr;

    // 6. placeholder / editor placeholder
    const placeholder =
      el.getAttribute('placeholder') ||
      el.getAttribute('data-empty-text') ||
      el.getAttribute('data-placeholder') ||
      el.getAttribute('aria-placeholder');
    if (placeholder) return placeholder;

    // 6b. contenteditable placeholder descendants (ProseMirror, Tiptap, Slate, Linear)
    if (
      el.isContentEditable ||
      el.getAttribute('contenteditable') === 'true' ||
      el.getAttribute('role') === 'textbox' ||
      el.getAttribute('role') === 'combobox'
    ) {
      const placeholderNode = el.querySelector?.(
        '[data-empty-text], [data-placeholder], [aria-placeholder], .editor-placeholder, [data-placeholder-text]',
      ) as HTMLElement | null;
      const derived =
        placeholderNode?.getAttribute('data-empty-text') ||
        placeholderNode?.getAttribute('data-placeholder') ||
        placeholderNode?.getAttribute('aria-placeholder') ||
        placeholderNode?.getAttribute('data-placeholder-text') ||
        placeholderNode?.textContent?.trim();
      if (derived) return derived;
    }

    // 7. title
    const titleAttr = el.getAttribute('title');
    if (titleAttr) return titleAttr;

    return '';
  }

  private selectElement(interactiveTarget: HTMLElement) {
    const pageUrl = window.location.href;
    this.stop();

    const selector = this.robustGetSelector(interactiveTarget);
    const elementName = this.getElementName(interactiveTarget);
    const nameFallback =
      interactiveTarget.innerText?.trim().split('\n')[0].substring(0, 40) ||
      (interactiveTarget as HTMLInputElement).placeholder ||
      interactiveTarget.getAttribute('data-empty-text') ||
      interactiveTarget.getAttribute('data-placeholder') ||
      interactiveTarget.getAttribute('aria-placeholder') ||
      interactiveTarget.title ||
      interactiveTarget.id ||
      interactiveTarget.tagName.toLowerCase();
    const name = elementName || nameFallback;
    chrome.storage.local.get('automation_recording_state', (res: any) => {
      const state = res.automation_recording_state;
      if (state?.active) {
        chrome.storage.local.set(
          {
            automation_recorded_selector: {
              stepId: state.stepId,
              selector: selector,
              pageUrl: pageUrl,
              elementName: elementName,
              url: window.location.href,
              name,
              iconHost: window.location.hostname,
              timestamp: Date.now(),
            },
            automation_recording_state: null,
          },
          () => {},
        );
      } else {
        console.warn('[ElementPicker] Capture failed: No active recording state found in storage.');
      }
    });
  }

  private handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!this.isReadyForCapture) {
      return;
    }

    // Use elementFromPoint for the most accurate target
    const rawTarget = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    const target = rawTarget || (e.target as HTMLElement);
    const interactiveTarget = this.getInteractiveParent(target);
    this.selectElement(interactiveTarget);
  };

  private highlightMatchingLabels() {
    if (!this.labelsContainer) return;
    const labels = this.labelsContainer.querySelectorAll('.tasklabs-element-label');
    labels.forEach(l => {
      const label = l as HTMLDivElement;
      const idx = label.textContent || '';
      if (this.inputBuffer && idx === this.inputBuffer) {
        label.style.transform = 'scale(1.8)';
        label.style.boxShadow = '0 0 20px #fbbf24, 0 0 40px #fbbf24';
        label.style.zIndex = '2147483647';
        label.style.border = '2px solid white';
      } else if (this.inputBuffer && idx.startsWith(this.inputBuffer)) {
        label.style.transform = 'scale(1.3)';
        label.style.boxShadow = '0 0 10px rgba(255,255,255,0.8)';
        label.style.zIndex = '2147483647';
      } else {
        label.style.transform = 'scale(1)';
        label.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.2)';
        label.style.zIndex = '2147483646';
        label.style.border = '1px solid rgba(0,0,0,0.2)';
      }
    });

    const borders = this.labelsContainer.querySelectorAll('.tasklabs-element-border');
    borders.forEach(b => {
      const border = b as HTMLDivElement;
      const idx = border.dataset.index || '';
      if (this.inputBuffer && idx === this.inputBuffer) {
        border.style.borderWidth = '4px';
        border.style.boxShadow = '0 0 15px currentColor';
        border.style.zIndex = '2147483647';
        border.style.backgroundColor = 'rgba(255,255,255,0.1)';
      } else if (this.inputBuffer && idx.startsWith(this.inputBuffer)) {
        border.style.borderWidth = '3px';
        border.style.zIndex = '2147483647';
        border.style.backgroundColor = 'rgba(255,255,255,0.05)';
      } else {
        border.style.borderWidth = '2px';
        border.style.boxShadow = 'none';
        border.style.zIndex = '2147483645';
        border.style.backgroundColor = 'rgba(0,0,0,0.02)';
      }
    });
  }

  private processInputBuffer() {
    const idx = parseInt(this.inputBuffer, 10) - 1;
    if (idx >= 0 && idx < this.discoveredElements.length) {
      this.selectElement(this.discoveredElements[idx]);
    } else {
      this.inputBuffer = '';
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();
    }
    if (this.inputTimeout) clearTimeout(this.inputTimeout);
    this.inputTimeout = null;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      chrome.storage.local.set({ automation_recording_state: null });
      this.stop();
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      if (this.inputTimeout) clearTimeout(this.inputTimeout);
      this.inputBuffer += e.key;
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();

      // Check if this is a unique prefix
      const matches = this.discoveredElements.filter((_, i) => (i + 1).toString().startsWith(this.inputBuffer));
      if (matches.length === 1 && (this.discoveredElements.indexOf(matches[0]) + 1).toString() === this.inputBuffer) {
        // Only one possible match and it's an exact match -> select immediately
        this.processInputBuffer();
      } else if (matches.length === 0) {
        // No matches at all -> reset
        this.inputBuffer = '';
        this.updateOverlayInstructions();
        this.highlightMatchingLabels();
      } else {
        // Multiple possibilities (e.g. 2, 21, 22) -> wait for more input or Enter
        this.inputTimeout = setTimeout(() => {
          this.processInputBuffer();
        }, 1000);
      }
    } else if (e.key === 'Enter' && this.inputBuffer) {
      this.processInputBuffer();
    } else if (e.key === 'Backspace' && this.inputBuffer) {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.updateOverlayInstructions();
      this.highlightMatchingLabels();
    }
  };

  // ── Interactive parent resolution ──────────────────────────────────────

  private getInteractiveParent(el: HTMLElement): HTMLElement {
    // Placeholder → editor snap
    const placeholderHint =
      el.getAttribute?.('data-empty-text') ||
      el.getAttribute?.('data-placeholder') ||
      el.getAttribute?.('aria-placeholder') ||
      el.getAttribute?.('data-placeholder-text') ||
      (el.classList && el.classList.contains('editor-placeholder'));

    if (placeholderHint) {
      const editor = el.closest('[contenteditable="true"], [role="textbox"], [role="combobox"]') as HTMLElement | null;
      if (editor) return editor;
    }

    const interactiveTags = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY', 'DETAILS', 'LABEL']);
    const interactiveRoles = new Set([
      'button',
      'link',
      'textbox',
      'combobox',
      'option',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'tab',
      'switch',
      'checkbox',
      'radio',
      'slider',
      'spinbutton',
      'searchbox',
    ]);

    // Only walk up for leaf elements (icons, text spans, etc.)
    const leafTags = new Set([
      'SVG',
      'PATH',
      'CIRCLE',
      'RECT',
      'LINE',
      'POLYLINE',
      'POLYGON',
      'ELLIPSE',
      'G',
      'USE',
      'SPAN',
      'I',
      'EM',
      'STRONG',
      'B',
      'IMG',
      'SMALL',
      'SUB',
      'SUP',
      'BR',
      'WBR',
    ]);

    if (!leafTags.has(el.tagName) && !placeholderHint) {
      return el;
    }

    let current: HTMLElement | null = el;
    while (current && current.tagName !== 'BODY' && current !== document.documentElement) {
      if (
        interactiveTags.has(current.tagName) ||
        interactiveRoles.has(current.getAttribute('role') || '') ||
        current.isContentEditable ||
        current.getAttribute('contenteditable') === 'true' ||
        current.hasAttribute('tabindex') ||
        current.onclick ||
        current.hasAttribute('data-testid')
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  // ── Robust selector generator ──────────────────────────────────────────
  // This is the heart of the fix. Instead of building fragile CSS paths by
  // walking up the tree and appending tag.class:nth-child at every level,
  // we try attribute-based selectors first and validate uniqueness with
  // querySelectorAll. This is exactly what professional selector tools do.

  private cssEscape(s: string): string {
    if (!s) return '';
    return s.replace(/"/g, '\\"');
  }

  private isUnique(sel: string): boolean {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  }

  private isDynamicClass(c: string): boolean {
    if (!c || c.length === 0) return true;
    // CSS-modules / styled-components / emotion / linaria hashes
    if (/^(css|sc|jss|style|emotion|styled|__)-/i.test(c)) return true;
    // Pure hex/alphanum hashes (8+ chars of just letters/digits, no hyphens/underscores)
    if (/^[a-z0-9]{8,}$/i.test(c)) return true;
    // class_hash patterns like "class_abc12de"
    if (/^[a-z]+_[a-z0-9]{5,}$/i.test(c)) return true;
    // Utility with colons or brackets
    if (c.includes(':') || c.includes('[') || c.includes('\\')) return true;
    return false;
  }

  private isStateClass(c: string): boolean {
    const low = c.toLowerCase();
    const statePatterns = [
      /^is[-_]/,
      /^has[-_]/,
      /[-_](focus|hover|active|pressed|dragging|dropping)$/,
      /^(focused|hovered|activated|pressed|dragging|dropping|animating)$/,
    ];
    return statePatterns.some(p => p.test(low));
  }

  /** Try to build a short, unique selector from element attributes alone */
  private tryAttributeSelector(el: HTMLElement): string | null {
    const tag = el.tagName.toLowerCase();

    // 1. Test IDs & semantic data attributes (highest priority)
    const highPriAttrs = ['data-testid', 'data-cy', 'data-qa', 'data-test', 'data-automation-id', 'data-automation'];
    for (const attr of highPriAttrs) {
      const v = el.getAttribute(attr);
      if (v) {
        const sel = `[${attr}="${this.cssEscape(v)}"]`;
        if (this.isUnique(sel)) return sel;
        const tagSel = `${tag}${sel}`;
        if (this.isUnique(tagSel)) return tagSel;
      }
    }

    // 2. Stable ID
    if (el.id && !/^[a-f0-9]{8,}$/i.test(el.id) && !/^\d/.test(el.id) && !/^:/.test(el.id)) {
      const sel = `#${CSS.escape(el.id)}`;
      if (this.isUnique(sel)) return sel;
    }

    // 3. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      const sel = `[aria-label="${this.cssEscape(ariaLabel)}"]`;
      if (this.isUnique(sel)) return sel;
      const tagSel = `${tag}${sel}`;
      if (this.isUnique(tagSel)) return tagSel;
    }

    // 4. name attribute
    const name = el.getAttribute('name');
    if (name && !/^[0-9]/.test(name)) {
      const sel = `${tag}[name="${this.cssEscape(name)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 5. placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      const sel = `${tag}[placeholder="${this.cssEscape(placeholder)}"]`;
      if (this.isUnique(sel)) return sel;
      const noTag = `[placeholder="${this.cssEscape(placeholder)}"]`;
      if (this.isUnique(noTag)) return noTag;
    }

    // 6. role + aria combo
    const role = el.getAttribute('role');
    if (role && ariaLabel) {
      const sel = `[role="${this.cssEscape(role)}"][aria-label="${this.cssEscape(ariaLabel)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 7. input type
    const type = el.getAttribute('type');
    if (type && tag === 'input') {
      const sel = `input[type="${this.cssEscape(type)}"]`;
      if (this.isUnique(sel)) return sel;
    }

    // 8. contenteditable combos
    if (el.getAttribute('contenteditable') === 'true') {
      if (role) {
        const sel = `[role="${this.cssEscape(role)}"][contenteditable="true"]`;
        if (this.isUnique(sel)) return sel;
      }
      if (ariaLabel) {
        const sel = `[contenteditable="true"][aria-label="${this.cssEscape(ariaLabel)}"]`;
        if (this.isUnique(sel)) return sel;
      }
      const dp = el.getAttribute('data-placeholder');
      if (dp) {
        const sel = `[contenteditable="true"][data-placeholder="${this.cssEscape(dp)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 9. href for links
    if (tag === 'a') {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('javascript:') && href !== '#') {
        const sel = `a[href="${this.cssEscape(href)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 10. label[for]
    if (tag === 'label') {
      const forAttr = el.getAttribute('for');
      if (forAttr) {
        const sel = `label[for="${this.cssEscape(forAttr)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    // 11. Custom data-* attributes (Linear, Notion, etc.)
    const allAttrs = Array.from(el.attributes || []);
    for (const attr of allAttrs) {
      if (attr.name.startsWith('data-') && !highPriAttrs.includes(attr.name)) {
        if (attr.value.length > 80) continue;
        if (/^\d+$/.test(attr.value)) continue;
        const sel = `[${attr.name}="${this.cssEscape(attr.value)}"]`;
        if (this.isUnique(sel)) return sel;
      }
    }

    return null;
  }

  /**
   * Build the robust selector for an element.
   * Uses attribute shortcuts with uniqueness checks to produce the shortest
   * unique selector possible — just like professional selector tools.
   */
  private robustGetSelector(el: HTMLElement): string {
    if (!el || el === document.body || el === document.documentElement) return '';
    if (el.tagName === 'BODY') return 'body';
    if (el.tagName === 'HTML') return 'html';

    // ── Fast path: attribute-only selector ──
    const shortcut = this.tryAttributeSelector(el);
    if (shortcut) return shortcut;

    // ── Build a segment for this element ──
    let segment = el.tagName.toLowerCase();

    // Add stable classes
    const stableClasses = Array.from(el.classList || []).filter(c => !this.isDynamicClass(c) && !this.isStateClass(c));

    if (stableClasses.length > 0) {
      const classStr = stableClasses
        .slice(0, 2)
        .map(c => '.' + CSS.escape(c))
        .join('');
      const candidate = segment + classStr;
      if (this.isUnique(candidate)) return candidate;
      segment = candidate;
    }

    // Add nth-child for disambiguation
    const parent = el.parentElement;
    if (parent) {
      const sameTags = Array.from(parent.children).filter(s => s.tagName === el.tagName);
      if (sameTags.length > 1) {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        segment += `:nth-child(${idx})`;
      }
    }

    if (this.isUnique(segment)) return segment;

    // ── Walk up: try parent attribute shortcut first ──
    if (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
      const parentShortcut = this.tryAttributeSelector(parent);
      if (parentShortcut) {
        const combined = `${parentShortcut} > ${segment}`;
        if (this.isUnique(combined)) return combined;
        const loose = `${parentShortcut} ${segment}`;
        if (this.isUnique(loose)) return loose;
      }

      // Try grandparent
      const grandparent = parent.parentElement;
      if (grandparent && grandparent.tagName !== 'BODY') {
        const gpShortcut = this.tryAttributeSelector(grandparent);
        if (gpShortcut) {
          // Build parent segment
          let parentSeg = parent.tagName.toLowerCase();
          const parentSameTags = Array.from(grandparent.children).filter(s => s.tagName === parent.tagName);
          if (parentSameTags.length > 1) {
            const pidx = Array.from(grandparent.children).indexOf(parent) + 1;
            parentSeg += `:nth-child(${pidx})`;
          }
          const combined = `${gpShortcut} > ${parentSeg} > ${segment}`;
          if (this.isUnique(combined)) return combined;
          const loose = `${gpShortcut} ${segment}`;
          if (this.isUnique(loose)) return loose;
        }
      }

      // Recurse up the full tree
      const parentPath = this.robustGetSelector(parent);
      if (parentPath) {
        return `${parentPath} > ${segment}`;
      }
    }

    return segment;
  }
}

const elementPicker = new ElementPicker();
// Listen for storage changes to trigger the element picker automatically
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.automation_recording_state?.newValue?.active) {
    const newState = changes.automation_recording_state.newValue;

    // Only trigger picker if explicitly in select_mode
    if (newState.select_mode !== true) {
      return;
    }
    if (newState.targetTabId && currentTabId && newState.targetTabId !== currentTabId) {
      return;
    }
    elementPicker.start();
  }
});

class GlobalHotkeyController {
  private hotkeysMap: Record<string, { id: string, type: string }> = {};
  private isLoading = false;

  constructor() {
    this.loadHotkeys();
    this.setupKeydownListener();
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'RELOAD_HOTKEYS') {
        this.loadHotkeys();
      }
    });
  }

  private async loadHotkeys(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const response = await new Promise<any>((resolve, reject) => {
        if (!chrome?.runtime?.sendMessage) {
          resolve({});
          return;
        }
        chrome.runtime.sendMessage({ action: 'GET_ALL_HOTKEYS' }, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(res || {});
          }
        });
      });

      // Normalize keys up front for O(1) lookup
      this.hotkeysMap = {};
      if (response.hotkeysMap) {
        Object.entries(response.hotkeysMap).forEach(([combination, data]) => {
          this.hotkeysMap[normalizeHotkeyString(String(combination))] = data as { id: string, type: string };
        });
      }
    } catch (error) {
      console.error('[GlobalHotkey] Failed to load hotkeys:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private setupKeydownListener(): void {
    window.addEventListener(
      'keydown',
      (event: any) => {
        // IGNORE AUTOMATION EVENTS: Prevent extension hotkeys from triggering during automation
        // We check both the event property and the global window flag for maximum reliability
        if (event.isAutomation || (window as any).__tasklabs_automation_active) {
          return;
        }

        if (!event.altKey && !event.ctrlKey && !event.metaKey) return;
        if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(event.key)) return;

        const isMac = navigator.userAgent.indexOf('Mac OS X') !== -1;
        const rawHotkey = buildHotkeyString(event, isMac) || '';
        const pressedHotkey = normalizeHotkeyString(rawHotkey);

        // O(1) Match
        const matched = this.hotkeysMap[pressedHotkey];
        if (matched) {
          // Send original type (note, link, snippet, command, automation, module)
          this.triggerHotkey(matched.type, matched.id, event);
          return;
        }
      },
      true,
    );
  }

  private triggerHotkey(type: string, id: string, event: KeyboardEvent) {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    chrome.runtime.sendMessage({
      action: 'trigger_hotkey',
      type,
      id,
    });
  }
}

new GlobalHotkeyController();
}
