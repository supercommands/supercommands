import { Camera } from 'lucide-react';
import { useCollectionAsset } from './hooks/useCollectionAsset';

interface Props {
  organisationId: string;
  itemId: string;
  assetIds: string[];
  visible: boolean;
}

const placements = [
  'z-10 translate-y-1',
  '-translate-x-4 -rotate-6',
  'translate-x-4 rotate-6',
  '-translate-y-3 rotate-3',
] as const;

const CollageImage = ({
  organisationId,
  itemId,
  assetId,
  visible,
  index,
}: Omit<Props, 'assetIds'> & { assetId: string; index: number }) => {
  const preview = useCollectionAsset(organisationId, itemId, assetId, visible);
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-x-7 inset-y-2 flex items-center justify-center overflow-hidden rounded-sm bg-[var(--color-cardBg)] ${placements[index]}`}>
      {preview.url ? (
        <img src={preview.url} alt="" className="h-full w-full object-contain object-bottom" />
      ) : preview.status === 'error' ? (
        <Camera size={24} strokeWidth={1.5} className="text-[var(--color-iconDefault)]" />
      ) : null}
    </span>
  );
};

const CollectionWebScrapingCollage = ({ organisationId, itemId, assetIds, visible }: Props) => (
  <span className="relative block h-full w-full overflow-hidden" aria-hidden="true">
    {assetIds.map((assetId, index) => (
      <CollageImage
        key={assetId}
        organisationId={organisationId}
        itemId={itemId}
        assetId={assetId}
        visible={visible}
        index={index}
      />
    ))}
  </span>
);

export default CollectionWebScrapingCollage;
