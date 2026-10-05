/**
 * TanStack Query Client Configuration
 *
 * This provides centralized query caching with chrome.storage persistence.
 * Key benefits:
 * - Automatic request deduplication (multiple components = 1 request)
 * - Smart stale-while-revalidate caching
 * - Cross-tab data sharing via chrome.storage
 * - Significantly reduced memory footprint
 */
import { QueryClient } from '@tanstack/react-query';
// Create a custom storage adapter for chrome.storage.local
// This allows TanStack Query to persist its cache to chrome storage
const createChromeStorageAdapter = () => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local) {
        // Fallback to no-op storage if chrome.storage is unavailable
        return {
            getItem: () => Promise.resolve(null),
            setItem: () => Promise.resolve(),
            removeItem: () => Promise.resolve(),
        };
    }
    return {
        getItem: (key: string): Promise<string | null> => {
            return new Promise(resolve => {
                chromeAny.storage.local.get(key, (result: Record<string, string | undefined>) => {
                    resolve(result[key] ?? null);
                });
            });
        },
        setItem: (key: string, value: string): Promise<void> => {
            return new Promise(resolve => {
                chromeAny.storage.local.set({ [key]: value }, resolve);
            });
        },
        removeItem: (key: string): Promise<void> => {
            return new Promise(resolve => {
                chromeAny.storage.local.remove(key, resolve);
            });
        },
    };
};
export const chromeStorageAdapter = createChromeStorageAdapter();
/**
 * Create the main QueryClient with optimized settings for AltS_search_newtab
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data considered fresh for 5 minutes (won't refetch if accessed within this time)
            staleTime: 5 * 60 * 1000,
            // Keep data in memory for 30 minutes after last use
            gcTime: 30 * 60 * 1000,
            // Don't refetch on window focus (reduces API calls)
            refetchOnWindowFocus: false,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
            // Only retry once on failure
            retry: 1,
            // Network mode: always try to fetch (works offline with cache)
            networkMode: 'offlineFirst',
        },
        mutations: {
            // Retry mutations once on failure
            retry: 1,
        },
    },
});
/**
 * Query keys for consistent cache management
 */
export const QUERY_KEYS = {
    // Workspace data
    organisations: {
        byId: (organisationId: string) => ['organisations', 'detail', organisationId] as const,
    },
    // Snippet data
    snippets: {
        byOrganisation: (organisationId: string) => ['snippets', 'organisation', organisationId] as const,
        byId: (snippetId: string) => ['snippets', 'detail', snippetId] as const,
    },
    // History data
    history: {
        all: ['history', 'all'] as const,
        search: (query: string) => ['history', 'search', query] as const,
    },
    // Bookmarks
    bookmarks: {
        all: ['bookmarks', 'all'] as const,
    },
} as const;
