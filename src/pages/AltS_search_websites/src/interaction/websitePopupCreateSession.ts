import { createWebsitePopupModelSelection } from '../../../../shared-components/websitePopup/websitePopupModelSelection';
export const createWebsitePopupCreateSession = (entity: string | null | undefined) => entity
    ? {
        entity,
        modelSelection: entity === 'agent' ? createWebsitePopupModelSelection() : null,
        activeArgumentId: null,
        visibleFieldOrder: [],
        fieldSources: {},
        fieldValues: {},
        fieldsHydrated: false,
        propertyEntryOpen: false,
        propertyPrefixDraft: '',
        childMode: null,
        lastExitedChildField: null,
        argumentQueries: {},
        selectedValuesByField: {},
        committedOptionalFieldOrder: [],
        textCommandValidation: { status: 'empty' as const, value: '' as const },
        textCommandPartial: null,
        favoritePartial: null,
        todoFollowupPartial: null,
        hotkeyValidation: { status: 'empty' as const, value: '' as const },
        hotkeyCapture: { status: 'idle' as const, token: null, error: null },
        hotkeyPartial: null,
        focusRequest: null,
    }
    : null;
