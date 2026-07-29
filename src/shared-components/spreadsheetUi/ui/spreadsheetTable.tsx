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
import SpreadsheetHeader from './spreadsheetHeader';
import { clsx } from 'clsx';

import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
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
  FaRobot,
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
  FiFolder,
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


// Helper to resolve icon strings to emojis
const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
  if (!iconStr) return defaultEmoji;
  if (iconStr.startsWith('U+')) {
    try {
      return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
    } catch (e) {
      return defaultEmoji;
    }
  }
  return defaultEmoji;
};

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
  const folder = folderId ? dbState.getFolderById(folderId) : null;

  if (!workspace) return null;
  if (folder && folder.workspaceId !== workspace.id) return null;

  const wsIcon = workspace.workspaceName.includes('Personal Space') ? 'P' : getSingleInitial(workspace.workspaceName);
  const wsPath = `${wsIcon} ${workspace.workspaceName}`;
  const isPersonalSpace = workspace.workspaceName === 'Personal Space' || workspace.workspaceName.includes('Personal Space');

  let path = wsPath;
  let folderName: string | null = null;
  let visibilityType: 'lock' | 'globe' | 'users' | 'personal' = isPersonalSpace ? 'personal' : 'lock';

  if (folder) {
    folderName = folder.folderName;
    path = `${wsPath} / ${folder.folderName}`;
  }

  return {
    workspace,
    workspace_id: workspace.id,
    folder_id: folder?.id || null,
    folder: folderName || workspace.workspaceName,
    path,
    plainPath: path,
    visibilityType,
  };
};

