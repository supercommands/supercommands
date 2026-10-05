import { useChromeStorage } from '@extension/shared/lib/hooks/useChromeStorage';
import {
    ALT_S_WEBSITE_BACKDROP_BLUR_KEY,
    DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH,
    getAltSWebsiteBackdropBlurPixels,
    type AltSWebsiteBackdropBlurPreference,
} from '../../../../storage/localStorage/uxCustomizationStorage';
import { WebsitePopupLayer, type WebsitePopupLayerProps } from './WebsitePopupLayer';

/** Reuse the Settings/legacy preference without giving the visual layer storage ownership. */
export function ConnectedWebsitePopupLayer({ surface, suppressBackdropBlur = false, ...props }: WebsitePopupLayerProps & {
    surface: 'website' | 'newtab';
    /** Keep the page readable while the standalone Web Clips panel is active. */
    suppressBackdropBlur?: boolean;
}) {
    const [preference] = useChromeStorage<AltSWebsiteBackdropBlurPreference>(
        ALT_S_WEBSITE_BACKDROP_BLUR_KEY,
        DEFAULT_ALT_S_WEBSITE_BACKDROP_BLUR_STRENGTH,
    );
    return <WebsitePopupLayer {...props} backdropBlurPixels={surface === 'website' && !suppressBackdropBlur
        ? getAltSWebsiteBackdropBlurPixels(preference) : 0}/>;
}
