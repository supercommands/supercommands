export const AI_GROUP = {
  id: 'ai',
  label: 'All AI Chat Agents',
  prefix: 'ai',
  members: ['gpt', 'claude', 'gemini', 'perplexity'],
};

export const DEFAULT_SELECTED_AIS: string[] = ['gpt', 'claude', 'gemini', 'perplexity'];

export const THIS_SECTION_ACTION_PREFIXES: Record<string, string> = {
  capture_screenshot: 'cs',
  capture_full_screenshot: 'cfp',
  downloadallimages: 'dai',
  downloadalltables: 'dat',
  save_link: 'clc',
  save_session: 'tss',
  save_chat: 'stc',
  add_to_existing: 'elc',
  add_to_existing_session: 'es',
  summarize_page: 'smm',
};
