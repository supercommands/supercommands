import { useEffect, useMemo, useState, useRef } from 'react';
import type * as React from 'react';
import { LuClock3, LuGlobe, LuSettings } from 'react-icons/lu';
import type { WidgetInstance, WidgetSizePreset, TimeWidgetSettings } from '../widgetDashboard.types';
import { updateWidgetSettingsAsync } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import { TimeWidgetSettingsPopover, type TimeZoneOption } from '../components/TimeWidgetSettingsPopover';

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';
import { getWidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface TimeWidgetProps {
  widget?: WidgetInstance;
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

export const TIME_ZONE_REGISTRY: TimeZoneOption[] = [
  { id: 'America/New_York', label: 'New York', timeZone: 'America/New_York' },
  { id: 'America/Los_Angeles', label: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { id: 'America/Chicago', label: 'Chicago', timeZone: 'America/Chicago' },
  { id: 'America/Toronto', label: 'Toronto', timeZone: 'America/Toronto' },
  { id: 'America/Sao_Paulo', label: 'São Paulo', timeZone: 'America/Sao_Paulo' },
  { id: 'Europe/London', label: 'London', timeZone: 'Europe/London' },
  { id: 'Europe/Paris', label: 'Paris', timeZone: 'Europe/Paris' },
  { id: 'Europe/Berlin', label: 'Berlin', timeZone: 'Europe/Berlin' },
  { id: 'Asia/Dubai', label: 'Dubai', timeZone: 'Asia/Dubai' },
  { id: 'Asia/Kolkata', label: 'New Delhi', timeZone: 'Asia/Kolkata' },
  { id: 'Asia/Singapore', label: 'Singapore', timeZone: 'Asia/Singapore' },
  { id: 'Asia/Hong_Kong', label: 'Hong Kong', timeZone: 'Asia/Hong_Kong' },
  { id: 'Asia/Tokyo', label: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { id: 'Asia/Seoul', label: 'Seoul', timeZone: 'Asia/Seoul' },
  { id: 'Australia/Sydney', label: 'Sydney', timeZone: 'Australia/Sydney' },
  { id: 'Pacific/Auckland', label: 'Auckland', timeZone: 'Pacific/Auckland' },
];

export const DEFAULT_TIME_ZONE_IDS = [
  'America/New_York',
  'Asia/Tokyo',
  'Europe/London',
];

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

const formatMainTime = (date: Date, timeZone: string, includeSeconds: boolean) => {
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

const formatWorldTime = (date: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch {
    return '--:--';
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

export const normalizeTimeWidgetSettings = (settings: unknown): TimeWidgetSettings => {
  const rawIds = (settings && typeof settings === 'object' && Array.isArray((settings as any).selectedTimeZoneIds))
    ? (settings as any).selectedTimeZoneIds
    : null;

  if (!rawIds || rawIds.length === 0) {
    return { selectedTimeZoneIds: [...DEFAULT_TIME_ZONE_IDS] };
  }

  const validSet = new Set(TIME_ZONE_REGISTRY.map(tz => tz.id));
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawId of rawIds) {
    if (typeof rawId === 'string' && validSet.has(rawId) && !seen.has(rawId)) {
      seen.add(rawId);
      normalized.push(rawId);
      if (normalized.length === 3) break;
    }
  }

  if (normalized.length === 0) {
    return { selectedTimeZoneIds: [...DEFAULT_TIME_ZONE_IDS] };
  }

  return { selectedTimeZoneIds: normalized };
};

export const TimeWidget: React.FC<TimeWidgetProps> = ({
  widget,
  sizePreset = 'medium',
  isEditMode = false,
  layoutInfo: providedLayoutInfo,
}) => {
  const layout = providedLayoutInfo || getWidgetLayoutInfo(sizePreset === 'large' ? 12 : sizePreset === 'medium' ? 8 : 4, 5);
  const { isNarrow, isWide, isTall, isExtraTall } = layout;

  const [now, setNow] = useState(() => new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const browserTimeZone = useMemo(() => getBrowserTimeZone(), []);

  const rawSettings = (widget?.settings || {}) as Partial<TimeWidgetSettings>;
  const selectedTimeZoneIds = useMemo(() => {
    if (Array.isArray(rawSettings.selectedTimeZoneIds)) {
      return rawSettings.selectedTimeZoneIds;
    }
    return DEFAULT_TIME_ZONE_IDS;
  }, [rawSettings.selectedTimeZoneIds]);

  const activeLocations = useMemo(() => {
    const map = new Map(TIME_ZONE_REGISTRY.map(tz => [tz.id, tz]));
    return selectedTimeZoneIds
      .map(id => map.get(id))
      .filter((tz): tz is TimeZoneOption => Boolean(tz));
  }, [selectedTimeZoneIds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOpenSettings = () => {
    if (!isSettingsOpen && settingsBtnRef.current) {
      const rect = settingsBtnRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverWidth = Math.min(360, viewportWidth - 24);
      const popoverEstHeight = 360;

      let left = rect.right - popoverWidth + window.scrollX;
      if (left + popoverWidth > window.scrollX + viewportWidth - 12) {
        left = window.scrollX + viewportWidth - popoverWidth - 12;
      }
      if (left < window.scrollX + 12) {
        left = window.scrollX + 12;
      }

      let top = rect.bottom + window.scrollY + 4;
      if (top + popoverEstHeight > window.scrollY + viewportHeight - 12) {
        const topAbove = rect.top + window.scrollY - popoverEstHeight - 4;
        if (topAbove >= window.scrollY + 12) {
          top = topAbove;
        } else {
          top = Math.max(window.scrollY + 12, window.scrollY + viewportHeight - popoverEstHeight - 12);
        }
      }

      setPopoverPos({ top, left });
    }
    setIsSettingsOpen(!isSettingsOpen);
  };

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isSettingsOpen]);

  const handleToggleTimeZone = (timeZoneId: string) => {
    let nextIds: string[];
    if (selectedTimeZoneIds.includes(timeZoneId)) {
      nextIds = selectedTimeZoneIds.filter(id => id !== timeZoneId);
    } else {
      if (selectedTimeZoneIds.length >= 3) return;
      nextIds = [...selectedTimeZoneIds, timeZoneId];
    }

    if (widget?.viewId && widget?.id) {
      void updateWidgetSettingsAsync(widget.viewId, widget.id, {
        selectedTimeZoneIds: nextIds,
      });
    }
  };

  const localTime = formatMainTime(now, browserTimeZone, !isNarrow);
  const localDate = formatDate(now, browserTimeZone, sizePreset);
  const localOffset = formatUtcOffset(now, browserTimeZone);

  const containerPadding = isNarrow ? 'px-4 pt-3 pb-3' : isWide ? 'px-6 pt-4 pb-5' : 'px-5 pt-3.5 pb-4';
  const timeTextSize = isNarrow ? 'text-[28px]' : isWide ? 'text-5xl' : 'text-[38px]';
  const dateTextSize = isNarrow ? 'text-[10px]' : isWide ? 'text-sm' : 'text-xs';

  const cardCount = activeLocations.length;
  const detailGridClass = isNarrow
    ? cardCount === 1
      ? 'grid-cols-1 font-medium'
      : cardCount === 2
        ? 'grid-cols-2 font-medium'
        : 'grid-cols-3 font-medium'
    : cardCount === 1
      ? 'grid-cols-1 max-w-[260px] mx-auto'
      : cardCount === 2
        ? 'grid-cols-2 max-w-[420px] mx-auto'
        : 'grid-cols-3 max-w-[600px] mx-auto';
  const detailGridGapClass = isNarrow ? 'gap-1' : 'gap-2';
  const detailCardClass = isNarrow ? 'px-1.5 py-1.5' : isWide ? 'px-3 py-2' : 'px-2.5 py-1.5';
  const detailLabelClass = isNarrow ? 'text-[8px]' : 'text-[9px]';
  const detailValueClass = isNarrow ? 'text-[10px]' : 'text-[11px]';
  const detailSubValueClass = isNarrow ? 'text-[7px]' : 'text-[9px]';

  return (
    <div
      className={`relative flex h-full w-full min-w-0 flex-col overflow-hidden text-[var(--color-textPrimary)] ${containerPadding}`}>
      <div className="relative z-10 flex h-full w-full flex-col justify-between min-h-0">
        {/* Widget Header */}
        <div className="flex shrink-0 min-w-0 items-center justify-between gap-2 mb-2">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-textMuted)]">
            <LuClock3 size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
            <span className="truncate">Time</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`truncate font-bold text-[var(--color-textMuted)] ${detailLabelClass}`}>
              {localOffset}
            </div>

            {isEditMode && (
              <button
                ref={settingsBtnRef}
                type="button"
                data-no-widget-drag="true"
                aria-label="Configure time zones"
                title="Configure time zones"
                onClick={handleOpenSettings}
                onPointerDown={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                className="p-1 rounded-md text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg,var(--color-bgHover))] transition-colors cursor-pointer flex items-center justify-center">
                <LuSettings size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Main Clock & Date (Centered in available height) */}
        <div className={`flex-1 flex flex-col items-center justify-center min-h-0 py-2 text-center ${isTall || isExtraTall ? 'my-auto' : ''}`}>
          <div className={`truncate font-bold leading-none tracking-normal ${timeTextSize}`}>
            {localTime}
          </div>
          <div className={`mt-1.5 truncate font-bold text-[var(--color-textSecondary)] ${dateTextSize}`}>
            {localDate}
          </div>
        </div>

        {/* World Clock Cards */}
        {cardCount > 0 && (
          <div className={`grid shrink-0 min-w-0 w-full mt-auto ${detailGridGapClass} ${detailGridClass}`}>
            {activeLocations.map(loc => {
              const timeStr = formatWorldTime(now, loc.timeZone);
              const offsetStr = formatUtcOffset(now, loc.timeZone);

              return (
                <div
                  key={loc.id}
                  className={`min-w-0 rounded-xl border-0 bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] ${detailCardClass}`}>
                  <div className={`flex min-w-0 items-center gap-1 font-bold uppercase tracking-normal text-[var(--color-textMuted)] ${detailLabelClass}`}>
                    <LuGlobe size={isNarrow ? 9 : 11} className="shrink-0" />
                    <span className="truncate" title={loc.label}>
                      {loc.label}
                    </span>
                  </div>
                  <div className={`mt-0.5 truncate font-bold text-[var(--color-textPrimary)] ${detailValueClass}`}>
                    {timeStr}
                  </div>
                  <div className={`mt-0.5 truncate font-bold text-[var(--color-textMuted)] ${detailSubValueClass}`}>
                    {offsetStr}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Popover */}
      {isEditMode && (
        <TimeWidgetSettingsPopover
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          popoverPos={popoverPos}
          popoverRef={popoverRef}
          triggerBtnRef={settingsBtnRef}
          options={TIME_ZONE_REGISTRY}
          selectedTimeZoneIds={selectedTimeZoneIds}
          onToggleTimeZone={handleToggleTimeZone}
        />
      )}
    </div>
  );
};

export default TimeWidget;
