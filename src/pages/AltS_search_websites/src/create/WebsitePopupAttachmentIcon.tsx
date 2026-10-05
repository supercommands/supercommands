/** One popup icon mapping for Todo attachment results and selected chips. */
import { FiFileText, FiLink, FiSend } from 'react-icons/fi';
import type { WebsitePopupAttachmentOption } from '../../../../shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
export function WebsitePopupAttachmentIcon({ type, className, }: {
    type: WebsitePopupAttachmentOption['type'];
    className?: string;
}) {
    const icons = {
        note: FiFileText,
        link: FiLink,
        aiPrompt: FiSend,
        agent: FiSend,
    };
    const Icon = icons[type];
    return <Icon className={className} aria-hidden="true"/>;
}
