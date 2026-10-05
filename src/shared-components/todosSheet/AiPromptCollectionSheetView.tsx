import * as React from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { FaStar, FaTrash } from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight, FiExternalLink, FiStar } from 'react-icons/fi';
import { GridCommandInput, GridHotkeyInput } from '../spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../spreadsheetUi/ui/SpreadsheetTagSelector';
import { useSheetEngine } from '../sheetEngine/useSheetEngine';
import { getItemCompoundId } from '../hotkeys/utils/hotkeyUtils';
import { normalizeShortcutTrigger } from '../shortcuts/core/shortcutDbData';
import { useUIStore } from '../uiStateManager';
import { COLLECTION_SHEET_GROUP_ROW_STYLE } from '../collectionSheets/collectionSheetGroupStyle';
import { CollectionSheetBackButton } from '../collectionSheets/CollectionSheetBackButton';
import { COLLECTION_SHEET_TITLE_CLASS, CollectionSheetEditButton } from '../collectionSheets/CollectionSheetTitle';
import { COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, CollectionSheetColumnDividers, useCollectionSheetColumnDividerOffsets, } from '../collectionSheets/CollectionSheetColumnDividers';
import { COLLECTION_SHEET_HOVERED_CELL_CLASS, useCollectionSheetHighlight } from '../collectionSheets/useCollectionSheetHighlight';
import CircularModelStackIcon from '../icons/circularModelStackIcon';
import { resolveEnabledAiPromptModels } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import type { AiPromptRecord, CustomModelConfig } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import AiPromptModelSelectorPanel from './AiPromptModelSelectorPanel';
export type AiPromptModelUpdate = {
    enabledModelIds: string[];
    modelUrls: Record<string, string>;
    customModels: CustomModelConfig[];
};
type AiPromptCollectionSheetViewProps = {
    prompts: AiPromptRecord[];
    isExpanded?: boolean;
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    tagNamesMap?: Record<string, string>;
    isFavorite: (id: string) => boolean;
    onOpenPrompt?: (prompt: any) => void;
    onRunPrompt?: (prompt: AiPromptRecord) => void | Promise<void>;
    onRunPromptWithoutSavedPrompt?: () => void | Promise<void>;
    onToggleFavorite: (id: string) => void;
    onDeletePrompt: (id: string) => void;
    onUpdateTitle: (id: string, value: string) => void | Promise<void>;
    onUpdatePrompt: (id: string, value: string) => void | Promise<void>;
    onUpdateShortcut: (id: string, value: string) => void | Promise<void>;
    onUpdateHotkey: (id: string, value: string) => void | Promise<void>;
    onUpdateModels: (id: string, value: AiPromptModelUpdate) => void | Promise<void>;
    onUpdateTags: (id: string, tagIds: string[]) => void | Promise<void>;
};
const AI_PROMPT_SHEET_COLUMNS = [
    { id: 'title', header: '', width: 210 },
    { id: 'prompt', header: '', width: 275 },
    { id: 'models', header: 'Models', width: 105 },
    { id: 'command', header: 'Command', width: 105 },
    { id: 'hotkey', header: 'Hotkey', width: 90 },
    { id: 'tags', header: 'Tags', width: 90 },
    { id: 'actions', header: 'Actions', width: 62 }
] as const;
type AiPromptSheetColumnId = (typeof AI_PROMPT_SHEET_COLUMNS)[number]['id'];
const AI_PROMPT_SHEET_GROUP_LABEL_COL_SPAN = AI_PROMPT_SHEET_COLUMNS.findIndex(column => Boolean(column.header)) || 1;
type CellPosition = {
    rowIndex: number;
    colIndex: number;
};
type ActionCellTarget = 'favorite' | 'delete';
type AiPromptSheetGroup = {
    id: string;
    label: string;
    prompts: AiPromptRecord[];
};
const isSelectableColumn = (_columnId: AiPromptSheetColumnId) => true;
const hasRightDivider = (columnId: AiPromptSheetColumnId) => columnId === 'prompt' || columnId === 'hotkey';
const buildModelGroups = (prompts: AiPromptRecord[]): AiPromptSheetGroup[] => {
    const groups: AiPromptSheetGroup[] = [
        { id: 'multi-models', label: 'Multi models', prompts: [] },
        { id: 'single-models', label: 'Single models', prompts: [] }
    ];
    const byId = new Map(groups.map(group => [group.id, group]));
    prompts.forEach(prompt => {
        const enabledModelCount = resolveEnabledAiPromptModels(prompt).length;
        const targetGroupId = enabledModelCount > 1 ? 'multi-models' : 'single-models';
        byId.get(targetGroupId)?.prompts.push(prompt);
    });
    return groups.filter(group => group.prompts.length > 0);
};
const isEditableColumn = (columnId: AiPromptSheetColumnId) => columnId === 'title' ||
    columnId === 'prompt' ||
    columnId === 'command' ||
    columnId === 'hotkey' ||
    columnId === 'models' ||
    columnId === 'tags';
