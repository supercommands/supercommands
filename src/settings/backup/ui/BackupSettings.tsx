import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUpload, 
  FiCheck, 
  FiRefreshCw,
  FiHardDrive,
  FiX,
  FiRotateCcw,
  FiShield,
  FiDownload,
  FiMoreHorizontal,
  FiEye,
  FiBarChart2,
  FiTrash2,
  FiLogOut,
  FiPause,
} from 'react-icons/fi';
import { 
  executeDriveBackup, 
  getDriveToken,
  disconnectDrive, 
  listBackupsFromDrive, 
  downloadBackupFromDrive,
  deleteDriveBackup,
} from '../logic/driveApi';
import type { DriveFolder } from '../logic/driveApi';
import { exportLocalExcelBackup, exportLocalZipBackup } from '../logic/zipExport';
import { enableAutoBackup, disableAutoBackup } from '../logic/scheduler';
import { StorageManager } from '../../../storage/localStorage/storageManager';
import { extractDatabaseToJSON, formatBackupPayloadSize } from '../logic/extractData';
import type { BackupData } from '../logic/extractData';
import { restoreDatabaseFromJSON } from '../logic/restoreData';
import { readBackupArchive } from '../logic/backupArchive';
import { useDbStore } from '../../../storage/store/useDbStore';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { getAvatarColor, getSingleInitial } from '../../../shared-components/utils/avatarColors';
import { useRelativeSavedTime } from '../../../shared-components/utils';
import BackupDifferenceReview, { type BackupComparisonSource } from './BackupDifferenceReview';
import BackupVersionDeleteReview from './BackupVersionDeleteReview';
import BackupStatsReview from './BackupStatsReview';
import type { BackupComparisonResult, BackupDataLike, BackupMergeResult } from '../logic/backupComparisonTypes';

import CreateWorkspacePanel from '../../allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';

const GoogleDriveIcon: React.FC = () => (
  <svg className="w-12 h-12 shrink-0" viewBox="0 0 24 24" fill="none">
    <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
    <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
    <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
  </svg>
);

interface BackupSettingsProps {
  onClose?: () => void;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({ onClose }) => {
  const workspaces = useDbStore(state => state.workspaces);
  const selectedWorkspaceId = useUIStore(state => state.selectedWorkspaceId);
  const setSelectedWorkspaceId = useUIStore(state => state.setSelectedWorkspaceId);

  const [backupMode, setBackupMode] = useState<'drive' | 'local'>('local');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [version, setVersion] = useState(1);
  const [backups, setBackups] = useState<DriveFolder[]>([]);
  const [hasLoadedBackups, setHasLoadedBackups] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [selectedDriveBackupId, setSelectedDriveBackupId] = useState<string>('');
  const [openDriveBackupActionsId, setOpenDriveBackupActionsId] = useState<string>('');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(false);
  const [lastBackupStatus, setLastBackupStatus] = useState<'success' | 'failed' | ''>('');
  const [lastBackupError, setLastBackupError] = useState('');
  const [dbSizeStr, setDbSizeStr] = useState('Calculating...');
  const [isComparing, setIsComparing] = useState(false);
  const [isLoadingComparisonSources, setIsLoadingComparisonSources] = useState(false);
  const [showDeleteVersionReview, setShowDeleteVersionReview] = useState(false);
  const [initialDeleteBackupIds, setInitialDeleteBackupIds] = useState<string[]>([]);
  const [isDeletingVersions, setIsDeletingVersions] = useState(false);
  const [statsReviewBackup, setStatsReviewBackup] = useState<DriveFolder | null>(null);
  const [statsReviewData, setStatsReviewData] = useState<BackupData | null>(null);
  const [isLoadingStatsReview, setIsLoadingStatsReview] = useState(false);
  const [statsReviewError, setStatsReviewError] = useState('');
  const [differenceReview, setDifferenceReview] = useState<{
    backup: BackupComparisonSource;
    leftBackup: BackupComparisonSource;
    rightBackup: BackupComparisonSource;
    comparison: BackupComparisonResult | null;
    mergeResult: BackupMergeResult | null;
    resolvedSnapshot?: BackupDataLike;
  } | null>(null);

  const refreshEstimatedBackupSize = React.useCallback(async () => {
    try {
      const backupData = await extractDatabaseToJSON(0, { includeAssetBlobPayloads: false });
      setDbSizeStr(formatBackupPayloadSize(backupData.manifest.estimatedPayloadBytes || 0));
    } catch (error) {
      console.error('Failed to estimate backup payload size', error);
      setDbSizeStr('Unavailable');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    extractDatabaseToJSON(0, { includeAssetBlobPayloads: false })
      .then(backupData => {
        if (!isMounted) return;
        setDbSizeStr(formatBackupPayloadSize(backupData.manifest.estimatedPayloadBytes || 0));
      })
      .catch(error => {
        console.error('Failed to estimate backup payload size', error);
        if (isMounted) setDbSizeStr('Unavailable');
      });

    return () => {
      isMounted = false;
    };
  }, [refreshEstimatedBackupSize]);

  const lastSyncedMessage = useRelativeSavedTime(lastSyncedAt);


  // Default to first workspace if none selected
  const activeWorkspace = workspaces.find(w => w.id === selectedWorkspaceId) || workspaces[0];

  // Load configuration and check auth on mount
  useEffect(() => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        setIsConnected(true);
        loadBackups();
        chrome.identity.getProfileUserInfo?.((userInfo) => {
          if (userInfo && userInfo.email) {
            setUserEmail(userInfo.email);
          }
        });
      }
    });

