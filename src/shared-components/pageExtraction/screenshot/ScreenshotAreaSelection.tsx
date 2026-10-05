import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ScreenshotCropRect } from './cropViewportScreenshot';
import { PageSelectionOutline } from '../PageSelectionOutline';
import { PageSelectionToolbar } from '../PageSelectionToolbar';

type Props = {
  dataUrl: string;
  viewport: { width: number; height: number };
  rect: ScreenshotCropRect | null;
  status: 'selecting' | 'confirming' | 'cropping' | 'ready' | 'preparing-image' | 'saving';
  onSelect: (rect: ScreenshotCropRect) => void;
  onConfirm: () => void;
  onReselect: () => void;
  onCancel: () => void;
};

/** Frozen viewport selection. Persistence and popup routing remain owned by callers. */
export function ScreenshotAreaSelection({ dataUrl, viewport, rect, status, onSelect, onConfirm, onReselect, onCancel }: Props) {
  const origin = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const [dragRect, setDragRect] = useState<ScreenshotCropRect | null>(null);
  useEffect(() => { if (status === 'selecting') setDragRect(null); }, [status]);
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(viewport.width, (event.clientX - bounds.left) * viewport.width / bounds.width)),
      y: Math.max(0, Math.min(viewport.height, (event.clientY - bounds.top) * viewport.height / bounds.height)) };
  };
  const rectangle = (event: PointerEvent<HTMLDivElement>): ScreenshotCropRect | null => {
    const start = origin.current;
    if (!start || start.pointerId !== event.pointerId) return null;
    const end = point(event);
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  };
  const displayed = rect || dragRect;
  const busy = status === 'cropping' || status === 'preparing-image' || status === 'saving';
  const label = status === 'selecting' ? 'Drag to select an area'
    : status === 'confirming' ? 'Use this selection?'
      : status === 'cropping' ? 'Preparing selection…' : status === 'preparing-image' ? 'Preparing image…' : status === 'saving' ? 'Saving…' : 'Selection ready';
  return <div className="website-popup-screenshot-selection" role="dialog" aria-modal="true" aria-label="Select screenshot area"
    onContextMenu={event => event.preventDefault()} onWheel={event => event.preventDefault()}
    onKeyDown={event => event.stopPropagation()}
    onPointerDown={event => {
      if (status !== 'selecting' || event.button !== 0 || !event.isPrimary
          || (event.target as Element).closest('[data-screenshot-toolbar]')) return;
      event.preventDefault();
      origin.current = { ...point(event), pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragRect(null);
    }}
    onPointerMove={event => { const next = rectangle(event); if (next) setDragRect(next); }}
    onPointerUp={event => {
      const next = rectangle(event);
      if (!next) return;
      origin.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (next.width > 0 && next.height > 0) { setDragRect(null); onSelect(next); }
      else setDragRect(null);
    }}
    onPointerCancel={() => { origin.current = null; setDragRect(null); }}
    onLostPointerCapture={() => { origin.current = null; setDragRect(null); }}>
    <img className="website-popup-screenshot-selection__image" src={dataUrl} alt="Captured website" draggable={false}/>
    {displayed ? <PageSelectionOutline style={{
      left: `${displayed.x / viewport.width * 100}%`, top: `${displayed.y / viewport.height * 100}%`,
      width: `${displayed.width / viewport.width * 100}%`, height: `${displayed.height / viewport.height * 100}%`,
    }}/> : null}
    <PageSelectionToolbar label={label} canConfirm={status === 'confirming'} canReselect={!busy && status !== 'selecting'}
      canCancel={status !== 'saving'} onConfirm={onConfirm} onReselect={onReselect} onCancel={onCancel}/>
  </div>;
}
