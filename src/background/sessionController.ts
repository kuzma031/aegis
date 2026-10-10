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
  completeSession,
  dismissCompletion,
  endSession,
  isExpired,
  pauseSession,
  recordDistraction,
  resumeSession,
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
import type { StateRepository } from '@platform/storage';

export { sitesToBlock };

/** Chrome one-shot alarms are delayed below ~30s; use setTimeout as a backup. */
const CHROME_ALARM_MIN_MS = 30_000;

export class SessionController {
  private readonly repo: StateRepository;
  private readonly clock: Clock;
  private readonly alarms: AlarmAdapter;
  private readonly notifications: NotificationAdapter;
  private readonly blockingSync: BlockingSynchronizer;
  private readonly badge: ActionBadgeAdapter;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
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
        return this.end();
      case 'START_ANOTHER':
        return this.startAnother();
      case 'DISMISS_COMPLETION':
        return this.dismiss();
      case 'RECORD_DISTRACTION':
        return this.recordDistractionAttempt(command.site);
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

    if (session.status === 'paused') {
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
        if (beforePhase === 'focus' && next?.phase === 'break') {
          const record = completed.value.history.at(-1);
          if (record) {
            const time = formatFocusTimeLabel(record.focusedMs);
            await this.notifications.show(
              DEFAULT_FOCUS_COMPLETE_TITLE,
              formatNotificationTemplate(DEFAULT_FOCUS_COMPLETE_MESSAGE, { time }),
            );
          }
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

  private async end(): Promise<VoidResult> {
    const result = await this.apply((state) => endSession(state, this.clock.now()));
    if (!result.ok) {
      return result;
    }
    await this.clearExpiryScheduling();
    await this.notifications.clear();
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
    await this.blockingSync.syncFromState(state);
    await this.syncBadgeAndTick(state);
  }

  private async syncBadgeAndTick(state?: AppState): Promise<void> {
    const current = state ?? (await this.repo.load());
    await this.badge.sync(current, this.clock.now());

    const session = current.activeSession;
    const running =
      session?.status === 'running' && !isExpired(session, this.clock.now());
    if (running) {
      await this.alarms.startBadgeTick();
    } else {
      await this.alarms.clearBadgeTick();
    }
  }
}
