import { SessionController } from './sessionController';
import { BlockingSync } from './blockingSync';
import { isCommand, type Command } from './messages';
import type { VoidResult } from '@core/types';
import { createActionBadgeAdapter } from '@platform/actionBadge';
import { createBlockingAdapter } from '@platform/blocking';
import { createSystemClock } from '@platform/clock';
import {
  BADGE_TICK_ALARM,
  createAlarmAdapter,
  SESSION_END_ALARM,
} from '@platform/alarms';
import {
  createNotificationAdapter,
  SESSION_COMPLETE_NOTIFICATION_ID,
} from '@platform/notifications';
import { syncAmbientAudio } from '@platform/ambientSound';
import { syncSidePanelFromState } from '@platform/sidePanel';
import { ChromeStateRepository } from '@platform/storage';
import { createTabsAdapter } from '@platform/tabs';

const clock = createSystemClock();
const repo = new ChromeStateRepository(clock);
const alarms = createAlarmAdapter();
const notifications = createNotificationAdapter();
const badge = createActionBadgeAdapter();
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
  badge,
);

console.log('[focus] worker started');

function bootSession(): void {
  void (async () => {
    try {
      await controller.reconcile();
    } catch (error: unknown) {
      console.error('[focus] reconcile failed', error);
    }
    try {
      await syncAmbientAudio(await repo.load());
    } catch (error: unknown) {
      console.error('[focus] ambient sync failed', error);
    }
  })();
}

bootSession();

chrome.runtime.onInstalled.addListener(() => {
  bootSession();
});

chrome.runtime.onStartup.addListener(() => {
  bootSession();
});

repo.subscribe((state) => {
  void blockingSync.syncFromState(state).catch((error: unknown) => {
    console.error('[focus] storage blocking sync failed', error);
  });
  void badge.sync(state, clock.now()).catch((error: unknown) => {
    console.error('[focus] storage badge sync failed', error);
  });
  void syncSidePanelFromState(state).catch((error: unknown) => {
    console.error('[focus] side panel sync failed', error);
  });
  void syncAmbientAudio(state).catch((error: unknown) => {
    console.error('[focus] ambient sync failed', error);
  });
});

void repo
  .load()
  .then((state) => syncSidePanelFromState(state))
  .catch((error: unknown) => {
    console.error('[focus] initial side panel sync failed', error);
  });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Ignore non-commands (e.g. offscreen PLAY_COMPLETION_SOUND) so other listeners can handle them.
  if (!isCommand(message)) {
    return false;
  }
  void (async () => {
    try {
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
  if (alarm.name === BADGE_TICK_ALARM) {
    void (async () => {
      try {
        await controller.handleBadgeTick();
      } catch (error: unknown) {
        console.error('[focus] badge tick failed', error);
      }
      try {
        await syncAmbientAudio(await repo.load());
      } catch (error: unknown) {
        console.error('[focus] ambient sync failed', error);
      }
    })();
    return;
  }
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
