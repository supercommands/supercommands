import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useDbStore } from '../../storage/store/useDbStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiChevronDown,
  FiChevronRight,
  FiX,
  FiRefreshCw,
  FiCheck,
  FiList,
  FiSettings,
  FiDatabase,
  FiCloud,
  FiHardDrive,
  FiFolder,
  FiFileText,
  FiZap,
  FiLogOut,
  FiLink,
  FiTerminal,
} from 'react-icons/fi';
import { FaUser, FaPalette, FaGithub } from 'react-icons/fa';
import { FiCreditCard, FiSearch, FiPlus } from 'react-icons/fi';
import CreateWorkspacePanel from './workspaces/ui/CreateWorkspacePanel';
import type { WorkspaceData } from './workspaces/workspaceTypes';

import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { FEATURE_FLAGS } from '../../pages/AltS_search_newtab/src/utils/featureFlags';
import { CMDOS_SIGN_UP_URL } from '../../storage/API/core/api';

interface AllWorkspacesPanelProps {
  onClose: () => void;
  hideSidebar?: boolean;
}

interface WorkspaceRowData {
  id: string;
  name: string;
  storageMode: 'local' | 'cloud';
  path: string;
  todosCount: number;
  automationsCount: number;
  notesCount: number;
  linksCount: number;
  snippetsCount: number;
  sizeEstimate: string;
  lastSync: string;
  lastBackup: string;
  workspace: WorkspaceData;
}

const formatRelativeTime = (timestamp: number | undefined): string => {
  if (!timestamp) return 'Never';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) {
    return `${diffHours}${diffHours === 1 ? 'hr' : 'hrs'} ago`;
  }

  const dateObj = new Date(timestamp);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const exportBackup = async (_options?: { workspaceId?: string }) => {
  console.warn('[AllWorkspacesPanel] Backup subsystem removed.');
};

const validateBackup = (_raw: unknown): { valid: false; error: string; payload: null } => ({
  valid: false,
  error: 'Backup subsystem removed.',
  payload: null,
});

const previewSmartRestore = async (_payload: unknown): Promise<{ success: false; error: string }> => ({
  success: false,
  error: 'Backup subsystem removed.',
});

