export const TAG_IMAGE_READ_ACTION = 'api_read_tag_image';
export interface TagImageReadInput { tagId: string; assetId: string; }
export interface TagImageReadResult extends TagImageReadInput {
    base64: string;
    mimeType: 'image/png';
    byteSize: number;
}
export type TagImageReadResponse = { success: true; image: TagImageReadResult } | { success: false; error: string };
