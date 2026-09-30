import { describe, expect, it } from 'vitest';
import { createId } from './ids';
import {
  createInitialState,
  DEVELOPMENT_CONTEXT_ID,
  RESEARCH_CONTEXT_ID,
} from './seed';
import { SCHEMA_VERSION } from './types';

describe('ids', () => {
  it('returns a UUID string', () => {
    const id = createId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('seed', () => {
  it('seeds Development and Research with fixed ids', () => {
    const now = 1_700_000_000_000;
    const state = createInitialState(now);

    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.contexts).toEqual([
      {
        id: DEVELOPMENT_CONTEXT_ID,
        name: 'Development',
        sites: ['reddit.com', 'youtube.com', 'instagram.com', 'x.com'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: RESEARCH_CONTEXT_ID,
        name: 'Research',
        sites: ['instagram.com', 'tiktok.com'],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    expect(state.settings).toEqual({
      selectedContextId: DEVELOPMENT_CONTEXT_ID,
      lastDurationMinutes: 25,
    });
    expect(state.activeSession).toBeNull();
    expect(state.lastCompletion).toBeNull();
    expect(state.history).toEqual([]);
  });
});