// Helper component for Buffered Editing (Save on Enter, Discard on Escape)
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
  isEmbedded,
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
    collapsedSections,
    toggleSection,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    setShowShortcutsOnly,
    targetSection,
    setTargetSection,
    setQuickAddModal,
    spaceFilter,
    expandedEmptySections,
    toggleEmptySections,
    expandedCategories,
    toggleCategory,
    undoDelete,
    isCompactMode,
  } = useSpreadsheetStore();

    
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const dbTags = useDbStore(state => state.tags) || [];
  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    dbTags.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [dbTags]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [commandFilterOpen, setCommandFilterOpen] = useState(false);

  const [omniboxPrefixes, setOmniboxPrefixes] = useState<any>(null);

  React.useEffect(() => {
    const loadPrefixes = () => {
      CustomSearchPrefixesForOmniboxStorage.getPrefixes().then(prefixes => {
        setOmniboxPrefixes(prefixes);
      }).catch(console.error);
    };
    
    loadPrefixes();
    window.addEventListener('omniboxPrefixesChanged', loadPrefixes);
    
    return () => {
      window.removeEventListener('omniboxPrefixesChanged', loadPrefixes);
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside = () => setCommandFilterOpen(false);
    if (commandFilterOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [commandFilterOpen]);

  const filteredData = useMemo(() => {
    const sections: { title: string; rows: GridRow[] }[] = [];
    let current: { title: string; rows: GridRow[] } | null = null;

    const hasColumnFilters = Object.values(columnFilters).some(v => v.trim() !== '');
    const isGlobalFilterActive =
      showFavoritesOnly ||
      showHotkeysOnly ||
      showShortcutsOnly ||
      hasColumnFilters ||
      searchTerm.trim() !== '' ||
      !categoryFilter.includes('all') ||
      !visibilityFilter.includes('all') ||
      !spaceFilter.includes('all');

    const filterRow = (r: GridRow) => {
      if (r.type === 'data' || r.type === 'automationModule') {
        const term = String(searchTerm || '')
          .toLowerCase()
          .trim();

        // 1. Search term match
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

        // 3. Visibility filters
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

        // 4. Category filters
        if (!categoryFilter.includes('all')) {
          if (!categoryFilter.includes(r.category || 'note')) return false;
        }

        // 5. Global Rail Filters
        if (showFavoritesOnly && !r.fav) return false;
        if (showHotkeysOnly && !r.key) return false;
        if (showShortcutsOnly && !r.command) return false;

        // 6. Custom Column Filters
        const columnFilterMatch = Object.entries(columnFilters).every(([colId, filterVal]) => {
          const cleanedFilter = filterVal.toLowerCase().trim();
          if (!cleanedFilter) return true;

          let val = '';
          if (colId === 'name') {
            val = String(r.name || '');
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
      }

      if (r.type === 'automationCategory') {
        // Only show category if its category type (module) is allowed
        if (!categoryFilter.includes('all') && !categoryFilter.includes('module')) return false;
        // The actual visibility of category depends on if it has children, which we handle in the second pass
        return true;
      }

      return false;
    };

    // First pass: Group and filter
    tableData.forEach(row => {
      if (row.type === 'section') {
        current = { title: row.title, rows: [] };
        sections.push(current);
      } else if (current && filterRow(row)) {
        current.rows.push(row);
      }
    });

    // Reorder: Active sections first, empty sections last
    const nonEmptySections = sections.filter(s => s.rows.length > 0);
    const emptySections = sections.filter(s => s.rows.length === 0);

    const sortedSections: typeof sections = [];
    sortedSections.push(...nonEmptySections);

    const isCategorySelected = (title: string) => {
      if (categoryFilter.includes('all')) return false;
      const lower = title.toLowerCase();
      if (lower.includes('note') && categoryFilter.includes('note')) return true;
      if (lower.includes('link') && categoryFilter.includes('link')) return true;
      if (lower.includes('snippet') && categoryFilter.includes('snippet')) return true;
      if (lower.includes('todo') && categoryFilter.includes('todo')) return true;
      if (lower.includes('automation') && categoryFilter.includes('automation')) return true;
      if (lower.includes('agent') && categoryFilter.includes('agent')) return true;
      if (lower.includes('session') && categoryFilter.includes('session')) return true;
      if (lower.includes('browser commands') && categoryFilter.includes('commands')) return true;
      if ((title === 'System Commands' || title === 'Commands') && categoryFilter.includes('general_commands')) return true;
      return false;
    };

    if (isGlobalFilterActive) {
      if (!categoryFilter.includes('all')) {
        const explicitlySelectedEmptySections = emptySections.filter(s => isCategorySelected(s.title));
        sortedSections.push(...explicitlySelectedEmptySections);
      }
    } else if (expandedEmptySections) {
      sortedSections.push(...emptySections);
    }

    // Final pass: Flatten and handle expanded categories
    const result: GridRow[] = [];

    sortedSections.forEach(s => {
      // If filtering is active, hide empty sections entirely UNLESS they are explicitly selected categories
      if (isGlobalFilterActive && s.rows.length === 0) {
        if (!isCategorySelected(s.title)) {
          return;
        }
      }

      // Special check for automation categories: only show them if they have visible children or if no filter is active
      const processedRows: GridRow[] = [];
      processedRows.push(...s.rows);

      // If after processing categories, we have no rows left in this section and filter is active, skip section UNLESS explicitly selected
      if (isGlobalFilterActive && processedRows.length === 0) {
        if (!isCategorySelected(s.title)) {
          return;
        }
      }

      result.push({ type: 'section', title: s.title, count: processedRows.length } as GridRow);

      if (!collapsedSections.includes(s.title)) {
        processedRows.forEach(row => {
          if (row.type === 'automationModule') {
            if (expandedCategories.includes(row.parentId)) {
              result.push(row);
            }
          } else {
            result.push(row);
          }
        });
      }
    });

    if (targetSection) {
      result.push({ type: 'section', title: targetSection, count: 0 } as GridRow);
    }

    // If not expanded and not filtering, add the toggle row at the very end
    if (!expandedEmptySections && !isGlobalFilterActive && emptySections.length > 0) {
      result.push({ type: 'emptySectionsToggle', count: emptySections.length });
    }

    return result;
  }, [
    tableData,
    categoryFilter,
    visibilityFilter,
    searchTerm,
    columnFilters,
    collapsedSections,
    showFavoritesOnly,
    showHotkeysOnly,
    showShortcutsOnly,
    spaceFilter,
    targetSection,
    expandedCategories,
    expandedEmptySections,
    tagNamesMap,
  ]);

  // Use filtered data for navigation sync
  const dataRows = useMemo(
    () =>
      filteredData.filter(
        (r): r is RowData | AutomationModuleRow => r.type === 'data' || r.type === 'automationModule',
      ),
    [filteredData],
  );

  // 🚀 Keep selection in sync when filteredData changes (e.g. section collapse)
  const lastSelectedRowIdRef = React.useRef<string | null>(null);

  // Update the ref whenever selection or data changes
  React.useEffect(() => {
    if (selectedCell !== null) {
      if (selectedCell.rowIndex === -1) {
        lastSelectedRowIdRef.current = `header-col-${selectedCell.colIndex}`;
      } else {
        const row = filteredData[selectedCell.rowIndex];
        if (row) {
          if (row.type === 'section') {
            lastSelectedRowIdRef.current = `section-${row.title}`;
          } else {
            lastSelectedRowIdRef.current = (row as any).id || (row as any).name || (row as any).command || null;
          }
        }
      }
    }
  }, [selectedCell, filteredData]);

  // Sync rowIndex if the row moved or handle if it's gone
  React.useEffect(() => {
    if (lastSelectedRowIdRef.current && selectedCell !== null) {
      const targetId = lastSelectedRowIdRef.current;
      const currentIndex = filteredData.findIndex(r => {
        if (r.type === 'section') return `section-${r.title}` === targetId;
        const rId = (r as any).id || (r as any).name || (r as any).command;
        return rId === targetId;
      });

      // Special handling for header col persistence
      if (targetId.startsWith('header-col-')) {
        const colIdx = parseInt(targetId.replace('header-col-', ''), 10);
        if (selectedCell.rowIndex !== -1 || selectedCell.colIndex !== colIdx) {
          setSelectedCell({ rowIndex: -1, colIndex: colIdx });
        }
        return;
      }

      if (currentIndex !== -1 && currentIndex !== selectedCell.rowIndex) {
        // Selection shifted (e.g. a section above was collapsed/expanded)
        setSelectedCell({ ...selectedCell, rowIndex: currentIndex });
      } else if (currentIndex === -1) {
        // Selected row is no longer in filteredData (e.g. its section was collapsed)
        // Clear selection to prevent jumping to a different row that now has the same index
        setSelectedCell(null);
      }
    }
  }, [filteredData]);

  // Determine the active section (hovered or selected)
  const activeSectionTitle = useMemo(() => {
    if (hoveredSection) return hoveredSection;
    if (selectedCell !== null) {
      const row = filteredData[selectedCell.rowIndex];
      if (row) {
        return (row as any).title || (row as any).section;
      }
    }
    return null;
  }, [hoveredSection, selectedCell, filteredData]);

  const columnVisibility = useMemo<Record<string, boolean>>(() => {
    if (isCompactMode) {
      return {
        folder: false,
        key: false,
        fav: false,
        id: false,
      };
    }
    return {} as Record<string, boolean>;
  }, [isCompactMode]);

  const table = useReactTable({
    data: dataRows,
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

  const visibleTotalSize = useMemo(() => {
    return table.getVisibleLeafColumns().reduce((acc, col) => acc + col.getSize(), 0);
  }, [table.getVisibleLeafColumns()]);

  // 🚀 Auto-scroll selection into view
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (selectedCell !== null) {
      // Small timeout to ensure DOM elements with data-row-index are rendered
      timer = setTimeout(() => {
        const rowElement = document.querySelector(`[data-row-index="${selectedCell.rowIndex}"]`);
        if (rowElement) {
          rowElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [selectedCell?.rowIndex]);

  // 🚀 Asynchronous navigation to target section (Deep Linking)
  React.useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    if (targetSection && filteredData.length > 0) {
      const index = filteredData.findIndex(r => r.type === 'section' && r.title === targetSection);
      if (index !== -1) {
        // We set to null briefly to ensure selecting the same index re-triggers scroll
        setSelectedCell(null);
        timer = setTimeout(() => {
          setSelectedCell({ rowIndex: index, colIndex: 0 });
          setTargetSection(null);
        }, 100);
      } else {
        setTargetSection(null);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [filteredData, targetSection, setSelectedCell, setTargetSection]);

  // 🚀 Auto-select first row (usually section header) when data loads or search updates
  React.useEffect(() => {
    if (selectedCell === null && filteredData.length > 0) {
      setSelectedCell({ rowIndex: 0, colIndex: 0 });
      setTimeout(() => {
        const container = document.getElementById('sheet-ui-container');
        if (container) {
          container.focus();
        }
      }, 50);
    }
  }, [filteredData, selectedCell, setSelectedCell]);

  // 🚀 Synchronized Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useSpreadsheetStore.getState();
      const {
        selectedCell,
        setSelectedCell,
        editingCell,
        setEditingCell,
        columnCount,
        addRow,
        openPicker,
        isPickerOpen,
      } = state;

      const path = e.composedPath ? e.composedPath() : [];
      const target = (path.length > 0 ? path[0] : e.target) as HTMLElement;
      const isSearchInput = target.tagName === 'INPUT' && (target as HTMLInputElement).id?.startsWith('sheet-search-');

      // 🚀 1. ESCAPE -> Cancel edit mode OR Close Sheet
      // Handle this at the very top to ensure it's never blocked
      if (e.key === 'Escape') {
        if (e.defaultPrevented) {
          return;
        }
        // If an editor (note/link/snippet/todo/session) is active,
        // let the global uiStateManager escape chain handle it — do NOT close the sheet.
        const activeEditor = useUIStore.getState().activeEditor;
        if (activeEditor) {
          return;
        }

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

        // If nothing else is active, close the sheet
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        return;
      }


      if (e.defaultPrevented) return;

      // 🚀 2. Alt + A -> Focus first data row AND Name Search
      // Handle this early so it works even if no cell is selected
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();

        const firstDataIndex = filteredData.findIndex(r => r.type === 'data' || r.type === 'automationModule');

        if (firstDataIndex !== -1) {
          setSelectedCell({ rowIndex: firstDataIndex, colIndex: 0 });
        }
        const nameSearch = document.getElementById('sheet-search-name');
        if (nameSearch) {
          (nameSearch as HTMLInputElement).focus();
          (nameSearch as HTMLInputElement).select();
        }
        return;
      }

      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

      // 🚀 3. Handle initial navigation from Search Bar if nothing is selected
      if (isSearchInput && !selectedCell && (e.key === 'ArrowDown' || e.key === 'Tab')) {
        if (filteredData.length > 0) {
          e.preventDefault();
          setSelectedCell({ rowIndex: 0, colIndex: 0 });
          return;
        }
      }

      if (!selectedCell || isPickerOpen) return;

      const { rowIndex, colIndex } = selectedCell;
      const columnId = table.getVisibleLeafColumns()[colIndex]?.id;
      const isEditing = editingCell !== null;

      const currentRow = filteredData[rowIndex];
      if (!currentRow) return;

      // 🚀 2. Restrict non-navigation keys when focused in an input (except search)
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

      // If it IS a search input, only allow specific navigation keys to pass through
      const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key);
      if (isSearchInput && !isNavKey) {
        return;
      }

      // 🚀 ESCAPE -> Cancel edit mode OR Close Sheet
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
        } else if (isSearchInput) {
          (target as HTMLInputElement).blur();
        } else {
          onClose?.();
        }
        return;
      }

      // Standard spreadsheet: arrows move cursor in input.
      if (isEditing && e.key !== 'Enter' && e.key !== 'Tab') {
        return;
      }

      // 🚀 ENTER -> Edit, Add Row, Open Picker, or Toggle Favorite
      if (e.key === 'Enter') {
        e.preventDefault();

        const isBookmark = (currentRow as any).category === 'bookmark';
        const isCommand = (currentRow as any).category === 'commands' || (currentRow as any).category === 'general_commands';

        if (isBookmark) {
          if (columnId === 'id') {
            useSpreadsheetStore.getState().removeRow((currentRow as any).id);
            return;
          }
          const dataRow = currentRow as RowData;
          if (dataRow.url) {
            window.open(dataRow.url, '_blank');
          }
          return;
        }

        if (isCommand) {
          if (!isEditing) {
            setEditingCell(selectedCell);
          } else {
            setEditingCell(null);
            const mainSearch = document.getElementById('sheet-search-name');
            if (mainSearch) mainSearch.focus();
          }
          return;
        }

        // 0. If on Folder column -> Trigger Picker
        if ((columnId === 'folder' || columnId === 'folder_id') && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isBookmark =
            (currentRow as any).category === 'bookmark' || (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands' ||
            (currentRow as any).section === 'Browser Commands';
          const isInstalledModule =
            (currentRow as any).category === 'module' || (currentRow as any).section === 'Installed Modules';

          if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
            openPicker(currentRow.id);
          }
          return;
        }

        // 1. If on Favorite column -> Toggle Favorite
        if (columnId === 'fav' && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          state.toggleFavorite(currentRow.id);
          return;
        }

        // 2. If on an "Add Row" button
        if (currentRow?.type === 'add_row') {
          addRow(currentRow.section);
          setEditingCell({ rowIndex: rowIndex, colIndex: 0 });
          return;
        }

        if (currentRow?.type === 'section') {
          toggleSection(currentRow.title);
          return;
        }
        if (currentRow?.type === 'automationCategory') {
          toggleCategory(currentRow.id);
          return;
        }
        if (currentRow?.type === 'emptySectionsToggle') {
          toggleEmptySections();
          return;
        }

        // 4. If on Delete column -> Remove Row
        if (columnId === 'id' && (currentRow?.type === 'data' || currentRow?.type === 'automationModule')) {
          const isSpecial =
            (currentRow as any).category === 'commands' ||
            (currentRow as any).category === 'general_commands';

          if (!isSpecial) {
            useSpreadsheetStore.getState().removeRow(currentRow.id);
          }
          return;
        }

        // 5. Default Enter behavior
        if (!isEditing) {
          if (columnId === 'name') {
            const isNote = currentRow.itemType === 'note' && (currentRow as any).section !== 'Snippets';
            const isSnippet = (currentRow as any).section === 'Snippets' || currentRow.itemType === 'snippet';
            const isLink = (currentRow as any).section === 'Smart Links' || currentRow.itemType === 'link';
            
            if (isNote) {
              useUIStore.getState().openEditor({ 
                type: 'note', 
                id: currentRow.id, 
                props: { category: 'note', isOverlay: true, editMode: true, snippet: currentRow } 
              });
              return;
            }
            if (isSnippet) {
              useUIStore.getState().openEditor({ 
                type: 'note', 
                id: currentRow.id, 
                props: { category: 'snippet', isOverlay: true, editMode: true, snippet: currentRow } 
              });
              return;
            }
            if (isLink) {
              useUIStore.getState().openEditor({ 
                type: 'link', 
                id: currentRow.id, 
                props: { category: 'link', isOverlay: true, editMode: true, snippet: currentRow } 
              });
              return;
            }
            const isTodo = (currentRow as any).section === 'Todos' || currentRow.itemType === 'todo' || (currentRow as any).category === 'todo';
            if (isTodo) {
              const prefill = {
                todo_id: currentRow.id,
                snippet_id: currentRow.id,
                is_todo_type: true,
                key: currentRow.name || '',
                title: currentRow.name || '',
                value: currentRow.value || '',
                shortcut: currentRow.command || '',
                tags: (currentRow as any).tagIds || (currentRow as any).tags || [],
              };
              useUIStore.getState().setTodoCreatePrefill(prefill);
              useUIStore.getState().openEditor({ 
                type: 'todo', 
                id: currentRow.id, 
                props: { category: 'todo', isOverlay: true, editMode: true, snippet: currentRow, prefill } 
              });
              return;
            }

            triggerLocalToast('Currently it is not supported');
            return;
          }

          const isAgent =
            ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(
              String((currentRow as any).category || '').toLowerCase()
            ) || (currentRow as any).section === 'Chat Agents';
          const isBookmark =
            ['bookmark', 'bookmarks'].includes(String((currentRow as any).category || '').toLowerCase()) ||
            (currentRow as any).section === 'Bookmarks';
          const isBrowserCommand =
            ['commands', 'general_commands', 'command'].includes(String((currentRow as any).category || '').toLowerCase()) ||
            (currentRow as any).section === 'Browser Commands';
          const isAutomation =
            ['automation', 'automations'].includes(String((currentRow as any).category || '').toLowerCase()) ||
            currentRow?.section === 'My Saved Automations' ||
            currentRow?.section === 'Automation Store' ||
            (currentRow as any).type === 'automationModule';

          const isCellBlocked =
            columnId === 'name' ||
            (columnId === 'url' && (isBookmark || isBrowserCommand)) ||
            isAutomation;

          if (!isCellBlocked && !(isAgent && (columnId === 'name' || columnId === 'command' || columnId === 'id')) && columnId !== 'tags') {
            setEditingCell(selectedCell);
          }
        } else if (isEditing) {
          setEditingCell(null);
          const mainSearch = document.getElementById('sheet-search-name');
          if (mainSearch) mainSearch.focus();
          const nextRow = rowIndex + 1;
          // In filtered data, if it exists, it is navigable
          if (nextRow < filteredData.length) {
            setSelectedCell({ rowIndex: nextRow, colIndex });
          }
        }
        return;
      }

      // 🚀 TAB & ARROWS -> Move Navigation
      const visibleCols = table.getVisibleLeafColumns().length;
      const moveFocus = (rInc: number, cInc: number) => {
        const nRow = rowIndex + rInc;
        let nCol = colIndex + cInc;

        if (nRow >= 0 && nRow < filteredData.length) {
          if (nCol < 0) nCol = 0;
          if (nCol >= visibleCols) nCol = visibleCols - 1;
          setSelectedCell({ rowIndex: nRow, colIndex: nCol });
        }
      };

      if (isArrowKey) {
        if (isEditing) return;
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        if (rowIndex > 0) {
          moveFocus(-1, 0);
        }
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

      // Quick Type-to-Edit
      if (
        !isEditing &&
        (currentRow?.type === 'data' || currentRow?.type === 'automationModule') &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const isAgent =
          ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(
            String((currentRow as any).category || '').toLowerCase()
          ) || (currentRow as any).section === 'Chat Agents';
        const isBookmark =
          ['bookmark', 'bookmarks'].includes(String((currentRow as any).category || '').toLowerCase()) ||
          (currentRow as any).section === 'Bookmarks';
        const isBrowserCommand =
          ['commands', 'general_commands', 'command'].includes(String((currentRow as any).category || '').toLowerCase()) ||
          (currentRow as any).section === 'Browser Commands';
        const isAutomation =
          ['automation', 'automations'].includes(String((currentRow as any).category || '').toLowerCase()) ||
          currentRow?.section === 'My Saved Automations' ||
          currentRow?.section === 'Automation Store' ||
          (currentRow as any).type === 'automationModule';

        const isCellBlocked =
          (columnId === 'name' && (isBookmark || isBrowserCommand)) ||
          (columnId === 'url' && (isBookmark || isBrowserCommand)) ||
          isAutomation;

        if (!isCellBlocked && !(isAgent && (columnId === 'name' || columnId === 'command' || columnId === 'id')) && !isBookmark && columnId !== 'tags') {
          setEditingCell(selectedCell);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData, selectedCell, editingCell, setSelectedCell, setEditingCell, toggleSection, onClose]);

  const handleAddRow = async (section: string, visualIndex: number) => {
    const storageKey = section === 'Smart Links' ? 'lastLinkDestination' : 'lastNoteDestination';
    let initialLocation: Record<string, any> = {};
    const workspaces = useDbStore.getState().workspaces || [];
    if (workspaces.length > 0) {
      const result: any = await new Promise(res => chrome.storage.local.get(storageKey, res));
      const lastDest = result[storageKey];

      if (lastDest) {
        const lastLocation = getWorkspaceAndFolderLocation(lastDest.workspace_id || null, lastDest.folder_id || null);
        if (lastLocation) {
          initialLocation = lastLocation;
        }
      }

      if (Object.keys(initialLocation).length === 0 && workspaces.length > 0) {
        const firstWorkspace = workspaces[0];
        const fallbackLocation = getWorkspaceAndFolderLocation(firstWorkspace.id, null);
        if (fallbackLocation) {
          initialLocation = fallbackLocation;
        }
      }
    }

    addRow(section, initialLocation);
    // Expand the section if it was collapsed so the user can see the new row
    if (collapsedSections.includes(section)) {
      toggleSection(section);
    }
    // Select the newly added row (which is at visualIndex + 1 since addRow inserts at top)
    setTimeout(() => {
      setSelectedCell({ rowIndex: visualIndex + 1, colIndex: 0 });
      setEditingCell({ rowIndex: visualIndex + 1, colIndex: 0 });
    }, 50);
  };

  let dataIndex = 0;

  const sectionGroups: { key: string; items: { row: any; visualIndex: number }[] }[] = [];
  let currentGroup: { key: string; items: { row: any; visualIndex: number }[] } | null = null;

  filteredData.forEach((row, visualIndex) => {
    if (row.type === 'section') {
      currentGroup = { key: `section-${row.title}-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    if (!currentGroup) {
      currentGroup = { key: `default-${visualIndex}`, items: [] };
      sectionGroups.push(currentGroup);
    }
    currentGroup.items.push({ row, visualIndex });
  });

  const firstVisibleSection = React.useMemo(() => {
    return filteredData.find(r => r.type === 'section') as any;
  }, [filteredData]);

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
          {sectionGroups.map(group => (
            <tbody key={group.key} className="bg-transparent">
              {group.items.map(({ row, visualIndex }) => {
                if (row.type === 'section') {
                  const getIcon = (title: string) => {
                    switch (title) {
                      case 'Smart Links':
                        return <FaLink className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Notes':
                        return <NotesIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Saved Automations':
                      case 'Automations':
                        return <FiZap className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Chat Agents':
                        return <FaRobot className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'System Commands':
                      case 'Commands':
                      case 'Browser Commands':
                        return <FaTerminal className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Snippets':
                        return <FaCode className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Tab Sessions':
                        return <SessionGridIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      case 'Todos':
                        return <BsCalendarCheck className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />;
                      default:
                        return null;
                    }
                  };

                  const isSelectedSection = selectedCell?.rowIndex === visualIndex;
                  const isCollapsed = collapsedSections.includes(row.title);

                  const isFirstTargetSection = firstVisibleSection && row.title === firstVisibleSection.title;
                  
                  const count = tableData.filter(
                    r => (r.type === 'data' || r.type === 'automationCategory' || r.type === 'automationModule') && r.section === row.title,
                  ).length;

                  return (
                    <tr
                      key={`section-${row.title}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleSection(row.title);
                      }}
                      onMouseEnter={() => setHoveredSection(row.title)}
                      onMouseLeave={() => setHoveredSection(null)}
                      className="cursor-pointer relative group/section-row select-none">
                      {isFirstTargetSection ? (
                        <td
                          colSpan={table.getVisibleLeafColumns().length}
                          className="p-0 text-sm font-normal tracking-tight bg-[var(--color-sheetBg)] z-[50]">
                          <div className="flex items-stretch h-full -ml-6 relative pr-0 gap-1 bg-transparent">
                            <div
                              className={clsx(
                                'p-1 rounded-md self-center transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 z-20 bg-transparent hover:bg-white/10 text-neutral-400',
                                isSelectedSection ? 'opacity-100' : 'opacity-0 group-hover/section-row:opacity-100',
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleSection(row.title);
                              }}>
                              {isCollapsed ? <FiChevronRight size={14} /> : <FiChevronDown size={14} />}
                            </div>
                            
                            {/* Unified Row Background */}
                            <div className={clsx(
                              "w-full transition-colors relative text-white group overflow-hidden",
                              isSelectedSection ? 'bg-white/10 ring-1 ring-white/20 ring-inset z-10' : 'bg-white/[0.025] border-l border-b border-white/[0.08]'
                            )}>
                              <table className="w-full h-full table-fixed border-collapse">
                                <colgroup>
                                  {table.getVisibleLeafColumns().map(column => (
                                    <col key={column.id} style={{ width: column.getSize() }} />
                                  ))}
                                </colgroup>
                                <tbody>
                                  <tr className="divide-x divide-black/10 dark:divide-white/10">
                                    <td className="p-0 align-middle">
                                      <div className="flex items-center gap-2 pl-2 pr-3 py-1">
                                <span className="text-white/75">{getIcon(row.title)}</span>
                                <span className="flex items-center flex-1">
                                  <span className="min-w-[135px] shrink-0 flex items-center gap-1.5 text-white/90 font-medium">
                                    {row.title}
                                    <span className={clsx("ml-2 text-[10px] font-bold text-[var(--color-sectionCountText)] transition-opacity", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                      {count}
                                    </span>
                                    {row.title === 'Notes' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Smart Links' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { category: 'link', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Snippets' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Tab Sessions' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'session', id: 'new', props: { category: 'session', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Todos' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: { category: 'todo', isOverlay: true, prefill: { isCreateModalOnly: true } as any } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer transition-opacity duration-200", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100 group-hover:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    
                                  </span>
                                  {omniboxPrefixes && (row.title === 'Notes' || row.title === 'Smart Links' || row.title === 'Tab Sessions' || row.title === 'Browser Commands' || row.title === 'System Commands' || row.title === 'Commands' || row.title === 'Saved Automations' || row.title === 'Chat Agents' || row.title === 'AI Prompts' || row.title === 'Todos') && (
                                    <span className={clsx("flex items-center gap-1 transition-opacity", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                      <EditablePrefixKey 
                                        category={
                                          row.title === 'Notes' ? 'note' :
                                          row.title === 'Tab Sessions' ? 'session' :
                                          row.title === 'Saved Automations' ? 'automation' :
                                          row.title === 'Chat Agents' ? 'agent' :
                                          row.title === 'AI Prompts' ? 'prompt' :
                                          row.title === 'Todos' ? 'todo' :
                                          (row.title === 'System Commands' || row.title === 'Commands') ? 'system_command' :
                                          row.title === 'Browser Commands' ? 'command' : 'link'
                                        }
                                        currentValue={
                                          row.title === 'Notes' ? (omniboxPrefixes.note || '') : 
                                          row.title === 'Smart Links' ? (omniboxPrefixes.link || '') : 
                                          row.title === 'Tab Sessions' ? ((omniboxPrefixes as any).session || '') : 
                                          row.title === 'Saved Automations' ? (omniboxPrefixes.automation || '') : 
                                          row.title === 'Chat Agents' ? (omniboxPrefixes.agent || '') : 
                                          row.title === 'AI Prompts' ? ((omniboxPrefixes as any).prompt || '') :
                                          row.title === 'Todos' ? ((omniboxPrefixes as any).todo || '') :
                                          (row.title === 'System Commands' || row.title === 'Commands') ? (omniboxPrefixes.system_command || '') :
                                          row.title === 'Browser Commands' ? (omniboxPrefixes.command || '') : ''
                                        }
                                      />
                                    </span>
                                  )}
                                </span>
                              </div>
                                    </td>

                                    {/* Remaining Columns: Render their column headers */}
                                    {table.getVisibleLeafColumns().slice(1).map((col, i) => (
                                      <td key={col.id} className="p-0 align-middle">
                                        <div 
                                          className={clsx(
                                            "flex items-center py-1 text-[11px] font-bold text-neutral-400 transform scale-[0.9]",
                                            col.id === 'fav' ? 'justify-center origin-center' : 'px-2 justify-start origin-left'
                                          )}
                                        >
                                  {col.id === 'command' ? (
                                    <div className="flex items-center gap-1.5 relative">
                                      <span>{col.columnDef.header as string}</span>
                                      <div 
                                        className="cursor-pointer p-[3px] -m-[3px] hover:bg-white/10 rounded transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCommandFilterOpen(!commandFilterOpen);
                                        }}
                                      >
                                        <FaFilter size={9} className={showShortcutsOnly ? "text-blue-400" : "text-neutral-500"} />
                                      </div>
                                      
                                      {/* Dropdown */}
                                      {commandFilterOpen && (
                                        <div 
                                          className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl py-1 z-[200] min-w-[170px]"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <div 
                                            className={clsx("px-3 py-1.5 text-[11px] font-normal cursor-pointer transition-colors", !showShortcutsOnly ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5")}
                                            onClick={() => {
                                              setShowShortcutsOnly(false);
                                              setCommandFilterOpen(false);
                                            }}
                                          >
                                            All
                                          </div>
                                          <div 
                                            className={clsx("px-3 py-1.5 text-[11px] font-normal cursor-pointer transition-colors", showShortcutsOnly ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5")}
                                            onClick={() => {
                                              setShowShortcutsOnly(true);
                                              setCommandFilterOpen(false);
                                            }}
                                          >
                                            Assigned Commands ({tableData.filter(r => (r.type === 'data' || r.type === 'automationModule') && !!(r as any).command).length})
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    col.columnDef.header as string
                                  )}
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <td
                          colSpan={table.getVisibleLeafColumns().length}
                          className="pt-4 pb-0 px-0 text-sm font-normal tracking-tight bg-[var(--color-sheetBg)] z-[50]">
                          <div className="flex items-stretch h-full -ml-6 relative pr-0 gap-1 bg-transparent">
                            <div
                              className={clsx(
                                'p-1 rounded-md self-center transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 z-20 bg-transparent hover:bg-white/10 text-neutral-400',
                                isSelectedSection ? 'opacity-100' : 'opacity-0 group-hover/section-row:opacity-100',
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleSection(row.title);
                              }}>
                              {isCollapsed ? (
                                <FiChevronRight size={14} />
                              ) : (
                                <FiChevronDown size={14} />
                              )}
                            </div>

                            {/* Unified Row Background */}
                            <div className={clsx(
                              "w-full transition-colors relative text-white group overflow-hidden",
                              isSelectedSection ? 'bg-white/10 ring-1 ring-white/20 ring-inset z-10' : 'bg-white/[0.025] border-l border-y border-white/[0.08]'
                            )}>
                              <table className="w-full h-full table-fixed border-collapse">
                                <colgroup>
                                  {table.getVisibleLeafColumns().map(column => (
                                    <col key={column.id} style={{ width: column.getSize() }} />
                                  ))}
                                </colgroup>
                                <tbody>
                                  <tr>
                                    <td colSpan={table.getVisibleLeafColumns().length} className="p-0 align-middle">
                                      <div className="flex items-center gap-2 pl-2 pr-3 py-1">
                                <span className="text-white/75">{getIcon(row.title)}</span>
                                <span className="flex items-center flex-1">
                                  <span className="min-w-[135px] shrink-0 flex items-center gap-1.5 text-white/90 font-medium">
                                    {row.title}
                                    <span className={clsx("ml-2 text-[10px] font-bold text-[var(--color-sectionCountText)] transition-opacity", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                      {count}
                                    </span>
                                    {row.title === 'Notes' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'note', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Smart Links' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'link', id: 'new', props: { category: 'link', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Snippets' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'note', id: 'new', props: { category: 'snippet', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Tab Sessions' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'session', id: 'new', props: { category: 'session', isOverlay: true } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                    {row.title === 'Todos' && (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: { category: 'todo', isOverlay: true, prefill: { isCreateModalOnly: true } as any } });
                                        }}
                                        className={clsx("ml-2 p-[2px] rounded text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all focus:outline-none flex items-center justify-center cursor-pointer transition-opacity duration-200", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100 group-hover:opacity-100")}>
                                        <FiPlus size={12} />
                                      </button>
                                    )}
                                  </span>
                                  {omniboxPrefixes && (row.title === 'Notes' || row.title === 'Smart Links' || row.title === 'Tab Sessions' || row.title === 'Browser Commands' || row.title === 'System Commands' || row.title === 'Commands' || row.title === 'Saved Automations' || row.title === 'Chat Agents' || row.title === 'AI Prompts' || row.title === 'Todos') && (
                                    <span className={clsx("flex items-center gap-1 transition-opacity", isSelectedSection ? "opacity-100" : "opacity-0 group-hover/section-row:opacity-100")}>
                                      <EditablePrefixKey 
                                        category={
                                          row.title === 'Notes' ? 'note' :
                                          (row.title === 'System Commands' || row.title === 'Commands') ? 'system_command' :
                                          row.title === 'Browser Commands' ? 'command' :
                                          row.title === 'Tab Sessions' ? 'session' :
                                          row.title === 'Saved Automations' ? 'automation' :
                                          row.title === 'Chat Agents' ? 'agent' : 
                                          row.title === 'AI Prompts' ? 'prompt' : 
                                          row.title === 'Todos' ? 'todo' : 'link'
                                        }
                                        currentValue={
                                          row.title === 'Notes' ? (omniboxPrefixes.note || '') : 
                                          row.title === 'Smart Links' ? (omniboxPrefixes.link || '') : 
                                          row.title === 'Tab Sessions' ? ((omniboxPrefixes as any).session || '') : 
                                          row.title === 'Saved Automations' ? (omniboxPrefixes.automation || '') : 
                                          row.title === 'Chat Agents' ? (omniboxPrefixes.agent || '') : 
                                          row.title === 'AI Prompts' ? ((omniboxPrefixes as any).prompt || '') : 
                                          row.title === 'Todos' ? ((omniboxPrefixes as any).todo || '') : 
                                          (row.title === 'System Commands' || row.title === 'Commands') ? (omniboxPrefixes.system_command || '') :
                                          row.title === 'Browser Commands' ? (omniboxPrefixes.command || '') : ''
                                        }
                                      />
                                    </span>
                                  )}

                                </span>
                                      </div>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }

                if (row.type === 'automationCategory') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;
                  const isExpanded = useSpreadsheetStore.getState().expandedCategories.includes(row.id);

                  return (
                    <tr
                      key={`cat-${row.id}-${visualIndex}`}
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                      }}
                      onDoubleClick={() => toggleCategory(row.id)}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className={clsx(
                        'cursor-pointer relative select-none transition-all duration-200 group',
                        isExpanded
                          ? 'bg-white/5 border-b border-white/5'
                          : 'bg-transparent border-b border-white/5 hover:bg-white/5',
                        isSelected ? 'ring-1 ring-white/60 ring-inset z-10' : '',
                      )}>
                      <td
                        colSpan={table.getVisibleLeafColumns().length}
                        className="pl-1 pr-0 py-1.5 border-white/10">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-1">
                            <div
                              className={clsx(
                                'p-1 rounded-md transition-all duration-200 cursor-pointer w-5 h-5 flex items-center justify-center shrink-0 hover:bg-white/10',
                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                              )}
                              onClick={e => {
                                e.stopPropagation();
                                toggleCategory(row.id);
                              }}>
                              {isExpanded ? (
                                <FiChevronDown className="text-[var(--color-iconDefault)]" size={14} />
                              ) : (
                                <FiChevronRight className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                            </div>

                            {/* Icon & Name */}
                            <div className="flex items-center gap-2">
                              {row.iconHost ? (
                                <img
                                  src={getFaviconUrl(row.iconHost)}
                                  alt=""
                                  className="w-4 h-4 object-contain rounded-sm transition-all"
                                />
                              ) : (
                                <FiBox className="text-[var(--color-iconDefault)]" size={14} />
                              )}
                              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">
                                {row.name}
                                <span className="ml-2 text-[10px] font-bold text-neutral-400">
                                  {row.moduleCount}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'emptySectionsToggle') {
                  const isSelected = selectedCell?.rowIndex === visualIndex;

                  return (
                    <tr
                      key="empty-sections-toggle"
                      data-row-index={visualIndex}
                      onClick={() => {
                        setSelectedCell({ rowIndex: visualIndex, colIndex: 0 });
                        toggleEmptySections();
                      }}
                      onMouseEnter={() => setHoveredRowIndex(visualIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                      className="cursor-pointer select-none transition-colors bg-transparent hover:bg-white/5">
                      <td colSpan={table.getVisibleLeafColumns().length} className="pl-3 pr-0 py-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
                          <FiChevronRight size={11} className="text-[var(--color-iconDefault)]" />
                          Show {row.count} more sections
                        </span>
                      </td>
                    </tr>
                  );
                }

                if (row.type === 'add_row') return null;

                // Normal data row
                const tableRow = table.getRowModel().rows[dataIndex++];
                if (!tableRow) return null;

                return (
                  <tr
                    key={tableRow.id}
                    data-row-index={visualIndex}
                    onMouseEnter={() => setHoveredSection(tableRow.original.section)}
                    onMouseLeave={() => setHoveredSection(null)}
                    className={clsx(
                      'group/row grow h-auto min-h-[36px] transition-all duration-300',
                      'border-b border-black/10 dark:border-white/10 divide-x divide-black/10 dark:divide-white/10',
                      (tableRow.original as any).isDeleting
                        ? 'bg-red-900/20'
                        : 'bg-transparent hover:bg-white/5',
                    )}>
                    {tableRow.getVisibleCells().map((cell, index) => {
                      const isSelected = selectedCell?.rowIndex === visualIndex && selectedCell?.colIndex === index;
                      const isSelectedRow = selectedCell?.rowIndex === visualIndex;

                      const isEditing = editingCell?.rowIndex === visualIndex && editingCell?.colIndex === index;

                      const value = cell.getValue() as string;

                      return (
                        <td
                          key={cell.id}
                          onClick={() => {
                            setSelectedCell({ rowIndex: visualIndex, colIndex: index });
                            if (isSelected && !isEditing) {
                              const row = tableRow.original as any;

                              if (cell.column.id === 'name') {
                                const isNote = row.itemType === 'note' && row.section !== 'Snippets';
                                const isSnippet = row.section === 'Snippets' || row.itemType === 'snippet';
                                const isLink = row.section === 'Smart Links' || row.itemType === 'link';
                                
                                if (isNote) {
                                  useUIStore.getState().openEditor({ 
                                    type: 'note', 
                                    id: row.id, 
                                    props: { category: 'note', isOverlay: true, editMode: true, snippet: row } 
                                  });
                                  return;
                                }
                                if (isSnippet) {
                                  useUIStore.getState().openEditor({ 
                                    type: 'note', 
                                    id: row.id, 
                                    props: { category: 'snippet', isOverlay: true, editMode: true, snippet: row } 
                                  });
                                  return;
                                }
                                if (isLink) {
                                  useUIStore.getState().openEditor({ 
                                    type: 'link', 
                                    id: row.id, 
                                    props: { category: 'link', isOverlay: true, editMode: true, snippet: row } 
                                  });
                                  return;
                                }
                                if (row.section === 'Todos' || row.itemType === 'todo' || row.category === 'todo') {
                                  const prefill = {
                                    todo_id: row.id,
                                    snippet_id: row.id,
                                    is_todo_type: true,
                                    key: row.name || '',
                                    title: row.name || '',
                                    value: row.value || '',
                                    shortcut: row.command || '',
                                    tags: row.tagIds || [],
                                  };
                                  useUIStore.getState().setTodoCreatePrefill(prefill);
                                  useUIStore.getState().openEditor({
                                    type: 'todo',
                                    id: row.id,
                                    props: { category: 'todo', isOverlay: true, editMode: true, snippet: row, prefill },
                                  });
                                  return;
                                }

                                triggerLocalToast('Currently it is not supported');
                                return;
                              }

                              const isModule = row.category === 'module' || row.section === 'Installed Modules';
                              const isAgent =
                                ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(
                                  String(row.category || '').toLowerCase()
                                ) || row.section === 'Chat Agents';
                              const isBookmark =
                                ['bookmark', 'bookmarks'].includes(String(row.category || '').toLowerCase()) ||
                                row.section === 'Bookmarks';
                              const isBrowserCommand =
                                ['commands', 'general_commands', 'command'].includes(String(row.category || '').toLowerCase()) ||
                                row.section === 'Browser Commands';
                              const isInstalledModule =
                                row.category === 'module' || row.section === 'Installed Modules';
                              const isAutomation =
                                ['automation', 'automations'].includes(String(row.category || '').toLowerCase()) ||
                                row.section === 'My Saved Automations' ||
                                row.section === 'Automation Store' ||
                                row.type === 'automationModule';

                              const isCellBlocked =
                                cell.column.id === 'name' ||
                                (cell.column.id === 'url' && (isBookmark || isBrowserCommand)) ||
                                isAutomation;

                              // For modules and agents, the 2nd column (index 1) is now editable
                              const isReadonlyCol = isModule
                                ? cell.column.id === 'name' || cell.column.id === 'command'
                                : cell.column.id === 'name' || cell.column.id === 'url' || cell.column.id === 'command';
                              const isAgentReadonlyCol = cell.column.id === 'url';

                              if (!isCellBlocked && !(isModule && isReadonlyCol) && !(isAgent && (cell.column.id === 'name' || cell.column.id === 'command')) && cell.column.id !== 'tags') {
                                setEditingCell({ rowIndex: visualIndex, colIndex: index });
                              }
                            }
                          }}
                          className={clsx(
                            'text-[11px] cursor-pointer transition-all relative h-auto min-h-[36px]',
                            index === 0 && 'border-l border-white/10',
                            cell.column.id === 'id'
                              ? 'p-0 text-center align-middle'
                              : cell.column.id === 'key' || cell.column.id === 'fav'
                                ? 'px-1'
                                : cell.column.id === 'url' && isSelected
                                  ? 'px-[2px]'
                                  : 'px-2 py-1',
                            isSelected
                              ? 'text-white ring-1 ring-white/30 ring-inset rounded bg-white/5 z-[50] overflow-visible py-[2px]'
                              : 'text-neutral-300/90 py-[1.5px]',
                            (tableRow.original as any).isDeleting && (cell.column.id !== 'id' ? 'opacity-40 grayscale pointer-events-none' : 'opacity-100'),
                          )}
                          style={{ width: cell.column.getSize() }}>
                          {cell.column.id === 'id' ? (
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
                                <div className="flex items-center justify-center w-full h-full min-h-[28px]">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      useSpreadsheetStore.getState().removeRow(tableRow.original.id);
                                    }}
                                    className={clsx(
                                      'flex items-center justify-center w-7 h-7 rounded hover:text-red-500 transition-all opacity-70 hover:opacity-100',
                                      isSelectedRow ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100',
                                    )}>
                                    <FiTrash size={14} />
                                  </button>
                                </div>
                              )
                            ) : isEditing ? (
                              cell.column.id === 'fav' ? (
                                tableRow.original.section === 'Bookmarks' ? null : (
                                  <div className="flex justify-center w-full">
                                    <button
                                      className="transition-colors"
                                      onClick={e => {
                                        e.stopPropagation();
                                        toggleFavorite(tableRow.original.id as string);
                                      }}>
                                      {tableRow.original.syncStatus === 'syncing' ? (
                                        <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                      ) : tableRow.original.fav ? (
                                        <FaStar className="text-amber-400 text-xs" />
                                      ) : (
                                        <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                      )}
                                    </button>
                                  </div>
                                )
                              ) : cell.column.id === 'key' ? (
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

                                if (
                                  tableRow.original.section === 'Notes' ||
                                  tableRow.original.section === 'Snippets'
                                ) {
                                  return (
                                    <BufferedCellInput
                                      initialValue={String(tableRow.original.value || '')
                                        .replace(/<[^>]*>?/gm, '')
                                        .replace(/&nbsp;/g, ' ')
                                        .trim()}
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
                                placeholder="Enter the title"
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
                              {cell.column.id === 'fav' ? (
                                tableRow.original.section === 'Bookmarks' ? null : (
                                  <div className="flex justify-center w-full opacity-70 hover:opacity-100 transition-opacity">
                                    <button
                                      className="transition-colors"
                                      onClick={e => {
                                        e.stopPropagation();
                                        toggleFavorite(tableRow.original.id as string);
                                      }}>
                                      {tableRow.original.syncStatus === 'syncing' ? (
                                        <FiLoader className="animate-spin text-[var(--color-iconDefault)] text-xs" />
                                      ) : tableRow.original.fav ? (
                                        <FaStar className="text-amber-400 text-xs" />
                                      ) : (
                                        <FiStar className="text-[var(--color-iconDefault)] text-xs hover:opacity-80" />
                                      )}
                                    </button>
                                  </div>
                                )
                              ) : (cell.column.id === 'folder' || cell.column.id === 'folder_id') &&
                                (tableRow.original.section === 'My Saved Automations' ||
                                  tableRow.original.section === 'Chat Agents') ? (
                                <div className="flex items-center justify-between gap-1 w-full h-full px-2 overflow-hidden">
                                  {tableRow.original.path && (
                                    <>
                                      <div className="truncate flex-1 min-w-0 text-white/70">
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'hidden' : 'group-hover/row:hidden'
                                          )}>
                                          {tableRow.original.plainPath || tableRow.original.path}
                                        </span>
                                        <span
                                          className={clsx(
                                            'truncate whitespace-nowrap transition-all duration-200',
                                            isSelectedRow ? 'inline' : 'hidden group-hover/row:inline'
                                          )}>
                                          {tableRow.original.path}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : cell.column.id === 'name' ? (
                                <div
                                  className={clsx(
                                    'truncate max-w-full w-full min-w-0 py-1 h-full',
                                    supportsTitleInlinePreview(tableRow.original)
                                      ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3'
                                      : 'flex items-center gap-2',
                                    tableRow.original.type === 'automationModule' && 'ml-8',
                                  )}>
                                  <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-1.5 min-w-0 w-full overflow-hidden">
                                  <div className="w-6 min-w-6 flex items-center justify-center overflow-hidden">
                                  {(() => {
                                    const rowItem = tableRow.original;
                                    const isLink = rowItem.itemType === 'link' || rowItem.itemType === 'session' || ['bookmark', 'bookmarks'].includes(String(rowItem.category || '').toLowerCase());

                                    return (
                                      <>
                                        {isLink && !['commands', 'general_commands', 'command'].includes(String(rowItem.category || '').toLowerCase()) && (
                                          <StackedLinkIcon
                                            urls={rowItem.urls || []}
                                            size={14}
                                            fallback={
                                              ['bookmark', 'bookmarks'].includes(String(rowItem.category || '').toLowerCase())
                                                ? 'link'
                                                : ['tabgroup', 'session', 'sessions', 'tab session'].includes(String(rowItem.category || '').toLowerCase())
                                                  ? 'tabgroup'
                                                  : 'link'
                                            }
                                            maxIcons={3}
                                          />
                                        )}
                                        {rowItem.itemType === 'note' && (
                                          <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {rowItem.itemType === 'snippet' && (
                                          <FaCode size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {(String(rowItem.itemType) === 'todo' || rowItem.section === 'Todos' || rowItem.category === 'todo') && (
                                          <BsCalendarCheck size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        )}
                                        {(
                                          rowItem.itemType === 'agent' ||
                                          rowItem.section === 'Chat Agents' ||
                                          ['chatagent', 'chat_agent', 'agent'].includes(String(rowItem.category || '').toLowerCase())
                                        ) ? (
                                          <FaRobot size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5" />
                                        ) : (
                                          ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(String(rowItem.category || '').toLowerCase()) ||
                                          rowItem.category === 'module' ||
                                          ['commands', 'general_commands', 'command'].includes(String(rowItem.category || '').toLowerCase())
                                        ) ? (
                                          (typeof rowItem.icon_host === 'string' && rowItem.icon_host) ? (
                                            <img
                                              src={getFaviconUrl(rowItem.icon_host)}
                                              alt=""
                                              className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"
                                            />
                                          ) : (!isLink && rowItem.category !== 'commands' && rowItem.category !== 'general_commands') ? (
                                            <AutomationDynamicIcon
                                              automation={rowItem.automationData}
                                              size={14}
                                              className="shrink-0"
                                            />
                                          ) : null
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                  </div>
                                  <span className="font-normal flex items-center gap-1.5 min-w-0">
                                    <span className="truncate min-w-0">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </span>
                                    {(tableRow.original.section === 'Smart Links' || tableRow.original.section === 'Tab Sessions') && (
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();

                                          if (tableRow.original.section === 'Tab Sessions' || tableRow.original.category === 'session') {
                                            const item = tableRow.original as any;
                                            const sessionId = item.id;
                                            const sessionName = item.key || item.name || item.title || 'Untitled Tab Session';
                                            const openSettings = item.sessionOpenSettings || item.data?.sessionOpenSettings || {};
                                            let initialUrls = item.urls || [];
                                            let initialNames = item.names || [];
                                            
                                            if (initialUrls.length === 0) {
                                              try {
                                                const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
                                                if (Array.isArray(parsed)) {
                                                  initialUrls = parsed.map((l: any) => l.url || l);
                                                  initialNames = parsed.map((l: any) => l.name || '');
                                                } else if (parsed && typeof parsed === 'object') {
                                                  if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
                                                  if (Array.isArray(parsed.names)) initialNames = parsed.names;
                                                }
                                              } catch (err) {}
                                            }

                                            const chromeAny = (window as any)?.chrome;
                                            if (!chromeAny?.tabs?.query) return;

                                            chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
                                              const activeTab = tabs?.[0];
                                              const activeTabContext = {
                                                currentTabId: activeTab?.id ?? null,
                                                currentWindowId: activeTab?.windowId ?? null,
                                                currentPageUrl: activeTab?.url || window.location.href,
                                              };

                                              chrome.runtime.sendMessage(
                                                {
                                                  action: 'start_session',
                                                  sessionId,
                                                  sessionName,
                                                  workspaceId: item.workspace_id || item.workspaceId || null,
                                                  folderId: item.folder_id || item.folderId || null,
                                                  teamId: 'local',
                                                  storageMode: 'local',
                                                  initialUrls,
                                                  initialNames,
                                                  openSettings,
                                                  isInlineCreation: true,
                                                  ...activeTabContext,
                                                },
                                                (response: any) => {
                                                  if (response?.ok && openSettings?.openMode === 'same_window') {
                                                    if (response?.reused || response?.reusedCurrentTab) {
                                                      return;
                                                    }
                                                    const encodedName = encodeURIComponent(sessionName);
                                                    window.history.replaceState(
                                                      null,
                                                      '',
                                                      `?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
                                                    );
                                                    useUIStore.getState().openEditor({
                                                      type: 'session',
                                                      id: sessionId,
                                                      props: {
                                                        session: {
                                                          id: sessionId,
                                                          title: sessionName,
                                                        },
                                                      },
                                                    });
                                                  }
                                                },
                                              );
                                            });
                                            return;
                                          }

                                          const urls = tableRow.original.urls || [];
                                          if (urls.length > 0) {
                                            const finalUrls = urls
                                              .map((url: string) => {
                                                if (url.startsWith('note:')) {
                                                  const sid = url.substring(5);
                                                  return chrome.runtime.getURL(
                                                    `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`,
                                                  );
                                                }
                                                return url;
                                              })
                                              .filter(Boolean);

                                            if (finalUrls.length > 0) {
                                              finalUrls.slice(1).forEach((url: string) => {
                                                if (url.startsWith('agent_chat?id=')) {
                                                  const agentId = url.split('id=')[1];
                                                  const extensionUrl = chrome.runtime.getURL(
                                                    `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                                  );
                                                  chrome.tabs.create({ url: extensionUrl, active: false });
                                                } else {
                                                  chrome.tabs.create({ url, active: false });
                                                }
                                              });

                                              const firstUrl = finalUrls[0];
                                              if (firstUrl.startsWith('agent_chat?id=')) {
                                                const agentId = firstUrl.split('id=')[1];
                                                const extensionUrl = chrome.runtime.getURL(
                                                  `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
                                                );
                                                window.location.href = extensionUrl;
                                              } else if (firstUrl.startsWith('chrome://') || firstUrl.startsWith('edge://') || firstUrl.startsWith('brave://')) {
                                                chrome.tabs.update({ url: firstUrl });
                                              } else {
                                                window.location.href = firstUrl;
                                              }
                                            }
                                          }
                                        }}
                                        className={clsx(
                                          'w-6 h-6 rounded-md transition-all cursor-pointer shrink-0 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300',
                                          isSelectedRow || isSelected
                                            ? 'opacity-100'
                                            : 'opacity-0 group-hover/row:opacity-100',
                                        )}
                                        title="Open Link">
                                        <FiExternalLink size={15} strokeWidth={2.4} />
                                      </button>
                                    )}
                                    {!cell.getValue() && !tableRow.original.isReal && (
                                      <span className="text-red-500 font-bold text-[10px]">*</span>
                                    )}
                                  </span>
                                  <AnimatePresence mode="popLayout">
                                    {tableRow.original.syncStatus === 'syncing' && (
                                      <motion.div
                                        key="syncing"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-blue-500/20 border-blue-500/30 text-blue-300">
                                        <BsHourglassSplit className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Syncing...
                                        </span>
                                      </motion.div>
                                    )}
                                    {tableRow.original.syncStatus === 'deleting' && (
                                      <div
                                        key="deleting"
                                        className="shrink-0 ml-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border bg-red-500/20 border-red-500/30 text-red-300">
                                        <FiLoader className="text-[10px] animate-spin" />
                                        <span className="text-[9px] font-medium tracking-tight">
                                          Deleting...
                                        </span>
                                      </div>
                                    )}
                                    {tableRow.original.syncStatus === 'saved' && (
                                      <div className="shrink-0 ml-1">
                                        <motion.div
                                          key="saved-check"
                                          initial={{ opacity: 0, scale: 0.5 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="flex items-center">
                                          <FiCheck className="text-[10px] text-emerald-500 stroke-[3]" />
                                        </motion.div>
                                      </div>
                                    )}
                                  </AnimatePresence>
                                  </div>
                                  
                                  {(() => {
                                    const row = tableRow.original as any;
                                    const isNote = row.section === 'Notes' || row.itemType === 'note';
                                    const isSnippet = row.section === 'Snippets' || row.itemType === 'snippet';
                                    const isLink = row.section === 'Smart Links' || row.section === 'Tab Sessions' || row.itemType === 'link' || row.itemType === 'session' || row.category === 'link' || row.category === 'session';
                                    const isCommand = row.category === 'commands' || row.category === 'general_commands' || row.section === 'Browser Commands';
                                    
                                    const supportsPreview = isNote || isSnippet || isLink || isCommand;
                                    if (!supportsPreview) return null;
                                    
                                    if (['bookmark', 'bookmarks'].includes(String(row.category || '').toLowerCase())) return null;

                                    if (isCommand) {
                                      const text = String(row.description || '').replace(/<[^>]*>?/gm, '').trim();
                                      if (!text) return null;
                                      return (
                                        <div className="text-[10px] text-white/50 truncate min-w-0">
                                          {text}
                                        </div>
                                      );
                                    }

                                    const urls = row.urls || [];
                                    const hasUrls = urls.length > 0;

                                    if ((isNote || isSnippet) && !hasUrls) {
                                      let rawText = row.body || row.config || row.value || row.url || '';
                                      if (typeof rawText === 'string' && (rawText.trim().startsWith('[') || rawText.trim().startsWith('{'))) {
                                        try {
                                          rawText = JSON.parse(rawText);
                                        } catch (e) {}
                                      }
                                      
                                      const extractText = (obj: any): string => {
                                        if (typeof obj === 'string') return obj;
                                        if (Array.isArray(obj)) return obj.map(extractText).join(' ');
                                        if (typeof obj === 'object' && obj !== null) {
                                           if (obj.type === 'text' && obj.value) return String(obj.value);
                                           if (obj.text) return String(obj.text);
                                           if (obj.content) return typeof obj.content === 'string' ? obj.content : extractText(obj.content);
                                           if (obj.children) return extractText(obj.children);
                                           if (obj.html) return String(obj.html);
                                           if (obj.type === 'field' || obj.type === 'dropdown' || obj.type === 'toggle') {
                                              const config = obj.config || {};
                                              return `{{${config.label || obj.alias || obj.id || 'Field'}}}`;
                                           }
                                           return '';
                                        }
                                        return '';
                                      };

                                      if (typeof rawText !== 'string') {
                                        rawText = extractText(rawText);
                                      }

                                      const text = String(rawText)
                                        .replace(/<[^>]*>?/gm, '')
                                        .replace(/&nbsp;/g, ' ')
                                        .trim();
                                      if (!text || text.toLowerCase() === 'note data' || text.toLowerCase() === 'snippet data') return null;
                                      return (
                                        <div className="text-[10px] text-white/50 truncate min-w-0">
                                          {text}
                                        </div>
                                      );
                                    }
                                    
                                    if (isLink || hasUrls) {
                                       const displayUrls = hasUrls ? urls : [row.url || ''];
                                       const domains = displayUrls.filter(Boolean).map((u: string) => {
                                         try {
                                           const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                           return hostname.replace('www.', '');
                                         } catch {
                                           return u;
                                         }
                                       });
                                       if (domains.length === 0) return null;
                                       const topThree = domains.slice(0, 3).join(', ');
                                       return (
                                         <div className="text-[10px] text-white/50 truncate min-w-0 flex items-center gap-1">
                                           {topThree}
                                         </div>
                                       );
                                    }
                                    return null;
                                  })()}
                                </div>
                              ) : cell.column.id === 'folder' ? (
                                <>
                                  <div
                                    className="flex items-center justify-between gap-1 cursor-pointer hover:text-blue-500 transition-colors w-full h-full pr-2"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const row = tableRow.original as any;
                                      const isBookmark =
                                        row.category === 'bookmark' || row.section === 'Bookmarks';
                                      const isBrowserCommand =
                                        row.category === 'commands' ||
                                        row.category === 'general_commands' ||
                                        row.section === 'Browser Commands';
                                      const isInstalledModule =
                                        row.category === 'module' || row.section === 'Installed Modules';

                                      if (!(isBookmark || isBrowserCommand || isInstalledModule)) {
                                        useSpreadsheetStore.getState().openPicker(tableRow.original.id);
                                      }
                                    }}>
                                    {tableRow.original.path ? (
                                      <>
                                        <div className="truncate flex-1 min-w-0 text-white/70">
                                          <span className="truncate whitespace-nowrap">
                                            {tableRow.original.plainPath || tableRow.original.path}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-blue-400/70 font-normal italic text-[10px] pl-2 group-hover/folder:text-blue-500 transition-colors flex items-center gap-1">
                                        +{' '}
                                        {tableRow.original.section === 'Notes'
                                          ? 'Select regarding'
                                          : 'Selector for destination'}
                                        {!tableRow.original.folder && !tableRow.original.isReal && (
                                          <span className="text-red-500 text-[10px]">*</span>
                                        )}
                                      </span>
                                    )}
                                  </div>

                                  {isPickerOpen && pickerRowIndex === visualIndex && (
                                    <div
                                      className={clsx(
                                        'absolute right-1 z-[9999] w-[320px] min-w-[320px] transform transition-all animate-in fade-in zoom-in duration-150',
                                        visualIndex > tableData.length * 0.7 ? 'bottom-full mb-2' : 'top-full mt-2',
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
                                </>
                              ) : cell.column.id === 'tags' ? (
                                (() => {
                                  const row = tableRow.original as any;
                                  const cat = (row.itemType || row.category || '').toLowerCase();
                                  const supportsTags = ['note', 'link', 'snippet', 'automation', 'agent', 'session'].includes(cat);
                                  if (!supportsTags) return null;

                                  const tagIds = row.tagIds || [];
                                  
                                  if (tagIds.length === 0) return null;

                                  return (
                                    <div className="truncate flex-1 min-w-0 text-white/70 text-[11px] font-normal px-2">
                                      {tagIds.map((tid: string) => tagNamesMap[tid] || tid).join(', ')}
                                    </div>
                                  );
                                })()
                              ) : cell.column.id === 'key' ? (
                                 <div className="flex justify-center w-full opacity-70">
                                   {value && <VisualKeyDisplay hotkey={value} variant="text" />}
                                 </div>
                              ) : cell.column.id === 'command' ? (
                                (() => {
                                  const row = tableRow.original as any;
                                  const isInvalidForCommand =
                                    row.category === 'bookmark' ||
                                    row.section === 'Bookmarks' ||
                                    row.category === 'commands' ||
                                    row.category === 'general_commands' ||
                                    row.section === 'Browser Commands' ||
                                    row.category === 'automation' ||
                                    row.section === 'My Saved Automations' ||
                                    row.section === 'Automation Store' ||
                                    row.type === 'automationModule' ||
                                    row.category === 'module' ||
                                    row.section === 'Installed Modules' ||
                                    row.category === 'agent' ||
                                    row.section === 'Chat Agents';

                                  if (isInvalidForCommand && !value) return null;

                                  return (
                                    <div className="flex items-center w-full px-1">
                                      <span
                                        className="text-[11px] font-normal text-white/70 whitespace-nowrap"
                                        title={value ? `c_${String(value)}` : undefined}>
                                        {value ? `c_${String(value)}` : ''}
                                      </span>
                                    </div>
                                  );
                                })()
                              ) : cell.column.id === 'url' ? (
                                (() => {
                                  if (
                                    tableRow.original.section === 'Notes' ||
                                    tableRow.original.section === 'Snippets'
                                  ) {
                                    const urls = tableRow.original.urls || [];
                                    // If Note has URLs, show them like Links. If not, show plain text snippet content.
                                    if (urls.length > 0) {
                                      // Fall through to standard URL rendering logic below
                                    } else {
                                      return (
                                        <div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-white/70">
                                          {tableRow.original.value ? (
                                            String(tableRow.original.value)
                                              .replace(/<[^>]*>?/gm, '')
                                              .replace(/&nbsp;/g, ' ')
                                              .trim()
                                          ) : (
                                            <>
                                              {!tableRow.original.isReal && (
                                                <span className="text-red-500 font-bold text-[10px]">*</span>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                  }

                                  const isAutomation =
                                    tableRow.original.section === 'My Saved Automations' ||
                                    tableRow.original.section === 'Automation Store' ||
                                    tableRow.original.section === 'Installed Modules' ||
                                    tableRow.original.category === 'automation' ||
                                    tableRow.original.type === 'automationModule';

                                  const isAgent =
                                    tableRow.original.section === 'Chat Agents' || tableRow.original.category === 'agent';

                                  if (isAutomation) {
                                    const steps =
                                      tableRow.original.automationData?.steps ||
                                      tableRow.original.automationData?.automation_steps ||
                                      tableRow.original.automationData?.execution_steps ||
                                      [];

                                    // 🚀 Priority 2: Preview for rows with steps
                                    if (steps.length > 0) {
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
                                          <span className="truncate flex-1">{visibleSteps}</span>
                                          {moreCount > 0 && (
                                            <span className="ml-1 text-[9px] font-normal shrink-0 px-1.5 rounded whitespace-nowrap text-neutral-400 bg-neutral-800">
                                              +{moreCount} more
                                            </span>
                                          )}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 3: Fallback to description for modules/automations without steps
                                    const rawVal = tableRow.original.url || tableRow.original.value || '';
                                    let decodedVal = rawVal.includes('%') ? decodeURIComponent(rawVal) : rawVal;

                                    // If decodedVal is just dots or very short, try to use mod name or a better placeholder
                                    if (decodedVal === '......' || !decodedVal) {
                                      decodedVal =
                                        tableRow.original.name !== 'Untitled Module'
                                          ? `Module: ${tableRow.original.name}`
                                          : '';
                                    }

                                    if (decodedVal) {
                                      return (
                                        <div className="text-slate-500 italic text-[10px] truncate h-full px-1">
                                          {decodedVal}
                                        </div>
                                      );
                                    }

                                    // 🚀 Priority 4: Placeholder for empty/new automation rows
                                    return (
                                      <div className="italic text-[10px] flex items-center gap-1.5 h-full px-1 text-neutral-500">
                                        <FiZap size={10} className="text-[var(--color-iconDefault)]" />
                                        No steps - press Enter to add
                                      </div>
                                    );
                                  }

                                  const urls = tableRow.original.urls || [];
                                  // Only show editor if SPECIFICALLY in edit mode
                                  if (isSelected && isEditing) {
                                    return (
                                      <SpreadsheetMultiLinkInput
                                        initialUrls={urls}
                                        onSave={(val: string) =>
                                          updateCellData(
                                            tableRow.original.id,
                                            index,
                                            cell.column.id,
                                            val,
                                          )
                                        }
                                        onCancel={() => setEditingCell(null)}
                                      />
                                    );
                                  }

                                  const displayUrls = urls.length > 0 ? urls : [value || ''];
                                  const domains = displayUrls.map((u: string) => {
                                    try {
                                      const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                      return hostname.replace('www.', '');
                                    } catch {
                                      return u;
                                    }
                                  });

                                  const topThree = domains.slice(0, 3).join(', ');
                                  const moreCount = domains.length - 3;

                                  return (
                                    <div className="group/url flex items-center w-full text-[10px] overflow-hidden font-normal relative h-full text-white">
                                      <div className="flex flex-col w-full group-hover/row:py-1">
                                        {/* Collapsed View */}
                                        <div
                                          className={clsx(
                                            'flex items-center w-full transition-opacity',
                                            isSelected ? 'hidden' : 'flex',
                                          )}>
                                          <span className="truncate flex-1">{topThree}</span>
                                        </div>

                                        {/* Expanded View on Cell Selection */}
                                        <div className={clsx('flex-col gap-1.5 w-full', isSelected ? 'flex' : 'hidden')}>
                                          {urls.map((u, i) => (
                                            <div
                                              key={i}
                                              className="text-[10px] hover:text-blue-600 transition-colors break-all leading-tight border-b last:border-0 pb-1 text-white border-white/5">
                                              {u}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
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
          ))}
        </table>
      </div>
    </div>
  );
};

export default SpreadsheetTable;
