import { useEffect, useState } from 'react';
import { extractSiteFromUrl } from '@core/domain';
import { addSite } from '@core/contexts';
import { formatClock, formatDuration } from '@core/format';
import { getRemainingMs } from '@core/session';
import { getTodayStats } from '@core/stats';
import type { AppState, VoidResult } from '@core/types';
import { createTabsAdapter } from '@platform/tabs';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { Clock } from '../components/Clock';
import { EmptyState } from '../components/EmptyState';
import { useNow } from '../hooks/useNow';
import { sendCommand } from '../services/commands';
import { getAppRepository } from '../services/repository';

type DurationMode = 25 | 50 | 'custom';

function resolveInitialMode(minutes: number): DurationMode {
  if (minutes === 25 || minutes === 50) {
    return minutes;
  }
  return 'custom';
}

export function HomeView({
  state,
  onGoToContexts,
}: {
  state: AppState;
  onGoToContexts: () => void;
}) {
  const running = state.activeSession?.status === 'running';
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [durationMode, setDurationMode] = useState<DurationMode>(() =>
    resolveInitialMode(state.settings.lastDurationMinutes),
  );
  const [customMinutes, setCustomMinutes] = useState(
    String(state.settings.lastDurationMinutes || 25),
  );
  const [addSiteMessage, setAddSiteMessage] = useState<string | null>(null);
  const [activeTabSite, setActiveTabSite] = useState<string | null>(null);

  const selectedContext =
    state.contexts.find((context) => context.id === state.settings.selectedContextId) ??
    state.contexts[0] ??
    null;

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
    const minutes =
      durationMode === 'custom' ? Number.parseInt(customMinutes, 10) : durationMode;
    await runCommand(
      sendCommand({
        type: 'START_SESSION',
        contextId: selectedContext.id,
        durationMinutes: minutes,
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
      <EmptyState
        title="No contexts yet"
        description="Create a focus context to choose which sites to block."
        action={
          <Button variant="primary" onClick={onGoToContexts}>
            Create your first context
          </Button>
        }
      />
    );
  }

  if (state.lastCompletion && !state.activeSession) {
    const minutes = Math.round(state.lastCompletion.record.focusedMs / 60_000);
    return (
      <div className="stack">
        <Card>
          <div className="stack">
            <h1 className="heading">Focus session complete 🎉</h1>
            <p className="subheading">You worked for {minutes} minutes</p>
            <p className="muted">Take 5–10 minutes away from the screen</p>
            <Button
              variant="primary"
              large
              onClick={() => void runCommand(sendCommand({ type: 'START_ANOTHER' }))}
            >
              Start another session
            </Button>
            <Button
              variant="ghost"
              onClick={() => void runCommand(sendCommand({ type: 'DISMISS_COMPLETION' }))}
            >
              Dismiss
            </Button>
          </div>
        </Card>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    );
  }

  if (state.activeSession) {
    const session = state.activeSession;
    const remaining = formatClock(getRemainingMs(session, now));
    const isPaused = session.status === 'paused';

    return (
      <div className="stack">
        <Card>
          <div className="stack">
            <p className="muted">Focusing on</p>
            <h1 className="heading">{session.contextName}</h1>
            <Clock value={remaining} />
            {isPaused ? <p className="muted">Paused. Blocking stays on.</p> : null}
            <div className="row">
              <Button
                variant="primary"
                onClick={() =>
                  void runCommand(
                    sendCommand({ type: isPaused ? 'RESUME_SESSION' : 'PAUSE_SESSION' }),
                  )
                }
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runCommand(sendCommand({ type: 'END_SESSION' }))}
              >
                End
              </Button>
            </div>
          </div>
        </Card>
        <AddCurrentSiteSection
          selectedContextName={session.contextName}
          selectedContextSites={
            state.contexts.find((context) => context.id === session.contextId)?.sites ?? []
          }
          activeTabSite={activeTabSite}
          sessionActive
          sessionContextId={session.contextId}
          selectedContextId={session.contextId}
          message={addSiteMessage}
          onAdd={() => void handleAddCurrentSite()}
        />
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    );
  }

  const today = getTodayStats(state.history, now);

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <button
            type="button"
            className="ui-button ui-button-ghost"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
          >
            <span className="heading">{selectedContext?.name ?? 'Choose context'}</span>
          </button>
          {pickerOpen ? (
            <ul className="list" aria-label="Contexts">
              {state.contexts.map((context) => (
                <li key={context.id}>
                  <Button
                    variant={context.id === selectedContext?.id ? 'primary' : 'secondary'}
                    onClick={() => void handleSelectContext(context.id)}
                  >
                    {context.name}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button variant="ghost" onClick={() => setPickerOpen(true)}>
            Change context
          </Button>

          <div className="row" role="group" aria-label="Duration">
            <Chip
              selected={durationMode === 25}
              onClick={() => {
                setDurationMode(25);
                setCustomMinutes('25');
              }}
            >
              25 min
            </Chip>
            <Chip
              selected={durationMode === 50}
              onClick={() => {
                setDurationMode(50);
                setCustomMinutes('50');
              }}
            >
              50 min
            </Chip>
            <Chip selected={durationMode === 'custom'} onClick={() => setDurationMode('custom')}>
              Custom
            </Chip>
          </div>

          {durationMode === 'custom' ? (
            <label className="field">
              <span className="muted">Minutes (1–240)</span>
              <input
                type="number"
                min={1}
                max={240}
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
              />
            </label>
          ) : null}

          <Button variant="primary" large onClick={() => void handleStart()}>
            Start Focus
          </Button>

          <p className="muted">
            Today · {formatDuration(today.focusMs)} · {today.sessions}{' '}
            {today.sessions === 1 ? 'session' : 'sessions'}
          </p>
        </div>
      </Card>

      <AddCurrentSiteSection
        selectedContextName={selectedContext?.name ?? 'context'}
        selectedContextSites={selectedContext?.sites ?? []}
        activeTabSite={activeTabSite}
        sessionActive={false}
        sessionContextId={null}
        selectedContextId={selectedContext?.id ?? null}
        message={addSiteMessage}
        onAdd={() => void handleAddCurrentSite()}
      />

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

function AddCurrentSiteSection({
  selectedContextName,
  selectedContextSites,
  activeTabSite,
  sessionActive,
  sessionContextId,
  selectedContextId,
  message,
  onAdd,
}: {
  selectedContextName: string;
  selectedContextSites: string[];
  activeTabSite: string | null;
  sessionActive: boolean;
  sessionContextId: string | null;
  selectedContextId: string | null;
  message: string | null;
  onAdd: () => void;
}) {
  if (!activeTabSite) {
    return null;
  }

  const already = selectedContextSites.includes(activeTabSite);
  if (already) {
    return (
      <p className="muted">Already blocked in {selectedContextName}</p>
    );
  }

  const willBlockNow = sessionActive && sessionContextId === selectedContextId;

  return (
    <div className="stack">
      <Button variant="secondary" onClick={onAdd}>
        Add {activeTabSite} to {selectedContextName}
      </Button>
      {willBlockNow ? (
        <p className="muted">This tab will be blocked now.</p>
      ) : null}
      {message ? <p className="success-text">{message}</p> : null}
    </div>
  );
}
