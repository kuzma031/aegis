import type { Command } from './messages';
import type { BlockingSynchronizer } from './blockingSync';
import { sitesToBlock } from './blockingSync';
import {
  DEFAULT_CYCLE_FINISHED_MESSAGE,
  DEFAULT_CYCLE_FINISHED_TITLE,
  DEFAULT_FOCUS_COMPLETE_MESSAGE,
  DEFAULT_FOCUS_COMPLETE_TITLE,
  formatFocusTimeLabel,
  formatNotificationTemplate,
} from '@core/completionFeedback';
import {
  allowPeek,
  beginPeekWait,
  clearPeekWait,
  completeSession,
  continueFocusSession,
  dismissCompletion,
  endSession,
  extendFocusSession,
  getPendingBreak,
  isExpired,
  nextPeekExpiryAt,
  pauseSession,
  pruneExpiredPeeks,
  recordDistraction,
  resumeSession,
  startBreakSession,
  startSession,
} from '@core/session';
import {
  err,
  errVoid,
  okVoid,
  type AppState,
  type Result,
  type VoidResult,
} from '@core/types';
import type { Clock } from '@platform/clock';
import { playCompletionSound } from '@platform/completionSound';
import type {
  ActionBadgeAdapter,
  AlarmAdapter,
  NotificationAdapter,
} from '@platform/interfaces';
import {
  BREAK_CHOICE_NOTIFICATION_ID,
  FOCUS_CHOICE_NOTIFICATION_ID,
  STRICT_ESCAPE_NOTIFICATION_ID,
} from '@platform/notifications';
import type { StateRepository } from '@platform/storage';

export { sitesToBlock };

/** Chrome one-shot alarms are delayed below ~30s; use setTimeout as a backup. */
const CHROME_ALARM_MIN_MS = 30_000;

const FOCUS_CHOICE_TITLE = 'Are you in flow?';
const FOCUS_CHOICE_MESSAGE = 'Extend the session, or start your break.';
const BREAK_CHOICE_TITLE = 'Break finished';
const BREAK_CHOICE_MESSAGE = 'Start another focus session, or end and see your recap.';

export class SessionController {
  private readonly repo: StateRepository;
  private readonly clock: Clock;
  private readonly alarms: AlarmAdapter;
  private readonly notifications: NotificationAdapter;
  private readonly blockingSync: BlockingSynchronizer;
  private readonly badge: ActionBadgeAdapter;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private peekExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Serialize expiry handling so alarm + UI CHECK_EXPIRED can't double-advance. */
  private expiryChain: Promise<void> = Promise.resolve();

  constructor(
    repo: StateRepository,
    clock: Clock,
    alarms: AlarmAdapter,
    notifications: NotificationAdapter,
    blockingSync: BlockingSynchronizer,
    badge: ActionBadgeAdapter,
  ) {
    this.repo = repo;
    this.clock = clock;
    this.alarms = alarms;
    this.notifications = notifications;
    this.blockingSync = blockingSync;
    this.badge = badge;
  }

