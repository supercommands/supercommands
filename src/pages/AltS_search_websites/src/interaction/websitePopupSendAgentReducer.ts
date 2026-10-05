import type { WebsitePopupInteractionEvent, WebsitePopupInteractionState, WebsitePopupRoute } from './websitePopupInteractionTypes';
export const isWebsitePopupSendAgentRoute = (route: WebsitePopupRoute) => route.kind === 'submode'
  && ['send-agent', 'send-agent-compose'].includes(route.submode.id);

/** Pure scoped drafts; existing routes remain responsible for back-navigation. */
export function reduceWebsitePopupSendAgentInteraction(state: WebsitePopupInteractionState,
  event: WebsitePopupInteractionEvent): WebsitePopupInteractionState | null {
  const session = state.sendAgentSession;
  const composing = state.route.kind === 'submode' && state.route.submode.id === 'send-agent-compose';
  if (event.type === 'SEND_AGENT_FLOW_CLOSED') return !session ? state : { ...state,
    sendAgentSession: { ...session, requestId: null, status: 'closed' } };
  if (event.type === 'SEND_AGENT_TARGET_SELECTED') {
    if (state.route.kind !== 'submode' || state.route.submode.id !== 'send-agent' || session?.requestId) return state;
    const previous = session && session.sourceUrl === event.sourceUrl && session.target.targetKind === event.target.targetKind
      && session.target.targetId === event.target.targetId ? session : null;
    return { ...state, inputValue: '', parsedIntent: { kind: 'none' }, selectedIndex: 0, suggestionCount: 0,
      route: { kind: 'submode', submode: { id: 'send-agent-compose' }, query: '', returnTo: state.route },
      sendAgentSession: previous ? { ...previous, target: event.target,
        status: previous.status === 'unknown' ? 'unknown' : 'idle', error: previous.status === 'unknown' ? previous.error : null }
        : { flowId: event.flowId, sourceUrl: event.sourceUrl, target: event.target, temporaryPrompt: '', attachedTabs: [],
          expanded: false, rulesExpanded: false, revision: 0, status: 'idle', requestId: null, error: null } };
  }
  if (!session || !isWebsitePopupSendAgentRoute(state.route)) return null;
  if (event.type === 'QUERY_CHANGED' && composing) return state;
  if (event.type === 'BACK_REQUESTED' && composing && state.route.kind === 'submode') {
    return { ...state, route: state.route.returnTo, inputValue: state.route.returnTo.query,
      selectedIndex: 0, suggestionCount: 0, sendAgentSession: { ...session, requestId: null,
        status: session.status === 'unknown' ? 'unknown' : 'idle', error: session.status === 'unknown' ? session.error : null } };
  }
  if (!('flowId' in event) || event.flowId !== session.flowId) return null;
  switch (event.type) {
    case 'SEND_AGENT_DRAFT_CHANGED': {
      if (!composing || session.requestId || session.status === 'closed' || session.status === 'sent') return state;
      const attachedTabs = [...new Map(event.attachedTabs.map(tab => [tab.tabId, tab])).values()];
      if (session.temporaryPrompt === event.temporaryPrompt && JSON.stringify(session.attachedTabs) === JSON.stringify(attachedTabs)) return state;
      return { ...state, sendAgentSession: { ...session, temporaryPrompt: event.temporaryPrompt, attachedTabs,
        revision: session.revision + 1, status: session.status === 'unknown' ? 'unknown' : 'idle',
        error: session.status === 'unknown' ? session.error : null } };
    }
    case 'SEND_AGENT_VIEW_CHANGED': return !composing || session.status === 'closed' || ((event.expanded ?? session.expanded) === session.expanded
      && (event.rulesExpanded ?? session.rulesExpanded) === session.rulesExpanded) ? state : { ...state, sendAgentSession: { ...session,
      expanded: event.expanded ?? session.expanded, rulesExpanded: event.rulesExpanded ?? session.rulesExpanded } };
    case 'SEND_AGENT_OPERATION_STARTED': return !composing || session.status !== 'idle' || session.requestId || event.revision !== session.revision ? state
      : { ...state, sendAgentSession: { ...session, requestId: event.requestId, status: event.operation, error: null } };
    case 'SEND_AGENT_OPERATION_FINISHED': return session.requestId !== event.requestId ? state
      : { ...state, sendAgentSession: { ...session, requestId: null,
        status: event.unknownOutcome ? 'unknown' : event.error ? 'idle' : session.status === 'sending' ? 'sent' : 'idle', error: event.error || null } };
    default: return null;
  }
}
