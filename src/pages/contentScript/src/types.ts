export interface NoteItem {
    id: string;
    key: string;
    value: string;
    plainText: string;
    preview: string;
    tags: string[];
    category?: string;
    config?: any;
    urls?: Array<{
        id?: string;
        title?: string;
        name?: string;
        url: string;
        favIconUrl?: string;
    }>;
}
export interface PopupPosition {
    x: number;
    y: number;
    caretHeight?: number;
}
export type SupportedInputElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
