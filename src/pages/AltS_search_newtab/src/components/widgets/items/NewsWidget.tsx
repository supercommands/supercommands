import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';
import { FiExternalLink, FiGlobe, FiRefreshCw } from 'react-icons/fi';
import type { WidgetSizePreset } from '../widgetDashboard.types';

type NewsRegion = 'us' | 'uk' | 'ca' | 'au' | 'in';

interface NewsRegionConfig {
  hl: string;
  gl: string;
  ceid: string;
  label: string;
}

interface NewsArticle {
  title: string;
  source: string;
  publishedLabel: string;
  publishedAt: number;
  description: string;
  articleUrl: string;
}

interface NewsData {
  articles: NewsArticle[];
  topic: string;
  region: NewsRegion;
  fetchedAt: number;
}

interface NewsWidgetProps {
  sizePreset?: WidgetSizePreset;
  isEditMode?: boolean;
}

const NEWS_REGION_CONFIG: Record<NewsRegion, NewsRegionConfig> = {
  us: { hl: 'en-US', gl: 'US', ceid: 'US:en', label: 'United States' },
  uk: { hl: 'en-GB', gl: 'GB', ceid: 'GB:en', label: 'United Kingdom' },
  ca: { hl: 'en-CA', gl: 'CA', ceid: 'CA:en', label: 'Canada' },
  au: { hl: 'en-AU', gl: 'AU', ceid: 'AU:en', label: 'Australia' },
  in: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en', label: 'India' },
};

const DAILY_TOPICS = ['world', 'business', 'science', 'health', 'sports', 'entertainment', 'technology'];
const NEWS_CACHE_STORAGE_KEY = 'cmdos-news-widget-cache-v1';
const CACHE_TTL_MS = 15 * 60 * 1000;
const AUTO_REFRESH_MS = 15 * 60 * 1000;
const MANUAL_REFRESH_COOLDOWN_MS = 30 * 1000;
const FAILURE_BACKOFF_MS = 2 * 60 * 1000;
const REMOUNT_REFRESH_THROTTLE_MS = 60 * 1000;
const NEWS_BUTTON_SURFACE_CLASS =
  'bg-[color:color-mix(in_srgb,var(--color-widgetBg)_64%,var(--color-inputBg)_36%)]';

const newsCache = new Map<string, NewsData>();
const failureBackoff = new Map<string, number>();
const sharedInFlightRequests = new Map<string, Promise<NewsData>>();
const lastRequestAt = new Map<string, number>();

const isValidNewsArticle = (article: Partial<NewsArticle> | null | undefined): article is NewsArticle =>
  Boolean(
    article &&
      typeof article.title === 'string' &&
      typeof article.source === 'string' &&
      typeof article.publishedLabel === 'string' &&
      typeof article.publishedAt === 'number' &&
      typeof article.description === 'string' &&
      typeof article.articleUrl === 'string',
  );

const isValidNewsData = (data: Partial<NewsData> | null | undefined): data is NewsData =>
  Boolean(
    data &&
      Array.isArray(data.articles) &&
      data.articles.every(isValidNewsArticle) &&
      typeof data.topic === 'string' &&
      typeof data.region === 'string' &&
      typeof data.fetchedAt === 'number',
  );

const readNewsCacheStore = () => {
  try {
    if (typeof sessionStorage === 'undefined') return {};
    const rawCache = sessionStorage.getItem(NEWS_CACHE_STORAGE_KEY);
    if (!rawCache) return {};
    const parsedCache = JSON.parse(rawCache) as Record<string, NewsData>;
    return Object.entries(parsedCache).reduce<Record<string, NewsData>>((validCache, [cacheKey, data]) => {
      if (isValidNewsData(data)) validCache[cacheKey] = data;
      return validCache;
    }, {});
  } catch {
    try {
      sessionStorage.removeItem(NEWS_CACHE_STORAGE_KEY);
    } catch {
      // Cache is only a fallback; ignore storage failures.
    }
    return {};
  }
};

const writeNewsCache = (cacheKey: string, data: NewsData) => {
  newsCache.set(cacheKey, data);
  try {
    if (typeof sessionStorage === 'undefined') return;
    const cacheStore = readNewsCacheStore();
    sessionStorage.setItem(
      NEWS_CACHE_STORAGE_KEY,
      JSON.stringify({
        ...cacheStore,
        [cacheKey]: data,
      }),
    );
  } catch {
    // Cache is only a fallback; news can still load without it.
  }
};

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getDailyTopic = () => DAILY_TOPICS[hashString(getLocalDateKey()) % DAILY_TOPICS.length];

const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

const getBrowserLanguages = () => {
  if (typeof navigator === 'undefined') return [];
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  return [...languages, navigator.language].filter(Boolean);
};

