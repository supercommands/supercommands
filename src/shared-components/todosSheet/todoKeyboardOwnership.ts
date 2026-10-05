/** Keep Todo keyboard handling inside the active surface and its own portals. */
export const isTodoKeyboardEventWithin = (target: EventTarget | null, root: Element | null, portalSelector?: string): target is Element => target instanceof Element &&
    (Boolean(root?.contains(target)) || Boolean(portalSelector && target.closest(portalSelector)));
/** A focused Todo child handles Escape before the page-level editor hierarchy. */
export const hasTodoLocalEscapeOwner = (target: EventTarget | null): boolean => (target instanceof Element && Boolean(target.closest('[data-todo-local-escape="true"]'))) ||
    (typeof document !== 'undefined' &&
        document.activeElement instanceof Element &&
        Boolean(document.activeElement.closest('[data-todo-local-escape="true"]')));
