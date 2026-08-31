import { executeDriveBackup } from './driveApi';

const ALARM_NAME = 'cmdos-drive-backup-alarm';
const PERIOD_IN_MINUTES = 8 * 60; // 8 hours
const AUTO_BACKUP_ENABLED_KEY = 'autoBackupEnabled';

const notifyBackupFailure = (message: string) => {
  if (!chrome.notifications?.create) return;
  chrome.notifications.create(`drive-backup-failed-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon.png'),
    title: 'Google Drive backup failed',
    message,
    requireInteraction: false,
  });
};

export const enableAutoBackup = () => {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      console.log(`[Backup Scheduler] Setting up backup alarm every ${PERIOD_IN_MINUTES} minutes.`);
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: PERIOD_IN_MINUTES
      });
    }
  });
};

export const disableAutoBackup = () => {
  chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
    if (wasCleared) {
      console.log('[Backup Scheduler] Auto backup alarm disabled.');
    }
  });
};

export const reconcileAutoBackupAlarm = () => {
  chrome.storage.local.get([AUTO_BACKUP_ENABLED_KEY], result => {
    if (result[AUTO_BACKUP_ENABLED_KEY]) {
      enableAutoBackup();
    } else {
      disableAutoBackup();
    }
  });
};

// This needs to be called inside your background script/service worker
export const handleBackupAlarm = async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Backup Scheduler] Alarm triggered. Executing Drive backup...');
    try {
      await executeDriveBackup({ interactive: false, mode: 'scheduled' });
    } catch (err) {
      console.error('[Backup Scheduler] Automated Drive backup failed:', err);
      const message = err instanceof Error ? err.message : 'Reconnect Google Drive and try again.';
      notifyBackupFailure(message);
    }
  }
};
