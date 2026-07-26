import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppearance } from '@extension/ui';
import {
  FaEdit,
  FaTimes,
  FaRobot,
  FaPlay,
  FaPencilAlt,
  FaLink,
  FaSave,
  FaTerminal,
  FaChevronDown,
  FaStar,
  FaCloudDownloadAlt,
  FaChevronRight,
} from 'react-icons/fa';
import {
  HighlightedInput,
  extractParamName,
  formatParamBadgeName,
  PARAM_TYPE_BADGE_LABEL,
  parseUrlParts,
  assembleUrl,
} from '../steps/automationStepPicker';
import type { ParamInputType, ParamConfig } from '../steps/automationStepPicker';
import { useSelector } from 'react-redux';
import AutomationDynamicIcon from '../../../../../shared-components/icons/automationDynamicIcon';
import { getUserId } from '../../../../../storage/API/core/api';
import { FiCheck, FiStar } from 'react-icons/fi';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { ShortcutAssignButton } from '../../../../../shared-components/shortcuts';
import { getUserHotkey } from '../../../../../shared-components/hotkeys';
import { getUserShortcut } from '../../../../../shared-components/shortcuts';
import { saveHotkey as apiSaveHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut } from '../../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import { useUIStore } from '../../../../../shared-components/uiStateManager';


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

