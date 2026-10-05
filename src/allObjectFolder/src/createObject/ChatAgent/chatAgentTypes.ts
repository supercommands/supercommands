/**
 * @file chatAgentTypes.ts
 * @description Defines the TypeScript types and interfaces for the ChatAgent entity,
 * representing saved AI conversation setups and multi-model configurations.
 *
 * @usage
 * ```ts
 * import type { ChatAgentRecord, CreateChatAgentInput } from './chatAgentTypes';
 * ```
 */
export interface ChatAgentRecord {
    id: string;
    organisationId: string;
    title: string;
    prompt: string;
    urls: string[]; // URLs contain the cmd_select_status=true param to infer models
    tagIds: string[];
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}
export const CHAT_AGENT_COMPARISON_FIELDS = ['id', 'organisationId', 'title', 'prompt', 'urls', 'tagIds', 'deletedAt'] as const satisfies readonly (keyof ChatAgentRecord)[];
export interface CreateChatAgentInput {
    organisationId?: string;
    title: string;
    prompt?: string;
    urls?: string[];
    tagIds?: string[];
}
export interface UpdateChatAgentInput {
    expectedUpdatedAt?: number;
    title?: string;
    prompt?: string;
    urls?: string[];
    organisationId?: string;
    tagIds?: string[];
}
