import DiffMatchPatch from 'diff-match-patch';
import type { NoteVersionHistory, NoteSnapshot } from './noteTypes';
import {
  createInitialStructuredVersionHistory,
  upsertVersionForChange,
  shouldCreateCheckpoint as shouldCreateStructuredCheckpoint,
  normalizeHistory,
  VERSION_HISTORY_CHECKPOINT_INTERVAL_MS,
} from '../../../../shared-components/versionHistory/structuredVersionHistory';

const dmp = new DiffMatchPatch();

const MAX_HISTORY_VERSIONS = 20;

function makeReversePatchText(newerText: string, olderText: string): string {
  const diffs = dmp.diff_main(newerText, olderText);
  dmp.diff_cleanupSemantic(diffs);
  const patches = dmp.patch_make(newerText, diffs);
  return dmp.patch_toText(patches);
}

function applyPatchText(text: string, patchText: string): string {
  const patches = dmp.patch_fromText(patchText);
  const [result, applied] = dmp.patch_apply(patches, text);
  if (applied.some(ok => !ok)) {
    console.warn('[versionHistory] one or more patches failed to apply cleanly');
  }
  return result;
}

export function extractNoteSnapshotFromRecord(record: {
  title?: string;
  body?: string;
  shortcut?: string;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
}): NoteSnapshot {
  return {
    entityType: 'note',
    title: record.title || 'Untitled Note',
    body: record.body || '',
    shortcut: record.shortcut || '',
    workspaceId: record.workspaceId || '',
    folderId: record.folderId || null,
    tagIds: record.tagIds || [],
  };
}

export function shouldCreateCheckpoint(
  history: NoteVersionHistory,
  prevSnapshotOrBody: NoteSnapshot | string,
  nextSnapshotOrBody?: NoteSnapshot | string,
  now: number = Date.now()
): boolean {
  if (!history) return true;

  if (typeof prevSnapshotOrBody === 'object' && typeof nextSnapshotOrBody === 'object') {
    return shouldCreateStructuredCheckpoint(
      history.structuredHistory,
      prevSnapshotOrBody,
      nextSnapshotOrBody,
      now,
      VERSION_HISTORY_CHECKPOINT_INTERVAL_MS
    );
  }

  const prevText = typeof prevSnapshotOrBody === 'string' ? prevSnapshotOrBody : prevSnapshotOrBody?.body || '';
  const nextText = typeof nextSnapshotOrBody === 'string' ? nextSnapshotOrBody : nextSnapshotOrBody?.body || '';

  if (prevText === nextText) return false;

  const lastCheckpointAt = history.lastCheckpointAt || 0;
  return now - lastCheckpointAt >= VERSION_HISTORY_CHECKPOINT_INTERVAL_MS;
}

export function createInitialHistory(body: string | NoteSnapshot, time: number = Date.now()): NoteVersionHistory {
  const bodyText = typeof body === 'string' ? body : body.body;
  const initialSnapshot: NoteSnapshot = typeof body === 'object' ? body : {
    entityType: 'note',
    title: 'Untitled Note',
    body: bodyText,
    shortcut: '',
    workspaceId: '',
    folderId: null,
    tagIds: [],
  };

  return {
    lastCheckpointAt: time,
    lastSavedText: bodyText,
    historyBuffer: [],
    structuredHistory: createInitialStructuredVersionHistory<NoteSnapshot>(initialSnapshot, time),
  };
}

export function createCheckpoint(
  newBodyOrSnapshot: string | NoteSnapshot,
  history: NoteVersionHistory,
  now: number = Date.now(),
  prevSnapshot?: NoteSnapshot
): NoteVersionHistory {
  const newBodyText = typeof newBodyOrSnapshot === 'string' ? newBodyOrSnapshot : newBodyOrSnapshot.body;

  if (!history || typeof history.lastSavedText !== 'string') {
    return createInitialHistory(newBodyOrSnapshot, now);
  }

  const reversePatch = makeReversePatchText(newBodyText, history.lastSavedText);
  let nextBuffer = [...(history.historyBuffer || []), reversePatch];

  if (nextBuffer.length > MAX_HISTORY_VERSIONS) {
    nextBuffer = nextBuffer.slice(nextBuffer.length - MAX_HISTORY_VERSIONS);
  }

  const nextSnapshot: NoteSnapshot = typeof newBodyOrSnapshot === 'object'
    ? newBodyOrSnapshot
    : {
        entityType: 'note',
        title: 'Untitled Note',
        body: newBodyText,
        shortcut: '',
        workspaceId: '',
        folderId: null,
        tagIds: [],
      };

  const { history: nextStructHistory } = upsertVersionForChange<NoteSnapshot>(
    history.structuredHistory,
    prevSnapshot,
    nextSnapshot,
    now
  );

  return {
    lastSavedText: newBodyText,
    historyBuffer: nextBuffer,
    lastCheckpointAt: now,
    structuredHistory: nextStructHistory,
  };
}

/**
 * Reconstructs the note body `n` versions back from `currentText` (the live editor value).
 *   n = 0  -> currentText itself (live draft)
 *   n = 1  -> history.lastSavedText (most recent checkpoint)
 *   n >= 2 -> walks backward through historyBuffer, most-recent diff first
 */
export function getHistoricalVersion(currentText: string, history: NoteVersionHistory, n: number): string {
  if (!Number.isFinite(n) || n <= 0) return currentText;
  if (!history || typeof history.lastSavedText !== 'string') return currentText;

  let text = history.lastSavedText;
  if (n === 1) return text;

  const buffer = Array.isArray(history.historyBuffer) ? history.historyBuffer : [];
  const steps = Math.min(n - 1, buffer.length);

  for (let i = 0; i < steps; i++) {
    const patchText = buffer[buffer.length - 1 - i];
    try {
      text = applyPatchText(text, patchText);
    } catch (err) {
      console.error('[versionHistory] failed applying patch at step', i, err);
      break;
    }
  }
  return text;
}

/** Number of distinct saved snapshots (lastSavedText + each buffered diff), excludes live draft. */
export function getVersionCount(history: NoteVersionHistory): number {
  if (!history) return 0;
  if (history.structuredHistory && Array.isArray(history.structuredHistory.versions)) {
    return history.structuredHistory.versions.length;
  }
  if (typeof history.lastSavedText !== 'string') return 0;
  return 1 + (Array.isArray(history.historyBuffer) ? history.historyBuffer.length : 0);
}
