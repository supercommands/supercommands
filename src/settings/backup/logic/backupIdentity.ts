import { getBackupSchemaDescriptor } from './schemaComparisonRegistry';

function readPath(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, record);
}

export function getBackupRecordIdentity(tableName: string, record: Record<string, unknown>): string {
  const primaryKey = getBackupSchemaDescriptor(tableName).primaryKey;
  const keyParts = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  const values = keyParts.map(key => readPath(record, key));

  if (values.some(value => value === undefined || value === null)) {
    throw new Error(`Backup record in ${tableName} is missing its primary key`);
  }

  return JSON.stringify(values.length === 1 ? values[0] : values);
}
