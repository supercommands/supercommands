import type { WebsitePopupResolvedRow } from '../results/websitePopupResultsTypes';
import type { WebsitePopupActivationRequest, WebsitePopupExecutionOutcome, } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
/** Bulk orchestration only; each item still uses the existing normal activation authority. */
export class WebsitePopupTextCommandActivationController {
    pending = false;
    async activate(rows: readonly WebsitePopupResolvedRow[], activate: (request: WebsitePopupActivationRequest) => Promise<WebsitePopupExecutionOutcome>) {
        if (this.pending)
            return null;
        this.pending = true;
        const seen = new Set<string>();
        const failures: string[] = [];
        try {
            for (const row of rows) {
                if (row.disabled || (row.intent.kind !== 'open-entity' && row.intent.kind !== 'open-web-collection'))
                    continue;
                const identity = row.intent.kind === 'open-web-collection'
                    ? `webCollection:${row.intent.organisationId}:${row.intent.collectionId}`
                    : `${row.intent.entity}:${row.intent.targetId}`;
                if (seen.has(identity))
                    continue;
                seen.add(identity);
                try {
                    const outcome = await activate({
                        source: 'click',
                        intent: row.intent,
                        rowId: row.id,
                        requestId: crypto.randomUUID(),
                    });
                    if (outcome.status === 'failed')
                        failures.push(outcome.message);
                    else if (row.intent.kind === 'open-web-collection'
                        ? outcome.status !== 'action-executed' || outcome.actionId !== 'open-web-collection'
                        : outcome.status !== 'entity-opened')
                        failures.push(`Could not open ${String(row.title)}.`);
                }
                catch (error) {
                    failures.push(error instanceof Error ? error.message : String(error));
                }
            }
            return { failures };
        }
        finally {
            this.pending = false;
        }
    }
}
