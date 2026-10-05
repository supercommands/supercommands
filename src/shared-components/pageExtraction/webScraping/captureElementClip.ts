import { ELEMENT_SNAPSHOT_ATTRIBUTES, ELEMENT_SNAPSHOT_LIMITS as limits, ELEMENT_CLIP_RUNTIME_LIMITS, ELEMENT_SNAPSHOT_STYLE_KEYS, ELEMENT_SNAPSHOT_TAGS,
  type ElementSnapshotBackground, type ElementSnapshotDraft, type ElementSnapshotNode, type ElementSnapshotStyle } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotTypes';
import { isElementSnapshotGradient, isElementSnapshotStyleValue } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotStyle';
import { validateElementSnapshotDraft } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { isCollectionPageImageUrl } from '../../collections/collectionCaptureSource';
import { isPageCaptureUi } from '../pageCaptureDocument';
import { extractWebScrapingFromElement } from './extractWebScrapingFromElement';
import type { ExtractedElementClip, ExtractedWebScraping, WebScrapingImageCandidate } from './webScrapingExtractionTypes';
import { WEB_SCRAPING_LIMITS } from '../../../allObjectFolder/src/createObject/collections/webScrapingLimits';
import { readWebScrapingImageUrl } from './readWebScrapingImageUrl';

const tags = new Set(ELEMENT_SNAPSHOT_TAGS);
const excluded = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'LINK', 'META']);
const replaced = new Set(['SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED']);
function cancelled(signal?: AbortSignal): void { if (signal?.aborted) throw new DOMException('Element capture cancelled.', 'AbortError'); }
/** Bounded waiting never mutates the source page or leaves an abort listener behind. */
function waitFor(promise: PromiseLike<unknown>, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  cancelled(signal);
  return new Promise((resolve, reject) => {
    const finish = (value: boolean, abort = false) => {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort);
      if (abort) reject(new DOMException('Element capture cancelled.', 'AbortError')); else resolve(value);
    };
    const onAbort = () => finish(false, true);
    const timer = setTimeout(() => finish(false), Math.max(0, timeoutMs));
    signal?.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(() => finish(true), () => finish(false));
  });
}
function cssText(value: string): string | null {
  // Only resolved quoted strings are materialized. Counters/attr()/URL content stays unsupported.
  const tokens = value.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g);
  if (!tokens || value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '').trim()) return null;
  return tokens.map(token => token.slice(1, -1).replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string, char: string) => {
    if (!hex) return char;
    const code = parseInt(hex, 16); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  })).join('');
}
function backgroundParts(value: string): string[] {
  let depth = 0, quote = '', start = 0; const result: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const char = value[i]; if (char === '\\') { i++; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) { result.push(value.slice(start, i).trim()); start = i + 1; }
  }
  result.push(value.slice(start).trim()); return result;
}