const getRegionFromCountryCode = (countryCode: string): NewsRegion | null => {
  const normalizedCode = countryCode.toLowerCase();
  if (normalizedCode === 'us') return 'us';
  if (normalizedCode === 'gb' || normalizedCode === 'uk') return 'uk';
  if (normalizedCode === 'ca') return 'ca';
  if (normalizedCode === 'au') return 'au';
  if (normalizedCode === 'in') return 'in';
  return null;
};

const detectNewsRegion = (): NewsRegion => {
  const timeZone = getBrowserTimeZone().toLowerCase();
  if (timeZone === 'asia/kolkata' || timeZone === 'asia/calcutta') return 'in';
  if (timeZone === 'europe/london') return 'uk';
  if (timeZone.startsWith('australia/')) return 'au';
  if (
    [
      'america/toronto',
      'america/vancouver',
      'america/winnipeg',
      'america/edmonton',
      'america/halifax',
      'america/st_johns',
      'america/regina',
    ].includes(timeZone)
  ) {
    return 'ca';
  }
  if (timeZone.startsWith('america/')) return 'us';

  for (const language of getBrowserLanguages()) {
    const countryCode = language.match(/[-_]([A-Za-z]{2})\b/)?.[1];
    const region = countryCode ? getRegionFromCountryCode(countryCode) : null;
    if (region) return region;
  }

  return 'us';
};

const formatTopicLabel = (topic: string) => topic.charAt(0).toUpperCase() + topic.slice(1);

const formatRelativeTime = (dateValue: string) => {
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) return 'Latest';

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / (60 * 1000)));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

const getPublishedAt = (dateValue: unknown) => {
  const timestamp = typeof dateValue === 'string' ? Date.parse(dateValue) : NaN;
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
};

const stripHtml = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const parseArticle = (item: any): NewsArticle | null => {
  const rawTitle = typeof item?.title === 'string' ? item.title.trim() : '';
  const articleUrl = typeof item?.link === 'string' ? item.link : '';
  if (!rawTitle || !articleUrl) return null;

  const source = rawTitle.split(' - ').at(-1)?.trim() || item?.author || 'News';
  const title = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
  const description = stripHtml(item?.description || item?.content);
  const publishedAt = getPublishedAt(item?.pubDate);

  return {
    title,
    source,
    publishedLabel: formatRelativeTime(new Date(publishedAt).toISOString()),
    publishedAt,
    description,
    articleUrl,
  };
};

const buildGoogleNewsRssUrl = (topic: string, region: NewsRegion) => {
  const config = NEWS_REGION_CONFIG[region];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${topic} when:24h`)}&hl=${config.hl}&gl=${config.gl}&ceid=${config.ceid}`;
};

