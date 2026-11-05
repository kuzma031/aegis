import { describe, expect, it } from 'vitest';
import { advanceExpired, projectTransitions } from './catchUp';
import { createInitialState } from './seed';
import { startSession } from './session';

const START = 1_700_000_000_000;

function startedState(opts: {
  focusMinutes: number;
  breakMinutes: number;
  repeat: boolean;
}) {
  const base = createInitialState(START);
  const result = startSession(
    base,
    base.contexts[0]!.id,
    opts.focusMinutes,
    opts.breakMinutes,
    opts.repeat,
    START,
    'production',
  );
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}

describe('advanceExpired', () => {
  it('returns no transitions when the focus has not ended', () => {
    const state = startedState({
      focusMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    const { state: next, transitions } = advanceExpired(state, START + 10 * 60_000);
    expect(transitions).toHaveLength(0);
    expect(next).toBe(state);
  });

  it('catches up auto-repeat focus → break → focus across a long gap', () => {
    const state = startedState({
      focusMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    // After 70 minutes: F25 → B5 → F25 → B5 → running focus (started at 60)
    const now = START + 70 * 60_000;
    const { state: next, transitions } = advanceExpired(state, now);

    expect(transitions.map((t) => t.beforePhase)).toEqual([
      'focus',
      'break',
      'focus',
      'break',
    ]);
    expect(transitions[0]!.at).toBe(START + 25 * 60_000);
    expect(transitions[1]!.at).toBe(START + 30 * 60_000);
    expect(transitions[2]!.at).toBe(START + 55 * 60_000);
    expect(transitions[3]!.at).toBe(START + 60 * 60_000);

    expect(next.history).toHaveLength(2);
    expect(next.history[0]!.endedAt).toBe(START + 25 * 60_000);
    expect(next.history[1]!.endedAt).toBe(START + 55 * 60_000);

    expect(next.activeSession?.phase).toBe('focus');
    expect(next.activeSession?.status).toBe('running');
    expect(next.activeSession?.startedAt).toBe(START + 60 * 60_000);
    expect(next.activeSession?.endsAt).toBe(START + 85 * 60_000);
  });

  it('stops at awaiting when auto-repeat is off', () => {
    const state = startedState({
      focusMinutes: 25,
      breakMinutes: 5,
      repeat: false,
    });
    const { state: next, transitions } = advanceExpired(
      state,
      START + 40 * 60_000,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.beforePhase).toBe('focus');
    expect(next.activeSession?.status).toBe('awaiting');
    expect(next.activeSession?.phase).toBe('focus');
  });

  it('caps the loop at maxSteps', () => {
    const state = startedState({
      focusMinutes: 0.5,
      breakMinutes: 0.5,
      repeat: true,
    });
    const { transitions } = advanceExpired(state, START + 60 * 60_000, 3);
    expect(transitions).toHaveLength(3);
  });
});

describe('projectTransitions', () => {
  it('excludes transitions at or before now', () => {
    const state = startedState({
      focusMinutes: 25,
      breakMinutes: 5,
      repeat: true,
    });
    const midFocus = START + 10 * 60_000;
    const projected = projectTransitions(
      state,
      midFocus,
      24 * 60 * 60_000,
      48,
    );
    expect(projected.every((t) => t.at > midFocus)).toBe(true);
    expect(projected[0]!.at).toBe(START + 25 * 60_000);
  });
});
