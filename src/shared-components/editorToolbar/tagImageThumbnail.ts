import { validateTagImageThumbnail } from '../../allObjectFolder/src/createObject/tags/tagAppearanceValidation';

/** Rasterize locally into a bounded, transparent thumbnail; the original is never stored. */
export async function createTagImageThumbnail(file: File): Promise<string> {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type))
        throw new Error('Choose a PNG, JPG, WebP, GIF, or AVIF image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
    const url = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.src = url;
        await image.decode().catch(() => { throw new Error('This image could not be read. Try another file.'); });
        const canvas = document.createElement('canvas');
        // Encoding resolution, not a UI/design token. Preserves aspect ratio without cropping.
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error('Could not prepare the image.');
        const scale = Math.min(64 / image.naturalWidth, 64 / image.naturalHeight, 1);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        context.drawImage(image, (64 - width) / 2, (64 - height) / 2, width, height);
        const value = canvas.toDataURL('image/png');
        validateTagImageThumbnail(value);
        return value;
    } finally {
        URL.revokeObjectURL(url);
    }
}