/** Live DOM → inert hierarchy/styles/resources. No HTML serialization, resource fetch or source mutation. */
export function extractElementSnapshot(element: Element, semantic: ExtractedWebScraping, initialUnsupported: string[] = []): { snapshot: ElementSnapshotDraft; snapshotImages: WebScrapingImageCandidate[] } {
  const document = element.ownerDocument, view = document.defaultView;
  if (!view || !element.isConnected || document.location.href !== semantic.url || isPageCaptureUi(element)) throw new Error('The selected page content changed. Capture it again.');
  const nodes: ElementSnapshotNode[] = [], styles: ElementSnapshotDraft['styles'] = [], resources: ElementSnapshotDraft['resources'] = [];
  const unsupported = new Set(initialUnsupported), styleIds = new Map<string, string>();
  const resourceIds = new Map<string, string>(semantic.images.filter(image => image.downloadUrl).map(image => [image.downloadUrl!, image.id]));
  const referenced = new Set<string>(), snapshotImages: WebScrapingImageCandidate[] = [];
  const unresolved = semantic.images.filter(image => image.downloadUrl === null).map(image => image.id);
  const resource = (raw: string | null, fallbackId?: string): string => {
    let url: string | null = null;
    try { if (raw) { const resolved = new URL(raw, document.baseURI).href; if (isCollectionPageImageUrl(resolved, semantic.url)) url = resolved; } } catch { /* unavailable image candidate */ }
    let id = url ? resourceIds.get(url) : fallbackId;
    if (!id) {
      if (referenced.size >= limits.resources) throw new Error('Element capture exceeds 100 image resources.');
      id = `visual-image-${snapshotImages.length + 1}`;
      if (url) resourceIds.set(url, id);
      snapshotImages.push({ id, downloadUrl: url });
    }
    if (!referenced.has(id)) { referenced.add(id); resources.push({ id }); }
    return id;
  };
  const appearance = (computed: CSSStyleDeclaration, root = false): string => {
    const values: ElementSnapshotStyle = {};
    for (const key of ELEMENT_SNAPSHOT_STYLE_KEYS) {
      const value = computed[key];
      if (isElementSnapshotStyleValue(key, value)) values[key] = value;
      else if (value) unsupported.add('appearance-value');
    }
    if (root) {
      // Remove placement in an outside containing block; preserve the selected box's internal layout.
      values.position = 'relative'; values.top = values.right = values.bottom = values.left = 'auto';
      values.marginTop = values.marginRight = values.marginBottom = values.marginLeft = '0px';
      if (values.transform && values.transform !== 'none') { values.transform = 'none'; unsupported.add('root-transform'); }
      // A transparent selected wrapper inherits its website backing, not the eventual extension theme.
      let color = computed.backgroundColor;
      for (let parent = element.parentElement; parent && (color === 'rgba(0, 0, 0, 0)' || color === 'transparent'); parent = parent.parentElement) color = view.getComputedStyle(parent).backgroundColor;
      values.backgroundColor = isElementSnapshotStyleValue('backgroundColor', color) && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent' ? color : 'Canvas';
    } else if (values.position === 'fixed' || values.position === 'sticky') unsupported.add('viewport-position');
    const key = JSON.stringify(values); let id = styleIds.get(key);
    if (!id) { id = `style-${styles.length + 1}`; styles.push({ id, values }); styleIds.set(key, id); }
    return id;
  };
  let sourceNodes = 0;
  const visit = (source: Node, depth: number): string | null => {
    if (++sourceNodes > WEB_SCRAPING_LIMITS.nodes || depth > limits.depth) throw new Error('Element capture exceeds the source-tree limit. Choose a smaller section.');
    if (source.nodeType !== Node.TEXT_NODE && source.nodeType !== Node.ELEMENT_NODE) return null;
    if (nodes.length >= limits.nodes) throw new Error('Element capture exceeds 4,000 nodes. Choose a smaller section.');
    const id = `node-${nodes.length + 1}`;
    if (source.nodeType === Node.TEXT_NODE) { nodes.push({ id, type: 'text', text: source.textContent || '' }); return id; }
    const original = source as Element;
    if (excluded.has(original.tagName) || isPageCaptureUi(original) || original.hasAttribute('hidden') || original.getAttribute('aria-hidden') === 'true') return null;
    const computed = view.getComputedStyle(original);
    if (computed.display === 'none' || ['hidden', 'collapse'].includes(computed.visibility)) return null;
    const nativeControl = ['INPUT', 'TEXTAREA', 'SELECT'].includes(original.tagName);
    const unsupportedNode = replaced.has(original.tagName.toUpperCase()) || original.namespaceURI !== 'http://www.w3.org/1999/xhtml' || Boolean(original.shadowRoot);
    const originalTag = original.tagName.toLowerCase();
    const tag = !unsupportedNode && tags.has(originalTag) ? originalTag : computed.display.startsWith('inline') ? 'span' : 'div';
    const node: Extract<ElementSnapshotNode, { type: 'element' }> = { id, type: 'element', tag, attributes: {}, children: [], styleId: appearance(computed, original === element) };
    nodes.push(node);
    for (const name of ELEMENT_SNAPSHOT_ATTRIBUTES) {
      const value = original.getAttribute(name);
      if (value !== null && value.length <= 4096 && !['aria-checked'].includes(name)) node.attributes[name] = value;
    }
    if (original === element && !node.attributes.lang) {
      const lang = original.closest('[lang]')?.getAttribute('lang'); if (lang) node.attributes.lang = lang;
    }
    if (originalTag.includes('-')) unsupported.add('custom-element');
    if (unsupportedNode) { unsupported.add(original.shadowRoot ? 'shadow-dom' : 'unsupported-' + originalTag); return id; }
    if (original instanceof view.HTMLImageElement) {
      const url = readWebScrapingImageUrl(original, semantic.url);
      node.resourceId = resource(url, url ? undefined : unresolved.shift());
    }
    const backgrounds: ElementSnapshotBackground[] = [];
    for (const value of backgroundParts(computed.backgroundImage)) {
      if (value === 'none') backgrounds.push({ type: 'none' });
      else if (isElementSnapshotGradient(value)) backgrounds.push({ type: 'gradient', value });
      else {
        const match = value.match(/^url\((.*)\)$/i), url = match && (cssText(match[1]) ?? (!/['"\\]/.test(match[1]) ? match[1].trim() : null));
        backgrounds.push(url ? { type: 'image', resourceId: resource(url) } : { type: 'none' });
      }
    }
    if (backgrounds.some(layer => layer.type !== 'none')) node.backgroundLayers = backgrounds;
    for (const kind of ['before', 'after', 'marker'] as const) {
      const pseudo = view.getComputedStyle(original, `::${kind}`), content = pseudo.content;
      if (!content || content === 'none' || content === 'normal' || pseudo.display === 'none') continue;
      const text = cssText(content);
      if (text === null) { unsupported.add('generated-content'); continue; }
      if (pseudo.backgroundImage && pseudo.backgroundImage !== 'none') unsupported.add('pseudo-background');
      (node.pseudos ||= []).push({ kind, text, styleId: appearance(pseudo) });
    }
    if (nativeControl) {
      unsupported.add('native-form-control');
      // Do not read .value, .checked or .selected: only authored placeholder/default display is retained.
      let label = original.getAttribute('placeholder') || '';
      if (original instanceof view.HTMLSelectElement) label = Array.from(original.options).find(option => option.defaultSelected)?.textContent || original.options[0]?.textContent || '';
      if (original instanceof view.HTMLInputElement && ['checkbox', 'radio'].includes(original.type)) {
        node.attributes.role = original.type; node.attributes['aria-checked'] = String(original.defaultChecked);
        if (original.defaultChecked) label = '✓';
      }
      if (label) { const textId = `node-${nodes.length + 1}`; nodes.push({ id: textId, type: 'text', text: label }); node.children.push(textId); }
      return id;
    }
    const children = original.tagName === 'DETAILS' && !original.hasAttribute('open')
      ? Array.from(original.childNodes).filter(child => child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === 'SUMMARY') : Array.from(original.childNodes);
    for (const child of children) { const childId = visit(child, depth + 1); if (childId) node.children.push(childId); }
    return id;
  };
  const rootId = visit(element, 0);
  if (!rootId) throw new Error('The selected element is hidden or unsupported.');
  const rect = element.getBoundingClientRect(), html = element as HTMLElement;
  const snapshot = validateElementSnapshotDraft({ version: 1, capturedAt: Date.now(), viewport: { width: view.innerWidth, height: view.innerHeight, devicePixelRatio: view.devicePixelRatio },
    root: { nodeId: rootId, width: html.offsetWidth || rect.width, height: html.offsetHeight || rect.height }, nodes, styles, resources, unsupportedFeatures: [...unsupported] });
  if (new TextEncoder().encode(JSON.stringify(snapshotImages)).byteLength > WEB_SCRAPING_LIMITS.bytes) throw new Error('Visual image candidate URLs exceed 1 MiB. Choose a smaller section.');
  return { snapshot, snapshotImages };
}

/** Both representations are read together after a bounded font/media wait. */
async function readSettledElementClip(element: Element, signal?: AbortSignal): Promise<ExtractedElementClip> {
  cancelled(signal); const document = element.ownerDocument, sourceUrl = document.location.href;
  const images: HTMLImageElement[] = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
  let count = 0;
  for (let node: Node | null = element; node; node = walker.nextNode()) {
    if (++count > WEB_SCRAPING_LIMITS.nodes) throw new Error('Element capture exceeds the source-tree limit. Choose a smaller section.');
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'IMG') {
      if (images.length >= limits.resources) throw new Error('Element capture exceeds 100 images.');
      images.push(node as HTMLImageElement);
    }
  }
  const unsupported: string[] = [], deadline = Date.now() + ELEMENT_CLIP_RUNTIME_LIMITS.settleMs;
  if (document.fonts && !await waitFor(document.fonts.ready, ELEMENT_CLIP_RUNTIME_LIMITS.fontWaitMs, signal)) unsupported.push('font-loading-timeout');
  if (!await waitFor(Promise.all(images.map(image => image.decode())), deadline - Date.now(), signal)) unsupported.push('image-decode-unavailable');
  cancelled(signal);
  if (!element.isConnected || document.location.href !== sourceUrl) throw new Error('The source page changed. Capture content again.');
  const semantic = extractWebScrapingFromElement(element);
  return { ...semantic, ...extractElementSnapshot(element, semantic, unsupported) };
}

/** Own pending-page lifecycle even after the picker has released its DOM listeners. */
export async function captureElementClip(element: Element, signal?: AbortSignal): Promise<ExtractedElementClip> {
  cancelled(signal);
  const document = element.ownerDocument, view = document.defaultView, controller = new AbortController();
  const abort = () => controller.abort(), visibility = () => { if (document.hidden) abort(); };
  const guard = (event: Event) => {
    if (event.composedPath().some(target => target instanceof Element && target.hasAttribute('data-screenshot-toolbar'))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event instanceof KeyboardEvent && event.key === 'Escape') abort();
  };
  signal?.addEventListener('abort', abort, { once: true });
  document.addEventListener('visibilitychange', visibility);
  for (const event of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown']) document.addEventListener(event, guard, true);
  for (const event of ['pagehide', 'popstate', 'hashchange']) view?.addEventListener(event, abort);
  try { if (document.hidden) abort(); return await readSettledElementClip(element, controller.signal); }
  finally {
    signal?.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', visibility);
    for (const event of ['pointerdown', 'pointerup', 'click', 'contextmenu', 'keydown']) document.removeEventListener(event, guard, true);
    for (const event of ['pagehide', 'popstate', 'hashchange']) view?.removeEventListener(event, abort);
  }
}
