import type { SnippetRecord } from './snippetTypes';
type Snippet = SnippetRecord & {
  value?: string | { urls?: string[]; names?: string[] };
};
type Folder = { id?: string; folder_id?: string; folderName?: string; folder_name?: string };
type Workspace = { id?: string; workspace_id?: string; workspaceName?: string; workspace_name?: string; folders?: Folder[] };

export type SnippetSuggestion = {
  snippet: Snippet;
  workspace: Workspace;
  folder: Folder | null;
};

export type SnippetActionDetail = {
  snippetId: string;
  snippetKey: string;
  id?: string;
  key?: string;
  category: string | null | undefined;
  workspaceId: string;
  workspaceName?: string;
  folderId?: string | null;
  folderName?: string | null;
  orgId?: string;
  commandId:
    | 'delete_snippet'
    | 'delete_link'
    | 'delete_folder'
    | 'delete_todo'
    | 'delete_session'
    | 'delete_prompt'
    | 'delete_agent'
    | 'delete_automation';
};

/**
 * Strips HTML tags from a string and returns plain text content.
 * Example: "<p>Hello</p>" -> "Hello"
 */
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  // Remove HTML tags and decode common HTML entities
  return html
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode ampersand
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotes
    .replace(/&#39;/g, "'") // Decode single quotes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export const resolveSnippetIcon = (category: string | null | undefined): 'note' | 'link' | 'session' => {
  const cat = String(category || '').toLowerCase();
  if (['session', 'sessions', 'tab session'].includes(cat)) return 'session';
  if (['link', 'links', 'tabgroup'].includes(cat)) return 'link';
  return 'note';
};

// Centralized Action Resolver for Unified Node System
export type NodeActionKind = 'view_note' | 'edit_link' | 'open_multiple_links';

export const resolvePrimaryAction = (category: string | null | undefined): NodeActionKind => {
  const cat = String(category || '').toLowerCase();
  if (['session', 'sessions', 'tab session'].includes(cat)) return 'open_multiple_links';
  if (['link', 'links', 'tabgroup'].includes(cat)) return 'edit_link';
  return 'view_note';
};

export const buildSnippetDeleteDetail = (
  suggestion: SnippetSuggestion,
  itemKind: 'note' | 'link' | 'session',
): SnippetActionDetail | null => {
  const snippet = suggestion.snippet;
  const workspace = suggestion.workspace;
  const folder = suggestion.folder;
  const snippetId = snippet.id || (snippet as any).snippet_id;
  if (!snippetId) return null;

  let commandId: 'delete_snippet' | 'delete_link' | 'delete_folder' = 'delete_snippet';
  if (itemKind === 'link' || itemKind === 'session') commandId = 'delete_link';

  return {
    snippetId,
    snippetKey: (snippet as any).key || snippet.id || (snippet as any).snippet_id,
    category: (snippet as any).category || (snippet as any).kind || 'note',
    workspaceId: (workspace.workspace_id as string) || (workspace as any).id,
    workspaceName: workspace.workspace_name || (workspace as any).name,
    folderId: folder?.folder_id ?? null,
    folderName: folder?.folder_name ?? null,
    commandId,
  };
};

export const getSnippetPreview = (snippet: Snippet): string => {
  if (!snippet?.value) return '';

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    if (!raw) return '';

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray((parsed as any).urls)) {
          return ((parsed as any).urls as string[]).slice(0, 2).join(', ');
        }
        if (typeof (parsed as any).note === 'string') {
          const noteContent = (parsed as any).note as string;
          const cleanNote = stripHtmlTags(noteContent);
          return cleanNote.length > 140 ? `${cleanNote.slice(0, 137)}…` : cleanNote;
        }
      }
    } catch {
      // fall through to raw string
    }

    // Strip HTML tags from raw content
    const cleanRaw = stripHtmlTags(raw);
    return cleanRaw.length > 140 ? `${cleanRaw.slice(0, 137)}…` : cleanRaw;
  }

  if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      return ((snippet.value as any).urls as string[]).slice(0, 2).join(', ');
    }
    if ('names' in snippet.value && Array.isArray((snippet.value as any).names)) {
      return ((snippet.value as any).names as string[]).slice(0, 2).join(', ');
    }
  }

  return '';
};

export const extractUrlsFromSnippet = (snippet: Snippet): string[] => {
  if (!snippet?.value) return [];

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).urls)) {
        return ((parsed as any).urls as string[]).filter(Boolean);
      }
    } catch {
      if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) return [raw];
    }
    if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) return [raw];
    return [];
  }

  if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      return ((snippet.value as any).urls as string[]).filter(Boolean);
    }
  }

  return [];
};

export const buildSuggestionKey = (
  workspace: Workspace,
  folder: Folder | null,
  snippet: Snippet,
  index: number,
): string => {
  const snippetId = snippet.id || (snippet as any).snippet_id;
  if (snippetId) return snippetId;
  const folderPart = folder ? `${folder.folder_id}-` : '';
  return `${(workspace as any).workspace_id}-${folderPart}${(snippet as any).key || snippet.id || 'snippet'}-${index}`;
};

export const buildSnippetSuggestion = (
  workspace: Workspace,
  folder: Folder | null,
  snippet: Snippet,
): SnippetSuggestion => ({
  snippet,
  workspace,
  folder,
});
