import { createInitialState } from '@core/seed';
import { SCHEMA_VERSION, type AppState } from '@core/types';

export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION;

export function migrate(raw: unknown, now: number): AppState {
  if (raw == null || typeof raw !== 'object') {
    return createInitialState(now);
  }

  const candidate = raw as Partial<AppState>;
  if (candidate.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return candidate as AppState;
  }

  return createInitialState(now);
}
