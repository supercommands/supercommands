import { useCallback, useEffect, useRef, useState } from 'react';
import { createCollectionImage } from '../../../../../../allObjectFolder/src/createObject/collections/collectionClient';
import { inspectCollectionImage } from '../collectionFileTransfer';

export type ImageUploadEntry = { id: string; file: File; status: 'queued' | 'preparing' | 'saving' | 'saved' | 'failed'; percent: number; error?: string };

export const useCollectionImageUpload = (organisationId: string | null, collectionId: string | null, onUploaded: () => Promise<unknown>) => {
    const [entries, setEntries] = useState<ImageUploadEntry[]>([]);
    const queue = useRef<ImageUploadEntry[]>([]);
    const processing = useRef<number | null>(null);
    const active = useRef<{ id: string; controller: AbortController; phase: 'preparing' | 'saving' } | null>(null);
    const generation = useRef(0);

    useEffect(() => {
        generation.current += 1;
        setEntries([]);
        queue.current = [];
        return () => { generation.current += 1; active.current?.controller.abort(); queue.current = []; };
    }, [organisationId, collectionId]);

    const patch = useCallback((id: string, change: Partial<ImageUploadEntry>) => {
        setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...change } : entry));
    }, []);

    const drain = useCallback(async () => {
        const startedGeneration = generation.current;
        if (processing.current === startedGeneration || !organisationId || !collectionId) return;
        processing.current = startedGeneration;
        try {
            while (queue.current.length && generation.current === startedGeneration) {
                const entry = queue.current.shift()!;
                const controller = new AbortController();
                active.current = { id: entry.id, controller, phase: 'preparing' };
                patch(entry.id, { status: 'preparing', percent: 0, error: undefined });
                try {
                    const { title, fileName } = await inspectCollectionImage(entry.file);
                    if (controller.signal.aborted) throw new DOMException('Upload cancelled.', 'AbortError');
                    await createCollectionImage({ organisationId, collectionId, title, fileName, blob: entry.file, signal: controller.signal, onPrepareProgress: percent => {
                        if (generation.current !== startedGeneration) return;
                        if (percent === 100 && active.current?.id === entry.id) active.current.phase = 'saving';
                        patch(entry.id, { status: percent === 100 ? 'saving' : 'preparing', percent });
                    } });
                    if (generation.current === startedGeneration) {
                        patch(entry.id, { status: 'saved', percent: 100 });
                        await onUploaded();
                    }
                } catch (error) {
                    if (generation.current === startedGeneration && !controller.signal.aborted) patch(entry.id, { status: 'failed', error: error instanceof Error ? error.message : 'Image upload failed.' });
                } finally { if (active.current?.id === entry.id) active.current = null; }
            }
        } finally { if (processing.current === startedGeneration) processing.current = null; }
    }, [organisationId, collectionId, onUploaded, patch]);

    const enqueue = useCallback((files: File[]) => {
        if (!files.length || !organisationId || !collectionId) return;
        const next = files.map(file => ({ id: crypto.randomUUID(), file, status: 'queued' as const, percent: 0 }));
        queue.current.push(...next);
        setEntries(current => [...current, ...next]);
        void drain();
    }, [organisationId, collectionId, drain]);

    const cancel = useCallback((id: string) => {
        if (active.current?.id === id) {
            if (active.current.phase === 'saving') return;
            active.current.controller.abort();
        } else queue.current = queue.current.filter(entry => entry.id !== id);
        setEntries(current => current.filter(entry => entry.id !== id));
    }, []);

    const retry = useCallback((entry: ImageUploadEntry) => {
        if (active.current?.id === entry.id || queue.current.some(queued => queued.id === entry.id)) return;
        queue.current.push({ ...entry, status: 'queued', percent: 0, error: undefined });
        patch(entry.id, { status: 'queued', percent: 0, error: undefined });
        void drain();
    }, [drain, patch]);

    const dismiss = useCallback((id: string) => setEntries(current => current.filter(entry => entry.id !== id)), []);
    return { entries, enqueue, cancel, retry, dismiss };
};
