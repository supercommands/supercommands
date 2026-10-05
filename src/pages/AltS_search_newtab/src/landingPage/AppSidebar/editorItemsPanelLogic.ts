import type { EditorType } from '../../../../../shared-components/uiStateManager/types';
import type { AiPromptRecord } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { LinkRecord } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { NoteRecord } from '../../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../../../allObjectFolder/src/createObject/session/sessionTypes';
import type { SnippetRecord } from '../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../../../allObjectFolder/src/createObject/todos/todoTypes';
import type { OrganisationData } from '../../../../../settings/allOrganisationManager/organisations/organisationTypes';
export type EditorItemsKind = 'link' | 'session' | 'note' | 'snippet' | 'aiPrompt' | 'todo' | 'organisation';
export type EditorItemsRecord = LinkRecord | SessionRecord | NoteRecord | SnippetRecord | AiPromptRecord | TodoRecord | null | OrganisationData;
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
    if (!editorType)
        return null;
    if (editorType === 'organisation')
        return 'organisation';
    return KIND_BY_EDITOR[editorType as EditorType] ?? null;
};
export const resolveEditorItemsKindFromActiveEditor = (activeEditor: ActiveEditorLike | any): EditorItemsKind | null => resolveEditorItemsKind(activeEditor?.type ?? null);
export const getEditorItemsLabel = (kind: EditorItemsKind | null) => {
    if (kind === 'link')
        return 'All Links';
    if (kind === 'session')
        return 'All sessions';
    if (kind === 'note')
        return 'All Notes';
    if (kind === 'snippet')
        return 'All snippets';
    if (kind === 'aiPrompt')
        return 'All prompts';
    if (kind === 'todo')
        return 'All Todo';
    if (kind === 'organisation')
        return 'All Organisations';
    return '';
};
export const getEditorItemsEmptyState = (kind: EditorItemsKind | null) => {
    if (kind === 'link')
        return 'No link items found.';
    if (kind === 'session')
        return 'No session items found.';
    if (kind === 'note')
        return 'No note items found.';
    if (kind === 'snippet')
        return 'No snippet items found.';
    if (kind === 'aiPrompt')
        return 'No AI prompt items found.';
    if (kind === 'todo')
        return 'No Todo items found.';
    if (kind === 'organisation')
        return 'No Organisations found.';
    return 'No related items found.';
};
export const getEditorItemsId = (item: (Partial<EditorItemsRecord> & {
    snippet_id?: string;
    organisation_id?: string;
}) | any) => item?.id || item?.snippet_id || item?.organisation_id || '';
export const getEditorItemsTitle = (item: Partial<EditorItemsRecord> | any) => item?.title || item?.name || item?.label || item?.key || item?.organisationName || 'Untitled';
export const isInSelectedScope = (item: (Partial<EditorItemsRecord> & {
    organisation_id?: string;
}) | any, selectedOrganisationId: string | null) => {
    const organisationId = item?.organisationId || item?.organisation_id;
    if (selectedOrganisationId && organisationId && organisationId !== selectedOrganisationId)
        return false;
    return true;
};
