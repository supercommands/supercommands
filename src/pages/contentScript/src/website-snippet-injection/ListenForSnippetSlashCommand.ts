import type { Root } from 'react-dom/client';
import type { NoteItem, PopupPosition, SupportedInputElement } from '../types';
import { evaluateAst, RuntimeContext, scanAstForFields, type FieldNode, type DropdownFieldConfig, type ToggleFieldConfig, type ASTNode, } from '@extension/shared';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
type SnippetPopupRuntime = {
    React: typeof import('react');
    createRoot: typeof import('react-dom/client')['createRoot'];
    InjectedSnippetDropdownUI: typeof import('./InjectedSnippetDropdownUI').default;
};
let snippetPopupRuntimePromise: Promise<SnippetPopupRuntime> | null = null;
const loadSnippetPopupRuntime = async (): Promise<SnippetPopupRuntime> => {
    snippetPopupRuntimePromise ??= Promise.all([
        import('react'),
        import('react-dom/client'),
        import('./InjectedSnippetDropdownUI')
    ]).then(([React, reactDomClient, dropdownModule]) => ({
        React,
        createRoot: reactDomClient.createRoot,
        InjectedSnippetDropdownUI: dropdownModule.default,
    }));
    return snippetPopupRuntimePromise;
};
type TriggerContext = {
    type: 'input';
    element: HTMLInputElement | HTMLTextAreaElement;
    selectionStart: number;
} | {
    type: 'codeEditor';
    element: HTMLInputElement | HTMLTextAreaElement | null;
    editor: HTMLElement;
    selectionStart: number;
} | {
    type: 'contentEditable';
    element: HTMLElement;
    slashRange: Range;
} | {
    type: 'googleDocs';
    iframe: HTMLIFrameElement;
    caretRange: Range;
} | {
    type: 'googleSheets';
    element: HTMLInputElement | HTMLTextAreaElement;
    selectionStart: number;
} | {
    type: 'googleSheetsGrid';
    deleteCount: number;
    element?: HTMLElement;
};
type WebsiteSnippetShortcutRecord = {
    trigger: string;
    referenceId: string;
    actualReferenceId?: string;
    referenceType: string;
};
const isTextInput = (element: HTMLInputElement) => {
    const allowedTypes = ['text', 'search', 'email', 'url', 'tel'];
    return allowedTypes.includes(element.type);
};
const SNIPPET_POPUP_TRIGGER = 'c/';
const findLastSnippetPopupTrigger = (text: string): number => {
    return text.toLowerCase().lastIndexOf(SNIPPET_POPUP_TRIGGER);
};
const endsWithSnippetPopupTrigger = (text: string): boolean => {
    return text.toLowerCase().endsWith(SNIPPET_POPUP_TRIGGER);
};
const CODE_EDITOR_SELECTOR = [
    '.monaco-editor',
    '.cm-editor',
    '.CodeMirror',
    '.ace_editor'
].join(',');
const CODE_EDITOR_CURSOR_SELECTOR = [
    '.cursor',
    '.monaco-cursor',
    '.cm-cursor',
    '.CodeMirror-cursor',
    '.ace_cursor'
].join(',');
const getCodeEditorHost = (target: HTMLElement | null): HTMLElement | null => {
    return (target?.closest(CODE_EDITOR_SELECTOR) as HTMLElement | null) ?? null;
};
const logGoogleDocsDebug = (message: string, data?: Record<string, unknown>) => {
    console.info(`[cmdOS Snippets][Docs] ${message}`, data ?? '');
};
const getContentEditableHost = (target: HTMLElement | null): HTMLElement | null => {
    if (!target)
        return null;
    const doc = target.ownerDocument;
    if (doc?.designMode?.toLowerCase() === 'on') {
        return doc.body;
    }
    let current: HTMLElement | null = target;
    let editableHost: HTMLElement | null = null;
    while (current && current !== doc.documentElement) {
        const editable = current.getAttribute('contenteditable');
        if (editable === 'false') {
            return null;
        }
        if (editable === '' || editable === 'true' || editable === 'plaintext-only') {
            editableHost = current;
        }
        current = current.parentElement;
    }
    return editableHost ?? (target.isContentEditable ? target : null);
};
const extensionOverlaySelector = '[data-website-popup-layer-host="true"], #cmdos-slash-popup-root';
const isExtensionOverlayElement = (target: EventTarget | null): boolean => {
    if (!target)
        return false;
    if (target instanceof HTMLElement) {
        if (target.closest(extensionOverlaySelector))
            return true;
    }
    if (target instanceof Node) {
        const root = target.getRootNode();
        if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
            if (root.host.matches(extensionOverlaySelector))
                return true;
        }
    }
    return false;
};
const getEditableTargetFromEvent = (event: Event): HTMLElement | null => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const item of path) {
        if (isExtensionOverlayElement(item)) {
            return null;
        }
    }
    if (isExtensionOverlayElement(event.target)) {
        return null;
    }
    for (const item of path) {
        if (!(item instanceof HTMLElement))
            continue;
        if (item instanceof HTMLInputElement && isTextInput(item)) {
            return item;
        }
        if (item instanceof HTMLTextAreaElement) {
            return item;
        }
        if (getContentEditableHost(item)) {
            return item;
        }
        if (getCodeEditorHost(item)) {
            return item;
        }
    }
    return event.target instanceof HTMLElement ? event.target : null;
};
const sanitizeHtml = (html: string): string => {
    if (!html)
        return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    let text = '';
    const getTextWithStructure = (node: Node, context: {
        inOrderedList?: boolean;
        listIndex?: number;
    } = {}) => {
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
                }
                else {
                    text += '• ';
                }
            }
            // Handle children
            if (tagName === 'ol') {
                let index = 1;
                el.childNodes.forEach(child => {
                    if (child.nodeName.toLowerCase() === 'li') {
                        getTextWithStructure(child, { inOrderedList: true, listIndex: index++ });
                    }
                    else {
                        getTextWithStructure(child, context);
                    }
                });
            }
            else if (tagName === 'ul') {
                el.childNodes.forEach(child => {
                    if (child.nodeName.toLowerCase() === 'li') {
                        getTextWithStructure(child, { inOrderedList: false });
                    }
                    else {
                        getTextWithStructure(child, context);
                    }
                });
            }
            else {
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
    return (text
        .replace(/\r/g, '')
        .replace(/&nbsp;/g, ' ')
        // Collapse 3+ newlines to 2
        .replace(/\n{3,}/g, '\n\n')
        // Trim result
        .trim());
};
const buildPreview = (text: string) => {
    if (!text)
        return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > 90 ? `${compact.slice(0, 90)}…` : compact;
};
const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const normalizeLinkUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed)
        return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed))
        return trimmed;
    return `https://${trimmed}`;
};
const extractLinkItemsFromValue = (value: unknown): NonNullable<NoteItem['urls']> => {
    let parsedValue = value;
    if (typeof value === 'string' && value.trim().startsWith('{')) {
        try {
            parsedValue = JSON.parse(value);
        }
        catch {
            parsedValue = value;
        }
    }
    if (parsedValue && typeof parsedValue === 'object') {
        const rawUrls = Array.isArray((parsedValue as any).urls) ? (parsedValue as any).urls : [];
        return rawUrls
            .map((urlItem: unknown) => {
            if (typeof urlItem === 'string') {
                return { url: urlItem };
            }
            if (urlItem && typeof urlItem === 'object') {
                return {
                    id: typeof (urlItem as any).id === 'string' ? (urlItem as any).id : undefined,
                    title: typeof (urlItem as any).title === 'string' ? (urlItem as any).title : undefined,
                    name: typeof (urlItem as any).name === 'string' ? (urlItem as any).name : undefined,
                    url: typeof (urlItem as any).url === 'string' ? (urlItem as any).url.trim() : '',
                    favIconUrl: typeof (urlItem as any).favIconUrl === 'string' ? (urlItem as any).favIconUrl : undefined,
                };
            }
            return null;
        })
            .filter((urlItem: {
            url: string;
        } | null): urlItem is {
            url: string;
        } => Boolean(urlItem?.url));
    }
    if (typeof value === 'string' && value.trim()) {
        return [{ url: value.trim() }];
    }
    return [];
};
const buildLinkPlainText = (title: string, urls: NonNullable<NoteItem['urls']>): string => {
    const lines = urls.map(link => normalizeLinkUrl(link.url)).filter(Boolean);
    if (!lines.length)
        return '';
    return [title.trim(), ...lines].filter(Boolean).join('\n');
};
const buildLinkHtml = (urls: NonNullable<NoteItem['urls']>): string => {
    return urls
        .map(link => {
        const url = normalizeLinkUrl(link.url);
        if (!url)
            return '';
        const label = (link.title || link.name || link.url || url).trim();
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || url)}</a>`;
    })
        .filter(Boolean)
        .join('<br>');
};
const buildNoteFromLinkRecord = (link: any): NoteItem | null => {
    if (!link || typeof link !== 'object')
        return null;
    const id = typeof link.id === 'string' && link.id.trim() ? link.id.trim() : null;
    if (!id)
        return null;
    const urls = Array.isArray(link.urls)
        ? link.urls
            .map((urlItem: any) => ({
            id: typeof urlItem?.id === 'string' ? urlItem.id : undefined,
            title: typeof urlItem?.title === 'string' ? urlItem.title : undefined,
            name: typeof urlItem?.name === 'string' ? urlItem.name : undefined,
            url: typeof urlItem?.url === 'string' ? urlItem.url.trim() : '',
            favIconUrl: typeof urlItem?.favIconUrl === 'string' ? urlItem.favIconUrl : undefined,
        }))
            .filter((urlItem: {
            url: string;
        }) => urlItem.url)
        : [];
    if (!urls.length)
        return null;
    const key = typeof link.title === 'string' && link.title.trim() ? link.title.trim() : urls[0].title || urls[0].url;
    const plainText = buildLinkPlainText(key, urls);
    if (!plainText)
        return null;
    const firstUrl = normalizeLinkUrl(urls[0].url);
    const preview = urls.length > 1 ? `${urls.length} links - ${firstUrl.replace(/^https?:\/\//i, '')}` : firstUrl;
    return {
        id,
        key,
        value: JSON.stringify({ urls }),
        plainText,
        preview: buildPreview(preview),
        tags: Array.isArray(link.tagIds) ? link.tagIds : [],
        category: 'link',
        urls,
    };
};
const buildNoteFromStoredSnippet = (snippet: any): NoteItem | null => {
    const id = String(snippet?.id || '').trim();
    if (!id)
        return null;
    const config = snippet.config;
    const value = typeof config === 'string' ? config : JSON.stringify(config ?? '');
    let plainText = value;
    try {
        const ast = typeof config === 'string' ? JSON.parse(config) : config;
        if (Array.isArray(ast)) {
            plainText = evaluateAst(ast, new RuntimeContext(), { leaveUnresolvedAsBraces: true }).text;
        }
        else {
            plainText = sanitizeHtml(value);
        }
    }
    catch {
        plainText = sanitizeHtml(value);
    }
    const key = String(snippet.title || '').trim() || 'Untitled Text Expander';
    return {
        id,
        key,
        value,
        plainText,
        preview: buildPreview(plainText),
        tags: Array.isArray(snippet.tagIds) ? snippet.tagIds : [],
        category: 'snippet',
        config,
    };
};
const buildNoteFromStoredNote = (note: any): NoteItem | null => {
    const id = String(note?.id || '').trim();
    const body = String(note?.body || '');
    if (!id || !body.trim())
        return null;
    const plainText = sanitizeHtml(body);
    if (!plainText)
        return null;
    return {
        id,
        key: String(note.title || '').trim() || 'Untitled Note',
        value: body,
        plainText,
        preview: buildPreview(plainText),
        tags: Array.isArray(note.tagIds) ? note.tagIds : [],
        category: 'note',
    };
};
const requestWebsiteSnippetLinks = async (): Promise<NoteItem[]> => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage)
        return [];
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage({ action: 'get_website_snippet_links' }, response => {
                if (chrome.runtime.lastError) {
                    console.warn('[SlashNotes] Failed to load IndexedDB links:', chrome.runtime.lastError.message);
                    resolve([]);
                    return;
                }
                if (!response?.ok || !Array.isArray(response.links)) {
                    resolve([]);
                    return;
                }
                resolve(response.links.map(buildNoteFromLinkRecord).filter((item: NoteItem | null): item is NoteItem => Boolean(item)));
            });
        }
        catch (error) {
            console.warn('[SlashNotes] Failed to request IndexedDB links:', error);
            resolve([]);
        }
    });
};
const requestWebsiteSnippetShortcuts = async (): Promise<{
    shortcuts: WebsiteSnippetShortcutRecord[];
    snippets: any[];
    notes: any[];
}> => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        return { shortcuts: [], snippets: [], notes: [] };
    }
    return new Promise(resolve => {
        try {
            chrome.runtime.sendMessage({ action: 'get_website_snippet_shortcuts' }, response => {
                if (chrome.runtime.lastError) {
                    console.warn('[SlashNotes] Failed to load website snippet shortcuts:', chrome.runtime.lastError.message);
                    resolve({ shortcuts: [], snippets: [], notes: [] });
                    return;
                }
                if (!response?.ok || !Array.isArray(response.shortcuts)) {
                    resolve({ shortcuts: [], snippets: [], notes: [] });
                    return;
                }
                resolve({
                    shortcuts: response.shortcuts
                        .map((shortcut: any) => ({
                        trigger: String(shortcut?.trigger || '').trim().toLowerCase(),
                        referenceId: String(shortcut?.referenceId || '').trim(),
                        actualReferenceId: String(shortcut?.actualReferenceId || '').trim(),
                        referenceType: String(shortcut?.referenceType || '').toLowerCase(),
                    }))
                        .filter((shortcut: WebsiteSnippetShortcutRecord) => Boolean(shortcut.trigger) && Boolean(shortcut.referenceId) && Boolean(shortcut.referenceType)),
                    snippets: Array.isArray(response.snippets) ? response.snippets : [],
                    notes: Array.isArray(response.notes) ? response.notes : [],
                });
            });
        }
        catch (error) {
            console.warn('[SlashNotes] Failed to request website snippet shortcuts:', error);
            resolve({ shortcuts: [], snippets: [], notes: [] });
        }
    });
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
    const suffix = day % 10 === 1 && day !== 11
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
// Slight offset so the popup appears lower on standard inputs and avoids overlapping host UI.
const POPUP_VERTICAL_OFFSET = 36;
const CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET = 8;
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
    'MozTabSize'
] as const;
const getInputCaretPosition = (element: HTMLInputElement | HTMLTextAreaElement, selectionStart: number): PopupPosition | null => {
    if (typeof selectionStart !== 'number' || selectionStart < 0)
        return null;
    const doc = element.ownerDocument;
    const win = doc?.defaultView ?? window;
    if (!doc)
        return null;
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
    let caretHeight = spanRect.height ||
        parseFloat(computed.lineHeight || '') ||
        parseFloat(computed.fontSize || '') ||
        elementRect.height ||
        16;
    if (!Number.isFinite(caretHeight))
        caretHeight = 16;
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
    if (!value || typeof value !== 'object')
        return '';
    const urls = Array.isArray(value.urls) ? value.urls : [];
    if (!urls.length)
        return JSON.stringify(value);
    return urls
        .map((url: unknown) => {
        if (typeof url === 'string')
            return url;
        if (url && typeof url === 'object' && typeof (url as any).url === 'string')
            return (url as any).url;
        return '';
    })
        .filter(Boolean)
        .join('\n');
};
const isRawTagId = (tag: string): boolean => {
    if (!tag || typeof tag !== 'string')
        return true;
    const trimmed = tag.trim();
    if (/^TAG_/i.test(trimmed))
        return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed))
        return true;
    return false;
};
const normalizeSnippetTags = (raw: unknown): string[] => {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map(tag => {
        if (!tag)
            return null;
        if (typeof tag === 'object' && typeof (tag as {
            name?: unknown;
        }).name === 'string') {
            const name = ((tag as {
                name: string;
            }).name || '').trim();
            if (name && !isRawTagId(name))
                return name;
        }
        if (typeof tag === 'object' && typeof (tag as {
            label?: unknown;
        }).label === 'string') {
            const label = ((tag as {
                label: string;
            }).label || '').trim();
            if (label && !isRawTagId(label))
                return label;
        }
        if (typeof tag === 'string') {
            const str = tag.trim();
            if (str && !isRawTagId(str))
                return str;
        }
        return null;
    })
        .filter((tag): tag is string => Boolean(tag && tag.trim()));
};
const buildNoteFromSnippet = (snippet: any): NoteItem | null => {
    if (!snippet || typeof snippet !== 'object')
        return null;
    const rawId = typeof snippet.id === 'string' && snippet.id.trim().length > 0 ? snippet.id.trim() : null;
    const rawSnippetId = typeof snippet.snippet_id === 'string' && snippet.snippet_id.trim().length > 0 ? snippet.snippet_id.trim() : null;
    const id = rawId || rawSnippetId;
    const key = typeof snippet.key === 'string' && snippet.key.trim().length > 0 ? snippet.key.trim() : id || 'Untitled note';
    const rawValue = snippet.value;
    let value: string;
    if (typeof rawValue === 'string') {
        if (rawValue.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(rawValue);
                if (typeof parsed.url === 'string') {
                    value = parsed.url;
                }
                else if (Array.isArray(parsed.urls)) {
                    value = extractTabsValue(parsed);
                }
                else {
                    value = rawValue;
                }
            }
            catch {
                value = rawValue;
            }
        }
        else {
            value = rawValue;
        }
    }
    else if (rawValue && typeof rawValue === 'object') {
        value = extractTabsValue(rawValue);
    }
    else {
        value = '';
    }
    if (!value || !value.trim())
        return null;
    const plainText = sanitizeHtml(value);
    if (!plainText)
        return null;
    const tags = normalizeSnippetTags(snippet.tags ?? snippet.snippet_tags);
    const category = typeof snippet.category === 'string'
        ? snippet.category.trim()
        : typeof snippet.snippet_category === 'string'
            ? snippet.snippet_category.trim()
            : undefined;
    const linkUrls = category?.toLowerCase() === 'link' ? extractLinkItemsFromValue(rawValue) : undefined;
    return {
        id: id || `${key}-${plainText.slice(0, 12)}-${Math.random().toString(36).slice(2, 8)}`,
        key,
        value,
        plainText,
        preview: buildPreview(plainText),
        tags,
        category,
        config: snippet.config,
        urls: linkUrls?.length ? linkUrls : undefined,
    };
};
const flattenNotesFromAllData = (rawData: unknown): NoteItem[] => {
    if (!Array.isArray(rawData))
        return [];
    const notes: NoteItem[] = [];
    const seen = new Set<string>();
    const pushSnippet = (snippet: any) => {
        const note = buildNoteFromSnippet(snippet);
        if (!note)
            return;
        // ALLOWED CATEGORIES: note, snippet, link
        if (note.category !== 'note' && note.category !== 'link' && note.category !== 'snippet') {
            return;
        }
        if (seen.has(note.id))
            return;
        seen.add(note.id);
        notes.push(note);
    };
    rawData.forEach(organisationRecord => {
        if (!organisationRecord || typeof organisationRecord !== 'object')
            return;
        const organisations = [organisationRecord];
        organisations.forEach((organisation: any) => {
            if (!organisation || typeof organisation !== 'object')
                return;
            const organisationSnippets = Array.isArray((organisation as any).organisation_snippets)
                ? ((organisation as any).organisation_snippets as any[])
                : [];
            organisationSnippets.forEach(pushSnippet);
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
const getGoogleSheetsCellPosition = (): PopupPosition | null => {
    const selectors = [
        '.waffle-cell-selected',
        '.waffle-cell-active',
        '.grid-cell-input',
        '.cell-input',
        '[role="gridcell"][aria-selected="true"]'
    ];
    for (const selector of selectors) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element)
            continue;
        const rect = element.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0))
            continue;
        return clampPositionToViewport({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 8,
            caretHeight: rect.height || 20,
        });
    }
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    return active ? getElementAnchorPosition(active) : null;
};
const getGoogleDocsVisibleCaretPosition = (): PopupPosition | null => {
    const selectors = [
        '.kix-cursor-caret',
        '.kix-cursor',
        '.docs-text-ui-cursor-blink',
        '.docs-text-ui-cursor',
        '.kix-insert-cursor'
    ];
    for (const selector of selectors) {
        const cursors = Array.from(document.querySelectorAll<HTMLElement>(selector));
        for (const cursor of cursors) {
            const style = window.getComputedStyle(cursor);
            if (style.display === 'none' || style.visibility === 'hidden')
                continue;
            const rect = cursor.getBoundingClientRect();
            if (!rect || (rect.width === 0 && rect.height === 0))
                continue;
            return clampPositionToViewport({
                x: rect.left + window.scrollX,
                y: rect.bottom + window.scrollY + 8,
                caretHeight: rect.height || parseFloat(style.height || '') || 18,
            });
        }
    }
    return null;
};
const getAceCaretPosition = (editor: HTMLElement): PopupPosition | null => {
    if (!editor.classList.contains('ace_editor'))
        return null;
    const cursor = editor.querySelector<HTMLElement>('.ace_cursor-layer .ace_cursor') ??
        editor.querySelector<HTMLElement>('.ace_cursor');
    if (!cursor)
        return null;
    const style = window.getComputedStyle(cursor);
    if (style.display === 'none' || style.visibility === 'hidden')
        return null;
    const rect = cursor.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) {
        return clampPositionToViewport({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 8,
            caretHeight: rect.height || parseFloat(style.height || '') || 18,
        });
    }
    const cursorLayer = cursor.closest<HTMLElement>('.ace_cursor-layer');
    const layerRect = cursorLayer?.getBoundingClientRect();
    const left = parseFloat(style.left || cursor.style.left || '');
    const top = parseFloat(style.top || cursor.style.top || '');
    const height = parseFloat(style.height || cursor.style.height || '') || 18;
    if (!layerRect || !Number.isFinite(left) || !Number.isFinite(top))
        return null;
    return clampPositionToViewport({
        x: layerRect.left + left + window.scrollX,
        y: layerRect.top + top + height + window.scrollY + 8,
        caretHeight: height,
    });
};
const getMonacoCaretPosition = (editor: HTMLElement): PopupPosition | null => {
    if (!editor.classList.contains('monaco-editor'))
        return null;
    const cursor = editor.querySelector<HTMLElement>('.cursors-layer .cursor') ??
        editor.querySelector<HTMLElement>('.view-cursors .cursor') ??
        editor.querySelector<HTMLElement>('.cursor');
    if (!cursor)
        return null;
    const style = window.getComputedStyle(cursor);
    if (style.display === 'none' || style.visibility === 'hidden')
        return null;
    const rect = cursor.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) {
        return clampPositionToViewport({
            x: rect.left + window.scrollX,
            y: rect.bottom + window.scrollY + 8,
            caretHeight: rect.height || parseFloat(style.height || '') || 18,
        });
    }
    const cursorLayer = cursor.closest<HTMLElement>('.cursors-layer') ?? cursor.closest<HTMLElement>('.view-cursors');
    const layerRect = cursorLayer?.getBoundingClientRect();
    const left = parseFloat(style.left || cursor.style.left || '');
    const top = parseFloat(style.top || cursor.style.top || '');
    const height = parseFloat(style.height || cursor.style.height || '') || 18;
    if (!layerRect || !Number.isFinite(left) || !Number.isFinite(top))
        return null;
    return clampPositionToViewport({
        x: layerRect.left + left + window.scrollX,
        y: layerRect.top + top + height + window.scrollY + 8,
        caretHeight: height,
    });
};
const getCodeEditorCaretPosition = (editor: HTMLElement): PopupPosition | null => {
    const monacoPosition = getMonacoCaretPosition(editor);
    if (monacoPosition)
        return monacoPosition;
    const acePosition = getAceCaretPosition(editor);
    if (acePosition)
        return acePosition;
    const cursors = Array.from(editor.querySelectorAll<HTMLElement>(CODE_EDITOR_CURSOR_SELECTOR));
    const cursor = cursors.find(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    });
    if (!cursor)
        return null;
    const rect = cursor.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0))
        return null;
    return clampPositionToViewport({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 8,
        caretHeight: rect.height || 18,
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
const getContentEditableCaretPosition = (element: HTMLElement, range: Range): PopupPosition | null => {
    const rangePosition = getRangeAnchorPosition(range);
    if (rangePosition)
        return rangePosition;
    const doc = element.ownerDocument;
    const win = doc?.defaultView ?? window;
    if (!doc)
        return null;
    const marker = doc.createElement('span');
    marker.setAttribute('data-cmdos-caret-marker', 'true');
    marker.textContent = '\u200B';
    Object.assign(marker.style, {
        display: 'inline-block',
        width: '0',
        height: '1em',
        overflow: 'hidden',
        lineHeight: '1',
        verticalAlign: 'baseline',
        pointerEvents: 'none',
    });
    const markerRange = range.cloneRange();
    try {
        markerRange.collapse(true);
        markerRange.insertNode(marker);
        const rect = marker.getBoundingClientRect();
        const computed = win.getComputedStyle(element);
        const elementRect = element.getBoundingClientRect();
        let caretHeight = rect.height ||
            parseFloat(computed.lineHeight || '') ||
            parseFloat(computed.fontSize || '') ||
            elementRect.height ||
            16;
        if (!Number.isFinite(caretHeight))
            caretHeight = 16;
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            return null;
        }
        return clampPositionToViewport({
            x: rect.left + win.scrollX,
            y: rect.bottom + win.scrollY + 8,
            caretHeight,
        });
    }
    catch {
        return null;
    }
    finally {
        const parent = marker.parentNode;
        marker.remove();
        parent?.normalize();
        const selection = win.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
};
const getRangeRelativeToIframe = (iframe: HTMLIFrameElement, range: Range): PopupPosition | null => {
    const iframeRect = iframe.getBoundingClientRect();
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0))
        return null;
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
            }
            else {
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
            }
            else if (endOffset > 0) {
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
const getContentEditableTextBeforeCaret = (element: HTMLElement, range: Range): string => {
    const probe = range.cloneRange();
    probe.selectNodeContents(element);
    probe.setEnd(range.endContainer, range.endOffset);
    return probe.toString();
};
const dispatchInputEvents = (element: HTMLInputElement | HTMLTextAreaElement) => {
    const inputEvent = new Event('input', { bubbles: true });
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(inputEvent);
    element.dispatchEvent(changeEvent);
};
const CURSOR_MARKER = '\u200B__CURSOR__\u200B';
const FALLBACK_CURSOR_MARKER = '__CURSOR__';
const resolveCursorMarker = (text: string, cursorOffset?: number) => {
    let cleanedText = text;
    let resolvedOffset = cursorOffset;
    const markerIndex = cleanedText.indexOf(CURSOR_MARKER);
    if (markerIndex !== -1) {
        cleanedText = cleanedText.replace(CURSOR_MARKER, '');
        resolvedOffset = markerIndex;
    }
    else {
        const fallbackIndex = cleanedText.indexOf(FALLBACK_CURSOR_MARKER);
        if (fallbackIndex !== -1) {
            cleanedText = cleanedText.replace(FALLBACK_CURSOR_MARKER, '');
            resolvedOffset = fallbackIndex;
        }
    }
    return { cleanedText, resolvedOffset };
};
const setStandardInputCaret = (element: HTMLInputElement | HTMLTextAreaElement, position: number) => {
    const caretPosition = Math.max(0, Math.min(position, element.value.length));
    try {
        element.focus({ preventScroll: true });
    }
    catch {
        element.focus();
    }
    element.setSelectionRange(caretPosition, caretPosition);
    requestAnimationFrame(() => {
        if (!element.isConnected)
            return;
        element.setSelectionRange(caretPosition, caretPosition);
    });
};
class WebsiteSnippetInjector {
    private notes: NoteItem[] = [];
    private shortcutCommands: WebsiteSnippetShortcutRecord[] = [];
    private popupContainer: HTMLDivElement | null = null;
    private popupRoot: Root | null = null;
    private shadowRoot: ShadowRoot | null = null;
    private shadowContainer: HTMLDivElement | null = null;
    private isOpen = false;
    private triggerContext: TriggerContext | null = null;
    private focusedElement: SupportedInputElement | null = null;
    private lastTriggerTimestamp = 0;
    private readonly googleDocs = window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/document/');
    private readonly googleSheets = window.location.hostname === 'docs.google.com' && window.location.pathname.includes('/spreadsheets/');
    private docsIframe: HTMLIFrameElement | null = null;
    private docsSlashCount = 0;
    private loadNotesPromise: Promise<void> | null = null;
    private pendingTrigger: (() => void) | null = null;
    private injectedDocsIframes = new WeakSet<HTMLIFrameElement>();
    private injectedDocsIframeLoaders = new WeakMap<HTMLIFrameElement, Promise<void>>();
    private docsTypedBuffer = '';
    private sheetsTypedBuffer = '';
    private codeEditorTypedBuffer = '';
    private searchQuery = ''; // Track text typed after c/
    private selectedPopupNoteId: string | null = null;
    private snippetExpansionActive = false;
    private sharedShortcutPicker: {
        notes: NoteItem[];
        context: TriggerContext;
        deleteCount: number;
        textBefore: string;
    } | null = null;
    private popupRenderGeneration = 0;
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
        chrome.runtime.onMessage.addListener(request => {
            if (request?.action === 'db_changed' &&
                ['notes', 'snippets', 'links', 'userShortcuts', 'shortcutsMap', 'prefixSettings'].includes(String(request.table || ''))) {
                this.loadNotesPromise = null;
                void this.loadNotes();
            }
        });
    }
    private async loadNotes(): Promise<void> {
        if (this.loadNotesPromise) {
            await this.loadNotesPromise;
            return;
        }
        if (this.sharedShortcutPicker)
            this.closePopup();
        this.loadNotesPromise = (async () => {
            try {
                const result = await chrome.storage.local.get(['snippets_cache', 'local_ast_snippets']);
                const fallbackNotes: NoteItem[] = [];
                if (result?.snippets_cache && typeof result.snippets_cache === 'object') {
                    const entries = Object.entries(result.snippets_cache as Record<string, unknown>);
                    entries.forEach(([key, value]) => {
                        if (typeof value !== 'string' || !value.trim())
                            return;
                        const plainText = sanitizeHtml(value);
                        if (!plainText)
                            return;
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
                                }
                                else if (astObj.value && typeof astObj.value === 'string' && astObj.value.trim().startsWith('[')) {
                                    snippetAst = JSON.parse(astObj.value);
                                }
                            }
                            catch (e) {
                                console.warn('Failed to parse snippet value as AST', e);
                            }
                            let plainText = astObj.value;
                            if (Array.isArray(snippetAst)) {
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
                const [linkNotes, shortcutConfig] = await Promise.all([
                    requestWebsiteSnippetLinks(),
                    requestWebsiteSnippetShortcuts()
                ]);
                const liveNotes = [
                    ...shortcutConfig.snippets.map(buildNoteFromStoredSnippet),
                    ...shortcutConfig.notes.map(buildNoteFromStoredNote),
                    ...linkNotes
                ].filter((note): note is NoteItem => Boolean(note));
                liveNotes.forEach(note => {
                    const index = baseNotes.findIndex(candidate => candidate.id === note.id && (candidate.category || 'snippet') === note.category);
                    if (index === -1)
                        baseNotes.push(note);
                    else
                        baseNotes[index] = note;
                });
                this.shortcutCommands = shortcutConfig.shortcuts;
                this.notes = baseNotes;
            }
            catch (error) {
                console.error('[SlashNotes] Failed to load notes:', error);
                this.notes = [];
                this.shortcutCommands = [];
            }
            finally {
                this.loadNotesPromise = null;
            }
        })();
        await this.loadNotesPromise;
    }
    private getCompletedShortcutCandidates(textBefore: string): Array<{
        value: string;
        deleteCount: number;
    }> {
        const normalizedText = String(textBefore || '').replace(/\u00A0/g, ' ');
        const trailingWhitespace = normalizedText.match(/ +$/)?.[0] || '';
        if (!trailingWhitespace)
            return [];
        const textWithoutTrailingWhitespace = normalizedText.slice(0, normalizedText.length - trailingWhitespace.length);
        const tokenMatches = Array.from(textWithoutTrailingWhitespace.matchAll(/\S+/g));
        const candidates: Array<{
            value: string;
            deleteCount: number;
        }> = [];
        for (let count = Math.min(3, tokenMatches.length); count >= 1; count -= 1) {
            const firstToken = tokenMatches[tokenMatches.length - count];
            const startIndex = firstToken.index ?? 0;
            const rawValue = textWithoutTrailingWhitespace.slice(startIndex);
            candidates.push({
                value: rawValue.replace(/\s+/g, ' ').trim(),
                deleteCount: normalizedText.length - startIndex,
            });
        }
        return candidates;
    }
    private getNoteByShortcut(shortcut: WebsiteSnippetShortcutRecord): NoteItem | null {
        const referenceIds = new Set([shortcut.referenceId, shortcut.actualReferenceId, extractSnippetIdFromCompoundId(shortcut.referenceId)]
            .map(id => String(id || '').trim())
            .filter(Boolean));
        const shortcutType = String(shortcut.referenceType || '').toLowerCase();
        return (this.notes.find(note => {
            const noteType = note.category?.toLowerCase() || 'snippet';
            if (shortcutType === 'note' && noteType !== 'note')
                return false;
            if (shortcutType === 'snippet' && noteType !== 'snippet')
                return false;
            if (shortcutType === 'link' && noteType !== 'link')
                return false;
            return referenceIds.has(String(note.id || '').trim()) || referenceIds.has(extractSnippetIdFromCompoundId(note.id));
        }));
    }
    private getDirectInsertionPayload(note: NoteItem): {
        text: string;
        html?: string;
    } {
        if (note.category?.toLowerCase() === 'link') {
            const urls = note.urls?.length ? note.urls : extractLinkItemsFromValue(note.value);
            return {
                text: buildLinkPlainText(note.key, urls),
                html: buildLinkHtml(urls),
            };
        }
        if (note.category?.toLowerCase() === 'snippet' && note.config) {
            try {
                const ast = typeof note.config === 'string' ? JSON.parse(note.config) : note.config;
                if (Array.isArray(ast)) {
                    const text = evaluateAst(ast, new RuntimeContext(), { leaveUnresolvedAsBraces: true }).text;
                    return { text, html: escapeHtml(text).replace(/\n/g, '<br>') };
                }
            }
            catch {
                // Plain text snippets continue through the existing payload path.
            }
        }
        let htmlSnippet = note.value || note.plainText;
        if (htmlSnippet && !/<[a-z][\s\S]*>/i.test(htmlSnippet)) {
            htmlSnippet = htmlSnippet.replace(/\n/g, '<br>');
        }
        return {
            text: note.plainText,
            html: htmlSnippet,
        };
    }
    private findDirectShortcutMatch(textBefore: string): {
        deleteCount: number;
        text: string;
        html?: string;
        note: NoteItem;
    } | null {
        if (!this.shortcutCommands.length)
            return null;
        for (const candidate of this.getCompletedShortcutCandidates(textBefore)) {
            const normalizedCandidate = candidate.value.toLowerCase();
            if (!normalizedCandidate.startsWith('c_'))
                continue;
            const trigger = normalizedCandidate.slice(2);
            if (!trigger || /\s/.test(trigger))
                continue;
            const matches = this.shortcutCommands.filter(record => record.trigger === trigger);
            // Shared commands open the same picker with explicit item selection.
            const shortcut = matches.length === 1 ? matches[0] : undefined;
            if (!shortcut)
                continue;
            const note = this.getNoteByShortcut(shortcut);
            if (!note)
                continue;
            const payload = this.getDirectInsertionPayload(note);
            if (!payload.text && !payload.html)
                continue;
            return {
                deleteCount: candidate.deleteCount,
                text: payload.text,
                html: payload.html,
                note,
            };
        }
        return null;
    }
    /** Keep the original trigger in the host field until an assigned item is selected. */
    private openSharedShortcutPicker(textBefore: string, context: TriggerContext, position: PopupPosition): boolean {
        const previous = this.sharedShortcutPicker;
        if (previous?.textBefore === textBefore && previous.context.type === context.type
            && (('element' in context && 'element' in previous.context && context.element === previous.context.element)
                || (context.type === 'googleDocs' && previous.context.type === 'googleDocs' && context.iframe === previous.context.iframe)
                || context.type === 'googleSheetsGrid'))
            return true;
        if (this.sharedShortcutPicker)
            this.closePopup();
        for (const candidate of this.getCompletedShortcutCandidates(textBefore)) {
            const value = candidate.value.toLowerCase();
            if (!value.startsWith('c_'))
                continue;
            const trigger = value.slice(2);
            if (!trigger || /\s/.test(trigger))
                continue;
            const matches = this.shortcutCommands.filter(record => record.trigger === trigger);
            if (matches.length < 2)
                continue;
            const seen = new Set<string>();
            const notes = matches.flatMap(record => {
                const note = this.getNoteByShortcut(record);
                if (!note || seen.has(note.id))
                    return [];
                seen.add(note.id);
                return [note];
            });
            if (!notes.length)
                return false;
            this.sharedShortcutPicker = { notes, context, deleteCount: candidate.deleteCount, textBefore };
            this.triggerContext = context;
            this.searchQuery = '';
            this.selectedPopupNoteId = notes[0].id;
            void this.renderPopup(position, '', CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
            return true;
        }
        return false;
    }
    private selectPopupNote(note: NoteItem) {
        const shared = this.sharedShortcutPicker;
        if (shared && !shared.notes.some(item => item.id === note.id))
            return;
        if (shared && 'element' in shared.context && shared.context.element) {
            const element = shared.context.element;
            if (!element.isConnected) {
                this.closePopup();
                return;
            }
            if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && 'selectionStart' in shared.context) {
                if (element.selectionStart !== shared.context.selectionStart
                    || element.value.slice(0, element.selectionStart ?? 0) !== shared.textBefore) {
                    this.closePopup();
                    return;
                }
            }
            if (shared.context.type === 'contentEditable'
                && shared.context.slashRange.toString() !== shared.textBefore.slice(-shared.deleteCount)) {
                this.closePopup();
                return;
            }
        }
        void this.insertNote(note, shared ? { context: shared.context, deleteCount: shared.deleteCount } : undefined);
    }
    private checkAndReplaceSnippet(textBefore: string, replaceCallback: (deleteCount: number, text: string, html?: string, note?: NoteItem) => void): boolean {
        const shortcutMatch = this.findDirectShortcutMatch(textBefore);
        if (shortcutMatch) {
            replaceCallback(shortcutMatch.deleteCount, shortcutMatch.text, shortcutMatch.html, shortcutMatch.note);
            return true;
        }
        const triggers = ['/t', 'c//'];
        for (const trigger of triggers) {
            const lastTriggerIndex = textBefore.lastIndexOf(trigger);
            if (lastTriggerIndex === -1)
                continue;
            const rawPotentialKey = textBefore.slice(lastTriggerIndex + trigger.length);
            if (!rawPotentialKey)
                continue;
            const potentialKey = rawPotentialKey.trimStart();
            const note = this.notes.find(n => n.category?.toLowerCase() === 'snippet' && n.key === potentialKey);
            if (note) {
                // We need to delete everything from the trigger start to the cursor
                // This includes the trigger, any whitespace, and the key
                const matchLength = textBefore.length - lastTriggerIndex;
                const payload = this.getDirectInsertionPayload(note);
                replaceCallback(matchLength, payload.text, payload.html);
                return true;
            }
        }
        return false;
    }
    private getFilteredSnippetNotes(query: string = this.searchQuery): NoteItem[] {
        if (this.sharedShortcutPicker)
            return this.sharedShortcutPicker.notes;
        const snippetNotes = this.notes.filter(note => ['snippet', 'link'].includes(note.category?.toLowerCase() || ''));
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery) {
            return snippetNotes;
        }
        return snippetNotes.filter(note => {
            const titleMatch = note.key.toLowerCase().includes(trimmedQuery);
            const valueMatch = note.plainText.toLowerCase().includes(trimmedQuery);
            const urlsMatch = note.urls?.some(link => link.url.toLowerCase().includes(trimmedQuery) ||
                (link.title || '').toLowerCase().includes(trimmedQuery) ||
                (link.name || '').toLowerCase().includes(trimmedQuery));
            const tagsMatch = note.tags.some(tag => tag.toLowerCase().includes(trimmedQuery));
            return titleMatch || valueMatch || urlsMatch || tagsMatch;
        });
    }
    private selectFirstPopupSnippet(event?: KeyboardEvent) {
        const matches = this.getFilteredSnippetNotes();
        const note = matches.find(item => item.id === this.selectedPopupNoteId) || matches[0];
        if (!note) {
            if (this.triggerContext?.type === 'googleDocs') {
                logGoogleDocsDebug('Popup selection requested but no matching snippet exists', {
                    query: this.searchQuery,
                    notesCount: this.notes.length,
                });
            }
            return;
        }
        event?.preventDefault();
        event?.stopPropagation();
        if (this.triggerContext?.type === 'googleDocs') {
            logGoogleDocsDebug('Selecting first popup snippet', {
                snippetId: note.id,
                key: note.key,
            });
        }
        this.selectPopupNote(note);
    }
    private movePopupSelection(delta: number) {
        const matches = this.getFilteredSnippetNotes();
        if (!matches.length)
            return;
        const index = matches.findIndex(item => item.id === this.selectedPopupNoteId);
        const nextIndex = (Math.max(index, 0) + delta + matches.length) % matches.length;
        this.selectedPopupNoteId = matches[nextIndex].id;
        if (this.popupRoot && this.popupContainer) {
            const context = this.triggerContext;
            const position = context?.type === 'googleDocs'
                ? getGoogleDocsVisibleCaretPosition() || getElementAnchorPosition(context.iframe)
                : context?.type === 'googleSheetsGrid' ? getGoogleSheetsCellPosition()
                    : context?.type === 'input' || context?.type === 'googleSheets'
                        ? getInputCaretPosition(context.element, context.element.selectionStart ?? context.selectionStart) || getElementAnchorPosition(context.element)
                        : context?.type === 'codeEditor' ? getCodeEditorCaretPosition(context.editor) || getElementAnchorPosition(context.editor)
                            : context?.type === 'contentEditable'
                                ? getContentEditableCaretPosition(context.element, context.slashRange) || getElementAnchorPosition(context.element) : null;
            if (position)
                this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
        }
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
        document.addEventListener('focusin', event => {
            const target = getEditableTargetFromEvent(event);
            if (!target)
                return;
            if (target instanceof HTMLInputElement && isTextInput(target)) {
                this.focusedElement = target;
            }
            else if (target instanceof HTMLTextAreaElement) {
                this.focusedElement = target;
            }
            else {
                const contentEditableHost = getContentEditableHost(target);
                if (contentEditableHost) {
                    this.focusedElement = contentEditableHost;
                }
            }
        }, true);
        document.addEventListener('focusout', event => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (event.target === this.focusedElement || path.includes(this.focusedElement as EventTarget)) {
                this.focusedElement = null;
            }
        }, true);
    }
    private setupInputListeners() {
        document.addEventListener('input', event => {
            if (!event.isTrusted || (event as InputEvent).isComposing)
                return;
            // IGNORE AUTOMATION EVENTS
            if ((window as any).__supercommands_automation_active ||
                (window as any).__cmdos_automation_active ||
                (event as any).isAutomation) {
                return;
            }
            const target = getEditableTargetFromEvent(event);
            if (!target)
                return;
            if (target instanceof HTMLInputElement && isTextInput(target)) {
                this.tryTriggerForInput(target);
            }
            else if (target instanceof HTMLTextAreaElement) {
                this.tryTriggerForInput(target);
            }
            else {
                const contentEditableHost = getContentEditableHost(target);
                if (contentEditableHost) {
                    this.tryTriggerForContentEditable(contentEditableHost);
                }
            }
        }, true);
    }
    private setupGlobalKeyListeners() {
        // Handle shared choices before the lazily loaded dropdown mounts, and once
        // per key even after its own window listener is registered.
        window.addEventListener('keydown', event => {
            if (!event.isTrusted || event.isComposing || !this.sharedShortcutPicker || !this.isOpen)
                return;
            if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key))
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.key === 'Escape')
                this.closePopup();
            else if (event.key === 'Enter')
                this.selectFirstPopupSnippet();
            else
                this.movePopupSelection(event.key === 'ArrowDown' ? 1 : -1);
        }, true);
        document.addEventListener('selectionchange', () => {
            if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
                this.validateOpenContentEditablePopup();
            }
        }, true);
        document.addEventListener('keyup', event => {
            if (!event.isTrusted || event.isComposing)
                return;
            if (event.key === 'Escape' && this.isOpen) {
                event.stopPropagation();
                this.closePopup();
                return;
            }
            if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
                if (isExtensionOverlayElement(event.target)) {
                    return;
                }
                const target = getEditableTargetFromEvent(event) ||
                    (document.activeElement instanceof HTMLElement && !isExtensionOverlayElement(document.activeElement)
                        ? document.activeElement
                        : null) ||
                    (this.focusedElement && !isExtensionOverlayElement(this.focusedElement) ? this.focusedElement : null);
                if (!target || isExtensionOverlayElement(target)) {
                    return;
                }
                const codeEditor = getCodeEditorHost(target) || getCodeEditorHost(document.activeElement as HTMLElement | null);
                if (codeEditor && !(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
                    this.handleCodeEditorSurfaceKey(event, codeEditor);
                    return;
                }
                const contentEditableHost = getContentEditableHost(target) || getContentEditableHost(this.focusedElement);
                if (contentEditableHost) {
                    this.tryTriggerForContentEditable(contentEditableHost);
                }
            }
        }, true);
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
            logGoogleDocsDebug('Attached key listener to docs text event iframe', {
                iframeSrc: iframe.src || '(no src)',
                iframeReadyState: doc.readyState,
            });
        };
        pollIframe();
    }
    private setupGoogleSheets() {
        document.addEventListener('keydown', event => {
            if (!this.googleSheets)
                return;
            if (!event.isTrusted || event.isComposing)
                return;
            const target = getEditableTargetFromEvent(event);
            if (!target)
                return;
            if (this.sharedShortcutPicker && this.triggerContext?.type === 'googleSheetsGrid'
                && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
                this.closePopup();
                this.sheetsTypedBuffer = '';
            }
            if (this.isOpen && this.triggerContext?.type === 'googleSheetsGrid') {
                if (event.key === 'Enter') {
                    this.selectFirstPopupSnippet(event);
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    this.closePopup();
                    return;
                }
                if (event.key === 'Backspace') {
                    if (!this.searchQuery) {
                        this.closePopup();
                        this.sheetsTypedBuffer = '';
                        return;
                    }
                    this.searchQuery = this.searchQuery.slice(0, -1);
                    this.sheetsTypedBuffer = `c/${this.searchQuery}`;
                    const position = getGoogleSheetsCellPosition();
                    if (position) {
                        this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                    }
                    return;
                }
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    this.searchQuery += event.key;
                    this.sheetsTypedBuffer = `c/${this.searchQuery}`;
                    const position = getGoogleSheetsCellPosition();
                    if (position) {
                        this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                    }
                    return;
                }
            }
            const isFormulaBar = target instanceof HTMLInputElement &&
                target.id === 't-formula-bar-input' &&
                isTextInput(target as HTMLInputElement);
            // The normal input listener sees the committed Space and owns direct shortcuts.
            // Handling it here would expand twice or remove a Space that never entered the cell.
            if (isFormulaBar)
                return;
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                this.sheetsTypedBuffer = `${this.sheetsTypedBuffer}${event.key}`.slice(-50);
            }
            else if (event.key === 'Backspace') {
                this.sheetsTypedBuffer = this.sheetsTypedBuffer.slice(0, -1);
            }
            else if (event.key === 'Escape' || event.key === 'Enter') {
                this.sheetsTypedBuffer = '';
            }
            if (event.key === ' ') {
                const position = getGoogleSheetsCellPosition();
                if (position && this.openSharedShortcutPicker(this.sheetsTypedBuffer, { type: 'googleSheetsGrid', deleteCount: 0 }, position))
                    return;
                const match = this.findDirectShortcutMatch(this.sheetsTypedBuffer);
                if (match?.note.category?.toLowerCase() === 'snippet') {
                    this.sheetsTypedBuffer = '';
                    setTimeout(() => {
                        void this.insertNote(match.note, {
                            context: { type: 'googleSheetsGrid', deleteCount: match.deleteCount, element: target },
                            deleteCount: match.deleteCount,
                        });
                    }, 0);
                    return;
                }
            }
            if (!endsWithSnippetPopupTrigger(this.sheetsTypedBuffer))
                return;
            this.sheetsTypedBuffer = '';
            const position = getGoogleSheetsCellPosition();
            if (!position)
                return;
            this.runWithNotes(() => {
                this.triggerContext = {
                    type: 'googleSheetsGrid',
                    deleteCount: 2,
                };
                this.searchQuery = '';
                this.renderPopup(position, '', CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
            });
        }, true);
    }
    private handleGoogleDocsKeyDown = (event: KeyboardEvent) => {
        if (!event.isTrusted || event.isComposing)
            return;
        const iframe = this.docsIframe;
        if (!iframe)
            return;
        const doc = iframe.contentDocument;
        if (!doc)
            return;
        if (this.sharedShortcutPicker && this.triggerContext?.type === 'googleDocs'
            && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
            this.closePopup();
            this.docsTypedBuffer = '';
        }
        if (this.isOpen && this.triggerContext?.type === 'googleDocs') {
            if (event.key === 'Enter') {
                logGoogleDocsDebug('Enter pressed while popup is open');
                this.selectFirstPopupSnippet(event);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closePopup();
                return;
            }
            if (event.key === 'Backspace') {
                if (!this.searchQuery) {
                    this.closePopup();
                    this.docsTypedBuffer = '';
                    return;
                }
                this.searchQuery = this.searchQuery.slice(0, -1);
                this.docsTypedBuffer = `c/${this.searchQuery}`;
                requestAnimationFrame(() => {
                    const selection = iframe.contentWindow?.getSelection();
                    const currentRange = selection && selection.rangeCount
                        ? selection.getRangeAt(0).cloneRange()
                        : this.triggerContext?.type === 'googleDocs'
                            ? this.triggerContext.caretRange.cloneRange()
                            : null;
                    const position = getGoogleDocsVisibleCaretPosition() ||
                        (currentRange ? getRangeRelativeToIframe(iframe, currentRange) : null) ||
                        getElementAnchorPosition(iframe);
                    if (position) {
                        this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                    }
                });
                return;
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                this.searchQuery += event.key;
                this.docsTypedBuffer = `c/${this.searchQuery}`;
                requestAnimationFrame(() => {
                    const selection = iframe.contentWindow?.getSelection();
                    const currentRange = selection && selection.rangeCount
                        ? selection.getRangeAt(0).cloneRange()
                        : this.triggerContext?.type === 'googleDocs'
                            ? this.triggerContext.caretRange.cloneRange()
                            : null;
                    const position = getGoogleDocsVisibleCaretPosition() ||
                        (currentRange ? getRangeRelativeToIframe(iframe, currentRange) : null) ||
                        getElementAnchorPosition(iframe);
                    if (position) {
                        this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                    }
                });
                return;
            }
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.docsTypedBuffer += event.key;
            if (event.key === ' ') {
                const selection = iframe.contentWindow?.getSelection();
                const range = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
                const position = getGoogleDocsVisibleCaretPosition() || (range ? getRangeRelativeToIframe(iframe, range) : null)
                    || getElementAnchorPosition(iframe);
                if (range && this.openSharedShortcutPicker(this.docsTypedBuffer, { type: 'googleDocs', iframe, caretRange: range }, position))
                    return;
            }
            this.checkAndReplaceSnippet(this.docsTypedBuffer, (deleteCount, text, html, note) => {
                this.docsTypedBuffer = '';
                if (note?.category?.toLowerCase() === 'snippet') {
                    setTimeout(() => {
                        const selection = iframe.contentWindow?.getSelection();
                        const range = selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
                        if (range)
                            void this.insertNote(note, { context: { type: 'googleDocs', iframe, caretRange: range }, deleteCount });
                    }, 0);
                    return;
                }
                logGoogleDocsDebug('Direct exact snippet trigger matched', {
                    deleteCount,
                    textLength: text.length,
                    hasHtml: Boolean(html),
                });
                const selection = iframe.contentWindow?.getSelection();
                const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
                setTimeout(() => {
                    this.insertIntoGoogleDocs(iframe, range!, text, html, deleteCount);
                }, 0);
            });
        }
        else if (event.key === 'Backspace') {
            this.docsTypedBuffer = this.docsTypedBuffer.slice(0, -1);
        }
        else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            if (this.docsTypedBuffer.length > 100) {
                this.docsTypedBuffer = this.docsTypedBuffer.slice(-50);
            }
        }
        if (event.key.toLowerCase() === 'c') {
            this.docsSlashCount = 1;
        }
        else if (event.key === '/' && this.docsSlashCount === 1) {
            this.docsSlashCount = 2;
        }
        else {
            this.docsSlashCount = 0;
        }
        if (this.docsSlashCount >= 2) {
            this.docsSlashCount = 0;
            const selection = iframe.contentWindow?.getSelection();
            if (!selection || !selection.rangeCount) {
                logGoogleDocsDebug('c/ detected but iframe selection range is missing');
                return;
            }
            const caretRange = selection.getRangeAt(0).cloneRange();
            const openPopup = () => {
                const docSelection = iframe.contentWindow?.getSelection();
                const currentRange = docSelection && docSelection.rangeCount ? docSelection.getRangeAt(0).cloneRange() : caretRange.cloneRange();
                const position = getGoogleDocsVisibleCaretPosition() ||
                    getRangeRelativeToIframe(iframe, currentRange) ||
                    getElementAnchorPosition(iframe);
                if (!position) {
                    logGoogleDocsDebug('c/ detected but no popup position could be resolved');
                    return;
                }
                this.triggerContext = {
                    type: 'googleDocs',
                    iframe,
                    caretRange: currentRange,
                };
                logGoogleDocsDebug('Opening popup for c/ trigger', {
                    x: Math.round(position.x),
                    y: Math.round(position.y),
                    visibleCaretFound: Boolean(getGoogleDocsVisibleCaretPosition()),
                    notesCount: this.notes.length,
                });
                this.renderPopup(position, '', CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
            };
            this.runWithNotes(() => {
                requestAnimationFrame(openPopup);
            });
        }
    };
    private handleCodeEditorSurfaceKey(event: KeyboardEvent, editor: HTMLElement) {
        if (this.sharedShortcutPicker && this.triggerContext?.type === 'codeEditor'
            && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) {
            this.closePopup();
            this.codeEditorTypedBuffer = '';
        }
        if (this.isOpen && this.triggerContext?.type === 'codeEditor') {
            if (event.key === 'Enter') {
                this.selectFirstPopupSnippet(event);
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closePopup();
                return;
            }
            if (event.key === 'Backspace') {
                if (!this.searchQuery) {
                    this.closePopup();
                    this.codeEditorTypedBuffer = '';
                    return;
                }
                this.searchQuery = this.searchQuery.slice(0, -1);
                this.codeEditorTypedBuffer = `c/${this.searchQuery}`;
                const position = getCodeEditorCaretPosition(editor) || getElementAnchorPosition(editor);
                this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                return;
            }
            if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                this.searchQuery += event.key;
                this.codeEditorTypedBuffer = `c/${this.searchQuery}`;
                const position = getCodeEditorCaretPosition(editor) || getElementAnchorPosition(editor);
                this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                return;
            }
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            this.codeEditorTypedBuffer = `${this.codeEditorTypedBuffer}${event.key}`.slice(-50);
        }
        else if (event.key === 'Backspace') {
            this.codeEditorTypedBuffer = this.codeEditorTypedBuffer.slice(0, -1);
        }
        else if (event.key === 'Escape' || event.key === 'Enter') {
            this.codeEditorTypedBuffer = '';
        }
        if (event.key === ' ') {
            const position = getCodeEditorCaretPosition(editor) || getElementAnchorPosition(editor);
            if (this.openSharedShortcutPicker(this.codeEditorTypedBuffer, { type: 'codeEditor', element: null, editor, selectionStart: 0 }, position))
                return;
            const match = this.findDirectShortcutMatch(this.codeEditorTypedBuffer);
            if (match?.note.category?.toLowerCase() === 'snippet') {
                this.codeEditorTypedBuffer = '';
                setTimeout(() => {
                    void this.insertNote(match.note, {
                        context: { type: 'codeEditor', element: null, editor, selectionStart: 0 },
                        deleteCount: match.deleteCount,
                    });
                }, 0);
                return;
            }
        }
        if (!endsWithSnippetPopupTrigger(this.codeEditorTypedBuffer))
            return;
        this.codeEditorTypedBuffer = '';
        const position = getCodeEditorCaretPosition(editor) || getElementAnchorPosition(editor);
        this.runWithNotes(() => {
            this.triggerContext = {
                type: 'codeEditor',
                element: document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement
                    ? document.activeElement
                    : null,
                editor,
                selectionStart: 0,
            };
            this.searchQuery = '';
            this.renderPopup(position, '', CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
        });
    }
    private tryTriggerForInput(element: HTMLInputElement | HTMLTextAreaElement) {
        if (element instanceof HTMLInputElement && !isTextInput(element))
            return;
        if (element.readOnly || element.disabled)
            return;
        if (element.selectionStart === null)
            return;
        const selectionStart = element.selectionStart;
        const valueBefore = element.value.slice(0, selectionStart);
        const codeEditor = getCodeEditorHost(element);
        const sharedContext: TriggerContext = codeEditor
            ? { type: 'codeEditor', element, editor: codeEditor, selectionStart }
            : this.googleSheets && element.id === 't-formula-bar-input'
                ? { type: 'googleSheets', element, selectionStart }
                : { type: 'input', element, selectionStart };
        const sharedPosition = (codeEditor ? getCodeEditorCaretPosition(codeEditor) : null)
            || getInputCaretPosition(element, selectionStart) || getElementAnchorPosition(element);
        if (this.openSharedShortcutPicker(valueBefore, sharedContext, sharedPosition))
            return;
        const handled = this.checkAndReplaceSnippet(valueBefore, (deleteCount, text, _html, note) => {
            if (note?.category?.toLowerCase() === 'snippet') {
                void this.insertNote(note, { context: sharedContext, deleteCount });
                return;
            }
            if (codeEditor) {
                this.insertIntoCodeEditor(element, selectionStart, text, deleteCount);
                return;
            }
            this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
        });
        if (handled)
            return;
        const slashIndex = findLastSnippetPopupTrigger(valueBefore);
        if (this.isOpen && this.triggerContext?.type === 'codeEditor') {
            if (slashIndex === -1) {
                this.closePopup();
                return;
            }
            const newQuery = valueBefore.slice(slashIndex + 2);
            this.searchQuery = newQuery;
            const editorPosition = getCodeEditorCaretPosition(this.triggerContext.editor);
            const caretPosition = editorPosition || getInputCaretPosition(element, selectionStart);
            const position = caretPosition || getElementAnchorPosition(this.triggerContext.editor);
            this.renderPopup(position, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
            return;
        }
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
        if (!endsWithSnippetPopupTrigger(valueBefore))
            return;
        const openPopup = () => {
            if (!element.isConnected)
                return;
            if (!endsWithSnippetPopupTrigger(element.value.slice(0, selectionStart)))
                return;
            this.slashPosition = selectionStart - 2;
            this.searchQuery = '';
            if (codeEditor) {
                const editorPosition = getCodeEditorCaretPosition(codeEditor);
                const caretPosition = editorPosition || getInputCaretPosition(element, selectionStart);
                const position = caretPosition || getElementAnchorPosition(codeEditor);
                this.triggerContext = {
                    type: 'codeEditor',
                    element,
                    editor: codeEditor,
                    selectionStart,
                };
                this.renderPopup(position, '', CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
                return;
            }
            this.openPopupForElement(element, selectionStart, 'input');
        };
        this.runWithNotes(() => {
            requestAnimationFrame(openPopup);
        });
    }
    private tryTriggerForContentEditable(element: HTMLElement) {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
                this.closePopup();
            }
            return;
        }
        const range = selection.getRangeAt(0);
        if (!element.contains(range.endContainer)) {
            if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
                this.closePopup();
            }
            return;
        }
        const textBefore = getContentEditableTextBeforeCaret(element, range);
        const completed = this.getCompletedShortcutCandidates(textBefore).find(candidate => /^c_[^\s]+$/i.test(candidate.value));
        if (completed) {
            const sharedRange = buildSlashRange(element, range, completed.deleteCount);
            const position = getContentEditableCaretPosition(element, range) || getElementAnchorPosition(element);
            if (sharedRange && this.openSharedShortcutPicker(textBefore, { type: 'contentEditable', element, slashRange: sharedRange.cloneRange() }, position))
                return;
        }
        else if (this.sharedShortcutPicker)
            this.closePopup();
        const handled = this.checkAndReplaceSnippet(textBefore, (deleteCount, text, html, note) => {
            const slashRange = buildSlashRange(element, range, deleteCount);
            if (slashRange) {
                if (note?.category?.toLowerCase() === 'snippet') {
                    void this.insertNote(note, { context: { type: 'contentEditable', element, slashRange }, deleteCount });
                    return;
                }
                this.insertIntoContentEditable(element, slashRange, text, html);
            }
        });
        if (handled)
            return;
        const slashIndex = findLastSnippetPopupTrigger(textBefore);
        if (this.isOpen && this.triggerContext?.type === 'contentEditable') {
            if (slashIndex === -1) {
                this.closePopup();
                return;
            }
            const newQuery = textBefore.slice(slashIndex + 2);
            this.searchQuery = newQuery;
            const currentSelection = window.getSelection();
            const currentRange = currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : range;
            const anchorPosition = getContentEditableCaretPosition(element, currentRange) || getElementAnchorPosition(element);
            if (anchorPosition) {
                this.renderPopup(anchorPosition, this.searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
            }
            return;
        }
        if (!endsWithSnippetPopupTrigger(textBefore))
            return;
        const slashRange = buildSlashRange(element, range, 2);
        if (!slashRange)
            return;
        const slashIndexForQuery = findLastSnippetPopupTrigger(textBefore);
        const searchQuery = slashIndexForQuery !== -1 ? textBefore.slice(slashIndexForQuery + 2) : '';
        const storedRange = slashRange.cloneRange();
        const openPopup = () => {
            if (!element.isConnected)
                return;
            const textSnapshot = element.textContent || '';
            if (!textSnapshot.includes('c/'))
                return;
            const currentSelection = window.getSelection();
            const currentRange = currentSelection && currentSelection.rangeCount ? currentSelection.getRangeAt(0) : storedRange;
            const anchorPosition = getContentEditableCaretPosition(element, currentRange) || getElementAnchorPosition(element);
            if (!anchorPosition)
                return;
            this.triggerContext = {
                type: 'contentEditable',
                element,
                slashRange: storedRange.cloneRange(),
            };
            this.renderPopup(anchorPosition, searchQuery, CONTENT_EDITABLE_POPUP_VERTICAL_OFFSET);
        };
        this.runWithNotes(openPopup);
    }
    private validateOpenContentEditablePopup() {
        if (!this.isOpen || this.triggerContext?.type !== 'contentEditable')
            return;
        const { element } = this.triggerContext;
        if (!element.isConnected) {
            this.closePopup();
            return;
        }
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) {
            this.closePopup();
            return;
        }
        const range = selection.getRangeAt(0);
        if (!element.contains(range.endContainer)) {
            this.closePopup();
            return;
        }
        const textBefore = getContentEditableTextBeforeCaret(element, range);
        if (this.sharedShortcutPicker) {
            if (textBefore !== this.sharedShortcutPicker.textBefore)
                this.closePopup();
            return;
        }
        const slashIndex = findLastSnippetPopupTrigger(textBefore);
        if (slashIndex === -1) {
            this.closePopup();
            return;
        }
        this.searchQuery = textBefore.slice(slashIndex + SNIPPET_POPUP_TRIGGER.length);
    }
    private openPopupForElement(element: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, type: 'input' | 'googleSheets') {
        const now = Date.now();
        if (now - this.lastTriggerTimestamp < 150) {
            return;
        }
        this.lastTriggerTimestamp = now;
        const safeSelection = Math.max(0, Math.min(selectionStart, element.value.length));
        const caretPosition = type === 'input' || type === 'googleSheets' ? getInputCaretPosition(element, safeSelection) : null;
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
    private async renderPopup(position: PopupPosition, externalQuery: string = '', verticalOffset: number = POPUP_VERTICAL_OFFSET) {
        if (this.getFilteredSnippetNotes(externalQuery).length === 0) {
            this.closePopup();
            return;
        }
        const generation = ++this.popupRenderGeneration;
        this.isOpen = true;
        const finalPosition = clampPositionToViewport({
            x: position.x,
            y: position.y + verticalOffset,
            caretHeight: position.caretHeight,
        });
        if (!this.popupContainer) {
            // Clean up any existing popup root left over from previous script versions (e.g. after extension reloads)
            const existing = document.getElementById('cmdos-slash-popup-root');
            if (existing) {
                existing.remove();
            }
            this.popupContainer = document.createElement('div');
            this.popupContainer.id = 'cmdos-slash-popup-root';
            this.popupContainer.style.position = 'absolute';
            this.popupContainer.style.top = '0';
            this.popupContainer.style.left = '0';
            this.popupContainer.style.zIndex = '2147483646';
            document.documentElement.appendChild(this.popupContainer);
            this.shadowRoot = this.popupContainer.attachShadow({ mode: 'open' });
            this.shadowContainer = document.createElement('div');
            this.shadowRoot.appendChild(this.shadowContainer);
            this.attachShadowStyles();
        }
        const { React, createRoot, InjectedSnippetDropdownUI } = await loadSnippetPopupRuntime();
        if (generation !== this.popupRenderGeneration)
            return;
        if (!this.popupRoot && this.shadowContainer)
            this.popupRoot = createRoot(this.shadowContainer);
        if (!this.popupRoot)
            return;
        this.popupRoot?.render(React.createElement(InjectedSnippetDropdownUI, {
            notes: this.sharedShortcutPicker?.notes || this.notes,
            assignedItemsOnly: Boolean(this.sharedShortcutPicker),
            position: finalPosition,
            onClose: () => this.closePopup(),
            activeNoteId: this.sharedShortcutPicker ? this.selectedPopupNoteId : undefined,
            onActiveNoteChange: this.sharedShortcutPicker ? note => { this.selectedPopupNoteId = note?.id; } : undefined,
            verticalOffset,
            onSelect: note => this.selectPopupNote(note),
            onEdit: item => {
                const category = item.category?.toLowerCase();
                const entityType = category === 'link' ? 'link' : category === 'snippet' ? 'snippet' : '';
                if (!entityType || !item.id)
                    return;
                try {
                    const url = new URL(chrome.runtime.getURL('AltS_search_newtab/index.html'));
                    url.searchParams.set('alts_action', 'true');
                    url.searchParams.set('type', entityType);
                    url.searchParams.set('entityId', item.id);
                    url.searchParams.set('edit_mode', 'true');
                    chrome.runtime.sendMessage({ action: 'open_tab', url: url.toString(), active: true }, response => {
                        if (chrome.runtime.lastError) {
                            console.error('[SlashNotes] Failed to open snippet editor:', chrome.runtime.lastError.message);
                            return;
                        }
                        if (response && response.ok === false) {
                            console.error('[SlashNotes] Failed to open snippet editor:', response.error || response);
                        }
                    });
                }
                catch (e) {
                    console.error('[SlashNotes] Failed to open snippet editor', e);
                }
                this.closePopup();
            },
            externalQuery,
        }));
        document.addEventListener('mousedown', this.handleOutsideClick, true);
        document.addEventListener('touchstart', this.handleOutsideClick, true);
        this.isOpen = true;
    }
    private handleOutsideClick = (event: MouseEvent | TouchEvent) => {
        if (!this.popupContainer)
            return;
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (path.includes(this.popupContainer) || (this.shadowContainer && path.includes(this.shadowContainer))) {
            return;
        }
        const targetNode = event.target as Node | null;
        if (!targetNode)
            return;
        if (this.popupContainer.contains(targetNode))
            return;
        if (this.shadowContainer?.contains(targetNode))
            return;
        this.closePopup();
    };
    private closePopup() {
        ++this.popupRenderGeneration;
        this.sharedShortcutPicker = null;
        if (!this.isOpen)
            return;
        document.removeEventListener('mousedown', this.handleOutsideClick, true);
        document.removeEventListener('touchstart', this.handleOutsideClick, true);
        if (this.popupRoot) {
            this.popupRoot.render(null);
        }
        this.isOpen = false;
        this.triggerContext = null;
        this.searchQuery = '';
        this.selectedPopupNoteId = null;
        this.slashPosition = -1;
    }
  private async insertNote(note: NoteItem, direct?: { context: TriggerContext; deleteCount: number }) {
    if (this.snippetExpansionActive) return;
    this.snippetExpansionActive = true;
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
          if (astFields.some(field => field.fieldType === 'clipboard')) {
            try {
              clipboardText = await navigator.clipboard.readText();
            } catch (e) {
              console.warn('[NotesExtension] Failed to read clipboard:', e);
            }
          }

          const context = new RuntimeContext();
          context.setValue('__system_clipboard__', clipboardText, 'SYSTEM');

          // Keep editable defaults as placeholders so the form can replace them.
          const promptNodes = (nodes: ASTNode[]): ASTNode[] => nodes.map(node => {
            if (node.type === 'field' && (node.fieldType === 'text' || node.fieldType === 'dropdown')) {
              return { ...node, config: { ...node.config, defaultValue: undefined } };
            }
            if ('children' in node && Array.isArray(node.children)) {
              return { ...node, children: promptNodes(node.children) };
            }
            return node;
          });
          const evalResult = evaluateAst(promptNodes(parsed as ASTNode[]), context, { leaveUnresolvedAsBraces: true });
          textToInsert = evalResult.text;
          htmlToInsert = evalResult.text; // Basic AST doesn't have HTML formatting yet, so we just use the evaluated text
          if (evalResult.cursorPosition !== undefined) {
            textToInsert =
              textToInsert.slice(0, evalResult.cursorPosition) +
              CURSOR_MARKER +
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
                node.nodeValue = text.slice(0, splitIndex) + CURSOR_MARKER + text.slice(splitIndex);
                inserted = true;
                break;
              }
              currentOffset += textLength;
              node = walker.nextNode();
            }

            if (!inserted) {
              tempDiv.appendChild(document.createTextNode(CURSOR_MARKER));
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
      this.snippetExpansionActive = false;
      return;
    }

    // For link-type notes, insert as a clickable hyperlink
    const cat = (note.category || '').toLowerCase();
    const isLink = cat === 'link';
    if (isLink) {
      const urls = note.urls?.length
        ? note.urls
        : [
          {
            title: note.key,
            url: note.value,
          },
        ];
      textToInsert = buildLinkPlainText(note.key, urls);
      htmlToInsert = buildLinkHtml(urls);
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

    const context = direct?.context || this.triggerContext;
    const queryLength = this.searchQuery.length; // Length of text typed after //
    const triggerLength = direct?.deleteCount ?? 2 + queryLength;
    this.closePopup();

    if (!context) {
      this.snippetExpansionActive = false;
      return;
    }

    if (context.type === 'googleDocs') {
      logGoogleDocsDebug('Snippet variable decision', {
        astFieldsCount: astFields.length,
        rawVariables: rawStrings,
        customVariablesCount: customVariables.length,
        interactiveVariablesCount: interactiveVariables.length,
        textPreview: textToInsert.slice(0, 120),
      });
    }

    // Collect answers before replacing the trigger in the destination.
    const performInsertion = (text: string, html: string, cursorIndex?: number) => {
      switch (context.type) {
        case 'input':
          // Delete // plus the search query
          this.insertIntoStandardInput(
            context.element,
            direct ? context.selectionStart : context.selectionStart + queryLength,
            text,
            triggerLength,
            cursorIndex,
          );
          break;
        case 'codeEditor':
          if (context.element) {
            this.insertIntoCodeEditor(
              context.element,
              direct ? context.selectionStart : context.selectionStart + queryLength,
              text,
              triggerLength,
              cursorIndex,
            );
          } else {
            this.insertIntoCodeEditorSurface(context.editor, text, triggerLength, cursorIndex);
          }
          break;
        case 'googleSheets':
          this.insertIntoSheets(context.element, context.selectionStart, text, triggerLength);
          break;
        case 'googleSheetsGrid':
          if (context.element?.isConnected) context.element.focus();
          this.insertIntoGoogleSheetsGrid(text, context.deleteCount);
          break;
        case 'contentEditable': {
          if (direct) {
            this.insertIntoContentEditable(context.element, context.slashRange.cloneRange(), text, html);
            break;
          }
          const selection = window.getSelection();
          let extendedRange: Range | null = null;

          if (selection && selection.rangeCount) {
            const currentRange = selection.getRangeAt(0);
            if (context.element.contains(currentRange.endContainer)) {
              const textBefore = getContentEditableTextBeforeCaret(context.element, currentRange);
              const slashIndex = findLastSnippetPopupTrigger(textBefore);
              if (slashIndex !== -1) {
                const deleteCount = textBefore.length - slashIndex;
                extendedRange = buildSlashRange(context.element, currentRange, deleteCount);
              }
            }
          }

          // Fallback to the original stored range if the editor does not expose a stable live range.
          const fallbackRange = context.slashRange.cloneRange();
          if (queryLength > 0) {
            try {
              // Move the end of the range forward by queryLength characters to cover the search query
              let remaining = queryLength;
              let node = fallbackRange.endContainer;
              let offset = fallbackRange.endOffset;

              while (remaining > 0 && node) {
                if (node.nodeType === Node.TEXT_NODE) {
                  const textLen = (node.textContent || '').length;
                  const available = textLen - offset;
                  if (available >= remaining) {
                    fallbackRange.setEnd(node, offset + remaining);
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
          this.insertIntoContentEditable(context.element, extendedRange || fallbackRange, text, html);
          break;
        }
        case 'googleDocs':
          this.insertIntoGoogleDocs(context.iframe, context.caretRange, text, html, triggerLength);
          break;
        default:
          break;
      }
    };

    // If there are custom variables, show the inline modal first
    if (
      interactiveVariables.length > 0 &&
      (context.type === 'input' ||
        context.type === 'codeEditor' ||
        context.type === 'contentEditable' ||
        context.type === 'googleDocs' ||
        context.type === 'googleSheets' ||
        context.type === 'googleSheetsGrid')
    ) {
      const element =
        context.type === 'contentEditable'
          ? context.element
          : context.type === 'codeEditor'
            ? context.editor
            : context.type === 'googleDocs'
              ? document.body
              : context.type === 'googleSheetsGrid'
                ? document.body
              : context.element;
      if (context.type === 'googleDocs') {
        logGoogleDocsDebug('Showing configuration modal before insert', {
          interactiveVariablesCount: interactiveVariables.length,
        });
      }
      this.showInlineVariablesModal(
        element,
        interactiveVariables,
        textToInsert,
        htmlToInsert,
        (finalText, finalHtml) => {
          this.closePopup();
          if (context.type === 'googleDocs') {
            logGoogleDocsDebug('Configuration modal submitted', {
              finalTextPreview: finalText.slice(0, 120),
            });
          }
          try {
            performInsertion(finalText, finalHtml, cursorOffset);
            if (context.type !== 'googleDocs') {
              this.finalizeCursor(element);
            }
          } finally {
            this.snippetExpansionActive = false;
          }
        },
        () => { this.snippetExpansionActive = false; },
      );
    } else {
      try {
        performInsertion(textToInsert, htmlToInsert, cursorOffset);
        if (context.type === 'input' || context.type === 'codeEditor' || context.type === 'contentEditable') {
          const element =
            context.type === 'contentEditable'
              ? context.element
              : context.type === 'codeEditor'
                ? context.editor
                : context.element;
          this.finalizeCursor(element);
        }
      } finally {
        this.snippetExpansionActive = false;
      }
    }
  }

  private showInlineVariablesModal(
    element: HTMLElement,
    variables: Array<string | FieldNode>,
    rawText: string,
    rawHtml: string,
    onComplete: (finalText: string, finalHtml: string) => void,
    onCancel?: () => void,
  ) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      colorScheme: 'dark',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      backgroundColor: '#161722',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '18px 20px 12px',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75)',
      width: '700px',
      maxWidth: '92vw',
      maxHeight: '86vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
      colorScheme: 'dark',
    });

    // Deduplicate variables & exclude clipboard and date types
    const seen = new Set<string>();
    const uniqueVariables: Array<string | FieldNode> = [];
    variables.forEach(v => {
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

    // Map variable keys to their FieldNode definition or null
    const varNodeMap = new Map<string, FieldNode | null>();
    uniqueVariables.forEach(v => {
      const key = typeof v === 'string' ? v : (v.config as any)?.label || v.alias || v.id;
      varNodeMap.set(key, typeof v === 'string' ? null : v);
    });

    // Map to track current value getters for each variable
    const elementsMap = new Map<string, { getValue: () => string }>();
    let firstInteractiveControl: HTMLElement | null = null;

    // 1. Header Section
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      paddingBottom: '20px',
      flexShrink: '0',
    });

    const title = document.createElement('div');
    title.textContent = 'Configure Variables';
    Object.assign(title.style, {
      color: '#f9fafb',
      fontSize: '14.5px',
      fontWeight: '650',
      letterSpacing: '-0.01em',
    });

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Fill the highlighted values before inserting.';
    Object.assign(subtitle.style, {
      color: 'rgba(255, 255, 255, 0.42)',
      fontSize: '11.5px',
      fontWeight: '400',
      textAlign: 'left',
    });

    header.appendChild(title);
    header.appendChild(subtitle);
    modal.appendChild(header);

    // 2. Document Area Outer Scroll Container
    const docContainer = document.createElement('div');
    Object.assign(docContainer.style, {
      display: 'block',
      overflowY: 'auto',
      maxHeight: '65vh',
      padding: '16px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '4px',
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.90)',
      fontSize: '15px',
      flexShrink: '1',
      textAlign: 'left',
    });

    // Inner Flex Wrap Flow Container for Perfect Row Calculation & Spacing
    const flexFlow = document.createElement('div');
    Object.assign(flexFlow.style, {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: '4px',
      rowGap: '10px',
      lineHeight: '1.5',
    });
    docContainer.appendChild(flexFlow);

    // Helper to create helper text hidden canvas for auto-sizing text inputs
    const hiddenMeasurer = document.createElement('span');
    Object.assign(hiddenMeasurer.style, {
      position: 'absolute',
      visibility: 'hidden',
      whiteSpace: 'pre',
      fontSize: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '0 8px',
    });
    document.body.appendChild(hiddenMeasurer);

    // Helper function to build per-component custom inline variable elements
    const createInlineVariableElement = (key: string): HTMLElement => {
      const fieldNode = varNodeMap.get(key);
      const fieldType = (fieldNode?.fieldType as string) || 'text';

      if (fieldType === 'dropdown') {
        const select = document.createElement('select');
        Object.assign(select.style, {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          whiteSpace: 'nowrap',
          flexShrink: '0',
          height: '28px',
          padding: '0 20px 0 8px',
          backgroundColor: '#20212A',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          color: 'rgba(255, 255, 255, 0.90)',
          fontSize: '14px',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          colorScheme: 'dark',
          backgroundImage:
            "url(\"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.55)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
          backgroundSize: '10px',
          transition: 'all 150ms ease',
        });

        const opts = (fieldNode!.config as any)?.options || [];
        opts.forEach((opt: string) => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          o.style.backgroundColor = '#161722';
          o.style.color = '#f9fafb';
          o.style.colorScheme = 'dark';
          select.appendChild(o);
        });
        const defaultOption = (fieldNode?.config as DropdownFieldConfig | undefined)?.defaultValue;
        if (defaultOption && opts.includes(defaultOption)) select.value = defaultOption;

        select.addEventListener('focus', () => {
          select.style.backgroundColor = '#242630';
          select.style.borderColor = 'rgba(255, 255, 255, 0.24)';
          select.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.04)';
        });
        select.addEventListener('blur', () => {
          select.style.backgroundColor = '#20212A';
          select.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          select.style.boxShadow = 'none';
        });
        select.addEventListener('mouseenter', () => {
          if (document.activeElement !== select) {
            select.style.backgroundColor = '#242630';
            select.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }
        });
        select.addEventListener('mouseleave', () => {
          if (document.activeElement !== select) {
            select.style.backgroundColor = '#20212A';
            select.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }
        });

        elementsMap.set(key, { getValue: () => select.value });
        if (!firstInteractiveControl) firstInteractiveControl = select;
        return select;

      } else if (fieldType === 'checkbox') {
        const wrapper = document.createElement('label');
        Object.assign(wrapper.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
          flexShrink: '0',
          height: '28px',
          padding: '0 8px',
          backgroundColor: '#20212A',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          boxSizing: 'border-box',
          transition: 'all 150ms ease',
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = (fieldNode!.config as any)?.defaultValue === true;
        Object.assign(checkbox.style, {
          width: '14px',
          height: '14px',
          margin: '0',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundColor: checkbox.checked ? '#3A3C46' : 'transparent',
          border: checkbox.checked ? '1px solid rgba(255, 255, 255, 0.24)' : '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '4px',
          cursor: 'pointer',
          outline: 'none',
          position: 'relative',
          transition: 'all 150ms ease',
        });

        const updateCheckboxVisual = () => {
          if (checkbox.checked) {
            checkbox.style.backgroundColor = '#3A3C46';
            checkbox.style.borderColor = 'rgba(255, 255, 255, 0.24)';
            checkbox.style.backgroundImage =
              "url(\"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E\")";
            checkbox.style.backgroundRepeat = 'no-repeat';
            checkbox.style.backgroundPosition = 'center';
            checkbox.style.backgroundSize = '9px';
          } else {
            checkbox.style.backgroundColor = 'transparent';
            checkbox.style.borderColor = 'rgba(255, 255, 255, 0.18)';
            checkbox.style.backgroundImage = 'none';
          }
        };
        updateCheckboxVisual();

        checkbox.addEventListener('focus', () => {
          wrapper.style.backgroundColor = '#242630';
          wrapper.style.borderColor = 'rgba(255, 255, 255, 0.24)';
          wrapper.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.04)';
        });
        checkbox.addEventListener('blur', () => {
          wrapper.style.backgroundColor = '#20212A';
          wrapper.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          wrapper.style.boxShadow = 'none';
          updateCheckboxVisual();
        });
        wrapper.addEventListener('mouseenter', () => {
          if (document.activeElement !== checkbox) {
            wrapper.style.backgroundColor = '#242630';
            wrapper.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }
        });
        wrapper.addEventListener('mouseleave', () => {
          if (document.activeElement !== checkbox) {
            wrapper.style.backgroundColor = '#20212A';
            wrapper.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }
        });
        checkbox.addEventListener('change', () => {
          updateCheckboxVisual();
        });

        const labelText = document.createElement('span');
        labelText.textContent = key;
        Object.assign(labelText.style, {
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.90)',
          fontWeight: '500',
        });

        wrapper.appendChild(checkbox);
        wrapper.appendChild(labelText);

        elementsMap.set(key, { getValue: () => (checkbox.checked ? key : '') });
        if (!firstInteractiveControl) firstInteractiveControl = checkbox;
        return wrapper;

      } else if (fieldType === 'toggle') {
        const cfg = (fieldNode!.config as any) || {};
        const trueLabel = cfg.trueLabel || 'Yes';
        const falseLabel = cfg.falseLabel || 'No';
        let isChecked = cfg.defaultValue === true;

        const segmentedControl = document.createElement('div');
        Object.assign(segmentedControl.style, {
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          flexShrink: '0',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '1.5px',
          gap: '2px',
          height: '28px',
          boxSizing: 'border-box',
          transition: 'all 150ms ease',
        });

        const yesBtn = document.createElement('button');
        yesBtn.type = 'button';
        yesBtn.textContent = trueLabel;

        const noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.textContent = falseLabel;

        const updateSegmentStyles = () => {
          Object.assign(yesBtn.style, {
            height: '22px',
            padding: '0 10px',
            borderRadius: '5.5px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            border: isChecked ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
            backgroundColor: isChecked ? '#3A3C46' : 'transparent',
            color: isChecked ? '#FFFFFF' : 'rgba(255, 255, 255, 0.62)',
            transition: 'all 150ms ease',
          });

          Object.assign(noBtn.style, {
            height: '22px',
            padding: '0 10px',
            borderRadius: '5.5px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            border: !isChecked ? '1px solid rgba(255, 255, 255, 0.12)' : 'none',
            backgroundColor: !isChecked ? '#3A3C46' : 'transparent',
            color: !isChecked ? '#FFFFFF' : 'rgba(255, 255, 255, 0.62)',
            transition: 'all 150ms ease',
          });
        };

        updateSegmentStyles();

        yesBtn.addEventListener('focus', () => {
          segmentedControl.style.backgroundColor = '#242630';
          segmentedControl.style.borderColor = 'rgba(255, 255, 255, 0.24)';
          segmentedControl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.04)';
        });
        yesBtn.addEventListener('blur', () => {
          segmentedControl.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          segmentedControl.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          segmentedControl.style.boxShadow = 'none';
        });
        noBtn.addEventListener('focus', () => {
          segmentedControl.style.backgroundColor = '#242630';
          segmentedControl.style.borderColor = 'rgba(255, 255, 255, 0.24)';
          segmentedControl.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.04)';
        });
        noBtn.addEventListener('blur', () => {
          segmentedControl.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
          segmentedControl.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          segmentedControl.style.boxShadow = 'none';
        });

        yesBtn.addEventListener('click', () => {
          isChecked = true;
          updateSegmentStyles();
        });

        noBtn.addEventListener('click', () => {
          isChecked = false;
          updateSegmentStyles();
        });

        segmentedControl.appendChild(yesBtn);
        segmentedControl.appendChild(noBtn);

        elementsMap.set(key, { getValue: () => (isChecked ? trueLabel : falseLabel) });
        if (!firstInteractiveControl) firstInteractiveControl = yesBtn;
        return segmentedControl;

      } else {
        // Default text variable input with neutral styling
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = key;
        input.value = String((fieldNode?.config as { defaultValue?: string } | undefined)?.defaultValue ?? '');

        const autoFitWidth = () => {
          hiddenMeasurer.textContent = input.value || input.placeholder || key;
          const measuredWidth = Math.max(90, Math.min(hiddenMeasurer.offsetWidth + 40, 260));
          input.style.width = `${measuredWidth}px`;
        };

        Object.assign(input.style, {
          display: 'inline-block',
          flexShrink: '1',
          maxWidth: '100%',
          height: '28px',
          padding: '0 8px',
          backgroundColor: '#20212A',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '4px',
          color: 'rgba(255, 255, 255, 0.90)',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
          colorScheme: 'dark',
          transition: 'all 150ms ease',
        });

        const updatePlaceholderStyle = () => {
          input.style.color = input.value ? 'rgba(255, 255, 255, 0.90)' : 'rgba(255, 255, 255, 0.90)';
        };

        autoFitWidth();
        updatePlaceholderStyle();

        input.addEventListener('focus', () => {
          input.style.backgroundColor = '#242630';
          input.style.borderColor = 'rgba(255, 255, 255, 0.24)';
          input.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.04)';
        });
        input.addEventListener('blur', () => {
          input.style.backgroundColor = '#20212A';
          input.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          input.style.boxShadow = 'none';
        });
        input.addEventListener('mouseenter', () => {
          if (document.activeElement !== input) {
            input.style.backgroundColor = '#242630';
            input.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }
        });
        input.addEventListener('mouseleave', () => {
          if (document.activeElement !== input) {
            input.style.backgroundColor = '#20212A';
            input.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }
        });
        input.addEventListener('input', () => {
          autoFitWidth();
          updatePlaceholderStyle();
        });

        elementsMap.set(key, { getValue: () => input.value });
        if (!firstInteractiveControl) firstInteractiveControl = input;
        return input;
      }
    };

    // Helper to append text fragments safely into flexFlow
    const appendTextFragments = (text: string) => {
      if (!text) return;
      const parts = text.split(/(\s+)/);
      parts.forEach(part => {
        if (!part) return;
        const span = document.createElement('span');
        span.textContent = part;
        span.style.whiteSpace = 'pre-wrap';
        flexFlow.appendChild(span);
      });
    };

    // Render snippet text into flex items flow
    let textToProcess = rawText.split(CURSOR_MARKER).join('').replace(/__CURSOR__/g, '');
    const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = placeholderRegex.exec(textToProcess)) !== null) {
      const varKey = match[1].trim();

      // Skip non-interactive variables (clipboard, date)
      if (varKey.toLowerCase() === 'clipboard' || varKey.toLowerCase() === 'date') {
        const textBefore = textToProcess.substring(lastIndex, match.index);
        if (textBefore) {
          appendTextFragments(textBefore);
        }
        lastIndex = placeholderRegex.lastIndex;
        continue;
      }

      const textBefore = textToProcess.substring(lastIndex, match.index);
      if (textBefore) {
        appendTextFragments(textBefore);
      }

      if (varNodeMap.has(varKey)) {
        const inlineCtrl = createInlineVariableElement(varKey);
        flexFlow.appendChild(inlineCtrl);
      } else {
        appendTextFragments(match[0]);
      }

      lastIndex = placeholderRegex.lastIndex;
    }

    const remainingText = textToProcess.substring(lastIndex);
    if (remainingText) {
      appendTextFragments(remainingText);
    }

    // 3. Action Buttons placed inside docContainer at bottom right
    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.alignItems = 'center';
    buttons.style.justifyContent = 'flex-end';
    buttons.style.gap = '8px';
    buttons.style.marginTop = '28px';
    buttons.style.flexShrink = '0';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      height: '34px',
      padding: '0 14px',
      border: '1px solid rgba(255, 255, 255, 0.10)',
      borderRadius: '9px',
      backgroundColor: 'transparent',
      color: 'rgba(255, 255, 255, 0.62)',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 150ms ease',
    });
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      cancelBtn.style.color = 'rgba(255, 255, 255, 0.88)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.backgroundColor = 'transparent';
      cancelBtn.style.color = 'rgba(255, 255, 255, 0.62)';
    });

    const insertBtn = document.createElement('button');
    insertBtn.textContent = 'Insert';
    Object.assign(insertBtn.style, {
      height: '34px',
      padding: '0 18px',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '9px',
      backgroundColor: '#E7E7EA',
      color: '#17181F',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 6px 18px rgba(0, 0, 0, 0.22)',
      transition: 'all 150ms ease',
    });
    insertBtn.addEventListener('mouseenter', () => {
      insertBtn.style.backgroundColor = '#F2F2F4';
    });
    insertBtn.addEventListener('mouseleave', () => {
      insertBtn.style.backgroundColor = '#E7E7EA';
    });
    insertBtn.addEventListener('mousedown', () => {
      insertBtn.style.backgroundColor = '#DADAE0';
    });
    insertBtn.addEventListener('mouseup', () => {
      insertBtn.style.backgroundColor = '#F2F2F4';
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(insertBtn);
    docContainer.appendChild(buttons);
    modal.appendChild(docContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (firstInteractiveControl) setTimeout(() => (firstInteractiveControl as HTMLElement).focus(), 50);
    else setTimeout(() => insertBtn.focus(), 50);

    let settled = false;
    const doInsert = (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (settled) return;
      settled = true;

      let finalText = rawText;
      let finalHtml = rawHtml;

      for (const [key, getter] of elementsMap.entries()) {
        const val = getter.getValue();
        const re = new RegExp(`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
        finalText = finalText.replace(re, val);
        if (finalHtml) {
          finalHtml = finalHtml.replace(re, escapeHtml(val));
        }
      }

      hiddenMeasurer.remove();
      overlay.remove();
      this.closePopup();
      onComplete(finalText, finalHtml);
    };

    const doCancel = (event?: Event) => {
      event?.preventDefault();
      event?.stopPropagation();
      if (settled) return;
      settled = true;
      hiddenMeasurer.remove();
      overlay.remove();
      this.closePopup();
      onCancel?.();
    };

    insertBtn.addEventListener('click', doInsert);
    cancelBtn.addEventListener('click', doCancel);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        doCancel(e);
      }
    });

    modal.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        doInsert(e);
      } else if (e.key === 'Escape') {
        doCancel(e);
      }
    });
  }

    private finalizeCursor(element: HTMLElement) {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            const idx = element.value.indexOf(CURSOR_MARKER);
            if (idx !== -1) {
                element.value = element.value.replace(CURSOR_MARKER, '');
                element.dispatchEvent(new Event('input', { bubbles: true }));
                setStandardInputCaret(element, idx);
            }
        }
        else if (element.isContentEditable) {
            // Robust TreeWalker to find the zero-width cursor marker in text nodes
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                if (node.nodeValue && node.nodeValue.includes(CURSOR_MARKER)) {
                    const idx = node.nodeValue.indexOf(CURSOR_MARKER);
                    node.nodeValue = node.nodeValue.replace(CURSOR_MARKER, '');
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
    private insertIntoStandardInput(element: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, text: string, deleteCount: number, cursorOffset?: number) {
        const { cleanedText, resolvedOffset } = resolveCursorMarker(text, cursorOffset);
        const start = Math.max(0, selectionStart - deleteCount);
        const before = element.value.slice(0, start);
        const after = element.value.slice(selectionStart);
        const nextValue = `${before}${cleanedText}${after}`;
        const prototype = element instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (nativeSetter)
            nativeSetter.call(element, nextValue);
        else
            element.value = nextValue;
        dispatchInputEvents(element);
        const offset = resolvedOffset !== undefined ? Math.max(0, Math.min(resolvedOffset, cleanedText.length)) : cleanedText.length;
        setStandardInputCaret(element, before.length + offset);
    }
    private insertIntoSheets(element: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, text: string, deleteCount: number) {
        element.focus();
        const start = Math.max(0, selectionStart - deleteCount);
        element.setSelectionRange(start, selectionStart);
        const success = document.execCommand('insertText', false, text);
        if (!success) {
            this.insertIntoStandardInput(element, selectionStart, text, deleteCount);
        }
    }
    private insertIntoGoogleSheetsGrid(text: string, deleteCount: number) {
        const { cleanedText } = resolveCursorMarker(text);
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
        target.focus();
        for (let i = 0; i < deleteCount; i++) {
            target.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window,
            }));
            target.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window,
            }));
        }
        try {
            if (document.execCommand('insertText', false, cleanedText))
                return;
        }
        catch { }
        target.dispatchEvent(new InputEvent('input', {
            data: cleanedText,
            inputType: 'insertText',
            bubbles: true,
            cancelable: true,
        }));
    }
    private insertIntoCodeEditor(element: HTMLInputElement | HTMLTextAreaElement, selectionStart: number, text: string, deleteCount: number, cursorOffset?: number) {
        const { cleanedText } = resolveCursorMarker(text, cursorOffset);
        const currentSelectionStart = typeof element.selectionStart === 'number' && element.selectionStart >= 0 ? element.selectionStart : selectionStart;
        const valueBefore = element.value.slice(0, currentSelectionStart);
        const triggerIndex = findLastSnippetPopupTrigger(valueBefore);
        const safeSelectionStart = triggerIndex !== -1 && currentSelectionStart - triggerIndex <= Math.max(deleteCount, 2) + 100
            ? currentSelectionStart
            : selectionStart;
        const start = Math.max(0, safeSelectionStart - deleteCount);
        try {
            element.focus({ preventScroll: true });
        }
        catch {
            element.focus();
        }
        element.setSelectionRange(start, safeSelectionStart);
        const deletedSelection = document.execCommand('delete');
        const insertedText = document.execCommand('insertText', false, cleanedText);
        if (!deletedSelection || !insertedText) {
            this.insertIntoStandardInput(element, safeSelectionStart, cleanedText, deleteCount);
        }
    }
    private insertIntoCodeEditorSurface(editor: HTMLElement, text: string, deleteCount: number, cursorOffset?: number) {
        const { cleanedText } = resolveCursorMarker(text, cursorOffset);
        try {
            editor.focus({ preventScroll: true });
        }
        catch {
            editor.focus();
        }
        for (let i = 0; i < deleteCount; i += 1) {
            editor.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window,
            }));
            editor.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window,
            }));
        }
        try {
            if (document.execCommand('insertText', false, cleanedText)) {
                return;
            }
        }
        catch { }
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    private insertIntoContentEditable(element: HTMLElement, slashRange: Range, text: string, html: string = text) {
        const { cleanedText } = resolveCursorMarker(text);
        const { cleanedText: cleanedHtml } = resolveCursorMarker(html);
        const isWhatsAppEditor = window.location.hostname.includes('web.whatsapp.com');
        const isCkEditor = Boolean(element.closest('.ck-editor__editable, .ck-content, [data-cke-editable], .ck-editor'));
        try {
            element.focus({ preventScroll: true });
        }
        catch {
            element.focus();
        }
        const selection = window.getSelection();
        if (!selection)
            return;
        const notifyEditor = () => {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const restoreSlashSelection = () => {
            selection.removeAllRanges();
            selection.addRange(slashRange);
        };
        const dispatchSyntheticPaste = () => {
            try {
                const clipboardData = new DataTransfer();
                clipboardData.setData('text/plain', cleanedText);
                clipboardData.setData('text/html', cleanedHtml || cleanedText.replace(/\n/g, '<br>'));
                const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData,
                });
                const allowedDefault = element.dispatchEvent(pasteEvent);
                return !allowedDefault || pasteEvent.defaultPrevented;
            }
            catch (e) {
                console.warn('[SlashNotes] Synthetic paste failed, falling back to direct insertion', e);
                return false;
            }
        };
        const dispatchSyntheticBeforeInput = () => {
            try {
                const beforeInputEvent = new InputEvent('beforeinput', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: cleanedText,
                });
                element.dispatchEvent(beforeInputEvent);
                return beforeInputEvent.defaultPrevented;
            }
            catch (e) {
                console.warn('[SlashNotes] Synthetic beforeinput failed, falling back to manual insertion', e);
                return false;
            }
        };
        if (isCkEditor && !isWhatsAppEditor) {
            restoreSlashSelection();
            if (dispatchSyntheticPaste()) {
                return;
            }
        }
        if (isWhatsAppEditor) {
            try {
                restoreSlashSelection();
                slashRange.deleteContents();
                const lines = cleanedText.split(/\r?\n/);
                const fragment = document.createDocumentFragment();
                lines.forEach((line, index) => {
                    if (index > 0) {
                        const lineBreak = document.createElement('br');
                        fragment.appendChild(lineBreak);
                    }
                    if (line) {
                        const textNode = document.createTextNode(line);
                        fragment.appendChild(textNode);
                    }
                });
                const lastInsertedNode = fragment.lastChild;
                slashRange.insertNode(fragment);
                selection.removeAllRanges();
                const collapseRange = document.createRange();
                if (lastInsertedNode?.parentNode) {
                    collapseRange.setStartAfter(lastInsertedNode);
                }
                else {
                    collapseRange.selectNodeContents(element);
                    collapseRange.collapse(false);
                }
                collapseRange.collapse(true);
                selection.addRange(collapseRange);
                notifyEditor();
                return;
            }
            catch (e) {
                console.warn('[SlashNotes] WhatsApp text insertion failed, falling back to manual insertion', e);
            }
        }
        if (!isWhatsAppEditor && !isCkEditor) {
            try {
                restoreSlashSelection();
                const success = document.execCommand('insertHTML', false, cleanedHtml) ||
                    document.execCommand('insertText', false, cleanedText);
                if (success) {
                    notifyEditor();
                    return;
                }
            }
            catch (e) {
                console.warn('[SlashNotes] execCommand failed, falling back to manual insertion', e);
            }
        }
        restoreSlashSelection();
        if (dispatchSyntheticPaste()) {
            return;
        }
        restoreSlashSelection();
        if (dispatchSyntheticBeforeInput()) {
            return;
        }
        // Fallback: Manual insertion if execCommand fails
        // This is less ideal because it might not trigger editor's internal state updates
        restoreSlashSelection();
        slashRange.deleteContents();
        // Check if text has newlines
        if (cleanedText.includes('\n')) {
            const fragment = document.createDocumentFragment();
            const lines = cleanedText.split('\n');
            let lastInsertedNode: Node | null = null;
            lines.forEach((line, index) => {
                if (index > 0) {
                    const br = document.createElement('br');
                    fragment.appendChild(br);
                    lastInsertedNode = br;
                }
                if (line) {
                    const textNode = document.createTextNode(line);
                    fragment.appendChild(textNode);
                    lastInsertedNode = textNode;
                }
            });
            const insertRange = slashRange.cloneRange();
            insertRange.insertNode(fragment);
            // Update cursor position
            selection.removeAllRanges();
            const collapseRange = document.createRange();
            const targetNode = lastInsertedNode as Node | null;
            if (targetNode?.parentNode) {
                collapseRange.setStartAfter(targetNode);
            }
            else {
                collapseRange.selectNodeContents(element);
                collapseRange.collapse(false);
            }
            collapseRange.collapse(true);
            selection.addRange(collapseRange);
        }
        else {
            const textNode = document.createTextNode(cleanedText);
            const insertRange = slashRange.cloneRange();
            insertRange.insertNode(textNode);
            selection.removeAllRanges();
            const collapseRange = document.createRange();
            collapseRange.setStart(textNode, textNode.length);
            collapseRange.collapse(true);
            selection.addRange(collapseRange);
        }
        notifyEditor();
    }
    private async insertIntoGoogleDocs(iframe: HTMLIFrameElement, _caretRange: Range, text: string, html: string = text, deleteCount: number = 0) {
        try {
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument;
            if (!win || !doc) {
                logGoogleDocsDebug('Insert aborted: iframe window/document is missing', {
                    hasWindow: Boolean(win),
                    hasDocument: Boolean(doc),
                });
                return;
            }
            logGoogleDocsDebug('Preparing insert into Google Docs', {
                textLength: text.length,
                htmlLength: html.length,
                deleteCount,
                iframeReadyState: doc.readyState,
                alreadyInjected: this.injectedDocsIframes.has(iframe),
            });
            if (!this.injectedDocsIframes.has(iframe)) {
                let loader = this.injectedDocsIframeLoaders.get(iframe);
                if (!loader) {
                    logGoogleDocsDebug('Injecting Google Docs insertion script');
                    loader = new Promise<void>((resolve, reject) => {
                        const script = doc.createElement('script');
                        const timeout = window.setTimeout(() => {
                            script.remove();
                            this.injectedDocsIframeLoaders.delete(iframe);
                            logGoogleDocsDebug('Insertion script load timed out');
                            reject(new Error('Timed out loading Google Docs insertion script'));
                        }, 3000);
                        script.src = chrome.runtime.getURL('content/injected.js');
                        script.onload = () => {
                            window.clearTimeout(timeout);
                            script.remove();
                            this.injectedDocsIframes.add(iframe);
                            logGoogleDocsDebug('Insertion script loaded');
                            resolve();
                        };
                        script.onerror = () => {
                            window.clearTimeout(timeout);
                            script.remove();
                            this.injectedDocsIframeLoaders.delete(iframe);
                            logGoogleDocsDebug('Insertion script failed to load');
                            reject(new Error('Failed to load Google Docs insertion script'));
                        };
                        (doc.head || doc.documentElement).appendChild(script);
                    });
                    this.injectedDocsIframeLoaders.set(iframe, loader);
                }
                await loader;
            }
            const { cleanedText } = resolveCursorMarker(text);
            // Send message to the iframe's window to trigger the insertion
            logGoogleDocsDebug('Posting insert message to iframe', {
                textPreview: cleanedText.slice(0, 40),
                deleteCount,
            });
            win.dispatchEvent(new CustomEvent('supercommands:insert-text', {
                detail: { type: 'supercommands:insert-text', text: cleanedText, html: cleanedText, deleteCount },
            }));
        }
        catch (error) {
            console.warn('[SlashNotes] Failed to insert into Google Docs:', error);
            logGoogleDocsDebug('Insert failed with exception', {
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }
    private attachShadowStyles() {
        if (!this.shadowRoot)
            return;
        if (this.shadowRoot.querySelector('style[data-slash-notes]'))
            return;
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
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .snippet-link-icon {
        flex-shrink: 0;
      }

      .relative {
        position: relative;
      }

      .absolute {
        position: absolute;
      }

      .flex {
        display: flex;
      }

      .items-center {
        align-items: center;
      }

      .justify-center {
        justify-content: center;
      }

      .shrink-0 {
        flex-shrink: 0;
      }

      .object-contain {
        object-fit: contain;
      }

      .object-cover {
        object-fit: cover;
      }

      .rounded-sm {
        border-radius: 2px;
      }

      .rounded-full {
        border-radius: 999px;
      }

      .overflow-hidden {
        overflow: hidden;
      }

      .bg-white {
        background: #ffffff;
      }

      .w-full {
        width: 100%;
      }

      .h-full {
        height: 100%;
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
        flex-shrink: 0;
        margin-left: 4px;
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
export { WebsiteSnippetInjector };
