import {
  DEFAULT_CYCLE_FINISHED_MESSAGE,
  DEFAULT_CYCLE_FINISHED_TITLE,
  DEFAULT_FOCUS_COMPLETE_MESSAGE,
  DEFAULT_FOCUS_COMPLETE_TITLE,
  formatFocusTimeLabel,
  formatNotificationTemplate,
} from './completionFeedback';
import { getPendingBreak } from './session';
import type { AppState, SessionPhase } from './types';

export type PhaseNotificationCategory =
  | 'focus-choice-break'
  | 'focus-choice-end'
  | 'break-choice'
  | 'strict-escape';

export interface PhaseNotification {
  title: string;
  body: string;
  categoryId: PhaseNotificationCategory | null;
}

const FOCUS_CHOICE_TITLE = 'Are you in flow?';
const FOCUS_CHOICE_MESSAGE = 'Extend the session, or start your break.';
const BREAK_CHOICE_TITLE = 'Break finished';
const BREAK_CHOICE_MESSAGE =
  'Start another focus session, or end and see your recap.';

export function phaseEndNotification(
  beforePhase: SessionPhase,
  next: AppState,
): PhaseNotification | null {
  const session = next.activeSession;

  if (beforePhase === 'focus' && session?.status === 'awaiting') {
    const pending = getPendingBreak(session);
    return {
      title: FOCUS_CHOICE_TITLE,
      body: FOCUS_CHOICE_MESSAGE,
      categoryId:
        pending.minutes > 0 ? 'focus-choice-break' : 'focus-choice-end',
    };
  }

  if (beforePhase === 'break' && session?.status === 'awaiting') {
    return {
      title: BREAK_CHOICE_TITLE,
      body: BREAK_CHOICE_MESSAGE,
      categoryId: 'break-choice',
    };
  }

  if (beforePhase === 'focus' && session?.phase === 'break') {
    const record = next.history.at(-1);
    if (!record) {
      return null;
    }
    const time = formatFocusTimeLabel(record.focusedMs);
    const body = formatNotificationTemplate(DEFAULT_FOCUS_COMPLETE_MESSAGE, {
      time,
    });
    return {
      title: DEFAULT_FOCUS_COMPLETE_TITLE,
      body,
      categoryId: session.strictLockControls ? 'strict-escape' : null,
    };
  }

  if (
    beforePhase === 'break' &&
    session?.phase === 'focus' &&
    session.strictLockControls
  ) {
    return {
      title: 'Break finished',
      body: 'Next focus started. End the session if you need out.',
      categoryId: 'strict-escape',
    };
  }

  if (beforePhase === 'break' && session?.phase === 'focus') {
    return null;
  }

  if ((beforePhase === 'focus' || beforePhase === 'break') && !session) {
    return {
      title: DEFAULT_CYCLE_FINISHED_TITLE,
      body: DEFAULT_CYCLE_FINISHED_MESSAGE,
      categoryId: null,
    };
  }

  return null;
}
