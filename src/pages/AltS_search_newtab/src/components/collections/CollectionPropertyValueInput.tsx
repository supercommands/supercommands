import { useCallback, useEffect, useId, useLayoutEffect, useRef, type Ref } from 'react';
import type { CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

interface Props {
  definition: CollectionPropertyDefinition;
  itemTitle: string;
  value: string;
  onChange: (value: string) => void;
  onFlush: () => Promise<void>;
  inputRef?: Ref<HTMLInputElement>;
  showLabel?: boolean;
  multiline?: boolean;
  disabled?: boolean;
}

/** Shared optional Text input for table cells and item-detail fields. */
export default function CollectionPropertyValueInput({ definition, itemTitle, value, onChange, onFlush, inputRef, showLabel = false, multiline = false, disabled = false }: Props) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fitTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
  }, []);
  useLayoutEffect(() => { if (multiline) fitTextarea(); }, [fitTextarea, multiline, value]);
  useEffect(() => {
    if (!multiline || !textareaRef.current || typeof ResizeObserver === 'undefined') return;
    const textarea = textareaRef.current;
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      fitTextarea();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [fitTextarea, multiline]);

  if (multiline) return <div className="flex min-w-0 items-start gap-3">
    {showLabel && <label htmlFor={id} className="min-w-0 max-w-48 shrink break-words pt-2 text-xs font-medium text-[var(--color-textSecondary)]">{definition.label}</label>}
    <textarea id={id} ref={textareaRef} value={value} disabled={disabled} rows={1} wrap="soft"
      aria-label={`${definition.label} for ${itemTitle}`} placeholder="Optional value"
      onChange={event => onChange(event.target.value)} onBlur={() => { void onFlush(); }}
      className="min-h-9 min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-transparent px-3 py-2 text-sm text-[var(--color-textPrimary)] placeholder:text-[var(--color-textMuted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50" />
  </div>;

  return <>
    {showLabel && <label htmlFor={id} className="mb-2 block break-words text-xs font-medium text-[var(--color-textSecondary)]">{definition.label}</label>}
    <input id={id} ref={inputRef} type="text" value={value} disabled={disabled}
      aria-label={`${definition.label} for ${itemTitle}`} placeholder="Optional value"
      onChange={event => onChange(event.target.value)} onBlur={() => { void onFlush(); }}
      onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void onFlush(); } }}
      className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] placeholder:text-[var(--color-textMuted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50" />
  </>;
}
