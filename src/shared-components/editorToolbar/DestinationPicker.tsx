import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { FaFolder, FaSearch, FaBriefcase, FaCheck, FaPlus, FaChevronDown } from 'react-icons/fa';
import { useDestination, DestinationGroup } from './hooks/useDestination';
import { FiZapOff, FiChevronLeft } from 'react-icons/fi';
import { createFolder } from '../../settings/allWorkspaceManager/folders/folderData';
import { useWorkspaces } from '../../settings/allWorkspaceManager/workspaces/workspaceHooks';

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
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Folder creation inline state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(selectedWorkspaceId || '');
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);

  const { destinations } = useDestination();
  const { workspaces } = useWorkspaces();

  useEffect(() => {
    if (!targetWorkspaceId && workspaces.length > 0) {
      setTargetWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, targetWorkspaceId]);

  useEffect(() => {
    if (isCreatingFolder) {
      setTimeout(() => newFolderInputRef.current?.focus(), 50);
    }
  }, [isCreatingFolder]);

  const handleCreateFolderSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setCreateFolderError('Enter a folder name');
      return;
    }
    if (!targetWorkspaceId) {
      setCreateFolderError('Select a workspace');
      return;
    }

    setIsSubmittingFolder(true);
    setCreateFolderError(null);
    try {
      const created = await createFolder(targetWorkspaceId, trimmedName);
      onSelectFolder(targetWorkspaceId, created.id);
      onClose();
    } catch (err: any) {
      console.error('[DestinationPicker] Create folder failed:', err);
      setCreateFolderError(err?.message || 'Failed to create folder');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

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
    if (isCreatingFolder) return;

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
  }, [flatItems, activeIndex, onSelectWorkspace, onSelectFolder, onClose, isCreatingFolder]);

  let flatCounter = 0;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'w-[260px] bg-[var(--color-popupBg)] supports-[backdrop-filter]:bg-[var(--color-popupBg)]/95 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-lg shadow-lg overflow-hidden flex flex-col z-50',
        className,
      )}>
      {/* Header Bar */}
      <div className="px-2.5 py-1.5 border-b border-[var(--color-borderDefault)] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-[var(--color-textMuted)] uppercase">
          {isCreatingFolder ? (
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(false);
                setCreateFolderError(null);
              }}
              className="flex items-center gap-1 text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] transition-colors p-0.5 rounded cursor-pointer"
              title="Back to location list">
              <FiChevronLeft size={13} />
              <span>Create Folder</span>
            </button>
          ) : (
            <span>Select Location</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isCreatingFolder && (
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(true);
                setNewFolderName('');
                setCreateFolderError(null);
              }}
              className="p-1 rounded-md text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-colors flex items-center justify-center cursor-pointer"
              title="Create New Folder">
              <FaPlus size={11} />
            </button>
          )}

          {(selectedWorkspaceId || selectedFolderId) && onClear && !isCreatingFolder && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClear();
                onClose();
              }}
              className="text-[var(--color-danger)] hover:text-[var(--color-dangerHover)] transition-colors p-1 rounded-md hover:bg-[var(--color-dangerBg)] flex items-center gap-1 text-[10px] font-medium"
              title="Clear Location">
              <span>Clear</span>
              <FiZapOff size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isCreatingFolder ? (
        <form onSubmit={handleCreateFolderSubmit} className="p-2.5 flex flex-col gap-2.5">
          {/* Folder Name Input */}
          <div className="flex flex-col gap-1">
            <div className="relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3 py-2 flex items-center shadow-sm">
              <input
                ref={newFolderInputRef}
                type="text"
                placeholder="Give your folder a name..."
                value={newFolderName}
                onChange={e => {
                  setNewFolderName(e.target.value);
                  if (createFolderError) setCreateFolderError(null);
                }}
                className="w-full text-xs font-medium text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none p-0"
              />
            </div>
            {createFolderError && (
              <span className="text-[10px] text-red-500 font-medium px-1">{createFolderError}</span>
            )}
          </div>

          {/* Workspace Select Dropdown */}
          <div className="relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] overflow-hidden px-3 py-2 flex items-center justify-between shadow-sm cursor-pointer">
            <select
              value={targetWorkspaceId}
              onChange={e => setTargetWorkspaceId(e.target.value)}
              className="w-full text-xs font-semibold text-[var(--color-textPrimary)] bg-transparent outline-none border-none shadow-none appearance-none cursor-pointer pr-4"
            >
              {workspaces.map(ws => (
                <option key={ws.id} value={ws.id} className="bg-[var(--color-popupBg)] text-[var(--color-textPrimary)]">
                  {ws.workspaceName}
                </option>
              ))}
            </select>
            <FaChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none" />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(false);
                setCreateFolderError(null);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingFolder}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--color-accent,#2563eb)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmittingFolder ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-2 space-y-2">
          <div className="relative px-1">
            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)]" size={12} />
            <input
              ref={searchInputRef}
              className={clsx(
                'w-full pl-8 pr-3 py-1.5 text-[13px] font-medium rounded-lg focus:outline-none transition-all',
                'text-[var(--color-textPrimary)] bg-[var(--color-inputBg)] focus:ring-1 focus:ring-[var(--color-borderActive)] placeholder:text-[var(--color-textPlaceholder)] border border-transparent focus:border-[var(--color-borderDefault)]',
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
                          'w-full group flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer border',
                          isSelected
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border-[var(--color-borderSelected,var(--color-borderDefault))] font-semibold shadow-xs'
                            : isHighlighted
                            ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border-transparent'
                            : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border-transparent',
                        )}>
                        <div
                          className={clsx(
                            'w-5 h-5 flex items-center justify-center rounded shrink-0',
                            isSelected
                              ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                              : isHighlighted
                              ? 'bg-[var(--color-inputBg)] text-[var(--color-textPrimary)]'
                              : 'bg-[var(--color-inputBg)] text-[var(--color-iconDefault)]',
                          )}>
                          <FaBriefcase size={10} />
                        </div>
                        <span className="text-[13px] font-semibold flex-1 truncate text-[var(--color-textPrimary)]">
                          {group.workspace.workspaceName}
                        </span>
                        {isSelected && <FaCheck size={12} className="text-[var(--color-textPrimary)] shrink-0 ml-2" />}
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
                              'w-full group relative flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer border',
                              isSelected
                                ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border-[var(--color-borderSelected,var(--color-borderDefault))] font-semibold shadow-xs'
                                : isHighlighted
                                ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] border-transparent'
                                : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] border-transparent',
                            )}>
                            <FaFolder
                              size={11}
                              className={clsx(
                                'transition-colors shrink-0',
                                isSelected || isHighlighted ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)]',
                              )}
                            />
                            <span className="text-[12px] font-medium flex-1 truncate text-[var(--color-textPrimary)]">
                              {folder.folderName}
                            </span>
                            {isSelected && <FaCheck size={12} className="text-[var(--color-textPrimary)] shrink-0 ml-2" />}
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
      )}
    </div>
  );
};