const stripHtml = (html: string) => String(html || '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
const normalizeShortcut = (shortcut: string) => normalizeShortcutTrigger(shortcut || '')
    .replace(/^c[_\s-]+/i, '')
    .replace(/[^a-z0-9_]/g, '');
const getPromptCompoundId = (prompt: AiPromptRecord) => getItemCompoundId({
    id: prompt.id,
    organisation_id: prompt.organisationId,
    snippet: { id: prompt.id, category: 'aiPrompt' },
});
const getMappedValue = (map: Record<string, string>, prompt: AiPromptRecord) => {
    const compoundId = getPromptCompoundId(prompt);
    return map[compoundId] || map[prompt.id] || '';
};
const BufferedAiPromptSheetInput = ({ initialValue, startValue, placeholder, multiline = false, onSave, onCancel, onNavigateFromCleanEdit, }: {
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
const AiPromptModelsCellEditor = ({ cellElement, prompt, onSave, onCancel, }: {
    cellElement: HTMLElement | null;
    prompt: AiPromptRecord;
    onSave: (value: AiPromptModelUpdate) => void;
    onCancel: () => void;
}) => {
    const [enabledModelIds, setEnabledModelIds] = React.useState<string[]>(() => {
        const resolved = resolveEnabledAiPromptModels(prompt);
        return resolved.length ? resolved.map(model => model.id) : ['gpt', 'claude'];
    });
    const [modelUrls, setModelUrls] = React.useState<Record<string, string>>(() => ({ ...(prompt.modelUrls || {}) }));
    const [customModels, setCustomModels] = React.useState<CustomModelConfig[]>(() => [...(prompt.customModels || [])]);
    const popoverRef = React.useRef<HTMLDivElement | null>(null);
    const finishedRef = React.useRef(false);
    React.useLayoutEffect(() => {
        popoverRef.current?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus();
    }, []);
    const position = React.useMemo(() => {
        const rect = cellElement?.getBoundingClientRect();
        const width = Math.min(390, window.innerWidth - 24);
        if (!rect)
            return { top: 100, left: 12, width };
        const left = Math.max(12, Math.min(rect.left - 160, window.innerWidth - width - 12));
        const top = Math.min(rect.bottom + 4, window.innerHeight - 380);
        return { top: Math.max(12, top), left, width };
    }, [cellElement]);
    const save = React.useCallback(() => {
        if (finishedRef.current)
            return;
        finishedRef.current = true;
        onSave({ enabledModelIds, modelUrls, customModels });
    }, [customModels, enabledModelIds, modelUrls, onSave]);
    React.useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (!target)
                return;
            if (popoverRef.current?.contains(target) || cellElement?.contains(target))
                return;
            save();
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [cellElement, save]);
    return createPortal(<div ref={popoverRef} data-ignore-grid-nav="true" style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 99999,
            backgroundColor: 'var(--color-popupBg)',
        }} className="overflow-hidden rounded-[18px] border border-[var(--color-borderDefault)] p-3 shadow-2xl" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                finishedRef.current = true;
                onCancel();
            }
            else if (event.key === 'Tab') {
                const focusable = Array.from(popoverRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)') || []);
                const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
                if ((event.shiftKey && activeIndex === 0) || (!event.shiftKey && activeIndex === focusable.length - 1)) {
                    save();
                }
            }
        }}>
      <AiPromptModelSelectorPanel value={{ enabledModelIds, modelUrls, customModels }} onChange={next => {
            setEnabledModelIds(next.enabledModelIds);
            setModelUrls(next.modelUrls);
            setCustomModels(next.customModels);
        }}/>
    </div>, document.body);
};
export const AiPromptCollectionSheetView: React.FC<AiPromptCollectionSheetViewProps> = ({ prompts, isExpanded = false, shortcutsMap, hotkeysMap, tagNamesMap = {}, isFavorite, onOpenPrompt, onRunPrompt, onRunPromptWithoutSavedPrompt, onToggleFavorite, onDeletePrompt, onUpdateTitle, onUpdatePrompt, onUpdateShortcut, onUpdateHotkey, onUpdateModels, onUpdateTags, }) => {
    const sortedPrompts = React.useMemo(() => [...prompts], [prompts]);
    const groupedPromptSections = React.useMemo(() => buildModelGroups(sortedPrompts), [sortedPrompts]);
    const visiblePrompts = React.useMemo(() => groupedPromptSections.flatMap(group => group.prompts), [groupedPromptSections]);
    const promptRowIndexById = React.useMemo(() => {
        const rowIndexById = new Map<string, number>();
        visiblePrompts.forEach((prompt, index) => rowIndexById.set(prompt.id, index));
        return rowIndexById;
    }, [visiblePrompts]);
    const [selectedCell, setSelectedCell] = React.useState<CellPosition | null>(null);
    const [editingCell, setEditingCell] = React.useState<CellPosition | null>(null);
    const { isKeyboardHighlight, isHoveredRow, rowPointerProps } = useCollectionSheetHighlight();
    const selectedCellRef = React.useRef<CellPosition | null>(null);
    const editingCellRef = React.useRef<CellPosition | null>(null);
    const [focusedActionCell, setFocusedActionCell] = React.useState<{
        rowIndex: number;
        target: ActionCellTarget;
    } | null>(null);
    const cellRefs = React.useRef<Record<string, HTMLTableCellElement | null>>({});
    const tableRef = React.useRef<HTMLTableElement | null>(null);
    type AiPromptSheetColumn = (typeof AI_PROMPT_SHEET_COLUMNS)[number];
    const displayColumns: readonly AiPromptSheetColumn[] = AI_PROMPT_SHEET_COLUMNS;
    const dividerColumnIndexes = React.useMemo(() => displayColumns.reduce<number[]>((indexes, column, index) => hasRightDivider(column.id) && index < displayColumns.length - 1 ? [...indexes, index] : indexes, []), [displayColumns]);
    const dividerOffsets = useCollectionSheetColumnDividerOffsets(tableRef, dividerColumnIndexes);
    const sheetWidth = React.useMemo(() => {
        let total = 0;
        for (const column of displayColumns) {
            total += column.width;
        }
        return total;
    }, [displayColumns]);
    const visibleColumnIndexes = React.useMemo(() => displayColumns.map(column => AI_PROMPT_SHEET_COLUMNS.findIndex(candidate => candidate.id === column.id)), [displayColumns]);
    const focusCell = React.useCallback((rowIndex: number, colIndex: number, shouldAutoOpen = false, actionTarget: ActionCellTarget = 'favorite') => {
        const columnId = AI_PROMPT_SHEET_COLUMNS[colIndex]?.id;
        if (!columnId || !isSelectableColumn(columnId) || !visibleColumnIndexes.includes(colIndex))
            return;
        const nextCell = { rowIndex, colIndex };
        const shouldAutoEditCell = shouldAutoOpen && isEditableColumn(columnId);
        selectedCellRef.current = nextCell;
        editingCellRef.current = shouldAutoEditCell ? nextCell : null;
        setSelectedCell(nextCell);
        setEditingCell(shouldAutoEditCell ? nextCell : null);
        setFocusedActionCell(columnId === 'actions' ? { rowIndex, target: actionTarget } : null);
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
        if (selectedCell || visiblePrompts.length === 0)
            return;
        focusCell(0, 0, false);
    }, [focusCell, selectedCell, visiblePrompts.length]);
    const { moveCell: moveSelectedCell, handleCellKeyDown, initialTypedValue } = useSheetEngine({
        rowCount: visiblePrompts.length,
        rowIds: visiblePrompts.map(prompt => prompt.id),
        visibleColumnIndexes,
        selectedCell,
        editingCell,
        onSelect: (cell, edit) => focusCell(cell.rowIndex, cell.colIndex, edit, selectedCellRef.current?.colIndex === cell.colIndex && AI_PROMPT_SHEET_COLUMNS[cell.colIndex]?.id === 'actions'
            ? focusedActionCell?.target
            : undefined),
    });
    React.useEffect(() => {
        editingCellRef.current = editingCell;
    }, [editingCell]);
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
            {groupedPromptSections.map((group, groupIndex) => (<React.Fragment key={group.id}>
                <tr className="h-8 overflow-hidden rounded-lg" style={COLLECTION_SHEET_GROUP_ROW_STYLE}>
                  <td colSpan={groupIndex === 0 ? AI_PROMPT_SHEET_GROUP_LABEL_COL_SPAN : displayColumns.length} className="px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-textPrimary)]">
                      <span className="truncate text-[var(--color-textSecondary)]">{group.label}</span>
                      <span className="text-[11px] font-medium tabular-nums text-[var(--color-textMuted)]">
                        {group.prompts.length}
                      </span>
                    </div>
                  </td>
                  {groupIndex === 0 &&
                displayColumns.slice(AI_PROMPT_SHEET_GROUP_LABEL_COL_SPAN).map(column => (<td key={column.id} className={clsx('px-2 py-1.5 text-left text-[12px] font-semibold text-[var(--color-textSecondary)] first:rounded-l-lg last:rounded-r-lg', column.id === 'actions' && 'text-center')}>
                        {column.header}
                      </td>))}
                </tr>
                {group.prompts.map(prompt => {
                const index = promptRowIndexById.get(prompt.id);
                if (index === undefined)
                    return null;
                const shortcut = normalizeShortcut(getMappedValue(shortcutsMap, prompt));
                const hotkey = getMappedValue(hotkeysMap, prompt);
                const tagText = (prompt.tagIds || [])
                    .map(tagId => tagNamesMap[tagId])
                    .filter(Boolean)
                    .join(', ');
                const enabledModels = resolveEnabledAiPromptModels(prompt);
                const cellValues: Record<AiPromptSheetColumnId, string> = {
                    title: prompt.title || 'Untitled Chat Agent',
                    prompt: stripHtml(prompt.prompt || ''),
                    command: shortcut ? `c_${shortcut}` : '',
                    hotkey,
                    models: enabledModels.map(model => model.name).join(', '),
                    tags: tagText,
                    actions: '',
                };
                const favorite = isFavorite(prompt.id);
                return (<tr key={prompt.id} data-collection-sheet-row="true" {...rowPointerProps(index)} className="group/row h-9 bg-transparent text-[var(--color-textPrimary)]">
                      {displayColumns.map((column, colIndex) => {
                        const isSelected = isKeyboardHighlight && selectedCell?.rowIndex === index && selectedCell?.colIndex === colIndex;
                        const isHovered = isHoveredRow(index);
                        const isEditing = editingCell?.rowIndex === index && editingCell?.colIndex === colIndex;
                        const focusedActionTarget = isSelected && column.id === 'actions' && focusedActionCell?.rowIndex === index
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
                                            onDeletePrompt(prompt.id);
                                        }
                                        else {
                                            onToggleFavorite(prompt.id);
                                        }
                                    }
                                    else if (event.key === 'f' || event.key === 'F') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onToggleFavorite(prompt.id);
                                    }
                                    else if (event.key === 'Delete' || event.key === 'Backspace') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onDeletePrompt(prompt.id);
                                    }
                                }}>
                              <div className="flex min-h-[28px] w-full items-center justify-center gap-1">
                                <button type="button" tabIndex={-1} onMouseDown={event => {
                                    event.preventDefault();
                                    const nextCell = { rowIndex: index, colIndex };
                                    selectedCellRef.current = nextCell;
                                    setSelectedCell(nextCell);
                                    setEditingCell(null);
                                    setFocusedActionCell({ rowIndex: index, target: 'favorite' });
                                }} onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onToggleFavorite(prompt.id);
                                }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] transition-colors hover:text-amber-400 focus:outline-none', focusedActionTarget === 'favorite' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-amber-400')} title={favorite ? 'Remove favorite' : 'Add favorite'}>
                                  {favorite ? (<FaStar className="text-xs text-amber-400"/>) : (<FiStar className="text-xs"/>)}
                                </button>
                                <button type="button" tabIndex={-1} onMouseDown={event => {
                                    event.preventDefault();
                                    const nextCell = { rowIndex: index, colIndex };
                                    selectedCellRef.current = nextCell;
                                    setSelectedCell(nextCell);
                                    setEditingCell(null);
                                    setFocusedActionCell({ rowIndex: index, target: 'delete' });
                                }} onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onDeletePrompt(prompt.id);
                                }} className={clsx('flex h-7 w-7 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-70 transition-colors hover:text-[var(--color-error)] hover:opacity-100 focus:outline-none', focusedActionTarget === 'delete' &&
                                    'ring-1 ring-[var(--color-borderActive)] ring-inset bg-[var(--color-hoverBg)] text-[var(--color-error)] opacity-100')} title="Delete Chat Agent">
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
                                handleCellKeyDown(event, { rowIndex: index, colIndex }, column.id === 'title' || column.id === 'prompt' ? 'text' : isEditableColumn(column.id) ? 'popup' : 'readonly');
                            }}>
                            {isEditing && column.id === 'title' ? (<BufferedAiPromptSheetInput initialValue={prompt.title || ''} startValue={initialTypedValue} placeholder="Enter title" onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdateTitle(prompt.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'prompt' ? (<BufferedAiPromptSheetInput initialValue={stripHtml(prompt.prompt || '')} startValue={initialTypedValue} placeholder="Enter prompt" multiline onNavigateFromCleanEdit={moveSelectedCell} onSave={value => onUpdatePrompt(prompt.id, value)} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'command' ? (<GridCommandInput navigateOnCleanArrow={false} itemId={getPromptCompoundId(prompt)} initialValue={shortcut} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                    void onUpdateShortcut(prompt.id, normalizeShortcut(value));
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                    void onUpdateShortcut(prompt.id, normalizeShortcut(value));
                                    setEditingCell(null);
                                }}/>) : isEditing && column.id === 'hotkey' ? (<GridHotkeyInput navigateOnCleanArrow={false} itemId={getPromptCompoundId(prompt)} initialValue={hotkey} requireModifierCombo onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={value => {
                                    void onUpdateHotkey(prompt.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)} onOverwrite={value => {
                                    void onUpdateHotkey(prompt.id, value);
                                    setEditingCell(null);
                                }}/>) : isEditing && column.id === 'models' ? (<AiPromptModelsCellEditor cellElement={cellRefs.current[cellKey]} prompt={prompt} onSave={value => {
                                    void onUpdateModels(prompt.id, value);
                                    setEditingCell(null);
                                }} onCancel={() => setEditingCell(null)}/>) : isEditing && column.id === 'tags' ? (<SpreadsheetTagSelector keepOpenOnEnter cellElement={cellRefs.current[cellKey]} initialTagIds={prompt.tagIds || []} organisationId={prompt.organisationId} onNavigateFromCleanEdit={moveSelectedCell} onCommit={() => moveSelectedCell(1, 0)} onSave={tagIds => {
                                    void onUpdateTags(prompt.id, tagIds);
                                }} onCancel={() => setEditingCell(null)}/>) : column.id === 'models' ? (<div className="flex min-w-0 items-center gap-1.5" title={cellValues.models || 'Select models'}>
                                <CircularModelStackIcon models={enabledModels} variant="compact" maxVisible={3} showOverflowCount={false}/>
                                <span className="min-w-0 truncate text-[11px] text-[var(--color-textSecondary)]">
                                  {enabledModels.length ? `${enabledModels.length} models` : 'Select model'}
                                </span>
                              </div>) : column.id === 'title' ? (<div className="flex min-w-0 items-center gap-1.5">
                                <span className={COLLECTION_SHEET_TITLE_CLASS}>
                                  {cellValues[column.id]}
                                </span>
                                {onOpenPrompt && (<CollectionSheetEditButton itemLabel={prompt.title || 'Untitled Chat Agent'} onEdit={() => onOpenPrompt(prompt)}/>)}
                                {onRunPrompt ? (<button type="button" tabIndex={-1} onMouseDown={event => {
                                        // The title cell opens its editor on click. Keep the
                                        // prompt-open affordance independent from that cell.
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }} onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void onRunPrompt(prompt);
                                    }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-80 transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" title="Open prompt" aria-label={`Open prompt ${prompt.title || 'Untitled Prompt'}`}>
                                    <FiExternalLink size={14}/>
                                  </button>) : null}
                              </div>) : (<span className={clsx('block text-[11px] text-[var(--color-textPrimary)]', (column.id === 'prompt' || column.id === 'tags') && isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate', column.id === 'prompt' && 'opacity-90', column.id === 'tags' && 'opacity-85')}>
                                {cellValues[column.id]}
                              </span>)}
                          </td>);
                    })}
                    </tr>);
            })}
                <tr aria-hidden="true" className="h-9 bg-[var(--color-editorBg)]">
                  <td colSpan={displayColumns.length} className="relative z-20 h-9 bg-[var(--color-editorBg)] p-0"/>
                </tr>
              </React.Fragment>))}
            {sortedPrompts.length === 0 && (<tr>
                <td colSpan={displayColumns.length} className="h-32 text-center text-[12px] text-[var(--color-textMuted)]">
                  No AI Prompts found
                </td>
              </tr>)}
          </tbody>
          </table>
          <CollectionSheetColumnDividers offsets={dividerOffsets}/>
        </div>
      </div>
      {sortedPrompts.length === 0 && onRunPromptWithoutSavedPrompt ? (<div className="flex shrink-0 items-center justify-center gap-2 bg-[var(--color-editorBg)] px-2 py-2">
          <button type="button" onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                void onRunPromptWithoutSavedPrompt();
            }} className="inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-[var(--color-accent)] transition-colors duration-150 hover:opacity-90 focus:outline-none">
            <FiExternalLink size={12} className="shrink-0"/>
            <span className="whitespace-nowrap text-[12px] font-normal leading-none">Run a prompt</span>
          </button>
      </div>) : null}
    </div>
    </div>);
};
export default AiPromptCollectionSheetView;
