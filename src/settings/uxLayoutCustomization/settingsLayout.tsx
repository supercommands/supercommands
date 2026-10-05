import * as React from 'react';
import { useUIStore } from '../../shared-components/uiStateManager';
import { FiList, FiSettings, FiLogOut, FiSearch, FiCreditCard, FiChevronDown, FiChevronRight, FiArrowUpRight, FiCloud, FiX, } from 'react-icons/fi';
import { FaUser, FaPalette, FaGithub } from 'react-icons/fa';
import { LuBookOpen } from 'react-icons/lu';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { CMDOS_DOCS_URL, CMDOS_APP_SETTINGS_DOCS_URL } from '../../storage/API/core/apiConfig';
import { BRAND } from '../../shared-components/brandingConfig';
// Sub-panels
import GeneralSettingsPanel from '../generalSettingsPageUi/generalSettingsPanel';
import AllOrganisationsPanel from '../allOrganisationManager/allOrganisationsPanel';
const BackupSettings = React.lazy(() => import('../backup/ui/BackupSettings').then(m => ({ default: m.BackupSettings })));
export { getDefaultSettingsView } from './defaultSettingsView';
interface SettingsLayoutProps {
    view: {
        kind: 'generalSettings' | 'allOrganisations' | 'organisationSettings' | 'googleDriveBackup';
        section?: 'usage' | 'appearance' | 'searchView' | 'todoSettings';
        backupStatsId?: string;
    };
    onClose: () => void;
}
export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ view, onClose }) => {
    const currentTab = view.kind;
    const currentSection = view.section;
    // ── Sidebar ───────────────────────────────────────────────────────────────
    const sidebarSections = [
        {
            title: 'UX APPEARANCE',
            items: [
                { id: 'appearance', label: 'Theme', icon: FaPalette, active: currentTab === 'generalSettings' && currentSection === 'appearance', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'appearance' }) },
                { id: 'searchView', label: 'Settings', icon: FiSearch, active: currentTab === 'generalSettings' && currentSection === 'searchView', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'searchView' }) }
            ],
        },
        {
            title: 'ORGANISATION',
            items: [
                { id: 'organisations', label: 'All Organisations', icon: FiList, active: currentTab === 'allOrganisations', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'allOrganisations' }) },
                { id: 'googleDriveBackup', label: 'Drive & Backup', icon: FiCloud, active: currentTab === 'googleDriveBackup', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'googleDriveBackup' }) },
            ],
        },
        {
            title: 'USAGE',
            items: [
                { id: 'usage', label: 'Usage', icon: FaUser, active: currentTab === 'generalSettings' && currentSection === 'usage', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'usage' }) }
            ],
        },
    ];
    return (<div className="flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-rootBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl">
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────── */}
      <div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-5 flex flex-col justify-between">
        <div className="space-y-6">
          <nav className="space-y-3">
            {sidebarSections.map((section, index) => (<React.Fragment key={section.title}>
                {index > 0 && (<div className="border-t border-neutral-800/30 dark:border-white/5 my-1.5 mx-2"/>)}
                <div className="space-y-1.5">
                  <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map(item => {
                const Icon = item.icon;
                const isDanger = 'isDanger' in item && item.isDanger;
                return (<div key={item.id} onClick={item.onClick ?? undefined} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${item.active
                        ? 'text-[var(--color-textPrimary)] bg-[var(--color-selectedBg)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                        : isDanger
                            ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
                            : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                          <Icon size={14} className={isDanger ? 'text-red-500' : 'text-neutral-500'}/>
                          <span>{item.label}</span>
                        </div>);
            })}
                  </div>
                </div>
              </React.Fragment>))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 w-full mt-auto pt-4">

          {/* Footer Card Container (Help & GitHub) */}
          <div className="border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] rounded-xl p-2 flex flex-col gap-1 shadow-sm">
            {/* Help Row */}
            <a href={CMDOS_APP_SETTINGS_DOCS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open SuperCommands documentation" title="Help and documentation" className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer group hover:bg-[var(--color-hoverBg)] transition-colors text-left w-full">
              <div className="flex items-center gap-2 min-w-0 flex-grow">
                <LuBookOpen size={14} className="text-neutral-500 shrink-0"/>
                <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Help</div>
              </div>
              <FiChevronRight size={13} className="text-[var(--color-textMuted)] opacity-60 shrink-0"/>
            </a>

            <div className="border-t border-[var(--color-borderDefault)] my-0.5"/>

            {/* GitHub Row */}
            <a href="https://github.com/supercommands/supercommands" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer group hover:bg-[var(--color-hoverBg)] transition-colors text-left w-full">
              <FaGithub size={14} className="text-neutral-500 shrink-0"/>
              <div className="min-w-0 flex-grow">
                <div className="text-xs font-semibold text-[var(--color-textPrimary)]">GitHub</div>
              </div>
            </a>
          </div>

          {/* Socials / Connect */}
          <div className="pt-2 border-t border-white/5 space-y-1">
            <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
              Connect
            </div>
            <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-1 px-0.5">
              {[
            { href: BRAND.social.slack, domain: 'slack.com', title: 'Slack' },
            { href: BRAND.social.reddit, domain: 'reddit.com', title: 'Reddit' },
            { href: BRAND.social.twitter, domain: 'x.com', title: 'X' }
        ].map(social => (<a key={social.domain} href={social.href} target="_blank" rel="noopener noreferrer" title={social.title} onPointerDown={e => e.stopPropagation()} className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0">
                  <img src={getFaviconUrl(social.domain)} className="w-[18px] h-[18px] rounded-sm" alt={social.title}/>
                </a>))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT CONTENT PANE ─────────────────────────────────────── */}
      <div className={currentTab !== 'generalSettings' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0'}>
        <GeneralSettingsPanel hideSidebar onClose={onClose} initialTab={currentSection}/>
      </div>
      <div className={currentTab !== 'allOrganisations' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0'}>
        <AllOrganisationsPanel hideSidebar onClose={onClose}/>
      </div>
      <div className={currentTab !== 'googleDriveBackup' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0 relative'}>
        <React.Suspense fallback={<div className="flex-1"/>}>
          <BackupSettings onClose={onClose} initialStatsBackupId={view.backupStatsId}/>
        </React.Suspense>
      </div>
    </div>);
};
export default SettingsLayout;
