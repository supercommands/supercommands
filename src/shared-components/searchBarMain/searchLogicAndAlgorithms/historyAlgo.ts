/**
 * historyAlgo.ts
 *
 * Chrome Omnibox-like algorithm for filtering and sorting Chrome history search results.
 *
 * Key optimizations:
 * 1. Google Search filtering - Removes Google search result URLs but keeps Google apps
 * 2. Domain prefix early return - Instant match for domain prefix without fuzzy search
 * 3. Navigation Intent Detection - Prioritizes destinations over content for short queries
 *
 * Sorting:
 *   1. Domain prefix matches first (instant like Chrome)
 *   2. Higher frecency score (frequency × recency)
 *   3. Better text match quality
 */

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
  frecencyScore?: number;
  domain?: string; // Optional pre-calculated domain for search optimization
}

// ============================================================================
// 1️⃣ HELPERS & FILTERS
// ============================================================================

/**
 * Detect if a URL is a Google search result page.
 */
export function isGoogleSearchResult(url: string): boolean {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();

    const isMainGoogleDomain =
      hostname === 'google.com' ||
      hostname === 'www.google.com' ||
      /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(hostname);

    if (!isMainGoogleDomain) return false;

    const isSearchPath = u.pathname === '/search' || u.pathname.startsWith('/search');
    const hasSearchQuery = u.searchParams.has('q');

    return isSearchPath && hasSearchQuery;
  } catch {
    return false;
  }
}

/**
 * Filter out Google search results from history items.
 */
export function filterGoogleSearchResults(items: HistoryItem[]): HistoryItem[] {
  return items.filter(item => !isGoogleSearchResult(item.url));
}

/**
 * Detect if a query looks like navigation intent (typing a destination).
 * E.g., "m", "ma", "mail", "github"
 */
export function isLikelyNavigationQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  // Single token or very short query without spaces
  if (!q.includes(' ') && q.length <= 6) return true;
  // Looks like domain typing (pure letters)
  if (/^[a-z]+$/.test(q)) return true;
  return false;
}

/**
 * Detect if a URL is a "deep path" (3+ segments).
 * These represent deep content rather than top-level destinations.
 * E.g., reddit.com/r/category/comments/id/...
 */
export function isDeepPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    // Filter Boolean removes empty strings from lead/trail slashes
    return path.split('/').filter(Boolean).length >= 3;
  } catch {
    return false;
  }
}

// ============================================================================
// 3️⃣ DOMAIN PREFIX EARLY RETURN
// ============================================================================

/**
 * Check if query is a domain prefix match.
 */
