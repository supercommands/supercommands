/** popup display names only; entity IDs, prefixes and persisted record types stay stable. */
import { getShortcutCategoryLabel } from '../triggers/shortcutRuntime';
import { WEBSITE_COLLECTION_CAPTURE_CHOICES } from '../commands/websiteCollectionCommands';
const entityLabels: Record<string, string> = {
  note: 'Note', todo: 'Todo', link: 'Link shortcut', snippet: 'Text Expander',
  collection: 'Workspace Session', session: 'Workspace Session',
  prompt: 'AI Prompts',
  webCollection: 'Web Clips', collection_capture: 'Web Clips',
};
export function getWebsitePopupEntityLabel(entity: string, fallback?: string): string {
  return entityLabels[entity] || fallback || getShortcutCategoryLabel(entity);
}
export function getWebsitePopupClipLabel(type: string): string {
  return WEBSITE_COLLECTION_CAPTURE_CHOICES.find(choice => choice.type === type)?.displayLabel
    || type.charAt(0).toUpperCase() + type.slice(1);
}
