import * as React from 'react';
import { FiStar, FiTrash2 } from 'react-icons/fi';
import type { NoteRecord } from '../../allObjectFolder/src/createObject/notes/noteTypes';
import { useSheetEngine } from '../sheetEngine/useSheetEngine';
import { useUIStore } from '../uiStateManager';
import { CollectionSheetBackButton } from '../collectionSheets/CollectionSheetBackButton';
import { GridCommandInput, GridHotkeyInput } from '../spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../spreadsheetUi/ui/SpreadsheetTagSelector';
import { COLLECTION_SHEET_GROUP_ROW_STYLE } from '../collectionSheets/collectionSheetGroupStyle';
import { COLLECTION_SHEET_TITLE_CLASS, CollectionSheetEditButton } from '../collectionSheets/CollectionSheetTitle';
import { COLLECTION_SHEET_HOVERED_CELL_CLASS, useCollectionSheetHighlight } from '../collectionSheets/useCollectionSheetHighlight';
import { CollectionSheetColumnDividers, COLLECTION_SHEET_ROW_HOVER_CELL_CLASS, useCollectionSheetColumnDividerOffsets } from '../collectionSheets/CollectionSheetColumnDividers';

// Match the existing Links sheet's column proportions and typography.
const COLUMNS = ['Title', 'Description', 'Command', 'Hotkey', 'Tags', 'Actions'];
const WIDTHS = [300, 255, 95, 90, 90, 85];
const BASE_SHEET_WIDTH = WIDTHS.reduce((sum, width) => sum + width, 0);
const COLUMN_INDEXES = [0, 1, 2, 3, 4, 5];
const DIVIDERS = [1, 3];

export function noteBodyAsPlainText(body: string): string {
  const doc = new DOMParser().parseFromString(body || '', 'text/html');
  doc.querySelectorAll('script, style').forEach(element => element.remove());
  doc.querySelectorAll('br').forEach(element => element.replaceWith('\n'));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre').forEach(element => element.append('\n'));
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').replace(/\n+$/, '');
}

