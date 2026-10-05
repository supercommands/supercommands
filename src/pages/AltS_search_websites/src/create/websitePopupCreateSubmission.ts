/** Create submission and partial retries are independent of footer rendering. */
import type { WebsitePopupCreateSession, WebsitePopupInteractionEvent, } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupBaseCreateEntity, WebsitePopupExecutionOutcome, } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupExecutionBridgeRequest } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionBridgeContract';
export function buildWebsitePopupCreateSubmission(session: WebsitePopupCreateSession, entity: string | null, textCommandValue: string, hotkeyValue: string, favoriteEnabled: boolean, createAnother: boolean): WebsitePopupExecutionBridgeRequest['operation'] {
    if (!entity || !['note', 'link', 'todo', 'snippet', 'agent'].includes(entity))
        throw new Error('Unsupported Create category.');
    const createEntity = entity as WebsitePopupBaseCreateEntity;
    const validation = session.textCommandValidation;
    const hotkeyValidation = session.hotkeyValidation;
    const approval = validation?.status === 'approved' ? validation.conflict : undefined;
    const hotkeyApproval = hotkeyValidation?.status === 'approved' ? hotkeyValidation.conflict : undefined;
    return session.favoritePartial
        ? {
            kind: 'assign-created-favorite',
            entity: createEntity,
            entityId: session.favoritePartial.entityId,
            title: session.favoritePartial.title,
            createAnother: createAnother || session.favoritePartial.createAnother,
        }
        : session.todoFollowupPartial
            ? {
                kind: 'complete-created-todo',
                entityId: session.todoFollowupPartial.entityId,
                title: session.todoFollowupPartial.title,
                isAnytime: session.todoFollowupPartial.isAnytime,
                textCommand: textCommandValue.trim(),
                approval,
                hotkey: hotkeyValue.trim(),
                hotkeyApproval,
                favorite: favoriteEnabled,
                createAnother: createAnother || session.todoFollowupPartial.createAnother,
            }
            : session.textCommandPartial
                ? {
                    kind: 'assign-created-text-command',
                    entity: createEntity,
                    entityId: session.textCommandPartial.entityId,
                    title: session.textCommandPartial.title,
                    value: textCommandValue,
                    approval,
                    hotkey: hotkeyValue.trim(),
                    hotkeyApproval,
                    favorite: favoriteEnabled,
                    createAnother: createAnother || session.textCommandPartial.createAnother,
                }
                : session.hotkeyPartial
                    ? {
                        kind: 'assign-created-hotkey',
                        entity: createEntity,
                        entityId: session.hotkeyPartial.entityId,
                        title: session.hotkeyPartial.title,
                        value: hotkeyValue,
                        approval: hotkeyApproval,
                        favorite: favoriteEnabled,
                        createAnother: createAnother || session.hotkeyPartial.createAnother,
                    }
                    : {
                        kind: 'create-entity',
                        entity: createEntity,
                        draft: {
                            fieldValues: session.fieldValues,
                            modelSelection: session.modelSelection ?? undefined,
                            selectedValuesByField: session.selectedValuesByField,
                            textCommandApproval: approval,
                            hotkeyApproval,
                        },
                        createAnother,
                    };
}
export function applyWebsitePopupCreateOutcome(outcome: WebsitePopupExecutionOutcome, session: WebsitePopupCreateSession, dispatch: (event: WebsitePopupInteractionEvent) => void): {
    close: boolean;
    error: string | null;
} {
    let error: string | null = null;
    const setError = (message: string) => {
        error = message;
    };
    if (outcome.status === 'entity-created-todo-followup-pending') {
        dispatch({
            type: 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED',
            partial: {
                entityId: outcome.entityId,
                title: outcome.title,
                message: outcome.message,
                isAnytime: outcome.isAnytime,
                createAnother: outcome.createAnother,
            },
        });
        setError(`"${outcome.title}" was created, but its alarm setup needs retry: ${outcome.message}`);
        return { close: false, error };
    }
    if (outcome.status === 'entity-created-shortcut-pending') {
        if (session.todoFollowupPartial) {
            dispatch({ type: 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED', partial: null });
        }
        dispatch({
            type: 'CREATE_TEXT_COMMAND_PARTIAL_CHANGED',
            partial: {
                entityId: outcome.entityId,
                title: outcome.title,
                message: outcome.message,
                createAnother: outcome.createAnother,
            },
        });
        setError(`"${outcome.title}" was created, but its Text Command was not assigned: ${outcome.message}`);
        return { close: false, error };
    }
    if (outcome.status === 'entity-created-favorite-pending') {
        if (session.todoFollowupPartial)
            dispatch({ type: 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED', partial: null });
        if (session.textCommandPartial)
            dispatch({ type: 'CREATE_TEXT_COMMAND_PARTIAL_CHANGED', partial: null });
        if (session.hotkeyPartial)
            dispatch({ type: 'CREATE_HOTKEY_PARTIAL_CHANGED', partial: null });
        dispatch({
            type: 'CREATE_FAVORITE_PARTIAL_CHANGED',
            partial: {
                entityId: outcome.entityId,
                title: outcome.title,
                message: outcome.message,
                createAnother: outcome.createAnother,
            },
        });
        setError(`"${outcome.title}" was created, but Favorite was not added: ${outcome.message}`);
        return { close: false, error };
    }
    if (outcome.status === 'entity-created-hotkey-pending') {
        if (session.todoFollowupPartial)
            dispatch({ type: 'CREATE_TODO_FOLLOWUP_PARTIAL_CHANGED', partial: null });
        if (session.textCommandPartial)
            dispatch({ type: 'CREATE_TEXT_COMMAND_PARTIAL_CHANGED', partial: null });
        dispatch({
            type: 'CREATE_HOTKEY_PARTIAL_CHANGED',
            partial: {
                entityId: outcome.entityId,
                title: outcome.title,
                message: outcome.message,
                createAnother: outcome.createAnother,
            },
        });
        setError(`"${outcome.title}" was created, but its Hotkey was not assigned: ${outcome.message}`);
        return { close: false, error };
    }
    if (outcome.status !== 'entity-created')
        throw new Error('The Create request returned an unexpected result.');
    if (outcome.createAnother) {
        dispatch({ type: 'CREATE_RESET_FOR_ANOTHER' });
    }
    else {
        return { close: true, error: null };
    }
    return { close: false, error };
}
