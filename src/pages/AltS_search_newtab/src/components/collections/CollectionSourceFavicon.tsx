import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface Props {
    url: string;
    savedUrl?: string;
    size: number;
}

const isHttpUrl = (value: string | undefined): value is string => {
    if (!value) return false;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); }
    catch { return false; }
};

/** Use a captured icon when available, then the app's existing site-icon resolver. */
const CollectionSourceFavicon = ({ url, savedUrl, size }: Props) => {
    const sourceKey = `${url}|${savedUrl ?? ''}`;
    const [failed, setFailed] = useState<{ sourceKey: string; index: number }>({ sourceKey, index: 0 });
    const derivedUrl = isHttpUrl(url) ? getFaviconUrl(url) : '';
    const candidates = [...new Set([isHttpUrl(savedUrl) ? savedUrl : '', derivedUrl].filter(Boolean))];
    const index = failed.sourceKey === sourceKey ? failed.index : 0;
    const iconUrl = candidates[index];

    return iconUrl
        ? <img src={iconUrl} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="shrink-0 rounded-sm object-contain" onError={() => setFailed({ sourceKey, index: index + 1 })}/>
        : <Globe2 size={size} strokeWidth={1.5} className="shrink-0 text-[var(--color-iconDefault)]" aria-hidden="true"/>;
};

export default CollectionSourceFavicon;
