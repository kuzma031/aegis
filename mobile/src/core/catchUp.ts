import { completeSession } from './session';
import type { AppState, SessionPhase } from './types';

export interface PhaseTransition {
  at: number;
  beforePhase: SessionPhase;
  next: AppState;
}

export const MAX_CATCH_UP_STEPS = 1000;

export function advanceExpired(
  state: AppState,
  now: number,
  maxSteps = MAX_CATCH_UP_STEPS,
): { state: AppState; transitions: PhaseTransition[] } {
  let current = state;
  const transitions: PhaseTransition[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const session = current.activeSession;
    if (!session || session.status !== 'running' || session.endsAt == null) {
      break;
    }
    if (session.endsAt > now) {
      break;
    }
    const result = completeSession(current, session.endsAt);
    if (!result.ok) {
      break;
    }
    transitions.push({
      at: session.endsAt,
      beforePhase: session.phase,
      next: result.value,
    });
    current = result.value;
  }
  return { state: current, transitions };
}

/** Future phase ends from `now`, for scheduling notifications. */
export function projectTransitions(
  state: AppState,
  now: number,
  horizonMs: number,
  maxCount: number,
): PhaseTransition[] {
  return advanceExpired(state, now + horizonMs, maxCount).transitions.filter(
    (t) => t.at > now,
  );
}
