import type { NoteLibraryWidgetSettings } from '../widgetDashboard.types';
import type { NoteRecord } from '../../../../../../allObjectFolder/src/createObject/notes/noteTypes';

export function normalizeNoteLibrarySettings(
  rawSettings?: Partial<NoteLibraryWidgetSettings> | null,
): NoteLibraryWidgetSettings {
  const safe = rawSettings || {};
  return {
    sourceMode: safe.sourceMode === 'manual' || safe.sourceMode === 'tags' ? safe.sourceMode : 'all',
    selectedNoteIds: Array.isArray(safe.selectedNoteIds) ? safe.selectedNoteIds : [],
    selectedTagIds: Array.isArray(safe.selectedTagIds) ? safe.selectedTagIds : [],
    tagMatchMode: safe.tagMatchMode === 'all' ? 'all' : 'any',
    sortBy: safe.sortBy === 'title' || safe.sortBy === 'recent' ? safe.sortBy : 'saved-order',
    enableSearch: Boolean(safe.enableSearch),
  };
}

export function filterAndSortNotes(
  notes: NoteRecord[],
  settings: NoteLibraryWidgetSettings,
  searchQuery: string = '',
  plainTextMap?: Map<string, string>,
): NoteRecord[] {
  const validNotes = notes.filter(n => n.deletedAt == null);

  let visibleNotes: NoteRecord[] = [];
  if (settings.sourceMode === 'manual') {
    const validNotesMap = new Map(validNotes.map(n => [n.id, n]));
    visibleNotes = settings.selectedNoteIds
      .map(id => validNotesMap.get(id))
      .filter((n): n is NoteRecord => Boolean(n));
  } else if (settings.sourceMode === 'all') {
    visibleNotes = validNotes;
  } else if (settings.sourceMode === 'tags') {
    if (settings.selectedTagIds.length > 0) {
      if (settings.tagMatchMode === 'all') {
        visibleNotes = validNotes.filter(n =>
          settings.selectedTagIds.every((tId: string) => (n.tagIds || []).includes(tId)),
        );
      } else {
        visibleNotes = validNotes.filter(n =>
          settings.selectedTagIds.some((tId: string) => (n.tagIds || []).includes(tId)),
        );
      }
    }
  }

  if (settings.sortBy === 'title') {
    visibleNotes = [...visibleNotes].sort((a, b) =>
      (a.title || 'Untitled Note').localeCompare(b.title || 'Untitled Note', undefined, { sensitivity: 'base' }),
    );
  } else if (settings.sortBy === 'recent') {
    visibleNotes = [...visibleNotes].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  if (settings.enableSearch && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    visibleNotes = visibleNotes.filter(n => {
      const titleStr = (n.title || '').toLowerCase();
      const bodyStr = (plainTextMap?.get(n.id) || '').toLowerCase();
      return titleStr.includes(q) || bodyStr.includes(q);
    });
  }

  return visibleNotes;
}
