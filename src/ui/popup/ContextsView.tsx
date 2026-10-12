import { useEffect, useState } from 'react';
import {
  addSite,
  createContext,
  dailyGoalOptions,
  deleteContext,
  removeSite,
  renameContext,
  updateContextDefaults,
  type ContextDefaultsInput,
} from '@core/contexts';
import { isDevelopmentMode } from '@core/env';
import type { AppState, Context } from '@core/types';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import {
  IconBack,
  IconEdit,
  IconInfo,
  IconPlus,
  IconShield,
} from '../components/icons';
import { getAppRepository } from '../services/repository';

function parseMinutesInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  if (!Number.isFinite(value)) return null;
  return value;
}

function formatDefaultTiming(context: Context): string {
  const focus = context.defaultFocusMinutes;
  const brk = context.defaultBreakMinutes;
  return `${focus}m / ${brk}m`;
}

export function ContextsView({
  state,
  initialEditingId = null,
  onConsumedInitialEdit,
}: {
  state: AppState;
  initialEditingId?: string | null;
  onConsumedInitialEdit?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialEditingId) return;
    setEditingId(initialEditingId);
    onConsumedInitialEdit?.();
  }, [initialEditingId]); // eslint-disable-line react-hooks/exhaustive-deps -- consume once per deep-link id

  const editing = state.contexts.find((context) => context.id === editingId) ?? null;
  const selected =
    state.contexts.find((context) => context.id === state.settings.selectedContextId) ??
    state.contexts[0] ??
    null;
  const activeSession = state.activeSession;
  const totalSites = selected?.sites.length ?? 0;

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

  async function handleSelectContext(contextId: string) {
    try {
      await getAppRepository().update((current) => {
        if (!current.contexts.some((context) => context.id === contextId)) {
          return current;
        }
        return {
          ...current,
          settings: { ...current.settings, selectedContextId: contextId },
        };
      });
      setError(null);
    } catch (err: unknown) {
      console.error('[focus] selectContext failed', err);
      setError('Could not change context');
    }
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
        onUpdateDefaults={async (defaults) => {
          return applyUpdate((current) =>
            updateContextDefaults(current, editing.id, defaults, Date.now()),
          );
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
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <div className="screen-title">
            <span className="screen-title-text">
              {selected?.name ?? 'Contexts'}
            </span>
            {activeSession && selected && activeSession.contextId === selected.id ? (
              <span className="badge badge-active">Active</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="switch-btn"
          onClick={() => {
            setCreating(true);
            setNewName('');
            setError(null);
          }}
        >
          <IconPlus style={{ width: 12, height: 12 }} />
          New
        </button>
      </header>

      <div className="screen-banner" style={{ background: '#fcfaf7', borderColor: '#f4eee6' }}>
        <span style={{ color: '#64748b' }}>Distractions blocked</span>
        <span style={{ fontWeight: 600, color: '#92400e' }}>
          {totalSites} {totalSites === 1 ? 'site' : 'sites'}
        </span>
      </div>

      <div className="screen-body-scroll">
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
          state.contexts.map((context) => {
            const isSelected = context.id === selected?.id;
            const isSessionActive = activeSession?.contextId === context.id;
            return (
              <div
                key={context.id}
                className={`context-card${isSelected ? ' context-card-active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => void handleSelectContext(context.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void handleSelectContext(context.id);
                  }
                }}
              >
                <div className="context-card-top">
                  <div className="context-card-identity">
                    <span className="context-dot" aria-hidden="true" />
                    <div>
                      <h3 className="context-name">
                        {context.name}
                        {isSessionActive ? (
                          <span className="badge badge-active">Active</span>
                        ) : null}
                      </h3>
                    </div>
                  </div>
                  {isSelected ? (
                    <button
                      type="button"
                      className="edit-icon-btn"
                      aria-label={`Edit ${context.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingId(context.id);
                      }}
                    >
                      <IconEdit />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mini-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSelectContext(context.id);
                      }}
                    >
                      Switch
                    </button>
                  )}
                </div>
                <div className="context-card-footer">
                  <div className="row" style={{ gap: 8 }}>
                    <span className="context-card-sites">
                      <IconShield className="context-card-logo" />
                      <strong>{context.sites.length}</strong> blocked{' '}
                      {context.sites.length === 1 ? 'site' : 'sites'}
                    </span>
                    <span>
                      ⏱️ <strong>{formatDefaultTiming(context)}</strong> default
                    </span>
                  </div>
                  <span
                    className={
                      isSessionActive || isSelected
                        ? 'context-status'
                        : 'context-status-idle'
                    }
                  >
                    {isSessionActive ? 'Guarded' : isSelected ? 'Selected' : 'Idle'}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {selected ? (
          <div className="context-notice">
            <div className="context-notice-icon" aria-hidden="true">
              <IconInfo style={{ width: 14, height: 14 }} />
            </div>
            <p>
              Each context shields custom domains. Sites listed in{' '}
              <strong>{selected.name}</strong> are blocked automatically during a session.
            </p>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </>
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
  onUpdateDefaults,
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
  onUpdateDefaults: (defaults: ContextDefaultsInput) => Promise<boolean>;
  onAddSite: (raw: string) => Promise<void>;
  onRemoveSite: (site: string) => Promise<void>;
}) {
  const latest = state.contexts.find((item) => item.id === context.id) ?? context;
  const [name, setName] = useState(latest.name);
  const [focusMinutes, setFocusMinutes] = useState(String(latest.defaultFocusMinutes));
  const [breakMinutes, setBreakMinutes] = useState(String(latest.defaultBreakMinutes));
  const [autoRepeat, setAutoRepeat] = useState(latest.autoRepeat);
  const [blockDuringBreak, setBlockDuringBreak] = useState(latest.blockDuringBreak);
  const [strictLockControls, setStrictLockControls] = useState(latest.strictLockControls);
  const [strictAllowPeek, setStrictAllowPeek] = useState(latest.strictAllowPeek);
  const [strictAllowPeekOnBreak, setStrictAllowPeekOnBreak] = useState(
    latest.strictAllowPeekOnBreak,
  );
  const [strictEscalatePeek, setStrictEscalatePeek] = useState(latest.strictEscalatePeek);
  const [longBreaksEnabled, setLongBreaksEnabled] = useState(latest.longBreaksEnabled);
  const [longBreakAfterSessions, setLongBreakAfterSessions] = useState(
    String(latest.longBreakAfterSessions),
  );
  const [longBreakMinutes, setLongBreakMinutes] = useState(String(latest.longBreakMinutes));
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(latest.dailyGoalMinutes);
  const [siteInput, setSiteInput] = useState('');
  const isActiveSessionContext = state.activeSession?.contextId === context.id;
  const durationStep = isDevelopmentMode() ? 'any' : 0.5;
  const focusMin = isDevelopmentMode() ? 0.0167 : 0.5;
  const breakMin = isDevelopmentMode() ? 0 : 0;
  const isLongBreakError =
    error != null && /long break/i.test(error);
  const goalOptions = dailyGoalOptions();

  function revertDefaultsFields() {
    setFocusMinutes(String(latest.defaultFocusMinutes));
    setBreakMinutes(String(latest.defaultBreakMinutes));
    setAutoRepeat(latest.autoRepeat);
    setBlockDuringBreak(latest.blockDuringBreak);
    setStrictLockControls(latest.strictLockControls);
    setStrictAllowPeek(latest.strictAllowPeek);
    setStrictAllowPeekOnBreak(latest.strictAllowPeekOnBreak);
    setStrictEscalatePeek(latest.strictEscalatePeek);
    setLongBreaksEnabled(latest.longBreaksEnabled);
    setLongBreakAfterSessions(String(latest.longBreakAfterSessions));
    setLongBreakMinutes(String(latest.longBreakMinutes));
    setDailyGoalMinutes(latest.dailyGoalMinutes);
  }

  function buildDefaultsInput(
    nextAutoRepeat = autoRepeat,
    nextBlockDuringBreak = blockDuringBreak,
    nextLongBreaksEnabled = longBreaksEnabled,
    nextDailyGoalMinutes = dailyGoalMinutes,
    nextStrictLock = strictLockControls,
    nextStrictPeek = strictAllowPeek,
    nextStrictPeekOnBreak = strictAllowPeekOnBreak,
    nextStrictEscalate = strictEscalatePeek,
  ): ContextDefaultsInput | null {
    const focusValue = parseMinutesInput(focusMinutes);
    const breakValue = parseMinutesInput(breakMinutes);
    const afterValue = parseMinutesInput(longBreakAfterSessions);
    const longBreakValue = parseMinutesInput(longBreakMinutes);
    if (focusValue == null) {
      onError('Enter a valid focus duration in minutes');
      return null;
    }
    if (breakValue == null) {
      onError('Enter a valid break duration in minutes (0 to skip)');
      return null;
    }
    if (nextLongBreaksEnabled) {
      if (afterValue == null || !Number.isInteger(afterValue)) {
        onError('Enter how many focus sessions before a long break (whole number)');
        return null;
      }
      if (longBreakValue == null) {
        onError('Enter a valid long break duration in minutes');
        return null;
      }
    }
    const peekEnabled = nextStrictPeek || nextStrictPeekOnBreak;
    return {
      focusMinutes: focusValue,
      breakMinutes: breakValue,
      autoRepeat: nextAutoRepeat,
      blockDuringBreak: nextBlockDuringBreak,
      strictLockControls: nextStrictLock,
      strictAllowPeek: nextStrictPeek,
      strictAllowPeekOnBreak: nextStrictPeekOnBreak,
      strictEscalatePeek: peekEnabled && nextStrictEscalate,
      longBreaksEnabled: nextLongBreaksEnabled,
      longBreakAfterSessions:
        afterValue != null && Number.isInteger(afterValue)
          ? afterValue
          : latest.longBreakAfterSessions,
      longBreakMinutes:
        longBreakValue != null ? longBreakValue : latest.longBreakMinutes,
      dailyGoalMinutes: nextDailyGoalMinutes,
    };
  }

  async function saveDefaults(
    nextAutoRepeat = autoRepeat,
    nextBlockDuringBreak = blockDuringBreak,
    nextLongBreaksEnabled = longBreaksEnabled,
    nextDailyGoalMinutes = dailyGoalMinutes,
    nextStrictLock = strictLockControls,
    nextStrictPeek = strictAllowPeek,
    nextStrictPeekOnBreak = strictAllowPeekOnBreak,
    nextStrictEscalate = strictEscalatePeek,
  ) {
    const defaults = buildDefaultsInput(
      nextAutoRepeat,
      nextBlockDuringBreak,
      nextLongBreaksEnabled,
      nextDailyGoalMinutes,
      nextStrictLock,
      nextStrictPeek,
      nextStrictPeekOnBreak,
      nextStrictEscalate,
    );
    if (!defaults) {
      revertDefaultsFields();
      return;
    }
    if (
      defaults.focusMinutes === latest.defaultFocusMinutes &&
      defaults.breakMinutes === latest.defaultBreakMinutes &&
      defaults.autoRepeat === latest.autoRepeat &&
      defaults.blockDuringBreak === latest.blockDuringBreak &&
      defaults.strictLockControls === latest.strictLockControls &&
      defaults.strictAllowPeek === latest.strictAllowPeek &&
      defaults.strictAllowPeekOnBreak === latest.strictAllowPeekOnBreak &&
      defaults.strictEscalatePeek === latest.strictEscalatePeek &&
      defaults.longBreaksEnabled === latest.longBreaksEnabled &&
      defaults.longBreakAfterSessions === latest.longBreakAfterSessions &&
      defaults.longBreakMinutes === latest.longBreakMinutes &&
      defaults.dailyGoalMinutes === latest.dailyGoalMinutes
    ) {
      onError(null);
      return;
    }
    const saved = await onUpdateDefaults(defaults);
    if (!saved) {
      revertDefaultsFields();
    }
  }

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
            <IconBack />
          </button>
          <div className="screen-header-meta">
            <div className="screen-title">
              <span className="screen-title-text">Edit Context</span>
            </div>
          </div>
        </div>
      </header>

      <div className="edit-body">
        <section className="edit-section">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="edit-section-label">Identity & Scope</span>
          </div>
          <label className="field">
            <span className="muted" style={{ fontWeight: 500, color: 'var(--color-text)' }}>
              Context Name
            </span>
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

          <div className="stack" style={{ gap: 6 }}>
            <span className="edit-section-label" style={{ textTransform: 'none', letterSpacing: 0 }}>
              Session Duration
            </span>
            <div className="duration-inputs" role="group" aria-label="Default session timing">
              <label className="field duration-field">
                <span className="muted">Focus (min)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={focusMin}
                  max={240}
                  step={durationStep}
                  value={focusMinutes}
                  onChange={(event) => {
                    setFocusMinutes(event.target.value);
                    onError(null);
                  }}
                  onBlur={() => void saveDefaults()}
                  placeholder="25"
                />
              </label>
              <label className="field duration-field">
                <span className="muted">Break (min)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={breakMin}
                  max={240}
                  step={durationStep}
                  value={breakMinutes}
                  onChange={(event) => {
                    setBreakMinutes(event.target.value);
                    onError(null);
                  }}
                  onBlur={() => void saveDefaults()}
                  placeholder="5"
                />
              </label>
            </div>
            <label className="field">
              <span className="muted">Daily goal</span>
              <select
                value={dailyGoalMinutes}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setDailyGoalMinutes(next);
                  onError(null);
                  void saveDefaults(autoRepeat, blockDuringBreak, longBreaksEnabled, next);
                }}
              >
                {goalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error && !isLongBreakError ? (
              <p className="error-text duration-error">{error}</p>
            ) : null}
            <label
              className="auto-repeat-check"
              title="When enabled, a new focus session starts automatically after your break ends — until you stop the cycle."
            >
              <input
                type="checkbox"
                checked={autoRepeat}
                onChange={(event) => {
                  const next = event.target.checked;
                  setAutoRepeat(next);
                  void saveDefaults(next, blockDuringBreak, longBreaksEnabled);
                }}
              />
              <span>Auto-start next session</span>
            </label>
            <label
              className="auto-repeat-check"
              title="Recommended: keeping distractions blocked on break helps you stay focused. Stretch, hydrate, or take a short walk instead of browsing."
            >
              <input
                type="checkbox"
                checked={blockDuringBreak}
                onChange={(event) => {
                  const next = event.target.checked;
                  setBlockDuringBreak(next);
                  void saveDefaults(autoRepeat, next, longBreaksEnabled);
                }}
              />
              <span>Keep sites blocked during breaks</span>
            </label>
            <label
              className="auto-repeat-check"
              title="After several focus sessions, take a longer break instead of the short one."
            >
              <input
                type="checkbox"
                checked={longBreaksEnabled}
                onChange={(event) => {
                  const next = event.target.checked;
                  setLongBreaksEnabled(next);
                  void saveDefaults(autoRepeat, blockDuringBreak, next);
                }}
              />
              <span>Long breaks</span>
            </label>
            {longBreaksEnabled ? (
              <>
                <div className="duration-inputs" role="group" aria-label="Long break settings">
                  <label className="field duration-field">
                    <span className="muted">After sessions</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={99}
                      step={1}
                      value={longBreakAfterSessions}
                      onChange={(event) => {
                        setLongBreakAfterSessions(event.target.value);
                        onError(null);
                      }}
                      onBlur={() => void saveDefaults()}
                      placeholder="4"
                    />
                  </label>
                  <label className="field duration-field">
                    <span className="muted">Long break (min)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={breakMin}
                      max={240}
                      step={durationStep}
                      value={longBreakMinutes}
                      onChange={(event) => {
                        setLongBreakMinutes(event.target.value);
                        onError(null);
                      }}
                      onBlur={() => void saveDefaults()}
                      placeholder="15"
                    />
                  </label>
                </div>
                {isLongBreakError ? (
                  <p className="error-text duration-error">{error}</p>
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        <section className="edit-section">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="edit-section-label">Strict mode</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Optional locks for when willpower runs low. Copied onto the session when you
            start.
          </p>
          <label
            className="auto-repeat-check"
            title="Hide pause and end while a timer is running. You can still choose at phase boundaries."
          >
            <input
              type="checkbox"
              checked={strictLockControls}
              onChange={(event) => {
                const next = event.target.checked;
                setStrictLockControls(next);
                void saveDefaults(
                  autoRepeat,
                  blockDuringBreak,
                  longBreaksEnabled,
                  dailyGoalMinutes,
                  next,
                );
              }}
            />
            <span>Lock pause &amp; end during session</span>
          </label>
          <label
            className="auto-repeat-check"
            title="On the blocked page, wait then open that site for a chosen duration during focus."
          >
            <input
              type="checkbox"
              checked={strictAllowPeek}
              onChange={(event) => {
                const next = event.target.checked;
                setStrictAllowPeek(next);
                const escalate =
                  next || strictAllowPeekOnBreak ? strictEscalatePeek : false;
                if (!next && !strictAllowPeekOnBreak) {
                  setStrictEscalatePeek(false);
                }
                void saveDefaults(
                  autoRepeat,
                  blockDuringBreak,
                  longBreaksEnabled,
                  dailyGoalMinutes,
                  strictLockControls,
                  next,
                  strictAllowPeekOnBreak,
                  escalate,
                );
              }}
            />
            <span>Allow a peek during focus</span>
          </label>
          <label
            className="auto-repeat-check"
            title="Same peek flow during breaks when sites stay blocked."
          >
            <input
              type="checkbox"
              checked={strictAllowPeekOnBreak}
              onChange={(event) => {
                const next = event.target.checked;
                setStrictAllowPeekOnBreak(next);
                const escalate = strictAllowPeek || next ? strictEscalatePeek : false;
                if (!strictAllowPeek && !next) {
                  setStrictEscalatePeek(false);
                }
                void saveDefaults(
                  autoRepeat,
                  blockDuringBreak,
                  longBreaksEnabled,
                  dailyGoalMinutes,
                  strictLockControls,
                  strictAllowPeek,
                  next,
                  escalate,
                );
              }}
            />
            <span>Allow a peek during breaks</span>
          </label>
          <label
            className={`auto-repeat-check${
              strictAllowPeek || strictAllowPeekOnBreak
                ? ''
                : ' auto-repeat-check-disabled'
            }`}
            title="Each peek makes the next wait longer: 10s, then 1m, 5m, 15m, 30m."
          >
            <input
              type="checkbox"
              checked={strictEscalatePeek}
              disabled={!strictAllowPeek && !strictAllowPeekOnBreak}
              onChange={(event) => {
                const next = event.target.checked;
                setStrictEscalatePeek(next);
                void saveDefaults(
                  autoRepeat,
                  blockDuringBreak,
                  longBreaksEnabled,
                  dailyGoalMinutes,
                  strictLockControls,
                  strictAllowPeek,
                  strictAllowPeekOnBreak,
                  next,
                );
              }}
            />
            <span>Longer wait after each peek</span>
          </label>
        </section>

        <section className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6 }}>
              <h2 className="heading" style={{ fontSize: 16 }}>
                Blocked Websites
              </h2>
              <span className="badge badge-soft" style={{ textTransform: 'none' }}>
                {latest.sites.length} {latest.sites.length === 1 ? 'site' : 'sites'}
              </span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: -4 }}>
            These domains will be warded during active sessions.
          </p>

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
                placeholder="e.g., twitter.com, reddit.com..."
              />
            </label>
            <Button type="submit" variant="primary" style={{ alignSelf: 'flex-end' }}>
              <IconPlus style={{ width: 14, height: 14 }} />
              Add
            </Button>
          </form>

          {error ? <p className="error-text">{error}</p> : null}

          {latest.sites.length === 0 ? (
            <EmptyState
              title="No sites blocked"
              description="Add a domain above to shield it during focus sessions."
            />
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {latest.sites.map((site) => (
                <div key={site} className="site-row">
                  <div className="site-row-left">
                    <div className="site-glyph">{site.charAt(0).toUpperCase()}</div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{site}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${site}`}
                    onClick={() => void onRemoveSite(site)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="danger-zone">
          <div className="stack" style={{ gap: 4, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
              Delete Context
            </span>
            <p className="muted" style={{ margin: 0 }}>
              Permanently remove this preset and its {latest.sites.length} blocked domain
              rules.
            </p>
            {pendingDelete ? (
              <div className="row" style={{ marginTop: 8 }}>
                <Button
                  variant="primary"
                  onClick={onConfirmDelete}
                  disabled={isActiveSessionContext}
                >
                  Delete
                </Button>
                <Button variant="ghost" onClick={onCancelDelete}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                disabled={isActiveSessionContext}
                onClick={onRequestDelete}
                title={isActiveSessionContext ? 'End the session first.' : undefined}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                Delete This Context
              </Button>
            )}
            {isActiveSessionContext ? (
              <p className="muted">End the session first.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
