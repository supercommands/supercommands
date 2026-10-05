import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, Layers, Plus, Settings, Trash2 } from 'lucide-react';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { editWorkspaceDestinations } from '../../../../../../allObjectFolder/src/createObject/session/workspaceDestinationActions';
import { launchDashboardViewSessionSmart } from '../../../../../../shared-components/dashboardCollections/protectedDashboardSessionLaunch';
import { DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT } from '../../../../../../shared-components/dashboardCollections/dashboardCollectionEvents';
import { buildSessionLaunchUrls } from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceUtils';
import { handleSessionReferenceLaunchActions } from '../../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { buildSessionAgentSuggestions } from '../../../../../../allObjectFolder/src/createObject/session/sessionAgentSnapshot';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import type { LinkItem } from '../../../../../../allObjectFolder/src/createObject/links/linkTypes';
import { reflectNewTabTheme } from '../../../../../../../packages/ui/lib/theme/registry';

const AddLinksModal = lazy(() => import('../../../../../../allObjectFolder/src/createObject/session/ui/SessionAddLinksModal'));
const hostname = (url: string) => { try { return new URL(url).hostname || url; } catch { return url; } };
const actionClass = 'flex h-7 items-center justify-center gap-1 rounded px-2 text-[12px] font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50';

// Reuse the URL favicon resolver even for older saved destinations without metadata.
function DestinationFavicon({ item }: { item: LinkItem }) {
    const resolvedUrl = getFaviconUrl(item.url);
    const [src, setSrc] = useState(item.favIconUrl || resolvedUrl);
    if (!src) return <Globe size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>;
    return <img src={src} alt="" className="h-4 w-4 shrink-0 object-contain" onError={() => setSrc(src !== resolvedUrl ? resolvedUrl : '')}/>;
}

