/**
 * @file timerService.ts
 * @description Centralized Timer & Stopwatch service for SuperCommands.
 * Backed by chrome.storage.local and background alarms for reliable persistence across tabs and idle service workers.
 */

import { useEffect, useState, useCallback } from 'react';

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

const DEFAULT_STATE: TimerStorageData = {
  timer: null,
  stopwatch: null,
};

const getStorage = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return {
      get: async (key: string): Promise<any> => {
        const res = await chrome.storage.local.get(key);
        return res[key];
      },
      set: async (key: string, val: any): Promise<void> => {
        await chrome.storage.local.set({ [key]: val });
      },
    };
  }
  return {
    get: async (key: string): Promise<any> => {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    },
    set: async (key: string, val: any): Promise<void> => {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {}
    },
  };
};

export function parseDurationString(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Match patterns like "1h30m", "25m", "45s", "1h", "90m"
  const regex =
    /^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hours?))?\s*(?:(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?))?\s*(?:(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?))?$/i;
  const match = trimmed.match(regex);

  if (match && (match[1] || match[2] || match[3])) {
    const hours = parseFloat(match[1] || '0');
    const minutes = parseFloat(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    const totalMs = Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
    return totalMs > 0 ? totalMs : null;
  }

  // Bare number: if <= 180 treat as minutes, else treat as seconds
  const numeric = parseFloat(trimmed);
  if (!isNaN(numeric) && numeric > 0) {
    return numeric <= 180 ? Math.round(numeric * 60 * 1000) : Math.round(numeric * 1000);
  }

  return null;
}

export function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.ceil(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatStopwatch(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hundredths = Math.floor((safeMs % 1000) / 10);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
}

/**
 * Web Audio synthesizer chime for completion feedback.
 */
export function playTimerChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      void ctx.close();
    };
  } catch {
    // Audio feedback is best-effort
  }
}

async function notifyBackgroundAlarm(durationMs: number): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      if (durationMs > 0) {
        chrome.runtime.sendMessage({ action: 'SCHEDULE_TIMER_ALARM', durationMs }).catch(() => {});
      } else {
        chrome.runtime.sendMessage({ action: 'CLEAR_TIMER_ALARM' }).catch(() => {});
      }
    } catch {}
  }
}

export async function getTimerState(): Promise<TimerStorageData> {
  const store = getStorage();
  const data = await store.get(TIMER_STORAGE_KEY);
  return data || DEFAULT_STATE;
}

export async function setTimerState(state: TimerStorageData): Promise<void> {
  const store = getStorage();
  await store.set(TIMER_STORAGE_KEY, state);
}

export async function startTimer(durationMs: number, label?: string): Promise<ActiveTimerState> {
  const now = Date.now();
  const timer: ActiveTimerState = {
    id: `timer-${now}`,
    label,
    durationMs,
    targetTimestamp: now + durationMs,
    remainingMs: durationMs,
    isRunning: true,
    createdAt: now,
  };

  const current = await getTimerState();
  current.timer = timer;
  await setTimerState(current);
  await notifyBackgroundAlarm(durationMs);

  return timer;
}

export async function pauseTimer(): Promise<void> {
  const current = await getTimerState();
  const timer = current.timer;
  if (!timer || !timer.isRunning || !timer.targetTimestamp) return;

  const now = Date.now();
  const remaining = Math.max(0, timer.targetTimestamp - now);

  current.timer = {
    ...timer,
    remainingMs: remaining,
    targetTimestamp: null,
    isRunning: false,
  };

  await setTimerState(current);
  await notifyBackgroundAlarm(0);
}

export async function resumeTimer(): Promise<void> {
  const current = await getTimerState();
  const timer = current.timer;
  if (!timer || timer.isRunning || timer.remainingMs <= 0) return;

  const now = Date.now();
  current.timer = {
    ...timer,
    targetTimestamp: now + timer.remainingMs,
    isRunning: true,
  };

  await setTimerState(current);
  await notifyBackgroundAlarm(timer.remainingMs);
}

export async function resetTimer(): Promise<void> {
  const current = await getTimerState();
  if (current.timer) {
    current.timer = {
      ...current.timer,
      isRunning: false,
      remainingMs: current.timer.durationMs,
      targetTimestamp: null,
    };
    await setTimerState(current);
  }
  await notifyBackgroundAlarm(0);
}

