import { useDbStore } from '../storage/store/useDbStore';
import { useUIStore } from './uiStateManager';
export const useSelectedOrganisationId = () => useUIStore(state => state.selectedOrganisationId);
export const useSelectedSnippetId = () => useUIStore(state => state.selectedSnippetId);
export const useOrganisationById = (organisationId: string | null | undefined) => useDbStore(state => (organisationId ? state.organisations.find(organisation => organisation.id === organisationId) ?? null : null));
export const useSnippetById = (snippetId: string | null | undefined) => useDbStore(state => (snippetId ? state.snippets.find(snippet => snippet.id === snippetId) ?? null : null));
export const useNoteById = (noteId: string | null | undefined) => useDbStore(state => (noteId ? state.notes.find(note => note.id === noteId) ?? null : null));
export const useLinkById = (linkId: string | null | undefined) => useDbStore(state => (linkId ? state.links.find(link => link.id === linkId) ?? null : null));
export const useSelectedOrganisation = () => {
    const organisationId = useSelectedOrganisationId();
    return useOrganisationById(organisationId);
};
export const useSelectedSnippet = () => {
    const snippetId = useSelectedSnippetId();
    return useSnippetById(snippetId);
};
