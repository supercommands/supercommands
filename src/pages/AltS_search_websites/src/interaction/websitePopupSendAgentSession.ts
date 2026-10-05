import type { TemporaryPromptTabAttachment } from '../../../../shared-components/aiPromptComposer/temporaryPromptComposition';
export interface WebsitePopupSendAgentTarget {
  targetKind: 'prompt' | 'agent'; targetId: string; targetTitle: string;
}
export interface WebsitePopupSendAgentSession {
  flowId: string; sourceUrl: string; target: WebsitePopupSendAgentTarget;
  temporaryPrompt: string; attachedTabs: TemporaryPromptTabAttachment[];
  expanded: boolean; rulesExpanded: boolean; revision: number;
  status: 'idle' | 'sending' | 'editing' | 'sent' | 'unknown' | 'closed'; requestId: string | null; error: string | null;
}
export type WebsitePopupSendAgentEvent = {
  type: 'SEND_AGENT_TARGET_SELECTED'; target: WebsitePopupSendAgentTarget; sourceUrl: string; flowId: string;
} | {
  type: 'SEND_AGENT_DRAFT_CHANGED'; flowId: string; temporaryPrompt: string; attachedTabs: TemporaryPromptTabAttachment[];
} | {
  type: 'SEND_AGENT_VIEW_CHANGED'; flowId: string; expanded?: boolean; rulesExpanded?: boolean;
} | {
  type: 'SEND_AGENT_OPERATION_STARTED'; flowId: string; requestId: string; operation: 'sending' | 'editing'; revision: number;
} | {
  type: 'SEND_AGENT_OPERATION_FINISHED'; flowId: string; requestId: string; error?: string; unknownOutcome?: boolean;
} | {
  type: 'SEND_AGENT_FLOW_CLOSED';
};
