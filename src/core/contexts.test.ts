import { describe, expect, it } from 'vitest';
import {
  addSite,
  createContext,
  deleteContext,
  removeSite,
  renameContext,
  selectContext,
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
    expect(state.contexts.some((context) => context.name === 'Writing')).toBe(true);

    const duplicate = createContext(state, 'development', NOW);
    expect(duplicate).toEqual({
      ok: false,
      error: 'A context with that name already exists',
    });

    const writing = state.contexts.find((context) => context.name === 'Writing');
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

    const started = startSession(state, developmentId, 25, NOW);
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
