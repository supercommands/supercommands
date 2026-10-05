import type { NoteRecord, NoteSnapshot, NoteVersionHistory } from './noteTypes';
export type NoteSourceType = 'note' | 'snippet' | 'todo';
export type NoteEditorRecord = NoteRecord & {
    sourceType: NoteSourceType;
};
const asBody = (value: unknown): string => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
/** One read projection for current content and historical snapshots. Never writes/migrates records. */
export function toNoteSnapshot(record: any, sourceType: NoteSourceType = 'note'): NoteSnapshot {
    const body = sourceType === 'snippet'
        ? record.config ?? record.body ?? record.content ?? record.value
        : sourceType === 'todo'
            ? record.description ?? record.body ?? record.content ?? record.value
            : record.body ?? record.content ?? record.description ?? record.value;
    return {
        entityType: 'note',
        title: String((sourceType === 'todo' ? record.name ?? record.title : record.title ?? record.name) ?? record.key ?? ''),
        body: asBody(body),
        shortcut: record.shortcut ?? '',
        organisationId: record.organisationId ?? record.organisation_id ?? '',
        tagIds: Array.from(new Set<string>((record.tagIds ?? record.tags ?? [])
            .map((tag: any) => typeof tag === 'string' ? tag : tag?.id).filter(Boolean))),
    };
}
export function toNoteEditorRecord(record: any, sourceType: NoteSourceType = 'note'): NoteEditorRecord {
    const snapshot = toNoteSnapshot(record, sourceType);
    const rawHistory = record.versionHistory;
    const structured = rawHistory?.structuredHistory ?? (Array.isArray(rawHistory?.versions) ? rawHistory : undefined);
    const versionHistory: NoteVersionHistory | undefined = rawHistory ? {
        ...rawHistory,
        lastSavedText: rawHistory.lastSavedText ?? snapshot.body,
        historyBuffer: rawHistory.historyBuffer ?? [],
        lastCheckpointAt: rawHistory.lastCheckpointAt ?? record.updatedAt ?? 0,
        structuredHistory: structured?.versions?.length ? {
            ...structured,
            versions: structured.versions.map((version: any) => ({
                ...version,
                snapshot: toNoteSnapshot(version.snapshot ?? {}, sourceType),
            })),
        } : undefined,
    } : undefined;
    return {
        ...record,
        ...snapshot,
        id: String(record.id ?? record.snippet_id ?? record.note_id ?? record.todo_id ?? ''),
        sourceType,
        assetIds: record.assetIds ?? [],
        createdAt: record.createdAt ?? 0,
        updatedAt: record.updatedAt ?? 0,
        deletedAt: record.deletedAt ?? null,
        versionHistory: versionHistory as NoteVersionHistory,
    };
}
