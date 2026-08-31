import * as React from 'react';
import { useAppearance } from '@extension/ui';
import { useShortcutCalendar } from './hooks/useShortcutCalendar';
import { ContributionCalendar } from './ContributionCalendar/ContributionCalendar';
import { DailyUsageDetails } from './UsageDetails/DailyUsageDetails';

const getThemeUsageVars = (_themeId: string | undefined, isDark: boolean | undefined): React.CSSProperties => {
  // Derive calendar heat-map colours from the semantic isDark flag.
  // All 12 theme variants are handled correctly without per-ID branching.
  if (isDark) {
    return {
      '--usage-level-0': '#20242b',
      '--usage-level-1': '#123c2a',
      '--usage-level-2': '#166534',
      '--usage-level-3': '#22a057',
      '--usage-level-4': '#6ee7a8',
      '--usage-border': 'rgba(255,255,255,0.08)',
    } as React.CSSProperties;
  }
  return {
    '--usage-level-0': '#edf1f3',
    '--usage-level-1': '#b8efd0',
    '--usage-level-2': '#6dd995',
    '--usage-level-3': '#2fa861',
    '--usage-level-4': '#176b3a',
    '--usage-border': 'rgba(15,23,42,0.08)',
  } as React.CSSProperties;
};

export const ShortcutAnalyticsCard: React.FC<{ userId?: string }> = ({ userId = 'local_user' }) => {
  const { theme, themeId } = useAppearance();
  const calendar = useShortcutCalendar(userId);

  return (
    <div className="space-y-4" style={getThemeUsageVars(themeId, theme?.isDark)}>
      <div>
        <h2 className="text-lg font-bold text-[var(--color-textPrimary)]">Usage</h2>
        <p className="mt-1 text-xs text-[var(--color-textSecondary)]">
          Review how often assigned hotkeys and text shortcuts are actually used.
        </p>
      </div>

      {calendar.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Total uses', calendar.data.totals.usages],
            ['Hotkeys', calendar.data.totals.hotkeys],
            ['Text shortcuts', calendar.data.totals.textShortcuts],
            ['Active days', calendar.data.totals.activeDays],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-3">
              <div className="text-lg font-bold text-[var(--color-textPrimary)] tabular-nums">{value}</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-textMuted)]">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      <ContributionCalendar
        data={calendar.data}
        isLoading={calendar.isLoading}
        selectedDate={calendar.selectedDate}
        year={calendar.year}
        onSelectDate={calendar.selectDate}
        onPreviousYear={calendar.goPreviousYear}
        onNextYear={calendar.goNextYear}
        onToday={calendar.goToday}
      />

      <DailyUsageDetails details={calendar.selectedDetails} />
    </div>
  );
};

export default ShortcutAnalyticsCard;
