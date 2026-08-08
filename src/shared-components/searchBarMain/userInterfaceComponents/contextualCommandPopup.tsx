import type * as React from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaLink, FaSearch } from 'react-icons/fa';
import type { SavedAutomation } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';
import type { InstalledModule } from '../searchLogicAndAlgorithms/searchEngine';

import { getFaviconUrl } from '../utilityFunctions/utils';
import AutomationDynamicIcon from '../../../shared-components/icons/automationDynamicIcon';
import { UnifiedContextMenu, type MenuAction } from '../../../shared-components/ui/UnifiedContextMenu';
import { FiEdit2 } from 'react-icons/fi';

export type ContextualMatch = {
  id: string;
  label: string;
  type: 'automation' | 'agent' | 'module' | 'snippet' | 'command' | 'agent_collection';
  automation?: SavedAutomation;
  agent?: any;
  module?: InstalledModule;
  snippet?: any;
  command?: any;
};

interface ContextualCommandPopupProps {
  matches: ContextualMatch[];
  highlightIndex: number;
  isOpen: boolean;
  onSelect: (match: ContextualMatch) => void;
  onHighlightChange: (index: number) => void;
  onRequestEditLink?: (item: any) => void;
  onRequestEditAutomation?: (automation: any) => void;
}

const ContextualCommandPopup: React.FC<ContextualCommandPopupProps> = ({
  matches,
  highlightIndex,
  isOpen,
  onSelect,
  onHighlightChange,
  onRequestEditLink,
  onRequestEditAutomation,
}) => {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [openMenuMatch, setOpenMenuMatch] = useState<ContextualMatch | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const actionableMatches = useMemo(() => {
    const allActionable = matches.filter(
      match =>
        match.type === 'command' ||
        match.type === 'automation' ||
        match.type === 'module' ||
        match.type === 'agent_collection' ||
        (match.type === 'snippet' &&
          match.snippet &&
          (match.snippet.category === 'link' ||
            match.snippet.category === 'links' ||
            match.snippet.category === 'link' ||
            match.snippet.category === 'link')),
    );

    if (!searchTerm.trim()) return allActionable;

    const term = searchTerm.toLowerCase().trim();
    return allActionable.filter(match => match.label.toLowerCase().includes(term));
  }, [matches, searchTerm]);

  // ✅ Auto-focus search input when user enters the popup (via Tab)
  useEffect(() => {
    if (highlightIndex >= 0) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [highlightIndex]);

  // Handle clearing search when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  // ✅ SCROLL FIX
  useEffect(() => {
    const activeItem = itemRefs.current[highlightIndex];
    if (activeItem && scrollRef.current) {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [highlightIndex]);

  // Adjust highlight index if it's out of bounds after filtering
  useEffect(() => {
    if (highlightIndex >= 0 && actionableMatches.length > 0) {
      if (highlightIndex >= actionableMatches.length) {
        onHighlightChange(actionableMatches.length - 1);
      }
    }
  }, [actionableMatches, highlightIndex, onHighlightChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (actionableMatches.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      onHighlightChange((highlightIndex + 1) % actionableMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      onHighlightChange((highlightIndex - 1 + actionableMatches.length) % actionableMatches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const selectedMatch = actionableMatches[highlightIndex];
      if (selectedMatch) {
        onSelect(selectedMatch);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onHighlightChange(-1);
    }
  };

  if (!isOpen || (actionableMatches.length === 0 && !searchTerm.trim())) return null;
  // If no actionable matches after filtering, we still show the search box
  const hasNoResults = actionableMatches.length === 0 && searchTerm.trim().length > 0;

  return (
    <div className="absolute right-3 top-0 flex flex-col items-end z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className="flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xl overflow-hidden min-w-[186px] max-w-[246px]">
            {actionableMatches.length > 6 && (
              <div className="px-2 py-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col gap-2">
                <div className="relative flex items-center">
                  <FaSearch className="absolute left-2 text-[var(--color-iconDefault)]" size={10} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search actions..."
                    className="w-full pl-7 pr-2 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-none rounded-md text-[11px] focus:ring-1 focus:ring-purple-500/50 outline-none placeholder-[var(--color-textPlaceholder)]"
                  />
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              className="p-1 max-h-[186px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-400/50 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600/50 [&::-webkit-scrollbar-track]:bg-transparent">
              {hasNoResults ? (
                <div className="px-4 py-6 text-center">
                  <span className="text-[11px] text-neutral-500 italic">No matches found</span>
                </div>
              ) : (
                actionableMatches.map((match, idx) => {
                  const isActive = idx === highlightIndex;
                  const isModule = match.type === 'module';
                  const isSnippet = match.type === 'snippet';
                  const isCommand = match.type === 'command';
                  const isAutomation = match.type === 'automation';

                  let shortcutLabel: string | null = null;
                  if (isSnippet && match.snippet?.shortcuts) {
                    const shortcuts = match.snippet.shortcuts.split(',').map((s: string) => s.trim());
                    if (shortcuts.length > 0) {
                      const shortcutValue = shortcuts[0].split(':/').pop()?.trim();
                      shortcutLabel = shortcutValue ? `/${shortcutValue}` : null;
                    }
                  } else if (idx < 9) {
                    shortcutLabel = `Alt+${idx + 1}`;
                  }

                  const moduleIconHost = String(
                    (match.module as any)?.icon_host || (match.module as any)?.parent_icon_host || '',
                  ).trim();

                  let snippetUrls: string[] = [];
                  if (isSnippet && match.snippet) {
                    const value = match.snippet.value;
                    if (typeof value === 'string' && value.startsWith('http')) {
                      snippetUrls = [value];
                    } else if (typeof value === 'object' && (value as any).urls) {
                      snippetUrls = ((value as any).urls as string[]).filter(u => u);
                    } else if (typeof value === 'object' && (value as any).tabs) {
                      snippetUrls = (value as any).tabs
                        .map((tab: any) => tab.url || tab.link || '')
                        .filter((u: string) => u && u.startsWith('http'));
                    }
                  }

                  return (
                    <button
                      ref={el => {
                        itemRefs.current[idx] = el;
                      }}
                      key={match.id + idx}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => onSelect(match)}
                      onMouseEnter={() => onHighlightChange(idx)}
                      onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isSnippet || isAutomation) {
                          setMenuPosition({ x: e.clientX, y: e.clientY });
                          setOpenMenuMatch(match);
                        }
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-all duration-200 ${isActive
                        ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}>
                      <div className="flex items-center justify-center">
                        {isSnippet ? (
                          snippetUrls.length > 1 ? (
                            <div className="flex -space-x-1.5 items-center w-7">
                              {snippetUrls.slice(0, 3).map((url, i) => (
                                <div
                                  key={i}
                                  className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-neutral-800 overflow-hidden shadow-sm bg-white dark:bg-neutral-700">
                                  <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
                                </div>
                              ))}
                            </div>
                          ) : snippetUrls.length === 1 ? (
                            <img src={getFaviconUrl(snippetUrls[0])} className="w-3.5 h-3.5 rounded-sm" />
                          ) : (
                            <FaLink size={14} className="opacity-80" />
                          )
                        ) : isModule ? (
                          moduleIconHost ? (
                            <img src={getFaviconUrl(moduleIconHost)} className="w-3.5 h-3.5 rounded-sm" />
                          ) : (
                            <AutomationDynamicIcon automation={{}} size={14} className="opacity-80" />
                          )
                        ) : isCommand && match.command?.iconHost ? (
                          <img
                            src={getFaviconUrl(match.command.iconHost)}
                            className="w-3.5 h-3.5 rounded-sm shadow-sm"
                          />
                        ) : isCommand ? (
                          <FaSearch size={14} className="opacity-80" />
                        ) : (
                          <AutomationDynamicIcon automation={match.automation || {}} size={14} className="opacity-80" />
                        )}
                      </div>

                      <span className="flex-1 text-left font-medium truncate">{match.label}</span>

                      {shortcutLabel && (
                        <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
                          {shortcutLabel}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {openMenuMatch && menuPosition && (
        <UnifiedContextMenu
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => {
            setOpenMenuMatch(null);
            setMenuPosition(null);
          }}
          actions={[
            ...(openMenuMatch?.type === 'snippet'
              ? [
                {
                  key: 'edit-link',
                  label: ['link', 'links'].includes((openMenuMatch?.snippet?.category || '').toLowerCase())
                    ? 'Edit Link'
                    : 'Edit Snippet',
                  icon: <FiEdit2 size={14} />,
                  onSelect: () => {
                    if (onRequestEditLink && openMenuMatch?.snippet) {
                      const suggestion = {
                        snippet: openMenuMatch.snippet,
                        workspace: { workspace_id: '', workspace_name: '' }, // Fallback
                        folder: null,
                      };
                      onRequestEditLink(suggestion);
                    }
                    setOpenMenuMatch(null);
                    setMenuPosition(null);
                  },
                },
              ]
              : []),
            ...(openMenuMatch?.type === 'automation'
              ? [
                {
                  key: 'edit-automation',
                  label: 'Edit Automation',
                  icon: <FiEdit2 size={14} />,
                  onSelect: () => {
                    if (onRequestEditAutomation && openMenuMatch?.automation) {
                      onRequestEditAutomation(openMenuMatch.automation);
                    }
                    setOpenMenuMatch(null);
                    setMenuPosition(null);
                  },
                },
              ]
              : []),
          ]}
        />
      )}
    </div>
  );
};

export default ContextualCommandPopup;
