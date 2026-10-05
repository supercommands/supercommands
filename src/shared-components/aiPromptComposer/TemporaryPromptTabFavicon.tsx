import { useEffect, useState } from 'react';
import { getFaviconUrl } from '../searchBarMain/utilityFunctions/utils';
import type { TemporaryPromptTabAttachment } from './temporaryPromptComposition';
type WebsitePopupOpenTabOption = TemporaryPromptTabAttachment;
export const TemporaryPromptTabFavicon = ({ tab, className = '' }: {
    tab: WebsitePopupOpenTabOption;
    className?: string;
}) => {
    const fallbackUrl = getFaviconUrl(tab.url);
    const [iconUrl, setIconUrl] = useState(tab.favIconUrl || fallbackUrl);
    useEffect(() => {
        setIconUrl(tab.favIconUrl || fallbackUrl);
    }, [fallbackUrl, tab.favIconUrl]);
    return (<span className={`relative flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
      {iconUrl ? (<img src={iconUrl} alt="" className="h-full w-full rounded-sm object-contain" onError={() => {
                if (iconUrl !== fallbackUrl)
                    setIconUrl(fallbackUrl);
                else
                    setIconUrl('');
            }}/>) : <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-altsIconColor,var(--color-iconDefault))]"/>}
    </span>);
};
