import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

export type ItemDraft = {
  type: CollectionItemRecord['type'];
  title: string;
  url: string;
  note: string;
  text: string;
  author: string;
};
interface Props {
  item?: CollectionItemRecord;
  onClose: () => void;
  onSave: (draft: ItemDraft) => Promise<void>;
}

const itemKind = (type: CollectionItemRecord['type']) =>
  type === 'screenshot' ? 'image' : type === 'web-scraping' ? 'web scraping' : type;

const CollectionItemEditor = ({ item, onClose, onSave }: Props) => {
  const [type, setType] = useState<ItemDraft['type']>(item?.type ?? 'link');
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [text, setText] = useState(item?.type === 'text' || item?.type === 'article' ? item.data.text : '');
  const [author, setAuthor] = useState(item?.type === 'article' ? (item.data.author ?? '') : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (
      !title.trim() ||
      (type !== 'screenshot' && !url.trim()) ||
      ((type === 'text' || type === 'article') && !text.trim())
    ) {
      setError('Complete the required fields.');
      return;
    }
    if (url.trim()) {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
      } catch {
        setError('Enter a valid HTTP or HTTPS source URL.');
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({ type, title: title.trim(), url: url.trim(), note: note.trim(), text, author: author.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save item.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        formRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
        ) ?? [],
      );
      if (!focusable.length) return;
      if (!formRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        focusable[0].focus();
      } else if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saving]);

  const fieldClass =
    'mt-1.5 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] placeholder:text-[var(--color-textMuted)] focus-visible:border-[var(--color-borderActive)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]';
  const labelClass = 'block text-xs font-medium text-[var(--color-textSecondary)]';

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-[var(--color-overlayBg)] p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close editor"
        disabled={saving}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-item-editor-title"
        onSubmit={event => {
          void submit(event);
        }}
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-borderDefault)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="collection-item-editor-title" className="text-base font-semibold">
              {item ? `Edit ${itemKind(item.type)}` : 'Add item'}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-textMuted)]">
              {item ? 'Update the saved details.' : 'Save a link or article to this webclip.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close editor"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 custom-scrollbar">
          {!item && (
            <label className={labelClass}>
              Type
              <select
                value={type}
                onChange={event => setType(event.target.value as ItemDraft['type'])}
                className={fieldClass}>
                <option value="link">Link</option>
                <option value="article">Article</option>
              </select>
            </label>
          )}
          <label className={labelClass}>
            Title
            <input
              ref={titleRef}
              value={title}
              onChange={event => setTitle(event.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Source URL{' '}
            {type === 'screenshot' && <span className="font-normal text-[var(--color-textMuted)]">(optional)</span>}
            <input
              value={url}
              onChange={event => setUrl(event.target.value)}
              type="url"
              required={type !== 'screenshot'}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Note <span className="font-normal text-[var(--color-textMuted)]">(optional)</span>
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={3}
              className={`${fieldClass} resize-y`}
            />
          </label>
          {(type === 'text' || type === 'article') && (
            <label className={labelClass}>
              {type === 'article' ? 'Article text' : 'Text'}
              <textarea
                value={text}
                onChange={event => setText(event.target.value)}
                required
                rows={6}
                className={`${fieldClass} resize-y`}
              />
            </label>
          )}
          {type === 'article' && (
            <label className={labelClass}>
              Author <span className="font-normal text-[var(--color-textMuted)]">(optional)</span>
              <input value={author} onChange={event => setAuthor(event.target.value)} className={fieldClass} />
            </label>
          )}
          {item?.type === 'screenshot' && (
            <p className="text-xs text-[var(--color-textMuted)]">
              The saved image stays attached when you edit its details.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-[var(--color-danger)]">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-borderDefault)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-2 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-[var(--color-borderActive)] bg-[var(--color-inputBg)] px-3 py-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
};

export default CollectionItemEditor;
