
export interface CustomModelConfig {
    id: string;
    name: string;
    host: string;
}
export interface AiPromptRecord {
    id: string;
    organisationId: string;
    title: string;
    prompt: string;
    rules?: string;
    modelUrls: Record<string, string>;
    favIconUrl?: string;
    tagIds: string[];
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    customModels?: CustomModelConfig[];
    enabledModelIds?: string[];
}
export const AI_PROMPT_COMPARISON_FIELDS = ['id', 'organisationId', 'title', 'prompt', 'rules', 'modelUrls', 'favIconUrl', 'tagIds', 'customModels', 'enabledModelIds', 'deletedAt'] as const satisfies readonly (keyof AiPromptRecord)[];
export interface CreateAiPromptInput {
    organisationId?: string;
    title: string;
    prompt: string;
    rules?: string;
    modelUrls: Record<string, string>;
    favIconUrl?: string;
    tagIds?: string[];
    customModels?: CustomModelConfig[];
    enabledModelIds?: string[];
}
export interface UpdateAiPromptInput {
    expectedUpdatedAt?: number;
    title?: string;
    prompt?: string;
    rules?: string;
    modelUrls?: Record<string, string>;
    favIconUrl?: string;
    organisationId?: string;
    tagIds?: string[];
    customModels?: CustomModelConfig[];
    enabledModelIds?: string[];
}
