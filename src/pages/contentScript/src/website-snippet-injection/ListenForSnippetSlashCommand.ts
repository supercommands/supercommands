import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import InjectedSnippetDropdownUI from './InjectedSnippetDropdownUI';
import type { NoteItem, PopupPosition, SupportedInputElement } from '../types';
import {
  evaluateAst,
  RuntimeContext,
  scanAstForFields,
  type FieldNode,
  type DropdownFieldConfig,
  type ToggleFieldConfig,
  type ASTNode,
} from '@extension/shared';

type TriggerContext =
  | {
      type: 'input';
      element: HTMLInputElement | HTMLTextAreaElement;
      selectionStart: number;
    }
  | {
      type: 'contentEditable';
      element: HTMLElement;
      slashRange: Range;
    }
  | {
      type: 'googleDocs';
      iframe: HTMLIFrameElement;
      caretRange: Range;
    }
  | {
      type: 'googleSheets';
      element: HTMLInputElement | HTMLTextAreaElement;
      selectionStart: number;
    };

const isTextInput = (element: HTMLInputElement) => {
  const allowedTypes = ['text', 'search', 'email', 'url', 'tel', 'password', 'number'];
  return allowedTypes.includes(element.type);
};

const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  const temp = document.createElement('div');
  temp.innerHTML = html;

  let text = '';

  const getTextWithStructure = (node: Node, context: { inOrderedList?: boolean; listIndex?: number } = {}) => {
    // Handle Text Nodes
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent || '';
      // We don't trim completely because space between inline elements matters
      // But we can collapse multiple spaces
      text += content.replace(/[ \t]{2,}/g, ' ');
      return;
    }

    // Handle Element Nodes
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // Block elements that should trigger a newline
      // Added 'tr' for table rows to behave like blocks
      const isBlock = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'ul', 'ol', 'tr'].includes(tagName);
      const isListItem = tagName === 'li';

      // Prefix for list items
      if (isListItem) {
        if (context.inOrderedList) {
          text += `${context.listIndex}. `;
        } else {
          text += '• ';
        }
      }

      // Handle children
      if (tagName === 'ol') {
        let index = 1;
        el.childNodes.forEach(child => {
          if (child.nodeName.toLowerCase() === 'li') {
            getTextWithStructure(child, { inOrderedList: true, listIndex: index++ });
          } else {
            getTextWithStructure(child, context);
          }
        });
      } else if (tagName === 'ul') {
        el.childNodes.forEach(child => {
          if (child.nodeName.toLowerCase() === 'li') {
            getTextWithStructure(child, { inOrderedList: false });
          } else {
            getTextWithStructure(child, context);
          }
        });
      } else {
        // Normal recursion
        el.childNodes.forEach(child => {
          getTextWithStructure(child, context);
        });
      }

      // Append newline after block elements
      // But avoid double newlines if the block ends with one already (simple heuristic)
      if (isBlock) {
        if (!text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
  };

  getTextWithStructure(temp);

  return (
    text
      .replace(/\r/g, '')
      .replace(/&nbsp;/g, ' ')
      // Collapse 3+ newlines to 2
      .replace(/\n{3,}/g, '\n\n')
      // Trim result
      .trim()
  );
};

const buildPreview = (text: string) => {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 90 ? `${compact.slice(0, 90)}…` : compact;
};

// ============================================
// Dynamic Variable Helpers
// ============================================

/**
 * Detect all {{variable}} patterns in text
 */
const detectVariables = (text: string): string[] => {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = variableRegex.exec(text)) !== null) {
    const variableName = match[1].trim();
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }
  return variables;
};

/**
 * Format a date like "16th December 2025"
 */
