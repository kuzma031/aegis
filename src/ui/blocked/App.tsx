import { useEffect, useMemo, useRef, useState } from 'react';
import { formatClock } from '@core/format';
import { getRemainingMs } from '@core/session';
import { useAppState } from '../hooks/useAppState';
import { useNow } from '../hooks/useNow';
import { Button } from '../components/Button';
import { IconShield } from '../components/icons';
import { sendCommand } from '../services/commands';

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
  const running = state?.activeSession?.status === 'running';
  const now = useNow(Boolean(running));
  const [error, setError] = useState<string | null>(null);
  const recordedDistraction = useRef(false);

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

  async function handleEnd() {
    const result = await sendCommand({ type: 'END_SESSION' });
    if (!result.ok) {
      setError(result.error);
    }
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

  if (loading || !state) {
    return (
      <div className="blocked-shell">
        <div className="blocked-panel">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  const session = state.activeSession;

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

  if (!original) {
    return (
      <div className="blocked-shell">
        <div className="blocked-panel stack">
          <h1 className="heading">Session finished</h1>
          <p className="muted">This page does not have a valid return URL.</p>
          <div className="row">
            <Button variant="ghost" onClick={() => void handleEnd()}>
              End session
            </Button>
            <Button variant="secondary" onClick={() => void handleClose()}>
              Close tab
            </Button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    );
  }

  const remainingMs = getRemainingMs(session, now);
  const remaining = formatClock(remainingMs);
  const progressPct =
    session.plannedMs > 0
      ? Math.min(100, Math.max(0, ((session.plannedMs - remainingMs) / session.plannedMs) * 100))
      : 0;
  const timeLabel = session.status === 'paused' ? remaining : remaining;

  return (
    <div className="blocked-shell">
      <header className="blocked-topbar">
        <div className="blocked-topbar-left">
          <span aria-hidden="true" className="blocked-topbar-logo">
            <IconShield />
          </span>
          <strong>{original.host}</strong>
        </div>
        <div className="blocked-topbar-right">
          <span className="blocked-live-dot" aria-hidden="true" />
          Aegis Guarded
        </div>
      </header>

      <main className="blocked-main">
        <div className="blocked-medallion">
          <div className="blocked-medallion-aura" aria-hidden="true" />
          <div className="blocked-medallion-ring">
            <IconShield />
          </div>
          <div className="blocked-medallion-badge">Golden Aegis Active</div>
        </div>

        <div className="blocked-copy">
          <h1 className="blocked-title">
            You&apos;re currently immersed in <strong>{session.contextName}</strong>.
          </h1>
          <p className="blocked-lede">
            <strong>{original.host}</strong> is peacefully paused until your focus window
            wraps up.
          </p>
        </div>

        <div className="blocked-timer-card">
          <div className="blocked-progress-track" aria-hidden="true">
            <div className="blocked-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="blocked-timer-meta">
            <span className="blocked-session-chip">
              {session.status === 'paused' ? 'Paused' : 'Active Focus Session'}
            </span>
          </div>
          <div className="blocked-countdown">
            <span className="blocked-countdown-value">{timeLabel}</span>
            <span className="blocked-countdown-label">remaining</span>
          </div>
          <p className="blocked-reassure">
            Your concentration is valuable and your future self will thank you.
          </p>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
      </main>
    </div>
  );
}
