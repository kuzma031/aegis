import { useEffect, useMemo, useState } from 'react';
import { formatClock } from '@core/format';
import { getRemainingMs } from '@core/session';
import { useAppState } from '../hooks/useAppState';
import { useNow } from '../hooks/useNow';
import { Button } from '../components/Button';
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
            {original
              ? 'Taking you back…'
              : 'Your focus session has ended.'}
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

  const remaining = formatClock(getRemainingMs(session, now));
  const timeLabel =
    session.status === 'paused' ? `Paused · ${remaining}` : remaining;

  return (
    <div className="blocked-shell">
      <div className="blocked-panel stack">
        <p className="subheading">
          You&apos;re currently working on <strong>{session.contextName}</strong>.
        </p>
        <h1 className="heading">
          {original.host} is blocked until your focus session ends.
        </h1>
        <p className="ui-clock" style={{ fontSize: '2rem' }}>
          {timeLabel}
        </p>
        <p className="muted">Come back to it after your break.</p>
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