const formatDate = (date: Date): string => {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${day}${suffix} ${month} ${year}`;
};

/**
 * Format time like "3:45 PM"
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Special variables that are auto-resolved without user input
 */
const specialVariableResolvers: Record<string, () => string> = {
  current_date: () => formatDate(new Date()),
  next_day: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  },
  next_week: () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDate(d);
  },
  current_time: () => formatTime(new Date()),
  current_year: () => new Date().getFullYear().toString(),
  current_month: () => new Date().toLocaleString('default', { month: 'long' }),
  next_month: () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString('default', { month: 'long' });
  },
};

/**
 * Resolve all special variables in text
 */
const resolveSpecialVariables = (text: string): string => {
  let result = text;
  for (const [varName, resolver] of Object.entries(specialVariableResolvers)) {
    const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, resolver());
  }
  return result;
};

/**
 * Check if a variable name is a special auto-resolved variable
 */
const isSpecialVariable = (varName: string): boolean => {
  return varName.toLowerCase() in specialVariableResolvers;
};

// Slight offset so the popup appears lower on the page and avoids overlapping host UI.
const POPUP_VERTICAL_OFFSET = 36;

const CARET_MIRROR_PROPS = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

const getInputCaretPosition = (
  element: HTMLInputElement | HTMLTextAreaElement,
  selectionStart: number,
): PopupPosition | null => {
  if (typeof selectionStart !== 'number' || selectionStart < 0) return null;
  const doc = element.ownerDocument;
  const win = doc?.defaultView ?? window;
  if (!doc) return null;

  const mirrorDiv = doc.createElement('div');
  const mirrorSpan = doc.createElement('span');
  const computed = win.getComputedStyle(element);
  const isInputElement = element instanceof HTMLInputElement && !(element instanceof HTMLTextAreaElement);

  mirrorDiv.style.position = 'absolute';
  mirrorDiv.style.top = '0';
  mirrorDiv.style.left = '-9999px';
  mirrorDiv.style.visibility = 'hidden';
  mirrorDiv.style.whiteSpace = isInputElement ? 'pre' : 'pre-wrap';
  mirrorDiv.style.wordWrap = 'break-word';
  mirrorDiv.style.pointerEvents = 'none';

  CARET_MIRROR_PROPS.forEach(prop => {
    const value = computed.getPropertyValue(prop);
    if (value) {
      mirrorDiv.style.setProperty(prop, value);
    }
  });

  // For inputs we need to explicitly set width to allow horizontal measuring.
  if (isInputElement) {
    mirrorDiv.style.width = `${element.scrollWidth}px`;
  }

  const beforeValue = element.value.substring(0, selectionStart);
  const afterValue = element.value.substring(selectionStart) || '.';
  mirrorDiv.textContent = beforeValue;
  mirrorSpan.textContent = afterValue;
  mirrorDiv.appendChild(mirrorSpan);
  doc.body.appendChild(mirrorDiv);

  mirrorDiv.scrollTop = element.scrollTop;
  mirrorDiv.scrollLeft = element.scrollLeft;

  const mirrorRect = mirrorDiv.getBoundingClientRect();
  const spanRect = mirrorSpan.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  let caretHeight =
    spanRect.height ||
    parseFloat(computed.lineHeight || '') ||
    parseFloat(computed.fontSize || '') ||
    elementRect.height ||
    16;

  if (!Number.isFinite(caretHeight)) caretHeight = 16;

  const leftOffset = spanRect.left - mirrorRect.left;
  const topOffset = spanRect.top - mirrorRect.top;

  const x = elementRect.left + leftOffset - element.scrollLeft + win.scrollX;
  const y = elementRect.top + topOffset - element.scrollTop + caretHeight + 6 + win.scrollY;

  doc.body.removeChild(mirrorDiv);

  return {
    x,
    y,
    caretHeight,
  };
};

const extractTabsValue = (value: any): string => {
  if (!value || typeof value !== 'object') return '';
  const urls = Array.isArray(value.urls) ? value.urls : [];
  if (!urls.length) return JSON.stringify(value);
  return urls
    .map((url: unknown) => (typeof url === 'string' ? url : ''))
    .filter(Boolean)
    .join('\n');
};

const isRawTagId = (tag: string): boolean => {
  if (!tag || typeof tag !== 'string') return true;
  const trimmed = tag.trim();
  if (/^TAG_/i.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  return false;
};

const normalizeSnippetTags = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(tag => {
      if (!tag) return null;
      if (typeof tag === 'object' && typeof (tag as { name?: unknown }).name === 'string') {
        const name = ((tag as { name: string }).name || '').trim();
        if (name && !isRawTagId(name)) return name;
      }
      if (typeof tag === 'object' && typeof (tag as { label?: unknown }).label === 'string') {
        const label = ((tag as { label: string }).label || '').trim();
        if (label && !isRawTagId(label)) return label;
      }
      if (typeof tag === 'string') {
        const str = tag.trim();
        if (str && !isRawTagId(str)) return str;
      }
      return null;
    })
    .filter((tag): tag is string => Boolean(tag && tag.trim()));
};

const buildNoteFromSnippet = (snippet: any): NoteItem | null => {
  if (!snippet || typeof snippet !== 'object') return null;

  const rawId = typeof snippet.id === 'string' && snippet.id.trim().length > 0 ? snippet.id.trim() : null;
  const rawSnippetId =
    typeof snippet.snippet_id === 'string' && snippet.snippet_id.trim().length > 0 ? snippet.snippet_id.trim() : null;
  const id = rawId || rawSnippetId;

  const key =
    typeof snippet.key === 'string' && snippet.key.trim().length > 0 ? snippet.key.trim() : id || 'Untitled note';

  const rawValue = snippet.value;
  let value: string;
  if (typeof rawValue === 'string') {
    if (rawValue.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawValue);
        if (typeof parsed.url === 'string') {
          value = parsed.url;
        } else if (Array.isArray(parsed.urls)) {
          value = extractTabsValue(parsed);
        } else {
          value = rawValue;
        }
      } catch {
        value = rawValue;
      }
    } else {
      value = rawValue;
    }
  } else if (rawValue && typeof rawValue === 'object') {
    value = extractTabsValue(rawValue);
  } else {
    value = '';
  }

  if (!value || !value.trim()) return null;

  const plainText = sanitizeHtml(value);
  if (!plainText) return null;

  const tags = normalizeSnippetTags(snippet.tags ?? snippet.snippet_tags);
  const category =
    typeof snippet.category === 'string'
      ? snippet.category.trim()
      : typeof snippet.snippet_category === 'string'
        ? snippet.snippet_category.trim()
        : undefined;

  return {
    id: id || `${key}-${plainText.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    value,
    plainText,
    preview: buildPreview(plainText),
    tags,
    category,
    config: snippet.config,
  };
};

const flattenNotesFromAllData = (rawData: unknown): NoteItem[] => {
  if (!Array.isArray(rawData)) return [];
  const notes: NoteItem[] = [];
  const seen = new Set<string>();

  const pushSnippet = (snippet: any) => {
    const note = buildNoteFromSnippet(snippet);
    if (!note) return;

    // ALLOWED CATEGORIES: note, snippet, link
    if (note.category !== 'note' && note.category !== 'link' && note.category !== 'snippet') {
      return;
    }

    if (seen.has(note.id)) return;
    seen.add(note.id);
    notes.push(note);
  };

  rawData.forEach(team => {
    if (!team || typeof team !== 'object') return;
    const workspaces = Array.isArray((team as any).workspaces) ? ((team as any).workspaces as any[]) : [];
    workspaces.forEach((workspace: any) => {
      if (!workspace || typeof workspace !== 'object') return;
      const workspaceSnippets = Array.isArray((workspace as any).workspace_snippets)
        ? ((workspace as any).workspace_snippets as any[])
        : [];
      workspaceSnippets.forEach(pushSnippet);

      const folders = Array.isArray((workspace as any).folders) ? ((workspace as any).folders as any[]) : [];
      folders.forEach((folder: any) => {
        if (!folder || typeof folder !== 'object') return;
        const folderSnippets = Array.isArray((folder as any).snippets) ? ((folder as any).snippets as any[]) : [];
        folderSnippets.forEach(pushSnippet);
      });
    });
  });

  return notes;
};

const clampPositionToViewport = (position: PopupPosition): PopupPosition => {
  const padding = 12;
  const maxX = window.scrollX + window.innerWidth - padding;
  const maxY = window.scrollY + window.innerHeight - padding;
  return {
    x: Math.max(window.scrollX + padding, Math.min(position.x, maxX)),
    y: Math.max(window.scrollY + padding, Math.min(position.y, maxY)),
    caretHeight: position.caretHeight,
  };
};

