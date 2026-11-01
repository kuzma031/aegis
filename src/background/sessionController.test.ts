import { describe, expect, it } from 'vitest';
import { SessionController } from './sessionController';
import { sitesToBlock, type BlockingSynchronizer } from './blockingSync';
import { DEVELOPMENT_CONTEXT_ID } from '@core/seed';
import type { Clock } from '@platform/clock';
import type {
  ActionBadgeAdapter,
  AlarmAdapter,
  NotificationAdapter,
} from '@platform/interfaces';
import { MemoryStateRepository } from '@platform/storage';
import type { AppState } from '@core/types';

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
  let badgeTick = false;
  const alarms: AlarmAdapter = {
    async schedule(when: number) {
      scheduled.length = 0;
      scheduled.push(when);
    },
    async clear() {
      scheduled.length = 0;
    },
    async startBadgeTick() {
      badgeTick = true;
    },
    async clearBadgeTick() {
      badgeTick = false;
    },
  };
  const notificationsShown: Array<{
    id?: string;
    title: string;
    message: string;
    buttons?: Array<{ title: string }>;
  }> = [];
  const notifications: NotificationAdapter = {
    async show(title, message) {
      notificationsShown.push({ title, message });
    },
    async showChoice(id, title, message, buttons) {
      notificationsShown.push({ id, title, message, buttons });
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
  const badgeSnapshots: Array<{ text: string; title: string }> = [];
  const badge: ActionBadgeAdapter = {
    async sync(state, syncNow) {
      const session = state.activeSession;
      if (!session) {
        badgeSnapshots.push({ text: '', title: 'Wardfocus' });
        return;
      }
      badgeSnapshots.push({
        text: session.status === 'paused' ? '||' : 'active',
        title: `now:${syncNow}`,
      });
    },
  };
  const controller = new SessionController(
    repo,
    clock,
    alarms,
    notifications,
    blockingSync,
    badge,
  );
  return {
    clock,
    repo,
    controller,
    scheduled,
    notificationsShown,
    synced,
    badgeSnapshots,
    isBadgeTickOn: () => badgeTick,
  };
}

function startCmd(
  durationMinutes = 25,
  breakMinutes = 5,
  repeat = false,
) {
  return {
    type: 'START_SESSION' as const,
    contextId: DEVELOPMENT_CONTEXT_ID,
    durationMinutes,
    breakMinutes,
    repeat,
  };
}

describe('SessionController', () => {
  const NOW = 1_700_000_000_000;

  it('starts, pauses, resumes, then awaits choice when repeat is off', async () => {
    const { clock, repo, controller, scheduled, notificationsShown, isBadgeTickOn, synced } =
      createFakes(NOW);

    const started = await controller.handleCommand(startCmd());
    expect(started).toEqual({ ok: true });
    expect(scheduled).toEqual([NOW + 25 * 60_000]);
    expect(isBadgeTickOn()).toBe(true);
    expect(synced.at(-1)?.length).toBeGreaterThan(0);

    clock.advance(5 * 60_000);
    expect(await controller.handleCommand({ type: 'PAUSE_SESSION' })).toEqual({
      ok: true,
    });
    expect(scheduled).toEqual([]);
    expect(isBadgeTickOn()).toBe(false);

    clock.advance(2 * 60_000);
    expect(await controller.handleCommand({ type: 'RESUME_SESSION' })).toEqual({
      ok: true,
    });
    expect(scheduled).toEqual([clock.now() + 20 * 60_000]);
    expect(isBadgeTickOn()).toBe(true);

    clock.advance(20 * 60_000);
    await controller.handleAlarm();

    const state = await repo.load();
    expect(state.activeSession).toMatchObject({
      phase: 'focus',
      status: 'awaiting',
    });
    expect(state.lastSessionSummary).toBeNull();
    expect(state.history).toHaveLength(1);
    expect(notificationsShown).toHaveLength(1);
    expect(notificationsShown[0]).toMatchObject({
      id: 'focus-session-choice',
      title: 'Are you in flow?',
      buttons: [{ title: 'Extend' }, { title: 'Start break' }],
    });
    expect(scheduled).toEqual([]);
    expect(synced.at(-1)?.length).toBeGreaterThan(0);
    expect(isBadgeTickOn()).toBe(false);
  });

  it('starts break from awaiting, then holds for start focus or end', async () => {
    const { clock, repo, controller, notificationsShown, scheduled } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, false));
    clock.advance(10 * 60_000);
    await controller.handleAlarm();

    let state = await repo.load();
    expect(state.activeSession?.status).toBe('awaiting');

    expect(await controller.handleCommand({ type: 'START_BREAK' })).toEqual({ ok: true });
    state = await repo.load();
    expect(state.activeSession?.phase).toBe('break');
    expect(scheduled).toEqual([clock.now() + 5 * 60_000]);

    clock.advance(5 * 60_000);
    await controller.handleAlarm();

    state = await repo.load();
    expect(state.activeSession).toMatchObject({
      phase: 'break',
      status: 'awaiting',
    });
    expect(state.lastSessionSummary).toBeNull();
    expect(notificationsShown.at(-1)).toMatchObject({
      id: 'break-session-choice',
      title: 'Break finished',
      buttons: [{ title: 'Start focus' }, { title: 'End session' }],
    });
    expect(scheduled).toEqual([]);

    expect(await controller.handleCommand({ type: 'CONTINUE_FOCUS' })).toEqual({
      ok: true,
    });
    state = await repo.load();
    expect(state.activeSession).toMatchObject({
      phase: 'focus',
      status: 'running',
      plannedMs: 10 * 60_000,
    });
    expect(scheduled).toEqual([clock.now() + 10 * 60_000]);
  });

  it('ends onto the recap from break awaiting without double-counting', async () => {
    const { clock, repo, controller } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, false));
    clock.advance(10 * 60_000);
    await controller.handleAlarm();
    expect(await controller.handleCommand({ type: 'START_BREAK' })).toEqual({ ok: true });
    clock.advance(5 * 60_000);
    await controller.handleAlarm();

    expect(await controller.handleCommand({ type: 'END_SESSION' })).toEqual({ ok: true });

    const state = await repo.load();
    expect(state.activeSession).toBeNull();
    expect(state.history).toHaveLength(1);
    expect(state.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 1,
      focusMs: 10 * 60_000,
      breakMs: 5 * 60_000,
    });
  });

  it('extends focus from awaiting with a custom duration', async () => {
    const { clock, repo, controller, scheduled } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, false));
    clock.advance(10 * 60_000);
    await controller.handleAlarm();

    expect(
      await controller.handleCommand({ type: 'EXTEND_FOCUS', durationMinutes: 40 }),
    ).toEqual({ ok: true });

    const state = await repo.load();
    expect(state.activeSession).toMatchObject({
      phase: 'focus',
      status: 'running',
      focusMinutes: 10,
      plannedMs: 40 * 60_000,
    });
    expect(scheduled).toEqual([clock.now() + 40 * 60_000]);
  });

  it('repeats focus after break when repeat is on', async () => {
    const { clock, repo, controller, scheduled, synced } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, true));
    clock.advance(10 * 60_000);
    await controller.handleAlarm();
    clock.advance(5 * 60_000);
    await controller.handleAlarm();

    const state = await repo.load();
    expect(state.activeSession?.phase).toBe('focus');
    expect(state.activeSession?.plannedMs).toBe(10 * 60_000);
    expect(state.history).toHaveLength(1);
    expect(scheduled).toEqual([clock.now() + 10 * 60_000]);
    expect(synced.at(-1)?.length).toBeGreaterThan(0);
  });

  it('does not skip break when expiry handlers race', async () => {
    const { clock, repo, controller, notificationsShown, scheduled } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, true));
    clock.advance(10 * 60_000);

    await Promise.all([controller.handleAlarm(), controller.handleAlarm()]);

    const state = await repo.load();
    expect(state.activeSession?.phase).toBe('break');
    expect(state.history).toHaveLength(1);
    expect(notificationsShown).toHaveLength(1);
    expect(scheduled).toEqual([clock.now() + 5 * 60_000]);
  });

  it('reconciles an expired running focus into awaiting when repeat is off', async () => {
    const { clock, repo, controller, notificationsShown, scheduled } = createFakes(NOW);

    await controller.handleCommand(startCmd(10, 5, false));
    clock.advance(15 * 60_000);
    await controller.reconcile();

    const state = await repo.load();
    expect(state.activeSession).toMatchObject({
      phase: 'focus',
      status: 'awaiting',
    });
    expect(state.lastSessionSummary).toBeNull();
    expect(notificationsShown).toHaveLength(1);
    expect(scheduled).toEqual([]);
  });

  it('ignores an alarm while the session is paused', async () => {
    const { clock, repo, controller, notificationsShown } = createFakes(NOW);

    await controller.handleCommand(startCmd());
    clock.advance(5 * 60_000);
    await controller.handleCommand({ type: 'PAUSE_SESSION' });

    clock.advance(30 * 60_000);
    await controller.handleAlarm();

    const state = await repo.load();
    expect(state.activeSession?.status).toBe('paused');
    expect(state.history).toHaveLength(0);
    expect(notificationsShown).toHaveLength(0);
  });

  it('starts another session from last settings', async () => {
    const { clock, repo, controller } = createFakes(NOW);

    await controller.handleCommand(startCmd(25, 5, false));
    clock.advance(25 * 60_000);
    await controller.handleAlarm();
    expect(await controller.handleCommand({ type: 'START_BREAK' })).toEqual({ ok: true });
    clock.advance(5 * 60_000);
    await controller.handleAlarm();
    expect(await controller.handleCommand({ type: 'END_SESSION' })).toEqual({ ok: true });

    expect(await controller.handleCommand({ type: 'START_ANOTHER' })).toEqual({
      ok: true,
    });

    const state = await repo.load();
    expect(state.activeSession?.contextId).toBe(DEVELOPMENT_CONTEXT_ID);
    expect(state.activeSession?.plannedMs).toBe(25 * 60_000);
    expect(state.activeSession?.breakMinutes).toBe(5);
  });

  it('recreates the alarm when reconciling a still-running session', async () => {
    const { clock, controller, scheduled } = createFakes(NOW);

    await controller.handleCommand(startCmd());
    scheduled.length = 0;

    clock.advance(5 * 60_000);
    await controller.reconcile();
    expect(scheduled).toEqual([NOW + 25 * 60_000]);
  });

  it('updates the action badge while a session is active and clears it when idle', async () => {
    const { clock, controller, badgeSnapshots } = createFakes(NOW);

    await controller.handleCommand(startCmd());
    expect(badgeSnapshots.at(-1)?.text).toBe('active');

    clock.advance(60_000);
    await controller.handleBadgeTick();
    expect(badgeSnapshots.at(-1)?.text).toBe('active');

    await controller.handleCommand({ type: 'PAUSE_SESSION' });
    expect(badgeSnapshots.at(-1)?.text).toBe('||');

    await controller.handleCommand({ type: 'END_SESSION' });
    expect(badgeSnapshots.at(-1)).toEqual({ text: '', title: 'Wardfocus' });
  });
});
