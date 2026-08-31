import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaTimes,
  FaSearch,
  FaSync,
  FaCloud,
  FaRobot,
  FaPlus,
  FaEllipsisV,
  FaExternalLinkAlt,
  FaMousePointer,
  FaPaste,
  FaHistory,
  FaTerminal,
  FaLink,
  FaClipboardList,
  FaCookieBite,
  FaKeyboard,
} from 'react-icons/fa';
import type { AutomationStep } from './automation';
import type { ModuleDefinition } from '../../../../../../background/src/automation/runtime_Execution_Engine/runner';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';

export interface CloudModule extends ModuleDefinition {
  module_key: string;
  variables: any;
  category: any;
  icon_host: any;
  icon_url?: string;
  description?: string;
}

interface AutomationActionMenuProps {
  onClose: () => void;
  insertPoint: { parentId?: string; index: number };
  steps: AutomationStep[];
  setSteps: React.Dispatch<React.SetStateAction<AutomationStep[]>>;
  setSelectedStepId: (id: string | number | null) => void;
  installedModules: CloudModule[];
  moduleCatalog: CloudModule[];
  refreshCommands: () => void;
  installModule: (moduleId: string) => Promise<void>;
  onRequestStepTableFocus?: (target?: 'select' | 'last_menu') => void;
}

// Fixed Modules for Local Actions
const LOCAL_MODULES = [
  {
    id: 'open_tab',
    name: 'Open Link',
    icon: FaExternalLinkAlt,
    color: 'text-blue-400',
    description: 'Automatically opens the specified URL.',
    category: 'navigation',
    isPopular: true,
  },
  {
    id: 'click',
    name: 'Click a button',
    icon: FaMousePointer,
    color: 'text-emerald-400',
    description: 'Automatically clicks the selected button or element.',
    category: 'navigation',
    isPopular: true,
  },
  {
    id: 'paste',
    name: 'Paste in input field ',
    icon: FaPaste,
    color: 'text-purple-400',
    description: 'Automatically focuses the selected input field and pastes the provided text.',
    category: 'navigation',
    isPopular: true,
  },
  {
    id: 'wait',
    name: 'Wait',
    icon: FaHistory,
    color: 'text-amber-400',
    description: 'Automatically pauses the automation for the specified duration.',
    category: 'navigation',
  },

  {
    id: 'clipboard_write',
    name: 'Clipboard Write',
    icon: FaClipboardList,
    color: 'text-indigo-400',
    description: 'Writes provided text to the system clipboard.',
    category: 'navigation',
  },
  {
    id: 'cookies_clear',
    name: 'Clear Cookies',
    icon: FaCookieBite,
    color: 'text-amber-600',
    description: 'Deletes all cookies for the current website domain.',
    category: 'navigation',
    isPro: true,
  },
  {
    id: 'clipboard_paste',
    name: 'Clipboard Paste',
    icon: FaPaste,
    color: 'text-orange-400',
    description: 'Pastes current system clipboard content into selected field.',
    category: 'navigation',
  },
  {
    id: 'keystroke',
    name: 'Keystroke',
    icon: FaKeyboard,
    color: 'text-cyan-400',
    description: 'Records and sends keyboard shortcuts.',
    category: 'navigation',
  },
];

