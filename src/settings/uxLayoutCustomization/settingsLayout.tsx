import * as React from 'react';
import { useState, useEffect } from 'react';
import { useUIStore } from '../../shared-components/uiStateManager';
import {
  FiList,
  FiSettings,
  FiLogOut,
  FiSearch,
  FiCreditCard,
  FiChevronDown,
  FiChevronRight,
  FiArrowUpRight,
  FiCloud,
  FiX,
} from 'react-icons/fi';
import { FaUser, FaPalette, FaGithub } from 'react-icons/fa';

import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { StorageManager } from '../../storage/localStorage/storageManager';
import { FEATURE_FLAGS } from '../../pages/AltS_search_newtab/src/utils/featureFlags';
import { CMDOS_SIGN_UP_URL, checkHasCloudData } from '../../storage/API/core/api';

// Lazy load/import the sub panels to avoid circular dependency or import issues.
import GeneralSettingsPanel from '../generalSettingsPageUi/generalSettingsPanel';
import AllWorkspacesPanel from '../allWorkspaceManager/allWorkspacesPanel';
import { BackupSettings } from '../backup/ui/BackupSettings';
import { ImportCloudDataPanel } from '../_private/importCloudData_private/ui/ImportCloudDataPanel';

export const getDefaultSettingsView = (_isLoggedIn: boolean): { type: 'settings'; section?: 'profile' | 'usage' | 'appearance' | 'searchView' | 'todoSettings' | 'allWorkspaces' | 'workspaceSettings' | 'generalSettings' | 'googleDriveBackup' | 'importCloudData' } => {
  // This helper returns the first item of the first section in the settings sidebar.
  // If the order of sections changes in the future, update this return value to match.
  return { type: 'settings', section: 'allWorkspaces' };
};

