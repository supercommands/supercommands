import type { WebScrapingBlock } from '../../../../../allObjectFolder/src/createObject/collections/webScrapingTypes';
import { validateWebScrapingData } from '../../../../../allObjectFolder/src/createObject/collections/webScrapingValidation';
import { webScrapingTextPreview } from '../../../../../shared-components/pageExtraction/webScraping/webScrapingTextPreview';

export interface WebScrapingCardPreview {
    assetIds: string[];
    excerpt: string;
}

/** Preserve the visual order of image blocks, including nested lists and tables. */
const imageIdsInOrder = (blocks: WebScrapingBlock[]): string[] => {
    const imageIds: string[] = [];
    for (const block of blocks) {
        if (block.type === 'image') imageIds.push(block.imageId);
        else if (block.type === 'quote') imageIds.push(...imageIdsInOrder(block.blocks));
        else if (block.type === 'list') for (const item of block.items) imageIds.push(...imageIdsInOrder(item));
        else if (block.type === 'table') for (const row of block.rows) for (const cell of row) imageIds.push(...imageIdsInOrder(cell));
    }
    return imageIds;
};

export const getWebScrapingCardPreview = (value: unknown): WebScrapingCardPreview => {
    try {
        const data = validateWebScrapingData(value);
        const assetsByImageId = new Map(data.images.map(image => [image.id, image.assetId]));
        const assetIds = [...new Set(imageIdsInOrder(data.blocks).map(id => assetsByImageId.get(id)).filter((id): id is string => Boolean(id)))].slice(0, 4);
        return {
            assetIds,
            excerpt: webScrapingTextPreview(data.blocks).replace(/\[Image\]/g, '').trim(),
        };
    } catch {
        return { assetIds: [], excerpt: 'Preview unavailable' };
    }
};