  async handleCommand(command: Command): Promise<VoidResult> {
    switch (command.type) {
      case 'START_SESSION':
        return this.start(
          command.contextId,
          command.durationMinutes,
          command.breakMinutes,
          command.repeat,
        );
      case 'PAUSE_SESSION':
        return this.pause();
      case 'RESUME_SESSION':
        return this.resume();
      case 'END_SESSION':
        return this.end(command.force === true);
      case 'EXTEND_FOCUS':
        return this.extendFocus(command.durationMinutes);
      case 'START_BREAK':
        return this.startBreak();
      case 'CONTINUE_FOCUS':
        return this.continueFocus();
      case 'START_ANOTHER':
        return this.startAnother();
      case 'DISMISS_COMPLETION':
        return this.dismiss();
      case 'RECORD_DISTRACTION':
        return this.recordDistractionAttempt(command.site);
      case 'BEGIN_PEEK_WAIT':
        return this.beginPeek(command.site);
      case 'CLEAR_PEEK_WAIT':
        return this.clearPeek();
      case 'ALLOW_PEEK':
        return this.grantPeek(command.site, command.durationMinutes);
      case 'CHECK_EXPIRED':
        await this.handleAlarm();
        return okVoid();
      default: {
        const _exhaustive: never = command;
        return errVoid(`Unknown command: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  async handleBadgeTick(): Promise<void> {
    await this.handleAlarm();
    await this.prunePeeksAndResync();
    await this.syncBadgeAndTick();
  }

  async handleAlarm(): Promise<void> {
    const run = this.expiryChain.then(() => this.advanceIfExpired());
    this.expiryChain = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  async reconcile(): Promise<void> {
    const state = await this.repo.load();
    const session = state.activeSession;

    if (!session) {
      await this.clearExpiryScheduling();
      await this.syncSideEffects();
      return;
    }

    if (session.status === 'paused' || session.status === 'awaiting') {
      await this.clearExpiryScheduling();
      await this.syncSideEffects();
      return;
    }

    if (isExpired(session, this.clock.now())) {
      await this.handleAlarm();
      return;
    }

    if (session.endsAt != null) {
      await this.scheduleExpiry(session.endsAt);
    }
    await this.syncSideEffects();
  }

  private async advanceIfExpired(): Promise<void> {
    let beforePhase: 'focus' | 'break' | null = null;
    const completed = await this.apply((current) => {
      const session = current.activeSession;
      if (!session || session.status !== 'running') {
        return err('No running session');
      }
      if (!isExpired(session, this.clock.now())) {
        return err('Session has not expired yet');
      }
      beforePhase = session.phase;
      return completeSession(current, this.clock.now());
    });

    if (!completed.ok || beforePhase == null) {
      return;
    }

    await this.afterPhaseAdvance(completed, beforePhase);
  }

  private async afterPhaseAdvance(
    completed: Result<AppState>,
    beforePhase: 'focus' | 'break',
  ): Promise<void> {
    await this.clearExpiryScheduling();

    if (completed.ok) {
      const next = completed.value.activeSession;
      const settings = completed.value.settings;
      if (next?.endsAt != null) {
        await this.scheduleExpiry(next.endsAt);
      }

      // Never block notifications on audio — offscreen playback can race/fail.
      void playCompletionSound(settings.completionSoundId).catch((error: unknown) => {
        console.error('[focus] completion sound failed', error);
      });

      try {
        if (beforePhase === 'focus' && next?.status === 'awaiting') {
          const pending = getPendingBreak(next);
          const secondTitle = pending.minutes > 0 ? 'Start break' : 'End session';
          await this.notifications.showChoice(
            FOCUS_CHOICE_NOTIFICATION_ID,
            FOCUS_CHOICE_TITLE,
            FOCUS_CHOICE_MESSAGE,
            [{ title: 'Extend' }, { title: secondTitle }],
          );
        } else if (beforePhase === 'break' && next?.status === 'awaiting') {
          await this.notifications.showChoice(
            BREAK_CHOICE_NOTIFICATION_ID,
            BREAK_CHOICE_TITLE,
            BREAK_CHOICE_MESSAGE,
            [{ title: 'Start focus' }, { title: 'End session' }],
          );
        } else if (beforePhase === 'focus' && next?.phase === 'break') {
          const record = completed.value.history.at(-1);
          if (record) {
            const time = formatFocusTimeLabel(record.focusedMs);
            const message = formatNotificationTemplate(DEFAULT_FOCUS_COMPLETE_MESSAGE, {
              time,
            });
            if (next.strictLockControls) {
              await this.notifications.showChoice(
                STRICT_ESCAPE_NOTIFICATION_ID,
                DEFAULT_FOCUS_COMPLETE_TITLE,
                message,
                [{ title: 'End session' }],
              );
            } else {
              await this.notifications.show(DEFAULT_FOCUS_COMPLETE_TITLE, message);
            }
          }
        } else if (
          beforePhase === 'break' &&
          next?.phase === 'focus' &&
          next.strictLockControls
        ) {
          await this.notifications.showChoice(
            STRICT_ESCAPE_NOTIFICATION_ID,
            'Break finished',
            'Next focus started. End the session if you need out.',
            [{ title: 'End session' }],
          );
        } else if (beforePhase === 'focus' && !next) {
          await this.notifications.show(
            DEFAULT_CYCLE_FINISHED_TITLE,
            DEFAULT_CYCLE_FINISHED_MESSAGE,
          );
        } else if (beforePhase === 'break' && !next) {
          await this.notifications.show(
            DEFAULT_CYCLE_FINISHED_TITLE,
            DEFAULT_CYCLE_FINISHED_MESSAGE,
          );
        }
      } catch (error: unknown) {
        console.error('[focus] completion notification failed', error);
      }
    }

    await this.syncSideEffects();
  }

  private async scheduleExpiry(endsAt: number): Promise<void> {
    await this.alarms.schedule(endsAt);
    this.clearExpiryTimer();
    const delay = endsAt - this.clock.now();
    if (delay > 0 && delay < CHROME_ALARM_MIN_MS) {
      this.expiryTimer = setTimeout(() => {
        this.expiryTimer = null;
        void this.handleAlarm().catch((error: unknown) => {
          console.error('[focus] short expiry timer failed', error);
        });
      }, delay);
    }
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer != null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private async clearExpiryScheduling(): Promise<void> {
    this.clearExpiryTimer();
    await this.alarms.clear();
  }

  private async start(
    contextId: string,
    durationMinutes: number,
    breakMinutes: number,
    repeat: boolean,
  ): Promise<VoidResult> {
    const result = await this.apply((state) =>
      startSession(
        state,
        contextId,
        durationMinutes,
        breakMinutes,
        repeat,
        this.clock.now(),
      ),
    );
    if (!result.ok) {
      return result;
    }

    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.scheduleExpiry(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async pause(): Promise<VoidResult> {
    const result = await this.apply((state) => pauseSession(state, this.clock.now()));
    if (!result.ok) {
      return result;
    }
    await this.clearExpiryScheduling();
    await this.syncSideEffects();
    return okVoid();
  }

  private async resume(): Promise<VoidResult> {
    const result = await this.apply((state) => resumeSession(state, this.clock.now()));
    if (!result.ok) {
      return result;
    }

    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.scheduleExpiry(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async end(force = false): Promise<VoidResult> {
    const result = await this.apply((state) =>
      endSession(state, this.clock.now(), { force }),
    );
    if (!result.ok) {
      return result;
    }
    await this.clearExpiryScheduling();
    await this.notifications.clear();
    await this.syncSideEffects();
    return okVoid();
  }

  private async extendFocus(durationMinutes: number): Promise<VoidResult> {
    const result = await this.apply((state) =>
      extendFocusSession(state, durationMinutes, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    await this.notifications.clear(FOCUS_CHOICE_NOTIFICATION_ID);
    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.scheduleExpiry(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async startBreak(): Promise<VoidResult> {
    const result = await this.apply((state) =>
      startBreakSession(state, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    await this.notifications.clear(FOCUS_CHOICE_NOTIFICATION_ID);
    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.scheduleExpiry(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async continueFocus(): Promise<VoidResult> {
    const result = await this.apply((state) =>
      continueFocusSession(state, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    await this.notifications.clear(BREAK_CHOICE_NOTIFICATION_ID);
    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.scheduleExpiry(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async startAnother(): Promise<VoidResult> {
    const state = await this.repo.load();
    const settings = state.settings;
    const contextId =
      settings.selectedContextId ??
      state.contexts[0]?.id ??
      null;
    if (!contextId) {
      return errVoid('No context available');
    }
    if (state.activeSession) {
      return errVoid('A session is already active');
    }

    return this.start(
      contextId,
      settings.lastDurationMinutes,
      settings.lastBreakMinutes,
      settings.lastRepeat,
    );
  }

  private async dismiss(): Promise<VoidResult> {
    const result = await this.apply((state) => dismissCompletion(state));
    if (!result.ok) {
      return result;
    }
    return okVoid();
  }

  private async recordDistractionAttempt(site?: string): Promise<VoidResult> {
    const result = await this.apply((state) => recordDistraction(state, site));
    if (!result.ok) {
      return okVoid();
    }
    return okVoid();
  }

  private async beginPeek(site?: string): Promise<VoidResult> {
    const result = await this.apply((state) =>
      beginPeekWait(state, site, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    return okVoid();
  }

  private async clearPeek(): Promise<VoidResult> {
    const result = await this.apply((state) => clearPeekWait(state));
    if (!result.ok) {
      return result;
    }
    return okVoid();
  }

  private async grantPeek(
    site: string | undefined,
    durationMinutes: number,
  ): Promise<VoidResult> {
    const result = await this.apply((state) =>
      allowPeek(state, site, durationMinutes, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async prunePeeksAndResync(): Promise<void> {
    const before = await this.repo.load();
    const pruned = pruneExpiredPeeks(before, this.clock.now());
    if (pruned === before) {
      this.schedulePeekExpiry(pruned);
      return;
    }
    await this.repo.update(() => pruned);
    await this.blockingSync.syncFromState(pruned, this.clock.now());
    this.schedulePeekExpiry(pruned);
  }

  private schedulePeekExpiry(state: AppState): void {
    if (this.peekExpiryTimer != null) {
      clearTimeout(this.peekExpiryTimer);
      this.peekExpiryTimer = null;
    }
    const session = state.activeSession;
    if (!session) {
      return;
    }
    const when = nextPeekExpiryAt(session, this.clock.now());
    if (when == null) {
      return;
    }
    const delay = Math.max(0, when - this.clock.now());
    this.peekExpiryTimer = setTimeout(() => {
      this.peekExpiryTimer = null;
      void this.prunePeeksAndResync().catch((error: unknown) => {
        console.error('[focus] peek expiry failed', error);
      });
    }, delay);
  }

  private async apply(
    fn: (state: AppState) => Result<AppState>,
  ): Promise<Result<AppState>> {
    let outcome: Result<AppState> = err('Update failed');
    await this.repo.update((state) => {
      outcome = fn(state);
      return outcome.ok ? outcome.value : state;
    });
    return outcome;
  }

  private async syncSideEffects(): Promise<void> {
    const state = await this.repo.load();
    try {
      await this.blockingSync.syncFromState(state, this.clock.now());
    } catch (error: unknown) {
      // Tab restore races must not fail the user-facing command.
      console.warn('[focus] blocking sync after command failed', error);
    }
    await this.syncBadgeAndTick(state);
    this.schedulePeekExpiry(state);
  }

  private async syncBadgeAndTick(state?: AppState): Promise<void> {
    const current = state ?? (await this.repo.load());
    await this.badge.sync(current, this.clock.now());

    const session = current.activeSession;
    const running =
      session?.status === 'running' && !isExpired(session, this.clock.now());
    const hasPeek = (session?.run.peekGrants.length ?? 0) > 0;
    if (running || hasPeek) {
      await this.alarms.startBadgeTick();
    } else {
      await this.alarms.clearBadgeTick();
    }
  }
}
