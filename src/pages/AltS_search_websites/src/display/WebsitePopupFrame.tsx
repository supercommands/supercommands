/**
 * Responsive shell grid for the header and results viewport.
 * All measurements are consumed from the central popup design-token stylesheet.
 */
import type React from 'react';
import type { WebsitePopupCreatePresentation } from '../interaction/websitePopupInteractionTypes';
export type WebsitePopupFrameProps = {
    header: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    sidePanel?: React.ReactNode;
    presentation?: WebsitePopupCreatePresentation;
};
export function WebsitePopupFrame({ header, children, footer, sidePanel, presentation = 'inline' }: WebsitePopupFrameProps) {
    return (<div className="website-popup-frame" data-presentation={presentation} data-has-footer={footer && presentation === 'inline' ? 'true' : 'false'} data-has-side-panel={sidePanel ? 'true' : 'false'}>
      {presentation === 'standalone' ? <div hidden>{header}</div> : header}
      {children}
      {footer}
      {sidePanel}
    </div>);
}
