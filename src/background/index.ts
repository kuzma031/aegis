import { SessionController } from './sessionController';
import { BlockingSync } from './blockingSync';
import { isCommand, type Command } from './messages';
import { getPendingBreak } from '@core/session';
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
  BREAK_CHOICE_NOTIFICATION_ID,
  createNotificationAdapter,
  FOCUS_CHOICE_NOTIFICATION_ID,
  SESSION_COMPLETE_NOTIFICATION_ID,
  STRICT_ESCAPE_NOTIFICATION_ID,
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

const POPUP_WINDOW_WIDTH = 380;
const POPUP_WINDOW_HEIGHT = 620;
const POPUP_PAGE_URL = chrome.runtime.getURL('popup.html');

let focusChoiceWindowId: number | null = null;

async function openPopupWindowFallback(): Promise<void> {
  if (focusChoiceWindowId != null) {
    try {
      await chrome.windows.update(focusChoiceWindowId, { focused: true });
      return;
    } catch {
      focusChoiceWindowId = null;
    }
  }

  const created = await chrome.windows.create({
    url: POPUP_PAGE_URL,
    type: 'popup',
    width: POPUP_WINDOW_WIDTH,
    height: POPUP_WINDOW_HEIGHT,
    focused: true,
  });
  focusChoiceWindowId = created?.id ?? null;
}

async function openExtensionPopup(): Promise<void> {
  try {
    await chrome.action.openPopup();
    return;
  } catch (error: unknown) {
    console.warn('[focus] openPopup unavailable, opening window fallback', error);
  }

  try {
    await openPopupWindowFallback();
  } catch (error: unknown) {
    console.error('[focus] popup window fallback failed', error);
  }
}

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === focusChoiceWindowId) {
    focusChoiceWindowId = null;
  }
});

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
  if (notificationId === SESSION_COMPLETE_NOTIFICATION_ID) {
    if (buttonIndex !== 0) {
      return;
    }
    void controller
      .handleCommand({ type: 'START_ANOTHER' })
      .catch((error: unknown) => {
        console.error('[focus] start another from notification failed', error);
      });
    return;
  }

  if (notificationId === FOCUS_CHOICE_NOTIFICATION_ID) {
    if (buttonIndex === 0) {
      // Extend: open popup so the user can pick minutes.
      void openExtensionPopup();
      return;
    }

    if (buttonIndex === 1) {
      void (async () => {
        try {
          const state = await repo.load();
          const session = state.activeSession;
          if (
            session?.status === 'awaiting' &&
            session.phase === 'focus' &&
            getPendingBreak(session).minutes <= 0
          ) {
            await controller.handleCommand({ type: 'END_SESSION' });
            return;
          }
          await controller.handleCommand({ type: 'START_BREAK' });
        } catch (error: unknown) {
          console.error('[focus] focus choice notification action failed', error);
        }
      })();
    }
    return;
  }

  if (notificationId === BREAK_CHOICE_NOTIFICATION_ID) {
    if (buttonIndex === 0) {
      void controller
        .handleCommand({ type: 'CONTINUE_FOCUS' })
        .catch((error: unknown) => {
          console.error('[focus] continue focus from notification failed', error);
        });
      return;
    }
    if (buttonIndex === 1) {
      void controller.handleCommand({ type: 'END_SESSION' }).catch((error: unknown) => {
        console.error('[focus] end session from notification failed', error);
      });
    }
    return;
  }

  if (notificationId === STRICT_ESCAPE_NOTIFICATION_ID && buttonIndex === 0) {
    void controller
      .handleCommand({ type: 'END_SESSION', force: true })
      .catch((error: unknown) => {
        console.error('[focus] end locked session from notification failed', error);
      });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (
    notificationId !== SESSION_COMPLETE_NOTIFICATION_ID &&
    notificationId !== FOCUS_CHOICE_NOTIFICATION_ID &&
    notificationId !== BREAK_CHOICE_NOTIFICATION_ID &&
    notificationId !== STRICT_ESCAPE_NOTIFICATION_ID
  ) {
    return;
  }
  void openExtensionPopup();
});
