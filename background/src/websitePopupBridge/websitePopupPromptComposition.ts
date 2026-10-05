/** Composition adapter over the existing tab scraper and shared prompt formatter. */
import { executeScrapeScript } from '../all_PreBuilt_Commands/extraction/textExtractor';
import { getAiPromptExecutionText } from '../../../src/allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import { enrichTemporaryPromptWithTabs, type TemporaryPromptComposition, type TemporaryPromptTabAttachment,
  type ScrapedPromptTab } from '../../../src/shared-components/aiPromptComposer/temporaryPromptComposition';

export async function composeWebsitePopupAgentPrompt(basePrompt: string, composition: TemporaryPromptComposition): Promise<string> {
  const attachments: TemporaryPromptTabAttachment[] = [];
  const unavailable = new Map<number, ScrapedPromptTab>();
  // Metadata comes from live tabs, not caller-supplied titles or URLs. Never select a default tab.
  for (const tabId of new Set(composition.attachedTabIds)) {
    let tab: chrome.tabs.Tab | undefined;
    try { tab = await chrome.tabs.get(tabId); }
    catch { unavailable.set(tabId, { ok: false, error: 'The selected tab is no longer available' }); }
    const url = tab?.url || '';
    if (tab && !/^https?:\/\//i.test(url)) {
      unavailable.set(tabId, { ok: false, error: 'The selected tab is not an accessible website' });
    }
    attachments.push({ id: `tab:${tabId}`, tabId, title: tab?.title || url || `Tab ${tabId}`, url,
      windowId: tab?.windowId ?? -1, index: tab?.index ?? -1, active: Boolean(tab?.active) });
  }
  const temporaryText = await enrichTemporaryPromptWithTabs(composition.temporaryPrompt, attachments, tabId => {
    const failure = unavailable.get(tabId);
    if (failure) return Promise.resolve(failure);
    return new Promise<ScrapedPromptTab>(resolve => executeScrapeScript(tabId, response => {
      resolve(response || { ok: false, error: 'No scrape response' });
    }));
  });
  const prompt = getAiPromptExecutionText({ prompt: basePrompt }, temporaryText);
  if (!prompt) throw new Error('Enter a prompt or attach a tab before sending.');
  return prompt;
}
