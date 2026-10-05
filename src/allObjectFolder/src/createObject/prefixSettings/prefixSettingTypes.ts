export type PrefixSettingCategory = 'note' | 'link' | 'collection' | 'todo' | 'bookmark' | 'command' | 'system_command' | 'snippet' | 'agent' | 'prompt' | 'collection_capture';
export type PrefixSettingAction = 'collection_link' | 'collection_article' | 'collection_screenshot' | 'collection_web_scraping' | 'capture_screenshot' | 'capture_clip_screenshot' | 'capture_full_screenshot' | 'capture_element_screenshot' | 'downloadallimages' | 'downloadalltables' | 'save_note' | 'save_snippet' | 'save_chat' | 'send_to_agent' | 'summarize_page' | 'merge_windows' | 'close_duplicate_tabs' | 'mute_all_tabs' | 'unmute_all_tabs';
export type PrefixSettingSubcommand = 'chain_action_save' | 'chain_action_save_long' | 'chain_action_filter' | 'chain_action_filter_long' | 'chain_action_filter_alias_plain' | 'chain_action_favorite' | 'chain_action_favorite_long' | 'chain_action_favorite_alias_plain' | 'chain_action_unfavorite' | 'chain_action_unfavorite_long' | 'chain_action_unfavorite_alias_plain' | 'field_title' | 'field_title_long' | 'field_title_alias_name' | 'field_title_alias_plain' | 'field_description' | 'field_description_long' | 'field_description_alias_desc' | 'field_description_alias_body' | 'field_url' | 'field_url_long' | 'field_tag' | 'field_tag_plural' | 'field_hotkey' | 'field_hotkey_long' | 'field_shortcut' | 'field_shortcut_long' | 'field_time' | 'field_recurring' | 'field_recurring_long' | 'field_reference' | 'field_reference_attach' | 'field_reference_attachment' | 'field_reference_long';
export type PrefixSettingKey = PrefixSettingCategory | PrefixSettingAction | PrefixSettingSubcommand;
export type PrefixSettingType = 'category' | 'action' | 'subcommand';
export interface PrefixSettingRecord {
    id: string;
    type: PrefixSettingType;
    category: PrefixSettingKey;
    label: string;
    prefix: string;
    enabled: boolean;
    /** Explicitly released by Text Command overwrite; never resurrect a default trigger. */
    releasedTextCommandPrefix?: boolean;
    createdAt: number;
    updatedAt: number;
}
export const PREFIX_SETTING_COMPARISON_FIELDS = [] as const satisfies readonly (keyof PrefixSettingRecord)[];
export type CreatePrefixSettingInput = Omit<PrefixSettingRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    createdAt?: number;
    updatedAt?: number;
};
export type UpdatePrefixSettingInput = Partial<Pick<PrefixSettingRecord, 'label' | 'prefix' | 'enabled' | 'releasedTextCommandPrefix'>>;
