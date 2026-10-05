/**
 * @file contextMenus.ts
 * @description Registers and handles right-click context menus for AI Chat injection.
 */
import { tabPromptQueues, processTabQueue } from './runtimeExecutionEngine';
import { BRAND } from '../../../src/shared-components/brandingConfig';

const CONTEXT_MENU_PARENT_ID = BRAND.contextMenuId;
const CONTEXT_MENU_AI_OPTIONS = [
  { id: 'gpt', label: 'ChatGPT', kind: 'chatgpt', url: 'https://chatgpt.com/' },
  { id: 'perplexity', label: 'Perplexity', kind: 'perplexity', url: 'https://www.perplexity.ai/search' },
  { id: 'claude', label: 'Claude', kind: 'claude', url: 'https://claude.ai/new' },
  { id: 'all_ai', label: 'All AI', kind: 'ai' },
];

/**
 * Registers the right-click context menu options for sending selected text
 * directly to AI platforms (ChatGPT, Perplexity, Claude, or All).
 */
export function setupContextMenus() {
  if (!chrome.contextMenus) return;

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_PARENT_ID,
      title: BRAND.contextMenuTitle,
      contexts: ['selection'],
    });

    CONTEXT_MENU_AI_OPTIONS.forEach(opt => {
      chrome.contextMenus.create({
        id: `ask_${opt.id}`,
        parentId: CONTEXT_MENU_PARENT_ID,
        title: opt.label,
        contexts: ['selection'],
      });
    });
  });
}

/**
 * Attaches click event listeners to the context menu options.
 * When a user selects text and clicks an AI option, this opens the corresponding
 * platform in a new tab and adds the selected text to that tab's auto-submit queue.
 */
export function attachContextMenuListeners() {
  chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
    const selectionText = info.selectionText;
    if (!selectionText || !info.menuItemId.toString().startsWith('ask_')) return;

    const id = info.menuItemId.toString().replace('ask_', '');

    if (id === 'all_ai') {
      const { selectedAIs } = await chrome.storage.local.get(['selectedAIs']);
      // Fallback to these 3 if none selected – user requested these specifically
      const activeAIs =
        selectedAIs && Array.isArray(selectedAIs) && selectedAIs.length > 0
          ? selectedAIs
          : ['gpt', 'perplexity', 'claude'];

      activeAIs.forEach((aiId: string, index: number) => {
        const opt = CONTEXT_MENU_AI_OPTIONS.find(o => o.id === aiId);
        if (opt && opt.url) {
          chrome.tabs.create({ url: opt.url, active: index === 0 }, AltS_search_newtab => {
            if (AltS_search_newtab?.id) {
              const q = tabPromptQueues.get(AltS_search_newtab.id) || [];
              q.push({
                kind: opt.kind as any,
                prompt: selectionText,
              });
              tabPromptQueues.set(AltS_search_newtab.id, q);

              if (AltS_search_newtab.status === 'complete') {
                processTabQueue(AltS_search_newtab.id);
              }
            }
          });
        }
      });
    } else {
      const opt = CONTEXT_MENU_AI_OPTIONS.find(o => o.id === id);
      if (opt && opt.url) {
        chrome.tabs.create({ url: opt.url, active: true }, AltS_search_newtab => {
          if (AltS_search_newtab?.id) {
            const q = tabPromptQueues.get(AltS_search_newtab.id) || [];
            q.push({
              kind: opt.kind as any,
              prompt: selectionText,
            });
            tabPromptQueues.set(AltS_search_newtab.id, q);

            if (AltS_search_newtab.status === 'complete') {
              processTabQueue(AltS_search_newtab.id);
            }
          }
        });
      }
    }
  });
}
