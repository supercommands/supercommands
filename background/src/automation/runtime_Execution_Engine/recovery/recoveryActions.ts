/**
 * @fileoverview Recovery and validation interactions.
 *
 * This module defines actions for recovering from failed automation steps,
 * validating expected outcomes, and handling protected flows where standard
 * interactions might be blocked.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * interactionEngine/recoveryActions.ts
 *
 * PHASE 1 — validateState, recoverAction, fallbackDebugger, detectProtectedFlow.
 *
 * VERY IMPORTANT: These methods MUST exist in the contract now (Phase 1),
 * even though their implementation is Phase 2+.
 *
 * Why: Contract-first architecture means future phases slot in here
 * without touching the executor or the index. The executor is already
 * calling interactionEngine.fallbackDebugger() — it just returns 'skipped'
 * until Phase 2 implements it.
 *
 * fallbackDebugger: The safety net for when the primary engine fails.
 *   Phase 2+: will attempt raw CDP commands as a last resort.
 *
 * detectProtectedFlow: Detects if the current page is blocking automation
 *   (e.g. Cloudflare, CSP restrictions, reCAPTCHA).
 *   Phase 2+: will return signals so the executor can route to a native helper.
 */

import { attachDebugger } from '../debugger/debuggerActions';
import type {
  ValidateStateContext,
  RecoverActionContext,
  FallbackDebuggerContext,
  DetectProtectedFlowContext,
  InteractionResult,
} from '../core/types';

// ─────────────────────────────────────────────────────────────────────────────
// validateState — PHASE 5A
//
// Logic:
//   Checks if the page state matches the 'expected' outcome.
//   Universal check for URL, elements, and text.
// ─────────────────────────────────────────────────────────────────────────────

export const validateState = async (ctx: ValidateStateContext): Promise<InteractionResult> => {
  if (!ctx.expected) {
    return { status: 'skipped' };
  }

  const { url_contains, element_present, element_absent, text_present } = ctx.expected;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: (config: any) => {
        const results: Record<string, boolean> = {};

        if (config.url_contains) {
          results.url = window.location.href.includes(config.url_contains);
        }

        if (config.element_present) {
          results.element_present = !!document.querySelector(config.element_present);
        }

        if (config.element_absent) {
          results.element_absent = !document.querySelector(config.element_absent);
        }

        if (config.text_present) {
          results.text_present = document.body.innerText.includes(config.text_present);
        }

        return results;
      },
      args: [ctx.expected],
    });

    const res = results?.[0]?.result as Record<string, boolean>;
    const failedChecks = Object.entries(res).filter(([_, passed]) => !passed);

    if (failedChecks.length === 0) {
      return { status: 'success', tabId: ctx.tabId };
    }

    const error = `Validation failed: ${failedChecks.map(([k]) => k).join(', ')}`;
    console.warn(`[InteractionEngine] validateState ✗ ${error}`);
    return { status: 'failed', error, tabId: ctx.tabId };
  } catch (err: any) {
    return { status: 'failed', error: `validateState error: ${err?.message}`, tabId: ctx.tabId };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// recoverAction — Phase 1: STUB
// ─────────────────────────────────────────────────────────────────────────────

export const recoverAction = async (_ctx: RecoverActionContext): Promise<InteractionResult> => {
  console.warn('[InteractionEngine] recoverAction: stub — not yet implemented (Phase 6)');
  return { status: 'skipped' };
};

// ─────────────────────────────────────────────────────────────────────────────
// fallbackDebugger — PHASE 5A
// Centralized CDP escape hatch.
// ─────────────────────────────────────────────────────────────────────────────

export const fallbackDebugger = async (ctx: FallbackDebuggerContext): Promise<InteractionResult> => {
  if (!ctx.command) return { status: 'failed', error: 'fallbackDebugger: missing command' };

  try {
    const target = ctx.target || { tabId: ctx.tabId };

    // Ensure attached
    const finalTarget = await attachDebugger(ctx.tabId);

    const result = await chrome.debugger.sendCommand(finalTarget, ctx.command, ctx.params || {});
    return { status: 'success', value: result, tabId: ctx.tabId };
  } catch (err: any) {
    console.error(`[InteractionEngine] fallbackDebugger ✗ ${err?.message}`);
    return { status: 'failed', error: err?.message, tabId: ctx.tabId };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// detectProtectedFlow — PHASE 5B
//
// Logic:
//   Environment intelligence.
//   Checks for Cloudflare, Captcha, Datadome, etc.
// ─────────────────────────────────────────────────────────────────────────────

export const detectProtectedFlow = async (ctx: DetectProtectedFlowContext): Promise<InteractionResult> => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: ctx.tabId },
      func: () => {
        const title = (document.title || '').toLowerCase();
        const bodyText = (document.body?.innerText || '').toLowerCase();
        const html = (document.documentElement?.innerHTML || '').toLowerCase();

        // 1. Cloudflare
        if (title.includes('just a moment') || html.includes('cloudflare-static') || html.includes('cf-challenge')) {
          return { protected: true, kind: 'cloudflare' };
        }

        // 2. reCAPTCHA / hCaptcha
        if (html.includes('recaptcha/api') || html.includes('hcaptcha.com/1/api')) {
          return { protected: true, kind: 'captcha' };
        }

        // 3. Common "Access Denied" or "Verify you are human"
        if (bodyText.includes('verify you are human') || title.includes('attention required')) {
          return { protected: true, kind: 'challenge' };
        }

        // 4. Datadome / Akamai
        if (html.includes('datadome') || html.includes('akamai-bm')) {
          return { protected: true, kind: 'anti-bot' };
        }

        return { protected: false };
      },
    });

    const res = results?.[0]?.result as { protected: boolean; kind?: string };
    if (res?.protected) {
      console.warn(`[InteractionEngine] 🚨 PROTECTED FLOW DETECTED: ${res.kind}`);
      return { status: 'failed', value: res.kind, error: `Page is protected by ${res.kind}`, tabId: ctx.tabId };
    }

    return { status: 'success', tabId: ctx.tabId }; // Not protected
  } catch (err: any) {
    // If we can't even run a script, the page might be heavily restricted (CSP)
    return { status: 'failed', error: `Protection detection failed: ${err?.message}`, tabId: ctx.tabId };
  }
};
