/** Background-only Favorite assignment for a popup-created entity. */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { addFavoriteRecord } from '../../../src/shared-components/favorites/favoriteData';
import { getItemCompoundId } from '../../../src/shared-components/utils/idGenerator';
import type { WebsitePopupBaseCreateEntity } from '../../../src/shared-components/websitePopup/contracts/websitePopupExecutionTypes';

export async function assignWebsitePopupCreatedFavorite(
  entity: WebsitePopupBaseCreateEntity,
  entityId: string,
  title: string,
): Promise<void> {
  const record = entity === 'note' ? await db.notes.get(entityId)
    : entity === 'link' ? await db.links.get(entityId)
    : entity === 'todo' ? await db.todos.get(entityId)
    : entity === 'snippet' ? await db.snippets.get(entityId)
    : await db.aiPrompts.get(entityId);
  if (!record) throw new Error('The created item could not be found. Favorite was not added.');
  await addFavoriteRecord('local_user', getItemCompoundId(record), entity === 'agent' ? 'aiPrompt' : entity, title);
}
