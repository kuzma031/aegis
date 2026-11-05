import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import {
  allowPeek,
  beginPeekWait,
  clearPeekWait,
  completeSession,
  continueFocusSession,
  dismissCompletion,
  endSession,
  extendFocusSession,
  getPendingBreak,
  getRemainingMs,
  isExpired,
  pauseSession,
  peekWaitMs,
  recordDistraction,
  resumeSession,
  startBreakSession,
  startSession,
} from './session';
import { createTask, setTaskStatus } from './tasks';
import { updateContextDefaults } from './contexts';

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

  it('holds at awaiting when repeat is off, then starts break on demand', () => {
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
      phase: 'focus',
      status: 'awaiting',
      endsAt: null,
      run: {
        focusCount: 1,
        focusMs: 25 * 60_000,
        distractionOverrides: 1,
      },
    });
    expect(getPendingBreak(completed.value.activeSession!)).toEqual({
      minutes: 5,
      isLongBreak: false,
    });

    const breakStarted = startBreakSession(completed.value, NOW + 25 * 60_000);
    expect(breakStarted.ok).toBe(true);
    if (!breakStarted.ok) return;
    expect(breakStarted.value.activeSession).toMatchObject({
      phase: 'break',
      plannedMs: 5 * 60_000,
      status: 'running',
      distractionOverrides: 0,
    });
  });

  it('extends awaiting focus with typed minutes without changing stored focus length', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const awaiting = completeSession(started.value, NOW + 25 * 60_000);
    expect(awaiting.ok).toBe(true);
    if (!awaiting.ok) return;

    const extended = extendFocusSession(awaiting.value, 40, NOW + 25 * 60_000);
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.value.activeSession).toMatchObject({
      phase: 'focus',
      status: 'running',
      focusMinutes: 25,
      plannedMs: 40 * 60_000,
      run: { focusCount: 1, focusMs: 25 * 60_000 },
    });
    expect(extended.value.history).toHaveLength(1);

    const afterExtend = completeSession(extended.value, NOW + 25 * 60_000 + 40 * 60_000);
    expect(afterExtend.ok).toBe(true);
    if (!afterExtend.ok) return;
    const afterBreak = startBreakSession(afterExtend.value, NOW + 65 * 60_000);
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;
    const breakEnd = NOW + 65 * 60_000 + 5 * 60_000;
    const afterBreakDone = completeSession(afterBreak.value, breakEnd);
    expect(afterBreakDone.ok).toBe(true);
    if (!afterBreakDone.ok) return;
    expect(afterBreakDone.value.activeSession).toMatchObject({
      phase: 'break',
      status: 'awaiting',
    });

    const continued = continueFocusSession(afterBreakDone.value, breakEnd);
    expect(continued.ok).toBe(true);
    if (!continued.ok) return;
    expect(continued.value.activeSession).toMatchObject({
      phase: 'focus',
      status: 'running',
      focusMinutes: 25,
      plannedMs: 25 * 60_000,
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
    expect(afterFocus.value.activeSession?.status).toBe('awaiting');
    expect(completeSession(afterFocus.value, NOW + 25 * 60_000).ok).toBe(false);
  });

  it('holds after break when repeat is off, then ends without double-counting', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const afterFocus = completeSession(started.value, NOW + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) return;

    const breakStarted = startBreakSession(afterFocus.value, NOW + 25 * 60_000);
    expect(breakStarted.ok).toBe(true);
    if (!breakStarted.ok) return;

    const afterBreak = completeSession(
      breakStarted.value,
      NOW + 25 * 60_000 + 5 * 60_000,
    );
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;

    expect(afterBreak.value.activeSession).toMatchObject({
      phase: 'break',
      status: 'awaiting',
      run: {
        focusCount: 1,
        breakCount: 1,
        focusMs: 25 * 60_000,
        breakMs: 5 * 60_000,
      },
    });
    expect(afterBreak.value.history).toHaveLength(1);
    expect(afterBreak.value.history[0]).toMatchObject({
      breakCount: 1,
      breakMs: 5 * 60_000,
    });

    const ended = endSession(afterBreak.value, NOW + 30 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.activeSession).toBeNull();
    expect(ended.value.history).toHaveLength(1);
    expect(ended.value.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 1,
      focusMs: 25 * 60_000,
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
    expect(afterFocus.value.activeSession).toMatchObject({
      phase: 'break',
      status: 'running',
    });

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

  it('awaits choice when break is 0 and repeat is off; end does not double-count', () => {
    const state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const started = startSession(state, contextId, 25, 0, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const completed = completeSession(started.value, NOW + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;

    expect(completed.value.activeSession).toMatchObject({
      phase: 'focus',
      status: 'awaiting',
    });
    expect(getPendingBreak(completed.value.activeSession!).minutes).toBe(0);
    expect(startBreakSession(completed.value, NOW + 25 * 60_000).ok).toBe(false);

    const ended = endSession(completed.value, NOW + 25 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.activeSession).toBeNull();
    expect(ended.value.history).toHaveLength(1);
    expect(ended.value.lastSessionSummary).toMatchObject({
      focusCount: 1,
      breakCount: 0,
      focusMs: 25 * 60_000,
      breakMs: 0,
    });
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
    expect(completed.value.activeSession?.status).toBe('awaiting');
    expect(getPendingBreak(completed.value.activeSession!)).toEqual({
      minutes: 15,
      isLongBreak: true,
    });

    const breakStarted = startBreakSession(completed.value, NOW + 25 * 60_000);
    expect(breakStarted.ok).toBe(true);
    if (!breakStarted.ok) return;
    expect(breakStarted.value.activeSession).toMatchObject({
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
        peekStarts: 0,
        peekCount: 0,
        peekAbandoned: 0,
        peekMs: 0,
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
      phase: 'focus',
      status: 'awaiting',
      taskFocus: null,
    });
    expect(afterFocus.value.history[0]).toMatchObject({
      taskId,
      taskTitle: 'Write docs',
      outcome: 'completed',
    });

    const breakStarted = startBreakSession(afterFocus.value, focusEnd);
    expect(breakStarted.ok).toBe(true);
    if (!breakStarted.ok) return;
    expect(breakStarted.value.activeSession).toMatchObject({
      phase: 'break',
      taskFocus: null,
    });

    const afterBreak = completeSession(breakStarted.value, focusEnd + 5 * 60_000);
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) return;
    expect(afterBreak.value.activeSession).toMatchObject({
      phase: 'break',
      status: 'awaiting',
    });
    expect(afterBreak.value.tasks[0]!.focusedMs).toBe(25 * 60_000);
    expect(afterBreak.value.tasks[0]!.status).toBe('active');

    const ended = endSession(afterBreak.value, focusEnd + 5 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.tasks[0]!.status).toBe('todo');
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

  it('locks pause/end during a running phase and allows end when awaiting', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const locked = updateContextDefaults(
      state,
      contextId,
      {
        focusMinutes: 25,
        breakMinutes: 5,
        autoRepeat: false,
        blockDuringBreak: true,
        strictLockControls: true,
        strictAllowPeek: false,
        strictAllowPeekOnBreak: false,
        strictEscalatePeek: false,
        longBreaksEnabled: false,
        longBreakAfterSessions: 4,
        longBreakMinutes: 15,
        dailyGoalMinutes: 240,
      },
      NOW,
    );
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    state = locked.value;

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.activeSession?.strictLockControls).toBe(true);

    expect(pauseSession(started.value, NOW + 60_000).ok).toBe(false);
    expect(endSession(started.value, NOW + 60_000).ok).toBe(false);
    expect(endSession(started.value, NOW + 60_000, { force: true }).ok).toBe(true);

    const awaiting = completeSession(started.value, NOW + 25 * 60_000);
    expect(awaiting.ok).toBe(true);
    if (!awaiting.ok) return;
    expect(endSession(awaiting.value, NOW + 25 * 60_000).ok).toBe(true);
  });

  it('grants timed peeks after the wait and escalates the next wait', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const locked = updateContextDefaults(
      state,
      contextId,
      {
        focusMinutes: 25,
        breakMinutes: 5,
        autoRepeat: false,
        blockDuringBreak: true,
        strictLockControls: false,
        strictAllowPeek: true,
        strictAllowPeekOnBreak: false,
        strictEscalatePeek: true,
        longBreaksEnabled: false,
        longBreakAfterSessions: 4,
        longBreakMinutes: 15,
        dailyGoalMinutes: 240,
      },
      NOW,
    );
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    state = locked.value;

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const waiting = beginPeekWait(started.value, 'reddit.com', NOW);
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    expect(waiting.value.activeSession?.run.peekWait).toEqual({
      host: 'reddit.com',
      readyAt: NOW + peekWaitMs(0, true),
    });
    expect(waiting.value.activeSession?.run.peekStarts).toBe(1);
    expect(
      allowPeek(waiting.value, 'reddit.com', 5, NOW + 1000).ok,
    ).toBe(false);

    const readyAt = NOW + peekWaitMs(0, true);
    const granted = allowPeek(waiting.value, 'reddit.com', 5, readyAt);
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    expect(granted.value.activeSession?.run).toMatchObject({
      peekStarts: 1,
      peekCount: 1,
      peekMs: 5 * 60_000,
      peekGrants: [{ host: 'reddit.com', expiresAt: readyAt + 5 * 60_000 }],
      peekWait: null,
    });

    const nextWait = beginPeekWait(granted.value, 'youtube.com', readyAt + 60_000);
    expect(nextWait.ok).toBe(true);
    if (!nextWait.ok) return;
    expect(nextWait.value.activeSession?.run.peekWait?.readyAt).toBe(
      readyAt + 60_000 + peekWaitMs(1, true),
    );
    expect(nextWait.value.activeSession?.run.peekStarts).toBe(2);

    const afterExpiry = readyAt + 5 * 60_000 + 1;
    const pruned = {
      ...granted.value,
      activeSession: {
        ...granted.value.activeSession!,
        run: {
          ...granted.value.activeSession!.run,
          peekGrants: [],
        },
      },
    };
    const sameSite = beginPeekWait(pruned, 'reddit.com', afterExpiry);
    expect(sameSite.ok).toBe(true);
    if (!sameSite.ok) return;
    expect(sameSite.value.activeSession?.run.peekWait?.readyAt).toBe(
      afterExpiry + peekWaitMs(1, true),
    );
  });

  it('tracks abandoned peeks and rolls peek stats into the session summary', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const updated = updateContextDefaults(
      state,
      contextId,
      {
        focusMinutes: 25,
        breakMinutes: 5,
        autoRepeat: false,
        blockDuringBreak: true,
        strictLockControls: false,
        strictAllowPeek: true,
        strictAllowPeekOnBreak: false,
        strictEscalatePeek: false,
        longBreaksEnabled: false,
        longBreakAfterSessions: 4,
        longBreakMinutes: 15,
        dailyGoalMinutes: 240,
      },
      NOW,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    state = updated.value;

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const waiting = beginPeekWait(started.value, 'reddit.com', NOW);
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;

    const cancelled = clearPeekWait(waiting.value);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.activeSession?.run).toMatchObject({
      peekStarts: 1,
      peekAbandoned: 1,
      peekCount: 0,
    });

    const waitingAgain = beginPeekWait(cancelled.value, 'reddit.com', NOW + 1_000);
    expect(waitingAgain.ok).toBe(true);
    if (!waitingAgain.ok) return;
    const readyAt = NOW + 1_000 + peekWaitMs(0, false);
    const granted = allowPeek(waitingAgain.value, 'reddit.com', 2, readyAt);
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    const ended = endSession(granted.value, readyAt + 1_000, { force: true });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.value.lastSessionSummary).toMatchObject({
      peekStarts: 2,
      peekCount: 1,
      peekAbandoned: 1,
      peekMs: 2 * 60_000,
    });
    expect(ended.value.history[0]).toMatchObject({
      peekStarts: 2,
      peekCount: 1,
      peekAbandoned: 1,
      peekMs: 2 * 60_000,
    });
  });

  it('allows peek during break when that option is enabled', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;
    const updated = updateContextDefaults(
      state,
      contextId,
      {
        focusMinutes: 25,
        breakMinutes: 5,
        autoRepeat: false,
        blockDuringBreak: true,
        strictLockControls: false,
        strictAllowPeek: false,
        strictAllowPeekOnBreak: true,
        strictEscalatePeek: false,
        longBreaksEnabled: false,
        longBreakAfterSessions: 4,
        longBreakMinutes: 15,
        dailyGoalMinutes: 240,
      },
      NOW,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    state = updated.value;

    const started = startSession(state, contextId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    expect(beginPeekWait(started.value, 'reddit.com', NOW).ok).toBe(false);

    const onBreak = {
      ...started.value,
      activeSession: {
        ...started.value.activeSession!,
        phase: 'break' as const,
        plannedMs: 5 * 60_000,
        endsAt: NOW + 5 * 60_000,
      },
    };
    const waiting = beginPeekWait(onBreak, 'reddit.com', NOW);
    expect(waiting.ok).toBe(true);
  });
});