interface SettingsLayoutProps {
  view: {
    kind: 'generalSettings' | 'allWorkspaces' | 'workspaceSettings' | 'googleDriveBackup' | 'importCloudData';
    section?: 'profile' | 'usage' | 'appearance' | 'searchView' | 'todoSettings';
  };
  onClose: () => void;
  isLoggedIn?: boolean;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ view, onClose, isLoggedIn }) => {

  // User info from chrome storage/localStorage
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string; avatar_url?: string } | null>(null);
  const [userInitials, setUserInitials] = useState<string>('ME');

  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [isCloudUser, setIsCloudUser] = useState<boolean>(isLoggedIn ?? false);
  const [storageLoaded, setStorageLoaded] = useState<boolean>(false);
  const [hasCloudWorkspaces, setHasCloudWorkspaces] = useState<boolean>(false);

  useEffect(() => {
    const checkCloud = async () => {
      if (isCloudUser && FEATURE_FLAGS.ENABLE_SHARING) {
        const found = await checkHasCloudData();
        setHasCloudWorkspaces(found);
      }
    };
    checkCloud();
  }, [isCloudUser]);

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    let cleanup: (() => void) | undefined;

    if (chromeAny?.storage?.local) {
    const loadData = () => {
      StorageManager.getItem(['user_info', 'user_name', 'accessToken']).then((res: any) => {
        console.log('[SettingsLayout] Loaded storage keys:', {
          user_info: res.user_info,
          user_name: res.user_name,
          accessToken: res.accessToken
        });
        const nameVal = res.user_info?.name || res.user_name;
        const name = typeof nameVal === 'string' ? nameVal : 'Me';
        const parts = name.split(/\s+/);
        const initials = parts.filter(Boolean).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
        if (initials) setUserInitials(initials);
        if (res.user_info) {
          setUserInfo(res.user_info);
          StorageManager.setItem('user_info', res.user_info);
        } else if (res.user_name) {
          const defaultInfo = { name: res.user_name, email: 'user@cmdos.dev' };
          setUserInfo(defaultInfo);
          StorageManager.setItem('user_info', defaultInfo);
        }

        const token = res.accessToken;
        const cloudUser = !!(token && typeof token === 'string' && token.startsWith('user_'));
        setIsCloudUser(cloudUser);
        setStorageLoaded(true);
      });
    };

    loadData();

      const listener = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          if (changes.user_info || changes.user_name || changes.accessToken) {
            loadData();
          }
        }
      };

      chromeAny.storage.onChanged.addListener(listener);
      cleanup = () => {
        chromeAny.storage.onChanged.removeListener(listener);
      };
    } else {
      setStorageLoaded(true);
    }

    return cleanup;
  }, []);

  const currentTab = view.kind;
  const currentSection = view.section;

  // Redirect local users if they somehow land on cloud-only tabs (profile)
  useEffect(() => {
    if (!storageLoaded) return;
    const isCloudOnlySection = currentSection === 'profile';
    if (!isCloudUser && currentTab === 'generalSettings' && isCloudOnlySection) {
      useUIStore.getState().setView({ type: 'settings', section: 'searchView' });
    }
  }, [storageLoaded, isCloudUser, currentTab, currentSection]);

  // ── Logout ────────────────────────────────────────────────────────────────
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
        'accessToken', 'profileImg', 'loggedIn', 'user_name', 'user_email',
        'orgRefreshCounters', 'last_org_counter_check_timestamp', 'last_org_counter_check_result',
      ];
      chromeAny.storage.local.remove(KEYS_TO_REMOVE, () => { window.location.reload(); });
    } else {
      window.location.reload();
    }
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebarSections = [
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: currentTab === 'allWorkspaces', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'allWorkspaces' }) },
        { id: 'googleDriveBackup', label: 'Drive & Backup', icon: FiCloud, active: currentTab === 'googleDriveBackup', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'googleDriveBackup' }) },
        ...(isCloudUser && FEATURE_FLAGS.ENABLE_SHARING && hasCloudWorkspaces
          ? [{ id: 'importCloudData', label: 'Import Cloud Data', icon: FiCloud, active: currentTab === 'importCloudData', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'importCloudData' }) }]
          : []),
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: currentTab === 'generalSettings' && currentSection === 'appearance', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'appearance' }) },
        { id: 'searchView', label: 'Settings', icon: FiSearch, active: currentTab === 'generalSettings' && currentSection === 'searchView', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'searchView' }) },
      ],
    },
    {
      title: 'USAGE',
      items: [
        { id: 'usage', label: 'Usage', icon: FaUser, active: currentTab === 'generalSettings' && currentSection === 'usage', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'usage' }) },
      ],
    },
    ...(isCloudUser && FEATURE_FLAGS.ENABLE_SHARING
      ? [
        {
          title: 'ACCOUNT',
          items: [
            { id: 'profile', label: 'Profile', icon: FaUser, active: currentTab === 'generalSettings' && currentSection === 'profile', onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'profile' }) },
          ],
        },
      ]
      : []),
  ];

  return (
    <div className="flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl">
      {/* ── LEFT SIDEBAR ───────────────────────────────────────────── */}
      <div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-5 flex flex-col justify-between">
        <div className="space-y-6">
          <nav className="space-y-3">
            {sidebarSections.map((section, index) => (
              <React.Fragment key={section.title}>
                {index > 0 && (
                  <div className="border-t border-neutral-800/30 dark:border-white/5 my-1.5 mx-2" />
                )}
                <div className="space-y-1.5">
                  <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const isDanger = 'isDanger' in item && item.isDanger;
                      return (
                        <div
                          key={item.id}
                          onClick={item.onClick ?? undefined}
                          className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${item.active
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
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 w-full mt-auto pt-4">

          {/* Profile Card / Login Button & Guest Options */}
          {isCloudUser ? (
            <div className="relative">
              {/* Logout Popup — appears above the profile card */}
              {showLogoutMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowLogoutMenu(false)}
                  />
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-[var(--color-popupBg)] border border-[var(--color-borderDefault)] rounded-xl p-1 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <button
                      onClick={() => {
                        setShowLogoutMenu(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-all cursor-pointer"
                    >
                      <FiLogOut size={14} className="text-red-500" />
                      <span>Logout</span>
                    </button>
                  </div>
                </>
              )}
              <div
                onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                className="flex items-center gap-2 p-2 rounded-xl w-full text-left transition-all cursor-pointer hover:bg-[var(--color-hoverBg)]"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-inputBg)] flex items-center justify-center font-bold text-xs text-[var(--color-textPrimary)] shrink-0 overflow-hidden">
                  {userInfo?.avatar_url || userInfo?.image_url ? (
                    <img src={userInfo.avatar_url || userInfo.image_url} alt={userInfo.name} className="w-full h-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-[var(--color-textPrimary)] truncate leading-tight">
                    {userInfo?.name || 'Me'}
                  </div>
                </div>
                <FiChevronDown size={14} className="text-[var(--color-textMuted)] shrink-0" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              {/* Unified Login & GitHub Card Container */}
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

          {/* Socials / Connect */}
          <div className="pt-2 border-t border-white/5 space-y-1">
            <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
              Connect
            </div>
            <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-1 px-0.5">
              {[
                { href: 'https://cmdos.slack.com/join/shared_invite/zt-3mycapoa9-afKNhqrFiGXAb7GS7zsOhA', domain: 'slack.com', title: 'Slack' },
                { href: 'https://www.reddit.com/r/cmdOS/', domain: 'reddit.com', title: 'Reddit' },
                { href: 'https://x.com/cmdos_terminal', domain: 'x.com', title: 'X' },
              ].map(social => (
                <a
                  key={social.domain}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.title}
                  onPointerDown={e => e.stopPropagation()}
                  className="transition-all opacity-80 hover:opacity-100 hover:scale-110 shrink-0"
                >
                  <img src={getFaviconUrl(social.domain)} className="w-[18px] h-[18px] rounded-sm" alt={social.title} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT CONTENT PANE ─────────────────────────────────────── */}
      <div className={currentTab !== 'generalSettings' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0'}>
        <GeneralSettingsPanel hideSidebar onClose={onClose} initialTab={currentSection} isLoggedIn={isLoggedIn} />
      </div>
      <div className={currentTab !== 'allWorkspaces' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0'}>
        <AllWorkspacesPanel hideSidebar onClose={onClose} />
      </div>
      <div className={currentTab !== 'googleDriveBackup' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0 relative'}>
        <BackupSettings onClose={onClose} />
      </div>
      <div className={currentTab !== 'importCloudData' ? 'hidden' : 'flex-1 flex flex-col min-w-0 h-full min-h-0 bg-[var(--color-editorBg)]/20 relative'}>
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <ImportCloudDataPanel />
        </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
