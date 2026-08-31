import { useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import type { WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import { widgetPerf } from '../utils/widgetPerf';

interface QuoteEntry {
  text: string;
  author: string;
}

interface CachedQuoteEntry extends QuoteEntry {
  dateKey: string;
}

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';
import { getWidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface DailyQuoteWidgetProps {
  widget?: WidgetInstance;
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

let quotesRequest: Promise<QuoteEntry[]> | null = null;
const DAILY_QUOTE_CACHE_KEY = 'cmdos_daily_quote_widget_cache_v1';

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hashDateKey = (dateKey: string) => {
  let hash = 2166136261;
  for (let index = 0; index < dateKey.length; index += 1) {
    hash ^= dateKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const isQuoteEntry = (quote: Partial<QuoteEntry> | null | undefined): quote is QuoteEntry => {
  if (!quote) return false;
  return (
    typeof quote.text === 'string' &&
    quote.text.trim().length > 0 &&
    typeof quote.author === 'string' &&
    quote.author.trim().length > 0
  );
};

const readCachedQuote = (dateKey: string): CachedQuoteEntry | null => {
  if (typeof window === 'undefined') return null;

  try {
    const storage = window.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(DAILY_QUOTE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedQuoteEntry>;
    if (cached.dateKey !== dateKey || !isQuoteEntry(cached)) return null;
    widgetPerf('cache:hit', {
      widgetType: 'daily-quote',
      dateKey,
      source: 'localStorage',
    });
    return { dateKey, text: cached.text, author: cached.author };
  } catch {
    return null;
  }
};

const writeCachedQuote = (dateKey: string, quote: QuoteEntry) => {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    if (!storage) return;
    storage.setItem(
      DAILY_QUOTE_CACHE_KEY,
      JSON.stringify({
        dateKey,
        text: quote.text,
        author: quote.author,
      } satisfies CachedQuoteEntry),
    );
    widgetPerf('cache:write', {
      widgetType: 'daily-quote',
      dateKey,
      source: 'localStorage',
    });
  } catch {
    // localStorage may be unavailable in private or restricted extension contexts.
  }
};

const loadQuotes = () => {
  if (quotesRequest) {
    widgetPerf('cache:request:reuse', { widgetType: 'daily-quote' });
    return quotesRequest;
  }

  const quotesUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('static/quotes.json')
      : '/static/quotes.json';

  widgetPerf('data:fetch:start', {
    widgetType: 'daily-quote',
    source: quotesUrl,
  });
  const startedAt = performance.now();

  quotesRequest = fetch(quotesUrl)
    .then(async response => {
      if (!response.ok) throw new Error('Quote collection could not be loaded.');
      const data = (await response.json()) as Array<Partial<QuoteEntry>>;
      if (!Array.isArray(data)) throw new Error('Quote collection is invalid.');

      const validQuotes = data.filter(isQuoteEntry);
      if (validQuotes.length === 0) throw new Error('Quote collection is empty.');
      widgetPerf('data:fetch:end', {
        widgetType: 'daily-quote',
        durationMs: Math.round(performance.now() - startedAt),
        received: data.length,
        valid: validQuotes.length,
      });
      return validQuotes;
    })
    .catch(error => {
      quotesRequest = null;
      console.error('[DailyQuoteWidget] Quote collection failed:', error);
      throw error;
    });

  return quotesRequest;
};

const DailyQuoteWidget: React.FC<DailyQuoteWidgetProps> = ({
  widget,
  sizePreset = 'small',
  isEditMode = false,
  layoutInfo: providedLayoutInfo,
}) => {
  const layout = providedLayoutInfo || getWidgetLayoutInfo(sizePreset === 'large' ? 12 : sizePreset === 'medium' ? 8 : 4, 5);
  const { isNarrow, isWide } = layout;

  const [quotes, setQuotes] = useState<QuoteEntry[]>([]);
  const [dateKey, setDateKey] = useState(getLocalDateKey);
  const [cachedQuote, setCachedQuote] = useState<CachedQuoteEntry | null>(() => readCachedQuote(getLocalDateKey()));
  const [error, setError] = useState('');
  const firstContentLoggedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    widgetPerf('body:mounted', {
      widgetType: widget?.type || 'daily-quote',
      widgetId: widget?.id || 'unknown',
      sizePreset,
      dateKey,
    });

    if (cachedQuote?.dateKey === dateKey) {
      widgetPerf('data:fetch:skip', {
        widgetType: 'daily-quote',
        dateKey,
        reason: 'daily-localStorage-cache',
      });
      return () => {
        cancelled = true;
      };
    }

    loadQuotes()
      .then(loadedQuotes => {
        if (!cancelled) {
          setQuotes(loadedQuotes);
          const quoteIndex = hashDateKey(dateKey) % loadedQuotes.length;
          const selectedQuote = loadedQuotes[quoteIndex];
          writeCachedQuote(dateKey, selectedQuote);
          setCachedQuote(prev =>
            prev?.dateKey === dateKey && prev?.text === selectedQuote.text && prev?.author === selectedQuote.author
              ? prev
              : { dateKey, ...selectedQuote },
          );
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          console.error('[DailyQuoteWidget] Failed to initialize:', loadError);
          setError(loadError instanceof Error ? loadError.message : 'Quote unavailable.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachedQuote?.dateKey, dateKey, sizePreset, widget?.id, widget?.type]);

  useEffect(() => {
    setCachedQuote(readCachedQuote(dateKey));
  }, [dateKey]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeoutId = window.setTimeout(
      () => setDateKey(getLocalDateKey()),
      nextMidnight.getTime() - now.getTime() + 1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [dateKey]);

  const quote = useMemo(() => {
    if (quotes.length === 0) {
      if (cachedQuote?.dateKey !== dateKey) return null;
      return cachedQuote;
    }
    const quoteIndex = hashDateKey(dateKey) % quotes.length;
    const selectedQuote = quotes[quoteIndex];
    widgetPerf('data:selected', {
      widgetType: widget?.type || 'daily-quote',
      widgetId: widget?.id || 'unknown',
      dateKey,
      quoteIndex,
      recordsReturned: quotes.length,
      recordsDisplayed: 1,
    });
    return selectedQuote;
  }, [cachedQuote, dateKey, quotes, widget?.id, widget?.type]);

  useEffect(() => {
    if (firstContentLoggedRef.current || !quote) return;
    firstContentLoggedRef.current = true;
    widgetPerf('content:firstReady', {
      widgetType: widget?.type || 'daily-quote',
      widgetId: widget?.id || 'unknown',
      recordsReturned: quotes.length,
      recordsDisplayed: 1,
    });
  }, [quote, quotes.length, widget?.id, widget?.type]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-center text-xs font-semibold text-[var(--color-textMuted)]">
        {error}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-semibold text-[var(--color-textMuted)]">
        Loading quote...
      </div>
    );
  }

  const shouldShowAuthor = !/^(anonymous|anon\.?|unknown)$/i.test(quote.author.trim());

  const textSizeClass = isNarrow
    ? 'text-sm leading-relaxed max-w-[280px]'
    : isWide
      ? 'text-xl leading-relaxed max-w-[620px]'
      : 'text-base leading-relaxed max-w-[460px]';

  const authorSizeClass = isNarrow ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex h-full w-full min-h-0 flex-col items-center justify-center text-center p-4 overflow-y-auto ${isEditMode ? 'pb-8' : ''}`}>
      <div className="my-auto flex flex-col items-center justify-center max-w-full">
        <blockquote
          className={`min-h-0 font-semibold not-italic text-[var(--color-textPrimary)] mx-auto ${textSizeClass}`}>
          &ldquo;{quote.text}&rdquo;
        </blockquote>
        {shouldShowAuthor && (
          <div className={`mt-3 shrink-0 font-bold text-[var(--color-textMuted)] ${authorSizeClass}`}>
            &mdash; {quote.author}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyQuoteWidget;
