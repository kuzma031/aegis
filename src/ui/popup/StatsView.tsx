import { useMemo, useState } from 'react';
import { formatDuration } from '@core/format';
import {
  completionRate,
  focusMsDelta,
  formatFocusDelta,
  getDistractionsBySite,
  getFocusByTask,
  getPreviousWeekPeriodStats,
  getTodayPeriodStats,
  getWeekCadence,
  getWeekPeriodStats,
  getYesterdayPeriodStats,
  startOfLocalWeek,
  type DayCadenceStat,
  type PeriodStats,
} from '@core/stats';
import type { AppState } from '@core/types';
import { IconChevronDown, IconShield } from '../components/icons';
import { useNow } from '../hooks/useNow';

function formatCompletion(stats: PeriodStats): string {
  const rate = completionRate(stats);
  if (rate == null) {
    return 'No sessions yet';
  }
  return `${Math.round(rate * 100)}% completion`;
}

function cadenceTone(
  day: DayCadenceStat,
  maxMs: number,
): 'warm' | 'warmer' | 'hot' | 'hotter' | 'today' | 'muted' {
  if (day.focusMs <= 0) {
    return 'muted';
  }
  if (day.isToday) {
    return 'today';
  }
  const ratio = maxMs > 0 ? day.focusMs / maxMs : 0;
  if (ratio >= 0.85) return 'hotter';
  if (ratio >= 0.65) return 'hot';
  if (ratio >= 0.4) return 'warmer';
  return 'warm';
}

function cadenceHeight(focusMs: number, maxMs: number): number {
  if (focusMs <= 0 || maxMs <= 0) {
    return 8;
  }
  return Math.max(12, Math.round((focusMs / maxMs) * 58));
}

