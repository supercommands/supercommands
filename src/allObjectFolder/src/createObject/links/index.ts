/**
 * @file index.ts
 * @description Barrel export file for the links module,
 * exposing the main editor view, hook, database functions, and types.
 *
 * @usage
 * ```ts
 * import { LinkEditorView, useLinkEditor } from './links';
 * ```
 */
export { default as LinkEditorView } from './ui/LinkEditorView';
export { useLinkEditor } from './useLinkEditor';
export * from './linkHooks';
export type { LinkRecord, CreateLinkInput, UpdateLinkInput } from './linkTypes';
export * from './ui/LinkEditorView';