    StorageManager.getItem([
      'user_email',
      'email',
      'autoBackupEnabled',
      'lastBackupStatus',
      'lastBackupError',
      'lastBackupAt',
    ]).then((res) => {
      if (res.user_email || res.email) {
        setUserEmail(res.user_email || res.email);
      }
      setIsAutoBackupEnabled(res.autoBackupEnabled ?? false);
      setLastBackupStatus(res.lastBackupStatus || '');
      setLastBackupError(res.lastBackupError || '');
      if (res.lastBackupAt) {
        setLastSyncedAt(new Date(res.lastBackupAt));
      }
    });
  }, []);

  // Sync mode key when active workspace changes
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const modeKey = `backupMode_${activeWorkspace.id}`;
    const syncTimeKey = `lastSyncedAt_${activeWorkspace.id}`;
    StorageManager.getItem([modeKey, syncTimeKey]).then((res) => {
      const nextMode = res[modeKey] || 'local';
      setBackupMode(nextMode);
      if (res[syncTimeKey]) {
        setLastSyncedAt(new Date(res[syncTimeKey]));
      } else {
        setLastSyncedAt(null);
      }
    });
  }, [activeWorkspace?.id]);

  // Reconstruct the first-connection status from Drive when local extension storage has no history.
  useEffect(() => {
    if (!isConnected || lastBackupStatus || backups.length === 0) return;

    const latestBackup = backups[0];
    setLastBackupStatus('success');
    if (!lastSyncedAt) {
      const createdAt = latestBackup.manifest?.createdAt || latestBackup.createdTime;
      if (createdAt) setLastSyncedAt(new Date(createdAt));
    }
  }, [backups, isConnected, lastBackupStatus, lastSyncedAt]);


  const handleConnect = async (workspaceId = activeWorkspace?.id) => {
    try {
      await getDriveToken(); // triggers interactive OAuth
      setIsConnected(true);
      if (workspaceId) {
        const modeKey = `backupMode_${workspaceId}`;
        setBackupMode('drive');
        await StorageManager.setItem(modeKey, 'drive');
      }
      await loadBackups();
      chrome.identity.getProfileUserInfo?.((userInfo) => {
        if (userInfo && userInfo.email) {
          setUserEmail(userInfo.email);
          StorageManager.setItem('user_email', userInfo.email);
        }
      });
    } catch (err) {
      console.error('Failed to connect to Google Drive', err);
      alert('Authentication failed.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectDrive();
      setIsConnected(false);
      setUserEmail('');
      handleSwitchMode('local');
      await StorageManager.removeItem(['user_email', 'email']);
    } catch (err) {
      console.error('Failed to disconnect from Google Drive', err);
    }
  };

  const handleSwitchMode = (mode: 'drive' | 'local', workspaceId = activeWorkspace?.id) => {
    if (!workspaceId) return;
    const modeKey = `backupMode_${workspaceId}`;
    if (mode === 'drive' && !isConnected) {
      handleConnect(workspaceId);
    } else {
      setBackupMode(mode);
      StorageManager.setItem(modeKey, mode);
    }
  };

  const loadBackups = async (preferredBackupId?: string) => {
    setIsLoadingBackups(true);
    try {
      const list = await listBackupsFromDrive();
      setBackups(list);
      setHasLoadedBackups(true);
      setSelectedDriveBackupId(currentId => {
        if (preferredBackupId && list.some(backup => backup.id === preferredBackupId)) return preferredBackupId;
        if (currentId && list.some(backup => backup.id === currentId)) return currentId;
        return list[0]?.id || '';
      });
    } catch (err) {
      console.error('Failed to load backups', err);
      setHasLoadedBackups(true);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleToggleAutoBackup = () => {
    const newValue = !isAutoBackupEnabled;
    setIsAutoBackupEnabled(newValue);
    StorageManager.setItem('autoBackupEnabled', newValue);
    if (newValue) {
      enableAutoBackup();
    } else {
      disableAutoBackup();
    }
  };

  const handleBackupNow = async () => {
    setIsSyncing(true);
    try {
      const now = new Date();
      if (backupMode === 'drive') {
        const driveBackup = await executeDriveBackup({ interactive: true, mode: 'manual', downloadArchive: true });
        setBackups(current => [driveBackup, ...current.filter(backup => backup.id !== driveBackup.id)].slice(0, 20));
        setSelectedDriveBackupId(driveBackup.id);
        setHasLoadedBackups(true);
        void refreshEstimatedBackupSize();
        setLastBackupStatus('success');
        setLastBackupError('');
        
        setLastSyncedAt(now);
        if (activeWorkspace?.id) {
          StorageManager.setItem(`lastSyncedAt_${activeWorkspace.id}`, now.toISOString());
        }

        alert('Backup completed successfully! Uploaded to Google Drive and downloaded a ZIP copy.');
      } else {
        await exportLocalZipBackup(version);
        setVersion(v => v + 1);
        await refreshEstimatedBackupSize();
        setLastBackupStatus('success');
        setLastBackupError('');
        
        setLastSyncedAt(now);
        if (activeWorkspace?.id) {
          StorageManager.setItem(`lastSyncedAt_${activeWorkspace.id}`, now.toISOString());
        }
        
        alert('Backup completed successfully! Local ZIP file downloaded.');
      }
    } catch (err) {
      console.error(err);
      setLastBackupStatus('failed');
      setLastBackupError(err instanceof Error ? err.message : String(err));
      alert('Backup failed. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      await exportLocalZipBackup(version);
      setVersion(v => v + 1);
      alert('Local ZIP file downloaded successfully.');
    } catch (err) {
      console.error(err);
      alert('Backup download failed. Check console for details.');
    }
  };

  const handleDownloadExcelBackup = async () => {
    try {
      await exportLocalExcelBackup(version);
      alert('Excel backup downloaded successfully.');
    } catch (err) {
      console.error(err);
      alert('Excel backup download failed. Check console for details.');
    }
  };

  const handleReviewDifferences = async (driveBackupId?: string) => {
    const fallbackSource: BackupComparisonSource = { id: 'local-current', name: 'Local current data', kind: 'local' };
    const fallbackDrive: BackupComparisonSource = { id: 'drive-loading', name: 'Loading Drive backups...', kind: 'drive' };
    setIsLoadingComparisonSources(true);
    setDifferenceReview({
      backup: fallbackDrive,
      leftBackup: fallbackSource,
      rightBackup: fallbackDrive,
      comparison: null,
      mergeResult: null,
    });
    try {
      const availableBackups = hasLoadedBackups ? backups : await listBackupsFromDrive();
      if (!hasLoadedBackups) {
        setBackups(availableBackups);
        setHasLoadedBackups(true);
      }
      if (availableBackups.length < 1) {
        alert('At least one completed Drive backup is required to compare against local data.');
        return;
      }
      const targetBackup = availableBackups.find(backup => backup.id === driveBackupId) || availableBackups.find(backup => backup.id === selectedDriveBackupId) || availableBackups[0];
      const sources: BackupComparisonSource[] = [
        fallbackSource,
        ...availableBackups.map(driveFolder => ({ id: driveFolder.id, name: driveFolder.name, kind: 'drive' as const, driveFolder })),
      ];
      const targetSource = sources.find(source => source.id === targetBackup.id) || fallbackDrive;
      setDifferenceReview({
        backup: targetSource,
        leftBackup: fallbackSource,
        rightBackup: targetSource,
        comparison: null,
        mergeResult: null,
      });
    } catch (error) {
      console.error('Failed to fetch Drive backups for comparison', error);
      alert('Could not fetch available Drive backups. Check your Drive connection.');
    } finally {
      setIsLoadingComparisonSources(false);
    }
  };

  const handleCompareSelectedVersions = async (leftBackup: BackupComparisonSource, rightBackup: BackupComparisonSource) => {
    setIsComparing(true);
    setDifferenceReview(current => current ? {
      ...current,
      backup: rightBackup,
      leftBackup,
      rightBackup,
      comparison: null,
      mergeResult: null,
    } : current);
    try {
      const loadSource = (source: BackupComparisonSource) => source.kind === 'local'
        ? extractDatabaseToJSON(0, { includeAssetBlobPayloads: false })
        : downloadBackupFromDrive(source.id, { hydrateAssets: false });
      const [leftSnapshot, rightSnapshot] = await Promise.all([loadSource(leftBackup), loadSource(rightBackup)]);
      const { compareBackupSnapshots } = await import('../logic/compareBackupSnapshots');
      setDifferenceReview({
        backup: rightBackup,
        leftBackup,
        rightBackup,
        comparison: compareBackupSnapshots(leftSnapshot, rightSnapshot),
        mergeResult: null,
      });
    } catch (err) {
      console.error('Failed to compare selected backup versions', err);
      alert('Could not compare the selected backup versions. Check the console for details.');
    } finally {
      setIsComparing(false);
    }
  };

  const handleReviewStats = async (driveBackupId?: string) => {
    try {
      const availableBackups = hasLoadedBackups ? backups : await listBackupsFromDrive();
      if (!hasLoadedBackups) {
        setBackups(availableBackups);
        setHasLoadedBackups(true);
      }

      const selectedBackup = availableBackups.find(backup => backup.id === driveBackupId)
        || availableBackups.find(backup => backup.id === selectedDriveBackupId)
        || availableBackups[0];

      if (!selectedBackup) {
        alert('No completed Drive backup is available for stats.');
        return;
      }

      setStatsReviewBackup(selectedBackup);
      setStatsReviewData(null);
      setStatsReviewError('');
      const manifestCounts = selectedBackup.manifest?.tableCounts || {};
      if (Object.keys(manifestCounts).length > 0) {
        setIsLoadingStatsReview(false);
        return;
      }

      setIsLoadingStatsReview(true);
      const backupData = await downloadBackupFromDrive(selectedBackup.id, { hydrateAssets: false });
      setStatsReviewData(backupData);
    } catch (err) {
      console.error('Failed to load backup stats', err);
      setStatsReviewError('Could not load stats for this backup. Check your Drive connection.');
    } finally {
      setIsLoadingStatsReview(false);
    }
  };

  const handleRestoreFromDrive = async (driveBackupId?: string) => {
    if (backups.length === 0) {
      alert('No backups found in Google Drive to restore from.');
      return;
    }

    const selectedBackup = backups.find(backup => backup.id === driveBackupId) || backups.find(backup => backup.id === selectedDriveBackupId) || backups[0];
    const confirmed = window.confirm(`WARNING: This will completely erase your current local data and replace it with the selected backup: "${selectedBackup.name}". Are you sure you want to proceed?`);
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const backupData = await downloadBackupFromDrive(selectedBackup.id);
      await restoreDatabaseFromJSON(backupData);
      alert('Database successfully restored! Reloading application...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to restore database', err);
      alert('Restoration failed. Check console.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteDriveBackup = async (driveBackupId?: string) => {
    setInitialDeleteBackupIds(driveBackupId ? [driveBackupId] : []);
    setShowDeleteVersionReview(true);
  };

  const handleDeleteSelectedBackups = async (selectedBackups: DriveFolder[]) => {
    const names = selectedBackups.map(backup => backup.name).join(', ');
    const confirmed = window.confirm(`Delete ${selectedBackups.length} complete Drive backup version${selectedBackups.length === 1 ? '' : 's'}?\n\n${names}\n\nLocal workspace data will not be deleted.`);
    if (!confirmed) return;

    setIsDeletingVersions(true);
    try {
      for (const backup of selectedBackups) {
        await deleteDriveBackup(backup.id, backup.name);
      }
      await loadBackups();
      setShowDeleteVersionReview(false);
      alert(`${selectedBackups.length} Drive backup version${selectedBackups.length === 1 ? '' : 's'} deleted.`);
    } catch (err) {
      console.error('Failed to delete Drive backup versions', err);
      alert('Could not delete one or more Drive backup versions. Check your Drive connection.');
    } finally {
      setIsDeletingVersions(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const confirmed = window.confirm("WARNING: This will completely erase your current local data and replace it with this local ZIP backup. Are you sure you want to proceed?");
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const backupData = await readBackupArchive(file, { hydrateAssets: true });
      await restoreDatabaseFromJSON(backupData);
      alert('Local Database successfully restored! Reloading application...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to restore from local ZIP', err);
      alert('Local restoration failed. Please ensure you uploaded a valid backup ZIP.');
    } finally {
      setIsRestoring(false);
    }
  };

  const navigateToAllWorkspaces = () => {
    useUIStore.getState().setView({ type: 'settings', section: 'allWorkspaces' });
  };

  const handleSwitchModeWithConfirmation = (mode: 'drive' | 'local') => {
    if (mode === backupMode) return;
    const targetName = mode === 'drive' ? 'Google Drive' : 'Local data';
    const confirmed = window.confirm(`Are you sure you want to switch your active backup location to ${targetName}?`);
    if (confirmed) {
      handleSwitchMode(mode);
    }
  };

  const todayDateKey = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDateKey = yesterday.toDateString();
  const driveBackupHistory = backups.reduce<Array<{ key: string; label: string; dateLabel: string; backups: DriveFolder[] }>>((groups, backup) => {
    const createdAt = new Date(backup.createdTime);
    const key = createdAt.toDateString();
    const existingGroup = groups.find(group => group.key === key);
    const label = key === todayDateKey ? 'Today' : key === yesterdayDateKey ? 'Yesterday' : createdAt.toLocaleDateString(undefined, { weekday: 'short' });
    const dateLabel = createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    if (existingGroup) {
      existingGroup.backups.push(backup);
      return groups;
    }

    return [
      ...groups,
      {
        key,
        label,
        dateLabel,
        backups: [backup],
      },
    ];
  }, []);
  const getDriveBackupVersionLabel = (backup: DriveFolder, index: number) => {
    const backupNumber = backup.backupNumber ?? backup.manifest?.backupNumber;
    if (typeof backupNumber === 'number' && Number.isFinite(backupNumber)) {
      return `v${Math.max(1, Math.trunc(backupNumber))}`;
    }
    return `v${index + 1}`;
  };
  const getDriveBackupSizeLabel = (backup: DriveFolder) => {
    if (backup.storageKind === 'zip') {
      const fileSize = Number(backup.size);
      if (Number.isFinite(fileSize) && fileSize > 0) return formatBackupPayloadSize(fileSize);
    }
    const size = backup.manifest?.estimatedPayloadBytes;
    return typeof size === 'number' && size > 0 ? formatBackupPayloadSize(size) : '';
  };
  const selectedDriveBackup = backups.find(backup => backup.id === selectedDriveBackupId) || backups[0];
  const selectedDriveBackupSizeLabel = selectedDriveBackup
    ? getDriveBackupSizeLabel(selectedDriveBackup) || dbSizeStr
    : dbSizeStr;
  const selectedDriveBackupDate = selectedDriveBackup
    ? new Date(selectedDriveBackup.manifest?.createdAt || selectedDriveBackup.createdTime)
    : null;
  const driveBackupStatusLabel = lastBackupStatus === 'failed'
    ? 'Failed'
    : selectedDriveBackup?.manifest?.status === 'complete' || selectedDriveBackup
      ? 'Successful'
      : 'Ready';
  const driveBackupStatusTone = lastBackupStatus === 'failed'
    ? 'failed'
    : selectedDriveBackup?.manifest?.status === 'complete' || selectedDriveBackup
      ? 'success'
      : 'ready';
  const driveBackupTimestampDate = selectedDriveBackupDate || lastSyncedAt;
  const driveBackupTimestampLabel = driveBackupTimestampDate
    ? `Last updated ${driveBackupTimestampDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}, ${driveBackupTimestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'No Drive backup has been created yet.';

  const activeWorkspaceSlug = activeWorkspace?.workspaceName
    ? activeWorkspace.workspaceName.toLowerCase().replace(/\s+/g, '-')
    : 'workspace';
  const activeWorkspacePath = `/local/${activeWorkspaceSlug}`;

  return (
    <div className="flex h-full w-full bg-transparent text-[var(--color-textPrimary)] select-none">
      {/* ── COLUMN 2: WORKSPACE LIST SIDEBAR ── */}
      <div className="w-[145px] shrink-0 border-r border-[var(--color-borderDefault)] flex flex-col justify-between p-2 bg-transparent">
        <div className="space-y-3">
          <div className="px-1.5 text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80 text-left">
            Workspaces
          </div>
          <div className="space-y-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-0.5">
            {workspaces.map(ws => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`w-full rounded-lg px-1.5 py-1.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] shadow-sm'
                      : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold text-white shadow-sm shrink-0 ${getAvatarColor(ws.workspaceName)}`}>
                      {getSingleInitial(ws.workspaceName)}
                    </div>
                    <span className="min-w-0 flex-1 truncate">{ws.workspaceName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workspace creation is only allowed from onboarding for now.
            Previously rendered the Add workspace button here. */}
        {/*
          <div className="space-y-2 pt-4">
            <button
              onClick={() => setShowCreateOrg(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-all cursor-pointer border-none bg-transparent"
            >
              <FiPlus size={14} className="text-[var(--color-textMuted)]" />
              <span>Add workspace</span>
            </button>
          </div>
        */}
      </div>

      {/* ── COLUMN 3: BACKUP LOCATIONS SELECTOR ── */}
      <div className="w-[220px] shrink-0 border-r border-[var(--color-borderDefault)] flex flex-col p-3 overflow-y-auto bg-[var(--color-panelBg)]/30">
        <h3 className="text-sm font-bold text-[var(--color-textPrimary)] mb-1 text-left">Backup locations</h3>
        <p className="text-[11px] text-[var(--color-textSecondary)] mb-6 text-left leading-relaxed">
          Choose backup location.
        </p>

        <div className="space-y-3">
          {/* Option 1: Local data */}
          <div
            onClick={() => handleSwitchModeWithConfirmation('local')}
            className={`w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
              backupMode === 'local'
                ? 'border-[var(--color-borderActive)] bg-[var(--color-accentBg)] shadow-sm'
                : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/40 hover:bg-[var(--color-hoverBg)]'
            }`}
          >
            {/* Custom Radio dot */}
            <div className="w-4 h-4 rounded-full border border-[var(--color-borderDefault)] flex items-center justify-center shrink-0">
              {backupMode === 'local' && (
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </div>
            {/* Icon Box */}
            <div className="w-8 h-8 rounded-lg bg-[var(--color-hoverBg)] flex items-center justify-center text-[var(--color-iconDefault)] shrink-0 border border-[var(--color-borderDefault)]">
              <FiHardDrive size={16} />
            </div>
            {/* Text */}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-[var(--color-textPrimary)]">Local data</span>
              <span className="text-[10px] text-[var(--color-textMuted)] mt-0.5 flex items-center gap-1.5">
                {backupMode === 'local' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                    <span>Active • On this device</span>
                  </>
                ) : (
                  <span>On this device</span>
                )}
              </span>
            </div>
          </div>

          {/* Option 2: Google Drive */}
          <div
            onClick={() => handleSwitchModeWithConfirmation('drive')}
            className={`w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer ${
              backupMode === 'drive'
                ? 'border-[var(--color-borderActive)] bg-[var(--color-accentBg)] shadow-sm'
                : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/40 hover:bg-[var(--color-hoverBg)]'
            }`}
          >
            {/* Custom Radio dot */}
            <div className="w-4 h-4 rounded-full border border-[var(--color-borderDefault)] flex items-center justify-center shrink-0">
              {backupMode === 'drive' && (
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent)]" />
              )}
            </div>
            {/* Icon Box */}
            <div className="w-8 h-8 rounded-lg bg-[var(--color-hoverBg)] flex items-center justify-center text-[var(--color-iconDefault)] shrink-0 border border-[var(--color-borderDefault)] overflow-hidden">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
                <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
                <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
              </svg>
            </div>
            {/* Text */}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-[var(--color-textPrimary)]">Google Drive</span>
              <span className="text-[10px] text-[var(--color-textMuted)] mt-0.5 flex items-center gap-1.5">
                {backupMode === 'drive' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] shrink-0" />
                    <span>Active • {isConnected ? 'Connected' : 'Not connected'}</span>
                  </>
                ) : (
                  <span>{isConnected ? 'Connected' : 'Not connected'}</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── COLUMN 4: SELECTED BACKUP DETAILS & ACTIONS ── */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto relative bg-[var(--color-sheetBg)]/40">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2.5 right-3 p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 z-10"
            title="Close"
          >
            <FiX size={16} />
          </button>
        )}

        {/* Local Data details pane */}
        {backupMode === 'local' && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-6">
              {/* Header block */}
              <div className="flex items-center gap-3 text-left mt-2">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-accentBg)] border border-[var(--color-borderActive)] flex items-center justify-center text-[var(--color-accent)] shadow-sm shrink-0">
                  <FiHardDrive size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-textPrimary)]">Local data</h4>
                  <p className="text-[10px] text-[var(--color-textMuted)] mt-0.5">On this device</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--color-textSecondary)] text-left leading-relaxed">
                All your workspace data stays on this device and is accessible only to you.
              </p>

              {/* Details table */}
              <div className="space-y-3 pt-2 text-left">
                <h5 className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider">Details</h5>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-[var(--color-borderDefault)] pb-2">
                    <span className="text-[var(--color-textMuted)]">Last backup</span>
                    <span className="text-[var(--color-textPrimary)] font-medium">
                      {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + lastSyncedAt.toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[var(--color-borderDefault)] pb-2">
                    <span className="text-[var(--color-textMuted)]">Backup location</span>
                    <span className="text-[var(--color-textPrimary)] font-mono text-[10px]">{activeWorkspacePath}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[var(--color-borderDefault)] pb-2">
                    <span className="text-[var(--color-textMuted)]">Estimated source size</span>
                    <span className="text-[var(--color-textPrimary)] font-medium">{dbSizeStr}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-4">
                <button
                  onClick={handleBackupNow}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accentHover)] disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                >
                  {isSyncing ? (
                    <>
                      <FiRefreshCw className="animate-spin" size={13} />
                      <span>Backing up...</span>
                    </>
                  ) : (
                    <>
                      <FiUpload size={13} />
                      <span>Back up now</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  <FiRefreshCw size={13} />
                  <span>Restore backup</span>
                </button>
                <button
                  onClick={handleDownloadBackup}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  <FiDownload size={13} />
                  <span>Export backup</span>
                </button>
              </div>
            </div>

            {/* Privacy Shield Card */}
            <div className="border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left mt-8">
              <div className="flex items-center gap-3">
                <FiShield className="text-[var(--color-iconDefault)] shrink-0" size={18} />
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-[var(--color-textPrimary)]">Your data is private and secure</div>
                  <div className="text-[9px] text-[var(--color-textMuted)] mt-0.5 truncate">Backups stay on this device unless you export them.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Google Drive details pane */}
        {backupMode === 'drive' && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-4">
              {/* Header block */}
              <div className="flex items-center justify-between gap-3 pr-14 text-left mt-0">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                    <svg className="h-10 w-10 shrink-0" viewBox="-1 -1 26 26" fill="none">
                      <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
                      <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
                      <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-[var(--color-textPrimary)]">Google Drive</h4>
                    <p className={`mt-0.5 flex items-center gap-1.5 truncate text-[10px] ${
                      isConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-textMuted)]'
                    }`}>
                      {isConnected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]" />}
                      <span className="truncate">{isConnected ? (userEmail || 'Connected') : 'Not connected'}</span>
                    </p>
                  </div>
                </div>
                {isConnected && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isSyncing || isRestoring}
                      title="Disconnect Drive"
                      aria-label="Disconnect Drive"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-danger)] px-2 py-1.5 text-[10px] font-semibold text-white transition-all hover:bg-[var(--color-dangerHover)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>Disconnect</span>
                      <FiLogOut size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-textSecondary)] text-left leading-relaxed">
                <FiShield className="shrink-0 text-[var(--color-iconDefault)]" size={13} />
                <span>
                  <span className="font-semibold text-[var(--color-textPrimary)]">Your data is private and secure.</span>{' '}
                  Backups are stored privately in your Google Drive app data.
                </span>
              </p>

              {isConnected && (
                <div className="flex w-full flex-wrap items-stretch gap-3">
                  <div className="flex w-[310px] shrink-0 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 px-3 py-3 text-left shadow-sm">
                    <div className="flex min-w-0 items-start gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-transparent shadow-sm ${
                            driveBackupStatusTone === 'failed'
                              ? 'border-[var(--color-danger)] text-[var(--color-danger)]'
                              : driveBackupStatusTone === 'success'
                                ? 'border-[var(--color-success)] text-[var(--color-success)]'
                                : 'border-[var(--color-borderDefault)] text-[var(--color-iconDefault)]'
                          }`}>
                            {driveBackupStatusTone === 'failed' ? (
                              <FiX size={20} strokeWidth={3} />
                            ) : driveBackupStatusTone === 'success' ? (
                              <FiCheck size={22} strokeWidth={3} />
                            ) : (
                              <FiPause size={18} strokeWidth={3} />
                            )}
                          </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold text-[var(--color-textPrimary)]">Drive backup</span>
                          <span className={`text-[9px] font-semibold ${
                            driveBackupStatusTone === 'failed'
                              ? 'text-[var(--color-danger)]'
                              : driveBackupStatusTone === 'success'
                                ? 'text-[var(--color-success)]'
                                : 'text-[var(--color-textMuted)]'
                          }`}>
                            {driveBackupStatusLabel}
                          </span>
                        </div>
                        <div className="mt-2 truncate text-[11px] text-[var(--color-textMuted)]">
                          {driveBackupTimestampLabel}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-textMuted)]">
                          <span>Uploaded ZIP size</span>
                          <span className="font-semibold text-[var(--color-textPrimary)]">{selectedDriveBackupSizeLabel}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-[300px] shrink-0 flex-col rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 px-2.5 py-3 text-left shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-borderDefault)] text-[var(--color-iconDefault)]">
                          <FiUpload size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[var(--color-textPrimary)]">Automatic Drive backup</div>
                          <div className="mt-1 truncate text-[11px] text-[var(--color-textMuted)]">
                            {isAutoBackupEnabled ? 'Every 8 hours' : 'Automatic backup is off'}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-textMuted)]">
                            <span>Source data before ZIP</span>
                            <span className="font-semibold text-[var(--color-textPrimary)]">{dbSizeStr}</span>
                          </div>
                        </div>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={isAutoBackupEnabled}
                          onChange={handleToggleAutoBackup}
                        />
                        <div className="relative h-5 w-9 rounded-full bg-[var(--color-borderDefault)] transition-colors peer-checked:bg-[var(--color-borderActive)] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4" />
                      </label>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={handleBackupNow}
                        disabled={isSyncing || isRestoring}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-1.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-colors hover:border-[var(--color-borderActive)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSyncing ? (
                          <FiRefreshCw className="animate-spin" size={13} />
                        ) : (
                          <svg className="h-4 w-4 shrink-0" viewBox="-1 -1 26 26" fill="none">
                            <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
                            <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
                            <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
                          </svg>
                        )}
                        <span>{isSyncing ? 'Backing up...' : 'Backup to Drive now'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadExcelBackup}
                        disabled={isSyncing || isRestoring}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-transparent px-2 py-1.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:border-[var(--color-borderActive)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <FiDownload size={13} />
                        <span>Export as Excel</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isConnected ? (
                <>
                  {lastBackupStatus === 'failed' && lastBackupError && (
                    <div className="text-[10px] text-[var(--color-danger)] bg-[var(--color-dangerBg)] border border-[var(--color-danger)]/20 rounded-lg p-2.5 text-left">
                      {lastBackupError}
                    </div>
                  )}

                  {isLoadingBackups ? (
                    <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 px-3 py-3 text-left">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-textPrimary)]">
                        <FiRefreshCw className="animate-spin text-[var(--color-accent)]" size={14} />
                        <span>Loading backup history</span>
                      </div>
                      <div className="mt-2 space-y-2 pl-6">
                        <div className="h-2 w-28 rounded-full bg-[var(--color-hoverBg)]" />
                        <div className="h-7 rounded-lg bg-[var(--color-hoverBg)]" />
                      </div>
                    </div>
                  ) : backups.length > 0 ? (
                    <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 px-3 py-3 text-left">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Backup history</div>
                        <div className="truncate text-[10px] font-medium text-[var(--color-textSecondary)]">New backups are added automatically</div>
                      </div>

                      <div className="space-y-0">
                        {driveBackupHistory.map((group, groupIndex) => (
                          <div key={group.key} className="relative pl-5">
                            <div className="absolute left-[5px] top-0 h-full w-px bg-[var(--color-borderDefault)]" />
                            <div className="relative flex items-center gap-2 pb-1.5">
                              <span className="absolute -left-[19px] h-3 w-3 rounded-full border border-[var(--color-textMuted)] bg-[var(--color-cardBg)]" />
                              <span className="text-[10px] font-semibold text-[var(--color-textPrimary)]">{group.label}</span>
                              <span className="text-[9px] text-[var(--color-textMuted)]">-</span>
                              <span className="text-[9px] text-[var(--color-textMuted)]">{group.dateLabel}</span>
                            </div>

                            <div className="space-y-1 pb-3">
                              {group.backups.map((backup, backupIndex) => {
                                const selectedBackup = selectedDriveBackupId === backup.id || (!selectedDriveBackupId && groupIndex === 0 && backupIndex === 0);
                                const flatIndex = backups.findIndex(item => item.id === backup.id);
                                const createdAt = new Date(backup.createdTime);
                                const sizeLabel = getDriveBackupSizeLabel(backup) || dbSizeStr;

                                return (
                                  <div
                                    key={backup.id}
                                    onClick={() => setSelectedDriveBackupId(backup.id)}
                                    role="button"
                                    tabIndex={0}
                                    className={`group flex min-h-[46px] w-full cursor-pointer items-center gap-4 rounded-lg border px-3 py-2 text-left transition-colors ${
                                      selectedBackup
                                        ? 'border-[var(--color-borderActive)] bg-[var(--color-selectedBg)]'
                                        : 'border-transparent bg-[var(--color-hoverBg)]/40 hover:border-[var(--color-borderDefault)]'
                                    }`}
                                  >
                                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                      selectedBackup ? 'border-[var(--color-accent)]' : 'border-[var(--color-textMuted)]'
                                    }`}>
                                      {selectedBackup && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />}
                                    </span>
                                    <span className="w-16 shrink-0 text-[11px] font-medium leading-none text-[var(--color-textSecondary)]">
                                      {createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                    <span className="w-8 shrink-0 text-[11px] font-bold leading-none text-[var(--color-textPrimary)]">
                                      {getDriveBackupVersionLabel(backup, flatIndex)}
                                    </span>
                                    <span className="w-20 shrink-0 text-[10px] font-bold leading-none text-[var(--color-accent)]">
                                      {selectedBackup ? 'Current' : ''}
                                    </span>
                                    {sizeLabel && (
                                      <span className="w-20 shrink-0 text-[11px] font-semibold leading-none text-[var(--color-textSecondary)]">
                                        {sizeLabel}
                                        {backup.storageKind === 'zip' ? ' ZIP' : ''}
                                      </span>
                                    )}
                                    {openDriveBackupActionsId === backup.id && (
                                      <span className="ml-auto flex shrink-0 items-center gap-1">
                                        <button
                                          type="button"
                                          title="Stats"
                                          aria-label="View backup stats"
                                          disabled={isSyncing || isRestoring || isLoadingStatsReview || isLoadingBackups}
                                          onClick={event => {
                                            event.stopPropagation();
                                            setSelectedDriveBackupId(backup.id);
                                            handleReviewStats(backup.id);
                                          }}
                                          className="flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiBarChart2 size={13} />
                                          <span>Stats</span>
                                        </button>
                                        <button
                                          type="button"
                                          title="Review"
                                          aria-label="Review backup"
                                          disabled={isSyncing || isRestoring || isComparing || isLoadingComparisonSources || isLoadingBackups}
                                          onClick={event => {
                                            event.stopPropagation();
                                            setSelectedDriveBackupId(backup.id);
                                            handleReviewDifferences(backup.id);
                                          }}
                                          className="flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiEye size={13} />
                                          <span>Review</span>
                                        </button>
                                        <button
                                          type="button"
                                          title="Restore"
                                          aria-label="Restore backup"
                                          disabled={isSyncing || isRestoring || isLoadingBackups}
                                          onClick={event => {
                                            event.stopPropagation();
                                            setSelectedDriveBackupId(backup.id);
                                            handleRestoreFromDrive(backup.id);
                                          }}
                                          className="flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiRotateCcw size={13} />
                                          <span>Restore</span>
                                        </button>
                                        <button
                                          type="button"
                                          title="Delete"
                                          aria-label="Delete backup"
                                          disabled={isSyncing || isRestoring || isLoadingBackups}
                                          onClick={event => {
                                            event.stopPropagation();
                                            setSelectedDriveBackupId(backup.id);
                                            handleDeleteDriveBackup(backup.id);
                                          }}
                                          className="flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-[var(--color-danger)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <FiTrash2 size={13} />
                                          <span>Delete</span>
                                        </button>
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      title="More actions"
                                      aria-label="More backup actions"
                                      onClick={event => {
                                        event.stopPropagation();
                                        setSelectedDriveBackupId(backup.id);
                                        setOpenDriveBackupActionsId(current => current === backup.id ? '' : backup.id);
                                      }}
                                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-iconDefault)] transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] ${
                                        selectedBackup ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                      } ${openDriveBackupActionsId === backup.id ? 'ml-0' : 'ml-auto'}`}
                                    >
                                      <FiMoreHorizontal size={14} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 px-3 py-3 text-left">
                      <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Backup history</div>
                      <div className="mt-1 text-[10px] text-[var(--color-textMuted)]">No Drive backups found.</div>
                    </div>
                  )}

                </>
              ) : (
                <div className="pt-6">
                  <button
                    onClick={() => handleConnect()}
                    disabled={isSyncing || isRestoring}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accentHover)] disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
      {differenceReview && (
        <BackupDifferenceReview
          backup={differenceReview.backup}
          leftBackup={differenceReview.leftBackup}
          rightBackup={differenceReview.rightBackup}
          backups={[{ id: 'local-current', name: 'Local current data', kind: 'local' }, ...backups.map(driveFolder => ({ id: driveFolder.id, name: driveFolder.name, kind: 'drive' as const, driveFolder }))]}
          isComparing={isComparing}
          isLoadingSources={isLoadingComparisonSources}
          onCompareVersions={handleCompareSelectedVersions}
          comparison={differenceReview.comparison}
          mergeResult={differenceReview.mergeResult}
          onResolvedSnapshot={snapshot => setDifferenceReview(current => current ? { ...current, resolvedSnapshot: snapshot } : current)}
          onClose={() => setDifferenceReview(null)}
        />
      )}
      {showDeleteVersionReview && (
        <BackupVersionDeleteReview
          backups={backups}
          isDeleting={isDeletingVersions}
          initialSelectedIds={initialDeleteBackupIds}
          onDelete={handleDeleteSelectedBackups}
          onClose={() => {
            setShowDeleteVersionReview(false);
            setInitialDeleteBackupIds([]);
          }}
        />
      )}
      {statsReviewBackup && (
        <BackupStatsReview
          backup={statsReviewBackup}
          backupData={statsReviewData}
          isLoading={isLoadingStatsReview}
          error={statsReviewError}
          onClose={() => {
            setStatsReviewBackup(null);
            setStatsReviewData(null);
            setStatsReviewError('');
          }}
        />
      )}

      {/* Hidden file selector for local backup restoration */}
      <input 
        type="file" 
        accept=".zip" 
        ref={fileInputRef}
        onChange={handleLocalRestore} 
        className="hidden" 
      />

      {/* ── CREATE WORKSPACE POPUP MODAL ── */}
      <AnimatePresence>
        {/* Workspace creation is only allowed from onboarding for now. */}
        {false && showCreateOrg && (
          <div
            className="absolute inset-0 z-50 flex items-start pt-[15vh] justify-center backdrop-blur-sm bg-black/45"
            onClick={() => setShowCreateOrg(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-[480px] h-[320px] flex flex-col bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative"
            >
              <CreateWorkspacePanel
                onClose={() => setShowCreateOrg(false)}
                onSuccess={() => setShowCreateOrg(false)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
