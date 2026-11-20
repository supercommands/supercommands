/**
 * @file backgroundTimer.ts
 * @description Background alarm and notification handler for Timer and Stopwatch.
 * Ensures timer completions trigger Chrome native notifications even when service worker was idle.
 */

export const TIMER_ALARM_NAME = 'supercmd-timer';
export const TIMER_STORAGE_KEY = 'supercmd_timer_state';

export interface ActiveTimerState {
  id: string;
  label?: string;
  durationMs: number;
  targetTimestamp: number | null;
  remainingMs: number;
  isRunning: boolean;
  createdAt: number;
}

export interface ActiveStopwatchState {
  id: string;
  startedAt: number | null;
  elapsedMs: number;
  isRunning: boolean;
  laps: number[];
}

export interface TimerStorageData {
  timer: ActiveTimerState | null;
  stopwatch: ActiveStopwatchState | null;
}

export async function scheduleTimerAlarm(durationMs: number): Promise<void> {
  try {
    await chrome.alarms.clear(TIMER_ALARM_NAME);
    if (durationMs > 0) {
      chrome.alarms.create(TIMER_ALARM_NAME, { when: Date.now() + durationMs });
    }
  } catch (err) {
    console.warn('[BackgroundTimer] scheduleTimerAlarm error:', err);
  }
}

export async function clearTimerAlarm(): Promise<void> {
  try {
    await chrome.alarms.clear(TIMER_ALARM_NAME);
  } catch (err) {
    console.warn('[BackgroundTimer] clearTimerAlarm error:', err);
  }
}

export async function handleTimerAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (!alarm.name.startsWith(TIMER_ALARM_NAME)) return;

  try {
    const data = await chrome.storage.local.get(TIMER_STORAGE_KEY);
    const state: TimerStorageData = data[TIMER_STORAGE_KEY] || { timer: null, stopwatch: null };
    const timer = state.timer;

    const labelSuffix = timer?.label ? ` - ${timer.label}` : '';
    const title = `Timer Finished!${labelSuffix}`;
    const message = timer?.label ? `Timer for "${timer.label}" is up!` : 'Your countdown timer has finished.';

    chrome.notifications.create(`supercmd-timer-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title,
      message,
      priority: 2,
      requireInteraction: true,
    });

    if (timer) {
      state.timer = {
        ...timer,
        isRunning: false,
        remainingMs: 0,
        targetTimestamp: null,
      };
      await chrome.storage.local.set({ [TIMER_STORAGE_KEY]: state });
    }
  } catch (err) {
    console.error('[BackgroundTimer] handleTimerAlarm error:', err);
  }
}
