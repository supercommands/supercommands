import React, { useState, useMemo } from 'react';
import { LuTimer, LuPlay, LuPause, LuRotateCcw, LuPlus, LuFlag, LuCheck } from 'react-icons/lu';
import type { WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';
import EditableWidgetTitle from '../components/EditableWidgetTitle';
import { useTimerState, formatDuration, formatStopwatch } from '../../../../../../shared-components/timer/timerService';

interface TimerWidgetProps {
  widget?: WidgetInstance;
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

const PRESETS = [
  { label: '5m', ms: 5 * 60 * 1000 },
  { label: '15m', ms: 15 * 60 * 1000 },
  { label: '25m', ms: 25 * 60 * 1000 }, // Standard Pomodoro
  { label: '45m', ms: 45 * 60 * 1000 },
];

export const TimerWidget: React.FC<TimerWidgetProps> = ({
  widget,
  sizePreset = 'medium',
  isEditMode = false,
  layoutInfo,
}) => {
  const [tab, setTab] = useState<'timer' | 'stopwatch'>('timer');
  const [selectedPresetMs, setSelectedPresetMs] = useState<number>(25 * 60 * 1000);

  const { timer, stopwatch, timerRemaining, stopwatchElapsed, isTimerRunning, isStopwatchRunning, actions } =
    useTimerState();

  const isSmall = sizePreset === 'small' || Boolean(layoutInfo?.isNarrow);
  const isLarge = sizePreset === 'large' || Boolean(layoutInfo?.isWide);

  // Timer Progress Calculation
  const totalDuration = timer?.durationMs || selectedPresetMs;
  const progressPercent =
    totalDuration > 0 ? Math.max(0, Math.min(100, Math.round((timerRemaining / totalDuration) * 100))) : 0;

  const displayTimerText =
    timer && (timer.isRunning || timer.remainingMs > 0)
      ? formatDuration(timerRemaining)
      : formatDuration(selectedPresetMs);

  const handlePresetSelect = (ms: number) => {
    setSelectedPresetMs(ms);
    actions.startTimer(ms);
  };

  return (
    <div
      className={`relative flex h-full w-full select-none flex-col justify-between text-[var(--color-textPrimary)] transition-all duration-200 ${
        isEditMode ? 'pb-6' : ''
      }`}>
      {/* Header with Title and Mode Switcher */}
      <div className="flex shrink-0 min-w-0 items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 text-xs font-medium uppercase tracking-wider text-[var(--color-textPrimary)]">
          <LuTimer size={14} className="shrink-0 text-[var(--color-iconDefault)]" aria-hidden="true" />
          {widget ? (
            <EditableWidgetTitle
              viewId={widget.viewId}
              widgetId={widget.id}
              initialTitle={widget.title || 'Timer & Stopwatch'}
              isEditMode={isEditMode}
              className="truncate text-xs font-medium uppercase tracking-wider text-[var(--color-textPrimary)]"
            />
          ) : (
            <span className="truncate">Timer & Stopwatch</span>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center rounded-lg bg-[var(--color-inputBg)] p-0.5 border border-[var(--color-borderDefault)] shrink-0">
          <button
            type="button"
            onClick={() => setTab('timer')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${
              tab === 'timer'
                ? 'bg-[var(--color-widgetInnerBg,#2a2a2a)] text-[var(--color-textPrimary)] shadow-sm'
                : 'text-[var(--color-textMuted)] hover:text-[var(--color-textSecondary)]'
            }`}>
            Timer
          </button>
          <button
            type="button"
            onClick={() => setTab('stopwatch')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-colors ${
              tab === 'stopwatch'
                ? 'bg-[var(--color-widgetInnerBg,#2a2a2a)] text-[var(--color-textPrimary)] shadow-sm'
                : 'text-[var(--color-textMuted)] hover:text-[var(--color-textSecondary)]'
            }`}>
            Stopwatch
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {tab === 'timer' ? (
        <div className="flex flex-1 flex-col items-center justify-center min-h-0 w-full py-1">
          {/* Preset Buttons for Medium/Large */}
          {!isSmall && (
            <div className="flex items-center gap-1.5 mb-2">
              {PRESETS.map(preset => {
                const isActive = selectedPresetMs === preset.ms && (!timer || !timer.isRunning);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetSelect(preset.ms)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors border ${
                      isActive
                        ? 'border-[var(--color-focusRing,#a855f7)] bg-[var(--color-focusRing,#a855f7)]/15 text-[var(--color-textPrimary)]'
                        : 'border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderHover,#555)]'
                    }`}>
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Time Display */}
          <div
            className={`font-mono font-medium leading-none tracking-tight text-[var(--color-textPrimary)] my-1 ${
              isSmall ? 'text-3xl' : isLarge ? 'text-5xl' : 'text-4xl'
            }`}>
            {displayTimerText}
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-[240px] bg-[var(--color-borderDefault)] h-1.5 rounded-full overflow-hidden my-2">
            <div
              className="h-full bg-[var(--color-focusRing,#a855f7)] transition-all duration-200 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {timer?.label && (
            <div className="text-xs text-[var(--color-textMuted)] truncate max-w-[200px] mb-1">{timer.label}</div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 mt-1">
            {isTimerRunning ? (
              <>
                <button
                  type="button"
                  onClick={() => actions.pauseTimer()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textPrimary)] transition-colors"
                  title="Pause timer">
                  <LuPause size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => actions.addTimerMinutes(1)}
                  className="flex items-center justify-center px-2 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-xs font-medium text-[var(--color-textSecondary)] transition-colors"
                  title="Add 1 minute">
                  +1m
                </button>
                <button
                  type="button"
                  onClick={() => actions.addTimerMinutes(5)}
                  className="flex items-center justify-center px-2 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-xs font-medium text-[var(--color-textSecondary)] transition-colors"
                  title="Add 5 minutes">
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => actions.resetTimer()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors"
                  title="Reset timer">
                  <LuRotateCcw size={14} />
                </button>
              </>
            ) : timer && timer.remainingMs > 0 && timer.remainingMs < timer.durationMs ? (
              <>
                <button
                  type="button"
                  onClick={() => actions.resumeTimer()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-focusRing,#a855f7)] text-white shadow-sm hover:opacity-90 transition-opacity"
                  title="Resume timer">
                  <LuPlay size={14} className="ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => actions.resetTimer()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors"
                  title="Reset timer">
                  <LuRotateCcw size={14} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => actions.startTimer(selectedPresetMs)}
                className="flex items-center justify-center px-4 h-8 rounded-full bg-[var(--color-focusRing,#a855f7)] text-white font-medium text-xs shadow-sm hover:opacity-90 transition-opacity gap-1.5">
                <LuPlay size={12} />
                Start
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Stopwatch View */
        <div className="flex flex-1 flex-col items-center justify-center min-h-0 w-full py-1">
          {/* Time Display */}
          <div
            className={`font-mono font-medium leading-none tracking-tight text-[var(--color-textPrimary)] my-2 ${
              isSmall ? 'text-2xl' : isLarge ? 'text-5xl' : 'text-4xl'
            }`}>
            {formatStopwatch(stopwatchElapsed)}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mt-1">
            {isStopwatchRunning ? (
              <>
                <button
                  type="button"
                  onClick={() => actions.pauseStopwatch()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textPrimary)] transition-colors"
                  title="Pause stopwatch">
                  <LuPause size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => actions.recordLap()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textSecondary)] transition-colors"
                  title="Record lap">
                  <LuFlag size={14} />
                </button>
              </>
            ) : stopwatch && stopwatch.elapsedMs > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => actions.resumeStopwatch()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-focusRing,#a855f7)] text-white shadow-sm hover:opacity-90 transition-opacity"
                  title="Resume stopwatch">
                  <LuPlay size={14} className="ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => actions.resetStopwatch()}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] hover:bg-[var(--color-widgetInnerBg,#333)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors"
                  title="Reset stopwatch">
                  <LuRotateCcw size={14} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => actions.startStopwatch()}
                className="flex items-center justify-center px-4 h-8 rounded-full bg-[var(--color-focusRing,#a855f7)] text-white font-medium text-xs shadow-sm hover:opacity-90 transition-opacity gap-1.5">
                <LuPlay size={12} />
                Start
              </button>
            )}
          </div>

          {/* Laps List (Medium & Large) */}
          {!isSmall && stopwatch && stopwatch.laps.length > 0 && (
            <div className="w-full max-h-[70px] overflow-y-auto mt-2 text-xs border-t border-[var(--color-borderDefault)] pt-1 px-2 space-y-0.5">
              {stopwatch.laps.slice(0, 5).map((lapMs, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[var(--color-textMuted)] font-mono text-[11px]">
                  <span>Lap {stopwatch.laps.length - idx}</span>
                  <span>{formatStopwatch(lapMs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimerWidget;
