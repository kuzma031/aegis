import { useState } from 'react';
import { useAppState } from '../hooks/useAppState';
import {
  IconContexts,
  IconHome,
  IconSettings,
  IconStats,
  IconTasks,
} from '../components/icons';
import { ContextsView } from './ContextsView';
import { HomeView } from './HomeView';
import { SettingsView } from './SettingsView';
import { StatsView } from './StatsView';
import { TasksView } from './TasksView';

type PopupView = 'home' | 'contexts' | 'tasks' | 'stats' | 'settings';

export function App() {
  const { state, loading, error } = useAppState();
  const [view, setView] = useState<PopupView>('home');
  const [editContextId, setEditContextId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="popup-shell">
        <div className="popup-content" style={{ padding: 16, justifyContent: 'center' }}>
          <p className="muted">Loading Wardfocus…</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="popup-shell">
        <div className="popup-content" style={{ padding: 16, justifyContent: 'center' }}>
          <p className="error-text">{error ?? 'Could not load state'}</p>
        </div>
      </div>
    );
  }

  function go(next: PopupView) {
    setEditContextId(null);
    setView(next);
  }

  return (
    <div className="popup-shell">
      <div className="popup-content">
        {view === 'home' ? (
          <HomeView
            state={state}
            onGoToContexts={() => go('contexts')}
            onEditContext={(contextId) => {
              setEditContextId(contextId);
              setView('contexts');
            }}
          />
        ) : null}
        {view === 'contexts' ? (
          <ContextsView
            state={state}
            initialEditingId={editContextId}
            onConsumedInitialEdit={() => setEditContextId(null)}
          />
        ) : null}
        {view === 'tasks' ? <TasksView state={state} /> : null}
        {view === 'stats' ? <StatsView state={state} /> : null}
        {view === 'settings' ? <SettingsView state={state} /> : null}
      </div>
      <nav className="popup-nav" aria-label="Main">
        <button
          type="button"
          aria-current={view === 'home' ? 'page' : undefined}
          onClick={() => go('home')}
        >
          <IconHome className="popup-nav-icon" strokeWidth={view === 'home' ? 2.5 : 2} />
          <span className="popup-nav-label">Home</span>
        </button>
        <button
          type="button"
          aria-current={view === 'contexts' ? 'page' : undefined}
          onClick={() => go('contexts')}
        >
          <IconContexts
            className="popup-nav-icon"
            strokeWidth={view === 'contexts' ? 2.5 : 2}
          />
          <span className="popup-nav-label">Contexts</span>
        </button>
        <button
          type="button"
          aria-current={view === 'tasks' ? 'page' : undefined}
          onClick={() => go('tasks')}
        >
          <IconTasks className="popup-nav-icon" strokeWidth={view === 'tasks' ? 2.5 : 2} />
          <span className="popup-nav-label">Tasks</span>
        </button>
        <button
          type="button"
          aria-current={view === 'stats' ? 'page' : undefined}
          onClick={() => go('stats')}
        >
          <IconStats className="popup-nav-icon" strokeWidth={view === 'stats' ? 2.5 : 2} />
          <span className="popup-nav-label">Stats</span>
        </button>
        <button
          type="button"
          aria-current={view === 'settings' ? 'page' : undefined}
          onClick={() => go('settings')}
        >
          <IconSettings
            className="popup-nav-icon"
            strokeWidth={view === 'settings' ? 2.5 : 2}
          />
          <span className="popup-nav-label">Settings</span>
        </button>
      </nav>
    </div>
  );
}
