/** Autosave feedback in the same footer location used by the Create composer. */
import { useMemo } from 'react';
import { AutoSaveIndicator } from '../../../../shared-components/autoSaveEngine/autoSave';
export type WebsitePopupCollectionItemFooterState = {
    revision: number;
    status: 'waiting' | 'extracting' | 'creating' | 'saved' | 'saving-details' | 'skipped' | 'error';
    canRetry?: boolean;
    error: string | null;
    retry: () => void;
    itemId?: string;
    lastSavedAt?: number;
    message?: string;
};

export function WebsitePopupCollectionItemStatusFooter({ state, presentation = 'inline' }: {
    state: WebsitePopupCollectionItemFooterState | null;
    presentation?: 'inline' | 'standalone';
}) {
    const lastSavedAt = useMemo(() => state?.lastSavedAt ? new Date(state.lastSavedAt) : null, [state?.lastSavedAt]);
    const message = state?.error || (state?.status === 'skipped' ? 'Nothing capturable to save. Choose another element.' : state?.message || (state?.status === 'extracting' ? 'Extracting Article…' : ''));
    const saveStatus = state?.status === 'creating' || state?.status === 'saving-details' ? 'saving'
        : state?.status === 'saved' ? 'saved' : 'idle';
    return <footer className="website-popup-create-footer" data-layout="collection-status" data-presentation={presentation} aria-live="polite">
      {message ? <span className="website-popup-create-footer__error" data-status={state?.error ? 'error' : undefined} role={state?.error ? 'alert' : 'status'}>{message}</span> : null}
      {!message ? <AutoSaveIndicator variant="compact" saveStatus={saveStatus} lastSavedAt={lastSavedAt} activeId={state?.itemId}/> : null}
      {state?.error && state.canRetry !== false ? <span className="website-popup-create-footer__actions">
      <button type="button" className="website-popup-create-footer__save" onClick={state.retry}>Retry</button>
      </span> : null}
    </footer>;
}