export function StatsView({ state }: { state: AppState }) {
  const now = useNow(false);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  /** null = All contexts combined */
  const [statsContextId, setStatsContextId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedContext =
    statsContextId == null
      ? null
      : (state.contexts.find((context) => context.id === statsContextId) ?? null);
  const headerLabel = selectedContext?.name ?? 'All';

  const derived = useMemo(() => {
    const history =
      statsContextId == null
        ? state.history
        : state.history.filter((record) => record.contextId === statsContextId);

    const current =
      period === 'today'
        ? getTodayPeriodStats(history, now)
        : getWeekPeriodStats(history, now);
    const previous =
      period === 'today'
        ? getYesterdayPeriodStats(history, now)
        : getPreviousWeekPeriodStats(history, now);
    const rangeStart =
      period === 'today'
        ? new Date(now).setHours(0, 0, 0, 0)
        : startOfLocalWeek(now);
    const rangeEnd =
      period === 'today' ? rangeStart + 24 * 60 * 60_000 : rangeStart + 7 * 24 * 60 * 60_000;
    const sites = getDistractionsBySite(history, rangeStart, rangeEnd, 4);
    const byTask = getFocusByTask(history, rangeStart, rangeEnd);
    const cadence = getWeekCadence(history, now);
    const maxCadence = Math.max(...cadence.map((day) => day.focusMs), 1);

    return {
      current,
      previous,
      sites,
      byTask,
      cadence,
      maxCadence,
      siteTotal: sites.reduce((sum, item) => sum + item.count, 0),
    };
  }, [state.history, period, now, statsContextId]);

  const {
    current,
    previous,
    sites,
    byTask,
    cadence,
    maxCadence,
    siteTotal,
  } = derived;
  const delta = focusMsDelta(current, previous);
  const topSiteCount = sites[0]?.count ?? 0;
  const assignedTaskCount = byTask.filter((item) => item.taskId != null).length;
  const taskCountLabel =
    assignedTaskCount > 0
      ? `${assignedTaskCount} task${assignedTaskCount === 1 ? '' : 's'}`
      : byTask.length > 0
        ? 'Unassigned only'
        : 'None yet';

  return (
    <>
      <header className="screen-header">
        <div className="screen-header-left">
          <div className="screen-header-icon screen-header-icon-soft" aria-hidden="true">
            <IconShield />
          </div>
          <div className="screen-header-meta">
            <span className="screen-eyebrow">Showing stats for</span>
            <div className="screen-title">
              <span className="screen-title-text">{headerLabel}</span>
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
        <ul className="picker-list" aria-label="Stats context">
          <li>
            <button
              type="button"
              aria-current={statsContextId == null ? 'true' : undefined}
              onClick={() => {
                setStatsContextId(null);
                setPickerOpen(false);
              }}
            >
              All
            </button>
          </li>
          {state.contexts.map((context) => (
            <li key={context.id}>
              <button
                type="button"
                aria-current={context.id === statsContextId ? 'true' : undefined}
                onClick={() => {
                  setStatsContextId(context.id);
                  setPickerOpen(false);
                }}
              >
                {context.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="screen-body-scroll">
        <div className="period-toggle period-toggle-full" role="group" aria-label="Period">
          <button
            type="button"
            aria-pressed={period === 'today'}
            onClick={() => setPeriod('today')}
          >
            Today
          </button>
          <button
            type="button"
            aria-pressed={period === 'week'}
            onClick={() => setPeriod('week')}
          >
            7 Days
          </button>
        </div>

        <div className="stats-grid">
          <div className="stats-metric stats-metric-accent">
            <span className="stats-metric-label">Deep Flow Time</span>
            <div className="stats-metric-value">{formatDuration(current.focusMs)}</div>
            <div className="stats-metric-delta">{formatFocusDelta(delta)}</div>
          </div>
          <div className="stats-metric">
            <span className="stats-metric-label">Sessions Shielded</span>
            <div className="stats-metric-value">
              {current.sessionsCompleted} <span>done</span>
            </div>
            <div className="stats-metric-delta stats-metric-delta-amber">
              {formatCompletion(current)}
            </div>
          </div>
        </div>

        {period === 'week' ? (
          <div className="stats-panel">
            <div className="stats-panel-head">
              <strong>Weekly Focus Cadence</strong>
            </div>
            <div className="cadence-bars" aria-hidden="true">
              {cadence.map((day) => (
                <CadenceCol
                  key={`${day.dayIndex}-${day.label}`}
                  label={day.label}
                  height={cadenceHeight(day.focusMs, maxCadence)}
                  tone={cadenceTone(day, maxCadence)}
                  today={day.isToday}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="stats-panel">
          <div className="stats-panel-head">
            <strong>Peeks</strong>
            <span className="accent">
              {current.peekCount > 0
                ? `${current.peekCount} taken`
                : current.peekStarts > 0
                  ? 'None completed'
                  : 'None yet'}
            </span>
          </div>
          <div className="ward-row">
            <span>Peeks started</span>
            <strong>{current.peekStarts}</strong>
          </div>
          <div className="ward-row" style={{ paddingTop: 4 }}>
            <span>Peeks taken</span>
            <strong>{current.peekCount}</strong>
          </div>
          <div className="ward-row" style={{ paddingTop: 4 }}>
            <span>Peek time unlocked</span>
            <strong>{formatDuration(current.peekMs)}</strong>
          </div>
          <div className="ward-row" style={{ paddingTop: 4 }}>
            <span>Peeks cancelled</span>
            <strong>{current.peekAbandoned}</strong>
          </div>
        </div>

        <div className="stats-panel">
          <div className="stats-panel-head">
            <strong>Distractions Warded Off</strong>
            <span className="accent">
              {siteTotal > 0
                ? `${siteTotal} blocked visit${siteTotal === 1 ? '' : 's'}`
                : current.distractionOverrides > 0
                  ? `${current.distractionOverrides} blocked visit${current.distractionOverrides === 1 ? '' : 's'}`
                  : 'None yet'}
            </span>
          </div>
          {sites.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Blocked sites you open during focus will show up here.
            </p>
          ) : (
            <div>
              {sites.map((item, index) => (
                <div key={item.site}>
                  <div
                    className="ward-row"
                    style={index > 0 ? { paddingTop: 4 } : undefined}
                  >
                    <span>{item.site}</span>
                    <strong>{item.count} deflected</strong>
                  </div>
                  <div className="ward-track">
                    <div
                      className="ward-fill"
                      style={{
                        width: `${Math.max(8, Math.round((item.count / topSiteCount) * 100))}%`,
                        background: index === 0 ? undefined : '#b45309',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stats-panel">
          <div className="stats-panel-head">
            <strong>Focus by task</strong>
            <span className="accent">{taskCountLabel}</span>
          </div>
          {byTask.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Mark a task Working during focus to attribute time here.
            </p>
          ) : (
            <div>
              {byTask.map((item, index) => (
                <div
                  key={item.taskId ?? `unassigned-${index}`}
                  className="ward-row"
                  style={index > 0 ? { paddingTop: 6 } : undefined}
                >
                  <span>{item.taskTitle}</span>
                  <strong>{formatDuration(item.focusMs)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stats-panel">
          <div className="stats-panel-head">
            <strong>Session rhythm</strong>
            <span>
              {current.pauseCount} pause{current.pauseCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="ward-row">
            <span>Break time</span>
            <strong>{formatDuration(current.breakMs)}</strong>
          </div>
          <div className="ward-row" style={{ paddingTop: 4 }}>
            <span>Breaks taken</span>
            <strong>{current.breakCount}</strong>
          </div>
        </div>
      </div>
    </>
  );
}

function CadenceCol({
  label,
  height,
  tone,
  today = false,
}: {
  label: string;
  height: number;
  tone: 'warm' | 'warmer' | 'hot' | 'hotter' | 'today' | 'muted';
  today?: boolean;
}) {
  const colors: Record<typeof tone, string> = {
    warm: '#fde68a',
    warmer: '#fcd34d',
    hot: '#fbbf24',
    hotter: '#f59e0b',
    today: '#b45309',
    muted: 'rgba(226, 232, 240, 0.8)',
  };

  return (
    <div className="cadence-col">
      <div
        className={`cadence-bar${today ? ' cadence-bar-today' : ''}${tone === 'muted' ? ' cadence-bar-muted' : ''}`}
        style={{ height, background: colors[tone] }}
      />
      <span className={`cadence-label${today ? ' cadence-label-today' : ''}`}>{label}</span>
    </div>
  );
}
