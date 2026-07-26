import type { EditorType } from '../../../../../shared-components/uiStateManager/types';
import type { AiPromptRecord } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { LinkRecord } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { NoteRecord } from '../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../../../allObjectFolder/src/createObject/session/sessionTypes';
import type { SnippetRecord } from '../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../../../allObjectFolder/src/createObject/todos/todoTypes';
import type { FolderData } from '../../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { WorkspaceData } from '../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';

export type EditorItemsKind = 'link' | 'session' | 'note' | 'snippet' | 'aiPrompt' | 'todo' | 'folder' | 'workspace';

export type EditorItemsRecord =
  | LinkRecord
  | SessionRecord
  | NoteRecord
  | SnippetRecord
  | AiPromptRecord
  | TodoRecord
  | FolderData
  | WorkspaceData;

export type EditorItemsRow = {
  item: EditorItemsRecord;
  kind: EditorItemsKind;
};

export type ActiveEditorLike = {
  type: EditorType;
  id: string;
  isNew?: boolean;
  readOnly?: boolean;
  props?: any;
} | null;

const KIND_BY_EDITOR: Partial<Record<EditorType, EditorItemsKind>> = {
  link: 'link',
  session: 'session',
  note: 'note',
  snippet: 'snippet',
  aiPrompt: 'aiPrompt',
  todo: 'todo',
};

export const resolveEditorItemsKind = (editorType: string | null | undefined): EditorItemsKind | null => {
  if (!editorType) return null;
  if (editorType === 'folder') return 'folder';
  if (editorType === 'workspace') return 'workspace';
  return KIND_BY_EDITOR[editorType as EditorType] ?? null;
};

export const resolveEditorItemsKindFromActiveEditor = (activeEditor: ActiveEditorLike | any): EditorItemsKind | null =>
  resolveEditorItemsKind(activeEditor?.type ?? null);

export const getEditorItemsLabel = (kind: EditorItemsKind | null) => {
  if (kind === 'link') return 'All links';
  if (kind === 'session') return 'All sessions';
  if (kind === 'note') return 'All notes';
  if (kind === 'snippet') return 'All snippets';
  if (kind === 'aiPrompt') return 'All prompts';
  if (kind === 'todo') return "All To Do's";
  if (kind === 'folder') return 'All Folders';
  if (kind === 'workspace') return 'All Organizations';
  return '';
};

export const getEditorItemsEmptyState = (kind: EditorItemsKind | null) => {
  if (kind === 'link') return 'No link items found.';
  if (kind === 'session') return 'No session items found.';
  if (kind === 'note') return 'No note items found.';
  if (kind === 'snippet') return 'No snippet items found.';
  if (kind === 'aiPrompt') return 'No AI prompt items found.';
  if (kind === 'todo') return 'No To Do items found.';
  if (kind === 'folder') return 'No Folders found.';
  if (kind === 'workspace') return 'No Organizations found.';
  return 'No related items found.';
};

export const getEditorItemsId = (
  item: (Partial<EditorItemsRecord> & { snippet_id?: string; folder_id?: string; workspace_id?: string }) | any,
) => item?.id || item?.snippet_id || item?.folder_id || item?.workspace_id || '';

export const getEditorItemsTitle = (item: Partial<EditorItemsRecord> | any) =>
  item?.title || item?.name || item?.label || item?.key || item?.folderName || item?.workspaceName || 'Untitled';

export const isInSelectedScope = (
  item: (Partial<EditorItemsRecord> & { workspace_id?: string; folder_id?: string | null }) | any,
  selectedWorkspaceId: string | null,
  selectedFolderId: string | null,
) => {
  const workspaceId = item?.workspaceId || item?.workspace_id || null;
  const folderId = item?.folderId || item?.folder_id || null;
  if (selectedWorkspaceId && workspaceId && workspaceId !== selectedWorkspaceId) return false;
  if (selectedFolderId && folderId && folderId !== selectedFolderId) return false;
  return true;
};
