/**
 * Unified utility for parsing and normalizing hotkeys from KeyboardEvents.
 * Shared between the React UI (KeystrokeRecording) and the Content Scripts.
 */
/**
 * Normalizes a hotkey string into a standard format: "Ctrl+Alt+Shift+Key"
 * E.g., "cmd + C", "Command+c", "ctrl+c" all normalize to their respective standard parts.
 *
 * @param value The raw string to normalize
 * @returns The normalized hotkey string
 */
export function normalizeHotkeyString(value: string): string {
    if (!value)
        return '';
    const parts = value
        .split('+')
        .map(part => part.trim())
        .filter(Boolean);
    let key = '';
    const mods = new Set<string>();
    for (const part of parts) {
        const upper = part.toUpperCase();
        if (upper === 'CTRL' || upper === 'CONTROL')
            mods.add('Ctrl');
        else if (upper === 'ALT' || upper === 'OPTION')
            mods.add('Alt');
        else if (upper === 'SHIFT')
            mods.add('Shift');
        else if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND')
            mods.add('Meta');
        else
            key = part.length === 1 ? part.toUpperCase() : part;
    }
    // Define a strict ordering for modifiers
    const ordered = ['Ctrl', 'Alt', 'Shift', 'Meta'].filter(mod => mods.has(mod));
    if (key) {
        // Format arrow keys and other special symbols
        const symbolMap: Record<string, string> = {
            ArrowUp: '↑',
            ArrowDown: '↓',
            ArrowLeft: '←',
            ArrowRight: '→',
            Space: 'Space',
        };
        key = symbolMap[key] || key;
        ordered.push(key);
    }
    return ordered.join('+');
}
/**
 * Builds a standardized hotkey string directly from a KeyboardEvent.
 *
 * @param e The raw KeyboardEvent
 * @param isMac True if the user is on a Mac OS environment
 * @returns A formatted string (e.g. "Ctrl+Alt+A") or null if invalid
 */
export function buildHotkeyString(e: KeyboardEvent | {
    key: string;
    ctrlKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}, isMac: boolean = false): string | null {
    // Ignore pure modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key))
        return null;
    if (e.key === 'Escape') {
        return 'CANCEL';
    }
    const parts: string[] = [];
    if (isMac) {
        // Mac Logic: Align with App.tsx mapping (Meta and Ctrl both map to "Ctrl")
        if (e.ctrlKey || e.metaKey) {
            parts.push('Ctrl');
        }
        else {
            // Default to Ctrl (which maps to Cmd/Meta in assignment UX)
            // BUT: Only add default Ctrl if it's NOT a navigation key without modifiers
            const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
            if (!isNavKey) {
                parts.push('Ctrl');
            }
        }
        if (e.shiftKey)
            parts.push('Shift');
    }
    else {
        // Windows/Linux Logic: Support Ctrl, Alt, or both
        if (e.ctrlKey)
            parts.push('Ctrl');
        if (e.altKey)
            parts.push('Alt');
        // If no modifiers, default to Alt (legacy consistency)
        const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
        if (!e.ctrlKey && !e.altKey && !isNavKey) {
            parts.push('Alt');
        }
        if (e.shiftKey)
            parts.push('Shift');
    }
    const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
    if (isNavKey && !e.ctrlKey && !e.altKey && !e.metaKey)
        return null;
    let keyName = e.key;
    if (keyName === ' ') {
        keyName = 'Space';
    }
    else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
    }
    else {
        // Format arrow keys and other special symbols
        const symbolMap: Record<string, string> = {
            ArrowUp: '↑',
            ArrowDown: '↓',
            ArrowLeft: '←',
            ArrowRight: '→',
        };
        keyName = symbolMap[keyName] || keyName;
    }
    parts.push(keyName);
    // We restrict to max 4 parts (Modifier + Shift + Meta + Key)
    if (parts.length > 4)
        return null;
    return parts.join('+');
}
