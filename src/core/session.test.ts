import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import {
  completeSession,
  dismissCompletion,
  endSession,
  getRemainingMs,
  isExpired,
  pauseSession,
  recordDistraction,
  resumeSession,
  startSession,
} from './session';
import { createTask, setTaskStatus } from './tasks';

const NOW = 1_700_000_000_000;

describe('session', () => {
  it('starts a session and tracks remaining time', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const session = started.value.activeSession!;
    expect(session.status).toBe('running');
    expect(session.phase).toBe('focus');
    expect(session.plannedMs).toBe(25 * 60_000);
    expect(session.endsAt).toBe(NOW + 25 * 60_000);
    expect(started.value.settings.lastDurationMinutes).toBe(25);
    expect(started.value.settings.lastBreakMinutes).toBe(5);
    expect(started.value.settings.lastRepeat).toBe(false);
    expect(started.value.lastSessionSummary).toBeNull();
    expect(getRemainingMs(session, NOW + 60_000)).toBe(24 * 60_000);
    expect(isExpired(session, NOW + 25 * 60_000)).toBe(true);
  });

  it('accepts fractional minutes (0.5 = 30 seconds)', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const started = startSession(state, contextId, 0.5, 0, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const session = started.value.activeSession!;
    expect(session.plannedMs).toBe(30_000);
    expect(session.endsAt).toBe(NOW + 30_000);
    expect(started.value.settings.lastDurationMinutes).toBe(0.5);
    expect(isExpired(session, NOW + 30_000)).toBe(true);
  });

  it('pauses and resumes without changing remaining time', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 50, 5, false, NOW);
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
    const started = startSession(state, contextId, 50, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const paused = pauseSession(started.value, NOW + 10 * 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    const ended = endSession(paused.value, NOW + 30 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;

    expect(ended.value.activeSession).toBeNull();
    expect(ended.value.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 0,
      focusMs: 10 * 60_000,
      breakMs: 0,
      pauseCount: 1,
    });
    expect(ended.value.history).toHaveLength(1);
    expect(ended.value.history[0]).toMatchObject({
      outcome: 'ended_early',
      focusedMs: 10 * 60_000,
      plannedMs: 50 * 60_000,
    });
  });

  it('moves from focus to break and keeps run stats open', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const withDistraction = recordDistraction(started.value, 'www.Reddit.com');
    expect(withDistraction.ok).toBe(true);
    if (!withDistraction.ok) return;
    expect(withDistraction.value.activeSession?.distractionOverrides).toBe(1);
    expect(withDistraction.value.activeSession?.distractionBySite).toEqual({
      'reddit.com': 1,
    });

    const completed = completeSession(withDistraction.value, NOW + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    expect(completed.value.lastSessionSummary).toBeNull();
    expect(completed.value.history).toHaveLength(1);
    expect(completed.value.history[0]).toMatchObject({
      outcome: 'completed',
      distractionOverrides: 1,
      distractionBySite: { 'reddit.com': 1 },
    });
    expect(completed.value.activeSession).toMatchObject({
      phase: 'break',
      plannedMs: 5 * 60_000,
      status: 'running',
      distractionOverrides: 0,
      run: {
        focusCount: 1,
        focusMs: 25 * 60_000,
        distractionOverrides: 1,
      },
    });
  });

  it('rejects completing a session that has not expired yet', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(completeSession(started.value, NOW + 1000)).toEqual({
      ok: false,
      error: 'Session has not expired yet',
    });

    const afterFocus = completeSession(started.value, NOW + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) return;

    expect(completeSession(afterFocus.value, NOW + 25 * 60_000)).toEqual({
      ok: false,
      error: 'Session has not expired yet',
    });
  });

  it('resets to idle after break when repeat is off', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const afterFocus = completeSession(started.value, NOW + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) return;

    const afterBreak = completeSession(
      afterFocus.value,
      NOW + 25 * 60_000 + 5 * 60_000,
    );
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;

    expect(afterBreak.value.activeSession).toBeNull();
    expect(afterBreak.value.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 1,
      focusMs: 25 * 60_000,
      breakMs: 5 * 60_000,
    });
    expect(afterBreak.value.history).toHaveLength(1);
    expect(afterBreak.value.history[0]).toMatchObject({
      breakCount: 1,
      breakMs: 5 * 60_000,
    });
  });

  it('repeats focus after break when repeat is on', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, true, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const afterFocus = completeSession(started.value, NOW + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) return;

    const breakEnd = NOW + 25 * 60_000 + 5 * 60_000;
    const afterBreak = completeSession(afterFocus.value, breakEnd);
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;

    expect(afterBreak.value.activeSession).toMatchObject({
      phase: 'focus',
      plannedMs: 25 * 60_000,
      repeat: true,
      endsAt: breakEnd + 25 * 60_000,
    });
    expect(afterBreak.value.history).toHaveLength(1);
  });

  it('skips break and ends when break is 0 and repeat is off', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 0, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = completeSession(started.value, NOW + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    expect(completed.value.activeSession).toBeNull();
    expect(completed.value.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 0,
      focusMs: 25 * 60_000,
      breakMs: 0,
    });
    expect(completed.value.history).toHaveLength(1);
  });

  it('starts a long break after the configured number of focus sessions', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    state = {
      ...state,
      contexts: state.contexts.map((context) =>
        context.id === contextId
          ? {
              ...context,
              longBreaksEnabled: true,
              longBreakAfterSessions: 2,
              longBreakMinutes: 15,
            }
          : context,
      ),
    };

    const started = startSession(state, contextId, 25, 5, true, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.activeSession).toMatchObject({
      longBreaksEnabled: true,
      longBreakAfterSessions: 2,
      longBreakMinutes: 15,
      isLongBreak: false,
    });

    const afterFirstFocus = completeSession(started.value, NOW + 25 * 60_000);
    expect(afterFirstFocus.ok).toBe(true);
    if (!afterFirstFocus.ok) return;
    expect(afterFirstFocus.value.activeSession).toMatchObject({
      phase: 'break',
      isLongBreak: false,
      plannedMs: 5 * 60_000,
    });

    const afterFirstBreak = completeSession(
      afterFirstFocus.value,
      NOW + 25 * 60_000 + 5 * 60_000,
    );
    expect(afterFirstBreak.ok).toBe(true);
    if (!afterFirstBreak.ok) return;

    const secondFocusEnd = NOW + 25 * 60_000 + 5 * 60_000 + 25 * 60_000;
    const afterSecondFocus = completeSession(afterFirstBreak.value, secondFocusEnd);
    expect(afterSecondFocus.ok).toBe(true);
    if (!afterSecondFocus.ok) return;
    expect(afterSecondFocus.value.activeSession).toMatchObject({
      phase: 'break',
      isLongBreak: true,
      plannedMs: 15 * 60_000,
      run: { focusCount: 2 },
    });
  });

  it('uses a long break even when the short break is 0', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    state = {
      ...state,
      contexts: state.contexts.map((context) =>
        context.id === contextId
          ? {
              ...context,
              longBreaksEnabled: true,
              longBreakAfterSessions: 1,
              longBreakMinutes: 15,
            }
          : context,
      ),
    };

    const started = startSession(state, contextId, 25, 0, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = completeSession(started.value, NOW + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.value.activeSession).toMatchObject({
      phase: 'break',
      isLongBreak: true,
      plannedMs: 15 * 60_000,
    });
  });

  it('rejects non half-minute steps in production mode', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    expect(startSession(state, contextId, 0.1, 5, false, NOW, 'production').ok).toBe(
      false,
    );
    expect(startSession(state, contextId, 1.25, 5, false, NOW, 'production').ok).toBe(
      false,
    );
    expect(startSession(state, contextId, 0.5, 1.5, false, NOW, 'production').ok).toBe(
      true,
    );
  });

  it('allows fine-grained durations in development mode', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const started = startSession(state, contextId, 0.1, 0.2, false, NOW, 'development');
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.activeSession?.plannedMs).toBe(6_000);
  });

  it('guards invalid transitions and durations', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    expect(startSession(state, contextId, 0, 5, false, NOW).ok).toBe(false);
    expect(startSession(state, contextId, 241, 5, false, NOW).ok).toBe(false);
    expect(startSession(state, contextId, 25.5, 5, false, NOW).ok).toBe(true);
    expect(pauseSession(state, NOW).ok).toBe(false);

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(startSession(started.value, contextId, 25, 5, false, NOW).ok).toBe(false);
    expect(resumeSession(started.value, NOW).ok).toBe(false);
    expect(pauseSession(started.value, NOW + 25 * 60_000).ok).toBe(false);

    const paused = pauseSession(started.value, NOW + 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(completeSession(paused.value, NOW + 60_000).ok).toBe(false);
  });

  it('dismissSessionSummary clears the ended-run screen state', () => {
    const state = createInitialState(NOW);
    const withSummary = {
      ...state,
      lastSessionSummary: {
        contextId: state.contexts[0]!.id,
        contextName: 'Development',
        focusCount: 1,
        breakCount: 1,
        focusMs: 25_000,
        breakMs: 5_000,
        distractionOverrides: 0,
        pauseCount: 0,
        tasks: [],
        startedAt: NOW,
        endedAt: NOW + 30_000,
      },
    };
    const dismissed = dismissCompletion(withSummary);
    expect(dismissed.ok).toBe(true);
    if (!dismissed.ok) return;
    expect(dismissed.value.lastSessionSummary).toBeNull();
  });

  it('freezes task focus on pause/resume and does not accrue during break', () => {
    let state = createInitialState(NOW);
    const created = createTask(state, 'Write docs', NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    state = created.value;
    const taskId = state.tasks[0]!.id;

    const started = startSession(state, state.contexts[0]!.id, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.value;

    const working = setTaskStatus(state, taskId, 'active', NOW);
    expect(working.ok).toBe(true);
    if (!working.ok) return;
    state = working.value;

    const paused = pauseSession(state, NOW + 3 * 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.activeSession?.taskFocus).toBeNull();
    expect(paused.value.tasks[0]!.focusedMs).toBe(3 * 60_000);
    expect(paused.value.tasks[0]!.status).toBe('active');

    const resumeAt = NOW + 10 * 60_000;
    const resumed = resumeSession(paused.value, resumeAt);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.activeSession?.taskFocus).toEqual({
      taskId,
      startedAt: resumeAt,
    });

    // 3m elapsed before pause → 22m remaining; focus completes at resumeAt + 22m.
    const focusEnd = resumeAt + 22 * 60_000;
    const afterFocus = completeSession(resumed.value, focusEnd);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) return;
    // Accrued 3m before pause + 22m after resume
    expect(afterFocus.value.tasks[0]!.focusedMs).toBe(25 * 60_000);
    expect(afterFocus.value.tasks[0]!.status).toBe('active');
    expect(afterFocus.value.activeSession).toMatchObject({
      phase: 'break',
      taskFocus: null,
    });
    expect(afterFocus.value.history[0]).toMatchObject({
      taskId,
      taskTitle: 'Write docs',
      outcome: 'completed',
    });

    const afterBreak = completeSession(afterFocus.value, focusEnd + 5 * 60_000);
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;
    expect(afterBreak.value.tasks[0]!.focusedMs).toBe(25 * 60_000);
    expect(afterBreak.value.tasks[0]!.status).toBe('todo');
  });

  it('endSession commits open task time and demotes Working to Todo', () => {
    let state = createInitialState(NOW);
    const created = createTask(state, 'Ship feature', NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    state = created.value;
    const taskId = state.tasks[0]!.id;

    const started = startSession(state, state.contexts[0]!.id, 50, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const working = setTaskStatus(started.value, taskId, 'active', NOW);
    expect(working.ok).toBe(true);
    if (!working.ok) return;

    const ended = endSession(working.value, NOW + 12 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;

    expect(ended.value.activeSession).toBeNull();
    expect(ended.value.tasks[0]).toMatchObject({
      status: 'todo',
      focusedMs: 12 * 60_000,
    });
    expect(ended.value.history[0]).toMatchObject({
      taskId,
      taskTitle: 'Ship feature',
      outcome: 'ended_early',
      focusedMs: 12 * 60_000,
    });
    expect(ended.value.lastSessionSummary?.tasks).toEqual([
      { taskId, taskTitle: 'Ship feature', focusMs: 12 * 60_000 },
    ]);
  });
});
