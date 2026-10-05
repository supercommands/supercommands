/**
 * @file snippetHooks.ts
 * @description Provides React hooks (`useSnippet` and `useSnippets`) for subscribing to
 * snippet records reactively using dexie-react-hooks.
 *
 * @usage
 * ```tsx
 * import { useSnippet } from './snippetHooks';
 * const snippet = useSnippet(snippetId);
 * ```
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { getSnippet, getSnippetsForOrganisation, getAllSnippets } from './snippetData';
/**
 * Subscribes to a single snippet by its ID.
 */
export function useSnippet(id: string | null) {
    return useLiveQuery(() => (id ? getSnippet(id) : undefined), [id]);
}
/**
 * Subscribes to a collection of snippets.
 */
export function useSnippets(organisationId?: string) {
    return useLiveQuery(async () => {
        if (organisationId) {
            return getSnippetsForOrganisation(organisationId);
        }
        return getAllSnippets();
    }, [organisationId], []);
}
