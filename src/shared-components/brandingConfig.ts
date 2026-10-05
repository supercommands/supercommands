/**
 * @file brandingConfig.ts
 * SINGLE SOURCE OF TRUTH (SSOT) for all product branding, domains, URLs, events, and names.
 * Modify this file ONLY to rebrand or rename the extension everywhere in the future.
 */
export const BRAND_NAME = 'SuperCommands';
export const BRAND_NAME_SPACED = 'Super Commands';
export const BRAND_WORKSPACE_TITLE = `${BRAND_NAME} Workspace`;
export const BRAND_TAGLINE = 'Your digital brain for managing daily browser workflows — all in one place.';
/** Domains & Base URLs */
export const BRAND_DOMAIN = 'supercommands.com';
export const BRAND_BASE_URL = `https://www.${BRAND_DOMAIN}`;
export const BRAND_URL = `https://${BRAND_DOMAIN}`;
export const BRAND_DOCS_URL = `${BRAND_BASE_URL}/docs`;
/** Specific Docs URLs */
export const BRAND_DOCS = {
    root: BRAND_DOCS_URL,
    notes: `${BRAND_DOCS_URL}/notes`,
    links: `${BRAND_DOCS_URL}/links`,
    todos: `${BRAND_DOCS_URL}/todos`,
    textExpanders: `${BRAND_DOCS_URL}/text-expanders`,
    chatAgentsPrompts: `${BRAND_DOCS_URL}/chat-agents-prompts`,
    webCollections: `${BRAND_URL}/docs/webclips`,
    workspaceCollections: `${BRAND_DOCS_URL}/workspace-collections`,
    appSettings: `${BRAND_DOCS_URL}/app-settings`,
    widgets: `${BRAND_DOCS_URL}/widgets`,
    install: `${BRAND_BASE_URL}/install`,
} as const;
/** App Web Navigation URLs */
export const BRAND_WEB_URLS = {
    redirect: `${BRAND_BASE_URL}/`,
} as const;
/** Notifications & Toasts */
export const BRAND_NOTIFICATION_TITLE = `${BRAND_NAME} Notification`;
export const BRAND_TOAST_TITLE = BRAND_NAME;
/** Asset Paths */
export const BRAND_ASSETS = {
    logoFileName: 'supercommands_logo.png',
    logoContentPath: 'content/supercommands_logo.png',
    logoPopupPath: 'popup/supercommands_logo.png',
    logoSharedPath: './assets/supercommands_logo.png',
} as const;
/** Export & Backup Prefixes */
export const BRAND_EXPORTS = {
    backupZipPrefix: 'supercommands-backup',
    backupExcelPrefix: 'supercommands-backup',
    cloudExportFilename: 'supercommands_cloud_export.xlsx',
    screenshotPrefix: 'supercommands-screenshot',
    screenshotElementPrefix: 'supercommands-element',
    screenshotFullPagePrefix: 'supercommands-fullpage',
    tableExportPrefix: 'supercommands-table',
} as const;
/** Database Names */
export const BRAND_DB = {
    current: 'SuperCommands',
    legacy: 'cmdOS',
} as const;
/** Events & Runtime Message Types */
export const BRAND_EVENTS = {
    // Toggle UI
    toggleAlts: 'supercommands:toggle-alts',
    // Actions & Navigation
    returnToHomeDashboard: 'supercommands:return-to-home-dashboard',
    dashboardCollectionRename: 'supercommands:dashboard-collection-rename-request',
    sessionMissingAiPrompt: 'supercommands:session-missing-ai-prompt-input',
    closeEmbedCreator: 'supercommands:close-embed-creator',
    focusSearch: 'supercommands:focus-search',
    forceBoardView: 'supercommands:force-board-view',
    executeCreateAction: 'supercommands:execute-create-action',
    automationInputActiveChange: 'supercommands-automation-input-active-change',
    // Extraction & Screenshots
    downloadImage: 'supercommands:download-image',
    cropCapturedVisibleTab: 'supercommands:crop-captured-visible-tab',
    copyImageToClipboard: 'supercommands:copy-image-to-clipboard',
    prepareFullPageScreenshot: 'supercommands:prepare-full-page-screenshot',
    scrollFullPageScreenshot: 'supercommands:scroll-full-page-screenshot',
    restoreFullPageScreenshot: 'supercommands:restore-full-page-screenshot',
    contentScriptPing: 'supercommands:content-script-ping',
    insertText: 'supercommands:insert-text',
    // Auth Bridge
} as const;
/** DOM IDs & CSS Prefixes */
export const BRAND_DOM = {
    prefix: 'supercommands-',
    cssPrefix: 'supercommands-',
    onboardingRoot: 'supercommands-onboarding-root',
    imageMainContainer: 'supercommands-image-main-container',
    imageDialog: 'supercommands-image-dialog',
    tableMainContainer: 'supercommands-table-main-container',
    tableDialog: 'supercommands-table-dialog',
    tableClose: 'supercommands-table-close',
    tableDownload: 'supercommands-table-download',
    deepFocusOverlayId: 'supercommands-deep-focus-blocked-overlay',
    largeSessionLaunchConfirmation: 'supercommands-large-session-launch-confirmation',
} as const;
/** Legacy CMDOS event strings for backwards compatibility listeners */
export const LEGACY_BRAND_EVENTS = {
    toggleAlts: 'cmdos:toggle-alts',
    returnToHomeDashboard: 'cmdos:return-to-home-dashboard',
    dashboardCollectionRename: 'cmdos:dashboard-collection-rename-request',
    sessionMissingAiPrompt: 'cmdos:session-missing-ai-prompt-input',
    closeEmbedCreator: 'cmdos:close-embed-creator',
    focusSearch: 'cmdos:focus-search',
    forceBoardView: 'cmdos:force-board-view',
    executeCreateAction: 'cmdos:execute-create-action',
    automationInputActiveChange: 'cmdos-automation-input-active-change',
    downloadImage: 'cmdos:download-image',
    cropCapturedVisibleTab: 'cmdos:crop-captured-visible-tab',
    copyImageToClipboard: 'cmdos:copy-image-to-clipboard',
    prepareFullPageScreenshot: 'cmdos:prepare-full-page-screenshot',
    scrollFullPageScreenshot: 'cmdos:scroll-full-page-screenshot',
    restoreFullPageScreenshot: 'cmdos:restore-full-page-screenshot',
    contentScriptPing: 'cmdos:content-script-ping',
    insertText: 'cmdos:insert-text',
} as const;
/** Storage Keys */
export const BRAND_STORAGE_KEYS = {
    onboardingCoreSetupCompleted: 'supercommands_onboarding_core_setup_completed',
    onboardingCompletedHint: 'supercommands_onboarding_completed_hint',
    onboardingThemeInitialized: 'supercommands_onboarding_theme_initialized',
    widgetDashboardStartupSnapshot: 'supercommands_widget_dashboard_startup_snapshot_v3',
    dashboardViewReconciliationPrefix: 'supercommands_dashboard_views_reconciliation_v2:',
    themeStartupHint: 'supercommands_theme_id_startup_hint',
    themeStartupSnapshot: 'supercommands_theme_startup_snapshot',
    wallpaperStartupHint: 'supercommands_wallpaper_id_startup_hint',
    warmTintStartupHint: 'supercommands_warm_tint_startup_hint',
    warmTintStrengthStartupHint: 'supercommands_warm_tint_strength_startup_hint',
    dailyQuoteCache: 'supercommands_daily_quote_widget_cache_v1',
    weatherCache: 'supercommands-weather-widget-cache-v4',
    weatherLocation: 'supercommands-weather-widget-location-v1',
    newsCache: 'supercommands-news-widget-cache-v1',
    prefixSettingSeedVersion: 'supercommands_prefix_setting_seed_version',
    commandSeedVersion: 'supercommands_command_seed_version',
    debugStorage: 'supercommands_debug_storage',
    gateCache: 'supercommands_gate_cache',
} as const;
/** Legacy Storage Keys for Backwards Compatibility */
export const LEGACY_BRAND_STORAGE_KEYS = {
    onboardingCoreSetupCompleted: 'cmdos_onboarding_core_setup_completed',
    onboardingCompletedHint: 'cmdos_onboarding_completed_hint',
    onboardingThemeInitialized: 'cmdos_onboarding_theme_initialized',
    widgetDashboardStartupSnapshot: 'cmdos_widget_dashboard_startup_snapshot_v3',
    dashboardViewReconciliationPrefix: 'cmdos_dashboard_views_reconciliation_v2:',
    themeStartupHint: 'cmdos_theme_id_startup_hint',
    themeStartupSnapshot: 'cmdos_theme_startup_snapshot',
    wallpaperStartupHint: 'cmdos_wallpaper_id_startup_hint',
    warmTintStartupHint: 'cmdos_warm_tint_startup_hint',
    warmTintStrengthStartupHint: 'cmdos_warm_tint_strength_startup_hint',
    dailyQuoteCache: 'cmdos_daily_quote_widget_cache_v1',
    weatherCache: 'cmdos-weather-widget-cache-v4',
    weatherLocation: 'cmdos-weather-widget-location-v1',
    newsCache: 'cmdos-news-widget-cache-v1',
    prefixSettingSeedVersion: 'cmdos_prefix_setting_seed_version',
    commandSeedVersion: 'cmdos_command_seed_version',
    debugStorage: 'cmdos_debug_storage',
    gateCache: 'cmdos_gate_cache',
} as const;
/** Background Alarms */
export const BRAND_ALARMS = {
    autoBackup: 'supercommands-auto-backup',
    driveBackup: 'supercommands-drive-backup-alarm',
    drivePull: 'supercommands-drive-pull',
    periodicSync: 'supercommands-periodic-sync',
} as const;
/** Legacy Alarms */
export const LEGACY_BRAND_ALARMS = {
    autoBackup: 'cmdos-auto-backup',
    driveBackup: 'cmdos-drive-backup-alarm',
    drivePull: 'cmdos-drive-pull',
    periodicSync: 'cmdos-periodic-sync',
} as const;
/** Social & Community URLs */
export const BRAND_SOCIAL = {
    twitter: 'https://x.com/supercommands',
    reddit: 'https://www.reddit.com/r/SuperCommands/',
    slack: 'https://supercommands.slack.com',
} as const;
/** Consolidated Brand SSOT Object */
export const BRAND = {
    name: BRAND_NAME,
    nameSpaced: BRAND_NAME_SPACED,
    workspaceTitle: BRAND_WORKSPACE_TITLE,
    tagline: BRAND_TAGLINE,
    domain: BRAND_DOMAIN,
    baseUrl: BRAND_BASE_URL,
    url: BRAND_URL,
    docsUrl: BRAND_DOCS_URL,
    docs: BRAND_DOCS,
    webUrls: BRAND_WEB_URLS,
    notificationTitle: BRAND_NOTIFICATION_TITLE,
    toastTitle: BRAND_TOAST_TITLE,
    assets: BRAND_ASSETS,
    exports: BRAND_EXPORTS,
    db: BRAND_DB,
    events: BRAND_EVENTS,
    legacyEvents: LEGACY_BRAND_EVENTS,
    dom: BRAND_DOM,
    storageKeys: BRAND_STORAGE_KEYS,
    legacyStorageKeys: LEGACY_BRAND_STORAGE_KEYS,
    alarms: BRAND_ALARMS,
    legacyAlarms: LEGACY_BRAND_ALARMS,
    social: BRAND_SOCIAL,
    placeholderEmailDomain: BRAND_DOMAIN,
    contextMenuId: 'supercommands_commands',
    contextMenuTitle: `${BRAND_NAME} - Commands`,
    omniboxPrefix: BRAND_NAME,
    storagePrefix: 'supercommands',
} as const;
export type BrandConfig = typeof BRAND;
