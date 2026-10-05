import { db } from '../indexDB/dbConfig';
import { assetStore } from '../assets/assetStore';
import { loadInspirationImage } from './inspirationImage';

// Match the exact originally shipped crop, never arbitrary user screenshots.
const clippedImageHashes: Record<string, string> = {
  '01-keller-optimism.jpg': 'd85c761acc3b92ffa055de2b0b6fdc33dde9c5214de315afbd92c03324adb45a',
  '02-keller-character.jpg': 'c5482e7c092117e3a87a623474a242d195ea296839f9c786df612960676ffb62',
  '05-pichai-hope.jpg': 'ce401914723f6f3eeae7a553a1dc26f3cc22fab36c7bac7db8dbb21ef1ca533a',
};
const inFlight = new Map<string, Promise<boolean>>();

async function repair(organisationId: string): Promise<boolean> {
  const candidates = await db.collectionItems
    .where('organisationId')
    .equals(organisationId)
    .filter(item => item.type === 'screenshot' && Object.hasOwn(clippedImageHashes, item.data.fileName || ''))
    .toArray();
  const matches: { id: string; assetId: string; fileName: string }[] = [];
  for (const item of candidates) {
    if (item.type !== 'screenshot' || !item.data.fileName) continue;
    const fileName = item.data.fileName;
    const asset = await db.assets.get(item.data.assetId);
    if (asset?.hash?.toLowerCase() === clippedImageHashes[fileName]) matches.push({ id: item.id, assetId: asset.id, fileName });
  }
  if (!matches.length) return false;
  const fileNames = [...new Set(matches.map(match => match.fileName))];
  const sources = await Promise.all(fileNames.map(loadInspirationImage));
  return assetStore.withAssets(sources, replacements =>
    db.transaction('rw', [db.organisations, db.collections, db.collectionItems, db.assets], async () => {
      if (!(await db.organisations.get(organisationId))) return false;
      for (const replacement of replacements) {
        if (!(await db.assets.get(replacement.id))) throw new Error('Replacement quote image is missing.');
      }
      let changed = false;
      for (const match of matches) {
        const current = await db.collectionItems.get(match.id);
        // Preserve concurrent edits and deletions; update only the original image reference.
        if (
          !current ||
          current.organisationId !== organisationId ||
          current.type !== 'screenshot' ||
          current.data.fileName !== match.fileName ||
          current.data.assetId !== match.assetId
        )
          continue;
        const collection = await db.collections.get(current.collectionId);
        if (collection?.organisationId !== organisationId) continue;
        const original = await db.assets.get(match.assetId);
        if (original?.hash?.toLowerCase() !== clippedImageHashes[match.fileName]) continue;
        const replacement = replacements[fileNames.indexOf(match.fileName)];
        await db.collectionItems.put({
          ...current,
          data: { ...current.data, assetId: replacement.id },
          updatedAt: Math.max(Date.now(), current.updatedAt + 1),
        });
        changed = true;
      }
      return changed;
    }),
  );
}

/** No permanent marker: an older restored backup can still receive the repair. */
export function repairInspirationImages(organisationId: string): Promise<boolean> {
  const existing = inFlight.get(organisationId);
  if (existing) return existing;
  const operation = repair(organisationId).finally(() => {
    inFlight.delete(organisationId);
  });
  inFlight.set(organisationId, operation);
  return operation;
}
