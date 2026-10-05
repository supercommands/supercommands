import { useEffect, useState } from 'react';
import { readWebsitePopupOpenTabs, readWebsitePopupTodoAttachments, searchWebsitePopupLinkUrls, } from '../bridge/websitePopupCreateOptionsBridge';
/** Shared cancellation, loading and error behavior for Create and saved-item pickers. */
function useOptionResource<T>(enabled: boolean, read: (query: string) => Promise<T[]>, query = '', delayed = false) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        setItems([]);
        setError(null);
        setLoading(enabled);
        if (!enabled)
            return;
        const load = () => {
            void read(query)
                .then(value => {
                if (active)
                    setItems(value);
            })
                .catch(failure => {
                if (active)
                    setError(failure instanceof Error ? failure.message : String(failure));
            })
                .finally(() => {
                if (active)
                    setLoading(false);
            });
        };
        const timer = delayed ? window.setTimeout(load, 200) : null;
        if (!delayed)
            load();
        return () => {
            active = false;
            if (timer !== null)
                window.clearTimeout(timer);
        };
    }, [enabled, read, query, delayed]);
    return { items, loading, error };
}
export function useWebsitePopupPickerOptions(browserLinksActive: boolean, attachmentsActive: boolean, query: string) {
    const tabs = useOptionResource(browserLinksActive, readWebsitePopupOpenTabs);
    const urls = useOptionResource(browserLinksActive && Boolean(query.trim()), searchWebsitePopupLinkUrls, query, true);
    const attachments = useOptionResource(attachmentsActive, readWebsitePopupTodoAttachments);
    return { tabs, urls, attachments };
}
