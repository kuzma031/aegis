import { createId } from './ids';
import { getAppMode, type AppMode } from './env';
import {
  demoteActiveTasksToTodo,
  findActiveTask,
  flushTaskFocus,
  openTaskFocus,
} from './taskFocus';
import {
  err,
  ok,
  type ActiveSession,
  type AppState,
  type Result,
  type SessionRecord,
  type SessionRunStats,
  type SessionSummary,
  type Task,
} from './types';

/** Dev: allow down to 1 second. Prod: half-minute steps from 0.5. */
const MIN_DURATION_MINUTES_DEV = 1 / 60;
const MIN_DURATION_MINUTES_PROD = 0.5;
const MAX_DURATION_MINUTES = 240;
const PROD_STEP_MINUTES = 0.5;

export function isAllowedDurationStep(
  minutes: number,
  mode: AppMode = getAppMode(),
): boolean {
  if (mode === 'development') {
    return true;
  }
  const scaled = minutes / PROD_STEP_MINUTES;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export function validateFocusMinutes(
  durationMinutes: number,
  mode: AppMode = getAppMode(),
): Result<number> {
  if (!Number.isFinite(durationMinutes)) {
    return err('Duration must be a number');
  }
  const min =
    mode === 'development' ? MIN_DURATION_MINUTES_DEV : MIN_DURATION_MINUTES_PROD;
  if (durationMinutes < min || durationMinutes > MAX_DURATION_MINUTES) {
    return err(
      mode === 'development'
        ? 'Focus must be between 1 second and 240 minutes'
        : 'Focus must be between 0.5 and 240 minutes',
    );
  }
  if (!isAllowedDurationStep(durationMinutes, mode)) {
    return err('Focus must be in 0.5 minute steps (e.g. 0.5, 1, 1.5)');
  }
  return ok(durationMinutes);
}

export function validateBreakMinutes(
  breakMinutes: number,
  mode: AppMode = getAppMode(),
): Result<number> {
  if (!Number.isFinite(breakMinutes)) {
    return err('Break must be a number');
  }
  if (breakMinutes < 0 || breakMinutes > MAX_DURATION_MINUTES) {
    return err('Break must be between 0 and 240 minutes');
  }
  if (breakMinutes === 0) {
    return ok(0);
  }
  const min =
    mode === 'development' ? MIN_DURATION_MINUTES_DEV : MIN_DURATION_MINUTES_PROD;
  if (breakMinutes < min) {
    return err(
      mode === 'development'
        ? 'Break must be at least 1 second when set'
        : 'Break must be at least 0.5 minutes when set',
    );
  }
  if (!isAllowedDurationStep(breakMinutes, mode)) {
    return err('Break must be in 0.5 minute steps (e.g. 0.5, 1, 1.5)');
  }
  return ok(breakMinutes);
}

export function getRemainingMs(session: ActiveSession, now: number): number {
  if (session.status === 'paused') {
    return Math.max(0, session.remainingMs ?? 0);
  }
  if (session.endsAt == null) {
    return 0;
  }
  return Math.max(0, session.endsAt - now);
}

export function isExpired(session: ActiveSession, now: number): boolean {
  return session.status === 'running' && getRemainingMs(session, now) === 0;
}

function computeElapsedMs(session: ActiveSession, now: number): number {
  const remaining = getRemainingMs(session, now);
  return Math.min(session.plannedMs, Math.max(0, session.plannedMs - remaining));
}

function emptyRunStats(now: number): SessionRunStats {
  return {
    focusCount: 0,
    breakCount: 0,
    focusMs: 0,
    breakMs: 0,
    distractionOverrides: 0,
    pauseCount: 0,
    distractionBySite: {},
    tasks: [],
    startedAt: now,
    peekStarts: 0,
    peekCount: 0,
    peekAbandoned: 0,
    peekMs: 0,
    peekGrants: [],
    peekWait: null,
  };
}

/** Wait ladder for escalating peeks: 10s → 1m → 5m → 15m → 30m. */
export const PEEK_WAIT_MS = [
  10_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
] as const;

export const MAX_PEEK_DURATION_MINUTES = 15;

export function peekWaitMs(
  successfulPeekCount: number,
  escalate: boolean,
): number {
  if (!escalate) {
    return PEEK_WAIT_MS[0]!;
  }
  const index = Math.min(
    Math.max(0, successfulPeekCount),
    PEEK_WAIT_MS.length - 1,
  );
  return PEEK_WAIT_MS[index]!;
}

function normalizePeekHost(raw: string | undefined): string | null {
  return normalizeDistractionSite(raw);
}

/** True when pause/end should be hidden or rejected for the active phase. */
export function areSessionControlsLocked(session: ActiveSession): boolean {
  return (
    session.strictLockControls &&
    (session.status === 'running' || session.status === 'paused')
  );
}

/** Whether peek is allowed for the current phase. */
export function isPeekAllowed(session: ActiveSession): boolean {
  if (session.status === 'awaiting') {
    return false;
  }
  if (session.phase === 'focus') {
    return session.strictAllowPeek;
  }
  if (session.phase === 'break') {
    return session.strictAllowPeekOnBreak;
  }
  return false;
}

export function activePeekHosts(session: ActiveSession, now: number): string[] {
  return session.run.peekGrants
    .filter((grant) => grant.expiresAt > now)
    .map((grant) => grant.host);
}

export function nextPeekExpiryAt(session: ActiveSession, now: number): number | null {
  let soonest: number | null = null;
  for (const grant of session.run.peekGrants) {
    if (grant.expiresAt <= now) continue;
    if (soonest == null || grant.expiresAt < soonest) {
      soonest = grant.expiresAt;
    }
  }
  return soonest;
}

/** Whole minutes remaining in the current phase (floor). */
export function maxPeekDurationMinutes(session: ActiveSession, now: number): number {
  const remainingMs = getRemainingMs(session, now);
  return Math.min(
    MAX_PEEK_DURATION_MINUTES,
    Math.max(0, Math.floor(remainingMs / 60_000)),
  );
}

export function peekDurationOptions(session: ActiveSession, now: number): number[] {
  const max = maxPeekDurationMinutes(session, now);
  if (max < 1) {
    return [];
  }
  return Array.from({ length: max }, (_, index) => index + 1);
}

export function pruneExpiredPeeks(state: AppState, now: number): AppState {
  const session = state.activeSession;
  if (!session || session.run.peekGrants.length === 0) {
    return state;
  }
  const peekGrants = session.run.peekGrants.filter((grant) => grant.expiresAt > now);
  if (peekGrants.length === session.run.peekGrants.length) {
    return state;
  }
  return {
    ...state,
    activeSession: {
      ...session,
      run: {
        ...session.run,
        peekGrants,
      },
    },
  };
}

function mergeSiteCounts(
  base: Record<string, number>,
  extra: Record<string, number>,
): Record<string, number> {
  const next = { ...base };
  for (const [site, count] of Object.entries(extra)) {
    if (count <= 0) continue;
    next[site] = (next[site] ?? 0) + count;
  }
  return next;
}

function taskSnapshot(task: Task | null): Pick<SessionRecord, 'taskId' | 'taskTitle'> {
  if (!task) {
    return { taskId: null, taskTitle: null };
  }
  return { taskId: task.id, taskTitle: task.title };
}

function buildFocusRecord(
  session: ActiveSession,
  focusedMs: number,
  endedAt: number,
  outcome: SessionRecord['outcome'],
  task: Task | null,
): SessionRecord {
  return {
    id: session.id,
    contextId: session.contextId,
    contextName: session.contextName,
    plannedMs: session.plannedMs,
    focusedMs,
    startedAt: session.startedAt,
    endedAt,
    outcome,
    distractionOverrides: session.distractionOverrides,
    pauseCount: session.pauseCount,
    breakCount: 0,
    breakMs: 0,
    distractionBySite: { ...session.distractionBySite },
    peekStarts: session.peekStarts,
    peekCount: session.peekCount,
    peekAbandoned: session.peekAbandoned,
    peekMs: session.peekMs,
    ...taskSnapshot(task),
  };
}

function appendBreakToLastFocus(
  history: SessionRecord[],
  breakMs: number,
  peeks?: Pick<
    ActiveSession,
    'peekStarts' | 'peekCount' | 'peekAbandoned' | 'peekMs'
  >,
): SessionRecord[] {
  const hasBreak = breakMs > 0;
  const hasPeeks =
    peeks != null &&
    (peeks.peekStarts > 0 ||
      peeks.peekCount > 0 ||
      peeks.peekAbandoned > 0 ||
      peeks.peekMs > 0);
  if (history.length === 0 || (!hasBreak && !hasPeeks)) {
    return history;
  }
  const last = history[history.length - 1]!;
  return [
    ...history.slice(0, -1),
    {
      ...last,
      breakCount: hasBreak ? last.breakCount + 1 : last.breakCount,
      breakMs: last.breakMs + Math.max(0, breakMs),
      peekStarts: last.peekStarts + (peeks?.peekStarts ?? 0),
      peekCount: last.peekCount + (peeks?.peekCount ?? 0),
      peekAbandoned: last.peekAbandoned + (peeks?.peekAbandoned ?? 0),
      peekMs: last.peekMs + (peeks?.peekMs ?? 0),
    },
  ];
}

function normalizeDistractionSite(raw: string | undefined): string | null {
  if (raw == null) {
    return null;
  }
  const site = raw.trim().toLowerCase().replace(/^www\./, '');
  if (!site || site.length > 253) {
    return null;
  }
  return site;
}

function toSummary(
  session: ActiveSession,
  run: SessionRunStats,
  endedAt: number,
): SessionSummary {
  const tasks = run.tasks
    .filter((task) => task.focusMs > 0)
    .map((task) => ({ ...task }))
    .sort((a, b) => b.focusMs - a.focusMs || a.taskTitle.localeCompare(b.taskTitle));

  return {
    contextId: session.contextId,
    contextName: session.contextName,
    focusCount: run.focusCount,
    breakCount: run.breakCount,
    focusMs: run.focusMs,
    breakMs: run.breakMs,
    distractionOverrides: run.distractionOverrides,
    pauseCount: run.pauseCount,
    peekStarts: run.peekStarts,
    peekCount: run.peekCount,
    peekAbandoned: run.peekAbandoned,
    peekMs: run.peekMs,
    tasks,
    startedAt: run.startedAt,
    endedAt,
  };
}

function beginFocusPhase(
  session: Pick<
    ActiveSession,
    | 'contextId'
    | 'contextName'
    | 'focusMinutes'
    | 'breakMinutes'
    | 'longBreaksEnabled'
    | 'longBreakAfterSessions'
    | 'longBreakMinutes'
    | 'repeat'
    | 'strictLockControls'
    | 'strictAllowPeek'
    | 'strictAllowPeekOnBreak'
    | 'strictEscalatePeek'
  > & { run?: SessionRunStats },
  now: number,
): ActiveSession {
  const plannedMs = Math.round(session.focusMinutes * 60_000);
  return {
    id: createId(),
    contextId: session.contextId,
    contextName: session.contextName,
    phase: 'focus',
    focusMinutes: session.focusMinutes,
    breakMinutes: session.breakMinutes,
    longBreaksEnabled: session.longBreaksEnabled,
    longBreakAfterSessions: session.longBreakAfterSessions,
    longBreakMinutes: session.longBreakMinutes,
    isLongBreak: false,
    repeat: session.repeat,
    strictLockControls: session.strictLockControls,
    strictAllowPeek: session.strictAllowPeek,
    strictAllowPeekOnBreak: session.strictAllowPeekOnBreak,
    strictEscalatePeek: session.strictEscalatePeek,
    plannedMs,
    startedAt: now,
    status: 'running',
    endsAt: now + plannedMs,
    remainingMs: null,
    distractionOverrides: 0,
    distractionBySite: {},
    pauseCount: 0,
    peekStarts: 0,
    peekCount: 0,
    peekAbandoned: 0,
    peekMs: 0,
    run: session.run
      ? { ...session.run, peekWait: null, peekGrants: [] }
      : emptyRunStats(now),
    taskFocus: null,
  };
}

function beginBreakPhase(
  session: ActiveSession,
  now: number,
  breakMinutes: number,
  isLongBreak: boolean,
): ActiveSession {
  const plannedMs = Math.round(breakMinutes * 60_000);
  return {
    ...session,
    id: createId(),
    phase: 'break',
    isLongBreak,
    plannedMs,
    startedAt: now,
    status: 'running',
    endsAt: now + plannedMs,
    remainingMs: null,
    distractionOverrides: 0,
    distractionBySite: {},
    pauseCount: 0,
    peekStarts: 0,
    peekCount: 0,
    peekAbandoned: 0,
    peekMs: 0,
    run: {
      ...session.run,
      peekWait: null,
      peekGrants: [],
    },
    taskFocus: null,
  };
}

function breakMinutesForCompletedFocus(session: ActiveSession, focusCount: number): {
  minutes: number;
  isLongBreak: boolean;
} {
  const isLongBreak =
    session.longBreaksEnabled &&
    session.longBreakAfterSessions > 0 &&
    focusCount % session.longBreakAfterSessions === 0;
  if (isLongBreak) {
    return { minutes: session.longBreakMinutes, isLongBreak: true };
  }
  return { minutes: session.breakMinutes, isLongBreak: false };
}

/** Break that would start after the focus already counted in `session.run`. */
export function getPendingBreak(session: ActiveSession): {
  minutes: number;
  isLongBreak: boolean;
} {
  return breakMinutesForCompletedFocus(session, session.run.focusCount);
}

function beginAwaitingChoice(session: ActiveSession): ActiveSession {
  return {
    ...session,
    status: 'awaiting',
    endsAt: null,
    remainingMs: null,
    taskFocus: null,
    run: {
      ...session.run,
      peekWait: null,
      peekGrants: [],
    },
  };
}

export function startSession(
  state: AppState,
  contextId: string,
  focusMinutes: number,
  breakMinutes: number,
  repeat: boolean,
  now: number,
  mode: AppMode = getAppMode(),
): Result<AppState> {
  if (state.activeSession) {
    return err('A focus session is already active');
  }

  const focusResult = validateFocusMinutes(focusMinutes, mode);
  if (!focusResult.ok) {
    return focusResult;
  }
  const breakResult = validateBreakMinutes(breakMinutes, mode);
  if (!breakResult.ok) {
    return breakResult;
  }

  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  const session = beginFocusPhase(
    {
      contextId: context.id,
      contextName: context.name,
      focusMinutes: focusResult.value,
      breakMinutes: breakResult.value,
      longBreaksEnabled: context.longBreaksEnabled,
      longBreakAfterSessions: context.longBreakAfterSessions,
      longBreakMinutes: context.longBreakMinutes,
      repeat,
      strictLockControls: context.strictLockControls,
      strictAllowPeek: context.strictAllowPeek,
      strictAllowPeekOnBreak: context.strictAllowPeekOnBreak,
      strictEscalatePeek: context.strictEscalatePeek,
    },
    now,
  );

  let next: AppState = {
    ...state,
    activeSession: session,
    lastSessionSummary: null,
    settings: {
      ...state.settings,
      selectedContextId: context.id,
      lastDurationMinutes: focusResult.value,
      lastBreakMinutes: breakResult.value,
      lastRepeat: repeat,
    },
  };

  const activeTask = findActiveTask(next);
  if (activeTask) {
    next = openTaskFocus(next, activeTask.id, now);
  }

  return ok(next);
}

export function pauseSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (areSessionControlsLocked(session)) {
    return err('Controls are locked for this session');
  }
  if (session.status !== 'running') {
    return err('Session is not running');
  }
  if (isExpired(session, now)) {
    return err('Session has already ended');
  }

  const flushed = flushTaskFocus(state, now);
  const paused = flushed.activeSession!;
  return ok({
    ...flushed,
    activeSession: {
      ...paused,
      status: 'paused',
      remainingMs: getRemainingMs(session, now),
      endsAt: null,
      pauseCount: paused.pauseCount + 1,
      run: {
        ...paused.run,
        pauseCount: paused.run.pauseCount + 1,
      },
    },
  });
}

