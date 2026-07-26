import { useCallback } from 'react';
import { useDbStore } from '../../storage/store/useDbStore';
import { findCommandByAnyId } from '../commands';

export const useConflictResolver = () => {
  const commands = useDbStore(state => state.commands);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);
  const todos = useDbStore(state => state.todos);
  const links = useDbStore(state => state.links);
  const sessions = useDbStore(state => state.sessions);
  const aiPrompts = useDbStore(state => state.aiPrompts);

  const findConflictingItemName = useCallback(
    (conflictingId: string) => {
      if (!conflictingId) return null;
      const cleanConflictingId = conflictingId.replace(/^(todo|note|link|session|snippet|aiprompt)_/, '');

      // 1. Check commands
      const cmd = findCommandByAnyId(commands, conflictingId);
      if (cmd) return cmd.label;

      // 2. Check todos
      for (const todo of todos) {
        const tId = String(todo.id);
        const cleanTId = tId.replace(/^todo_/, '');
        if (tId === conflictingId || cleanTId === cleanConflictingId || conflictingId.includes(tId) || (cleanTId.length > 3 && conflictingId.includes(cleanTId))) {
          return todo.name || 'Task';
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
        const compound = `${String((snippet as any).workspaceId ?? '')}-${String((snippet as any).folderId ?? '')}-${snippetId}`;
        if (
          compound === conflictingId ||
          snippetId === conflictingId ||
          cleanSnippetId === cleanConflictingId ||
          (snippetId && conflictingId.includes(snippetId)) ||
          (cleanSnippetId.length > 3 && conflictingId.includes(cleanSnippetId))
        ) {
          return String((snippet as any).key ?? (snippet as any).title ?? 'Snippet');
        }
      }

      // 7. Check local workspace/folder records
      for (const workspace of workspaces) {
        const workspaceId = String((workspace as any).workspaceId ?? workspace.id);
        if (workspaceId === conflictingId || workspaceId === cleanConflictingId || conflictingId.includes(workspaceId)) {
          return String((workspace as any).workspaceName ?? (workspace as any).name ?? 'Workspace');
        }
      }

      for (const folder of folders) {
        const folderId = String((folder as any).folderId ?? folder.id);
        if (folderId === conflictingId || folderId === cleanConflictingId || conflictingId.includes(folderId)) {
          return String((folder as any).folderName ?? (folder as any).name ?? 'Folder');
        }
      }

      return null;
    },
    [commands, folders, snippets, workspaces, todos, links, sessions, aiPrompts],
  );

  return { findConflictingItemName };
};
