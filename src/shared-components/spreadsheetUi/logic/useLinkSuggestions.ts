import { useState, useEffect, useMemo } from 'react';
import { useDbStore
 } from '../../../storage/store/useDbStore';
 import { getFaviconUrl } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automationUtils';

export interface LinkSuggestion {
  id: string;
  url: string;
  name: string;
  source: 'tab' | 'history' | 'bookmark' | 'saved';
  favIconUrl?: string;
  allUrls?: string[]; // NEW: To support bulk selection
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const stripHtml = (html: string) => {
  return typeof html === 'string' ? html.replace(/<[^>]*>/g, '').trim() : '';
};

export const useLinkSuggestions = (query: string) => {
  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const [asyncSuggestions, setAsyncSuggestions] = useState<LinkSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Ensure normalizedQuery is always a string and defined before any hooks
  const normalizedQuery = useMemo(() => {
    if (!query || typeof query !== 'string') return '';
    return query.toLowerCase().trim();
  }, [query]);

  // 1. Instant Results from the local DB store (Memoized)
  const instantSuggestions = useMemo(() => {
    if (!normalizedQuery || normalizedQuery.length < 3) return [];

    const results: LinkSuggestion[] = [];
    const seenUrls = new Set<string>();

    const savedEntities = [...links, ...notes, ...snippets];

    savedEntities.forEach((entity: any) => {
      const category = String(entity.category || entity.type || '').toLowerCase();
      const isLink = ['link', 'links', 'tabgroup', 'session', 'sessions', 'tab session'].includes(category) || !!entity.url;
      const isNote = ['note', 'notes'].includes(category);
      const isSnippet = ['snippet', 'snippets'].includes(category);

      if (!isLink && !isNote && !isSnippet) return;

      const name = String(entity.key || entity.title || entity.name || 'Untitled');
      let urlsFound: string[] = [];

      try {
        if (typeof entity.value === 'string' && entity.value.trim().startsWith('{')) {
          const parsed = JSON.parse(entity.value);
          if (Array.isArray(parsed.urls)) {
            urlsFound = parsed.urls.map((item: any) =>
              typeof item === 'object' ? item.url || item.value || JSON.stringify(item) : item,
            );
          } else if (parsed.url) {
            urlsFound = [parsed.url];
          } else if (parsed.value) {
            urlsFound = [parsed.value];
          } else {
            urlsFound = [entity.value];
          }
        } else if (typeof entity.value === 'object' && entity.value !== null) {
          const val = entity.value as any;
          if (Array.isArray(val.urls)) urlsFound = val.urls;
          else if (val.url) urlsFound = [val.url];
          else urlsFound = [JSON.stringify(val)];
        } else if (entity.url) {
          urlsFound = [entity.url];
        } else if (entity.value) {
          urlsFound = [entity.value];
        }
      } catch {
        if (entity.value) urlsFound = [entity.value];
        else if (entity.url) urlsFound = [entity.url];
      }

      if (isLink && urlsFound.length > 1) {
        results.push({
          id: `saved-bulk-${entity.id}`,
          url: urlsFound[0],
          allUrls: urlsFound,
          name: `[Bulk] ${name}`,
          source: 'saved',
          favIconUrl: getFaviconUrl(getHostname(urlsFound[0])),
        });
      }

      urlsFound.forEach((u, idx) => {
        if (!u) return;
        let url = typeof u === 'object' ? (u as any).url || (u as any).value || JSON.stringify(u) : String(u);
        const safeName = name;

        if (isNote || url.includes('<')) {
          url = stripHtml(url);
        }

        if (seenUrls.has(url)) return;
        if (safeName.toLowerCase().includes(normalizedQuery) || url.toLowerCase().includes(normalizedQuery)) {
          seenUrls.add(url);
          results.push({
            id: `saved-${entity.id}-${idx}`,
            url,
            name: urlsFound.length > 1 ? `${safeName} (${idx + 1})` : safeName,
            source: 'saved',
            favIconUrl: getFaviconUrl(getHostname(url)),
          });
        }
      });
    });
    return results;
  }, [links, notes, snippets, normalizedQuery]);

  // 2. Async Results from Chrome APIs
  useEffect(() => {
    if (!normalizedQuery || normalizedQuery.length < 3) {
      setAsyncSuggestions([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime) return;

      setIsLoading(true);
      const results: LinkSuggestion[] = [];

      try {
        const tabPromise = chromeAny.tabs?.query
          ? new Promise<any[]>(r => chromeAny.tabs.query({}, r))
          : Promise.resolve([]);
        const historyPromise = chromeAny.history?.search
          ? new Promise<any[]>(r => chromeAny.history.search({ text: normalizedQuery, maxResults: 15 }, r))
          : Promise.resolve([]);
        const bookmarkPromise = chromeAny.bookmarks?.search
          ? new Promise<any[]>(r => chromeAny.bookmarks.search(normalizedQuery, r))
          : Promise.resolve([]);

        const [tabs, history, bookmarks] = await Promise.all([tabPromise, historyPromise, bookmarkPromise]);

        tabs?.forEach((t: any) => {
          if (
            t.url &&
            !t.url.startsWith('chrome-extension://') &&
            (t.title?.toLowerCase().includes(normalizedQuery) || t.url?.toLowerCase().includes(normalizedQuery))
          ) {
            results.push({
              id: `tab-${t.id}-${t.url}`,
              url: t.url,
              name: t.title || getHostname(t.url),
              source: 'tab',
              favIconUrl: t.favIconUrl || getFaviconUrl(getHostname(t.url)),
            });
          }
        });

        history?.forEach((h: any) => {
          if (h.url) {
            results.push({
              id: `history-${h.id || h.url}`,
              url: h.url,
              name: h.title || getHostname(h.url),
              source: 'history',
              favIconUrl: getFaviconUrl(getHostname(h.url)),
            });
          }
        });

        bookmarks?.forEach((b: any) => {
          if (b.url) {
            results.push({
              id: `bookmark-${b.id || b.url}`,
              url: b.url,
              name: b.title || getHostname(b.url),
              source: 'bookmark',
              favIconUrl: getFaviconUrl(getHostname(b.url)),
            });
          }
        });
      } catch (e) {
        console.error('Chrome API search failed', e);
      } finally {
        setAsyncSuggestions(results);
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [normalizedQuery]);

  // Merge and Deduplicate
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged: LinkSuggestion[] = [];

    [...instantSuggestions, ...asyncSuggestions].forEach(s => {
      if (!s.url || seen.has(s.url)) return;
      if (s.source === 'history' || s.source === 'saved' || s.source === 'bookmark') {
        seen.add(s.url);
        merged.push(s);
      }
    });

    return merged.slice(0, 8);
  }, [instantSuggestions, asyncSuggestions]);

  return { suggestions, isLoading };
};

