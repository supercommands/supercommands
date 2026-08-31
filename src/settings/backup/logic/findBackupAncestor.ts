import type { DriveFolder } from './driveApi';

export function findBackupAncestor(backup: DriveFolder, backups: DriveFolder[]): DriveFolder | undefined {
  if (backup.parentBackupId) {
    const byId = backups.find(candidate => candidate.id === backup.parentBackupId);
    if (byId) return byId;
  }

  if (backup.parentBackupNumber !== undefined) {
    return backups.find(candidate => candidate.backupNumber === backup.parentBackupNumber);
  }

  return undefined;
}
