import { createId } from './ids';
import {
  err,
  ok,
  type ActiveSession,
  type AppState,
  type Result,
  type SessionRecord,
} from './types';

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 240;

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

function computeFocusedMs(session: ActiveSession, now: number): number {
  const remaining = getRemainingMs(session, now);
  return Math.min(session.plannedMs, Math.max(0, session.plannedMs - remaining));
}

function validateDurationMinutes(durationMinutes: number): Result<number> {
  if (!Number.isInteger(durationMinutes)) {
    return err('Duration must be a whole number of minutes');
  }
  if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    return err('Duration must be between 1 and 240 minutes');
  }
  return ok(durationMinutes);
}

export function startSession(
  state: AppState,
  contextId: string,
  durationMinutes: number,
  now: number,
): Result<AppState> {
  if (state.activeSession) {
    return err('A focus session is already active');
  }

  const durationResult = validateDurationMinutes(durationMinutes);
  if (!durationResult.ok) {
    return durationResult;
  }

  const context = state.contexts.find((item) => item.id === contextId);
  if (!context) {
    return err('Context not found');
  }

  const plannedMs = durationResult.value * 60_000;
  const session: ActiveSession = {
    id: createId(),
    contextId: context.id,
    contextName: context.name,
    plannedMs,
    startedAt: now,
    status: 'running',
    endsAt: now + plannedMs,
    remainingMs: null,
  };

  return ok({
    ...state,
    activeSession: session,
    lastCompletion: null,
    settings: {
      ...state.settings,
      selectedContextId: context.id,
      lastDurationMinutes: durationResult.value,
    },
  });
}

export function pauseSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'running') {
    return err('Session is not running');
  }
  if (isExpired(session, now)) {
    return err('Session has already ended');
  }

  return ok({
    ...state,
    activeSession: {
      ...session,
      status: 'paused',
      remainingMs: getRemainingMs(session, now),
      endsAt: null,
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
  return ok({
    ...state,
    activeSession: {
      ...session,
      status: 'running',
      endsAt: now + remainingMs,
      remainingMs: null,
    },
  });
}

export function endSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }

  const record: SessionRecord = {
    id: session.id,
    contextId: session.contextId,
    contextName: session.contextName,
    plannedMs: session.plannedMs,
    focusedMs: computeFocusedMs(session, now),
    startedAt: session.startedAt,
    endedAt: now,
    outcome: 'ended_early',
  };

  return ok({
    ...state,
    activeSession: null,
    history: [...state.history, record],
  });
}

export function completeSession(state: AppState, now: number): Result<AppState> {
  const session = state.activeSession;
  if (!session) {
    return err('No active session');
  }
  if (session.status !== 'running') {
    return err('Session is not running');
  }

  const record: SessionRecord = {
    id: session.id,
    contextId: session.contextId,
    contextName: session.contextName,
    plannedMs: session.plannedMs,
    focusedMs: session.plannedMs,
    startedAt: session.startedAt,
    endedAt: now,
    outcome: 'completed',
  };

  return ok({
    ...state,
    activeSession: null,
    lastCompletion: { record },
    history: [...state.history, record],
  });
}

export function dismissCompletion(state: AppState): Result<AppState> {
  if (!state.lastCompletion) {
    return err('No completion to dismiss');
  }

  return ok({
    ...state,
    lastCompletion: null,
  });
}
