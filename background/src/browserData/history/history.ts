/**
 * @file history.ts
 * @description Background service handler for interacting with Chrome's native History API.
 */

/**
 * Message handler for history queries. Supports basic searching and an advanced
 * search mode with frecency (frequency + recency) scoring.
 *
 * @param request The message payload (actions: `search_history`, `history_search`).
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleHistorySearch(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'search_history') {
    // Default to last 90 days if startTime not provided. chrome.history.search defaults to last 24h otherwise.
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    chrome.history.search(
      {
        text: request.query,
        maxResults: request.maxResults || 10,
        startTime: request.startTime || ninetyDaysAgo,
      },
      results => {
        sendResponse(results || []);
      },
    );
    return true;
  }

  // History search for content scripts and AltS_search_newtab page (similar to bookmarks_search)
  if (request.action === 'history_search') {
    const query = (request.query as string) || '';
    const maxResults = typeof request.maxResults === 'number' ? request.maxResults : 30;
    const includeFrecency = Boolean(request.includeFrecency);
    const halfLifeHoursRaw = Number(request.halfLifeHours);
    const halfLifeHours = Number.isFinite(halfLifeHoursRaw) && halfLifeHoursRaw > 0 ? halfLifeHoursRaw : 2;
    const lambda = Math.LN2 / halfLifeHours;
    const now = Date.now();

    if (!chrome.history?.search) {
      sendResponse({ ok: false, results: [], error: 'history_api_unavailable' });
      return false; // synchronous
    }

    if (includeFrecency && !chrome.history?.getVisits) {
      sendResponse({ ok: false, results: [], error: 'history_visits_api_unavailable' });
      return false;
    }
    try {
      // Search history for the past 90 days by default, unless a caller asks for a narrower window.
      const requestedStartTime = Number(request.startTime);
      const historyDays = Number(request.historyDays);
      const defaultStartTime = Date.now() - 90 * 24 * 60 * 60 * 1000;
      const startTime = Number.isFinite(requestedStartTime) && requestedStartTime > 0
        ? requestedStartTime
        : Number.isFinite(historyDays) && historyDays > 0
          ? Date.now() - historyDays * 24 * 60 * 60 * 1000
          : defaultStartTime;
      chrome.history.search(
        {
          text: query,
          startTime,
          maxResults: maxResults * 2, // Request more to filter duplicates
        },
        historyItems => {
          // Filter out duplicate URLs and basic invalid/internal entries
          const seenUrls = new Set<string>();
          const uniqueItems = (historyItems || [])
            .filter(item => {
              if (!item.url || seenUrls.has(item.url)) return false;
              // Skip internal browser pages and extension pages
              if (
                item.url.startsWith('chrome://') ||
                item.url.startsWith('chrome-extension://') ||
                item.url.startsWith('edge://') ||
                item.url.startsWith('about:')
              ) {
                return false;
              }
              seenUrls.add(item.url);
              return true;
            })
            .slice(0, maxResults);

          if (!includeFrecency) {
            const results = uniqueItems.map(item => ({
              id: item.id || '',
              title: item.title || item.url || '',
              url: item.url || '',
              lastVisitTime: item.lastVisitTime || 0,
              visitCount: item.visitCount || 0,
            }));
            sendResponse({ ok: true, results });
            return;
          }

          const getVisitsForUrl = (url: string): Promise<chrome.history.VisitItem[]> =>
            new Promise(resolve => {
              chrome.history.getVisits({ url }, visits => {
                resolve(visits || []);
              });
            });

          const computeFrecencyScore = (visits: chrome.history.VisitItem[]): number => {
            let score = 0;
            for (const visit of visits) {
              if (!visit?.visitTime) continue;
              const hoursSinceVisit = (now - visit.visitTime) / 3600000;
              if (hoursSinceVisit < 0) continue;
              score += Math.exp(-lambda * hoursSinceVisit);
            }
            return score;
          };

          Promise.all(
            uniqueItems.map(async item => {
              const url = item.url || '';
              const visits = url ? await getVisitsForUrl(url) : [];
              const frecencyScore = computeFrecencyScore(visits);

              return {
                id: item.id || '',
                title: item.title || url || '',
                url,
                lastVisitTime: item.lastVisitTime || 0,
                visitCount: item.visitCount || 0,
                frecencyScore,
              };
            }),
          )
            .then(results => {
              sendResponse({ ok: true, results });
            })
            .catch(err => {
              sendResponse({ ok: false, results: [], error: String(err) });
            });
        },
      );
      return true; // async
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false; // synchronous
    }
  }

  return undefined;
}
