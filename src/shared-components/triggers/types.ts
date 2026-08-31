export type AssignedTriggerKind = 'user_hotkey' | 'user_shortcut';

export type TriggerSource = 'hotkey' | 'direct_search' | 'command_space' | 'omnibox' | 'website_popup';

export type TriggerSurface = 'newtab' | 'main_search' | 'omnibox' | 'website_popup' | 'content_script' | 'background';

export type TriggerReferenceType =
  | 'note'
  | 'link'
  | 'snippet'
  | 'collection'
  | 'command'
  | 'automation'
  | 'module'
  | 'todo'
  | 'aiPrompt'
  | string;

export interface TriggerDailySummaryRecord {
  id: string;
  dateKey: string;
  userId: string;
  shortcutUses: number;
  hotkeyUses: number;
  successCount: number;
  failureCount: number;
  uniqueTargets: number;
  targetIds: string[];
  firstUsedAt: number;
  lastUsedAt: number;
  updatedAt: number;
}

export const TRIGGER_DAILY_SUMMARY_COMPARISON_FIELDS = ['id', 'dateKey', 'userId', 'shortcutUses', 'hotkeyUses', 'successCount', 'failureCount', 'uniqueTargets', 'targetIds', 'firstUsedAt', 'lastUsedAt'] as const satisfies readonly (keyof TriggerDailySummaryRecord)[];

export interface TriggerDailyBreakdownRecord {
  id: string;
  dateKey: string;
  userId: string;
  triggerKind: AssignedTriggerKind;
  triggerValue: string;
  triggerSource: TriggerSource;
  referenceId: string;
  referenceType: TriggerReferenceType;
  targetLabelSnapshot: string;
  triggerLabelSnapshot: string;
  surface: TriggerSurface;
  urlHost: string;
  successCount: number;
  failureCount: number;
  lastErrorCode?: string;
  firstUsedAt: number;
  lastUsedAt: number;
  updatedAt: number;
}

export const TRIGGER_DAILY_BREAKDOWN_COMPARISON_FIELDS = ['id', 'dateKey', 'userId', 'triggerKind', 'triggerValue', 'triggerSource', 'referenceId', 'referenceType', 'targetLabelSnapshot', 'triggerLabelSnapshot', 'surface', 'urlHost', 'successCount', 'lastErrorCode', 'firstUsedAt', 'lastUsedAt'] as const satisfies readonly (keyof TriggerDailyBreakdownRecord)[];

export interface RecordAssignedTriggerUsageInput {
  triggerKind: AssignedTriggerKind;
  triggerValue: string;
  triggerSource: TriggerSource;
  referenceId: string;
  referenceType: TriggerReferenceType;
  surface: TriggerSurface;
  success?: boolean;
  errorCode?: string;
  url?: string;
  urlHost?: string;
  userId?: string;
  targetLabelSnapshot?: string;
  triggerLabelSnapshot?: string;
  timestamp?: number;
  correlationId?: string;
}

export interface DailyUsageGridItem {
  date: string;
  total: number;
  hotkeyCount: number;
  textShortcutCount: number;
  failureCount: number;
  uniqueTargets: number;
}

export interface DayUsageDetails {
  dateKey: string;
  totalUses: number;
  hotkeyUses: number;
  shortcutUses: number;
  failureCount: number;
  rows: TriggerDailyBreakdownRecord[];
}
