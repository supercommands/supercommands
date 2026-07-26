import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import {
  FaCloudDownloadAlt,
  FaPlay,
  FaRobot,
  FaChevronRight,
  FaTerminal,
  FaTimes,
  FaPlus,
  FaTrash,
} from 'react-icons/fa';
import { FiCheck } from 'react-icons/fi';

import { useSelector } from 'react-redux';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { removeRecentCommand } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';

const KeyHint: React.FC<{ keys: string[] }> = ({ keys }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => (
        <React.Fragment key={idx}>
          <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-white dark:bg-neutral-700 px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
            {key}
          </span>
          {idx < keys.length - 1 && (
            <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-white dark:bg-neutral-700 px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
              +
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

type ModuleCatalogItem = {
  id?: number; // installation_id
  module_id: string;
  name: string;
  version?: number;
  execution_steps?: any[];
  category?: string;
  module_key?: string;
  description?: string;
  icon_host?: string;
  iconHost?: string;
  parent_description?: string;
  parent_icon_host?: string;
  parent_name?: string;
  command_id?: string;
  command_key?: string;
  command_description?: string;
  commands?: Array<string | Record<string, any>>;
  module_commands?: Array<string | Record<string, any>>;
  command_templates?: Array<string | Record<string, any>>;
  description_meta?: any;
};

type ConstantFieldDef = {
  key: string;
  defaultName: string;
  defaultDescription: string;
  defaultValue: string;
};

type ConstantFieldInput = {
  displayName: string;
  description: string;
  value: string;
};

type CommandViewItem = {
  id: string;
  prefix: string;
  description: string;
  sourceModule: ModuleCatalogItem;
  description_meta?: string;
  name?: string;
  moduleId?: string;
  isInstalled?: boolean;
};

interface AutomationCapabilitiesMenuProps {
  onExecuteModule?: (module: ModuleCatalogItem) => void;
  query?: string;
  activeTab?: 'catalog' | 'saved';
  onTabChange?: (tab: 'catalog' | 'saved') => void;
  onClose?: () => void;
}

const formatCategoryTitle = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();

const getFaviconUrl = (host: string | undefined | null): string => {
  if (!host) return '';
  const domain = String(host)
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];
  const fullUrl = `https://${domain}`;
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    fullUrl,
  )}&size=128`;
};

const toCommandToken = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const commandPrefixFromModule = (module: ModuleCatalogItem): string => {
  const raw =
    module.command_id ||
    module.command_key ||
    module.module_key ||
    module.name ||
    String(module.module_id || 'command');
  const normalized = toCommandToken(raw) || `module_${String(module.module_id || '').toLowerCase()}`;
  return `/${normalized}`;
};

const extractLongDescription = (meta: any): string | null => {
  if (Array.isArray(meta)) {
    const longObj = meta.find((item: any) => typeof item.long === 'string');
    return longObj?.long || null;
  }
  if (typeof meta === 'string') return meta;
  return null;
};

const commandDescriptionFromModule = (module: ModuleCatalogItem): string => {
  const metaLong = extractLongDescription(module.description_meta);
  if (metaLong) return metaLong;
  return String(module.command_description || module.description || 'Runs this command.');
};

const openModuleInNewTab = (module: ModuleCatalogItem) => {
  const moduleId = String(module?.module_id || '');
  if (!moduleId) return;
  const baseUrl =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('AltS_search_newtab/index.html')
      : 'AltS_search_newtab/index.html';
  const url = `${baseUrl}?trigger_hotkey=true&type=module&id=${encodeURIComponent(moduleId)}`;
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url, active: true });
  } else {
    window.open(url, '_blank', 'noopener');
  }
};

const getCommandDisplayName = (command: CommandViewItem): string => {
  const raw =
    command.sourceModule?.name ||
    command.sourceModule?.command_key ||
    command.sourceModule?.module_key ||
    command.prefix.replace(/^\//, '');
  return raw ? raw.toString() : command.prefix;
};

const resolveCommandIconHost = (command: CommandViewItem): string => {
  const directHost =
    command.sourceModule?.icon_host || command.sourceModule?.iconHost || command.sourceModule?.parent_icon_host || '';
  if (directHost) return String(directHost);

  const signature = [
    command.name,
    command.moduleId,
    command.prefix,
    command.sourceModule?.name,
    command.sourceModule?.module_key,
    command.sourceModule?.command_id,
    command.sourceModule?.command_key,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (signature.includes('gemini') || signature.includes('bard')) return 'gemini.google.com';
  if (signature.includes('claude') || signature.includes('anthropic')) return 'claude.ai';
  if (signature.includes('perplexity')) return 'perplexity.ai';
  if (signature.includes('gpt') || signature.includes('chatgpt') || signature.includes('openai')) return 'chatgpt.com';

  return '';
};

const parseCommandEntry = (entry: any, module: ModuleCatalogItem, fallbackIndex: number): CommandViewItem | null => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const prefix = `/${toCommandToken(entry)}`;
    if (!prefix || prefix === '/') return null;
    return {
      id: `${module.module_id}-str-${fallbackIndex}`,
      prefix,
      description: commandDescriptionFromModule(module),
      sourceModule: module,
    };
  }

  const rawCommand = String(
    entry.command_id || entry.command_key || entry.command || entry.slug || entry.name || '',
  ).trim();
  const prefix = rawCommand ? `/${toCommandToken(rawCommand)}` : commandPrefixFromModule(module);
  const description = String(
    entry.description ||
    entry.help_text ||
    entry.action_description ||
    entry.summary ||
    commandDescriptionFromModule(module),
  ).trim();

  return {
    id: String(entry.id || entry.command_id || `${module.module_id}-obj-${fallbackIndex}`),
    prefix,
    description: description || commandDescriptionFromModule(module),
    sourceModule: module,
  };
};

const extractCommandsForModule = (module: ModuleCatalogItem): CommandViewItem[] => {
  const fromArrays = [
    ...(Array.isArray(module.commands) ? module.commands : []),
    ...(Array.isArray(module.module_commands) ? module.module_commands : []),
    ...(Array.isArray(module.command_templates) ? module.command_templates : []),
  ];

  const parsed = fromArrays
    .map((entry, index) => parseCommandEntry(entry, module, index))
    .filter((entry): entry is CommandViewItem => !!entry && !!entry.prefix && entry.prefix !== '/');

  if (parsed.length > 0) {
    const unique = new Map<string, CommandViewItem>();
    parsed.forEach(item => {
      if (!unique.has(item.prefix)) unique.set(item.prefix, item);
    });
    return Array.from(unique.values());
  }

  return [
    {
      id: `${module.module_id}-fallback`,
      prefix: commandPrefixFromModule(module),
      description: commandDescriptionFromModule(module),
      sourceModule: module,
    },
  ];
};

const extractConstantFieldsFromModule = (module: ModuleCatalogItem): ConstantFieldDef[] => {
  const defs = new Map<string, ConstantFieldDef>();

  const upsert = (keyRaw: string, source?: any) => {
    const key = String(keyRaw || '').trim();
    if (!key) return;
    const existing = defs.get(key);
    const next: ConstantFieldDef = {
      key,
      defaultName:
        String(source?.customName || source?.displayName || source?.name || key)
          .replace(/[_-]+/g, ' ')
          .trim() || key,
      defaultDescription: String(source?.description || '').trim(),
      defaultValue: String(
        Array.isArray(source?.values) ? source.values[0] : (source?.value ?? source?.fixedValue ?? ''),
      ).trim(),
    };
    if (!existing) {
      defs.set(key, next);
      return;
    }
    defs.set(key, {
      key,
      defaultName: existing.defaultName || next.defaultName,
      defaultDescription: existing.defaultDescription || next.defaultDescription,
      defaultValue: existing.defaultValue || next.defaultValue,
    });
  };

  const walk = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;

    const paramConfigs = (node as any).paramConfigs;
    if (paramConfigs && typeof paramConfigs === 'object') {
      Object.entries(paramConfigs).forEach(([paramKey, cfg]: [string, any]) => {
        if (String(cfg?.type || '').toLowerCase() === 'constant') {
          upsert(paramKey, cfg);
        }
      });
    }

    const prompts = (node as any).prompts;
    if (Array.isArray(prompts)) {
      prompts.forEach((prompt: any) => {
        if (String(prompt?.type || '').toLowerCase() === 'constant') {
          upsert(String(prompt?.key || ''), prompt);
        }
      });
    }

    const variables = (node as any).variables;
    if (Array.isArray(variables)) {
      variables.forEach((variable: any) => {
        if (String(variable?.type || '').toLowerCase() === 'constant') {
          upsert(String(variable?.key || ''), variable);
        }
      });
    }

    Object.values(node).forEach(walk);
  };

  walk(module);
  return Array.from(defs.values());
};

// Removed FocusedIndicator

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

const AutomationCapabilitiesMenu: React.FC<AutomationCapabilitiesMenuProps> = ({
  onExecuteModule,
  query = '',
  activeTab = 'catalog',
  onTabChange,
  onClose,
}) => {
  const [moduleCatalog, setModuleCatalog] = useState<ModuleCatalogItem[]>([]);
  const [installedModules, setInstalledModules] = useState<ModuleCatalogItem[]>([]);
  const [modulesMetadata, setModulesMetadata] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installingCategoryKey, setInstallingCategoryKey] = useState<string | null>(null);
  const [isInstallingModuleId, setIsInstallingModuleId] = useState<string | null>(null);
  const [isUninstallingModuleId, setIsUninstallingModuleId] = useState<string | null>(null);
  const [isUninstallingCategoryKey, setIsUninstallingCategoryKey] = useState<string | null>(null);
  const [constantWizard, setConstantWizard] = useState<{
    module: ModuleCatalogItem;
    defs: ConstantFieldDef[];
    index: number;
    values: Record<string, ConstantFieldInput>;
    error: string | null;
  } | null>(null);
  const constantWizardResolverRef = useRef<((value: Record<string, ConstantFieldInput> | null) => void) | null>(null);
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { dynamicFontSize, dynamicTitleFontSize, dynamicPadding } = useMemo(() => {
    const width = windowWidth;

    let fontSize = 12; // Base for categories/commands
    let titleFontSize = 15; // Base for selected header
    let py = 8;
    let px = 16;

    if (width >= 1800) {
      fontSize = 15.5;
      titleFontSize = 22;
      py = 12;
      px = 24;
    } else if (width >= 1600) {
      fontSize = 14;
      titleFontSize = 19;
      py = 10;
      px = 20;
    } else if (width >= 1350) {
      fontSize = 13;
      titleFontSize = 17;
      py = 9;
      px = 18;
    }

    return {
      dynamicFontSize: fontSize,
      dynamicTitleFontSize: titleFontSize,
      dynamicPadding: { py, px },
    };
  }, [windowWidth]);

  // Two Column Navigation State
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);
  const [focusedSide, setFocusedSide] = useState<'left' | 'right'>('left');

  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const leftListRef = useRef<HTMLDivElement>(null);
  const rightListRef = useRef<HTMLDivElement>(null);
  const leftItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const fetchModules = useCallback(async (forceCloud = false) => {
    const chromeAny = (window as any).chrome;

    try {
      if (!forceCloud) {
        // 1. Try to load from storage first
        const cached = await chromeAny.storage.local.get(['installed_modules', 'modules_metadata']);
        if (cached?.installed_modules && Array.isArray(cached.installed_modules)) {
          setInstalledModules(cached.installed_modules);
          setModuleCatalog(cached.installed_modules); // For initial view
          if (cached.modules_metadata) setModulesMetadata(cached.modules_metadata);
          setIsLoading(false);
        }
      }

      const catalogResult: any[] = [];
      const catalogList = Array.isArray(catalogResult) ? catalogResult : [];

      setModuleCatalog(catalogList);

      const cached = await chromeAny.storage.local.get(['modules_metadata']);
      if (cached?.modules_metadata) {
        setModulesMetadata(cached.modules_metadata);
      }
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load module catalog.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();

    // Listen for storage changes
    const storageListener = (changes: any) => {
      if (changes.installed_modules) {
        setInstalledModules(changes.installed_modules.newValue || []);
      }
      if (changes.modules_metadata) {
        setModulesMetadata(changes.modules_metadata.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => chrome.storage.onChanged.removeListener(storageListener);
  }, [fetchModules]);

  const installedIdSet = useMemo(
    () => new Set(installedModules.map(module => String(module.module_id))),
    [installedModules],
  );

  const openConstantWizard = useCallback(
    (module: ModuleCatalogItem, defs: ConstantFieldDef[]): Promise<Record<string, ConstantFieldInput> | null> => {
      const initialValues = defs.reduce(
        (acc, def) => {
          acc[def.key] = {
            displayName: def.defaultName || '',
            description: def.defaultDescription || '',
            value: '',
          };
          return acc;
        },
        {} as Record<string, ConstantFieldInput>,
      );

      setConstantWizard({
        module,
        defs,
        index: 0,
        values: initialValues,
        error: null,
      });

      return new Promise(resolve => {
        constantWizardResolverRef.current = resolve;
      });
    },
    [],
  );

  const resolveConstantWizard = useCallback((result: Record<string, ConstantFieldInput> | null) => {
    if (constantWizardResolverRef.current) {
      constantWizardResolverRef.current(result);
      constantWizardResolverRef.current = null;
    }
    setConstantWizard(null);
  }, []);

  const handleInstallModule = useCallback(
    async (module: ModuleCatalogItem) => {
      const moduleId = String(module.module_id || '');
      if (!moduleId) return;

      setIsInstallingModuleId(moduleId);
      try {
        const constantDefs = extractConstantFieldsFromModule(module);
        let settings: Record<string, any> | undefined;

        if (constantDefs.length > 0) {
          const filled = await openConstantWizard(module, constantDefs);
          if (!filled) return;

          const constants = Object.entries(filled).reduce(
            (acc, [key, value]) => {
              acc[key] = {
                type: 'constant',
                displayName: value.displayName,
                description: value.description,
                values: [value.value],
                value: value.value,
              };
              return acc;
            },
            {} as Record<string, any>,
          );

          settings = { constants };
        }

        // Optimistic update: Add the module to local state immediately
        setInstalledModules(prev => {
          if (prev.find(m => String(m.module_id) === moduleId)) return prev;
          return [...prev, module];
        });


        await fetchModules(true);
      } catch (err) {
        console.error(`Failed to install module ${moduleId}:`, err);
        throw err;
      } finally {
        setIsInstallingModuleId(null);
      }
    },
    [openConstantWizard],
  );

  const handleUninstallModule = useCallback(async (module: ModuleCatalogItem) => {
    const moduleId = String(module.module_id || '');
    if (!moduleId) return;

    setIsUninstallingModuleId(moduleId);
    try {
      // Optimistic update: Remove the module from local state immediately
      setInstalledModules(prev => prev.filter(m => String(m.module_id) !== moduleId));



      // Cleanup search history/recent commands for this module
      const prefix = commandPrefixFromModule(module);
      if (prefix) {
        removeRecentCommand(prefix);
        // Also check for raw variants that might be in recents
        removeRecentCommand(prefix.replace(/^\//, ''));
      }
      await fetchModules(true);
    } catch (err) {
      console.error(`Failed to uninstall module ${moduleId}:`, err);
      throw err;
    } finally {
      setIsUninstallingModuleId(null);
    }
  }, []);

  const handleUninstallCategory = useCallback(
    async (group: any) => {
      if (!group.modules || group.modules.length === 0) return;
      setIsUninstallingCategoryKey(group.key);
      try {
        const installed = group.modules.filter((m: any) => installedIdSet.has(String(m.module_id)));

        // Concurrent uninstallation for speed and robustness
        const results = await Promise.allSettled(installed.map((m: ModuleCatalogItem) => handleUninstallModule(m)));

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.warn(`Some modules failed to uninstall:`, failures);
        }

        await fetchModules();
      } catch (err) {
        console.error(`Failed to uninstall category ${group.key}:`, err);
      } finally {
        setIsUninstallingCategoryKey(null);
      }
    },
    [installedIdSet, fetchModules, handleUninstallModule],
  );

  const handleInstallCategory = useCallback(
    async (group: any) => {
      if (!group.modules || group.modules.length === 0) return;
      setInstallingCategoryKey(group.key);
      try {
        const uninstalled = group.modules.filter((m: any) => !installedIdSet.has(String(m.module_id)));
        for (const m of uninstalled) {
          await handleInstallModule(m);
        }
        await fetchModules();
      } finally {
        setInstallingCategoryKey(null);
      }
    },
    [installedIdSet, fetchModules, handleInstallModule],
  );

  const filteredModules = useMemo(() => {
    const lowerQuery = String(query || '')
      .toLowerCase()
      .trim();
    if (!lowerQuery) return moduleCatalog;
    return moduleCatalog.filter(m => {
      const name = String(m.name || m.module_key || '').toLowerCase();
      const desc = String(m.description || m.parent_description || '').toLowerCase();
      const cat = String(m.category || m.parent_name || '').toLowerCase();
      return name.includes(lowerQuery) || desc.includes(lowerQuery) || cat.includes(lowerQuery);
    });
  }, [moduleCatalog, query]);

  const groupedCategories = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        description: string;
        iconHost: string;
        iconUrl: string;
        modules: ModuleCatalogItem[];
        totalCount: number;
        installedCount: number;
      }
    >();

    filteredModules.forEach(module => {
      const categoryRaw = String(module?.category || module?.parent_name || 'other');
      const key = categoryRaw.toLowerCase();
      const meta = modulesMetadata[String(module.module_id)];

      if (!groups.has(key)) {
        const iconHost = module?.icon_host || module?.parent_icon_host || module?.iconHost || '';
        groups.set(key, {
          key,
          title: formatCategoryTitle(categoryRaw),
          description:
            extractLongDescription(meta?.description_meta) ||
            module?.parent_description ||
            module?.description ||
            'Automation commands for this integration.',
          iconHost,
          iconUrl: getFaviconUrl(iconHost),
          modules: [],
          totalCount: 0,
          installedCount: 0,
        });
      }
      const group = groups.get(key);
      if (group) {
        group.modules.push(module);
        group.totalCount++;
        if (installedIdSet.has(String(module.module_id))) {
          group.installedCount++;
        }
      }
    });

    return Array.from(groups.values()).sort((left, right) => left.title.localeCompare(right.title));
  }, [filteredModules, installedIdSet, modulesMetadata]);

  const [lastQuery, setLastQuery] = useState(query);
  useEffect(() => {
    if (query !== lastQuery) {
      setLeftIndex(0);
      setRightIndex(0);
      setLastQuery(query);
    }
  }, [query, lastQuery]);

  const selectedCategory = groupedCategories[leftIndex] || null;

  const selectedCategoryCommands = useMemo(() => {
    if (!selectedCategory) return [];

    const all = selectedCategory.modules.flatMap(module => {
      const meta = modulesMetadata[String(module.module_id)];
      const commands = extractCommandsForModule(module);
      return commands.map(cmd => ({
        ...cmd,
        name: String(cmd.name || module.name || module.module_key || ''),
        moduleId: String(module.module_id),
        isInstalled: installedIdSet.has(String(module.module_id)),
        description_meta: extractLongDescription(meta?.description_meta) || cmd.description,
      }));
    });

    const deduped: any[] = [];
    const prefixes = new Set();
    all.forEach(item => {
      if (!prefixes.has(item.prefix)) {
        prefixes.add(item.prefix);
        deduped.push(item);
      }
    });
    return deduped;
  }, [selectedCategory, installedIdSet, modulesMetadata]);

  // Reset highlight state when query changes
  useEffect(() => {
    setLeftIndex(0);
    setRightIndex(0);
    setFocusedSide('left');
  }, [query]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isInput =
          (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          if (focusedSide === 'right') {
            setFocusedSide('left');
            setRightIndex(0);
          } else {
            onClose?.();
          }
          return;
        }
      }

      if (groupedCategories.length === 0) return;

      const maxLeft = groupedCategories.length - 1;
      const maxRight = selectedCategoryCommands.length - 1;

      if (e.key === 'ArrowDown') {
        e.stopPropagation();
        if (focusedSide === 'left') {
          e.preventDefault();
          setLeftIndex(prev => (prev >= maxLeft ? 0 : prev + 1));
          setRightIndex(0);
        } else if (maxRight >= 0) {
          e.preventDefault();
          setRightIndex(prev => (prev >= maxRight ? 0 : prev + 1));
        }
      } else if (e.key === 'ArrowUp') {
        e.stopPropagation();
        if (focusedSide === 'left') {
          e.preventDefault();
          setLeftIndex(prev => (prev <= 0 ? maxLeft : prev - 1));
          setRightIndex(0);
        } else if (maxRight >= 0) {
          e.preventDefault();
          setRightIndex(prev => (prev <= 0 ? maxRight : prev - 1));
        }
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        if (focusedSide === 'left' && maxRight >= 0) {
          e.preventDefault();
          setFocusedSide('right');
        }
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        if (focusedSide === 'right') {
          e.preventDefault();
          setFocusedSide('left');
          setRightIndex(0);
        }
      } else if (e.key === 'Enter') {
        const isInput =
          (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';

        if (focusedSide === 'right') {
          e.preventDefault();
          const cmd = selectedCategoryCommands[rightIndex];
          if (cmd) {
            // Visual feedback: briefly show active state if possible (handled via selection highlight usually)
            if (cmd.isInstalled) {
              if (onExecuteModule) {
                onExecuteModule(cmd.sourceModule);
              } else {
                openModuleInNewTab(cmd.sourceModule);
              }
            } else {
              // Trigger installation
              const moduleId = cmd.moduleId || cmd.sourceModule?.module_id;
              if (moduleId) {
                const targetModule = cmd.sourceModule;
                handleInstallModule(targetModule).then(() => fetchModules());
              }
            }
          }
        } else if (!isInput) {
          // Only switch focus if not typing in an input
          e.preventDefault();
          // If on left side, switch focus to the right side commands
          if (selectedCategoryCommands.length > 0) {
            setFocusedSide('right');
            setRightIndex(0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    groupedCategories,
    leftIndex,
    rightIndex,
    focusedSide,
    selectedCategoryCommands,
    fetchModules,
    onExecuteModule,
    handleInstallModule,
  ]);

  // Scroll active items into view
  useEffect(() => {
    if (focusedSide === 'left' && leftItemRefs.current[leftIndex]) {
      leftItemRefs.current[leftIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (focusedSide === 'right' && rightItemRefs.current[rightIndex]) {
      rightItemRefs.current[rightIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [leftIndex, rightIndex, focusedSide]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-white/60">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          Loading automation store...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/70">
        <span className="text-sm">{error}</span>
        <button
          type="button"
          onClick={() => fetchModules(true)}
          className="rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
          Retry
        </button>
      </div>
    );
  }

  const primaryTextColor = isDark ? 'text-white' : 'text-[#073642]';
  const secondaryTextColor = isDark ? 'text-white/45' : 'text-[#586e75]';

  return (
    <div
      className={`relative flex flex-col h-[100%] max-h-[90vh] w-full min-w-0 bg-transparent overflow-hidden border rounded-xl dark:rounded-none ${isDark ? 'border-white/10 dark:border-white/10' : 'border-black/5'
        }`}>
      <div className="flex flex-1 w-full min-h-0">
        {/* LEFT COLUMN: MASTER LIST (40%) */}
        <div
          ref={leftListRef}
          className={`w-[40%] min-w-0 flex flex-col border-r overflow-y-auto custom-scrollbar ${isDark ? 'border-white/10' : 'bg-white border-black/5'
            }`}>
          {/* <div className={`flex items-center justify-between border-b px-4 py-2 ${isDark ? 'border-white/10' : 'border-black/5'}`}>
          <h2 className="text-[13px] font-semibold text-[var(--color-textPrimary)]" style={headingFontStyle}>
            Automation Store
          </h2>
        </div> */}

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-stretch justify-start pt-1">
            {groupedCategories.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-[12px] text-white/35">
                No items found.
              </div>
            ) : (
              groupedCategories.map((group, index) => {
                const isActive = index === leftIndex;
                const isTarget = isActive && focusedSide === 'left';
                const isGroupInstalled = group.installedCount === group.totalCount;

                return (
                  <div
                    key={`group-${group.key}`}
                    ref={el => {
                      leftItemRefs.current[index] = el;
                    }}
                    onClick={() => {
                      if (leftIndex !== index) {
                        setLeftIndex(index);
                        setRightIndex(0);
                      }
                      setFocusedSide('right');
                    }}
                    className={`relative group flex items-center gap-3 border-b text-left transition ${isDark ? 'border-white/5' : 'border-black/5'
                      } ${isTarget
                        ? isDark
                          ? 'bg-white/10'
                          : 'bg-white'
                        : isActive
                          ? isDark
                            ? 'bg-white/5'
                            : 'bg-white'
                          : isDark
                            ? 'hover:bg-white/5'
                            : 'hover:bg-black/5'
                      }`}
                    style={{ padding: `${dynamicPadding.py}px ${dynamicPadding.px}px` }}>
                    {/* Removed FocusedIndicator usages */}

                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded overflow-hidden flex-shrink-0
                    ${isDark ? 'bg-transparent' : 'bg-white shadow-sm border border-black/5'}
                  `}>
                      {group.iconUrl ? (
                        <img src={group.iconUrl} alt="" className="h-4 w-4 object-contain" />
                      ) : (
                        <FaRobot size={12} className="text-white/60" />
                      )}
                    </span>

                    <div className="flex flex-col flex-1 min-w-0">
                      <span
                        className={`truncate font-medium leading-tight ${isDark ? 'text-white' : 'text-[#073642]'}`}
                        style={{ ...headingFontStyle, fontSize: `${dynamicFontSize}px` }}>
                        {group.title}
                      </span>
                    </div>

                    <div
                      className={`flex items-center justify-end flex-shrink-0 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        } focus-within:opacity-100`}>
                      {!isGroupInstalled ? (
                        <button
                          type="button"
                          disabled={installingCategoryKey !== null || isUninstallingCategoryKey !== null}
                          onClick={e => {
                            e.stopPropagation();
                            handleInstallCategory(group);
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition border border-[#10b981]/50 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 shadow-sm shadow-[#10b981]/10">
                          {installingCategoryKey === group.key ? (
                            <div className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <FaCloudDownloadAlt size={9} />
                          )}
                          Install All
                        </button>
                      ) : (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${isDark
                              ? 'border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]'
                              : 'border-[#10b981]/20 bg-[#10b981]/5 text-[#059669]'
                            }`}>
                          <FaCloudDownloadAlt size={10} className="drop-shadow-sm" />
                          <span className="text-[10px] font-black tracking-widest">Installed</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION LIST (60%) */}
        <div
          ref={rightListRef}
          className={`w-[60%] min-w-0 flex flex-col overflow-y-auto custom-scrollbar ${isDark ? 'bg-black/20' : 'bg-white'
            }`}>
          <div className="flex-1 overflow-y-auto p-4 pt-5 custom-scrollbar">
            {!selectedCategory ? (
              <div className="flex h-full items-center justify-center text-[12px] text-white/35 italic">
                Select an item to view commands
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-transparent">
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg 
                       ${isDark ? 'bg-transparent' : 'bg-white shadow-sm border border-black/5'}
                     `}>
                        {selectedCategory.iconUrl ? (
                          <img
                            src={selectedCategory.iconUrl}
                            alt={selectedCategory.title}
                            className="h-6 w-6 object-contain"
                          />
                        ) : (
                          <FaRobot size={18} className="text-white/70" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h4
                          className={`truncate font-semibold ${isDark ? 'text-white/90' : 'text-[#073642]'}`}
                          style={{ ...headingFontStyle, fontSize: `${dynamicTitleFontSize}px` }}>
                          {selectedCategory.title}
                        </h4>
                        <p
                          className={`truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-[#586e75]'}`}
                          style={{ fontSize: `${dynamicFontSize - 1}px` }}>
                          {selectedCategory.description}
                        </p>
                      </div>
                    </div>

                    {/* Header Action: Installed Indicator (Only if fully installed) */}
                    {selectedCategory.installedCount === selectedCategory.totalCount && (
                      <div className="flex-shrink-0 animate-in fade-in slide-in-from-left-2 duration-300">
                        <button
                          type="button"
                          disabled={installingCategoryKey !== null || isUninstallingCategoryKey !== null}
                          onClick={e => {
                            e.stopPropagation();
                            handleUninstallCategory(selectedCategory);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition active:scale-95 ${isDark
                              ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            }`}>
                          {isUninstallingCategoryKey === selectedCategory.key && (
                            <div className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                          )}
                          Uninstall All
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="space-y-0.5">
                    {selectedCategoryCommands.map((command, index) => {
                      const isActive = index === rightIndex;
                      const isTarget = isActive && focusedSide === 'right';

                      return (
                        <div
                          key={command.id}
                          ref={el => {
                            rightItemRefs.current[index] = el;
                          }}
                          onClick={() => {
                            if (command.isInstalled) {
                              if (onExecuteModule) onExecuteModule(command.sourceModule);
                              else openModuleInNewTab(command.sourceModule);
                            } else {
                              handleInstallModule(command.sourceModule).then(() => fetchModules());
                            }
                          }}
                          className={`relative grid grid-cols-[1fr_auto] items-center gap-3 border-b transition-colors ${isDark ? 'border-white/10' : 'border-black/10'
                            } ${isTarget
                              ? isDark
                                ? 'bg-white/10'
                                : 'bg-white'
                              : isDark
                                ? 'hover:bg-white/5'
                                : 'hover:bg-black/5'
                            }`}
                          style={{ padding: `${dynamicPadding.py}px ${dynamicPadding.px}px` }}>
                          {/* Removed FocusedIndicator usages */}

                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
                                }`}>
                              {(() => {
                                const commandIconHost = resolveCommandIconHost(command);
                                if (commandIconHost) {
                                  return (
                                    <img
                                      src={getFaviconUrl(commandIconHost)}
                                      alt=""
                                      className="h-4 w-4 object-contain"
                                    />
                                  );
                                }

                                if (selectedCategory?.iconUrl) {
                                  return (
                                    <img src={selectedCategory.iconUrl} alt="" className="h-4 w-4 object-contain" />
                                  );
                                }
                                return (
                                  <FaTerminal size={11} className={isDark ? 'text-white/40' : 'text-[#586e75]'} />
                                );
                              })()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={`truncate font-medium ${isDark ? 'text-white' : 'text-[#073642]'}`}
                                style={{ ...headingFontStyle, fontSize: `${dynamicFontSize}px` }}>
                                {getCommandDisplayName(command)}
                              </p>
                              <p
                                className={`truncate ${isDark ? 'text-white' : 'text-[#586e75]'} opacity-100`}
                                style={{ fontSize: `${dynamicFontSize - 2}px` }}>
                                {command.description_meta || command.description}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 transition-all duration-200 ${isTarget ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
                            {/* Individual Uninstall button removed as per request */}

                            <button
                              type="button"
                              tabIndex={-1}
                              disabled={isInstallingModuleId === String(command.moduleId)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition active:scale-95 ${isDark
                                  ? command.isInstalled
                                    ? 'border-white/20 bg-transparent text-white/80 hover:bg-white/10'
                                    : 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20'
                                  : command.isInstalled
                                    ? 'border-black/10 bg-white text-[#073642] hover:bg-neutral-100'
                                    : 'border-[#10b981]/30 bg-[#10b981]/5 text-[#059669] hover:bg-[#10b981]/10'
                                }`}>
                              {command.isInstalled ? <FaPlay size={9} /> : <FaCloudDownloadAlt size={9} />}
                              {command.isInstalled
                                ? 'Try'
                                : isInstallingModuleId === String(command.moduleId)
                                  ? 'Installing...'
                                  : 'Install'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className={`flex-none h-8 border-t flex items-center justify-between px-4 z-30 ${isDark ? 'border-white/10 bg-black/90 text-white/40' : 'border-black/5 bg-white text-neutral-500'}`}>
        <div className="flex items-center gap-4 text-[10px] font-bold">
          <div className="flex items-center gap-1.5">
            <KeyHint keys={['Esc']} />
            <span>Back</span>
          </div>
          <div className="flex items-center gap-1.5">
            <KeyHint keys={['Enter']} />
            <span>Try / Install</span>
          </div>
        </div>
      </div>

      {constantWizard && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-neutral-950 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-[12px] font-bold text-white line-clamp-1">
                  {constantWizard.module.description || 'Configure Skill Settings'}
                </h3>
              </div>
              <button
                onClick={() => resolveConstantWizard(null)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <FaTimes size={14} />
              </button>
            </div>

            {/* Table Body */}
            <div className="p-0 border-y border-white/10">
              <div className="overflow-hidden bg-black/40">
                <div className="grid grid-cols-[1fr_1.2fr] border-b border-white/10 text-[9px] font-bold tracking-wider uppercase text-white/40 bg-white/[0.03]">
                  <div className="px-4 py-2 border-r border-white/10 text-left">Name</div>
                  <div className="px-4 py-2 text-left">Value</div>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {constantWizard.defs.map(def => {
                    const current = constantWizard.values[def.key];
                    return (
                      <div
                        key={def.key}
                        className="grid grid-cols-[1fr_1.2fr] border-b border-white/5 last:border-b-0 text-[10px] text-white/90 hover:bg-white/[0.02] transition-all group/row relative">
                        <div className="px-4 py-2 border-r border-white/10 flex flex-col gap-0.5">
                          <input
                            value={current.displayName}
                            onChange={e =>
                              setConstantWizard(prev =>
                                prev
                                  ? {
                                    ...prev,
                                    error: null,
                                    values: {
                                      ...prev.values,
                                      [def.key]: { ...prev.values[def.key], displayName: e.target.value },
                                    },
                                  }
                                  : prev,
                              )
                            }
                            placeholder="Name"
                            className="w-full bg-transparent border-none p-0 text-[10px] font-bold text-white focus:text-emerald-400 outline-none transition-colors"
                          />
                          <span className="text-[8px] text-white/20 font-medium leading-tight line-clamp-1">
                            {def.defaultDescription}
                          </span>
                        </div>
                        <div className="px-4 py-2 flex items-center pr-10">
                          <input
                            value={current.value}
                            onChange={e =>
                              setConstantWizard(prev =>
                                prev
                                  ? {
                                    ...prev,
                                    error: null,
                                    values: {
                                      ...prev.values,
                                      [def.key]: { ...prev.values[def.key], value: e.target.value },
                                    },
                                  }
                                  : prev,
                              )
                            }
                            autoFocus={constantWizard.defs.length === 1}
                            placeholder="Enter value..."
                            className="w-full bg-transparent border-none p-0 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                          />
                          {constantWizard.defs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setConstantWizard(prev => {
                                  if (!prev) return prev;
                                  const newDefs = prev.defs.filter(d => d.key !== def.key);
                                  const newValues = { ...prev.values };
                                  delete newValues[def.key];
                                  return { ...prev, defs: newDefs, values: newValues };
                                });
                              }}
                              className="absolute right-3 opacity-0 group-hover/row:opacity-100 p-1.5 rounded-md text-red-400 hover:bg-red-400/10 transition-all active:scale-90">
                              <FaTrash size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-center p-2 border-t border-white/10 bg-white/[0.01]">
                <button
                  type="button"
                  onClick={() => {
                    const newKey = `custom_${Date.now()}`;
                    setConstantWizard(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        defs: [
                          ...prev.defs,
                          { key: newKey, defaultName: '', defaultDescription: '', defaultValue: '' },
                        ],
                        values: {
                          ...prev.values,
                          [newKey]: { displayName: '', description: '', value: '' },
                        },
                      };
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[9px] font-bold text-white/60 hover:text-white transition-all active:scale-95">
                  <FaPlus size={8} />
                  Add Row
                </button>
              </div>
            </div>

            {/* Error Message */}
            {constantWizard.error && (
              <div className="px-6 py-2">
                <p className="text-[11px] text-red-400 font-medium">{constantWizard.error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
              <button
                type="button"
                onClick={() => resolveConstantWizard(null)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-800 group/esc">
                <span className="text-[10px] font-medium text-neutral-400 group-hover/esc:text-white transition-colors">
                  Cancel
                </span>
                <span className="flex items-center rounded border border-white/10 bg-white/5 px-1 py-0 text-[8px] font-semibold text-neutral-500 group-hover/esc:text-neutral-300 transition-colors">
                  Esc
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!constantWizard) return;
                  const missing = constantWizard.defs.find(def => {
                    const v = constantWizard.values[def.key];
                    return !v.displayName.trim() || !v.value.trim();
                  });
                  if (missing) {
                    setConstantWizard(prev => (prev ? { ...prev, error: 'All Names and Values are required.' } : prev));
                    return;
                  }
                  resolveConstantWizard(constantWizard.values);
                }}
                className="flex items-center gap-2 rounded-md border border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 px-3 py-1.5 text-[11px] font-bold shadow-sm transition-all hover:border-[#b9adff] dark:hover:border-[#8f93ff] active:scale-95">
                <span>Install Skill</span>
                <span className="flex items-center gap-0.5 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                  <span className="rounded border border-white/80 dark:border-white/20 bg-white dark:bg-neutral-700 px-0.5">
                    {isMac ? '⌘' : 'Ctrl'}
                  </span>
                  <span>+</span>
                  <span className="rounded border border-white/80 dark:border-white/20 bg-white dark:bg-neutral-700 px-0.5">
                    Enter
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationCapabilitiesMenu;
