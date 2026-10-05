import { db } from '../indexDB/dbConfig';
import { assetStore } from '../assets/assetStore';
import { loadInspirationImage } from './inspirationImage';
import { generateEntityId } from '../../shared-components/utils/idGenerator';
import type {
  CollectionItemRecord,
  CollectionRecord,
} from '../../allObjectFolder/src/createObject/collections/collectionTypes';
import { inspirationCatalog } from './inspirationCatalog';

export const inspirationSeedKey = (organisationId: string) => `web-clips-inspiration:v1:${organisationId}`;

/** Sample without replacement; selections become ordinary saved clips, never a live shuffle. */
export function selectInspiration(random: () => number = Math.random) {
  const quotes = [...inspirationCatalog.quotes];
  const first = quotes.splice(Math.floor(random() * quotes.length), 1)[0];
  const second = quotes.splice(Math.floor(random() * quotes.length), 1)[0];
  const video = inspirationCatalog.videos[Math.floor(random() * inspirationCatalog.videos.length)];
  return { quotes: [first, second], video };
}

async function alreadyProvisioned(organisationId: string): Promise<boolean> {
  // Restore recreates workspace provisioning markers even though migration metadata
  // is not exported. Never inject fresh samples into an existing/restored profile.
  return (
    !!(await db.migrationMetadata.get(inspirationSeedKey(organisationId)))?.completed ||
    !!(await db.migrationMetadata.get(`workspace-provisioning:${organisationId}`))?.completed
  );
}

/** Called only by fresh onboarding, before workspace provisioning or completion. */
export async function seedInspiration(organisationId: string): Promise<void> {
  if (!(await db.organisations.get(organisationId))) throw new Error('Organisation not found.');
  if (await alreadyProvisioned(organisationId)) return;

  const selection = selectInspiration();
  // Only local packaged files are read; no external image requests or hotlinks.
  // Finish fetches before opening an IndexedDB transaction.
  const sources = await Promise.all(selection.quotes.map(quote => loadInspirationImage(quote.asset)));

  // The shared lock protects OPFS writes/adoption from cleanup and backup restore.
  // Failed commits leave journaled, unreferenced files for normal staged cleanup.
  await assetStore.withAssets(sources, assets =>
    db.transaction(
      'rw',
      [db.organisations, db.collections, db.collectionItems, db.assets, db.migrationMetadata],
      async () => {
        if (!(await db.organisations.get(organisationId))) throw new Error('Organisation no longer exists.');
        // Recheck inside the write transaction for concurrent onboarding calls.
        if (await alreadyProvisioned(organisationId)) return;
        const existing = await db.collections.where('organisationId').equals(organisationId).toArray();
        if (existing.some(row => row.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === 'inspiration')) {
          // Respect user-created or imported content rather than appending samples.
          await db.migrationMetadata.put({
            id: inspirationSeedKey(organisationId),
            idMap: {},
            organisationId,
            completed: true,
          });
          return;
        }
        for (const asset of assets) {
          if (!(await db.assets.get(asset.id)))
            throw new Error('An Inspiration image could not be saved. Please try again.');
        }
        const now = Date.now();
        const collection: CollectionRecord = {
          id: generateEntityId('collection'),
          organisationId,
          name: 'Inspiration',
          propertyDefinitions: [],
          createdAt: now,
          updatedAt: now,
        };
        const base = {
          organisationId,
          collectionId: collection.id,
          tagIds: [],
          propertyValues: {},
          createdAt: now,
          updatedAt: now,
        };
        const items: CollectionItemRecord[] = selection.quotes.map((quote, index) => ({
          ...base,
          id: generateEntityId('collectionItem'),
          type: 'screenshot',
          title: `${quote.topic} — ${quote.author}`,
          url: quote.sourceUrl,
          note: `${quote.author} — ${quote.sourceWork}`,
          data: { assetId: assets[index].id, fileName: quote.asset },
        }));
        items.push({
          ...base,
          id: generateEntityId('collectionItem'),
          type: 'link',
          title: selection.video.title,
          url: selection.video.url,
          data: {},
        });
        await db.collections.add(collection);
        await db.collectionItems.bulkAdd(items);
        // Same commit as the folder/items: no partial folders, rerolls or resurrection.
        await db.migrationMetadata.put({
          id: inspirationSeedKey(organisationId),
          idMap: {},
          organisationId,
          completed: true,
        });
      },
    ),
  );
}
