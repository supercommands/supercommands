export type PrefixSettingCategory =
  | 'note'
  | 'link'
  | 'collection'
  | 'todo'
  | 'bookmark'
  | 'command'
  | 'system_command'
  | 'snippet'
  | 'agent'
  | 'prompt';

export type PrefixSettingAction =
  | 'capture_screenshot'
  | 'capture_clip_screenshot'
  | 'capture_full_screenshot'
  | 'capture_element_screenshot'
  | 'downloadallimages'
  | 'downloadalltables'
  | 'save_link'
  | 'save_todo'
  | 'save_note'
  | 'save_snippet'
  | 'save_chat'
  | 'add_to_existing'
  | 'send_to_agent'
  | 'summarize_page'
  | 'merge_windows'
  | 'close_duplicate_tabs'
  | 'mute_all_tabs'
  | 'unmute_all_tabs';

export type PrefixSettingSubcommand =
  | 'field_title'
  | 'field_description'
  | 'field_tag'
  | 'field_time'
  | 'field_recurring'
  | 'field_reference';

export type PrefixSettingKey = PrefixSettingCategory | PrefixSettingAction | PrefixSettingSubcommand;

export type PrefixSettingType = 'category' | 'action' | 'subcommand';

export interface PrefixSettingRecord {
  id: string;
  type: PrefixSettingType;
  category: PrefixSettingKey;
  label: string;
  prefix: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export const PREFIX_SETTING_COMPARISON_FIELDS = [] as const satisfies readonly (keyof PrefixSettingRecord)[];

export type CreatePrefixSettingInput = Omit<PrefixSettingRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdatePrefixSettingInput = Partial<
  Pick<
    PrefixSettingRecord,
    | 'label'
    | 'prefix'
    | 'enabled'
  >
>;
