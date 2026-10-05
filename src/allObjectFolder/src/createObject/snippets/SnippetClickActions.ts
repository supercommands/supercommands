import type { SnippetRecord } from './snippetTypes';
type Snippet = SnippetRecord & {
    value?: string | {
        urls?: string[];
        names?: string[];
    };
};
type Organisation = {
    id?: string;
    organisation_id?: string;
    organisationName?: string;
    organisation_name?: string;
};
export type SnippetSuggestion = {
    snippet: Snippet;
    organisation: Organisation;
};
export type SnippetActionDetail = {
    snippetId: string;
    snippetKey: string;
    id?: string;
    key?: string;
    category: string | null | undefined;
    organisationId: string;
    organisationName?: string;
    orgId?: string;
    commandId: 'delete_snippet' | 'delete_link' | 'delete_todo' | 'delete_session' | 'delete_prompt' | 'delete_agent';
};
/**
 * Strips HTML tags from a string and returns plain text content.
 * Example: "<p>Hello</p>" -> "Hello"
 */
const stripHtmlTags = (html: string): string => {
    if (!html)
        return '';
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
    if (['session', 'sessions', 'tab session'].includes(cat))
        return 'session';
    if (['link', 'links', 'tabgroup'].includes(cat))
        return 'link';
    return 'note';
};
// Centralized Action Resolver for Unified Node System
export type NodeActionKind = 'view_note' | 'edit_link' | 'open_multiple_links';
export const resolvePrimaryAction = (category: string | null | undefined): NodeActionKind => {
    const cat = String(category || '').toLowerCase();
    if (['session', 'sessions', 'tab session'].includes(cat))
        return 'open_multiple_links';
    if (['link', 'links', 'tabgroup'].includes(cat))
        return 'edit_link';
    return 'view_note';
};
export const buildSnippetDeleteDetail = (suggestion: SnippetSuggestion, itemKind: 'note' | 'link' | 'session'): SnippetActionDetail | null => {
    const snippet = suggestion.snippet;
    const organisation = suggestion.organisation;
    const snippetId = snippet.id || (snippet as any).snippet_id;
    if (!snippetId)
        return null;
    let commandId: 'delete_snippet' | 'delete_link' = 'delete_snippet';
    if (itemKind === 'link' || itemKind === 'session')
        commandId = 'delete_link';
    return {
        snippetId,
        snippetKey: (snippet as any).key || snippet.id || (snippet as any).snippet_id,
        category: (snippet as any).category || (snippet as any).kind || 'note',
        organisationId: (organisation.organisation_id as string) || (organisation as any).id,
        organisationName: organisation.organisation_name || (organisation as any).name,
        commandId,
    };
};
export const getSnippetPreview = (snippet: Snippet): string => {
    if (!snippet?.value)
        return '';
    if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        if (!raw)
            return '';
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                if (Array.isArray((parsed as any).urls)) {
                    const urls = (parsed as any).urls as string[];
                    if (urls.length === 0)
                        return 'No tabs added';
                    return urls.slice(0, 2).join(', ');
                }
                if (typeof (parsed as any).note === 'string') {
                    const noteContent = (parsed as any).note as string;
                    const cleanNote = stripHtmlTags(noteContent);
                    return cleanNote.length > 140 ? `${cleanNote.slice(0, 137)}…` : cleanNote;
                }
                if (Array.isArray(parsed)) {
                    const texts = parsed
                        .map((b: any) => (typeof b === 'object' && b ? b.value || b.text || b.content || '' : String(b || '')))
                        .filter(Boolean);
                    const cleanBlockText = stripHtmlTags(texts.join(' '));
                    return cleanBlockText.length > 140 ? `${cleanBlockText.slice(0, 137)}…` : cleanBlockText;
                }
            }
        }
        catch {
            // fall through to raw string
        }
        const cleanRaw = stripHtmlTags(raw);
        return cleanRaw.length > 140 ? `${cleanRaw.slice(0, 137)}…` : cleanRaw;
    }
    if (typeof snippet.value === 'object' && snippet.value) {
        if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
            const urls = (snippet.value as any).urls as string[];
            if (urls.length === 0)
                return 'No tabs added';
            return urls.slice(0, 2).join(', ');
        }
        if ('names' in snippet.value && Array.isArray((snippet.value as any).names)) {
            return ((snippet.value as any).names as string[]).slice(0, 2).join(', ');
        }
    }
    return '';
};
export const extractUrlsFromSnippet = (snippet: Snippet): string[] => {
    if (!snippet?.value)
        return [];
    if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        if (!raw)
            return [];
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).urls)) {
                return ((parsed as any).urls as string[]).filter(Boolean);
            }
        }
        catch {
            if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat'))
                return [raw];
        }
        if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat'))
            return [raw];
        return [];
    }
    if (typeof snippet.value === 'object' && snippet.value) {
        if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
            return ((snippet.value as any).urls as string[]).filter(Boolean);
        }
    }
    return [];
};
export const buildSuggestionKey = (organisation: Organisation, snippet: Snippet, index: number): string => {
    const snippetId = snippet.id || (snippet as any).snippet_id;
    if (snippetId)
        return snippetId;
    return `${(organisation as any).organisation_id}-${null}${(snippet as any).key || snippet.id || 'snippet'}-${index}`;
};
export const buildSnippetSuggestion = (organisation: Organisation, snippet: Snippet): SnippetSuggestion => ({
    snippet,
    organisation,
});
