/**
 * Fixed SuperCommands identity shown before the popup search input.
 *
 * The brand is deliberately separate from query state, so typing and Backspace
 * can never modify or remove it.
 */
import cmdOSLogo from '../../../../shared-components/assets/supercommands_logo.png';
import { BRAND_NAME } from '../../../../shared-components/brandingConfig';
export type WebsitePopupSearchBrandProps = {
    label?: string;
};
export function WebsitePopupSearchBrand({ label = BRAND_NAME }: WebsitePopupSearchBrandProps) {
    return (<span className="website-popup-search-brand" role="img" aria-label={label}>
      <img src={cmdOSLogo} alt="" draggable={false}/>
    </span>);
}
