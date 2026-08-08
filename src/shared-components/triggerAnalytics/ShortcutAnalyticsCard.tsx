import * as React from 'react';
import { useAppearance } from '@extension/ui';
import { useShortcutCalendar } from './hooks/useShortcutCalendar';
import { ContributionCalendar } from './ContributionCalendar/ContributionCalendar';
import { DailyUsageDetails } from './UsageDetails/DailyUsageDetails';

const getThemeUsageVars = (themeId: string | undefined, isDark: boolean | undefined): React.CSSProperties => {
  const base = isDark
    ? {
        '--usage-level-0': '#20242b',
        '--usage-level-1': '#123c2a',
        '--usage-level-2': '#166534',
        '--usage-level-3': '#22a057',
        '--usage-level-4': '#6ee7a8',
        '--usage-border': 'rgba(255,255,255,0.08)',
      }
    : {
        '--usage-level-0': '#edf1f3',
        '--usage-level-1': '#b8efd0',
        '--usage-level-2': '#6dd995',
        '--usage-level-3': '#2fa861',
        '--usage-level-4': '#176b3a',
        '--usage-border': 'rgba(15,23,42,0.08)',
      };

  if (themeId === 'cherry-blossom') {
    return {
      ...base,
      '--usage-level-0': '#f2e7ef',
      '--usage-level-1': '#c8efd2',
      '--usage-level-2': '#85d99a',
      '--usage-level-3': '#45ad67',
      '--usage-level-4': '#227246',
    } as React.CSSProperties;
  }
  if (themeId === 'periwinkle-mist') {
    return {
      ...base,
      '--usage-level-0': '#e8edf7',
      '--usage-level-1': '#c3ead2',
      '--usage-level-2': '#8ad1a3',
      '--usage-level-3': '#4da36d',
      '--usage-level-4': '#2f704d',
    } as React.CSSProperties;
  }
  if (themeId === 'coastal-mint' || themeId === 'reflect-gradient') {
    return {
      ...base,
      '--usage-level-0': '#e2eceb',
      '--usage-level-1': '#b8ead4',
      '--usage-level-2': '#78d5a8',
      '--usage-level-3': '#3ba777',
      '--usage-level-4': '#247356',
    } as React.CSSProperties;
  }

  return base as React.CSSProperties;
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
