import { extractDatabaseToJSON } from './extractData';
import { generateExcelBackup } from './excelExport';
import { buildBackupArchive } from './backupArchive';
import { BRAND } from '../../../shared-components/brandingConfig';

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
    const backupData = await extractDatabaseToJSON(versionNumber, { includeAssetBlobPayloads: false, includeAssetBinaryPayloads: true });
    const content = await buildBackupArchive(backupData);

    // Trigger download for ZIP
    downloadBlob(content, `${BRAND.exports.backupZipPrefix}-${new Date().toISOString().slice(0, 10)}.zip`);

    // Trigger download for Excel
    try {
      const excelBlob = await generateExcelBackup(backupData);
      downloadBlob(excelBlob, `${BRAND.exports.backupExcelPrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      throw new Error(`The ZIP backup was downloaded, but the accompanying Excel export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    console.error('[Backup Export] Failed to generate local ZIP backup:', error);
    throw error;
  }
};

export const exportLocalExcelBackup = async (versionNumber: number = 1): Promise<void> => {
  try {
    const backupData = await extractDatabaseToJSON(versionNumber, { includeAssetBlobPayloads: false });
    const excelBlob = await generateExcelBackup(backupData);
    downloadBlob(excelBlob, `${BRAND.exports.backupExcelPrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    console.error('[Backup Export] Failed to generate local Excel backup:', error);
    throw error;
  }
};
