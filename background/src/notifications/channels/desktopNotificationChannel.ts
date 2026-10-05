/**
 * @file desktopNotificationChannel.ts
 * @description Dedicated channel adapter for Chrome native desktop notifications.
 * Decoupled from in-tab UI toasts and isolated to OS notification delivery.
 */

import type { NotificationRecord } from '../../../../src/storage/indexDB/notificationTypes';
import type { NotificationDeliveryChannel } from '../../../../src/storage/indexDB/notificationDeliveryTypes';

const CHROME_NOTIFICATIONS_ENABLED_KEY = 'todo_chrome_alarm_notifications_enabled';

export interface NotificationChannelAdapter {
  readonly channel: NotificationDeliveryChannel;
  deliver(notification: NotificationRecord): Promise<void>;
}

async function shouldShowChromeNotification(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([CHROME_NOTIFICATIONS_ENABLED_KEY]);
    return result[CHROME_NOTIFICATIONS_ENABLED_KEY] === true;
  } catch (err) {
    console.warn('[DesktopNotificationChannel] Failed to read Chrome notification setting:', err);
    return false;
  }
}

export class DesktopNotificationChannel implements NotificationChannelAdapter {
  readonly channel: NotificationDeliveryChannel = 'desktop';

  async deliver(notification: NotificationRecord): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.notifications) {
      console.warn('[DesktopNotificationChannel] chrome.notifications API unavailable');
      return;
    }

    const enabled = await shouldShowChromeNotification();
    if (!enabled) {
      console.log('[DesktopNotificationChannel] Desktop notifications disabled by user setting');
      return;
    }

    const iconUrl = chrome.runtime.getURL('icon.png');
    const title = 'SuperCommands Notification';
    const message = notification.message && notification.message !== notification.title
      ? `${notification.title}\n${notification.message}`
      : notification.title;

    await new Promise<string>((resolve, reject) => {
      chrome.notifications.create(
        notification.id,
        {
          type: 'basic',
          iconUrl,
          title,
          message,
          priority: 2,
          requireInteraction: false,
        },
        notificationId => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(notificationId);
          }
        },
      );
    });
  }
}

export const desktopNotificationChannel = new DesktopNotificationChannel();
