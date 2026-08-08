import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import { LuClock3, LuGlobe, LuMapPin } from 'react-icons/lu';
import type { WidgetSizePreset } from '../widgetDashboard.types';

interface TimeWidgetProps {
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
}

const FALLBACK_TIME_ZONE = 'UTC';

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
};

const getLocale = () => {
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
};

const formatTime = (date: Date, timeZone: string, includeSeconds: boolean) => {
  try {
    return new Intl.DateTimeFormat(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      timeZone: FALLBACK_TIME_ZONE,
    }).format(date);
  }
};

const formatDate = (date: Date, timeZone: string, sizePreset: WidgetSizePreset) => {
  const dateStyle = sizePreset === 'small' ? 'medium' : sizePreset === 'large' ? 'full' : 'long';

  try {
    return new Intl.DateTimeFormat(getLocale(), {
      weekday: sizePreset === 'small' ? 'short' : 'long',
      month: dateStyle === 'medium' ? 'short' : 'long',
      day: 'numeric',
      year: sizePreset === 'large' ? 'numeric' : undefined,
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: FALLBACK_TIME_ZONE,
    }).format(date);
  }
};

const formatUtcOffset = (date: Date, timeZone: string) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    return parts.find(part => part.type === 'timeZoneName')?.value || 'UTC';
  } catch {
    return 'UTC';
  }
};

const formatTimeZoneName = (timeZone: string) => {
  const normalizedTimeZone = timeZone.toLowerCase();
  if (normalizedTimeZone === 'asia/calcutta' || normalizedTimeZone === 'asia/kolkata') {
    return 'India Standard Time';
  }

  return timeZone
    .split('/')
    .pop()
    ?.replace(/_/g, ' ') || timeZone;
};

const getGreeting = (date: Date, timeZone: string) => {
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone,
      }).format(date),
    );

    if (hour < 5) return 'Quiet hours';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 20) return 'Good evening';
    return 'Good night';
  } catch {
    return 'Local time';
  }
};

const TimeWidget: React.FC<TimeWidgetProps> = ({ sizePreset = 'medium', isEditMode = false }) => {
  const [now, setNow] = useState(() => new Date());
  const timeZone = useMemo(getBrowserTimeZone, []);
  const isSmall = sizePreset === 'small';
  const isLarge = sizePreset === 'large';

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const localTime = formatTime(now, timeZone, !isSmall);
  const localDate = formatDate(now, timeZone, sizePreset);
  const offset = formatUtcOffset(now, timeZone);
  const zoneLabel = formatTimeZoneName(timeZone);
  const utcTime = formatTime(now, FALLBACK_TIME_ZONE, false);
  const greeting = getGreeting(now, timeZone);
  const containerPadding = isSmall ? 'px-4 py-3.5' : isLarge ? 'px-7 py-6' : 'px-6 py-5';
  const timeTextSize = isSmall ? 'text-[30px]' : isLarge ? 'text-6xl' : 'text-[46px]';
  const dateTextSize = isSmall ? 'text-[10px]' : isLarge ? 'text-base' : 'text-sm';
  const detailGridClass = 'grid-cols-3';
  const detailCardClass = isSmall ? 'px-2 py-1.5' : isLarge ? 'px-3 py-2.5' : 'px-2.5 py-2';
  const detailLabelClass = isSmall ? 'text-[7px]' : 'text-[9px]';
  const detailValueClass = isSmall ? 'text-[9px]' : 'text-[11px]';
  const detailSubValueClass = isSmall ? 'text-[7px]' : 'text-[9px]';

  return (
    <div
      className={`relative flex h-full w-full min-w-0 overflow-hidden text-[var(--color-textPrimary)] ${
        containerPadding
      } ${isEditMode ? (isSmall ? 'pb-10' : 'pb-14') : ''}`}>
      <div className="relative z-10 flex min-h-0 w-full flex-col justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-normal text-[var(--color-textMuted)]">
            <LuClock3 size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
            <span className="truncate">Time</span>
          </div>
          <div className={`truncate font-bold text-[var(--color-textMuted)] ${detailLabelClass}`}>{offset}</div>
        </div>

        <div className={`min-w-0 ${isSmall ? 'py-2' : isLarge ? 'py-5' : 'py-3.5'}`}>
          <div className={`truncate font-bold leading-none tracking-normal ${timeTextSize}`}>
            {localTime}
          </div>
          <div className={`mt-2 truncate font-bold text-[var(--color-textSecondary)] ${dateTextSize}`}>
            {localDate}
          </div>
        </div>

        <div className={`grid min-w-0 gap-2 ${detailGridClass}`}>
          <div className={`min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] ${detailCardClass}`}>
            <div className={`flex min-w-0 items-center gap-1 font-bold uppercase tracking-normal text-[var(--color-textMuted)] ${detailLabelClass}`}>
              <LuGlobe size={11} className="shrink-0" />
              <span className="truncate">Local</span>
            </div>
            <div className={`mt-1 truncate font-bold text-[var(--color-textPrimary)] ${detailValueClass}`}>{zoneLabel}</div>
            <div className={`mt-0.5 truncate font-bold text-[var(--color-textMuted)] ${detailSubValueClass}`}>{offset}</div>
          </div>
          <div className={`min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] ${detailCardClass}`}>
            <div className={`truncate font-bold uppercase tracking-normal text-[var(--color-textMuted)] ${detailLabelClass}`}>
              UTC
            </div>
            <div className={`mt-1 truncate font-bold text-[var(--color-textPrimary)] ${detailValueClass}`}>{utcTime}</div>
          </div>
          <div className={`min-w-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] ${detailCardClass}`}>
            <div className={`flex min-w-0 items-center gap-1 font-bold uppercase tracking-normal text-[var(--color-textMuted)] ${detailLabelClass}`}>
              <LuMapPin size={11} className="shrink-0" />
              <span className="truncate">Now</span>
            </div>
            <div className={`mt-1 truncate font-bold text-[var(--color-textPrimary)] ${detailValueClass}`}>{greeting}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeWidget;
