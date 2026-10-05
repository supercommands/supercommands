/** Website host adapter: shared spacious prompt controls, one flow-owned draft. */
import { useCallback, useRef } from 'react';
import { useStore } from 'zustand';
import { TemporaryPromptComposer } from '../../../../shared-components/aiPromptComposer/TemporaryPromptComposer';
import type { TemporaryPromptTabAttachment } from '../../../../shared-components/aiPromptComposer/temporaryPromptComposition';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import { getAiPromptExecutionText } from '../../../../allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import { readWebsitePopupOpenTabs } from '../bridge/websitePopupCreateOptionsBridge';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { createWebsitePopupSendAgentController } from '../execution/createWebsitePopupSendAgentController';
import { getWebsitePopupEntityIcon } from '../catalog/websitePopupEntityIconCatalog';

export function ConnectedWebsitePopupSendAgentComposer({ store, snapshot, controller, shadowRoot, onInputRef, onSent }: {
  store: WebsitePopupInteractionStoreApi; snapshot: WebsitePopupSearchSnapshot;
  controller: ReturnType<typeof createWebsitePopupSendAgentController>; shadowRoot: ShadowRoot | null;
  onInputRef: (element: HTMLTextAreaElement | null) => void; onSent: () => void;
}) {
  const session = useStore(store, current => current.state.sendAgentSession);
  const initial = useRef(session);
  const flowId = session?.flowId || '';
  const sourceUrl = session?.sourceUrl || '';
  const draftChanged = useCallback((value: string, tabs: TemporaryPromptTabAttachment[]) => controller.changeDraft(flowId, value, tabs), [controller, flowId]);
  const viewChanged = useCallback((view: { expanded: boolean; rulesExpanded: boolean }) => controller.changeView(flowId, view), [controller, flowId]);
  const readTabs = useCallback(async () => {
    const tabs = await readWebsitePopupOpenTabs();
    const current = tabs.find(tab => tab.url === sourceUrl && tab.active) || tabs.find(tab => tab.url === sourceUrl);
    return current ? [current, ...tabs.filter(tab => tab.tabId !== current.tabId)] : tabs;
  }, [sourceUrl]);
  if (!session || !initial.current) return null;
  const record = session.target.targetKind === 'prompt'
    ? snapshot.prompts.find(value => value.id === session.target.targetId)
    : snapshot.agents.find(value => value.id === session.target.targetId);
  const rules = record?.prompt || ('rules' in (record || {}) ? (record as { rules?: string }).rules : '') || '';
  const pending = ['sending', 'editing', 'sent', 'closed'].includes(session.status);
  const unknownOutcome = session.status === 'unknown';
  return <TemporaryPromptComposer presentation="embedded" title={record?.title || session.target.targetTitle} rules={rules}
    recipientIcon={getWebsitePopupEntityIcon(session.target.targetKind)} autoSizeTextarea={false}
    initialPrompt={initial.current.temporaryPrompt} initialAttachedTabs={initial.current.attachedTabs}
    initialExpanded={initial.current.expanded} initialRulesExpanded={initial.current.rulesExpanded}
    allowEmpty={Boolean(getAiPromptExecutionText({ prompt: record?.prompt || '' }))} allowAttachmentsOnly
    refreshTabsOnAttachmentSearch stripMentionForEligibility showEmptyTabSearch sendBlocked={unknownOutcome}
    readOpenTabs={readTabs} focusRoot={shadowRoot || undefined} onInputRef={onInputRef}
    onDraftChange={draftChanged} onViewChange={viewChanged} isSending={pending} error={session.error}
    onClose={controller.back} onEdit={unknownOutcome ? undefined : () => { void controller.edit(); }}
    onSend={(prompt, tabs) => {
      controller.changeDraft(flowId, prompt, tabs);
      void controller.send().then(accepted => { if (accepted && controller.isAcceptedFlow(flowId)) onSent(); });
    }}/>;
}
