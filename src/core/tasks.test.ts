import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import { pauseSession, startSession } from './session';
import {
  createTask,
  deleteTask,
  renameTask,
  setTaskStatus,
  sortTasksForDisplay,
} from './tasks';

const NOW = 1_700_000_000_000;

function stateWithTasks() {
  const base = createInitialState(NOW);
  const created = createTask(base, 'Write brief', NOW);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('unreachable');
  const second = createTask(created.value, 'Review PRs', NOW + 1);
  expect(second.ok).toBe(true);
  if (!second.ok) throw new Error('unreachable');
  return second.value;
}

describe('tasks', () => {
  it('creates trimmed todo tasks', () => {
    const state = createInitialState(NOW);
    const created = createTask(state, '  Ship copy  ', NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.tasks).toHaveLength(1);
    expect(created.value.tasks[0]).toMatchObject({
      title: 'Ship copy',
      status: 'todo',
      focusedMs: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('rejects empty or oversized titles', () => {
    const state = createInitialState(NOW);
    expect(createTask(state, '   ', NOW).ok).toBe(false);
    expect(createTask(state, 'x'.repeat(81), NOW).ok).toBe(false);
  });

  it('renames and deletes tasks', () => {
    const state = stateWithTasks();
    const taskId = state.tasks[0]!.id;

    const renamed = renameTask(state, taskId, 'Write project brief', NOW + 5);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.value.tasks[0]!.title).toBe('Write project brief');
    expect(renamed.value.tasks[0]!.updatedAt).toBe(NOW + 5);

    const deleted = deleteTask(renamed.value, taskId);
    expect(deleted.ok).toBe(true);
    if (!deleted.ok) return;
    expect(deleted.value.tasks).toHaveLength(1);
    expect(deleted.value.tasks[0]!.title).toBe('Review PRs');
  });

  it('keeps only one active task', () => {
    const state = stateWithTasks();
    const [first, second] = state.tasks;
    const activateFirst = setTaskStatus(state, first!.id, 'active', NOW + 2);
    expect(activateFirst.ok).toBe(true);
    if (!activateFirst.ok) return;

    const activateSecond = setTaskStatus(
      activateFirst.value,
      second!.id,
      'active',
      NOW + 3,
    );
    expect(activateSecond.ok).toBe(true);
    if (!activateSecond.ok) return;

    expect(activateSecond.value.tasks.find((task) => task.id === first!.id)?.status).toBe(
      'todo',
    );
    expect(activateSecond.value.tasks.find((task) => task.id === second!.id)?.status).toBe(
      'active',
    );
  });

  it('marks tasks finished and sorts for display', () => {
    let state = stateWithTasks();
    const [first, second] = state.tasks;
    const activate = setTaskStatus(state, second!.id, 'active', NOW + 2);
    expect(activate.ok).toBe(true);
    if (!activate.ok) return;
    state = activate.value;

    const finish = setTaskStatus(state, first!.id, 'finished', NOW + 3);
    expect(finish.ok).toBe(true);
    if (!finish.ok) return;

    const sorted = sortTasksForDisplay(finish.value.tasks);
    expect(sorted.map((task) => task.status)).toEqual(['active', 'finished']);
  });

  it('opens a focus segment on Work only while focus is running', () => {
    let state = stateWithTasks();
    const taskId = state.tasks[0]!.id;

    const withoutSession = setTaskStatus(state, taskId, 'active', NOW);
    expect(withoutSession.ok).toBe(true);
    if (!withoutSession.ok) return;
    expect(withoutSession.value.activeSession).toBeNull();
    expect(withoutSession.value.tasks[0]!.status).toBe('active');

    const started = startSession(
      withoutSession.value,
      state.contexts[0]!.id,
      25,
      5,
      false,
      NOW,
    );
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.activeSession?.taskFocus).toEqual({
      taskId,
      startedAt: NOW,
    });

    state = started.value;
    const paused = pauseSession(state, NOW + 10_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.activeSession?.taskFocus).toBeNull();
    expect(paused.value.tasks[0]!.focusedMs).toBe(10_000);

    const otherId = state.tasks[1]!.id;
    const workWhilePaused = setTaskStatus(paused.value, otherId, 'active', NOW + 20_000);
    expect(workWhilePaused.ok).toBe(true);
    if (!workWhilePaused.ok) return;
    expect(workWhilePaused.value.tasks.find((t) => t.id === otherId)?.status).toBe(
      'active',
    );
    expect(workWhilePaused.value.activeSession?.taskFocus).toBeNull();
  });

  it('flushes on Pause/Done and splits time when switching Working tasks', () => {
    let state = stateWithTasks();
    const [first, second] = state.tasks;
    const started = startSession(state, state.contexts[0]!.id, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.value;

    const workFirst = setTaskStatus(state, first!.id, 'active', NOW);
    expect(workFirst.ok).toBe(true);
    if (!workFirst.ok) return;
    state = workFirst.value;

    const switchToSecond = setTaskStatus(state, second!.id, 'active', NOW + 40_000);
    expect(switchToSecond.ok).toBe(true);
    if (!switchToSecond.ok) return;
    state = switchToSecond.value;
    expect(state.tasks.find((t) => t.id === first!.id)?.focusedMs).toBe(40_000);
    expect(state.activeSession?.taskFocus).toEqual({
      taskId: second!.id,
      startedAt: NOW + 40_000,
    });

    const pause = setTaskStatus(state, second!.id, 'todo', NOW + 55_000);
    expect(pause.ok).toBe(true);
    if (!pause.ok) return;
    expect(pause.value.tasks.find((t) => t.id === second!.id)?.focusedMs).toBe(15_000);
    expect(pause.value.activeSession?.taskFocus).toBeNull();

    const workAgain = setTaskStatus(pause.value, second!.id, 'active', NOW + 60_000);
    expect(workAgain.ok).toBe(true);
    if (!workAgain.ok) return;

    const done = setTaskStatus(workAgain.value, second!.id, 'finished', NOW + 75_000);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.tasks.find((t) => t.id === second!.id)?.focusedMs).toBe(30_000);
    expect(done.value.activeSession?.taskFocus).toBeNull();
  });
});