const getFaviconUrl = (host: string) => {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    `https://${host}`,
  )}&size=128`;
};

const ALL_AI_ICON_HOSTS = ['chatgpt.com', 'gemini.google.com', 'claude.ai', 'perplexity.ai'];

const isAllAiModule = (module: CloudModule) => {
  const normalizedName = String(module?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const normalizedKey = String(module?.module_key || module?.module_id || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return normalizedName === 'allai' || normalizedKey === 'allai';
};

const AutomationActionMenu: React.FC<AutomationActionMenuProps> = ({
  onClose,
  insertPoint,
  steps,
  setSteps,
  setSelectedStepId,
  installedModules,
  moduleCatalog,
  refreshCommands,
  installModule,
  onRequestStepTableFocus,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const speakerRootRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'navigation' | 'aichat'>('navigation');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [pickerFocusIdx, setPickerFocusIdx] = useState(0);
  const [keyboardSection, setKeyboardSection] = useState<'search' | 'list'>('search');
  const [isProUser, setIsProUser] = useState(false);

  useEffect(() => {
    const checkSub = async () => {
      try {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          const res = await chromeAny.storage.local.get(['personal_subscription']);
          if (res?.personal_subscription) {
            const sub = res.personal_subscription;
            setIsProUser(Boolean(sub.stripe_user_id));
          }
        }
      } catch (err) {
        console.error('Failed to read sub in AutomationActionMenu:', err);
      }
    };
    checkSub();

    const listener = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.personal_subscription) {
        const sub = changes.personal_subscription.newValue;
        setIsProUser(sub ? Boolean(sub.stripe_user_id) : false);
      }
    };
    const chromeAny = (window as any).chrome;
    if (chromeAny?.storage?.onChanged) {
      chromeAny.storage.onChanged.addListener(listener);
      return () => chromeAny.storage.onChanged.removeListener(listener);
    }
    return;
  }, []);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const aiChatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Small delay to ensure the animation has started or the component is mounted
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      setKeyboardSection('search');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setPickerFocusIdx(0);
    }
  }, [searchQuery]);

  const insertLocalStep = (mod: any) => {
    let newConfig: any = {};
    if (mod.id === 'open_tab') newConfig = { url: '', fixedValue: '', dropdownOptions: '' };
    if (mod.id === 'click') newConfig = { selector: '', name: '', fixedValue: '', dropdownOptions: '' };
    if (mod.id === 'paste') newConfig = { content: '', selector: '', fixedValue: '', dropdownOptions: '' };
    if (mod.id === 'wait') newConfig = { delay: 1000 };
    if (mod.id === 'clipboard_write') newConfig = { text: '' };
    if (mod.id === 'clipboard_paste') newConfig = { selector: '' };
    if (mod.id === 'cookies_clear') newConfig = {};
    if (mod.id === 'keystroke') newConfig = { key: '' };

    const newStep: AutomationStep = {
      id: generateEntityId('automationStep'),
      moduleId: mod.id,
      config: { ...newConfig, name: mod.name },
    };
    if (insertPoint.parentId) {
      setSteps(prev =>
        prev.map(step => {
          if (step.id === insertPoint.parentId) {
            const updatedSubs = [...(step.subSteps || [])];
            updatedSubs.splice(insertPoint.index, 0, newStep);
            return { ...step, subSteps: updatedSubs };
          }
          return step;
        }),
      );
    } else {
      setSteps(prev => {
        const updated = [...prev];
        updated.splice(insertPoint.index, 0, newStep);
        return updated;
      });
    }

    if (mod.id === 'click' || mod.id === 'paste' || mod.id === 'clipboard_paste') {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({
          automation_recording_state: {
            stepId: newStep.id,
            type: mod.id,
            active: true,
            select_mode: false,
            timestamp: Date.now(),
          },
        });
      }
    }

    setSelectedStepId(newStep.id);
    onClose();
    setTimeout(() => {
      onRequestStepTableFocus?.('select');
    }, 0);
  };

  const insertCloudModule = (module: CloudModule) => {
    const newStep: AutomationStep = {
      id: generateEntityId('automationStep'),
      moduleId: module.module_key || String(module.module_id),
      config: {
        name: module.name,
        icon_url: module.icon_host ? getFaviconUrl(module.icon_host) : module.icon_url,
        isCloudModule: true,
        execution_steps: module.execution_steps,
        variables: module.variables,
        category: module.category,
        description: module.description,
      },
    };

    if (insertPoint.parentId) {
      setSteps(prev =>
        prev.map(s => {
          if (s.id === insertPoint.parentId) {
            const updatedSubs = [...(s.subSteps || [])];
            updatedSubs.splice(insertPoint.index, 0, newStep);
            return { ...s, subSteps: updatedSubs };
          }
          return s;
        }),
      );
    } else {
      setSteps(prev => {
        const updated = [...prev];
        updated.splice(insertPoint.index, 0, newStep);
        return updated;
      });
    }
    setSelectedStepId(newStep.id);
    onClose();
    setTimeout(() => {
      onRequestStepTableFocus?.('select');
    }, 0);
  };

  const filteredNavigation = LOCAL_MODULES.filter(
    m => {
      if ((m as any).isPro && !isProUser) return false;
      return (
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  );

  const installedModuleKeys = useMemo(
    () => new Set(installedModules.map(m => String(m.module_id || m.module_key || '')).filter(Boolean)),
    [installedModules],
  );

  const allAiCatalog = useMemo(() => {
    const combined = [...moduleCatalog, ...installedModules].filter(isAllAiModule);
    const deduped = new Map<string, CloudModule>();
    combined.forEach(module => {
      const key = String(module.module_id || module.module_key || module.name || '').toLowerCase();
      if (!key) return;
      if (!deduped.has(key)) deduped.set(key, module);
    });
    return Array.from(deduped.values());
  }, [moduleCatalog, installedModules]);

  const filteredCatalog = allAiCatalog.filter(
    m =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const allFilteredResults = useMemo(() => {
    const popularLocal = filteredNavigation.filter(m => (m as any).isPopular).map(m => ({ type: 'local', data: m }));
    const proLocal = filteredNavigation.filter(m => (m as any).isPro).map(m => ({ type: 'local', data: m }));
    const othersLocal = filteredNavigation.filter(m => !(m as any).isPopular && !(m as any).isPro).map(m => ({ type: 'local', data: m }));
    const catalog = filteredCatalog.map(m => ({ type: 'catalog', data: m }));

    return [...popularLocal, ...proLocal, ...othersLocal, ...catalog];
  }, [filteredNavigation, filteredCatalog]);

  useEffect(() => {
    const onFocusSpeakerList = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ target?: 'open_click' }>;
      const target = customEvt?.detail?.target;

      setKeyboardSection('list');
      if (target === 'open_click') {
        const openLinkIdx = allFilteredResults.findIndex(
          item => item.type === 'local' && (item as any).data?.id === 'open_tab',
        );
        setPickerFocusIdx(openLinkIdx >= 0 ? openLinkIdx : 0);
      } else {
        setPickerFocusIdx(prev => Math.min(Math.max(prev, 0), Math.max(allFilteredResults.length - 1, 0)));
      }

      setTimeout(() => {
        speakerRootRef.current?.focus({ preventScroll: true });
      }, 0);
    };
    window.addEventListener('agent-speaker-focus-list', onFocusSpeakerList as EventListener);
    return () => window.removeEventListener('agent-speaker-focus-list', onFocusSpeakerList as EventListener);
  }, [allFilteredResults]);

  const renderModuleCard = (item: any, isSelected: boolean, idx: number) => {
    const isLocal = item.type === 'local';
    const mod = item.data;
    const Icon = isLocal ? mod.icon || FaRobot : null;
    const iconUrl = !isLocal ? (mod.icon_host ? getFaviconUrl(mod.icon_host) : mod.icon_url) : null;
    const mid = mod.module_id || mod.module_key;
    const isInstalled = !isLocal && installedModuleKeys.has(String(mid));

    return (
      <div
        key={`${item.type}-${mid || mod.id}`}
        onMouseEnter={() => {
          if (pickerFocusIdx !== idx) {
            setPickerFocusIdx(idx);
          }
          if (keyboardSection !== 'list') {
            setKeyboardSection('list');
          }
        }}
        onMouseMove={() => {
          if (pickerFocusIdx !== idx) {
            setPickerFocusIdx(idx);
          }
        }}
        onClick={e => {
          e.stopPropagation();
          if (isLocal) insertLocalStep(mod);
          else if (isInstalled) {
            insertCloudModule(mod);
          } else if (!isInstalled) {
            setInstallingId(mid);
            installModule(mid)
              .then(() => {
                refreshCommands?.();
                setInstallingId(null);
                insertCloudModule(mod);
              })
              .catch(() => setInstallingId(null));
          }
        }}
        className={`group relative w-full flex items-center py-2 px-3 transition-all text-left cursor-pointer border-b border-white/5 ${
          isSelected ? 'bg-white/10 shadow-sm' : 'hover:bg-white/5'
        }`}>
        <div className="flex items-center gap-2.5 w-full">
          {/* Icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            {isAllAiModule(mod) ? (
              <div className="relative w-4 h-4">
                {ALL_AI_ICON_HOSTS.map((host, idx) => {
                  const positions = [
                    { left: 0, top: 0 },
                    { left: 6, top: 0 },
                    { left: 0, top: 6 },
                    { left: 6, top: 6 },
                  ];
                  const pos = positions[idx] || positions[0];
                  return (
                    <div
                      key={`all-ai-${host}`}
                      className="absolute w-2.5 h-2.5 rounded-full overflow-hidden bg-white border border-[#0b0b0b]"
                      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}>
                      <img src={getFaviconUrl(host)} alt="" className="w-2.5 h-2.5 object-cover" />
                    </div>
                  );
                })}
              </div>
            ) : Icon ? (
              <Icon className={mod.color || 'text-emerald-400'} size={14} />
            ) : iconUrl ? (
              <img src={iconUrl} alt={String(mod.name)} className="w-4 h-4 rounded-sm object-contain" />
            ) : (
              <FaCloud size={14} className="text-[var(--color-iconDefault)] group-hover:text-emerald-400" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <span
                className={`text-[11.5px] font-bold truncate ${
                  isSelected ? 'text-emerald-300' : 'text-neutral-200 group-hover:text-white'
                }`}>
                {String(mod.name)}
              </span>
              {isSelected && (
                <div
                  className={`shrink-0 animate-in fade-in duration-200 flex items-center gap-0.5 px-1 py-0.5 rounded-md border ${
                    isLocal
                      ? 'bg-emerald-500/10 border-emerald-500/20'
                      : isInstalled
                        ? 'bg-white/5 border-white/10'
                        : 'bg-emerald-500/10 border-emerald-500/20'
                  }`}>
                  <span
                    className={`text-[8px] font-bold uppercase tracking-tight ${
                      isLocal ? 'text-emerald-500' : isInstalled ? 'text-neutral-400' : 'text-emerald-500'
                    }`}>
                    {isLocal ? 'Add' : isInstalled ? 'Add' : 'Install'}
                  </span>
                  <FaPlus size={7} className={isInstalled ? 'text-neutral-400' : 'text-emerald-500'} />
                </div>
              )}
            </div>
            {mod.description && (
              <p className="text-[10px] mt-0.5 leading-relaxed text-neutral-400 line-clamp-2">{mod.description}</p>
            )}
          </div>

          {installingId === mid && !isInstalled && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 animate-pulse">
              <FaSync className="animate-spin" size={10} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    const navPos = navigationRef.current?.getBoundingClientRect().top ?? Infinity;
    const aiChatPos = aiChatRef.current?.getBoundingClientRect().top ?? Infinity;
    const buffer = 80;

    if (aiChatPos <= containerTop + buffer) setActiveSection('aichat');
    else setActiveSection('navigation');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && keyboardSection === 'search') {
      e.preventDefault();
      setKeyboardSection('list');
      setPickerFocusIdx(prev => Math.min(Math.max(prev, 0), Math.max(allFilteredResults.length - 1, 0)));
      return;
    }

    if (e.key === 'ArrowLeft' && keyboardSection === 'list') {
      e.preventDefault();
      onRequestStepTableFocus?.('last_menu');
      return;
    }

    if (e.key === 'ArrowLeft' && keyboardSection === 'search') {
      e.preventDefault();
      onRequestStepTableFocus?.('last_menu');
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setKeyboardSection('list');
      setPickerFocusIdx(prev => Math.min(prev + 1, allFilteredResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setKeyboardSection('list');
      setPickerFocusIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allFilteredResults[pickerFocusIdx];
      if (selected) {
        if (selected.type === 'local') {
          insertLocalStep(selected.data);
        } else {
          const mod = selected.data as CloudModule;
          const mid = mod.module_id || mod.module_key;
          if (installedModuleKeys.has(String(mid))) {
            insertCloudModule(mod);
          } else {
            setInstallingId(mid);
            installModule(mid).then(() => {
              refreshCommands?.();
              setInstallingId(null);
              insertCloudModule(mod);
            });
          }
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const scrollToSection = (section: 'navigation' | 'aichat', ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current && scrollContainerRef.current) {
      const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
      const elementTop = ref.current.getBoundingClientRect().top;
      const scrollOffset = elementTop - containerTop + scrollContainerRef.current.scrollTop - 20;

      scrollContainerRef.current.scrollTo({ top: scrollOffset, behavior: 'smooth' });
      setActiveSection(section);
    }
  };

  return (
    <div
      ref={speakerRootRef}
      className="h-full flex flex-col bg-[var(--color-popupBg)] overflow-hidden outline-none rounded-2xl shadow-2xl"
      onKeyDown={handleKeyDown}
      tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5">
        <h2 className="text-sm font-bold text-white tracking-normal">Select a step</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-white transition-all">
          <FaTimes size={14} />
        </button>
      </div>

      {/* Mirrored Search Bar Style - Full Width */}
      <div className="pb-0">
        <div className="relative group border-y border-white/5">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <FaSearch className="text-[var(--color-iconDefault)] group-focus-within:text-neutral-300 transition-colors" size={12} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setPickerFocusIdx(0);
              setKeyboardSection('search');
            }}
            onFocus={() => setKeyboardSection('search')}
            placeholder="Search modules..."
            className="w-full bg-white/5 rounded-[2px] py-2 pl-9 pr-4 border border-white/10 text-sm focus:outline-none transition-all placeholder:text-neutral-600"
          />
        </div>
      </div>

      {/* Results */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onMouseMove={() => setKeyboardSection('list')}
        className="flex-1 overflow-y-auto custom-scrollbar space-y-0">
        <div className="flex flex-col border-t border-white/5">
          {allFilteredResults.map((item, idx) => {
            const isLocal = item.type === 'local';
            const isPopular = isLocal && (item.data as any).isPopular;
            const isPro = isLocal && (item.data as any).isPro;

            // Popular header shows at the very top index 0 if it exists
            const showPopularHeader = idx === 0 && isPopular;

            // Pro header shows at the first item that is Pro
            const firstProIdx = allFilteredResults.findIndex(
              it => it.type === 'local' && (it.data as any).isPro,
            );
            const showProHeader = idx === firstProIdx && isPro;

            // Others header shows at the first item that is NOT popular and NOT Pro
            const firstOtherIdx = allFilteredResults.findIndex(
              it => !(it.type === 'local' && (it.data as any).isPopular) && !(it.type === 'local' && (it.data as any).isPro),
            );
            const showOthersHeader = idx === firstOtherIdx;

            return (
              <React.Fragment
                key={`${item.type}-${(item.data as any).id || (item.data as any).module_id || (item.data as any).module_key}`}>
                {showPopularHeader && <div className="px-3 py-1 text-[9px] font-bold text-neutral-600">Popular</div>}
                {showProHeader && (
                  <div className={`px-3 py-1 text-[9px] font-bold text-neutral-600 ${idx > 0 ? 'mt-1' : ''}`}>
                    Pro plan
                  </div>
                )}
                {showOthersHeader && (
                  <div className={`px-3 py-1 text-[9px] font-bold text-neutral-600 ${idx > 0 ? 'mt-1' : ''}`}>
                    Others
                  </div>
                )}
                {renderModuleCard(item, pickerFocusIdx === idx, idx)}
              </React.Fragment>
            );
          })}
        </div>

        {allFilteredResults.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-neutral-700 space-y-4 py-12">
            <FaSearch size={24} className="opacity-20" />
            <p className="text-[10px] font-bold tracking-widest uppercase">No modules found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationActionMenu;
