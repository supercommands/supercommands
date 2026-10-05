import { BRAND_DOMAIN, BRAND_BASE_URL, BRAND_URL, BRAND_WEB_URLS, BRAND_DOCS } from '../../../shared-components/brandingConfig';
// Base URL constants (derived from SSOT brandingConfig.ts)
export const APP_DOMAIN = BRAND_DOMAIN;
export const APP_BASE_URL = BRAND_BASE_URL;
export const APP_URL = BRAND_URL;
export const APP_REDIRECT_URL = BRAND_WEB_URLS.redirect;
export const APP_DOCS_URL = BRAND_DOCS.root;
export const APP_APP_SETTINGS_DOCS_URL = BRAND_DOCS.appSettings;
export const APP_WIDGETS_DOCS_URL = BRAND_DOCS.widgets;
export const APP_INSTALL_URL = BRAND_DOCS.install;
// Backwards compatibility aliases
export const CMD_DOMAIN = APP_DOMAIN;
export const CMD_BASE_URL = APP_BASE_URL;
export const CMD_URL = APP_URL;
export const CMDOS_REDIRECT_URL = APP_REDIRECT_URL;
export const CMDOS_DOCS_URL = APP_DOCS_URL;
export const CMDOS_APP_SETTINGS_DOCS_URL = APP_APP_SETTINGS_DOCS_URL;
export const CMDOS_WIDGETS_DOCS_URL = APP_WIDGETS_DOCS_URL;
export const CMDOS_INSTALL_URL = APP_INSTALL_URL;
