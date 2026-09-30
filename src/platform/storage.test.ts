import { describe, expect, it } from 'vitest';
import {
  createInitialState,
  DEVELOPMENT_CONTEXT_ID,
} from '@core/seed';
import { createSystemClock } from './clock';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import { MemoryStateRepository } from './storage';

describe('migrate', () => {
  it('seeds initial state when storage is empty', () => {
    const now = 1_700_000_000_000;
    const state = migrate(null, now);
    expect(state).toEqual(createInitialState(now));
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.settings.selectedContextId).toBe(DEVELOPMENT_CONTEXT_ID);
  });

  it('returns version 1 state as-is', () => {
    const now = 1_700_000_000_000;
    const seeded = createInitialState(now);
    expect(migrate(seeded, now + 1)).toBe(seeded);
  });

  it('reseeds unknown schema versions', () => {
    const now = 1_700_000_000_000;
    const state = migrate({ schemaVersion: 999 }, now);
    expect(state).toEqual(createInitialState(now));
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
