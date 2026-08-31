/**
 * useWidgetPopoverPosition
 *
 * A shared utility hook for positioning any popover/dropdown that opens
 * from inside a widget card. Since widget cards move dynamically on the
 * dashboard grid, this hook captures the live viewport-relative coordinates
 * of the trigger element at the moment the user clicks it, and computes
 * the best placement (right → left → below → above) to keep the popover
 * fully within the visible screen area.
 *
 * USAGE GUIDE
 * ──────────────────────────────────────────────────────────────────────
 * 1. Call the hook in the component that manages the popover open state.
 * 2. Call `computeFromEvent(e)` inside the onClick handler of your trigger
 *    button and pass the resulting `{ top, left }` object to your popover.
 * 3. Inside the popover, apply `style={{ position:'fixed', top, left }}`.
 *
 *   const { computeFromEvent, computeFromElement } = useWidgetPopoverPosition();
 *
 *   // In the trigger button onClick:
 *   const coords = computeFromEvent(e, { width: 240, height: 320 });
 *   setPopoverCoords(coords); // { top: number, left: number }
 *
 * 4. For future widgets, simply import and reuse this hook — no additional
 *    work is needed to make new popovers respect widget position.
 * ──────────────────────────────────────────────────────────────────────
 */

import type * as React from 'react';

interface PopoverDimensions {
  /** Expected pixel width of the popover (used for overflow checking). */
  width?: number;
  /** Expected pixel height of the popover (used for overflow checking). */
  height?: number;
}

interface PopoverCoords {
  top: number;
  left: number;
}

/**
 * Placement preference for the popover relative to the trigger element.
 */
type PopoverPlacement = 'right-of-trigger' | 'left-of-trigger' | 'below-trigger' | 'above-trigger';

const GAP = 8; // pixels of spacing between trigger and popover
const SCREEN_MARGIN = 12; // pixels of margin from screen edges

/**
 * Core logic: compute best coords from a DOMRect following:
 * right-of-trigger → left-of-trigger → below-trigger → above-trigger
 */
function computePopoverCoords(
  rect: DOMRect,
  { width = 240, height = 320 }: PopoverDimensions,
): PopoverCoords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Try: right of trigger ─────────────────────────────────────────
  const rightLeft = rect.right + GAP;
  if (rightLeft + width <= vw - SCREEN_MARGIN) {
    const top = Math.min(Math.max(SCREEN_MARGIN, rect.top), vh - height - SCREEN_MARGIN);
    return { top, left: rightLeft };
  }

  // ── Try: left of trigger ──────────────────────────────────────────
  const leftLeft = rect.left - width - GAP;
  if (leftLeft >= SCREEN_MARGIN) {
    const top = Math.min(Math.max(SCREEN_MARGIN, rect.top), vh - height - SCREEN_MARGIN);
    return { top, left: leftLeft };
  }

  // ── Try: below trigger ────────────────────────────────────────────
  const belowTop = rect.bottom + GAP;
  if (belowTop + height <= vh - SCREEN_MARGIN) {
    const left = Math.min(Math.max(SCREEN_MARGIN, rect.right - width), vw - width - SCREEN_MARGIN);
    return { top: belowTop, left };
  }

  // ── Fallback: above trigger ───────────────────────────────────────
  const aboveTop = Math.max(SCREEN_MARGIN, rect.top - height - GAP);
  const left = Math.min(Math.max(SCREEN_MARGIN, rect.right - width), vw - width - SCREEN_MARGIN);
  return { top: aboveTop, left };
}

/**
 * Returns helpers to compute popover screen coordinates from either:
 *  - a React MouseEvent (reads `e.currentTarget`)
 *  - a raw HTMLElement reference
 */
export function useWidgetPopoverPosition() {
  /**
   * Compute popover coords from a React mouse event.
   * Reads the live bounding rect of `e.currentTarget` at click time.
   */
  function computeFromEvent(
    e: React.MouseEvent,
    dimensions?: PopoverDimensions,
  ): PopoverCoords {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return computePopoverCoords(rect, dimensions ?? {});
  }

  /**
   * Compute popover coords from a direct element reference.
   * Useful when you have a `ref` to the trigger element but no event.
   */
  function computeFromElement(
    el: HTMLElement | null,
    dimensions?: PopoverDimensions,
  ): PopoverCoords | null {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return computePopoverCoords(rect, dimensions ?? {});
  }

  /**
   * Compute popover coords with an explicit placement preference.
   * Falls back to the standard cascade if preferred placement overflows.
   */
  function computeFromEventWithPreference(
    e: React.MouseEvent,
    preference: PopoverPlacement,
    dimensions?: PopoverDimensions,
  ): PopoverCoords {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { width = 240, height = 320 } = dimensions ?? {};
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (preference === 'right-of-trigger') {
      const left = rect.right + GAP;
      if (left + width <= vw - SCREEN_MARGIN) {
        const top = Math.min(Math.max(SCREEN_MARGIN, rect.top), vh - height - SCREEN_MARGIN);
        return { top, left };
      }
    }

    if (preference === 'left-of-trigger') {
      const left = rect.left - width - GAP;
      if (left >= SCREEN_MARGIN) {
        const top = Math.min(Math.max(SCREEN_MARGIN, rect.top), vh - height - SCREEN_MARGIN);
        return { top, left };
      }
    }

    if (preference === 'below-trigger') {
      const top = rect.bottom + GAP;
      if (top + height <= vh - SCREEN_MARGIN) {
        const left = Math.min(Math.max(SCREEN_MARGIN, rect.right - width), vw - width - SCREEN_MARGIN);
        return { top, left };
      }
    }

    if (preference === 'above-trigger') {
      const top = Math.max(SCREEN_MARGIN, rect.top - height - GAP);
      const left = Math.min(Math.max(SCREEN_MARGIN, rect.right - width), vw - width - SCREEN_MARGIN);
      return { top, left };
    }

    // Default cascade if preference doesn't fit
    return computePopoverCoords(rect, { width, height });
  }

  return { computeFromEvent, computeFromElement, computeFromEventWithPreference };
}

export type { PopoverCoords, PopoverDimensions, PopoverPlacement };
