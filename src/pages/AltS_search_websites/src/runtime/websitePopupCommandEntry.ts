/** Adapt existing Omnibox command identities to the popup routes and execution bridge. */
import { WEBSITE_SAVE_AS_DEFINITIONS } from '../../../../shared-components/commands/websiteSaveAs';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS } from '../../../../shared-components/commands/websitePageExtraction';
import type { WebsitePopupInteractionEvent } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupExecutionBridgeRequest } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
import type { WebsitePopupPageContext } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
export type WebsitePopupCommandEntry = { event: WebsitePopupInteractionEvent } | { operation: WebsitePopupExecutionBridgeRequest['operation'] };
export function resolveWebsitePopupCommandEntry(commandId: string, context: WebsitePopupPageContext): WebsitePopupCommandEntry {
    const saveId = commandId === 'add_to_existing_session' ? 'add_to_existing'
        : commandId === 'save_todo' ? 'todo_chain_save' : commandId;
    const save = WEBSITE_SAVE_AS_DEFINITIONS.find(definition => definition.id === saveId);
    if (save || commandId === 'save_chat') return {
        event: { type: 'MODE_ENTERED', mode: 'save', entity: save?.destinationCategory || 'agent', query: '' },
    };
    if (commandId === 'send_to_agent' || commandId === 'capture_screenshot_tools' || commandId === 'capture_full_screenshot') return {
        event: { type: 'SUBMODE_ENTERED', submode: { id: commandId === 'send_to_agent' ? 'send-agent'
            : commandId === 'capture_full_screenshot' ? 'screenshot-format' : 'screenshot-tools' }, query: '' },
    };
    if (commandId === 'summarize_page') return { operation: { kind: 'summarize-page', context } };
    const actionId = commandId === 'capture_screenshot' ? 'capture_visible_screenshot' : commandId;
    if (actionId === 'capture_visible_screenshot' || actionId === 'capture_clip_screenshot'
        || WEBSITE_PAGE_EXTRACTION_DEFINITIONS.some(definition => definition.id === actionId)) return {
        operation: { kind: 'execute-page-extraction', actionId },
    };
    throw new Error('This page command is not supported by Website Popup: ' + commandId);
}
