import * as React from 'react';

export const CalendarEmptyState: React.FC = () => (
  <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4 text-xs text-[var(--color-textSecondary)]">
    No assigned hotkey or text shortcut activity yet. Your usage will appear here after you trigger an assigned shortcut.
  </div>
);
