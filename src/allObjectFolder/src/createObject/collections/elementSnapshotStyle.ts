import { ELEMENT_SNAPSHOT_STYLE_KEYS } from './elementSnapshotTypes';
const keys = new Set<string>(ELEMENT_SNAPSHOT_STYLE_KEYS);
/** Values cannot carry CSS rules or fetchable resources. Resource layers use explicit IDs. */
export function isElementSnapshotStyleValue(property: string, value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || !keys.has(property)
      || /[\\;{}<>@!\x00-\x1f\x7f]/.test(value) || /(?:url|image-set|var|env|attr|expression)\s*\(/i.test(value)) return false;
  return property === 'fontFamily' ? /^[\p{L}\p{M}\p{N}\s.,'"_-]+$/u.test(value) : /^[A-Za-z0-9\s.,%#()+/'"\[\]_-]+$/.test(value);
}
export function isElementSnapshotGradient(value: unknown): boolean {
  if (typeof value !== 'string' || !/^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(value)
      || !isElementSnapshotStyleValue('color', value) || /['"]/.test(value)) return false;
  let depth = 0;
  for (const char of value) { if (char === '(') depth++; else if (char === ')' && --depth < 0) return false; }
  return depth === 0 && value.endsWith(')');
}
