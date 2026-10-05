import type { TagAppearance } from './tagTypes';

export const TAG_COLOR_IDS = ['textMuted', 'success', 'warning', 'error'] as const;
export const TAG_ICON_IDS = ['tag', 'work', 'idea', 'research', 'book', 'code', 'bug', 'star', 'target', 'personal'] as const;
export const MAX_TAG_IMAGE_DATA_LENGTH = 48 * 1024;

/** Persisted appearances only. Inline images are deliberately unsupported. */
export function validateTagAppearance(value: unknown): TagAppearance {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Choose a valid tag color, icon, or saved image.');
    const appearance = value as Record<string, unknown>;
    const keys = Object.keys(appearance);
    const hasOnly = (field: string) => keys.length === 2 && keys.includes('kind') && keys.includes(field);
    if (appearance.kind === 'color' && hasOnly('value') && TAG_COLOR_IDS.some(id => id === appearance.value))
        return { kind: 'color', value: appearance.value as typeof TAG_COLOR_IDS[number] };
    if (appearance.kind === 'icon' && hasOnly('value') && TAG_ICON_IDS.some(id => id === appearance.value))
        return { kind: 'icon', value: appearance.value as typeof TAG_ICON_IDS[number] };
    if (appearance.kind === 'image' && hasOnly('assetId') && typeof appearance.assetId === 'string' &&
        /^asset_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(appearance.assetId))
        return { kind: 'image', assetId: appearance.assetId };
    throw new Error('Choose a valid tag color, icon, or saved image.');
}

/** Bounded transport/preview validation; this never produces a stored appearance. */
export function validateTagImageThumbnail(value: unknown): string {
    if (typeof value === 'string' && value.length <= MAX_TAG_IMAGE_DATA_LENGTH &&
        /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
    throw new Error('Choose a valid small PNG thumbnail.');
}
