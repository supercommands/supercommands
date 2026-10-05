import TextExpanderIcon from '../../../../../shared-components/icons/TextExpanderIcon';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Link2, Plus, Sparkles, X } from 'lucide-react';

import type { SelectedLink } from '../../links/linkTypes';
import type { SessionAgentSuggestion } from '../sessionAgentSnapshot';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { searchAll } from '../../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/searchEngine';
import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
type LinkSuggestion = {
    title: string;
    url: string;
    source: 'history' | 'bookmark';
};
type InternalNoteSuggestion = {
    id: string;
    title: string;
    body?: string;
};
type InternalSnippetSuggestion = {
    id: string;
    title: string;
    config?: string | Record<string, any>;
};
type InternalSuggestion = {
    kind: 'note';
    id: string;
    title: string;
    body?: string;
} | {
    kind: 'link';
    id: string;
    title: string;
    urls: SelectedLink[];
} | {
    kind: 'snippet';
    id: string;
    title: string;
    config?: string | Record<string, any>;
} | ({
    kind: 'agent';
} & SessionAgentSuggestion);
interface SessionAddLinksModalProps {
    isOpen: boolean;
    availableTabs?: SelectedLink[];
    notes?: InternalNoteSuggestion[];
    snippets?: InternalSnippetSuggestion[];
    chatAgents?: SessionAgentSuggestion[];
    onAddAvailableTab?: (item: SelectedLink) => void | boolean | Promise<void | boolean>;
    onAddCustomLink: (url: string, name?: string) => Promise<boolean>;
    onAddSessionLinks: (items: SelectedLink[]) => Promise<boolean> | boolean;
    onSearchBrowserLinks?: (query: string) => Promise<LinkSuggestion[]>;
    onClose: () => void;
    portalContainer?: HTMLElement | null;
    anchorPosition?: {
        top: number;
        left: number;
        width?: number;
    };
    appearanceTokens?: CSSProperties;
    commandChainSurface?: boolean;
}
const getHostname = (url: string) => {
    try {
        const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(safeUrl).hostname;
    }
    catch {
        return url;
    }
};
const isExternalLinkUrl = (url: string) => {
    const value = String(url || '').trim();
    return Boolean(value) && !/^(chrome|chrome-extension|edge|about|devtools):/i.test(value);
};
const getUrlsFromLinkItems = (items?: SelectedLink[]) => {
    if (!Array.isArray(items))
        return [];
    return items.map(item => item.url).filter(isExternalLinkUrl);
};
const SessionAddLinksModal = ({ isOpen, availableTabs = [], notes = [], snippets = [], chatAgents = [], onAddAvailableTab, onAddCustomLink, onAddSessionLinks, onSearchBrowserLinks, onClose, portalContainer, anchorPosition, appearanceTokens, commandChainSurface = false, }: SessionAddLinksModalProps) => {
    const [customUrl, setCustomUrl] = useState('');
    const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (!isOpen)
            return;
        setCustomUrl('');
        setSuggestions([]);
        setErrorMessage('');
        setIsSaving(false);
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
        return () => {
            window.cancelAnimationFrame(frame);
            if (previousFocus?.isConnected)
                previousFocus.focus();
        };
    }, [isOpen]);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);
    useEffect(() => {
        const query = customUrl.trim();
        if (!isOpen || !query) {
            setSuggestions([]);
            return;
        }
        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            if (onSearchBrowserLinks) {
                try {
                    const results = await onSearchBrowserLinks(query);
                    if (!cancelled)
                        setSuggestions(results.filter(item => isExternalLinkUrl(item.url)).slice(0, 5));
                }
                catch {
                    if (!cancelled)
                        setSuggestions([]);
                }
                return;
            }
            const chromeApi = (window as typeof window & {
                chrome?: typeof chrome;
            }).chrome;
            const searchBookmarks = (): Promise<chrome.bookmarks.BookmarkTreeNode[]> => new Promise(resolve => {
                if (!chromeApi?.bookmarks?.search)
                    return resolve([]);
                chromeApi.bookmarks.search(query, results => resolve(results || []));
            });
            const searchHistory = (): Promise<chrome.history.HistoryItem[]> => new Promise(resolve => {
                if (!chromeApi?.history?.search)
                    return resolve([]);
                chromeApi.history.search({ text: query, maxResults: 5 }, results => resolve(results || []));
            });
            const [bookmarks, history] = await Promise.all([searchBookmarks(), searchHistory()]);
            if (cancelled)
                return;
            const unique = new Map<string, LinkSuggestion>();
            bookmarks.forEach(item => {
                const url = item.url || '';
                if (isExternalLinkUrl(url) && !unique.has(url)) {
                    unique.set(url, { title: item.title || getHostname(url), url, source: 'bookmark' });
                }
            });
            history.forEach(item => {
                const url = item.url || '';
                if (isExternalLinkUrl(url) && !unique.has(url)) {
                    unique.set(url, { title: item.title || getHostname(url), url, source: 'history' });
                }
            });
            setSuggestions(Array.from(unique.values()).slice(0, 5));
        }, 150);
        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [customUrl, isOpen, onSearchBrowserLinks]);
    const normalizedAvailableTabs = useMemo(() => availableTabs.filter(item => isExternalLinkUrl(item.url)), [availableTabs]);
    const buildExtensionUrl = (path: string) => {
        const chromeApi = (window as typeof window & {
            chrome?: typeof chrome;
        }).chrome;
        return chromeApi?.runtime?.getURL ? chromeApi.runtime.getURL(path) : path;
    };
    const internalSuggestions = useMemo<InternalSuggestion[]>(() => {
        const query = customUrl.trim();
        if (commandChainSurface || !isOpen || !query)
            return [];
        const snippetMap = new Map(snippets.map(snippet => [String(snippet.id), snippet]));
        const normalizedChatAgents = chatAgents.map(agent => ({
            ...agent,
            id: agent.id,
            title: agent.title || 'Untitled Agent',
        }));
        const results = searchAll(query, {
            commands: [],
            localCommands: [],
            historyItems: null,
            bookmarks: [],
            commonCommands: [],
            notes: notes.map(note => ({
                id: note.id,
                title: note.title || 'Untitled Note',
                body: note.body || '',
            })),
            // Saved link entities are intentionally excluded here. This field is
            // the custom-URL add flow, not the link-entity search flow.
            links: [],
            snippets: snippets.map(snippet => ({
                id: snippet.id,
                title: snippet.title || 'Untitled Snippet',
            })),
            agents: normalizedChatAgents,
            sessions: [],
            prompts: [],
            lockedCommand: null,
            includeCommonIfEmpty: false,
            returnAllIfEmpty: false,
        });
        const internalResults = results.reduce<InternalSuggestion[]>((items, result) => {
            if (result._kind === 'note') {
                items.push({
                    kind: 'note',
                    id: result.id,
                    title: result.title || 'Untitled Note',
                    body: result.body,
                });
            }
            else if (result._kind === 'snippet') {
                const snippet = snippetMap.get(String(result.id));
                items.push({
                    kind: 'snippet',
                    id: result.id,
                    title: result.title || snippet?.title || 'Untitled Snippet',
                    config: snippet?.config,
                });
            }
            else if (result._kind === 'agent_collection') {
                const agent = normalizedChatAgents.find(candidate => String(candidate.id) === String(result.id));
                if (!agent)
                    return items;
                items.push({
                    kind: 'agent',
                    id: result.id,
                    title: result.title || 'Untitled Agent',
                    prompt: agent.prompt,
                    targets: agent.targets,
                });
            }
            return items;
        }, []).slice(0, 8);
        return internalResults;
    }, [chatAgents, commandChainSurface, customUrl, isOpen, notes, snippets]);
    const addCustomLink = async (url: string, name?: string) => {
        if (isSaving)
            return;
        if (!url.trim()) {
            setErrorMessage('Enter a URL to add.');
            return;
        }
        setIsSaving(true);
        setErrorMessage('');
        try {
            const didSave = await onAddCustomLink(url, name);
            if (didSave) {
                setCustomUrl('');
                setSuggestions([]);
                inputRef.current?.focus();
                return;
            }
            setErrorMessage('Could not add this link. Check the URL and try again.');
        }
        catch {
            setErrorMessage('Could not add this link. Check the URL and try again.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const addAvailableTab = async (item: SelectedLink) => {
        if (isSaving || !onAddAvailableTab)
            return;
        setIsSaving(true);
        setErrorMessage('');
        try {
            if (await onAddAvailableTab(item) === false) {
                setErrorMessage('Could not add this tab. Try again.');
            }
        }
        catch {
            setErrorMessage('Could not add this tab. Try again.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const addInternalSuggestion = async (suggestion: InternalSuggestion) => {
        if (isSaving)
            return;
        let items: SelectedLink[] = [];
        if (suggestion.kind === 'note') {
            const title = suggestion.title || 'Untitled Note';
            items = [{
                    id: generateEntityId('linkItem'),
                    title,
                    name: title,
                    url: buildExtensionUrl(`AltS_search_newtab/index.html?session_reference=true&type=note&id=${encodeURIComponent(suggestion.id)}`),
                    source: 'note',
                }];
        }
        else if (suggestion.kind === 'snippet') {
            const title = suggestion.title || 'Untitled Snippet';
            items = [{
                    id: generateEntityId('linkItem'),
                    title,
                    name: title,
                    url: buildExtensionUrl(`AltS_search_newtab/index.html?session_reference=true&type=snippet&id=${encodeURIComponent(suggestion.id)}`),
                    source: 'snippet',
                }];
        }
        else if (suggestion.kind === 'agent') {
            const title = suggestion.title || 'Untitled Agent';
            if (suggestion.targets.length === 0) {
                setErrorMessage('This Chat Agent does not have any saved URLs to add.');
                return;
            }
            items = suggestion.targets.map((target, index) => {
                const itemTitle = suggestion.targets.length === 1 ? title : `${title} - ${target.name}`;
                return {
                    id: generateEntityId('linkItem'),
                    title: itemTitle,
                    name: itemTitle,
                    url: target.url,
                    favIconUrl: getFaviconUrl(getHostname(target.url)),
                    source: 'custom',
                    originalData: {
                        sessionAgentSnapshot: {
                            sourceId: suggestion.id,
                            sourceTitle: title,
                            providerId: target.id,
                            providerName: target.name,
                            providerKind: target.kind,
                            prompt: suggestion.prompt,
                        },
                    },
                } satisfies SelectedLink;
            });
        }
        else {
            const title = suggestion.title || 'Untitled Link';
            items = [{
                    id: generateEntityId('linkItem'),
                    title,
                    name: title,
                    url: buildExtensionUrl(`AltS_search_newtab/index.html?session_reference=true&type=link&id=${encodeURIComponent(suggestion.id)}`),
                    source: 'link',
                    originalData: {
                        id: suggestion.id,
                        urls: suggestion.urls,
                    },
                }];
        }
        if (items.length === 0) {
            setErrorMessage('This link does not have any URLs to add.');
            return;
        }
        setIsSaving(true);
        setErrorMessage('');
        try {
            const didSave = await onAddSessionLinks(items);
            if (didSave) {
                setCustomUrl('');
                setSuggestions([]);
                inputRef.current?.focus();
                return;
            }
            setErrorMessage('Could not add this item. Try again.');
        }
        catch {
            setErrorMessage('Could not add this item. Try again.');
        }
        finally {
            setIsSaving(false);
        }
    };
    if (!isOpen)
        return null;
    const isAnchored = Boolean(anchorPosition);
    const rootStyle: CSSProperties = isAnchored
        ? {
            ...appearanceTokens,
            position: 'absolute',
            top: anchorPosition?.top ?? 0,
            left: anchorPosition?.left ?? 0,
            width: anchorPosition?.width ?? 560,
            maxWidth: '80vw',
        }
        : {
            ...appearanceTokens,
        };
    return createPortal(<div data-session-add-links-popup="" data-command-chain-url-popup={commandChainSurface ? '' : undefined} className={isAnchored
            ? 'z-[10000000] font-sans font-normal text-[var(--color-textPrimary)]'
            : 'fixed inset-0 z-[10000000] flex items-center justify-center p-4 font-sans font-normal'} style={rootStyle} onPointerDown={event => {
            event.stopPropagation();
        }} onMouseDown={event => {
            event.stopPropagation();
        }} onClick={event => {
            event.stopPropagation();
        }}>
      {!isAnchored ? (<button type="button" aria-label="Dismiss add links" className="absolute inset-0 h-full w-full bg-[var(--color-overlayBg)]" onClick={onClose}/>) : null}
      <section role="dialog" aria-modal="true" aria-labelledby="session-add-links-title" className={isAnchored
            ? 'relative flex max-h-[min(520px,calc(100vh-8rem))] w-full flex-col overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] shadow-2xl'
            : 'relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] shadow-2xl'}>
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-borderDefault)] px-4 py-3">
          <div>
            <h2 id="session-add-links-title" className="text-sm font-semibold">
              Add links
            </h2>
            <p className="mt-1 text-xs text-[var(--color-textMuted)]">{commandChainSurface ? 'Paste a URL to add a link.' : 'Paste a URL or choose an open tab.'}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" aria-label="Close add links" title="Close add links">
            <X size={16}/>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4">
          <form onSubmit={event => {
            event.preventDefault();
            void addCustomLink(customUrl);
        }}>
            <label htmlFor="session-custom-link" className="mb-2 block text-xs font-medium text-[var(--color-textPrimary)]">
              Custom link
            </label>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 py-1.5 transition-colors focus-within:border-[var(--color-borderActive)]">
                <Link2 size={15} className="shrink-0 text-[var(--color-textMuted)]"/>
                <input ref={inputRef} id="session-custom-link" aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'session-link-error' : undefined} value={customUrl} onChange={event => {
            setCustomUrl(event.target.value);
            setErrorMessage('');
        }} placeholder="Type or paste a URL" className="h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] focus:outline-none"/>
              </div>
              <button type="submit" disabled={isSaving || !customUrl.trim()} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-3 text-xs font-medium text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:cursor-not-allowed disabled:opacity-60">
                <Plus size={15}/>
                {isSaving ? 'Adding…' : 'Add'}
              </button>
            </div>
            {errorMessage && <p id="session-link-error" role="alert" className="mt-2 text-xs text-[var(--color-error)]">{errorMessage}</p>}

            {internalSuggestions.length > 0 && (<div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto custom-scrollbar">
                {internalSuggestions.map(suggestion => {
                const icon = suggestion.kind === 'note' ? (<FileText size={16} className="shrink-0 text-[var(--color-textMuted)]"/>) : suggestion.kind === 'snippet' ? (<TextExpanderIcon size={16} className="shrink-0 text-[var(--color-textMuted)]"/>) : suggestion.kind === 'agent' ? (<Sparkles size={16} className="shrink-0 text-[var(--color-textMuted)]"/>) : (<span className="flex w-8 shrink-0 items-center">
                        <StackedLinkIcon urls={getUrlsFromLinkItems(suggestion.urls)} size={16} fallback="link"/>
                      </span>);
                const subtitle = suggestion.kind === 'link'
                    ? `${suggestion.urls.length} ${suggestion.urls.length === 1 ? 'URL' : 'URLs'}`
                    : suggestion.kind === 'note'
                        ? 'Note'
                        : suggestion.kind === 'snippet'
                            ? 'Snippet'
                            : 'Chat Agent';
                return (<button key={`${suggestion.kind}-${suggestion.id}`} type="button" disabled={isSaving} onClick={() => void addInternalSuggestion(suggestion)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-hoverBg)]">
                      {icon}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[var(--color-textPrimary)]">
                          {suggestion.title}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--color-textSecondary)]">
                          {subtitle}
                        </span>
                      </span>
                    </button>);
            })}
              </div>)}

            {suggestions.length > 0 && (<div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto custom-scrollbar">
                {suggestions.map(suggestion => (<button key={suggestion.url} type="button" disabled={isSaving} onClick={() => void addCustomLink(suggestion.url, suggestion.title)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-hoverBg)]">
                    <img src={getFaviconUrl(getHostname(suggestion.url))} alt="" className="h-4 w-4 shrink-0 object-contain"/>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[var(--color-textPrimary)]">
                        {suggestion.title}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--color-textSecondary)]">
                        {suggestion.url}
                      </span>
                    </span>
                  </button>))}
              </div>)}
          </form>

          {!commandChainSurface && <div className="mt-4 border-t border-[var(--color-borderDefault)] pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-[var(--color-textPrimary)]">Available tabs</h3>
              <span className="text-xs text-[var(--color-textSecondary)]">{normalizedAvailableTabs.length}</span>
            </div>
            {normalizedAvailableTabs.length > 0 ? (<div className="max-h-64 space-y-0.5 overflow-y-auto custom-scrollbar">
                {normalizedAvailableTabs.map(item => {
                    const title = String(item.title || item.name || '').trim() || getHostname(item.url);
                    return (<button key={`${item.id}-${item.url}`} type="button" disabled={isSaving || !onAddAvailableTab} onClick={() => void addAvailableTab(item)} className="group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-hoverBg)]">
                      {item.favIconUrl ? (<img src={item.favIconUrl} alt="" className="h-5 w-5 shrink-0 object-contain"/>) : (<Link2 size={18} className="shrink-0 text-[var(--color-textMuted)]"/>)}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[var(--color-textPrimary)]">
                          {title}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--color-textSecondary)]">{item.url}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--color-textSecondary)]">
                        <Plus size={13}/>
                        Add
                      </span>
                    </button>);
                })}
              </div>) : (<div className="flex items-start gap-3 rounded-lg bg-[var(--color-inputBg)] px-3 py-3">
                <Link2 size={18} className="mt-0.5 shrink-0 text-[var(--color-textSecondary)]"/>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--color-textPrimary)]">No tabs available</p>
                  <p className="mt-1 text-xs text-[var(--color-textMuted)]">You can still add a link using the URL field above.</p>
                </div>
              </div>)}
          </div>}
        </div>
      </section>
    </div>, portalContainer || document.body);
};
export default SessionAddLinksModal;
