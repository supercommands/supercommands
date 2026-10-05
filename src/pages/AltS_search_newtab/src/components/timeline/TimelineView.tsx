import TextExpanderIcon from '../../../../../shared-components/icons/TextExpanderIcon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, FileText, Folder, Star } from 'lucide-react';
import { BsCalendarCheck } from 'react-icons/bs';
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useUser } from '../../../../../shared-components/favorites/favoriteHooks';
import type { FavoriteRecord } from '../../../../../shared-components/favorites/favoriteTypes';
import { toggleFavoriteRecord } from '../../../../../shared-components/favorites/favoriteData';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/utils/idGenerator';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import { StackedLinkIcon } from '../../../../../shared-components/icons/stackedLinkIcon';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { loadTimelineItems, type TimelineItem } from './timelineData';
import { readRecentOpens, TIMELINE_ACTIVITY_EVENT, timelineKey, type TimelineKind } from './timelineActivity';
import TimelineExpandedRow from './TimelineExpandedRow';
import { deleteTimelineEditorItem, isTimelineEditorItem } from './timelineProperties';

type TimelineTab = 'opened' | 'created' | 'favorites';
type TimelineLayout = 'grid' | 'list';
type TimelineEntry = { item: TimelineItem; timestamp: number };
type TimelinePanelEntry = TimelineEntry & { id: string };

const FAVORITE_KINDS: Record<string, TimelineKind> = {
    note: 'note', link: 'link', todo: 'todo', snippet: 'snippet',
    aiPrompt: 'aiPrompt', prompt: 'aiPrompt',
};

const favoriteEntries = (favorites: FavoriteRecord[], items: TimelineItem[], userId: string) => {
    const byKey = new Map(items.map(item => [timelineKey(item.kind, item.id), item]));
    const byId = new Map(items.filter(item => FAVORITE_KINDS[item.kind]).map(item => [item.id, item]));
    const seen = new Set<string>();
    return favorites.filter(favorite => favorite.user_id === userId).flatMap(favorite => {
        const kind = FAVORITE_KINDS[favorite.reference_type];
        if (!kind) return [];
        const ids = [favorite.reference_id, extractSnippetIdFromCompoundId(favorite.reference_id)];
        const item = ids.map(id => byKey.get(timelineKey(kind, id)) || byId.get(id)).find(Boolean);
        if (!item) return [];
        const key = timelineKey(item.kind, item.id);
        if (seen.has(key)) return [];
        seen.add(key);
        const timestamp = Number.isFinite(favorite.updatedAt) && favorite.updatedAt > 0 ? favorite.updatedAt : 0;
        return [{ item, timestamp }];
    }).sort((a, b) => b.timestamp - a.timestamp);
};

const KIND_LABELS: Record<TimelineKind, string> = {
    note: 'Note', link: 'Link', todo: 'Todo', snippet: 'Text Expander',
    aiPrompt: 'Chat Agent', collection: 'Webclip', collectionItem: 'Webclip item',
};

const iconFor = (item: TimelineItem, size = 19) => {
    const props = { size, 'aria-hidden': true as const };
    if (item.kind === 'link' || item.kind === 'aiPrompt') {
        return <StackedLinkIcon urls={item.urls} faviconUrls={item.faviconUrls} size={size} maxIcons={3} fallback={item.kind === 'link' ? 'link' : 'session'}/>;
    }
    switch (item.kind) {
        case 'note': return <FileText {...props}/>;
        case 'todo': return <BsCalendarCheck {...props}/>;
        case 'snippet': return <TextExpanderIcon {...props}/>;
        case 'collection': return <Folder {...props}/>;
        case 'collectionItem': return <FileText {...props}/>;
    }
};

const dateKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const dateHeading = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    if (dateKey(timestamp) === dateKey(today.getTime())) return 'Today';
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (dateKey(timestamp) === dateKey(yesterday.getTime())) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const groupTimelineEntries = (entries: TimelineEntry[], tab: TimelineTab) => {
    if (tab === 'favorites') return entries.length ? [{ key: 'favorites', heading: 'Favorites', entries }] : [];
    const result: { key: string; heading: string; entries: TimelineEntry[] }[] = [];
    for (const entry of entries) {
        const key = dateKey(entry.timestamp);
        const last = result[result.length - 1];
        if (last?.key === key) last.entries.push(entry);
        else result.push({ key, heading: dateHeading(entry.timestamp), entries: [entry] });
    }
    return result;
};

