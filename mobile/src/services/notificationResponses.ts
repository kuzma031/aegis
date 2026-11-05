import * as Notifications from 'expo-notifications';
import { getPendingBreak } from '@core/session';
import type { StateRepository } from '@platform/storage';
import type { SessionController } from './sessionController';

export async function handleNotificationAction(
  controller: SessionController,
  repo: StateRepository,
  actionIdentifier: string,
): Promise<void> {
  await controller.reconcile();

  if (
    actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
    actionIdentifier === 'extend'
  ) {
    return;
  }

  try {
    if (actionIdentifier === 'start-break') {
      const state = await repo.load();
      const session = state.activeSession;
      if (
        session?.status === 'awaiting' &&
        session.phase === 'focus' &&
        getPendingBreak(session).minutes <= 0
      ) {
        const result = await controller.handleCommand({ type: 'END_SESSION' });
        if (!result.ok) {
          console.warn('[focus] end session from notification failed', result.error);
        }
        return;
      }
      const result = await controller.handleCommand({ type: 'START_BREAK' });
      if (!result.ok) {
        console.warn('[focus] start break from notification failed', result.error);
      }
      return;
    }

    if (actionIdentifier === 'start-focus') {
      const result = await controller.handleCommand({ type: 'CONTINUE_FOCUS' });
      if (!result.ok) {
        console.warn('[focus] continue focus from notification failed', result.error);
      }
      return;
    }

    if (actionIdentifier === 'end-session') {
      const result = await controller.handleCommand({ type: 'END_SESSION' });
      if (!result.ok) {
        console.warn('[focus] end session from notification failed', result.error);
      }
      return;
    }

    if (actionIdentifier === 'force-end') {
      const result = await controller.handleCommand({
        type: 'END_SESSION',
        force: true,
      });
      if (!result.ok) {
        console.warn(
          '[focus] end locked session from notification failed',
          result.error,
        );
      }
    }
  } catch (error: unknown) {
    console.error('[focus] notification action failed', error);
  }
}
