import type { Command } from './messages';
import { advanceExpired, projectTransitions } from '@core/catchUp';
import { phaseEndNotification } from '@core/phaseNotifications';
import {
  allowPeek,
  beginPeekWait,
  clearPeekWait,
  continueFocusSession,
  dismissCompletion,
  endSession,
  extendFocusSession,
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
  ok,
  okVoid,
  type AppState,
  type Result,
  type VoidResult,
} from '@core/types';
import type { Clock } from '@platform/clock';
import type {
  BellPlayer,
  PhaseNotificationScheduler,
} from '@platform/interfaces';
import type { StateRepository } from '@platform/storage';

const NOTIFICATION_HORIZON_MS = 24 * 60 * 60_000;
const NOTIFICATION_MAX_COUNT = 48;

export class SessionController {
  private readonly repo: StateRepository;
  private readonly clock: Clock;
  private readonly scheduler: PhaseNotificationScheduler;
  private readonly bell: BellPlayer;
  private readonly isForeground: () => boolean;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private peekExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryChain: Promise<void> = Promise.resolve();
  private syncing = false;

  constructor(
    repo: StateRepository,
    clock: Clock,
    scheduler: PhaseNotificationScheduler,
    bell: BellPlayer,
    isForeground: () => boolean,
  ) {
    this.repo = repo;
    this.clock = clock;
    this.scheduler = scheduler;
    this.bell = bell;
    this.isForeground = isForeground;
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

  async handleAlarm(): Promise<void> {
    const run = this.expiryChain.then(() => this.advanceIfExpired());
    this.expiryChain = run.then(
      () => undefined,
      () => undefined,
    );
    await run;
  }

  async reconcile(): Promise<void> {
    await this.handleAlarm();
    await this.syncSideEffects();
  }

  async syncSideEffects(): Promise<void> {
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    try {
      let state = await this.repo.load();
      const pruned = pruneExpiredPeeks(state, this.clock.now());
      if (pruned !== state) {
        await this.repo.update(() => pruned);
        state = pruned;
      }

      this.clearExpiryTimer();
      const session = state.activeSession;
      if (session?.status === 'running' && session.endsAt != null) {
        this.scheduleExpiry(session.endsAt);
      }

      if (session?.status === 'running') {
        const transitions = projectTransitions(
          state,
          this.clock.now(),
          NOTIFICATION_HORIZON_MS,
          NOTIFICATION_MAX_COUNT,
        );
        const items = transitions
          .map((transition) => {
            const content = phaseEndNotification(
              transition.beforePhase,
              transition.next,
            );
            if (!content) {
              return null;
            }
            return { at: transition.at, content };
          })
          .filter(
            (item): item is { at: number; content: NonNullable<typeof item>['content'] } =>
              item != null,
          );
        await this.scheduler.scheduleAll(items);
      } else {
        await this.scheduler.cancelAll();
      }

      this.schedulePeekExpiry(state);
    } finally {
      this.syncing = false;
    }
  }

  private async advanceIfExpired(): Promise<void> {
    let transitions: ReturnType<typeof advanceExpired>['transitions'] = [];
    await this.apply((current) => {
      const result = advanceExpired(current, this.clock.now());
      transitions = result.transitions;
      return transitions.length > 0 ? ok(result.state) : err('Nothing expired');
    });

    if (transitions.length === 0) {
      return;
    }

    if (this.isForeground()) {
      this.bell.play();
    }
    await this.syncSideEffects();
  }

  private scheduleExpiry(endsAt: number): void {
    this.clearExpiryTimer();
    const delay = Math.max(0, endsAt - this.clock.now());
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      void this.handleAlarm().catch((error: unknown) => {
        console.error('[focus] expiry timer failed', error);
      });
    }, delay);
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer != null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
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
      void this.syncSideEffects().catch((error: unknown) => {
        console.error('[focus] peek expiry failed', error);
      });
    }, delay);
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
    await this.syncSideEffects();
    return okVoid();
  }

  private async pause(): Promise<VoidResult> {
    const result = await this.apply((state) =>
      pauseSession(state, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }
    this.clearExpiryTimer();
    await this.syncSideEffects();
    return okVoid();
  }

  private async resume(): Promise<VoidResult> {
    const result = await this.apply((state) =>
      resumeSession(state, this.clock.now()),
    );
    if (!result.ok) {
      return result;
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
    this.clearExpiryTimer();
    await this.scheduler.dismissDelivered();
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
    await this.scheduler.dismissDelivered();
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
    await this.scheduler.dismissDelivered();
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
    await this.scheduler.dismissDelivered();
    await this.syncSideEffects();
    return okVoid();
  }

  private async startAnother(): Promise<VoidResult> {
    const state = await this.repo.load();
    const settings = state.settings;
    const contextId =
      settings.selectedContextId ?? state.contexts[0]?.id ?? null;
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
}