const buildNewsUrl = (topic: string, region: NewsRegion) => {
  const googleNewsUrl = buildGoogleNewsRssUrl(topic, region);
  return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleNewsUrl)}`;
};

const getCacheKey = (region: NewsRegion, topic: string) => `${region}|${topic.toLowerCase()}`;

const getCachedNews = (cacheKey: string) => {
  const cached = newsCache.get(cacheKey) || readNewsCacheStore()[cacheKey];
  if (cached) newsCache.set(cacheKey, cached);
  return cached || null;
};

const isCacheFresh = (data: NewsData | null) => Boolean(data && Date.now() - data.fetchedAt < CACHE_TTL_MS);

const parseRssText = (rssText: string): NewsArticle[] => {
  const document = new DOMParser().parseFromString(rssText, 'text/xml');
  const items = Array.from(document.querySelectorAll('item'));
  const articles: NewsArticle[] = [];

  items.forEach(item => {
    const title = item.querySelector('title')?.textContent?.trim() || '';
    const articleUrl = item.querySelector('link')?.textContent?.trim() || '';
    if (!title || !articleUrl) return;

    const source =
      item.querySelector('source')?.textContent?.trim() ||
      title.split(' - ').at(-1)?.trim() ||
      'News';
    const cleanTitle = title.replace(/\s+-\s+[^-]+$/, '').trim() || title;
    const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
    const publishedAt = getPublishedAt(pubDate);
    const description = stripHtml(item.querySelector('description')?.textContent || '');

    articles.push({
      title: cleanTitle,
      source,
      publishedLabel: formatRelativeTime(new Date(publishedAt).toISOString()),
      publishedAt,
      description,
      articleUrl,
    });
  });

  return articles;
};

const loadNewsDataFromGoogleRss = async (
  topic: string,
  region: NewsRegion,
  signal?: AbortSignal,
): Promise<NewsArticle[]> => {
  const response = await fetch(buildGoogleNewsRssUrl(topic, region), { signal });
  if (!response.ok) throw new Error('Unable to load news right now.');

  const rssText = await response.text();
  return parseRssText(rssText);
};

const prioritizeFreshArticles = (articles: NewsArticle[]) => {
  const newestFirst = [...articles].sort((first, second) => second.publishedAt - first.publishedAt);
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  return newestFirst.filter(article => article.publishedAt >= recentCutoff);
};

const loadNewsData = async (topic: string, region: NewsRegion, signal?: AbortSignal): Promise<NewsData> => {
  let articles: NewsArticle[] = [];

  try {
    const response = await fetch(buildNewsUrl(topic, region), { signal });
    if (!response.ok) throw new Error('rss2json unavailable.');

    const payload = await response.json();
    if (payload?.status !== 'ok') throw new Error('rss2json unavailable.');

    articles = (Array.isArray(payload.items) ? payload.items : [])
      .map(parseArticle)
      .filter((article: NewsArticle | null): article is NewsArticle => Boolean(article));
  } catch (error) {
    if (signal?.aborted) throw error;
    articles = await loadNewsDataFromGoogleRss(topic, region, signal);
  }

  articles = prioritizeFreshArticles(articles).slice(0, 12);

  if (articles.length === 0) throw new Error('No live news results matched today.');

  const data = {
    articles,
    topic,
    region,
    fetchedAt: Date.now(),
  };
  writeNewsCache(getCacheKey(region, topic), data);
  return data;
};

const requestNewsData = (
  cacheKey: string,
  topic: string,
  region: NewsRegion,
) => {
  const existingRequest = sharedInFlightRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  lastRequestAt.set(cacheKey, Date.now());
  const request = loadNewsData(topic, region).finally(() => {
    if (sharedInFlightRequests.get(cacheKey) === request) {
      sharedInFlightRequests.delete(cacheKey);
    }
  });
  sharedInFlightRequests.set(cacheKey, request);
  return request;
};

const NewsArticleCard = ({
  article,
  compact = false,
  showDescription = false,
}: {
  article: NewsArticle;
  compact?: boolean;
  showDescription?: boolean;
}) => {
  return (
    <a
      href={article.articleUrl}
      target="_blank"
      rel="noreferrer"
      data-no-widget-drag="true"
      className={`group flex min-w-0 items-start gap-2 border-b border-[var(--color-borderDefault)] transition hover:border-[var(--color-borderActive)] ${compact ? 'px-0 py-1' : 'px-0 py-1.5'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`${compact ? 'text-[11px]' : 'text-xs'} min-w-0 flex-1 truncate font-bold leading-none text-[var(--color-textPrimary)]`}>
            {article.title}
          </span>
          <span className="hidden max-w-[30%] shrink truncate text-[9px] font-bold leading-none text-[var(--color-textMuted)] sm:inline">
            {article.source}
          </span>
          <span className="shrink-0 text-[9px] font-bold leading-none text-[var(--color-textMuted)]">
            {article.publishedLabel}
          </span>
        </div>
        {showDescription && article.description ? (
          <div className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-[var(--color-textSecondary)]">
            {article.description}
          </div>
        ) : null}
      </div>
      {!compact ? <FiExternalLink size={12} className="shrink-0 text-[var(--color-iconDefault)] opacity-60" /> : null}
    </a>
  );
};

