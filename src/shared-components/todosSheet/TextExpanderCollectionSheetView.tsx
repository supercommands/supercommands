import TextExpanderIcon from '../icons/TextExpanderIcon';
import * as React from 'react';
import { clsx } from 'clsx';
import { FaStar, FaTrash } from 'react-icons/fa';
import { FiStar } from 'react-icons/fi';
import type { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { GridCommandInput, GridHotkeyInput } from '../spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../spreadsheetUi/ui/SpreadsheetTagSelector';
import { useSheetEngine } from '../sheetEngine/useSheetEngine';
import { getItemCompoundId } from '../utils/idGenerator';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { useUIStore } from '../uiStateManager';
import { COLLECTION_SHEET_GROUP_ROW_STYLE } from '../collectionSheets/collectionSheetGroupStyle';
import { CollectionSheetBackButton } from '../collectionSheets/CollectionSheetBackButton';
import { COLLECTION_SHEET_TITLE_CLASS, CollectionSheetEditButton } from '../collectionSheets/CollectionSheetTitle';
import { COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, CollectionSheetColumnDividers, useCollectionSheetColumnDividerOffsets, } from '../collectionSheets/CollectionSheetColumnDividers';
import { COLLECTION_SHEET_HOVERED_CELL_CLASS, useCollectionSheetHighlight } from '../collectionSheets/useCollectionSheetHighlight';
type TextExpanderCollectionSheetViewProps = {
    snippets: SnippetRecord[];
    isExpanded?: boolean;
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    tagNamesMap?: Record<string, string>;
    isFavorite: (id: string) => boolean;
    onOpenSnippet?: (snippet: SnippetRecord) => void;
    onToggleFavorite: (id: string) => void;
    onDeleteSnippet: (id: string) => void;
    onUpdateTitle: (id: string, value: string) => void | Promise<void>;
    onUpdateContent: (id: string, value: string) => void | Promise<void>;
    onUpdateShortcut: (id: string, value: string) => void | Promise<void>;
    onUpdateHotkey: (id: string, value: string) => void | Promise<void>;
    onUpdateTags: (id: string, tagIds: string[]) => void | Promise<void>;
};
const TEXT_EXPANDER_SHEET_COLUMNS = [
    { id: 'title', header: '', width: 210 },
    { id: 'content', header: '', width: 300 },
    { id: 'command', header: 'Command', width: 110 },
    { id: 'hotkey', header: 'Hotkey', width: 90 },
    { id: 'tags', header: 'Tags', width: 90 },
    { id: 'actions', header: 'Actions', width: 70 }
] as const;
type TextExpanderSheetColumnId = (typeof TEXT_EXPANDER_SHEET_COLUMNS)[number]['id'];
const TEXT_EXPANDER_SHEET_GROUP_LABEL_COL_SPAN = TEXT_EXPANDER_SHEET_COLUMNS.findIndex(column => Boolean(column.header)) || 1;
type CellPosition = {
    rowIndex: number;
    colIndex: number;
};
type ActionCellTarget = 'favorite' | 'delete';
const isSelectableColumn = (_columnId: TextExpanderSheetColumnId) => true;
const hasRightDivider = (columnId: TextExpanderSheetColumnId) => columnId === 'content' || columnId === 'hotkey';
const isEditableColumn = (columnId: TextExpanderSheetColumnId) => columnId === 'title' ||
    columnId === 'content' ||
    columnId === 'command' ||
    columnId === 'hotkey' ||
    columnId === 'tags';
const normalizeShortcut = (shortcut: string) => normalizeShortcutTrigger(shortcut || '')
    .replace(/^[cs][_\s-]+/i, '')
    .replace(/[^a-z0-9_]/g, '');
const getSnippetCompoundId = (snippet: SnippetRecord) => getItemCompoundId({
    snippet,
    organisation: snippet.organisationId ? { organisation_id: snippet.organisationId } : null,
});
const getMappedValue = (map: Record<string, string>, snippet: SnippetRecord) => {
    const compoundId = getSnippetCompoundId(snippet);
    return map[compoundId] || map[snippet.id] || '';
};
export const textToSnippetConfig = (text: string) => JSON.stringify(text ? [{ type: 'text', value: text }] : []);
export const snippetConfigToPlainText = (config: SnippetRecord['config']) => {
    const parseConfig = () => {
        if (!config)
            return [];
        if (typeof config === 'string') {
            try {
                return JSON.parse(config);
            }
            catch {
                return config;
            }
        }
        return config;
    };
    const parsed = parseConfig();
    if (typeof parsed === 'string')
        return parsed;
    let result = '';
    const visit = (nodes: any) => {
        const list = Array.isArray(nodes) ? nodes : nodes?.content;
        if (!Array.isArray(list))
            return;
        for (const node of list) {
            if (node.type === 'text') {
                result += node.value || node.text || '';
            }
            else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
                const configData = node.config || {};
                const label = configData.label || node.alias || node.id || 'Field';
                result += `{{${label}}}`;
            }
            else if (node.type === 'cursor') {
                result += '{{cursor}}';
            }
            visit(node.children || node.content);
        }
    };
    visit(parsed);
    return result.trim();
};
const BufferedTextExpanderSheetInput = ({ initialValue, startValue, placeholder, multiline = false, onSave, onCancel, onNavigateFromCleanEdit, }: {
    initialValue: string;
    startValue?: string | null;
    placeholder?: string;
    multiline?: boolean;
    onSave: (value: string) => void | Promise<void>;
    onCancel: () => void;
    onNavigateFromCleanEdit: (rowDelta: number, colDelta: number) => void;
}) => {
    const [localValue, setLocalValue] = React.useState(startValue ?? initialValue);
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const skipBlurSaveRef = React.useRef(false);
    const save = React.useCallback(() => {
        if (skipBlurSaveRef.current)
            return;
        void onSave(localValue);
    }, [localValue, onSave]);
    React.useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
        const frameId = window.requestAnimationFrame(() => {
            input.scrollTop = input.scrollHeight;
            input.scrollLeft = input.scrollWidth;
        });
        return () => window.cancelAnimationFrame(frameId);
    }, []);
    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && (!multiline || !event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            save();
            skipBlurSaveRef.current = true;
            onNavigateFromCleanEdit(1, 0);
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            save();
            skipBlurSaveRef.current = true;
            onNavigateFromCleanEdit(0, event.shiftKey ? -1 : 1);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            skipBlurSaveRef.current = true;
            onCancel();
        }
    };
    if (multiline) {
        return (<textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={localValue} placeholder={placeholder} className="h-full min-h-[34px] w-full resize-none bg-transparent px-0.5 py-1 text-[11px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]" onChange={event => setLocalValue(event.target.value)} onBlur={save} onKeyDown={handleKeyDown}/>);
    }
    return (<input ref={inputRef as React.RefObject<HTMLInputElement>} value={localValue} placeholder={placeholder} className="h-full w-full bg-transparent px-0.5 text-[11px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]" onChange={event => setLocalValue(event.target.value)} onBlur={save} onKeyDown={handleKeyDown}/>);
};
export const TextExpanderCollectionSheetView: React.FC<TextExpanderCollectionSheetViewProps> = ({ snippets, isExpanded = false, shortcutsMap, hotkeysMap, tagNamesMap = {}, isFavorite, onOpenSnippet, onToggleFavorite, onDeleteSnippet, onUpdateTitle, onUpdateContent, onUpdateShortcut, onUpdateHotkey, onUpdateTags, }) => {
    const sortedSnippets = React.useMemo(() => [...snippets], [snippets]);
    const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(null);
    const [editingCell, setEditingCell] = React.useState<CellPosition | null>(null);
    const { isKeyboardHighlight, isHoveredRow, rowPointerProps } = useCollectionSheetHighlight();
    const selectedCellRef = React.useRef<CellPosition | null>(null);
    const editingCellRef = React.useRef<CellPosition | null>(null);
    const [focusedActionCell, setFocusedActionCell] = React.useState<{
        rowIndex: number;
        target: ActionCellTarget;
    } | null>(null);
    const focusedActionCellRef = React.useRef<typeof focusedActionCell>(null);
    const cellRefs = React.useRef<Record<string, HTMLTableCellElement | null>>({});
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    type TextExpanderSheetColumn = (typeof TEXT_EXPANDER_SHEET_COLUMNS)[number];
    const displayColumns: readonly TextExpanderSheetColumn[] = TEXT_EXPANDER_SHEET_COLUMNS;
    const dividerColumnIndexes = React.useMemo(() => displayColumns.reduce<number[]>((indexes, column, index) => hasRightDivider(column.id) && index < displayColumns.length - 1 ? [...indexes, index] : indexes, []), [displayColumns]);
    const dividerOffsets = useCollectionSheetColumnDividerOffsets(tableRef, dividerColumnIndexes);
    const sheetWidth = React.useMemo(() => {
        let total = 0;
        for (const column of displayColumns) {
            total += column.width;
        }
        return total;
    }, [displayColumns]);
    const visibleColumnIndexes = React.useMemo(() => displayColumns.map(column => TEXT_EXPANDER_SHEET_COLUMNS.findIndex(candidate => candidate.id === column.id)), [displayColumns]);
    const focusCell = React.useCallback((rowIndex: number, colIndex: number, shouldAutoOpen = false, actionTarget: ActionCellTarget = 'favorite') => {
        const columnId = TEXT_EXPANDER_SHEET_COLUMNS[colIndex]?.id;
        if (!columnId || !isSelectableColumn(columnId) || !visibleColumnIndexes.includes(colIndex))
            return;
        const nextCell = { rowIndex, colIndex };
        const shouldAutoEditCell = shouldAutoOpen && isEditableColumn(columnId);
        selectedCellRef.current = nextCell;
        editingCellRef.current = shouldAutoEditCell ? nextCell : null;
        setSelectedCell(nextCell);
        setEditingCell(shouldAutoEditCell ? nextCell : null);
        const nextFocusedActionCell = columnId === 'actions' ? { rowIndex, target: actionTarget } : null;
        focusedActionCellRef.current = nextFocusedActionCell;
        setFocusedActionCell(nextFocusedActionCell);
        if (!shouldAutoEditCell) {
            requestAnimationFrame(() => {
                if (editingCellRef.current)
                    return;
                if (selectedCellRef.current?.rowIndex !== rowIndex || selectedCellRef.current?.colIndex !== colIndex)
                    return;
                cellRefs.current[`${rowIndex}:${colIndex}`]?.focus({ preventScroll: true });
            });
        }
    }, [visibleColumnIndexes]);
    React.useEffect(() => {
        if (selectedCell || sortedSnippets.length === 0)
            return;
        focusCell(0, 0, false);
    }, [focusCell, selectedCell, sortedSnippets.length]);
    const { moveCell: moveSelectedCell, handleCellKeyDown, initialTypedValue } = useSheetEngine({
        rowCount: sortedSnippets.length,
        rowIds: sortedSnippets.map(snippet => snippet.id),
        visibleColumnIndexes,
        selectedCell,
        editingCell,
        onSelect: (cell, edit) => focusCell(cell.rowIndex, cell.colIndex, edit, selectedCellRef.current?.colIndex === cell.colIndex && TEXT_EXPANDER_SHEET_COLUMNS[cell.colIndex]?.id === 'actions'
            ? focusedActionCellRef.current?.target
            : undefined),
    });
    React.useEffect(() => {
        editingCellRef.current = editingCell;
    }, [editingCell]);
    React.useEffect(() => {
        focusedActionCellRef.current = focusedActionCell;
    }, [focusedActionCell]);
    React.useEffect(() => {
        if (!selectedCell || editingCell)
            return;
        cellRefs.current[`${selectedCell.rowIndex}:${selectedCell.colIndex}`]?.focus();
    }, [editingCell, selectedCell]);
    React.useEffect(() => {
        if (!editingCell)
            return undefined;
        const unregisterEscapeInterceptor = useUIStore.getState().registerEscapeInterceptor(() => {
            setEditingCell(null);
            return true;
        });
        return () => {
            unregisterEscapeInterceptor();
        };
    }, [editingCell]);
    return (<div className="flex h-full min-h-0 w-full flex-col">
    <div className="relative mx-auto flex h-auto max-h-[90%] min-h-0 w-full flex-col overflow-visible bg-transparent pt-4 text-[var(--color-textPrimary)]" style={{ maxWidth: sheetWidth }}>
      <CollectionSheetBackButton/>
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <div className="relative w-full">
          <table ref={tableRef} className="w-full table-fixed border-separate border-spacing-0 bg-transparent">
          <colgroup>
            {displayColumns.map(column => (<col key={column.id} style={{ width: column.width }}/>))}
          </colgroup>
          <tbody>
            <tr className="h-8 overflow-hidden rounded-lg" style={COLLECTION_SHEET_GROUP_ROW_STYLE}>
              <td colSpan={TEXT_EXPANDER_SHEET_GROUP_LABEL_COL_SPAN} className="px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg">
                <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-textPrimary)]">
                  <span className="text-[var(--color-textSecondary)]">Text expanders</span>
                  <span className="text-[11px] font-medium tabular-nums text-[var(--color-textMuted)]">
                    {sortedSnippets.length}
                  </span>
                </div>
              </td>
              {displayColumns.slice(TEXT_EXPANDER_SHEET_GROUP_LABEL_COL_SPAN).map(column => (<td key={column.id} className={clsx('px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--color-textSecondary)] first:rounded-l-lg last:rounded-r-lg', column.id === 'actions' && 'text-center')}>
                  {column.header}
                </td>))}
            </tr>
            {sortedSnippets.map((snippet, index) => {
            const shortcut = normalizeShortcut(getMappedValue(shortcutsMap, snippet) || snippet.shortcut || '');
            const hotkey = getMappedValue(hotkeysMap, snippet);
            const content = snippetConfigToPlainText(snippet.config);
            const tagText = (snippet.tagIds || [])
                .map(tagId => tagNamesMap[tagId])
                .filter(Boolean)
                .join(', ');
            const cellValues: Record<TextExpanderSheetColumnId, string> = {
                title: snippet.title || 'Untitled Snippet',
                content,
                command: shortcut ? `c_${shortcut}` : '',
                hotkey,
                tags: tagText,
                actions: '',
            };
            const favorite = isFavorite(snippet.id);
            return (<tr key={snippet.id} data-collection-sheet-row="true" {...rowPointerProps(index)} className="group/row h-9 bg-transparent text-[var(--color-textPrimary)]">
                  {displayColumns.map((column, colIndex) => {
                    const isSelected = isKeyboardHighlight && selectedCell?.rowIndex === index && selectedCell?.colIndex === colIndex;
                    const isHovered = isHoveredRow(index);
                    const isEditing = editingCell?.rowIndex === index && editingCell?.colIndex === colIndex;
                    const focusedActionTarget = isSelected &&
                        column.id === 'actions' &&
                        focusedActionCell?.rowIndex === index
                        ? focusedActionCell.target
                        : null;
                    const cellKey = `${index}:${colIndex}`;
                    if (column.id === 'actions') {
                        return (<td key={column.id} ref={element => {
                                cellRefs.current[cellKey] = element;
                            }} tabIndex={0} className={clsx('p-0 align-middle outline-none relative transition-all', COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected ? 'z-[50] overflow-visible rounded bg-transparent' : '')} onFocus={() => {
                                if (!isSelected) {
                                    focusCell(index, colIndex, false);
                                }
                            }} onClick={() => {
                                focusCell(index, colIndex, false);
                            }} onKeyDown={event => {
                                if (event.key === 'ArrowRight') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (focusedActionTarget === 'delete') {
                                        moveSelectedCell(0, 1);
                                    }
                                    else {
                                        const nextFocusedActionCell = { rowIndex: index, target: 'delete' as const };
                                        focusedActionCellRef.current = nextFocusedActionCell;
                                        setFocusedActionCell(nextFocusedActionCell);
                                    }
                                }
                                else if (event.key === 'ArrowLeft') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (focusedActionTarget === 'delete') {
                                        const nextFocusedActionCell = { rowIndex: index, target: 'favorite' as const };
                                        focusedActionCellRef.current = nextFocusedActionCell;
                                        setFocusedActionCell(nextFocusedActionCell);
                                    }
                                    else {
                                        moveSelectedCell(0, -1);
                                    }
                                }
                                else if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    moveSelectedCell(-1, 0);
                                }
                                else if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    moveSelectedCell(1, 0);
                                }
                                else if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (focusedActionTarget === 'delete') {
                                        onDeleteSnippet(snippet.id);
                                    }
                                    else {
                                        onToggleFavorite(snippet.id);
                                    }
                                }
                                else if (event.key === 'f' || event.key === 'F') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onToggleFavorite(snippet.id);
                                }
                                else if (event.key === 'Delete' || event.key === 'Backspace') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDeleteSnippet(snippet.id);
                                }
                            }}>
                          <div className="flex min-h-[28px] w-full items-center justify-center gap-1">
                            <button type="button" tabIndex={-1} onMouseDown={event => {
                                event.preventDefault();
                                const nextCell = { rowIndex: index, colIndex };
                                const nextFocusedActionCell = { rowIndex: index, target: 'favorite' as const };
                                selectedCellRef.current = nextCell;
                                editingCellRef.current = null;
                                focusedActionCellRef.current = nextFocusedActionCell;
                                setSelectedCell(nextCell);
                                setEditingCell(null);
                                setFocusedActionCell(nextFocusedActionCell);
                            }} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                onToggleFavorite(snippet.id);
                            }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] transition-colors hover:text-amber-400 focus:outline-none', focusedActionTarget === 'favorite' &&
                                'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-amber-400')} title={favorite ? 'Remove favorite' : 'Add favorite'}>
                              {favorite ? <FaStar className="text-xs text-amber-400"/> : <FiStar className="text-xs"/>}
                            </button>
                            <button type="button" tabIndex={-1} onMouseDown={event => {
                                event.preventDefault();
                                const nextCell = { rowIndex: index, colIndex };
                                const nextFocusedActionCell = { rowIndex: index, target: 'delete' as const };
                                selectedCellRef.current = nextCell;
                                editingCellRef.current = null;
                                focusedActionCellRef.current = nextFocusedActionCell;
                                setSelectedCell(nextCell);
                                setEditingCell(null);
                                setFocusedActionCell(nextFocusedActionCell);
                            }} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                onDeleteSnippet(snippet.id);
                            }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-70 transition-colors hover:text-[var(--color-error)] hover:opacity-100 focus:outline-none', focusedActionTarget === 'delete' &&
                                'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-[var(--color-error)] opacity-100')} title="Delete text expander">
                              <FaTrash size={12}/>
                            </button>
                          </div>
                        </td>);
                    }
                    return (<td key={column.id} ref={element => {
                            cellRefs.current[cellKey] = element;
                        }} tabIndex={0} className={clsx('relative cursor-pointer align-middle text-[11px] text-[var(--color-textPrimary)] outline-none', COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected
                            ? 'z-[50] overflow-visible rounded bg-transparent px-2 py-[2px] ring-1 ring-[var(--color-borderActive)] ring-inset'
                            : 'px-2 py-[1.5px]')} onFocus={event => {
                            if (event.target !== event.currentTarget)
                                return;
                            const currentCell = selectedCellRef.current || selectedCell;
                            if (currentCell?.rowIndex === index && currentCell?.colIndex === colIndex)
                                return;
                            focusCell(index, colIndex, false);
                        }} onClick={() => {
                            if (!isEditing)
                                focusCell(index, colIndex, true);
                        }} onKeyDown={event => {
                            handleCellKeyDown(event, { rowIndex: index, colIndex }, column.id === 'title' || column.id === 'content' ? 'text' : isEditableColumn(column.id) ? 'popup' : 'readonly');
                        }}>
                        {isEditing && column.id === 'title' ? (<BufferedTextExpanderSheetInput initialValue={snippet.title || ''} startValue={initialTypedValue} placeholder="Enter title" onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdateTitle(snippet.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'content' ? (<BufferedTextExpanderSheetInput initialValue={content} startValue={initialTypedValue} placeholder="Enter content" multiline onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdateContent(snippet.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'command' ? (<GridCommandInput navigateOnCleanArrow={false} itemId={getSnippetCompoundId(snippet)} initialValue={shortcut} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                void onUpdateShortcut(snippet.id, normalizeShortcut(value));
                                setEditingCell(null);
                            }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                void onUpdateShortcut(snippet.id, normalizeShortcut(value));
                                setEditingCell(null);
                            }}/>) : isEditing && column.id === 'hotkey' ? (<GridHotkeyInput navigateOnCleanArrow={false} itemId={getSnippetCompoundId(snippet)} initialValue={hotkey} requireModifierCombo onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                void onUpdateHotkey(snippet.id, value);
                                setEditingCell(null);
                            }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                void onUpdateHotkey(snippet.id, value);
                                setEditingCell(null);
                            }}/>) : isEditing && column.id === 'tags' ? (<SpreadsheetTagSelector keepOpenOnEnter cellElement={cellRefs.current[cellKey]} initialTagIds={snippet.tagIds || []} organisationId={snippet.organisationId} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={tagIds => {
                                void onUpdateTags(snippet.id, tagIds);
                            }} onCancel={() => setEditingCell(null)}/>) : column.id === 'title' ? (<div className="flex min-w-0 items-center gap-1.5 cursor-pointer">
                            <TextExpanderIcon size={13} className="shrink-0 text-[var(--color-iconDefault)]"/>
                            <span className={COLLECTION_SHEET_TITLE_CLASS}>
                              {cellValues.title}
                            </span>
                            {onOpenSnippet && (<CollectionSheetEditButton itemLabel={snippet.title || 'snippet'} onEdit={() => onOpenSnippet(snippet)}/>)}
                          </div>) : (<span className={clsx('block text-[11px] text-[var(--color-textPrimary)]', (column.id === 'content' || column.id === 'tags') && isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate', column.id === 'content' && 'opacity-90', column.id === 'tags' && 'opacity-85')}>
                            {cellValues[column.id]}
                          </span>)}
                      </td>);
                })}
                </tr>);
        })}
            {sortedSnippets.length > 0 && (<tr aria-hidden="true" className="h-9 bg-[var(--color-editorBg)]">
                <td colSpan={displayColumns.length} className="relative z-20 h-9 bg-[var(--color-editorBg)] p-0"/>
              </tr>)}
            {sortedSnippets.length === 0 && (<tr>
                <td colSpan={displayColumns.length} className="h-32 text-center text-[12px] text-[var(--color-textMuted)]">
                  No text expanders found
                </td>
              </tr>)}
          </tbody>
          </table>
          <CollectionSheetColumnDividers offsets={dividerOffsets}/>
        </div>
      </div>
    </div>
    </div>);
};
export default TextExpanderCollectionSheetView;