export default function WorkspaceSessionCard({ workspaceId, query = '' }: { workspaceId: string; query?: string }) {
    const workspace = useDbStore(state => state.workspaces.find(item => item.id === workspaceId));
    const notes = useDbStore(state => state.notes);
    const snippets = useDbStore(state => state.snippets);
    const chatAgents = useDbStore(state => state.chatAgents);
    const aiPrompts = useDbStore(state => state.aiPrompts);
    const [adding, setAdding] = useState(false);
    const [availableTabs, setAvailableTabs] = useState<LinkItem[]>([]);
    const [pending, setPending] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [running, setRunning] = useState(false);
    const alive = useRef(true);
    const busy = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const savedItems = workspace?.urls || [];
    const filteredItems = savedItems.filter(item => `${item.title || ''} ${item.name || ''} ${item.url}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const suggestions = useMemo(() => buildSessionAgentSuggestions({
        chatAgents: chatAgents.filter(item => item.organisationId === workspace?.organisationId),
        aiPrompts: aiPrompts.filter(item => item.organisationId === workspace?.organisationId),
    }), [chatAgents, aiPrompts, workspace?.organisationId]);
    useEffect(() => { if (!workspace) setAdding(false); }, [workspace]);
    useEffect(() => {
        if (!adding) return;
        return useUIStore.getState().registerEscapeInterceptor(() => { setAdding(false); return true; });
    }, [adding]);

    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            try {
                const response = await chrome.runtime.sendMessage({ action: 'get_active_sessions' });
                if (!cancelled) setRunning((response?.active_sessions || []).some((item: { sessionId: string }) => item.sessionId === workspaceId));
            } catch { if (!cancelled) setRunning(false); }
        };
        const changed = (changes: Record<string, unknown>) => { if (changes.active_sessions) void refresh(); };
        void refresh();
        chrome.storage.onChanged.addListener(changed);
        return () => { cancelled = true; chrome.storage.onChanged.removeListener(changed); };
    }, [workspaceId]);

    useEffect(() => {
        if (!adding) return;
        let cancelled = false;
        setAvailableTabs([]);
        void chrome.tabs.query({ currentWindow: true }).then(tabs => {
            if (!cancelled) setAvailableTabs(tabs.filter(tab => /^https?:\/\//i.test(tab.url || '')).map(tab => ({
                id: `tab-${tab.id}`, title: tab.title, url: tab.url!, favIconUrl: tab.favIconUrl, source: 'tab',
            })));
        }).catch(() => { if (!cancelled) setError('Could not load browser tabs. You can still enter a URL.'); });
        return () => { cancelled = true; };
    }, [adding]);

    const perform = async (action: () => Promise<void>, message: string): Promise<boolean> => {
        if (busy.current || !workspace) return false;
        busy.current = true; setPending(true); setError(''); setStatus('');
        try {
            await action();
            if (alive.current) setStatus(message);
            return true;
        } catch (failure) {
            if (alive.current) setError(failure instanceof Error ? failure.message : 'Could not update this Workspace.');
            return false;
        } finally { busy.current = false; if (alive.current) setPending(false); }
    };
    const add = (items: LinkItem[]) => perform(async () => {
        if (!items.some(item => item.url?.trim())) throw new Error('Enter a URL to add.');
        await editWorkspaceDestinations(workspaceId, { type: 'add', items });
    }, 'Saved');
    const addCustom = async (url: string, name?: string) => {
        try {
            const parsed = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
            if (!/^https?:$/.test(parsed.protocol)) throw new Error('Enter a valid website URL.');
            return await add([{ id: '', url: parsed.href, title: name || parsed.hostname, name, source: 'custom', favIconUrl: getFaviconUrl(parsed.hostname) }]);
        } catch { if (alive.current) setError('Enter a valid website URL.'); return false; }
    };
    const openItem = (item: LinkItem) => perform(async () => {
        const response = await chrome.runtime.sendMessage({ action: 'activate_focus_item', sessionId: workspaceId, itemId: item.id, url: item.url });
        if (response?.ok) return;
        if (response?.error !== 'focus_item_not_running') throw new Error(response?.error || 'Could not activate this saved tab.');
        const { openUrls } = buildSessionLaunchUrls([item]);
        for (const url of openUrls) {
            const tab = await chrome.tabs.create({ url, active: true });
            await handleSessionReferenceLaunchActions([{ ...item, targetTabId: tab.id }], { aiPrompts, chatAgents });
        }
        if (!openUrls.length) await handleSessionReferenceLaunchActions([item], { aiPrompts, chatAgents });
    }, 'Opened');
    const openSession = () => perform(async () => {
        const result = await launchDashboardViewSessionSmart({ viewId: workspaceId, organisationId: workspace!.organisationId, openBehavior: 'respect_session' });
        if (!result.handled) throw new Error('This Workspace is unavailable.');
        if (!result.ok) throw new Error(result.error);
        if (alive.current) setRunning(true);
    }, 'Opened');

    return <section aria-label="Workspace Session" data-workspace-session-card="true" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)]">
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--color-borderDefault)] px-4">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-textPrimary)]">
                <Layers size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>
                <span>Session</span><span className="text-[11px] font-normal tabular-nums text-[var(--color-textMuted)]">· {filteredItems.length}</span>
                {running && <span className="text-[11px] font-normal text-[var(--color-textMuted)]">Running</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={!workspace || !savedItems.some(item => item.url) || pending} onClick={() => void openSession()} aria-label="Open session" title="Open all saved destinations, including those hidden by search" className={actionClass}><ExternalLink size={14}/></button>
                <button type="button" disabled={!workspace || pending} aria-label="Session settings" title="Session settings" className={actionClass} onClick={() => window.dispatchEvent(new CustomEvent(DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT, { detail: { viewId: workspaceId } }))}><Settings size={14}/></button>
            </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            {!filteredItems.length ? <div className="flex h-full flex-col items-center justify-center gap-2 px-3 py-6 text-center">
                <span className="text-[12px] text-[var(--color-textMuted)]">{!workspace ? 'Workspace unavailable' : query.trim() ? 'No matching tabs' : 'No saved tabs yet'}</span>
            </div> : filteredItems.map((item, index) => <div key={item.id || `${item.url}-${index}`} className="group flex w-full items-center border-b border-[var(--color-borderDefault)] pr-1.5 last:border-b-0 hover:bg-[var(--color-hoverBg)]">
                <button type="button" disabled={pending} onClick={() => void openItem(item)} aria-label={`Open ${item.name || item.title || item.url}`} title={`Open ${item.title || item.name || item.url}`} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--color-textPrimary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)] focus-visible:ring-inset">
                    <DestinationFavicon key={`${item.url}-${item.favIconUrl || ''}`} item={item}/>
                    <span className="flex min-w-0 flex-col"><span className="truncate">{item.name || item.title || item.url}</span><span className="truncate text-[11px] font-normal text-[var(--color-textMuted)]">{hostname(item.url)}</span></span>
                </button>
                <button type="button" disabled={pending} aria-label={`Remove ${item.name || item.title || item.url}`} title="Remove saved tab" onClick={() => void perform(async () => { await editWorkspaceDestinations(workspaceId, { type: 'remove', item }); }, 'Saved')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-error)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focusRing)]"><Trash2 size={13}/></button>
            </div>)}
        </div>
        <footer className="shrink-0 border-t border-[var(--color-borderDefault)] px-3 py-2">
            {(pending || status || error) && <p role={error ? 'alert' : 'status'} className={`truncate text-[11px] ${error ? 'text-[var(--color-error)]' : 'text-[var(--color-textMuted)]'}`} title={error}>{error || (pending ? 'Working…' : status)}</p>}
            <div className="flex items-center justify-center gap-2">
                <button type="button" disabled={!workspace || pending} onClick={() => setAdding(true)} className={actionClass}><Plus size={15}/>Add links</button>
            </div>
        </footer>
        {adding && <Suspense fallback={<span role="status" className="text-[12px] text-[var(--color-textMuted)]">Loading Add links…</span>}><AddLinksModal isOpen availableTabs={availableTabs.filter(tab => !savedItems.some(item => item.url === tab.url))} notes={notes.filter(item => item.organisationId === workspace?.organisationId)} snippets={snippets.filter(item => item.organisationId === workspace?.organisationId)} chatAgents={suggestions} onAddAvailableTab={item => add([item])} onAddCustomLink={addCustom} onAddSessionLinks={add} onClose={() => setAdding(false)} appearanceTokens={{ '--color-editorBg': reflectNewTabTheme.tokens.rootBg, '--color-inputBg': reflectNewTabTheme.tokens.rootBg, '--color-panelBg': reflectNewTabTheme.tokens.rootBg, '--color-containerBg': reflectNewTabTheme.tokens.rootBg } as import('react').CSSProperties}/></Suspense>}
    </section>;
}
