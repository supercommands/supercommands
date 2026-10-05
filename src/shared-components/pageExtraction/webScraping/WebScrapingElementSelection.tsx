import { useLayoutEffect, useRef, useState } from 'react';
import { PageSelectionOutline } from '../PageSelectionOutline';
import { PageSelectionToolbar } from '../PageSelectionToolbar';
import { startElementPicker, type ElementPicker, type ElementPickerSelection } from './elementPicker';

/** Render in the existing themed capture slot; no extraction or persistence here. */
export function WebScrapingElementSelection({ onConfirm, onCancel, busy = false }: {
  onConfirm: (element: Element) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<ElementPicker | null>(null);
  const callbacks = useRef({ onConfirm, onCancel });
  callbacks.current = { onConfirm, onCancel };
  const [selection, setSelection] = useState<ElementPickerSelection | null>(null);
  const [selected, setSelected] = useState(false);
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const picker = startElementPicker({ document: overlay.ownerDocument, overlay,
      onChange: (next, locked) => { setSelection(next); setSelected(locked); },
      onConfirm: element => callbacks.current.onConfirm(element),
      onCancel: () => callbacks.current.onCancel(),
    });
    pickerRef.current = picker;
    return () => { picker.dispose(); pickerRef.current = null; };
  }, []);
  return <div ref={overlayRef} className="website-popup-screenshot-selection website-popup-element-selection" role="dialog" aria-modal="true" aria-label="Select website content">
    {selection && <PageSelectionOutline hovering={!selected} style={{ left: selection.rect.x, top: selection.rect.y, width: selection.rect.width, height: selection.rect.height }}/>}
    <PageSelectionToolbar label={busy ? 'Capturing element appearance…' : selected ? 'Use this element?' : 'Point to content and click to select'}
      canConfirm={!busy && selected && Boolean(selection)} canReselect={!busy && selected}
      onConfirm={() => pickerRef.current?.confirm()} onReselect={() => pickerRef.current?.reselect()}
      onCancel={() => { pickerRef.current?.dispose(); callbacks.current.onCancel(); }}/>
  </div>;
}
