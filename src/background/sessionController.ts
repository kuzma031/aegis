import type { Command } from './messages';
import type { BlockingSynchronizer } from './blockingSync';
import { sitesToBlock } from './blockingSync';
import {
  completeSession,
  dismissCompletion,
  endSession,
  isExpired,
  pauseSession,
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
import type {
  ActionBadgeAdapter,
  AlarmAdapter,
  NotificationAdapter,
} from '@platform/interfaces';
import type { StateRepository } from '@platform/storage';

export { sitesToBlock };

export class SessionController {
  private readonly repo: StateRepository;
  private readonly clock: Clock;
  private readonly alarms: AlarmAdapter;
  private readonly notifications: NotificationAdapter;
  private readonly blockingSync: BlockingSynchronizer;
  private readonly badge: ActionBadgeAdapter;

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
        return this.start(command.contextId, command.durationMinutes);
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
      default: {
        const _exhaustive: never = command;
        return errVoid(`Unknown command: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  async handleBadgeTick(): Promise<void> {
    await this.syncBadgeAndTick();
  }

  async handleAlarm(): Promise<void> {
    const state = await this.repo.load();
    const session = state.activeSession;
    if (!session || session.status !== 'running') {
      return;
    }
    if (!isExpired(session, this.clock.now())) {
      return;
    }

    const completed = await this.apply((current) =>
      completeSession(current, this.clock.now()),
    );
    await this.alarms.clear();
    await this.syncSideEffects();

    if (completed.ok && completed.value.lastCompletion) {
      await this.notifications.showSessionComplete(completed.value.lastCompletion.record);
    }
  }

  async reconcile(): Promise<void> {
    const state = await this.repo.load();
    const session = state.activeSession;

    if (!session) {
      await this.alarms.clear();
      await this.syncSideEffects();
      return;
    }

    if (session.status === 'paused') {
      await this.alarms.clear();
      await this.syncSideEffects();
      return;
    }

    if (isExpired(session, this.clock.now())) {
      const completed = await this.apply((current) =>
        completeSession(current, this.clock.now()),
      );
      await this.alarms.clear();
      await this.syncSideEffects();
      if (completed.ok && completed.value.lastCompletion) {
        await this.notifications.showSessionComplete(
          completed.value.lastCompletion.record,
        );
      }
      return;
    }

    if (session.endsAt != null) {
      await this.alarms.schedule(session.endsAt);
    }
    await this.syncSideEffects();
  }

  private async start(contextId: string, durationMinutes: number): Promise<VoidResult> {
    const result = await this.apply((state) =>
      startSession(state, contextId, durationMinutes, this.clock.now()),
    );
    if (!result.ok) {
      return result;
    }

    const endsAt = result.value.activeSession?.endsAt;
    if (endsAt != null) {
      await this.alarms.schedule(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async pause(): Promise<VoidResult> {
    const result = await this.apply((state) => pauseSession(state, this.clock.now()));
    if (!result.ok) {
      return result;
    }
    await this.alarms.clear();
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
      await this.alarms.schedule(endsAt);
    }
    await this.syncSideEffects();
    return okVoid();
  }

  private async end(): Promise<VoidResult> {
    const result = await this.apply((state) => endSession(state, this.clock.now()));
    if (!result.ok) {
      return result;
    }
    await this.alarms.clear();
    await this.notifications.clear();
    await this.syncSideEffects();
    return okVoid();
  }

  private async startAnother(): Promise<VoidResult> {
    const state = await this.repo.load();
    const completion = state.lastCompletion;
    if (!completion) {
      return errVoid('No completed session to restart');
    }

    const { record } = completion;
    if (!state.contexts.some((context) => context.id === record.contextId)) {
      return errVoid('Context no longer exists');
    }

    const durationMinutes =
      Math.round(record.plannedMs / 60_000) || state.settings.lastDurationMinutes;
    return this.start(record.contextId, durationMinutes);
  }

  private async dismiss(): Promise<VoidResult> {
    const result = await this.apply((state) => dismissCompletion(state));
    if (!result.ok) {
      return result;
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