export function resumeSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'paused') {
    return err('Session is not paused');
  }

  const remainingMs = session.remainingMs ?? 0;
  let next: AppState = {
    ...state,
    activeSession: {
      ...session,
      status: 'running',
      endsAt: now + remainingMs,
      remainingMs: null,
    },
  };

  const activeTask = findActiveTask(next);
  if (activeTask && next.activeSession?.phase === 'focus') {
    next = openTaskFocus(next, activeTask.id, now);
  }

  return ok(next);
}

export function endSession(
  state: AppState,
  now: number,
  options?: { force?: boolean },
): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (areSessionControlsLocked(session) && !options?.force) {
    return err('Controls are locked for this session');
  }

  // Focus or break already committed when entering awaiting; do not record again.
  if (session.status === 'awaiting') {
    let next = flushTaskFocus(state, now);
    const run = next.activeSession?.run ?? session.run;
    next = demoteActiveTasksToTodo(next, now);
    return ok({
      ...next,
      activeSession: null,
      lastSessionSummary: toSummary(session, run, now),
      history: state.history,
    });
  }

  const activeTask = findActiveTask(state);
  let history = state.history;
  let run = { ...session.run };
  const elapsed = computeElapsedMs(session, now);

  if (session.phase === 'focus') {
    const record = buildFocusRecord(session, elapsed, now, 'ended_early', activeTask);
    history = [...state.history, record];
    run = {
      ...run,
      focusCount: run.focusCount + 1,
      focusMs: run.focusMs + elapsed,
    };
  } else {
    history = appendBreakToLastFocus(history, elapsed, {
      peekStarts: session.peekStarts,
      peekCount: session.peekCount,
      peekAbandoned: session.peekAbandoned,
      peekMs: session.peekMs,
    });
    run = {
      ...run,
      breakCount: run.breakCount + 1,
      breakMs: run.breakMs + elapsed,
    };
  }

  let next = flushTaskFocus(state, now);
  run = {
    ...run,
    tasks: next.activeSession?.run.tasks ?? run.tasks,
  };
  next = demoteActiveTasksToTodo(next, now);

  return ok({
    ...next,
    activeSession: null,
    lastSessionSummary: toSummary(session, run, now),
    history,
  });
}