export const AllWorkspacesPanel: React.FC<AllWorkspacesPanelProps> = ({ onClose, hideSidebar }) => {
  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);

  // Expanded row state tracking (workspace ID -> boolean)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [userInitials, setUserInitials] = useState<string>('ME');
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string } | null>(null);

  const [backupTimestamps, setBackupTimestamps] = useState<Record<string, number>>({});
  const [syncTimestamps, setSyncTimestamps] = useState<Record<string, number>>({});
  const [isCloudUser, setIsCloudUser] = useState<boolean>(false);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(null, (allData: any) => {
        const backups: Record<string, number> = {};
        const syncs: Record<string, number> = {};
        const updatesToSave: Record<string, number> = {};
        const now = Date.now();

        Object.keys(allData || {}).forEach(key => {
          if (key.startsWith('last_backup_time_')) {
            const wsId = key.replace('last_backup_time_', '');
            backups[wsId] = allData[key];
          } else if (key.startsWith('last_sync_time_')) {
            const wsId = key.replace('last_sync_time_', '');
            syncs[wsId] = allData[key];
          }
        });

        if (Object.keys(updatesToSave).length > 0) {
          chromeAny.storage.local.set(updatesToSave);
        }

        setBackupTimestamps(backups);
        setSyncTimestamps(syncs);
      });
    }
  }, []);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['user_info', 'user_name', 'accessToken'], (res: any) => {
        const name = res.user_info?.name || res.user_name || 'Me';
        const parts = name.split(/\s+/);
        const initials = parts.filter(Boolean).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
        if (initials) {
          setUserInitials(initials);
        }
        if (res.user_info) {
          setUserInfo(res.user_info);
        } else if (res.user_name) {
          setUserInfo({ name: res.user_name, email: 'user@cmdos.dev' });
        }
        const token = res.accessToken;
        if (token && typeof token === 'string' && token.startsWith('user_')) {
          setIsCloudUser(true);
        }
      });
    }
  }, []);

  const handleBackupClick = async (workspaceId: string) => {
    try {
      await exportBackup({ workspaceId });
      const now = Date.now();
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ [`last_backup_time_${workspaceId}`]: now });
      }
      setBackupTimestamps(prev => ({
        ...prev,
        [workspaceId]: now
      }));
    } catch (e) {
      console.error('[AllWorkspacesPanel] Failed to run backup:', e);
    }
  };

  const [showCreateOrg, setShowCreateOrg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so the same file can be selected again
    e.target.value = '';

    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const validation = validateBackup(raw);

      if (!validation.valid || !validation.payload) {
        alert(validation.error ?? 'Invalid backup file.');
        return;
      }

      const confirmRestore = window.confirm(
        'Are you sure you want to restore this backup? This will overwrite your local organizations and restore settings.'
      );
      if (!confirmRestore) return;

      const result = await previewSmartRestore(validation.payload);
      if (result.success) {
        alert('Backup restored successfully!');
      } else {
        alert(result.error ?? 'Restore failed.');
      }
    } catch (err: any) {
      alert('Could not read the file. Make sure it is a valid backup JSON.');
    }
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Map Dexie workspace data to row models — counts come directly from the live store collections
  const workspacesList = useMemo<WorkspaceRowData[]>(() => {
    const list: WorkspaceRowData[] = [];

    dbWorkspaces.forEach((workspace) => {
      const wsId = String(workspace.id);

      const notesCount = dbNotes.filter(n => String(n.workspaceId) === wsId).length;
      const linksCount = dbLinks.filter(l => String(l.workspaceId) === wsId).length;
      const snippetsCount = dbSnippets.filter(s => String(s.workspaceId) === wsId).length;
      // Todos and automations are global (no workspaceId) so they cannot be filtered per-workspace
      const todosCount = 0;
      const automationsCount = 0;

      const totalItems = notesCount + linksCount + snippetsCount;
      const sizeKB = Math.max(10, totalItems * 8.5);
      const sizeEstimate = sizeKB > 1024
        ? `${(sizeKB / 1024).toFixed(1)} MB`
        : `${sizeKB.toFixed(0)} KB`;

      const wsBackupTime = backupTimestamps[wsId];
      const wsSyncTime = syncTimestamps[wsId];

      const lastBackup = wsBackupTime ? formatRelativeTime(wsBackupTime) : 'Never';
      const lastSync = wsSyncTime ? formatRelativeTime(wsSyncTime) : '—';

      const wsSlug = (workspace.workspaceName || 'workspace').toLowerCase().replace(/\s+/g, '-');
      const path = `/local/${wsSlug}`;

      list.push({
        id: wsId,
        name: workspace.workspaceName || 'Workspace',
        storageMode: 'local',
        path,
        todosCount,
        automationsCount,
        notesCount,
        linksCount,
        snippetsCount,
        sizeEstimate,
        lastSync,
        lastBackup,
        workspace,
      });
    });

    return list;
  }, [dbWorkspaces, dbFolders, dbNotes, dbLinks, dbSnippets, backupTimestamps, syncTimestamps]);

  const handleLogout = async () => {
    const chromeAny = (window as any)?.chrome;
    const storedResult = await new Promise<{ accessToken?: string }>(resolve => {
      if (chromeAny?.storage?.local?.get) {
        chromeAny.storage.local.get('accessToken', (res: any) => resolve(res || {}));
      } else {
        resolve({});
      }
    });
    const userId = storedResult?.accessToken;
    if (userId && typeof userId === 'string' && userId.startsWith('user_')) {

    }
    if (chromeAny?.storage?.local) {
      const KEYS_TO_REMOVE = [
        'accessToken',
        'profileImg',
        'loggedIn',
        'user_name',
        'user_email',
        'orgRefreshCounters',
        'last_org_counter_check_timestamp',
        'last_org_counter_check_result',
      ];
      chromeAny.storage.local.remove(KEYS_TO_REMOVE, () => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  const sidebarSections = [
    // ACCOUNT section: only shown for cloud (logged-in) users
    ...(isCloudUser ? [{
      title: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile', icon: FaUser, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'profile' }) },
        { id: 'logout', label: 'Logout', icon: FiLogOut, active: false, onClick: handleLogout, isDanger: true },
      ],
    }] : []),
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: true, onClick: undefined },
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'appearance' }) },
        { id: 'searchView', label: 'Settings', icon: FiSearch, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'searchView' }) },
      ],
    },
  ];



  const LocalFolderIcon = () => (
    <svg className="w-4 h-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );

  const globalPopups = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {showCreateOrg && (
        <div
          className="absolute inset-0 z-50 flex items-start pt-[15vh] justify-center  backdrop-blur-sm"
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
    </>
  );

  if (hideSidebar) {
    return (
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden bg-[var(--color-editorBg)]/20 relative">
        {globalPopups}
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <div></div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Workspaces List/Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="w-full border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] rounded-xl overflow-hidden">

            {/* Table Header */}
            <div className="grid grid-cols-[1.4fr_1.8fr] border-b border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] py-3 px-4 text-xs font-semibold text-[var(--color-textMuted)] select-none">
              <div>Workspace</div>
              <div>Location  / Source</div>
            </div>

            {/* Table Body */}
            {workspacesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No workspaces found.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-borderDefault)]">
                {workspacesList.map(ws => {
                  const isExpanded = !!expandedRows[ws.id];

                  return (
                    <div key={ws.id} className="flex flex-col w-full transition-colors hover:bg-[var(--color-hoverBg)]">

                      {/* Collapsible Row Header */}
                      <div
                        onClick={() => toggleRow(ws.id)}
                        className="grid grid-cols-[1.4fr_1.8fr] py-4 px-4 text-xs items-center cursor-pointer select-none"
                      >
                        {/* Workspace Name & Chevron */}
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-[var(--color-textMuted)]">
                            {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                          </span>
                          <span className="font-semibold text-[var(--color-textPrimary)] truncate">
                            {ws.name}
                          </span>
                        </div>
                        {/* Location / Source */}
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {ws.storageMode === 'cloud' ? <FiCloud className="w-4 h-4 text-blue-400 shrink-0" /> : <LocalFolderIcon />}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-neutral-200 truncate">
                              {ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}
                            </span>
                            <span className="text-[10px] text-neutral-500 truncate font-mono mt-0.5">
                              {ws.path}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Details Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-[var(--color-hoverBg)] border-t border-[var(--color-borderDefault)]"
                          >
                            <div className="flex flex-col p-5 select-none gap-6 text-xs text-left">
                              {/* Top Content Row */}
                              <div className="grid grid-cols-2 gap-6">
                                {/* 1. Included Items */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Included Items
                                  </h4>
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiCheck size={14} className="text-neutral-500 shrink-0" />
                                        <span>Todos</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.todosCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiFileText size={14} className="text-neutral-500 shrink-0" />
                                        <span>Notes</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.notesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiLink size={14} className="text-neutral-500 shrink-0" />
                                        <span>Links</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.linksCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiTerminal size={14} className="text-neutral-500 shrink-0" />
                                        <span>Snippets</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.snippetsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiZap size={14} className="text-neutral-500 shrink-0" />
                                        <span>Automations</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.automationsCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Location / Source */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Location / Source
                                  </h4>
                                  <div className="space-y-3 text-neutral-300">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Folder</span>
                                      <span className="font-mono break-all">{ws.path}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Type</span>
                                      <span>{ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Centered Create Organization Action Row (OUTSIDE table container) */}
          <div className="w-full flex justify-center pt-2">
            <button
              onClick={() => setShowCreateOrg(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FiPlus size={14} className="text-indigo-400" />
              <span>Create Organization</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className={hideSidebar ? "flex-1 flex flex-col min-w-0 h-full min-h-0 relative" : "flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200 relative"}>
      {globalPopups}

      {/* LEFT SIDEBAR */}
      {!hideSidebar && (
        <div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-3.5 flex flex-col justify-between">
          <div className="space-y-4">
            <nav className="space-y-4">
              {sidebarSections.map(section => (
                <div key={section.title} className="space-y-1.5">
                  <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const isDanger = 'isDanger' in item && item.isDanger;
                      return (
                        <div
                          key={item.id}
                          onClick={item.onClick ?? undefined}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${item.active
                            ? 'text-[var(--color-textPrimary)] bg-[var(--color-selectedBg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            : isDanger
                              ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
                              : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'
                            }`}
                        >
                          <Icon size={14} className={isDanger ? 'text-red-500' : 'text-neutral-500'} />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-2.5 w-full mt-auto pt-2">

            {/* Unified Login & GitHub Card Container */}
            {isCloudUser ? (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 w-full text-left">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                  {userInfo?.image_url ? (
                    <img src={userInfo.image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--color-textPrimary)] truncate">
                    {userInfo?.name || 'User'}
                  </div>
                </div>
                <FiChevronDown size={14} className="text-[var(--color-textMuted)] shrink-0" />
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] rounded-xl p-2 flex flex-col gap-1 shadow-sm">
                  {/* 1. Login Row */}
                  {FEATURE_FLAGS.ENABLE_SHARING && (
                    <>
                      <div 
                        onClick={() => {
                          const chromeAny = (window as any)?.chrome;
                          if (chromeAny?.tabs?.create) {
                            chromeAny.tabs.create({ url: CMDOS_SIGN_UP_URL });
                          } else {
                            window.open(CMDOS_SIGN_UP_URL, '_blank');
                          }
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer group hover:bg-[var(--color-hoverBg)] transition-colors text-left w-full"
                      >
                        <FaUser size={14} className="text-neutral-500 shrink-0" />
                        <div className="min-w-0 flex-grow">
                          <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Login</div>
                        </div>
                        <FiChevronRight size={14} className="text-[var(--color-textMuted)] shrink-0" />
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[var(--color-borderDefault)] my-0.5" />
                    </>
                  )}

                  {/* 2. GitHub Row */}
                  <a
                    href="https://github.com/cmdOS-App/cmdOS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer group hover:bg-[var(--color-hoverBg)] transition-colors text-left w-full"
                  >
                    <FaGithub size={14} className="text-neutral-500 shrink-0" />
                    <div className="min-w-0 flex-grow">
                      <div className="text-xs font-semibold text-[var(--color-textPrimary)]">GitHub</div>
                    </div>
                  </a>
                </div>
              </div>
            )}

            {/* Social Icons Connect Section */}
            <div className="flex flex-col gap-1 w-full shrink-0 border-t border-white/5 pt-2">
              <div className="text-[9px] font-bold text-neutral-400 tracking-wider text-left uppercase opacity-80 px-0.5">
                Connect
              </div>
              <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-0.5 px-0.5">
                <a
                  href="https://cmdos.slack.com/join/shared_invite/zt-3mycapoa9-afKNhqrFiGXAb7GS7zsOhA"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Slack"
                  onPointerDown={e => e.stopPropagation()}
                  className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
                >
                  <img src={getFaviconUrl('slack.com')} className="w-[18px] h-[18px] rounded-sm" alt="Slack" />
                </a>
                <a
                  href="https://www.reddit.com/r/cmdOS/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Reddit"
                  onPointerDown={e => e.stopPropagation()}
                  className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
                >
                  <img src={getFaviconUrl('reddit.com')} className="w-[18px] h-[18px] rounded-sm" alt="Reddit" />
                </a>
                <a
                  href="https://x.com/cmdos_terminal"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="X"
                  onPointerDown={e => e.stopPropagation()}
                  className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
                >
                  <img src={getFaviconUrl('x.com')} className="w-[18px] h-[18px] rounded-sm" alt="X" />
                </a>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* RIGHT CONTENT PANE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
        <div className="flex items-center justify-end pt-4 px-6 pb-0 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Workspaces List/Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-5">
          <div className="w-full border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] rounded-xl overflow-hidden">

            {/* Table Header */}
            <div className="grid grid-cols-[1.4fr_1.8fr] border-b border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] py-3 px-4 text-xs font-semibold text-[var(--color-textMuted)] select-none">
              <div>Workspace</div>
              <div>Location / Source</div>
            </div>

            {/* Table Body */}
            {workspacesList.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No workspaces found.
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-borderDefault)]">
                {workspacesList.map(ws => {
                  const isExpanded = !!expandedRows[ws.id];

                  return (
                    <div key={ws.id} className="flex flex-col w-full transition-colors hover:bg-[var(--color-hoverBg)]">

                      {/* Collapsible Row Header */}
                      <div
                        onClick={() => toggleRow(ws.id)}
                        className="grid grid-cols-[1.4fr_1.8fr] py-4 px-4 text-xs items-center cursor-pointer select-none"
                      >
                        {/* Workspace Name & Chevron */}
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-[var(--color-textMuted)]">
                            {isExpanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                          </span>
                          <span className="font-semibold text-[var(--color-textPrimary)] truncate">
                            {ws.name}
                          </span>
                        </div>
                        {/* Location / Source */}
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {ws.storageMode === 'cloud' ? <FiCloud className="w-4 h-4 text-blue-400 shrink-0" /> : <LocalFolderIcon />}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-neutral-200 truncate">
                              {ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}
                            </span>
                            <span className="text-[10px] text-neutral-500 truncate font-mono mt-0.5">
                              {ws.path}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Collapsible Details Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-[var(--color-hoverBg)] border-t border-[var(--color-borderDefault)]"
                          >
                            <div className="flex flex-col p-5 select-none gap-6 text-xs text-left">
                              {/* Top Content Row */}
                              <div className="grid grid-cols-2 gap-6">
                                {/* 1. Included Items */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Included Items
                                  </h4>
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiCheck size={14} className="text-neutral-500 shrink-0" />
                                        <span>Todos</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.todosCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiFileText size={14} className="text-neutral-500 shrink-0" />
                                        <span>Notes</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.notesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiLink size={14} className="text-neutral-500 shrink-0" />
                                        <span>Links</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.linksCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiTerminal size={14} className="text-neutral-500 shrink-0" />
                                        <span>Snippets</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.snippetsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-neutral-200">
                                        <FiZap size={14} className="text-neutral-500 shrink-0" />
                                        <span>Automations</span>
                                      </div>
                                      <span className="font-mono text-neutral-400">{ws.automationsCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Location / Source */}
                                <div className="space-y-4 border-r border-white/5 pr-4">
                                  <h4 className="font-bold text-neutral-400 uppercase tracking-wider text-[10px]">
                                    Location / Source
                                  </h4>
                                  <div className="space-y-3 text-neutral-300">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Folder</span>
                                      <span className="font-mono break-all">{ws.path}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Type</span>
                                      <span>{ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Centered Create Organization Action Row (OUTSIDE table container) */}
          <div className="w-full flex justify-center pt-2">
            <button
              onClick={() => setShowCreateOrg(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-200 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <FiPlus size={14} className="text-indigo-400" />
              <span>Create Organization</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default AllWorkspacesPanel;
