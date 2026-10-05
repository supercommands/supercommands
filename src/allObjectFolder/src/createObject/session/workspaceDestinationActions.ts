import { db } from '../../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { updateWorkspace, WorkspaceConflictError } from './workspaceClient';
import type { LinkItem } from '../links/linkTypes';
import type { WorkspaceRecord, UpdateWorkspaceInput } from './workspaceTypes';

type DestinationOperation = { type: 'add'; items: LinkItem[] } | { type: 'remove'; item: LinkItem };

/** Serialize manual edits and rebase operations, never stale whole-list snapshots. */
export function createWorkspaceDestinationWriter(
    read: (id: string) => Promise<WorkspaceRecord | undefined>,
    write: (id: string, input: UpdateWorkspaceInput) => Promise<WorkspaceRecord>,
    isConflict: (error: unknown) => boolean,
    newId: () => string,
    afterSave?: (record: WorkspaceRecord) => Promise<void>,
) {
    const queues = new Map<string, Promise<unknown>>();
    return (id: string, operation: DestinationOperation): Promise<WorkspaceRecord> => {
        const additions = operation.type === 'add' ? operation.items.filter(item => item.url?.trim()).map(item => ({
            ...item, id: newId(), title: item.title || item.name || item.url,
            name: item.name || item.title || item.url,
        })) : [];
        const save = (queues.get(id) || Promise.resolve()).catch(() => undefined).then(async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                const current = await read(id);
                if (!current) throw new Error('This Workspace no longer exists.');
                let urls = [...current.urls];
                if (operation.type === 'add') {
                    const savedUrls = new Set(urls.map(item => item.url));
                    for (const item of additions) {
                        if (!savedUrls.has(item.url)) { urls.push(item); savedUrls.add(item.url); }
                    }
                } else {
                    const index = urls.findIndex(item => operation.item.id
                        ? item.id === operation.item.id
                        : !item.id && item.url === operation.item.url && item.title === operation.item.title);
                    if (index >= 0) urls.splice(index, 1);
                }
                urls = urls.map(item => item.id ? item : { ...item, id: newId() });
                let saved: WorkspaceRecord;
                try { saved = await write(id, { urls, expectedUpdatedAt: current.updatedAt }); }
                catch (error) { if (!isConflict(error) || attempt === 2) throw error; continue; }
                await afterSave?.(saved);
                return saved;
            }
            throw new Error('Could not save Workspace tabs.');
        });
        queues.set(id, save);
        void save.finally(() => { if (queues.get(id) === save) queues.delete(id); }).catch(() => undefined);
        return save;
    };
}

export const editWorkspaceDestinations = createWorkspaceDestinationWriter(
    id => db.workspaces.get(id), updateWorkspace,
    error => error instanceof WorkspaceConflictError,
    () => generateEntityId('link'),
    async record => {
        if (typeof document === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
        const response = await chrome.runtime.sendMessage({ action: 'get_active_sessions' });
        if (!response?.ok) throw new Error('Tabs saved, but the running session could not be refreshed. Try again.');
        const latest = await db.workspaces.get(record.id);
        if (!latest) return;
        for (const session of response.active_sessions || []) {
            if (session.sessionId !== record.id) continue;
            const updated = await chrome.runtime.sendMessage({
                action: 'update_active_session_urls', sessionId: record.id, windowId: session.windowId,
                urls: latest.urls.map(item => item.url), names: latest.urls.map(item => item.name || item.title || item.url),
            });
            if (!updated?.ok && updated?.error !== 'session_not_running') throw new Error('Tabs saved, but the running session could not be refreshed. Try again.');
        }
    },
);
