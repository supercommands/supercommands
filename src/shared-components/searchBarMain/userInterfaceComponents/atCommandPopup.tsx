import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SiOpenai, SiPerplexity, SiGoogle } from 'react-icons/si';
import { TbSparkles } from 'react-icons/tb';
import { FaFileAlt, FaLink, FaBookmark, FaTerminal, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import NotesIcon from '../../../shared-components/icons/notesIcon';
import { LuSparkles } from 'react-icons/lu';
import { COMMANDS } from '../commandConfigurations/commands';
import { LOCAL_COMMANDS } from '../commandConfigurations/localCommands';


import { getRecentCommands, getFaviconUrl } from '../utilityFunctions/utils';
import { useChromeStorage } from '@extension/shared/lib/hooks';

interface AtCommandItem {
  id: string;
  label: string;
  icon: any;
  color: string;
  keywords: string[];
  category: string;
  favIconUrl?: string;
}

interface AtCommandPopupProps {
  highlightIndex: number;
  onSelect: (commandId: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  searchQuery?: string; // Text after @ for filtering
  onHighlightIndexChange?: (index: number) => void;


  isLockedAI?: boolean;
  hideTabs?: boolean;
}

// Map specific icons to commands based on ID or keywords
const getIconForCommand = (id: string, keywords: string[] = []) => {
  const lowerId = String(id || '').toLowerCase();

  if (lowerId === 'gpt' || lowerId === 'chatgpt') return SiOpenai;
  if (lowerId === 'claude') return TbSparkles;
  if (lowerId === 'gemini') return TbSparkles;
  if (lowerId === 'perplexity') return SiPerplexity;
  if (lowerId === 'google' || lowerId === 'g') return SiGoogle;
  if (lowerId === 'calendar') return FaCalendarAlt;
  if (lowerId === 'bookmarks') return FaBookmark;
  if (lowerId.includes('note')) return NotesIcon;
  if (lowerId.includes('link')) return FaLink;

  if (lowerId === 'upload_drive' || lowerId === 'drive') return SiGoogle;

  return FaTerminal;
};

// Map specific colors
const getColorForCommand = (id: string) => {
  const lowerId = String(id || '').toLowerCase();

  if (lowerId === 'gpt') return 'text-green-500';
  if (lowerId === 'claude') return 'text-orange-500';
  if (lowerId === 'gemini') return 'text-blue-400';
  if (lowerId === 'perplexity') return 'text-teal-500';
  if (lowerId === 'google') return 'text-blue-500';
  if (lowerId === 'calendar') return 'text-blue-500';
  if (lowerId === 'bookmarks') return 'text-amber-500';
  if (lowerId.includes('note')) return 'text-yellow-500';
  if (lowerId.includes('link')) return 'text-blue-500';

  if (lowerId === 'upload_drive' || lowerId === 'drive') return 'text-blue-500';

  return 'text-neutral-500';
};



// Combine and map all commands
const getAllAtCommands = (): AtCommandItem[] => {
  // Start with remote commands
  const remote = COMMANDS
    .filter(cmd => !['gpt', 'perplexity', 'gemini'].includes(cmd.id))
    .map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      icon: getIconForCommand(cmd.id, cmd.keywords),
      color: getColorForCommand(cmd.id),
      keywords: cmd.keywords || [],
      category:
        cmd.category === 'browser'
          ? 'Browser'
          : cmd.id === 'ai' || ['gpt', 'claude', 'gemini', 'perplexity'].includes(cmd.id)
            ? 'AI Assistants'
            : 'Tools',
    })).filter(cmd => cmd.category !== 'Browser');

  // Add local commands
  const local = LOCAL_COMMANDS
    .filter(cmd => cmd.id !== 'settings')
    .map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      icon: getIconForCommand(cmd.id, cmd.keywords),
      color: getColorForCommand(cmd.id),
      keywords: cmd.keywords || [],
      category: cmd.id === 'upload_drive' ? 'Tools' : 'Workspace',
    }));

  return [...remote, ...local];
};

const AT_COMMANDS = getAllAtCommands();

