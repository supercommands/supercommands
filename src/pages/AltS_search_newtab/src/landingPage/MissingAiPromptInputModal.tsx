/** New Tab host adapter; public props and omnibox behaviour are retained. */
import { useMemo, type CSSProperties } from 'react';
import { useAppearance } from '@extension/ui';
import { TemporaryPromptComposer, type TemporaryPromptComposerProps } from '../../../../shared-components/aiPromptComposer/TemporaryPromptComposer';
import type { TemporaryPromptTabAttachment } from '../../../../shared-components/aiPromptComposer/temporaryPromptComposition';
import { readWebsitePopupOpenTabs } from '../../../AltS_search_websites/src/bridge/websitePopupCreateOptionsBridge';
import { createWebsitePopupThemeVariables } from '../../../AltS_search_websites/src/theme/createWebsitePopupThemeVariables';
import '../../../AltS_search_websites/src/styles/websitePopupDesignTokens.css';
import '../../../AltS_search_websites/src/styles/websitePopupScrollbar.css';
export type MissingAiPromptTabAttachment = TemporaryPromptTabAttachment;
export type MissingAiPromptInputModalProps = Pick<TemporaryPromptComposerProps,
    'title' | 'rules' | 'initialPrompt' | 'allowEmpty' | 'isSending' | 'onClose' | 'onEdit' | 'onSend'>;
const subscribeTabRemoved = (onRemoved: (tabId: number) => void) => {
    const tabsApi = typeof chrome === 'undefined' ? undefined : chrome.tabs;
    if (!tabsApi?.onRemoved) return () => {};
    tabsApi.onRemoved.addListener(onRemoved);
    return () => tabsApi.onRemoved.removeListener(onRemoved);
};
export function MissingAiPromptInputModal(props: MissingAiPromptInputModalProps) {
    const { theme } = useAppearance();
    const themeVariables = useMemo(() => createWebsitePopupThemeVariables(theme.tokens, theme.glassOpacity), [theme]) as CSSProperties;
    return <TemporaryPromptComposer {...props} themeVariables={themeVariables}
        readOpenTabs={readWebsitePopupOpenTabs} subscribeTabRemoved={subscribeTabRemoved}
        focusRoot={document} keyboardTarget={window}/>;
}
