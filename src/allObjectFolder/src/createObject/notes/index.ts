/**
 * @file index.ts
 * @description Barrel export file for the notes module,
 * exporting NoteEditorView, hook, helpers, types, and DB functions.
 *
 * @usage
 * ```ts
 * import { NoteEditorView, useNoteEditor } from './notes';
 * ```
 */
export { NoteEditorView } from './ui/NoteEditorView';
export type { NoteEditorViewProps } from './ui/NoteEditorView';
export { useNoteEditor } from './useNoteEditor';
export * from './noteHooks';
export type { NoteRecord, CreateNoteInput, UpdateNoteInput } from './noteTypes';
