import { DEFAULT_AMBIENT_TRACK, isAmbientTrackId } from '@core/ambientAudio';
import { DEFAULT_COMPLETION_SOUND, isCompletionSoundId } from '@core/completionFeedback';
import {
  DEFAULT_DAILY_GOAL_MINUTES,
  isValidDailyGoalMinutes,
} from '@core/contexts';
import { createInitialState } from '@core/seed';
import { isTaskStatus } from '@core/tasks';
import type {
  ActiveSession,
  AppState,
  Context,
  SessionRecord,
  SessionRunStats,
  SessionSummary,
  Settings,
  Task,
  TaskPresentation,
  TaskStatus,
} from '@core/types';

const TASK_PRESENTATIONS: ReadonlySet<TaskPresentation> = new Set([
  'extension',
  'sidepanel',
  'hover',
]);

function isTaskPresentation(value: unknown): value is TaskPresentation {
  return typeof value === 'string' && TASK_PRESENTATIONS.has(value as TaskPresentation);
}

function patchSettings(settings: Partial<Settings> | undefined): Settings {
  return {
    selectedContextId: settings?.selectedContextId ?? null,
    lastDurationMinutes: settings?.lastDurationMinutes ?? 25,
    lastBreakMinutes: settings?.lastBreakMinutes ?? 5,
    lastRepeat: settings?.lastRepeat ?? false,
    dailyFocusTargetMinutes:
      typeof settings?.dailyFocusTargetMinutes === 'number' &&
      settings.dailyFocusTargetMinutes > 0
        ? Math.floor(settings.dailyFocusTargetMinutes)
        : 240,
    taskPresentation: isTaskPresentation(settings?.taskPresentation)
      ? settings.taskPresentation
      : 'hover',
    completionSoundId: isCompletionSoundId(settings?.completionSoundId)
      ? settings.completionSoundId
      : DEFAULT_COMPLETION_SOUND,
    ambientEnabled: settings?.ambientEnabled === true,
    ambientTrackId: isAmbientTrackId(settings?.ambientTrackId)
      ? settings.ambientTrackId
      : DEFAULT_AMBIENT_TRACK,
  };
}

type LegacyContext = {
  id?: unknown;
  name?: unknown;
  sites?: unknown;
  defaultFocusMinutes?: unknown;
  defaultBreakMinutes?: unknown;
  autoRepeat?: unknown;
  blockDuringBreak?: unknown;
  longBreaksEnabled?: unknown;
  longBreakAfterSessions?: unknown;
  longBreakMinutes?: unknown;
  dailyGoalMinutes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function patchContext(context: LegacyContext, now: number): Context | null {
  if (typeof context.id !== 'string' || typeof context.name !== 'string') {
    return null;
  }
  return {
    id: context.id,
    name: context.name,
    sites: Array.isArray(context.sites)
      ? context.sites.filter((site): site is string => typeof site === 'string')
      : [],
    defaultFocusMinutes:
      typeof context.defaultFocusMinutes === 'number' ? context.defaultFocusMinutes : 25,
    defaultBreakMinutes:
      typeof context.defaultBreakMinutes === 'number' ? context.defaultBreakMinutes : 5,
    autoRepeat: context.autoRepeat === true,
    // Default on for legacy contexts — keep breaks distraction-free.
    blockDuringBreak: context.blockDuringBreak !== false,
    longBreaksEnabled: context.longBreaksEnabled === true,
    longBreakAfterSessions:
      typeof context.longBreakAfterSessions === 'number' && context.longBreakAfterSessions >= 1
        ? Math.floor(context.longBreakAfterSessions)
        : 4,
    longBreakMinutes:
      typeof context.longBreakMinutes === 'number' ? context.longBreakMinutes : 15,
    dailyGoalMinutes:
      typeof context.dailyGoalMinutes === 'number' &&
      isValidDailyGoalMinutes(Math.floor(context.dailyGoalMinutes))
        ? Math.floor(context.dailyGoalMinutes)
        : DEFAULT_DAILY_GOAL_MINUTES,
    createdAt: typeof context.createdAt === 'number' ? context.createdAt : now,
    updatedAt: typeof context.updatedAt === 'number' ? context.updatedAt : now,
  };
}

type LegacyTask = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  focusedMs?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function patchTask(task: LegacyTask, now: number): Task | null {
  if (typeof task.id !== 'string' || typeof task.title !== 'string') {
    return null;
  }
  const title = task.title.trim();
  if (!title) {
    return null;
  }
  const status: TaskStatus = isTaskStatus(task.status) ? task.status : 'todo';
  return {
    id: task.id,
    title,
    status,
    focusedMs:
      typeof task.focusedMs === 'number' && task.focusedMs >= 0
        ? Math.floor(task.focusedMs)
        : 0,
    createdAt: typeof task.createdAt === 'number' ? task.createdAt : now,
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : now,
  };
}

function patchTasks(raw: unknown, now: number): Task[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const tasks = raw
    .map((task) => patchTask(task as LegacyTask, now))
    .filter((task): task is Task => task != null);

  // Ensure at most one active task survives migration.
  let seenActive = false;
  return tasks.map((task) => {
    if (task.status !== 'active') {
      return task;
    }
    if (seenActive) {
      return { ...task, status: 'todo' };
    }
    seenActive = true;
    return task;
  });
}

function patchSiteCounts(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [site, count] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof count === 'number' && count > 0 && site.trim()) {
      result[site] = Math.floor(count);
    }
  }
  return result;
}

