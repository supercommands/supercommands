import * as React from 'react';
import { FiGrid, FiTag, FiBriefcase, FiSearch, FiBookOpen, FiCode, FiStar, FiTarget, FiUser } from 'react-icons/fi';
import { LuLightbulb, LuBug } from 'react-icons/lu';
import type { TagRecord, TagAppearance as Appearance } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { validateTagAppearance } from '../../allObjectFolder/src/createObject/tags/tagAppearanceValidation';
import { useTagAsset } from './useTagAsset';

export const TAG_ICONS = [
    { id: 'tag', label: 'Tag', icon: FiTag }, { id: 'work', label: 'Work', icon: FiBriefcase },
    { id: 'idea', label: 'Idea', icon: LuLightbulb }, { id: 'research', label: 'Research', icon: FiSearch },
    { id: 'book', label: 'Learning', icon: FiBookOpen }, { id: 'code', label: 'Code', icon: FiCode },
    { id: 'bug', label: 'Bug', icon: LuBug }, { id: 'star', label: 'Favorite', icon: FiStar },
    { id: 'target', label: 'Goal', icon: FiTarget }, { id: 'personal', label: 'Personal', icon: FiUser },
] as const;
export const TAG_COLORS = [
    { id: 'textMuted', label: 'Gray' }, { id: 'success', label: 'Green' },
    { id: 'warning', label: 'Amber' }, { id: 'error', label: 'Red' },
] as const;
export const DEFAULT_TAG_APPEARANCE: Appearance = { kind: 'color', value: 'textMuted' };

function TagColorDot({color}: {color: string}) {
    return <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--color-${color})` }}/></span>;
}

function TagAssetImage({tagId, assetId}: {tagId: string; assetId: string}) {
    const image = useTagAsset(tagId, assetId);
    const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
    if (!image.url || failedUrl === image.url) return <TagColorDot color="textMuted"/>;
    return <img src={image.url} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" onError={() => setFailedUrl(image.url)}/>;
}

export function TagAppearance({ tag }: { tag: Pick<TagRecord, 'id' | 'workspaceId' | 'appearance'> }) {
    if (tag.workspaceId && !tag.appearance) return <FiGrid aria-hidden="true" size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>;
    let appearance = DEFAULT_TAG_APPEARANCE;
    try { if (tag.appearance) appearance = validateTagAppearance(tag.appearance); } catch { /* Legacy/import fallback. */ }
    if (appearance.kind === 'image') return <TagAssetImage tagId={tag.id} assetId={appearance.assetId}/>;
    if (appearance.kind === 'color') return <TagColorDot color={appearance.value}/>;
    const Icon = TAG_ICONS.find(icon => icon.id === appearance.value)?.icon || FiTag;
    return <Icon aria-hidden="true" size={14} className="shrink-0 text-[var(--color-iconDefault)]"/>;
}
