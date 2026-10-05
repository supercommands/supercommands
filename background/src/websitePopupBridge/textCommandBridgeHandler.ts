/** Background-owned validation shared with new-tab and board assignment controls. */
export { checkShortcutAssignment as checkWebsitePopupTextCommand } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
import { checkShortcutAssignment, checkPrefixShortcutAssignment } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
import { isWebsitePopupTextCommandBridgeRequest, type WebsitePopupTextCommandBridgeResponse } from '../../../src/shared-components/websitePopup/contracts/websitePopupTextCommandBridgeContract';
export function handleWebsitePopupTextCommandBridgeMessage(message: unknown, sendResponse: (response: WebsitePopupTextCommandBridgeResponse) => void): boolean {
  if (!isWebsitePopupTextCommandBridgeRequest(message)) return false;
  void (message.prefixTarget ? checkPrefixShortcutAssignment(message.value, message.prefixTarget.type, message.prefixTarget.category)
    : checkShortcutAssignment(message.value, message.currentReferenceId))
    .then(check => sendResponse({ success: true, check }))
    .catch(error => sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) }));
  return true;
}

