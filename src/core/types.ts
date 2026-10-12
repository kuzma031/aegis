import type { AmbientTrackId } from './ambientAudio';
import type { CompletionSoundId } from './completionFeedback';

export type { AmbientTrackId, CompletionSoundId };

export type ID = string;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type VoidResult = { ok: true } | { ok: false; error: string };

export interface Context {
  id: ID;
  name: string;
  sites: string[];
  /** Default focus length shown on Home when this context is selected. */
  defaultFocusMinutes: number;
  /** Default break length shown on Home when this context is selected. */
  defaultBreakMinutes: number;
  /** When true, sessions auto-repeat focus → break until ended. */
  autoRepeat: boolean;
  /** When true, blocked sites stay blocked during breaks. */
  blockDuringBreak: boolean;
  /** When true, pause/end are disabled while a phase is running or paused. */
  strictLockControls: boolean;
  /** When true, blocked page can unlock a site after a wait during focus. */
  strictAllowPeek: boolean;
  /** When true, peek is also available during breaks (when sites stay blocked). */
  strictAllowPeekOnBreak: boolean;
  /** When true, each successful peek increases the next wait. */
  strictEscalatePeek: boolean;
  /** When true, insert a long break after every N focus sessions. */
  longBreaksEnabled: boolean;
  /** Take a long break after this many completed focus sessions (e.g. 4). */
  longBreakAfterSessions: number;
  /** Length of the long break in minutes. */
  longBreakMinutes: number;
  /**
   * Daily focus goal for this context in minutes.
   * `0` = off; otherwise 30–480 in 30-minute steps.
   */
  dailyGoalMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'running' | 'paused' | 'awaiting';
export type SessionPhase = 'focus' | 'break';

/** Per-task focus time accrued during a single focus↔break run. */
export interface SessionRunTaskFocus {
  taskId: ID;
  taskTitle: string;
  focusMs: number;
}

/** Temporary unblock of a blocked host until `expiresAt`. */
export interface PeekGrant {
  host: string;
  expiresAt: number;
}

/** Accumulated stats for the current focus↔break run until it goes idle. */
export interface SessionRunStats {
  focusCount: number;
  breakCount: number;
  focusMs: number;
  breakMs: number;
  distractionOverrides: number;
  pauseCount: number;
  /** Blocked-page hits keyed by hostname during this run. */
  distractionBySite: Record<string, number>;
  /** Focus time per Working task during this run. */
  tasks: SessionRunTaskFocus[];
  startedAt: number;
  /** Times the user started a peek wait during this run. */
  peekStarts: number;
  /** Successful peeks granted during this run. */
  peekCount: number;
  /** Peek waits cancelled before unlock during this run. */
  peekAbandoned: number;
  /** Total granted peek unlock duration during this run (ms). */
  peekMs: number;
  /** Timed site unlocks for this run. */
  peekGrants: PeekGrant[];
  /** Active peek wait for a blocked host, if any. */
  peekWait: { host: string; readyAt: number } | null;
}

export interface ActiveSession {
  id: ID;
  contextId: ID;
  contextName: string;
  phase: SessionPhase;
  /** Focus length for this cycle (minutes, may be fractional). */
  focusMinutes: number;
  /** Short break length for this cycle (minutes; 0 skips short break). */
  breakMinutes: number;
  /** Whether long breaks are enabled for this run. */
  longBreaksEnabled: boolean;
  /** Take a long break after this many completed focuses in the run. */
  longBreakAfterSessions: number;
  /** Long break length in minutes. */
  longBreakMinutes: number;
  /** True when the current break phase is a long break. */
  isLongBreak: boolean;
  /** When true, restart focus after break forever until user ends. */
  repeat: boolean;
  /** Copied from context at session start. */
  strictLockControls: boolean;
  strictAllowPeek: boolean;
  strictAllowPeekOnBreak: boolean;
  strictEscalatePeek: boolean;
  plannedMs: number;
  startedAt: number;
  status: SessionStatus;
  endsAt: number | null;
  remainingMs: number | null;
  /** Times the user hit a blocked URL during this focus phase. */
  distractionOverrides: number;
  /** Blocked-page hits by hostname during this focus phase. */
  distractionBySite: Record<string, number>;
  /** Pauses during this focus phase. */
  pauseCount: number;
  /** Peek waits started during this phase. */
  peekStarts: number;
  /** Successful peeks granted during this phase. */
  peekCount: number;
  /** Peek waits cancelled during this phase. */
  peekAbandoned: number;
  /** Granted peek unlock duration during this phase (ms). */
  peekMs: number;
  /** Totals across the whole run (including prior phases). */
  run: SessionRunStats;
  /** Open focus-time segment for the Working task, if accruing. */
  taskFocus: { taskId: ID; startedAt: number } | null;
}

export type SessionOutcome = 'completed' | 'ended_early';

export interface SessionRecord {
  id: ID;
  contextId: ID;
  contextName: string;
  plannedMs: number;
  focusedMs: number;
  startedAt: number;
  endedAt: number;
  outcome: SessionOutcome;
  distractionOverrides: number;
  pauseCount: number;
  /** Breaks completed after this focus (updated when breaks finish). */
  breakCount: number;
  breakMs: number;
  distractionBySite: Record<string, number>;
  /** Peek waits started during this focus (break peeks append here too). */
  peekStarts: number;
  /** Successful peeks granted for this focus cycle. */
  peekCount: number;
  /** Peek waits cancelled for this focus cycle. */
  peekAbandoned: number;
  /** Granted peek unlock duration for this focus cycle (ms). */
  peekMs: number;
  /** Working task at focus-phase close (survives rename/delete via title). */
  taskId: ID | null;
  taskTitle: string | null;
}

/** Snapshot shown on Home after a run ends (auto off, or user ends). */
export interface SessionSummary {
  contextId: ID;
  contextName: string;
  focusCount: number;
  breakCount: number;
  focusMs: number;
  breakMs: number;
  distractionOverrides: number;
  pauseCount: number;
  peekStarts: number;
  peekCount: number;
  peekAbandoned: number;
  peekMs: number;
  /** Tasks that accrued focus time during this run (empty if none). */
  tasks: SessionRunTaskFocus[];
  startedAt: number;
  endedAt: number;
}

/** Where task controls appear outside the main Tasks tab. */
export type TaskPresentation = 'extension' | 'sidepanel' | 'hover';

export interface Settings {
  selectedContextId: ID | null;
  lastDurationMinutes: number;
  lastBreakMinutes: number;
  lastRepeat: boolean;
  /** Daily focus goal shown on Stats (minutes). */
  dailyFocusTargetMinutes: number;
  /**
   * Task UI surface:
   * - extension: popup Tasks tab only
   * - sidepanel: Chrome side panel
   * - hover: in-page edge rail (content script)
   */
  taskPresentation: TaskPresentation;
  /** Bell played when a focus or break phase ends. */
  completionSoundId: CompletionSoundId;
  /** When true, loop focus audio while a session is running. */
  ambientEnabled: boolean;
  /** Loop played while a session is running, if ambient audio is on. */
  ambientTrackId: AmbientTrackId;
}

export type TaskStatus = 'todo' | 'active' | 'finished';

export interface Task {
  id: ID;
  title: string;
  status: TaskStatus;
  /** Committed focus time only (open segment is added at display/flush). */
  focusedMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppState {
  contexts: Context[];
  tasks: Task[];
  settings: Settings;
  activeSession: ActiveSession | null;
  lastSessionSummary: SessionSummary | null;
  history: SessionRecord[];
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function okVoid(): VoidResult {
  return { ok: true };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}

export function errVoid(error: string): VoidResult {
  return { ok: false, error };
}
