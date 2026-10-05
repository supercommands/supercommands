import { isPageCaptureUi } from '../pageCaptureDocument';
export interface ElementSelectionRect { x: number; y: number; width: number; height: number }

/** The live Element is transient and must never enter storage or runtime messages. */
export interface ElementPickerSelection { element: Element; rect: ElementSelectionRect }
export interface ElementPicker {
  confirm(): void;
  reselect(): void;
  dispose(): void;
}

/** Top-document picker. Overlay/shadow-host hits and document roots are excluded. */
export function startElementPicker({ document, overlay, onChange, onConfirm, onCancel }: {
  document: Document;
  overlay: HTMLElement;
  onChange: (selection: ElementPickerSelection | null, selected: boolean) => void;
  onConfirm: (element: Element) => void;
  onCancel: () => void;
}): ElementPicker {
  const view = document.defaultView;
  if (!view) throw new Error('Element selection requires a live page document.');
  const root = overlay.getRootNode();
  const host = root instanceof ShadowRoot ? root.host : overlay;
  const previousFocus = root instanceof ShadowRoot ? root.activeElement || document.activeElement : document.activeElement;
  let active = true;
  let selected = false;
  let target: Element | null = null;
  let point: { x: number; y: number } | null = null;
  let frame = 0;
  let pressed = false;
  const uiEvent = (event: Event) => event.composedPath().includes(overlay);
  const eligible = (element: Element) => element.isConnected && element.ownerDocument === document
    && element !== document.documentElement && element !== document.body
    && element !== host && !host.contains(element)
    && !isPageCaptureUi(element)
    && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName);
  const notify = () => {
    if (!active) return;
    if (target && !eligible(target)) { target = null; selected = false; }
    const bounds = target?.getBoundingClientRect();
    const x = Math.max(0, bounds?.left || 0), y = Math.max(0, bounds?.top || 0);
    const width = bounds ? Math.min(view.innerWidth, bounds.right) - x : 0;
    const height = bounds ? Math.min(view.innerHeight, bounds.bottom) - y : 0;
    onChange(target && width > 0 && height > 0 ? { element: target, rect: { x, y, width, height } } : null, selected);
  };
  const hit = () => {
    if (!selected && point) target = document.elementsFromPoint(point.x, point.y).find(eligible) || null;
    notify();
  };
  const schedule = () => { if (active && !frame) frame = view.requestAnimationFrame(() => { frame = 0; hit(); }); };
  const move = (event: PointerEvent) => {
    if (!active || selected || uiEvent(event)) return;
    point = { x: event.clientX, y: event.clientY }; schedule();
  };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const down = (event: PointerEvent) => {
    if (!active || uiEvent(event)) return;
    stop(event);
    pressed = event.button === 0 && event.isPrimary;
    if (!selected) { point = { x: event.clientX, y: event.clientY }; hit(); }
  };
  const up = (event: PointerEvent) => {
    if (!active || uiEvent(event)) { pressed = false; return; }
    stop(event);
    if (pressed && event.button === 0 && !selected) {
      point = { x: event.clientX, y: event.clientY }; hit();
      if (target) { selected = true; notify(); }
    }
    pressed = false;
  };
  const click = (event: Event) => { if (active && !uiEvent(event)) stop(event); };
  const interrupted = () => { pressed = false; };
  const cancel = () => { if (!active) return; dispose(); onCancel(); };
  const key = (event: KeyboardEvent) => {
    if (!active) return;
    if (event.key === 'Escape') { stop(event); cancel(); }
    else if (!uiEvent(event)) stop(event);
  };
  const visibility = () => { if (document.hidden) cancel(); };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', interrupted, true);
  document.addEventListener('click', click, true);
  document.addEventListener('contextmenu', click, true);
  document.addEventListener('keydown', key, true);
  document.addEventListener('scroll', schedule, true);
  document.addEventListener('visibilitychange', visibility);
  view.addEventListener('resize', schedule);
  view.addEventListener('pagehide', cancel);
  view.addEventListener('popstate', cancel);
  view.addEventListener('hashchange', cancel);
  function dispose() {
    if (!active) return;
    active = false; observer.disconnect();
    if (frame) view!.cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', interrupted, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('contextmenu', click, true);
    document.removeEventListener('keydown', key, true);
    document.removeEventListener('scroll', schedule, true);
    document.removeEventListener('visibilitychange', visibility);
    view!.removeEventListener('resize', schedule);
    view!.removeEventListener('pagehide', cancel);
    view!.removeEventListener('popstate', cancel);
    view!.removeEventListener('hashchange', cancel);
    target = null; point = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }
  return {
    dispose,
    reselect() { if (!active) return; selected = false; target = null; point = null; notify(); },
    confirm() {
      if (!active || !selected || !target || !eligible(target)) { notify(); return; }
      const element = target;
      dispose(); onConfirm(element);
    },
  };
}
