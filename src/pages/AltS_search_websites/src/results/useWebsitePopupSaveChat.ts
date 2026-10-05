import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectWebsitePopupChatConversation } from '../../../../shared-components/websitePopup/websitePopupChatConversation';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
export type WebsitePopupChatSaveDestination = {
    entity: 'prompt' | 'agent';
    targetId: string;
    title: string;
};
/** The URL is frozen on entry; destination selection never persists anything. */
export function useWebsitePopupSaveChat(active: boolean, open: boolean, website: boolean, onSaved: () => void, restoreFocus: () => void) {
    const [currentUrl, setCurrentUrl] = useState(() => window.location.href);
    const [page, setPage] = useState<{
        providerId: string;
        url: string;
        title: string;
    } | null>(null);
    const [destination, setDestination] = useState<WebsitePopupChatSaveDestination | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const entered = useRef(false);
    const generation = useRef(0);
    const pendingRef = useRef(false);
    useEffect(() => () => {
        generation.current++;
    }, []);
    useEffect(() => {
        if (!open || !website)
            return;
        const update = () => setCurrentUrl(window.location.href);
        update();
        const timer = window.setInterval(update, 500);
        window.addEventListener('popstate', update);
        window.addEventListener('hashchange', update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('popstate', update);
            window.removeEventListener('hashchange', update);
        };
    }, [open, website]);
    useLayoutEffect(() => {
        const inFlow = active && open;
        if (inFlow && !entered.current) {
            const conversation = website ? detectWebsitePopupChatConversation(window.location.href) : null;
            setPage(conversation ? { ...conversation, title: document.title || conversation.url } : null);
            setError(conversation ? null : 'This page is not a supported AI conversation.');
        }
        if (!inFlow) {
            generation.current++;
            pendingRef.current = false;
            setPage(null);
            setDestination(null);
            setPending(false);
            setError(null);
        }
        entered.current = inFlow;
    }, [active, open, website]);
    const cancel = useCallback(() => {
        if (pendingRef.current)
            return;
        setDestination(null);
        setError(null);
        restoreFocus();
    }, [restoreFocus]);
    const stage = useCallback((next: WebsitePopupChatSaveDestination) => {
        if (!page || pendingRef.current)
            return;
        setDestination(next);
        setError(null);
    }, [page]);
    const save = useCallback(async () => {
        if (!destination || !page || pendingRef.current)
            return;
        const revision = generation.current;
        pendingRef.current = true;
        setPending(true);
        setError(null);
        try {
            const result = await executeWebsitePopupBridgeOperation({
                kind: 'save-chat-to-target',
                entity: destination.entity,
                targetId: destination.targetId,
                page: { url: page.url, title: page.title },
            });
            if (revision !== generation.current)
                return;
            if (result.status !== 'chat-saved')
                throw new Error(result.status === 'failed' ? result.message : 'Unable to save this conversation.');
            onSaved();
        }
        catch (failure) {
            if (revision === generation.current)
                setError(failure instanceof Error ? failure.message : String(failure));
        }
        finally {
            if (revision === generation.current) {
                pendingRef.current = false;
                setPending(false);
            }
        }
    }, [destination, page, onSaved]);
    const canSaveChat = website && Boolean(detectWebsitePopupChatConversation(currentUrl));
    return { canSaveChat: active ? Boolean(page) : canSaveChat, page, destination, pending, error, stage, save, cancel };
}
