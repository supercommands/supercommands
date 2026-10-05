import { useRef, useState, type KeyboardEvent } from 'react';
import { VisualKeyDisplay } from '../../../../../shared-components/hotkeys/ui/VisualKeyDisplay';
import { TagAppearance } from '../../../../../shared-components/editorToolbar/TagAppearance';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { FiStar, FiTrash2 } from 'react-icons/fi';
import { GridCommandInput, GridHotkeyInput } from '../../../../../shared-components/spreadsheetUi/ui/spreadsheetShortcutInputs';
import { SpreadsheetTagSelector } from '../../../../../shared-components/spreadsheetUi/ui/SpreadsheetTagSelector';
import type { TimelineItem } from './timelineData';
import { canEditTimelineAssignment, canEditTimelineTags, isTimelineEditorItem, saveTimelineCommand, saveTimelineHotkey, saveTimelineTags } from './timelineProperties';

type Property = 'command' | 'hotkey' | 'tags';

interface Props {
    item: TimelineItem;
    timestamp: number;
    typeLabel: string;
    icon: React.ReactNode;
    shortcutsMap: Record<string, string>;
    hotkeysMap: Record<string, string>;
    tagNames: Map<string, string>;
    isFavorite: boolean;
    onOpen: () => void;
    onToggleFavorite: () => Promise<void>;
    onDelete: () => void;
    onChanged: () => Promise<void>;
    onError: (message: string) => void;
}

const propertyValue = (map: Record<string, string>, id: string): string =>
    map[id] || Object.entries(map).find(([referenceId]) => referenceId.endsWith(`-${id}`))?.[1] || '';

