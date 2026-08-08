import * as React from 'react';

type CalendarHeaderProps = {
  year: number;
  disableNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({ year, disableNext, onPrevious, onNext, onToday }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Shortcut Activity</h3>
      <p className="text-xs text-[var(--color-textSecondary)] mt-1">
        Daily usage from assigned hotkeys and text shortcuts.
      </p>
    </div>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onPrevious}
        className="h-7 w-7 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]">
        ‹
      </button>
      <div className="min-w-14 text-center text-xs font-bold text-[var(--color-textPrimary)]">{year}</div>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className="h-7 w-7 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] disabled:opacity-40">
        ›
      </button>
      <button
        type="button"
        onClick={onToday}
        className="ml-1 h-7 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] px-2 text-xs font-semibold text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]">
        Today
      </button>
    </div>
  </div>
);
