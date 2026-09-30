export const SCHEMA_VERSION = 1;

export type ID = string;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface Context {
  id: ID;
  name: string;
  sites: string[];
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'running' | 'paused';

export interface ActiveSession {
  id: ID;
  contextId: ID;
  contextName: string;
  plannedMs: number;
  startedAt: number;
  status: SessionStatus;
  endsAt: number | null;
  remainingMs: number | null;
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
}

export interface Settings {
  selectedContextId: ID | null;
  lastDurationMinutes: number;
}

export interface AppState {
  schemaVersion: number;
  contexts: Context[];
  settings: Settings;
  activeSession: ActiveSession | null;
  lastCompletion: { record: SessionRecord } | null;
  history: SessionRecord[];
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
