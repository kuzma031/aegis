import { describe, expect, it } from 'vitest';
import {
  formatFocusDelta,
  formatTargetLabel,
  getDistractionsBySite,
  getFocusByTask,
  getTodayPeriodStats,
  getTodayStats,
  getWeekByContext,
  getWeekCadence,
  startOfLocalWeek,
} from './stats';
import type { SessionRecord } from './types';

function record(
  partial: Pick<
    SessionRecord,
    'id' | 'contextId' | 'contextName' | 'focusedMs' | 'endedAt' | 'outcome'
  > &
    Partial<
      Pick<
        SessionRecord,
        | 'distractionOverrides'
        | 'pauseCount'
        | 'breakCount'
        | 'breakMs'
        | 'distractionBySite'
        | 'peekStarts'
        | 'peekCount'
        | 'peekAbandoned'
        | 'peekMs'
        | 'taskId'
        | 'taskTitle'
      >
    >,
): SessionRecord {
  return {
    plannedMs: partial.focusedMs,
    startedAt: partial.endedAt - partial.focusedMs,
    distractionOverrides: partial.distractionOverrides ?? 0,
    pauseCount: partial.pauseCount ?? 0,
    breakCount: partial.breakCount ?? 0,
    breakMs: partial.breakMs ?? 0,
    distractionBySite: partial.distractionBySite ?? {},
    peekStarts: partial.peekStarts ?? 0,
    peekCount: partial.peekCount ?? 0,
    peekAbandoned: partial.peekAbandoned ?? 0,
    peekMs: partial.peekMs ?? 0,
    taskId: partial.taskId ?? null,
    taskTitle: partial.taskTitle ?? null,
    ...partial,
  };
}

