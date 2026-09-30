import type { SessionRecord } from './types';

export interface TodayStats {
  focusMs: number;
  sessions: number;
}

export interface WeekContextStat {
  contextId: string;
  contextName: string;
  focusMs: number;
}

function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfNextLocalDay(now: number): number {
  const date = new Date(startOfLocalDay(now));
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

/** Monday 00:00 local time for the week containing `now`. */
export function startOfLocalWeek(now: number): number {
  const date = new Date(startOfLocalDay(now));
  const day = date.getDay(); // 0 = Sunday
  const daysFromMonday = (day + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return date.getTime();
}

function startOfNextLocalWeek(now: number): number {
  const date = new Date(startOfLocalWeek(now));
  date.setDate(date.getDate() + 7);
  return date.getTime();
}

function inRange(endedAt: number, start: number, end: number): boolean {
  return endedAt >= start && endedAt < end;
}

export function getTodayStats(history: SessionRecord[], now: number): TodayStats {
  const start = startOfLocalDay(now);
  const end = startOfNextLocalDay(now);

  let focusMs = 0;
  let sessions = 0;

  for (const record of history) {
    if (!inRange(record.endedAt, start, end)) {
      continue;
    }
    focusMs += record.focusedMs;
    if (record.outcome === 'completed') {
      sessions += 1;
    }
  }

  return { focusMs, sessions };
}

export function getWeekByContext(history: SessionRecord[], now: number): WeekContextStat[] {
  const start = startOfLocalWeek(now);
  const end = startOfNextLocalWeek(now);
  const byContext = new Map<string, WeekContextStat>();

  for (const record of history) {
    if (!inRange(record.endedAt, start, end)) {
      continue;
    }

    const existing = byContext.get(record.contextId);
    if (existing) {
      existing.focusMs += record.focusedMs;
      existing.contextName = record.contextName;
    } else {
      byContext.set(record.contextId, {
        contextId: record.contextId,
        contextName: record.contextName,
        focusMs: record.focusedMs,
      });
    }
  }

  return [...byContext.values()].sort((a, b) => b.focusMs - a.focusMs);
}