const TimelineView = () => {
    const [tab, setTab] = useState<TimelineTab>('opened');
    const [layout, setLayout] = useState<TimelineLayout>(() => {
        try { return localStorage.getItem('supercommands.timeline.layout.v2') === 'grid' ? 'grid' : 'list'; }
        catch { return 'list'; }
    });
    const [panelSearch, setPanelSearch] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<TimelineItem | null>(null);
    const [actionError, setActionError] = useState('');
    const [items, setItems] = useState<TimelineItem[]>([]);
    const [opens, setOpens] = useState(readRecentOpens);
    const [limit, setLimit] = useState(80);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const favorites = useDbStore(state => state.favorites);
    const shortcutsMap = useDbStore(state => state.shortcutsMap);
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const tags = useDbStore(state => state.tags);
    const userId = useUser();
    const tagNames = useMemo(() => new Map(tags.map(tag => [tag.id, tag.name])), [tags]);
    const favoriteIds = useMemo(() => new Set(favoriteEntries(favorites, items, userId).map(entry => timelineKey(entry.item.kind, entry.item.id))), [favorites, items, userId]);

    useEffect(() => {
        try { localStorage.setItem('supercommands.timeline.layout.v2', layout); }
        catch { /* Keep the selected layout for this visit. */ }
    }, [layout]);

    const refresh = useCallback(async () => {
        try {
            const records = await loadTimelineItems();
            setItems(records);
            setOpens(readRecentOpens());
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        void refresh();
        const onFocus = () => { void refresh(); };
        const onStorage = () => setOpens(readRecentOpens());
        const onDbChange = (message: unknown) => {
            if (message && typeof message === 'object' && 'action' in message && message.action === 'db_changed') void refresh();
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('storage', onStorage);
        window.addEventListener(TIMELINE_ACTIVITY_EVENT, onStorage);
        const calendarTimer = window.setInterval(onStorage, 60_000);
        chrome.runtime?.onMessage?.addListener(onDbChange);
        return () => {
            window.clearInterval(calendarTimer);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(TIMELINE_ACTIVITY_EVENT, onStorage);
            chrome.runtime?.onMessage?.removeListener(onDbChange);
        };
    }, [refresh]);

    const entries = useMemo(() => {
        if (tab === 'created') return items.filter(item => item.createdAt > 0).map(item => ({ item, timestamp: item.createdAt }));
        if (tab === 'favorites') return favoriteEntries(favorites, items, userId);
        const byKey = new Map(items.map(item => [timelineKey(item.kind, item.id), item]));
        return opens.flatMap(open => {
            const item = byKey.get(timelineKey(open.kind, open.id));
            return item ? [{ item, timestamp: open.openedAt }] : [];
        }).sort((a, b) => b.timestamp - a.timestamp);
    }, [favorites, items, opens, tab, userId]);

    const visible = entries.slice(0, limit);
    const groups = groupTimelineEntries(visible, tab);
    const panelGroups = groupTimelineEntries(entries, tab).map(group => ({
        key: group.key,
        heading: group.heading,
        items: group.entries.map(entry => ({ ...entry, id: timelineKey(entry.item.kind, entry.item.id) })),
    }));

    const openItem = (item: TimelineItem) => {
        const state = useUIStore.getState();
        if (item.kind === 'collection' || item.kind === 'collectionItem') {
            state.clearEditorStates();
            state.setView({ type: 'collections', organisationId: item.organisationId, collectionId: item.kind === 'collection' ? item.id : item.collectionId, returnToTimeline: true,
                ...(item.kind === 'collectionItem' ? { itemId: item.id } : {}) });
            return;
        }
        state.openEditor({ type: item.kind, id: item.id, props: { returnToTimeline: true } });
    };

    const card = ({ item, timestamp }: { item: TimelineItem; timestamp: number }) => (
        <button key={timelineKey(item.kind, item.id)} type="button" onClick={() => openItem(item)}
            className="group flex min-w-0 flex-col rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4 text-left transition-colors hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <span className="mb-4 text-[var(--color-iconDefault)]">{iconFor(item)}</span>
            <span className="w-full truncate text-sm font-medium text-[var(--color-textPrimary)]" title={item.title}>{item.title}</span>
            <span className="mt-1 line-clamp-2 min-h-9 text-xs text-[var(--color-textSecondary)]">{item.description || KIND_LABELS[item.kind]}</span>
            <span className="mt-4 flex w-full items-center justify-between gap-2 text-xs text-[var(--color-textMuted)]">
                <span className="truncate" title={item.location}>{item.location}</span>
                {timestamp > 0 && <time className="shrink-0" dateTime={new Date(timestamp).toISOString()}>{tab === 'favorites' ? new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</time>}
            </span>
        </button>
    );

    return <main className="flex h-full min-h-0 w-full flex-col bg-[var(--color-rootBg)] text-[var(--color-textPrimary)]">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-6">
            <div className="flex min-w-0 items-center gap-2">
                <button type="button" onClick={() => useUIStore.getState().returnToHome()} aria-label="Back to Home" title="Back to Home"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><ArrowLeft size={18}/></button>
                <h1 className="truncate text-xl font-semibold">Recent</h1>
            </div>
            <button type="button" onClick={() => setLayout(value => value === 'grid' ? 'list' : 'grid')} title={layout === 'grid' ? 'Minimize to list view' : 'Maximize to grid view'} aria-label={layout === 'grid' ? 'Minimize to list view' : 'Maximize to grid view'}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
                {layout === 'grid' ? <FiMinimize2 size={15} aria-hidden="true"/> : <FiMaximize2 size={15} aria-hidden="true"/>}
            </button>
        </header>
        <div className="flex min-h-0 flex-1">
        <RightSideItemsPanel timelineGroups={panelGroups} searchQuery={panelSearch} onSearchChange={setPanelSearch} getItemTitle={entry => entry.item.title} getItemIcon={entry => iconFor(entry.item, 14)} getItemTimestamp={entry => entry.timestamp} onLoadItem={(entry: TimelinePanelEntry) => openItem(entry.item)}/>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
            <div className="mx-auto w-full max-w-6xl">
            <div role="tablist" aria-label="Recent activity" className="mb-8 flex flex-wrap gap-2">
                {([['opened', 'Recently opened'], ['created', 'Created'], ['favorites', 'Favorites']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setLimit(80); setPanelSearch(''); }} className={`rounded-lg border bg-transparent px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${tab === value ? 'border-[var(--color-borderSelected)] text-[var(--color-textPrimary)] ring-1 ring-[var(--color-borderSelected)] font-semibold' : 'border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] font-medium hover:border-[var(--color-borderActive)] hover:bg-[var(--color-hoverBg)]'}`}>{label}</button>)}
            </div>
            {actionError && <div role="alert" className="mb-4 text-sm text-[var(--color-danger)]">{actionError}</div>}
            {status === 'loading' ? <p role="status" className="text-sm text-[var(--color-textSecondary)]">Loading Recent…</p>
                : status === 'error' ? <div role="alert" className="text-sm text-[var(--color-textSecondary)]">Could not load Recent. <button type="button" onClick={() => void refresh()} className="underline">Retry</button></div>
                    : entries.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center text-[var(--color-textSecondary)]">
                        {tab === 'opened' ? <Clock3 size={24} aria-hidden="true"/> : tab === 'created' ? <CalendarDays size={24} aria-hidden="true"/> : <Star size={24} aria-hidden="true"/>}
                        <p className="text-sm font-medium text-[var(--color-textPrimary)]">{tab === 'opened' ? 'No recently opened items yet' : tab === 'created' ? 'No created items yet' : 'No favorite items yet'}</p>
                        <p className="max-w-md text-xs">{tab === 'opened' ? 'Saved items you open will appear here from your five most recent active days.' : tab === 'created' ? 'Saved content will appear here under its creation date.' : 'Favorite saved items from your editors will appear here.'}</p>
                    </div> : <>
                        {groups.map(group => <section key={group.key} aria-label={group.heading} className="mb-9">
                            <h2 className="mb-4 text-lg font-semibold text-[var(--color-textPrimary)]">{group.heading}</h2>
                            {layout === 'grid' ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{group.entries.map(card)}</div>
                                : <div className="overflow-x-auto rounded-lg border border-[var(--color-borderDefault)] custom-scrollbar">
                                    <div className="relative min-w-[1100px]">
                                        <div className="grid min-w-[1100px] grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,1fr))_minmax(0,0.8fr)] gap-3 px-4 py-2 text-xs font-medium text-[var(--color-textSecondary)]"><span>Name</span><span>Type</span><span>{tab === 'opened' ? 'Last opened' : tab === 'created' ? 'Created' : 'Favorite updated'}</span><span>Command</span><span>Hotkey</span><span>Tags</span><span>Actions</span></div>
                                        {group.entries.map(({ item, timestamp }) => <TimelineExpandedRow key={timelineKey(item.kind, item.id)} item={item} timestamp={timestamp} typeLabel={KIND_LABELS[item.kind]} icon={iconFor(item)} shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNames={tagNames} isFavorite={favoriteIds.has(timelineKey(item.kind, item.id))} onOpen={() => openItem(item)} onToggleFavorite={async () => { if (isTimelineEditorItem(item)) await toggleFavoriteRecord(userId, item.id, item.kind, item.title); }} onDelete={() => setDeleteTarget(item)} onChanged={refresh} onError={setActionError}/>)}
                                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 grid gap-3 px-4 grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,1fr))_minmax(0,0.8fr)]">
                                        <span className="col-start-3 row-start-1 border-r border-[var(--color-borderDefault)] opacity-40"/><span className="col-start-5 row-start-1 border-r border-[var(--color-borderDefault)] opacity-40"/>
                                    </div>
                                    </div>
                                </div>}
                        </section>)}
                        {entries.length > limit && <button type="button" onClick={() => setLimit(value => value + 80)} className="rounded-lg border border-[var(--color-borderDefault)] px-4 py-2 text-sm text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Show more</button>}
                    </>}
            </div>
        </div>
        </div>
        <DeleteConfirmation isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title={deleteTarget ? `Delete ${deleteTarget.title}?` : 'Delete item?'} description="This saved item will be permanently deleted. This action cannot be undone." onConfirm={async () => {
            if (!deleteTarget || !isTimelineEditorItem(deleteTarget)) return;
            try { await deleteTimelineEditorItem(deleteTarget); await refresh(); setActionError(''); }
            catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Could not delete this item.'); }
        }}/>
    </main>;
};

export default TimelineView;
