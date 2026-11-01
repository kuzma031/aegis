import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock } from '@core/format';
import {
  activePeekHosts,
  areSessionControlsLocked,
  getRemainingMs,
  isPeekAllowed,
  peekDurationOptions,
} from '@core/session';
import { useAppState } from '../hooks/useAppState';
import { useNow } from '../hooks/useNow';
import { Button } from '../components/Button';
import { TimerRing } from '../components/TimerRing';
import { IconShield } from '../components/icons';
import { sendCommand } from '../services/commands';

/** One inhale or exhale — roughly a full comfortable breath phase. */
const BREATH_PHASE_MS = 4_000;

function parseOriginalFromHash(hash: string): { href: string; host: string } | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return null;
  }

  const candidates = [raw];
  try {
    candidates.unshift(decodeURIComponent(raw));
  } catch {
    // keep raw only
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return { href: url.href, host: url.hostname.replace(/^www\./, '') };
      }
    } catch {
      // try next
    }
  }
  return null;
}

export function App() {
  const { state, loading } = useAppState();
  const session = state?.activeSession ?? null;
  const peekWait = session?.run.peekWait ?? null;
  const peekAllowed = session ? isPeekAllowed(session) : false;
  const running = session?.status === 'running' || peekWait != null;
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [breathPhase, setBreathPhase] = useState<'in' | 'out'>('in');
  const recordedDistraction = useRef(false);
  const peekDialogRef = useRef<HTMLDivElement | null>(null);
  const peekCloseRef = useRef<HTMLButtonElement | null>(null);

  const original = useMemo(
    () => parseOriginalFromHash(window.location.hash),
    [],
  );

  useEffect(() => {
    if (!state || state.activeSession) {
      return;
    }
    if (original) {
      window.location.replace(original.href);
    }
  }, [state, original]);

  useEffect(() => {
    if (recordedDistraction.current) {
      return;
    }
    if (!state?.activeSession || state.activeSession.phase !== 'focus') {
      return;
    }
    recordedDistraction.current = true;
    void sendCommand({
      type: 'RECORD_DISTRACTION',
      site: original?.host,
    });
  }, [state?.activeSession, original?.host]);

  useEffect(() => {
    if (!session || !original?.host) {
      return;
    }
    if (activePeekHosts(session, now).includes(original.host)) {
      window.location.replace(original.href);
    }
  }, [session, original, now]);

  useEffect(() => {
    if (!original?.host) {
      return;
    }
    if (peekWait?.host === original.host) {
      setOverlayOpen(true);
    }
  }, [peekWait?.host, original?.host]);

  const durationOptions = session ? peekDurationOptions(session, now) : [];

  useEffect(() => {
    if (durationOptions.length === 0) {
      return;
    }
    if (!durationOptions.includes(durationMinutes)) {
      setDurationMinutes(durationOptions[0]!);
    }
  }, [durationOptions, durationMinutes]);

  useEffect(() => {
    if (!overlayOpen) {
      setBreathPhase('in');
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      return;
    }
    const id = window.setInterval(() => {
      setBreathPhase((phase) => (phase === 'in' ? 'out' : 'in'));
    }, BREATH_PHASE_MS);
    return () => window.clearInterval(id);
  }, [overlayOpen]);

  async function handleEnd() {
    const result = await sendCommand({ type: 'END_SESSION' });
    if (!result.ok) {
      setError(result.error);
    }
  }

  async function handleStartPeek() {
    if (!original?.host) {
      return;
    }
    const result = await sendCommand({
      type: 'BEGIN_PEEK_WAIT',
      site: original.host,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setOverlayOpen(true);
  }

  async function handleCancelPeek() {
    const result = await sendCommand({ type: 'CLEAR_PEEK_WAIT' });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setOverlayOpen(false);
  }

  async function handleAllowPeek() {
    if (!original?.host) {
      return;
    }
    const result = await sendCommand({
      type: 'ALLOW_PEEK',
      site: original.host,
      durationMinutes,
    });
    if (!result.ok) {
      // Background may already be restoring this tab; a race error is harmless.
      if (/navigation rejected/i.test(result.error)) {
        window.location.replace(original.href);
        return;
      }
      setError(result.error);
      return;
    }
    setError(null);
    // Background enforceTabs also restores; page nav is the snappy path.
    window.location.replace(original.href);
  }

  async function handleClose() {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id != null) {
        await chrome.tabs.remove(tab.id);
      }
    } catch (err: unknown) {
      console.error('[focus] close tab failed', err);
      setError('Could not close this tab');
    }
  }

  const awaitingChoice = session?.status === 'awaiting';
  const waitForHost = peekWait?.host === original?.host ? peekWait : null;
  const showOverlay = overlayOpen && waitForHost != null && !awaitingChoice;

  useEffect(() => {
    if (!showOverlay) {
      return;
    }
    peekCloseRef.current?.focus();
    const dialog = peekDialogRef.current;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleCancelPeek();
        return;
      }
      if (event.key !== 'Tab' || !dialog) {
        return;
      }
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled])',
        ),
      ];
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showOverlay]);

  if (loading || !state) {
    return (
      <div className="blocked-shell">
        <div className="blocked-panel">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="blocked-shell">
        <div className="blocked-panel stack">
          <h1 className="heading">Session finished</h1>
          <p className="muted">
            {original ? 'Taking you back…' : 'Your focus session has ended.'}
          </p>
          <Button variant="secondary" onClick={() => void handleClose()}>
            Close tab
          </Button>
        </div>
      </div>
    );
  }

  const controlsLocked = areSessionControlsLocked(session);

  if (!original) {
    return (
      <div className="blocked-shell">
        <div className="blocked-panel stack">
          <h1 className="heading">Session finished</h1>
          <p className="muted">This page does not have a valid return URL.</p>
          <div className="row">
            {!controlsLocked ? (
              <Button variant="ghost" onClick={() => void handleEnd()}>
                End session
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void handleClose()}>
              Close tab
            </Button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    );
  }

  const awaitingBreak = awaitingChoice && session.phase === 'break';
  const remainingMs = getRemainingMs(session, now);
  const remaining = formatClock(remainingMs);
  const progressPct = awaitingChoice
    ? 100
    : session.plannedMs > 0
      ? Math.min(100, Math.max(0, ((session.plannedMs - remainingMs) / session.plannedMs) * 100))
      : 0;
  const timeLabel = awaitingChoice ? 'Done' : remaining;
  const chipLabel = awaitingBreak
    ? 'Break finished'
    : awaitingChoice
      ? 'Focus finished'
      : session.status === 'paused'
        ? 'Paused'
        : session.phase === 'break'
          ? 'On break'
          : 'Focus';

  const peekReadyMs = waitForHost ? Math.max(0, waitForHost.readyAt - now) : 0;
  const peekReady = waitForHost != null && peekReadyMs === 0;
  const showPeekButton =
    peekAllowed && !awaitingChoice && durationOptions.length > 0;

  return (
    <div className="blocked-shell">
      <header className="blocked-topbar">
        <div className="blocked-topbar-left">
          <span aria-hidden="true" className="blocked-topbar-logo">
            <IconShield />
          </span>
          <strong>{original.host}</strong>
        </div>
        <div className="blocked-topbar-right">{session.contextName}</div>
      </header>

      <main className="blocked-main">
        <div className="blocked-medallion">
          <div className="blocked-medallion-aura" aria-hidden="true" />
          <div className="blocked-medallion-ring">
            <IconShield />
          </div>
          <div className="blocked-medallion-badge">Wardfocus active</div>
        </div>

        <div className="blocked-copy">
          <h1 className="blocked-title">
            {awaitingBreak
              ? 'Break finished'
              : awaitingChoice
                ? 'Focus finished'
                : 'This site is blocked'}
          </h1>
          <p className="blocked-lede">
            {awaitingBreak ? (
              <>
                Open Wardfocus to start another focus or end the session.{' '}
                <strong>{original.host}</strong> stays blocked until then.
              </>
            ) : awaitingChoice ? (
              <>
                Open Wardfocus to extend, start a break, or end.{' '}
                <strong>{original.host}</strong> stays blocked until then.
              </>
            ) : (
              <>
                <strong>{original.host}</strong> is blocked for{' '}
                <strong>{session.contextName}</strong> until this phase ends.
              </>
            )}
          </p>
        </div>

        <div className="blocked-timer-card">
          <div className="blocked-progress-track" aria-hidden="true">
            <div className="blocked-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="blocked-timer-meta">
            <span className="blocked-session-chip">{chipLabel}</span>
          </div>
          <div className="blocked-countdown">
            <span className="blocked-countdown-value">{timeLabel}</span>
            <span className="blocked-countdown-label">
              {awaitingChoice ? 'open Wardfocus to continue' : 'remaining'}
            </span>
          </div>
        </div>

        <div className="blocked-actions">
          {showPeekButton && !showOverlay ? (
            <Button variant="secondary" onClick={() => void handleStartPeek()}>
              Take a peek
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => void handleClose()}>
            Close tab
          </Button>
          {!controlsLocked && !awaitingChoice ? (
            <Button variant="ghost" onClick={() => void handleEnd()}>
              End session
            </Button>
          ) : null}
        </div>

        {error && !showOverlay ? <p className="error-text">{error}</p> : null}
      </main>

      {showOverlay ? (
        <div className="blocked-peek-overlay">
          <div
            ref={peekDialogRef}
            className="blocked-peek-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="peek-dialog-title"
          >
            <h2 id="peek-dialog-title" className="heading">
              Peek at {original.host}
            </h2>
            <div
              className={`blocked-peek-ring-wrap is-${breathPhase}`}
              style={{ animationDuration: `${BREATH_PHASE_MS}ms` }}
            >
              <TimerRing progress={1}>
                <span className="blocked-peek-ring-spacer" aria-hidden="true" />
              </TimerRing>
            </div>
            <p className="blocked-peek-breath-label" aria-live="polite">
              {breathPhase === 'in' ? 'Breathe in' : 'Breathe out'}
            </p>
            <label
              className={`blocked-peek-duration${peekReady ? '' : ' is-waiting'}`}
            >
              <span className="muted">Peek for (minutes)</span>
              <select
                value={durationMinutes}
                disabled={!peekReady}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
              >
                {durationOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}
                  </option>
                ))}
              </select>
            </label>
            <div className="blocked-peek-actions">
              <Button
                ref={peekCloseRef}
                variant="ghost"
                onClick={() => void handleCancelPeek()}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className={peekReady ? '' : 'blocked-peek-continue-waiting'}
                aria-live="polite"
                onClick={() => {
                  if (!peekReady) {
                    return;
                  }
                  void handleAllowPeek();
                }}
              >
                {peekReady ? 'Open site' : formatClock(peekReadyMs)}
              </Button>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
