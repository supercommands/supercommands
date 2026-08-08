import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { FaTimes,
  FaRobot,
  FaTrash,
  FaCloudDownloadAlt,
  FaChevronLeft,
  FaCheck,
  FaPlus } from 'react-icons/fa';
import type { ModuleDefinition } from '../../../../../../background/src/automation/runtime_Execution_Engine/runner';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';


const normalizeAutomations = (raw: unknown): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') return Object.values(raw as Record<string, any>);
  return [];
};

const stepUsesModule = (step: any, moduleId: string): boolean => {
  if (!step || !moduleId) return false;
  const stepModuleId = String(step.moduleId || step.module_id || '');
  if (stepModuleId && stepModuleId === moduleId) return true;

  const nested = [step.subSteps, step.steps, step.config?.steps, step.config?.subSteps];

  return nested.some(list => Array.isArray(list) && list.some(child => stepUsesModule(child, moduleId)));
};

const automationUsesModule = (automation: any, moduleId: string): boolean => {
  const steps = automation?.steps || automation?.automation_steps || [];
  if (!Array.isArray(steps)) return false;
  return steps.some((step: any) => stepUsesModule(step, moduleId));
};

const formatCategoryTitle = (value: string): string => {
  if (!value) return 'Other';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
};

const getFaviconUrl = (host: string | null | undefined) => {
  if (!host) return '';
  const cleanDomain = String(host)
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];
  const fullUrl = `https://${cleanDomain}`;
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    fullUrl,
  )}&size=128`;
};

interface AutomationStoreProps {
  isOpen: boolean;
  onClose: () => void;
  moduleCatalog: any[];
  installedModules: ModuleDefinition[];
  installModule: (moduleId: string) => Promise<void>;
  uninstallModule: (moduleId: string) => Promise<void>;
  onImportModule: (module: any) => void;
  setInstalledModules: (modules: any[]) => void;
  refreshCommands?: () => void;
  refreshModules?: (force?: boolean) => Promise<void>;
  variant?: 'modal' | 'view';
  showImportActions?: boolean;
}

const AutomationStore: React.FC<AutomationStoreProps> = ({
  isOpen,
  onClose,
  moduleCatalog,
  installedModules,
  installModule,
  uninstallModule,
  onImportModule,
  setInstalledModules,
  refreshCommands,
  refreshModules,
  variant = 'modal',
  showImportActions = variant === 'modal',
}) => {
  if (!isOpen) return null;

  const [usageWarning, setUsageWarning] = useState<{ moduleName: string } | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null);
  const [installingCategoryKey, setInstallingCategoryKey] = useState<string | null>(null);
  const [listFocusIndex, setListFocusIndex] = useState(0);

  const checkModuleUsage = useCallback(async (moduleId: string): Promise<boolean> => {
    try {
      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.storage?.local?.get) return false;
      const result = await chromeAny.storage.local.get(['automations']);
      const automations = normalizeAutomations(result.automations);
      return automations.some(auto => automationUsesModule(auto, moduleId));
    } catch (error) {
      console.warn('[AutomationStore] Failed to check module usage:', error);
      return false;
    }
  }, []);

  const installedIdSet = useMemo(() => {
    return new Set(installedModules.map(mod => String(mod.module_id)));
  }, [installedModules]);

  const groupedCategories = useMemo(() => {
    const groups: Array<{
      key: string;
      title: string;
      description: string;
      iconHost: string;
      modules: any[];
      installedCount: number;
      totalCount: number;
    }> = [];

    const groupMap = new Map<string, (typeof groups)[number]>();

    moduleCatalog.forEach((module: any) => {
      const categoryRaw = module?.category || 'other';
      const key = String(categoryRaw).toLowerCase();
      const existing = groupMap.get(key);
      if (!existing) {
        const description =
          module?.parent_description || module?.description || 'Automation modules to speed up your workflows.';
        const iconHost = module?.parent_icon_host || module?.icon_host || module?.iconHost || '';
        const nextGroup = {
          key,
          title: formatCategoryTitle(String(categoryRaw)),
          description,
          iconHost,
          modules: [],
          installedCount: 0,
          totalCount: 0,
        };
        groupMap.set(key, nextGroup);
        groups.push(nextGroup);
      }

      const group = groupMap.get(key)!;
      group.modules.push(module);
    });

    groups.forEach(group => {
      group.totalCount = group.modules.length;
      group.installedCount = group.modules.filter(m => installedIdSet.has(String(m.module_id))).length;
    });

    return groups.sort((a, b) => a.title.localeCompare(b.title));
  }, [moduleCatalog, installedIdSet]);

  const activeCategory = groupedCategories.find(group => group.key === activeCategoryKey) || null;
  const selectedGroup = groupedCategories[listFocusIndex] || null;

  const handleInstallCategory = useCallback(
    async (categoryKey: string) => {
      const target = groupedCategories.find(group => group.key === categoryKey);
      if (!target) return;
      const modulesToInstall = target.modules.filter(m => !installedIdSet.has(String(m.module_id)));
      if (modulesToInstall.length === 0) return;

      setInstallingCategoryKey(categoryKey);
      try {
        for (const module of modulesToInstall) {
          await installModule(String(module.module_id));
        }
        if (refreshModules) {
          await refreshModules();
        } else if ((window as any)?.chrome?.storage?.local?.get) {
          const result = await (window as any).chrome.storage.local.get(['installed_modules']);
          setInstalledModules(result.installed_modules || []);
        }
        refreshCommands?.();
      } finally {
        setInstallingCategoryKey(null);
      }
    },
    [groupedCategories, installedIdSet, installModule, refreshModules, refreshCommands, setInstalledModules],
  );

  React.useEffect(() => {
    if (activeCategoryKey) return;
    if (groupedCategories.length === 0) {
      setListFocusIndex(0);
      return;
    }
    setListFocusIndex(prev => Math.min(Math.max(prev, 0), groupedCategories.length - 1));
  }, [activeCategoryKey, groupedCategories.length]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (activeCategoryKey) return;
      if (groupedCategories.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setListFocusIndex(prev => Math.min(prev + 1, groupedCategories.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setListFocusIndex(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const target = groupedCategories[listFocusIndex];
        if (target) setActiveCategoryKey(target.key);
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'ArrowRight') {
        event.stopPropagation();
        const target = groupedCategories[listFocusIndex];
        if (target) {
          event.preventDefault();
          handleInstallCategory(target.key);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, activeCategoryKey, groupedCategories, listFocusIndex, onClose, handleInstallCategory]);

  React.useEffect(() => {
    if (!isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      if (activeCategoryKey) {
        setActiveCategoryKey(null);
      } else {
        onClose();
      }
      return true;
    });
    return unregister;
  }, [isOpen, activeCategoryKey, onClose]);

  const refreshInstalledModules = useCallback(async () => {
    if (refreshModules) {
      await refreshModules(true);
      return;
    }
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.storage?.local?.get) return;
    const result = await chromeAny.storage.local.get(['installed_modules']);
    setInstalledModules(result.installed_modules || []);
  }, [refreshModules, setInstalledModules]);

  const handleInstallSingle = useCallback(
    async (module: any) => {
      // Optimistic update: Add the module to local state immediately
      const alreadyInstalled = installedModules.some((m: any) => String(m.module_id) === String(module.module_id));
      if (!alreadyInstalled) {
        setInstalledModules([...installedModules, module]);
      }

      await installModule(String(module.module_id));
      await refreshInstalledModules();
      refreshCommands?.();
    },
    [installModule, refreshInstalledModules, refreshCommands],
  );

  const handleUninstallSingle = useCallback(
    async (module: any) => {
      const isInUse = await checkModuleUsage(String(module.module_id));
      if (isInUse) {
        setUsageWarning({ moduleName: module.name || 'This module' });
        return;
      }
      // Optimistic update: Remove the module from local state immediately
      setInstalledModules(installedModules.filter((m: any) => String(m.module_id) !== String(module.module_id)));

      await uninstallModule(String(module.module_id));
      await refreshInstalledModules();
      refreshCommands?.();
    },
    [checkModuleUsage, refreshInstalledModules, refreshCommands, uninstallModule],
  );

  const content = (
    <div
      className={`w-full ${variant === 'modal' ? 'max-w-5xl max-h-[88vh]' : 'h-full'} rounded-3xl shadow-2xl border border-white/10 bg-[var(--color-popupBg)] overflow-hidden flex flex-col`}>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {!activeCategory ? (
          <div className="flex flex-col gap-2">
            {groupedCategories.map((group, index) => {
              const iconUrl = getFaviconUrl(group.iconHost);
              const isSelected = index === listFocusIndex;
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setActiveCategoryKey(group.key)}
                  onMouseEnter={() => setListFocusIndex(index)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-[var(--color-borderSelected)] bg-[var(--color-selectedBg)]'
                      : 'border-white/5 bg-[var(--color-popupBg)] hover:bg-[var(--color-hoverBg)]'
                  }`}>
                  <div className="w-10 h-10 rounded-2xl bg-[var(--color-popupBg)] shadow-sm border border-white/5 flex items-center justify-center overflow-hidden">
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-5 h-5 object-contain" />
                    ) : (
                      <FaRobot size={18} className="text-[var(--color-iconDefault)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-semibold text-[var(--color-textPrimary)] truncate">
                      {group.title}
                    </h4>
                    <p className="text-[11px] text-[var(--color-textSecondary)] leading-relaxed line-clamp-2">{group.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/5 bg-[var(--color-popupBg)] p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-popupBg)] shadow-sm border border-white/5 flex items-center justify-center overflow-hidden">
                  {activeCategory.iconHost ? (
                    <img src={getFaviconUrl(activeCategory.iconHost)} alt="" className="w-7 h-7 object-contain" />
                  ) : (
                    <FaRobot size={22} className="text-[var(--color-iconDefault)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xl font-bold text-[var(--color-textPrimary)]">{activeCategory.title}</h4>
                  <p className="text-[12px] text-[var(--color-textSecondary)] leading-relaxed mt-2">{activeCategory.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--color-textMuted)] font-semibold">
                    <span>
                      {activeCategory.installedCount}/{activeCategory.totalCount} installed
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                    <span>{activeCategory.totalCount} automations</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-[11px] font-semibold tracking-[0.2em] text-[var(--color-textMuted)] uppercase mb-3">
                Automations
              </h5>
              <div className="flex flex-col gap-3">
                {activeCategory.modules.map(module => {
                  const isInstalled = installedIdSet.has(String(module.module_id));
                  const moduleIcon = getFaviconUrl(module.icon_host || module.iconHost);

                  return (
                    <div
                      key={module.module_id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-[var(--color-popupBg)] px-4 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-popupBg)] border border-white/5 flex items-center justify-center overflow-hidden">
                          {moduleIcon ? (
                            <img src={moduleIcon} alt="" className="w-4 h-4 object-contain" />
                          ) : (
                            <FaRobot size={14} className="text-[var(--color-iconDefault)]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                            {module.name}
                          </p>
                          <p className="text-[11px] text-neutral-500 leading-relaxed line-clamp-2">
                            {module.description || 'Automation module for this workflow.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isInstalled ? (
                          <span className="px-3 py-1 rounded-lg bg-neutral-200 text-neutral-600 text-[10px] font-semibold border border-neutral-300">
                            Installed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInstallSingle(module)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-bold transition-all shadow-lg shadow-neutral-900/20">
                            <FaCloudDownloadAlt size={12} />
                            Install
                          </button>
                        )}
                        {showImportActions && isInstalled && (
                          <button
                            onClick={() => handleUninstallSingle(module)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-bold hover:bg-red-500/20 transition-all">
                            <FaTrash size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {!activeCategory && (
        <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-[var(--color-popupBg)] px-4 py-3 text-[10px] text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-600 dark:text-neutral-300">Esc</span>
            <span>Back</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-600 dark:text-neutral-300">Ctrl + →</span>
            <button
              type="button"
              onClick={() => selectedGroup && handleInstallCategory(selectedGroup.key)}
              disabled={!selectedGroup || selectedGroup.installedCount === selectedGroup.totalCount}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition disabled:opacity-40">
              {selectedGroup && selectedGroup.installedCount === selectedGroup.totalCount ? 'Installed' : 'Install'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-600 dark:text-neutral-300">Enter</span>
            <span>View Details</span>
          </div>
        </div>
      )}

      {activeCategory && (
        <div className="flex items-center justify-between gap-3 border-t border-white/5 bg-[var(--color-popupBg)] px-4 py-3 text-[10px] text-neutral-500">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[var(--color-popupBg)] border border-white/5 flex items-center justify-center overflow-hidden">
              {activeCategory.iconHost ? (
                <img src={getFaviconUrl(activeCategory.iconHost)} alt="" className="w-3.5 h-3.5 object-contain" />
              ) : (
                <FaRobot size={12} className="text-[var(--color-iconDefault)]" />
              )}
            </div>
            <span className="font-semibold text-neutral-700 dark:text-neutral-200 truncate">
              {activeCategory.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleInstallCategory(activeCategory.key)}
              disabled={activeCategory.installedCount === activeCategory.totalCount || installingCategoryKey !== null}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition ${
                activeCategory.installedCount === activeCategory.totalCount
                  ? 'border-neutral-200 text-neutral-400 bg-neutral-100 cursor-not-allowed'
                  : 'border-neutral-900 text-white bg-neutral-900 hover:bg-neutral-800'
              }`}>
              {activeCategory.installedCount === activeCategory.totalCount
                ? 'Installed'
                : installingCategoryKey === activeCategory.key
                  ? 'Adding...'
                  : 'Add all'}
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryKey(null)}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-white/10 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 transition">
              Back Esc
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={
        variant === 'modal'
          ? 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300'
          : 'w-full h-full'
      }>
      {content}

      {usageWarning && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-popupBg)] shadow-2xl border border-white/10 p-5">
            <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">Module In Use</h3>
            <p className="mt-2 text-xs text-[var(--color-textSecondary)] leading-relaxed">
              {usageWarning.moduleName} is currently used in one or more automations. Remove it from those automations
              before uninstalling.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setUsageWarning(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 text-white text-[11px] font-semibold hover:bg-neutral-700 transition">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationStore;
