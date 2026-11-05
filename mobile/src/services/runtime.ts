import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { VoidResult } from '@core/types';
import { createBellPlayer } from '@platform/bell';
import { createSystemClock } from '@platform/clock';
import {
  createPhaseNotificationScheduler,
  ensureNotificationPermission,
  setupNotifications,
} from '@platform/notifications';
import {
  AsyncStorageStateRepository,
  type StateRepository,
} from '@platform/storage';
import type { Command } from './messages';
import { handleNotificationAction } from './notificationResponses';
import { SessionController } from './sessionController';

const clock = createSystemClock();
const repo = new AsyncStorageStateRepository(clock);
const scheduler = createPhaseNotificationScheduler();
const bell = createBellPlayer();
const controller = new SessionController(
  repo,
  clock,
  scheduler,
  bell,
  () => AppState.currentState === 'active',
);

let started = false;
let handledResponseId: string | null = null;

export function getAppRepository(): StateRepository {
  return repo;
}

export function getController(): SessionController {
  return controller;
}

export async function sendCommand(command: Command): Promise<VoidResult> {
  try {
    return await controller.handleCommand(command);
  } catch (error: unknown) {
    console.error('[focus] sendCommand failed', error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not run the session command',
    };
  }
}

async function processResponse(
  response: Notifications.NotificationResponse | null,
): Promise<void> {
  if (!response) {
    return;
  }
  const id = response.notification.request.identifier;
  if (id && id === handledResponseId) {
    return;
  }
  handledResponseId = id;
  await handleNotificationAction(
    controller,
    repo,
    response.actionIdentifier,
  );
}

export function startRuntime(): void {
  if (started) {
    return;
  }
  started = true;

  void (async () => {
    try {
      await setupNotifications();
    } catch (error: unknown) {
      console.error('[focus] notification setup failed', error);
    }
    void ensureNotificationPermission().catch((error: unknown) => {
      console.error('[focus] notification permission failed', error);
    });

    repo.subscribe(() => {
      void controller.syncSideEffects().catch((error: unknown) => {
        console.error('[focus] side-effect sync failed', error);
      });
    });

    try {
      await controller.reconcile();
    } catch (error: unknown) {
      console.error('[focus] reconcile failed', error);
    }

    AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void controller.reconcile().catch((error: unknown) => {
          console.error('[focus] foreground reconcile failed', error);
        });
      }
    });

    Notifications.addNotificationResponseReceivedListener((response) => {
      void processResponse(response).catch((error: unknown) => {
        console.error('[focus] notification response failed', error);
      });
    });

    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      await processResponse(last);
    } catch (error: unknown) {
      console.error('[focus] last notification response failed', error);
    }
  })();
}
