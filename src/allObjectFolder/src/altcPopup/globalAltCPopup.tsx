/**
 * @file globalAltCPopup.tsx
 * @description This file implements the Global Alt+C Command Popup.
 * It provides a search-and-select interface (command palette style) allowing users
 * to quickly trigger creation actions such as Link Collection, Notes, Sessions, Snippets,
 * Todos, Chat Agent, and Automations via keyboard shortcuts (e.g., ALT+C or specific keys) or search.
 * 
 * @usage
 * ```tsx
 * import { GlobalAltCPopup } from './altcPopup';
 * 
 * <GlobalAltCPopup
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCommandSelect={(id) => handleCommand(id)}
 * />
 * ```
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';

import { useAppearance } from '@extension/ui';
import { FaBuilding, FaLink, FaRegFolder } from 'react-icons/fa';
import { FiZap, FiCode, FiCheckSquare } from 'react-icons/fi';
import { FaLayerGroup } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import NotesIcon from '../../../shared-components/icons/notesIcon';
import { useUIStore } from '../../../shared-components/uiStateManager';

interface GlobalAltCPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (id: string) => void;
}

export const GlobalAltCPopup: React.FC<GlobalAltCPopupProps> = ({ isOpen, onClose, onCommandSelect, }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const shortcutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const createItems = useMemo(() => [
    {
      id: 'createlinks',
      label: 'Link',
      category: 'Data',
      icon: <FaLink size={14} />,
      action: () => onCommandSelect('createlinks'),
      shortcut: 'L',
    },
    {
      id: 'createnotes',
      label: 'Note',
      category: 'Data',
      icon: <NotesIcon size={15} />,
      action: () => onCommandSelect('createnotes'),
      shortcut: 'N',
    },
    {
      id: 'createsession',
      label: 'Tab Session',
      category: 'Data',
      icon: <FaLayerGroup size={15} />,
      action: () => onCommandSelect('createsession'),
      shortcut: 'TS',
    },
    {
      id: 'createsnippet',
      label: 'Text Expander',
      category: 'Data',
      icon: <FiCode size={16} />,
      action: () => onCommandSelect('createsnippet'),
      shortcut: 'TE',
    },
    {
      id: 'createtodo',
      label: 'Todo',
      category: 'Data',
      icon: <FiCheckSquare size={16} />,
      action: () => onCommandSelect('createtodo'),
      shortcut: 'T',
    },
    {
      id: 'createprompt',
      label: 'Chat Agent',
      category: 'Data',
      icon: <LuSparkles size={16} />,
      action: () => onCommandSelect('createprompt'),
      shortcut: 'C',
    },
    {
      id: 'createworkspace',
      label: 'Workspace',
      category: 'Structure',
      icon: <FaBuilding size={14} />,
      action: () => onCommandSelect('createworkspace'),
      shortcut: 'W',
    },
    {
      id: 'createfolder',
      label: 'Folder',
      category: 'Structure',
      icon: <FaRegFolder size={14} />,
      action: () => onCommandSelect('createfolder'),
      shortcut: 'F',
    },
    {
      id: 'agent',
      label: 'Automation Agent (beta)',
      category: 'Automations',
      icon: <FiZap size={15} className="text-[var(--color-iconDefault)]" />,
      action: () => onCommandSelect('agent'),
      shortcut: 'A',
    },
  ], [onCommandSelect]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return createItems;
    const query = searchQuery.toLowerCase().trim();
    return createItems.filter(
      item =>
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }, [createItems, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMenuIndex(0);
      setSearchQuery('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
        shortcutTimeoutRef.current = null;
      }

      const keyUpper = e.key.toUpperCase();

      if (pendingActionRef.current && (keyUpper === 'E' || keyUpper === 'S')) {
        e.preventDefault();
        pendingActionRef.current = null;
        const targetShortcut = keyUpper === 'E' ? 'TE' : 'TS';
        const matchedSeq = filteredItems.find(item => item.shortcut === targetShortcut);
        if (matchedSeq) {
          matchedSeq.action();
          onClose();
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMenuIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = filteredItems[selectedMenuIndex];
        if (activeItem) {
          onCommandSelect(activeItem.id);
          onClose();
        }
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const item = filteredItems[num - 1];
          if (item) {
            e.preventDefault();
            item.action();
            onClose();
            return;
          }
        }
        const matchedItem = filteredItems.find(item => item.shortcut === keyUpper);
        if (matchedItem) {
          e.preventDefault();
          if (keyUpper === 'T') {
            pendingActionRef.current = () => {
              matchedItem.action();
              onClose();
            };
            shortcutTimeoutRef.current = setTimeout(() => {
              if (pendingActionRef.current) {
                pendingActionRef.current();
                pendingActionRef.current = null;
              }
            }, 250);
          } else {
            matchedItem.action();
            onClose();
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
      unregister();
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, [isOpen, filteredItems, selectedMenuIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/10 backdrop-blur-[2px] pointer-events-auto"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative rounded-2xl border flex flex-col transition-all duration-200 select-none w-[400px] max-w-[90vw] shadow-2xl pb-3
          ${isDark 
            ? 'bg-[#171821] border-white/10 text-neutral-400' 
            : 'bg-[#fdf6e3] border-[#eee8d5] text-[#586e75]'
          }`}
        style={{
          boxShadow: isDark 
            ? '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div className={`relative flex items-center px-4 py-3.5 border-b
          ${isDark ? 'border-white/5 bg-[#171821]' : 'border-black/5 bg-[#fdf6e3]'} rounded-t-2xl`}>
          <input
            type="text"
            ref={searchInputRef}
            placeholder="Select a create command"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedMenuIndex(0);
            }}
            onFocus={e => e.target.select()}
            className={`w-full bg-transparent outline-none border-none text-[13px] pr-20
              ${isDark ? 'text-white placeholder-neutral-500' : 'text-neutral-800 placeholder-[#93a1a1]'}`}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border select-none tracking-wider
              ${isDark 
                ? 'border-white/10 bg-white/5 text-neutral-400' 
                : 'border-black/10 bg-black/5 text-[#586e75]'
              }`}>
              ALT + C
            </span>
          </div>
        </div>

        <div className="flex flex-col max-h-[50vh] overflow-y-auto custom-scrollbar px-2 mt-2">
          {filteredItems.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-neutral-500">
              No matching creation tools
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const showCategoryHeader = idx === 0 || item.category !== filteredItems[idx - 1].category;
              
              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <>
                      {idx > 0 && <div className={`my-1 mx-2 h-[1px] ${isDark ? 'bg-white/5' : 'bg-black/5'}`} />}
                      <div className={`px-3 pt-1 pb-0.5 text-[11px] font-semibold tracking-wider ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                        {item.category}
                      </div>
                    </>
                  )}
                  <div className="px-1 mb-0.5">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        item.action();
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-none text-left transition-colors duration-150 group
                        ${idx === selectedMenuIndex
                          ? (isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-[#073642]')
                          : (isDark ? 'hover:bg-white/5 text-neutral-300 hover:text-white' : 'hover:bg-black/5 text-[#586e75] hover:text-[#073642]')
                        }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-150
                          ${isDark ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-neutral-400 group-hover:text-[#073642]'}`}>
                          {item.icon}
                        </div>
                        <span className="text-[14px] font-semibold tracking-tight truncate">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border select-none font-mono min-w-[20px] text-center
                          ${isDark 
                            ? 'border-white/10 bg-white/5 text-neutral-300' 
                            : 'border-black/10 bg-black/5 text-[#073642]'
                          }`}>
                          {idx < 9 ? `${idx + 1}/${item.shortcut}` : item.shortcut}
                        </span>
                      </div>
                    </button>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalAltCPopup;
