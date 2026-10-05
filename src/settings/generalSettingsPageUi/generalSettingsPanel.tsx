import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiUpload, FiSearch, FiLayout, FiList, FiGrid, FiCreditCard, FiSettings, FiLogOut, FiChevronDown, FiRotateCcw } from 'react-icons/fi';
import { FaPalette, FaUser } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { useUIStore } from '../../shared-components/uiStateManager';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { ALT_S_WEBSITE_BACKDROP_BLUR_KEY, DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH, getAltSWebsiteBackdropBlurPixels, normalizeAltSWebsiteBackdropBlurStrength, getStoredSearchFocusPreference, setStoredSearchFocusPreference, getStoredLayoutViewMode, setStoredLayoutViewMode } from '../../storage/localStorage/uxCustomizationStorage';
import type { AltSWebsiteBackdropBlurPreference } from '../../storage/localStorage/uxCustomizationStorage';
import { StorageManager } from '../../storage/localStorage/storageManager';
import { getFaviconUrl } from '../../shared-components/searchBarMain/utilityFunctions/utils';
import { BRAND } from '../../shared-components/brandingConfig';
import ThemeSettings from '../uiPersonalization/ThemeSettings';
import ShortcutAnalyticsCard from '../../shared-components/triggerAnalytics/ShortcutAnalyticsCard';
const CHROME_NOTIFICATIONS_ENABLED_KEY = 'todo_chrome_alarm_notifications_enabled';
interface GeneralSettingsPanelProps {
    onClose: () => void;
    initialTab?: string;
    hideSidebar?: boolean;
}
const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({ onClose, initialTab = 'searchView', hideSidebar }) => {
    // Search View settings hooks
    const [autoTriggerDropdown, setAutoTriggerDropdownInternal] = useState(true);
    // Chrome-level notifications are opt-in for new users.
    const [chromeNotificationsEnabled, setChromeNotificationsEnabled] = useState(false);
    const [altSWebsiteBackdropBlurPreference, setAltSWebsiteBackdropBlurPreference] = useChromeStorage<AltSWebsiteBackdropBlurPreference>(ALT_S_WEBSITE_BACKDROP_BLUR_KEY, DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH);
    const altSWebsiteBackdropBlurStrength = normalizeAltSWebsiteBackdropBlurStrength(altSWebsiteBackdropBlurPreference);
    const altSWebsiteBackdropBlurPixels = getAltSWebsiteBackdropBlurPixels(altSWebsiteBackdropBlurPreference);
    useEffect(() => {
        StorageManager.getItem('search_focus_preference').then(val => val !== null && setAutoTriggerDropdownInternal(val));
        StorageManager.getItem(CHROME_NOTIFICATIONS_ENABLED_KEY).then(val => val !== null && setChromeNotificationsEnabled(val !== false));
    }, []);
    const setAutoTriggerDropdown = async (val: boolean) => {
        setAutoTriggerDropdownInternal(val);
        await StorageManager.setItem('search_focus_preference', val);
    };
    const setChromeNotifications = async (val: boolean) => {
        setChromeNotificationsEnabled(val);
        await StorageManager.setItem(CHROME_NOTIFICATIONS_ENABLED_KEY, val);
    };
    const todoDisplayMode = useUIStore(s => s.todoDisplayMode);
    const setTodoDisplayMode = useUIStore.getState().setTodoDisplayMode;
    // Layout selection state
    const [currentLayout, setCurrentLayout] = useState<'board' | 'sheet'>('board');
    const [hoveredLayout, setHoveredLayout] = useState<'board' | 'sheet' | null>(null);
    // Tab Selection State
    const [activeTab, setActiveTab] = useState<'usage' | 'searchView' | 'appearance'>(() => {
        if (initialTab === 'appearance')
            return 'appearance';
        if (initialTab === 'usage')
            return 'usage';
        return 'searchView';
    });
    useEffect(() => {
        if (initialTab === 'appearance') {
            setActiveTab('appearance');
        }
        else if (initialTab === 'usage') {
            setActiveTab('usage');
        }
        else if (initialTab === 'todoSettings') {
            setActiveTab('searchView');
        }
        else {
            setActiveTab('searchView');
        }
    }, [initialTab]);
    useEffect(() => {
        getStoredLayoutViewMode().then(mode => {
            if (mode) {
                setCurrentLayout(mode);
            }
            else {
                setCurrentLayout('board');
            }
        });
    }, []);
    const handleSelectLayout = async (mode: 'board' | 'sheet') => {
        setCurrentLayout(mode);
        await setStoredLayoutViewMode(mode);
        window.dispatchEvent(new CustomEvent('setViewMode', { detail: mode }));
    };
    const sidebarSections = [
        {
            title: 'USAGE',
            items: [
                { id: 'usage', label: 'Usage', icon: FaUser, active: activeTab === 'usage', onClick: () => setActiveTab('usage') }
            ],
        },
        {
            title: 'ORGANIZATION',
            items: [
                { id: 'organisations', label: 'All Organizations', icon: FiList, active: false, onClick: () => useUIStore.getState().setView({ type: 'settings', section: 'allOrganisations' }) }
            ],
        },
        {
            title: 'UX APPEARANCE',
            items: [
                { id: 'appearance', label: 'Theme', icon: FaPalette, active: activeTab === 'appearance', onClick: () => setActiveTab('appearance') },
                { id: 'searchView', label: 'Settings', icon: FiSearch, active: activeTab === 'searchView', onClick: () => setActiveTab('searchView') }
            ],
        }
    ];
    const getLayoutGifUrl = (gifPath: string) => {
        return typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL(gifPath)
            : '/' + gifPath;
    };
    return (<div className={hideSidebar ? "flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden" : "flex h-full w-full max-w-[1300px] mx-auto bg-[var(--color-modalBg)] border border-[var(--color-borderDefault)] shadow-2xl rounded-2xl overflow-hidden font-sans select-none backdrop-blur-xl animate-in fade-in duration-200"}>
      {/* LEFT SIDEBAR */}
      {!hideSidebar && (<div className="w-[175px] shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)]/40 px-3 py-5 flex flex-col justify-between">
          <div className="space-y-6">
            <nav className="space-y-5">
              {sidebarSections.map((section, index) => (<React.Fragment key={section.title}>
                  {index > 0 && (<div className="border-t border-neutral-800/30 dark:border-white/5 my-3.5 mx-2"/>)}
                  <div className="space-y-2">
                    <div className="px-3 text-[9px] font-bold tracking-wider text-[var(--color-textMuted)] uppercase select-none opacity-80">
                      {section.title}
                    </div>
                    <div className="space-y-1">
                      {section.items.map(item => {
                    const Icon = item.icon;
                    const isDanger = 'isDanger' in item && item.isDanger;
                    return (<div key={item.id} onClick={item.onClick} className={`w-full flex items-center gap-2 px-2 py-2 rounded-xl text-left text-xs font-semibold transition-all relative cursor-pointer ${item.active
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

            {/* Social Icons Connect Section */}
            <div className="flex flex-col gap-1.5 w-full shrink-0 border-t border-white/5 pt-3">
              <div className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 tracking-wider text-left uppercase opacity-80 px-0.5">
                Connect
              </div>
              <div className="flex flex-nowrap items-center justify-start gap-2.5 w-full mt-1 px-0.5">
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
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 bg-[var(--color-editorBg)]/20 relative">
        <div className="flex items-center justify-end pt-4 px-6 pb-0 shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)] transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95" title="Close Settings">
            <FiX size={16}/>
          </button>
        </div>

        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
          {activeTab === 'searchView' && (<div className="space-y-6">
              {/* LAYOUT SELECTION SECTION */}
              <div className="space-y-3 relative">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Select Layout
                </h3>
                <div className="flex flex-wrap gap-4">
                  {/* Board View Card */}
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => handleSelectLayout('board')} onMouseEnter={() => setHoveredLayout('board')} onMouseLeave={() => setHoveredLayout(null)} style={{
                backgroundImage: `url('${getLayoutGifUrl('AltS_search_newtab/images/Gif/board_view.gif')}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }} className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${currentLayout === 'board'
                ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'}`}>
                    <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors"/>
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none"/>
                    {currentLayout === 'board' && (<div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]"/>
                      </div>)}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Board (Kanaban)</span>
                    </div>
                  </motion.div>


                  {/* Sheet UI Card */}
                  <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => handleSelectLayout('sheet')} onMouseEnter={() => setHoveredLayout('sheet')} onMouseLeave={() => setHoveredLayout(null)} style={{
                backgroundImage: `url('${getLayoutGifUrl('AltS_search_newtab/images/Gif/sheet_ui.gif')}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }} className={`cursor-pointer border rounded-xl w-[160px] h-[95px] transition-all relative overflow-hidden shadow-md ${currentLayout === 'sheet'
                ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                : 'border-[var(--color-borderDefault)] hover:border-[var(--color-borderActive)]'}`}>
                    <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors"/>
                    {/* Subtle inner border for contrast */}
                    <div className="absolute inset-0 border border-white/5 rounded-xl pointer-events-none"/>
                    {currentLayout === 'sheet' && (<div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md z-10">
                        <FiCheck size={11} className="stroke-[3]"/>
                      </div>)}
                    <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 z-10 select-none">
                      <span className="text-[10px] font-bold text-white tracking-wide">Table (SpreadSheet)</span>
                    </div>
                  </motion.div>
                </div>

                {/* Floating Preview Tooltip Popup */}
                <AnimatePresence>
                  {hoveredLayout && (<motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }} className="absolute z-30 left-0 top-[140px] w-[340px] rounded-2xl border border-white/10 bg-neutral-950/95 shadow-2xl p-2 select-none pointer-events-none backdrop-blur-md">
                      <div className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider px-2 py-1 mb-1">
                        Preview: {hoveredLayout === 'board' ? 'Board (Kanaban)' : 'Table (SpreadSheet)'}
                      </div>
                      <div className="w-full h-[190px] rounded-xl overflow-hidden bg-neutral-900 border border-white/5" style={{
                    backgroundImage: `url('${getLayoutGifUrl(`AltS_search_newtab/images/Gif/${hoveredLayout === 'board' ? 'board_view.gif' : 'sheet_ui.gif'}`)}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}/>
                    </motion.div>)}
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
                    <button type="button" onClick={() => setAutoTriggerDropdown(!autoTriggerDropdown)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center ${autoTriggerDropdown ? 'bg-emerald-500' : 'bg-[var(--color-borderActive)]'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${autoTriggerDropdown ? 'translate-x-4' : 'translate-x-0'}`}/>
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--color-textMuted)] mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>
                    <span>Turn off to use normal search results instead.</span>
                  </div>
                </div>

                <div className="glass-card border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] rounded-xl p-4 flex flex-col gap-3 text-left max-w-[480px]">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--color-textPrimary)]">Blur website background</span>
                    <p className="text-[10.5px] text-[var(--color-textSecondary)] mt-1">
                      Adjust the website blur behind the Alt+S popup from 0 to 10 pixels.
                    </p>
                  </div>
                  <div className="w-full p-2.5 px-3 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] flex items-center gap-3">
                    <input type="range" min={0} max={100} step={1} value={altSWebsiteBackdropBlurStrength} onChange={event => setAltSWebsiteBackdropBlurPreference(Number(event.target.value))} aria-label="Website background blur strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={altSWebsiteBackdropBlurStrength} aria-valuetext={`${altSWebsiteBackdropBlurStrength}% (${altSWebsiteBackdropBlurPixels}px)`} style={{
                background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${altSWebsiteBackdropBlurStrength}%, var(--color-borderDefault) ${altSWebsiteBackdropBlurStrength}%, var(--color-borderDefault) 100%)`,
            }} className="w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
                    <span className="text-xs font-mono font-bold text-[var(--color-textSecondary)] w-10 text-right shrink-0 select-none">
                      {altSWebsiteBackdropBlurStrength}%
                    </span>
                    <button type="button" onClick={() => setAltSWebsiteBackdropBlurPreference(DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH)} disabled={altSWebsiteBackdropBlurStrength === DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH} title="Reset website blur to 0%" aria-label="Reset website background blur to 0%" className={`p-1.5 rounded-lg border transition-all flex items-center justify-center shrink-0 ${altSWebsiteBackdropBlurStrength === DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH
                ? 'opacity-30 cursor-not-allowed border-transparent text-[var(--color-textMuted)]'
                : 'cursor-pointer border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]'}`}>
                      <FiRotateCcw size={14}/>
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--color-textMuted)] mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"/>
                    <span>
                      Current blur: {altSWebsiteBackdropBlurPixels}px. Applied only while the website popup is open.
                    </span>
                  </div>
                </div>
              </div>

              {/* NOTIFICATION SETTINGS SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Notifications
                </h3>
                <div className="glass-card border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] rounded-xl p-4 flex flex-col gap-3 text-left max-w-[480px]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--color-textPrimary)]">Chrome notifications</span>
                      <p className="text-[10.5px] text-[var(--color-textSecondary)] mt-1">
                        Show browser notifications for durable background reminders and important app events.
                      </p>
                    </div>
                    <button type="button" onClick={() => setChromeNotifications(!chromeNotificationsEnabled)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer flex items-center shrink-0 ${chromeNotificationsEnabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-borderActive)]'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 transform ${chromeNotificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`}/>
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--color-textMuted)] mt-1 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"/>
                    <span>Turn off to keep notifications in SuperCommands without showing Chrome popups.</span>
                  </div>
                </div>
              </div>

              {/* TO-DO SETTINGS SECTION */}
              <div className="space-y-3 pt-6 border-t border-[var(--color-borderDefault)]">
                <h3 className="text-xs font-bold text-[var(--color-textMuted)] tracking-wider uppercase">
                  Todo Workspace Mode
                </h3>
                <div className="flex flex-col gap-3 max-w-[480px]">
                  {[
                {
                    id: 'pin',
                    title: 'Pin',
                    description: 'The Todo list remains permanently open and fully visible.',
                },
                {
                    id: 'data-blur',
                    title: 'Pin Summary',
                    description: 'Shows a summary widget containing Todo count',
                },
                {
                    id: 'collapse',
                    title: 'Always close',
                    description: 'The Todo list is collapsible and can be closed.',
                }
            ].map((option) => {
                const isActive = todoDisplayMode === option.id;
                return (<motion.div key={option.id} whileHover={{ scale: 1.01, x: 2 }} whileTap={{ scale: 0.99 }} onClick={() => setTodoDisplayMode(option.id as any)} className={`cursor-pointer border rounded-xl p-4 transition-all relative flex items-center justify-between text-left ${isActive
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500'
                        : 'border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] hover:border-[var(--color-borderActive)] hover:bg-[var(--color-hoverBg)]'}`}>
                        <div className="flex flex-col pr-8">
                          <span className={`text-sm font-bold ${isActive ? 'text-emerald-500 font-bold' : 'text-[var(--color-textPrimary)]'}`}>
                            {option.title}
                          </span>
                          <span className="text-xs text-[var(--color-textSecondary)] mt-1.5 leading-relaxed">
                            {option.description}
                          </span>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isActive ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--color-borderDefault)] bg-transparent text-[var(--color-iconDefault)]'}`}>
                          {isActive && <FiCheck size={11} className="stroke-[3]"/>}
                        </div>
                      </motion.div>);
            })}
                </div>
              </div>
            </div>)}

          {activeTab === 'appearance' && (<ThemeSettings />)}

          {activeTab === 'usage' && (<ShortcutAnalyticsCard />)}

        </div>
      </div>
    </div>);
};
export default GeneralSettingsPanel;
