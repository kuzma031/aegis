import { useEffect, useRef, useState } from 'react';
import { extractSiteFromUrl } from '@core/domain';
import { addSite } from '@core/contexts';
import { DAILY_GOAL_OFF } from '@core/contexts';
import { formatClock, formatDuration, formatMinutesPhrase } from '@core/format';
import { getRemainingMs } from '@core/session';
import { getTodayPeriodStats } from '@core/stats';
import type { AppState, SessionSummary, VoidResult } from '@core/types';
import { createTabsAdapter } from '@platform/tabs';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import {
  IconChevronDown,
  IconClock,
  IconEdit,
  IconPause,
  IconPlay,
  IconPlus,
  IconShield,
} from '../components/icons';
import { TimerRing } from '../components/TimerRing';
import { useNow } from '../hooks/useNow';
import { sendCommand } from '../services/commands';
import { getAppRepository } from '../services/repository';

function shortContextLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

export function HomeView({
  state,
  onGoToContexts,
  onEditContext,
}: {
  state: AppState;
  onGoToContexts: () => void;
  onEditContext: (contextId: string) => void;
}) {
  const running = state.activeSession?.status === 'running';
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedContext =
    state.contexts.find((context) => context.id === state.settings.selectedContextId) ??
    state.contexts[0] ??
    null;
  const [addSiteMessage, setAddSiteMessage] = useState<string | null>(null);
  const [activeTabSite, setActiveTabSite] = useState<string | null>(null);

  const focusMinutes = selectedContext?.defaultFocusMinutes ?? 25;
  const breakMinutes = selectedContext?.defaultBreakMinutes ?? 5;
  const autoRepeat = selectedContext?.autoRepeat ?? false;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tab = await createTabsAdapter().getActiveTab();
        if (cancelled) return;
        setActiveTabSite(tab?.url ? extractSiteFromUrl(tab.url) : null);
      } catch (err: unknown) {
        console.error('[focus] failed to read active tab', err);
        if (!cancelled) setActiveTabSite(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.activeSession?.id, state.settings.selectedContextId]);

  async function runCommand(resultPromise: Promise<VoidResult>) {
    const result = await resultPromise;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
  }

  async function handleStart() {
    if (!selectedContext) return;
    await runCommand(
      sendCommand({
        type: 'START_SESSION',
        contextId: selectedContext.id,
        durationMinutes: focusMinutes,
        breakMinutes,
        repeat: autoRepeat,
      }),
    );
  }

  async function handleSelectContext(contextId: string) {
    try {
      await getAppRepository().update((current) => {
        const next = current.contexts.some((context) => context.id === contextId)
          ? {
              ...current,
              settings: { ...current.settings, selectedContextId: contextId },
            }
          : current;
        return next;
      });
      setPickerOpen(false);
      setError(null);
    } catch (err: unknown) {
      console.error('[focus] selectContext failed', err);
      setError('Could not change context');
    }
  }

  async function handleAddCurrentSite() {
    const targetContext =
      state.contexts.find((context) => context.id === state.activeSession?.contextId) ??
      selectedContext;
    if (!targetContext || !activeTabSite) return;
    setAddSiteMessage(null);
    try {
      let message = '';
      await getAppRepository().update((current) => {
        const result = addSite(current, targetContext.id, activeTabSite, Date.now());
        if (!result.ok) {
          message = result.error;
          return current;
        }
        message = `Added ${activeTabSite}`;
        return result.value;
      });
      if (message.startsWith('Added')) {
        setAddSiteMessage(message);
        setError(null);
      } else {
        setError(message || 'Could not add site');
      }
    } catch (err: unknown) {
      console.error('[focus] addSite failed', err);
      setError('Could not add site');
    }
  }

  if (state.contexts.length === 0) {
    return (
      <div className="screen-body">
        <EmptyState
          title="No contexts yet"
          description="Create a focus context to choose which sites to block."
          action={
            <Button variant="primary" onClick={onGoToContexts}>
              Create your first context
            </Button>
          }
        />
      </div>
    );
  }

  if (!state.activeSession && state.lastSessionSummary) {
    return (
      <SessionEndedView
        summary={state.lastSessionSummary}
        error={error}
        onDone={() => void runCommand(sendCommand({ type: 'DISMISS_COMPLETION' }))}
      />
    );
  }

  if (state.activeSession) {
    return (
      <RunningHome
        state={state}
        now={now}
        error={error}
        activeTabSite={activeTabSite}
        addSiteMessage={addSiteMessage}
        onPauseResume={() => {
          const isPaused = state.activeSession?.status === 'paused';
          void runCommand(
            sendCommand({ type: isPaused ? 'RESUME_SESSION' : 'PAUSE_SESSION' }),
          );
        }}
        onEnd={() => void runCommand(sendCommand({ type: 'END_SESSION' }))}
        onAddSite={() => void handleAddCurrentSite()}
        onCheckExpired={() => void runCommand(sendCommand({ type: 'CHECK_EXPIRED' }))}
      />
    );
  }

  const todayHistory =
    selectedContext == null
      ? state.history
      : state.history.filter((record) => record.contextId === selectedContext.id);
  const today = getTodayPeriodStats(todayHistory, now);
  const dailyGoalMinutes = selectedContext?.dailyGoalMinutes ?? DAILY_GOAL_OFF;
  const previewClock = formatClock(Math.max(0, focusMinutes) * 60_000);

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <div className="screen-header-meta">
            <span className="screen-eyebrow">Active context:</span>
            <div className="screen-title">
              <span className="screen-title-text">
                {selectedContext?.name ?? 'Choose context'}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="switch-btn"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <span>Switch</span>
          <IconChevronDown />
        </button>
      </header>

      {pickerOpen ? (
        <ul className="picker-list" aria-label="Contexts">
          {state.contexts.map((context) => (
            <li key={context.id}>
              <button
                type="button"
                aria-current={context.id === selectedContext?.id ? 'true' : undefined}
                onClick={() => void handleSelectContext(context.id)}
              >
                {context.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="screen-body">
        <div className="timer-wrap">
          <TimerRing progress={1} gradientId="idleAegisGradient">
            <span className="timer-value">{previewClock}</span>
            <div className="timer-caption">
              <span>Ready for deep work</span>
            </div>
          </TimerRing>

          <div className="timer-wrap-meta">
            <div className="session-defaults" aria-label="Session timing">
              <div className="session-defaults-times">
                <span>
                  Focus <strong>{formatMinutesPhrase(focusMinutes)}</strong>
                </span>
                <span className="session-defaults-sep" aria-hidden="true">
                  ·
                </span>
                <span>
                  Break <strong>{formatMinutesPhrase(breakMinutes)}</strong>
                </span>
              </div>
              {selectedContext ? (
                <button
                  type="button"
                  className="session-defaults-edit"
                  onClick={() => onEditContext(selectedContext.id)}
                >
                  <IconEdit style={{ width: 12, height: 12 }} />
                  Edit Context
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="home-actions">
          <Button variant="primary" large onClick={() => void handleStart()}>
            <IconPlay style={{ width: 16, height: 16 }} />
            Start Focus Session
          </Button>

          <AddCurrentSiteSection
            selectedContextName={selectedContext?.name ?? 'context'}
            selectedContextSites={selectedContext?.sites ?? []}
            activeTabSite={activeTabSite}
            sessionActive={false}
            message={addSiteMessage}
            onAdd={() => void handleAddCurrentSite()}
          />

          <div className="summary-ribbon">
            <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <IconClock style={{ width: 14, height: 14, color: '#b45309' }} />
              Today:{' '}
              <strong>{formatDuration(today.focusMs)}</strong>
            </span>
            {dailyGoalMinutes > DAILY_GOAL_OFF ? (
              <span>
                <span className="accent">{formatDuration(today.focusMs)}</span>
                {' of '}
                {formatDuration(dailyGoalMinutes * 60_000)}
              </span>
            ) : null}
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </>
  );
}

function SessionEndedView({
  summary,
  error,
  onDone,
}: {
  summary: SessionSummary;
  error: string | null;
  onDone: () => void;
}) {
  const totalMs = summary.focusMs + summary.breakMs;

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <div className="screen-header-meta">
            <span className="screen-eyebrow">Session complete</span>
            <div className="screen-title">
              <span className="screen-title-text">{summary.contextName}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="screen-body">
        <div className="session-ended">
          <h1 className="session-ended-title">Nice work</h1>
          <p className="session-ended-subtitle">
            Here’s what you got done in this run.
          </p>

          <div className="session-ended-grid" aria-label="Session counts">
            <div className="session-ended-stat">
              <span className="session-ended-stat-value">{summary.focusCount}</span>
              <span className="session-ended-stat-label">Focus sessions</span>
            </div>
            <div className="session-ended-stat">
              <span className="session-ended-stat-value">{summary.breakCount}</span>
              <span className="session-ended-stat-label">Breaks</span>
            </div>
          </div>

          <div className="session-ended-card">
            <div className="session-ended-row">
              <span>Focus time</span>
              <strong>{formatDuration(summary.focusMs)}</strong>
            </div>
            <div className="session-ended-row">
              <span>Break time</span>
              <strong>{formatDuration(summary.breakMs)}</strong>
            </div>
            <div className="session-ended-row session-ended-row-total">
              <span>Total time</span>
              <strong>{formatDuration(totalMs)}</strong>
            </div>
          </div>

          {summary.tasks.length > 0 ? (
            <div className="session-ended-card" aria-label="Task focus time">
              <div className="session-ended-card-label">Tasks</div>
              {summary.tasks.map((task) => (
                <div key={task.taskId} className="session-ended-row">
                  <span className="session-ended-task-title">{task.taskTitle}</span>
                  <strong>{formatDuration(task.focusMs)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="session-ended-card">
            <div className="session-ended-row">
              <span>Blocked site hits</span>
              <strong>{summary.distractionOverrides}</strong>
            </div>
            <div className="session-ended-row">
              <span>Pauses</span>
              <strong>{summary.pauseCount}</strong>
            </div>
          </div>
        </div>

        <div className="home-actions">
          <Button variant="primary" large onClick={onDone}>
            Back to Home
          </Button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </>
  );
}

function RunningHome({
  state,
  now,
  error,
  activeTabSite,
  addSiteMessage,
  onPauseResume,
  onEnd,
  onAddSite,
  onCheckExpired,
}: {
  state: AppState;
  now: number;
  error: string | null;
  activeTabSite: string | null;
  addSiteMessage: string | null;
  onPauseResume: () => void;
  onEnd: () => void;
  onAddSite: () => void;
  onCheckExpired: () => void;
}) {
  const session = state.activeSession!;
  const remainingMs = getRemainingMs(session, now);
  const remaining = formatClock(remainingMs);
  const isPaused = session.status === 'paused';
  const isBreak = session.phase === 'break';
  const progress =
    session.plannedMs > 0 ? Math.min(1, Math.max(0, remainingMs / session.plannedMs)) : 0;
  const plannedLabel =
    session.plannedMs < 60_000
      ? `${Math.round(session.plannedMs / 1000)}s`
      : `${Math.round(session.plannedMs / 60_000)} min`;
  const context =
    state.contexts.find((item) => item.id === session.contextId) ?? null;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const checkedExpiryKey = useRef<string | null>(null);

  useEffect(() => {
    if (session.status !== 'running' || remainingMs > 0) {
      return;
    }
    const key = `${session.id}:${session.phase}`;
    if (checkedExpiryKey.current === key) {
      return;
    }
    checkedExpiryKey.current = key;
    onCheckExpired();
  }, [session.status, session.id, session.phase, remainingMs, onCheckExpired]);

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <div className="screen-header-meta">
            <span className="screen-eyebrow">Active context:</span>
            <div className="screen-title">
              <span className="screen-title-text">{session.contextName}</span>
              <span className="badge badge-soft">
                {isBreak ? (session.isLongBreak ? 'Long break' : 'Break') : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="screen-body">
        {isBreak ? (
          <div className="break-complete">
            <h1 className="break-complete-title">Focus session complete</h1>
            <p className="break-complete-subtitle">
              You worked uninterrupted for{' '}
              <strong>{formatMinutesPhrase(session.focusMinutes)}</strong> with{' '}
              <strong>{session.distractionOverrides}</strong> distraction{' '}
              {session.distractionOverrides === 1 ? 'override' : 'overrides'}.
            </p>

            <div className="break-away-card">
              <div className="break-away-heading">
                <svg
                  className="break-away-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                <span>Take {formatMinutesPhrase(session.plannedMs / 60_000)} away</span>
              </div>
              <p className="break-away-copy">
                Step back from the screen. Stretch, hydrate, or rest your gaze on the
                horizon.
                {context?.blockDuringBreak ? (
                  <>
                    {' '}
                    <strong>Shielded tabs remain preserved.</strong>
                  </>
                ) : null}
              </p>
            </div>

            <div className="break-timer-row">
              <span className="break-timer-label">
                {isPaused
                  ? session.isLongBreak
                    ? 'Long break paused'
                    : 'Break paused'
                  : session.isLongBreak
                    ? 'Long break remaining'
                    : 'Break remaining'}
              </span>
              <span className="break-timer-value">{remaining}</span>
            </div>
          </div>
        ) : (
          <div className="timer-wrap">
            <TimerRing progress={progress} gradientId="runningAegisGradient">
              <span className="timer-value">{remaining}</span>
              <span className="timer-remaining">
                {isPaused ? 'Paused · ' : ''}
                focus · {plannedLabel}
              </span>
            </TimerRing>

            <div className="timer-wrap-meta">
              <div className="encourage-pill">
                <span className="star" aria-hidden="true">
                  ✦
                </span>
                <span>
                  {isPaused
                    ? 'Paused. Blocking stays on until you resume.'
                    : "You're in the zone. Keep up the steady flow."}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="home-actions">
          {confirmEnd ? (
            <div className="end-confirm">
              <p className="end-confirm-text">
                {isBreak ? 'End break and stop the cycle?' : 'End this focus session?'}
              </p>
              <div className="home-controls">
                <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                  Keep going
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirmEnd(false);
                    onEnd();
                  }}
                >
                  Yes, end session
                </Button>
              </div>
            </div>
          ) : (
            <div className="home-controls">
              <Button variant="secondary" onClick={onPauseResume}>
                {isPaused ? (
                  <>
                    <IconPlay style={{ width: 14, height: 14 }} />
                    Resume
                  </>
                ) : (
                  <>
                    <IconPause style={{ width: 14, height: 14 }} />
                    Pause
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmEnd(true)}>
                End Session
              </Button>
            </div>
          )}

          {!isBreak ? (
            <AddCurrentSiteSection
              selectedContextName={session.contextName}
              selectedContextSites={context?.sites ?? []}
              activeTabSite={activeTabSite}
              sessionActive
              message={addSiteMessage}
              onAdd={onAddSite}
              runningLabel
            />
          ) : null}

          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    </>
  );
}

function AddCurrentSiteSection({
  selectedContextName,
  selectedContextSites,
  activeTabSite,
  sessionActive,
  message,
  onAdd,
  runningLabel = false,
}: {
  selectedContextName: string;
  selectedContextSites: string[];
  activeTabSite: string | null;
  sessionActive: boolean;
  message: string | null;
  onAdd: () => void;
  runningLabel?: boolean;
}) {
  if (!activeTabSite) {
    return null;
  }

  const already = selectedContextSites.includes(activeTabSite);
  if (already) {
    return <p className="muted">Already blocked in {selectedContextName}</p>;
  }

  const initial = activeTabSite.charAt(0).toUpperCase();
  const label = runningLabel
    ? 'Add to Blocked'
    : `Block in ${shortContextLabel(selectedContextName)}`;

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="tab-action">
        <div className="tab-action-left">
          <div className={`tab-favicon${sessionActive ? ' tab-favicon-alert' : ''}`}>
            {initial}
          </div>
          <span className="tab-host">{activeTabSite}/...</span>
        </div>
        <button type="button" className="ui-add-chip" onClick={onAdd}>
          <IconPlus />
          <span>{label}</span>
        </button>
      </div>
      {message ? <p className="success-text">{message}</p> : null}
    </div>
  );
}
