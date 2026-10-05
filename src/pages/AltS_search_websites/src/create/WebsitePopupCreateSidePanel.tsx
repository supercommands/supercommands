/** Compatibility adapter: Create grammar supplies labels and supported picker identities. */
import type { ReactNode } from 'react';
import type { WebsitePopupCreateEntityGrammar } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import { getWebsitePopupEntityLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
import type { WebsitePopupCreatePresentation } from '../interaction/websitePopupInteractionTypes';
import { WebsitePopupFormPanel } from '../display/WebsitePopupFormPanel';

export type WebsitePopupCreateSidePanelProps = {
    children?: ReactNode;
    additionalProperties?: ReactNode;
    grammar: WebsitePopupCreateEntityGrammar;
    presentation?: WebsitePopupCreatePresentation;
    label?: string;
    onPanelMount?: (element: HTMLElement | null) => void;
    onCollapse: () => void;
    onPropertiesMount: (element: HTMLDivElement | null) => void;
    onPickerMount: (element: HTMLDivElement | null) => void;
    activePickerField: string | null;
    onSaveMount: (element: HTMLDivElement | null) => void;
};

export function WebsitePopupCreateSidePanel({ children, additionalProperties, grammar, presentation = 'inline', label,
    onPanelMount, onCollapse, onPropertiesMount, onPickerMount, activePickerField, onSaveMount }: WebsitePopupCreateSidePanelProps) {
    const pickerField = grammar.fields.find(field => field.field === activePickerField
        && (field.kind === 'multiSelect' || field.kind === 'singleSelect'));
    return <WebsitePopupFormPanel
      label={label || getWebsitePopupEntityLabel(grammar.entity)} presentation={presentation}
      contentBeforeFields={additionalProperties} activePickerFieldId={pickerField?.field || null}
      onPanelMount={onPanelMount} onEscape={onCollapse} onFieldsMount={onPropertiesMount}
      onPickerMount={onPickerMount} onFooterMount={onSaveMount}
    >{children}</WebsitePopupFormPanel>;
}