const getElementAnchorPosition = (element: HTMLElement): PopupPosition => {
  const rect = element.getBoundingClientRect();
  return clampPositionToViewport({
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const getRangeAnchorPosition = (range: Range): PopupPosition | null => {
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }
  return clampPositionToViewport({
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const getRangeRelativeToIframe = (iframe: HTMLIFrameElement, range: Range): PopupPosition | null => {
  const iframeRect = iframe.getBoundingClientRect();
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return clampPositionToViewport({
    x: iframeRect.left + rect.left + window.scrollX,
    y: iframeRect.top + rect.bottom + window.scrollY + 8,
    caretHeight: rect.height,
  });
};

const buildSlashRange = (element: HTMLElement, caretRange: Range, length: number = 2): Range | null => {
  const slashRange = caretRange.cloneRange();
  let remaining = length;
  let { endContainer, endOffset } = slashRange;

  const findPreviousTextNode = (node: Node): Text | null => {
    let current: Node | null = node;

    while (current && current !== element) {
      if (current.previousSibling) {
        current = current.previousSibling;
        while (current && current.lastChild) {
          current = current.lastChild;
        }
      } else {
        current = current.parentNode;
      }

      if (current && current.nodeType === Node.TEXT_NODE) {
        return current as Text;
      }
    }

    return null;
  };

  while (remaining > 0) {
    if (endContainer.nodeType === Node.TEXT_NODE) {
      const textNode = endContainer as Text;
      if (endOffset >= remaining) {
        slashRange.setStart(textNode, endOffset - remaining);
        remaining = 0;
        break;
      } else if (endOffset > 0) {
        remaining -= endOffset;
        slashRange.setStart(textNode, 0);
      }
    }

    const previous = findPreviousTextNode(endContainer);
    if (!previous) {
      return null;
    }

    endContainer = previous;
    endOffset = previous.textContent?.length ?? 0;
    slashRange.setStart(previous, Math.max(0, endOffset));
  }

  return remaining === 0 ? slashRange : null;
};

const dispatchInputEvents = (element: HTMLInputElement | HTMLTextAreaElement) => {
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
};

class WebsiteSnippetInjector {
  private notes: NoteItem[] = [];
  private popupContainer: HTMLDivElement | null = null;
  private popupRoot: Root | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private shadowContainer: HTMLDivElement | null = null;
  private isOpen = false;
  private triggerContext: TriggerContext | null = null;
  private focusedElement: SupportedInputElement | null = null;
  private lastTriggerTimestamp = 0;
  private readonly googleDocs =
    window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/document/');
  private readonly googleSheets =
    window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/');
  private docsIframe: HTMLIFrameElement | null = null;
  private docsSlashCount = 0;
  private loadNotesPromise: Promise<void> | null = null;
  private pendingTrigger: (() => void) | null = null;
  private injectedDocsIframes = new WeakSet<HTMLIFrameElement>();
  private docsTypedBuffer = '';
  private searchQuery = ''; // Track text typed after c/
  private slashPosition = -1; // Position of c/ in the input when popup opened

  constructor() {
    void this.loadNotes();
    this.setupFocusTracking();
    this.setupInputListeners();
    this.setupGlobalKeyListeners();
    this.setupStorageListener(); // Listen for updates
    if (this.googleDocs) {
      this.setupGoogleDocs();
    }
    if (this.googleSheets) {
      this.setupGoogleSheets();
    }
  }

  private setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.snippets_cache || changes.local_ast_snippets) {
          // Force reload
          this.loadNotesPromise = null;
          void this.loadNotes();
        }
      }
    });
  }

  private async loadNotes(): Promise<void> {
    if (this.loadNotesPromise) {
      await this.loadNotesPromise;
      return;
    }

    this.loadNotesPromise = (async () => {
      try {
        const result = await chrome.storage.local.get(['snippets_cache', 'local_ast_snippets']);

        const fallbackNotes: NoteItem[] = [];
        if (result?.snippets_cache && typeof result.snippets_cache === 'object') {
          const entries = Object.entries(result.snippets_cache as Record<string, unknown>);
          entries.forEach(([key, value]) => {
            if (typeof value !== 'string' || !value.trim()) return;
            const plainText = sanitizeHtml(value);
            if (!plainText) return;
            fallbackNotes.push({
              id: key,
              key,
              value,
              plainText,
              preview: buildPreview(plainText),
              tags: [],
            });
          });
        }

        const baseNotes = fallbackNotes;

        // Merge local AST snippets
        if (result?.local_ast_snippets && typeof result.local_ast_snippets === 'object') {
          const localAsts = Object.values(result.local_ast_snippets as Record<string, any>);
          localAsts.forEach(astObj => {
            // Check if it already exists in base notes
            if (!baseNotes.some(n => n.id === astObj.snippet_id)) {
              let snippetAst: ASTNode[] | null = null;
              try {
                if (astObj.config) {
                  snippetAst = typeof astObj.config === 'string' ? JSON.parse(astObj.config) : astObj.config;
                } else if (astObj.value && typeof astObj.value === 'string' && astObj.value.trim().startsWith('[')) {
                  snippetAst = JSON.parse(astObj.value);
                }
              } catch (e) {
                console.warn('Failed to parse snippet value as AST', e);
              }

              let plainText = astObj.value;
              if (snippetAst) {
                plainText = snippetAst.map(n => (n.type === 'text' ? n.value : '')).join('');
              }

              baseNotes.push({
                id: astObj.snippet_id,
                key: astObj.key,
                value: astObj.value,
                plainText: plainText || astObj.key,
                preview: buildPreview(plainText || astObj.key),
                tags: astObj.tags ? astObj.tags.map((t: any) => t.name || t.label || t).filter(Boolean) : [],
                category: 'snippet',
                config: astObj.config,
              });
            }
          });
        }

        this.notes = baseNotes;
      } catch (error) {
        console.error('[SlashNotes] Failed to load notes:', error);
        this.notes = [];
      } finally {
        this.loadNotesPromise = null;
      }
    })();

    await this.loadNotesPromise;
  }

  private checkAndReplaceSnippet(
    textBefore: string,
    replaceCallback: (deleteCount: number, text: string, html?: string) => void,
  ): boolean {
    const triggers = ['/t', 'c//'];

    for (const trigger of triggers) {
      const lastTriggerIndex = textBefore.lastIndexOf(trigger);
      if (lastTriggerIndex === -1) continue;

      const rawPotentialKey = textBefore.slice(lastTriggerIndex + trigger.length);
      if (!rawPotentialKey) continue;

      const potentialKey = rawPotentialKey.trimStart();

      const note = this.notes.find(n => n.key === potentialKey);
      if (note) {
        // We need to delete everything from the trigger start to the cursor
        // This includes the trigger, any whitespace, and the key
        const matchLength = textBefore.length - lastTriggerIndex;
        let htmlSnippet = note.value || note.plainText;
        if (htmlSnippet && !/<[a-z][\s\S]*>/i.test(htmlSnippet)) {
          htmlSnippet = htmlSnippet.replace(/\n/g, '<br>');
        }
        replaceCallback(matchLength, note.plainText, htmlSnippet);
        return true;
      }
    }
    return false;
  }

  private runWithNotes(callback: () => void) {
    if (this.notes.length) {
      callback();
      return;
    }

    this.pendingTrigger = callback;
    void this.loadNotes().then(() => {
      const trigger = this.pendingTrigger;
      this.pendingTrigger = null;
      trigger?.();
    });
  }

  private setupFocusTracking() {
    document.addEventListener(
      'focusin',
      event => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target instanceof HTMLInputElement && isTextInput(target)) {
          this.focusedElement = target;
        } else if (target instanceof HTMLTextAreaElement) {
          this.focusedElement = target;
        } else if (target.isContentEditable) {
          this.focusedElement = target;
        }
      },
      true,
    );

    document.addEventListener(
      'focusout',
      event => {
        if (event.target === this.focusedElement) {
          this.focusedElement = null;
        }
      },
      true,
    );
  }

  private setupInputListeners() {
    document.addEventListener(
      'input',
      event => {
        // IGNORE AUTOMATION EVENTS
        if ((window as any).__tasklabs_automation_active || (event as any).isAutomation) {
          return;
        }

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (target instanceof HTMLInputElement && isTextInput(target)) {
          this.tryTriggerForInput(target);
        } else if (target instanceof HTMLTextAreaElement) {
          this.tryTriggerForInput(target);
        } else if (target.isContentEditable) {
          this.tryTriggerForContentEditable(target);
        }
      },
      true,
    );
  }

  private setupGlobalKeyListeners() {
    document.addEventListener(
      'keyup',
      event => {
        if (event.key === 'Escape' && this.isOpen) {
          event.stopPropagation();
          this.closePopup();
        }
      },
      true,
    );
  }

  private setupGoogleDocs() {
    const pollIframe = () => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe.docs-texteventtarget-iframe');
      if (!iframe || !iframe.contentDocument) {
        window.setTimeout(pollIframe, 500);
        return;
      }

      this.docsIframe = iframe;
      const doc = iframe.contentDocument;
      doc.addEventListener('keydown', this.handleGoogleDocsKeyDown, true);
    };

    pollIframe();
  }

  private setupGoogleSheets() {
    document.addEventListener(
      'keydown',
      event => {
        if (!this.googleSheets) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        const isFormulaBar =
          target instanceof HTMLInputElement &&
          target.id === 't-formula-bar-input' &&
          isTextInput(target as HTMLInputElement);

        if (isFormulaBar && target.selectionStart !== null) {
          const key = event.key;
          if (key.length === 1) {
            const valueBefore = target.value.slice(0, target.selectionStart || 0) + key;

            this.checkAndReplaceSnippet(valueBefore, (deleteCount, text, html) => {
              event.preventDefault();
              event.stopPropagation();
              this.insertIntoSheets(target as HTMLInputElement, target.selectionStart || 0, text, deleteCount - 1);
            });
          }
        }
      },
      true,
    );
  }

  private handleGoogleDocsKeyDown = (event: KeyboardEvent) => {
    const iframe = this.docsIframe;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.docsTypedBuffer += event.key;

      this.checkAndReplaceSnippet(this.docsTypedBuffer, (deleteCount, text, html) => {
        this.docsTypedBuffer = '';

        const selection = iframe.contentWindow?.getSelection();
        const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

        setTimeout(() => {
          this.insertIntoGoogleDocs(iframe, range!, text, html, deleteCount);
        }, 0);
      });
    } else if (event.key === 'Backspace') {
      this.docsTypedBuffer = this.docsTypedBuffer.slice(0, -1);
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
      if (this.docsTypedBuffer.length > 100) {
        this.docsTypedBuffer = this.docsTypedBuffer.slice(-50);
      }
    }

    if (event.key === 'c') {
      this.docsSlashCount = 1;
    } else if (event.key === '/' && this.docsSlashCount === 1) {
      this.docsSlashCount = 2;
    } else {
      this.docsSlashCount = 0;
    }

    if (this.docsSlashCount >= 2) {
      this.docsSlashCount = 0;
      const selection = iframe.contentWindow?.getSelection();
      if (!selection || !selection.rangeCount) return;

      const caretRange = selection.getRangeAt(0).cloneRange();
      const openPopup = () => {
        const docSelection = iframe.contentWindow?.getSelection();
        const currentRange =
          docSelection && docSelection.rangeCount ? docSelection.getRangeAt(0).cloneRange() : caretRange.cloneRange();
        const position = getRangeRelativeToIframe(iframe, currentRange) || getElementAnchorPosition(iframe);
        if (!position) return;
        this.triggerContext = {
          type: 'googleDocs',
          iframe,
          caretRange: currentRange,
        };
        this.renderPopup(position);
      };

      this.runWithNotes(() => {
        requestAnimationFrame(openPopup);
      });
    }
  };

  private tryTriggerForInput(element: HTMLInputElement | HTMLTextAreaElement) {
    if (element.selectionStart === null) return;

    const selectionStart = element.selectionStart;
    const valueBefore = element.value.slice(0, selectionStart);

    const handled = this.checkAndReplaceSnippet(valueBefore, (deleteCount, text, html) => {
      this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
    });

    if (handled) return;

    const slashIndex = valueBefore.lastIndexOf('c/');

    if (this.isOpen && this.triggerContext?.type === 'input') {
      if (slashIndex === -1) {
        this.closePopup();
        return;
      }

      const newQuery = valueBefore.slice(slashIndex + 2);
      this.searchQuery = newQuery;

      const caretPosition = getInputCaretPosition(element, selectionStart);
      const position = caretPosition || getElementAnchorPosition(element);
      this.renderPopup(position, this.searchQuery);
      return;
    }

    if (!valueBefore.endsWith('c/')) return;

    const openPopup = () => {
      if (!element.isConnected) return;
      if (!element.value.slice(0, selectionStart).endsWith('c/')) return;

      this.slashPosition = selectionStart - 2;
      this.searchQuery = '';

      this.openPopupForElement(element, selectionStart, 'input');
    };

    this.runWithNotes(() => {
      requestAnimationFrame(openPopup);
    });
  }

  private tryTriggerForContentEditable(element: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!element.contains(range.endContainer)) return;

    const probe = range.cloneRange();
    probe.selectNodeContents(element);
    probe.setEnd(range.endContainer, range.endOffset);
    const textBefore = probe.toString();

    const handled = this.checkAndReplaceSnippet(textBefore, (deleteCount, text, html) => {
      const slashRange = buildSlashRange(element, range, deleteCount);
      if (slashRange) {
        this.insertIntoContentEditable(element, slashRange, text, html);
      }
    });

    if (handled) return;

    const slashIndex = textBefore.lastIndexOf('c/');

    if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
      if (slashIndex === -1) {
        this.closePopup();
        return;
      }

      const newQuery = textBefore.slice(slashIndex + 2);
      this.searchQuery = newQuery;

      const currentSelection = window.getSelection();
      const currentRange = currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : range;
      const anchorPosition = getRangeAnchorPosition(currentRange) || getElementAnchorPosition(element);

      if (anchorPosition) {
        this.renderPopup(anchorPosition, this.searchQuery);
      }
      return;
    }

    if (!textBefore.endsWith('c/')) return;

    const slashRange = buildSlashRange(element, range, 2);
    if (!slashRange) return;

    const slashIndexForQuery = textBefore.lastIndexOf('c/');
    const searchQuery = slashIndexForQuery !== -1 ? textBefore.slice(slashIndexForQuery + 2) : '';

    const storedRange = slashRange.cloneRange();
    const openPopup = () => {
      if (!element.isConnected) return;
      const textSnapshot = element.textContent || '';
      if (!textSnapshot.includes('c/')) return;

      const currentSelection = window.getSelection();
      const currentRange =
        currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : storedRange;
      const anchorPosition = getRangeAnchorPosition(currentRange) || getElementAnchorPosition(element);

      if (!anchorPosition) return;
      this.triggerContext = {
        type: 'contentEditable',
        element,
        slashRange: storedRange.cloneRange(),
      };
      this.renderPopup(anchorPosition, searchQuery);
    };

    this.runWithNotes(openPopup);
  }

  private openPopupForElement(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    type: 'input' | 'googleSheets',
  ) {
    const now = Date.now();
    if (now - this.lastTriggerTimestamp < 150) {
      return;
    }
    this.lastTriggerTimestamp = now;

    const safeSelection = Math.max(0, Math.min(selectionStart, element.value.length));
    const caretPosition =
      type === 'input' || type === 'googleSheets' ? getInputCaretPosition(element, safeSelection) : null;
    const position = caretPosition || getElementAnchorPosition(element);
    this.triggerContext =
      type === 'googleSheets'
        ? {
            type: 'googleSheets',
            element,
            selectionStart,
          }
        : {
            type: 'input',
            element,
            selectionStart,
          };

    this.renderPopup(position);
  }

  private renderPopup(position: PopupPosition, externalQuery: string = '') {
    const finalPosition = clampPositionToViewport({
      x: position.x,
      y: position.y + POPUP_VERTICAL_OFFSET,
    });
    if (!this.popupContainer) {
      // Clean up any existing popup root left over from previous script versions (e.g. after extension reloads)
      const existing = document.getElementById('tasklabs-slash-popup-root');
      if (existing) {
        existing.remove();
      }

      this.popupContainer = document.createElement('div');
      this.popupContainer.id = 'tasklabs-slash-popup-root';
      this.popupContainer.style.position = 'absolute';
      this.popupContainer.style.top = '0';
      this.popupContainer.style.left = '0';
      this.popupContainer.style.zIndex = '2147483646';
      document.documentElement.appendChild(this.popupContainer);
      this.shadowRoot = this.popupContainer.attachShadow({ mode: 'open' });
      this.shadowContainer = document.createElement('div');
      this.shadowRoot.appendChild(this.shadowContainer);
      this.attachShadowStyles();
      this.popupRoot = createRoot(this.shadowContainer);
    }

    this.popupRoot?.render(
      React.createElement(InjectedSnippetDropdownUI, {
        notes: this.notes,
        position: finalPosition,
        onClose: () => this.closePopup(),
        onSelect: note => this.insertNote(note),
        onEdit: note => {
          try {
            window.dispatchEvent(
              new CustomEvent('tasklabs:edit-snippet', {
                detail: note,
              }),
            );
          } catch (e) {
            console.error('[SlashNotes] Failed to send edit message', e);
          }
          this.closePopup();
        },
        externalQuery,
      }),
    );

    document.addEventListener('mousedown', this.handleOutsideClick, true);
    document.addEventListener('touchstart', this.handleOutsideClick, true);

    this.isOpen = true;
  }

  private handleOutsideClick = (event: MouseEvent | TouchEvent) => {
    if (!this.popupContainer) return;

    const targetNode = event.target as Node | null;
    if (!targetNode) return;

    if (this.popupContainer.contains(targetNode)) return;
    if (this.shadowContainer?.contains(targetNode)) return;
    this.closePopup();
  };

  private closePopup() {
    if (!this.isOpen) return;

    document.removeEventListener('mousedown', this.handleOutsideClick, true);
    document.removeEventListener('touchstart', this.handleOutsideClick, true);

    if (this.popupRoot) {
      this.popupRoot.render(null);
    }

    this.isOpen = false;
    this.triggerContext = null;
    this.searchQuery = '';
    this.slashPosition = -1;
  }

  private async insertNote(note: NoteItem) {
    let textToInsert = note.plainText;
    let htmlToInsert = note.value || note.plainText;
    let customVariables: Array<string | FieldNode> = [];
    let astFields: FieldNode[] = [];
    let cursorOffset: number | undefined;

    if (note.category === 'snippet') {
      try {
        let parsed: any = null;
        if (note.config) {
          parsed = typeof note.config === 'string' ? JSON.parse(note.config) : note.config;
        } else if (note.value && note.value.trim().startsWith('[')) {
          parsed = JSON.parse(note.value);
        }
        if (
          parsed &&
          Array.isArray(parsed) &&
          (parsed.length === 0 || (typeof parsed[0] === 'object' && parsed[0] !== null && 'type' in parsed[0]))
        ) {
          astFields = scanAstForFields(parsed);
          let clipboardText = '';
          try {
            clipboardText = await navigator.clipboard.readText();
          } catch (e) {
            console.warn('[NotesExtension] Failed to read clipboard:', e);
          }

          const context = new RuntimeContext();
          context.setValue('__system_clipboard__', clipboardText, 'SYSTEM');

          const evalResult = evaluateAst(parsed, context, { leaveUnresolvedAsBraces: true });
          textToInsert = evalResult.text;
          htmlToInsert = evalResult.text; // Basic AST doesn't have HTML formatting yet, so we just use the evaluated text
          if (evalResult.cursorPosition !== undefined) {
            textToInsert =
              textToInsert.slice(0, evalResult.cursorPosition) +
              '\u200B__CURSOR__\u200B' +
              textToInsert.slice(evalResult.cursorPosition);

            // Safely insert cursor into HTML using DOM traversal instead of plain string slicing
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlToInsert;
            const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            let currentOffset = 0;
            let inserted = false;

            while (node) {
              const textLength = node.nodeValue?.length || 0;
              if (currentOffset + textLength >= evalResult.cursorPosition) {
                const splitIndex = evalResult.cursorPosition - currentOffset;
                const text = node.nodeValue || '';
                node.nodeValue = text.slice(0, splitIndex) + '\u200B__CURSOR__\u200B' + text.slice(splitIndex);
                inserted = true;
                break;
              }
              currentOffset += textLength;
              node = walker.nextNode();
            }

            if (!inserted) {
              tempDiv.appendChild(document.createTextNode('\u200B__CURSOR__\u200B'));
            }

            htmlToInsert = tempDiv.innerHTML;
          }

          cursorOffset = evalResult.cursorPosition;
        }
      } catch (e) {
        // Fallback to plainText if parsing fails
      }
    }

    if (!textToInsert) {
      this.closePopup();
      return;
    }

    // For link-type notes, insert as a clickable hyperlink
    const cat = (note.category || '').toLowerCase();
    const isLink = cat === 'link';
    if (isLink) {
      // Get the raw URL from the note value
      let url = (note.value || '').trim();
      // Handle JSON-wrapped URLs
      if (url.startsWith('{')) {
        try {
          const parsed = JSON.parse(url);
          if (parsed.url) url = parsed.url;
          else if (Array.isArray(parsed.urls) && parsed.urls.length > 0) url = parsed.urls[0];
        } catch {}
      }
      // Ensure URL has a protocol
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      const linkTitle = note.key || url;
      textToInsert = url; // Plain text fallback is just the URL
      htmlToInsert = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkTitle}</a>`;
    }

    // Normalize HTML (only for non-link notes, links already have proper HTML)
    if (!isLink && htmlToInsert && !/<[a-z][\s\S]*>/i.test(htmlToInsert)) {
      htmlToInsert = htmlToInsert.replace(/\n/g, '<br>');
    }

    // Step 1: Auto-resolve special variables (current_date, next_day, etc.)
    textToInsert = resolveSpecialVariables(textToInsert);
    htmlToInsert = resolveSpecialVariables(htmlToInsert);

    // Step 2: Check for remaining custom variables that need user input
    const rawStrings = detectVariables(textToInsert).filter(v => !isSpecialVariable(v));

    // Merge astFields and rawStrings
    customVariables = [...astFields];
    rawStrings.forEach(s => {
      const isAstField = astFields.some(f => {
        const configLabel =
          f.config && typeof f.config === 'object' && 'label' in f.config ? (f.config as any).label : undefined;
        return (configLabel || f.alias || f.id) === s;
      });
      if (!isAstField) customVariables.push(s);
    });

    // Filter out auto-evaluating fields from the popup variables list
    // Clipboard and date are always auto-resolved — never show in the modal
    const interactiveVariables = customVariables.filter(v => {
      if (typeof v === 'string') {
        const lower = v.toLowerCase();
        return lower !== 'clipboard' && lower !== 'date';
      }
      return v.fieldType !== 'date' && v.fieldType !== 'clipboard';
    });

    // Strip leftover {{placeholders}} for non-interactive fields (clipboard, date)
    // These may appear in the text if they couldn't be resolved (e.g. empty values)
    const nonInteractiveFields = customVariables.filter(
      v => typeof v !== 'string' && (v.fieldType === 'clipboard' || v.fieldType === 'date'),
    ) as FieldNode[];
    nonInteractiveFields.forEach(f => {
      const label = (f.config as any)?.label || f.alias || f.id;
      const re = new RegExp(`\\{\\{\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}}`, 'gi');
      textToInsert = textToInsert.replace(re, '');
      htmlToInsert = htmlToInsert.replace(re, '');
    });

    // Also strip literal {{clipboard}}, {{date}} case-insensitively
    ['clipboard', 'date'].forEach(name => {
      const re = new RegExp(`\\{\\{\\s*${name}\\s*\\}}`, 'gi');
      textToInsert = textToInsert.replace(re, '');
      htmlToInsert = htmlToInsert.replace(re, '');
    });

    const context = this.triggerContext;
    const queryLength = this.searchQuery.length; // Length of text typed after //
    this.closePopup();

    if (!context) return;

    // If there are custom variables, we'll insert text first then prompt for each
    const performInsertion = (text: string, html: string, cursorIndex?: number) => {
      switch (context.type) {
        case 'input':
          // Delete // plus the search query
          this.insertIntoStandardInput(
            context.element,
            context.selectionStart + queryLength,
            text,
            2 + queryLength,
            cursorIndex,
          );
          break;
        case 'googleSheets':
          this.insertIntoSheets(context.element, context.selectionStart, text, 2);
          break;
        case 'contentEditable': {
          // Extend the slashRange to also cover the search query typed after c/
          const extendedRange = context.slashRange.cloneRange();
          if (queryLength > 0) {
            try {
              // Move the end of the range forward by queryLength characters to cover the search query
              let remaining = queryLength;
              let node = extendedRange.endContainer;
              let offset = extendedRange.endOffset;

              while (remaining > 0 && node) {
                if (node.nodeType === Node.TEXT_NODE) {
                  const textLen = (node.textContent || '').length;
                  const available = textLen - offset;
                  if (available >= remaining) {
                    extendedRange.setEnd(node, offset + remaining);
                    remaining = 0;
                  } else {
                    remaining -= available;
                    offset = 0;
                    // Move to next text node
                    const walker = document.createTreeWalker(context.element, NodeFilter.SHOW_TEXT);
                    walker.currentNode = node;
                    const nextText = walker.nextNode();
                    if (nextText) {
                      node = nextText;
                    } else {
                      break;
                    }
                  }
                } else {
                  // Move into child text nodes
                  const walker = document.createTreeWalker(context.element, NodeFilter.SHOW_TEXT);
                  walker.currentNode = node;
                  const nextText = walker.nextNode();
                  if (nextText) {
                    node = nextText;
                    offset = 0;
                  } else {
                    break;
                  }
                }
              }
            } catch (e) {
              // If extending fails, fall back to original range (at least c/ will be replaced)
              console.warn('[SlashNotes] Failed to extend range for search query removal', e);
            }
          }
          this.insertIntoContentEditable(context.element, extendedRange, text, html);
          break;
        }
        case 'googleDocs':
          this.insertIntoGoogleDocs(context.iframe, context.caretRange, text, html, 2);
          break;
        default:
          break;
      }
    };

    // If there are custom variables, show the inline modal first
    if (interactiveVariables.length > 0 && (context.type === 'input' || context.type === 'contentEditable')) {
      const element = context.type === 'input' ? context.element : context.element;
      this.showInlineVariablesModal(
        element,
        interactiveVariables,
        textToInsert,
        htmlToInsert,
        (finalText, finalHtml) => {
          performInsertion(finalText, finalHtml, cursorOffset);
          this.finalizeCursor(element);
        },
      );
    } else {
      performInsertion(textToInsert, htmlToInsert, cursorOffset);
      if (context.type === 'input' || context.type === 'contentEditable') {
        const element = context.type === 'input' ? context.element : context.element;
        this.finalizeCursor(element);
      }
    }
  }

  private showInlineVariablesModal(
    element: HTMLElement,
    variables: Array<string | FieldNode>,
    rawText: string,
    rawHtml: string,
    onComplete: (finalText: string, finalHtml: string) => void,
  ) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.55)',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: '#1a1f2e',
      border: '1px solid #2d3548',
      borderRadius: '14px',
      padding: '24px 24px 20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      width: '460px',
      maxWidth: '92vw',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      overflowY: 'auto',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, { marginBottom: '16px' });
    const title = document.createElement('div');
    title.textContent = 'Fill in the Blanks';
    Object.assign(title.style, { color: '#f1f5f9', fontSize: '16px', fontWeight: '600', letterSpacing: '-0.01em' });
    header.appendChild(title);
    modal.appendChild(header);

    // Deduplicate variables & exclude clipboard and date types
    const seen = new Set<string>();
    const uniqueVariables: Array<string | FieldNode> = [];
    variables.forEach(v => {
      // Exclude special resolved fields (clipboard, date) from being treated as variables
      if (typeof v !== 'string' && (v.fieldType === 'clipboard' || v.fieldType === 'date')) {
        return;
      }
      const key = typeof v === 'string' ? v : (v.config as any)?.label || v.alias || v.id;
      const lower = key.toLowerCase();
      if (lower === 'clipboard' || lower === 'date') {
        return;
      }
      if (!seen.has(key)) {
        seen.add(key);
        uniqueVariables.push(v);
      }
    });
    const elementsMap = new Map<string, { getValue: () => string }>();
    let firstInput: HTMLElement | null = null;

    // Body: The text flows naturally like a document with inline elements
    const bodyWrapper = document.createElement('div');
    Object.assign(bodyWrapper.style, {
      color: '#e2e8f0',
      fontSize: '14px',
      lineHeight: '1.7',
      backgroundColor: '#0f1420',
      border: '1px solid #2d3548',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '20px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    });

    // We split rawText by variable placeholders to build the inline structure
    const currentText = rawText;
    // Exclude clipboard and date types from sortedKeys to prevent rendering as input in text splits
    const sortedKeys = uniqueVariables
      .filter(v => {
        if (typeof v === 'string') {
          const lower = v.toLowerCase();
          return lower !== 'clipboard' && lower !== 'date';
        }
        return v.fieldType !== 'clipboard' && v.fieldType !== 'date';
      })
      .map(v => {
        const key = typeof v === 'string' ? v : (v.config as any)?.label || v.alias || v.id;
        return { key, node: typeof v === 'string' ? null : v };
      });
    // Build the inline text element sequence
    const renderInlineElements = () => {
      // Find matches for any variable key format {{key}}
      // We will match the placeholders in order of their appearance in the text
      const regexParts: string[] = [];
      sortedKeys.forEach(({ key }) => {
        regexParts.push(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`);
      });

      // Filter out the cursor marker from the preview text so the user does not see it
      const previewText = rawText.replace(/\u200B__CURSOR__\u200B/g, '').replace(/__CURSOR__/g, '');
      if (regexParts.length === 0) {
        bodyWrapper.textContent = previewText;
        return;
      }

      const combinedRegex = new RegExp(`(${regexParts.join('|')})`, 'g');
      const parts = previewText.split(combinedRegex);

      parts.forEach(part => {
        // Check if this part matches one of our variable keys
        const matchedVar = sortedKeys.find(({ key }) => {
          const re = new RegExp(`^\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}$`);
          return re.test(part);
        });

        if (matchedVar) {
          const { key, node } = matchedVar;
          const fieldType = node?.fieldType || 'text';
          if (fieldType === 'dropdown') {
            const select = document.createElement('select');
            Object.assign(select.style, {
              display: 'inline-block',
              padding: '4px 26px 4px 10px',
              margin: '0 4px',
              backgroundColor: '#1e2538',
              border: '1px solid #3b455c',
              borderRadius: '6px',
              color: '#f1f5f9',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              verticalAlign: 'baseline',
              appearance: 'none',
              backgroundImage:
                "url(\"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23B89DF5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            });
            const opts = (node!.config as any)?.options || [];
            opts.forEach((opt: string) => {
              const o = document.createElement('option');
              o.value = opt;
              o.textContent = opt;
              select.appendChild(o);
            });
            select.addEventListener('focus', () => {
              select.style.borderColor = '#B89DF5';
              select.style.boxShadow = '0 0 0 2px rgba(184,157,245,0.25)';
            });
            select.addEventListener('blur', () => {
              select.style.borderColor = '#3b455c';
              select.style.boxShadow = 'none';
            });
            bodyWrapper.appendChild(select);
            elementsMap.set(key, { getValue: () => select.value });
            if (!firstInput) firstInput = select;
          } else if (fieldType === 'toggle') {
            const cfg = (node!.config as any) || {};
            const trueLabel = cfg.trueLabel || 'Yes';
            const falseLabel = cfg.falseLabel || 'No';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.defaultChecked = cfg.defaultValue === true;
            Object.assign(checkbox.style, {
              display: 'inline-block',
              margin: '0 6px',
              width: '16px',
              height: '16px',
              accentColor: '#B89DF5',
              cursor: 'pointer',
              verticalAlign: 'middle',
            });
            bodyWrapper.appendChild(checkbox);
            elementsMap.set(key, { getValue: () => (checkbox.checked ? trueLabel : falseLabel) });
            if (!firstInput) firstInput = checkbox;
          } else {
            // Text blank
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = key.toLowerCase();
            Object.assign(input.style, {
              display: 'inline-block',
              padding: '4px 10px',
              margin: '0 4px',
              backgroundColor: '#1e2538',
              border: '1px solid #3b455c',
              borderRadius: '6px',
              color: '#f1f5f9',
              fontSize: '13px',
              outline: 'none',
              width: '100px',
              verticalAlign: 'baseline',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            });
            input.addEventListener('focus', () => {
              input.style.borderColor = '#B89DF5';
              input.style.boxShadow = '0 0 0 2px rgba(184,157,245,0.25)';
            });
            input.addEventListener('blur', () => {
              input.style.borderColor = '#3b455c';
              input.style.boxShadow = 'none';
            });
            bodyWrapper.appendChild(input);
            elementsMap.set(key, { getValue: () => input.value });
            if (!firstInput) firstInput = input;
          }
        } else {
          // Regular text
          bodyWrapper.appendChild(document.createTextNode(part));
        }
      });
    };

    renderInlineElements();
    modal.appendChild(bodyWrapper);

    // Buttons
    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', justifyContent: 'flex-end', gap: '10px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '8px 16px',
      border: '1px solid #2d3548',
      borderRadius: '6px',
      backgroundColor: 'transparent',
      color: '#94a3b8',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
    });
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.backgroundColor = '#1e2635';
      cancelBtn.style.color = '#e2e8f0';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.color = '#94a3b8';
    });

    const insertBtn = document.createElement('button');
    insertBtn.textContent = 'Insert';
    Object.assign(insertBtn.style, {
      padding: '8px 18px',
      border: 'none',
      borderRadius: '6px',
      background: 'linear-gradient(135deg, #B89DF5 0%, #9b73f0 100%)',
      color: 'white',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      boxShadow: '0 2px 10px rgba(184,157,245,0.2)',
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(insertBtn);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (firstInput) setTimeout(() => (firstInput as HTMLElement).focus(), 50);
    else setTimeout(() => insertBtn.focus(), 50);

    const doInsert = () => {
      let finalText = rawText;
      let finalHtml = rawHtml;
      elementsMap.forEach((data, varKey) => {
        const val = data.getValue();
        const re = new RegExp(`\\{\\{\\s*${varKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
        finalText = finalText.replace(re, val);
        finalHtml = finalHtml.replace(re, val);
      });
      overlay.remove();
      onComplete(finalText, finalHtml);
    };

    const doCancel = () => overlay.remove();

    insertBtn.addEventListener('click', doInsert);
    cancelBtn.addEventListener('click', doCancel);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) doCancel();
    });

    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        doCancel();
      } else if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        doInsert();
      }
    });
  }

  private finalizeCursor(element: HTMLElement) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const idx = element.value.indexOf('\u200B__CURSOR__\u200B');
      if (idx !== -1) {
        element.value = element.value.replace('\u200B__CURSOR__\u200B', '');
        element.setSelectionRange(idx, idx);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (element.isContentEditable) {
      // Robust TreeWalker to find the zero-width cursor marker in text nodes
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeValue && node.nodeValue.includes('\u200B__CURSOR__\u200B')) {
          const idx = node.nodeValue.indexOf('\u200B__CURSOR__\u200B');
          node.nodeValue = node.nodeValue.replace('\u200B__CURSOR__\u200B', '');

          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          break;
        }
        node = walker.nextNode();
      }
    }
  }

  private insertIntoStandardInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    text: string,
    deleteCount: number,
    cursorOffset?: number,
  ) {
    const start = Math.max(0, selectionStart - deleteCount);
    const before = element.value.slice(0, start);
    const after = element.value.slice(selectionStart);
    const nextValue = `${before}${text}${after}`;
    element.value = nextValue;

    const cursor = cursorOffset !== undefined ? before.length + cursorOffset : before.length + text.length;
    element.setSelectionRange(cursor, cursor);
    dispatchInputEvents(element);
  }

  private insertIntoSheets(
    element: HTMLInputElement | HTMLTextAreaElement,
    selectionStart: number,
    text: string,
    deleteCount: number,
  ) {
    element.focus();
    const start = Math.max(0, selectionStart - deleteCount);
    element.setSelectionRange(start, selectionStart);
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
    }
  }

  private insertIntoContentEditable(element: HTMLElement, slashRange: Range, text: string, html: string = text) {
    element.focus();
    const selection = window.getSelection();
    if (!selection) return;

    try {
      // Method 1: Use execCommand('insertHTML') which handles formatting correctly
      // First, select the range we want to replace
      selection.removeAllRanges();
      selection.addRange(slashRange);

      // Attempt to use execCommand which simulates user typing/pasting
      // This is deprecated but still the most reliable way to interact with complex editors like Gmail/Docs
      const success =
        document.execCommand('insertHTML', false, html) || document.execCommand('insertText', false, text);

      if (success) {
        return;
      }
    } catch (e) {
      console.warn('[SlashNotes] execCommand failed, falling back to manual insertion', e);
    }

    // Fallback: Manual insertion if execCommand fails
    // This is less ideal because it might not trigger editor's internal state updates
    selection.removeAllRanges();
    selection.addRange(slashRange);
    slashRange.deleteContents();

    // Check if text has newlines
    if (text.includes('\n')) {
      const fragment = document.createDocumentFragment();
      const lines = text.split('\n');

      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement('br'));
        }
        if (line) {
          fragment.appendChild(document.createTextNode(line));
        }
      });

      const insertRange = slashRange.cloneRange();
      insertRange.insertNode(fragment);

      // Update cursor position
      selection.removeAllRanges();
      const collapseRange = document.createRange();
      collapseRange.setStartAfter(fragment.lastChild || fragment);
      collapseRange.collapse(true);
      selection.addRange(collapseRange);
    } else {
      const textNode = document.createTextNode(text);
      const insertRange = slashRange.cloneRange();
      insertRange.insertNode(textNode);

      selection.removeAllRanges();
      const collapseRange = document.createRange();
      collapseRange.setStart(textNode, textNode.length);
      collapseRange.collapse(true);
      selection.addRange(collapseRange);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private async insertIntoGoogleDocs(
    iframe: HTMLIFrameElement,
    _caretRange: Range,
    text: string,
    html: string = text,
    deleteCount: number = 0,
  ) {
    try {
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !doc) return;

      if (!this.injectedDocsIframes.has(iframe)) {
        const script = doc.createElement('script');
        script.src = chrome.runtime.getURL('content/injected.js');
        script.onload = () => {
          script.remove();
        };
        (doc.head || doc.documentElement).appendChild(script);
        this.injectedDocsIframes.add(iframe);
      }

      // Send message to the iframe's window to trigger the insertion
      win.postMessage({ type: 'TASKLABS_INSERT_TEXT', text, html, deleteCount }, '*');
    } catch (error) {
      console.warn('[SlashNotes] Failed to insert into Google Docs:', error);
    }
  }

  private attachShadowStyles() {
    if (!this.shadowRoot) return;
    if (this.shadowRoot.querySelector('style[data-slash-notes]')) return;

    const style = document.createElement('style');
    style.setAttribute('data-slash-notes', 'true');
    style.textContent = `
      :host {
        all: initial;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #374151;
      }

      * {
        box-sizing: border-box;
      }

      .popup-container {
        position: fixed;
        width: 320px;
        max-height: 320px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.5);
        box-shadow: 
          0 4px 6px -1px rgba(0, 0, 0, 0.1), 
          0 2px 4px -1px rgba(0, 0, 0, 0.06),
          0 20px 25px -5px rgba(0, 0, 0, 0.1), 
          0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: fadeIn 0.15s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .popup-header {
        padding: 4px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        background: rgba(255, 255, 255, 0.5);
      }

      .popup-input {
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        font-size: 13px;
        color: #111827;
        outline: none;
        transition: all 0.2s;
      }

      .popup-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
      }

      .popup-list {
        overflow-y: auto;
        padding: 6px;
        max-height: 240px;
      }

      .note-item {
        width: 100%;
        text-align: left;
        padding: 5px 6px;
        border-radius: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: all 0.15s;
        display: flex;
        flex-direction: column;
        gap: 2px;
        color: #374151;
      }

      .note-item:hover, .note-item.active {
        background: #f3f4f6;
      }

      .note-item.active {
        background: #e5e7eb;
        color: #111827;
      }

      .note-title {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .note-preview {
        font-size: 11px;
        color: #6b7280;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        opacity: 0.8;
      }

      .note-tags {
        display: flex;
        gap: 4px;
        margin-top: 4px;
      }

      .note-tag {
        font-size: 9px;
        padding: 2px 6px;
        border-radius: 99px;
        background: #e5e7eb;
        color: #4b5563;
        font-weight: 500;
        text-transform: uppercase;
      }

      .popup-footer {
        padding: 4px 8px;
        background: #f9fafb;
        border-top: 1px solid rgba(0, 0, 0, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 10px;
        color: #9ca3af;
      }

      .shortcut {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .kbd {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        padding: 1px 4px;
        font-family: monospace;
        font-weight: 600;
        color: #6b7280;
      }

      .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
      }

      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }

      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(156, 163, 175, 0.3);
        border-radius: 99px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(156, 163, 175, 0.5);
      }


      .menu-trigger {
        opacity: 0;
        transition: opacity 0.2s;
        background: transparent;
        border: none;
        padding: 4px;
        border-radius: 4px;
        cursor: pointer;
        color: #9ca3af;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .note-item:hover .menu-trigger,
      .menu-trigger.active {
        opacity: 1;
      }

      .menu-trigger:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #4b5563;
      }
    `;

    this.shadowRoot.appendChild(style);
  }
}

// ============================================
// Global Hotkey Controller
// ============================================
// Enables hotkeys to work on any website, not just the new tab page.
// Listens for key combinations and sends messages to background script to open links.

new WebsiteSnippetInjector();
export { WebsiteSnippetInjector };
