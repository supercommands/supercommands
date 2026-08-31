import * as React from 'react';
import { useState, useMemo } from 'react';
import type { SortingState, ColumnSizingState } from '@tanstack/react-table';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { useDbStore } from '../../../storage/store/useDbStore';
import { getSingleInitial } from '../../../shared-components/utils/avatarColors';
import type { RowData, GridRow, AutomationModuleRow } from '../types/spreadsheetTypes';
import { columns } from '../logic/spreadsheetColumnDefinitions';
import { getSpreadsheetDescriptionPreview, extractPlainTextFromSnippetConfig, canOpenSpreadsheetRow, hasExternalOpenerIcon, openSpreadsheetRow, openSpreadsheetRowInNewTab } from '../logic/spreadsheetHelpers';
import SpreadsheetHeader from './spreadsheetHeader';
import { clsx } from 'clsx';

import { useSpreadsheetStore, isTagSupportedRow } from '../logic/spreadsheetStateStore';
import { SpreadsheetTagSelector } from './SpreadsheetTagSelector';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { VisualKeyDisplay } from '../../../shared-components/hotkeys/ui/VisualKeyDisplay';
import { EditablePrefixKey } from '../../../shared-components/shortcuts/ui/EditablePrefixKey';
import { DestinationPicker } from '../../../shared-components/editorToolbar/DestinationPicker';
import { FaPlus,
  FaTrash,
  FaLock,
  FaGlobe,
  FaUsers,
  FaUser,
  FaStar,
  FaFilter,
  FaLink,
  FaFileAlt,
  FaCode,
  FaTerminal,
  FaTrashAlt,
  FaCheck,
  FaBookmark,
  FaPuzzlePiece } from 'react-icons/fa';

import { BsPersonFill, BsPeopleFill, BsHourglassSplit } from 'react-icons/bs';
import { MdLockOutline } from 'react-icons/md';
import {
  FiStar,
  FiCheck,
  FiGlobe,
  FiFilter,
  FiExternalLink,
  FiUsers,
  FiLock,
  FiPlus,
  FiLoader,
  FiChevronRight,
  FiChevronDown,
  FiBox,
  FiZap,
  FiSearch,
  FiTrash,
  FiFileText,
  FiLayout,
  FiMonitor,
  FiLink,
  FiCheckSquare,
} from 'react-icons/fi';
import { SiGooglechrome } from 'react-icons/si';
import { TbBrandGithub, TbWorld, TbStack2 } from 'react-icons/tb';
import { FaUserCircle } from 'react-icons/fa';

import { LuSparkles, LuPlus } from 'react-icons/lu';
import { getFaviconUrl } from '../../../shared-components/searchBarMain/utilityFunctions/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotesIcon from '../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../shared-components/icons/stackedLinkIcon';
import AutomationDynamicIcon from '../../../shared-components/icons/automationDynamicIcon';
import { GridHotkeyInput, GridCommandInput } from './spreadsheetShortcutInputs';
import { SpreadsheetMultiLinkInput } from './spreadsheetMultiLinkInput';

import { getItemCompoundId, readAllHotkeys, readAllShortcuts } from '../../../shared-components/hotkeys/utils/hotkeyUtils';
import { BsCalendarCheck } from 'react-icons/bs';
import { SessionGridIcon } from '../../icons/sessionGridIcon';

const supportsTitleInlinePreview = (row: any) => {
  if (['bookmark', 'bookmarks'].includes(String(row.category || '').toLowerCase())) return false;

  const isNote = row.section === 'Notes' || row.itemType === 'note';
  const isSnippet = row.section === 'Snippets' || row.itemType === 'snippet';
  const isLink =
    row.section === 'Smart Links' ||
    row.section === 'Tab Sessions' ||
    row.itemType === 'link' ||
    row.itemType === 'session' ||
    row.category === 'link' ||
    row.category === 'session';
  const isCommand =
    row.category === 'commands' ||
    row.category === 'general_commands' ||
    row.section === 'Browser Commands';

  return isNote || isSnippet || isLink || isCommand;
};

const getWorkspaceAndFolderLocation = (workspaceId: string | null, folderId: string | null) => {
  const dbState = useDbStore.getState();
  const workspace = workspaceId ? dbState.getWorkspaceById(workspaceId) : null;

  if (!workspace) return null;

  const wsIcon = workspace.workspaceName.includes('Personal Space') ? 'P' : getSingleInitial(workspace.workspaceName);
  const wsPath = `${wsIcon} ${workspace.workspaceName}`;
  const isPersonalSpace = workspace.workspaceName === 'Personal Space' || workspace.workspaceName.includes('Personal Space');

  let path = wsPath;
  let visibilityType: 'lock' | 'globe' | 'users' | 'personal' = isPersonalSpace ? 'personal' : 'lock';

  return {
    workspace,
    workspace_id: workspace.id,
    folder_id: folderId || null,
    folder: workspace.workspaceName,
    path,
    plainPath: path,
    visibilityType,
  };
};

type SpreadsheetTypeInfo = {
  label: string;
  tone:
    | 'link'
    | 'collection'
    | 'note'
    | 'textExpander'
    | 'todo'
    | 'command'
    | 'automation'
    | 'agent'
    | 'default';
  foregroundClass: string;
  icon: React.ReactNode;
};

