import { validateOrganisationOwnership } from '../../../storage/migrations/organisationMigration';
import { validateWorkspaceTables } from '../../../storage/migrations/workspaceMigration';
import { validateWidgetOwnership } from '../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { validateCollectionBackupTables } from './collectionBackupValidation';
import { validateBackupTagImageReferences } from './tagAssetBackupValidation';

/** Shared graph checks for extraction, comparison, merge and restore; no database writes. */
export function validateBackupGraph(tables: Record<string, any[]>): void {
  validateBackupTagImageReferences(tables);
  validateOrganisationOwnership(tables);
  validateWorkspaceTables(tables);
  validateWidgetOwnership(tables);
  validateCollectionBackupTables(tables);
  const assetIds = new Set((tables.assets || []).map(record => record.id));
  for (const name of ['notes', 'snippets', 'todos']) {
    for (const record of tables[name] || []) {
      if (record.assetIds !== undefined && !Array.isArray(record.assetIds)) throw new Error(`Backup ${name} ${record.id}: invalid image references.`);
      const ids = new Set<string>(record.assetIds || []);
      for (const html of [record.body, record.config, record.description]) {
        if (typeof html === 'string') for (const match of html.matchAll(/data-local-asset-id=["']([^"']+)["']/g)) ids.add(match[1]);
      }
      for (const id of ids) if (!assetIds.has(id)) throw new Error(`Backup ${name} ${record.id}: missing image metadata ${id}.`);
    }
  }
}
