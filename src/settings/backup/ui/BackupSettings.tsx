import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCloud, 
  FiUpload, 
  FiCheck, 
  FiDatabase, 
  FiFolder, 
  FiRefreshCw,
  FiPlus,
  FiSettings,
  FiHardDrive,
  FiX,
  FiArrowRight,
  FiShield,
  FiDownload,
  FiMoreHorizontal
} from 'react-icons/fi';
import { 
  executeDriveBackup, 
  getDriveToken,
  disconnectDrive, 
  listBackupsFromDrive, 
  downloadBackupFromDrive,
  DriveFolder
} from '../logic/driveApi';
import { exportLocalZipBackup } from '../logic/zipExport';
import { enableAutoBackup, disableAutoBackup } from '../logic/scheduler';
import { StorageManager } from '../../../storage/localStorage/storageManager';
import { extractDatabaseToJSON } from '../logic/extractData';
import { restoreDatabaseFromJSON } from '../logic/restoreData';
import { useDbStore } from '../../../storage/store/useDbStore';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { getAvatarColor, getSingleInitial } from '../../../shared-components/utils/avatarColors';
import { useRelativeSavedTime } from '../../../shared-components/utils';

import CreateWorkspacePanel from '../../allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import JSZip from 'jszip';

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
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);

  const [backupMode, setBackupMode] = useState<'drive' | 'local'>('local');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [version, setVersion] = useState(1);
  const [backups, setBackups] = useState<DriveFolder[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAutoBackupEnabled, setIsAutoBackupEnabled] = useState(false);
  const [dbSizeStr, setDbSizeStr] = useState('60 KB');

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usageBytes = estimate.usage || 0;
        const kb = usageBytes / 1024;
        if (kb > 1024) {
          setDbSizeStr(`${(kb / 1024).toFixed(1)} MB`);
        } else {
          setDbSizeStr(`${kb.toFixed(0)} KB`);
        }
      });
    }
  }, [workspaces, dbNotes, dbLinks, dbSnippets]);

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

    StorageManager.getItem(['user_email', 'email', 'autoBackupEnabled']).then((res) => {
      if (res.user_email || res.email) {
        setUserEmail(res.user_email || res.email);
      }
      setIsAutoBackupEnabled(res.autoBackupEnabled ?? false);
    });
  }, []);

  // Sync mode key when active workspace changes
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const modeKey = `backupMode_${activeWorkspace.id}`;
    const syncTimeKey = `lastSyncedAt_${activeWorkspace.id}`;
    StorageManager.getItem([modeKey, syncTimeKey]).then((res) => {
      setBackupMode(res[modeKey] || 'local');
      if (res[syncTimeKey]) {
        setLastSyncedAt(new Date(res[syncTimeKey]));
      } else {
        setLastSyncedAt(null);
      }
    });
  }, [activeWorkspace?.id]);


  const handleConnect = async () => {
    try {
      await getDriveToken(); // triggers interactive OAuth
      setIsConnected(true);
      if (activeWorkspace?.id) {
        const modeKey = `backupMode_${activeWorkspace.id}`;
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

  const handleSwitchMode = (mode: 'drive' | 'local') => {
    if (!activeWorkspace?.id) return;
    const modeKey = `backupMode_${activeWorkspace.id}`;
    if (mode === 'drive' && !isConnected) {
      handleConnect();
    } else {
      setBackupMode(mode);
      StorageManager.setItem(modeKey, mode);
    }
  };

  const loadBackups = async () => {
    try {
      const list = await listBackupsFromDrive();
      setBackups(list);
    } catch (err) {
      console.error('Failed to load backups', err);
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
        await executeDriveBackup(version);
        setVersion(v => v + 1);
        await loadBackups();
        
        setLastSyncedAt(now);
        if (activeWorkspace?.id) {
          StorageManager.setItem(`lastSyncedAt_${activeWorkspace.id}`, now.toISOString());
        }

        alert('Backup completed successfully! Uploaded to Google Drive.');
      } else {
        await exportLocalZipBackup(version);
        setVersion(v => v + 1);
        
        setLastSyncedAt(now);
        if (activeWorkspace?.id) {
          StorageManager.setItem(`lastSyncedAt_${activeWorkspace.id}`, now.toISOString());
        }
        
        alert('Backup completed successfully! Local ZIP file downloaded.');
      }
    } catch (err) {
      console.error(err);
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

  const handleRestoreFromDrive = async () => {
    if (backups.length === 0) {
      alert('No backups found in Google Drive to restore from.');
      return;
    }

    // Select the latest backup automatically or prompt
    const latestBackup = backups[0];
    const confirmed = window.confirm(`WARNING: This will completely erase your current local data and replace it with the selected backup: "${latestBackup.name}". Are you sure you want to proceed?`);
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const backupData = await downloadBackupFromDrive(latestBackup.id);
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
      const zip = new JSZip();
      const unzipped = await zip.loadAsync(file);
      
      const backupData: any = {
        manifest: null,
        tables: {}
      };

      // Extract manifest
      const manifestFile = unzipped.file('manifest.json');
      if (!manifestFile) throw new Error('Invalid backup ZIP: missing manifest.json');
      backupData.manifest = JSON.parse(await manifestFile.async('string'));

      // Extract tables
      for (const relativePath of Object.keys(unzipped.files)) {
        if (relativePath.endsWith('.json') && relativePath !== 'manifest.json') {
          const tableName = relativePath.replace('.json', '');
          const tableContent = await unzipped.file(relativePath)?.async('string');
          if (tableContent) {
            backupData.tables[tableName] = JSON.parse(tableContent);
          }
        }
      }

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

  // Calculate dynamic size estimate of database items for selected workspace
  const activeWorkspaceIdStr = activeWorkspace?.id ? String(activeWorkspace.id) : '';
  const totalItems = 
    dbNotes.filter(n => String(n.workspaceId) === activeWorkspaceIdStr).length +
    dbLinks.filter(l => String(l.workspaceId) === activeWorkspaceIdStr).length +
    dbSnippets.filter(s => String(s.workspaceId) === activeWorkspaceIdStr).length;
  const sizeKB = Math.max(10, totalItems * 8.5);
  const sizeEstimate = sizeKB > 1024
    ? `${(sizeKB / 1024).toFixed(2)} MB`
    : `${sizeKB.toFixed(0)} KB`;

  const activeWorkspaceSlug = activeWorkspace?.workspaceName
    ? activeWorkspace.workspaceName.toLowerCase().replace(/\s+/g, '-')
    : 'workspace';
  const activeWorkspacePath = `/local/${activeWorkspaceSlug}`;

  return (
    <div className="flex h-full w-full bg-transparent text-[var(--color-textPrimary)] select-none">
      {/* ── COLUMN 2: WORKSPACE LIST SIDEBAR ── */}
      <div className="w-[240px] shrink-0 border-r border-[var(--color-borderDefault)] flex flex-col justify-between p-4 bg-transparent">
        <div className="space-y-4">
          <div className="px-2 text-[10px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80 text-left">
            Workspaces
          </div>
          <div className="space-y-1.5 overflow-y-auto max-h-[400px] custom-scrollbar pr-1">
            {workspaces.map(ws => {
              const isActive = activeWorkspace?.id === ws.id;
              return (
                <div
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] shadow-sm'
                      : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                  }`}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold text-white shadow-sm shrink-0 ${getAvatarColor(ws.workspaceName)}`}>
                    {getSingleInitial(ws.workspaceName)}
                  </div>
                  <span className="truncate">{ws.workspaceName}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <button
            onClick={() => setShowCreateOrg(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-all cursor-pointer border-none bg-transparent"
          >
            <FiPlus size={14} className="text-[var(--color-textMuted)]" />
            <span>Add workspace</span>
          </button>
        </div>
      </div>

      {/* ── COLUMN 3: BACKUP LOCATIONS SELECTOR ── */}
      <div className="w-[340px] shrink-0 border-r border-[var(--color-borderDefault)] flex flex-col p-6 overflow-y-auto bg-neutral-900/10">
        <h3 className="text-sm font-bold text-white mb-1 text-left">Backup locations</h3>
        <p className="text-[11px] text-[var(--color-textSecondary)] mb-6 text-left leading-relaxed">
          Choose where to back up or restore your workspace data.
        </p>

        <div className="space-y-3">
          {/* Option 1: Local data */}
          <div
            onClick={() => handleSwitchModeWithConfirmation('local')}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
              backupMode === 'local'
                ? 'border-blue-500 bg-blue-500/5 shadow-sm'
                : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/40 hover:bg-[var(--color-hoverBg)]'
            }`}
          >
            {/* Custom Radio dot */}
            <div className="w-4 h-4 rounded-full border border-neutral-600 flex items-center justify-center shrink-0">
              {backupMode === 'local' && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            {/* Icon Box */}
            <div className="w-9 h-9 rounded-lg bg-[var(--color-hoverBg)] flex items-center justify-center text-neutral-400 shrink-0 border border-[var(--color-borderDefault)]">
              <FiHardDrive size={18} />
            </div>
            {/* Text */}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-white">Local data</span>
              <span className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1.5">
                {backupMode === 'local' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
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
            className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
              backupMode === 'drive'
                ? 'border-blue-500 bg-blue-500/5 shadow-sm'
                : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/40 hover:bg-[var(--color-hoverBg)]'
            }`}
          >
            {/* Custom Radio dot */}
            <div className="w-4 h-4 rounded-full border border-neutral-600 flex items-center justify-center shrink-0">
              {backupMode === 'drive' && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            {/* Icon Box */}
            <div className="w-9 h-9 rounded-lg bg-[var(--color-hoverBg)] flex items-center justify-center text-neutral-400 shrink-0 border border-[var(--color-borderDefault)] overflow-hidden">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
                <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
                <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
              </svg>
            </div>
            {/* Text */}
            <div className="flex flex-col text-left min-w-0">
              <span className="text-xs font-bold text-white">Google Drive</span>
              <span className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1.5">
                {backupMode === 'drive' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
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
      <div className="flex-1 flex flex-col p-6 overflow-y-auto relative bg-neutral-900/5">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 z-10"
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
                <div className="w-11 h-11 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
                  <FiHardDrive size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Local data</h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">On this device</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--color-textSecondary)] text-left leading-relaxed">
                All your workspace data stays on this device and is accessible only to you.
              </p>

              {/* Details table */}
              <div className="space-y-3 pt-2 text-left">
                <h5 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Details</h5>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                    <span className="text-neutral-400">Last backup</span>
                    <span className="text-neutral-200 font-medium">
                      {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + lastSyncedAt.toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                    <span className="text-neutral-400">Backup location</span>
                    <span className="text-neutral-200 font-mono text-[10px]">{activeWorkspacePath}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                    <span className="text-neutral-400">Size</span>
                    <span className="text-neutral-200 font-medium">{dbSizeStr}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-4">
                <button
                  onClick={handleBackupNow}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  <FiRefreshCw size={13} />
                  <span>Restore backup</span>
                </button>
                <button
                  onClick={handleDownloadBackup}
                  disabled={isSyncing || isRestoring}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  <FiDownload size={13} />
                  <span>Export backup</span>
                </button>
              </div>
            </div>

            {/* Privacy Shield Card */}
            <div className="border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left mt-8">
              <div className="flex items-center gap-3">
                <FiShield className="text-neutral-400 shrink-0" size={18} />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-white">Your data is private and secure</div>
                  <div className="text-[9px] text-neutral-400 mt-0.5 truncate">Backups are encrypted and never shared.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Google Drive details pane */}
        {backupMode === 'drive' && (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-6">
              {/* Header block */}
              <div className="flex items-center gap-3 text-left mt-2">
                <div className="w-11 h-11 rounded-xl bg-neutral-800 flex items-center justify-center border border-neutral-700/30 overflow-hidden shrink-0">
                  <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M19.3496 14.6504L13.9996 4.3999L9.99961 4.3999L15.3496 14.6504H19.3496Z" fill="#FFC107" />
                    <path d="M9.99961 4.3999L4.64961 14.6504L6.64961 18.1504L11.9996 7.8999L9.99961 4.3999Z" fill="#00E676" />
                    <path d="M15.3496 14.6504L11.9996 18.1504L6.64961 18.1504L9.99961 14.6504L15.3496 14.6504Z" fill="#2196F3" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Google Drive</h4>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {isConnected && userEmail ? userEmail : 'Not connected'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--color-textSecondary)] text-left leading-relaxed">
                All your workspace data is stored privately in your personal Google Drive and is accessible only to you.
              </p>

              {isConnected ? (
                <>
                  {/* Details table */}
                  <div className="space-y-3 pt-2 text-left">
                    <h5 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Details</h5>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                        <span className="text-neutral-400">Last backup</span>
                        <span className="text-neutral-200 font-medium">
                          {lastSyncedAt ? lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + lastSyncedAt.toLocaleDateString() : 'Never'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                        <span className="text-neutral-400">Backup folder</span>
                        <span className="text-neutral-200 font-mono text-[10px]">
                          {backups.length > 0 ? backups[0].name : 'Google Drive (App Data Folder)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-neutral-800/40 pb-2">
                        <span className="text-neutral-400">Size</span>
                        <span className="text-neutral-200 font-medium">{dbSizeStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Auto backup option */}
                  <div className="flex items-center justify-between px-4 mt-4 mb-2 bg-[var(--color-hoverBg)] p-2.5 rounded-lg border border-[var(--color-borderDefault)] text-left">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Auto-backup</span>
                      <span className="text-[10px] text-[var(--color-textMuted)]">Triggers every 8 hours</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={isAutoBackupEnabled}
                        onChange={handleToggleAutoBackup}
                      />
                      <div className="w-8 h-4 bg-neutral-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-4">
                    <button
                      onClick={handleBackupNow}
                      disabled={isSyncing || isRestoring}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white font-semibold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                    >
                      {isSyncing ? (
                        <>
                          <FiRefreshCw className="animate-spin" size={13} />
                          <span>Syncing...</span>
                        </>
                      ) : (
                        <>
                          <FiUpload size={13} />
                          <span>Back up now</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRestoreFromDrive}
                      disabled={isSyncing || isRestoring || backups.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <FiRefreshCw size={13} />
                      <span>Restore backup</span>
                    </button>
                    <button
                      onClick={handleDownloadBackup}
                      disabled={isSyncing || isRestoring}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--color-hoverBg)] text-white font-semibold rounded-xl border border-[var(--color-borderDefault)] transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      <FiDownload size={13} />
                      <span>Export backup</span>
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={isSyncing || isRestoring}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-semibold rounded-xl border border-red-500/20 transition-all text-xs cursor-pointer disabled:opacity-50 mt-4"
                    >
                      Disconnect Drive
                    </button>
                  </div>
                </>
              ) : (
                <div className="pt-6">
                  <button
                    onClick={handleConnect}
                    disabled={isSyncing || isRestoring}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-md text-xs cursor-pointer border-none"
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}
            </div>

            {/* Privacy Shield Card */}
            <div className="border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)]/20 rounded-xl p-3.5 flex items-center justify-between gap-3 text-left mt-8">
              <div className="flex items-center gap-3">
                <FiShield className="text-neutral-400 shrink-0" size={18} />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-white">Your data is private and secure</div>
                  <div className="text-[9px] text-neutral-400 mt-0.5 truncate">Backups are encrypted and never shared.</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
        {showCreateOrg && (
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

