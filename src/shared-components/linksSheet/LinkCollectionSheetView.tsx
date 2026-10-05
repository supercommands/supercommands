import * as React from 'react';
import { clsx } from 'clsx';
import { FiExternalLink, FiStar, FiTrash } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { StackedLinkIcon } from '../icons/stackedLinkIcon';
import { getItemCompoundId } from '../hotkeys/utils/hotkeyUtils';
import { SpreadsheetMultiLinkInput } from '../spreadsheetUi/ui/spreadsheetMultiLinkInput';
import { LinkSheetUrlPreview } from './LinkSheetUrlPreview';
import { GridHotkeyInput, GridCommandInput } from '../spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../spreadsheetUi/ui/SpreadsheetTagSelector';
import { useSheetEngine } from '../sheetEngine/useSheetEngine';
import { useUIStore } from '../uiStateManager';
import { CollectionSheetBackButton } from '../collectionSheets/CollectionSheetBackButton';
import { COLLECTION_SHEET_GROUP_ROW_STYLE } from '../collectionSheets/collectionSheetGroupStyle';
import { COLLECTION_SHEET_TITLE_CLASS, CollectionSheetEditButton } from '../collectionSheets/CollectionSheetTitle';
import { COLLECTION_SHEET_HOVERED_CELL_CLASS, useCollectionSheetHighlight, } from '../collectionSheets/useCollectionSheetHighlight';
import { CollectionSheetColumnDividers, useCollectionSheetColumnDividerOffsets, } from '../collectionSheets/CollectionSheetColumnDividers';
import type { LinkRecord } from '../../allObjectFolder/src/createObject/links/linkTypes';
type LinkCollectionSheetViewProps = {
    links: LinkRecord[];
    expandGroupedLinks?: boolean;
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    tagNamesMap?: Record<string, string>;
    isFavorite: (id: string) => boolean;
    onOpenLink?: (link: LinkRecord) => void;
    onOpenUrls: (link: LinkRecord) => void;
    onToggleFavorite: (id: string) => void;
    onDeleteLink: (id: string) => void;
    onUpdateTitle: (id: string, value: string) => void | Promise<void>;
    onUpdateShortcut: (id: string, value: string) => void | Promise<void>;
    onUpdateHotkey: (id: string, value: string) => void | Promise<void>;
    onUpdateTags: (id: string, tagIds: string[]) => void | Promise<void>;
    onUpdateUrls: (id: string, value: string) => void | Promise<void>;
};
const LINK_SHEET_COLUMNS = [
    { id: 'title', header: '', width: 300 },
    { id: 'description', header: '', width: 255 },
    { id: 'command', header: 'Command', width: 95 },
    { id: 'hotkey', header: 'Hotkey', width: 90 },
    { id: 'tags', header: 'Tags', width: 90 },
    { id: 'actions', header: 'Actions', width: 85 }
] as const;
const LINK_SHEET_GROUP_LABEL_COL_SPAN = LINK_SHEET_COLUMNS.findIndex(column => Boolean(column.header)) || 1;
const LINK_SHEET_COLLAPSED_WIDTH = LINK_SHEET_COLUMNS.reduce((total, column) => total + column.width, 0);
type LinkSheetColumnId = (typeof LINK_SHEET_COLUMNS)[number]['id'];
const LINK_SHEET_CELL_CLASS = 'relative border-y border-r border-transparent transition-colors first:border-l first:rounded-l-md last:rounded-r-md';
type CellPosition = {
    rowIndex: number;
    colIndex: number;
};
type ActionCellTarget = 'favorite' | 'delete';
type LinkSheetGroup = {
    id: string;
    label: string;
    links: LinkRecord[];
};
const getHostname = (url: string) => {
    try {
        const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(safeUrl).hostname.replace(/^www\./i, '');
    }
    catch {
        return (url
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .split('/')[0] || url);
    }
};
const normalizeShortcut = (shortcut: string) => String(shortcut || '')
    .replace(/^c[_\s-]+/i, '')
    .trim();
