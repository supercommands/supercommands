/**
 * Gate script - runs BEFORE React to decide: redirect or show.
 * The body is hidden by CSS. This script either:
 * 1. Redirects to chrome://newtab if disabled (before anything renders)
 * 2. Applies the focus hack if enabled (bypasses omnibox stealing focus)
 * 3. Shows the body if enabled and focused
 */

const applyGateDecision = ({
  omniboxOverrideEnabled,
  hasFocusParam,
}: {
  omniboxOverrideEnabled: boolean;
  hasFocusParam: boolean;
}) => {
  if (!omniboxOverrideEnabled) {
    showBody();
    return;
  }

  if (!hasFocusParam) {
    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get('focus') !== 'true') {
      currentUrl.searchParams.set('focus', 'true');
      window.location.replace(currentUrl.toString());
    }
    return;
  }

  showBody();
};

// Apply dark mode early to prevent flickering (before storage load)
// The app currently enforces dark mode by default.
document.documentElement.classList.add('dark');

(async () => {
  try {
    // Check if chrome.storage.local is available
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      showBody();
      return;
    }

    const url = new URL(window.location.href);
    const hasFocusParam =
      url.searchParams.get('focus') === 'true' || url.searchParams.get('focus_sheet_ui_first_column') === 'true';

    let decided = false;
    // Optimistic fast-path: if storage doesn't respond in 40ms, assume defaults to avoid blank screen
    const optimisticTimer = window.setTimeout(() => {
      if (decided) return;
      decided = true;
      applyGateDecision({
        omniboxOverrideEnabled: false,
        hasFocusParam,
      });
    }, 40);

    // Load theme and settings together to ensure theme is applied before body is shown
    const result = await chrome.storage.local.get([
      'theme',
      'new_tab_is_dark_mode',
      'new_tab_dark_mode',
      'omnibox_override_enabled',
    ]);

    // Apply theme immediately after await returns
    const isLightMode =
      result.theme === 'cherry-blossom' ||
      result.theme === 'coastal-mint' ||
      result.theme === 'reflect-gradient' ||
      result.theme === 'periwinkle-mist' ||
      result.theme === 'light' ||
      result.new_tab_is_dark_mode === false;

    if (isLightMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    const resolved = {
      omniboxOverrideEnabled: result.omnibox_override_enabled !== false,
    };

    if (!decided) {
      decided = true;
      window.clearTimeout(optimisticTimer);
      applyGateDecision({
        omniboxOverrideEnabled: resolved.omniboxOverrideEnabled,
        hasFocusParam,
      });
    }
  } catch (error) {
    // On any error, show the page to avoid blank screen
    console.warn('[gate.ts] Error:', error);
    showBody();
  }
})();

/**
 * Helper to show the body (unhide from CSS display:none)
 */
function showBody() {
  // Body is no longer hidden by default to prevent "loading" screen
  return;
}
