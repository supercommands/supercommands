import * as React from 'react';

export const CalendarLegend: React.FC = () => (
  <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-textMuted)]">
    <span>Less</span>
    {[0, 1, 2, 3, 4].map(level => (
      <span
        key={level}
        className="h-3 w-3 rounded-[2px] border"
        style={{ backgroundColor: `var(--usage-level-${level})`, borderColor: 'var(--usage-border)' }}
      />
    ))}
    <span>More</span>
  </div>
);
