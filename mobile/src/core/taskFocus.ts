import type { ActiveSession, AppState, SessionRunTaskFocus, Task } from './types';

export function isTaskFocusAccruing(session: ActiveSession | null | undefined): boolean {
  return session != null && session.phase === 'focus' && session.status === 'running';
}

export function findActiveTask(state: AppState): Task | null {
  return state.tasks.find((task) => task.status === 'active') ?? null;
}

function addRunTaskFocus(
  runTasks: SessionRunTaskFocus[],
  taskId: string,
  taskTitle: string,
  elapsed: number,
): SessionRunTaskFocus[] {
  if (elapsed <= 0) {
    return runTasks;
  }
  const index = runTasks.findIndex((item) => item.taskId === taskId);
  if (index < 0) {
    return [...runTasks, { taskId, taskTitle, focusMs: elapsed }];
  }
  const existing = runTasks[index]!;
  const next = [...runTasks];
  next[index] = {
    taskId,
    taskTitle: taskTitle || existing.taskTitle,
    focusMs: existing.focusMs + elapsed,
  };
  return next;
}

/** Commit open segment into Task.focusedMs / run stats and clear taskFocus. */
export function flushTaskFocus(state: AppState, now: number): AppState {
  const session = state.activeSession;
  const segment = session?.taskFocus;
  if (!session || !segment) {
    return state;
  }

  const elapsed = Math.max(0, now - segment.startedAt);
  const task = state.tasks.find((item) => item.id === segment.taskId);
  const taskTitle = task?.title?.trim() || 'Task';

  return {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === segment.taskId
        ? { ...item, focusedMs: item.focusedMs + elapsed }
        : item,
    ),
    activeSession: {
      ...session,
      taskFocus: null,
      run: {
        ...session.run,
        tasks: addRunTaskFocus(session.run.tasks, segment.taskId, taskTitle, elapsed),
      },
    },
  };
}

/** Open a segment for taskId when focus is running. No-op if already open for that task. */
export function openTaskFocus(state: AppState, taskId: string, now: number): AppState {
  const session = state.activeSession;
  if (!isTaskFocusAccruing(session) || !session) {
    return state;
  }
  if (session.taskFocus?.taskId === taskId) {
    return state;
  }

  return {
    ...state,
    activeSession: {
      ...session,
      taskFocus: { taskId, startedAt: now },
    },
  };
}

/**
 * After task status mutations: flush if the open segment's task is no longer
 * Working or accrual stopped; open a segment if a Working task exists and focus is running.
 */
export function syncTaskFocusAfterStatusChange(state: AppState, now: number): AppState {
  const session = state.activeSession;
  const segment = session?.taskFocus;
  let next = state;

  if (segment) {
    const owner = next.tasks.find((task) => task.id === segment.taskId);
    const stillActive = owner?.status === 'active';
    if (!stillActive || !isTaskFocusAccruing(session)) {
      next = flushTaskFocus(next, now);
    }
  }

  const active = findActiveTask(next);
  if (active && isTaskFocusAccruing(next.activeSession)) {
    next = openTaskFocus(next, active.id, now);
  }

  return next;
}

export function demoteActiveTasksToTodo(state: AppState, now: number): AppState {
  let changed = false;
  const tasks = state.tasks.map((task) => {
    if (task.status !== 'active') {
      return task;
    }
    changed = true;
    return { ...task, status: 'todo' as const, updatedAt: now };
  });
  return changed ? { ...state, tasks } : state;
}

/** Committed focusedMs plus any open segment for this task. */
export function getDisplayedTaskFocusMs(
  task: Task,
  session: ActiveSession | null | undefined,
  now: number,
): number {
  const committed = Math.max(0, task.focusedMs);
  const segment = session?.taskFocus;
  if (!segment || segment.taskId !== task.id) {
    return committed;
  }
  return committed + Math.max(0, now - segment.startedAt);
}
