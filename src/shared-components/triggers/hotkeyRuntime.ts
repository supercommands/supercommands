import { normalizeHotkeyString } from '../hotkeys/core/eventParser';

export const normalizeHotkeyTrigger = (value: string): string => normalizeHotkeyString(value);
