import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import { ContextsView } from './ContextsView';
import { HomeView } from './HomeView';
import { StatsView } from './StatsView';

type PopupView = 'home' | 'contexts' | 'stats';

export function App() {
  const { state, loading, error } = useAppState();
  const [view, setView] = useState<PopupView>('home');

  if (loading) {
    return (
      <div className="popup-shell">
        <div className="popup-content">
          <p className="muted">Loading Aegis…</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="popup-shell">
        <div className="popup-content">
          <p className="error-text">{error ?? 'Could not load state'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-shell">
      <div className="popup-content">
        {view === 'home' ? (
          <HomeView state={state} onGoToContexts={() => setView('contexts')} />
        ) : null}
        {view === 'contexts' ? <ContextsView state={state} /> : null}
        {view === 'stats' ? <StatsView state={state} /> : null}
      </div>
      <nav className="popup-nav" aria-label="Main">
        <button
          type="button"
          aria-current={view === 'home' ? 'page' : undefined}
          onClick={() => setView('home')}
        >
          Home
        </button>
        <button
          type="button"
          aria-current={view === 'contexts' ? 'page' : undefined}
          onClick={() => setView('contexts')}
        >
          Contexts
        </button>
        <button
          type="button"
          aria-current={view === 'stats' ? 'page' : undefined}
          onClick={() => setView('stats')}
        >
          Stats
        </button>
      </nav>
    </div>
  );
}