/**
 * After a finished focus (awaiting), start another focus for `durationMinutes`.
 * Does not change `focusMinutes` on the session — later focuses keep the original length.
 */
export function extendFocusSession(
  state: AppState,
  durationMinutes: number,
  now: number,
  mode: AppMode = getAppMode(),
): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'awaiting' || session.phase !== 'focus') {
    return err('No finished focus to extend');
  }

  const focusResult = validateFocusMinutes(durationMinutes, mode);
  if (!focusResult.ok) {
    return focusResult;
  }

  const plannedMs = Math.round(focusResult.value * 60_000);
  const nextSession: ActiveSession = {
    ...beginFocusPhase({ ...session, run: session.run }, now),
    plannedMs,
    endsAt: now + plannedMs,
  };

  let next: AppState = {
    ...state,
    activeSession: nextSession,
    lastSessionSummary: null,
  };

  const activeTask = findActiveTask(next);
  if (activeTask) {
    next = openTaskFocus(next, activeTask.id, now);
  }

  return ok(next);
}

/** After a finished focus (awaiting), start the pending break. */
export function startBreakSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'awaiting' || session.phase !== 'focus') {
    return err('No finished focus awaiting a break');
  }

  const nextBreak = getPendingBreak(session);
  if (nextBreak.minutes <= 0) {
    return err('No break to start');
  }

  return ok({
    ...state,
    lastSessionSummary: null,
    activeSession: beginBreakPhase(
      session,
      now,
      nextBreak.minutes,
      nextBreak.isLongBreak,
    ),
  });
}

