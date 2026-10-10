import type { NotificationAdapter } from './interfaces';

export const SESSION_COMPLETE_NOTIFICATION_ID = 'focus-session-complete';

export function createNotificationAdapter(): NotificationAdapter {
  return {
    async show(title: string, message: string): Promise<void> {
      await chrome.notifications.create(SESSION_COMPLETE_NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title.trim() || 'Aegis',
        message: message.trim() || 'Session update',
        priority: 2,
      });
    },
    async clear(): Promise<void> {
      await chrome.notifications.clear(SESSION_COMPLETE_NOTIFICATION_ID);
    },
  };
}
