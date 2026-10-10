import { useAppState } from '../hooks/useAppState';
import { TasksView } from '../popup/TasksView';

export function SidepanelApp() {
  const { state, loading, error } = useAppState();

  if (loading) {
    return (
      <div className="sidepanel-shell">
        <div className="sidepanel-content" style={{ padding: 16, justifyContent: 'center' }}>
          <p className="muted">Loading Aegis…</p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="sidepanel-shell">
        <div className="sidepanel-content" style={{ padding: 16, justifyContent: 'center' }}>
          <p className="error-text">{error ?? 'Could not load state'}</p>
        </div>
      </div>
    );
  }

  if (state.settings.taskPresentation !== 'sidepanel') {
    return (
      <div className="sidepanel-shell">
        <div className="sidepanel-content" style={{ padding: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Side panel tasks are turned off. Open Aegis → Settings and choose Side panel to use
            this view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidepanel-shell">
      <div className="sidepanel-content">
        <TasksView state={state} />
      </div>
    </div>
  );
}
