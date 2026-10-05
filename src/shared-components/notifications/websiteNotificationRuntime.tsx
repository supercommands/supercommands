import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import NotificationContainer from './NotificationContainer';
import { useUIStore } from '../uiStateManager';
import websiteCss from './websiteNotificationStyles.css?inline';
let notificationRoot: Root | null = null;
let notificationHost: HTMLDivElement | null = null;
/**
 * Mounts the single webpage notification surface used by popup
 * and background-delivered notifications. The host is deliberately outside
 * either popup so Todo alarms can be displayed while no popup is open.
 */
export function ensureWebsiteNotificationHost(): void {
    if (notificationRoot || notificationHost)
        return;
    const existingHost = document.querySelector<HTMLDivElement>('[data-supercommands-website-notifications="true"]');
    if (existingHost?.shadowRoot) {
        notificationHost = existingHost;
        const existingContainer = existingHost.shadowRoot.querySelector<HTMLDivElement>('#website-notification-container');
        if (existingContainer) {
            notificationRoot = createRoot(existingContainer);
            notificationRoot.render(<NotificationContainer variant="top-text-only"/>);
            return;
        }
        existingHost.remove();
        notificationHost = null;
    }
    notificationHost = document.createElement('div');
    notificationHost.id = 'alts-notification-root';
    notificationHost.dataset.supercommandsWebsiteNotifications = 'true';
    notificationHost.style.cssText =
        'position: fixed; top: 0; left: 0; width: 100vw; height: 0; z-index: 2147483647; pointer-events: none; border: none; outline: none; overflow: visible;';
    document.body.appendChild(notificationHost);
    const shadowRoot = notificationHost.attachShadow({ mode: 'open' });
    const styleTag = document.createElement('style');
    styleTag.textContent = websiteCss;
    shadowRoot.appendChild(styleTag);
    const themeStyleTag = document.createElement('style');
    themeStyleTag.textContent = `
    :host {
      all: initial !important;
      display: block !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    #website-notification-container {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  `;
    shadowRoot.appendChild(themeStyleTag);
    const container = document.createElement('div');
    container.id = 'website-notification-container';
    container.classList.add('dark');
    shadowRoot.appendChild(container);
    notificationRoot = createRoot(container);
    notificationRoot.render(<NotificationContainer variant="top-text-only"/>);
}
export function showWebsiteNotification(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    ensureWebsiteNotificationHost();
    useUIStore.getState().queueNotification({ message, type });
}
