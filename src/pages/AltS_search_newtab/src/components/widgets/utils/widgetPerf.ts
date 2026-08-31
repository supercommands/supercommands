import { startupNow } from '../../../startupPerf';

const WIDGET_TRACE_WINDOW_MS = 5000;
const WIDGET_TRACE_PREFIX = '[NewTabPerf][WidgetHydration]';
const ENABLE_WIDGET_PERF_LOGS = false;

export const widgetPerf = (label: string, data?: Record<string, unknown>): void => {
  if (!ENABLE_WIDGET_PERF_LOGS) return;
  const atMs = startupNow();
  if (atMs > WIDGET_TRACE_WINDOW_MS) return;

  const payload = {
    atMs,
    ...(data || {}),
  };

  try {
    console.log(WIDGET_TRACE_PREFIX, label, JSON.stringify(payload));
  } catch {
    console.log(WIDGET_TRACE_PREFIX, label, payload);
  }
};

export const getWidgetPerfId = (widget: { id?: string; type?: string } | undefined | null): string =>
  widget?.id ? String(widget.id) : 'unknown';
