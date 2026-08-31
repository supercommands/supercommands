import { extractDatabaseToJSON } from './extractData';
import { generateExcelBackup } from './excelExport';
import { buildBackupArchive } from './backupArchive';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportLocalZipBackup = async (versionNumber: number = 1): Promise<void> => {
  try {
    const backupData = await extractDatabaseToJSON(versionNumber, { includeAssetBlobPayloads: false });
    const content = await buildBackupArchive(backupData);

    // Trigger download for ZIP
    downloadBlob(content, `cmdos-backup-${new Date().toISOString().slice(0, 10)}.zip`);

    // Generate Excel blob
    const excelBlob = await generateExcelBackup(backupData);

    // Trigger download for Excel
    downloadBlob(excelBlob, `cmdos-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('[Backup Export] Failed to generate local ZIP backup:', error);
    throw error;
  }
};

export const exportLocalExcelBackup = async (versionNumber: number = 1): Promise<void> => {
  try {
    const backupData = await extractDatabaseToJSON(versionNumber, { includeAssetBlobPayloads: false });
    const excelBlob = await generateExcelBackup(backupData);
    downloadBlob(excelBlob, `cmdos-backup-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('[Backup Export] Failed to generate local Excel backup:', error);
    throw error;
  }
};
