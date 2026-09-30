import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import {
  completeSession,
  dismissCompletion,
  endSession,
  getRemainingMs,
  isExpired,
  pauseSession,
  resumeSession,
  startSession,
} from './session';

const NOW = 1_700_000_000_000;

describe('session', () => {
  it('starts a session and tracks remaining time', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const started = startSession(state, contextId, 25, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const session = started.value.activeSession!;
    expect(session.status).toBe('running');
    expect(session.plannedMs).toBe(25 * 60_000);
    expect(session.endsAt).toBe(NOW + 25 * 60_000);
    expect(started.value.settings.lastDurationMinutes).toBe(25);
    expect(started.value.lastCompletion).toBeNull();
    expect(getRemainingMs(session, NOW + 60_000)).toBe(24 * 60_000);
    expect(isExpired(session, NOW + 25 * 60_000)).toBe(true);
  });

  it('pauses and resumes without changing remaining time', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 50, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const pauseAt = NOW + 10 * 60_000;
    const paused = pauseSession(started.value, pauseAt);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    expect(paused.value.activeSession).toMatchObject({
      status: 'paused',
      endsAt: null,
      remainingMs: 40 * 60_000,
    });

    const resumeAt = pauseAt + 5 * 60_000;
    const resumed = resumeSession(paused.value, resumeAt);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;

    expect(resumed.value.activeSession).toMatchObject({
      status: 'running',
      remainingMs: null,
      endsAt: resumeAt + 40 * 60_000,
    });
    expect(getRemainingMs(resumed.value.activeSession!, resumeAt + 60_000)).toBe(
      39 * 60_000,
    );
  });

  it('ends early with focused time excluding paused time', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 50, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const paused = pauseSession(started.value, NOW + 10 * 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    const ended = endSession(paused.value, NOW + 30 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;

    expect(ended.value.activeSession).toBeNull();
    expect(ended.value.history).toHaveLength(1);
    expect(ended.value.history[0]).toMatchObject({
      outcome: 'ended_early',
      focusedMs: 10 * 60_000,
      plannedMs: 50 * 60_000,
    });
  });

  it('completes a running session and allows dismiss', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = completeSession(started.value, NOW + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    expect(completed.value.activeSession).toBeNull();
    expect(completed.value.lastCompletion?.record).toMatchObject({
      outcome: 'completed',
      focusedMs: 25 * 60_000,
    });

    const dismissed = dismissCompletion(completed.value);
    expect(dismissed.ok).toBe(true);
    if (!dismissed.ok) return;
    expect(dismissed.value.lastCompletion).toBeNull();
  });

  it('guards invalid transitions and durations', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    expect(startSession(state, contextId, 0, NOW).ok).toBe(false);
    expect(startSession(state, contextId, 241, NOW).ok).toBe(false);
    expect(startSession(state, contextId, 25.5, NOW).ok).toBe(false);
    expect(pauseSession(state, NOW).ok).toBe(false);

    const started = startSession(state, contextId, 25, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(startSession(started.value, contextId, 25, NOW).ok).toBe(false);
    expect(resumeSession(started.value, NOW).ok).toBe(false);
    expect(pauseSession(started.value, NOW + 25 * 60_000).ok).toBe(false);

    const paused = pauseSession(started.value, NOW + 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(completeSession(paused.value, NOW + 60_000).ok).toBe(false);
  });
});
