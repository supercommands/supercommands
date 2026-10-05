import { ConflictError, getSession, updateSession } from './sessionData';
import { normalizeSessionOpenSettings, type SessionOpenSettings } from './sessionSettings';
import type { SessionRecord } from './sessionTypes';
const pendingSettingsBySession = new Map<string, Promise<SessionRecord>>();
/** Keep a saved session setting and any running browser-window instance in sync. */
export function saveSessionOpenSettings(sessionId: string, updates: Partial<SessionOpenSettings>): Promise<SessionRecord> {
    const previous = pendingSettingsBySession.get(sessionId) || Promise.resolve(null);
    const operation = previous.catch(() => null).then(async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            const current = await getSession(sessionId);
            if (!current)
                throw new Error('Session not found.');
            const nextSettings = normalizeSessionOpenSettings({ ...current.sessionOpenSettings, ...updates });
            try {
                const updated = await updateSession(sessionId, {
                    sessionOpenSettings: nextSettings,
                    expectedUpdatedAt: current.updatedAt,
                });
                const response = await chrome.runtime.sendMessage({
                    action: 'update_workspace_settings',
                    workspaceId: sessionId,
                    openSettings: updated.sessionOpenSettings,
                });
                if (!response?.ok) {
                    throw new Error('Session settings were saved, but the running session could not be updated.');
                }
                return updated;
            }
            catch (error) {
                if (!(error instanceof ConflictError) || attempt === 2)
                    throw error;
            }
        }
        throw new Error('Could not save session settings.');
    });
    pendingSettingsBySession.set(sessionId, operation);
    void operation.finally(() => {
        if (pendingSettingsBySession.get(sessionId) === operation)
            pendingSettingsBySession.delete(sessionId);
    }).catch(() => { });
    return operation;
}