const getFaviconUrl = (host: string | undefined | null): string => {
  if (!host) return '';
  let domain = String(host)
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];

  // Try using parseUrlParts if host looks like a full URL
  const parts = parseUrlParts(host);
  if (parts?.domain) {
    domain = parts.domain.replace(/^www\./, '');
  }

  const fullUrl = `https://${domain}`;
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    fullUrl,
  )}&size=128`;
};

const toProperCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
};

type ModuleCatalogItem = {
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

type CommandViewItem = {
  id: string;
  prefix: string;
  description: string;
  sourceModule: ModuleCatalogItem;
  name?: string;
  moduleId?: string;
};

const formatCategoryTitle = (value: string): string =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();

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

const getCommandDisplayName = (command: CommandViewItem): string => {
  const raw =
    command.sourceModule?.name ||
    command.sourceModule?.command_key ||
    command.sourceModule?.module_key ||
    command.prefix.replace(/^\//, '');
  return raw ? raw.toString() : command.prefix;
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

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

interface SavedAutomation {
  type: 'installed' | 'saved' | 'header' | 'installed_category';
  label?: string;
  data: any;
}

interface MyAutomationsListProps {
  automations: any[];
  onRunAutomation?: (automation: any) => void;
  onEditAutomation?: (automation: any) => void;
  onExecuteModule?: (module: any) => void;
  activeTab?: 'catalog' | 'saved';
  onTabChange?: (tab: 'catalog' | 'saved') => void;
  query?: string;
  onClose?: () => void;
  userId?: string;
}

const MyAutomationsList: React.FC<MyAutomationsListProps> = ({
  automations,
  onRunAutomation,
  onEditAutomation,
  onExecuteModule,
  query = '',
  onClose,
  userId: userIdProp,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const [userId, setUserId] = useState<string | null>(userIdProp || null);
  const [isFav, setIsFav] = useState(false);
  const [favouriteId, setFavouriteId] = useState<number | null>(null);

  // Initialize userId if not provided
  useEffect(() => {
    if (!userId) {
      getUserId().then(setUserId).catch(console.error);
    }
  }, [userId]);

  const selectedWorkspaceId = useUIStore((s: any) => s.selectedWorkspaceId);
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const [installedModules, setInstalledModules] = useState<any[]>([]);
  const [modulesMetadata, setModulesMetadata] = useState<Record<string, any>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [focusSection, setFocusSection] = useState<'list' | 'editor'>('list');
  const [dashboardFocus, setDashboardFocus] = useState<'name' | 'fav' | 'hotkey' | number>('name');
  const [categoryRightIndex, setCategoryRightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Selection Sync logic - Use primitive IDs for stability
  const handleSelectItem = useCallback((item: any, index: number) => {
    setSelectedIndex(index);
    const id = String(
      item.type === 'installed'
        ? item.data.module_id
        : item.type === 'installed_category'
          ? `category-${item.data.key}`
          : item.data.id || item.data.automation_id,
    );
    setSelectedItemId(prev => (prev === id ? prev : id));
    if (item.type === 'installed_category') {
      setCategoryRightIndex(0);
    }
  }, []);

  // Load installed modules and metadata from local storage
  useEffect(() => {
    const initData = async () => {
      try {
        const chromeAny = (window as any).chrome;
        if (!chromeAny?.storage?.local) return;

        const result = await chromeAny.storage.local.get(['installed_modules', 'modules_metadata']);

        if (result.installed_modules && Array.isArray(result.installed_modules)) {
          setInstalledModules(result.installed_modules);
        }

        if (result.modules_metadata && typeof result.modules_metadata === 'object') {
          setModulesMetadata(result.modules_metadata);
        }
      } catch (e) {
        console.error('Failed to initialize panel data from storage:', e);
      }
    };
    initData();

    // Listen for storage changes
    const listener = (changes: any) => {
      if (changes.installed_modules) {
        setInstalledModules(changes.installed_modules.newValue || []);
      }
      if (changes.modules_metadata) {
        setModulesMetadata(changes.modules_metadata.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const { filteredInstalled, filteredSaved } = useMemo(() => {
    const lowQuery = String(query || '')
      .toLowerCase()
      .trim();

    const filterFn = (item: any) => {
      const name = String(item?.name || item?.module_key || '').toLowerCase();
      const desc = String(item?.description || '').toLowerCase();
      const steps = item?.automation_steps || item?.steps || [];
      const stepText = Array.isArray(steps)
        ? steps.map((s: any) => String(s.config?.url || s.config?.content || '').toLowerCase()).join(' ')
        : '';
      return name.includes(lowQuery) || desc.includes(lowQuery) || stepText.includes(lowQuery);
    };

    return {
      filteredInstalled: lowQuery ? installedModules.filter(filterFn) : installedModules,
      filteredSaved: lowQuery ? automations.filter(filterFn) : automations,
    };
  }, [installedModules, automations, query]);

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

    filteredInstalled.forEach(module => {
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

      const group = groups.get(key)!;
      group.modules.push(module);
      group.totalCount++;
      group.installedCount++;
    });

    return Array.from(groups.values()).sort((left, right) => left.title.localeCompare(right.title));
  }, [filteredInstalled, modulesMetadata]);

  const displayItems = useMemo(() => {
    const items: SavedAutomation[] = [];
    if (filteredSaved.length > 0) {
      filteredSaved.forEach(auto => items.push({ type: 'saved', data: auto }));
    }
    if (groupedCategories.length > 0) {
      groupedCategories.forEach(cat => items.push({ type: 'installed_category', data: cat }));
    }
    return items;
  }, [groupedCategories, filteredSaved]);

  const selectableIndices = useMemo(() => {
    return displayItems
      .map((item, idx) => (item.type !== 'header' ? idx : null))
      .filter(idx => idx !== null) as number[];
  }, [displayItems]);

  // Primitive ID string for stable dependency tracking
  const selectableIdsString = useMemo(() => {
    return displayItems
      .filter(item => item.type !== 'header')
      .map(item =>
        String(
          item.type === 'installed'
            ? item.data.module_id
            : item.type === 'installed_category'
              ? `category-${item.data.key}`
              : item.data.id || item.data.automation_id,
        ),
      )
      .join(',');
  }, [displayItems]);

  const selectedItem = useMemo(() => {
    return (
      displayItems.find((item, idx) => {
        if (item.type === 'header') return false;
        const id = String(
          item.type === 'installed'
            ? item.data.module_id
            : item.type === 'installed_category'
              ? `category-${item.data.key}`
              : item.data.id || item.data.automation_id,
        );
        return id === selectedItemId;
      }) || null
    );
  }, [displayItems, selectedItemId]);

  // Sync Favorites State for selectedItem
  useEffect(() => {
    const syncFav = async () => {
      const automationId = selectedItem?.data?.id;
      if (!userId || !automationId) return;
      try {
        const result: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
        const favItems = result.myFavouriteItems || {};
        const currentFavList: any[] = favItems[userId] || [];
        const existingFav = currentFavList.find(fav => String(fav.id) === String(automationId));

        if (existingFav) {
          setIsFav(true);
          setFavouriteId(existingFav.favourite_id || null);
        } else {
          setIsFav(false);
          setFavouriteId(null);
        }
      } catch (err) {
        console.error('[MyAutomationsList] Fav Sync error:', err);
      }
    };
    syncFav();
  }, [userId, selectedItem?.data?.id]);

  const handleToggleFavorite = async () => {
    const automation = selectedItem?.data;
    if (!automation?.id || !userId) return;

    const automationId = automation.id.toString();
    const isAdding = !isFav;

    try {
      const result: any = await new Promise(resolve => chrome.storage.local.get('myFavouriteItems', resolve));
      const favItems = result.myFavouriteItems || {};
      const currentFavList: any[] = favItems[userId] || [];

      let updatedFavList;
      if (isAdding) {
        updatedFavList = [{ ...automation, category: 'automation', fav: true }, ...currentFavList];
        setFavouriteId((automation as any)?.favourite_id || null);
      } else {
        updatedFavList = currentFavList.filter(fav => String(fav.id) !== automationId);
        setFavouriteId(null);
      }

      await new Promise<void>(resolve =>
        chrome.storage.local.set({ myFavouriteItems: { ...favItems, [userId]: updatedFavList } }, resolve),
      );

      setIsFav(isAdding);
    } catch (err) {
      console.error('[MyAutomationsList] Toggle Favorite Error:', err);
    }
  };

  const [lastQuery, setLastQuery] = useState(query);
  useEffect(() => {
    const hasItems = selectableIndices.length > 0;
    const isNewQuery = query !== lastQuery;

    if (hasItems && (selectedItemId === null || isNewQuery)) {
      const firstSelectable = selectableIndices[0];
      const firstItem = displayItems[firstSelectable];
      if (firstItem) {
        setSelectedIndex(firstSelectable);
        const id = String(
          firstItem.type === 'installed'
            ? firstItem.data.module_id
            : firstItem.type === 'installed_category'
              ? `category-${firstItem.data.key}`
              : firstItem.data.id || firstItem.data.automation_id,
        );
        setSelectedItemId(id);
      }
      if (isNewQuery) setLastQuery(query);
    }
  }, [query, lastQuery, selectableIndices.length, selectableIdsString]); // Use the stable ID string as dependency

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const isInput =
          (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          if (focusSection === 'editor') {
            setFocusSection('list');
          } else {
            onClose?.();
          }
          return;
        }
      }

      if (selectableIndices.length === 0) return;

      // If we're not in the list, we don't handle list navigation
      if (focusSection !== 'list') return;

      const currentIndex = selectableIndices.indexOf(selectedIndex);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const nextIndex = (currentIndex + 1) % selectableIndices.length;
        const targetIdx = selectableIndices[nextIndex];
        handleSelectItem(displayItems[targetIdx], targetIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const prevIndex = (currentIndex - 1 + selectableIndices.length) % selectableIndices.length;
        const targetIdx = selectableIndices[prevIndex];
        handleSelectItem(displayItems[targetIdx], targetIdx);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        setFocusSection('editor');
        setDashboardFocus('name');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const item = displayItems[selectedIndex];
        if (!item) return;

        if (item.type === 'installed') onExecuteModule?.(item.data);
        else if (item.type === 'saved') onRunAutomation?.(item.data);

      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    displayItems,
    selectedIndex,
    selectableIndices,
    onRunAutomation,
    onExecuteModule,
    handleSelectItem,
    focusSection,
  ]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose?.();
      return true;
    });
    return unregister;
  }, [onClose]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  return (
    <div
      className={`relative flex h-[90%] max-h-[90vh] w-full flex-col bg-transparent overflow-hidden border rounded-xl dark:rounded-none ${isDark ? 'border-white/10 dark:border-white/10' : 'border-black/5'}`}>
      <div className="flex flex-1 w-full min-h-0">
        {/* Left Pane: List of Automations (50%) */}
        <div
          className={`w-1/2 flex flex-col border-r ${isDark ? 'border-white/10' : 'bg-white border-black/5'} overflow-hidden`}>
          <div className="flex-1 overflow-y-auto pt-1 custom-scrollbar" ref={listRef}>
            {displayItems.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl bg-black/20 p-6 text-center">
                <span className="text-[12px] text-white/40">
                  {query ? `No items matching "${query}"` : 'No automations found.'}
                </span>
              </div>
            ) : (
              <div>
                {displayItems.map((item, index) => {
                  if (item.type === 'header') {
                    return (
                      <div key={`header-${item.label}`} className="px-3 py-2  first:pt-1">
                        <h3 className="text-[10px] font-bold tracking-widest text-white/30 ">{item.label}</h3>
                      </div>
                    );
                  }

                  const isSelected = index === selectedIndex;
                  const data = item.data;

                  if (item.type === 'installed_category') {
                    const group = data;
                    return (
                      <div
                        key={`cat-${group.key}`}
                        ref={el => {
                          itemRefs.current[index] = el;
                        }}
                        onClick={() => {
                          handleSelectItem(item, index);
                          setFocusSection('list');
                        }}
                        className={`relative group flex items-center gap-3 border-b px-4 py-2 text-left transition ${isDark ? 'border-white/5' : 'border-black/5'
                          } ${isSelected
                            ? isDark
                              ? focusSection === 'list'
                                ? 'bg-white/10 ring-1 ring-white/20'
                                : 'bg-white/5'
                              : 'bg-white'
                            : isDark
                              ? 'hover:bg-white/5'
                              : 'hover:bg-black/5'
                          }`}>
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded overflow-hidden flex-shrink-0 transition-all
                        ${isDark ? 'bg-transparent border border-white/5' : 'bg-white shadow-sm border border-black/5'}
                      `}>
                          {group.iconUrl ? (
                            <img src={group.iconUrl} alt="" className="h-5.5 w-5.5 object-contain" />
                          ) : (
                            <FaRobot size={20} className="text-white/60" />
                          )}
                        </div>

                        <div className="flex flex-col flex-1 min-w-0">
                          <span
                            className={`truncate text-[12px] font-medium leading-tight ${isDark ? 'text-white' : 'text-[#073642]'}`}
                            style={headingFontStyle}>
                            {group.title}
                          </span>
                        </div>

                        <div
                          className={`flex items-center justify-end flex-shrink-0 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                          <FaChevronRight size={10} className={`${isDark ? 'text-white/20' : 'text-black/20'}`} />
                        </div>
                      </div>
                    );
                  }

                  const isInstalled = item.type === 'installed';
                  const steps = data?.automation_steps || data?.steps || [];
                  const stepCount = Array.isArray(steps) ? steps.length : 0;
                  const stepLabel = isInstalled
                    ? data?.description || 'Automation skill'
                    : stepCount === 1
                      ? '1 step'
                      : `${stepCount} steps`;

                  return (
                    <div
                      key={isInstalled ? `inst-${data.module_id}` : `saved-${data.id || data.automation_id}`}
                      ref={el => {
                        itemRefs.current[index] = el;
                      }}
                      onClick={() => {
                        handleSelectItem(item, index);
                        setFocusSection('list');
                      }}
                      role="button"
                      tabIndex={0}
                      className={`group flex w-full items-center gap-3 border-b px-4 py-2.5 text-left transition-all ${isDark ? 'border-white/5' : 'border-black/5'} ${isSelected ? (isDark ? (focusSection === 'list' ? 'bg-white/10' : 'bg-white/5') : 'bg-white') : isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded transition-all ${isDark
                            ? 'bg-transparent border border-white/5'
                            : 'bg-white shadow-sm border border-black/5'
                          } overflow-hidden`}>
                        {(() => {
                          if (isInstalled) {
                            const iconHost = data?.icon_host || data?.iconHost || '';
                            const iconUrl = getFaviconUrl(iconHost);
                            if (iconUrl) return <img src={iconUrl} alt="" className="h-5.5 w-5.5 object-contain" />;
                            return <FaRobot size={20} />;
                          }
                          const firstStepHost = steps?.[0]?.icon_host || steps?.[0]?.iconHost || steps?.[0]?.host;
                          const iconUrl = getFaviconUrl(firstStepHost);
                          if (iconUrl) return <img src={iconUrl} alt="" className="h-5.5 w-5.5 object-contain" />;
                          return <AutomationDynamicIcon automation={data} size={20} />;
                        })()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-[12px] font-semibold ${isSelected ? (isDark ? 'text-white' : 'text-[#073642]') : isDark ? 'text-white/90' : 'text-[#073642]'}`}>
                            {toProperCase(data?.name || data?.module_key || 'Untitled Automation')}
                          </p>
                          <span
                            className={`flex-shrink-0 text-[10px] font-medium ${isDark ? 'text-white/30' : 'text-black/40'}`}>
                            {stepLabel}
                          </span>
                        </div>
                      </div>

                      {isInstalled ? (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onExecuteModule?.(data);
                          }}
                          className={`${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black  tracking-widest text-white/60 hover:bg-white/10 hover:text-white`}>
                          <FaPlay size={8} /> Run
                        </button>
                      ) : (
                        <div
                          className={`flex items-center gap-1 transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <button
                            type="button"
                            tabIndex={-1}
                            title="Run automation"
                            onClick={e => {
                              e.stopPropagation();
                              onRunAutomation?.(data);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 hover:bg-white/10 hover:text-white">
                            <FaPlay size={11} />
                          </button>
                          <button
                            type="button"
                            tabIndex={-1}
                            title="Edit automation"
                            onClick={e => {
                              e.stopPropagation();
                              onEditAutomation?.(data);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80">
                            <FaEdit size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Automation Dashboard (50%) */}
        <div className={`w-1/2 flex flex-col overflow-hidden ${isDark ? 'bg-black/20' : 'bg-white'}`}>
          {selectedItem ? (
            selectedItem.type === 'installed_category' ? (
              <CategoryCommandsView
                category={selectedItem.data}
                onExecuteModule={onExecuteModule}
                isFocused={focusSection === 'editor'}
                selectedIndex={categoryRightIndex}
                setSelectedIndex={setCategoryRightIndex}
                onBackToList={() => setFocusSection('list')}
                modulesMetadata={modulesMetadata}
              />
            ) : (
              <AutomationDashboard
                item={selectedItem}
                onUpdate={updated => {
                  const id = String(
                    updated.type === 'installed'
                      ? updated.data.module_id
                      : updated.data.id || updated.data.automation_id,
                  );
                  setSelectedItemId(prev => (prev === id ? prev : id));
                }}
                onRun={selectedItem.type === 'installed' ? onExecuteModule : onRunAutomation}
                onEditAutomation={onEditAutomation}
                isFocused={focusSection === 'editor'}
                dashboardFocus={dashboardFocus}
                setDashboardFocus={setDashboardFocus}
                onBackToList={() => setFocusSection('list')}
                userId={userId}
                isFav={isFav}
                handleToggleFavorite={handleToggleFavorite}
                modulesMetadata={modulesMetadata}
              />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-xs text-white/20 italic">Select an automation to manage</p>
            </div>
          )}
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
            <span>Run</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AutomationDashboardProps {
  item: SavedAutomation;
  onUpdate: (updated: SavedAutomation) => void;
  onRun?: (item: any) => void;
  onEditAutomation?: (item: any) => void;
  isFocused: boolean;
  dashboardFocus: 'name' | 'fav' | 'hotkey' | number;
  setDashboardFocus: (val: 'name' | 'fav' | 'hotkey' | number) => void;
  onBackToList: () => void;
  userId: string | null;
  isFav: boolean;
  handleToggleFavorite: () => void;
  modulesMetadata: Record<string, any>;
}

const AutomationDashboard: React.FC<AutomationDashboardProps> = ({
  item,
  onUpdate,
  onRun,
  onEditAutomation,
  isFocused,
  dashboardFocus,
  setDashboardFocus,
  onBackToList,
  userId,
  isFav,
  handleToggleFavorite,
  modulesMetadata,
}) => {
  const data = item.data;
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const selectedWorkspaceId = useUIStore((s: any) => s.selectedWorkspaceId);
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const itemId = String(data.id || data.module_id || '');
  const [editedName, setEditedName] = useState(data.name || data.module_key || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedSlashCommand, setEditedSlashCommand] = useState('');
  const [hotkey, setHotkey] = useState('');
  const [lastSavedValues, setLastSavedValues] = useState({
    name: data.name || data.module_key || '',
    slash: '',
    hotkey: '',
  });
  const [localSteps, setLocalSteps] = useState<any[]>(data?.automation_steps || data?.steps || []);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const nameRef = useRef<HTMLHeadingElement>(null);
  const favRef = useRef<HTMLButtonElement>(null);
  const hotkeyRef = useRef<HTMLDivElement>(null);
  const configRefs = useRef<(HTMLDivElement | null)[]>([]);

  const getEditableConfigKey = (moduleId: string) => {
    const m = String(moduleId || '').toLowerCase();
    if (m === 'open_tab' || m === 'open_link' || m === 'agent') return 'url';
    if (m === 'paste') return 'content';
    if (m === 'type' || m === 'clipboard_write') return 'text';
    if (m === 'keystroke') return 'key';
    if (m === 'wait') return 'delay';
    return null;
  };

  const getPlaceholder = (moduleId: string) => {
    const m = String(moduleId || '').toLowerCase();
    if (m === 'open_tab' || m === 'open_link' || m === 'agent') return 'https://example.com/{query}';
    if (m === 'paste' || m === 'type') return 'Enter text or {param}';
    if (m === 'keystroke') return 'Enter key (e.g. Enter)';
    if (m === 'wait') return 'Timeout in ms (e.g. 500)';
    return 'Configuration...';
  };

  const editableStepsExist = localSteps.some(step => {
    const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
    return getEditableConfigKey(moduleId) !== null;
  });

  const isInstalled = item.type === 'installed';
  const lastSyncedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentId = String(data.id || data.module_id || '');
    if (lastSyncedIdRef.current === currentId) {
      // Already synced for this exact ID
      return;
    }

    const syncData = async () => {
      if (item && currentId) {
        try {
          const [hotkeysMap, shortcutsMap] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          const compoundId = getItemCompoundId({
            ...data,
            workspace_id: data.workspace_id || selectedWorkspaceId,
            folder_id: data.folder_id || selectedFolderId,
            category: 'automation',
          });

          const currentHotkey = hotkeysMap[compoundId] || (userId ? getUserHotkey(data.hotkeys, userId) : '');
          const currentShortcut = shortcutsMap[compoundId] || (userId ? getUserShortcut(data.shortcuts, userId) : '');

          setHotkey(currentHotkey);
          setEditedSlashCommand(normalizeShortcutTrigger(currentShortcut));
          setLastSavedValues({
            name: data.name || data.module_key || '',
            slash: normalizeShortcutTrigger(currentShortcut),
            hotkey: currentHotkey,
          });
          setEditedName(data.name || data.module_key || '');
          lastSyncedIdRef.current = currentId;
        } catch (error) {
          console.error('[AutomationDashboard] Error loading stored data:', error);
        }
      }
    };
    syncData();
    setLocalSteps(data?.automation_steps || data?.steps || []);
  }, [
    data.id,
    data.module_id,
    data.name,
    data.module_key,
    userId,
    selectedWorkspaceId,
    selectedFolderId,
  ]);

  const updateStepConfig = (stepId: string, updates: any) => {
    setLocalSteps(prev =>
      prev.map(s => {
        const sId = String(s.id || s.step_id || '');
        if (sId === stepId) {
          let finalUpdates = { ...updates };

          // If updating URL, also try to update host/icon_host for better "address" handling
          if (updates.url) {
            const parts = parseUrlParts(updates.url);
            if (parts?.domain) {
              finalUpdates = {
                ...finalUpdates,
                host: parts.domain,
                icon_host: parts.domain,
                iconHost: parts.domain,
              };
            }
          }

          return { ...s, config: { ...s.config, ...finalUpdates } };
        }
        return s;
      }),
    );
  };

  const handleConfigSave = async () => {
    if (item.type !== 'saved') return;
    setIsSavingConfig(true);
    setSaveStatus('saving');
    try {
      const apiSteps = localSteps.map((s, idx) => ({
        module_id: String(s.module_id || s.moduleId),
        step_order: idx + 1,
        config: s.config || {},
      }));

      onUpdate({
        ...item,
        data: {
          ...item.data,
          name: editedName,
          steps: apiSteps,
          automation_steps: apiSteps,
        },
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save config:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleNameSave = async () => {
    if (!isEditingName || !editedName.trim() || editedName === lastSavedValues.name) {
      setIsEditingName(false);
      return;
    }
    try {
      if (item.type === 'saved') {
        const steps = data?.automation_steps || data?.steps || [];
        const apiSteps = steps.map((s: any, idx: number) => ({
          module_id: String(s.module_id || s.moduleId),
          step_order: s.step_order || idx + 1,
          config: s.config || {},
        }));

      }
      onUpdate({ ...item, data: { ...item.data, name: editedName } });
      setLastSavedValues(prev => ({ ...prev, name: editedName }));
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name:', err);
    }
  };

  const handleHotkeyChange = async (newHotkey: string) => {
    setHotkey(newHotkey);
    try {
      const compoundId = getItemCompoundId({
        ...data,
        workspace_id: data.workspace_id || selectedWorkspaceId,
        folder_id: data.folder_id || selectedFolderId,
        category: 'automation',
      });
      await apiSaveHotkey(String(data.id || itemId), compoundId, newHotkey, item.type === 'saved' ? 'automation' : 'module', 'cloud', true);
    } catch (err) {
      console.error('Failed to update hotkey:', err);
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    const normalizedShortcut = normalizeShortcutTrigger(newShortcut);
    setEditedSlashCommand(normalizedShortcut);
    try {
      const compoundId = getItemCompoundId({
        ...data,
        workspace_id: data.workspace_id || selectedWorkspaceId,
        folder_id: data.folder_id || selectedFolderId,
        category: 'automation',
      });
      await apiSaveShortcut(
        String(data.id || itemId),
        compoundId,
        normalizedShortcut,
        data.name || 'Automation',
        item.type === 'saved' ? 'automation' : 'module',
        'cloud',
        true
      );
    } catch (err) {
      console.error('Failed to update shortcut:', err);
    }
  };

  useEffect(() => {
    if (!isFocused) return;

    const editableConfigsCount = localSteps.filter(step => {
      const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
      return getEditableConfigKey(moduleId) !== null;
    }).length;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. ArrowLeft at Name -> Return to list
      if (e.key === 'ArrowLeft') {
        if (dashboardFocus === 'name' || typeof dashboardFocus === 'number') {
          e.preventDefault();
          onBackToList();
          return;
        }
        // Horizontal Header Nav (Backward)
        if (dashboardFocus === 'fav') setDashboardFocus('name');
        if (dashboardFocus === 'hotkey') setDashboardFocus('fav');
      }

      // 2. ArrowRight -> Horizontal Header Nav
      if (e.key === 'ArrowRight') {
        if (dashboardFocus === 'name') {
          e.preventDefault();
          setDashboardFocus('fav');
        } else if (dashboardFocus === 'fav') {
          e.preventDefault();
          setDashboardFocus('hotkey');
        }
      }

      // 3. ArrowDown -> Enter Configs or Next Config
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (typeof dashboardFocus !== 'number') {
          if (editableConfigsCount > 0) setDashboardFocus(0);
        } else {
          if (dashboardFocus < editableConfigsCount - 1) {
            setDashboardFocus(dashboardFocus + 1);
          }
        }
      }

      // 4. ArrowUp -> Back to Header or Prev Config
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (typeof dashboardFocus === 'number') {
          if (dashboardFocus === 0) setDashboardFocus('name');
          else setDashboardFocus(dashboardFocus - 1);
        }
      }

      // 5. Enter -> Contextual Action
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (dashboardFocus === 'name') {
          setIsEditingName(true);
        } else if (dashboardFocus === 'fav') {
          handleToggleFavorite();
        } else if (dashboardFocus === 'hotkey') {
          const hotkeyBtn = hotkeyRef.current?.querySelector('button');
          hotkeyBtn?.click();
        } else if (typeof dashboardFocus === 'number') {
          const stepDiv = configRefs.current[dashboardFocus];
          const input = stepDiv?.querySelector('input, textarea') as HTMLElement;
          input?.focus();
        }
      }

      // 6. Ctrl+Enter -> Save Config
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleConfigSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, onBackToList, dashboardFocus, localSteps]);

  // Sync actual DOM focus when dashboardFocus state changes
  useEffect(() => {
    if (!isFocused) return;
    if (dashboardFocus === 'name') nameRef.current?.focus();
    else if (dashboardFocus === 'fav') favRef.current?.focus();
    else if (dashboardFocus === 'hotkey') {
      const hotkeyBtn = hotkeyRef.current?.querySelector('button');
      hotkeyBtn?.focus();
    } else if (typeof dashboardFocus === 'number') {
      configRefs.current[dashboardFocus]?.focus();
    }
  }, [dashboardFocus, isFocused]);

  return (
    <div className="flex flex-col h-full w-full p-5 animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-4 mb-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-all ${isDark ? 'bg-transparent border border-white/10' : 'bg-white shadow-sm border border-black/5'
            }`}>
          <AutomationDynamicIcon automation={data} size={30} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col pt-0.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 group cursor-pointer min-w-0">
              {!isEditingName ? (
                <>
                  <h2
                    ref={nameRef}
                    tabIndex={0}
                    onFocus={() => setDashboardFocus('name')}
                    className={`text-[17px] font-bold tracking-tight outline-none truncate transition-all px-2 py-0.5 rounded-lg border-2 ${isFocused && dashboardFocus === 'name'
                        ? isDark
                          ? 'border-[#9fa2ff]/60 bg-white/5 opacity-100'
                          : 'border-[#c7bcff] bg-white opacity-100 shadow-sm'
                        : `border-transparent opacity-80 ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`
                      } ${isDark ? 'text-white/90' : 'text-neutral-900'}`}>
                    {toProperCase(editedName || 'Untitled Automation')}
                  </h2>
                  {!isInstalled && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                      <FaPencilAlt size={10} />
                    </button>
                  )}
                </>
              ) : (
                <div
                  className={`flex items-center gap-2 p-0.5 pl-2 rounded-lg border-2 transition-all ${isFocused && dashboardFocus === 'name'
                      ? isDark
                        ? 'border-[#9fa2ff]/60 bg-black/60 shadow-inner'
                        : 'border-[#c7bcff] bg-white shadow-sm'
                      : isDark
                        ? 'bg-black/40 border-white/10 shadow-inner'
                        : 'bg-neutral-100/50 border-black/5'
                    }`}>
                  <input
                    autoFocus
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleNameSave();
                      if (e.key === 'Escape') {
                        setEditedName(lastSavedValues.name);
                        setIsEditingName(false);
                      }
                    }}
                    onBlur={handleNameSave}
                    className="bg-transparent border-none text-[15px] font-bold focus:ring-0 w-40 p-0"
                  />
                  <button
                    onClick={handleNameSave}
                    className={`p-1 rounded transition-all active:scale-95 border shadow-sm ${isDark
                        ? 'bg-neutral-800 border-[#9fa2ff] text-neutral-100 hover:border-[#8f93ff]'
                        : 'bg-[#f5f3ff] border-[#c7bcff] text-neutral-700 hover:border-[#b9adff]'
                      }`}>
                    <FiCheck size={11} />
                  </button>
                </div>
              )}
            </div>

            {!isInstalled && (
              <div className="flex items-center gap-3 ml-4 flex-shrink-0 animate-in slide-in-from-left-1 duration-300">
                <button
                  ref={favRef}
                  tabIndex={0}
                  onFocus={() => setDashboardFocus('fav')}
                  onClick={handleToggleFavorite}
                  className={`flex items-center justify-center p-1.5 rounded-lg border transition-all focus:outline-none ${isFocused && dashboardFocus === 'fav'
                      ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-transparent'
                      : ''
                    } ${isFav
                      ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700/50 text-yellow-500'
                      : 'bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700/50 text-neutral-400 hover:text-yellow-500'
                    }`}
                  title={isFav ? 'Remove from favorites' : 'Mark as favorite'}>
                  {isFav ? <FaStar size={12} /> : <FiStar size={12} />}
                </button>
                <div
                  ref={hotkeyRef}
                  onFocus={() => setDashboardFocus('hotkey')}
                  className={`flex-shrink-0 transition-all ${isFocused && dashboardFocus === 'hotkey' ? 'bg-white/5 rounded-lg p-0.5' : ''
                    }`}>
                  <div className="flex items-center gap-1.5"><HotkeyAssignButton
  itemId={getItemCompoundId({
                      ...data,
                      workspace_id: data.workspace_id || selectedWorkspaceId,
                      folder_id: data.folder_id || selectedFolderId,
                      category: 'automation',
                    })}
  currentHotkey={hotkey}
  onHotkeyChange={handleHotkeyChange}
  className="scale-[0.8] origin-left opacity-70 hover:opacity-100 transition-opacity"
/><ShortcutAssignButton
  itemId={getItemCompoundId({
                      ...data,
                      workspace_id: data.workspace_id || selectedWorkspaceId,
                      folder_id: data.folder_id || selectedFolderId,
                      category: 'automation',
                    })}
  currentShortcut={editedSlashCommand}
  onShortcutChange={handleShortcutChange}
  defaultName={data.name}
  className="scale-[0.8] origin-left opacity-70 hover:opacity-100 transition-opacity"
/></div>
                </div>
              </div>
            )}
          </div>

          {isInstalled && (
            <p
              className={`text-[11px] font-medium leading-relaxed max-w-sm mt-1 ${isDark ? 'text-white/30' : 'text-black/40'}`}>
              {modulesMetadata && itemId
                ? extractLongDescription(modulesMetadata[itemId]?.description_meta) || data.description
                : data.description || 'Integrated service module.'}
            </p>
          )}
        </div>
      </div>

      <div className="w-full h-px bg-white/5 mb-6" />

      {!isInstalled && editableStepsExist && (
        <div
          className="flex-1 flex flex-col gap-2 min-h-0"
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleConfigSave();
            }
          }}>
          <div className="flex items-center justify-between px-1">
            <h3
              className={`text-[10px] font-bold tracking-widest opacity-30 ${isDark ? 'text-white' : 'text-black'}`}>
              Configuration
            </h3>
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 pb-4 pt-1">
            {localSteps
              .filter(step => {
                const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
                return getEditableConfigKey(moduleId) !== null;
              })
              .map((step, idx) => {
                const stepId = String(step.id || step.step_id || `step-${idx}`);
                const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
                const config = step.config || {};
                const configKey = getEditableConfigKey(moduleId) || 'url';

                let currentVal = '';
                if (typeof step.config === 'string') {
                  currentVal = step.config;
                } else if (config[configKey]) {
                  currentVal = String(config[configKey]);
                }

                const paramConfigs = config.paramConfigs || {};

                return (
                  <div
                    key={stepId}
                    ref={el => {
                      configRefs.current[idx] = el;
                    }}
                    tabIndex={0}
                    onFocus={() => setDashboardFocus(idx)}
                    className={`relative rounded-xl border transition-all outline-none ${isDark ? 'bg-black/30 border-white/5' : 'bg-white border-black/5'
                      } ${isFocused && dashboardFocus === idx ? 'border-white/20 bg-white/5' : ''} mb-0.5`}>
                    <HighlightedInput
                      value={currentVal}
                      onChange={(e: any) => updateStepConfig(stepId, { [configKey]: e.target.value })}
                      placeholder={getPlaceholder(moduleId)}
                      paramConfigs={paramConfigs}
                      onParamTypeChange={(pName, type) => {
                        const nextParams: Record<string, ParamConfig> = {
                          ...paramConfigs,
                          [pName]: { ...paramConfigs[pName], type, values: paramConfigs[pName]?.values || [''] },
                        };
                        updateStepConfig(stepId, { paramConfigs: nextParams });
                      }}
                      onSaveCustomInput={(pName, val) => {
                        const nextParams = { ...paramConfigs, [pName]: { ...paramConfigs[pName], values: [val] } };
                        updateStepConfig(stepId, { paramConfigs: nextParams });
                      }}
                      onRenameParam={(pName, newDisplay) => {
                        const nextParams = {
                          ...paramConfigs,
                          [pName]: { ...paramConfigs[pName], displayName: newDisplay },
                        };
                        updateStepConfig(stepId, { paramConfigs: nextParams });
                      }}
                      onSaveDropdownOptionPairs={(pName, pairs) => {
                        const nextParams = {
                          ...paramConfigs,
                          [pName]: { ...paramConfigs[pName], optionPairs: pairs, values: pairs.map(p => p.value) },
                        };
                        updateStepConfig(stepId, { paramConfigs: nextParams });
                      }}
                      className={`w-full min-h-[32px] text-[11px] font-medium p-2 pb-5 ${isDark ? 'text-white/90' : 'text-neutral-800'}`}
                      wrapperStyle={{ background: 'transparent' }}
                    />
                  </div>
                );
              })}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 flex gap-3 justify-end items-center sticky bottom-0 bg-transparent backdrop-blur-sm z-10">
            {saveStatus === 'success' && (
              <span className="text-[10px] text-purple-400 font-bold animate-in fade-in slide-in-from-right-2">
                Settings Saved
              </span>
            )}
            <button
              onClick={handleConfigSave}
              disabled={isSavingConfig}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-[0.95] border shadow-sm ${saveStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/40 text-red-400'
                  : isDark
                    ? 'bg-neutral-800 border-[#9fa2ff] text-neutral-100 hover:border-[#8f93ff]'
                    : 'bg-[#f5f3ff] border-[#c7bcff] text-neutral-700 hover:border-[#b9adff]'
                }`}>
              {isSavingConfig && (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              )}
              {isSavingConfig ? 'Saving...' : saveStatus === 'success' ? 'Settings Saved' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface CategoryCommandsViewProps {
  category: any;
  onExecuteModule?: (module: any) => void;
  isFocused: boolean;
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  onBackToList: () => void;
  modulesMetadata: Record<string, any>;
}

const CategoryCommandsView: React.FC<CategoryCommandsViewProps> = ({
  category,
  onExecuteModule,
  isFocused,
  selectedIndex,
  setSelectedIndex,
  onBackToList,
  modulesMetadata,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const commands = useMemo(() => {
    const all = category.modules.flatMap((module: any) => {
      const cmds = extractCommandsForModule(module);
      return cmds.map(cmd => ({
        ...cmd,
        name: String(cmd.name || module.name || module.module_key || ''),
        moduleId: String(module.module_id),
        isInstalled: true,
      }));
    });

    const deduped: any[] = [];
    const prefixes = new Set();
    all.forEach((item: any) => {
      if (!prefixes.has(item.prefix)) {
        prefixes.add(item.prefix);
        deduped.push(item);
      }
    });
    return deduped;
  }, [category]);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!isFocused) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onBackToList();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((selectedIndex + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((selectedIndex - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = commands[selectedIndex];
        if (cmd && onExecuteModule) {
          onExecuteModule(cmd.sourceModule);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, selectedIndex, commands, onBackToList, onExecuteModule, setSelectedIndex]);

  useEffect(() => {
    if (isFocused && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isFocused]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 pt-5 custom-scrollbar">
      <div className="space-y-4">
        <div className="rounded-xl bg-transparent">
          <div className="flex items-center gap-3 pl-1">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg 
                       ${isDark ? 'bg-transparent border border-white/10' : 'bg-white shadow-sm border border-black/5'}
                     `}>
                {category.iconUrl ? (
                  <img src={category.iconUrl} alt={category.title} className="h-8 w-8 object-contain" />
                ) : (
                  <FaRobot size={30} className="text-white/70" />
                )}
              </div>
              <h4
                className={`truncate text-[15px] font-semibold ${isDark ? 'text-white/90' : 'text-[#073642]'}`}
                style={headingFontStyle}>
                {category.title}
              </h4>
              <p className={`truncate text-[12px] mt-0.5 ${isDark ? 'text-white/40' : 'text-[#586e75]'}`}>
                {category.description}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="space-y-0.5">
            {commands.map((command, index) => {
              const itemIsSelected = index === selectedIndex && isFocused;

              return (
                <div
                  key={command.id}
                  ref={el => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => onExecuteModule?.(command.sourceModule)}
                  className={`relative grid grid-cols-[1fr_auto] items-center gap-3 border-b px-2 py-2 transition-colors ${isDark ? 'border-white/10' : 'border-black/10'
                    } ${itemIsSelected
                      ? isDark
                        ? 'bg-white/10'
                        : 'bg-white'
                      : isDark
                        ? 'hover:bg-white/5'
                        : 'hover:bg-black/5'
                    }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-black/5 shadow-sm'
                        }`}>
                      {(() => {
                        const name = String(command.name || '').toLowerCase();
                        const id = String(command.moduleId || '').toLowerCase();

                        if (name.includes('gemini') || id.includes('gemini')) {
                          return (
                            <img
                              src="https://www.gstatic.com/lamda/images/favicon_v1_150160d13ffabc72aa70.png"
                              alt=""
                              className="h-5.5 w-5.5 object-contain"
                            />
                          );
                        }
                        if (
                          name.includes('gpt') ||
                          id.includes('gpt') ||
                          name.includes('chat') ||
                          id.includes('chat')
                        ) {
                          return (
                            <img src="https://chatgpt.com/favicon.ico" alt="" className="h-5.5 w-5.5 object-contain" />
                          );
                        }
                        if (name.includes('perplexity') || id.includes('perplexity')) {
                          return (
                            <img
                              src="https://www.perplexity.ai/favicon.ico"
                              alt=""
                              className="h-5.5 w-5.5 object-contain"
                            />
                          );
                        }
                        if (name.includes('claude') || id.includes('claude')) {
                          return (
                            <img src="https://claude.ai/favicon.ico" alt="" className="h-5.5 w-5.5 object-contain" />
                          );
                        }

                        if (category?.iconUrl) {
                          return <img src={category.iconUrl} alt="" className="h-5.5 w-5.5 object-contain" />;
                        }
                        return <FaTerminal size={18} className={isDark ? 'text-white/40' : 'text-[#586e75]'} />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[12px] font-medium ${isDark ? 'text-white' : 'text-[#073642]'}`}
                        style={headingFontStyle}>
                        {getCommandDisplayName(command)}
                      </p>
                      <p className={`truncate text-[11px] ${isDark ? 'text-white' : 'text-[#586e75]'} opacity-100`}>
                        {extractLongDescription(modulesMetadata[String(command.moduleId)]?.description_meta) ||
                          command.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onExecuteModule?.(command.sourceModule);
                        }}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition active:scale-95 ${isDark
                            ? 'border-white/20 bg-transparent text-white/80 hover:bg-white/10'
                            : 'border-black/10 bg-white text-[#073642] hover:bg-neutral-100'
                          } ${itemIsSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'} transition-all duration-200`}>
                        <FaPlay size={9} /> Try
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAutomationsList;

