import type { WebScrapingBlock, WebScrapingInline } from '../../../allObjectFolder/src/createObject/collections/webScrapingTypes';
import { WEB_SCRAPING_LIMITS as limits } from '../../../allObjectFolder/src/createObject/collections/webScrapingLimits';
import type { ExtractedWebScraping, WebScrapingImageCandidate } from './webScrapingExtractionTypes';
import { validateWebScrapingData } from '../../../allObjectFolder/src/createObject/collections/webScrapingValidation';
import { createWebScrapingStyleReader } from './readWebScrapingStyle';
import type { WebScrapingStyle } from '../../../allObjectFolder/src/createObject/collections/webScrapingStyle';
import { isCollectionSourceUrl, collectionSourceLabel } from '../../collections/collectionCaptureSource';
import { readWebScrapingImageUrl } from './readWebScrapingImageUrl';
import { isPageCaptureUi } from '../pageCaptureDocument';

const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);
const containers = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DETAILS', 'SUMMARY']);
type Marks = ('bold' | 'italic' | 'code')[];

function safeUrl(value: string | null, base: string): string | null {
  if (!value?.trim()) return null;
  try { const url = new URL(value, base); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

/** Synchronous live-subtree snapshot; no DOM mutation, network access or author extraction. */
export function extractWebScrapingFromElement(element: Element): ExtractedWebScraping {
  const document = element.ownerDocument;
  const view = document.defaultView;
  const sourceUrl = document.location?.href || '';
  if (!view || !element.isConnected || !isCollectionSourceUrl(sourceUrl)) throw new Error('Choose content from the current website or New Tab.');
  if (isPageCaptureUi(element)) throw new Error('Choose page content outside the capture controls.');
  // Bound the source tree before bulk selectors/cloning, including empty rows and code text.
  const walker = document.createTreeWalker(element, 0xFFFFFFFF, {
    acceptNode: node => node.nodeType === 1 && isPageCaptureUi(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let sourceNodes = 0;
  let sourceBytes = 0;
  for (let node: Node | null = element; node; node = walker.nextNode()) {
    if (++sourceNodes > limits.nodes) throw new Error('Selected content exceeds the node limit.');
    if (node.nodeType === 3) {
      sourceBytes += new TextEncoder().encode(node.textContent || '').byteLength;
      if (sourceBytes > limits.bytes) throw new Error('Selected content exceeds 1 MiB.');
    }
    let depth = 0;
    for (let current: Node | null = node; current && current !== element; current = current.parentNode) {
      if (++depth > limits.sourceDepth) throw new Error('Selected website markup exceeds the capture depth limit. Choose a smaller section.');
    }
  }
  let visited = 0;
  const readStyle = createWebScrapingStyleReader(view);
  const images: WebScrapingImageCandidate[] = [];
  const imageIds = new Map<string, string>();
  const visible = (node: Element): boolean => {
    if (isPageCaptureUi(node) || ignored.has(node.tagName.toUpperCase()) || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return false;
    const style = view.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
  };
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    if (!visible(ancestor)) throw new Error('The selected content is hidden or unsupported.');
  }
  const codeText = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1 || !visible(node as Element)) return '';
    if ((node as Element).tagName.toUpperCase() === 'BR') return '\n';
    return Array.from(node.childNodes, codeText).join('');
  };
  const image = (node: Element): WebScrapingBlock => {
    const img = node as HTMLImageElement;
    const downloadUrl = readWebScrapingImageUrl(img, sourceUrl);
    let id = downloadUrl ? imageIds.get(downloadUrl) : undefined;
    if (!id) {
      if (images.length >= limits.images) throw new Error('Selected content exceeds 100 image candidates.');
      id = `image-${images.length + 1}`;
      images.push({ id, downloadUrl });
      if (downloadUrl) imageIds.set(downloadUrl, id);
    }
    return { type: 'image', imageId: id, style: readStyle(node) };
  };
  const sequence = (nodes: readonly Node[], depth: number, inherited: Marks = [], inheritedHref?: string,
    inheritedStyle: WebScrapingStyle = readStyle(element)): WebScrapingBlock[] => {
    const result: WebScrapingBlock[] = [];
    let inline: WebScrapingInline[] = [];
    const flush = () => {
      if (inline.some(part => part.type === 'link' || part.text.trim())) result.push({ type: 'paragraph', children: inline, style: inheritedStyle });
      inline = [];
    };
    const text = (value: string, marks: Marks, href?: string, style: WebScrapingStyle = inheritedStyle) => {
      if (!value) return;
      const part: WebScrapingInline = { type: 'text', text: value, style, ...(marks.length ? { marks: [...new Set(marks)] } : {}) };
      inline.push(href ? { type: 'link', url: href, children: [part], style } : part);
    };
    const visit = (node: Node, level: number, marks: Marks, href?: string): void => {
      if (++visited > limits.nodes) throw new Error('Selected content exceeds the node limit.');
      if (level > limits.depth) throw new Error('Selected content has too many nested lists, quotes or tables. Choose a smaller section.');
      if (node.nodeType === 3) { text((node.textContent || '').replace(/\s+/g, ' '), marks, href, node.parentElement ? readStyle(node.parentElement) : inheritedStyle); return; }
      if (node.nodeType !== 1) return;
      const current = node as Element;
      if (!visible(current)) return;
      const tag = current.tagName.toUpperCase();
      const children = Array.from(current.childNodes);
      if (tag === 'IMG') { flush(); result.push(image(current)); return; }
      if (tag === 'BR') { text('\n', marks, href); return; }
      if (tag === 'PRE') {
        flush();
        const content = codeText(current);
        if (content.trim()) result.push({ type: 'code', text: content, style: readStyle(current) });
        return;
      }
      if (tag === 'UL' || tag === 'OL') {
        flush();
        const items = Array.from(current.children).filter(child => child.tagName === 'LI' && visible(child))
          .map(child => sequence(Array.from(child.childNodes), level + 1, marks, href, readStyle(child)));
        if (items.length) result.push({ type: 'list', ordered: tag === 'OL', items, style: readStyle(current) });
        return;
      }
      if (tag === 'TABLE') {
        flush();
        const caption = Array.from(current.children).find(child => child.tagName === 'CAPTION' && visible(child));
        if (caption) result.push(...sequence(Array.from(caption.childNodes), level, marks, href, readStyle(caption)));
        const rows = Array.from(current.querySelectorAll('tr')).filter(row => row.closest('table') === current && visible(row))
          .map(row => Array.from(row.children).filter(cell => (cell.tagName === 'TD' || cell.tagName === 'TH') && visible(cell))
            .map(cell => sequence(Array.from(cell.childNodes), level + 1, marks, href, readStyle(cell))));
        if (rows.length) result.push({ type: 'table', rows, style: readStyle(current) });
        return;
      }
      if (tag === 'BLOCKQUOTE') { flush(); const blocks = sequence(children, level + 1, marks, href, readStyle(current)); if (blocks.length) result.push({ type: 'quote', blocks, style: readStyle(current) }); return; }
      if (/^H[1-6]$/.test(tag)) {
        flush(); const blocks = sequence(children, level, marks, href, readStyle(current));
        for (const block of blocks) result.push(block.type === 'paragraph'
          ? { type: 'heading', level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6, children: block.children, style: readStyle(current) } : block);
        return;
      }
      if (tag === 'P' || containers.has(tag)) {
        flush();
        const content = tag === 'DETAILS' && !current.hasAttribute('open') ? children.filter(child => child.nodeType === 1 && (child as Element).tagName === 'SUMMARY') : children;
        // Layout wrappers do not introduce nesting in the persisted block structure.
        result.push(...sequence(content, level, marks, href, readStyle(current))); return;
      }
      const nextMarks: Marks = tag === 'STRONG' || tag === 'B' ? [...marks, 'bold'] : tag === 'EM' || tag === 'I' ? [...marks, 'italic'] : tag === 'CODE' ? [...marks, 'code'] : marks;
      const nextHref = tag === 'A' ? safeUrl(current.getAttribute('href'), document.baseURI) || undefined : href;
      // Inline formatting and links merge into the same paragraph, rather than nesting DOM wrappers.
      for (const child of children) visit(child, level, nextMarks, nextHref);
    };
    for (const node of nodes) visit(node, depth, inherited, inheritedHref);
    flush(); return result;
  };
  const blocks = sequence([element], 0);
  if (!blocks.length) throw new Error('The selected element has no supported content.');
  const heading = element.matches('h1,h2,h3,h4,h5,h6') ? element : Array.from(element.querySelectorAll('h1,h2,h3,h4,h5,h6')).find(visible);
  const title = (heading?.textContent || document.title || collectionSourceLabel(sourceUrl)).replace(/\s+/g, ' ').trim() || collectionSourceLabel(sourceUrl);
  const style = readStyle(element);
  const extracted: ExtractedWebScraping = { title, url: sourceUrl, blocks, images, style };
  if (new TextEncoder().encode(JSON.stringify(extracted)).byteLength > limits.bytes) throw new Error('Selected content exceeds 1 MiB.');
  // Validate the flattened structure before review, without persisting transient download URLs.
  validateWebScrapingData({ version: 1, blocks, images: images.map(image => ({ id: image.id, assetId: image.id })), style });
  return extracted;
}
