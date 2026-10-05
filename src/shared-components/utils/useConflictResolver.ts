import { useCallback } from 'react';
import { useDbStore } from '../../storage/store/useDbStore';
import { findCommandByAnyId } from '../commands';
export const useConflictResolver = () => {
    const commands = useDbStore(state => state.commands);
    const organisations = useDbStore(state => state.organisations);
    const snippets = useDbStore(state => state.snippets);
    const todos = useDbStore(state => state.todos);
    const links = useDbStore(state => state.links);
    const sessions = useDbStore(state => state.sessions);
    const aiPrompts = useDbStore(state => state.aiPrompts);
    const findConflictingItemName = useCallback((conflictingId: string) => {
        if (!conflictingId)
            return null;
        const cleanConflictingId = conflictingId.replace(/^(todo|note|link|session|snippet|aiprompt)_/, '');
        // 1. Check commands
        const cmd = findCommandByAnyId(commands, conflictingId);
        if (cmd)
            return cmd.label;
        // 2. Check todos
        for (const todo of todos) {
            const tId = String(todo.id);
            const cleanTId = tId.replace(/^todo_/, '');
            if (tId === conflictingId || cleanTId === cleanConflictingId || conflictingId.includes(tId) || (cleanTId.length > 3 && conflictingId.includes(cleanTId))) {
                return todo.name || 'Todo';
            }
        }
        // 3. Check links
        for (const link of links) {
            const lId = String((link as any).id);
            const cleanLId = lId.replace(/^link_/, '');
            if (lId === conflictingId || cleanLId === cleanConflictingId || conflictingId.includes(lId) || (cleanLId.length > 3 && conflictingId.includes(cleanLId))) {
                return (link as any).title || (link as any).name || 'Link';
            }
        }
        // 4. Check sessions
        for (const session of sessions) {
            const sId = String((session as any).id);
            const cleanSId = sId.replace(/^session_/, '');
            if (sId === conflictingId || cleanSId === cleanConflictingId || conflictingId.includes(sId) || (cleanSId.length > 3 && conflictingId.includes(cleanSId))) {
                return (session as any).title || (session as any).name || 'Session';
            }
        }
        // 5. Check aiPrompts
        for (const prompt of aiPrompts) {
            const pId = String((prompt as any).id);
            const cleanPId = pId.replace(/^aiprompt_/, '');
            if (pId === conflictingId || cleanPId === cleanConflictingId || conflictingId.includes(pId) || (cleanPId.length > 3 && conflictingId.includes(cleanPId))) {
                return (prompt as any).title || (prompt as any).name || 'AI Prompt';
            }
        }
        // 6. Check snippets
        for (const snippet of snippets) {
            const snippetId = String((snippet as any).snippet_id ?? (snippet as any).id ?? '');
            const cleanSnippetId = snippetId.replace(/^snippet_/, '');
            const compound = `${String((snippet as any).organisationId ?? '')}-${String('')}-${snippetId}`;
            if (compound === conflictingId ||
                snippetId === conflictingId ||
                cleanSnippetId === cleanConflictingId ||
                (snippetId && conflictingId.includes(snippetId)) ||
                (cleanSnippetId.length > 3 && conflictingId.includes(cleanSnippetId))) {
                return String((snippet as any).key ?? (snippet as any).title ?? 'Snippet');
            }
        }
        for (const organisation of organisations) {
            const organisationId = String((organisation as any).organisationId ?? organisation.id);
            if (organisationId === conflictingId || organisationId === cleanConflictingId || conflictingId.includes(organisationId)) {
                return String((organisation as any).organisationName ?? (organisation as any).name ?? 'Workspace');
            }
        }
        return null;
    }, [commands, snippets, organisations, todos, links, sessions, aiPrompts]);
    return { findConflictingItemName };
};