/** After a finished break (awaiting), start the next focus at the stored length. */
export function continueFocusSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'awaiting' || session.phase !== 'break') {
    return err('No finished break to continue from');
  }

  let next: AppState = {
    ...state,
    lastSessionSummary: null,
    activeSession: beginFocusPhase({ ...session, run: session.run }, now),
  };

  const activeTask = findActiveTask(next);
  if (activeTask) {
    next = openTaskFocus(next, activeTask.id, now);
  }

  return ok(next);
}

/**
 * Advances an expired running phase:
 * focus → break (if break > 0) → idle or next focus (if repeat)
 * break → next focus (if repeat) or idle
 */
export function completeSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'running') {
    return err('Session is not running');
  }
  if (!isExpired(session, now)) {
    return err('Session has not expired yet');
  }

  if (session.phase === 'focus') {
    const activeTask = findActiveTask(state);
    const record = buildFocusRecord(
      session,
      session.plannedMs,
      now,
      'completed',
      activeTask,
    );
    const history = [...state.history, record];

    let next = flushTaskFocus(state, now);
    const flushedSession = next.activeSession!;
    const run: SessionRunStats = {
      ...flushedSession.run,
      focusCount: session.run.focusCount + 1,
      focusMs: session.run.focusMs + session.plannedMs,
    };
    const withRun = { ...flushedSession, run };
    const nextBreak = breakMinutesForCompletedFocus(withRun, run.focusCount);

    // Auto-repeat on: keep the automatic focus → break → focus cycle.
    if (session.repeat) {
      if (nextBreak.minutes > 0) {
        return ok({
          ...next,
          history,
          lastSessionSummary: null,
          activeSession: beginBreakPhase(
            withRun,
            now,
            nextBreak.minutes,
            nextBreak.isLongBreak,
          ),
        });
      }

      next = {
        ...next,
        history,
        lastSessionSummary: null,
        activeSession: beginFocusPhase({ ...withRun, run }, now),
      };
      const stillActive = findActiveTask(next);
      if (stillActive) {
        next = openTaskFocus(next, stillActive.id, now);
      }
      return ok(next);
    }

    // Auto-repeat off: hold for Extend / Start break (or End when no break).
    return ok({
      ...next,
      history,
      lastSessionSummary: null,
      activeSession: beginAwaitingChoice(withRun),
    });
  }

  // Break phase finished
  const breakMs = session.plannedMs;
  const history = appendBreakToLastFocus(state.history, breakMs, {
    peekStarts: session.peekStarts,
    peekCount: session.peekCount,
    peekAbandoned: session.peekAbandoned,
    peekMs: session.peekMs,
  });
  const run: SessionRunStats = {
    ...session.run,
    breakCount: session.run.breakCount + 1,
    breakMs: session.run.breakMs + breakMs,
  };
  const withRun = { ...session, run };

  if (session.repeat) {
    let next: AppState = {
      ...state,
      history,
      lastSessionSummary: null,
      activeSession: beginFocusPhase({ ...withRun, run }, now),
    };
    const activeTask = findActiveTask(next);
    if (activeTask) {
      next = openTaskFocus(next, activeTask.id, now);
    }
    return ok(next);
  }

  // Auto-repeat off: hold for Start focus / End session.
  return ok({
    ...state,
    history,
    lastSessionSummary: null,
    activeSession: beginAwaitingChoice(withRun),
  });
}

