import { getUrlIdentity } from '../../../src/shared-components/utils/urlIdentity';
import { escapeHtml } from '../../../src/shared-components/utils/escapeHtml';
/**
 * Background-owned Save-current-page adapters for Website Popup.
 *
 * The content script supplies only a page title and external URL. This module
 * reads current records and applies the entity-specific mutation through the
 * domain layer; it never imports legacy website-popup UI or state.
 */
import { getAiPrompt, updateAiPrompt } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { deleteLink, getLink, createLink, updateLink } from '../../../src/allObjectFolder/src/createObject/links/linkData';
import { getNote, updateNote } from '../../../src/allObjectFolder/src/createObject/notes/noteData';
import { getSnippet, updateSnippet } from '../../../src/allObjectFolder/src/createObject/snippets/snippetData';
import { getTodo, updateTodoContent } from '../../../src/allObjectFolder/src/createObject/todos/todoData';
import { getSession, updateSession } from '../../../src/allObjectFolder/src/createObject/session/sessionData';
import { generateEntityId } from '../../../src/shared-components/utils/idGenerator';
import type {
  WebsitePopupPageReference,
  WebsitePopupSaveTargetEntity,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';

export type WebsitePopupSavedPageResult = {
  entity: WebsitePopupSaveTargetEntity;
  targetId: string;
  title: string;
  changed: boolean;
  changedTables: Array<'notes' | 'links' | 'todos' | 'snippets' | 'aiPrompts' | 'workspaces' | 'organisations'>;
};

const normalizeUrl = getUrlIdentity;

const normalizePage = (page: WebsitePopupPageReference): WebsitePopupPageReference => {
  const url = String(page.url || '').trim();
  const ownNewTabUrl = chrome.runtime.getURL('AltS_search_newtab/index.html');
  if (!/^https?:\/\//i.test(url) && url !== ownNewTabUrl) {
    throw new Error('Only external HTTP(S) pages or the SuperCommands new tab can be saved.');
  }
  return {
    url,
    title: String(page.title || '').trim() || url,
  };
};

const pageText = (page: WebsitePopupPageReference) => `${page.title}\n${page.url}`;

const appendPlainPageText = (currentValue: string, page: WebsitePopupPageReference) => currentValue.trim()
  ? `${currentValue.trimEnd()}\n\n${pageText(page)}`
  : pageText(page);

const appendNotePageLink = (currentBody: string, page: WebsitePopupPageReference) => {
  const link = `<p><a href="${escapeHtml(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.title)}</a></p>`;
  if (!currentBody.trim()) return link;
  return `${currentBody}${currentBody.endsWith('</p>') ? '' : '<p><br></p>'}${link}`;
};

export async function saveWebsitePopupPageToEntity(
  entity: WebsitePopupSaveTargetEntity,
  targetId: string,
  pageReference: WebsitePopupPageReference,
): Promise<WebsitePopupSavedPageResult> {
  const page = normalizePage(pageReference);

  if (entity === 'collection') {
    const session = await getSession(targetId);
    if (!session || (session.deletedAt !== null && session.deletedAt !== undefined))
      throw new Error('The selected Collection no longer exists.');
    const currentUrls = Array.isArray(session.urls) ? session.urls : [];
    if (currentUrls.some(item => normalizeUrl(item.url) === normalizeUrl(page.url))) {
      return { entity, targetId, title: session.title || 'Untitled Collection', changed: false, changedTables: [] };
    }
    const saved = await updateSession(targetId, {
      expectedUpdatedAt: session.updatedAt,
      urls: [...currentUrls, {
        id: generateEntityId('linkItem'),
        title: page.title,
        name: page.title,
        url: page.url,
        source: 'tab',
      }],
    });
    return { entity, targetId, title: saved.title || session.title || 'Untitled Collection', changed: true, changedTables: ['workspaces'] };
  }

  if (entity === 'note') {
    const note = await getNote(targetId);
    if (!note) throw new Error('The selected note no longer exists.');
    if (String(note.body || '').includes(page.url)) {
      return { entity, targetId, title: note.title || 'Untitled Note', changed: false, changedTables: [] };
    }
    const saved = await updateNote(targetId, { body: appendNotePageLink(String(note.body || ''), page) });
    return { entity, targetId, title: saved.title || note.title || 'Untitled Note', changed: true, changedTables: ['notes'] };
  }

  if (entity === 'snippet') {
    const snippet = await getSnippet(targetId);
    if (!snippet) throw new Error('The selected text expander no longer exists.');
    const currentText = typeof snippet.config === 'string'
      ? snippet.config
      : JSON.stringify(snippet.config || '');
    if (currentText.includes(page.url)) {
      return { entity, targetId, title: snippet.title || 'Untitled Text Expander', changed: false, changedTables: [] };
    }
    const saved = await updateSnippet(targetId, { config: appendPlainPageText(currentText, page) });
    return { entity, targetId, title: saved.title || snippet.title || 'Untitled Text Expander', changed: true, changedTables: ['snippets'] };
  }

  if (entity === 'prompt') {
    const prompt = await getAiPrompt(targetId);
    if (!prompt) throw new Error('The selected AI Prompt no longer exists.');
    if (String(prompt.prompt || '').includes(page.url)) {
      return { entity, targetId, title: prompt.title || 'Untitled AI Prompt', changed: false, changedTables: [] };
    }
    const saved = await updateAiPrompt(targetId, { prompt: appendPlainPageText(String(prompt.prompt || ''), page) });
    return { entity, targetId, title: saved.title || prompt.title || 'Untitled AI Prompt', changed: true, changedTables: ['aiPrompts'] };
  }

  if (entity === 'link') {
    const link = await getLink(targetId);
    if (!link) throw new Error('The selected Link no longer exists.');
    const currentUrls = Array.isArray(link.urls) ? link.urls : [];
    if (currentUrls.some(item => normalizeUrl(item.url) === normalizeUrl(page.url))) {
      return { entity, targetId, title: link.title || 'Untitled Link', changed: false, changedTables: [] };
    }
    const saved = await updateLink(targetId, {
      urls: [...currentUrls, {
        id: generateEntityId('linkItem'),
        title: page.title,
        name: page.title,
        url: page.url,
        source: 'tab',
      }],
    });
    return { entity, targetId, title: saved.title || link.title || 'Untitled Link', changed: true, changedTables: ['links'] };
  }

  const todo = await getTodo(targetId);
  if (!todo) throw new Error('The selected Todo no longer exists.');
  const references = Array.isArray(todo.references) ? todo.references : [];
  const referencedLinks = await Promise.all(references
    .filter(reference => reference.type === 'link' && reference.id)
    .map(reference => getLink(reference.id)));
  if (referencedLinks.some(link => link?.urls.some(item => normalizeUrl(item.url) === normalizeUrl(page.url)))) {
    return { entity, targetId, title: todo.name || 'Untitled Todo', changed: false, changedTables: [] };
  }

  const createdLink = await createLink({
    organisationId: todo.organisationId,
    
    title: page.title,
    urls: [{
      id: generateEntityId('linkItem'),
      title: page.title,
      name: page.title,
      url: page.url,
      source: 'tab',
    }],
  });
  try {
    await updateTodoContent(targetId, {
      references: [...references, { type: 'link', id: createdLink.id, name: createdLink.title }],
    });
  } catch (error) {
    await deleteLink(createdLink.id).catch(() => undefined);
    throw error;
  }
  return {
    entity,
    targetId,
    title: todo.name || 'Untitled Todo',
    changed: true,
    changedTables: ['links', 'todos'],
  };
}
