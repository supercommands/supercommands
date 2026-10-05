import { CollectionStorageError } from './collectionErrors';
import { collectionSourceUrl } from './collectionValidation';
import { ELEMENT_SNAPSHOT_LIMITS as limits, ELEMENT_SNAPSHOT_STYLE_KEYS, ELEMENT_SNAPSHOT_TAGS, ELEMENT_SNAPSHOT_ATTRIBUTES, type ElementSnapshotDraft, type ElementSnapshotRecord } from './elementSnapshotTypes';
import { isElementSnapshotStyleValue, isElementSnapshotGradient } from './elementSnapshotStyle';
import type { CollectionItemRecord } from './collectionTypes';

const fail = (message: string): never => { throw new CollectionStorageError('INVALID_INPUT', `Element snapshot: ${message}`); };
const tags = new Set(ELEMENT_SNAPSHOT_TAGS);
const attributes = new Set(ELEMENT_SNAPSHOT_ATTRIBUTES);
function object(value: unknown, keys: readonly string[]): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('expected a plain object.');
  const row = value as Record<string, any>;
  if (Object.keys(row).some(key => !keys.includes(key))) fail('unsupported field.');
  return row;
}
function text(value: unknown, max = 4096): string {
  if (typeof value !== 'string' || value.length > max) fail('invalid text.');
  return value as string;
}
function id(value: unknown): string {
  const result = text(value, 160);
  if (!/^[A-Za-z0-9_-]+$/.test(result)) fail('invalid identifier.');
  return result;
}
function number(value: unknown, min: number, max: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('invalid geometry or timestamp.');
}
function array(value: unknown, max: number): any[] {
  if (!Array.isArray(value) || value.length > max) fail('invalid or excessive array.');
  return value as any[];
}
export function validateElementSnapshotResources(value: unknown, stored: true): ElementSnapshotRecord['resources'];
export function validateElementSnapshotResources(value: unknown, stored: false): ElementSnapshotDraft['resources'];
export function validateElementSnapshotResources(value: unknown, stored: boolean): ElementSnapshotRecord['resources'] | ElementSnapshotDraft['resources'] {
  const seen = new Set<string>(), entries = array(value, limits.resources);
  for (const entry of entries) {
    const resource = object(entry, stored ? ['id', 'assetId'] : ['id']);
    const key = id(resource.id); if (seen.has(key)) fail('duplicate resource.'); seen.add(key);
    if (stored) id(resource.assetId);
  }
  return entries;
}
/** Strict inert AST validation, shared by saves, reads and detached backups. */
function validate(value: unknown, stored: boolean): ElementSnapshotDraft | ElementSnapshotRecord {
  const keys = ['version', 'capturedAt', 'viewport', 'root', 'nodes', 'styles', 'resources', 'unsupportedFeatures'];
  const row = object(value, stored ? [...keys, 'id', 'captureId', 'organisationId', 'collectionId', 'sourceUrl'] : keys);
  if (row.version !== 1) fail('unsupported version.');
  number(row.capturedAt, 0, Number.MAX_SAFE_INTEGER);
  const viewport = object(row.viewport, ['width', 'height', 'devicePixelRatio']);
  number(viewport.width, 1, 100000); number(viewport.height, 1, 100000); number(viewport.devicePixelRatio, 0.1, 16);
  const root = object(row.root, ['nodeId', 'width', 'height']);
  id(root.nodeId); number(root.width, 1, 1000000); number(root.height, 1, 1000000);
  if (stored) {
    for (const key of ['id', 'captureId', 'organisationId', 'collectionId']) id(row[key]);
    if (collectionSourceUrl(row.sourceUrl) !== row.sourceUrl) fail('source URL must be normalized.');
  }
  const resourceEntries = stored ? validateElementSnapshotResources(row.resources, true) : validateElementSnapshotResources(row.resources, false);
  const resources = new Set(resourceEntries.map(resource => resource.id));
  const styles = new Set<string>();
  for (const entry of array(row.styles, limits.nodes * 4)) {
    const style = object(entry, ['id', 'values']); const key = id(style.id);
    if (styles.has(key)) fail('duplicate style.'); styles.add(key);
    const values = object(style.values, ELEMENT_SNAPSHOT_STYLE_KEYS);
    for (const [property, entry] of Object.entries(values)) {
      if (!isElementSnapshotStyleValue(property, entry)) fail('unsafe appearance value.');
    }
  }
  const usedResources = new Set<string>(); const usedStyles = new Set<string>();
  const referenceStyle = (value: unknown) => { const key = id(value); if (!styles.has(key)) fail('unknown style.'); usedStyles.add(key); };
  const referenceResource = (value: unknown) => { const key = id(value); if (!resources.has(key)) fail('unknown resource.'); usedResources.add(key); };
  const nodes = new Map<string, Record<string, any>>();
  for (const entry of array(row.nodes, limits.nodes)) {
    const node = object(entry, ['id', 'type', 'text', 'tag', 'attributes', 'children', 'styleId', 'resourceId', 'backgroundResourceIds', 'backgroundLayers', 'pseudos']);
    const key = id(node.id); if (nodes.has(key)) fail('duplicate node.'); nodes.set(key, node);
    if (node.type === 'text') { object(node, ['id', 'type', 'text']); text(node.text, limits.bytes); continue; }
    if (node.type !== 'element' || !tags.has(node.tag)) fail('unsupported element.');
    object(node, ['id', 'type', 'tag', 'attributes', 'children', 'styleId', 'resourceId', 'backgroundResourceIds', 'backgroundLayers', 'pseudos']);
    const attrs = object(node.attributes, [...attributes]);
    for (const [name, value] of Object.entries(attrs)) {
      text(value); if (/^on/i.test(name)) fail('event attributes are forbidden.');
      if (['colspan', 'rowspan', 'start', 'aria-level'].includes(name) && !/^-?\d{1,6}$/.test(value as string)) fail('invalid numeric attribute.');
      if (name === 'dir' && !['ltr', 'rtl', 'auto'].includes(value as string)) fail('invalid direction.');
      if (name === 'aria-hidden' && !['true', 'false'].includes(value as string)) fail('invalid visibility attribute.');
      if (name === 'aria-checked' && !['true', 'false'].includes(value as string)) fail('invalid checked attribute.');
    }
    array(node.children, limits.nodes).forEach(id);
    if (['img', 'br', 'hr'].includes(node.tag) && node.children.length) fail('void element has children.');
    if (node.styleId !== undefined) referenceStyle(node.styleId);
    if (node.resourceId !== undefined) { if (node.tag !== 'img') fail('image reference on non-image node.'); referenceResource(node.resourceId); }
    if (node.tag === 'img' && node.resourceId === undefined) fail('image requires a local resource.');
    if (node.backgroundResourceIds !== undefined) array(node.backgroundResourceIds, limits.resources).forEach(referenceResource);
    if (node.backgroundLayers !== undefined) {
      if (node.backgroundResourceIds !== undefined) fail('ambiguous background representation.');
      for (const entry of array(node.backgroundLayers, limits.resources)) {
        const layer = object(entry, ['type', 'resourceId', 'value']);
        if (layer.type === 'image') { object(layer, ['type', 'resourceId']); referenceResource(layer.resourceId); }
        else if (layer.type === 'gradient') { object(layer, ['type', 'value']); if (!isElementSnapshotGradient(layer.value)) fail('unsafe gradient.'); }
        else if (layer.type === 'none') object(layer, ['type']);
        else fail('unsupported background layer.');
      }
    }
    if (node.pseudos !== undefined) {
      const kinds = new Set();
      for (const entry of array(node.pseudos, 3)) {
        const pseudo = object(entry, ['kind', 'text', 'styleId']);
        if (!['before', 'after', 'marker'].includes(pseudo.kind) || kinds.has(pseudo.kind)) fail('invalid pseudo-element.');
        kinds.add(pseudo.kind); text(pseudo.text);
        if (pseudo.styleId !== undefined) referenceStyle(pseudo.styleId);
      }
    }
  }
  if (nodes.get(root.nodeId)?.type !== 'element') fail('root must be an element.');
  const visited = new Set<string>(); const pending = [{ key: root.nodeId, depth: 0 }];
  while (pending.length) {
    const { key, depth } = pending.pop()!;
    if (depth > limits.depth || visited.has(key)) fail('cycle, shared child or excessive depth.');
    const node = nodes.get(key); if (!node) fail('unknown child.');
    visited.add(key);
    for (const child of node!.children || []) pending.push({ key: child, depth: depth + 1 });
  }
  if (visited.size !== nodes.size || usedResources.size !== resources.size || usedStyles.size !== styles.size) fail('unreachable node, resource or style.');
  for (const entry of array(row.unsupportedFeatures, 100)) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(text(entry, 64))) fail('invalid unsupported-feature marker.');
  }
  if (new TextEncoder().encode(JSON.stringify(row)).byteLength > limits.bytes) fail('exceeds 4 MiB.');
  return row as ElementSnapshotDraft | ElementSnapshotRecord;
}
export const validateElementSnapshotDraft = (value: unknown): ElementSnapshotDraft => validate(value, false) as ElementSnapshotDraft;
export const validateElementSnapshotRecord = (value: unknown): ElementSnapshotRecord => validate(value, true) as ElementSnapshotRecord;
export function assertElementSnapshotMatchesItem(snapshot: ElementSnapshotRecord, item: CollectionItemRecord): void {
  if (item.type !== 'web-scraping' || snapshot.id !== item.id || snapshot.captureId !== item.data.snapshotId
      || snapshot.organisationId !== item.organisationId || snapshot.collectionId !== item.collectionId || snapshot.sourceUrl !== item.url) {
    throw new CollectionStorageError('INVALID_OWNERSHIP', 'Element snapshot does not match its Collection item.');
  }
}
