import { describe, expect, it } from 'vitest';
import { createInitialState } from './seed';
import {
  completeSession,
  endSession,
  startBreakSession,
  startSession,
} from './session';
import { phaseEndNotification } from './phaseNotifications';
import type { AppState } from './types';

const START = 1_700_000_000_000;

function withStrict(state: AppState): AppState {
  const contextId = state.contexts[0]!.id;
  return {
    ...state,
    contexts: state.contexts.map((item) =>
      item.id === contextId
        ? { ...item, strictLockControls: true }
        : item,
    ),
  };
}

function start(
  state: AppState,
  opts: { focus: number; breakMin: number; repeat: boolean },
): AppState {
  const result = startSession(
    state,
    state.contexts[0]!.id,
    opts.focus,
    opts.breakMin,
    opts.repeat,
    START,
    'production',
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('phaseEndNotification', () => {
  it('focus → awaiting with break: focus-choice-break', () => {
    let state = start(createInitialState(START), {
      focus: 25,
      breakMin: 5,
      repeat: false,
    });
    const completed = completeSession(state, START + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error);
    const note = phaseEndNotification('focus', completed.value);
    expect(note).toEqual({
      title: 'Are you in flow?',
      body: 'Extend the session, or start your break.',
      categoryId: 'focus-choice-break',
    });
  });

  it('focus → awaiting without break: focus-choice-end', () => {
    let state = start(createInitialState(START), {
      focus: 25,
      breakMin: 0,
      repeat: false,
    });
    const completed = completeSession(state, START + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error);
    const note = phaseEndNotification('focus', completed.value);
    expect(note?.categoryId).toBe('focus-choice-end');
  });

  it('break → awaiting: break-choice', () => {
    const state = start(createInitialState(START), {
      focus: 25,
      breakMin: 5,
      repeat: false,
    });
    const focusDone = completeSession(state, START + 25 * 60_000);
    expect(focusDone.ok).toBe(true);
    if (!focusDone.ok) throw new Error(focusDone.error);
    const onBreak = startBreakSession(focusDone.value, START + 25 * 60_000);
    expect(onBreak.ok).toBe(true);
    if (!onBreak.ok) throw new Error(onBreak.error);
    const breakDone = completeSession(onBreak.value, START + 30 * 60_000);
    expect(breakDone.ok).toBe(true);
    if (!breakDone.ok) throw new Error(breakDone.error);
    const note = phaseEndNotification('break', breakDone.value);
    expect(note).toEqual({
      title: 'Break finished',
      body: 'Start another focus session, or end and see your recap.',
      categoryId: 'break-choice',
    });
  });

  it('focus → break (auto-repeat): focus complete, no category', () => {
    const state = start(createInitialState(START), {
      focus: 25,
      breakMin: 5,
      repeat: true,
    });
    const completed = completeSession(state, START + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error);
    const note = phaseEndNotification('focus', completed.value);
    expect(note?.title).toBe('Focus complete');
    expect(note?.categoryId).toBeNull();
    expect(note?.body).toContain('min');
  });

  it('focus → break with strict lock: strict-escape', () => {
    const state = start(withStrict(createInitialState(START)), {
      focus: 25,
      breakMin: 5,
      repeat: true,
    });
    expect(state.activeSession?.strictLockControls).toBe(true);
    const completed = completeSession(state, START + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error);
    const note = phaseEndNotification('focus', completed.value);
    expect(note?.categoryId).toBe('strict-escape');
  });

  it('break → focus with strict lock: strict-escape', () => {
    let state = start(withStrict(createInitialState(START)), {
      focus: 25,
      breakMin: 5,
      repeat: true,
    });
    const afterFocus = completeSession(state, START + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) throw new Error(afterFocus.error);
    const afterBreak = completeSession(
      afterFocus.value,
      START + 30 * 60_000,
    );
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) throw new Error(afterBreak.error);
    expect(afterBreak.value.activeSession?.phase).toBe('focus');
    const note = phaseEndNotification('break', afterBreak.value);
    expect(note).toEqual({
      title: 'Break finished',
      body: 'Next focus started. End the session if you need out.',
      categoryId: 'strict-escape',
    });
  });

  it('break → focus without strict: null', () => {
    let state = start(createInitialState(START), {
      focus: 25,
      breakMin: 5,
      repeat: true,
    });
    const afterFocus = completeSession(state, START + 25 * 60_000);
    expect(afterFocus.ok).toBe(true);
    if (!afterFocus.ok) throw new Error(afterFocus.error);
    const afterBreak = completeSession(
      afterFocus.value,
      START + 30 * 60_000,
    );
    expect(afterBreak.ok).toBe(true);
    if (!afterBreak.ok) throw new Error(afterBreak.error);
    expect(phaseEndNotification('break', afterBreak.value)).toBeNull();
  });

  it('session finished: cycle finished', () => {
    let state = start(createInitialState(START), {
      focus: 25,
      breakMin: 5,
      repeat: false,
    });
    const completed = completeSession(state, START + 25 * 60_000);
    expect(completed.ok).toBe(true);
    if (!completed.ok) throw new Error(completed.error);
    const ended = endSession(completed.value, START + 25 * 60_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) throw new Error(ended.error);
    const note = phaseEndNotification('focus', ended.value);
    expect(note).toEqual({
      title: 'Session finished',
      body: 'Your focus cycle has ended. Nice work.',
      categoryId: null,
    });
  });
});