describe('stats', () => {
  it('counts today focus time including early ends, and completed sessions only', () => {
    const now = new Date(2026, 2, 18, 15, 0, 0).getTime(); // Wed local
    const todayMorning = new Date(2026, 2, 18, 9, 0, 0).getTime();
    const yesterday = new Date(2026, 2, 17, 20, 0, 0).getTime();

    const history = [
      record({
        id: '1',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 50 * 60_000,
        endedAt: todayMorning,
        outcome: 'completed',
      }),
      record({
        id: '2',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 10 * 60_000,
        endedAt: todayMorning + 60_000,
        outcome: 'ended_early',
      }),
      record({
        id: '3',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 25 * 60_000,
        endedAt: yesterday,
        outcome: 'completed',
      }),
    ];

    expect(getTodayStats(history, now)).toEqual({
      focusMs: 60 * 60_000,
      sessions: 1,
    });
  });

  it('groups this week by context with Monday start and descending time', () => {
    // Wednesday March 18, 2026 — week starts Monday March 16
    const now = new Date(2026, 2, 18, 12, 0, 0).getTime();
    expect(new Date(startOfLocalWeek(now)).getDay()).toBe(1);

    const monday = new Date(2026, 2, 16, 10, 0, 0).getTime();
    const sundayBefore = new Date(2026, 2, 15, 10, 0, 0).getTime();
    const nextMonday = new Date(2026, 2, 23, 10, 0, 0).getTime();

    const history = [
      record({
        id: '1',
        contextId: 'a',
        contextName: 'Alpha',
        focusedMs: 30 * 60_000,
        endedAt: monday,
        outcome: 'completed',
      }),
      record({
        id: '2',
        contextId: 'b',
        contextName: 'Beta',
        focusedMs: 90 * 60_000,
        endedAt: monday + 60_000,
        outcome: 'completed',
      }),
      record({
        id: '3',
        contextId: 'a',
        contextName: 'Alpha Renamed',
        focusedMs: 20 * 60_000,
        endedAt: monday + 120_000,
        outcome: 'ended_early',
      }),
      record({
        id: '4',
        contextId: 'b',
        contextName: 'Beta',
        focusedMs: 10 * 60_000,
        endedAt: sundayBefore,
        outcome: 'completed',
      }),
      record({
        id: '5',
        contextId: 'b',
        contextName: 'Beta',
        focusedMs: 10 * 60_000,
        endedAt: nextMonday,
        outcome: 'completed',
      }),
    ];

    expect(getWeekByContext(history, now)).toEqual([
      { contextId: 'b', contextName: 'Beta', focusMs: 90 * 60_000 },
      { contextId: 'a', contextName: 'Alpha Renamed', focusMs: 50 * 60_000 },
    ]);
  });

  it('aggregates peek counters across a period', () => {
    const now = new Date(2026, 2, 18, 15, 0, 0).getTime();
    const todayMorning = new Date(2026, 2, 18, 9, 0, 0).getTime();
    const history = [
      record({
        id: '1',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 25 * 60_000,
        endedAt: todayMorning,
        outcome: 'completed',
        peekStarts: 3,
        peekCount: 2,
        peekAbandoned: 1,
        peekMs: 7 * 60_000,
      }),
      record({
        id: '2',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 10 * 60_000,
        endedAt: todayMorning + 60_000,
        outcome: 'ended_early',
        peekStarts: 1,
        peekCount: 1,
        peekAbandoned: 0,
        peekMs: 2 * 60_000,
      }),
    ];

    expect(getTodayPeriodStats(history, now)).toMatchObject({
      peekStarts: 4,
      peekCount: 3,
      peekAbandoned: 1,
      peekMs: 9 * 60_000,
    });
  });

  it('builds weekday cadence and site distraction rankings', () => {
    const now = new Date(2026, 2, 18, 12, 0, 0).getTime(); // Wed
    const monday = new Date(2026, 2, 16, 10, 0, 0).getTime();
    const wednesday = new Date(2026, 2, 18, 9, 0, 0).getTime();

    const history = [
      record({
        id: '1',
        contextId: 'a',
        contextName: 'A',
        focusedMs: 60 * 60_000,
        endedAt: monday,
        outcome: 'completed',
        distractionBySite: { 'reddit.com': 2 },
      }),
      record({
        id: '2',
        contextId: 'a',
        contextName: 'A',
        focusedMs: 30 * 60_000,
        endedAt: wednesday,
        outcome: 'completed',
        distractionOverrides: 3,
        distractionBySite: { 'reddit.com': 1, 'youtube.com': 5 },
      }),
    ];

    const cadence = getWeekCadence(history, now);
    expect(cadence[0]).toMatchObject({ label: 'M', focusMs: 60 * 60_000, isToday: false });
    expect(cadence[2]).toMatchObject({ label: 'W', focusMs: 30 * 60_000, isToday: true });

    expect(getDistractionsBySite(history, monday, monday + 7 * 24 * 60 * 60_000)).toEqual([
      { site: 'youtube.com', count: 5 },
      { site: 'reddit.com', count: 3 },
    ]);
  });

  it('formats deltas and daily targets', () => {
    expect(formatFocusDelta(40 * 60_000)).toBe('↑ 40m vs prior');
    expect(formatFocusDelta(-2 * 60 * 60_000 - 10 * 60_000)).toBe('↓ 2h 10m vs prior');
    expect(formatFocusDelta(0)).toBe('Same as before');
    expect(formatTargetLabel(240)).toBe('Target: 4h / day');
    expect(formatTargetLabel(90)).toBe('Target: 1h 30m / day');
  });

  it('aggregates focus time by task for a period', () => {
    const today = new Date(2026, 2, 18, 10, 0, 0).getTime();
    const yesterday = new Date(2026, 2, 17, 10, 0, 0).getTime();
    const dayStart = new Date(2026, 2, 18, 0, 0, 0).getTime();
    const dayEnd = dayStart + 24 * 60 * 60_000;

    const history = [
      record({
        id: '1',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 20 * 60_000,
        endedAt: today,
        outcome: 'completed',
        taskId: 't1',
        taskTitle: 'Draft',
      }),
      record({
        id: '2',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 10 * 60_000,
        endedAt: today + 60_000,
        outcome: 'ended_early',
        taskId: 't1',
        taskTitle: 'Draft renamed',
      }),
      record({
        id: '3',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 15 * 60_000,
        endedAt: today + 120_000,
        outcome: 'completed',
        taskId: null,
        taskTitle: null,
      }),
      record({
        id: '4',
        contextId: 'dev',
        contextName: 'Development',
        focusedMs: 40 * 60_000,
        endedAt: yesterday,
        outcome: 'completed',
        taskId: 't1',
        taskTitle: 'Draft',
      }),
    ];

    expect(getFocusByTask(history, dayStart, dayEnd)).toEqual([
      { taskId: 't1', taskTitle: 'Draft renamed', focusMs: 30 * 60_000 },
      { taskId: null, taskTitle: 'Unassigned', focusMs: 15 * 60_000 },
    ]);
  });
});
