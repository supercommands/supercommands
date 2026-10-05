/**
 * @file chatAgentHooks.ts
 * @description Exposes custom React hooks (`useChatAgent`) to subscribe to
 * ChatAgent records reactively from IndexedDB.
 *
 * @usage
 * ```tsx
 * import { useChatAgent } from './chatAgentHooks';
 * const agent = useChatAgent(agentId);
 * ```
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../storage/indexDB/dbConfig';
import type { ChatAgentRecord } from './chatAgentTypes';
/**
 * Custom hook to reactively fetch a single ChatAgent by ID.
 * Returns the ChatAgentRecord or undefined if not found or still loading.
 */
export function useChatAgent(id: string | null | undefined): ChatAgentRecord | undefined {
    return useLiveQuery(async () => {
        if (!id)
            return undefined;
        return await db.chatAgents.get(id);
    }, [id]);
}
