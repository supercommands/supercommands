import { useEffect, useMemo, useState } from 'react';
import type * as React from 'react';
import type { WidgetSizePreset } from '../widgetDashboard.types';

interface QuoteEntry {
  text: string;
  author: string;
}

interface DailyQuoteWidgetProps {
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
}

let quotesRequest: Promise<QuoteEntry[]> | null = null;

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

const loadQuotes = () => {
  if (quotesRequest) {
    console.info('[DailyQuoteWidget] Reusing cached quote request.');
    return quotesRequest;
  }

  const quotesUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('static/quotes.json')
      : '/static/quotes.json';

  console.info('[DailyQuoteWidget] Loading quote collection:', quotesUrl);

  quotesRequest = fetch(quotesUrl)
    .then(async response => {
      console.info('[DailyQuoteWidget] Quote collection response:', {
        ok: response.ok,
        status: response.status,
        url: response.url,
      });
      if (!response.ok) throw new Error('Quote collection could not be loaded.');
      const data = (await response.json()) as Array<Partial<QuoteEntry>>;
      if (!Array.isArray(data)) throw new Error('Quote collection is invalid.');

      const validQuotes = data.filter(
        (quote): quote is QuoteEntry =>
          typeof quote.text === 'string' &&
          quote.text.trim().length > 0 &&
          typeof quote.author === 'string' &&
          quote.author.trim().length > 0,
      );
      if (validQuotes.length === 0) throw new Error('Quote collection is empty.');
      console.info('[DailyQuoteWidget] Quote collection ready:', {
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

const DailyQuoteWidget: React.FC<DailyQuoteWidgetProps> = ({ sizePreset = 'small', isEditMode = false }) => {
  const [quotes, setQuotes] = useState<QuoteEntry[]>([]);
  const [dateKey, setDateKey] = useState(getLocalDateKey);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    console.info('[DailyQuoteWidget] Mounted:', { sizePreset, dateKey });

    loadQuotes()
      .then(loadedQuotes => {
        if (!cancelled) {
          setQuotes(loadedQuotes);
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
      console.info('[DailyQuoteWidget] Unmounted.');
    };
  }, [dateKey, sizePreset]);

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
    if (quotes.length === 0) return null;
    const quoteIndex = hashDateKey(dateKey) % quotes.length;
    const selectedQuote = quotes[quoteIndex];
    console.info('[DailyQuoteWidget] Daily quote selected:', {
      dateKey,
      quoteIndex,
      quoteCount: quotes.length,
      author: selectedQuote.author,
    });
    return selectedQuote;
  }, [dateKey, quotes]);

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

  const isSmall = sizePreset === 'small';
  const isLarge = sizePreset === 'large';
  const shouldShowAuthor = !/^(anonymous|anon\.?|unknown)$/i.test(quote.author.trim());

  return (
    <div className={`flex h-full min-h-0 flex-col justify-center ${isEditMode ? 'pb-9' : ''}`}>
      <blockquote
        className={`min-h-0 w-full text-left font-semibold not-italic text-[var(--color-textPrimary)] ${
          isSmall
            ? 'text-[13px] leading-[1.45]'
            : isLarge
              ? 'text-[28px] leading-[1.32]'
              : 'text-[22px] leading-[1.35]'
        }`}>
        &ldquo;
        {quote.text}
        &rdquo;
      </blockquote>
      {shouldShowAuthor && (
        <div
          className={`mt-4 shrink-0 text-left font-semibold text-[var(--color-textMuted)] ${
            isSmall ? 'text-[10px]' : isLarge ? 'text-base' : 'text-sm'
          }`}>
          - {quote.author}
        </div>
      )}
    </div>
  );
};

export default DailyQuoteWidget;
