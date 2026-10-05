/**
 * @file workspaceItemTypes.ts
 * @description Defines the union type `WorkspaceItem` representing all record entities
 * within the workspace, along with type guards to identify specific record variants.
 *
 * @usage
 * ```ts
 * import type { WorkspaceItem } from './workspaceItemTypes';
 * import { isNoteRecord } from './workspaceItemTypes';
 * if (isNoteRecord(item)) { ... }
 * ```
 */
import type { SnippetRecord } from './snippets/snippetTypes';
import type { NoteRecord } from './notes/noteTypes';
import type { LinkRecord } from './links/linkTypes';
import type { SessionRecord } from './session/sessionTypes';
import type { ChatAgentRecord } from './ChatAgent/chatAgentTypes';
import type { AiPromptRecord } from './aiPrompt/aiPromptTypes';
import type { TodoRecord } from './todos/todoTypes';
import type { CommandRecord } from './commands/commandTypes';
// A union type that encompasses all specific object types in the workspace.
// This replaces the legacy `Snippet` catch-all interface.
export type WorkspaceItem = SnippetRecord | NoteRecord | LinkRecord | SessionRecord | ChatAgentRecord | AiPromptRecord | TodoRecord | CommandRecord;
export const isSnippetRecord = (item: any): item is SnippetRecord => {
    return item && 'config' in item && 'title' in item && !('urls' in item) && !('body' in item);
};
export const isNoteRecord = (item: any): item is NoteRecord => {
    return item && 'body' in item && 'title' in item;
};
export const isLinkRecord = (item: any): item is LinkRecord => {
    return item && 'urls' in item && 'title' in item;
};
