import { WEBSITE_POPUP_ENTITY_SOURCES, type WebsitePopupStoredRecord } from '../../../src/shared-components/websitePopup/websitePopupEntityRecords';
import { getUrlIdentity, requireHttpUrl } from '../../../src/shared-components/utils/urlIdentity';
/** Saves an ordinary popup result through the existing entity update functions. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { requireWebCollectionAssignmentTarget } from '../../../src/allObjectFolder/src/createObject/collections/collectionAssignmentData';
import { updateNote } from '../../../src/allObjectFolder/src/createObject/notes/noteData';
import { updateLink } from '../../../src/allObjectFolder/src/createObject/links/linkData';
import { updateSnippet } from '../../../src/allObjectFolder/src/createObject/snippets/snippetData';
import { updateTodoContent } from '../../../src/allObjectFolder/src/createObject/todos/todoData';
import { updateAiPrompt } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { updateChatAgent } from '../../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { updateSession } from '../../../src/allObjectFolder/src/createObject/session/sessionData';
import type { LinkItem } from '../../../src/allObjectFolder/src/createObject/links/linkTypes';
import type { TodoRecord, TodoReference } from '../../../src/allObjectFolder/src/createObject/todos/todoTypes';
import type { WebsitePopupEntityKind, WebsitePopupTextCommandTargetEntity, WebsitePopupResultEditChanges } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { extractSnippetIdFromCompoundId, getItemCompoundId } from '../../../src/shared-components/utils/idGenerator';
import { addFavoriteRecord, removeFavoriteRecord } from '../../../src/shared-components/favorites/favoriteData';
import { getAllUserHotkeys, saveUserHotkeyGuarded, deleteUserHotkeyByReference } from '../../../src/shared-components/hotkeys/core/hotkeyDbData';
import { normalizeHotkeyString } from '../../../src/shared-components/hotkeys/core/eventParser';
import type { HotkeyReferenceType } from '../../../src/shared-components/hotkeys/core/hotkeyDbTypes';
import type { WebsitePopupHotkeyConflict } from '../../../src/shared-components/websitePopup/contracts/websitePopupHotkeyBridgeContract';
import { assertWebsitePopupHotkeyAvailable } from './websitePopupHotkeyBridgeHandler';
import { serializeWebsitePopupAgentModels } from '../../../src/shared-components/websitePopup/websitePopupModelSelection';
import { DEFAULT_AI_PROMPT_MODEL_URLS, DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';

const favoriteReference = async (entity: WebsitePopupEntityKind, targetId: string) => {
  const record = entity === 'bookmark' ? (await chrome.bookmarks.get(targetId))[0]
    : await (entity === 'collection' ? db.workspaceSessions.get(targetId) : db.table<WebsitePopupStoredRecord, string>(WEBSITE_POPUP_ENTITY_SOURCES[entity].table).get(targetId));
  if (!record || ('deletedAt' in record && record.deletedAt != null)) {
    throw new Error('This item no longer exists.');
  }
  return { referenceId: getItemCompoundId(record), title: String('title' in record ? record.title : 'name' in record ? record.name : '') };
};

export async function getWebsitePopupResultFavorite(entity: WebsitePopupEntityKind, targetId: string) {
  const { referenceId } = await favoriteReference(entity, targetId);
  const favorite = await db.favorites.where('[user_id+reference_id]')
    .equals(['local_user', referenceId]).first();
  return Boolean(favorite);
}

export async function setWebsitePopupResultFavorite(entity: WebsitePopupEntityKind, targetId: string, favorite: boolean) {
  const { referenceId, title } = await favoriteReference(entity, targetId);
  if (favorite) await addFavoriteRecord('local_user', referenceId, entity, title);
  else await removeFavoriteRecord('local_user', referenceId);
  return favorite;
}

export async function syncWebsitePopupResultFavoriteLabel(
  entity: WebsitePopupEntityKind, targetId: string, title: string,
) {
  const { referenceId } = await favoriteReference(entity, targetId);
  const favorite = await db.favorites.where('[user_id+reference_id]')
    .equals(['local_user', referenceId]).first();
  if (!favorite || favorite.label === title) return false;
  await db.favorites.update(favorite.id, { label: title, updatedAt: Date.now() });
  return true;
}

const hotkeyReference = async (entity: WebsitePopupTextCommandTargetEntity, targetId: string) => {
  if (entity === 'webCollection') await requireWebCollectionAssignmentTarget(targetId);
  const referenceId = entity === 'webCollection' ? targetId : (await favoriteReference(entity, targetId)).referenceId;
  const existing = (await getAllUserHotkeys('local_user')).find(record =>
    (record.referenceType === entity
      || (entity === 'prompt' && record.referenceType === 'aiPrompt')
      || (entity === 'collection' && record.referenceType === 'session'))
    && (record.referenceId === referenceId
      || extractSnippetIdFromCompoundId(record.referenceId) === targetId));
  return { referenceId: existing?.referenceId || referenceId, existing };
};

export async function getWebsitePopupResultHotkey(entity: WebsitePopupTextCommandTargetEntity, targetId: string) {
  const { existing } = await hotkeyReference(entity, targetId);
  return existing?.combination || '';
}

export async function setWebsitePopupResultHotkey(
  entity: WebsitePopupTextCommandTargetEntity,
  targetId: string,
  value: string,
  approval?: WebsitePopupHotkeyConflict,
) {
  const { referenceId } = await hotkeyReference(entity, targetId);
  if (!value.trim()) {
    await deleteUserHotkeyByReference(referenceId);
    return '';
  }
  const normalized = normalizeHotkeyString(value);
  await assertWebsitePopupHotkeyAvailable(normalized, approval, referenceId);
  const referenceType: HotkeyReferenceType = entity === 'prompt' ? 'aiPrompt' : entity;
  await saveUserHotkeyGuarded(normalized, referenceId, referenceType, approval || null);
  return normalized;
}

const normalizedUrl = requireHttpUrl;

const mapLinks = (draft: NonNullable<WebsitePopupResultEditChanges['urls']>, existing: LinkItem[]): LinkItem[] => {
  const seen = new Set<string>();
  return draft.map((item, index) => {
    const url = normalizedUrl(item.url);
    if (seen.has(url)) throw new Error('Remove duplicate URLs before saving.');
    seen.add(url);
    const original = existing.find(candidate => candidate.id === item.id || getUrlIdentity(candidate.url) === getUrlIdentity(item.url));
    const sameUrl = Boolean(original
      && getUrlIdentity(original.url) === getUrlIdentity(url));
    return {
      ...(sameUrl && original ? original : {}),
      id: original?.id || item.id || `url:${index}:${url}`,
      title: item.title?.trim() || (sameUrl ? original?.title : undefined) || url,
      url: sameUrl && original ? original.url : url,
      source: (sameUrl ? original?.source || 'custom' : 'custom') as LinkItem['source'],
      favIconUrl: sameUrl ? original?.favIconUrl || item.favIconUrl : undefined,
    };
  });
};

export async function updateWebsitePopupResultEntity(
  entity: WebsitePopupEntityKind,
  targetId: string,
  expectedUpdatedAt: number | undefined,
  changes: WebsitePopupResultEditChanges,
  expectedBookmark?: { title: string; url: string },
): Promise<string> {
  if (!targetId) throw new Error('Choose an item to edit.');
  if (!changes.title.trim()) throw new Error('Title is required.');

  if (entity === 'bookmark') {
    const nodes = await chrome.bookmarks.get(targetId);
    if (!nodes[0]?.url) throw new Error('Bookmark no longer exists.');
    if (expectedBookmark && (nodes[0].title !== expectedBookmark.title || nodes[0].url !== expectedBookmark.url)) {
      throw new Error('This bookmark changed elsewhere. Reopen its editor to review the latest values.');
    }
    const url = changes.urls ? normalizedUrl(changes.urls[0]?.url || '') : nodes[0].url;
    await chrome.bookmarks.update(targetId, { title: changes.title.trim(), url });
    return 'bookmarks';
  }

  const current = await (entity === 'collection' ? db.workspaceSessions.get(targetId) : db.table<WebsitePopupStoredRecord, string>(WEBSITE_POPUP_ENTITY_SOURCES[entity].table).get(targetId));
  if (!current || ('deletedAt' in current && current.deletedAt != null)) {
    throw new Error('This item no longer exists. Reopen the search result.');
  }
  if (expectedUpdatedAt !== undefined && current.updatedAt !== expectedUpdatedAt) {
    throw new Error('This item changed elsewhere. Close and reopen its editor to review the latest values.');
  }

  if (entity === 'note') {
    await updateNote(targetId, {
      title: changes.title,
      ...(changes.content !== undefined ? { body: changes.content } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
      expectedUpdatedAt,
    });
    return 'notes';
  }
  if (entity === 'link') {
    if (changes.urls && !changes.urls.length) throw new Error('A Link needs at least one URL.');
    const link = current as Awaited<ReturnType<typeof db.links.get>>;
    await updateLink(targetId, {
      title: changes.title,
      ...(changes.urls !== undefined ? { urls: mapLinks(changes.urls, link?.urls ?? []) } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
      expectedUpdatedAt,
    });
    return 'links';
  }
  if (entity === 'snippet') {
    const snippet = current as Awaited<ReturnType<typeof db.snippets.get>>;
    let config: string | Record<string, unknown> | undefined = changes.content;
    if (changes.content !== undefined && snippet && typeof snippet.config !== 'string') {
      try {
        const parsed = JSON.parse(changes.content ?? '');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        config = parsed;
      } catch {
        throw new Error('The structured Text Expander content must be a JSON object.');
      }
    }
    await updateSnippet(targetId, {
      expectedUpdatedAt,
      title: changes.title,
      ...(config !== undefined ? { config } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
    });
    return 'snippets';
  }
  if (entity === 'todo') {
    const todo = current as TodoRecord;
    if (changes.scheduleTime !== undefined && !Number.isFinite(changes.scheduleTime)) {
      throw new Error('Choose a valid time.');
    }
    if ((changes.scheduleType ?? todo.scheduleType) === 'recurring'
      && !(changes.scheduleTime ?? todo.scheduleTime)) {
      throw new Error('Choose a time for the recurring task.');
    }
    await updateTodoContent(targetId, {
      expectedUpdatedAt,
      name: changes.title,
      ...(changes.content !== undefined ? { description: changes.content } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
      ...(changes.scheduleType !== undefined ? { scheduleType: changes.scheduleType,
        recurringType: changes.scheduleType === 'recurring' ? changes.recurringType : undefined } : {}),
      ...(changes.scheduleTime !== undefined ? { scheduleTime: changes.scheduleTime } : {}),
      ...(changes.isDone !== undefined ? { isDone: changes.isDone } : {}),
      ...(changes.references !== undefined ? { references: changes.references.map(reference => ({
        type: reference.type as TodoReference['type'], id: reference.id, name: reference.name,
      })) } : {}),
    });
    return 'todos';
  }
  if (entity === 'prompt') {
    if (changes.modelUrls !== undefined || changes.customModels !== undefined || changes.enabledModelIds !== undefined) {
      const prompt = current as NonNullable<Awaited<ReturnType<typeof db.aiPrompts.get>>>;
      serializeWebsitePopupAgentModels({
        enabledModelIds: changes.enabledModelIds ?? prompt.enabledModelIds ?? DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS,
        customModels: changes.customModels ?? prompt.customModels ?? [],
        modelUrls: { ...DEFAULT_AI_PROMPT_MODEL_URLS, ...(changes.modelUrls ?? prompt.modelUrls ?? {}) },
      });
    }
    await updateAiPrompt(targetId, {
      expectedUpdatedAt,
      title: changes.title,
      ...(changes.content !== undefined ? { prompt: changes.content } : {}),
      ...(changes.rules !== undefined ? { rules: changes.rules } : {}),
      ...(changes.modelUrls !== undefined ? { modelUrls: changes.modelUrls } : {}),
      ...(changes.customModels !== undefined ? { customModels: changes.customModels } : {}),
      ...(changes.enabledModelIds !== undefined ? { enabledModelIds: changes.enabledModelIds } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
    });
    return 'aiPrompts';
  }
  if (entity === 'agent') {
    await updateChatAgent(targetId, {
      expectedUpdatedAt,
      title: changes.title,
      ...(changes.content !== undefined ? { prompt: changes.content } : {}),
      ...(changes.tagIds !== undefined ? { tagIds: changes.tagIds } : {}),
      ...(changes.urls !== undefined ? { urls: changes.urls.map(item => normalizedUrl(item.url)) } : {}),
    });
    return 'chatAgents';
  }
  const session = current as Awaited<ReturnType<typeof db.workspaceSessions.get>>;
  await updateSession(targetId, {
    title: changes.title,
    ...(changes.urls !== undefined ? { urls: mapLinks(changes.urls, session?.urls ?? []) } : {}),
    expectedUpdatedAt,
  });
  return 'workspaces';
}
