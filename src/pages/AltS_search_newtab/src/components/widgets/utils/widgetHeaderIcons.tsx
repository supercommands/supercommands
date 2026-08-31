import type * as React from 'react';
import { LuClock3, LuCloudSun, LuQuote, LuLayers, LuFileText, LuSparkles, LuCode, LuStar } from 'react-icons/lu';
import { FiGlobe, FiClock, FiCode } from 'react-icons/fi';
import type { WidgetType } from '../widgetDashboard.types';

export function getWidgetHeaderIcon(widgetType: WidgetType | string | undefined): React.ReactNode {
  if (!widgetType) return null;
  switch (widgetType) {
    case 'time':
      return <LuClock3 size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'news':
      return <FiGlobe size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'weather':
      return <LuCloudSun size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'quote-of-the-day':
    case 'daily-quote':
      return <LuQuote size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'link-item':
    case 'link-library':
      return <FiGlobe size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'session-item':
      return <LuLayers size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'note-item':
    case 'note-library':
      return <LuFileText size={14} className="shrink-0 text-[var(--color-noteLibraryIcon)]" />;
    case 'ai-prompt-library':
      return <LuSparkles size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'snippet-library':
      return <LuCode size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'favorites':
      return <LuStar size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'html':
      return <FiCode size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    case 'todo-list':
      return <FiClock size={14} className="shrink-0 text-[var(--color-iconDefault)]" />;
    default:
      return null;
  }
}
