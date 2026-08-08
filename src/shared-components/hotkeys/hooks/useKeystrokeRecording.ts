/**
 * Unified hook for capturing and formatting hotkey combinations.
 * Standardizes the "Alt + [Key]" pattern used throughout the app.
 * Validates against reserved system and extension shortcuts.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { checkReservedHotkey } from '../core/reservedHotkeys';
import { buildHotkeyString } from '../core/eventParser';

export interface HotkeyState {
  value: string;
  isMac: boolean;
}

export type HotkeyResult = string | 'CANCEL' | null;

/**
 * Unified hook for checking if recording is active AND capturing/formatting hotkey combinations.
 */
export const useKeystrokeRecording = (initialHotkey: string = '', isMac: boolean = false) => {
  const isKeystrokeRecordingActive = useCallback(() => {
    const active = document.activeElement;
    if (active && active.tagName === 'INPUT') {
      if (active.hasAttribute('readonly') && active.classList.contains('opacity-0')) {
        return true;
      }
    }
    return Boolean((window as any).__tasklabsKeystrokeRecordingActive);
  }, []);

  const [hotkey, setHotkey] = useState<string>(initialHotkey);


  const captureHotkey = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent): HotkeyResult => {
      e.preventDefault();
      e.stopPropagation();

      const reactEvent = e as React.KeyboardEvent;
      if (reactEvent.nativeEvent) {
        reactEvent.nativeEvent.stopImmediatePropagation();
        reactEvent.nativeEvent.stopPropagation();
      }

      const resultString = buildHotkeyString(e, isMac);
      if (resultString === 'CANCEL') return 'CANCEL';
      if (!resultString) return null;

      const newValue = resultString;

      setHotkey(newValue);
      return newValue;
    },
    [isMac],
  );

  const resetHotkey = useCallback((newInitialValue: string = '') => {
    setHotkey(newInitialValue);
  }, []);

  return {
    isKeystrokeRecordingActive,
    hotkey,
    setHotkey,
    captureHotkey,
    resetHotkey,
  };
};
