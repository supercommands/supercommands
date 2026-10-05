/** Shared ownership contract. Keep this module free of database/UI dependencies. */
export type ShortcutOwner = {
    kind: 'shortcut' | 'command' | 'prefix';
    id: string;
    label: string;
    referenceId?: string;
    referenceType?: string;
    value?: string;
};
export type ShortcutAssignmentApproval = ShortcutOwner & {
    owners?: ShortcutOwner[];
    canShare?: boolean;
    mode?: 'add' | 'overwrite';
};
export type ShortcutAssignmentCheck = {
    status: 'available';
    value: string;
} | {
    status: 'conflict';
    value: string;
    message: string;
    conflict: ShortcutAssignmentApproval;
} | {
    status: 'error';
    value: string;
    message: string;
};
export function shortcutOwnersMatch(current: ShortcutOwner[], approved: ShortcutOwner[]): boolean {
    const key = (owner: ShortcutOwner) => JSON.stringify([
        owner.kind, owner.id, owner.referenceId || '', owner.referenceType || '', owner.value || ''
    ]);
    const expected = new Set(approved.map(key));
    return current.length === expected.size && current.every(owner => expected.has(key(owner)));
}
