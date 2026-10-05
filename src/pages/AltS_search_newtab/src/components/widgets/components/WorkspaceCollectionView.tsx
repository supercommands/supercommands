import TextExpanderIcon from '../../../../../../shared-components/icons/TextExpanderIcon';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { reflectNewTabTheme } from '../../../../../../../packages/ui/lib/theme/registry';
import { ArrowLeft, LayoutGrid, Pencil, Plus, Settings, X } from 'lucide-react';
import { RightSideItemsPanel } from '../../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { FaCheck, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { BsCalendarCheck } from 'react-icons/bs';
import { FiFileText } from 'react-icons/fi';
import { FiCalendar, FiCheckCircle, FiClock, FiMinusCircle, FiPieChart, FiTrash2 } from 'react-icons/fi';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../../storage/store/useWidgetDashboardStore';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT } from '../../../../../../shared-components/dashboardCollections/dashboardCollectionEvents';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import type { WidgetDashboardState } from '../widgetDashboard.types';
import { createTodo, deleteTodo, mapTodoReferences, updateTodo, updateTodoContent } from '../../../../../../allObjectFolder/src/createObject/todos/todoData';
import { ensureDashboardViewTag } from '../../../../../../allObjectFolder/src/createObject/tags/dashboardTagData';
import type { TodoRecord } from '../../../../../../allObjectFolder/src/createObject/todos/todoTypes';
import type { AiPromptRecord } from '../../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { selectWorkspaceNoteId } from './workspaceCollectionNavigation';
import { requestMissingAiPromptInput } from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
const COLLECTION_BACKGROUND = reflectNewTabTheme.tokens.rootBg;
const NoteEditorView = lazy(() => import('../../../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView').then(module => ({
    default: module.NoteEditorView,
})));
const LinkEditorView = lazy(() => import('../../../../../../allObjectFolder/src/createObject/links/ui/LinkEditorView'));
const SnippetEditorScreen = lazy(() => import('../../../../../../allObjectFolder/src/createObject/snippets/SnippetEditorScreen'));
const AiPromptEditorView = lazy(() => import('../../../../../../allObjectFolder/src/createObject/aiPrompt/ui/AiPromptEditorView').then(module => ({
    default: module.AiPromptEditorView,
})));
const CreateTodoView = lazy(() => import('../../../../../../allObjectFolder/src/createObject/todos/ui/CreateTodoView'));
type CollectionTabId = 'all' | 'notes' | 'links' | 'snippets' | 'chatAgents' | 'todos';
type CollectionIcon = ComponentType<{
    size?: number | string;
    className?: string;
}>;
type CollectionItemKind = 'note' | 'link' | 'snippet' | 'aiPrompt' | 'chatAgent' | 'todo';
type CollectionListItem = {
    id: string;
    kind: CollectionItemKind;
    title: string;
    subtitle: string;
    updatedAt: number;
    record: unknown;
};
type CollectionOverviewSectionProps = {
    title: string;
    icon: CollectionIcon;
    items: CollectionListItem[];
    emptyStateMessage: string;
    createActionLabel: string;
    onOpenItem: (item: CollectionListItem) => void;
    onCreateItem: () => void;
    renderItemLeading?: (item: CollectionListItem) => ReactNode;
    renderItemAction?: (item: CollectionListItem) => ReactNode;
    renderItems?: (items: CollectionListItem[]) => ReactNode;
};
/**
 * Shared overview panel for collection-scoped entities. Each collection type
 * supplies its already-filtered items and retains its own open/create actions.
 */
const CollectionOverviewSection = ({ title, icon: Icon, items, emptyStateMessage, createActionLabel, onOpenItem, onCreateItem, renderItemLeading, renderItemAction, renderItems, }: CollectionOverviewSectionProps) => (<section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)]">
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-borderDefault)] px-4">
      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-textPrimary)]">
        <Icon size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
        <span className="truncate">{title}</span>
        <span className="shrink-0 text-[11px] font-normal tabular-nums text-[var(--color-textMuted)]">
          <span aria-hidden="true">· </span>{items.length}
        </span>
      </div>
      {items.length > 0 && (<button type="button" onClick={onCreateItem} aria-label={createActionLabel} title={createActionLabel} className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]">
          <Plus size={15}/>
        </button>)}
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
      {items.length === 0 ? (<div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 px-3 py-6 text-center">
          <span className="text-[12px] text-[var(--color-textMuted)]">{emptyStateMessage}</span>
          <button type="button" onClick={onCreateItem} className="flex h-7 items-center justify-center gap-1 rounded px-2 text-[12px] font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]">
            <Plus size={15} aria-hidden="true"/>
            <span>{createActionLabel}</span>
          </button>
        </div>) : renderItems ? (renderItems(items)) : (items.map(item => (<div key={item.id} className="group flex w-full items-center border-b border-[var(--color-borderDefault)] pr-1.5 last:border-b-0 hover:bg-[var(--color-hoverBg)]">
            <button type="button" onClick={() => onOpenItem(item)} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] focus-visible:ring-inset">
              {renderItemLeading ? (renderItemLeading(item)) : (<Icon size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>)}
              <span className="min-w-0 truncate">{item.title}</span>
            </button>
            {renderItemAction?.(item)}
          </div>)))}
    </div>
  </section>);
