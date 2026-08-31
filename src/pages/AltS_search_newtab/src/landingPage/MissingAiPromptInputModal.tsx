import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface MissingAiPromptInputModalProps {
  title?: string;
  isSending?: boolean;
  onClose: () => void;
  onSend: (prompt: string) => void;
}

export const MissingAiPromptInputModal = ({
  title,
  isSending = false,
  onClose,
  onSend,
}: MissingAiPromptInputModalProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !isSending;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = value.trim();
    if (!prompt || isSending) return;
    onSend(prompt);
  };

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center px-4 text-[var(--color-textPrimary)]">
      <button
        type="button"
        aria-label="Close prompt input"
        className="absolute inset-0 cursor-default bg-[var(--color-rootBg)] opacity-80 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-[520px] flex-col gap-4 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-4 shadow-2xl">
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold">Enter prompt</div>
          {title && <div className="truncate text-xs text-[var(--color-textSecondary)]">{title}</div>}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={event => setValue(event.target.value)}
          className="min-h-[128px] w-full resize-none rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-2 text-sm text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none focus:border-[var(--color-borderActive)]"
          placeholder="Type the prompt to send"
          disabled={isSending}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]"
            onClick={onClose}
            disabled={isSending}>
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSend}>
            {isSending ? 'Sending...' : 'Send prompt'}
          </button>
        </div>
      </form>
    </div>
  );
};
