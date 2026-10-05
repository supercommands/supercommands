import * as React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useDbStore } from '../../storage/store/useDbStore';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronDown, FiChevronRight, FiX, FiRefreshCw, FiCheck, FiList, FiSettings, FiDatabase, FiCloud, FiHardDrive, FiFolder, FiFileText, FiLogOut, FiLink, FiTerminal, FiTrash2, } from 'react-icons/fi';
import { FaUser, FaPalette, FaGithub, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { BRAND } from '../../shared-components/brandingConfig';
import { BsCalendarCheck } from 'react-icons/bs';
import { FiCreditCard, FiSearch, FiPlus } from 'react-icons/fi';
import CreateOrganisationPanel from './organisations/ui/CreateOrganisationPanel';
import type { OrganisationData } from './organisations/organisationTypes';
import { deleteOrganisation } from './organisations/organisationData';
import DeleteConfirmation from '../../shared-components/modals/deleteDialog';
import NotesIcon from '../../shared-components/icons/notesIcon';
import { CUnderscoreIcon } from '../../shared-components/icons/cUnderscoreIcon';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { SessionGridIcon } from '../../shared-components/icons/sessionGridIcon';
interface AllOrganisationsPanelProps {
    onClose: () => void;
    hideSidebar?: boolean;
}
interface OrganisationRowData {
    id: string;
    name: string;
    storageMode: 'local' | 'cloud';
    path: string;
    todosCount: number;
    notesCount: number;
    linksCount: number;
    snippetsCount: number;
    sessionsCount: number;
    chatAgentsCount: number;
    sizeEstimate: string;
    lastSync: string;
    lastBackup: string;
    organisation: OrganisationData;
}
const formatRelativeTime = (timestamp: number | undefined): string => {
    if (!timestamp)
        return 'Never';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    if (diffSecs < 60)
        return 'Just now';
    if (diffMins < 60)
        return `${diffMins}m ago`;
    if (diffHours < 24) {
        return `${diffHours}${diffHours === 1 ? 'hr' : 'hrs'} ago`;
    }
    const dateObj = new Date(timestamp);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const exportBackup = async (_options?: {
    organisationId?: string;
}) => {
    console.warn('[AllOrganisationsPanel] Backup subsystem removed.');
};
const validateBackup = (_raw: unknown): {
    valid: false;
    error: string;
    payload: null;
} => ({
    valid: false,
    error: 'Backup subsystem removed.',
    payload: null,
});
const previewSmartRestore = async (_payload: unknown): Promise<{
    success: false;
    error: string;
}> => ({
    success: false,
    error: 'Backup subsystem removed.',
});
export const AllOrganisationsPanel: React.FC<AllOrganisationsPanelProps> = ({ onClose, hideSidebar }) => {
    const dbOrganisations = useDbStore(state => state.organisations);
    const dbNotes = useDbStore(state => state.notes);
    const dbLinks = useDbStore(state => state.links);
    const dbSnippets = useDbStore(state => state.snippets);
    const dbTodos = useDbStore(state => state.todos);
    const dbChatAgents = useDbStore(state => state.chatAgents);
    const dbSessions = useDbStore(state => state.sessions);
    // Expanded row state tracking (workspace ID -> boolean)
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [userInitials, setUserInitials] = useState<string>('ME');
    const [userInfo, setUserInfo] = useState<{
        email: string;
        name: string;
        image_url?: string;
    } | null>(null);
    const [wsToDelete, setWsToDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const handleDeleteOrganisationClick = useCallback((e: React.MouseEvent, ws: {
        id: string;
        name: string;
    }, totalOrganisations: number) => {
        e.stopPropagation();
        if (totalOrganisations <= 1) {
            alert("At least one organisation must remain. You cannot delete the last organisation.");
            return;
        }
        setWsToDelete(ws);
        setIsDeleteModalOpen(true);
    }, []);
    const handleConfirmDeleteOrganisation = useCallback(async () => {
        if (!wsToDelete)
            return;
        try {
            await deleteOrganisation(wsToDelete.id);
        }
        catch (err) {
            console.error('[AllOrganisationsPanel] Failed to delete organisation:', err);
        }
        finally {
            setIsDeleteModalOpen(false);
            setWsToDelete(null);
        }
    }, [wsToDelete]);
    const [backupTimestamps, setBackupTimestamps] = useState<Record<string, number>>({});
    const [syncTimestamps, setSyncTimestamps] = useState<Record<string, number>>({});
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
                    }
                    else if (key.startsWith('last_sync_time_')) {
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
    const handleBackupClick = async (organisationId: string) => {
        try {
            await exportBackup({ organisationId });
            const now = Date.now();
            const chromeAny = (window as any).chrome;
            if (chromeAny?.storage?.local) {
                chromeAny.storage.local.set({ [`last_backup_time_${organisationId}`]: now });
            }
            setBackupTimestamps(prev => ({
                ...prev,
                [organisationId]: now
            }));
        }
        catch (e) {
            console.error('[AllOrganisationsPanel] Failed to run backup:', e);
        }
    };
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
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
            const confirmRestore = window.confirm('Are you sure you want to restore this backup? This will overwrite your local organizations and restore settings.');
            if (!confirmRestore)
                return;
            const result = await previewSmartRestore(validation.payload);
            if (result.success) {
                alert('Backup restored successfully!');
            }
            else {
                alert(result.error ?? 'Restore failed.');
            }
        }
        catch (err: any) {
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
    const organisationsList = useMemo<OrganisationRowData[]>(() => {
        const list: OrganisationRowData[] = [];
        dbOrganisations.forEach((organisation, index) => {
            const wsId = String(organisation.id);
            const isFirstWs = index === 0;
            const matchesWs = (itemWsId: string | null | undefined) => {
                if (!itemWsId)
                    return isFirstWs;
                return String(itemWsId) === wsId;
            };
            const notesCount = dbNotes.filter(n => matchesWs(n.organisationId)).length;
            const linksCount = dbLinks.filter(l => matchesWs(l.organisationId)).length;
            const snippetsCount = dbSnippets.filter(s => matchesWs(s.organisationId)).length;
            const todosCount = dbTodos.filter(t => matchesWs((t as any).organisationId)).length;
            const sessionsCount = dbSessions.filter(s => matchesWs(s.organisationId)).length;
            const chatAgentsCount = dbChatAgents.filter(c => matchesWs((c as any).organisationId)).length;
            const totalItems = notesCount + linksCount + snippetsCount + todosCount + sessionsCount + chatAgentsCount;
            const sizeKB = Math.max(10, totalItems * 8.5);
            const sizeEstimate = sizeKB > 1024
                ? `${(sizeKB / 1024).toFixed(1)} MB`
                : `${sizeKB.toFixed(0)} KB`;
            const wsBackupTime = backupTimestamps[wsId];
            const wsSyncTime = syncTimestamps[wsId];
            const lastBackup = wsBackupTime ? formatRelativeTime(wsBackupTime) : 'Never';
            const lastSync = wsSyncTime ? formatRelativeTime(wsSyncTime) : '—';
            const wsSlug = (organisation.organisationName || 'organisation').toLowerCase().replace(/\s+/g, '-');
            const path = `/local/${wsSlug}`;
            list.push({
                id: wsId,
                name: organisation.organisationName || 'Organisation',
                storageMode: 'local',
                path,
                todosCount,
                notesCount,
                linksCount,
                snippetsCount,
                sessionsCount,
                chatAgentsCount,
                sizeEstimate,
                lastSync,
                lastBackup,
                organisation,
            });
        });
        return list;
    }, [dbOrganisations, dbNotes, dbLinks, dbSnippets, dbTodos, dbSessions, dbChatAgents, backupTimestamps, syncTimestamps]);
    const sidebarSections = [
        {
            title: 'ORGANIZATION',
            items: [
                { id: 'organisations', label: 'All Organisations', icon: FiList, active: true, onClick: undefined }
            ],
        },
        {
            title: 'UX APPEARANCE',
            items: [
                { id: 'appearance', label: 'Theme', icon: FaPalette, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'appearance' }) },
                { id: 'searchView', label: 'Settings', icon: FiSearch, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'searchView' }) }
            ],
        }
    ];
    const globalPopups = (<>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden"/>

      {/* Organization/workspace creation is only allowed from onboarding for now. */}
      {false}
    </>);
    if (hideSidebar) {
        return (<>
        <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden bg-[var(--color-editorBg)]/20 relative">
        {globalPopups}
        {/* Header bar */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <div></div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95" title="Close">
            <FiX size={16}/>
          </button>
        </div>

        {/* Workspaces List/Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="w-full border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] rounded-xl overflow-hidden">

            {/* Table Header */}
            <div className="grid grid-cols-[1.4fr_1.8fr] border-b border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] py-3 px-4 text-xs font-semibold text-[var(--color-textMuted)] select-none">
              <div>Organisation</div>
              <div>Location  / Source</div>
            </div>

            {/* Table Body */}
            {organisationsList.length === 0 ? (<div className="py-12 text-center text-xs text-neutral-500">
                No organizations found.
              </div>) : (<div className="divide-y divide-[var(--color-borderDefault)]">
                {organisationsList.map(ws => {
                    const isExpanded = !!expandedRows[ws.id];
                    return (<div key={ws.id} className="flex flex-col w-full transition-colors hover:bg-[var(--color-hoverBg)]">

                      {/* Collapsible Row Header */}
                      <div onClick={() => toggleRow(ws.id)} className="relative grid grid-cols-[1.4fr_1.8fr] py-4 pl-4 pr-14 text-xs items-center cursor-pointer select-none">
                        {/* Workspace Name & Chevron */}
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-[var(--color-textMuted)]">
                            {isExpanded ? <FiChevronDown size={14}/> : <FiChevronRight size={14}/>}
                          </span>
                          <span className="font-semibold text-[var(--color-textPrimary)] truncate">
                            {ws.name}
                          </span>
                        </div>
                        {/* Location / Source */}
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {ws.storageMode === 'cloud' ? <FiCloud className="w-4 h-4 text-blue-400 shrink-0"/> : <FiDatabase className="w-4 h-4 shrink-0"/>}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-[var(--color-textPrimary)] truncate">
                              {ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}
                            </span>
                            <span className="text-[10px] text-[var(--color-textMuted)] truncate font-mono mt-0.5">
                              {ws.path}
                            </span>
                          </div>
                        </div>

                        {/* Delete Icon (Positioned Absolutely on Far Right) */}
                        <button type="button" onClick={e => handleDeleteOrganisationClick(e, ws, organisationsList.length)} disabled={organisationsList.length <= 1} className={`absolute right-3.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg transition-all ${organisationsList.length <= 1
                            ? 'text-[var(--color-textDisabled)] opacity-50 cursor-not-allowed'
                            : 'text-[var(--color-iconDefault)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 cursor-pointer'}`} title={organisationsList.length <= 1 ? 'Cannot delete the only remaining organisation' : 'Delete Organisation'}>
                          <FiTrash2 size={16}/>
                        </button>
                      </div>

                      {/* Collapsible Details Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-[var(--color-hoverBg)] border-t border-[var(--color-borderDefault)]">
                            <div className="flex flex-col p-5 select-none gap-6 text-xs text-left">
                              {/* Top Content Row */}
                              <div className="grid grid-cols-2 gap-6">
                                {/* 1. Included Items */}
                                <div className="space-y-4 border-r border-[var(--color-borderDefault)] pr-4">
                                  <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                                    Included Items
                                  </h4>
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Todo</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.todosCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
                                        <span>Notes</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.notesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <FaLink size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Links</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.linksCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <CUnderscoreIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Text Expander</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.snippetsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <SessionGridIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Tab Sessions</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.sessionsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Chat Agents</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.chatAgentsCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Location / Source */}
                                <div className="space-y-4 border-r border-[var(--color-borderDefault)] pr-4">
                                  <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                                    Location / Source
                                  </h4>
                                  <div className="space-y-3 text-[var(--color-textPrimary)]">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-[var(--color-textMuted)] uppercase tracking-wider font-semibold">Organisation</span>
                                      <span className="font-mono break-all">{ws.path}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-[var(--color-textMuted)] uppercase tracking-wider font-semibold">Type</span>
                                      <span>{ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </motion.div>)}
                      </AnimatePresence>

                    </div>);
                })}
              </div>)}

          </div>

          {/* Organization/workspace creation is only allowed from onboarding for now.
                            Previously rendered the Create Organization button here. */}
          {/*
                          <div className="w-full flex justify-center pt-2">
                            <button
                              onClick={() => setShowCreateOrg(true)}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[var(--color-inputBg)] hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                              <FiPlus size={14} className="text-[var(--color-accent)]" />
                              <span className="text-[var(--color-textPrimary)]">Create Organization</span>
                            </button>
                          </div>
                        */}

        </div>
      </div>

      <DeleteConfirmation isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDeleteOrganisation} title={`Delete Organisation "${wsToDelete?.name || ''}"`} description="Are you sure you want to delete this organisation? All associated notes, links, snippets will be deleted permanently. This action cannot be undone." zIndex={100005}/>
    </>);
    }
    return (<div className={hideSidebar ? "flex-1 flex flex-col min-w-0 h-full min-h-0 relative" : "flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200 relative"}>
      {globalPopups}

      {/* LEFT SIDEBAR */}
      {!hideSidebar && (<div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-3.5 flex flex-col justify-between">
          <div className="space-y-4">
            <nav className="space-y-4">
              {sidebarSections.map(section => (<div key={section.title} className="space-y-1.5">
                  <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                    {section.title}
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map(item => {
                    const Icon = item.icon;
                    const isDanger = 'isDanger' in item && item.isDanger;
                    return (<div key={item.id} onClick={item.onClick ?? undefined} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${item.active
                            ? 'text-[var(--color-textPrimary)] bg-[var(--color-selectedBg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                            : isDanger
                                ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
                                : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                          <Icon size={14} className={isDanger ? 'text-red-500' : 'text-neutral-500'}/>
                          <span>{item.label}</span>
                        </div>);
                })}
                  </div>
                </div>))}
            </nav>
          </div>

          <div className="flex flex-col gap-2.5 w-full mt-auto pt-2">

            <a href="https://github.com/supercommands/supercommands" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer group hover:bg-[var(--color-hoverBg)] transition-colors text-left w-full">
                    <FaGithub size={14} className="text-neutral-500 shrink-0"/>
                    <div className="min-w-0 flex-grow">
                      <div className="text-xs font-semibold text-[var(--color-textPrimary)]">GitHub</div>
                    </div>
                  </a>

            {/* Social Icons Connect Section */}
            <div className="flex flex-col gap-1 w-full shrink-0 border-t border-white/5 pt-2">
              <div className="text-[9px] font-bold text-neutral-400 tracking-wider text-left uppercase opacity-80 px-0.5">
                Connect
              </div>
              <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-0.5 px-0.5">
                <a href={BRAND.social.slack} target="_blank" rel="noopener noreferrer" title="Slack" onPointerDown={e => e.stopPropagation()} className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                  <img src={getFaviconUrl('slack.com')} className="w-[18px] h-[18px] rounded-sm" alt="Slack"/>
                </a>
                <a href={BRAND.social.reddit} target="_blank" rel="noopener noreferrer" title="Reddit" onPointerDown={e => e.stopPropagation()} className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                  <img src={getFaviconUrl('reddit.com')} className="w-[18px] h-[18px] rounded-sm" alt="Reddit"/>
                </a>
                <a href={BRAND.social.twitter} target="_blank" rel="noopener noreferrer" title="X" onPointerDown={e => e.stopPropagation()} className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                  <img src={getFaviconUrl('x.com')} className="w-[18px] h-[18px] rounded-sm" alt="X"/>
                </a>
              </div>
            </div>

          </div>
        </div>)}

      {/* RIGHT CONTENT PANE */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-editorBg)]/20 relative">
        <div className="flex items-center justify-end pt-4 px-6 pb-0 shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95" title="Close">
            <FiX size={16}/>
          </button>
        </div>

        {/* Workspaces List/Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2 space-y-5">
          <div className="w-full border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] rounded-xl overflow-hidden">

            {/* Table Header */}
            <div className="grid grid-cols-[1.4fr_1.8fr] border-b border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] py-3 px-4 text-xs font-semibold text-[var(--color-textMuted)] select-none">
              <div>Organisation</div>
              <div>Location / Source</div>
            </div>

            {/* Table Body */}
            {organisationsList.length === 0 ? (<div className="py-12 text-center text-xs text-neutral-500">
                No organizations found.
              </div>) : (<div className="divide-y divide-[var(--color-borderDefault)]">
                {organisationsList.map(ws => {
                const isExpanded = !!expandedRows[ws.id];
                return (<div key={ws.id} className="flex flex-col w-full transition-colors hover:bg-[var(--color-hoverBg)]">

                      {/* Collapsible Row Header */}
                      <div onClick={() => toggleRow(ws.id)} className="relative grid grid-cols-[1.4fr_1.8fr] py-4 pl-4 pr-14 text-xs items-center cursor-pointer select-none">
                        {/* Workspace Name & Chevron */}
                        <div className="flex items-center gap-2 pr-2">
                          <span className="text-[var(--color-textMuted)]">
                            {isExpanded ? <FiChevronDown size={14}/> : <FiChevronRight size={14}/>}
                          </span>
                          <span className="font-semibold text-[var(--color-textPrimary)] truncate">
                            {ws.name}
                          </span>
                        </div>
                        {/* Location / Source */}
                        <div className="flex items-center gap-1.5 pr-2 min-w-0">
                          {ws.storageMode === 'cloud' ? <FiCloud className="w-4 h-4 text-blue-400 shrink-0"/> : <FiDatabase className="w-4 h-4 shrink-0"/>}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-[var(--color-textPrimary)] truncate">
                              {ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}
                            </span>
                            <span className="text-[10px] text-[var(--color-textMuted)] truncate font-mono mt-0.5">
                              {ws.path}
                            </span>
                          </div>
                        </div>

                        {/* Delete Icon (Positioned Absolutely on Far Right) */}
                        <button type="button" onClick={e => handleDeleteOrganisationClick(e, ws, organisationsList.length)} disabled={organisationsList.length <= 1} className={`absolute right-3.5 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-lg transition-all ${organisationsList.length <= 1
                        ? 'text-[var(--color-textDisabled)] opacity-50 cursor-not-allowed'
                        : 'text-[var(--color-iconDefault)] hover:text-red-400 hover:bg-red-500/10 active:scale-95 cursor-pointer'}`} title={organisationsList.length <= 1 ? 'Cannot delete the only remaining organisation' : 'Delete Organisation'}>
                          <FiTrash2 size={16}/>
                        </button>
                      </div>

                      {/* Collapsible Details Panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-[var(--color-hoverBg)] border-t border-[var(--color-borderDefault)]">
                            <div className="flex flex-col p-5 select-none gap-6 text-xs text-left">
                              {/* Top Content Row */}
                              <div className="grid grid-cols-2 gap-6">
                                {/* 1. Included Items */}
                                <div className="space-y-4 border-r border-[var(--color-borderDefault)] pr-4">
                                  <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                                    Included Items
                                  </h4>
                                  <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Todo</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.todosCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
                                        <span>Notes</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.notesCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <FaLink size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Links</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.linksCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <CUnderscoreIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Text Expander</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.snippetsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <SessionGridIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Tab Sessions</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.sessionsCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5 text-[var(--color-textPrimary)]">
                                        <LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                        <span>Chat Agents</span>
                                      </div>
                                      <span className="font-mono text-[var(--color-textSecondary)]">{ws.chatAgentsCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 2. Location / Source */}
                                <div className="space-y-4 border-r border-[var(--color-borderDefault)] pr-4">
                                  <h4 className="font-bold text-[var(--color-textMuted)] uppercase tracking-wider text-[10px]">
                                    Location / Source
                                  </h4>
                                  <div className="space-y-3 text-[var(--color-textPrimary)]">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-[var(--color-textMuted)] uppercase tracking-wider font-semibold">Organisation</span>
                                      <span className="font-mono break-all">{ws.path}</span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] text-[var(--color-textMuted)] uppercase tracking-wider font-semibold">Type</span>
                                      <span>{ws.storageMode === 'cloud' ? 'Cloud' : 'Local Drive'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </motion.div>)}
                      </AnimatePresence>

                    </div>);
            })}
              </div>)}

          </div>

          {/* Organization/workspace creation is only allowed from onboarding for now.
Previously rendered the Create Organization button here. */}
          {/*
<div className="w-full flex justify-center pt-2">
<button
  onClick={() => setShowCreateOrg(true)}
  className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[var(--color-inputBg)] hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] transition-all shadow-sm active:scale-95 cursor-pointer"
>
  <FiPlus size={14} className="text-[var(--color-accent)]" />
  <span className="text-[var(--color-textPrimary)]">Create Organization</span>
</button>
</div>
*/}

        </div>
      </div>

      <DeleteConfirmation isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDeleteOrganisation} title={`Delete Organisation "${wsToDelete?.name || ''}"`} description="Are you sure you want to delete this organisation? All associated notes, links, snippets will be deleted permanently. This action cannot be undone." zIndex={100005}/>
    </div>);
};
export default AllOrganisationsPanel;