export function dismissSessionSummary(state: AppState): Result<AppState> {
  if (!state.lastSessionSummary) {
    return err('No session summary to dismiss');
  }

  return ok({
    ...state,
    lastSessionSummary: null,
  });
}

/** @deprecated Use dismissSessionSummary */
export function dismissCompletion(state: AppState): Result<AppState> {
  return dismissSessionSummary(state);
}

/** Count a blocked-URL attempt during an active focus phase. */
export function recordDistraction(
  state: AppState,
  site?: string,
): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.phase !== 'focus') {
    return err('Distractions are only counted during focus');
  }

  const host = normalizeDistractionSite(site);
  const distractionBySite = { ...session.distractionBySite };
  if (host) {
    distractionBySite[host] = (distractionBySite[host] ?? 0) + 1;
  }

  return ok({
    ...state,
    activeSession: {
      ...session,
      distractionOverrides: session.distractionOverrides + 1,
      distractionBySite,
      run: {
        ...session.run,
        distractionOverrides: session.run.distractionOverrides + 1,
        distractionBySite: mergeSiteCounts(
          session.run.distractionBySite,
          host ? { [host]: 1 } : {},
        ),
      },
    },
  });
}

/**
 * Start (or keep) the peek wait for a blocked host.
 * Idempotent for the same host while a wait is already running.
 */
