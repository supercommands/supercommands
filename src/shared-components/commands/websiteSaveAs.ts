/**
 * Shared identity registry for the website popup's Save As section.
 *
 * Destination availability and configured command text remain owned by prefix
 * settings. This registry owns the stable legacy IDs, display order, and
 * destination category used by popup and command launch adapters.
 */
import type { PrefixSettingCategory } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export type WebsiteSaveAsId = 'add_to_existing' | 'save_link' | 'todo_chain_save' | 'save_note' | 'save_snippet';
export type WebsiteSaveAsDefinition = {
    id: WebsiteSaveAsId;
    fallbackLabel: string;
    destinationCategory: Extract<PrefixSettingCategory, 'collection' | 'link' | 'todo' | 'note' | 'snippet'>;
};
export const WEBSITE_SAVE_AS_DEFINITIONS: readonly WebsiteSaveAsDefinition[] = [
    { id: 'add_to_existing', fallbackLabel: 'Existing Workspace Session', destinationCategory: 'collection' },
    { id: 'save_link', fallbackLabel: 'Existing Link', destinationCategory: 'link' },
    { id: 'todo_chain_save', fallbackLabel: 'Existing Todo', destinationCategory: 'todo' },
    { id: 'save_note', fallbackLabel: 'Existing Note', destinationCategory: 'note' },
    { id: 'save_snippet', fallbackLabel: 'Existing Text Expander', destinationCategory: 'snippet' }
];
