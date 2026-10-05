import { assetStore } from '../../../storage/assets/assetStore';
import { ALLOWED_IMAGE_MIME_TYPES, hasImageSignature } from '../../../storage/assets/assetPolicy';
import { ASSET_BLOB_BACKUP_FIELD } from './assetBackupPayload';
import type { BackupData } from './extractData';
import { validateBackupTagImageReferences, validateBackupTagImageBlob } from './tagAssetBackupValidation';

// In-memory bytes belong to this snapshot only; they are not persisted in any database.
const capturedAssets = new WeakMap<BackupData, ReadonlyMap<string, Blob>>();
export function captureBackupAssetBlobs(backup: BackupData, blobs: ReadonlyMap<string, Blob>): void {
  capturedAssets.set(backup, blobs);
}
export function inheritCapturedBackupAssets(source: BackupData, target: BackupData): void {
  const blobs = capturedAssets.get(source);
  if (blobs) capturedAssets.set(target, blobs);
}

export async function validateBackupAssetBlob(record: any, blob: Blob): Promise<Blob> {
  const fail = (reason: string): never => { throw new Error(`Backup image ${record.id}: ${reason}`); };
  if (!ALLOWED_IMAGE_MIME_TYPES.has(record.mimeType)) fail('unsupported image MIME type.');
  if (!Number.isSafeInteger(record.byteSize) || record.byteSize <= 0 || blob.size !== record.byteSize) fail('image byte size does not match snapshot metadata.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!hasImageSignature(bytes, record.mimeType)) fail('image bytes do not match the declared MIME type.');
  if (record.hash !== undefined) {
    if (typeof record.hash !== 'string' || !/^[a-f0-9]{64}$/i.test(record.hash)) fail('invalid SHA-256 metadata.');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== record.hash.toLowerCase()) fail('image SHA-256 does not match snapshot metadata.');
  }
  // OPFS File handles remain backed by the live file. Copy verified bytes so later
  // cleanup or writes cannot invalidate the snapshot's payload.
  return new Blob([bytes], {type: record.mimeType});
}

export function backupDataUrlToBlob(value: string): Blob {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) throw new Error('Invalid backup image data URL.');
  const binary = atob(match[2]);
  return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], {type: match[1]});
}

/** Reads each image once and validates against the captured metadata, not a newer live record. */
export async function readBackupAssetBlobs(backup: BackupData, options: {allowLiveReads?: boolean} = {}): Promise<Map<string, Blob>> {
  const tagImageIds = validateBackupTagImageReferences(backup.tables);
  const cached = capturedAssets.get(backup);
  const blobs = new Map<string, Blob>();
  for (const record of backup.tables.assets || []) {
    if (typeof record?.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(record.id)) throw new Error('Invalid backup image ID.');
    if (blobs.has(record.id)) throw new Error(`Duplicate backup image ID: ${record.id}`);
    let blob = cached?.get(record.id);
    if (!blob && typeof record[ASSET_BLOB_BACKUP_FIELD] === 'string') blob = backupDataUrlToBlob(record[ASSET_BLOB_BACKUP_FIELD]);
    if (!blob && record.blob instanceof Blob) blob = record.blob;
    if (!blob && !cached && options.allowLiveReads !== false) blob = (await assetStore.getAsset(record.id))?.blob;
    if (!blob) throw new Error(`Backup image ${record.id}: image bytes are unavailable. Backup was not created.`);
    const verifiedBlob = await validateBackupAssetBlob(record, blob);
    if (tagImageIds.has(record.id)) await validateBackupTagImageBlob(record.id, verifiedBlob);
    blobs.set(record.id, verifiedBlob);
  }
  return blobs;
}