export default function TimelineExpandedRow({ item, timestamp, typeLabel, icon, shortcutsMap, hotkeysMap, tagNames, isFavorite, onOpen, onToggleFavorite, onDelete, onChanged, onError }: Props) {
    const [editing, setEditing] = useState<Property | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const tagsAnchor = useRef<HTMLButtonElement>(null);
    const editVersion = useRef(0);
    const pendingSave = useRef<number | null>(null);
    const navigation = useRef<[number, number] | null>(null);
    const tagWrites = useRef<Promise<void>>(Promise.resolve());
    const [tagDraft, setTagDraft] = useState<string[]>([]);
    const dbTags = useDbStore(state => state.tags);
    const editable = isTimelineEditorItem(item);
    const assignmentEditable = canEditTimelineAssignment(item);
    const tagsEditable = canEditTimelineTags(item);
    const command = assignmentEditable ? propertyValue(shortcutsMap, item.id) : '';
    const commandReferenceId = Object.keys(shortcutsMap).find(referenceId => referenceId === item.id || referenceId.endsWith(`-${item.id}`)) || item.id;
    const hotkey = assignmentEditable ? propertyValue(hotkeysMap, item.id) : '';
    const hotkeyReferenceId = Object.keys(hotkeysMap).find(referenceId => referenceId === item.id || referenceId.endsWith(`-${item.id}`)) || item.id;
    const tagIds = item.tagIds || [];
    const tags = tagIds.map(id => tagNames.get(id) || id).join(', ');
    const properties: Property[] = ['command', 'hotkey', 'tags'];
    const cellClass = 'flex h-full min-h-[36px] w-full min-w-0 items-center overflow-hidden rounded px-2 py-1 text-left text-[11px] font-normal text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--color-borderActive)]';
    const focusCell = (property: Property, rowDelta = 0, colDelta = 0) => {
        const rows = Array.from(rowRef.current?.closest('main')?.querySelectorAll<HTMLElement>('[data-timeline-editable-row]') || []);
        const rowIndex = rows.indexOf(rowRef.current!);
        const selector = (name: Property) => `button[data-timeline-property="${name}"]`;
        let target: HTMLButtonElement | null | undefined;
        if (rowDelta) {
            for (let index = rowIndex + rowDelta; index >= 0 && index < rows.length; index += rowDelta) {
                target = rows[index].querySelector<HTMLButtonElement>(selector(property));
                if (target) break;
            }
        } else if (colDelta) {
            const cells = rows.flatMap(row => properties.map(name => ({ row, name, button: row.querySelector<HTMLButtonElement>(selector(name)) })));
            const index = cells.findIndex(cell => cell.row === rowRef.current && cell.name === property);
            for (let next = index + colDelta; next >= 0 && next < cells.length; next += colDelta) {
                target = cells[next].button;
                if (target) break;
            }
        }
        (target || rowRef.current?.querySelector<HTMLButtonElement>(selector(property)))?.focus();
    };
    const beginEdit = (property: Property) => {
        editVersion.current++;
        navigation.current = null;
        onError('');
        if (property === 'tags') setTagDraft([...tagIds]);
        setEditing(property);
    };
    const cancelEdit = (property: Property) => {
        editVersion.current++;
        setEditing(null);
        const version = editVersion.current;
        requestAnimationFrame(() => {
            if (editVersion.current === version && (document.activeElement === document.body || rowRef.current?.contains(document.activeElement))) focusCell(property);
        });
    };
    const navigate = (property: Property, rowDelta: number, colDelta: number) => {
        if (pendingSave.current === editVersion.current) navigation.current = [rowDelta, colDelta];
        else {
            editVersion.current++;
            setEditing(null);
            requestAnimationFrame(() => focusCell(property, rowDelta, colDelta));
        }
    };
    const cellKeys = (event: KeyboardEvent<HTMLButtonElement>, property: Property) => {
        const deltas: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        if (deltas[event.key]) {
            event.preventDefault();
            event.stopPropagation();
            focusCell(property, ...deltas[event.key]);
        } else if (event.key === 'F2') {
            event.preventDefault();
            beginEdit(property);
        }
    };
    const save = async (property: Property, action: () => Promise<void>) => {
        const version = editVersion.current;
        if (pendingSave.current === version) return;
        pendingSave.current = version;
        const restoreFocus = Boolean(rowRef.current?.contains(document.activeElement));
        try {
            await action();
            await onChanged();
            if (editVersion.current !== version) return;
            const next = navigation.current;
            setEditing(null);
            onError('');
            if (next || (restoreFocus && rowRef.current?.contains(document.activeElement))) {
                requestAnimationFrame(() => focusCell(property, ...(next || [0, 0] as [number, number])));
            }
        } catch (reason) {
            onError(reason instanceof Error ? reason.message : 'Could not save this property.');
        } finally {
            if (pendingSave.current === version) pendingSave.current = null;
        }
    };

    return <div ref={rowRef} data-timeline-editable-row={assignmentEditable || tagsEditable ? true : undefined} className="grid min-h-[36px] min-w-[1100px] grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,1fr))_minmax(0,0.8fr)] items-stretch gap-3 px-4 py-1 text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)]">
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 pr-6 text-left text-sm font-medium text-[var(--color-textPrimary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <span className="shrink-0 text-[var(--color-iconDefault)]">{icon}</span><span className="min-w-0 max-w-sm truncate" title={item.title}>{item.title}</span>
        </button>
        <span className="flex items-center truncate">{typeLabel}</span>
        {timestamp > 0 ? <time className="flex items-center" dateTime={new Date(timestamp).toISOString()}>{new Date(timestamp).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time> : <span/>}
        {assignmentEditable ? <div className={editing === 'command' ? 'min-w-0 rounded ring-1 ring-inset ring-[var(--color-borderActive)]' : 'min-w-0'}>
            {editing === 'command' ? <GridCommandInput itemId={commandReferenceId} initialValue={command} onCancel={() => cancelEdit('command')} onSave={value => { void save('command', () => saveTimelineCommand(item, value)); }} onOverwrite={value => { void save('command', () => saveTimelineCommand(item, value)); }} navigateOnCleanArrow={false} onCommit={() => navigate('command', 1, 0)} onNavigateFromCleanEdit={(row, col) => navigate('command', row, col)}/>
                : <button type="button" data-timeline-property="command" onKeyDown={event => cellKeys(event, 'command')} onClick={() => beginEdit('command')} aria-label={`Edit command for ${item.title}`} title={command ? `c_${command}` : 'Set command'} className={cellClass}><span className="truncate">{command ? `c_${command}` : ''}</span></button>}
        </div> : <span/>}
        {assignmentEditable ? <div className={editing === 'hotkey' ? 'min-w-0 rounded ring-1 ring-inset ring-[var(--color-borderActive)]' : 'min-w-0'}>
            {editing === 'hotkey' ? <GridHotkeyInput itemId={hotkeyReferenceId} initialValue={hotkey} onCancel={() => cancelEdit('hotkey')} onSave={value => { void save('hotkey', () => saveTimelineHotkey(item, value, undefined, hotkeyReferenceId)); }} onOverwrite={(value, conflictId) => { void save('hotkey', () => saveTimelineHotkey(item, value, conflictId, hotkeyReferenceId)); }} navigateOnCleanArrow={false} requireModifierCombo onCommit={() => navigate('hotkey', 1, 0)} onNavigateFromCleanEdit={(row, col) => navigate('hotkey', row, col)}/>
                : <button type="button" data-timeline-property="hotkey" onKeyDown={event => cellKeys(event, 'hotkey')} onClick={() => beginEdit('hotkey')} aria-label={`Edit hotkey for ${item.title}`} title={hotkey || 'Set hotkey'} className={cellClass}>{hotkey && <VisualKeyDisplay hotkey={hotkey} variant="text"/>}</button>}
        </div> : <span/>}
        {tagsEditable ? <div className="min-w-0">
            <button ref={tagsAnchor} type="button" data-timeline-property="tags" onKeyDown={event => cellKeys(event, 'tags')} onClick={() => beginEdit('tags')} aria-label={`Edit tags for ${item.title}`} title={tags || 'Edit tags'} className={cellClass}>
                <span className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap">{tagIds.map((id, index) => {
                    const tag = dbTags.find(candidate => candidate.id === id);
                    return <span key={id} className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1">
                        {tag && (!tag.workspaceId || tag.appearance) && <TagAppearance tag={tag}/>}
                        <span className="truncate">{tag?.name || id}{index < tagIds.length - 1 ? ',' : ''}</span>
                    </span>;
                })}</span>
            </button>
            {editing === 'tags' && <SpreadsheetTagSelector keepOpenOnEnter cellElement={tagsAnchor.current} initialTagIds={tagDraft} organisationId={item.organisationId} entityType={item.kind === 'collectionItem' ? undefined : item.kind} onCancel={() => cancelEdit('tags')} onNavigateFromCleanEdit={(row, col) => navigate('tags', row, col)} onSave={ids => {
                tagWrites.current = tagWrites.current.then(async () => {
                    await saveTimelineTags(item, ids);
                    await onChanged();
                    onError('');
                }).catch(reason => onError(reason instanceof Error ? reason.message : 'Could not save tags.'));
            }}/>}
        </div> : <span/>}
        {editable ? <div className="flex items-center justify-center gap-2">
            <button type="button" aria-label={`${isFavorite ? 'Remove favorite' : 'Add favorite'} ${item.title}`} aria-pressed={isFavorite} onClick={() => { void onToggleFavorite().catch(reason => onError(reason instanceof Error ? reason.message : 'Could not update favorite.')); }} className="flex h-6 w-6 items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><FiStar size={14} className={isFavorite ? 'fill-current text-[var(--color-warning)]' : ''}/></button>
            <button type="button" aria-label={`Delete ${item.title}`} onClick={onDelete} className="flex h-6 w-6 items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><FiTrash2 size={14}/></button>
        </div> : <span/>}
    </div>;
}
