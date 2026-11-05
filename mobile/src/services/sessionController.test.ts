import { describe, expect, it, vi } from 'vitest';
import { DEVELOPMENT_CONTEXT_ID } from '@core/seed';
import type { PhaseNotification } from '@core/phaseNotifications';
import type { Clock } from '@platform/clock';
import type {
  BellPlayer,
  PhaseNotificationScheduler,
} from '@platform/interfaces';
import { MemoryStateRepository } from '@platform/storage';
import { SessionController } from './sessionController';

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

function createFakes(now: number, foreground = true) {
  const clock = new FakeClock(now);
  const repo = new MemoryStateRepository(clock);
  const scheduled: Array<{ at: number; content: PhaseNotification }> = [];
  let cancelCount = 0;
  const scheduler: PhaseNotificationScheduler = {
    async scheduleAll(items) {
      scheduled.length = 0;
      scheduled.push(...items);
    },
    async cancelAll() {
      cancelCount += 1;
      scheduled.length = 0;
    },
    async dismissDelivered() {},
  };
  const bellPlays: number[] = [];
  const bell: BellPlayer = {
    play() {
      bellPlays.push(clock.now());
    },
  };
  let isForeground = foreground;
  const controller = new SessionController(
    repo,
    clock,
    scheduler,
    bell,
    () => isForeground,
  );
  return {
    clock,
    repo,
    controller,
    scheduled,
    getCancelCount: () => cancelCount,
    bellPlays,
    setForeground: (value: boolean) => {
      isForeground = value;
    },
  };
}

describe('SessionController', () => {
  it('starts a session and schedules phase-end notifications', async () => {
    const { controller, scheduled, repo, clock } = createFakes(1_000_000);
    const result = await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    expect(result.ok).toBe(true);
    const state = await repo.load();
    expect(state.activeSession?.status).toBe('running');
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled[0]!.at).toBe(clock.now() + 25 * 60_000);
  });

  it('cancels notifications on pause', async () => {
    const { controller, getCancelCount, scheduled } = createFakes(1_000_000);
    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    expect(scheduled.length).toBeGreaterThan(0);
    const before = getCancelCount();
    const paused = await controller.handleCommand({ type: 'PAUSE_SESSION' });
    expect(paused.ok).toBe(true);
    expect(getCancelCount()).toBeGreaterThan(before);
    expect(scheduled).toHaveLength(0);
  });

  it('reconcile catches up multiple expired phases', async () => {
    vi.useFakeTimers();
    const { controller, repo, clock } = createFakes(1_000_000);
    await controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    clock.advance(70 * 60_000);
    await controller.reconcile();
    const state = await repo.load();
    expect(state.history.length).toBeGreaterThanOrEqual(2);
    expect(state.activeSession?.status).toBe('running');
    vi.useRealTimers();
  });

  it('plays the bell only when foreground', async () => {
    vi.useFakeTimers();
    const fakes = createFakes(1_000_000, true);
    await fakes.controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
      breakMinutes: 5,
      repeat: false,
    });
    fakes.clock.advance(25 * 60_000);
    await fakes.controller.reconcile();
    expect(fakes.bellPlays.length).toBe(1);

    const bg = createFakes(2_000_000, false);
    await bg.controller.handleCommand({
      type: 'START_SESSION',
      contextId: DEVELOPMENT_CONTEXT_ID,
      durationMinutes: 25,
      breakMinutes: 5,
      repeat: false,
    });
    bg.clock.advance(25 * 60_000);
    await bg.controller.reconcile();
    expect(bg.bellPlays.length).toBe(0);
    vi.useRealTimers();
  });
});
