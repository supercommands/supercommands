const STARTUP_TRACE_WINDOW_MS = 1500;
const STARTUP_TRACE_PREFIX = '[NewTabPerf][ReactStartup]';
const ENABLE_STARTUP_PERF_LOGS = false;
const startupOrigin =
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

export const startupNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? Math.round((performance.now() - startupOrigin) * 10) / 10
    : Date.now() - startupOrigin;

export const shouldLogStartupPerf = (): boolean => ENABLE_STARTUP_PERF_LOGS && startupNow() <= STARTUP_TRACE_WINDOW_MS;

export const startupPerf = (label: string, data?: Record<string, unknown>): void => {
  if (!shouldLogStartupPerf()) return;

  const payload = {
    atMs: startupNow(),
    ...(data || {}),
  };

  try {
    console.log(STARTUP_TRACE_PREFIX, label, JSON.stringify(payload));
  } catch {
    console.log(STARTUP_TRACE_PREFIX, label, payload);
  }
};
