import TextExpanderIcon from '../../icons/TextExpanderIcon';
import { TagAppearance } from '../../editorToolbar/TagAppearance';
import * as React from 'react';
import { useSheetEngine } from '../../sheetEngine/useSheetEngine';
import { useState, useMemo } from 'react';
import type { SortingState, ColumnSizingState } from '@tanstack/react-table';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { useDbStore } from '../../../storage/store/useDbStore';
import { getSingleInitial } from '../../../shared-components/utils/avatarColors';
import type { RowData, GridRow } from '../types/spreadsheetTypes';
import { columns } from '../logic/spreadsheetColumnDefinitions';
import { getSpreadsheetDescriptionPreview, extractPlainTextFromSnippetConfig, canOpenSpreadsheetRow, hasExternalOpenerIcon, openSpreadsheetRow, openSpreadsheetRowInNewTab, } from '../logic/spreadsheetHelpers';
import SpreadsheetHeader from './spreadsheetHeader';
import { clsx } from 'clsx';
import { useSpreadsheetStore, isTagSupportedRow } from '../logic/spreadsheetStateStore';
import { SpreadsheetTagSelector } from './SpreadsheetTagSelector';
import { CommandTerminalPrefixStorage } from '../../../storage/commandTerminal/commandTerminalPrefixAdapter';
import { VisualKeyDisplay } from '../../../shared-components/hotkeys/ui/VisualKeyDisplay';
import { EditablePrefixKey } from '../../../shared-components/shortcuts/ui/EditablePrefixKey';
import { DestinationPicker } from '../../../shared-components/editorToolbar/DestinationPicker';
import { FaPlus, FaTrash, FaLock, FaGlobe, FaUsers, FaUser, FaStar, FaFilter, FaLink, FaFileAlt, FaTerminal, FaTrashAlt, FaCheck, FaBookmark, FaPuzzlePiece } from 'react-icons/fa';
import { BsPersonFill, BsPeopleFill, BsHourglassSplit } from 'react-icons/bs';
import { MdLockOutline } from 'react-icons/md';
import { FiStar, FiCheck, FiGlobe, FiFilter, FiExternalLink, FiEye, FiUsers, FiLock, FiPlus, FiLoader, FiChevronRight, FiChevronDown, FiBox, FiZap, FiSearch, FiTrash, FiFileText, FiLayout, FiMonitor, FiLink, FiCheckSquare, } from 'react-icons/fi';
import { SiGooglechrome } from 'react-icons/si';
import { TbBrandGithub, TbWorld, TbStack2 } from 'react-icons/tb';
import { FaUserCircle } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { getFaviconUrl } from '../../../shared-components/searchBarMain/utilityFunctions/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotesIcon from '../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../shared-components/icons/stackedLinkIcon';
import { GridHotkeyInput, GridCommandInput } from './spreadsheetShortcutInputs';
import { SpreadsheetMultiLinkInput } from './spreadsheetMultiLinkInput';
import { getItemCompoundId, readAllHotkeys, readAllShortcuts, } from '../../../shared-components/hotkeys/utils/hotkeyUtils';
import { BsCalendarCheck } from 'react-icons/bs';
import { SessionGridIcon } from '../../icons/sessionGridIcon';
const supportsTitleInlinePreview = (row: any) => {
    if (['bookmark', 'bookmarks'].includes(String(row.category || '').toLowerCase()))
        return false;
    const isNote = row.section === 'Notes' || row.itemType === 'note';
    const isSnippet = row.section === 'Snippets' || row.itemType === 'snippet';
    const isLink = row.section === 'Smart Links' ||
        row.section === 'Tab Sessions' ||
        row.section === 'Organisations' ||
        row.itemType === 'link' ||
        row.itemType === 'session' ||
        row.category === 'link' ||
        row.category === 'session';
    const isCommand = row.category === 'commands' || row.category === 'general_commands' || row.section === 'Browser Commands';
    return isNote || isSnippet || isLink || isCommand;
};
const getSpreadsheetRowKind = (row: any) => ({
    itemType: String(row?.itemType || '').toLowerCase(),
    section: String(row?.section || '').toLowerCase(),
    category: String(row?.category || '').toLowerCase(),
});
const supportsInlineTitleEditForRow = (row: any) => {
    const rowKind = getSpreadsheetRowKind(row);
    return (rowKind.itemType === 'link' ||
        rowKind.itemType === 'note' ||
        rowKind.itemType === 'snippet' ||
        rowKind.itemType === 'session' ||
        rowKind.itemType === 'todo' ||
        rowKind.itemType === 'agent' ||
        rowKind.itemType === 'chat_agent' ||
        rowKind.category === 'link' ||
        rowKind.category === 'note' ||
        rowKind.category === 'snippet' ||
        rowKind.category === 'session' ||
        rowKind.category === 'todo' ||
        rowKind.category === 'agent' ||
        rowKind.category === 'chatagent' ||
        rowKind.category === 'chat_agent' ||
        rowKind.section.includes('smart link') ||
        rowKind.section.includes('note') ||
        rowKind.section.includes('snippet') ||
        rowKind.section.includes('text expander') ||
        rowKind.section.includes('tab session') ||
        rowKind.section.includes('collection') ||
        rowKind.section.includes('todo') ||
        rowKind.section.includes('chat agent'));
};
const isLinkDescriptionRow = (row: any) => {
    const rowKind = getSpreadsheetRowKind(row);
    return rowKind.itemType === 'link' || rowKind.category === 'link' || rowKind.section.includes('smart link');
};
const supportsInlineDescriptionEditForRow = (row: any) => {
    const rowKind = getSpreadsheetRowKind(row);
    return (rowKind.itemType === 'note' ||
        rowKind.itemType === 'snippet' ||
        rowKind.itemType === 'todo' ||
        rowKind.itemType === 'agent' ||
        rowKind.itemType === 'chat_agent' ||
        rowKind.category === 'note' ||
        rowKind.category === 'snippet' ||
        rowKind.category === 'text_expander' ||
        rowKind.category === 'todo' ||
        rowKind.category === 'agent' ||
        rowKind.category === 'chatagent' ||
        rowKind.category === 'chat_agent' ||
        rowKind.section.includes('note') ||
        rowKind.section.includes('snippet') ||
        rowKind.section.includes('text expander') ||
        rowKind.section.includes('todo') ||
        rowKind.section.includes('chat agent'));
};
type SpreadsheetTypeInfo = {
    label: string;
    tone: 'link' | 'collection' | 'note' | 'textExpander' | 'todo' | 'command' | 'automation' | 'agent' | 'default';
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
            icon: <FaLink size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'session' || section.includes('tab session') || section.includes('collection')) {
        return {
            label: 'Workspace',
            tone: 'collection',
            foregroundClass: 'text-emerald-500 dark:text-emerald-400',
            icon: <SessionGridIcon className="w-3.5 h-3.5 shrink-0"/>,
        };
    }
    if (cat === 'note' || section.includes('note')) {
        return {
            label: 'Note',
            tone: 'note',
            foregroundClass: 'text-[#C2410C] dark:text-[#FB923C]',
            icon: <NotesIcon className="w-3.5 h-3.5 shrink-0"/>,
        };
    }
    if (cat === 'snippet' || section.includes('snippet') || section.includes('text expander')) {
        return {
            label: 'Text Expander',
            tone: 'textExpander',
            foregroundClass: 'text-purple-500 dark:text-purple-400',
            icon: <TextExpanderIcon size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'todo' || section.includes('todo')) {
        return {
            label: 'Todo',
            tone: 'todo',
            foregroundClass: 'text-cyan-500 dark:text-cyan-400',
            icon: <BsCalendarCheck size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'general_commands' || section.includes('system command')) {
        return {
            label: 'System Command',
            tone: 'command',
            foregroundClass: 'text-sky-600 dark:text-sky-300',
            icon: <FaTerminal size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'commands' || section.includes('browser command')) {
        return {
            label: 'Browser Command',
            tone: 'command',
            foregroundClass: 'text-sky-600 dark:text-sky-300',
            icon: <FaTerminal size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'automation' || section.includes('automation')) {
        return {
            label: 'Automation',
            tone: 'automation',
            foregroundClass: 'text-orange-500 dark:text-orange-400',
            icon: <FiZap size={13} className="shrink-0"/>,
        };
    }
    if (cat === 'agent' || section.includes('chat agent')) {
        return {
            label: 'Chat Agent',
            tone: 'agent',
            foregroundClass: 'text-[#7E22CE] dark:text-[#C084FC]',
            icon: <LuSparkles size={13} className="shrink-0"/>,
        };
    }
    return {
        label: row.category || 'Resource',
        tone: 'default',
        foregroundClass: 'text-[var(--color-textSecondary)]',
        icon: null,
    };
};
const BufferedCellInput = ({ initialValue, startValue, onSave, onCancel, placeholder, isReal, onNavigateFromCleanEdit, }: {
    initialValue: string;
    startValue?: string | null;
    onSave: (val: string) => void;
    onCancel: () => void;
    placeholder?: string;
    isReal: boolean;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
}) => {
    const [localValue, setLocalValue] = React.useState(startValue ?? initialValue);
    const completedRef = React.useRef(false);
    const save = () => {
        if (completedRef.current)
            return;
        completedRef.current = true;
        onSave(localValue);
    };
    return (<div className="relative w-full h-full flex items-center px-0.5">
      <input autoFocus value={localValue} placeholder={placeholder} className="w-full h-full outline-none bg-transparent text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)]" onChange={e => setLocalValue(e.target.value)} onBlur={save} onKeyDown={e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
                onNavigateFromCleanEdit?.(1, 0);
            }
            else if (e.key === 'Tab' && onNavigateFromCleanEdit) {
                e.preventDefault();
                save();
                onNavigateFromCleanEdit(0, e.shiftKey ? -1 : 1);
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                completedRef.current = true;
                onCancel();
            }
        }}/>
      {!localValue && !isReal && (<span className="absolute right-1 text-red-500 text-[10px] font-bold pointer-events-none">*</span>)}
    </div>);
};
interface SpreadsheetTableProps {
    onClose?: () => void;
    tutorialStep: number | null;
    setTutorialStep: (step: number | null) => void;
    isEmbedded?: boolean;
    compactColumns?: boolean;
}
type ActionCellTarget = 'favorite' | 'delete';
const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({ onClose, tutorialStep, setTutorialStep, compactColumns = false, }: SpreadsheetTableProps) => {
    const [localToastMsg, setLocalToastMsg] = useState<string | null>(null);
    const triggerLocalToast = (msg: string) => {
        setLocalToastMsg(msg);
        setTimeout(() => setLocalToastMsg(null), 3000);
    };
    const { tableData, selectedCell, setSelectedCell, editingCell, setEditingCell, addRow, removeRow, updateCellData, isPickerOpen, pickerRowIndex, closePicker, updateRowLocation, toggleFavorite, categoryFilter, selectedTagIds, visibilityFilter, searchTerm, columnFilters, showFavoritesOnly, showHotkeysOnly, showShortcutsOnly, showTagsOnly, spaceFilter, undoDelete, updateRowTags, } = useSpreadsheetStore();
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const tableViewportRef = React.useRef<HTMLDivElement | null>(null);
    const [dataRowHeight, setDataRowHeight] = useState<number | null>(null);
    const dbTags = useDbStore(state => state.tags) || [];
    const tagsById = useMemo(() => new Map(dbTags.map(tag => [tag.id, tag])), [dbTags]);
    const tagNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        dbTags.forEach(t => {
            map[t.id] = t.name;
        });
        return map;
    }, [dbTags]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
    const [focusedActionCell, setFocusedActionCell] = useState<{
        rowIndex: number;
        target: ActionCellTarget;
    } | null>(null);
    const focusedActionCellRef = React.useRef<typeof focusedActionCell>(null);
    const consumeHandledEscapeRef = React.useRef(false);
    const filteredData = useMemo(() => {
        const term = String(searchTerm || '')
            .toLowerCase()
            .trim();
        return tableData.filter((r): r is RowData => {
            if (r.type !== 'data')
                return false;
            const hasTagMatch = Array.isArray((r as any).tagIds) &&
                (r as any).tagIds.some((id: string) => {
                    const tagName = tagNamesMap[id];
                    return tagName && tagName.toLowerCase().includes(term);
                });
            const matchesSearch = !term ||
                String(r.name || '')
                    .toLowerCase()
                    .includes(term) ||
                String(r.url || '')
                    .toLowerCase()
                    .includes(term) ||
                (Array.isArray((r as any).urls) &&
                    (r as any).urls.some((u: any) => String(u || '')
                        .toLowerCase()
                        .includes(term))) ||
                String(r.value || '')
                    .toLowerCase()
                    .includes(term) ||
                String(r.path || '')
                    .toLowerCase()
                    .includes(term) ||
                String('')
                    .toLowerCase()
                    .includes(term) ||
                String(r.key || '')
                    .toLowerCase()
                    .includes(term) ||
                String((r as any).hotkey || '')
                    .toLowerCase()
                    .includes(term) ||
                String(r.command || '')
                    .toLowerCase()
                    .includes(term) ||
                String((r as any).shortcut || '')
                    .toLowerCase()
                    .includes(term) ||
                String((r as any).description || '')
                    .toLowerCase()
                    .includes(term) ||
                String((r as any).organisation_name || '')
                    .toLowerCase()
                    .includes(term) ||
                hasTagMatch ||
                (Array.isArray((r as any).tags) &&
                    (r as any).tags.some((t: any) => String(t || '')
                        .toLowerCase()
                        .includes(term))) ||
                (typeof (r as any).tags === 'string' &&
                    String((r as any).tags || '')
                        .toLowerCase()
                        .includes(term));
            if (!matchesSearch)
                return false;
            if (!visibilityFilter.includes('all')) {
                const v = r.visibilityType || 'lock';
                const mappedV = v === 'lock' || v === 'personal'
                    ? 'private'
                    : v === 'globe'
                        ? 'public'
                        : v === 'users'
                            ? 'shared'
                            : 'private';
                if (!visibilityFilter.includes(mappedV))
                    return false;
            }
            if (!categoryFilter.includes('all')) {
                const cat = r.category || 'note';
                if (!categoryFilter.includes(cat))
                    return false;
            }
            if (selectedTagIds.length > 0) {
                const rowTagIds = Array.isArray((r as any).tagIds) ? (r as any).tagIds : [];
                const legacyTags = Array.isArray((r as any).tags) ? (r as any).tags : [];
                const matchesTag = selectedTagIds.some(tagId => rowTagIds.includes(tagId) ||
                    legacyTags.some(tag => String(tag).toLowerCase() === tagId.toLowerCase() ||
                        Boolean(tagNamesMap[tagId]) && String(tag).toLowerCase() === tagNamesMap[tagId].toLowerCase()));
                if (!matchesTag)
                    return false;
            }
            if (showFavoritesOnly && !r.fav)
                return false;
            if (showHotkeysOnly && !r.key)
                return false;
            if (showShortcutsOnly && !r.command)
                return false;
            if (showTagsOnly && (!Array.isArray((r as any).tagIds) || (r as any).tagIds.length === 0))
                return false;
            const columnFilterMatch = Object.entries(columnFilters).every(([colId, filterVal]) => {
                const cleanedFilter = filterVal.toLowerCase().trim();
                if (!cleanedFilter)
                    return true;
                let val = '';
                if (colId === 'name') {
                    const titleVal = String(r.name || (r as any).title || '');
                    const descVal = getSpreadsheetDescriptionPreview(r);
                    val = `${titleVal} ${descVal}`;
                }
                else if (colId === 'url') {
                    const rawVal = r.url || r.value || '';
                    if (typeof rawVal === 'object' && rawVal && 'urls' in rawVal) {
                        val = Array.isArray((rawVal as any).urls) ? (rawVal as any).urls.join(' ') : '';
                    }
                    else {
                        val = String(rawVal);
                    }
                }
                else if (colId === 'path') {
                    val = String(r.path || '');
                }
                else if (colId === 'key') {
                    val = String(r.key || '');
                }
                else if (colId === 'command') {
                    val = String(r.command || '');
                }
                else if (colId === 'tags') {
                    if (Array.isArray((r as any).tagIds)) {
                        val = (r as any).tagIds.map((id: string) => tagNamesMap[id] || '').join(' ');
                    }
                    else if (Array.isArray((r as any).tags)) {
                        val = (r as any).tags.join(' ');
                    }
                    else {
                        val = String((r as any).tags || '');
                    }
                }
                return val.toLowerCase().includes(cleanedFilter);
            });
            if (!columnFilterMatch)
                return false;
            return true;
        });
    }, [
        tableData,
        categoryFilter,
        selectedTagIds,
        visibilityFilter,
        searchTerm,
        columnFilters,
        showFavoritesOnly,
        showHotkeysOnly,
        showShortcutsOnly,
        showTagsOnly,
        spaceFilter,
        tagNamesMap
    ]);
    const columnVisibility = useMemo<Record<string, boolean>>(() => ({}), []);
    const tableColumns = useMemo(() => compactColumns
        ? columns.map(column => ({
            ...column,
            size: Math.max(36, Math.round((column.size || 100) * 0.82)),
        }))
        : columns, [compactColumns]);
    const table = useReactTable({
        data: filteredData,
        columns: tableColumns,
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
    const visibleRows = table.getRowModel().rows;
    const groupedRows = useMemo(() => {
        const groups: Array<{
            key: string;
            tone: SpreadsheetTypeInfo['tone'];
            rows: Array<{
                tableRow: (typeof visibleRows)[number];
                visualIndex: number;
            }>;
        }> = [];
        visibleRows.forEach((tableRow, visualIndex) => {
            const typeInfo = getTypeInfo(tableRow.original);
            const previousGroup = groups[groups.length - 1];
            if (!previousGroup || previousGroup.tone !== typeInfo.tone) {
                groups.push({
                    key: `${typeInfo.tone}-${visualIndex}`,
                    tone: typeInfo.tone,
                    rows: [],
                });
            }
            groups[groups.length - 1].rows.push({ tableRow, visualIndex });
        });
        return groups;
    }, [visibleRows]);
    const visibleColumns = table.getVisibleLeafColumns();
    const visibleColumnCount = visibleColumns.length;
    const isMultiLinkCellEditing = React.useMemo(() => {
        if (!editingCell)
            return false;
        const tableRow = table.getRowModel().rows[editingCell.rowIndex];
        const column = visibleColumns[editingCell.colIndex];
        return Boolean(tableRow && column?.id === 'url' && isLinkDescriptionRow(tableRow.original));
    }, [editingCell, table, visibleColumns]);
    const getColumnDisplaySize = React.useCallback((columnId: string, fallbackSize: number) => {
        if (!isMultiLinkCellEditing)
            return fallbackSize;
        const expandedSizes: Record<string, number> = {
            url: 360,
            command: 100,
            key: 80,
            tags: 55,
            actions: 55,
        };
        return expandedSizes[columnId] ?? fallbackSize;
    }, [isMultiLinkCellEditing]);
    const getActionTargetsForRow = React.useCallback((row: RowData | GridRow | any): ActionCellTarget[] => {
        if (row?.isDeleting)
            return ['delete'];
        const targets: ActionCellTarget[] = [];
        if (row?.section !== 'Bookmarks') {
            targets.push('favorite');
        }
        targets.push('delete');
        return targets;
    }, []);
    const getDefaultActionTargetForRow = React.useCallback((row: RowData | GridRow | any): ActionCellTarget => getActionTargetsForRow(row)[0] || 'delete', [getActionTargetsForRow]);
    const selectCell = React.useCallback((targetRowIndex: number, targetColIndex: number, shouldAutoEdit = false, actionTarget?: ActionCellTarget) => {
        const nextCell = { rowIndex: targetRowIndex, colIndex: targetColIndex };
        const tableRow = table.getRowModel().rows[targetRowIndex];
        const targetColumn = table.getVisibleLeafColumns()[targetColIndex];
        let nextEditingCell: typeof nextCell | null = null;
        if (shouldAutoEdit && tableRow && targetColumn) {
            const colId = targetColumn.id;
            const row = tableRow.original as any;
            const shouldAutoEditCell = colId === 'command' ||
                colId === 'key' ||
                (colId === 'tags' && isTagSupportedRow(row)) ||
                (colId === 'name' && supportsInlineTitleEditForRow(row)) ||
                (colId === 'url' && (supportsInlineDescriptionEditForRow(row) || isLinkDescriptionRow(row)));
            if (shouldAutoEditCell) {
                nextEditingCell = nextCell;
            }
        }
        setSelectedCell(nextCell);
        setEditingCell(nextEditingCell);
        const actionTargets = tableRow ? getActionTargetsForRow(tableRow.original) : [];
        const resolvedActionTarget = actionTarget && actionTargets.includes(actionTarget)
            ? actionTarget
            : getDefaultActionTargetForRow(tableRow?.original);
        const nextFocusedActionCell = targetColumn?.id === 'actions' && tableRow ? { rowIndex: targetRowIndex, target: resolvedActionTarget } : null;
        focusedActionCellRef.current = nextFocusedActionCell;
        setFocusedActionCell(nextFocusedActionCell);
        if (!nextEditingCell) {
            window.requestAnimationFrame(() => {
                const state = useSpreadsheetStore.getState();
                if (state.editingCell ||
                    state.selectedCell?.rowIndex !== targetRowIndex ||
                    state.selectedCell?.colIndex !== targetColIndex) {
                    return;
                }
                document
                    .querySelector<HTMLElement>(`[data-spreadsheet-cell="${targetRowIndex}-${targetColIndex}"]`)
                    ?.focus({ preventScroll: true });
            });
        }
    }, [getActionTargetsForRow, getDefaultActionTargetForRow, setEditingCell, setSelectedCell, table]);
    const visibleColumnIndexes = React.useMemo(() => visibleColumns.map((_, index) => index), [visibleColumns]);
    const visibleRowIds = React.useMemo(() => visibleRows.map(row => String(row.original.id)), [visibleRows]);
    const selectFromEngine = React.useCallback((cell: {
        rowIndex: number;
        colIndex: number;
    }, edit: boolean) => {
        const previous = useSpreadsheetStore.getState().selectedCell;
        const keepActionTarget = previous?.colIndex === cell.colIndex && visibleColumns[cell.colIndex]?.id === 'actions'
            ? focusedActionCellRef.current?.target
            : undefined;
        selectCell(cell.rowIndex, cell.colIndex, edit, keepActionTarget);
    }, [selectCell, visibleColumns]);
    const { moveCell: moveSelectedCell, handleCellKeyDown, initialTypedValue, } = useSheetEngine({
        rowCount: visibleRows.length,
        rowIds: visibleRowIds,
        visibleColumnIndexes,
        selectedCell,
        editingCell,
        onSelect: selectFromEngine,
    });
    const exitCellEditMode = React.useCallback((cell = useSpreadsheetStore.getState().editingCell) => {
        if (!cell)
            return false;
        setEditingCell(null);
        setSelectedCell(cell);
        window.requestAnimationFrame(() => {
            document.querySelector<HTMLElement>(`[data-spreadsheet-cell="${cell.rowIndex}-${cell.colIndex}"]`)?.focus();
        });
        return true;
    }, [setEditingCell, setSelectedCell]);
    React.useEffect(() => {
        focusedActionCellRef.current = focusedActionCell;
    }, [focusedActionCell]);
    React.useEffect(() => {
        const element = tableViewportRef.current;
        if (!element)
            return;
        let observedRow: HTMLTableRowElement | null = null;
        const updateHeight = () => {
            const row = element.querySelector<HTMLTableRowElement>('tr[data-row-index]');
            if (!row)
                return;
            setDataRowHeight(row.getBoundingClientRect().height);
            observedRow = row;
        };
        updateHeight();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateHeight);
            return () => window.removeEventListener('resize', updateHeight);
        }
        const observer = new ResizeObserver(updateHeight);
        const observeCurrentRow = () => {
            const row = element.querySelector<HTMLTableRowElement>('tr[data-row-index]');
            if (row && row !== observedRow) {
                if (observedRow)
                    observer.unobserve(observedRow);
                observedRow = row;
                observer.observe(row);
                updateHeight();
            }
        };
        observeCurrentRow();
        observer.observe(element);
        return () => observer.disconnect();
    }, [visibleRows.length, columnSizing]);
    React.useEffect(() => {
        return useUIStore.getState().registerEscapeInterceptor(() => {
            const state = useSpreadsheetStore.getState();
            if (state.isPickerOpen) {
                consumeHandledEscapeRef.current = true;
                state.closePicker();
                return true;
            }
            if (state.editingCell !== null) {
                consumeHandledEscapeRef.current = true;
                exitCellEditMode(state.editingCell);
                return true;
            }
            if (state.selectedCell !== null) {
                consumeHandledEscapeRef.current = true;
                state.setSelectedCell(null);
                focusedActionCellRef.current = null;
                setFocusedActionCell(null);
                return true;
            }
            return false;
        });
    }, [exitCellEditMode]);
    // Only sheet-level shortcuts remain global. Cell keys are owned by useSheetEngine.
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const state = useSpreadsheetStore.getState();
            const path = event.composedPath ? event.composedPath() : [];
            const target = (path.length > 0 ? path[0] : event.target) as HTMLElement;
            const isSearchInput = target.tagName === 'INPUT' && (target as HTMLInputElement).id?.startsWith('sheet-search-');
            if (event.key === 'Escape') {
                if (consumeHandledEscapeRef.current) {
                    consumeHandledEscapeRef.current = false;
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
                if (event.defaultPrevented || useUIStore.getState().activeEditor)
                    return;
                if (state.editingCell) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    exitCellEditMode(state.editingCell);
                }
                else if (state.selectedCell) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    state.setSelectedCell(null);
                    focusedActionCellRef.current = null;
                    setFocusedActionCell(null);
                }
                else if (state.isPickerOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.closePicker();
                }
                else {
                    event.preventDefault();
                    event.stopPropagation();
                    onClose?.();
                }
                return;
            }
            if (event.defaultPrevented)
                return;
            if (event.altKey && event.key.toLowerCase() === 'a') {
                event.preventDefault();
                event.stopPropagation();
                if (visibleRows.length > 0)
                    state.setSelectedCell({ rowIndex: 0, colIndex: 0 });
                const nameSearch = document.getElementById('sheet-search-name') as HTMLInputElement | null;
                nameSearch?.focus();
                nameSearch?.select();
                return;
            }
            if (isSearchInput && (event.key === 'ArrowDown' || event.key === 'Tab')) {
                if (visibleRows.length > 0) {
                    event.preventDefault();
                    selectCell(0, 0);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [exitCellEditMode, onClose, selectCell, visibleRows.length]);
    return (<div className="flex flex-col items-center w-full relative">
      <AnimatePresence>
        {localToastMsg && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute -top-12 z-[2147483647] px-4 py-2 bg-[var(--color-popupBg)] rounded border border-[var(--color-borderDefault)] shadow-xl">
            <span className="text-[var(--color-textPrimary)] text-xs font-medium">{localToastMsg}</span>
          </motion.div>)}
      </AnimatePresence>
      <div ref={tableViewportRef} className="w-full">
        <table className={clsx('w-full border-collapse table-fixed group/sidebar', 'bg-transparent')}>
          <colgroup>
            {visibleColumns.map(column => (<col key={column.id} style={{ width: getColumnDisplaySize(column.id, column.getSize()) }}/>))}
          </colgroup>
          <SpreadsheetHeader table={table} tutorialStep={tutorialStep} setTutorialStep={setTutorialStep} getColumnDisplaySize={getColumnDisplaySize}/>
          {groupedRows.map((group, groupIndex) => (<tbody key={group.key} className="group/type-section bg-transparent">
              {groupIndex > 0 && (<tr className="h-9 bg-transparent">
                  <td colSpan={visibleColumnCount} className="h-9 p-0 border-b border-[var(--color-borderDefault)]"/>
                </tr>)}
              {group.rows.map(({ tableRow, visualIndex }) => {
                if (!tableRow)
                    return null;
                const isSelectedRow = selectedCell?.rowIndex === visualIndex;
                return (<tr key={tableRow.id || `row-${visualIndex}`} data-row-index={visualIndex} className={clsx('group/row grow h-auto min-h-[36px] transition-all duration-150', 'border-b border-[var(--color-borderDefault)] divide-x divide-[var(--color-borderDefault)]', (tableRow.original as any).isDeleting
                        ? 'bg-red-900/20'
                        : isSelectedRow
                            ? 'bg-transparent text-[var(--color-textPrimary)] font-medium'
                            : 'bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]')}>
                    {tableRow.getVisibleCells().map((cell, index) => {
                        const isSelected = selectedCell?.rowIndex === visualIndex && selectedCell?.colIndex === index;
                        const isEditing = editingCell?.rowIndex === visualIndex && editingCell?.colIndex === index;
                        const focusedActionTarget = isSelected &&
                            cell.column.id === 'actions' &&
                            focusedActionCell?.rowIndex === visualIndex
                            ? focusedActionCell.target
                            : null;
                        const value = cell.getValue() as string;
                        const supportsInlineTitleEdit = supportsInlineTitleEditForRow(tableRow.original);
                        const supportsInlineDescriptionEdit = cell.column.id === 'url' && supportsInlineDescriptionEditForRow(tableRow.original);
                        const isLinkDescriptionCell = cell.column.id === 'url' && isLinkDescriptionRow(tableRow.original);
                        const isEditorBackedDescriptionCell = cell.column.id === 'url' &&
                            !isLinkDescriptionCell &&
                            !supportsInlineDescriptionEdit &&
                            canOpenSpreadsheetRow(tableRow.original);
                        const canEditCell = () => {
                            const r = tableRow.original as any;
                            if (cell.column.id === 'tags') {
                                return isTagSupportedRow(r);
                            }
                            if (cell.column.id === 'name') {
                                return supportsInlineTitleEdit;
                            }
                            if (isLinkDescriptionCell) {
                                return true;
                            }
                            if (supportsInlineDescriptionEdit) {
                                return true;
                            }
                            if (isEditorBackedDescriptionCell) {
                                return false;
                            }
                            const isAgent = ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(String(r.category || '').toLowerCase()) || r.section === 'Chat Agents';
                            const isBookmark = ['bookmark', 'bookmarks'].includes(String(r.category || '').toLowerCase()) ||
                                r.section === 'Bookmarks';
                            const isBrowserCommand = ['commands', 'general_commands', 'command'].includes(String(r.category || '').toLowerCase()) || r.section === 'Browser Commands';
                            const isCellBlocked = cell.column.id === 'name' || (cell.column.id === 'url' && (isBookmark || isBrowserCommand));
                            const isPrefixCommandRow = String(r.itemType || '').toLowerCase() === 'prefix_command';
                            const isReadonlyCol = cell.column.id === 'name' ||
                                cell.column.id === 'url' ||
                                (isPrefixCommandRow && cell.column.id === 'command');
                            return (!isCellBlocked &&
                                !isReadonlyCol &&
                                !(isAgent && cell.column.id === 'name') &&
                                cell.column.id !== 'type' &&
                                cell.column.id !== 'rowNumber' &&
                                cell.column.id !== 'actions');
                        };
                        return (<td key={cell.id} data-cell-id={cell.id} data-spreadsheet-cell={`${visualIndex}-${index}`} tabIndex={isSelected ? 0 : -1} onFocus={event => {
                                if (event.target !== event.currentTarget || isSelected)
                                    return;
                                selectCell(visualIndex, index);
                            }} onClick={() => {
                                if (isEditing)
                                    return;
                                if (isEditorBackedDescriptionCell ||
                                    (cell.column.id === 'name' && !supportsInlineTitleEdit && canOpenSpreadsheetRow(tableRow.original))) {
                                    openSpreadsheetRow(tableRow.original);
                                }
                                else {
                                    selectCell(visualIndex, index, canEditCell());
                                }
                            }} onKeyDown={event => {
                                if (isPickerOpen || event.target !== event.currentTarget)
                                    return;
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setSelectedCell(null);
                                    focusedActionCellRef.current = null;
                                    setFocusedActionCell(null);
                                    return;
                                }
                                const position = { rowIndex: visualIndex, colIndex: index };
                                if (cell.column.id === 'actions') {
                                    const targets = getActionTargetsForRow(tableRow.original);
                                    const currentTarget = focusedActionCellRef.current?.rowIndex === visualIndex &&
                                        targets.includes(focusedActionCellRef.current.target)
                                        ? focusedActionCellRef.current.target
                                        : targets[0];
                                    const targetIndex = targets.indexOf(currentTarget);
                                    if (event.key === 'ArrowRight' && targetIndex < targets.length - 1) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const nextAction = { rowIndex: visualIndex, target: targets[targetIndex + 1] };
                                        focusedActionCellRef.current = nextAction;
                                        setFocusedActionCell(nextAction);
                                        return;
                                    }
                                    if (event.key === 'ArrowLeft' && targetIndex > 0) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const nextAction = { rowIndex: visualIndex, target: targets[targetIndex - 1] };
                                        focusedActionCellRef.current = nextAction;
                                        setFocusedActionCell(nextAction);
                                        return;
                                    }
                                    handleCellKeyDown(event, position, 'action', () => {
                                        if (tableRow.original.isDeleting) {
                                            useSpreadsheetStore.getState().undoDelete(tableRow.original.id);
                                        }
                                        else if (currentTarget === 'favorite') {
                                            toggleFavorite(tableRow.original.id as string);
                                        }
                                        else {
                                            useSpreadsheetStore.getState().removeRow(tableRow.original.id);
                                        }
                                    });
                                    return;
                                }
                                const isPlainTextCell = cell.column.id === 'name' || (cell.column.id === 'url' && !isLinkDescriptionCell);
                                const cellKind = !canEditCell() ? 'readonly' : isPlainTextCell ? 'text' : 'popup';
                                handleCellKeyDown(event, position, cellKind);
                            }} className={clsx('text-[11px] cursor-pointer transition-all relative h-auto min-h-[36px]', index === 0 && 'border-l border-[var(--color-borderDefault)]', cell.column.id === 'rowNumber' || cell.column.id === 'actions'
                                ? 'p-0 text-center align-middle'
                                : cell.column.id === 'key' || cell.column.id === 'type'
                                    ? 'px-1 py-1 align-middle'
                                    : cell.column.id === 'url' && isSelected
                                        ? 'px-[2px] py-1 align-middle'
                                        : 'px-2 py-1 align-middle', isSelected && cell.column.id !== 'actions'
                                ? 'text-[var(--color-textPrimary)] ring-1 ring-[var(--color-borderActive)] ring-inset rounded bg-transparent z-[50] overflow-visible py-[2px]'
                                : isSelected
                                    ? 'text-[var(--color-textPrimary)] bg-transparent z-[50] overflow-visible py-[2px]'
                                    : 'text-[var(--color-textPrimary)] py-[1.5px]', tableRow.original.isDeleting &&
                                (cell.column.id !== 'actions'
                                    ? 'opacity-40 grayscale pointer-events-none'
                                    : 'opacity-100'))} style={{
                                width: getColumnDisplaySize(cell.column.id, cell.column.getSize()),
                                ...(cell.column.id === 'url' ? { borderLeftWidth: 0 } : {}),
                            }}>
                          {cell.column.id === 'rowNumber' ? (<span className="text-[11px] font-mono font-medium text-[var(--color-textMuted)] flex justify-center items-center w-full select-none">
                              {visualIndex + 1}
                            </span>) : cell.column.id === 'type' ? (<div className="flex items-center px-1">
                              {(() => {
                                    const typeInfo = getTypeInfo(tableRow.original);
                                    return (<span className={clsx('inline-flex items-center gap-1.5 text-[12px] font-normal leading-none shrink-0 select-none whitespace-nowrap opacity-80', typeInfo.foregroundClass)}>
                                    {typeInfo.icon}
                                    <span>{typeInfo.label}</span>
                                  </span>);
                                })()}
                            </div>) : cell.column.id === 'actions' ? ((tableRow.original as any).isDeleting ? (<div className="flex items-center justify-center w-full h-full">
                                <button type="button" tabIndex={-1} aria-label="Undo delete" onClick={e => {
                                    e.stopPropagation();
                                    useSpreadsheetStore.getState().undoDelete(tableRow.original.id);
                                }} className={clsx('text-blue-400 hover:text-blue-300 text-[10px] font-bold px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20', focusedActionTarget === 'delete' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset')}>
                                  UNDO
                                </button>
                              </div>) : (<div className="flex items-center justify-center gap-1 w-full h-full min-h-[28px]">
                                {tableRow.original.section !== 'Bookmarks' && (<button type="button" tabIndex={-1} aria-label={tableRow.original.fav ? 'Remove favorite' : 'Add favorite'} className={clsx('flex items-center justify-center w-7 h-7 rounded text-[var(--color-iconDefault)] hover:text-amber-400 transition-colors focus:outline-none', focusedActionTarget === 'favorite' &&
                                        'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-amber-400')} onMouseDown={event => {
                                        event.preventDefault();
                                        selectCell(visualIndex, index, false, 'favorite');
                                    }} onClick={e => {
                                        e.stopPropagation();
                                        toggleFavorite(tableRow.original.id as string);
                                    }}>
                                    {tableRow.original.syncStatus === 'syncing' ? (<FiLoader className="animate-spin text-xs"/>) : tableRow.original.fav ? (<FaStar className="text-amber-400 text-xs"/>) : (<FiStar className="text-xs"/>)}
                                  </button>)}
                                <button type="button" tabIndex={-1} aria-label="Delete row" onMouseDown={event => {
                                    event.preventDefault();
                                    selectCell(visualIndex, index, false, 'delete');
                                }} onClick={e => {
                                    e.stopPropagation();
                                    useSpreadsheetStore.getState().removeRow(tableRow.original.id);
                                }} className={clsx('flex items-center justify-center w-7 h-7 rounded text-[var(--color-iconDefault)] hover:text-[var(--color-error)] transition-all opacity-70 hover:opacity-100 focus:outline-none', focusedActionTarget === 'delete' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-[var(--color-error)] opacity-100')}>
                                  <FiTrash size={14}/>
                                </button>
                              </div>)) : isEditing ? (cell.column.id === 'key' ? (<GridHotkeyInput navigateOnCleanArrow={false} itemId={getItemCompoundId(tableRow.original)} initialValue={value || ''} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={(val: string) => {
                                    updateCellData(tableRow.original.id, index, cell.column.id, val);
                                    setEditingCell(null);
                                }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })} onOverwrite={(val: string, conflictId?: string) => {
                                    useSpreadsheetStore
                                        .getState()
                                        .overwriteCellData(tableRow.original.id, index, cell.column.id, val, conflictId || '');
                                    setEditingCell(null);
                                }}/>) : cell.column.id === 'tags' ? (<SpreadsheetTagSelector keepOpenOnEnter cellElement={document.querySelector(`[data-cell-id="${cell.id}"]`)} initialTagIds={(tableRow.original as any).tagIds || []} organisationId={(tableRow.original as any).organisationId ||
                                    (tableRow.original as any).organisation_id} entityType={(tableRow.original as any).itemType ||
                                    (tableRow.original as any).category} onNavigateFromCleanEdit={moveSelectedCell} onSave={async (newTagIds) => {
                                    await updateRowTags(tableRow.original.id, newTagIds);
                                }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })}/>) : cell.column.id === 'command' ? (<GridCommandInput navigateOnCleanArrow={false} itemId={getItemCompoundId(tableRow.original)} initialValue={value || ''} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={(val: string) => {
                                    updateCellData(tableRow.original.id, index, cell.column.id, val);
                                    setEditingCell(null);
                                }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })} onOverwrite={(val: string, conflictId?: string) => {
                                    useSpreadsheetStore
                                        .getState()
                                        .overwriteCellData(tableRow.original.id, index, cell.column.id, val, conflictId || '');
                                    setEditingCell(null);
                                }}/>) : cell.column.id === 'url' ? ((() => {
                                const isChatAgentLike = !!tableRow.original.automationData ||
                                    tableRow.original.section === 'Chat Agents' ||
                                    ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(String(tableRow.original.category || '').toLowerCase()) ||
                                    (tableRow.original.itemType === 'agent' && !!tableRow.original.automationData);
                                const isSnippetOrNote = tableRow.original.section === 'Notes' ||
                                    tableRow.original.section === 'Snippets' ||
                                    tableRow.original.itemType === 'note' ||
                                    tableRow.original.itemType === 'snippet' ||
                                    tableRow.original.category === 'note' ||
                                    tableRow.original.category === 'snippet' ||
                                    tableRow.original.category === 'text_expander' ||
                                    String(tableRow.original.section || '')
                                        .toLowerCase()
                                        .includes('text expander');
                                const isTodoLike = tableRow.original.section === 'Todos' ||
                                    tableRow.original.itemType === 'todo' ||
                                    tableRow.original.category === 'todo' ||
                                    String(tableRow.original.section || '')
                                        .toLowerCase()
                                        .includes('todo');
                                if (isSnippetOrNote || isTodoLike || isChatAgentLike) {
                                    const initialDescription = isSnippetOrNote
                                        ? extractPlainTextFromSnippetConfig(tableRow.original.value || (tableRow.original as any).description)
                                        : (tableRow.original as any).description ||
                                            tableRow.original.url ||
                                            tableRow.original.value ||
                                            '';
                                    return (<BufferedCellInput initialValue={initialDescription} startValue={initialTypedValue} placeholder="Enter description" isReal={!!tableRow.original.isReal} onNavigateFromCleanEdit={moveSelectedCell} onSave={val => {
                                            updateCellData(tableRow.original.id, index, cell.column.id, val);
                                            setEditingCell(null);
                                        }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })}/>);
                                }
                                return (<SpreadsheetMultiLinkInput navigateOnCleanArrow={false} initialUrls={tableRow.original.urls || []} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} expandedWidth="100%" onSave={(val: string) => {
                                        updateCellData(tableRow.original.id, index, cell.column.id, val);
                                        setEditingCell(null);
                                    }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })}/>);
                            })()) : (<BufferedCellInput initialValue={value || ''} startValue={initialTypedValue} placeholder="Enter title" isReal={!!tableRow.original.isReal} onNavigateFromCleanEdit={moveSelectedCell} onSave={val => {
                                    updateCellData(tableRow.original.id, index, cell.column.id, val);
                                    setEditingCell(null);
                                }} onCancel={() => exitCellEditMode({ rowIndex: visualIndex, colIndex: index })}/>)) : (<div className={clsx('max-w-full flex items-center gap-2', 'truncate whitespace-nowrap')}>
                              {cell.column.id === 'name' ? (<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 w-full max-w-full min-w-0 py-1 h-full select-none overflow-hidden">
                                  <div className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-1.5 min-w-0 w-full overflow-hidden">
                                    <div className="w-6 min-w-6 flex items-center justify-center overflow-hidden">
                                      {(() => {
                                        const rowItem = tableRow.original;
                                        const cat = String(rowItem.category || '').toLowerCase();
                                        const sec = String(rowItem.section || '').toLowerCase();
                                        const itemType = String(rowItem.itemType || '').toLowerCase();
                                        const isCommand = ['commands', 'general_commands', 'command'].includes(cat) ||
                                            sec.includes('browser command') ||
                                            sec.includes('system command') ||
                                            itemType === 'command';
                                        const isLink = !isCommand &&
                                            (itemType === 'link' ||
                                                itemType === 'session' ||
                                                ['bookmark', 'bookmarks'].includes(cat));
                                        return (<>
                                            {isLink && (<StackedLinkIcon urls={rowItem.urls || []} size={14} fallback={['bookmark', 'bookmarks'].includes(cat)
                                                    ? 'link'
                                                    : ['tabgroup', 'session', 'sessions', 'tab session'].includes(cat)
                                                        ? 'tabgroup'
                                                        : 'link'} maxIcons={3}/>)}
                                            {itemType === 'note' && (<NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5"/>)}
                                            {itemType === 'snippet' && (<TextExpanderIcon size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5"/>)}
                                            {(itemType === 'todo' || sec.includes('todo') || cat === 'todo') && (<BsCalendarCheck size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5"/>)}
                                            {isCommand &&
                                                (typeof rowItem.icon_host === 'string' && rowItem.icon_host ? (<img src={getFaviconUrl(rowItem.icon_host)} alt="" className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"/>) : (<FaTerminal size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5"/>))}
                                            {!isCommand &&
                                                (itemType === 'agent' ||
                                                    sec.includes('chat agent') ||
                                                    ['chatagent', 'chat_agent', 'agent'].includes(cat) ? (<LuSparkles size={14} className="shrink-0 text-[var(--color-iconDefault)] ml-0.5"/>) : ['aiprompt', 'ai_prompt', 'prompt'].includes(cat) ||
                                                    cat === 'module' ? (typeof rowItem.icon_host === 'string' && rowItem.icon_host ? (<img src={getFaviconUrl(rowItem.icon_host)} alt="" className="shrink-0 w-3.5 h-3.5 object-contain rounded-sm"/>) : !isLink ? (<LuSparkles size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>) : null) : null)}
                                          </>);
                                    })()}
                                    </div>
                                    <span className="font-medium text-[var(--color-textPrimary)] truncate min-w-0">
                                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </span>
                                  </div>

                                  <div className="flex shrink-0 items-center justify-center gap-0.5 min-w-0">
                                    {canOpenSpreadsheetRow(tableRow.original) && (<button type="button" onClick={e => {
                                            e.stopPropagation();
                                            openSpreadsheetRow(tableRow.original);
                                        }} title="Open overlay editor" aria-label="Open overlay editor" className="shrink-0 p-0.5 rounded opacity-0 group-hover/row:opacity-100 transition-all hover:bg-[var(--color-hoverBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] focus:outline-none">
                                        <FiEye size={13} className="shrink-0"/>
                                      </button>)}
                                    {hasExternalOpenerIcon(tableRow.original) ? (<button type="button" onClick={e => {
                                            e.stopPropagation();
                                            openSpreadsheetRowInNewTab(tableRow.original);
                                        }} title="Open in new tab" aria-label="Open in new tab" className="shrink-0 p-0.5 rounded hover:bg-[var(--color-hoverBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-accent)] transition-colors focus:outline-none">
                                        <FiExternalLink size={13} className="shrink-0"/>
                                      </button>) : null}
                                  </div>
                                </div>) : cell.column.id === 'tags' ? ((() => {
                                    const row = tableRow.original as any;
                                    const tagIds = row.tagIds || [];
                                    if (tagIds.length === 0)
                                        return null;
                                    return (<div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden text-[var(--color-textSecondary)] text-[11px] font-normal px-1" title={tagIds.map((tid: string) => tagNamesMap[tid] || tid).join(', ')}>
                                      {tagIds.map((tid: string, index: number) => {
                                          const tag = tagsById.get(tid);
                                          return <span key={`${tid}-${index}`} className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1">
                                            {tag && (!tag.workspaceId || tag.appearance) && <TagAppearance tag={tag}/>}
                                            <span className="truncate">{tag?.name || tid}{index < tagIds.length - 1 ? ',' : ''}</span>
                                          </span>;
                                      })}
                                    </div>);
                                })()) : cell.column.id === 'key' ? (<div className="flex justify-center w-full">
                                  {value && <VisualKeyDisplay hotkey={value} variant="text"/>}
                                </div>) : cell.column.id === 'command' ? (<div className="flex items-center w-full px-1">
                                  <span className="text-[11px] font-normal text-[var(--color-textSecondary)] whitespace-nowrap" title={value ? `c_${String(value)}` : undefined}>
                                    {value ? `c_${String(value)}` : ''}
                                  </span>
                                </div>) : cell.column.id === 'url' ? ((() => {
                                    const row = tableRow.original as any;
                                    const isSnippetOrNote = row.section === 'Notes' ||
                                        row.section === 'Snippets' ||
                                        row.itemType === 'note' ||
                                        row.itemType === 'snippet' ||
                                        row.category === 'note' ||
                                        row.category === 'snippet' ||
                                        row.category === 'text_expander' ||
                                        String(row.section || '')
                                            .toLowerCase()
                                            .includes('text expander');
                                    const isTodoLike = row.section === 'Todos' ||
                                        row.itemType === 'todo' ||
                                        row.category === 'todo' ||
                                        String(row.section || '')
                                            .toLowerCase()
                                            .includes('todo');
                                    const isChatAgentLike = !!row.automationData ||
                                        row.section === 'Chat Agents' ||
                                        row.itemType === 'agent' ||
                                        row.itemType === 'chat_agent' ||
                                        ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(String(row.category || '').toLowerCase());
                                    if (isSnippetOrNote || isTodoLike || isChatAgentLike) {
                                        const textPreview = isSnippetOrNote
                                            ? extractPlainTextFromSnippetConfig(row.value || row.description)
                                            : row.description || row.url || row.value || '';
                                        return (<div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-[var(--color-textSecondary)]">
                                        {textPreview}
                                      </div>);
                                    }
                                    const isSession = row.itemType === 'session' ||
                                        row.category === 'session' ||
                                        ['session', 'sessions', 'tab session', 'collection'].includes(String(row.category || '').toLowerCase()) ||
                                        String(row.section || '')
                                            .toLowerCase()
                                            .includes('tab session') ||
                                        String(row.section || '')
                                            .toLowerCase()
                                            .includes('collection');
                                    let urls: string[] = Array.isArray(row.urls) ? row.urls : [];
                                    if (urls.length === 0 && (row.value || row.url)) {
                                        const rawVal = row.value || row.url;
                                        try {
                                            if (typeof rawVal === 'string' &&
                                                (rawVal.startsWith('{') || rawVal.startsWith('['))) {
                                                const parsed = JSON.parse(rawVal);
                                                if (Array.isArray(parsed.urls))
                                                    urls = parsed.urls;
                                            }
                                            else if (typeof rawVal === 'object' && Array.isArray(rawVal.urls)) {
                                                urls = rawVal.urls;
                                            }
                                            else if (typeof rawVal === 'string' && rawVal.trim() && !isSession) {
                                                urls = [rawVal.trim()];
                                            }
                                        }
                                        catch {
                                            // ignore
                                        }
                                    }
                                    if (urls.length === 0) {
                                        return (<div className="flex-1 truncate text-[11px] leading-tight flex items-center gap-1 text-[var(--color-textMuted)] italic">
                                        {isSession ? 'No tabs added' : 'No links added'}
                                      </div>);
                                    }
                                    const domains = urls.map((u: string) => {
                                        try {
                                            const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
                                            return hostname.replace('www.', '');
                                        }
                                        catch {
                                            return u;
                                        }
                                    });
                                    const topThree = domains.slice(0, 3).join(', ');
                                    return (<div className="group/url flex items-center w-full text-[10px] overflow-hidden font-normal relative h-full text-[var(--color-textSecondary)]">
                                      <span className="truncate flex-1">{topThree}</span>
                                    </div>);
                                })()) : (flexRender(cell.column.columnDef.cell, cell.getContext()))}
                            </div>)}
                        </td>);
                    })}
                  </tr>);
            })}
              <tr className="h-9 bg-transparent" aria-hidden="true">
                <td colSpan={visibleColumnCount} className="h-9 p-0"/>
              </tr>
            </tbody>))}
        </table>
      </div>
    </div>);
};
export default SpreadsheetTable;
