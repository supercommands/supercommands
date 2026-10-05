/** App-only controls are registered here; hotkey lifetime belongs to the outer route. */
export interface NewTabHotkeyAppBindings {
  openCreateMenu: () => void;
  executeCommand: (id: string) => void;
  focusSearch: () => void;
}
let bindings: NewTabHotkeyAppBindings | null = null;
let generation = 0;
const waiters = new Set<(value: NewTabHotkeyAppBindings | null) => void>();
export function registerNewTabHotkeyAppBindings(value: NewTabHotkeyAppBindings): () => void {
  bindings = value;
  for (const resolve of waiters) resolve(value);
  waiters.clear();
  return () => { if (bindings === value) bindings = null; };
}
export async function waitForNewTabHotkeyApp(prepareApp: () => Promise<boolean>): Promise<NewTabHotkeyAppBindings | null> {
  const ownerGeneration = generation;
  if (!await prepareApp()) return null;
  if (ownerGeneration !== generation) return null;
  if (bindings) return bindings;
  return new Promise(resolve => waiters.add(resolve));
}
export function clearNewTabHotkeyAppBindings(): void { bindings = null; }
export function cancelNewTabHotkeyAppWaiters(): void {
  generation++;
  for (const resolve of waiters) resolve(null);
  waiters.clear();
}
