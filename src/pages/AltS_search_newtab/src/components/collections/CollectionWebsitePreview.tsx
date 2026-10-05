import CollectionSourceFavicon from './CollectionSourceFavicon';

interface Props {
  url: string;
  savedFaviconUrl?: string;
  excerpt?: string;
}

const domainFor = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** A consistent media-sized preview when the item has no saved image. */
const CollectionWebsitePreview = ({ url, savedFaviconUrl, excerpt }: Props) => {
  const domain = domainFor(url);
  return excerpt ? (
    <span className="flex h-full w-full min-w-0 flex-col justify-center gap-3 overflow-hidden px-4 py-3">
      <span className="flex min-w-0 items-center gap-2 text-xs text-[var(--color-textMuted)]">
        <CollectionSourceFavicon url={url} savedUrl={savedFaviconUrl} size={20} />
        <span className="truncate" title={domain}>
          {domain}
        </span>
      </span>
      <span className="line-clamp-3 overflow-hidden text-sm leading-5 text-[var(--color-textSecondary)]">
        {excerpt}
      </span>
    </span>
  ) : (
    <span className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-3 text-center">
      <CollectionSourceFavicon url={url} savedUrl={savedFaviconUrl} size={40} />
      <span className="w-full truncate text-sm text-[var(--color-textSecondary)]" title={domain}>
        {domain}
      </span>
    </span>
  );
};

export default CollectionWebsitePreview;
