import type { SnippetActionDetail } from '../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { deleteLink } from '../../allObjectFolder/src/createObject/links/linkData';
import { deleteTodo } from '../../allObjectFolder/src/createObject/todos/todoData';
import { deleteNote } from '../../allObjectFolder/src/createObject/notes/noteData';
import { deleteSession } from '../../allObjectFolder/src/createObject/session/sessionData';
import { deleteAiPrompt } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { deleteChatAgent } from '../../allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { deleteAutomation } from '../../allObjectFolder/src/createObject/automationBeta/automationData';
import { deleteSnippet } from '../../allObjectFolder/src/createObject/snippets/snippetData';
import { removeSessionReferencesForEntities } from '../../allObjectFolder/src/createObject/session/sessionReferenceUtils';
import { db } from '../../storage/indexDB/dbConfig';
import { useUIStore } from '../uiStateManager';

export type ItemDeleteResult =
  | { status: 'skipped' }
  | { status: 'deleted' }
  | { status: 'deleted-locally'; error: unknown };

const resetDeleteStatusLater = () => {
  setTimeout(() => {
    useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
  }, 3000);
};

const deleteByDetail = async (detail: SnippetActionDetail) => {
  if (detail.commandId === 'delete_folder') {
    await deleteSnippet(detail.snippetId);
  } else if (detail.snippetId.startsWith('note_')) {
    await deleteNote(detail.snippetId);
  } else if (
    detail.snippetId.startsWith('link_') ||
    detail.snippetId.startsWith('bookmark_') ||
    (detail.commandId as string) === 'delete_link'
  ) {
    await deleteLink(detail.snippetId);
  } else if (detail.snippetId.startsWith('todo_') || (detail.commandId as string) === 'delete_todo') {
    await deleteTodo(detail.snippetId);
    window.dispatchEvent(new CustomEvent('todosUpdated'));
  } else if (detail.snippetId.startsWith('session_') || (detail.commandId as string) === 'delete_session') {
    await deleteSession(detail.snippetId);
  } else if (
    detail.snippetId.startsWith('prompt_') ||
    detail.snippetId.startsWith('aiPrompt_') ||
    (detail.commandId as string) === 'delete_prompt'
  ) {
    await deleteAiPrompt(detail.snippetId);
  } else if (
    detail.snippetId.startsWith('agent_') ||
    detail.snippetId.startsWith('chatAgent_') ||
    (detail.commandId as string) === 'delete_agent'
  ) {
    await deleteChatAgent(detail.snippetId);
  } else if (detail.snippetId.startsWith('automation_') || (detail.commandId as string) === 'delete_automation') {
    await deleteAutomation(detail.snippetId);
  } else {
    await deleteSnippet(detail.snippetId);
  }
};

const deleteLocally = async (snippetId: string) => {
  await db.notes.delete(snippetId);
  await db.links.delete(snippetId);
  await db.snippets.delete(snippetId);
  await db.todos.delete(snippetId);
  await db.sessions.delete(snippetId);
  await db.aiPrompts.delete(snippetId);
  await db.chatAgents.delete(snippetId);
  await db.automations.delete(snippetId);
  await removeSessionReferencesForEntities([
    { type: 'note', id: snippetId },
    { type: 'link', id: snippetId },
    { type: 'snippet', id: snippetId },
    { type: 'agent', id: snippetId },
  ]);
  window.dispatchEvent(new CustomEvent('todosUpdated'));
};

export const executeItemDelete = async (
  detail: SnippetActionDetail | null | undefined,
  debugLabel = 'executeItemDelete',
): Promise<ItemDeleteResult> => {
  if (!detail?.snippetId) return { status: 'skipped' };
  const deleteLabel = detail.snippetKey || (detail as any).key || detail.snippetId;

  useUIStore.getState().setCommandStatus({
    status: 'loading',
    message: `Deleting "${deleteLabel}"...`,
  });

  try {
    await deleteByDetail(detail);
    useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted successfully' });
    resetDeleteStatusLater();
    return { status: 'deleted' };
  } catch (error) {
    console.error(`[${debugLabel}] Delete failed, performing local fallback delete:`, error);

    try {
      await deleteLocally(detail.snippetId);
    } catch (localErr) {
      console.error(`[${debugLabel}] Local fallback delete failed:`, localErr);
    }

    useUIStore.getState().setCommandStatus({ status: 'success', message: 'Deleted locally' });
    resetDeleteStatusLater();
    return { status: 'deleted-locally', error };
  }
};
