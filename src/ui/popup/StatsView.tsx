import { formatDuration } from '@core/format';
import { getTodayStats, getWeekByContext } from '@core/stats';
import type { AppState } from '@core/types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { useNow } from '../hooks/useNow';

export function StatsView({ state }: { state: AppState }) {
  const now = useNow(false);
  const today = getTodayStats(state.history, now);
  const week = getWeekByContext(state.history, now);
  const weekTotal = week.reduce((sum, row) => sum + row.focusMs, 0);

  if (state.history.length === 0) {
    return (
      <EmptyState
        title="No focus sessions yet"
        description="Start one from Home."
      />
    );
  }

  return (
    <div className="stack">
      <h1 className="heading">Stats</h1>

      <Card>
        <div className="stack">
          <h2 className="heading" style={{ fontSize: '1rem' }}>
            Today
          </h2>
          <p className="muted">Focus time</p>
          <p className="heading">{formatDuration(today.focusMs)}</p>
          <p className="muted">Sessions</p>
          <p className="heading">{today.sessions}</p>
        </div>
      </Card>

      <Card>
        <div className="stack">
          <h2 className="heading" style={{ fontSize: '1rem' }}>
            This week by context
          </h2>
          {week.length === 0 ? (
            <p className="muted">No sessions this week.</p>
          ) : (
            <ul className="list">
              {week.map((row) => (
                <li key={row.contextId} className="list-item">
                  <span>{row.contextName}</span>
                  <span className="muted">{formatDuration(row.focusMs)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">Weekly total · {formatDuration(weekTotal)}</p>
        </div>
      </Card>
    </div>
  );
}
