import { isWebsitePopupCreateFieldRequired } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { escapeHtml } from '../../../src/shared-components/utils/escapeHtml';
/**
 * Background-owned base Create adapters for Website Popup.
 *
 * These adapters translate the neutral structured popup draft into existing
 * domain creator inputs. Required fields, Link URLs, resolved Tag IDs, and
 * validated Todo schedule/attachment options are supported. Text Command and
 * Favorite are assigned separately by the execution bridge.
 */
import { createNote } from '../../../src/allObjectFolder/src/createObject/notes/noteData';
import { createLink } from '../../../src/allObjectFolder/src/createObject/links/linkData';
import { createTodo } from '../../../src/allObjectFolder/src/createObject/todos/todoData';
import { createSnippet } from '../../../src/allObjectFolder/src/createObject/snippets/snippetData';
import { createAiPrompt } from '../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { generateEntityId } from '../../../src/shared-components/utils/idGenerator';
import { db } from '../../../src/storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../src/storage/localStorage/lastUsedOrganisation';
import type { TagRecord } from '../../../src/allObjectFolder/src/createObject/tags/tagTypes';
import { getCreateComposerFieldCapabilities } from '../../../src/shared-components/commandTerminal/chaining/entityCreateFieldsRegistry';
import type {
  WebsitePopupBaseCreateDraft,
  WebsitePopupBaseCreateEntity,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import { resolveWebsitePopupTodoCreateOptions } from './websitePopupTodoCreateOptions';
import { createWebsitePopupModelSelection, serializeWebsitePopupAgentModels } from '../../../src/shared-components/websitePopup/websitePopupModelSelection';

const toNoteBody = (value: string) => String(value || '')
  .split(/\r?\n/)
  .map(line => `<p>${escapeHtml(line) || '<br>'}</p>`)
  .join('');

const resolveWebsitePopupCreateTagIds = async (draft: WebsitePopupBaseCreateDraft): Promise<string[]> => {
  const serializedTags = String(draft.fieldValues.tag || '').trim();
  const requestedIds = Array.from(new Set(
    (draft.selectedValuesByField?.tag || []).map(value => String(value.id || '').trim()).filter(Boolean),
  ));
  if (serializedTags && requestedIds.length === 0) {
    throw new Error('Choose tags from the Tag list before saving.');
  }
  if (requestedIds.length === 0) return [];

  const [records, organisation] = await Promise.all([
    db.tags.bulkGet(requestedIds),
    getSmartDefaultOrganisation(),
  ]);
  const organisationViewIds = new Set<string>(organisation
    ? (await db.workspaceViews.where('organisationId').equals(organisation.id).primaryKeys()).map(String)
    : []);
  const validTags = records.filter((tag): tag is TagRecord => tag !== undefined
    && (!tag.workspaceId || organisationViewIds.has(tag.workspaceId)));
  if (validTags.length !== requestedIds.length) {
    throw new Error('One or more selected tags are no longer available. Remove them and select again.');
  }
  return requestedIds;
};

const requiredValue = (draft: WebsitePopupBaseCreateDraft, field: string, label: string, entity: string) => {
  const value = String(draft.fieldValues[field] || '').trim();
  if (!value) throw new Error(`Add a ${label} before creating the ${entity === 'snippet' ? 'text expander' : entity}.`);
  return value;
};

export async function createWebsitePopupBaseEntity(
  entity: WebsitePopupBaseCreateEntity,
  draft: WebsitePopupBaseCreateDraft,
) {
  if (!['note', 'link', 'todo', 'snippet', 'agent'].includes(entity)) {
    throw new Error('Unsupported Website Popup Create entity.');
  }
  const requiredFields = getCreateComposerFieldCapabilities(entity)
    .filter(field => isWebsitePopupCreateFieldRequired(entity, field));
  requiredFields.forEach(field => requiredValue(draft, field.field, field.label, entity));
  const unsupportedOptions = getCreateComposerFieldCapabilities(entity)
    .filter(field => !field.required && field.field !== 'tag' && field.field !== 'shortcut'
      && field.field !== 'hotkey' && field.field !== 'favorite'
      && !(entity === 'todo' && ['time', 'recurring', 'reference'].includes(field.field))
      && Object.prototype.hasOwnProperty.call(draft.fieldValues, field.field));
  if (unsupportedOptions.length > 0) {
    throw new Error(`${unsupportedOptions[0].label} is not available in Website Popup Create yet.`);
  }
  const favoriteValue = String(draft.fieldValues.favorite || '').trim().toLowerCase();
  if (favoriteValue && favoriteValue !== 'enabled' && favoriteValue !== 'disabled') {
    throw new Error('Choose a valid Favorite option.');
  }
  const title = requiredValue(draft, 'title', 'title', entity);
  const tagIds = await resolveWebsitePopupCreateTagIds(draft);
  switch (entity) {
    case 'note': {
      const description = String(draft.fieldValues.description || '');
      const record = await createNote({ title, body: toNoteBody(description), tagIds });
      return { id: record.id, title: record.title || title };
    }
    case 'link': {
      const selectedUrls = draft.selectedValuesByField?.url || [];
      if (selectedUrls.length === 0) {
        throw new Error('Add at least one URL before creating the link.');
      }
      const urls = selectedUrls.map(selection => {
        const url = String(selection.url || selection.serializedValue || '').trim();
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          throw new Error('A selected URL is invalid. Remove it and select another URL.');
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Link URLs must use HTTP or HTTPS.');
        }
        return {
          id: generateEntityId('linkItem'),
          title: selection.label || url,
          url,
          favIconUrl: selection.favIconUrl,
          source: selection.source === 'custom' ? 'custom' as const : 'tab' as const,
        };
      });
      const record = await createLink({ title, urls, tagIds });
      return { id: record.id, title: record.title || title };
    }
    case 'todo': {
      const description = requiredValue(draft, 'description', 'description', entity);
      const options = await resolveWebsitePopupTodoCreateOptions(draft);
      const record = await createTodo(
        title, options.references, options.scheduleType, options.scheduleTime,
        options.recurringCycle, description, tagIds,
      );
      return {
        id: record.id,
        title: record.name || title,
        todoAlarm: { isAnytime: options.isAnytime },
      };
    }
    case 'snippet': {
      const description = requiredValue(draft, 'description', 'description', entity);
      const record = await createSnippet({ title, config: description, tagIds });
      return { id: record.id, title: record.title || title };
    }
    case 'agent': {
      const description = requiredValue(draft, 'description', 'prompt', entity);
      // Keep the existing Create route alias, but persist the same schema as New Tab.
      const models = draft.modelSelection || createWebsitePopupModelSelection();
      serializeWebsitePopupAgentModels(models); // Validate selected model URLs without storing legacy flags.
      const record = await createAiPrompt({
        title, prompt: description, tagIds,
        modelUrls: { ...models.modelUrls },
        customModels: models.customModels.map(model => ({ ...model })),
        enabledModelIds: [...models.enabledModelIds],
      });
      return { id: record.id, title: record.title || title };
    }
    default:
      throw new Error('Unsupported Website Popup Create entity.');
  }
}