const NewsWidget: React.FC<NewsWidgetProps> = ({ sizePreset = 'medium', isEditMode = false }) => {
  const region = useMemo(detectNewsRegion, []);
  const topic = useMemo(getDailyTopic, []);
  const cacheKey = useMemo(() => getCacheKey(region, topic), [region, topic]);
  const cachedData = useMemo(() => getCachedNews(cacheKey), [cacheKey]);
  const [data, setData] = useState<NewsData | null>(cachedData);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(!cachedData);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const dataRef = useRef<NewsData | null>(cachedData);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);
  const isSmall = sizePreset === 'small';
  const isLarge = sizePreset === 'large';

  const fetchNews = useCallback(
    async (mode: 'auto' | 'manual' | 'silent' = 'auto') => {
      if (inFlightRef.current) return inFlightRef.current;
      const cachedNews = newsCache.get(cacheKey) || null;
      if (mode !== 'manual' && isCacheFresh(cachedNews)) {
        if (cachedNews !== dataRef.current) {
          dataRef.current = cachedNews;
          setData(cachedNews);
        }
        setIsLoading(false);
        return Promise.resolve();
      }

      const backoffUntil = failureBackoff.get(cacheKey) || 0;
      if (mode !== 'manual' && Date.now() < backoffUntil) return Promise.resolve();
      const previousRequestAt = lastRequestAt.get(cacheKey) || 0;
      if (
        mode !== 'manual' &&
        !sharedInFlightRequests.has(cacheKey) &&
        Date.now() - previousRequestAt < REMOUNT_REFRESH_THROTTLE_MS
      ) {
        return Promise.resolve();
      }

      if (mode !== 'silent' || !dataRef.current) setIsLoading(true);
      if (mode === 'manual') setCooldownUntil(Date.now() + MANUAL_REFRESH_COOLDOWN_MS);

      const request = requestNewsData(cacheKey, topic, region)
        .then(nextData => {
          if (!isMountedRef.current) return;
          dataRef.current = nextData;
          setData(nextData);
          setError('');
          failureBackoff.delete(cacheKey);
        })
        .catch(fetchError => {
          if (!isMountedRef.current) return;
          const fallbackData = newsCache.get(cacheKey) || readNewsCacheStore()[cacheKey] || null;
          if (fallbackData) {
            dataRef.current = fallbackData;
            setData(fallbackData);
          }
          failureBackoff.set(cacheKey, Date.now() + FAILURE_BACKOFF_MS);
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to load news right now.');
        })
        .finally(() => {
          if (inFlightRef.current === request) inFlightRef.current = null;
          if (!isMountedRef.current) return;
          setIsLoading(false);
        });

      inFlightRef.current = request;
      return request;
    },
    [cacheKey, region, topic],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void fetchNews(cachedData ? 'silent' : 'auto');

    const intervalId = window.setInterval(() => {
      void fetchNews('silent');
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cachedData, fetchNews]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    const timeoutId = window.setTimeout(() => setCooldownUntil(0), Math.max(0, cooldownUntil - Date.now()));
    return () => window.clearTimeout(timeoutId);
  }, [cooldownUntil]);

  const visibleArticles = (data?.articles || []).slice(0, isSmall ? 5 : isLarge ? 12 : 8);
  const updatedLabel = data ? formatRelativeTime(new Date(data.fetchedAt).toISOString()) : '';
  const refreshDisabled = isLoading || cooldownUntil > Date.now();
  const containerPadding = isSmall ? 'px-4 py-3' : isLarge ? 'px-6 py-5' : 'px-5 py-4';
  const topicLabel = formatTopicLabel(topic);
  const regionLabel = NEWS_REGION_CONFIG[region].label;

  return (
    <div
      className={`flex h-full w-full min-w-0 flex-col overflow-hidden text-[var(--color-textPrimary)] ${containerPadding} ${
        isEditMode ? (isSmall ? 'pb-11' : 'pb-14') : ''
      }`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FiGlobe size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-[11px] font-bold leading-none text-[var(--color-textSecondary)]">
              <span className="shrink-0 uppercase text-[var(--color-textMuted)]">News</span>
              <span className="shrink-0 text-[var(--color-textMuted)]">/</span>
              <span className="truncate">{topicLabel}</span>
              <span className="shrink-0 text-[var(--color-textMuted)]">/</span>
              <span className="truncate">{regionLabel}</span>
              <span className="shrink-0 text-[var(--color-textMuted)]">/</span>
              <span className="shrink-0">Today</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          data-no-widget-drag="true"
          disabled={refreshDisabled}
          title="Refresh news"
          aria-label="Refresh news"
          onClick={event => {
            event.stopPropagation();
            void fetchNews('manual');
          }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-borderDefault)] ${NEWS_BUTTON_SURFACE_CLASS} text-[var(--color-iconDefault)] transition hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50`}>
          <FiRefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading && visibleArticles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-xs font-semibold text-[var(--color-textSecondary)]">
          <FiRefreshCw className="animate-spin" size={22} />
          <span>Loading news...</span>
        </div>
      ) : error && visibleArticles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-2 text-center text-xs font-semibold text-[var(--color-textSecondary)]">
          {error || 'Unable to load news right now.'}
        </div>
      ) : (
        <>
          <div className={`custom-scrollbar min-h-0 flex-1 ${isSmall ? 'mt-2 flex flex-col gap-1.5 overflow-y-auto pr-1' : 'mt-2.5 flex flex-col gap-1.5 overflow-y-auto pr-1'}`}>
            <div className={`min-h-0 flex-col ${isSmall ? 'flex gap-1.5' : 'flex gap-1.5'}`}>
              {visibleArticles.map(article => (
                <NewsArticleCard key={`${article.articleUrl}-${article.title}`} article={article} compact={isSmall} showDescription={isLarge} />
              ))}
            </div>
          </div>

          <div className="mt-2 flex shrink-0 min-w-0 items-center justify-between gap-2 text-[9px] font-bold text-[var(--color-textMuted)]">
            <span className="truncate">
              {error ? `${error} Showing latest saved headlines.` : isLoading ? 'Refreshing headlines...' : 'Live headlines'}
            </span>
            <span className="shrink-0">{updatedLabel ? `Updated ${updatedLabel}` : 'Live'}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default NewsWidget;
