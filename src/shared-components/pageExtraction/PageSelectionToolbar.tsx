import { useEffect, useRef } from 'react';

/** Reuses the capture toolbar's theme, controls and local keyboard ownership. */
export function PageSelectionToolbar({ label, canConfirm, canReselect, canCancel = true, onConfirm, onReselect, onCancel }: {
  label: string;
  canConfirm: boolean;
  canReselect: boolean;
  canCancel?: boolean;
  onConfirm: () => void;
  onReselect: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => { cancelRef.current?.focus({ preventScroll: true }); }, []);
  return <div ref={toolbarRef} className="website-popup-screenshot-selection__toolbar" data-screenshot-toolbar
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const buttons = Array.from(toolbarRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
      if (!buttons.length) { event.preventDefault(); return; }
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
      event.preventDefault(); buttons[next]?.focus();
    }}>
    <span role="status" aria-live="polite">{label}</span>
    <button className="website-popup-create-footer__save" type="button" disabled={!canConfirm} onClick={onConfirm}>Use selection</button>
    <button className="website-popup-create-footer__save" type="button" disabled={!canReselect} onClick={onReselect}>Reselect</button>
    <button ref={cancelRef} className="website-popup-create-footer__save" type="button" disabled={!canCancel} onClick={onCancel}>Cancel</button>
  </div>;
}
