/**
 * Slot-based 56px popup header.
 * It owns only layout and typography; future inputs retain their own behavior.
 */
import type React from 'react';
export type WebsitePopupHeaderProps = {
    children: React.ReactNode;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    leadingLayout?: 'icon' | 'identity';
    composerLayout?: boolean;
};
export function WebsitePopupHeader({ children, leading, trailing, leadingLayout = 'icon', composerLayout = false, }: WebsitePopupHeaderProps) {
    return (<header className="website-popup-header" data-has-leading={leading ? 'true' : 'false'} data-has-trailing={trailing ? 'true' : 'false'} data-leading-layout={leadingLayout} data-composer-layout={composerLayout ? 'true' : 'false'}>
      {leading ? (<span className="website-popup-header__leading">
          <span className="website-popup-header__navigation">{leading}</span>
        </span>) : null}
      <div className="website-popup-header__content">{children}</div>
      {trailing ? <span className="website-popup-header__trailing">{trailing}</span> : null}
    </header>);
}
