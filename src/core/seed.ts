import { SCHEMA_VERSION, type AppState, type Context } from './types';

export const DEVELOPMENT_CONTEXT_ID = '00000000-0000-4000-8000-000000000001';
export const RESEARCH_CONTEXT_ID = '00000000-0000-4000-8000-000000000002';

export function createInitialState(now: number): AppState {
  const development: Context = {
    id: DEVELOPMENT_CONTEXT_ID,
    name: 'Development',
    sites: ['reddit.com', 'youtube.com', 'instagram.com', 'x.com'],
    createdAt: now,
    updatedAt: now,
  };

  const research: Context = {
    id: RESEARCH_CONTEXT_ID,
    name: 'Research',
    sites: ['instagram.com', 'tiktok.com'],
    createdAt: now,
    updatedAt: now,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    contexts: [development, research],
    settings: {
      selectedContextId: DEVELOPMENT_CONTEXT_ID,
      lastDurationMinutes: 25,
    },
    activeSession: null,
    lastCompletion: null,
    history: [],
  };
}
