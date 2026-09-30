import { describe, expect, it } from 'vitest';
import { SessionController } from './sessionController';
import { sitesToBlock, type BlockingSynchronizer } from './blockingSync';
import { DEVELOPMENT_CONTEXT_ID } from '@core/seed';
import type { Clock } from '@platform/clock';
import type { AlarmAdapter, NotificationAdapter } from '@platform/interfaces';
import { MemoryStateRepository } from '@platform/storage';
import type { AppState, SessionRecord } from '@core/types';

class FakeClock implements Clock {
  current: number;

  constructor(current: number) {
    this.current = current;
  }

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

function createFakes(now: number) {
  const clock = new FakeClock(now);
  const repo = new MemoryStateRepository(clock);
  const scheduled: number[] = [];
  const alarms: AlarmAdapter = {
    async schedule(when: number) {
      scheduled.length = 0;
      scheduled.push(when);
    },
    async clear() {
      scheduled.length = 0;
    },
  };
  const notificationsShown: SessionRecord[] = [];
  const notifications: NotificationAdapter = {
    async showSessionComplete(record) {
      notificationsShown.push(record);
    },
    async clear() {
      notificationsShown.length = 0;
    },
  };
  const synced: string[][] = [];
  const blockingSync: BlockingSynchronizer = {
    async syncFromState(state: AppState) {
      synced.push(sitesToBlock(state));
    },
  };
  const controller = new SessionController(
    repo,
    clock,
    alarms,
    notifications,
    blockingSync,
  );
  return { clock, repo, controller, scheduled, notificationsShown, synced };
}

describe('SessionController', () => {
  const NOW = 1_700_000_000_000;

  it('starts, pauses, resumes, and completes a session', async () => {
    const { clock, repo, controller, scheduled, notificationsShown } = createFakes(NOW);

    const started = await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
    });
    expect(started).toEqual({ ok: true });
    expect(scheduled).toEqual([NOW + 25 * 60_000]);

    clock.advance(5 * 60_000);
    expect(await controller.handleCommand({ type: 'PAUSE_SESSION' })).toEqual({
      ok: true,
    });
    expect(scheduled).toEqual([]);

    clock.advance(2 * 60_000);
    expect(await controller.handleCommand({ type: 'RESUME_SESSION' })).toEqual({
      ok: true,
    });
    expect(scheduled).toEqual([clock.now() + 20 * 60_000]);

    clock.advance(20 * 60_000);
    await controller.handleAlarm();

    const state = await repo.load();
    expect(state.activeSession).toBeNull();
    expect(state.lastCompletion?.record.outcome).toBe('completed');
    expect(state.history).toHaveLength(1);
    expect(notificationsShown).toHaveLength(1);
    expect(scheduled).toEqual([]);
  });

  it('reconciles an expired running session after the worker was asleep', async () => {
    const { clock, repo, controller, notificationsShown, scheduled } = createFakes(NOW);

    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 10,
    });

    clock.advance(15 * 60_000);
    await controller.reconcile();

    const state = await repo.load();
    expect(state.activeSession).toBeNull();
    expect(state.lastCompletion?.record.outcome).toBe('completed');
    expect(notificationsShown).toHaveLength(1);
    expect(scheduled).toEqual([]);
  });

  it('ignores an alarm while the session is paused', async () => {
    const { clock, repo, controller, notificationsShown } = createFakes(NOW);

    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
    });
    clock.advance(5 * 60_000);
    await controller.handleCommand({ type: 'PAUSE_SESSION' });

    clock.advance(30 * 60_000);
    await controller.handleAlarm();

    const state = await repo.load();
    expect(state.activeSession?.status).toBe('paused');
    expect(state.history).toHaveLength(0);
    expect(notificationsShown).toHaveLength(0);
  });

  it('starts another session from the last completion', async () => {
    const { clock, repo, controller } = createFakes(NOW);

    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
    });
    clock.advance(25 * 60_000);
    await controller.handleAlarm();

    expect(await controller.handleCommand({ type: 'START_ANOTHER' })).toEqual({
      ok: true,
    });

    const state = await repo.load();
    expect(state.activeSession?.contextId).toBe(DEVELOPMENT_CONTEXT_ID);
    expect(state.activeSession?.plannedMs).toBe(25 * 60_000);
    expect(state.lastCompletion).toBeNull();
  });

  it('recreates the alarm when reconciling a still-running session', async () => {
    const { clock, controller, scheduled } = createFakes(NOW);

    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
    });
    scheduled.length = 0;

    clock.advance(5 * 60_000);
    await controller.reconcile();
    expect(scheduled).toEqual([NOW + 25 * 60_000]);
  });
});
