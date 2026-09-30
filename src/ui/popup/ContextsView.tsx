import { useState } from 'react';
import {
  addSite,
  createContext,
  deleteContext,
  removeSite,
  renameContext,
} from '@core/contexts';
import type { AppState, Context } from '@core/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { getAppRepository } from '../services/repository';

export function ContextsView({ state }: { state: AppState }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const editing = state.contexts.find((context) => context.id === editingId) ?? null;

  async function applyUpdate(
    fn: (current: AppState) => { ok: true; value: AppState } | { ok: false; error: string },
  ) {
    let message = '';
    await getAppRepository().update((current) => {
      const result = fn(current);
      if (!result.ok) {
        message = result.error;
        return current;
      }
      return result.value;
    });
    if (message) {
      setError(message);
      return false;
    }
    setError(null);
    return true;
  }

  if (editing) {
    return (
      <ContextDetail
        state={state}
        context={editing}
        error={error}
        pendingDelete={pendingDeleteId === editing.id}
        onBack={() => {
          setEditingId(null);
          setPendingDeleteId(null);
          setError(null);
        }}
        onError={setError}
        onRequestDelete={() => setPendingDeleteId(editing.id)}
        onCancelDelete={() => setPendingDeleteId(null)}
        onConfirmDelete={async () => {
          const ok = await applyUpdate((current) => deleteContext(current, editing.id));
          if (ok) {
            setEditingId(null);
            setPendingDeleteId(null);
          }
        }}
        onRename={async (name) => {
          await applyUpdate((current) => renameContext(current, editing.id, name, Date.now()));
        }}
        onAddSite={async (raw) => {
          await applyUpdate((current) => addSite(current, editing.id, raw, Date.now()));
        }}
        onRemoveSite={async (site) => {
          await applyUpdate((current) => removeSite(current, editing.id, site, Date.now()));
        }}
      />
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="heading">Contexts</h1>
        <Button
          variant="primary"
          onClick={() => {
            setCreating(true);
            setNewName('');
            setError(null);
          }}
        >
          New Context
        </Button>
      </div>

      {creating ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const ok = await applyUpdate((current) =>
                createContext(current, newName, Date.now()),
              );
              if (ok) {
                setCreating(false);
                setNewName('');
              }
            })();
          }}
        >
          <label className="field">
            <span className="muted">Name</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={40}
              autoFocus
            />
          </label>
          <div className="row">
            <Button type="submit" variant="primary">
              Create
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {state.contexts.length === 0 ? (
        <EmptyState
          title="No contexts yet"
          description="Create one to start blocking sites during focus."
        />
      ) : (
        <ul className="list">
          {state.contexts.map((context) => (
            <li key={context.id} className="list-item">
              <div>
                <div className="heading" style={{ fontSize: '1rem' }}>
                  {context.name}
                </div>
                <div className="muted">
                  {context.sites.length} {context.sites.length === 1 ? 'site' : 'sites'}
                </div>
              </div>
              <Button variant="secondary" onClick={() => setEditingId(context.id)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

function ContextDetail({
  state,
  context,
  error,
  pendingDelete,
  onBack,
  onError,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onRename,
  onAddSite,
  onRemoveSite,
}: {
  state: AppState;
  context: Context;
  error: string | null;
  pendingDelete: boolean;
  onBack: () => void;
  onError: (message: string | null) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRename: (name: string) => Promise<void>;
  onAddSite: (raw: string) => Promise<void>;
  onRemoveSite: (site: string) => Promise<void>;
}) {
  const [name, setName] = useState(context.name);
  const [siteInput, setSiteInput] = useState('');
  const isActiveSessionContext = state.activeSession?.contextId === context.id;
  const latest =
    state.contexts.find((item) => item.id === context.id) ?? context;

  return (
    <div className="stack">
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>

      <label className="field">
        <span className="muted">Name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name.trim() !== latest.name) {
              void onRename(name);
            }
          }}
          maxLength={40}
        />
      </label>

      <div className="stack">
        <h2 className="heading" style={{ fontSize: '1rem' }}>
          Sites
        </h2>
        <ul className="list">
          {latest.sites.map((site) => (
            <li key={site} className="list-item">
              <span>{site}</span>
              <Button variant="ghost" onClick={() => void onRemoveSite(site)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              await onAddSite(siteInput);
              setSiteInput('');
            })();
          }}
        >
          <label className="field" style={{ flex: 1 }}>
            <span className="muted">Add site</span>
            <input
              value={siteInput}
              onChange={(event) => {
                setSiteInput(event.target.value);
                onError(null);
              }}
              placeholder="reddit.com"
            />
          </label>
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </div>

      {pendingDelete ? (
        <div className="stack">
          <p className="muted">
            Delete {latest.name}? Its sites list will be removed.
          </p>
          <div className="row">
            <Button variant="primary" onClick={onConfirmDelete}>
              Delete
            </Button>
            <Button variant="ghost" onClick={onCancelDelete}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          disabled={isActiveSessionContext}
          onClick={onRequestDelete}
          title={isActiveSessionContext ? 'End the session first.' : undefined}
        >
          Delete context
        </Button>
      )}

      {isActiveSessionContext ? (
        <p className="muted">End the session first.</p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
