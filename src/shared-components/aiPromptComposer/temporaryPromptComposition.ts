import type { WebsitePopupOpenTabOption } from '../websitePopup/contracts/websitePopupCreateOptionsBridgeContract';

export type TemporaryPromptTabAttachment = WebsitePopupOpenTabOption;

/** Transport-ready input for a composed request; recipient and execution stay host-owned. */
export interface TemporaryPromptComposition {
  temporaryPrompt: string;
  attachedTabIds: number[];
}

export function isTemporaryPromptComposition(value: unknown): value is TemporaryPromptComposition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const draft = value as Partial<TemporaryPromptComposition>;
  return typeof draft.temporaryPrompt === 'string' && Array.isArray(draft.attachedTabIds)
    && draft.attachedTabIds.every(id => Number.isSafeInteger(id) && id > 0);
}

export interface ScrapedPromptTab {
  ok?: boolean;
  content?: string;
  url?: string;
  error?: string;
}

/** Same attachment text used by the existing New Tab runner, without browser dependencies. */
export function formatPromptTabContext(tab: TemporaryPromptTabAttachment, response: ScrapedPromptTab): string {
  const title = tab.title.trim() || tab.url;
  const resolvedUrl = response.url || tab.url;
  const content = response.ok && typeof response.content === 'string' ? response.content.trim() : '';
  const body = content || `[Content unavailable: ${response.error || 'The selected tab could not be read'}]`;
  return [`--- Attached Tab: "${title}" ---`, `URL: ${resolvedUrl}`, 'Content:', body, '--- End Attached Tab ---'].join('\n');
}

export async function enrichTemporaryPromptWithTabs(promptText: string, attachedTabs: TemporaryPromptTabAttachment[],
  readTab: (tabId: number) => Promise<ScrapedPromptTab>): Promise<string> {
  const prompt = promptText.trim();
  if (!attachedTabs.length) return prompt;
  const contexts: string[] = [];
  for (const tab of attachedTabs) {
    let response: ScrapedPromptTab;
    try { response = await readTab(tab.tabId); }
    catch (error) { response = { ok: false, error: error instanceof Error ? error.message : 'Unable to contact the selected tab' }; }
    contexts.push(formatPromptTabContext(tab, response));
  }
  const attachments = ['[Attached Tabs Context]', ...contexts, '[End Attached Tabs Context]'].join('\n\n');
  return prompt ? `${prompt}\n\n${attachments}` : attachments;
}

/** Calls the existing background scraper; no new scraping implementation. */
export function readPromptTabContext(tabId: number): Promise<ScrapedPromptTab> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'scrape_tab_by_id', tabId }, (result: ScrapedPromptTab | undefined) => {
      const runtimeError = chrome.runtime.lastError;
      resolve(runtimeError ? { ok: false, error: runtimeError.message }
        : result || { ok: false, error: 'No scrape response' });
    });
  });
}
