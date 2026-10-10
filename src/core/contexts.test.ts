import { describe, expect, it } from 'vitest';
import {
  addSite,
  createContext,
  deleteContext,
  removeSite,
  renameContext,
  selectContext,
  updateContextDefaults,
} from './contexts';
import { createInitialState } from './seed';
import { startSession } from './session';

const NOW = 1_700_000_000_000;

describe('contexts', () => {
  it('creates, renames, selects, and rejects duplicate names', () => {
    let state = createInitialState(NOW);

    const created = createContext(state, ' Writing ', NOW);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    state = created.value;
    const writing = state.contexts.find((context) => context.name === 'Writing');
    expect(writing).toMatchObject({
      name: 'Writing',
      defaultFocusMinutes: 25,
      defaultBreakMinutes: 5,
      autoRepeat: true,
      blockDuringBreak: true,
      longBreaksEnabled: false,
      longBreakAfterSessions: 4,
      longBreakMinutes: 15,
      dailyGoalMinutes: 240,
      sites: [],
    });

    const duplicate = createContext(state, 'development', NOW);
    expect(duplicate).toEqual({
      ok: false,
      error: 'A context with that name already exists',
    });

    expect(writing).toBeDefined();
    if (!writing) return;

    const renamed = renameContext(state, writing.id, 'Deep Work', NOW + 1);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    state = renamed.value;

    const renameSelf = renameContext(state, writing.id, 'Deep Work', NOW + 2);
    expect(renameSelf.ok).toBe(true);

    const selected = selectContext(state, writing.id);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    expect(selected.value.settings.selectedContextId).toBe(writing.id);
  });

  it('updates per-context defaults including long breaks', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const updated = updateContextDefaults(
      state,
      contextId,
      {
        focusMinutes: 40,
        breakMinutes: 10,
        autoRepeat: true,
        blockDuringBreak: false,
        longBreaksEnabled: true,
        longBreakAfterSessions: 3,
        longBreakMinutes: 20,
        dailyGoalMinutes: 90,
      },
      NOW + 1,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    state = updated.value;
    expect(state.contexts[0]).toMatchObject({
      defaultFocusMinutes: 40,
      defaultBreakMinutes: 10,
      autoRepeat: true,
      blockDuringBreak: false,
      longBreaksEnabled: true,
      longBreakAfterSessions: 3,
      longBreakMinutes: 20,
      dailyGoalMinutes: 90,
      updatedAt: NOW + 1,
    });

    expect(
      updateContextDefaults(
        state,
        contextId,
        {
          focusMinutes: 0,
          breakMinutes: 5,
          autoRepeat: false,
          blockDuringBreak: true,
          longBreaksEnabled: false,
          longBreakAfterSessions: 4,
          longBreakMinutes: 15,
          dailyGoalMinutes: 240,
        },
        NOW,
        'production',
      ).ok,
    ).toBe(false);
    expect(
      updateContextDefaults(
        state,
        contextId,
        {
          focusMinutes: 25,
          breakMinutes: 5,
          autoRepeat: true,
          blockDuringBreak: true,
          longBreaksEnabled: true,
          longBreakAfterSessions: 0,
          longBreakMinutes: 15,
          dailyGoalMinutes: 240,
        },
        NOW,
        'production',
      ).ok,
    ).toBe(false);
    expect(
      updateContextDefaults(
        state,
        contextId,
        {
          focusMinutes: 25,
          breakMinutes: 5,
          autoRepeat: true,
          blockDuringBreak: true,
          longBreaksEnabled: false,
          longBreakAfterSessions: 4,
          longBreakMinutes: 15,
          dailyGoalMinutes: 45,
        },
        NOW,
        'production',
      ).ok,
    ).toBe(false);
    expect(
      updateContextDefaults(
        state,
        contextId,
        {
          focusMinutes: 0.1,
          breakMinutes: 0.2,
          autoRepeat: false,
          blockDuringBreak: true,
          longBreaksEnabled: false,
          longBreakAfterSessions: 4,
          longBreakMinutes: 15,
          dailyGoalMinutes: 0,
        },
        NOW,
        'development',
      ).ok,
    ).toBe(true);
  });

  it('adds and removes normalized sites with dedupe', () => {
    let state = createInitialState(NOW);
    const contextId = state.contexts[0]!.id;

    const added = addSite(state, contextId, 'https://www.Example.com/path', NOW);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    state = added.value;
    expect(state.contexts[0]!.sites).toContain('example.com');

    const duplicate = addSite(state, contextId, 'example.com', NOW);
    expect(duplicate.ok).toBe(false);

    const removed = removeSite(state, contextId, 'example.com', NOW);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.contexts[0]!.sites).not.toContain('example.com');
  });

  it('refuses deleting the active session context and reselects after delete', () => {
    let state = createInitialState(NOW);
    const developmentId = state.contexts[0]!.id;
    const researchId = state.contexts[1]!.id;

    const started = startSession(state, developmentId, 25, 5, false, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.value;

    expect(deleteContext(state, developmentId)).toEqual({
      ok: false,
      error: 'End the session first.',
    });

    state = { ...state, activeSession: null };
    const deletedSelected = deleteContext(
      {
        ...state,
        settings: { ...state.settings, selectedContextId: researchId },
      },
      researchId,
    );
    expect(deletedSelected.ok).toBe(true);
    if (!deletedSelected.ok) return;
    expect(deletedSelected.value.settings.selectedContextId).toBe(developmentId);
    expect(deletedSelected.value.contexts).toHaveLength(1);
  });

  it('rejects empty and too-long names', () => {
    const state = createInitialState(NOW);
    expect(createContext(state, '   ', NOW).ok).toBe(false);
    expect(createContext(state, 'x'.repeat(41), NOW).ok).toBe(false);
  });
});