const getLinkCompoundId = (link: LinkRecord) => getItemCompoundId({
    id: link.id,
    organisation_id: link.organisationId,
    snippet: { id: link.id, category: 'link' },
});
const getMappedValue = (map: Record<string, string>, link: LinkRecord) => {
    const compoundId = getLinkCompoundId(link);
    return map[compoundId] || map[link.id] || '';
};
const isSelectableColumn = (_columnId: LinkSheetColumnId) => true;
const hasRightDivider = (columnId: LinkSheetColumnId) => columnId === 'description' || columnId === 'hotkey';
const buildLinkGroups = (links: LinkRecord[]): LinkSheetGroup[] => {
    const groups: LinkSheetGroup[] = [
        { id: 'group-links', label: 'Group links', links: [] },
        { id: 'single-links', label: 'Single links', links: [] }
    ];
    const byId = new Map(groups.map(group => [group.id, group]));
    links.forEach(link => {
        const targetGroupId = (link.urls || []).length > 1 ? 'group-links' : 'single-links';
        byId.get(targetGroupId)?.links.push(link);
    });
    return groups.filter(group => group.links.length > 0);
};
const BufferedLinkSheetInput = ({ initialValue, startValue, placeholder, onSave, onCancel, onNavigateFromCleanEdit, }: {
    initialValue: string;
    startValue?: string | null;
    placeholder?: string;
    onSave: (value: string) => void | Promise<void>;
    onCancel: () => void;
    onNavigateFromCleanEdit: (rowDelta: number, colDelta: number) => void;
}) => {
    const [localValue, setLocalValue] = React.useState(startValue ?? initialValue);
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const skipBlurSaveRef = React.useRef(false);
    const save = React.useCallback(() => {
        if (skipBlurSaveRef.current)
            return;
        if (localValue === initialValue)
            return;
        void onSave(localValue);
    }, [initialValue, localValue, onSave]);
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
    return (<div className="relative flex h-full w-full items-center px-0.5">
      <input ref={inputRef} value={localValue} placeholder={placeholder} className="h-full w-full bg-transparent text-[11px] text-[var(--color-textPrimary)] outline-none placeholder:text-[var(--color-textPlaceholder)]" onChange={event => setLocalValue(event.target.value)} onBlur={save} onKeyDown={event => {
            if (event.key === 'Enter') {
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
        }}/>
    </div>);
};
export const LinkCollectionSheetView: React.FC<LinkCollectionSheetViewProps> = ({ links, expandGroupedLinks = false, shortcutsMap, hotkeysMap, tagNamesMap = {}, isFavorite, onOpenLink, onOpenUrls, onToggleFavorite, onDeleteLink, onUpdateTitle, onUpdateShortcut, onUpdateHotkey, onUpdateTags, onUpdateUrls, }) => {
    // The parent sorts by updatedAt, so persist the order seen by this open sheet.
    // Otherwise an inline save can move the edited record to another numeric row.
    const stableLinkOrderRef = React.useRef<string[]>([]);
    const sortedLinks = React.useMemo(() => {
        const linksById = new Map(links.map(link => [link.id, link]));
        const retainedIds = stableLinkOrderRef.current.filter(id => linksById.has(id));
        const retainedIdSet = new Set(retainedIds);
        const nextIds = [...retainedIds, ...links.map(link => link.id).filter(id => !retainedIdSet.has(id))];
        stableLinkOrderRef.current = nextIds;
        return nextIds.map(id => linksById.get(id)).filter((link): link is LinkRecord => Boolean(link));
    }, [links]);
    const groupedLinkSections = React.useMemo(() => buildLinkGroups(sortedLinks), [sortedLinks]);
    const visibleLinks = React.useMemo(() => groupedLinkSections.flatMap(group => group.links), [groupedLinkSections]);
    const linkRowIndexById = React.useMemo(() => {
        const rowIndexById = new Map<string, number>();
        visibleLinks.forEach((link, index) => rowIndexById.set(link.id, index));
        return rowIndexById;
    }, [visibleLinks]);
    const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(null);
    const [editingCell, setEditingCell] = React.useState<CellPosition | null>(null);
    const { isKeyboardHighlight, isHoveredRow, markKeyboard, rowPointerProps } = useCollectionSheetHighlight();
    const [focusedActionCell, setFocusedActionCell] = React.useState<{
        rowIndex: number;
        target: ActionCellTarget;
    } | null>(null);
    const cellRefs = React.useRef<Record<string, HTMLTableCellElement | null>>({});
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    const sheetViewportRef = React.useRef<HTMLDivElement | null>(null);
    const [expandedFitScale, setExpandedFitScale] = React.useState(1);
    const isMultiLinkCellEditing = React.useMemo(() => Boolean(editingCell && LINK_SHEET_COLUMNS[editingCell.colIndex]?.id === 'description'), [editingCell]);
    const isMultiLinkLayoutExpanded = isMultiLinkCellEditing || expandGroupedLinks;
    const displayColumns = React.useMemo(() => {
        return LINK_SHEET_COLUMNS.map(column => {
            if (!isMultiLinkLayoutExpanded)
                return column;
            return {
                ...column,
                // Reuse the existing title/description widths to give expanded URLs room.
                // Keep the metadata columns readable instead of squeezing them.
                width: column.id === 'description'
                    ? LINK_SHEET_COLUMNS[0].width + column.width
                    : column.width,
            };
        });
    }, [isMultiLinkLayoutExpanded]);
    const dividerColumnIndexes = React.useMemo(() => displayColumns.reduce<number[]>((indexes, column, index) => hasRightDivider(column.id) && index < displayColumns.length - 1 ? [...indexes, index] : indexes, []), [displayColumns]);
    const dividerOffsets = useCollectionSheetColumnDividerOffsets(tableRef, dividerColumnIndexes);
    const sheetWidth = React.useMemo(() => {
        let total = 0;
        for (const column of displayColumns) {
            total += column.width;
        }
        return total;
    }, [displayColumns]);
    React.useLayoutEffect(() => {
        const viewport = sheetViewportRef.current;
        if (!isMultiLinkLayoutExpanded || !viewport) {
            setExpandedFitScale(1);
            return;
        }
        const updateFit = () => {
            if (viewport.clientWidth > 0) {
                setExpandedFitScale(Math.min(1, viewport.clientWidth / sheetWidth));
            }
        };
        updateFit();
        const observer = new ResizeObserver(updateFit);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [isMultiLinkLayoutExpanded, sheetWidth]);
    const visibleColumnIndexes = React.useMemo(() => displayColumns.map(column => LINK_SHEET_COLUMNS.findIndex(candidate => candidate.id === column.id)), [displayColumns]);
    const focusCell = React.useCallback((rowIndex: number, colIndex: number, shouldAutoEdit = false, actionTarget: ActionCellTarget = 'favorite') => {
        const columnId = LINK_SHEET_COLUMNS[colIndex]?.id;
        if (!columnId || !isSelectableColumn(columnId) || !visibleColumnIndexes.includes(colIndex))
            return;
        const nextCell = { rowIndex, colIndex };
        const shouldAutoEditCell = shouldAutoEdit && columnId !== 'actions';
        setSelectedCell(nextCell);
        setEditingCell(shouldAutoEditCell ? nextCell : null);
        setFocusedActionCell(columnId === 'actions' ? { rowIndex, target: actionTarget } : null);
    }, [visibleColumnIndexes]);
    React.useEffect(() => {
        if (selectedCell || visibleLinks.length === 0)
            return;
        focusCell(0, 0, false);
    }, [focusCell, selectedCell, visibleLinks.length]);
    const { moveCell: moveSelectedCell, handleCellKeyDown, initialTypedValue } = useSheetEngine({
        rowCount: visibleLinks.length,
        rowIds: visibleLinks.map(link => link.id),
        visibleColumnIndexes,
        selectedCell,
        editingCell,
        onSelect: (cell, edit) => focusCell(cell.rowIndex, cell.colIndex, edit, selectedCell?.colIndex === cell.colIndex && LINK_SHEET_COLUMNS[cell.colIndex]?.id === 'actions'
            ? focusedActionCell?.target
            : undefined),
        onKeyboardNavigation: markKeyboard,
    });
    React.useEffect(() => {
        if (!selectedCell || editingCell)
            return;
        cellRefs.current[`${selectedCell.rowIndex}:${selectedCell.colIndex}`]?.focus();
    }, [editingCell, selectedCell]);
    React.useEffect(() => {
        if (!editingCell)
            return undefined;
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            setEditingCell(null);
            return true;
        });
        return () => {
            unregister();
        };
    }, [editingCell]);
    return (<div className="flex h-full min-h-0 w-full flex-col">
    <div className="relative mx-auto flex h-auto max-h-[90%] min-h-0 w-full flex-col overflow-visible bg-transparent pt-4 text-[var(--color-textPrimary)]" style={{ maxWidth: isMultiLinkLayoutExpanded ? undefined : sheetWidth }}>
      <CollectionSheetBackButton/>
      <div ref={sheetViewportRef} className={clsx('min-h-0 flex-1 overflow-y-auto custom-scrollbar', isMultiLinkLayoutExpanded ? 'overflow-x-auto' : 'overflow-x-hidden')} style={isMultiLinkLayoutExpanded ? {
            // Preserve the collapsed sheet's left edge as the extra width opens rightward.
            marginLeft: `max(0px, calc((100% - ${LINK_SHEET_COLLAPSED_WIDTH}px) / 2))`,
            maxWidth: sheetWidth,
        } : undefined}>
        <div className="relative w-full" style={isMultiLinkLayoutExpanded ? {
            width: sheetWidth,
            minWidth: sheetWidth,
            zoom: expandedFitScale,
        } : undefined}>
          <table ref={tableRef} className="w-full table-fixed border-separate border-spacing-0 bg-transparent" style={isMultiLinkLayoutExpanded ? { minWidth: sheetWidth } : undefined}>
          <colgroup>
            {displayColumns.map(column => (<col key={column.id} style={{ width: column.width }}/>))}
          </colgroup>
          <tbody>
            {groupedLinkSections.map((group, groupIndex) => (<React.Fragment key={group.id}>
                <tr className="h-8 overflow-hidden rounded-lg" style={COLLECTION_SHEET_GROUP_ROW_STYLE}>
                  <td colSpan={groupIndex === 0 ? LINK_SHEET_GROUP_LABEL_COL_SPAN : displayColumns.length} className="px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-textPrimary)]">
                      <span className="truncate text-[var(--color-textSecondary)]">{group.label}</span>
                      <span className="text-[11px] font-medium tabular-nums text-[var(--color-textMuted)]">
                        {group.links.length}
                      </span>
                    </div>
                  </td>
                  {groupIndex === 0 &&
                displayColumns.slice(LINK_SHEET_GROUP_LABEL_COL_SPAN).map(column => (<td key={column.id} className={clsx('px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--color-textSecondary)] first:rounded-l-lg last:rounded-r-lg', column.id === 'actions' && 'text-center')}>
                        {column.header}
                      </td>))}
                </tr>
                {group.links.map(link => {
                const index = linkRowIndexById.get(link.id);
                if (index === undefined)
                    return null;
                const shortcut = normalizeShortcut(getMappedValue(shortcutsMap, link) || link.shortcut || '');
                const hotkey = getMappedValue(hotkeysMap, link);
                const urls = link.urls || [];
                const urlPreview = urls
                    .map(item => getHostname(item.url || ''))
                    .filter(Boolean)
                    .join(', ');
                const tagText = (link.tagIds || [])
                    .map(tagId => tagNamesMap[tagId])
                    .filter(Boolean)
                    .join(', ');
                const favorite = isFavorite(link.id);
                const cellValues: Record<LinkSheetColumnId, string> = {
                    title: link.title || 'Untitled Link',
                    description: urlPreview,
                    command: shortcut ? `c_${shortcut}` : '',
                    hotkey,
                    tags: tagText,
                    actions: '',
                };
                const saveCellValue = (columnId: LinkSheetColumnId, value: string) => {
                    if (columnId === 'title')
                        return onUpdateTitle(link.id, value);
                    if (columnId === 'command')
                        return onUpdateShortcut(link.id, normalizeShortcut(value));
                    if (columnId === 'hotkey')
                        return onUpdateHotkey(link.id, value);
                    return undefined;
                };
                return (<tr key={link.id} data-collection-sheet-row="true" {...rowPointerProps(index)} className="group/row h-9 bg-transparent text-[var(--color-textPrimary)]">
                      {displayColumns.slice(0, -1).map((column, colIndex) => {
                        const isSelected = isKeyboardHighlight &&
                            selectedCell?.rowIndex === index &&
                            selectedCell?.colIndex === colIndex;
                        const isHovered = isHoveredRow(index);
                        const isEditing = editingCell?.rowIndex === index && editingCell?.colIndex === colIndex;
                        const cellKey = `${index}:${colIndex}`;
                        return (<td key={`${link.id}-${column.id}`} ref={element => {
                                cellRefs.current[cellKey] = element;
                            }} tabIndex={0} className={clsx('relative cursor-pointer align-middle text-[11px] text-[var(--color-textPrimary)] outline-none', LINK_SHEET_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, column.id === 'description' && isSelected ? 'px-[2px] py-1' : 'px-2 py-1', isSelected
                                ? 'z-[50] overflow-visible rounded bg-transparent py-[2px] ring-1 ring-[var(--color-borderActive)] ring-inset'
                                : 'py-[1.5px]')} onFocus={event => {
                                if (event.target !== event.currentTarget)
                                    return;
                                if (cellRefs.current[cellKey]?.matches(':focus-visible')) {
                                    markKeyboard();
                                }
                                if (selectedCell?.rowIndex === index && selectedCell?.colIndex === colIndex)
                                    return;
                                focusCell(index, colIndex, false);
                            }} onClick={() => {
                                if (!isEditing)
                                    focusCell(index, colIndex, true);
                            }} onKeyDown={event => {
                                markKeyboard();
                                handleCellKeyDown(event, { rowIndex: index, colIndex }, column.id === 'title' || column.id === 'command' ? 'text' : 'popup');
                            }}>
                            {isEditing ? (column.id === 'command' ? (<GridCommandInput itemId={getLinkCompoundId(link)} initialValue={shortcut} navigateOnCleanArrow={false} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => { void onUpdateShortcut(link.id, value); setEditingCell(null); }} onCancel={() => setEditingCell(null)} onOverwrite={() => { }}/>) : column.id === 'description' ? (<SpreadsheetMultiLinkInput navigateOnCleanArrow={false} initialUrls={urls.map(item => item.url || '')} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} expandedWidth="100%" onSave={value => {
                                    void onUpdateUrls(link.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} suggestionPlacement="bottom"/>) : column.id === 'tags' ? (<SpreadsheetTagSelector keepOpenOnEnter cellElement={cellRefs.current[cellKey]} initialTagIds={link.tagIds || []} organisationId={link.organisationId} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={tagIds => {
                                    void onUpdateTags(link.id, tagIds);
                                }} onCancel={() => setEditingCell(null)}/>) : column.id === 'hotkey' ? (<GridHotkeyInput navigateOnCleanArrow={false} itemId={getLinkCompoundId(link)} initialValue={cellValues.hotkey} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} requireModifierCombo={true} onSave={value => {
                                    void onUpdateHotkey(link.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                    void onUpdateHotkey(link.id, value);
                                    setEditingCell(null);
                                }}/>) : (<BufferedLinkSheetInput initialValue={cellValues[column.id]} startValue={initialTypedValue} placeholder={column.id === 'title' ? 'Enter title' : ''} onNavigateFromCleanEdit={moveSelectedCell} onSave={value => saveCellValue(column.id, value)} onCancel={() => setEditingCell(null)}/>)) : column.id === 'description' && expandGroupedLinks && urls.length > 1 ? (<LinkSheetUrlPreview urls={urls} itemTitle={link.title || 'Untitled Link'} onEdit={() => focusCell(index, colIndex, true)}/>) : column.id === 'title' ? (<div className="flex min-w-0 items-center gap-1.5 cursor-pointer">
                                <span className="flex w-8 shrink-0 items-center justify-start">
                                  <StackedLinkIcon urls={urls.map(item => item.url || '')} size={17} maxIcons={3} fallback="link" className="opacity-100"/>
                                </span>
                                <span className={COLLECTION_SHEET_TITLE_CLASS} style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
                                  {link.title || 'Untitled Link'}
                                </span>
                                {onOpenLink && (<CollectionSheetEditButton itemLabel={link.title || 'Untitled Link'} onEdit={() => onOpenLink(link)}/>)}
                                <button type="button" onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onOpenUrls(link);
                                }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-80 transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" title="Open links" aria-label={`Open links in ${link.title || 'Untitled Link'}`}>
                                  <FiExternalLink size={14}/>
                                </button>
                              </div>) : (<span className={clsx('block text-[11px] text-[var(--color-textPrimary)]', column.id === 'tags' && isMultiLinkLayoutExpanded ? 'whitespace-pre-wrap break-words' : 'truncate', column.id === 'description' && 'opacity-90', column.id === 'tags' && 'opacity-85')}>
                                {cellValues[column.id]}
                              </span>)}
                          </td>);
                    })}
                      {(() => {
                        const colIndex = displayColumns.length - 1;
                        const isSelected = isKeyboardHighlight &&
                            selectedCell?.rowIndex === index &&
                            selectedCell?.colIndex === colIndex;
                        const isHovered = isHoveredRow(index);
                        const focusedActionTarget = isSelected && focusedActionCell?.rowIndex === index ? focusedActionCell.target : null;
                        const cellKey = `${index}:${colIndex}`;
                        return (<td key="actions" ref={element => {
                                cellRefs.current[cellKey] = element;
                            }} tabIndex={0} className={clsx('p-0 align-middle outline-none relative transition-all', LINK_SHEET_CELL_CLASS, isHovered && COLLECTION_SHEET_HOVERED_CELL_CLASS, isSelected ? 'z-[50] overflow-visible rounded bg-transparent' : '')} onFocus={() => {
                                if (cellRefs.current[cellKey]?.matches(':focus-visible')) {
                                    markKeyboard();
                                }
                                if (!isSelected) {
                                    focusCell(index, colIndex, false);
                                }
                            }} onClick={() => {
                                focusCell(index, colIndex, false);
                            }} onKeyDown={event => {
                                markKeyboard();
                                if (event.key === 'ArrowRight') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (focusedActionTarget === 'delete') {
                                        moveSelectedCell(0, 1);
                                    }
                                    else {
                                        setFocusedActionCell({ rowIndex: index, target: 'delete' });
                                    }
                                }
                                else if (event.key === 'ArrowLeft') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (focusedActionTarget === 'delete') {
                                        setFocusedActionCell({ rowIndex: index, target: 'favorite' });
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
                                        onDeleteLink(link.id);
                                    }
                                    else {
                                        onToggleFavorite(link.id);
                                    }
                                }
                                else if (event.key === 'f' || event.key === 'F') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onToggleFavorite(link.id);
                                }
                                else if (event.key === 'Delete' || event.key === 'Backspace') {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDeleteLink(link.id);
                                }
                            }}>
                            <div className="flex min-h-[28px] w-full items-center justify-center gap-1">
                              <button type="button" tabIndex={-1} onMouseDown={event => {
                                event.preventDefault();
                                setSelectedCell({ rowIndex: index, colIndex });
                                setEditingCell(null);
                                setFocusedActionCell({ rowIndex: index, target: 'favorite' });
                            }} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                onToggleFavorite(link.id);
                            }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] transition-colors hover:text-amber-400 focus:outline-none', focusedActionTarget === 'favorite' &&
                                'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-amber-400')} title={favorite ? 'Remove favorite' : 'Add favorite'} aria-label={favorite ? 'Remove favorite' : 'Add favorite'}>
                                {favorite ? (<FaStar className="text-xs text-amber-400"/>) : (<FiStar className="text-xs"/>)}
                              </button>
                              <button type="button" tabIndex={-1} onMouseDown={event => {
                                event.preventDefault();
                                setSelectedCell({ rowIndex: index, colIndex });
                                setEditingCell(null);
                                setFocusedActionCell({ rowIndex: index, target: 'delete' });
                            }} onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                onDeleteLink(link.id);
                            }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-70 transition-colors hover:text-[var(--color-error)] hover:opacity-100 focus:outline-none', focusedActionTarget === 'delete' &&
                                'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-[var(--color-error)] opacity-100')} title="Delete link" aria-label="Delete link">
                                <FiTrash size={14}/>
                              </button>
                            </div>
                          </td>);
                    })()}
                    </tr>);
            })}
                <tr aria-hidden="true" className="h-9 bg-[var(--color-editorBg)]">
                  <td colSpan={displayColumns.length} className="relative z-20 h-9 bg-[var(--color-editorBg)] p-0"/>
                </tr>
              </React.Fragment>))}
            {sortedLinks.length === 0 && (<tr>
                <td colSpan={displayColumns.length} className="h-32 text-center text-[12px] text-[var(--color-textMuted)]">
                  No links found
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
export default LinkCollectionSheetView;
