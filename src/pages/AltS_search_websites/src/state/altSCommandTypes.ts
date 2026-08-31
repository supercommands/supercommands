export type CompactSubcommandMode =
  | 'none'
  | 'existing_collection'
  | 'send_to_agent'
  | 'save_link'
  | 'save_todo'
  | 'save_note'
  | 'save_snippet'
  | 'save_chat'
  | 'category_note'
  | 'category_link'
  | 'category_snippet'
  | 'category_todo'
  | 'category_bookmark'
  | 'category_collection'
  | 'category_prompt'
  | 'category_command';

export type AltSPageTarget = {
  url: string;
  title: string;
};

export type AltSOverlayMode = 'none' | 'create_link' | 'create_todo' | 'create_note' | 'create_snippet' | 'create_ai_prompt';

export type CategorySubcommandItem = {
  item: any;
  suggestion?: any;
  originalIndex: number;
};
