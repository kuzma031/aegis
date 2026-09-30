import { describe, expect, it } from 'vitest';
import { getTodayStats, getWeekByContext, startOfLocalWeek } from './stats';
import type { SessionRecord } from './types';

function record(
  partial: Pick<SessionRecord, 'id' | 'contextId' | 'contextName' | 'focusedMs' | 'endedAt' | 'outcome'>,
): SessionRecord {
  return {
    plannedMs: partial.focusedMs,
    startedAt: partial.endedAt - partial.focusedMs,
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
});