export function beginPeekWait(
  state: AppState,
  site: string | undefined,
  now: number,
): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (!isPeekAllowed(session)) {
    return err('Peek is not enabled for this phase');
  }

  const host = normalizePeekHost(site);
  if (!host) {
    return err('Invalid site');
  }
  if (activePeekHosts(session, now).includes(host)) {
    return err('Site is already open for a peek');
  }
  if (maxPeekDurationMinutes(session, now) < 1) {
    return err('Not enough time left to peek');
  }
  if (session.run.peekWait?.host === host) {
    return ok(state);
  }

  const abandonedPrior = session.run.peekWait != null ? 1 : 0;
  const readyAt =
    now + peekWaitMs(session.run.peekCount, session.strictEscalatePeek);

  return ok({
    ...state,
    activeSession: {
      ...session,
      peekStarts: session.peekStarts + 1,
      peekAbandoned: session.peekAbandoned + abandonedPrior,
      run: {
        ...session.run,
        peekStarts: session.run.peekStarts + 1,
        peekAbandoned: session.run.peekAbandoned + abandonedPrior,
        peekWait: { host, readyAt },
      },
    },
  });
}

export function clearPeekWait(state: AppState): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (!session.run.peekWait) {
    return ok(state);
  }
  return ok({
    ...state,
    activeSession: {
      ...session,
      peekAbandoned: session.peekAbandoned + 1,
      run: {
        ...session.run,
        peekAbandoned: session.run.peekAbandoned + 1,
        peekWait: null,
      },
    },
  });
}

