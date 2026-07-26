import { extractDatabaseToJSON } from './extractData';
import { generateExcelBackup } from './excelExport';

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAIN_BACKUP_FOLDER_NAME = 'cmdOS Backups';
const MAX_BACKUPS = 8;

export async function getDriveToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError || new Error('Failed to get auth token'));
      } else {
        resolve(token);
      }
    });
  });
}

export async function disconnectDrive(): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          // Completely revoke the token from Google's servers
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
            .then(() => {
              chrome.identity.clearAllCachedAuthTokens(() => resolve());
            })
            .catch((err) => {
              console.error('Failed to revoke token:', err);
              chrome.identity.clearAllCachedAuthTokens(() => resolve());
            });
        });
      } else {
        resolve();
      }
    });
  });
}

async function findOrCreateMainFolder(token: string): Promise<string> {
  // Since we use drive.appdata scope, we just use the reserved appDataFolder as our root.
  return 'appDataFolder';
}

async function createSubFolder(token: string, parentId: string, name: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId]
    })
  });
  const data = await res.json();
  return data.id;
}

async function uploadFile(token: string, parentId: string, name: string, content: string): Promise<void> {
  const metadata = {
    name,
    parents: [parentId],
    mimeType: 'application/json'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form
  });
}

export async function enforceRotationLimit(token: string, mainFolderId: string): Promise<void> {
  const query = `'${mainFolderId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&orderBy=createdTime asc&fields=files(id,name,createdTime)`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  const folders = data.files || [];
  
  if (folders.length > MAX_BACKUPS) {
    const overflowCount = folders.length - MAX_BACKUPS;
    for (let i = 0; i < overflowCount; i++) {
      const folderToDelete = folders[i];
      console.log(`[Backup] Deleting oldest backup to maintain limit: ${folderToDelete.name}`);
      await fetch(`https://www.googleapis.com/drive/v3/files/${folderToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  }
}

async function uploadBlob(token: string, parentId: string, name: string, blob: Blob): Promise<void> {
  const metadata = {
    name,
    parents: [parentId],
    mimeType: blob.type
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form
  });
}

export const executeDriveBackup = async (versionNumber: number = 1): Promise<void> => {
  try {
    const token = await getDriveToken();
    const backupData = await extractDatabaseToJSON(versionNumber);
    
    const mainFolderId = await findOrCreateMainFolder(token);
    
    // Create new backup folder
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const backupFolderName = `cmdos-backup-v${versionNumber}-${timestamp}`;
    const backupFolderId = await createSubFolder(token, mainFolderId, backupFolderName);
    
    // Upload manifest
    await uploadFile(token, backupFolderId, 'manifest.json', JSON.stringify(backupData.manifest, null, 2));
    
    // Upload tables
    for (const [tableName, records] of Object.entries(backupData.tables)) {
      await uploadFile(token, backupFolderId, `${tableName}.json`, JSON.stringify(records, null, 2));
    }
    
    // Generate and upload Excel backup
    const excelBlob = await generateExcelBackup(backupData);
    await uploadBlob(token, backupFolderId, `backup.xlsx`, excelBlob);
    
    // Enforce rotation
    await enforceRotationLimit(token, mainFolderId);
    console.log('[Backup] Drive backup executed successfully.');
  } catch (error) {
    console.error('[Backup] Failed to execute Drive backup:', error);
    throw error;
  }
};

// ----- RESTORE LOGIC -----

export interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
}

export const listBackupsFromDrive = async (): Promise<DriveFolder[]> => {
  const token = await getDriveToken();
  const mainFolderId = await findOrCreateMainFolder(token);

  const query = `'${mainFolderId}' in parents and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&orderBy=createdTime desc&fields=files(id,name,createdTime)`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  return data.files || [];
};

export const downloadBackupFromDrive = async (folderId: string): Promise<any> => {
  const token = await getDriveToken();
  
  // 1. Get all files in this backup folder
  const query = `'${folderId}' in parents and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id,name)`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  const files = data.files || [];

  const backupData: any = {
    manifest: null,
    tables: {}
  };

  // 2. Download each file
  for (const file of files) {
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const content = await fileRes.json();

    if (file.name === 'manifest.json') {
      backupData.manifest = content;
    } else if (file.name.endsWith('.json')) {
      const tableName = file.name.replace('.json', '');
      backupData.tables[tableName] = content;
    }
  }

  if (!backupData.manifest) {
    throw new Error('Manifest file not found in the backup folder.');
  }

  return backupData;
};
