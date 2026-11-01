import type { NotificationAdapter, NotificationButton } from './interfaces';

export const SESSION_COMPLETE_NOTIFICATION_ID = 'focus-session-complete';
export const FOCUS_CHOICE_NOTIFICATION_ID = 'focus-session-choice';
export const BREAK_CHOICE_NOTIFICATION_ID = 'break-session-choice';
/** Escape hatch while auto-repeat + lock keeps cycling. */
export const STRICT_ESCAPE_NOTIFICATION_ID = 'strict-session-escape';

export function createNotificationAdapter(): NotificationAdapter {
  return {
    async show(title: string, message: string): Promise<void> {
      await chrome.notifications.create(SESSION_COMPLETE_NOTIFICATION_ID, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title.trim() || 'Wardfocus',
        message: message.trim() || 'Session update',
        priority: 2,
      });
    },
    async showChoice(
      id: string,
      title: string,
      message: string,
      buttons: NotificationButton[],
    ): Promise<void> {
      await chrome.notifications.create(id, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title.trim() || 'Wardfocus',
        message: message.trim() || 'Session update',
        priority: 2,
        requireInteraction: true,
        buttons: buttons.slice(0, 2).map((button) => ({ title: button.title })),
      });
    },
    async clear(id?: string): Promise<void> {
      if (id) {
        await chrome.notifications.clear(id);
        return;
      }
      await chrome.notifications.clear(SESSION_COMPLETE_NOTIFICATION_ID);
      await chrome.notifications.clear(FOCUS_CHOICE_NOTIFICATION_ID);
      await chrome.notifications.clear(BREAK_CHOICE_NOTIFICATION_ID);
      await chrome.notifications.clear(STRICT_ESCAPE_NOTIFICATION_ID);
    },
  };
}
