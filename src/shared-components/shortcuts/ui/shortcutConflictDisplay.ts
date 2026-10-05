import type { ShortcutAssignmentApproval } from '../core/shortcutAssignmentTypes';

const ownerTypeLabels: Record<string, string> = {
    note: 'Note', link: 'Link', snippet: 'Text Expander', todo: 'Todo',
    aiPrompt: 'Chat Agent', prompt: 'Chat Agent', agent: 'Chat Agent',
    collection: 'Collection', workspace: 'Workspace', session: 'Session',
};

export function getShortcutConflictOwnerRows(approval: ShortcutAssignmentApproval) {
    const owners = approval.owners?.length ? approval.owners : [approval];
    const groups = new Map<string, { label: string; type: string; count: number }>();
    for (const owner of owners) {
        const type = owner.kind === 'prefix' ? 'Command prefix' : ownerTypeLabels[owner.referenceType || ''] || '';
        const key = `${owner.label}\u0000${type}`;
        const group = groups.get(key);
        if (group) group.count += 1;
        else groups.set(key, { label: owner.label, type, count: 1 });
    }
    return { count: owners.length, rows: Array.from(groups.values()) };
}
