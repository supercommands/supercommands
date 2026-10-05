import { MAX_TAG_IMAGE_DATA_LENGTH, validateTagAppearance } from '../../../allObjectFolder/src/createObject/tags/tagAppearanceValidation';
import { validateTagImageBlob } from '../../../allObjectFolder/src/createObject/tags/tagImagePayload';
import type { TagAppearance } from '../../../allObjectFolder/src/createObject/tags/tagTypes';

/** Validate detached snapshot references, including after conflict resolution. */
export function validateBackupTagImageReferences(tables: Record<string, any[]>): Set<string> {
  const assets = new Map<string, any>((tables.assets || []).map(record => [record.id, record] as const));
  const imageIds = new Set<string>();
  for (const tag of tables.tags || []) {
    if (tag.appearance === undefined) continue;
    let appearance: TagAppearance;
    try { appearance = validateTagAppearance(tag.appearance); }
    catch { throw new Error(`Backup tag ${tag.id}: invalid appearance. Inline tag images are not supported.`); }
    if (appearance.kind !== 'image') continue;
    const asset = assets.get(appearance.assetId);
    if (!asset) throw new Error(`Backup tag ${tag.id}: missing image metadata ${appearance.assetId}.`);
    if (asset.mimeType !== 'image/png' || !Number.isSafeInteger(asset.byteSize) || asset.byteSize <= 0 ||
      Math.ceil(asset.byteSize / 3) * 4 + 'data:image/png;base64,'.length > MAX_TAG_IMAGE_DATA_LENGTH)
      throw new Error(`Backup tag ${tag.id}: image ${appearance.assetId} is not a bounded PNG thumbnail.`);
    imageIds.add(appearance.assetId);
  }
  return imageIds;
}

/** Tag assets need successful 64×64 decoding in addition to shared asset integrity checks. */
export async function validateBackupTagImageBlob(assetId: string, blob: Blob): Promise<void> {
  try { await validateTagImageBlob(blob); }
  catch (error) {
    throw new Error(`Backup tag image ${assetId}: ${error instanceof Error ? error.message : 'invalid thumbnail.'}`);
  }
}
