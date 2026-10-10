import { createId } from './ids';
import { syncTaskFocusAfterStatusChange } from './taskFocus';
import { err, ok, type AppState, type Result, type Task, type TaskStatus } from './types';

const MAX_TITLE_LENGTH = 80;

const TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['todo', 'active', 'finished']);

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && TASK_STATUSES.has(value as TaskStatus);
}

function validateTitle(raw: string): Result<string> {
  const title = raw.trim();
  if (!title) {
    return err('Task title cannot be empty');
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return err(`Task title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  }
  return ok(title);
}

function replaceTask(state: AppState, updated: Task): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === updated.id ? updated : task)),
  };
}

export function createTask(state: AppState, title: string, now: number): Result<AppState> {
  const titleResult = validateTitle(title);
  if (!titleResult.ok) {
    return titleResult;
  }

  const task: Task = {
    id: createId(),
    title: titleResult.value,
    status: 'todo',
    focusedMs: 0,
    createdAt: now,
    updatedAt: now,
  };

  return ok({
    ...state,
    tasks: [...state.tasks, task],
  });
}

export function renameTask(
  state: AppState,
  taskId: string,
  title: string,
  now: number,
): Result<AppState> {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return err('Task not found');
  }

  const titleResult = validateTitle(title);
  if (!titleResult.ok) {
    return titleResult;
  }

  if (task.title === titleResult.value) {
    return ok(state);
  }

  return ok(
    replaceTask(state, {
      ...task,
      title: titleResult.value,
      updatedAt: now,
    }),
  );
}

export function setTaskStatus(
  state: AppState,
  taskId: string,
  status: TaskStatus,
  now: number,
): Result<AppState> {
  if (!isTaskStatus(status)) {
    return err('Invalid task status');
  }

  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    return err('Task not found');
  }

  if (task.status === status) {
    return ok(state);
  }

  if (status === 'active') {
    const tasks = state.tasks.map((item) => {
      if (item.id === taskId) {
        return { ...item, status: 'active' as const, updatedAt: now };
      }
      if (item.status === 'active') {
        return { ...item, status: 'todo' as const, updatedAt: now };
      }
      return item;
    });
    return ok(syncTaskFocusAfterStatusChange({ ...state, tasks }, now));
  }

  const next = replaceTask(state, {
    ...task,
    status,
    updatedAt: now,
  });
  return ok(syncTaskFocusAfterStatusChange(next, now));
}

export function deleteTask(state: AppState, taskId: string): Result<AppState> {
  if (!state.tasks.some((task) => task.id === taskId)) {
    return err('Task not found');
  }

  const session = state.activeSession;
  const clearFocus =
    session?.taskFocus?.taskId === taskId
      ? { ...session, taskFocus: null }
      : session;

  return ok({
    ...state,
    tasks: state.tasks.filter((task) => task.id !== taskId),
    activeSession: clearFocus,
  });
}

export function sortTasksForDisplay(tasks: Task[]): Task[] {
  const rank: Record<TaskStatus, number> = {
    active: 0,
    todo: 1,
    finished: 2,
  };
  return [...tasks].sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status];
    if (byStatus !== 0) {
      return byStatus;
    }
    return b.updatedAt - a.updatedAt;
  });
}