export function isDomainPrefixMatch(url: string, query: string): boolean {
  if (!query || query.length < 1) return false;

  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    const hostWithoutWww = hostname.replace(/^www\./, '');
    const normalizedQuery = query.toLowerCase().trim();

    if (hostWithoutWww.startsWith(normalizedQuery)) return true;
    if (hostname.startsWith(normalizedQuery)) return true;

    const domainParts = hostWithoutWww.split('.');
    const firstPart = domainParts[0];

    // Exact or prefix match of the first domain part (e.g., "git" -> "github")
    if (firstPart.startsWith(normalizedQuery)) return true;

    // Fuzzy/Plural match: query starts with the domain part and is very close (e.g., "mails" -> "mail")
    // Only allow if query is just 1-2 chars longer to avoid false positives
    if (normalizedQuery.startsWith(firstPart) && normalizedQuery.length <= firstPart.length + 2) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Get domain prefix match score.
 */
export function getDomainPrefixScore(url: string, query: string): number {
  if (!query || query.length < 1) return 0;

  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    const hostWithoutWww = hostname.replace(/^www\./, '');
    const normalizedQuery = query.toLowerCase().trim();

    // Exact domain match (highest)
    if (hostWithoutWww === normalizedQuery || hostWithoutWww === normalizedQuery + '.com') {
      return 0.5;
    }

    // Check individual segments
    const domainParts = hostWithoutWww.split('.');

    for (let i = 0; i < domainParts.length; i++) {
      const segment = domainParts[i];
      if (segment.startsWith(normalizedQuery)) {
        let score = 0.3;

        // Penalize tiny junk subdomains that technically start with the query
        // E.g., 'm.' or 'mobile.' match 'm' but aren't useful destinations
        const isTrivialSubdomain = segment === 'm' || segment === 'mobile' || segment === 'www' || segment === 'w';
        if (isTrivialSubdomain && i === 0 && domainParts.length > 1) {
          // If query is exactly 'm' and segment is 'm', it's high ratio but trivial
          score -= 0.15;
        }

        // Reward based on how much of the segment matched
        const matchRatio = normalizedQuery.length / segment.length;
        score += matchRatio * 0.15; // Increased impact

        // Priority for the second part if the first is 'm' (e.g., m.imdb.com -> highlight 'imdb')
        if (i === 1 && (domainParts[0] === 'm' || domainParts[0] === 'mobile')) {
          score += 0.1; // Increased boost
        }

        // Destination bonus: If this segment is the main domain part
        if (i === domainParts.length - 2 || (domainParts.length === 1 && i === 0)) {
          score += 0.1;
        }

        return score;
      }
    }

    return 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// 5️⃣ CORE MATCHING & SCORING
// ============================================================================

/**
 * Check if query matches the item's URL or title.
 */
export const matchesQuery = (item: HistoryItem, query: string): boolean => {
  if (!query || query.trim().length === 0) return true;

  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTitle = (item.title || '').toLowerCase();
  const normalizedUrl = (item.url || '').toLowerCase();

  const titleMatch = normalizedTitle.includes(normalizedQuery);
  const urlMatch = normalizedUrl.includes(normalizedQuery);
  return titleMatch || urlMatch;
};

/**
 * Calculate a relevance score for an item based on how well it matches the query.
 */
export const getRelevanceScore = (item: HistoryItem, query: string): number => {
  if (!query || query.trim().length === 0) return 0;

  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTitle = (item.title || '').toLowerCase();

  let score = 0;

  // Get domain for boosting
  let domain = '';
  try {
    domain = new URL(item.url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    domain = (item.url || '').toLowerCase();
  }

  // ===== DOMAIN PREFIX MATCHING (Chrome's #1 signal) =====
  const domainPrefixScore = getDomainPrefixScore(item.url, normalizedQuery);
  if (domainPrefixScore > 0) {
    score += domainPrefixScore * 200; // Increased boost
  }

  // ===== TEXT MATCH SCORING =====
  if (normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 70;
  } else {
    const titleWords = normalizedTitle.split(/[\s\-_|:,./]+/);
    if (titleWords.some(word => word.startsWith(normalizedQuery))) {
      score += 50;
    } else if (normalizedTitle.includes(normalizedQuery)) {
      score += 25;
    }
  }

  // Subdomain/Domain specific matches
  if (domainPrefixScore === 0) {
    if (domain === normalizedQuery || domain === normalizedQuery + '.com') {
      score += 80;
    } else if (domain.includes(normalizedQuery)) {
      score += 20;
    }
  }

  // ===== FRECENCY SCORING (INTELLIGENT WEIGHTING) =====
  // Logarithmic scaling for visit count - user wants this to give real priority
  // Use a steeper multiplier (100) to ensure high-frequency sites stay on top
  const frequencyBonus = Math.log10(Math.max(1, item.visitCount)) * 100;
  score += frequencyBonus;

  const now = Date.now();
  const hoursSinceVisit = (now - (item.lastVisitTime || 0)) / (1000 * 60 * 60);

  let recencyBonus: number;
  if (hoursSinceVisit < 1) recencyBonus = 40;
  else if (hoursSinceVisit < 4) recencyBonus = 30;
  else if (hoursSinceVisit < 24) recencyBonus = 20;
  else if (hoursSinceVisit < 24 * 7) recencyBonus = 10;
  else recencyBonus = 0;

  score += recencyBonus;

  // ===== PATH DEPTH PENALTY & DESTINATION BOOST =====
  try {
    const u = new URL(item.url);
    const pathSegments = u.pathname.split('/').filter(Boolean).length;

    // Penalize deep paths for short navigation-style queries
    if (normalizedQuery.length <= 4) {
      if (pathSegments > 2) score -= 50;
      if (pathSegments > 4) score -= 100;
      if (pathSegments <= 1) score += 30; // Boost root or near-root URLs
    }
  } catch {}

  return score;
};

/**
 * Compare two history items for sorting.
 */
export const compareHistoryItems = (a: HistoryItem, b: HistoryItem): number => {
  if (a.visitCount !== b.visitCount) {
    return b.visitCount - a.visitCount;
  }
  return b.lastVisitTime - a.lastVisitTime;
};

/**
 * Advanced comparator that also considers query relevance.
 */
export const compareWithRelevance = (a: HistoryItem, b: HistoryItem, query: string): number => {
  const aRelevance = getRelevanceScore(a, query);
  const bRelevance = getRelevanceScore(b, query);

  if (Math.abs(aRelevance - bRelevance) >= 20) {
    return bRelevance - aRelevance;
  }

  return compareHistoryItems(a, b);
};

// ============================================================================
// MAIN PROCESSING PIPELINE
// ============================================================================

/**
 * Preprocess history items for optimal search.
 */
export function preprocessHistoryItems(items: HistoryItem[]): HistoryItem[] {
  if (!items || items.length === 0) return [];

  // 1. Filter Google Search result pages
  const results = filterGoogleSearchResults(items);

  // 2. DEEP DEDUPLICATION
  // User: "remove duplicates where the site titles and domains with "/" check deeply"
  // Logic: Items with the same title and the same URL (ignoring trailing slash) are duplicates.
  // Keep the most recent/visited one.
  const seen = new Map<string, HistoryItem>();

  const extractSimpleDomain = (url: string): string => {
    try {
      const u = new URL(url);
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return url.toLowerCase();
    }
  };

  for (const item of results) {
    const normalizedUrl = item.url.replace(/\/$/, '').toLowerCase();
    const normalizedTitle = String(item.title || '')
      .trim()
      .toLowerCase();
    const key = `${normalizedTitle}|${normalizedUrl}`;

    // Also deduplicate by domain if titles are identical?
    // User: "remove duplicates where the site titles and domains with "/" check deeply"
    const domainKey = `${normalizedTitle}|${extractSimpleDomain(item.url)}`;

    const existing = seen.get(key);

    // If we have an existing item, decide whether to replace it
    if (!existing) {
      seen.set(key, item);
    } else {
      // Prioritize by visit count
      // Ties represent same site/path - prefer more recent or better titles
      const shouldReplace =
        item.visitCount > existing.visitCount ||
        (item.visitCount === existing.visitCount && item.lastVisitTime > existing.lastVisitTime) ||
        // If visit count is similar, prefer the SHORTER URL (likely a cleaner destination)
        (Math.abs(item.visitCount - existing.visitCount) < 5 && item.url.length < existing.url.length);

      if (shouldReplace) {
        seen.set(key, item);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Find domain prefix matches.
 */
export function findDomainPrefixMatches(items: HistoryItem[], query: string, limit: number = 5): HistoryItem[] {
  if (!query || query.trim().length < 1) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const matches = items.filter(item => isDomainPrefixMatch(item.url, normalizedQuery));

  const scored = matches.map(item => {
    const domainPrefixScore = getDomainPrefixScore(item.url, normalizedQuery);
    const relevanceScore = getRelevanceScore(item, normalizedQuery);
    const title = (item.title || '').toLowerCase();

    let totalScore = domainPrefixScore * 100 + relevanceScore;

    // INTELLIGENCE: Boost if query matches BOTH domain and title
    if (domainPrefixScore > 0 && title.startsWith(normalizedQuery)) {
      totalScore += 50; // Massively prioritize dual-matches (e.g., 'm' -> 'Mi Store' on 'm.mi.com')
    }

    // INTELLIGENCE: Penalize if domain match is just a utility subdomain (m., mobile.)
    // AND the title doesn't match the query at all. This fixes the 'm' -> 'imdb (Dhurandhar)' issue.
    try {
      const u = new URL(item.url);
      const hostParts = u.hostname
        .toLowerCase()
        .replace(/^www\./, '')
        .split('.');
      if ((hostParts[0] === 'm' || hostParts[0] === 'mobile') && !title.includes(normalizedQuery)) {
        totalScore -= 40; // Deprioritize mobile subdomains with irrelevant titles
      }
    } catch {}

    return { item, score: totalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.item);
}

/**
 * Filter and sort history items based on query.
 * Implements "Navigation Intent" logic from Chrome.
 */
export const filterAndSortHistory = (items: HistoryItem[], query: string, limit: number = 10): HistoryItem[] => {
  if (!items || items.length === 0) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const navMode = isLikelyNavigationQuery(normalizedQuery);

  // 1. Get Domain Prefix Matches
  const domainPrefixMatches = findDomainPrefixMatches(items, normalizedQuery, limit);

  // 2. EXCLUSIVE MODE: If it looks like domain typing and we found matches, kill content results
  if (navMode && domainPrefixMatches.length > 0) {
    // Only return the domain matches if they are strong (e.g. prefix match on hostname)
    return domainPrefixMatches.slice(0, limit);
  }

  // 3. Filter remaining items
  const filtered = items.filter(item => {
    // RULE: Basic query match
    if (!matchesQuery(item, normalizedQuery)) return false;

    return true;
  });

  // 4. Sort and return
  const sorted = filtered.sort((a, b) => compareWithRelevance(a, b, normalizedQuery));

  // Even if not exclusive, Domain Prefix Matches always stay top
  const combined = [...domainPrefixMatches, ...sorted];
  return combined.slice(0, limit);
};

/**
 * Simple filter and sort.
 */
export const filterAndSortHistorySimple = (items: HistoryItem[], query: string, limit: number = 10): HistoryItem[] => {
  if (!items || items.length === 0) return [];
  const filtered = items.filter(item => matchesQuery(item, query));
  const sorted = filtered.sort(compareHistoryItems);
  return sorted.slice(0, limit);
};
