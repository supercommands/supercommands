import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type {
  CollectionItemRecord,
  WebScrapingBlock,
  WebScrapingInline,
} from '../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { validateWebScrapingData } from '../../../allObjectFolder/src/createObject/collections/webScrapingValidation';
import { useCollectionAsset } from '../../collections/useCollectionAsset';
import type { ExtractedWebScraping } from './webScrapingExtractionTypes';
import type { WebScrapingStyle } from '../../../allObjectFolder/src/createObject/collections/webScrapingStyle';
import { isCollectionPageImageUrl } from '../../collections/collectionCaptureSource';

type WebScrapingItem = Extract<CollectionItemRecord, { type: 'web-scraping' }>;
const appearance = (style?: WebScrapingStyle) => style as CSSProperties | undefined;

function SavedImage({ item, assetId, style }: { item: WebScrapingItem; assetId: string; style?: WebScrapingStyle }) {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [decodeFailed, setDecodeFailed] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !root.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const image = useCollectionAsset(item.organisationId, item.id, assetId, visible);
  useEffect(() => {
    setDecodeFailed(false);
  }, [image.url]);
  if (decodeFailed || image.status === 'error') return null;
  return (
    <div
      ref={root}
      className="collection-web-content__image min-h-40 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4">
      {image.url ? (
        <img
          src={image.url}
          style={appearance(style)}
          alt={`Captured content from ${item.title}`}
          loading="lazy"
          onError={() => setDecodeFailed(true)}
          className="mx-auto max-w-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-sm text-[var(--color-textSecondary)]">
          <span role="status">{visible ? 'Loading image…' : 'Image preview'}</span>
        </div>
      )}
    </div>
  );
}

/** Draft URLs are transient previews, never persisted asset references. */
function DraftImage({ url, sourceUrl, title, style }: { url: string | null; sourceUrl: string; title: string; style?: WebScrapingStyle }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [url]);
  const safe = (() => {
    try {
      const parsed = new URL(url || '');
      return isCollectionPageImageUrl(parsed.href, sourceUrl) ? parsed.href : null;
    } catch {
      return null;
    }
  })();
  if (!safe || failed) return null;
  return (
    <div className="collection-web-content__image min-h-40 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4">
      <img
        src={safe}
        style={appearance(style)}
        alt={`Captured content from ${title}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="mx-auto max-w-full object-contain"
      />
    </div>
  );
}

/** Semantic rendering with validated captured appearance; no source HTML, CSS rules or scripts execute. */
export function WebScrapingContentRenderer({
  item,
  draft,
  preview = false,
}:
  | { item: WebScrapingItem; draft?: never; preview?: boolean }
  | { draft: ExtractedWebScraping; item?: never; preview?: boolean }) {
  const parsed = useMemo(() => {
    try {
      return {
        data: validateWebScrapingData(
          draft
            ? {
                version: 1,
                blocks: draft.blocks,
                images: draft.images.map(image => ({ id: image.id, assetId: image.id })),
                ...(draft.style ? { style: draft.style } : {}),
              }
            : item?.data,
        ),
        error: null,
      };
    } catch {
      return { data: null, error: 'Captured content is invalid and cannot be displayed.' };
    }
  }, [item?.data, draft]);
  if (!parsed.data)
    return (
      <p role="alert" className="text-sm text-[var(--color-textSecondary)]">
        {parsed.error}
      </p>
    );
  const images = new Map(parsed.data.images.map(image => [image.id, image.assetId]));
  const inline = (children: WebScrapingInline[]): ReactNode =>
    children.map((child, index) => {
      if (child.type === 'link')
        return preview ? (
          <span key={index} style={appearance(child.style)}>
            {inline(child.children)}
          </span>
        ) : (
          <a
            key={index}
            style={appearance(child.style)}
            href={child.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            {inline(child.children)}
          </a>
        );
      let content: ReactNode = child.text;
      for (const mark of [...new Set(child.marks || [])])
        content =
          mark === 'bold' ? (
            <strong style={child.style ? { fontWeight: 'inherit' } : undefined}>{content}</strong>
          ) : mark === 'italic' ? (
            <em>{content}</em>
          ) : (
            <code
              style={child.style ? { fontFamily: 'inherit', backgroundColor: 'inherit' } : undefined}
              className="rounded bg-[var(--color-inputBg)] px-1 font-mono">
              {content}
            </code>
          );
      return (
        <span key={index} style={appearance(child.style)}>
          {content}
        </span>
      );
    });
  const blocks = (values: WebScrapingBlock[]): ReactNode =>
    values.map((block, index) => {
      switch (block.type) {
        case 'paragraph':
          return (
            <p key={index} style={appearance(block.style)} className="whitespace-pre-wrap break-words">
              {inline(block.children)}
            </p>
          );
        case 'heading': {
          const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          const size =
            block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : block.level === 3 ? 'text-base' : 'text-sm';
          return (
            <Heading key={index} style={appearance(block.style)} className={`${size} break-words font-semibold`}>
              {inline(block.children)}
            </Heading>
          );
        }
        case 'list': {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List
              key={index}
              style={appearance(block.style)}
              className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-5`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <div className="space-y-2">{blocks(item)}</div>
                </li>
              ))}
            </List>
          );
        }
        case 'quote':
          return (
            <blockquote
              key={index}
              style={appearance(block.style)}
              className="space-y-3 border-l border-[var(--color-borderDefault)] pl-4 text-[var(--color-textSecondary)]">
              {blocks(block.blocks)}
            </blockquote>
          );
        case 'code':
          return (
            <pre
              key={index}
              style={appearance(block.style)}
              className="overflow-x-auto whitespace-pre rounded-lg bg-[var(--color-inputBg)] p-4 font-mono text-sm custom-scrollbar">
              <code>{block.text}</code>
            </pre>
          );
        case 'table':
          return (
            <div key={index} className="overflow-x-auto custom-scrollbar">
              <table style={appearance(block.style)} className="w-full border-collapse text-left">
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border border-[var(--color-borderDefault)] p-3 align-top">
                          <div className="space-y-2">{blocks(cell)}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        case 'image':
          return item ? (
            <SavedImage key={index} item={item} style={block.style} assetId={images.get(block.imageId)!} />
          ) : draft ? (
            <DraftImage
              sourceUrl={draft.url}
              key={index}
              title={draft.title}
              style={block.style}
              url={draft.images.find(image => image.id === block.imageId)?.downloadUrl || null}
            />
          ) : null;
        case 'unavailable-image':
          return null;
      }
    });
  return (
    <section
      style={appearance(parsed.data.style)}
      aria-label={item ? 'Saved Web Scraping content' : 'Captured Web Scraping content'}
      className="collection-web-content space-y-4 break-words text-sm text-[var(--color-textPrimary)]">
      {blocks(parsed.data.blocks)}
    </section>
  );
}
