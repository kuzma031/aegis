import { SessionController } from './sessionController';
import { BlockingSync } from './blockingSync';
import { isCommand, type Command } from './messages';
import type { VoidResult } from '@core/types';
import { createBlockingAdapter } from '@platform/blocking';
import { createSystemClock } from '@platform/clock';
import { createAlarmAdapter, SESSION_END_ALARM } from '@platform/alarms';
import {
  createNotificationAdapter,
  SESSION_COMPLETE_NOTIFICATION_ID,
} from '@platform/notifications';
import { ChromeStateRepository } from '@platform/storage';
import { createTabsAdapter } from '@platform/tabs';

const clock = createSystemClock();
const repo = new ChromeStateRepository(clock);
const alarms = createAlarmAdapter();
const notifications = createNotificationAdapter();
const extensionId = chrome.runtime.id;
const blockingSync = new BlockingSync(
  createBlockingAdapter(extensionId),
  createTabsAdapter(),
  extensionId,
);
const controller = new SessionController(
  repo,
  clock,
  alarms,
  notifications,
  blockingSync,
);

console.log('[focus] worker started');

void controller.reconcile().catch((error: unknown) => {
  console.error('[focus] reconcile failed', error);
});

chrome.runtime.onInstalled.addListener(() => {
  void controller.reconcile().catch((error: unknown) => {
    console.error('[focus] onInstalled reconcile failed', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  void controller.reconcile().catch((error: unknown) => {
    console.error('[focus] onStartup reconcile failed', error);
  });
});

repo.subscribe((state) => {
  void blockingSync.syncFromState(state).catch((error: unknown) => {
    console.error('[focus] storage blocking sync failed', error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (!isCommand(message)) {
        const response: VoidResult = { ok: false, error: 'Unknown command' };
        sendResponse(response);
        return;
      }
      const response = await controller.handleCommand(message as Command);
      sendResponse(response);
    } catch (error: unknown) {
      console.error('[focus] command failed', error);
      const response: VoidResult = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      };
      sendResponse(response);
    }
  })();
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SESSION_END_ALARM) {
    return;
  }
  void controller.handleAlarm().catch((error: unknown) => {
    console.error('[focus] alarm handler failed', error);
  });
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId !== SESSION_COMPLETE_NOTIFICATION_ID || buttonIndex !== 0) {
    return;
  }
  void controller
    .handleCommand({ type: 'START_ANOTHER' })
    .catch((error: unknown) => {
      console.error('[focus] start another from notification failed', error);
    });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId !== SESSION_COMPLETE_NOTIFICATION_ID) {
    return;
  }
  try {
    void chrome.action.openPopup();
  } catch (error: unknown) {
    console.error('[focus] openPopup failed', error);
  }
});