type WorkspaceCollectionRecord = Record<string, unknown>;
type TodoRoadmapGroup = {
    id: 'overdue' | 'today' | 'upcoming' | 'completed' | 'no-date';
    label: string;
    items: CollectionListItem[];
};
const getTodoRoadmapGroups = (items: CollectionListItem[]): TodoRoadmapGroup[] => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const groups: TodoRoadmapGroup[] = [
        { id: 'overdue', label: 'Overdue', items: [] },
        { id: 'today', label: 'Today', items: [] },
        { id: 'upcoming', label: 'Upcoming', items: [] },
        { id: 'completed', label: 'Completed', items: [] },
        { id: 'no-date', label: 'No due date', items: [] }
    ];
    items.forEach(item => {
        const record = asRecord(item.record);
        const dueAt = Number(record.scheduleTime || 0);
        if (record.isDone)
            groups[3].items.push(item);
        else if (!Number.isFinite(dueAt) || dueAt <= 0)
            groups[4].items.push(item);
        else if (dueAt < now)
            groups[0].items.push(item);
        else if (dueAt <= endOfToday.getTime())
            groups[1].items.push(item);
        else
            groups[2].items.push(item);
    });
    return groups
        .filter(group => group.items.length > 0)
        .map(group => ({
        ...group,
        items: [...group.items].sort((a, b) => {
            const aTime = Number(asRecord(a.record).scheduleTime || 0);
            const bTime = Number(asRecord(b.record).scheduleTime || 0);
            return group.id === 'completed' ? bTime - aTime : aTime - bTime;
        }),
    }));
};
const TodoRoadmapGroupIcon = ({ groupId }: {
    groupId: TodoRoadmapGroup['id'];
}) => {
    if (groupId === 'overdue')
        return <FiPieChart size={13} className="shrink-0 text-[var(--color-error)]"/>;
    if (groupId === 'today')
        return <FiCalendar size={13} className="shrink-0 text-[var(--color-info)]"/>;
    if (groupId === 'upcoming')
        return <FiClock size={13} className="shrink-0 text-[var(--color-info)]"/>;
    if (groupId === 'completed')
        return <FiCheckCircle size={13} className="shrink-0 text-[var(--color-success)]"/>;
    return <FiMinusCircle size={13} className="shrink-0 text-[var(--color-textMuted)]"/>;
};
const TodoRoadmapItems = ({ items, onOpenItem, onDeleteItem, }: {
    items: CollectionListItem[];
    onOpenItem: (item: CollectionListItem) => void;
    onDeleteItem: (item: CollectionListItem) => void;
}) => {
    const groups = getTodoRoadmapGroups(items);
    return (<div className="space-y-2 px-2 pb-2 pt-2">
      {groups.map(group => (<section key={group.id} aria-label={`${group.label} Todo`}>
          <h3 className="flex h-7 items-center gap-2 border-b border-[var(--color-borderDefault)] px-1 text-[11px] font-medium text-[var(--color-textSecondary)]">
            <TodoRoadmapGroupIcon groupId={group.id}/>
            <span>{group.label}</span>
            <span className="text-[var(--color-textMuted)]">{group.items.length}</span>
          </h3>
          <div className="pt-1">
            {group.items.map((item, index) => {
                const record = asRecord(item.record);
                const isDone = Boolean(record.isDone);
                const dueAt = Number(record.scheduleTime || 0);
                const timeLabel = Number.isFinite(dueAt) && dueAt > 0
                    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(dueAt))
                    : 'Anytime';
                const dotTone = isDone
                    ? 'border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-editorBg)]'
                    : group.id === 'overdue'
                        ? 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
                        : 'border-[var(--color-info)] text-[var(--color-info)] hover:bg-[var(--color-info)]/10';
                return (<div key={item.id} className="group/roadmap grid min-h-8 grid-cols-[16px_58px_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1 hover:bg-[var(--color-hoverBg)]">
                  <span className="relative flex h-full min-h-8 items-center justify-center">
                    {group.items.length > 1 && index < group.items.length - 1 && (<span className="absolute bottom-0 left-1/2 top-1/2 w-px -translate-x-1/2 bg-[var(--color-textSecondary)] opacity-50"/>)}
                    {group.items.length > 1 && index > 0 && (<span className="absolute bottom-1/2 left-1/2 top-0 w-px -translate-x-1/2 bg-[var(--color-textSecondary)] opacity-50"/>)}
                    <button type="button" onClick={() => {
                        if (!isDone)
                            void updateTodo(item.id, true);
                    }} disabled={isDone} aria-label={isDone ? `${item.title} is completed` : `Mark ${item.title} complete`} title={isDone ? 'Completed' : 'Mark complete'} className={`group/check relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border transition-colors ${dotTone}`}>
                      <FaCheck size={7} className={`${isDone ? 'opacity-100' : 'opacity-0 group-hover/check:opacity-100'} transition-opacity`}/>
                    </button>
                  </span>
                  <span className="truncate text-[10px] font-medium tabular-nums text-[var(--color-textSecondary)]" title={timeLabel}>{timeLabel}</span>
                  <button type="button" onClick={() => onOpenItem(item)} className={`min-w-0 truncate text-left text-[12px] text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] ${isDone ? 'opacity-60 line-through' : ''}`} title={item.title}>
                    {item.title}
                  </button>
                  <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/roadmap:opacity-100 group-focus-within/roadmap:opacity-100">
                    <button type="button" onClick={() => onOpenItem(item)} aria-label={`Edit ${item.title}`} title="Edit Todo" className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]"><Pencil size={12}/></button>
                    <button type="button" onClick={() => onDeleteItem(item)} aria-label={`Delete ${item.title}`} title="Delete Todo" className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-error)] focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]"><FiTrash2 size={12}/></button>
                  </span>
                </div>);
            })}
          </div>
        </section>))}
    </div>);
};
const COLLECTION_TABS: Array<{
    id: CollectionTabId;
    label: string;
    icon: CollectionIcon;
}> = [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'notes', label: 'Notes', icon: FiFileText },
    { id: 'links', label: 'Links', icon: FaLink },
    { id: 'snippets', label: 'Text Expander', icon: TextExpanderIcon },
    { id: 'chatAgents', label: 'Chat Agents', icon: LuSparkles },
    { id: 'todos', label: 'Todo', icon: BsCalendarCheck }
];
const asId = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');
const asRecord = (value: unknown): WorkspaceCollectionRecord => value && typeof value === 'object' ? (value as WorkspaceCollectionRecord) : {};
const getLinkOverviewUrls = (item: CollectionListItem): string[] => {
    const urls = asRecord(item.record).urls;
    const rawUrls = Array.isArray(urls) ? urls : [];
    return rawUrls
        .map(entry => {
        if (typeof entry === 'string')
            return entry.trim();
        const entryRecord = asRecord(entry);
        return String(entryRecord.url || entryRecord.href || entryRecord.value || '').trim();
    })
        .filter(Boolean);
};
const LinkOverviewIconStack = ({ item }: {
    item: CollectionListItem;
}) => {
    const urls = getLinkOverviewUrls(item).slice(0, 4);
    if (urls.length === 0) {
        return <FaLink size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>;
    }
    return (<span className="flex w-[42px] shrink-0 items-center" aria-label={`${urls.length} links`}>
      {urls.map((url, index) => {
            const faviconUrl = getFaviconUrl(url);
            return (<span key={`${url}-${index}`} title={url} className={`flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-editorBg)] bg-[var(--color-inputBg)] ${index === 0 ? '' : '-ml-1.5'}`}>
            {faviconUrl ? (<img src={faviconUrl} alt="" className="h-3 w-3 object-contain"/>) : (<FaLink size={9} className="text-[var(--color-iconDefault)]"/>)}
          </span>);
        })}
    </span>);
};
const matchesCollectionSearch = (item: CollectionListItem, query: string) => {
    const searchableText = [item.title, item.subtitle, ...getLinkOverviewUrls(item)].join(' ').toLocaleLowerCase();
    return searchableText.includes(query);
};
// Follow the existing Link sheet / Board opener behavior: open the first URL in
// focus, keep the remaining URLs in background tabs, and fall back safely when
// extension tab APIs are unavailable.
const openOverviewLinkUrls = (item: CollectionListItem) => {
    getLinkOverviewUrls(item).forEach((rawUrl, index) => {
        const url = rawUrl.startsWith('//')
            ? `https:${rawUrl}`
            : /^https?:\/\//i.test(rawUrl)
                ? rawUrl
                : `https://${rawUrl}`;
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url, active: index === 0 });
            return;
        }
        if (chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({ action: 'open_tab', url, active: index === 0 }, () => {
                if (chromeAny.runtime.lastError && index === 0) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    });
};
const runOverviewAiPrompt = (item: CollectionListItem) => {
    const promptRecord = item.record as AiPromptRecord;
    requestMissingAiPromptInput({
        promptRecord,
        promptId: item.id,
        title: item.title || 'AI Prompt',
    });
};
const getRecordOrganisationId = (value: unknown): string => {
    const record = asRecord(value);
    return asId(record.organisationId) || asId(record.organisation_id);
};
const getRecordId = (value: unknown): string => {
    const record = asRecord(value);
    return asId(record.id) || asId(record.snippet_id) || asId(record.todo_id);
};
const getRecordTagIds = (value: unknown): string[] => {
    const record = asRecord(value);
    const rawTagIds = Array.isArray(record.tagIds) ? record.tagIds : Array.isArray(record.tags) ? record.tags : [];
    return rawTagIds
        .map(tag => {
        if (typeof tag === 'string')
            return tag.trim();
        const tagRecord = asRecord(tag);
        return asId(tagRecord.id) || asId(tagRecord.tagId) || asId(tagRecord.tag_id);
    })
        .filter(Boolean);
};
const getRecordTitle = (value: unknown, fallback: string): string => {
    const record = asRecord(value);
    return String(record.title || record.name || record.key || fallback).trim() || fallback;
};
const toPlainText = (value: unknown): string => typeof value === 'string'
    ? value
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
const getRecordDescription = (value: unknown): string => {
    const record = asRecord(value);
    return (toPlainText(record.description) ||
        toPlainText(record.body) ||
        toPlainText(record.content) ||
        toPlainText(record.value) ||
        toPlainText(record.prompt));
};
const getSnippetPreview = (value: unknown): string => {
    const description = getRecordDescription(value);
    if (description)
        return description;
    const config = asRecord(value).config;
    let parsed: unknown = config;
    if (typeof config === 'string') {
        try {
            parsed = JSON.parse(config);
        }
        catch {
            return toPlainText(config);
        }
    }
    const parts: string[] = [];
    const visit = (nodes: unknown) => {
        const list = Array.isArray(nodes) ? nodes : asRecord(nodes).content;
        if (!Array.isArray(list))
            return;
        for (const value of list) {
            const node = asRecord(value);
            if (node.type === 'text')
                parts.push(String(node.value || node.text || ''));
            else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
                const field = asRecord(node.config);
                parts.push(`{{${field.label || node.alias || node.id || 'Field'}}}`);
            }
            visit(node.children || node.content);
        }
    };
    visit(parsed);
    return toPlainText(parts.join(''));
};
const getUpdatedAt = (value: unknown): number => {
    const record = asRecord(value);
    return typeof record.updatedAt === 'number'
        ? record.updatedAt
        : typeof record.createdAt === 'number'
            ? record.createdAt
            : 0;
};
const getLinkedRecordIds = (dashboardState: WidgetDashboardState | null, activeViewId: string) => {
    const activeView = dashboardState?.views.find(view => view.id === activeViewId);
    const onboardingIds = (activeView?.settings?.onboardingEntityIds || {}) as Record<string, unknown>;
    const viewWidgets = (dashboardState?.widgets || []).filter(widget => widget.viewId === activeViewId);
    const notes = new Set<string>();
    const links = new Set<string>();
    const snippets = new Set<string>();
    const chatAgents = new Set<string>();
    const todos = new Set<string>();
    const add = (target: Set<string>, value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(item => add(target, item));
            return;
        }
        const id = asId(value);
        if (id)
            target.add(id);
    };
    add(notes, onboardingIds.noteId);
    add(notes, onboardingIds.noteIds);
    add(links, onboardingIds.linkId);
    add(links, onboardingIds.linkIds);
    add(snippets, onboardingIds.snippetId);
    add(snippets, onboardingIds.snippetIds);
    add(chatAgents, onboardingIds.aiPromptId);
    add(chatAgents, onboardingIds.aiPromptIds);
    add(chatAgents, onboardingIds.chatAgentId);
    add(chatAgents, onboardingIds.chatAgentIds);
    add(todos, onboardingIds.todoId);
    add(todos, onboardingIds.todoIds);
    viewWidgets.forEach(widget => {
        const settings = widget.settings || {};
        if (widget.type === 'note-item')
            add(notes, widget.noteId || widget.referenceId || settings.noteId);
        if (widget.type === 'link-item')
            add(links, widget.linkId || widget.referenceId || settings.linkId);
        if (widget.type === 'note-library')
            add(notes, settings.selectedNoteIds);
        if (widget.type === 'link-library')
            add(links, settings.selectedCollectionIds);
        if (widget.type === 'snippet-library')
            add(snippets, settings.selectedSnippetIds);
        if (widget.type === 'ai-prompt-library') {
            add(chatAgents, settings.selectedPromptIds);
            add(chatAgents, settings.selectedAgentIds);
        }
        if (widget.type === 'todo-list')
            add(todos, settings.selectedTodoIds);
    });
    return { notes, links, snippets, chatAgents, todos };
};
const filterOrganisationItems = <T,>(items: T[], organisationId: string, selectedIds: Set<string>, collectionTagIds: Set<string>): T[] => {
    const notDeleted = items.filter(item => !asRecord(item).deletedAt);
    if (collectionTagIds.size > 0) {
        return notDeleted.filter(item => getRecordTagIds(item).some(tagId => collectionTagIds.has(tagId)));
    }
    const available = notDeleted.filter(item => getRecordOrganisationId(item) === organisationId);
    if (selectedIds.size > 0) {
        return available.filter(item => selectedIds.has(getRecordId(item)));
    }
    return available;
};
const sortByUpdatedAt = <T,>(items: T[]): T[] => [...items].sort((a, b) => getUpdatedAt(b) - getUpdatedAt(a));
const getLinkSubtitle = (value: unknown): string => {
    const record = asRecord(value);
    const description = getRecordDescription(record);
    if (description)
        return description;
    const urls = Array.isArray(record.urls) ? record.urls : [];
    const firstUrlEntry = urls[0] as WorkspaceCollectionRecord | string | undefined;
    const firstUrl = typeof firstUrlEntry === 'string' ? firstUrlEntry : firstUrlEntry?.url || firstUrlEntry?.href;
    if (!firstUrl)
        return '';
    const normalizedUrl = String(firstUrl);
    try {
        const url = new URL(/^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`);
        return url.hostname.replace(/^www\./i, '');
    }
    catch {
        return '';
    }
};
const WorkspaceCollectionView = () => {
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const returnToHomeView = useWidgetDashboardStore(state => state.returnToHomeView);
    const organisationId = useWidgetDashboardStore(state => state.organisationId);
    const organisations = useDbStore(state => state.organisations);
    const workspaces = useDbStore(state => state.workspaces);
    const notes = useDbStore(state => state.notes);
    const links = useDbStore(state => state.links);
    const snippets = useDbStore(state => state.snippets);
    const aiPrompts = useDbStore(state => state.aiPrompts);
    const chatAgents = useDbStore(state => state.chatAgents);
    const todos = useDbStore(state => state.todos);
    const tags = useDbStore(state => state.tags);
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const [activeTabId, setActiveTabId] = useState<CollectionTabId>('all');
    const [searchValue, setSearchValue] = useState('');
    const [workspaceTodoItem, setWorkspaceTodoItem] = useState<TodoRecord | null>(null);
    const [overviewSelectedNoteId, setOverviewSelectedNoteId] = useState<string | null>(null);
    const [overviewSelectedLinkId, setOverviewSelectedLinkId] = useState<string | null>(null);
    const [overviewSelectedSnippetId, setOverviewSelectedSnippetId] = useState<string | null>(null);
    const [overviewSelectedAiPromptId, setOverviewSelectedAiPromptId] = useState<string | null>(null);
    const activeView = dashboardState?.views.find(view => view.id === dashboardState.activeViewId);
    const [createIntent, setCreateIntent] = useState<{viewId: string | undefined; tab: CollectionTabId} | null>(null);
    const overviewCreateTarget = createIntent?.viewId === activeView?.id ? createIntent?.tab || null : null;
    const setOverviewCreateTarget = (tab: CollectionTabId | null) => setCreateIntent(tab ? {viewId: activeView?.id, tab} : null);
    const activeOrganisationId = organisationId || organisations[0]?.id || 'default';
    const activeCollectionName = workspaces.find(workspace => workspace.id === activeView?.id)?.workspaceName?.trim()
        || activeView?.title?.trim() || 'Workspace';
    useEffect(() => {
        setSearchValue('');
        setOverviewSelectedNoteId(null);
        setOverviewSelectedLinkId(null);
        setOverviewSelectedSnippetId(null);
        setOverviewSelectedAiPromptId(null);
        setWorkspaceTodoItem(null);
        setOverviewCreateTarget(null);
    }, [activeView?.id]);
    const collectionTagIds = useMemo(() => new Set((tags || [])
        .filter(tag => tag.workspaceId === activeView?.id)
        .map(tag => tag.id)
        .filter(Boolean)), [activeView?.id, tags]);
    const linkedIds = useMemo(() => getLinkedRecordIds(dashboardState, dashboardState?.activeViewId || ''), [dashboardState]);
    const itemsByTab = useMemo<Record<CollectionTabId, CollectionListItem[]>>(() => {
        const organisationNotes = sortByUpdatedAt(filterOrganisationItems(notes || [], activeOrganisationId, linkedIds.notes, collectionTagIds));
        const organisationLinks = sortByUpdatedAt(filterOrganisationItems(links || [], activeOrganisationId, linkedIds.links, collectionTagIds));
        const organisationSnippets = sortByUpdatedAt(filterOrganisationItems(snippets || [], activeOrganisationId, linkedIds.snippets, collectionTagIds));
        const organisationAiPrompts = sortByUpdatedAt(filterOrganisationItems(aiPrompts || [], activeOrganisationId, linkedIds.chatAgents, collectionTagIds));
        const organisationChatAgents = sortByUpdatedAt(filterOrganisationItems(chatAgents || [], activeOrganisationId, linkedIds.chatAgents, collectionTagIds));
        const organisationTodos = sortByUpdatedAt(filterOrganisationItems(todos || [], activeOrganisationId, linkedIds.todos, collectionTagIds));
        return {
            all: [],
            notes: organisationNotes.map(item => ({
                id: String(item.id),
                kind: 'note',
                title: getRecordTitle(item, 'Untitled Note'),
                subtitle: getRecordDescription(item),
                updatedAt: getUpdatedAt(item),
                record: item,
            })),
            links: organisationLinks.map(item => ({
                id: String(item.id),
                kind: 'link',
                title: getRecordTitle(item, 'Untitled Link'),
                subtitle: getLinkSubtitle(item),
                updatedAt: getUpdatedAt(item),
                record: item,
            })),
            snippets: organisationSnippets.map(item => ({
                id: String(item.id),
                kind: 'snippet',
                title: getRecordTitle(item, 'Untitled Snippet'),
                subtitle: getSnippetPreview(item),
                updatedAt: getUpdatedAt(item),
                record: item,
            })),
            chatAgents: [
                ...organisationChatAgents.map(item => ({ item, kind: 'chatAgent' as const })),
                ...organisationAiPrompts.map(item => ({ item, kind: 'aiPrompt' as const }))
            ].map(({ item, kind }) => ({
                id: String(item.id),
                kind,
                title: getRecordTitle(item, 'Untitled Agent'),
                subtitle: getRecordDescription(item),
                updatedAt: getUpdatedAt(item),
                record: item,
            })),
            todos: organisationTodos.map(item => ({
                id: String(item.id),
                kind: 'todo',
                title: getRecordTitle(item, 'Untitled Todo'),
                subtitle: getRecordDescription(item),
                updatedAt: getUpdatedAt(item),
                record: item,
            })),
        };
    }, [activeOrganisationId, aiPrompts, chatAgents, collectionTagIds, linkedIds, links, notes, snippets, todos]);
    const filteredCollectionItems = useMemo<Record<CollectionTabId, CollectionListItem[]>>(() => {
        const query = searchValue.trim().toLocaleLowerCase();
        if (!query)
            return itemsByTab;
        const filterItems = (items: CollectionListItem[]) => items.filter(item => matchesCollectionSearch(item, query));
        return {
            all: [],
            notes: filterItems(itemsByTab.notes),
            links: filterItems(itemsByTab.links),
            snippets: filterItems(itemsByTab.snippets),
            chatAgents: filterItems(itemsByTab.chatAgents),
            todos: filterItems(itemsByTab.todos),
        };
    }, [itemsByTab, searchValue]);
    const workspaceItemGroups = useMemo(() => [
        { id: 'notes', label: 'Notes', icon: <FiFileText size={14}/>, items: filteredCollectionItems.notes },
        { id: 'links', label: 'Links', icon: <FaLink size={14}/>, items: filteredCollectionItems.links },
        { id: 'chatAgents', label: 'Chat Agents', icon: <LuSparkles size={14}/>, items: filteredCollectionItems.chatAgents.filter(item => item.kind === 'aiPrompt') },
        { id: 'todos', label: 'Todo', icon: <BsCalendarCheck size={14}/>, items: filteredCollectionItems.todos },
        { id: 'snippets', label: 'Text Expander', icon: <TextExpanderIcon size={14}/>, items: filteredCollectionItems.snippets },
    ], [filteredCollectionItems]);
    const collectionAttachItems = useMemo(() => [
        ...itemsByTab.notes.map(item => ({
            id: item.id,
            name: item.title,
            category: 'note',
            data: item.record,
        })),
        ...itemsByTab.snippets.map(item => ({
            id: item.id,
            name: item.title,
            category: 'snippet',
            data: item.record,
        })),
        ...itemsByTab.links.map(item => ({
            id: item.id,
            name: item.title,
            category: 'link',
            data: item.record,
        })),
        ...itemsByTab.chatAgents.map(item => ({
            id: item.id,
            name: item.title,
            category: item.kind === 'aiPrompt' ? 'ai_prompt' : 'chat_agent',
            data: item.record,
        }))
    ], [itemsByTab]);
    const activeCollectionTagIds = useMemo(() => Array.from(collectionTagIds), [collectionTagIds]);
    // Keep the draft identity stable while a missing Workspace tag is hydrated.
    const workspaceTodoDraft = useMemo(() => ({ isCreateModalOnly: true }), [activeView?.id]);
    useEffect(() => {
        if (activeTabId !== 'todos' || !activeView?.id)
            return;
        void ensureDashboardViewTag(activeView.id, activeCollectionName).catch(error => {
            console.error('[WorkspaceCollectionView] Could not load the Workspace tag for Todo:', error);
        });
    }, [activeTabId, activeView?.id, activeCollectionName]);
    const editorInstanceKey = `workspace-${activeView?.id || 'pending'}-${activeTabId}`;
    useEffect(() => {
        if (activeTabId !== 'todos') {
            setWorkspaceTodoItem(null);
        }
    }, [activeTabId]);
    const handleCollectionTodoSave = useCallback(async (data: any) => {
        if (!activeView?.id)
            throw new Error('The Workspace is no longer available. Todo was not saved.');
        const workspaceTag = await ensureDashboardViewTag(activeView.id, activeCollectionName);
        if (!workspaceTag)
            throw new Error('The Workspace is no longer available. Todo was not saved.');
        const tagIds = Array.from(new Set([...(Array.isArray(data.tagIds) ? data.tagIds : []), ...activeCollectionTagIds, workspaceTag.id]));
        const scheduleTime = typeof data.scheduleTime === 'number' && Number.isFinite(data.scheduleTime)
            ? data.scheduleTime
            : Date.now();
        const references = Array.isArray(data.selectedItems) ? data.selectedItems : [];
        if (data.todoId) {
            return await updateTodoContent(String(data.todoId), {
                name: data.title || 'Untitled Todo',
                description: data.description || '',
                scheduleType: data.scheduleType || 'one-time',
                recurringType: data.recurringCycle,
                scheduleTime,
                references: mapTodoReferences(references),
                tagIds,
                tags: tagIds,
                shortcut: data.shortcut || '',
                organisationId: data.organisationId || activeOrganisationId,
            } as Partial<TodoRecord>);
        }
        const created = await createTodo(data.title || 'Untitled Todo', references, data.scheduleType || 'one-time', scheduleTime, data.recurringCycle, data.description || '', tagIds, data.shortcut || '', data.organisationId || activeOrganisationId);
        return created;
    }, [activeCollectionTagIds, activeCollectionName, activeOrganisationId, activeView?.id]);
    const openWorkspaceItem = (item: CollectionListItem) => {
        setOverviewCreateTarget(null);
        if (item.kind === 'note') {
            setOverviewSelectedNoteId(item.id);
            setActiveTabId('notes');
        }
        else if (item.kind === 'link') {
            setOverviewSelectedLinkId(item.id);
            setActiveTabId('links');
        }
        else if (item.kind === 'snippet') {
            setOverviewSelectedSnippetId(item.id);
            setActiveTabId('snippets');
        }
        else if (item.kind === 'aiPrompt') {
            setOverviewSelectedAiPromptId(item.id);
            setActiveTabId('chatAgents');
        }
        else if (item.kind === 'todo') {
            setWorkspaceTodoItem(item.record as TodoRecord);
            setActiveTabId('todos');
        }
    };
    const renderEditor = () => {
        if (activeTabId === 'all') {
            return (<div className="flex h-full min-h-0 flex-col md:flex-row">
          <RightSideItemsPanel groups={workspaceItemGroups} searchQuery={searchValue} onSearchChange={setSearchValue} getItemTitle={item => item.title} getItemPreview={item => item.subtitle} onLoadItem={openWorkspaceItem}/>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-6 md:pt-8 xl:pt-10 custom-scrollbar">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 auto-rows-[280px] gap-6 md:grid-cols-2 xl:grid-cols-3">
            <CollectionOverviewSection title="Notes" icon={FiFileText} items={filteredCollectionItems.notes} emptyStateMessage={searchValue.trim() ? 'No matching notes' : 'No notes yet'} createActionLabel="Create note" onOpenItem={item => {
                    setOverviewSelectedNoteId(item.id);
                    setOverviewCreateTarget(null);
                    setActiveTabId('notes');
                }} onCreateItem={() => {
                    setOverviewSelectedNoteId(null);
                    setOverviewCreateTarget('notes');
                    setActiveTabId('notes');
                }}/>
            <CollectionOverviewSection title="Links" icon={FaLink} items={filteredCollectionItems.links} emptyStateMessage={searchValue.trim() ? 'No matching links' : 'No links yet'} createActionLabel="Create link" renderItemLeading={item => <LinkOverviewIconStack item={item}/>} renderItemAction={item => (<button type="button" onClick={() => {
                        setOverviewSelectedLinkId(item.id);
                        setOverviewCreateTarget(null);
                        setActiveTabId('links');
                    }} aria-label={`Edit ${item.title}`} title="Edit link" className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-iconDefault)] opacity-0 transition-colors group-hover:opacity-100 hover:text-[var(--color-textPrimary)] focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]">
                  <Pencil size={13}/>
                </button>)} onOpenItem={openOverviewLinkUrls} onCreateItem={() => {
                    setOverviewSelectedLinkId(null);
                    setOverviewCreateTarget('links');
                    setActiveTabId('links');
                }}/>
            <CollectionOverviewSection title="Text Expander" icon={TextExpanderIcon} items={filteredCollectionItems.snippets} emptyStateMessage={searchValue.trim() ? 'No matching text expanders' : 'No text expanders yet'} createActionLabel="Create text expander" onOpenItem={item => {
                    setOverviewSelectedSnippetId(item.id);
                    setOverviewCreateTarget(null);
                    setActiveTabId('snippets');
                }} onCreateItem={() => {
                    setOverviewSelectedSnippetId(null);
                    setOverviewCreateTarget('snippets');
                    setActiveTabId('snippets');
                }}/>
            <CollectionOverviewSection title="Chat Agents" icon={LuSparkles} items={filteredCollectionItems.chatAgents.filter(item => item.kind === 'aiPrompt')} emptyStateMessage={searchValue.trim() ? 'No matching chat agents' : 'No chat agents yet'} createActionLabel="Create chat agent" renderItemAction={item => (<button type="button" onClick={() => {
                        setOverviewSelectedAiPromptId(item.id);
                        setOverviewCreateTarget(null);
                        setActiveTabId('chatAgents');
                    }} aria-label={`Edit ${item.title}`} title="Edit chat agent" className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--color-iconDefault)] opacity-0 transition-colors group-hover:opacity-100 hover:text-[var(--color-textPrimary)] focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]">
                  <Pencil size={13}/>
                </button>)} onOpenItem={runOverviewAiPrompt} onCreateItem={() => {
                    setOverviewSelectedAiPromptId(null);
                    setOverviewCreateTarget('chatAgents');
                    setActiveTabId('chatAgents');
                }}/>
            <CollectionOverviewSection title="Todo" icon={BsCalendarCheck} items={filteredCollectionItems.todos} emptyStateMessage={searchValue.trim() ? 'No matching Todo' : 'No Todo yet'} createActionLabel="Create Todo" renderItems={items => (<TodoRoadmapItems items={items} onOpenItem={item => {
                        setWorkspaceTodoItem(item.record as TodoRecord);
                        setOverviewCreateTarget(null);
                        setActiveTabId('todos');
                    }} onDeleteItem={item => { void deleteTodo(item.id); }}/>)} onOpenItem={item => {
                    setWorkspaceTodoItem(item.record as TodoRecord);
                    setOverviewCreateTarget(null);
                    setActiveTabId('todos');
                }} onCreateItem={() => {
                    setWorkspaceTodoItem(null);
                    setOverviewCreateTarget('todos');
                    setActiveTabId('todos');
                }}/>
          </div>
          </div>
        </div>);
        }
        const commonEditorProps = {
            key: editorInstanceKey,
            initialTagIds: activeCollectionTagIds,
            isFullScreenMode: false,
            hideRightPanel: false,
            appearanceScope: 'alts' as const,
            workspaceCollectionMode: true,
            workspaceCollectionFilterTagIds: activeCollectionTagIds,
            organisationCollectionOrganisationId: activeOrganisationId,
        };
        if (activeTabId === 'notes') {
            const isCreating = overviewCreateTarget === 'notes';
            const noteId = selectWorkspaceNoteId(itemsByTab.notes, overviewSelectedNoteId, isCreating);
            return (<NoteEditorView {...commonEditorProps} noteId={noteId}/>);
        }
        if (activeTabId === 'links') {
            return (<LinkEditorView key={editorInstanceKey} isOpen={true} onClose={() => { }} link={links.find(link => link.id === overviewSelectedLinkId)} prefill={null} initialTagIds={activeCollectionTagIds} reload={() => { }} isFullScreenMode={false} hideRightPanel={false} appearanceScope="alts" workspaceCollectionMode={true} workspaceCollectionFilterTagIds={activeCollectionTagIds} organisationCollectionOrganisationId={activeOrganisationId} forceCreateEditor={overviewCreateTarget === 'links'}/>);
        }
        if (activeTabId === 'snippets') {
            return (<SnippetEditorScreen key={editorInstanceKey} selectedSnippet={snippets.find(snippet => snippet.id === overviewSelectedSnippetId) ?? null} isCreatingNew={!overviewSelectedSnippetId} snippetBreadCrum={null} reload={() => { }} favoritesMapping={{}} setFavoritesMapping={() => { }} initialTagIds={activeCollectionTagIds} isFullScreenMode={false} hideRightPanel={false} appearanceScope="alts" workspaceCollectionMode={true} workspaceCollectionFilterTagIds={activeCollectionTagIds} organisationCollectionOrganisationId={activeOrganisationId} forceCreateEditor={overviewCreateTarget === 'snippets'} category="snippet"/>);
        }
        if (activeTabId === 'chatAgents') {
            return (<AiPromptEditorView {...commonEditorProps} aiPromptId={overviewSelectedAiPromptId} forceCreateEditor={overviewCreateTarget === 'chatAgents'}/>);
        }
        return (<CreateTodoView key={editorInstanceKey} items={collectionAttachItems} onCreateTodo={handleCollectionTodoSave} initialItem={workspaceTodoItem || workspaceTodoDraft} activeTodoId={workspaceTodoItem?.id} onLoadTodo={todo => setWorkspaceTodoItem(todo?.id ? todo : null)} existingTodos={todos || []} onClose={() => { }} hotkeysMap={hotkeysMap} isFullScreenMode={false} hideRightPanel={false} appearanceScope="alts" workspaceCollectionMode={true} workspaceCollectionFilterTagIds={activeCollectionTagIds} workspaceCollectionWorkspaceId={activeView?.id} organisationCollectionOrganisationId={activeOrganisationId} forceCreateEditor={overviewCreateTarget === 'todos'}/>);
    };
    const handleClose = useCallback(() => {
        returnToHomeView();
        useUIStore.getState().clearEditorStates();
        useUIStore.getState().returnToHome();
    }, [returnToHomeView]);
    const handleShowAll = useCallback(() => {
        setOverviewSelectedNoteId(null);
        setOverviewSelectedLinkId(null);
        setOverviewSelectedSnippetId(null);
        setOverviewSelectedAiPromptId(null);
        setWorkspaceTodoItem(null);
        setOverviewCreateTarget(null);
        setActiveTabId('all');
    }, []);
    const handleBack = activeTabId === 'all' ? handleClose : handleShowAll;
    const handleOpenCollectionSettings = useCallback(() => {
        if (!activeView?.id)
            return;
        window.dispatchEvent(new CustomEvent(DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT, {
            detail: { viewId: activeView.id },
        }));
    }, [activeView?.id]);
    useEffect(() => {
        return useUIStore.getState().registerEscapeInterceptor(() => {
            handleClose();
            return true;
        });
    }, [handleClose]);
    return (<section className="main-page-scrollbar h-full min-h-0 w-full overflow-y-auto overflow-x-hidden bg-[var(--color-editorBg)] text-[var(--color-textPrimary)]" data-workspace-collection-view="true">
      <style>{`
        [data-workspace-collection-editor="true"] button[title="Open docs"],
        [data-workspace-collection-editor="true"] button[title="Close"] {
          display: none !important;
        }

        [data-workspace-collection-view="true"],
        [data-workspace-collection-editor="true"] {
          --workspace-collection-editor-max-width: 980px;
          --workspace-collection-editor-fit-scale: 1;
          --workspace-collection-items-panel-width: 240px;
          --color-editorBg: ${COLLECTION_BACKGROUND};
          --color-inputBg: ${COLLECTION_BACKGROUND};
          --color-containerBg: ${COLLECTION_BACKGROUND};
          --color-panelBg: ${COLLECTION_BACKGROUND};
          --color-cardBg: ${COLLECTION_BACKGROUND};
          --color-popupBg: ${COLLECTION_BACKGROUND};
          --color-innerPopupBg: ${COLLECTION_BACKGROUND};
          --color-contextMenuBg: ${COLLECTION_BACKGROUND};
          --color-borderDefault: rgba(255, 255, 255, 0.1);
          --color-borderActive: rgba(255, 255, 255, 0.2);
          --color-hoverBg: rgba(255, 255, 255, 0.05);
          --color-selectedBg: rgba(255, 255, 255, 0.07);
          --color-textPrimary: #FFFFFF;
          --color-textSecondary: #D4D4D4;
          --color-textMuted: #737373;
          --color-textPlaceholder: #A3A3A3;
          --color-iconDefault: #9CA3AF;
          color-scheme: dark;
          background: ${COLLECTION_BACKGROUND};
        }

        .workspace-collection-editor-shell {
          position: relative;
          height: 100%;
          min-height: 0;
          padding: 0 24px 0 28px;
          transform: scale(var(--workspace-collection-editor-fit-scale));
          transform-origin: top left;
          width: calc(100% / var(--workspace-collection-editor-fit-scale));
          height: calc(100% / var(--workspace-collection-editor-fit-scale));
        }

        .workspace-collection-editor-shell--all {
          padding: 0;
          transform: none;
          width: 100%;
          height: 100%;
        }

        .workspace-collection-editor-back {
          position: absolute;
          left: 0;
          top: 0;
          z-index: 80;
        }

        .workspace-collection-editor-shell > :not(.workspace-collection-editor-back):not([data-editor-top-right-chrome]) {
          height: 100%;
          min-height: 0;
        }

        .workspace-collection-editor-shell [data-right-side-items-panel="true"] {
          width: var(--workspace-collection-items-panel-width) !important;
          min-width: var(--workspace-collection-items-panel-width) !important;
          max-width: var(--workspace-collection-items-panel-width) !important;
          flex-basis: var(--workspace-collection-items-panel-width) !important;
        }

        @media (max-width: 767px) {
          .workspace-collection-editor-shell--all [data-right-side-items-panel="true"] {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            flex-basis: 33.333333% !important;
          }
        }

        .workspace-collection-editor-shell [class*="max-w-[740px]"],
        .workspace-collection-editor-shell [class*="max-w-[760px]"],
        .workspace-collection-editor-shell [class*="max-w-[1080px]"],
        .workspace-collection-editor-shell [class*="max-w-[1340px]"],
        .workspace-collection-editor-shell [class*="max-w-[1480px]"] {
          max-width: var(--workspace-collection-editor-max-width) !important;
        }

        .workspace-collection-editor-shell [class*="px-8"],
        .workspace-collection-editor-shell [class*="md:px-10"],
        .workspace-collection-editor-shell [class*="lg:px-12"] {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        .workspace-collection-editor-shell--links [class*="py-1"][class*="px-3"][class*="z-30"] {
          padding: 0 !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }

        .workspace-collection-editor-shell--todos {
          --workspace-collection-editor-max-width: 1120px;
        }

        .workspace-collection-editor-shell--chatAgents {
          --workspace-collection-editor-max-width: 1180px;
        }

        .workspace-collection-editor-shell--snippets {
          --workspace-collection-editor-max-width: 1180px;
        }

        .workspace-collection-editor-shell--links {
          --workspace-collection-editor-max-width: 1180px;
        }

        .workspace-collection-editor-shell--todos textarea {
          min-height: 180px !important;
          max-height: min(300px, 32vh) !important;
        }

        @media (max-width: 1800px), (max-height: 900px) {
          [data-workspace-collection-editor="true"] {
            --workspace-collection-editor-fit-scale: 0.92;
          }

          .workspace-collection-editor-shell {
            padding: 0 22px 0 26px;
          }
        }

        @media (max-width: 1500px), (max-height: 760px) {
          [data-workspace-collection-editor="true"] {
            --workspace-collection-editor-fit-scale: 0.84;
          }

          .workspace-collection-editor-shell {
            padding: 0 20px 0 24px;
          }
        }

        @media (max-width: 1180px) {
          [data-workspace-collection-editor="true"] {
            --workspace-collection-editor-fit-scale: 0.78;
          }
        }
      `}</style>
      <div className="flex h-full min-h-[420px] w-full flex-col border-x border-b border-[var(--color-borderDefault)] bg-[var(--color-editorBg)]">
        <header className="relative flex shrink-0 flex-col bg-[var(--color-editorBg)] px-6 pb-3">
          <div className="flex w-full items-center gap-5 pr-24 pt-1">
            <button type="button" onClick={handleBack} aria-label={activeTabId === 'all' ? `Back from ${activeCollectionName}` : `Back to All in ${activeCollectionName}`} title={activeTabId === 'all' ? 'Back to Home' : 'Back to All'} className="flex h-10 min-w-0 shrink-0 items-center gap-2 rounded-lg px-0.5 text-xs font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-borderActive)]">
              <ArrowLeft size={16} className="shrink-0" aria-hidden="true"/>
              <span className="flex max-w-xs min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[var(--color-textPrimary)]">Workspace</span>
                <span className="shrink-0 text-[var(--color-textMuted)]" aria-hidden="true">
                  /
                </span>
                <span className="truncate text-[var(--color-textPrimary)]">{activeCollectionName}</span>
              </span>
            </button>
          </div>
          <div className="absolute right-2 top-2 flex items-center">
            <button type="button" onClick={handleClose} aria-label="Close workspace view" title="Close workspace view" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-borderActive)]">
              <X size={17} aria-hidden="true"/>
            </button>
          </div>
          <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center">
            <nav className="flex w-full min-w-0 items-center justify-center gap-3 overflow-x-auto" aria-label="Workspace sections">
              {COLLECTION_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTabId;
            return (<button key={tab.id} type="button" onClick={() => {
                    if (tab.id === 'all') {
                        handleShowAll();
                        return;
                    }
                    setActiveTabId(tab.id);
                }} className={`flex h-9 min-w-0 items-center gap-1.5 border-b-2 text-[12px] font-medium transition-colors ${isActive
                    ? 'border-[var(--color-borderActive)] text-[var(--color-textSecondary)]'
                    : 'border-transparent text-[var(--color-textSecondary)] opacity-70 hover:opacity-100 hover:text-[var(--color-textPrimary)]'}`}>
                    <Icon size={13} className="shrink-0"/>
                    <span className="truncate">{tab.label}</span>
                  </button>);
        })}
              <button type="button" onClick={handleOpenCollectionSettings} disabled={!activeView?.id} className="flex h-9 min-w-0 items-center gap-1.5 border-b-2 border-transparent text-[12px] font-medium text-[var(--color-textSecondary)] opacity-70 transition-colors hover:text-[var(--color-textPrimary)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-borderActive)] disabled:cursor-not-allowed disabled:opacity-40">
                <Settings size={13} className="shrink-0" aria-hidden="true"/>
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="relative h-full min-h-0 overflow-hidden bg-[var(--color-editorBg)] has-[[data-black-editor-surface=true]]:!bg-[var(--color-rootBg)]" data-workspace-collection-editor="true">
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-[var(--color-textSecondary)]">
                  Loading editor...
                </div>}>
              <div className={`workspace-collection-editor-shell workspace-collection-editor-shell--${activeTabId}`}>
                {renderEditor()}
              </div>
            </Suspense>
          </div>
        </div>
      </div>
    </section>);
};
export default WorkspaceCollectionView;
