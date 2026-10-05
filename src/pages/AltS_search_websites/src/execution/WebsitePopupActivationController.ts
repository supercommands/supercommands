/**
 * Single popup activation router for click, keyboard Enter, and committing Space.
 *
 * Providers supply typed intents; this controller owns deduplication, mode
 * transitions, bridge dispatch, and structured failures.
 */
import type { WebsitePopupInteractionEvent } from '../interaction/websitePopupInteractionTypes';
import { resolveWebsitePopupEntryPresentation } from '../interaction/websitePopupPresentation';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import { captureCollectionSource } from '../../../../shared-components/collections/collectionCaptureSource';
import type { WebsitePopupActivationRequest, WebsitePopupExecutionOutcome, WebsitePopupPageContext, } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
type WebsitePopupActivationControllerOptions = {
    dispatch: (event: WebsitePopupInteractionEvent) => void;
    capturePageContext: () => WebsitePopupPageContext;
    isCollectionMode?: () => boolean;
};
export class WebsitePopupActivationController {
    #options: WebsitePopupActivationControllerOptions;
    #pendingRequestId: string | null = null;
    #lastActivation: {
        rowId: string;
        at: number;
    } | null = null;
    constructor(options: WebsitePopupActivationControllerOptions) {
        this.#options = options;
    }
    updateOptions(options: WebsitePopupActivationControllerOptions) {
        this.#options = options;
    }
    get pending(): boolean {
        return this.#pendingRequestId !== null;
    }
    async activate(request: WebsitePopupActivationRequest): Promise<WebsitePopupExecutionOutcome> {
        const now = Date.now();
        if (this.#pendingRequestId)
            return { status: 'failed', message: 'An action is already running.' };
        if (this.#lastActivation?.rowId === request.rowId && now - this.#lastActivation.at < 400) {
            return { status: 'cancelled' };
        }
        this.#pendingRequestId = request.requestId;
        this.#lastActivation = { rowId: request.rowId, at: now };
        try {
            const intent = request.intent;
            if (intent.kind === 'open-web-collection') {
                return await executeWebsitePopupBridgeOperation({ kind: intent.kind, organisationId: intent.organisationId, collectionId: intent.collectionId });
            }
            if (intent.kind === 'select-collection') {
                this.#options.dispatch({ type: 'COLLECTION_SELECTED', id: intent.collectionId });
                if (!this.#options.isCollectionMode?.())
                    this.#options.dispatch({ type: 'SUBMODE_ENTERED', submode: { id: 'collection-actions' } });
                return { status: 'cancelled' };
            }
            if (intent.kind === 'open-web-collection-item') {
                return await executeWebsitePopupBridgeOperation({ kind: intent.kind, organisationId: intent.organisationId, collectionId: intent.collectionId, itemId: intent.itemId });
            }
            if (intent.kind === 'collection-mode') {
                this.#options.dispatch({ type: 'SUBMODE_ENTERED', submode: { id: intent.mode }, presentation: resolveWebsitePopupEntryPresentation(request.source) });
                return { status: 'cancelled' };
            }
            if (intent.kind === 'collection-capture-start') {
                const sourceContext = await captureCollectionSource(document);
                if (intent.entry === 'direct') {
                    this.#options.dispatch({ type: 'COLLECTION_SELECTED', id: null });
                    this.#options.dispatch({ type: 'SUBMODE_ENTERED', submode: { id: 'collection-actions' }, presentation: resolveWebsitePopupEntryPresentation(request.source) });
                }
                this.#options.dispatch({ type: 'COLLECTION_CAPTURE_STARTED', itemType: intent.itemType, sourceUrl: sourceContext.url, sourceContext });
                return { status: 'cancelled' };
            }
            if (intent.kind === 'collection-destination-select') {
                this.#options.dispatch({ type: 'COLLECTION_DESTINATION_CHOSEN', id: intent.collectionId, name: intent.collectionName });
                return { status: 'cancelled' };
            }
            if (intent.kind === 'enter-mode') {
                const modeEntry = {
                    type: 'MODE_ENTERED',
                    entity: intent.entity ?? null,
                    // A visible row starts a fresh submode. Parsed command invocations
                    // provide their own extracted remainder when they intentionally need
                    // to filter the destination list.
                    query: intent.query ?? '',
                    returnToCreateChooser: intent.returnToCreateChooser,
                } as const;
                this.#options.dispatch(intent.mode === 'create'
                    ? { ...modeEntry, mode: 'create', presentation: resolveWebsitePopupEntryPresentation(request.source) }
                    : { ...modeEntry, mode: intent.mode });
                return { status: 'mode-entered', mode: intent.mode };
            }
            // Result-layer selection commits this intent to the in-memory Create
            // draft. It is intentionally never an extension/background operation.
            if (intent.kind === 'create-property-select' || intent.kind === 'create-option-add') {
                return { status: 'cancelled' };
            }
            if (intent.kind === 'open-entity') {
                return await executeWebsitePopupBridgeOperation({
                    kind: 'open-entity',
                    entity: intent.entity,
                    targetId: intent.targetId,
                });
            }
            if (intent.kind === 'save-page-to-entity') {
                const context = this.#options.capturePageContext();
                return await executeWebsitePopupBridgeOperation({
                    kind: 'save-page-to-entity',
                    entity: intent.entity,
                    targetId: intent.targetId,
                    page: { url: context.url, title: context.title },
                });
            }
            if (intent.kind === 'page-extraction') {
                if (intent.actionId === 'capture_screenshot_tools') {
                    return { status: 'manual-surface-opened', actionId: intent.actionId };
                }
                return await executeWebsitePopupBridgeOperation({
                    kind: 'execute-page-extraction',
                    actionId: intent.actionId,
                });
            }
            if (intent.kind === 'page-action') {
                if (intent.actionId === 'send_to_agent') {
                    return { status: 'manual-surface-opened', actionId: intent.actionId };
                }
                return await executeWebsitePopupBridgeOperation({
                    kind: 'summarize-page',
                    context: this.#options.capturePageContext(),
                });
            }
            return { status: 'failed', message: 'Unsupported website popup action.' };
        }
        catch (error: unknown) {
            return {
                status: 'failed',
                message: error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            this.#pendingRequestId = null;
        }
    }
}
