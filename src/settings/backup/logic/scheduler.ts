import { executeDriveBackup } from './driveApi';

const ALARM_NAME = 'cmdos-drive-backup-alarm';
const PERIOD_IN_MINUTES = 24 * 60; // 24 hours
const AUTO_BACKUP_ENABLED_KEY = 'autoBackupEnabled';
const LAST_BACKUP_AT_KEY = 'lastBackupAt';
const LAST_BACKUP_STATUS_KEY = 'lastBackupStatus';
const LAST_STARTUP_ATTEMPT_AT_KEY = 'lastAutoBackupStartupAttemptAt';
const STARTUP_ATTEMPT_THROTTLE_MS = 30 * 60 * 1000;
const PERIOD_IN_MS = PERIOD_IN_MINUTES * 60 * 1000;
let autoBackupInFlight = false;

const notifyBackupFailure = async (message: string) => {
  const { createDurableNotification } = await import('../../../../background/src/notifications/notificationService');
  const now = Date.now();
  await createDurableNotification({
    sourceType: 'backup',
    sourceId: 'google-drive-auto-backup',
    dedupeKey: `backup:google-drive-auto-backup:failed:${now}`,
    title: 'Google Drive backup failed',
    message,
    occurrenceAt: now,
    chromeEligible: true,
    showInTab: false,
  });
};

export const enableAutoBackup = () => {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm || alarm.periodInMinutes !== PERIOD_IN_MINUTES) {
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

function parseStoredTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function runDueAutoBackup(source: 'startup' | 'alarm'): Promise<void> {
  const result = await chrome.storage.local.get([
    AUTO_BACKUP_ENABLED_KEY,
    LAST_BACKUP_AT_KEY,
    LAST_BACKUP_STATUS_KEY,
    LAST_STARTUP_ATTEMPT_AT_KEY,
  ]);

  if (!result[AUTO_BACKUP_ENABLED_KEY]) {
    console.log(`[Backup Scheduler] ${source} check skipped because automatic backup is off.`);
    return;
  }

  const now = Date.now();
  const lastSuccessfulBackupAt = result[LAST_BACKUP_STATUS_KEY] === 'success'
    ? parseStoredTimestamp(result[LAST_BACKUP_AT_KEY])
    : null;
  const isDue = !lastSuccessfulBackupAt || now - lastSuccessfulBackupAt >= PERIOD_IN_MS;

  if (!isDue) {
    console.log(`[Backup Scheduler] ${source} check skipped because backup is not due yet.`, {
      lastBackupAt: result[LAST_BACKUP_AT_KEY],
      nextDueAt: lastSuccessfulBackupAt ? new Date(lastSuccessfulBackupAt + PERIOD_IN_MS).toISOString() : undefined,
    });
    return;
  }

  if (source === 'startup') {
    const lastStartupAttemptAt = parseStoredTimestamp(result[LAST_STARTUP_ATTEMPT_AT_KEY]);
    if (lastStartupAttemptAt && now - lastStartupAttemptAt < STARTUP_ATTEMPT_THROTTLE_MS) {
      console.log('[Backup Scheduler] Startup due backup skipped because a recent startup attempt already ran.', {
        lastStartupAttemptAt: result[LAST_STARTUP_ATTEMPT_AT_KEY],
      });
      return;
    }
    await chrome.storage.local.set({ [LAST_STARTUP_ATTEMPT_AT_KEY]: new Date(now).toISOString() });
  }

  console.log(`[Backup Scheduler] ${source} check is due. Executing Drive backup...`, {
    lastBackupAt: result[LAST_BACKUP_AT_KEY],
    lastBackupStatus: result[LAST_BACKUP_STATUS_KEY],
  });

  if (autoBackupInFlight) {
    console.log(`[Backup Scheduler] ${source} backup skipped because another automatic backup is already running.`);
    return;
  }

  autoBackupInFlight = true;
  try {
    await executeDriveBackup({ interactive: false, mode: 'scheduled' });
  } finally {
    autoBackupInFlight = false;
  }
}

export const reconcileAutoBackupAlarm = () => {
  chrome.storage.local.get([AUTO_BACKUP_ENABLED_KEY], result => {
    if (result[AUTO_BACKUP_ENABLED_KEY]) {
      enableAutoBackup();
      runDueAutoBackup('startup').catch(err => {
        console.error('[Backup Scheduler] Startup due backup failed:', err);
        const message = err instanceof Error ? err.message : 'Reconnect Google Drive and try again.';
        void notifyBackupFailure(message);
      });
    } else {
      disableAutoBackup();
    }
  });
};

// This needs to be called inside your background script/service worker
export const handleBackupAlarm = async (alarm: chrome.alarms.Alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Backup Scheduler] Alarm triggered. Checking Drive backup due state...');
    try {
      await runDueAutoBackup('alarm');
    } catch (err) {
      console.error('[Backup Scheduler] Automated Drive backup failed:', err);
      const message = err instanceof Error ? err.message : 'Reconnect Google Drive and try again.';
      await notifyBackupFailure(message);
    }
  }
};