const AtCommandPopup: React.FC<AtCommandPopupProps> = ({
  highlightIndex,
  onSelect,
  onClose,
  anchorRef,
  searchQuery = '',
  onHighlightIndexChange,


  isLockedAI = false,
  hideTabs = false,
}) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [openTabs, setOpenTabs] = useState<AtCommandItem[]>([]);
  const [recentIds] = useChromeStorage<string[]>('taskbot_recent_commands', []);
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    const chromeAny = (window as any).chrome;
    if (chromeAny && chromeAny.tabs && chromeAny.tabs.query) {
      chromeAny.tabs.query({}, (tabs: any[]) => {
        const mapped = (tabs || [])
          .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
          .map(t => ({
            id: `tab:${t.id}`,
            label: t.title || t.url || 'Untitled Tab',
            icon: FaTerminal,
            color: 'text-neutral-400',
            keywords: ['tab', 'open tab'],
            category: 'Active Tabs',
            favIconUrl: t.favIconUrl || (t.url ? getFaviconUrl(t.url) : ''),
          }));
        setOpenTabs(mapped);
      });
    }
  }, []);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    // If not locked to an AI command, DO NOT show active tabs
    let tabs = isLockedAI && !hideTabs ? openTabs : [];
    if (tabs.length > 0) {
      const allTabsOption: AtCommandItem = {
        id: 'tab:all_tabs',
        label: 'Add All Open Tabs',
        icon: FaLink,
        color: 'text-neutral-400',
        keywords: ['all', 'tabs', 'add all'],
        category: 'Active Tabs',
      };
      tabs = [allTabsOption, ...tabs];
    }

    const defaultFiltered = isLockedAI ? [] : getFilteredAtCommands(searchQuery, recentIds);
    if (!searchQuery) {
      return [...tabs, ...defaultFiltered];
    }
    const q = searchQuery.toLowerCase().trim();
    const filteredTabs = tabs.filter(tab => tab.label.toLowerCase().includes(q));
    return [...filteredTabs, ...defaultFiltered];
  }, [searchQuery, openTabs, isLockedAI, hideTabs, recentIds]);

  // Reset highlight index when filtered results change
  useEffect(() => {
    if (onHighlightIndexChange && highlightIndex >= filteredCommands.length) {
      onHighlightIndexChange(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, highlightIndex, onHighlightIndexChange]);

  // Calculate position based on anchorRef
  useEffect(() => {
    const updatePosition = () => {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + 12, // slightly offset below input
          left: rect.left + 40, // approximate indentation for @ icon
        });
      }
    };

    updatePosition();
    // Update on resize/scroll to keep it attached
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click is not inside the anchor (input) AND not inside any button in our popup, close it
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        !Object.values(itemRefs.current).some(btn => btn?.contains(target))
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  // Keep highlighted item in view
  useEffect(() => {
    const node = itemRefs.current[highlightIndex];
    if (node) {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  // Don't render until we have coordinates
  if (!coords) return null;

  // Show "not added" fallback when there's a search query but no matches
  if (filteredCommands.length === 0 && searchQuery.trim()) {
    return null; // Or show custom "not found" UI if desired
  }

  // Close dropdown if no query and no default commands (though we have defaults now)
  if (filteredCommands.length === 0) {
    return null;
  }

  // Render via Portal to escape stacking contexts (glass theme, z-index traps)
  return createPortal(
    <div
      className="fixed w-64 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden flex flex-col font-sans max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full"
      style={{
        top: coords.top,
        left: coords.left,
        zIndex: 99999, // Very high z-index to stay on top
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/30 sticky top-0 backdrop-blur-md z-10">
        <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider truncate mr-2">
          {searchQuery
            ? `Search: ${searchQuery}`
            : filteredCommands[0]?.category === 'Active Tabs'
              ? 'Select Tab to Mention'
              : 'Quick Actions'}
        </span>
        <button
          type="button"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          title="Close">
          <FaTimes size={10} />
        </button>
      </div>

      {/* List */}
      <div className="py-1">
        {filteredCommands.map((cmd, idx) => {
          const isActive = idx === highlightIndex;
          const Icon = cmd.icon;

          // Header logic: show header if category changes
          const prevCmd = idx > 0 ? filteredCommands[idx - 1] : null;
          const showHeader = !prevCmd || prevCmd.category !== cmd.category;

          return (
            <React.Fragment key={`${cmd.id}-${idx}`}>
              {showHeader && cmd.category !== 'Active Tabs' && (
                <div className="px-3 py-1 mt-1 text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest bg-neutral-50/30 dark:bg-neutral-900/10">
                  {cmd.category}
                </div>
              )}
              <button
                ref={el => {
                  itemRefs.current[idx] = el;
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-all flex items-center gap-2.5 outline-none ${isActive
                    ? 'bg-neutral-100 dark:bg-neutral-700/80 text-neutral-900 dark:text-white font-medium'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                onMouseDown={e => {
                  e.preventDefault();
                  onSelect(cmd.id);
                }}
                onMouseEnter={() => {
                  onHighlightIndexChange?.(idx);
                }}>
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {cmd.favIconUrl ? (
                    <img
                      src={cmd.favIconUrl}
                      alt=""
                      className="w-3.5 h-3.5 object-contain rounded-sm"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Icon className={`text-sm ${cmd.color}`} />
                  )}
                </div>
                <span className="truncate flex-1 whitespace-nowrap">{cmd.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export const AT_COMMANDS_LIST = AT_COMMANDS;
export const AT_COMMAND_COUNT = AT_COMMANDS.length;

// Get filtered commands based on search query
export const getFilteredAtCommands = (query: string, recentIds: string[] = []): AtCommandItem[] => {
  const allCommands = getAllAtCommands();
  const searchItems = [...allCommands];

  if (!query) {
    // Group everything by category
    const categorized: Record<string, AtCommandItem[]> = {
      Recent: [],
      'AI Assistants': [],
      Workspace: [],
      Tools: [],
      Browser: [],
    };

    // Populate recent first
    recentIds.forEach(id => {
      const match = searchItems.find(item => item.id === id);
      if (match) {
        categorized['Recent'].push({ ...match, category: 'Recent' });
      }
    });

    searchItems.forEach(item => {
      if (categorized[item.category]) {
        categorized[item.category].push(item);
      } else {
        categorized['Tools'].push(item);
      }
    });

    return Object.values(categorized).flat();
  }

  // Filter based on query
  const q = query.toLowerCase().trim().replace(/_/g, ' ');
  const filtered = searchItems.filter((cmd: AtCommandItem) => {
    const labelLower = String(cmd.label || '').toLowerCase();
    const idLower = String(cmd.id || '').toLowerCase();

    if (labelLower.startsWith(q)) return true;
    if (idLower.startsWith(q)) return true;

    const labelWords = labelLower.split(/\s+/);
    if (labelWords.some(word => word.startsWith(q))) return true;

    if (
      cmd.keywords.some(kw => {
        const kwLower = String(kw || '').toLowerCase();
        return kwLower.startsWith(q) || kwLower.split(/\s+/).some(word => word.startsWith(q));
      })
    ) {
      return true;
    }

    return false;
  });

  // Sort filtered results
  const categoryOrder = ['Recent', 'AI Assistants', 'Workspace', 'Tools'];

  const sorted = filtered.sort((a: AtCommandItem, b: AtCommandItem) => {
    const aIsRecent = recentIds.includes(a.id);
    const bIsRecent = recentIds.includes(b.id);
    if (aIsRecent && !bIsRecent) return -1;
    if (!aIsRecent && bIsRecent) return 1;

    const aExact = String(a.label || '')
      .toLowerCase()
      .startsWith(q);
    const bExact = String(b.label || '')
      .toLowerCase()
      .startsWith(q);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aCatIdx = categoryOrder.indexOf(a.category);
    const bCatIdx = categoryOrder.indexOf(b.category);
    return aCatIdx - bCatIdx;
  });

  return sorted;
};

export const getFilteredAtCommandCount = (query: string, recentIds: string[] = []): number => {
  return getFilteredAtCommands(query, recentIds).length;
};

export default AtCommandPopup;
