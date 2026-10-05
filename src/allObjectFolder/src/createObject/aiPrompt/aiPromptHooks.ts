/**
 * @file aiPromptHooks.ts
 * @description Provides custom React hooks for fetching AI Prompt records reactively
 * from the local database (Dexie/IndexedDB).
 *
 * @usage
 * ```tsx
 * import { useAiPrompt } from './aiPromptHooks';
 * const promptData = useAiPrompt(aiPromptId);
 * ```
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../storage/indexDB/dbConfig';
import type { AiPromptRecord } from './aiPromptTypes';
export function useAiPrompt(id: string | null | undefined): AiPromptRecord | undefined {
    return useLiveQuery(async () => {
        if (!id)
            return undefined;
        return await db.aiPrompts.get(id);
    }, [id]);
}