function patchRunTaskFocus(raw: unknown): SessionRunStats['tasks'] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const tasks: SessionRunStats['tasks'] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') {
      continue;
    }
    const entry = item as Partial<{ taskId: unknown; taskTitle: unknown; focusMs: unknown }>;
    if (
      typeof entry.taskId !== 'string' ||
      typeof entry.taskTitle !== 'string' ||
      typeof entry.focusMs !== 'number' ||
      entry.focusMs <= 0
    ) {
      continue;
    }
    tasks.push({
      taskId: entry.taskId,
      taskTitle: entry.taskTitle.trim() || 'Task',
      focusMs: Math.floor(entry.focusMs),
    });
  }
  return tasks;
}

function patchRunStats(
  run: Partial<SessionRunStats> | undefined,
  startedAt: number,
): SessionRunStats {
  return {
    focusCount: typeof run?.focusCount === 'number' ? run.focusCount : 0,
    breakCount: typeof run?.breakCount === 'number' ? run.breakCount : 0,
    focusMs: typeof run?.focusMs === 'number' ? run.focusMs : 0,
    breakMs: typeof run?.breakMs === 'number' ? run.breakMs : 0,
    distractionOverrides:
      typeof run?.distractionOverrides === 'number' ? run.distractionOverrides : 0,
    pauseCount: typeof run?.pauseCount === 'number' ? run.pauseCount : 0,
    distractionBySite: patchSiteCounts(run?.distractionBySite),
    tasks: patchRunTaskFocus(run?.tasks),
    startedAt: typeof run?.startedAt === 'number' ? run.startedAt : startedAt,
  };
}

function patchActiveSession(
  session: (Partial<ActiveSession> & {
    id: string;
    contextId: string;
    contextName: string;
    plannedMs: number;
    startedAt: number;
    status: ActiveSession['status'];
  }) | null | undefined,
  settings: Settings,
): ActiveSession | null {
  if (!session) {
    return null;
  }
  const focusMinutes = session.focusMinutes ?? settings.lastDurationMinutes;
  return {
    id: session.id,
    contextId: session.contextId,
    contextName: session.contextName,
    phase: session.phase ?? 'focus',
    focusMinutes,
    breakMinutes: session.breakMinutes ?? settings.lastBreakMinutes,
    longBreaksEnabled: session.longBreaksEnabled === true,
    longBreakAfterSessions:
      typeof session.longBreakAfterSessions === 'number' && session.longBreakAfterSessions >= 1
        ? Math.floor(session.longBreakAfterSessions)
        : 4,
    longBreakMinutes:
      typeof session.longBreakMinutes === 'number' ? session.longBreakMinutes : 15,
    isLongBreak: session.isLongBreak === true,
    repeat: session.repeat ?? settings.lastRepeat,
    plannedMs: session.plannedMs,
    startedAt: session.startedAt,
    status: session.status,
    endsAt: session.endsAt ?? null,
    remainingMs: session.remainingMs ?? null,
    distractionOverrides: session.distractionOverrides ?? 0,
    distractionBySite: patchSiteCounts(session.distractionBySite),
    pauseCount: typeof session.pauseCount === 'number' ? session.pauseCount : 0,
    run: patchRunStats(session.run, session.startedAt),
    taskFocus: patchTaskFocus(session.taskFocus),
  };
}

