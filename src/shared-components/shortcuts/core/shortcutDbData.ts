import { db } from '../../../storage/indexDB/dbConfig';
import { requireWebCollectionAssignmentTarget } from '../../../allObjectFolder/src/createObject/collections/collectionAssignmentData';
import { CommandTerminalPrefixStorage } from '../../../storage/commandTerminal/commandTerminalPrefixAdapter';
import { getReservedCommandGrammarEntries, getCommandPrefixSettingKey } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingRecord } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import { validateUniquePrefixSettings } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import { generateEntityId } from '../../utils';
import { extractSnippetIdFromCompoundId } from '../../utils/idGenerator';
import type { UserShortcutRecord, ShortcutReferenceType } from './shortcutDbTypes';
import { shortcutOwnersMatch, type ShortcutOwner, type ShortcutAssignmentApproval, type ShortcutAssignmentCheck } from './shortcutAssignmentTypes';
const DEFAULT_USER = 'local_user';
export const normalizeShortcutTrigger = (trigger: string) => trigger.trim().toLowerCase();
export const normalizeStoredShortcutTrigger = (trigger: string) => normalizeShortcutTrigger(trigger).replace(/^\/+/, '');
export const getShortcutTriggerFormatError = (trigger: string) => {
    const value = normalizeShortcutTrigger(trigger);
    return !value || /^[a-z0-9_]+$/i.test(value) ? null
        : 'Shortcuts can only use letters, numbers, and underscores (_). Symbols like /, @, !, ., spaces, and prefixes are not allowed.';
};
const isProtectedPrefix = (row: Pick<PrefixSettingRecord, 'type' | 'category'>) => row.type === 'subcommand' || row.category === 'command' || row.category === 'system_command';
function reservedReason(value: string, rows: PrefixSettingRecord[]): string | null {
    const match = getReservedCommandGrammarEntries(rows).find(entry => entry.value === value && isProtectedPrefix({ type: entry.kind, category: entry.category }));
    return match ? 'The text command "' + value + '" is reserved by ' + match.label + '. Choose a different shortcut.' : null;
}
export async function getReservedShortcutReason(value: string): Promise<string | null> {
    const normalized = normalizeShortcutTrigger(value);
    if (!normalized)
        return 'Shortcut cannot be empty.';
    return getShortcutTriggerFormatError(value) || reservedReason(normalized, await CommandTerminalPrefixStorage.getPrefixSettings());
}
async function ownerLabel(referenceId: string, type: string): Promise<string> {
    const tables: Record<string, string> = { note: 'notes', link: 'links', snippet: 'snippets', todo: 'todos', agent: 'chatAgents', aiPrompt: 'aiPrompts', prompt: 'aiPrompts', session: 'workspaces', collection: 'workspaces', webCollection: 'collections', workspace: 'workspaces' };
    const table = tables[type];
    if (!table)
        return referenceId;
    const record = await db.table(table).get(type === 'webCollection' ? referenceId : extractSnippetIdFromCompoundId(referenceId)) || await db.table(table).get(referenceId);
    const collectionView = !record && type === 'collection' ? await db.workspaceViews.get(extractSnippetIdFromCompoundId(referenceId)) : undefined;
    return String(record?.workspaceName || record?.organisationName || record?.title || record?.name || collectionView?.title || referenceId);
}
async function checkFromSnapshot(value: string, currentReferenceId: string | undefined, userId: string, rows: PrefixSettingRecord[], records: UserShortcutRecord[], commands: any[], resolveLabels = true, prefixEditId?: string): Promise<ShortcutAssignmentCheck> {
    const normalized = normalizeShortcutTrigger(value);
    const grammarRows = prefixEditId ? rows.filter(row => row.id !== prefixEditId) : rows;
    const error = !normalized ? 'Enter a text command.' : (!prefixEditId && getShortcutTriggerFormatError(value)) || reservedReason(normalized, grammarRows);
    if (error)
        return { status: 'error', value: normalized, message: error };
    const prefixes = grammarRows.filter(row => row.enabled && normalizeStoredShortcutTrigger(row.prefix) === normalized);
    const owners: ShortcutOwner[] = prefixes.map(row => ({ kind: 'prefix', id: row.id, label: row.label, value: row.prefix }));
    for (const command of commands) {
        const settingKey = getCommandPrefixSettingKey(command.id);
        if (settingKey && rows.some(row => row.type === 'action' && row.category === settingKey))
            continue;
        if (normalizeStoredShortcutTrigger(String(command.prefix || '')) !== normalized)
            continue;
        return { status: 'error', value: normalized, message: 'The text command "' + normalized + '" is reserved by ' + (command.label || command.id) + '. Choose a different shortcut.' };
    }
    for (const assignment of records) {
        if (assignment.userId !== userId || normalizeStoredShortcutTrigger(assignment.trigger) !== normalized
            || assignment.referenceId === currentReferenceId)
            continue;
        if (assignment.referenceType === 'command' || assignment.referenceType === 'module') {
            return { status: 'error', value: normalized, message: 'This Text Command belongs to a system command and cannot be overwritten or shared.' };
        }
        owners.push({ kind: 'shortcut', id: assignment.id, label: resolveLabels ? await ownerLabel(assignment.referenceId, assignment.referenceType) : assignment.referenceId,
            referenceId: assignment.referenceId, referenceType: assignment.referenceType, value: normalized });
    }
    if (!owners.length)
        return { status: 'available', value: normalized };
    const canShare = owners.every(owner => owner.kind === 'shortcut' && owner.referenceType !== 'command');
    const labels = owners.map(owner => '"' + owner.label + '"').join(', ');
    return { status: 'conflict', value: normalized,
        message: 'Text command "' + normalized + '" is already assigned to ' + labels + '.' + (canShare ? '' : ' Overwrite releases the existing trigger; it cannot be shared.'),
        conflict: { ...owners[0], owners, canShare } };
}
export async function checkPrefixShortcutAssignment(value: string, type: string, category: string): Promise<ShortcutAssignmentCheck> {
    const rows = await CommandTerminalPrefixStorage.getPrefixSettings();
    const target = rows.find(row => row.type === type && row.category === category);
    if (!target)
        return { status: 'error', value, message: 'This prefix is no longer available.' };
    const check = await checkFromSnapshot(value, undefined, DEFAULT_USER, rows, await getAllUserShortcuts(), await db.commands.toArray(), true, target.id);
    if (check.status === 'conflict')
        check.conflict.canShare = false;
    return check;
}
/** Prefix editors share the same owner approval, but never support Add. */
export async function updatePrefixShortcutAssignment(id: string, value: string, expectedValue: string, approval?: ShortcutOverwriteApproval): Promise<PrefixSettingRecord> {
    await CommandTerminalPrefixStorage.getPrefixSettings();
    const saved = await db.transaction('rw', [db.userShortcuts, db.commands, db.prefixSettings, ...mirrorTables().map(table => db.table(table))], async () => {
        const rows = await db.prefixSettings.toArray();
        const target = rows.find(row => row.id === id);
        if (!target || target.prefix !== expectedValue)
            throw new Error('This prefix changed. Reopen the editor to review it.');
        const check = await checkFromSnapshot(value, undefined, DEFAULT_USER, rows, await getAllUserShortcuts(), await db.commands.toArray(), false, id);
        if (check.status === 'error')
            throw new Error(check.message);
        if (check.status === 'conflict') {
            const owners = check.conflict.owners || [check.conflict];
            if (!approval || approval.mode === 'add' || !shortcutOwnersMatch(owners, approval.owners || [approval])) {
                throw new Error(check.message + ' Review and approve Overwrite again.');
            }
            for (const owner of owners) {
                if (owner.kind === 'shortcut') {
                    await db.userShortcuts.delete(owner.id);
                    await syncMirror(owner.referenceId!, owner.referenceType!, '');
                }
                else if (owner.kind === 'prefix')
                    await db.prefixSettings.update(owner.id, { enabled: false, releasedTextCommandPrefix: true, updatedAt: Date.now() });
            }
        }
        const updated = { ...target, prefix: normalizeShortcutTrigger(value), enabled: true, releasedTextCommandPrefix: false, updatedAt: Date.now() };
        await validateUniquePrefixSettings(updated);
        await db.prefixSettings.put(updated);
        return updated;
    });
    notifyShortcutAssignmentChanged();
    return saved;
}
export async function checkShortcutAssignment(value: string, currentReferenceId?: string, userId = DEFAULT_USER): Promise<ShortcutAssignmentCheck> {
    const rows = await CommandTerminalPrefixStorage.getPrefixSettings();
    const normalizedUserId = userId.trim() || DEFAULT_USER;
    const [records, commands] = await Promise.all([db.userShortcuts.where('userId').equals(normalizedUserId).toArray(), db.commands.toArray()]);
    const current = records.find(record => currentReferenceId && (record.referenceId === currentReferenceId
        || extractSnippetIdFromCompoundId(record.referenceId) === extractSnippetIdFromCompoundId(currentReferenceId)));
    const check = await checkFromSnapshot(value, current?.referenceId || currentReferenceId, normalizedUserId, rows, records, commands);
    if (check.status === 'conflict' && (current?.referenceType === 'command' || current?.referenceType === 'module'
        || commands.some(command => command.id === currentReferenceId)))
        check.conflict.canShare = false;
    if (check.status === 'conflict' && check.conflict.canShare && current
        && normalizeStoredShortcutTrigger(current.trigger) === normalizeShortcutTrigger(value))
        return { status: 'available', value: check.value };
    return check;
}
/** Resolve existing editor/board/sheet identities without guessing from a title. */
export async function resolveShortcutItem(referenceId: string): Promise<{
    referenceId: string;
    referenceType: ShortcutReferenceType;
}> {
    if (await db.collections.get(referenceId)) {
        await requireWebCollectionAssignmentTarget(referenceId);
        return { referenceId, referenceType: 'webCollection' };
    }
    const rawId = extractSnippetIdFromCompoundId(referenceId);
    const existing = (await getAllUserShortcuts()).find(record => record.referenceId === referenceId || extractSnippetIdFromCompoundId(record.referenceId) === rawId);
    if (existing)
        return { referenceId: existing.referenceId, referenceType: existing.referenceType };
    const tables: [
        string,
        ShortcutReferenceType
    ][] = [['notes', 'note'], ['links', 'link'], ['snippets', 'snippet'], ['todos', 'todo'], ['aiPrompts', 'aiPrompt'], ['chatAgents', 'agent']];
    tables.push(['workspaces', 'collection']);
    for (const [table, referenceType] of tables) {
        if (await db.table(table).get(rawId))
            return { referenceId, referenceType };
    }
    if (/^\d+$/.test(rawId) && typeof chrome !== 'undefined' && chrome.bookmarks) {
        const bookmarks = await chrome.bookmarks.get(rawId);
        if (bookmarks.length)
            return { referenceId, referenceType: 'bookmark' };
    }
    throw new Error('This item is not saved yet or is no longer available.');
}
export type ShortcutOverwriteApproval = ShortcutAssignmentApproval;
const mirrorTables = () => ['notes', 'links', 'snippets', 'todos', 'aiPrompts', 'chatAgents'];
async function syncMirror(referenceId: string, type: string, value: string) {
    if (['session', 'collection', 'workspace'].includes(type)) return;
    const tableName: Record<string, string> = { note: 'notes', link: 'links', snippet: 'snippets', todo: 'todos', aiPrompt: 'aiPrompts', prompt: 'aiPrompts', agent: 'chatAgents', session: 'workspaces', collection: 'workspaces', workspace: 'workspaces' };
    const table = tableName[type];
    if (!table)
        return;
    const rawId = extractSnippetIdFromCompoundId(referenceId);
    const record = await db.table(table).get(rawId) || await db.table(table).get(referenceId);
    if (record)
        await db.table(table).update(record.id, { shortcut: value });
}
/** Atomic assign/share/transfer. Only explicit approval removes other owners. */
export async function saveUserShortcutGuarded(trigger: string, referenceId: string, referenceType: ShortcutReferenceType, approval?: ShortcutOverwriteApproval, userId = DEFAULT_USER): Promise<UserShortcutRecord | null> {
    await CommandTerminalPrefixStorage.getPrefixSettings();
    const normalized = normalizeShortcutTrigger(trigger);
    const normalizedUserId = userId.trim() || DEFAULT_USER;
    const saved = await db.transaction('rw', [db.userShortcuts, db.commands, db.prefixSettings, ...mirrorTables().map(table => db.table(table)), ...(referenceType === 'webCollection' ? [db.collections, db.organisations] : [])], async () => {
        if (referenceType === 'webCollection') await requireWebCollectionAssignmentTarget(referenceId);
        const records = await db.userShortcuts.where('userId').equals(normalizedUserId).toArray();
        const existingReferences = records.filter(record => record.referenceId === referenceId);
        if (!normalized) {
            await db.userShortcuts.bulkDelete(existingReferences.map(record => record.id));
            await syncMirror(referenceId, referenceType, '');
            return null;
        }
        const rows = await db.prefixSettings.toArray();
        const check = await checkFromSnapshot(trigger, referenceId, normalizedUserId, rows, records, await db.commands.toArray(), false);
        if (check.status === 'error')
            throw new Error(check.message);
        const ownsAlready = existingReferences.some(record => normalizeStoredShortcutTrigger(record.trigger) === normalized);
        if (check.status === 'conflict') {
            const owners = check.conflict.owners || [check.conflict];
            if (!(ownsAlready && !approval && check.conflict.canShare)) {
                if (!approval || !shortcutOwnersMatch(owners, approval.owners || [approval])) {
                    throw new Error(check.message + ' Review the current owners and choose Assign to this item too or Overwrite again.');
                }
                if (approval.mode === 'add' && (!check.conflict.canShare || referenceType === 'command' || referenceType === 'module'))
                    throw new Error('Prefix, action, and system commands cannot be shared.');
                if (approval.mode !== 'add') {
                    for (const owner of owners) {
                        if (owner.kind === 'shortcut') {
                            await db.userShortcuts.delete(owner.id);
                            await syncMirror(owner.referenceId!, owner.referenceType!, '');
                        }
                        else if (owner.kind === 'prefix') {
                            await db.prefixSettings.update(owner.id, { enabled: false, releasedTextCommandPrefix: true, updatedAt: Date.now() });
                        }
                        else
                            throw new Error('System commands cannot be overwritten.');
                    }
                }
            }
        }
        const original = existingReferences[0];
        const record: UserShortcutRecord = { id: original?.id || generateEntityId('shortcut'), userId: normalizedUserId,
            trigger: normalized, referenceId, referenceType, updatedAt: Date.now() };
        await db.userShortcuts.put(record);
        await db.userShortcuts.bulkDelete(existingReferences.filter(previous => previous.id !== record.id).map(previous => previous.id));
        await syncMirror(referenceId, referenceType, normalized);
        return record;
    });
    notifyShortcutAssignmentChanged();
    return saved;
}
function notifyShortcutAssignmentChanged() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        void chrome.runtime.sendMessage({ action: 'INVALIDATE_SHORTCUTS_CACHE' }).catch(() => undefined);
        void chrome.runtime.sendMessage({ action: 'INVALIDATE_OMNIBOX_CACHE' }).catch(() => undefined);
    }
    // Background writes cannot rely on sending a message back to their own frame.
    if (typeof chrome !== 'undefined' && chrome.tabs?.query && chrome.tabs?.sendMessage) {
        void chrome.tabs.query({}).then(tabs => Promise.all(tabs.flatMap(tab => tab.id === undefined ? [] :
            ['userShortcuts', 'shortcutsMap', 'prefixSettings', ...mirrorTables()].map(table => chrome.tabs.sendMessage(tab.id!, { action: 'db_changed', table }).catch(() => undefined))))).catch(() => undefined);
    }
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event('commandTerminalPrefixesChanged'));
}
export async function saveUserShortcut(trigger: string, referenceId: string, referenceType: ShortcutReferenceType, userId = DEFAULT_USER): Promise<UserShortcutRecord> {
    const record = await saveUserShortcutGuarded(trigger, referenceId, referenceType, undefined, userId);
    if (!record)
        throw new Error('Shortcut trigger cannot be empty.');
    return record;
}
export async function getUserShortcutsByTrigger(trigger: string, userId = DEFAULT_USER): Promise<UserShortcutRecord[]> {
    const normalized = normalizeStoredShortcutTrigger(trigger);
    return (await getAllUserShortcuts(userId)).filter(record => normalizeStoredShortcutTrigger(record.trigger) === normalized);
}
/** A singular reader must not silently choose a shared owner. */
export async function getUserShortcutByTrigger(trigger: string, userId = DEFAULT_USER): Promise<UserShortcutRecord | undefined> {
    const records = await getUserShortcutsByTrigger(trigger, userId);
    return records.length === 1 ? records[0] : undefined;
}
export async function getUserShortcutByReference(referenceId: string, userId = DEFAULT_USER): Promise<UserShortcutRecord | undefined> {
    return db.userShortcuts.where('referenceId').equals(referenceId).and(record => record.userId === (userId.trim() || DEFAULT_USER)).first();
}
export async function deleteUserShortcut(id: string): Promise<void> {
    const record = await db.userShortcuts.get(id);
    if (record)
        await deleteUserShortcutByReference(record.referenceId, record.userId);
}
export async function deleteUserShortcutByReference(referenceId: string, userId = DEFAULT_USER): Promise<void> {
    const existing = await getUserShortcutByReference(referenceId, userId);
    if (existing)
        await saveUserShortcutGuarded('', referenceId, existing.referenceType, undefined, userId);
}
export async function getAllUserShortcuts(userId = DEFAULT_USER): Promise<UserShortcutRecord[]> {
    return db.userShortcuts.where('userId').equals(userId.trim() || DEFAULT_USER).toArray();
}
