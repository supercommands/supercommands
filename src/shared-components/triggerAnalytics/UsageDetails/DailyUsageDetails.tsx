import * as React from 'react';
import type { DayUsageDetails } from '../../triggers';
import { TriggerUsageList } from './TriggerUsageList';

export const DailyUsageDetails: React.FC<{ details: DayUsageDetails | null }> = ({ details }) => {
  if (!details) return null;
  const date = new Date(`${details.dateKey}T00:00:00`);
  const label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">{label}</h3>
          <p className="mt-1 text-xs text-[var(--color-textSecondary)]">
            {details.totalUses} total uses - {details.hotkeyUses} hotkeys - {details.shortcutUses} text shortcuts
            {details.failureCount ? ` - ${details.failureCount} failed` : ''}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <TriggerUsageList rows={details.rows} />
      </div>
    </div>
  );
};