function patchTaskFocus(
  raw: ActiveSession['taskFocus'] | Partial<{ taskId: unknown; startedAt: unknown }> | null | undefined,
): ActiveSession['taskFocus'] {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  if (typeof raw.taskId !== 'string' || typeof raw.startedAt !== 'number') {
    return null;
  }
  return { taskId: raw.taskId, startedAt: raw.startedAt };
}

function patchSessionRecord(raw: unknown): SessionRecord | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Partial<SessionRecord>;
  if (
    typeof record.id !== 'string' ||
    typeof record.contextId !== 'string' ||
    typeof record.contextName !== 'string' ||
    typeof record.plannedMs !== 'number' ||
    typeof record.focusedMs !== 'number' ||
    typeof record.startedAt !== 'number' ||
    typeof record.endedAt !== 'number' ||
    (record.outcome !== 'completed' && record.outcome !== 'ended_early')
  ) {
    return null;
  }
  return {
    id: record.id,
    contextId: record.contextId,
    contextName: record.contextName,
    plannedMs: record.plannedMs,
    focusedMs: record.focusedMs,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    outcome: record.outcome,
    distractionOverrides:
      typeof record.distractionOverrides === 'number' ? record.distractionOverrides : 0,
    pauseCount: typeof record.pauseCount === 'number' ? record.pauseCount : 0,
    breakCount: typeof record.breakCount === 'number' ? record.breakCount : 0,
    breakMs: typeof record.breakMs === 'number' ? record.breakMs : 0,
    distractionBySite: patchSiteCounts(record.distractionBySite),
    taskId: typeof record.taskId === 'string' ? record.taskId : null,
    taskTitle: typeof record.taskTitle === 'string' ? record.taskTitle : null,
  };
}

function patchHistory(raw: unknown): SessionRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => patchSessionRecord(item))
    .filter((item): item is SessionRecord => item != null);
}

function patchSessionSummary(raw: unknown): SessionSummary | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }
  const summary = raw as Partial<SessionSummary>;
  if (
    typeof summary.contextId !== 'string' ||
    typeof summary.contextName !== 'string' ||
    typeof summary.startedAt !== 'number' ||
    typeof summary.endedAt !== 'number'
  ) {
    return null;
  }
  return {
    contextId: summary.contextId,
    contextName: summary.contextName,
    focusCount: typeof summary.focusCount === 'number' ? summary.focusCount : 0,
    breakCount: typeof summary.breakCount === 'number' ? summary.breakCount : 0,
    focusMs: typeof summary.focusMs === 'number' ? summary.focusMs : 0,
    breakMs: typeof summary.breakMs === 'number' ? summary.breakMs : 0,
    distractionOverrides:
      typeof summary.distractionOverrides === 'number' ? summary.distractionOverrides : 0,
    pauseCount: typeof summary.pauseCount === 'number' ? summary.pauseCount : 0,
    tasks: patchRunTaskFocus(summary.tasks),
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
  };
}

export function migrate(raw: unknown, now: number): AppState {
  if (raw == null || typeof raw !== 'object') {
    return createInitialState(now);
  }

  const candidate = raw as Partial<AppState> & { lastCompletion?: unknown };
  const settings = patchSettings(candidate.settings);
  const contexts = Array.isArray(candidate.contexts)
    ? candidate.contexts
        .map((context) => patchContext(context as LegacyContext, now))
        .filter((context): context is Context => context != null)
    : [];

  return {
    contexts,
    tasks: patchTasks(candidate.tasks, now),
    settings,
    activeSession: patchActiveSession(
      candidate.activeSession as Parameters<typeof patchActiveSession>[0],
      settings,
    ),
    lastSessionSummary: patchSessionSummary(candidate.lastSessionSummary),
    history: patchHistory(candidate.history),
  };
}
