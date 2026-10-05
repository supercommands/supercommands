/**
 * Presentation-only Shadow DOM host for the website popup.
 *
 * This component owns the Shadow DOM boundary and injects its narrowly scoped
 * stylesheet there. Internal selectors are isolated; the outer host still
 * needs protection from document styles and inherited typography. It
 * intentionally contains no Alt+S command, search, persistence, or Chrome API
 * logic; later feature layers render through its `children` slot.
 */
import type React from 'react';
import type { WebsitePopupCreatePresentation } from '../interaction/websitePopupInteractionTypes';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_THEME_ID, getTheme } from '@extension/ui/lib/theme/registry';
import { createWebsitePopupThemeVariables } from '../theme/createWebsitePopupThemeVariables';
import websitePopupDesignTokens from '../styles/websitePopupDesignTokens.css?inline';
import websitePopupScrollbarStyles from '../styles/websitePopupScrollbar.css?inline';
import websitePopupFonts from '../styles/websitePopupFonts.css?inline';
import websitePopupPanelStyles from '../styles/websitePopupPanels.css?inline';
import websitePopupComposerStyles from '../styles/websitePopupComposer.css?inline';
import websitePopupDisplayStyles from '../styles/websitePopupDisplay.css?inline';
import websitePopupLayerStyles from '../styles/websitePopupLayer.css?inline';
import websitePopupScreenshotStyles from '../styles/websitePopupScreenshot.css?inline';
import websitePopupCollectionPreviewStyles from '../styles/websitePopupCollectionPreview.css?inline';
export type WebsitePopupLayerProps = {
    open: boolean;
    presentation?: WebsitePopupCreatePresentation;
    dialogLabel?: string;
    /** Hide immediately for capture without closing or unmounting the popup. */
    suspended?: boolean;
    themeId?: string;
    /** Existing website blur preference, converted to pixels by the connected layer. */
    backdropBlurPixels?: number;
    children?: React.ReactNode;
    captureOverlay?: React.ReactNode;
    onRequestClose?: () => void;
    onAfterClose?: () => void;
    onShadowMountChange?: (mount: WebsitePopupShadowMount | null) => void;
};
export type WebsitePopupShadowMount = {
    host: HTMLDivElement;
    shadowRoot: ShadowRoot;
};
type ShadowMount = {
    host: HTMLDivElement;
    shadowRoot: ShadowRoot;
    portal: HTMLDivElement;
    style: HTMLStyleElement;
};
const EXIT_TRANSITION_MS = 160;
const websitePopupStyles = [
    websitePopupFonts,
    websitePopupDesignTokens,
    websitePopupScrollbarStyles,
    websitePopupLayerStyles,
    websitePopupPanelStyles,
    websitePopupComposerStyles,
    websitePopupDisplayStyles,
    websitePopupScreenshotStyles,
    websitePopupCollectionPreviewStyles
].join('\n');
export function WebsitePopupLayer({ open, presentation = 'inline', dialogLabel, suspended = false, captureOverlay, themeId = DEFAULT_THEME_ID, backdropBlurPixels = 0, children, onRequestClose, onAfterClose, onShadowMountChange, }: WebsitePopupLayerProps) {
    const [mount, setMount] = useState<ShadowMount | null>(null);
    const [shouldRender, setShouldRender] = useState(open);
    const [isVisible, setIsVisible] = useState(false);
    const themeProfile = useMemo(() => getTheme(themeId), [themeId]);
    useEffect(() => {
        const host = document.createElement('div');
        host.dataset.websitePopupLayerHost = 'true';
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = websitePopupStyles;
        shadowRoot.appendChild(style);
        const portal = document.createElement('div');
        portal.dataset.websitePopupLayerPortal = 'true';
        shadowRoot.appendChild(portal);
        document.body.appendChild(host);
        setMount({ host, shadowRoot, portal, style });
        return () => {
            host.remove();
        };
    }, []);
    const shadowMount = useMemo(() => mount ? { host: mount.host, shadowRoot: mount.shadowRoot } : null, [mount]);
    useLayoutEffect(() => {
        if (!shadowMount) return;
        onShadowMountChange?.(shadowMount);
        return () => onShadowMountChange?.(null);
    }, [shadowMount, onShadowMountChange]);
    // Inline CSS imports can change during development while this host stays mounted.
    useLayoutEffect(() => {
        if (mount)
            mount.style.textContent = websitePopupStyles;
    }, [mount, websitePopupStyles]);
    useLayoutEffect(() => {
        if (!mount)
            return;
        const themeVariables = createWebsitePopupThemeVariables(themeProfile.tokens, themeProfile.glassOpacity);
        Object.entries(themeVariables).forEach(([property, value]) => {
            mount.host.style.setProperty(property, value);
        });
        mount.host.style.setProperty('--glass-blur', `blur(${themeProfile.glassBlur}) saturate(1.2)`);
        mount.host.style.setProperty('color-scheme', themeProfile.isDark ? 'dark' : 'light');
    }, [mount, themeProfile]);
    useEffect(() => {
        if (open) {
            setShouldRender(true);
            const frame = window.requestAnimationFrame(() => setIsVisible(true));
            return () => window.cancelAnimationFrame(frame);
        }
        setIsVisible(false);
        const timer = window.setTimeout(() => {
            setShouldRender(false);
            onAfterClose?.();
        }, EXIT_TRANSITION_MS);
        return () => window.clearTimeout(timer);
    }, [onAfterClose, open]);
    if (!mount || !shouldRender)
        return null;
    return createPortal(<><div className="website-popup-layer" data-presentation={presentation} hidden={suspended} style={suspended ? { display: 'none' } : undefined} data-visible={isVisible ? 'true' : 'false'}>
      <button type="button" className="website-popup-backdrop" aria-label="Close website popup" tabIndex={-1} onClick={onRequestClose} style={open && !suspended && backdropBlurPixels > 0 ? {
        backdropFilter: `blur(${backdropBlurPixels}px)`,
        WebkitBackdropFilter: `blur(${backdropBlurPixels}px)`,
      } : undefined}/>
      <div className="website-popup-surface" data-presentation={presentation} role="dialog" aria-label={dialogLabel || (presentation === 'standalone' ? 'Create' : 'Website popup')} onClick={event => event.stopPropagation()}>
        {children}
      </div>
    </div>{open ? captureOverlay : null}</>, mount.portal);
}
