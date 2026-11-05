import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import { startSession } from './session';
import {
  flushTaskFocus,
  getDisplayedTaskFocusMs,
  isTaskFocusAccruing,
  openTaskFocus,
} from './taskFocus';
import { createTask, setTaskStatus } from './tasks';

const NOW = 1_700_000_000_000;

function runningFocusWithTask() {
  let state = createInitialState(NOW);
  const created = createTask(state, 'Draft outline', NOW);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error('unreachable');
  state = created.value;

  const started = startSession(state, state.contexts[0]!.id, 25, 5, false, NOW);
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error('unreachable');
  state = started.value;

  const activated = setTaskStatus(state, state.tasks[0]!.id, 'active', NOW);
  expect(activated.ok).toBe(true);
  if (!activated.ok) throw new Error('unreachable');
  return activated.value;
}

describe('taskFocus', () => {
  it('detects accruing only for running focus', () => {
    const state = runningFocusWithTask();
    expect(isTaskFocusAccruing(state.activeSession)).toBe(true);
    expect(
      isTaskFocusAccruing({
        ...state.activeSession!,
        status: 'paused',
      }),
    ).toBe(false);
    expect(
      isTaskFocusAccruing({
        ...state.activeSession!,
        phase: 'break',
      }),
    ).toBe(false);
    expect(isTaskFocusAccruing(null)).toBe(false);
  });

  it('flushes open segment into focusedMs and clears taskFocus', () => {
    const state = runningFocusWithTask();
    const taskId = state.tasks[0]!.id;
    expect(state.activeSession?.taskFocus).toEqual({ taskId, startedAt: NOW });

    const flushed = flushTaskFocus(state, NOW + 90_000);
    expect(flushed.activeSession?.taskFocus).toBeNull();
    expect(flushed.tasks[0]!.focusedMs).toBe(90_000);
  });

  it('does not accrue when segment is null', () => {
    const state = createInitialState(NOW);
    const started = startSession(state, state.contexts[0]!.id, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    const flushed = flushTaskFocus(started.value, NOW + 60_000);
    expect(flushed).toEqual(started.value);
  });

  it('openTaskFocus is a no-op for the same task and when not accruing', () => {
    const state = runningFocusWithTask();
    const taskId = state.tasks[0]!.id;
    expect(openTaskFocus(state, taskId, NOW + 1)).toEqual(state);

    const paused = {
      ...state,
      activeSession: {
        ...state.activeSession!,
        status: 'paused' as const,
        taskFocus: null,
      },
    };
    expect(openTaskFocus(paused, taskId, NOW + 2)).toEqual(paused);
  });

  it('display helper adds open segment elapsed to committed time', () => {
    const state = runningFocusWithTask();
    const task = state.tasks[0]!;
    const withCommitted = {
      ...state,
      tasks: [{ ...task, focusedMs: 30_000 }],
    };
    expect(
      getDisplayedTaskFocusMs(withCommitted.tasks[0]!, withCommitted.activeSession, NOW + 20_000),
    ).toBe(50_000);
    expect(getDisplayedTaskFocusMs(task, null, NOW + 20_000)).toBe(0);
  });
});
