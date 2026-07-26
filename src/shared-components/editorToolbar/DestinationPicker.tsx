import React, { useState, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { FaFolder, FaSearch, FaBriefcase, FaCheck } from 'react-icons/fa';
import { useDestination, DestinationGroup } from './hooks/useDestination';
import { FiZapOff } from 'react-icons/fi';

interface DestinationPickerProps {
  selectedWorkspaceId?: string | null;
  selectedFolderId?: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectFolder: (workspaceId: string, folderId: string) => void;
  onClear?: () => void;
  onClose: () => void;
  className?: string;
}

export const DestinationPicker: React.FC<DestinationPickerProps> = ({
  selectedWorkspaceId,
  selectedFolderId,
  onSelectWorkspace,
  onSelectFolder,
  onClear,
  onClose,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const { destinations } = useDestination();

  // Auto focus input on mount and reset activeIndex to 0
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    searchInputRef.current?.focus();
    const timer = setTimeout(() => searchInputRef.current?.focus(), 10);
    return () => clearTimeout(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Filter based on search query
  const filteredDestinations = useMemo(() => {
    if (!query.trim()) return destinations;

    const lowerQuery = query.toLowerCase();

    return destinations
      .map(group => {
        const workspaceMatches = group.workspace.workspaceName?.toLowerCase().includes(lowerQuery);

        const matchedFolders = group.folders.filter(f =>
          f.folderName?.toLowerCase().includes(lowerQuery),
        );

        if (workspaceMatches || matchedFolders.length > 0) {
          return {
            ...group,
            folders: workspaceMatches ? group.folders : matchedFolders,
          } as DestinationGroup;
        }
        return null;
      })
      .filter(Boolean) as DestinationGroup[];
  }, [destinations, query]);

  // Build a flat list of selectable items for keyboard navigation
  type FlatItem =
    | { id: string; type: 'workspace'; workspaceId: string; label: string }
    | { id: string; type: 'folder'; workspaceId: string; folderId: string; label: string };

  const flatItems = useMemo(() => {
    const items: FlatItem[] = [];
    filteredDestinations.forEach(group => {
      items.push({
        id: `ws-${group.workspace.id}`,
        type: 'workspace',
        workspaceId: group.workspace.id,
        label: group.workspace.workspaceName,
      });
      group.folders.forEach(folder => {
        items.push({
          id: `folder-${folder.id}`,
          type: 'folder',
          workspaceId: group.workspace.id,
          folderId: folder.id,
          label: folder.folderName,
        });
      });
    });
    return items;
  }, [filteredDestinations]);

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Capture-phase keydown listener for strict keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
      }

      if (e.key === 'ArrowDown') {
        setActiveIndex(prev => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        setActiveIndex(prev => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
      } else if (e.key === 'Enter') {
        const target = flatItems[activeIndex];
        if (target) {
          if (target.type === 'workspace') {
            onSelectWorkspace(target.workspaceId);
          } else {
            onSelectFolder(target.workspaceId, target.folderId);
          }
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [flatItems, activeIndex, onSelectWorkspace, onSelectFolder, onClose]);

  let flatCounter = 0;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'w-[260px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-lg shadow-lg overflow-hidden flex flex-col z-50',
        className,
      )}>
      <div className="px-2 py-1 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
        <div className="text-[9px] font-semibold tracking-wider text-slate-500 dark:text-neutral-200 uppercase">
          Select Location
        </div>
        {(selectedWorkspaceId || selectedFolderId) && onClear && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClear();
              onClose();
            }}
            className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1.5 text-[10px] font-medium"
            title="Clear Location">
            <span>Clear</span>
            <FiZapOff size={12} />
          </button>
        )}
      </div>
      <div className="p-2 space-y-2">
        <div className="relative px-1">
          <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" size={12} />
          <input
            ref={searchInputRef}
            className={clsx(
              'w-full pl-8 pr-3 py-1.5 text-[13px] font-medium rounded-lg focus:outline-none transition-all',
              'text-[var(--color-textPrimary)] bg-[var(--color-editorBg)] focus:ring-1 focus:ring-neutral-400/30 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 border border-transparent focus:border-[var(--color-borderDefault)]',
            )}
            placeholder="Find workspace or folder..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto custom-scrollbar px-1 pb-1">
          {filteredDestinations.length === 0 ? (
            <div className="text-xs px-2 py-6 text-center text-[var(--color-textSecondary)]">
              No destinations found.
            </div>
          ) : (
            filteredDestinations.map(group => (
              <div key={group.workspace.id} className="mb-1.5 last:mb-0">
                {/* Workspace Header (Selectable) */}
                {(() => {
                  const itemIndex = flatCounter++;
                  const isHighlighted = activeIndex === itemIndex;
                  const isSelected = selectedWorkspaceId === group.workspace.id && !selectedFolderId;

                  return (
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      onClick={() => {
                        onSelectWorkspace(group.workspace.id);
                        onClose();
                      }}
                      className={clsx(
                        'w-full group flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer',
                        isHighlighted
                          ? 'bg-white/15 text-white'
                          : isSelected
                          ? 'bg-[var(--color-activeBg)] text-white'
                          : 'hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]',
                      )}>
                      <div
                        className={clsx(
                          'w-5 h-5 flex items-center justify-center rounded shrink-0',
                          isSelected || isHighlighted
                            ? 'bg-white/20 text-white'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                        )}>
                        <FaBriefcase size={10} />
                      </div>
                      <span className="text-[13px] font-semibold flex-1 truncate">
                        {group.workspace.workspaceName}
                      </span>
                      {isSelected && <FaCheck size={12} className="text-white shrink-0 ml-2" />}
                    </button>
                  );
                })()}

                {/* Folders List (Indented) */}
                {group.folders.length > 0 && (
                  <div className="mt-0.5 ml-[11px] pl-4 border-l border-[var(--color-borderDefault)] flex flex-col gap-0.5">
                    {group.folders.map(folder => {
                      const itemIndex = flatCounter++;
                      const isHighlighted = activeIndex === itemIndex;
                      const isSelected = selectedFolderId === folder.id;

                      return (
                        <button
                          key={folder.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => {
                            onSelectFolder(group.workspace.id, folder.id);
                            onClose();
                          }}
                          className={clsx(
                            'w-full group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer',
                            isHighlighted
                              ? 'bg-white/15 text-white'
                              : isSelected
                              ? 'bg-[var(--color-activeBg)] text-white'
                              : 'hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)]',
                          )}>
                          <FaFolder
                            size={11}
                            className={clsx(
                              'transition-colors shrink-0',
                              isSelected || isHighlighted ? 'text-white' : 'text-neutral-400 group-hover:text-blue-500',
                            )}
                          />
                          <span className="text-[12px] font-medium flex-1 truncate">
                            {folder.folderName}
                          </span>
                          {isSelected && <FaCheck size={12} className="text-white shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
