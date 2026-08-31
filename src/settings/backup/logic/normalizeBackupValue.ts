import { getBackupSchemaDescriptor } from './schemaComparisonRegistry';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeBackupValue(value: unknown, path = '', tableName?: string): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;

  const descriptor = tableName ? getBackupSchemaDescriptor(tableName) : undefined;
  const ignoredFields = new Set(descriptor?.ignoredFields || []);
  const unorderedArrayFields = new Set(descriptor?.unorderedArrayFields || []);

  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => normalizeBackupValue(item, `${path}[${index}]`, tableName));
    const fieldName = path.split('.').pop() || '';
    return unorderedArrayFields.has(fieldName)
      ? [...normalized].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : normalized;
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .filter(key => !(path === '' && descriptor?.comparisonFields && !descriptor.comparisonFields.includes(key)))
      .filter(key => !ignoredFields.has(key))
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeBackupValue(value[key], path ? `${path}.${key}` : key, tableName);
        return result;
      }, {});
  }

  return value;
}

export function backupValuesAreEqual(left: unknown, right: unknown, tableName?: string): boolean {
  return JSON.stringify(normalizeBackupValue(left, '', tableName)) === JSON.stringify(normalizeBackupValue(right, '', tableName));
}
