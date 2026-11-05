import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { PhaseNotification } from '@core/phaseNotifications';
import type { PhaseNotificationScheduler } from './interfaces';

export const PHASE_CHANNEL_ID = 'phase-end';

export async function setupNotifications(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(PHASE_CHANNEL_ID, {
      name: 'Phase finished',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'bell.wav',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  await Notifications.setNotificationCategoryAsync('focus-choice-break', [
    {
      identifier: 'extend',
      buttonTitle: 'Extend',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'start-break',
      buttonTitle: 'Start break',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('focus-choice-end', [
    {
      identifier: 'extend',
      buttonTitle: 'Extend',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'end-session',
      buttonTitle: 'End session',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('break-choice', [
    {
      identifier: 'start-focus',
      buttonTitle: 'Start focus',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'end-session',
      buttonTitle: 'End session',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('strict-escape', [
    {
      identifier: 'force-end',
      buttonTitle: 'End session',
      options: { opensAppToForeground: true },
    },
  ]);

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted === true;
}

export function createPhaseNotificationScheduler(): PhaseNotificationScheduler {
  return {
    async scheduleAll(
      items: { at: number; content: PhaseNotification }[],
    ): Promise<void> {
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const item of items) {
        if (item.at <= Date.now()) {
          continue;
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: item.content.title,
            body: item.content.body,
            sound: 'bell.wav',
            categoryIdentifier: item.content.categoryId ?? undefined,
            data: { kind: 'phase-end' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(item.at),
            channelId: PHASE_CHANNEL_ID,
          },
        });
      }
    },

    async cancelAll(): Promise<void> {
      await Notifications.cancelAllScheduledNotificationsAsync();
    },

    async dismissDelivered(): Promise<void> {
      await Notifications.dismissAllNotificationsAsync();
    },
  };
}
