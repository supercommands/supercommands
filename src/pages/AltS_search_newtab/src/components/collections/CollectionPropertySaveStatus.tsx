import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import type { useCollectionItemProperties } from './hooks/useCollectionItemProperties';

interface Props {
  controller: ReturnType<typeof useCollectionItemProperties>;
  itemId: string;
}

export default function CollectionPropertySaveStatus({ controller, itemId }: Props) {
  return <div className="min-w-0 text-xs text-[var(--color-textMuted)]">
    {controller.error ? <div role="alert" className="flex flex-col gap-1">
      <span className="text-[var(--color-danger)]">{controller.error}</span>
      <button type="button" disabled={controller.pending} onClick={() => { void controller.retry(); }} className="rounded-lg px-2 py-1 text-left text-xs text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:opacity-50">Reload and retry</button>
    </div> : <AutoSaveIndicator variant="compact" className="inline-flex items-center gap-1.5 whitespace-nowrap [&_svg]:text-[var(--color-success)]"
      saveStatus={controller.status} lastSavedAt={controller.lastSavedAt} isDirty={controller.isDirty} activeId={itemId} />}
  </div>;
}
