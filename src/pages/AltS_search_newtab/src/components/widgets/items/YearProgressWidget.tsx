import React, { useEffect, useState, useRef, useMemo } from 'react';
import { LuCalendarDays } from 'react-icons/lu';
import type { WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import { widgetPerf } from '../utils/widgetPerf';
import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';
import EditableWidgetTitle from '../components/EditableWidgetTitle';
interface YearProgressWidgetProps {
    widget?: WidgetInstance;
    sizePreset?: WidgetSizePreset;
    isEditMode?: boolean;
    layoutInfo?: WidgetLayoutInfo;
}
interface YearProgressData {
    progress: number;
    percentage: number;
    remainingLabel: string;
    daysPassed: number;
    daysLeft: number;
}
/**
 * Computes calendar-accurate remaining time from `now` until the start of next year (Jan 1 00:00:00).
 * Avoids millisecond-division approximations by advancing full calendar months.
 */
function getCalendarRemainingLabel(now: Date, startOfNextYear: Date): string {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();
    // Edge case: Jan 1
    if (currentMonth === 0 && currentDate === 1) {
        const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0;
        return `${isLeapYear ? 366 : 365}d left`;
    }
    // Calculate full months remaining until December 31
    // If today is day 1 of month M, the remaining calendar months until next Jan 1 is (12 - M).
    // Otherwise, we count complete months after the current month, plus remaining days in the current month.
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemainingInMonth = daysInCurrentMonth - currentDate;
    let fullMonths = 11 - currentMonth;
    let remainingDays = daysRemainingInMonth;
    if (remainingDays === 0) {
        // Exact month boundary
        if (fullMonths > 0) {
            return `${fullMonths}m left`;
        }
        return '1d left';
    }
    if (fullMonths > 0) {
        return `${fullMonths}m ${remainingDays}d left`;
    }
    return `${remainingDays}d left`;
}
function computeYearProgress(now: Date): YearProgressData {
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const startOfNextYear = new Date(year + 1, 0, 1, 0, 0, 0, 0);
    const totalTime = startOfNextYear.getTime() - startOfYear.getTime();
    const elapsedTime = now.getTime() - startOfYear.getTime();
    const progress = Math.min(1, Math.max(0, elapsedTime / totalTime));
    // Use Math.floor so we never prematurely show 100% before the year concludes
    const percentage = Math.min(100, Math.max(0, Math.floor(progress * 100)));
    const oneDayMs = 86400000;
    const daysPassed = Math.floor(elapsedTime / oneDayMs);
    const daysLeft = Math.max(0, Math.ceil((startOfNextYear.getTime() - now.getTime()) / oneDayMs));
    const remainingLabel = getCalendarRemainingLabel(now, startOfNextYear);
    return {
        progress,
        percentage,
        remainingLabel,
        daysPassed,
        daysLeft,
    };
}
export const YearProgressWidget: React.FC<YearProgressWidgetProps> = ({ widget, sizePreset = 'medium', isEditMode = false, layoutInfo, }) => {
    const [data, setData] = useState<YearProgressData>(() => computeYearProgress(new Date()));
    const firstContentLoggedRef = useRef(false);
    // DST-safe midnight recalculation timer & visibility listener
    useEffect(() => {
        let timeoutId: number | undefined;
        const scheduleMidnightUpdate = () => {
            const now = new Date();
            const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
            const delay = Math.max(1000, nextMidnight.getTime() - now.getTime() + 100);
            timeoutId = window.setTimeout(() => {
                setData(computeYearProgress(new Date()));
                scheduleMidnightUpdate();
            }, delay);
        };
        scheduleMidnightUpdate();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setData(computeYearProgress(new Date()));
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            if (timeoutId)
                window.clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);
    useEffect(() => {
        if (firstContentLoggedRef.current)
            return;
        firstContentLoggedRef.current = true;
        widgetPerf('content:firstReady', {
            widgetType: widget?.type || 'year-progress',
            widgetId: widget?.id || 'unknown',
            percentage: data.percentage,
        });
    }, [data.percentage, widget?.id, widget?.type]);
    const isSmall = sizePreset === 'small' || Boolean(layoutInfo?.isNarrow);
    const isLarge = sizePreset === 'large' || Boolean(layoutInfo?.isWide);
    const percentageTextSize = isSmall ? 'text-[28px]' : isLarge ? 'text-5xl' : 'text-[38px]';
    // Compute 52-week array (or 53 weeks) for the full year: each week has 7 days
    const yearWeeks = useMemo(() => {
        const year = new Date().getFullYear();
        const weeks: Array<Array<{
            dayOfYear: number;
            isPassed: boolean;
            isToday: boolean;
        }>> = [];
        let currentWeek: Array<{
            dayOfYear: number;
            isPassed: boolean;
            isToday: boolean;
        }> = [];
        const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        const totalDays = isLeap ? 366 : 365;
        for (let day = 0; day < totalDays; day += 1) {
            const isPassed = day < data.daysPassed;
            const isToday = day === data.daysPassed;
            currentWeek.push({ dayOfYear: day, isPassed, isToday });
            if (currentWeek.length === 7 || day === totalDays - 1) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }
        return weeks;
    }, [data.daysPassed]);
    return (<div className={`relative flex h-full w-full select-none flex-col justify-between text-[var(--color-textPrimary)] transition-all duration-200 ${isEditMode ? 'pb-6' : ''}`}>
      {/* Header follows the Time widget's icon and title treatment. */}
      <div className="flex shrink-0 min-w-0 items-center gap-2 mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-textPrimary)]">
        <LuCalendarDays size={14} className="shrink-0 text-[var(--color-iconDefault)]" aria-hidden="true"/>
        {widget ? (<EditableWidgetTitle viewId={widget.viewId} widgetId={widget.id} initialTitle={widget.title || 'Year Progress'} isEditMode={isEditMode} className="truncate text-xs font-medium uppercase tracking-wider text-[var(--color-textPrimary)]"/>) : (<span className="truncate">Year Progress</span>)}
      </div>

      {/* Percentage is the primary metric; remaining time stays secondary. */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-2 text-center">
        <div className={`font-medium leading-none tracking-normal ${percentageTextSize}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.percentage} aria-label={`Year progress: ${data.percentage}% complete`}>
          {data.percentage}%
        </div>
        <div className={`mt-1.5 font-normal text-[var(--color-textSecondary)] ${isLarge ? 'text-sm' : 'text-xs'}`}>
          {data.remainingLabel}
        </div>
        <div className="mt-1 text-xs font-medium text-[var(--color-textMuted)]">
          {data.daysLeft} days left
        </div>
      </div>

      {/* Bottom: GitHub-Style Year Progress Block Grid (Rendered for medium & large layouts) */}
      {!isSmall && (<div className="flex w-full shrink-0 flex-col justify-end min-h-0 pt-2 pb-0.5">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--color-textMuted)] pb-1 px-0.5">
            <span>Jan</span>
            <span>Apr</span>
            <span>Jul</span>
            <span>Oct</span>
            <span>Dec</span>
          </div>
          <div className="flex w-full h-[96px] gap-[2.5px] sm:gap-[3px] items-stretch justify-between overflow-hidden">
            {yearWeeks.map((week, wIndex) => (<div key={wIndex} className="flex flex-1 flex-col gap-[2.5px] min-w-0 h-full justify-between">
                {week.map(day => (<div key={day.dayOfYear} title={`Day ${day.dayOfYear + 1} of year`} className={`flex-1 w-full min-h-[7px] max-h-[12px] rounded-[2px] transition-colors ${day.isToday
                        ? 'bg-[var(--color-textPrimary)] ring-1.5 ring-[var(--color-focusRing,#a855f7)] shadow-sm'
                        : day.isPassed
                            ? 'bg-[var(--color-accent,var(--color-success))] opacity-90'
                            : 'bg-[color:color-mix(in_srgb,var(--color-textMuted)_22%,transparent)]'}`}/>))}
              </div>))}
          </div>
        </div>)}
    </div>);
};
export default YearProgressWidget;
