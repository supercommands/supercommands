/** Read-only saved metadata, resolved through the existing reactive New Tab store. */
import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { useDbStore } from '../../../../../storage/store/useDbStore';

export default function CollectionItemTags({ item }: { item: CollectionItemRecord }) {
    const tags = useDbStore(state => state.tags);
    const workspaces = useDbStore(state => state.workspaces);
    const workspaceIds = new Set(workspaces.filter(workspace => workspace.organisationId === item.organisationId)
        .map(workspace => workspace.id));
    const byId = new Map(tags.filter(tag => tag.workspaceId == null || workspaceIds.has(tag.workspaceId))
        .map(tag => [tag.id, tag]));
    const names = [...new Set(item.tagIds || [])].flatMap(id => {
        const tag = byId.get(id);
        return tag ? [tag.name] : [];
    });
    if (!names.length) return null;
    const label = `Tags: ${names.join(', ')}`;
    return <span className="block truncate text-xs font-normal text-[var(--color-textMuted)]" title={label}>{label}</span>;
}
