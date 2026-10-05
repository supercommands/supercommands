/** Non-rendering coordinator over the existing store, typed bridge and editor launcher. */
import { executeWebsitePopupBridgeOperation, WebsitePopupExecutionTransportError } from '../bridge/websitePopupExecutionBridge';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupInteractionEvent } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupSendAgentTarget } from '../interaction/websitePopupSendAgentSession';
import type { TemporaryPromptTabAttachment } from '../../../../shared-components/aiPromptComposer/temporaryPromptComposition';

export function createWebsitePopupSendAgentController(store: WebsitePopupInteractionStoreApi, readSourceUrl: () => string) {
  let disposed = false;
  const dispatch = (event: WebsitePopupInteractionEvent) => {
    if (!disposed) store.getState().dispatch(event);
  };
  const currentRequest = (flowId: string, requestId: string) => {
    const state = store.getState().state;
    return !disposed && state.route.kind === 'submode' && state.route.submode.id === 'send-agent-compose'
      && state.sendAgentSession?.flowId === flowId && state.sendAgentSession.requestId === requestId;
  };
  const run = async (operation: 'sending' | 'editing'): Promise<boolean> => {
    const state = store.getState().state;
    const session = state.sendAgentSession;
    if (disposed || state.route.kind !== 'submode' || state.route.submode.id !== 'send-agent-compose'
        || !session || session.requestId || session.status !== 'idle') return false;
    const requestId = crypto.randomUUID();
    dispatch({ type: 'SEND_AGENT_OPERATION_STARTED', flowId: session.flowId, requestId, operation, revision: session.revision });
    if (!currentRequest(session.flowId, requestId)) return false;
    try {
      if (session.sourceUrl !== readSourceUrl()) throw new Error('The source page changed. Select the recipient again.');
      const outcome = operation === 'sending'
        ? await executeWebsitePopupBridgeOperation({ kind: 'send-to-agent', targetKind: session.target.targetKind,
          targetId: session.target.targetId, composition: { temporaryPrompt: session.temporaryPrompt,
            attachedTabIds: session.attachedTabs.map(tab => tab.tabId) } })
        : await executeWebsitePopupBridgeOperation({ kind: 'open-entity-editor', entity: session.target.targetKind,
          targetId: session.target.targetId });
      if (!currentRequest(session.flowId, requestId)) return false;
      if (operation === 'sending' ? outcome.status !== 'action-executed' || outcome.actionId !== 'send_to_agent'
        : outcome.status !== 'entity-opened') throw new Error('The requested action was not confirmed.');
      dispatch({ type: 'SEND_AGENT_OPERATION_FINISHED', flowId: session.flowId, requestId });
      return true;
    } catch (failure) {
      const unknownOutcome = operation === 'sending' && failure instanceof WebsitePopupExecutionTransportError;
      if (currentRequest(session.flowId, requestId)) dispatch({ type: 'SEND_AGENT_OPERATION_FINISHED', flowId: session.flowId,
        requestId, unknownOutcome, error: unknownOutcome
          ? 'The send could not be confirmed. Check the AI tab before reopening this flow to retry.'
          : failure instanceof Error ? failure.message : 'Unable to complete the request.' });
      return false;
    }
  };
  return {
    selectTarget: (target: WebsitePopupSendAgentTarget) => dispatch({ type: 'SEND_AGENT_TARGET_SELECTED', target,
      sourceUrl: readSourceUrl(), flowId: crypto.randomUUID() }),
    changeDraft: (flowId: string, temporaryPrompt: string, attachedTabs: TemporaryPromptTabAttachment[]) =>
      dispatch({ type: 'SEND_AGENT_DRAFT_CHANGED', flowId, temporaryPrompt, attachedTabs }),
    changeView: (flowId: string, options: { expanded?: boolean; rulesExpanded?: boolean }) =>
      dispatch({ type: 'SEND_AGENT_VIEW_CHANGED', flowId, ...options }),
    back: () => dispatch({ type: 'BACK_REQUESTED' }),
    send: () => run('sending'), edit: () => run('editing'),
    isAcceptedFlow: (flowId: string) => {
      const state = store.getState().state;
      return !disposed && state.route.kind === 'submode' && state.route.submode.id === 'send-agent-compose'
        && state.sendAgentSession?.flowId === flowId && state.sendAgentSession.status === 'sent';
    },
    activate: () => { disposed = false; },
    dispose: () => { disposed = true; },
  };
}
