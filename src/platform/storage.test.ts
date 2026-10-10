import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  DEVELOPMENT_CONTEXT_ID,
} from '@core/seed';
import { createSystemClock } from './clock';
import { migrate } from './migrations';
import { MemoryStateRepository } from './storage';

describe('migrate', () => {
  it('seeds initial state when storage is empty', () => {
    const now = 1_700_000_000_000;
    const state = migrate(null, now);
    expect(state).toEqual(createInitialState(now));
    expect(state.settings.selectedContextId).toBe(DEVELOPMENT_CONTEXT_ID);
  });

  it('fills missing settings fields on stored state', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    expect(migrate(seeded, now + 1)).toEqual(seeded);

    const partial = {
      contexts: seeded.contexts,
      settings: {
        selectedContextId: seeded.settings.selectedContextId,
        lastDurationMinutes: 25,
      },
      lastCompletion: {
        record: {
          id: 'old',
          contextId: DEVELOPMENT_CONTEXT_ID,
          contextName: 'Development',
          plannedMs: 1000,
          focusedMs: 1000,
          startedAt: now,
          endedAt: now + 1000,
          outcome: 'completed' as const,
        },
      },
    };
    const migrated = migrate(partial, now + 1);
    expect(migrated.settings.lastBreakMinutes).toBe(5);
    expect(migrated.settings.lastRepeat).toBe(false);
    expect(migrated.lastSessionSummary).toBeNull();
  });

  it('adds default focus/break minutes to legacy contexts', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    const legacyContexts = seeded.contexts.map((context) => ({
      id: context.id,
      name: context.name,
      sites: context.sites,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
    }));
    const migrated = migrate(
      {
        contexts: legacyContexts,
        settings: seeded.settings,
      },
      now + 1,
    );
    expect(migrated.contexts.every((context) => context.defaultFocusMinutes === 25)).toBe(
      true,
    );
    expect(migrated.contexts.every((context) => context.defaultBreakMinutes === 5)).toBe(
      true,
    );
    expect(
      migrated.contexts.every((context) => context.longBreakAfterSessions === 4),
    ).toBe(true);
    expect(migrated.contexts.every((context) => context.longBreakMinutes === 15)).toBe(
      true,
    );
    expect(migrated.contexts.every((context) => context.longBreaksEnabled === false)).toBe(
      true,
    );
  });

  it('defaults missing tasks to an empty list', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    const { tasks: _tasks, ...withoutTasks } = seeded;
    const migrated = migrate(withoutTasks, now + 1);
    expect(migrated.tasks).toEqual([]);
  });

  it('defaults missing taskPresentation to hover', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    const migrated = migrate(
      {
        contexts: seeded.contexts,
        settings: {
          selectedContextId: seeded.settings.selectedContextId,
          lastDurationMinutes: 25,
          lastBreakMinutes: 5,
          lastRepeat: false,
          dailyFocusTargetMinutes: 240,
        },
      },
      now + 1,
    );
    expect(migrated.settings.taskPresentation).toBe('hover');
    expect(migrated.settings.ambientEnabled).toBe(false);
    expect(migrated.settings.ambientTrackId).toBe('brown-noise');
  });

  it('defaults missing task focusedMs and session taskFocus fields', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    const migrated = migrate(
      {
        contexts: seeded.contexts,
        settings: seeded.settings,
        tasks: [
          {
            id: 'task-1',
            title: 'Legacy task',
            status: 'todo',
            createdAt: now,
            updatedAt: now,
          },
        ],
        activeSession: {
          id: 'sess-1',
          contextId: DEVELOPMENT_CONTEXT_ID,
          contextName: 'Development',
          phase: 'focus',
          focusMinutes: 25,
          breakMinutes: 5,
          plannedMs: 25 * 60_000,
          startedAt: now,
          status: 'running',
          endsAt: now + 25 * 60_000,
          remainingMs: null,
        },
        history: [
          {
            id: 'rec-1',
            contextId: DEVELOPMENT_CONTEXT_ID,
            contextName: 'Development',
            plannedMs: 1000,
            focusedMs: 1000,
            startedAt: now,
            endedAt: now + 1000,
            outcome: 'completed',
          },
        ],
      },
      now + 1,
    );

    expect(migrated.tasks[0]).toMatchObject({
      id: 'task-1',
      focusedMs: 0,
    });
    expect(migrated.activeSession?.taskFocus).toBeNull();
    expect(migrated.history[0]).toMatchObject({
      taskId: null,
      taskTitle: null,
    });
  });
});

describe('MemoryStateRepository', () => {
  it('serializes overlapping updates so both land', async () => {
    const clock = { now: () => 1_700_000_000_000 };
    const repo = new MemoryStateRepository(clock);

    const first = repo.update((state) => ({
      ...state,
      settings: { ...state.settings, lastDurationMinutes: 30 },
    }));
    const second = repo.update((state) => ({
      ...state,
      settings: {
        ...state.settings,
        lastDurationMinutes: state.settings.lastDurationMinutes + 5,
      },
    }));

    await Promise.all([first, second]);
    const loaded = await repo.load();
    expect(loaded.settings.lastDurationMinutes).toBe(35);
  });

  it('notifies subscribers on save', async () => {
    const repo = new MemoryStateRepository(createSystemClock());
    const seen: number[] = [];
    const unsubscribe = repo.subscribe((state) => {
      seen.push(state.settings.lastDurationMinutes);
    });

    await repo.update((state) => ({
      ...state,
      settings: { ...state.settings, lastDurationMinutes: 50 },
    }));

    unsubscribe();
    expect(seen).toEqual([50]);
  });
});
