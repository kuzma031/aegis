import type { SessionRecord } from '@core/types';
import type { NotificationAdapter } from './interfaces';

export const SESSION_COMPLETE_NOTIFICATION_ID = 'focus-session-complete';

export function createNotificationAdapter(): NotificationAdapter {
  return {
    async showSessionComplete(record: SessionRecord): Promise<void> {
      const minutes = Math.round(record.focusedMs / 60_000);
      await chrome.notifications.create(SESSION_COMPLETE_NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Focus session complete 🎉',
        message: `You worked for ${minutes} minutes. Take a short break away from the screen.`,
        buttons: [{ title: 'Start another session' }],
        priority: 2,
      });
    },
    async clear(): Promise<void> {
      await chrome.notifications.clear(SESSION_COMPLETE_NOTIFICATION_ID);
    },
  };
}
