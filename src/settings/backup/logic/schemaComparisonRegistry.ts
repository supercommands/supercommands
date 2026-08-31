import { BACKUP_TABLE_NAMES, type BackupTableName } from './backupRegistry';
import { db } from '../../../storage/indexDB/dbConfig';
import { WORKSPACE_COMPARISON_FIELDS } from '../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import { FOLDER_COMPARISON_FIELDS } from '../../../settings/allWorkspaceManager/folders/folderTypes';
import { NOTE_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/notes/noteTypes';
import { LINK_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/links/linkTypes';
import { SESSION_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/session/sessionTypes';
import { SNIPPET_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { TODO_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/todos/todoTypes';
import { AI_PROMPT_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { AUTOMATION_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/automationBeta/automationTypes';
import { CHAT_AGENT_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import { TAG_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/tags/tagTypes';
import { FAVORITE_CATEGORY_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/favoriteCategory/favoriteCategoryTypes';
import { HOTKEY_COMPARISON_FIELDS } from '../../../shared-components/hotkeys/core/hotkeyDbTypes';
import { SHORTCUT_COMPARISON_FIELDS } from '../../../shared-components/shortcuts/core/shortcutDbTypes';
import { FAVORITE_COMPARISON_FIELDS } from '../../../shared-components/favorites/favoriteTypes';
import { ASSET_COMPARISON_FIELDS } from '../../../storage/assets/assetTypes';
import { PREFIX_SETTING_COMPARISON_FIELDS } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import { ASSET_BLOB_BACKUP_FIELD, ASSET_FILE_BACKUP_FIELD } from './assetBackupPayload';

export interface BackupSchemaDescriptor {
  tableName: BackupTableName;
  primaryKey: string | string[];
  unorderedArrayFields?: readonly string[];
  textFields?: readonly string[];
  ignoredFields?: readonly string[];
  comparisonFields?: readonly string[];
  deletionField?: string;
}

const COMMON_IGNORED_FIELDS = ['createdAt', 'updatedAt', 'expectedUpdatedAt', 'versionHistory', '_kind'];

// Commands are regenerated from the bundled command catalog during startup.
// They remain part of the backup for completeness, but are not user-editable
// backup differences and should not create merge noise between app versions.
export const BACKUP_COMPARISON_EXCLUDED_TABLE_NAMES: BackupTableName[] = [
  'commands',
  'triggerDailySummary',
  'triggerDailyBreakdown',
];

const DESCRIPTORS: Partial<Record<BackupTableName, Omit<BackupSchemaDescriptor, 'tableName'>>> = {
  workspaces: { primaryKey: 'id', comparisonFields: WORKSPACE_COMPARISON_FIELDS, textFields: ['workspaceName'], ignoredFields: COMMON_IGNORED_FIELDS },
  folders: { primaryKey: 'id', comparisonFields: FOLDER_COMPARISON_FIELDS, textFields: ['folderName'], ignoredFields: COMMON_IGNORED_FIELDS },
  notes: { primaryKey: 'id', comparisonFields: NOTE_COMPARISON_FIELDS, textFields: ['title', 'body'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  links: { primaryKey: 'id', comparisonFields: LINK_COMPARISON_FIELDS, textFields: ['title'], unorderedArrayFields: ['urls', 'tagIds'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  snippets: { primaryKey: 'id', comparisonFields: SNIPPET_COMPARISON_FIELDS, textFields: ['title'], unorderedArrayFields: ['tagIds'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  todos: { primaryKey: 'id', comparisonFields: TODO_COMPARISON_FIELDS, textFields: ['name', 'description'], unorderedArrayFields: ['tagIds'], ignoredFields: COMMON_IGNORED_FIELDS },
  sessions: { primaryKey: 'id', comparisonFields: SESSION_COMPARISON_FIELDS, textFields: ['title', 'description'], unorderedArrayFields: ['urls'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  automations: { primaryKey: 'id', comparisonFields: AUTOMATION_COMPARISON_FIELDS, textFields: ['name'], unorderedArrayFields: ['tagIds'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  chatAgents: { primaryKey: 'id', comparisonFields: CHAT_AGENT_COMPARISON_FIELDS, textFields: ['title'], unorderedArrayFields: ['urls', 'tagIds'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  aiPrompts: { primaryKey: 'id', comparisonFields: AI_PROMPT_COMPARISON_FIELDS, textFields: ['title', 'prompt', 'rules'], unorderedArrayFields: ['tagIds', 'enabledModelIds'], ignoredFields: COMMON_IGNORED_FIELDS, deletionField: 'deletedAt' },
  tags: { primaryKey: 'id', comparisonFields: TAG_COMPARISON_FIELDS, textFields: ['name'], ignoredFields: COMMON_IGNORED_FIELDS },
  prefixSettings: { primaryKey: 'id', comparisonFields: PREFIX_SETTING_COMPARISON_FIELDS, ignoredFields: COMMON_IGNORED_FIELDS },
  favoriteCategories: { primaryKey: 'id', comparisonFields: FAVORITE_CATEGORY_COMPARISON_FIELDS, textFields: ['name'], unorderedArrayFields: ['filterTagIds'], ignoredFields: COMMON_IGNORED_FIELDS },
  userHotkeys: { primaryKey: 'id', comparisonFields: HOTKEY_COMPARISON_FIELDS, textFields: ['combination', 'referenceId'], ignoredFields: COMMON_IGNORED_FIELDS },
  userShortcuts: { primaryKey: 'id', comparisonFields: SHORTCUT_COMPARISON_FIELDS, textFields: ['trigger', 'referenceId'], ignoredFields: COMMON_IGNORED_FIELDS },
  favorites: { primaryKey: 'id', comparisonFields: FAVORITE_COMPARISON_FIELDS, textFields: ['label', 'referenceId'], ignoredFields: COMMON_IGNORED_FIELDS },
  assets: { primaryKey: 'id', comparisonFields: ASSET_COMPARISON_FIELDS, ignoredFields: [...COMMON_IGNORED_FIELDS, 'blob', ASSET_BLOB_BACKUP_FIELD, ASSET_FILE_BACKUP_FIELD] },
};

export const BACKUP_SCHEMA_DESCRIPTORS: Record<BackupTableName, BackupSchemaDescriptor> = Object.fromEntries(
  BACKUP_TABLE_NAMES.map(tableName => [
    tableName,
    { tableName, primaryKey: 'id', ignoredFields: COMMON_IGNORED_FIELDS, ...DESCRIPTORS[tableName] },
  ])
) as Record<BackupTableName, BackupSchemaDescriptor>;

export function getBackupSchemaDescriptor(tableName: string): BackupSchemaDescriptor {
  const descriptor = BACKUP_SCHEMA_DESCRIPTORS[tableName as BackupTableName];
  if (descriptor) return descriptor;

  const runtimeTable = db.tables.find(table => table.name === tableName);
  const runtimePrimaryKey = runtimeTable?.schema.primKey.keyPath;

  return {
    tableName: tableName as BackupTableName,
    primaryKey: (runtimePrimaryKey || 'id') as string | string[],
    ignoredFields: COMMON_IGNORED_FIELDS,
  };
}
