export const AI_GROUP = {
  id: 'ai',
  label: 'All AI Chat Agents',
  prefix: 'ai',
  members: ['gpt', 'claude', 'gemini', 'perplexity'],
};

export const DEFAULT_SELECTED_AIS: string[] = ['gpt', 'claude', 'gemini', 'perplexity'];

export const THIS_SECTION_ACTION_PREFIXES: Record<string, string> = {
  capture_screenshot: 'visiblescreen',
  capture_clip_screenshot: 'screen',
  capture_full_screenshot: 'fullscreen',
  downloadallimages: 'dp',
  downloadalltables: 'tables',
  save_link: 'ls',
  save_todo: 'td',
  save_note: 'cn',
  save_snippet: 'cs',
  save_chat: 'save_agent',
  add_to_existing: 'elc',
  send_to_agent: 'send_agent',
  summarize_page: 'summ',
};
