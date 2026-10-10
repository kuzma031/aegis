import { DEFAULT_AMBIENT_TRACK } from './ambientAudio';
import { DEFAULT_COMPLETION_SOUND } from './completionFeedback';
import { DEFAULT_DAILY_GOAL_MINUTES } from './contexts';
import type { AppState, Context } from './types';

export const DEVELOPMENT_CONTEXT_ID = '00000000-0000-4000-8000-000000000001';
export const RESEARCH_CONTEXT_ID = '00000000-0000-4000-8000-000000000002';

export function createInitialState(now: number): AppState {
  const development: Context = {
    id: DEVELOPMENT_CONTEXT_ID,
    name: 'Development',
    sites: ['reddit.com', 'youtube.com', 'instagram.com', 'x.com'],
    defaultFocusMinutes: 25,
    defaultBreakMinutes: 5,
    autoRepeat: true,
    blockDuringBreak: true,
    longBreaksEnabled: false,
    longBreakAfterSessions: 4,
    longBreakMinutes: 15,
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    createdAt: now,
    updatedAt: now,
  };

  const research: Context = {
    id: RESEARCH_CONTEXT_ID,
    name: 'Research',
    sites: ['instagram.com', 'tiktok.com'],
    defaultFocusMinutes: 50,
    defaultBreakMinutes: 10,
    autoRepeat: true,
    blockDuringBreak: true,
    longBreaksEnabled: false,
    longBreakAfterSessions: 4,
    longBreakMinutes: 15,
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    createdAt: now,
    updatedAt: now,
  };

  return {
    contexts: [development, research],
    tasks: [],
    settings: {
      selectedContextId: DEVELOPMENT_CONTEXT_ID,
      lastDurationMinutes: 25,
      lastBreakMinutes: 5,
      lastRepeat: false,
      dailyFocusTargetMinutes: 240,
      taskPresentation: 'hover',
      completionSoundId: DEFAULT_COMPLETION_SOUND,
      ambientEnabled: false,
      ambientTrackId: DEFAULT_AMBIENT_TRACK,
    },
    activeSession: null,
    lastSessionSummary: null,
    history: [],
  };
}
