import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CollectionItemRecord } from '../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { elementSnapshotAppearanceKey, subscribeElementSnapshotAppearance, type ElementSnapshotAppearance } from './elementSnapshotAppearance';

type Item = Extract<CollectionItemRecord, { type: 'web-scraping' }>;
/** One captured-width presentation. Source content stays in a scriptless, opaque iframe. */
export function ElementSnapshotView({ item }: { item: Item }) {
  const key = elementSnapshotAppearanceKey(item);
  const [attempt, setAttempt] = useState(0);
  const [receipt, setReceipt] = useState<{ key: string; attempt: number; value: ElementSnapshotAppearance } | null>(null);
  const host = useRef<HTMLDivElement>(null), [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(measure); observer.observe(element); return () => observer.disconnect(); }
    window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => subscribeElementSnapshotAppearance(item, value => setReceipt({ key, attempt, value })), [key, attempt]);
  const state = receipt?.key === key && receipt.attempt === attempt ? receipt.value : { status: 'loading' as const };
  const scale = state.status === 'ready' && width > 0 ? Math.min(1, width / state.snapshot.root.width) : 0;
  return <div ref={host} className="min-w-0 w-full">
    {state.status === 'error' ? <div role="alert" className="space-y-3 text-sm text-[var(--color-textSecondary)]">
      <p>The saved element appearance is unavailable. Try again, or capture it again from its source.</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)}
        className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-1.5 text-sm text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Retry appearance</button>
    </div> : state.status !== 'ready' || !scale ? <p role="status" className="text-sm text-[var(--color-textSecondary)]">Loading saved element…</p> : <>
      <div role="region" aria-label="Saved element content" tabIndex={0}
        className="max-h-[70vh] overflow-auto custom-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
        <div className="relative" style={{ width: state.snapshot.root.width * scale, height: state.snapshot.root.height * scale }}>
          <iframe title={`Captured element from ${item.title}`} sandbox="" srcDoc={state.document}
            className="absolute left-0 top-0 origin-top-left border-0" style={{ width: state.snapshot.root.width, height: state.snapshot.root.height, transform: `scale(${scale})` }}/>
        </div>
      </div>
      {state.snapshot.unsupportedFeatures.length > 0 && <p className="mt-2 text-xs text-[var(--color-textSecondary)]">Some appearance details could not be captured.</p>}
    </>}
  </div>;
}
