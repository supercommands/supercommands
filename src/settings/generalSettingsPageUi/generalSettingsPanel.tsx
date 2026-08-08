import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiUpload, FiSearch, FiLayout, FiList, FiGrid, FiCreditCard, FiSettings, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { FaPalette, FaUser } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { 
  getStoredSearchFocusPreference, 
  setStoredSearchFocusPreference, 
  getStoredLayoutViewMode, 
  setStoredLayoutViewMode 
} from '../../storage/localStorage/uxCustomizationStorage';
import { StorageManager } from '../../storage/localStorage/storageManager';
import { getUserId, getUserInfo, CMDOS_SIGN_UP_URL } from '../../storage/API/core/api';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { FEATURE_FLAGS } from '../../pages/AltS_search_newtab/src/utils/featureFlags';
import ThemeSettings from '../uiPersonalization/ThemeSettings';
import ShortcutAnalyticsCard from '../../shared-components/triggerAnalytics/ShortcutAnalyticsCard';

interface GeneralSettingsPanelProps {
  onClose: () => void;
  initialTab?: string;
  hideSidebar?: boolean;
  isLoggedIn?: boolean;
}

const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({ onClose, initialTab = 'searchView', hideSidebar, isLoggedIn }) => {
  // Search View settings hooks
  const [autoTriggerDropdown, setAutoTriggerDropdownInternal] = useState(true);
  useEffect(() => {
    StorageManager.getItem('search_focus_preference').then(val => val !== null && setAutoTriggerDropdownInternal(val));
  }, []);

  const setAutoTriggerDropdown = async (val: boolean) => {
    setAutoTriggerDropdownInternal(val);
    await StorageManager.setItem('search_focus_preference', val);
  };

  const todoDisplayMode = useUIStore(s => s.todoDisplayMode);
  const setTodoDisplayMode = useUIStore.getState().setTodoDisplayMode;

  // Layout selection state
  const [currentLayout, setCurrentLayout] = useState<'board' | 'sheet'>('board');
  const [hoveredLayout, setHoveredLayout] = useState<'board' | 'sheet' | null>(null);

  // Profile data states
  const [userInfo, setUserInfo] = useState<{ email: string; name: string; image_url?: string; avatar_url?: string } | null>(null);
  const [userInitials, setUserInitials] = useState<string>('ME');
  // Tab Selection State
  const [activeTab, setActiveTab] = useState<'profile' | 'usage' | 'searchView' | 'appearance'>(() => {
    if (initialTab === 'appearance') return 'appearance';
    if (initialTab === 'profile') return 'profile';
    if (initialTab === 'usage') return 'usage';
    return 'searchView';
  });
  const [isCloudUser, setIsCloudUser] = useState<boolean>(isLoggedIn ?? false);
  const [storageLoaded, setStorageLoaded] = useState<boolean>(false);

  useEffect(() => {
    StorageManager.getItem(['user_info', 'user_name', 'accessToken']).then((res: any) => {
      console.log('[GeneralSettingsPanel] Initial storage loaded:', {
        user_info: res.user_info,
        user_name: res.user_name,
        accessToken: res.accessToken
      });
      const nameVal = res.user_info?.name || res.user_name;
      const name = typeof nameVal === 'string' ? nameVal : 'Me';
      const parts = name.split(/\s+/);
      const initials = parts.filter(Boolean).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
      if (initials) {
        setUserInitials(initials);
      }
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
  }, []);

  useEffect(() => {
    if (initialTab === 'appearance') {
      setActiveTab('appearance');
    } else if (initialTab === 'profile') {
      setActiveTab('profile');
    } else if (initialTab === 'usage') {
      setActiveTab('usage');

    } else if (initialTab === 'todoSettings') {
      setActiveTab('searchView');
    } else {
      setActiveTab('searchView');
    }
  }, [initialTab]);

  // Redirect local users if they somehow land on cloud-only tabs (profile)
  useEffect(() => {
    if (!storageLoaded) return;
    const isCloudOnlyTab = activeTab === 'profile';
    if (!isCloudUser && isCloudOnlyTab) {
      setActiveTab('searchView');
    }
  }, [storageLoaded, isCloudUser, activeTab]);

  useEffect(() => {
    getStoredLayoutViewMode().then(mode => {
      if (mode) {
        setCurrentLayout(mode);
      } else {
        setCurrentLayout('board');
      }
    });
  }, []);

  const handleSelectLayout = async (mode: 'board' | 'sheet') => {
    setCurrentLayout(mode);
    await setStoredLayoutViewMode(mode);
    window.dispatchEvent(new CustomEvent('setViewMode', { detail: mode }));
  };

  // Fetch Profile data when the tab is 'profile'
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const storage: any = await StorageManager.getItem(['user_info', 'personal_subscription']);
        console.log('[GeneralSettingsPanel - fetchProfileData] local storage checked:', storage);

        if (storage?.user_info) {
          setUserInfo(storage.user_info);
        }


        // Fetch fresh info
        const userId = await getUserId();
        console.log('[GeneralSettingsPanel - fetchProfileData] userId:', userId);
        if (userId) {
          const info = await getUserInfo(userId);
          console.log('[GeneralSettingsPanel - fetchProfileData] getUserInfo response:', info);
          if (info && info.user) {
            const { user } = info;
            const emailVal = user.email || '';
            const fullName = user.first_name
              ? `${user.first_name} ${user.last_name || ''}`.trim()
              : emailVal.split('@')[0] || 'User';

            const data = { email: user.email, name: fullName, image_url: user.image_url || user.profile_image_url };
            setUserInfo(data);
            await StorageManager.setItem('user_info', data);
          }


        }
      } catch (err) {
        console.error('Failed to load profile data in settings:', err);
      }
    };

    if (activeTab === 'profile') {
      fetchProfileData();
    }
  }, [activeTab]);

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
    ...(isCloudUser && FEATURE_FLAGS.ENABLE_SHARING
      ? [
        {
          title: 'ACCOUNT',
          items: [
            { id: 'profile', label: 'Profile', icon: FaUser, active: activeTab === 'profile', onClick: () => setActiveTab('profile') },

            { id: 'logout', label: 'Logout', icon: FiLogOut, active: false, onClick: handleLogout, isDanger: true },
          ],
        },
      ]
      : []),
    {
      title: 'USAGE',
      items: [
        { id: 'usage', label: 'Usage', icon: FaUser, active: activeTab === 'usage', onClick: () => setActiveTab('usage') },
      ],
    },
    {
      title: 'WORKSPACE',
      items: [
        { id: 'workspaces', label: 'All Workspaces', icon: FiList, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'allWorkspaces' }) },
      ],
    },
    {
      title: 'UX APPEARANCE',
      items: [
        { id: 'appearance', label: 'Theme', icon: FaPalette, active: activeTab === 'appearance', onClick: () => setActiveTab('appearance') },
        { id: 'searchView', label: 'Settings', icon: FiSearch, active: activeTab === 'searchView', onClick: () => setActiveTab('searchView') },
      ],
    },
  ];

  const getLayoutGifUrl = (gifPath: string) => {
    return typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL(gifPath)
      : '/' + gifPath;
  };

  return (
    <div className={hideSidebar ? "flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden" : "flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200"}>
      {/* LEFT SIDEBAR */}
      {!hideSidebar && (
        <div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-5 flex flex-col justify-between">
          <div className="space-y-6">
            <nav className="space-y-5">
              {sidebarSections.map((section, index) => (
                <React.Fragment key={section.title}>
                  {index > 0 && (
                    <div className="border-t border-neutral-800/30 dark:border-white/5 my-3.5 mx-2" />
                  )}
                  <div className="space-y-2">
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
                            onClick={item.onClick}
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

            {/* Profile Card / Login Button */}
            {!isCloudUser && FEATURE_FLAGS.ENABLE_SHARING ? (
              <button
                onClick={() => {
                  const chromeAny = (window as any)?.chrome;
                  if (chromeAny?.tabs?.create) {
                    chromeAny.tabs.create({ url: CMDOS_SIGN_UP_URL });
                  } else {
                    window.open(CMDOS_SIGN_UP_URL, '_blank');
                  }
                }}
                className="flex items-center justify-center gap-2 p-2 rounded-xl w-full text-center text-xs font-bold text-neutral-900 bg-white hover:bg-neutral-100 transition-all cursor-pointer shadow-md active:scale-[0.98] h-9"
              >
                Login
              </button>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 w-full text-left">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden">
                  {userInfo?.avatar_url || userInfo?.image_url ? (
                    <img src={userInfo.avatar_url || userInfo.image_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{userInitials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--color-textPrimary)] truncate">
                    {userInfo?.name || 'User'}
                  </div>
                </div>
                {isCloudUser && <FiChevronDown size={14} className="text-[var(--color-textMuted)] shrink-0" />}
              </div>
            )}

            {/* Social Icons Connect Section */}
            <div className="flex flex-col gap-1.5 w-full shrink-0 border-t border-white/5 pt-3">
              <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
                Connect
              </div>
              <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-1 px-0.5">
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
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 bg-[var(--color-editorBg)]/20 relative">
        <div className="flex items-center justify-end pt-4 px-6 pb-0 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close Settings"
          >
            <FiX size={16} />
          </button>
        </div>

        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  User Profile
                </h3>

                {/* Profile Card */}
                <div className="glass-card border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6 text-left bg-neutral-900/30">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full border-2 border-emerald-500 bg-neutral-800 flex items-center justify-center font-bold text-3xl text-white select-none overflow-hidden shrink-0">
                    {userInfo?.avatar_url || userInfo?.image_url ? (
                      <img src={userInfo.avatar_url || userInfo.image_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{userInfo?.name?.charAt(0).toUpperCase() || '?'}</span>
                    )}
                  </div>

                  {/* Profile info */}
                  <div className="flex-grow flex flex-col justify-center min-w-0 text-center sm:text-left">
                    <h2 className="text-lg font-bold text-white truncate">
                      {userInfo?.name || 'Loading Name...'}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-3 items-center justify-center sm:justify-start">
                      <span className="text-xs text-neutral-400 capitalize">Local Account</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'searchView' && (
            <div className="space-y-6">
              {/* LAYOUT SELECTION SECTION */}
              <div className="space-y-3 relative">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Select Layout
                </h3>
                <div className="flex flex-wrap gap-4">
                  {/* Board View Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectLayout('board')}
                    onMouseEnter={() => setHoveredLayout('board')}
                    onMouseLeave={() => setHoveredLayout(null)}
                    style={{
                      backgroundImage: `url('${getLayoutGifUrl('AltS_search_newtab/images/Gif/board_view.gif')}')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${currentLayout === 'board'
                      ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                      : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                      }`}
                  >
                    <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors" />
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />
                    {currentLayout === 'board' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Board (Kanaban)</span>
                    </div>
                  </motion.div>


                  {/* Sheet UI Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectLayout('sheet')}
                    onMouseEnter={() => setHoveredLayout('sheet')}
                    onMouseLeave={() => setHoveredLayout(null)}
                    style={{
                      backgroundImage: `url('${getLayoutGifUrl('AltS_search_newtab/images/Gif/sheet_ui.gif')}')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${currentLayout === 'sheet'
                      ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                      : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'
                      }`}
                  >
                    <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors" />
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none" />
                    {currentLayout === 'sheet' && (
                      <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]" />
                      </div>
                    )}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Table (SpreadSheet)</span>
                    </div>
                  </motion.div>
                </div>

                {/* Floating Preview Tooltip Popup */}
                <AnimatePresence>
                  {hoveredLayout && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-30 left-0 top-[140px] w-[340px] rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl p-2 select-none pointer-events-none backdrop-blur-md"
                    >
                      <div className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider px-2 py-1 mb-1">
                        Preview: {hoveredLayout === 'board' ? 'Board (Kanaban)' : 'Table (SpreadSheet)'}
                      </div>
                      <div 
                        className="w-full h-[190px] rounded-xl overflow-hidden bg-neutral-900 border border-white/5"
                        style={{
                          backgroundImage: `url('${getLayoutGifUrl(`AltS_search_newtab/images/Gif/${hoveredLayout === 'board' ? 'board_view.gif' : 'sheet_ui.gif'}`)}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SEARCH PREFERENCES SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Search Preferences
                </h3>

                <div className="glass-card border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] rounded-xl p-4 flex flex-col gap-3 text-left max-w-[480px]">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--color-textPrimary)]">Command-first search</span>
                      <p className="text-[10.5px] text-[var(--color-textSecondary)] mt-1">
                        Clicking search opens command-first results so you can narrow choices faster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoTriggerDropdown(!autoTriggerDropdown)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${autoTriggerDropdown ? 'bg-emerald-500' : 'bg-[var(--color-borderActive)]'
                        }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--color-textMuted)] mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Turn off to use normal search results instead.</span>
                  </div>
                </div>
              </div>

              {/* TO-DO SETTINGS SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  To-Do Workspace Mode
                </h3>
                <div className="flex flex-col gap-3 max-w-[480px]">
                  {[
                    {
                      id: 'pin',
                      title: 'Pin',
                      description: 'The To-Do list remains permanently open and fully visible.',
                    },
                    {
                      id: 'data-blur',
                      title: 'Pin Summary',
                      description: 'Shows a summary widget containing tasks count',
                    },
                    {
                      id: 'collapse',
                      title: 'Always close',
                      description: 'The To-Do list is collapsible and can be closed.',
                    },
                  ].map((option) => {
                    const isActive = todoDisplayMode === option.id;
                    return (
                      <motion.div
                        key={option.id}
                        whileHover={{ scale: 1.01, x: 2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setTodoDisplayMode(option.id as any)}
                        className={`cursor-pointer border rounded-xl p-4 transition-all relative flex items-center justify-between text-left ${isActive
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500'
                          : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] hover:border-[var(--color-borderActive)] hover:bg-[var(--color-hoverBg)]'
                          }`}
                      >
                        <div className="flex flex-col pr-8">
                          <span className={`text-sm font-bold ${isActive ? 'text-emerald-500 font-bold' : 'text-[var(--color-textPrimary)]'}`}>
                            {option.title}
                          </span>
                          <span className="text-xs text-[var(--color-textSecondary)] mt-1.5 leading-relaxed">
                            {option.description}
                          </span>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isActive ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--color-borderDefault)] bg-transparent text-[var(--color-iconDefault)]'
                          }`}>
                          {isActive && <FiCheck size={11} className="stroke-[3]" />}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <ThemeSettings />
          )}

          {activeTab === 'usage' && (
            <ShortcutAnalyticsCard />
          )}

        </div>
      </div>
    </div>
  );
};

export default GeneralSettingsPanel;