export function plainTextAsNoteBody(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<p>${escaped || '<br>'}</p>`;
  }).join('');
}

type Cell = { rowIndex: number; colIndex: number };
export type NoteSheetHandle = { flushEdit: () => Promise<boolean> };
type Props = {
  notes: NoteRecord[];
  getCompoundId: (note: NoteRecord) => string;
  shortcutsMap: Record<string, string>;
  hotkeysMap: Record<string, string>;
  tagNamesMap: Record<string, string>;
  isFavorite: (id: string) => boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (note: NoteRecord, changes: { title?: string; body?: string; tagIds?: string[]; assetIds?: string[] }) => Promise<void>;
  onShortcut: (note: NoteRecord, value: string) => Promise<void>;
  onHotkey: (note: NoteRecord, value: string) => Promise<void>;
  onFavorite: (note: NoteRecord) => Promise<void>;
};

function PlainTextCell({ initialValue, startValue, multiline, onSave, onCancel, move, registerCommit }: {
  initialValue: string; startValue: string | null; multiline: boolean;
  onSave: (value: string) => Promise<void>; onCancel: () => void; move: (row: number, column: number) => void;
  registerCommit: (commit: (() => Promise<boolean>) | null) => void;
}) {
  const [value, setValue] = React.useState(startValue ?? initialValue);
  const [error, setError] = React.useState('');
  const original = React.useRef(initialValue);
  const originalSave = React.useRef(onSave);
  const pending = React.useRef<Promise<boolean> | null>(null);
  const skipBlur = React.useRef(false);
  const textInputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const attachTextInput = React.useCallback((element: HTMLInputElement | HTMLTextAreaElement | null) => {
    textInputRef.current = element;
  }, []);
  React.useLayoutEffect(() => {
    const input = textInputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, []);
  const commit = (delta?: [number, number]): Promise<boolean> => {
    if (pending.current) return pending.current;
    pending.current = (async () => {
      try {
        if (value !== original.current) await originalSave.current(value);
        onCancel();
        if (delta) move(...delta);
        return true;
      } catch (reason) {
        skipBlur.current = false;
        setError(reason instanceof Error ? reason.message : 'Unable to save note.');
        return false;
      } finally { pending.current = null; }
    })();
    return pending.current;
  };
  React.useEffect(() => {
    registerCommit(() => commit());
    return () => registerCommit(null);
  });
  React.useEffect(() => useUIStore.getState().registerEscapeInterceptor(() => {
    skipBlur.current = true;
    onCancel();
    return true;
  }), [onCancel]);
  const inputProps = {
    ref: attachTextInput, value,
    'aria-label': multiline ? 'Edit description' : 'Edit title',
    className: 'w-full min-h-[34px] bg-transparent px-0.5 py-1 text-[11px] text-[var(--color-textPrimary)] outline-none resize-none',
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value),
    onBlur: () => { if (!skipBlur.current) void commit(); },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); skipBlur.current = true; onCancel(); }
      else if ((event.key === 'Enter' && !(multiline && event.shiftKey)) || event.key === 'Tab') {
        event.preventDefault(); skipBlur.current = true;
        void commit(event.key === 'Tab' ? [0, event.shiftKey ? -1 : 1] : [1, 0]);
      }
    },
  };
  return <>{multiline ? <textarea {...inputProps} rows={3} /> : <input {...inputProps} />}
    {error && <div role="alert" className="text-[11px] text-[var(--color-danger)]">{error}</div>}</>;
}

export const NoteCollectionSheetView = React.forwardRef<NoteSheetHandle, Props>(function NoteCollectionSheetView(props, handleRef) {
  const [selected, setSelected] = React.useState<Cell | null>(null);
  const [editing, setEditing] = React.useState<Cell | null>(null);
  const [error, setError] = React.useState('');
  const [actionTarget, setActionTarget] = React.useState<'favorite' | 'delete'>('favorite');
  const commitRef = React.useRef<(() => Promise<boolean>) | null>(null);
  const pendingSave = React.useRef<Promise<boolean> | null>(null);
  const registerCommit = React.useCallback((commit: (() => Promise<boolean>) | null) => { commitRef.current = commit; }, []);
  const order = React.useRef<string[]>([]);
  // Saving updatedAt must not move the row under the user's cursor.
  const rows = React.useMemo(() => {
    const byId = new Map(props.notes.map(note => [note.id, note]));
    order.current = [...order.current.filter(id => byId.has(id)), ...props.notes.map(note => note.id).filter(id => !order.current.includes(id))];
    return order.current.map(id => byId.get(id)!);
  }, [props.notes]);
  const rowIds = React.useMemo(() => rows.map(note => note.id), [rows]);
  const refs = React.useRef<Record<string, HTMLTableCellElement | null>>({});
  const tableRef = React.useRef<HTMLTableElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const hasFocusedSheet = React.useRef(false);
  const [fit, setFit] = React.useState(1);
  const highlight = useCollectionSheetHighlight();
  const select = React.useCallback((cell: Cell, edit: boolean) => {
    const apply = () => { setSelected(cell); setEditing(edit ? cell : null); };
    if (editing && (editing.rowIndex !== cell.rowIndex || editing.colIndex !== cell.colIndex)) {
      // A mouse click must wait for blur-saving the previous text cell, too.
      const pending = commitRef.current ? commitRef.current() : pendingSave.current;
      if (pending) { void pending.then(saved => { if (saved) apply(); }); return; }
    }
    apply();
  }, [editing]);
  const { moveCell, handleCellKeyDown, initialTypedValue } = useSheetEngine({
    rowCount: rows.length, rowIds, visibleColumnIndexes: COLUMN_INDEXES,
    selectedCell: selected, editingCell: editing, onSelect: select, onKeyboardNavigation: highlight.markKeyboard,
  });
  React.useLayoutEffect(() => {
    if (rows.length === 0) {
      setSelected(null);
      setEditing(null);
      return;
    }
    if (!selected) select({ rowIndex: 0, colIndex: 0 }, false);
  }, [rows.length, selected, select]);
  React.useEffect(() => {
    if (!editing || editing.colIndex < 2) return;
    return useUIStore.getState().registerEscapeInterceptor(() => {
      setEditing(null); pendingSave.current = null; setError(''); return true;
    });
  }, [editing]);
  const offsets = useCollectionSheetColumnDividerOffsets(tableRef, DIVIDERS);
  React.useLayoutEffect(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    const resize = () => {
      const style = getComputedStyle(viewport);
      const available = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (available <= 0) return;
      setFit(Math.min(1, available / BASE_SHEET_WIDTH));
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  React.useEffect(() => {
    if (!selected || editing) return;
    // Filtering in the left panel must retain the search input's focus.
    const focused = document.activeElement;
    if (hasFocusedSheet.current && focused instanceof HTMLInputElement && focused.closest('[data-right-side-items-panel="true"]')) return;
    const cell = refs.current[`${selected.rowIndex}:${selected.colIndex}`];
    if (!cell) return;
    cell.focus({ preventScroll: true });
    hasFocusedSheet.current = true;
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected, editing]);
  const save = (operation: () => Promise<void>) => {
    const task = (async () => {
      try { await operation(); setError(''); setEditing(null); return true; }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save note.'); return false; }
    })();
    pendingSave.current = task;
    return task;
  };
  const flushEdit = async () => {
    if (commitRef.current && !await commitRef.current()) return false;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && viewportRef.current?.contains(focused)) focused.blur();
    if (pendingSave.current && !await pendingSave.current) return false;
    setEditing(null);
    return true;
  };
  React.useImperativeHandle(handleRef, () => ({ flushEdit }));
  return <div className="flex-1 flex flex-col min-h-0 min-w-0" ref={viewportRef}>
    <div className="relative mx-auto flex w-full flex-1 flex-col min-h-0 min-w-0" style={{ width: '100%', maxWidth: BASE_SHEET_WIDTH, alignSelf: 'center' }}>
    <CollectionSheetBackButton/>
    <div ref={scrollAreaRef} className="w-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar pt-4 pb-4">
      {error && <div role="alert" className="mb-2 text-[11px] text-[var(--color-danger)]">{error}</div>}
      <div className="relative" style={{ zoom: fit, width: BASE_SHEET_WIDTH }}>
        <table ref={tableRef} aria-label="Notes collection" className="w-full table-fixed border-separate border-spacing-0 bg-transparent">
          <colgroup>{WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <thead><tr className="h-8" style={COLLECTION_SHEET_GROUP_ROW_STYLE}>{COLUMNS.map(label => <th key={label} scope="col" className="px-3 py-1.5 text-left text-[12px] font-semibold text-[var(--color-textSecondary)] first:rounded-l-lg last:rounded-r-lg">{label}</th>)}</tr></thead>
          <tbody>{rows.map((note, rowIndex) => {
            const compoundId = props.getCompoundId(note);
            const values = [note.title || 'Untitled Note', noteBodyAsPlainText(note.body), props.shortcutsMap[compoundId] || props.shortcutsMap[note.id] || '', props.hotkeysMap[compoundId] || props.hotkeysMap[note.id] || '', (note.tagIds || []).map(id => props.tagNamesMap[id] || id).join(', ')];
            return <tr key={note.id} data-collection-sheet-row="true" className="group/row h-10" {...highlight.rowPointerProps(rowIndex)}>
              {COLUMNS.map((label, colIndex) => {
                const key = `${rowIndex}:${colIndex}`;
                const active = selected?.rowIndex === rowIndex && selected.colIndex === colIndex;
                const edit = editing?.rowIndex === rowIndex && editing.colIndex === colIndex;
                const cancel = () => { setEditing(null); pendingSave.current = null; setError(''); };
                return <td key={label} ref={element => { refs.current[key] = element; }} tabIndex={0}
                  aria-label={`${label}: ${values[colIndex] || note.title}`}
                  className={`${COLLECTION_SHEET_ROW_HOVER_CELL_CLASS} px-2 py-1 align-middle text-[11px] text-[var(--color-textPrimary)] outline-none ${highlight.isHoveredRow(rowIndex) ? COLLECTION_SHEET_HOVERED_CELL_CLASS : ''} ${active && colIndex !== 5 ? 'ring-1 ring-inset ring-[var(--color-borderActive)]' : ''}`}
                  onFocus={event => { if (event.target === event.currentTarget && !active) select({ rowIndex, colIndex }, false); }}
                  onClick={() => { if (!edit) select({ rowIndex, colIndex }, colIndex !== 5); }}
                  onKeyDown={event => {
                    if (colIndex === 5 && event.target === event.currentTarget && !editing && !event.altKey && !event.ctrlKey && !event.metaKey) {
                      if ((!event.shiftKey && event.key === 'ArrowRight' && actionTarget === 'favorite') || (!event.shiftKey && event.key === 'ArrowLeft' && actionTarget === 'delete') || (event.key === 'Tab' && ((!event.shiftKey && actionTarget === 'favorite') || (event.shiftKey && actionTarget === 'delete')))) {
                        event.preventDefault(); event.stopPropagation(); setActionTarget(current => current === 'favorite' ? 'delete' : 'favorite'); return;
                      }
                    }
                    handleCellKeyDown(event, { rowIndex, colIndex }, colIndex === 5 ? 'action' : colIndex === 3 || colIndex === 4 ? 'popup' : 'text', () => {
                      if (actionTarget === 'delete') props.onDelete(note.id);
                      else void save(() => props.onFavorite(note));
                    });
                  }}>
                  {edit && colIndex < 2 ? <PlainTextCell key={key} initialValue={values[colIndex]} startValue={initialTypedValue} multiline={colIndex === 1} onCancel={cancel} move={moveCell} registerCommit={registerCommit}
                    onSave={value => props.onUpdate(note, colIndex === 0 ? { title: value } : { body: plainTextAsNoteBody(value), assetIds: [] })} />
                  : edit && (colIndex === 2 || colIndex === 3) ? React.createElement(colIndex === 2 ? GridCommandInput : GridHotkeyInput, {
                    itemId: compoundId, initialValue: colIndex === 2 ? initialTypedValue ?? values[colIndex] : values[colIndex], navigateOnCleanArrow: false,
                    requireModifierCombo: colIndex === 3, onCancel: cancel, onNavigateFromCleanEdit: moveCell,
                    onCommit: () => moveCell(1, 0),
                    onSave: (value: string) => { void save(() => colIndex === 2 ? props.onShortcut(note, value) : props.onHotkey(note, value)); },
                    onOverwrite: (value: string) => { void save(() => colIndex === 2 ? props.onShortcut(note, value) : props.onHotkey(note, value)); },
                  })
                  : edit && colIndex === 4 ? <SpreadsheetTagSelector cellElement={refs.current[key]} initialTagIds={note.tagIds || []} organisationId={note.organisationId} entityType="note" onCancel={cancel} onNavigateFromCleanEdit={moveCell} onCommit={() => moveCell(1, 0)} onSave={tagIds => { void save(() => props.onUpdate(note, { tagIds })); }} />
                  : colIndex === 5 ? <div className="flex items-center justify-center gap-2">
                    <button type="button" tabIndex={-1} aria-label={`Favorite ${note.title}`} aria-pressed={props.isFavorite(compoundId)} onClick={event => { event.stopPropagation(); setActionTarget('favorite'); select({ rowIndex, colIndex }, false); void save(() => props.onFavorite(note)); }} className={`h-6 w-6 shrink-0 flex items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] ${active && actionTarget === 'favorite' ? 'rounded ring-1 ring-[var(--color-borderActive)]' : ''}`}><FiStar size={14} className={props.isFavorite(compoundId) ? 'fill-current text-[var(--color-warning)]' : ''} /></button>
                    <button type="button" tabIndex={-1} aria-label={`Delete ${note.title}`} onClick={event => { event.stopPropagation(); setActionTarget('delete'); select({ rowIndex, colIndex }, false); props.onDelete(note.id); }} className={`h-6 w-6 shrink-0 flex items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-danger)] ${active && actionTarget === 'delete' ? 'rounded ring-1 ring-[var(--color-borderActive)]' : ''}`}><FiTrash2 size={14} /></button>
                  </div>
                  : colIndex === 0 ? <div className="flex items-center gap-2"><span className={COLLECTION_SHEET_TITLE_CLASS}>{values[0]}</span><CollectionSheetEditButton itemLabel={values[0]} onEdit={() => props.onOpen(note.id)} /></div>
                  : <div className={`${colIndex === 4 ? 'whitespace-pre-wrap break-words' : 'truncate'} text-[var(--color-textSecondary)]`} title={values[colIndex]}>{values[colIndex]}</div>}
                </td>;
              })}
            </tr>;
          })}{!rows.length && <tr><td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-[12px] text-[var(--color-textMuted)]">No notes found</td></tr>}</tbody>
        </table>
        <CollectionSheetColumnDividers offsets={offsets} />
      </div>
    </div>
    </div>
  </div>;
});