/** Grant a timed peek after the wait has elapsed. */
export function allowPeek(
  state: AppState,
  site: string | undefined,
  durationMinutes: number,
  now: number,
): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (!isPeekAllowed(session)) {
    return err('Peek is not enabled for this phase');
  }

  const host = normalizePeekHost(site);
  if (!host) {
    return err('Invalid site');
  }

  const wait = session.run.peekWait;
  if (!wait || wait.host !== host) {
    return err('Peek wait has not started');
  }
  if (now < wait.readyAt) {
    return err('Peek wait is not finished yet');
  }

  if (
    !Number.isFinite(durationMinutes) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1
  ) {
    return err('Peek duration must be a whole number of minutes');
  }
  const maxMinutes = maxPeekDurationMinutes(session, now);
  if (maxMinutes < 1) {
    return err('Not enough time left to peek');
  }
  if (durationMinutes > maxMinutes) {
    return err(`Peek duration must be between 1 and ${maxMinutes} minutes`);
  }

  const grantedMs = durationMinutes * 60_000;
  const expiresAt = now + grantedMs;
  const peekGrants = [
    ...session.run.peekGrants.filter(
      (grant) => grant.host !== host && grant.expiresAt > now,
    ),
    { host, expiresAt },
  ];

  return ok({
    ...state,
    activeSession: {
      ...session,
      peekCount: session.peekCount + 1,
      peekMs: session.peekMs + grantedMs,
      run: {
        ...session.run,
        peekCount: session.run.peekCount + 1,
        peekMs: session.run.peekMs + grantedMs,
        peekGrants,
        peekWait: null,
      },
    },
  });
}
