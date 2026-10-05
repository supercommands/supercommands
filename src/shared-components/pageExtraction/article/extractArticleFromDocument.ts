/** Live-page extraction only; persistence belongs to the Collection bridge. */
import { createPageCaptureDocument } from '../pageCaptureDocument';
import { collectionSourceLabel, isCollectionSourceUrl } from '../../collections/collectionCaptureSource';
export interface ExtractedArticle {
    title: string;
    text: string;
    author: string;
    preview: string;
}

function authorNames(value: unknown): string[] {
    if (typeof value === 'string') return /^https?:\/\//i.test(value.trim()) ? [] : [value.trim()];
    if (Array.isArray(value)) return value.flatMap(authorNames);
    if (value && typeof value === 'object') return authorNames((value as Record<string, unknown>).name);
    return [];
}

function structuredAuthor(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(structuredAuthor);
    if (!value || typeof value !== 'object') return [];
    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
    const isArticle = types.some(type => typeof type === 'string'
        && /(?:^|[/#])(Article|NewsArticle|BlogPosting)$/.test(type));
    const names = isArticle ? authorNames(object.author) : [];
    return names.length ? names : structuredAuthor(object['@graph']);
}

function fallbackAuthor(document: Document): string {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
            const names = structuredAuthor(JSON.parse(script.textContent || ''));
            if (names.length) return [...new Set(names.filter(Boolean))].join(', ');
        } catch { /* Invalid publisher metadata must not prevent extraction. */ }
    }
    const metadata = document.querySelector<HTMLMetaElement>('meta[name="author" i]')?.content;
    return authorNames(metadata).filter(Boolean).join(', ');
}

function readableText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = (node as Element).tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return '';
    if (tag === 'BR') return '\n';
    const children = Array.from(node.childNodes, readableText).join('');
    return /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|BLOCKQUOTE|PRE|TR)$/.test(tag) ? `\n${children}\n` : children;
}

export async function extractArticleFromDocument(document: Document, sourceUrl: string, capturedTitle?: string): Promise<ExtractedArticle> {
    // Snapshot before the asynchronous import, retaining the currently rendered page.
    if (document.location.href !== sourceUrl) throw new Error('The page changed. Choose Article again to capture the current page.');
    if (!isCollectionSourceUrl(sourceUrl)) throw new Error('Article capture requires a website or this extension’s New Tab page.');
    const clone = createPageCaptureDocument(document);
    const fallbackTitle = capturedTitle?.trim() || document.title.trim() || collectionSourceLabel(sourceUrl);
    const metadataAuthor = fallbackAuthor(clone);
    const { Readability } = await import('@mozilla/readability');
    if (document.location.href !== sourceUrl) throw new Error('The page changed. Choose Article again to capture the current page.');
    const article = new Readability(clone, { serializer: node => node }).parse();
    if (!article?.textContent?.trim()) throw new Error('Couldn’t extract an article from this page.');
    // Keep paragraph boundaries rather than flattening the entire article into one line.
    const text = (article.content ? readableText(article.content) : article.textContent)
        .replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new Error('Couldn’t extract an article from this page.');
    const author = metadataAuthor || authorNames(article.byline).filter(Boolean).join(', ');
    return {
        title: article.title?.trim() || fallbackTitle,
        text,
        author,
        preview: (article.excerpt?.trim() || text).replace(/\s+/g, ' ').slice(0, 320),
    };
}
