import * as React from 'react';
import type { Table, Header } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import { clsx } from 'clsx';
import type { RowData, AutomationModuleRow } from '../types/spreadsheetTypes';
import Resizer from './tableColumnResizer';
import { FiArrowUp, FiArrowDown, FiSearch } from 'react-icons/fi';
import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import { CUnderscoreIcon } from '../../icons/cUnderscoreIcon';

interface SpreadsheetHeaderProps {
  table: Table<RowData | AutomationModuleRow>;
  tutorialStep: number | null;
  setTutorialStep: (step: number | null) => void;
  onClose?: () => void;
}

const HeaderContent: React.FC<{
  header: Header<RowData | AutomationModuleRow, unknown>;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  colIndex: number;
  columnFilters: Record<string, string>;
  setColumnFilter: (id: string, value: string) => void;
  setSelectedCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
  table: Table<RowData | AutomationModuleRow>;
  onClose?: () => void;
}> = ({ header, selectedCell, colIndex, columnFilters, setColumnFilter, setSelectedCell, table, onClose }) => {
  const columnId = header.column.id.toLowerCase();
  const rawHeader = header.column.columnDef.header;
  const headerLabel =
    typeof rawHeader === 'string'
      ? rawHeader
      : columnId === 'command'
        ? 'Command short'
        : columnId === 'key'
          ? 'Hotkey short'
          : String(header.column.id);
  const headerText = headerLabel.toLowerCase();
  const categoryFilter = useSpreadsheetStore(state => state.categoryFilter) || ['all'];
  const hasTagSupport = categoryFilter.some(cat => ['all', 'note', 'snippet', 'link', 'automation', 'agent', 'session', 'todo'].includes(cat.toLowerCase()));



  const isActionColumn =
    columnId.includes('fav') ||
    columnId.includes('id') ||
    headerText.includes('favorites') ||
    headerText.includes('delete');

  const isFavColumn = columnId.includes('fav');
  const isCompactColumn = columnId === 'key' || columnId === 'fav' || columnId === 'tags';
  const isColumnActive = selectedCell?.rowIndex === -1 && selectedCell?.colIndex === colIndex;
  const [isHovered, setIsHovered] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const filterKey = (header.column.columnDef as any).accessorKey || header.column.id;
  const [localVal, setLocalVal] = React.useState(columnFilters[filterKey] || '');

  // Sync local state if store changes elsewhere
  React.useEffect(() => {
    setLocalVal(columnFilters[filterKey] || '');
  }, [columnFilters[filterKey]]);

  const [isFocused, setIsFocused] = React.useState(false);

  const isHeaderRowSelected = selectedCell?.rowIndex === -1 && selectedCell?.colIndex === colIndex;
  const showSearch = (isHeaderRowSelected || isSearching || localVal.trim().length > 0) && !isActionColumn;
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 🚀 Auto-focus search bar ONLY when user explicitly navigates to the header row or clicks search
  React.useEffect(() => {
    if ((isHeaderRowSelected || isSearching) && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    } else if (!isHeaderRowSelected && !isSearching && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.blur();
    }
  }, [isHeaderRowSelected, isSearching]);

  if (columnId === 'tags' && !hasTagSupport) {
    return null;
  }

  if (showSearch) {
    return (
      <div
        className={clsx(
          'absolute left-0 right-0 top-0 z-[30] flex items-center w-full',
          isColumnActive ? 'bottom-[2px]' : 'bottom-[1px]',
          'bg-[var(--color-inputBg)]',
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}>
        <FiSearch
          className={clsx(
            "absolute top-1/2 -translate-y-1/2",
            isCompactColumn ? "left-1" : "left-3",
            isColumnActive ? "text-blue-500" : "text-[var(--color-iconDefault)]"
          )}
          size={11}
        />
        <input
          ref={inputRef}
          id={`sheet-search-${columnId}`}
          type="text"
          value={localVal}
          placeholder={isFocused || isSearching || localVal ? `Search ${headerLabel}...` : headerLabel}
          className={clsx(
            'w-full h-full bg-transparent text-[12px] font-medium capitalize outline-none min-w-[120px]',
            isCompactColumn ? "px-6" : "pl-8 pr-6",
            "text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)]",
          )}
          onChange={e => {
            const val = e.target.value;
            setLocalVal(val);
            setColumnFilter(filterKey, val);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            if (!localVal.trim()) {
              setIsSearching(false);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              // Let the global handler in SpreadsheetTable handle this to ensure correct data row indexing
              return;
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsSearching(false);
              setSelectedCell(null);
              if (inputRef.current) inputRef.current.blur();
            } else if (e.key === 'ArrowRight') {
              const isAtEnd = e.currentTarget.selectionStart === e.currentTarget.value.length;
              if (isAtEnd) {
                e.preventDefault();
                const leafCols = table.getVisibleLeafColumns();
                if (colIndex + 1 < leafCols.length) {
                  setSelectedCell({ rowIndex: selectedCell?.rowIndex ?? -1, colIndex: colIndex + 1 });
                }
              }
            } else if (e.key === 'ArrowLeft') {
              const isAtStart = e.currentTarget.selectionStart === 0;
              if (isAtStart) {
                e.preventDefault();
                if (colIndex - 1 >= 0) {
                  setSelectedCell({ rowIndex: selectedCell?.rowIndex ?? -1, colIndex: colIndex - 1 });
                }
              }
            }
          }}
          onClick={e => e.stopPropagation()}
        />
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-0.5 hover:bg-slate-100 rounded"
          onClick={e => {
            e.stopPropagation();
            header.column.toggleSorting();
          }}>
          {header.column.getIsSorted() === 'asc' ? (
            <FiArrowUp size={11} className="text-blue-600" />
          ) : header.column.getIsSorted() === 'desc' ? (
            <FiArrowDown size={11} className="text-blue-600" />
          ) : (
            <div className="flex flex-col -space-y-1 opacity-30">
              <FiArrowUp size={7} />
              <FiArrowDown size={7} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center w-full h-[calc(100%-1px)]',
        header.id === 'id'
          ? 'p-0'
          : isCompactColumn
            ? 'px-1'
            : 'px-3',
        isFavColumn ? 'justify-center' : 'justify-between',
        header.column.getCanSort() && 'cursor-pointer select-none',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        setSelectedCell({ rowIndex: -1, colIndex });
        setIsSearching(true);
      }}>
      <span className={clsx('truncate flex items-center gap-1.5', isFavColumn ? 'flex-shrink-0 justify-center' : 'flex-1 text-left')}>
        <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
        {header.column.id.toLowerCase() === 'command' && (
          <CUnderscoreIcon size={18} className="shrink-0 text-current inline-block align-middle" />
        )}
      </span>

      {header.column.getCanSort() && (
        <div
          className={clsx(
            'flex flex-col -gap-1 transition-opacity pr-0.5 ml-2',
            isFavColumn && 'absolute right-1',
            header.column.getIsSorted() ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
          )}
          onClick={e => {
            e.stopPropagation();
            header.column.toggleSorting();
          }}>
          {header.column.getIsSorted() === 'asc' ? (
            <FiArrowUp size={11} className="text-blue-600" />
          ) : header.column.getIsSorted() === 'desc' ? (
            <FiArrowDown size={11} className="text-blue-600" />
          ) : (
            <div className="flex flex-col -space-y-1.5">
              <FiArrowUp size={8} className="text-[var(--color-iconDefault)]" />
              <FiArrowDown size={8} className="text-[var(--color-iconDefault)]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SpreadsheetHeader: React.FC<SpreadsheetHeaderProps> = ({ table, tutorialStep, setTutorialStep, onClose }) => {
  const { columnFilters, setColumnFilter, selectedCell, setSelectedCell } = useSpreadsheetStore();

  return (
    <thead
      className={clsx(
        'sticky top-0 z-[100] bg-[var(--color-sheetBg)] border-b border-[var(--color-borderDefault)]',
      )}>
      {table.getHeaderGroups().map((headerGroup, groupIndex) => {
        const isLeafRow = groupIndex === table.getHeaderGroups().length - 1;

        return (
          <tr key={headerGroup.id} className="divide-x divide-[var(--color-borderDefault)]">
            {headerGroup.headers.map((header, index) => {
              const isShortcutsParent = header.id.includes('Shortcuts');
              const isActiveCol = isLeafRow && selectedCell?.rowIndex === -1 && selectedCell?.colIndex === index && header.id !== 'id';

              return (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  style={{ width: header.getSize() }}
                  onClick={() => {
                    if (isLeafRow && header.id !== 'id') {
                      setSelectedCell({ rowIndex: -1, colIndex: index });
                    }
                  }}
                  className={clsx(
                    'group relative transition-colors whitespace-nowrap sticky top-0 z-20',
                    header.id === 'fav' ? 'overflow-visible z-[25]' : 'overflow-hidden',
                    // Rounded corners for the outermost header cells to align with container
                    index === 0 && 'rounded-tl-2xl overflow-hidden border-l border-[var(--color-borderDefault)]',
                    index === headerGroup.headers.length - 1 && 'rounded-tr-2xl overflow-hidden',
                    // Shortcuts parent level
                    !isLeafRow &&
                      (isShortcutsParent
                        ? clsx(
                            'px-2 py-0.5 text-[12px] font-medium capitalize z-[21] border',
                            'text-[var(--color-textPrimary)] border-[var(--color-borderDefault)] bg-[var(--color-sheetBg)]',
                          )
                        : 'border-none bg-transparent'),
                    isLeafRow &&
                      clsx(
                        'text-[12px] font-medium capitalize h-[27px] align-bottom pt-0 transition-all duration-200 z-20',
                        isActiveCol 
                          ? ('text-[var(--color-textPrimary)] bg-[var(--color-hoverBg)]')
                          : 'text-[var(--color-textMuted)] bg-[var(--color-sheetBg)] hover:bg-[var(--color-hoverBg)]',
                      ),
                    isLeafRow && header.id !== 'id' && (
                      'border-b border-white/10'
                    ),
                    isLeafRow && isActiveCol && ('bg-white/5'),
                    header.id === 'id' && 'p-0 text-center',
                  )}>
                  <div className="absolute inset-0 top-0 bottom-0">
                    {!header.isPlaceholder &&
                      (isLeafRow || isShortcutsParent) &&
                      (isLeafRow ? (
                        <div
                          id={header.id.toLowerCase() === 'name' ? 'sheet-header-name' : undefined}
                          className="w-full h-full">
                          <HeaderContent
                            header={header}
                            selectedCell={selectedCell}
                            colIndex={index}
                            columnFilters={columnFilters}
                            setColumnFilter={setColumnFilter}
                            setSelectedCell={setSelectedCell}
                            table={table}
                            
                            onClose={onClose}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      ))}
                  </div>
                  {/* Resizer handle only on the main row */}
                  {isLeafRow && !header.isPlaceholder && header.column.getCanResize() && <Resizer header={header} />}
                </th>
              );
            })}
          </tr>
        );
      })}
    </thead>
  );
};

export default SpreadsheetHeader;