const getTypeInfo = (row: any): SpreadsheetTypeInfo => {
  const cat = String(row.category || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();

  if (cat === 'link' || section.includes('smart link')) {
    return {
      label: 'Link',
      tone: 'link',
      foregroundClass: 'text-blue-500 dark:text-blue-400',
      icon: <FaLink size={13} className="shrink-0" />,
    };
  }
  if (cat === 'session' || section.includes('tab session') || section.includes('collection')) {
    return {
      label: 'Collection',
      tone: 'collection',
      foregroundClass: 'text-emerald-500 dark:text-emerald-400',
      icon: <SessionGridIcon className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (cat === 'note' || section.includes('note')) {
    return {
      label: 'Note',
      tone: 'note',
      foregroundClass: 'text-[#C2410C] dark:text-[#FB923C]',
      icon: <NotesIcon className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (cat === 'snippet' || section.includes('snippet') || section.includes('text expander')) {
    return {
      label: 'Text Expander',
      tone: 'textExpander',
      foregroundClass: 'text-purple-500 dark:text-purple-400',
      icon: <FaCode size={13} className="shrink-0" />,
    };
  }
  if (cat === 'todo' || section.includes('todo')) {
    return {
      label: 'Todo',
      tone: 'todo',
      foregroundClass: 'text-cyan-500 dark:text-cyan-400',
      icon: <BsCalendarCheck size={13} className="shrink-0" />,
    };
  }
  if (cat === 'general_commands' || section.includes('system command')) {
    return {
      label: 'System Command',
      tone: 'command',
      foregroundClass: 'text-sky-600 dark:text-sky-300',
      icon: <FaTerminal size={13} className="shrink-0" />,
    };
  }
  if (cat === 'commands' || section.includes('browser command')) {
    return {
      label: 'Browser Command',
      tone: 'command',
      foregroundClass: 'text-sky-600 dark:text-sky-300',
      icon: <FaTerminal size={13} className="shrink-0" />,
    };
  }
  if (cat === 'automation' || section.includes('automation')) {
    return {
      label: 'Automation',
      tone: 'automation',
      foregroundClass: 'text-orange-500 dark:text-orange-400',
      icon: <FiZap size={13} className="shrink-0" />,
    };
  }
  if (cat === 'agent' || section.includes('chat agent')) {
    return {
      label: 'Chat Agent',
      tone: 'agent',
      foregroundClass: 'text-[#7E22CE] dark:text-[#C084FC]',
      icon: <LuSparkles size={13} className="shrink-0" />,
    };
  }

  return {
    label: row.category || 'Resource',
    tone: 'default',
    foregroundClass: 'text-[var(--color-textSecondary)]',
    icon: null,
  };
};

const BufferedCellInput = ({
  initialValue,
  onSave,
  onCancel,
  placeholder,
  isReal,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  placeholder?: string;
  isReal: boolean;
}) => {
  const [localValue, setLocalValue] = React.useState(initialValue);

  return (
    <div className="relative w-full h-full flex items-center px-0.5">
      <input
        autoFocus
        value={localValue}
        placeholder={placeholder}
        className="w-full h-full outline-none bg-transparent"
        onChange={e => setLocalValue(e.target.value)}
        onBlur={() => onSave(localValue)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave(localValue);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {!localValue && !isReal && (
        <span className="absolute right-1 text-red-500 text-[10px] font-bold pointer-events-none">*</span>
      )}
    </div>
  );
};

interface SpreadsheetTableProps {
  onClose?: () => void;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
  isEmbedded?: boolean;
}

const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({
  onClose,
  tutorialStep,
  setTutorialStep,
}: SpreadsheetTableProps) => {
  const [localToastMsg, setLocalToastMsg] = useState<string | null>(null);
  const triggerLocalToast = (msg: string) => {
    setLocalToastMsg(msg);
    setTimeout(() => setLocalToastMsg(null), 3000);
  };

  const {
    tableData,
    selectedCell,
    setSelectedCell,
    editingCell,
    setEditingCell,
    addRow,
    removeRow,
    updateCellData,
    isPickerOpen,
    pickerRowIndex,
    closePicker,
    updateRowLocation,
    toggleFavorite,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    showTagsOnly,
    spaceFilter,
    undoDelete,
    updateRowTags,
  } = useSpreadsheetStore();

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const dbTags = useDbStore(state => state.tags) || [];
  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbTags.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [dbTags]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  const filteredData = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase().trim();

    return tableData.filter((r): r is RowData | AutomationModuleRow => {
      if (r.type !== 'data' && r.type !== 'automationModule') return false;

      const hasTagMatch = Array.isArray((r as any).tagIds) && (r as any).tagIds.some((id: string) => {
        const tagName = tagNamesMap[id];
        return tagName && tagName.toLowerCase().includes(term);
      });

      const matchesSearch =
        !term ||
        String(r.name || '').toLowerCase().includes(term) ||
        String(r.url || '').toLowerCase().includes(term) ||
        (Array.isArray((r as any).urls) && (r as any).urls.some((u: any) => String(u || '').toLowerCase().includes(term))) ||
        String(r.value || '').toLowerCase().includes(term) ||
        String(r.path || '').toLowerCase().includes(term) ||
        String((r as any).folder || '').toLowerCase().includes(term) ||
        String(r.key || '').toLowerCase().includes(term) ||
        String((r as any).hotkey || '').toLowerCase().includes(term) ||
        String(r.command || '').toLowerCase().includes(term) ||
        String((r as any).shortcut || '').toLowerCase().includes(term) ||
        String((r as any).description || '').toLowerCase().includes(term) ||
        String((r as any).team_name || '').toLowerCase().includes(term) ||
        String((r as any).workspace_name || '').toLowerCase().includes(term) ||
        hasTagMatch ||
        (Array.isArray((r as any).tags) && (r as any).tags.some((t: any) => String(t || '').toLowerCase().includes(term))) ||
        (typeof (r as any).tags === 'string' && String((r as any).tags || '').toLowerCase().includes(term)) ||
        (r.category === 'module' && String((r as any).module_id || '').toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (!visibilityFilter.includes('all')) {
        const v = r.visibilityType || 'lock';
        const mappedV =
          v === 'lock' || v === 'personal'
            ? 'private'
            : v === 'globe'
              ? 'public'
              : v === 'users'
                ? 'shared'
                : 'private';
        if (!visibilityFilter.includes(mappedV)) return false;
      }

      if (!categoryFilter.includes('all')) {
        const cat = r.category || 'note';
        if (!categoryFilter.includes(cat)) return false;
      }

      if (showFavoritesOnly && !r.fav) return false;
      if (showHotkeysOnly && !r.key) return false;
      if (showShortcutsOnly && !r.command) return false;
      if (showTagsOnly && (!Array.isArray((r as any).tagIds) || (r as any).tagIds.length === 0)) return false;

      const columnFilterMatch = Object.entries(columnFilters).every(([colId, filterVal]) => {
        const cleanedFilter = filterVal.toLowerCase().trim();
        if (!cleanedFilter) return true;

        let val = '';
        if (colId === 'name') {
          const titleVal = String(r.name || (r as any).title || '');
          const descVal = getSpreadsheetDescriptionPreview(r);
          val = `${titleVal} ${descVal}`;
        } else if (colId === 'url') {
          const rawVal = r.url || r.value || '';
          if (typeof rawVal === 'object' && rawVal && 'urls' in rawVal) {
            val = Array.isArray((rawVal as any).urls) ? (rawVal as any).urls.join(' ') : '';
          } else {
            val = String(rawVal);
          }
        } else if (colId === 'folder' || colId === 'path') {
          val = String(r.path || '');
        } else if (colId === 'key') {
          val = String(r.key || '');
        } else if (colId === 'command') {
          val = String(r.command || '');
        } else if (colId === 'tags') {
          if (Array.isArray((r as any).tagIds)) {
            val = (r as any).tagIds.map((id: string) => tagNamesMap[id] || '').join(' ');
          } else if (Array.isArray((r as any).tags)) {
            val = (r as any).tags.join(' ');
          } else {
            val = String((r as any).tags || '');
          }
        }

        return val.toLowerCase().includes(cleanedFilter);
      });

      if (!columnFilterMatch) return false;

      return true;
    });
  }, [
    tableData,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    showTagsOnly,
    spaceFilter,
    tagNamesMap,
  ]);

  const columnVisibility = useMemo<Record<string, boolean>>(() => ({
    url: false,
  }), []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      columnSizing,
      sorting,
      columnVisibility,
    },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Synchronized Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useSpreadsheetStore.getState();
      const {
        selectedCell,
        setSelectedCell,
        editingCell,
        setEditingCell,
        isPickerOpen,
      } = state;

      const path = e.composedPath ? e.composedPath() : [];
      const target = (path.length > 0 ? path[0] : e.target) as HTMLElement;
      const isSearchInput = target.tagName === 'INPUT' && (target as HTMLInputElement).id?.startsWith('sheet-search-');

      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        const activeEditor = useUIStore.getState().activeEditor;
        if (activeEditor) return;

        const isEditing = editingCell !== null;
        if (isEditing) {
          e.preventDefault();
          e.stopPropagation();
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          return;
        }

        if (isPickerOpen) {
          e.preventDefault();
          e.stopPropagation();
          closePicker();
          return;
        }

        if (isSearchInput) {
          e.preventDefault();
          e.stopPropagation();
          onClose?.();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.defaultPrevented) return;

      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredData.length > 0) {
          setSelectedCell({ rowIndex: 0, colIndex: 0 });
        }
        const nameSearch = document.getElementById('sheet-search-name');
        if (nameSearch) {
          (nameSearch as HTMLInputElement).focus();
          (nameSearch as HTMLInputElement).select();
        }
        return;
      }

      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

      if (isSearchInput && !selectedCell && (e.key === 'ArrowDown' || e.key === 'Tab')) {
        if (filteredData.length > 0) {
          e.preventDefault();
          setSelectedCell({ rowIndex: 0, colIndex: 0 });
          return;
        }
      }

      if (!selectedCell || isPickerOpen) return;

      const { rowIndex, colIndex } = selectedCell;
      const visibleCols = table.getVisibleLeafColumns().length;
      const isEditing = editingCell !== null;

      if (
        !isSearchInput && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[data-ignore-grid-nav="true"]')
        )
      ) {
        return;
      }

      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key);
      if (isSearchInput && !isNavKey) return;

      const moveFocus = (rowDelta: number, colDelta: number) => {
        let nRow = rowIndex + rowDelta;
        let nCol = colIndex + colDelta;

        if (nCol >= visibleCols) {
          nCol = visibleCols - 1;
        } else if (nCol < 0) {
          nCol = 0;
        }

        if (nRow < 0) {
          nRow = 0;
        } else if (nRow >= filteredData.length) {
          nRow = filteredData.length - 1;
        }

        if (nRow >= 0 && nRow < filteredData.length) {
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
      };

      if (isArrowKey) {
        if (isEditing) return;
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        moveFocus(-1, 0);
        return;
      }
      if (e.key === 'ArrowDown') {
        moveFocus(1, 0);
        return;
      }
      if (e.key === 'ArrowLeft') {
        moveFocus(0, -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        moveFocus(0, 1);
        return;
      }

      if (e.key === 'Enter') {
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();

        const tableRow = table.getRowModel().rows[rowIndex];
        if (!tableRow) return;
        const r = tableRow.original as any;
        const visibleColumns = table.getVisibleLeafColumns();
        const targetColumn = visibleColumns[colIndex];
        if (!targetColumn) return;
        const colId = targetColumn.id;

        if (colId === 'actions') {
          return;
        }

        if (colId === 'name') {
          if (canOpenSpreadsheetRow(r)) {
            openSpreadsheetRow(r);
            return;
          }
          setEditingCell({ rowIndex, colIndex });
          return;
        }

        if (colId === 'tags') {
          if (isTagSupportedRow(r)) {
            setEditingCell({ rowIndex, colIndex });
          }
          return;
        }

        const isModule = r.category === 'module' || r.section === 'Installed Modules';
        const isAgent =
          ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(
            String(r.category || '').toLowerCase()
          ) || r.section === 'Chat Agents';
        const isBookmark =
          ['bookmark', 'bookmarks'].includes(String(r.category || '').toLowerCase()) ||
          r.section === 'Bookmarks';
        const isBrowserCommand =
          ['commands', 'general_commands', 'command'].includes(String(r.category || '').toLowerCase()) ||
          r.section === 'Browser Commands';

        const isCellBlocked =
          colId === 'name' ||
          (colId === 'url' && (isBookmark || isBrowserCommand));

        const isReadonlyCol = isModule
          ? colId === 'name' || colId === 'command'
          : colId === 'name' || colId === 'url' || colId === 'command';

        if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (colId === 'name' || colId === 'command')) && colId !== 'tags' && colId !== 'type' && colId !== 'rowNumber' && colId !== 'actions') {
          setEditingCell({ rowIndex, colIndex });
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (isEditing) setEditingCell(null);
        let nRow = rowIndex;
        let nCol = colIndex + (e.shiftKey ? -1 : 1);

        if (nCol >= visibleCols) {
          nCol = 0;
          nRow++;
        } else if (nCol < 0) {
          nCol = visibleCols - 1;
          nRow--;
        }

        if (nRow >= 0 && nRow < filteredData.length) {
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData, selectedCell, editingCell, setSelectedCell, setEditingCell, onClose, table]);

  return (
    <div className="flex flex-col items-center w-full relative">
      <AnimatePresence>
        {localToastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 z-[2147483647] px-4 py-2 bg-black/90 rounded border border-white/10 shadow-xl"
          >
            <span className="text-white text-xs font-medium">{localToastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full">
        <table className={clsx('w-full border-collapse table-fixed group/sidebar', 'bg-transparent')}>
          <colgroup>
            {table.getVisibleLeafColumns().map(column => (
              <col
                key={column.id}
                style={{ width: column.getSize() }}
              />
            ))}
          </colgroup>
          <SpreadsheetHeader
            table={table}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
          />
          <tbody className="bg-transparent">
            {filteredData.map((row, visualIndex) => {
              const tableRow = table.getRowModel().rows[visualIndex];
              if (!tableRow) return null;

              const isSelectedRow = selectedCell?.rowIndex === visualIndex;
              const previousTableRow = visualIndex > 0 ? table.getRowModel().rows[visualIndex - 1] : null;
              const startsNewTypeSection =
                previousTableRow !== null &&
                getTypeInfo(previousTableRow.original).tone !== getTypeInfo(tableRow.original).tone;

              return (
                <tr
                  key={tableRow.id || `row-${visualIndex}`}
                  data-row-index={visualIndex}
                  className={clsx(
                    'group/row grow h-auto min-h-[36px] transition-all duration-150',
                    'border-b border-[var(--color-borderDefault)] divide-x divide-[var(--color-borderDefault)]',
                    startsNewTypeSection && 'border-t-[36px] border-t-[var(--color-editorBg)]',
                    (tableRow.original as any).isDeleting
                      ? 'bg-red-900/20'
                      : isSelectedRow
                      ? 'bg-transparent text-[var(--color-textPrimary)] font-medium'
                      : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]',
                  )}>
                  {tableRow.getVisibleCells().map((cell, index) => {
                    const isSelected = selectedCell?.rowIndex === visualIndex && selectedCell?.colIndex === index;
                    const isEditing = editingCell?.rowIndex === visualIndex && editingCell?.colIndex === index;
                    const value = cell.getValue() as string;

                    return (
                      <td
                        key={cell.id}
                        data-cell-id={cell.id}
                        onClick={() => {
                          if (isEditing) return;
                          setSelectedCell({ rowIndex: visualIndex, colIndex: index });
                          if (isSelected && !isEditing) {
                            const r = tableRow.original as any;

                            if (cell.column.id === 'tags') {
                              if (isTagSupportedRow(r)) {
                                setEditingCell({ rowIndex: visualIndex, colIndex: index });
                              }
                              return;
                            }

                            if (cell.column.id === 'name') {
                              if (canOpenSpreadsheetRow(r)) {
                                openSpreadsheetRow(r);
                                return;
                              }
                              setEditingCell({ rowIndex: visualIndex, colIndex: index });
                              return;
                            }

                            const isModule = r.category === 'module' || r.section === 'Installed Modules';
                            const isAgent =
                              ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(
                                String(r.category || '').toLowerCase()
                              ) || r.section === 'Chat Agents';
                            const isBookmark =
                              ['bookmark', 'bookmarks'].includes(String(r.category || '').toLowerCase()) ||
                              r.section === 'Bookmarks';
                            const isBrowserCommand =
                              ['commands', 'general_commands', 'command'].includes(String(r.category || '').toLowerCase()) ||
                              r.section === 'Browser Commands';

                            const isCellBlocked =
                              cell.column.id === 'name' ||
                              (cell.column.id === 'url' && (isBookmark || isBrowserCommand));

                            const isReadonlyCol = isModule
                              ? cell.column.id === 'name' || cell.column.id === 'command'
                              : cell.column.id === 'name' || cell.column.id === 'url' || cell.column.id === 'command';

                            if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (cell.column.id === 'name' || cell.column.id === 'command')) && cell.column.id !== 'tags' && cell.column.id !== 'type' && cell.column.id !== 'rowNumber' && cell.column.id !== 'actions') {
                              setEditingCell({ rowIndex: visualIndex, colIndex: index });
                            }
                          }
                        }}
                        onDoubleClick={() => {
                          const r = tableRow.original as any;
                          if (cell.column.id === 'tags') {
                            if (isTagSupportedRow(r)) {
                              setEditingCell({ rowIndex: visualIndex, colIndex: index });
                            }
                          }
                        }}
                        className={clsx(
                          'text-[11px] cursor-pointer transition-all relative h-auto min-h-[36px]',
                          index === 0 && 'border-l border-[var(--color-borderDefault)]',
                          cell.column.id === 'rowNumber' || cell.column.id === 'actions'
                            ? 'p-0 text-center align-middle'
                            : cell.column.id === 'key' || cell.column.id === 'type'
                              ? 'px-1 py-1 align-middle'
                              : cell.column.id === 'url' && isSelected
                                ? 'px-[2px] py-1 align-middle'
                                : 'px-2 py-1 align-middle',
                          isSelected
                            ? 'text-[var(--color-textPrimary)] ring-1 ring-[var(--color-borderActive)] ring-inset rounded bg-transparent z-[50] overflow-visible py-[2px]'
                            : 'text-[var(--color-textPrimary)] py-[1.5px]',
                          (tableRow.original as any).isDeleting && (cell.column.id !== 'actions' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'),
                        )}
                        style={{ width: cell.column.getSize() }}>

                        {cell.column.id === 'rowNumber' ? (
                          <span className="text-[11px] font-mono font-medium text-[var(--color-textMuted)] flex justify-center items-center w-full select-none">
                            {visualIndex + 1}
                          </span>
                        ) : cell.column.id === 'type' ? (
                          <div className="flex items-center px-1">
                            {(() => {
                              const typeInfo = getTypeInfo(tableRow.original);
                              return (
                                <span
                                  className={clsx(
                                    'inline-flex items-center gap-1.5 text-[12px] font-normal leading-none shrink-0 select-none whitespace-nowrap opacity-80',
                                    typeInfo.foregroundClass,
                                  )}>
                                  {typeInfo.icon}
                                  <span>{typeInfo.label}</span>
                                </span>
                              );
                            })()}
                          </div>
                        ) : cell.column.id === 'actions' ? (
                          (tableRow.original as any).isDeleting ? (
                            <div className="flex items-center justify-center w-full h-full">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  undoDelete(tableRow.original.id);
                                }}
                                className="text-blue-400 hover:text-blue-300 text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20">
                                UNDO
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 w-full h-full min-h-[28px]">
                              {tableRow.original.section !== 'Bookmarks' && (
                                <button
                                  className="flex items-center justify-center w-7 h-7 rounded text-[var(--color-iconDefault)] hover:text-amber-400 transition-colors"
                                  onClick={e => {
                                    e.stopPropagation();
                                    toggleFavorite(tableRow.original.id as string);
                                  }}>
                                  {tableRow.original.syncStatus === 'syncing' ? (
                                    <FiLoader className="animate-spin text-xs" />
                                  ) : tableRow.original.fav ? (
                                    <FaStar className="text-amber-400 text-xs" />
                                  ) : (
                                    <FiStar className="text-xs" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  useSpreadsheetStore.getState().removeRow(tableRow.original.id);
                                }}
                                className={clsx(
                                  'flex items-center justify-center w-7 h-7 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-error)] transition-all opacity-70 hover:opacity-100',
                                )}>
                                <FiTrash size={14} />
                              </button>
                            </div>
                          )
                        ) : isEditing ? (
                          cell.column.id === 'key' ? (
                            <GridHotkeyInput
                              itemId={getItemCompoundId(tableRow.original)}
                              initialValue={value || ''}
                              onSave={(val: string) => {
                                updateCellData(tableRow.original.id, index, cell.column.id, val);
                                setEditingCell(null);
                              }}
                              onCancel={() => setEditingCell(null)}
                              onOverwrite={(val: string, conflictId?: string) => {
                                useSpreadsheetStore
                                  .getState()
                                  .overwriteCellData(
                                    tableRow.original.id,
                                    index,
                                    cell.column.id,
                                    val,
                                    conflictId || '',
                                  );
                                setEditingCell(null);
                              }}
                            />
                          ) : cell.column.id === 'tags' ? (
                            <SpreadsheetTagSelector
                              cellElement={document.querySelector(`[data-cell-id="${cell.id}"]`)}
                              initialTagIds={(tableRow.original as any).tagIds || []}
                              onSave={async (newTagIds) => {
                                await updateRowTags(tableRow.original.id, newTagIds);
                                setEditingCell(null);
                              }}
                              onCancel={() => setEditingCell(null)}
                            />
                          ) : cell.column.id === 'command' ? (
                            <GridCommandInput
                              itemId={getItemCompoundId(tableRow.original)}
                              initialValue={value || ''}
                              onSave={(val: string) => {
                                updateCellData(tableRow.original.id, index, cell.column.id, val);
                                setEditingCell(null);
                              }}
                              onCancel={() => setEditingCell(null)}
                              onOverwrite={(val: string, conflictId?: string) => {
                                useSpreadsheetStore
                                  .getState()
                                  .overwriteCellData(
                                    tableRow.original.id,
                                    index,
                                    cell.column.id,
                                    val,
                                    conflictId || '',
                                  );
                                setEditingCell(null);
                              }}
                            />
                          ) : cell.column.id === 'url' ? (
                            (() => {
                              const isAutomation =
                                !!tableRow.original.automationData ||
                                tableRow.original.section === 'My Saved Automations' ||
                                tableRow.original.section === 'Chat Agents' ||
                                ['automation', 'automations'].includes(String(tableRow.original.category || '').toLowerCase()) ||
                                ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(String(tableRow.original.category || '').toLowerCase()) ||
                                (tableRow.original.itemType === 'agent' && !!tableRow.original.automationData);

                              if (isAutomation) {
                                const steps =
                                  tableRow.original.automationData?.steps ||
                                  tableRow.original.automationData?.automation_steps ||
                                  tableRow.original.automationData?.execution_steps ||
                                  [];

                                const getStepName = (mId: any) => {
                                  const id = String(mId || '');
                                  switch (id) {
                                    case 'open_tab':
                                    case 'open_url':
                                      return 'Open Link';
                                    case 'paste':
                                    case 'insert_text':
                                      return 'Fill Input';
                                    case 'wait':
                                    case 'wait_duration':
                                    case 'wait_for_navigation':
                                    case 'wait_for_element':
                                      return 'Wait';
                                    case 'clipboard_write':
                                      return 'Write Clipboard';
                                    case 'clipboard_paste':
                                      return 'Paste Clipboard';
                                    case 'agent':
                                      return 'Agent Step';
                                    case 'sub_automation':
                                      return 'Sub-Automation';
                                    default:
                                      return null;
                                  }
                                };

                                const stepNames = steps
                                  .map((s: any) => getStepName(s.moduleId || s.module_id || s.action))
                                  .filter(Boolean);

                                const visibleSteps = stepNames.slice(0, 25).join(', ');
                                const moreCount = stepNames.length - 25;

                                return (
                                  <div className="flex items-center w-full text-[10px] overflow-hidden font-normal text-neutral-400">
                                    <span className="truncate flex-1">{visibleSteps || "No steps set"}</span>
                                    {moreCount > 0 && (
                                      <span className="ml-1 text-[9px] font-normal shrink-0 px-1.5 rounded whitespace-nowrap text-neutral-400 bg-neutral-800">
                                        +{moreCount} more
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              const isSnippetOrNote =
                                tableRow.original.section === 'Notes' ||
                                tableRow.original.section === 'Snippets' ||
                                tableRow.original.itemType === 'note' ||
                                tableRow.original.itemType === 'snippet' ||
                                tableRow.original.category === 'note' ||
                                tableRow.original.category === 'snippet' ||
                                tableRow.original.category === 'text_expander' ||
                                String(tableRow.original.section || '').toLowerCase().includes('text expander');

                              if (isSnippetOrNote) {
                                return (
                                  <BufferedCellInput
                                    initialValue={extractPlainTextFromSnippetConfig(tableRow.original.value || (tableRow.original as any).description)}
                                    placeholder="Enter description"
                                    isReal={!!tableRow.original.isReal}
                                    onSave={val => {
                                      updateCellData(
                                        tableRow.original.id,
                                        index,
                                        cell.column.id,
                                        val,
                                      );
                                      setEditingCell(null);
                                    }}
                                    onCancel={() => setEditingCell(null)}
                                  />
                                );
                              }

                              return (
                                <SpreadsheetMultiLinkInput
                                  initialUrls={tableRow.original.urls || []}
                                  onSave={(val: string) => {
                                    updateCellData(
                                      tableRow.original.id,
                                      index,
                                      cell.column.id,
                                      val,
                                    );
                                    setEditingCell(null);
                                  }}
                                  onCancel={() => setEditingCell(null)}
                                />
                              );
                            })()
                          ) : (
                            <BufferedCellInput
                              initialValue={value || ''}
                              placeholder="Enter title"
                              isReal={!!tableRow.original.isReal}
                              onSave={val => {
                                updateCellData(tableRow.original.id, index, cell.column.id, val);
                                setEditingCell(null);
                              }}
                              onCancel={() => setEditingCell(null)}
                            />
                          )
                        ) : (
                          <div className={clsx('max-w-full flex items-center gap-2', 'truncate whitespace-nowrap')}>
                            {(cell.column.id === 'folder' || cell.column.id === 'folder_id') ? (
                              <div className="flex items-center justify-between gap-1 w-full h-full px-1 overflow-hidden">
                                {tableRow.original.path ? (
                                  <div className="truncate flex-1 min-w-0 text-[var(--color-textPrimary)]">
                                    <span className="truncate whitespace-nowrap">
                                      {tableRow.original.plainPath || tableRow.original.path}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-blue-400/70 font-normal italic text-[10px] pl-1 transition-colors flex items-center gap-1">
                                    + Workspace
                                  </span>
                                )}
                                {isPickerOpen && pickerRowIndex === visualIndex && (
                                  <div
                                    className={clsx(
                                      'absolute right-1 z-[9999] w-[320px] min-w-[320px] transform transition-all animate-in fade-in zoom-in duration-150',
                                      visualIndex > filteredData.length * 0.7 ? 'bottom-full mb-2' : 'top-full mt-2',
                                    )}
                                    onClick={e => e.stopPropagation()}>
                                    <DestinationPicker
                                      className="!w-[320px] !min-w-[320px]"
                                      selectedWorkspaceId={tableRow.original.workspace_id}
                                      selectedFolderId={tableRow.original.folder_id ?? null}
                                      onSelectWorkspace={(workspaceId: string) => {
                                        updateRowLocation(
                                          tableRow.original.id,
                                          workspaceId,
                                          null
                                        );
                                      }}
                                      onSelectFolder={(workspaceId: string, folderId: string) => {
                                        updateRowLocation(
                                          tableRow.original.id,
                                          workspaceId,
                                          folderId
                                        );
                                      }}
                                      onClose={closePicker}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : cell.column.id === 'name' ? (
                              <div className="grid grid-cols-[176px_32px_minmax(0,1fr)] items-center gap-1.5 w-full max-w-full min-w-0 py-1 h-full select-none overflow-hidden">
                                {/* Track 1: Item icon and Title */}
                                <div className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-1.5 min-w-0 w-full overflow-hidden">
                                  <div className="w-6 min-w-6 flex items-center justify-center overflow-hidden">
                                    {(() => {
                                      const rowItem = tableRow.original;
                                      const cat = String(rowItem.category || '').toLowerCase();
                                      const sec = String(rowItem.section || '').toLowerCase();
                                      const itemType = String(rowItem.itemType || '').toLowerCase();

                                      const isCommand =
                                        ['commands', 'general_commands', 'command'].includes(cat) ||
                                        sec.includes('browser command') ||
                                        sec.includes('system command') ||
                                        itemType === 'command';

                                      const isLink =
                                        !isCommand && (itemType === 'link' || itemType === 'session' || ['bookmark', 'bookmarks'].includes(cat));

                                      return (
                                        <>
                                          {isLink && (
                                            <StackedLinkIcon
                                              urls={rowItem.urls || []}
                                              size={14}
                                              fallback={
                                                ['bookmark', 'bookmarks'].includes(cat)
                                                  ? 'link'
                                                  : ['tabgroup', 'session', 'sessions', 'tab session'].includes(cat)
                                                    ? 'tabgroup'
                                                    : 'link'
                                              }
                                              maxIcons={3}
                                            />
                                          )}
                                          {itemType === 'note' && (
                                            <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                          )}
                                          {itemType === 'snippet' && (
                                            <FaCode size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                          )}
                                          {(itemType === 'todo' || sec.includes('todo') || cat === 'todo') && (
                                            <BsCalendarCheck size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                          )}
                                          {isCommand && (
                                            (typeof rowItem.icon_host === 'string' && rowItem.icon_host) ? (
                                              <img
                                                src={getFaviconUrl(rowItem.icon_host)}
                                                alt=""
                                                className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"
                                              />
                                            ) : (
                                              <FaTerminal size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                            )
                                          )}
                                          {!isCommand && (
                                            (
                                              itemType === 'agent' ||
                                              sec.includes('chat agent') ||
                                              ['chatagent', 'chat_agent', 'agent'].includes(cat)
                                            ) ? (
                                              <LuSparkles size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                            ) : (
                                              ['aiprompt', 'ai_prompt', 'prompt'].includes(cat) ||
                                              cat === 'module'
                                            ) ? (
                                              (typeof rowItem.icon_host === 'string' && rowItem.icon_host) ? (
                                                <img
                                                  src={getFaviconUrl(rowItem.icon_host)}
                                                  alt=""
                                                  className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"
                                                />
                                              ) : (!isLink) ? (
                                                <AutomationDynamicIcon
                                                  automation={rowItem.automationData}
                                                  size={14}
                                                  className="shrink-0"
                                                />
                                              ) : null
                                            ) : null
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  <span className="font-medium text-[var(--color-textPrimary)] truncate min-w-0">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </span>
                                </div>

                                {/* Track 2: Dedicated opener-icon slot */}
                                <div className="flex shrink-0 w-8 h-full items-center justify-center">
                                  {hasExternalOpenerIcon(tableRow.original) ? (
                                    <button
                                      type="button"
                                      onClick={e => {
                                        e.stopPropagation();
                                        openSpreadsheetRowInNewTab(tableRow.original);
                                      }}
                                      title="Open in new tab"
                                      aria-label="Open in new tab"
                                      className="shrink-0 p-0.5 rounded hover:bg-[var(--color-hoverBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] transition-colors focus:outline-none">
                                      <FiExternalLink size={13} className="shrink-0" />
                                    </button>
                                  ) : null}
                                </div>

                                {/* Track 3: Description preview */}
                                <div className="min-w-0 w-full overflow-hidden flex items-center">
                                  {(() => {
                                    const descPreview = getSpreadsheetDescriptionPreview(tableRow.original);
                                    if (!descPreview) return null;
                                    return (
                                      <span className="text-[11px] font-normal text-[var(--color-textSecondary)] truncate min-w-0 whitespace-nowrap">
                                        {descPreview}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : cell.column.id === 'tags' ? (
                              (() => {
                                const row = tableRow.original as any;
                                const tagIds = row.tagIds || [];
                                if (tagIds.length === 0) return null;

                                return (
                                  <div className="truncate flex-1 min-w-0 text-[var(--color-textSecondary)] text-[11px] font-normal px-1">
                                    {tagIds.map((tid: string) => tagNamesMap[tid] || tid).join(', ')}
                                  </div>
                                );
                              })()
                            ) : cell.column.id === 'key' ? (
                              <div className="flex justify-center w-full opacity-70">
                                {value && <VisualKeyDisplay hotkey={value} variant="text" />}
                              </div>
                            ) : cell.column.id === 'command' ? (
                              <div className="flex items-center w-full px-1">
                                <span
                                  className="text-[11px] font-normal text-[var(--color-textSecondary)] whitespace-nowrap"
                                  title={value ? `c_${String(value)}` : undefined}>
                                  {value ? `c_${String(value)}` : ''}
                                </span>
                              </div>
                            ) : cell.column.id === 'url' ? (
                              (() => {
                                const row = tableRow.original as any;
                                const isSnippetOrNote =
                                  row.section === 'Notes' ||
                                  row.section === 'Snippets' ||
                                  row.itemType === 'note' ||
                                  row.itemType === 'snippet' ||
                                  row.category === 'note' ||
                                  row.category === 'snippet' ||
                                  row.category === 'text_expander' ||
                                  String(row.section || '').toLowerCase().includes('text expander');

                                if (isSnippetOrNote) {
                                  const textPreview = extractPlainTextFromSnippetConfig(row.value || row.description);
                                  return (
                                    <div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-[var(--color-textSecondary)]">
                                      {textPreview}
                                    </div>
                                  );
                                }

                                const isSession =
                                  row.itemType === 'session' ||
                                  row.category === 'session' ||
                                  ['session', 'sessions', 'tab session', 'collection'].includes(String(row.category || '').toLowerCase()) ||
                                  String(row.section || '').toLowerCase().includes('tab session') ||
                                  String(row.section || '').toLowerCase().includes('collection');

                                let urls: string[] = Array.isArray(row.urls) ? row.urls : [];
                                if (urls.length === 0 && (row.value || row.url)) {
                                  const rawVal = row.value || row.url;
                                  try {
                                    if (typeof rawVal === 'string' && (rawVal.startsWith('{') || rawVal.startsWith('['))) {
                                      const parsed = JSON.parse(rawVal);
                                      if (Array.isArray(parsed.urls)) urls = parsed.urls;
                                    } else if (typeof rawVal === 'object' && Array.isArray(rawVal.urls)) {
                                      urls = rawVal.urls;
                                    } else if (typeof rawVal === 'string' && rawVal.trim() && !isSession) {
                                      urls = [rawVal.trim()];
                                    }
                                  } catch {
                                    // ignore
                                  }
                                }

                                if (urls.length === 0) {
                                  return (
                                    <div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-[var(--color-textMuted)] italic">
                                      {isSession ? 'No tabs added' : 'No links added'}
                                    </div>
                                  );
                                }

                                const domains = urls.map((u: string) => {
                                  try {
                                    const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                    return hostname.replace('www.', '');
                                  } catch {
                                    return u;
                                  }
                                });

                                const topThree = domains.slice(0, 3).join(', ');

                                return (
                                  <div className="group/url flex items-center w-full text-[10px] overflow-hidden font-normal relative h-full text-[var(--color-textPrimary)]">
                                    <span className="truncate flex-1">{topThree}</span>
                                  </div>
                                );
                              })()
                            ) : (
                              flexRender(cell.column.columnDef.cell, cell.getContext())
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpreadsheetTable;
