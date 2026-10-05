/** Existing prompt/tab interaction extracted from the New Tab modal; host services are injected. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { TemporaryPromptTabAttachment } from './temporaryPromptComposition';
type WebsitePopupOpenTabOption = TemporaryPromptTabAttachment;

export interface TemporaryPromptComposerOptions {
    initialPrompt?: string;
    allowEmpty?: boolean;
    isSending?: boolean;
    onClose: () => void;
    onSend: (prompt: string, attachedTabs: TemporaryPromptTabAttachment[]) => void;
    readOpenTabs: () => Promise<TemporaryPromptTabAttachment[]>;
    subscribeTabRemoved?: (onRemoved: (tabId: number) => void) => (() => void);
    keyboardTarget?: Window | null;
    focusRoot?: Document | ShadowRoot;
    initialAttachedTabs?: TemporaryPromptTabAttachment[];
    initialExpanded?: boolean;
    initialRulesExpanded?: boolean;
    allowAttachmentsOnly?: boolean;
    onDraftChange?: (value: string, attachedTabs: TemporaryPromptTabAttachment[]) => void;
    onViewChange?: (view: { expanded: boolean; rulesExpanded: boolean }) => void;
    onInputRef?: (element: HTMLTextAreaElement | null) => void;
    refreshTabsOnAttachmentSearch?: boolean;
    stripMentionForEligibility?: boolean;
    sendBlocked?: boolean;
    showEmptyTabSearch?: boolean;
    autoSizeTextarea?: boolean;
}
type ActiveTabMention = {
    start: number;
    end: number;
    query: string;
};
const getActiveTabMention = (value: string, caret: number): ActiveTabMention | null => {
    const match = value.slice(0, caret).match(/(^|\s)@([^@\n]*)$/);
    if (!match)
        return null;
    const start = (match.index || 0) + match[1].length;
    return { start, end: caret, query: match[2] || '' };
};
const getTabSearchText = (tab: WebsitePopupOpenTabOption) => {
    let hostname = '';
    try {
        hostname = new URL(tab.url).hostname.replace(/^www\./i, '');
    }
    catch {
        hostname = '';
    }
    return `${tab.title} ${tab.url} ${hostname}`.toLowerCase();
};
export function useTemporaryPromptComposer({ initialPrompt = '', allowEmpty = false, isSending = false,
    onClose, onSend, readOpenTabs, subscribeTabRemoved, keyboardTarget, focusRoot,
    initialAttachedTabs = [], initialExpanded = false, initialRulesExpanded = false, allowAttachmentsOnly = false,
    onDraftChange, onViewChange, onInputRef, refreshTabsOnAttachmentSearch = false,
    stripMentionForEligibility = false, sendBlocked = false, showEmptyTabSearch = false, autoSizeTextarea = true }: TemporaryPromptComposerOptions) {
    const [value, setValue] = useState(initialPrompt);
    const [caret, setCaret] = useState(initialPrompt.length);
    const [openTabs, setOpenTabs] = useState<WebsitePopupOpenTabOption[]>([]);
    const [attachedTabs, setAttachedTabs] = useState<WebsitePopupOpenTabOption[]>(initialAttachedTabs);
    const [tabsLoading, setTabsLoading] = useState(true);
    const [tabsError, setTabsError] = useState<string | null>(null);
    const [textareaFocused, setTextareaFocused] = useState(false);
    const [mentionDismissed, setMentionDismissed] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [expanded, setExpanded] = useState(initialExpanded);
    const [rulesExpanded, setRulesExpanded] = useState(initialRulesExpanded);
    const formRef = useRef<HTMLFormElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const activeMention = useMemo(() => getActiveTabMention(value, caret), [caret, value]);
    const promptForEligibility = stripMentionForEligibility && activeMention
      ? `${value.slice(0, activeMention.start)}${value.slice(activeMention.end)}` : value;
    const canSend = (allowEmpty || promptForEligibility.trim().length > 0 || (allowAttachmentsOnly && attachedTabs.length > 0)) && !isSending && !sendBlocked;
    useEffect(() => { onDraftChange?.(value, attachedTabs); }, [value, attachedTabs, onDraftChange]);
    useEffect(() => { onViewChange?.({ expanded, rulesExpanded }); }, [expanded, rulesExpanded, onViewChange]);
    useLayoutEffect(() => { onInputRef?.(textareaRef.current); return () => onInputRef?.(null); }, [onInputRef]);
    const tabsOwner = useRef({ active: false, sequence: 0 });
    const reloadTabs = useCallback(async () => {
      const owner = tabsOwner.current;
      if (!owner.active) return;
      const sequence = ++owner.sequence;
      setTabsLoading(true); setTabsError(null);
      try {
        const tabs = await readOpenTabs();
        if (owner.active && owner.sequence === sequence) setOpenTabs(tabs);
      } catch (error) {
        if (owner.active && owner.sequence === sequence) setTabsError(error instanceof Error ? error.message : String(error));
      } finally {
        if (owner.active && owner.sequence === sequence) setTabsLoading(false);
      }
    }, [readOpenTabs]);
    const attachedTabIds = useMemo(() => new Set(attachedTabs.map(tab => tab.tabId)), [attachedTabs]);
    const filteredTabs = useMemo(() => {
        if (!activeMention)
            return [];
        const query = activeMention.query.trim().toLowerCase();
        return openTabs.filter(tab => !attachedTabIds.has(tab.tabId)
            && (!query || getTabSearchText(tab).includes(query)));
    }, [activeMention, attachedTabIds, openTabs]);
    const mentionMenuOpen = Boolean(textareaFocused && activeMention && !mentionDismissed && !tabsLoading && !tabsError
      && (filteredTabs.length > 0 || showEmptyTabSearch));
    useEffect(() => {
      if (highlightedIndex >= filteredTabs.length) setHighlightedIndex(0);
    }, [filteredTabs.length, highlightedIndex]);
    useEffect(() => {
        const previousFocus = focusRoot?.activeElement instanceof HTMLElement ? focusRoot?.activeElement : null;
        textareaRef.current?.focus();
        return () => {
            if (previousFocus?.isConnected)
                previousFocus.focus({ preventScroll: true });
        };
    }, [focusRoot]);
    useEffect(() => {
        if (!autoSizeTextarea) return;
        const input = textareaRef.current;
        if (!input)
            return;
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    }, [value, expanded, autoSizeTextarea]);
    useEffect(() => subscribeTabRemoved?.(closedTabId => {
        setOpenTabs(current => current.filter(tab => tab.tabId !== closedTabId));
        setAttachedTabs(current => current.filter(tab => tab.tabId !== closedTabId));
    }), [subscribeTabRemoved]);
    useEffect(() => {
        setValue(initialPrompt);
        setCaret(initialPrompt.length);
    }, [initialPrompt]);
    useEffect(() => {
        tabsOwner.current.active = true;
        void reloadTabs();
        return () => { tabsOwner.current.active = false; tabsOwner.current.sequence++; };
    }, [reloadTabs]);
    useEffect(() => {
        setHighlightedIndex(0);
        setMentionDismissed(false);
    }, [activeMention?.query, activeMention?.start]);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented && !mentionMenuOpen && !isSending) {
                event.preventDefault();
                onClose();
            }
            if (event.key === 'Tab' && !event.defaultPrevented && formRef.current) {
                const controls = Array.from(formRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), [tabindex="0"]'));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && focusRoot?.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && focusRoot?.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        keyboardTarget?.addEventListener('keydown', handleKeyDown);
        return () => keyboardTarget?.removeEventListener('keydown', handleKeyDown);
    }, [isSending, mentionMenuOpen, onClose, keyboardTarget, focusRoot]);
    const updateCaret = useCallback(() => {
        const input = textareaRef.current;
        if (input)
            setCaret(input.selectionStart ?? input.value.length);
    }, []);
    const focusPromptAt = useCallback((position: number) => {
        window.requestAnimationFrame(() => {
            const input = textareaRef.current;
            if (!input)
                return;
            input.focus({ preventScroll: true });
            input.setSelectionRange(position, position);
            setCaret(position);
        });
    }, []);
    const attachTab = useCallback((tab: WebsitePopupOpenTabOption) => {
        const mention = getActiveTabMention(value, caret);
        if (!mention)
            return;
        const nextAttachedIds = new Set([...attachedTabs.map(candidate => candidate.tabId), tab.tabId]);
        const hasMoreTabs = openTabs.some(candidate => !nextAttachedIds.has(candidate.tabId));
        const suffix = value.slice(mention.end);
        const keepPickerOpen = hasMoreTabs && (!suffix || /^\s/.test(suffix));
        const nextValue = `${value.slice(0, mention.start)}${keepPickerOpen ? '@' : ''}${suffix}`;
        setValue(nextValue);
        setAttachedTabs(current => current.some(candidate => candidate.tabId === tab.tabId)
            ? current
            : [...current, tab]);
        setMentionDismissed(false);
        focusPromptAt(mention.start + (keepPickerOpen ? 1 : 0));
    }, [attachedTabs, caret, focusPromptAt, openTabs, value]);
    const beginAttachmentSearch = useCallback(() => {
        if (refreshTabsOnAttachmentSearch) void reloadTabs();
        const input = textareaRef.current;
        const position = input?.selectionStart ?? value.length;
        const needsLeadingSpace = position > 0 && !/\s/.test(value[position - 1] || '');
        const insertion = `${needsLeadingSpace ? ' ' : ''}@`;
        const nextValue = `${value.slice(0, position)}${insertion}${value.slice(position)}`;
        const nextCaret = position + insertion.length;
        setValue(nextValue);
        setMentionDismissed(false);
        focusPromptAt(nextCaret);
    }, [focusPromptAt, value, refreshTabsOnAttachmentSearch, reloadTabs]);
    const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing)
            return;
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            if (canSend)
                formRef.current?.requestSubmit();
            return;
        }
        if (!mentionMenuOpen)
            return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (filteredTabs.length === 0)
                return;
            const offset = event.key === 'ArrowDown' ? 1 : -1;
            setHighlightedIndex(index => (index + offset + filteredTabs.length) % filteredTabs.length);
            return;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && filteredTabs[highlightedIndex]) {
            event.preventDefault();
            attachTab(filteredTabs[highlightedIndex]);
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setMentionDismissed(true);
        }
    };
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const mention = activeMention;
        const valueWithoutPickerQuery = mention
            ? `${value.slice(0, mention.start)}${value.slice(mention.end)}`
            : value;
        const prompt = valueWithoutPickerQuery.trim();
        if ((!prompt && !allowEmpty && !(allowAttachmentsOnly && attachedTabs.length)) || isSending || sendBlocked)
            return;
        onSend(prompt, attachedTabs);
    };
    return { value, setValue, caret, setCaret, attachedTabs, setAttachedTabs, tabsLoading, tabsError,
        setTextareaFocused, setMentionDismissed, highlightedIndex, setHighlightedIndex,
        expanded, setExpanded, rulesExpanded, setRulesExpanded, formRef, textareaRef,
        canSend, filteredTabs, mentionMenuOpen, updateCaret, attachTab, beginAttachmentSearch,
        handlePromptKeyDown, handleSubmit, reloadTabs };
}
export type TemporaryPromptComposerController = ReturnType<typeof useTemporaryPromptComposer>;
