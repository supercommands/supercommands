/**
 * @file noteHooks.ts
 * @description Provides React hooks (`useNote` and `useNotes`) for subscribing to
 * note record changes reactively using dexie-react-hooks.
 *
 * @usage
 * ```tsx
 * import { useNote } from './noteHooks';
 * const note = useNote(noteId);
 * ```
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { getNote, getNotesForOrganisation, getAllNotes } from './noteData';
/**
 * Subscribes to a single note by its ID.
 */
export function useNote(id: string | null) {
    return useLiveQuery(() => (id ? getNote(id) : undefined), [id]);
}
/**
 * Subscribes to a collection of notes.
 */
export function useNotes(organisationId?: string) {
    return useLiveQuery(async () => {
        if (organisationId) {
            return getNotesForOrganisation(organisationId);
        }
        return [];
    }, [organisationId], []);
}
