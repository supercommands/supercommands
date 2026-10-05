/** Always-visible right-panel model editor shared by Create and result editing. */
import { WebsitePopupAiPromptModelPicker } from '../results/WebsitePopupAiPromptModelPicker';
import type { WebsitePopupAiPromptModelValue } from '../../../../shared-components/websitePopup/websitePopupModelSelection';
export function WebsitePopupModelSelectionField({ value, onChange, disabled = false }: {
    value: WebsitePopupAiPromptModelValue;
    onChange: (value: WebsitePopupAiPromptModelValue) => void;
    disabled?: boolean;
}) {
    return <fieldset className="website-popup-model-selection-field" disabled={disabled}>
    <WebsitePopupAiPromptModelPicker value={value} onChange={onChange} inline/>
  </fieldset>;
}