export async function addTimerMinutes(minutes: number): Promise<void> {
  const current = await getTimerState();
  const timer = current.timer;
  if (!timer) return;

  const additionalMs = minutes * 60 * 1000;
  const now = Date.now();

  if (timer.isRunning && timer.targetTimestamp) {
    const newTarget = timer.targetTimestamp + additionalMs;
    const newRemaining = Math.max(0, newTarget - now);
    current.timer = {
      ...timer,
      durationMs: timer.durationMs + additionalMs,
      targetTimestamp: newTarget,
      remainingMs: newRemaining,
    };
    await setTimerState(current);
    await notifyBackgroundAlarm(newRemaining);
  } else {
    current.timer = {
      ...timer,
      durationMs: timer.durationMs + additionalMs,
      remainingMs: timer.remainingMs + additionalMs,
    };
    await setTimerState(current);
  }
}

export async function startStopwatch(): Promise<ActiveStopwatchState> {
  const current = await getTimerState();
  const now = Date.now();
  const existing = current.stopwatch;

  const stopwatch: ActiveStopwatchState = {
    id: existing?.id || `sw-${now}`,
    startedAt: now,
    elapsedMs: existing ? existing.elapsedMs : 0,
    isRunning: true,
    laps: existing ? existing.laps : [],
  };

  current.stopwatch = stopwatch;
  await setTimerState(current);
  return stopwatch;
}

export async function pauseStopwatch(): Promise<void> {
  const current = await getTimerState();
  const sw = current.stopwatch;
  if (!sw || !sw.isRunning || !sw.startedAt) return;

  const now = Date.now();
  const added = now - sw.startedAt;

  current.stopwatch = {
    ...sw,
    elapsedMs: sw.elapsedMs + added,
    startedAt: null,
    isRunning: false,
  };

  await setTimerState(current);
}

export async function resumeStopwatch(): Promise<void> {
  const current = await getTimerState();
  const sw = current.stopwatch;
  if (!sw || sw.isRunning) return;

  current.stopwatch = {
    ...sw,
    startedAt: Date.now(),
    isRunning: true,
  };

  await setTimerState(current);
}

export async function resetStopwatch(): Promise<void> {
  const current = await getTimerState();
  if (current.stopwatch) {
    current.stopwatch = {
      ...current.stopwatch,
      startedAt: null,
      elapsedMs: 0,
      isRunning: false,
      laps: [],
    };
    await setTimerState(current);
  }
}

export async function recordLap(): Promise<number | null> {
  const current = await getTimerState();
  const sw = current.stopwatch;
  if (!sw || !sw.isRunning || !sw.startedAt) return null;

  const now = Date.now();
  const currentElapsed = sw.elapsedMs + (now - sw.startedAt);

  current.stopwatch = {
    ...sw,
    laps: [currentElapsed, ...sw.laps],
  };

  await setTimerState(current);
  return currentElapsed;
}

/**
 * React hook for live Timer & Stopwatch state.
 */
export function useTimerState() {
  const [data, setData] = useState<TimerStorageData>(DEFAULT_STATE);
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const [stopwatchElapsed, setStopwatchElapsed] = useState<number>(0);

  // Load initial and subscribe to storage changes
  useEffect(() => {
    getTimerState().then(setData);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local' && changes[TIMER_STORAGE_KEY]) {
          setData(changes[TIMER_STORAGE_KEY].newValue || DEFAULT_STATE);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  // Compute live ticks
  useEffect(() => {
    const update = () => {
      const now = Date.now();

      // Timer calculation
      if (data.timer) {
        if (data.timer.isRunning && data.timer.targetTimestamp) {
          const rem = Math.max(0, data.timer.targetTimestamp - now);
          setTimerRemaining(rem);
          if (rem === 0) {
            playTimerChime();
          }
        } else {
          setTimerRemaining(data.timer.remainingMs);
        }
      } else {
        setTimerRemaining(0);
      }

      // Stopwatch calculation
      if (data.stopwatch) {
        if (data.stopwatch.isRunning && data.stopwatch.startedAt) {
          setStopwatchElapsed(data.stopwatch.elapsedMs + (now - data.stopwatch.startedAt));
        } else {
          setStopwatchElapsed(data.stopwatch.elapsedMs);
        }
      } else {
        setStopwatchElapsed(0);
      }
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [data]);

  return {
    timer: data.timer,
    stopwatch: data.stopwatch,
    timerRemaining,
    stopwatchElapsed,
    isTimerRunning: !!data.timer?.isRunning,
    isStopwatchRunning: !!data.stopwatch?.isRunning,
    actions: {
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      addTimerMinutes,
      startStopwatch,
      pauseStopwatch,
      resumeStopwatch,
      resetStopwatch,
      recordLap,
    },
  };
}
