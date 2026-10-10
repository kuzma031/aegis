import type { SessionRecord } from './types';

export interface PeriodStats {
  focusMs: number;
  /** Completed focus sessions only. */
  sessionsCompleted: number;
  /** All focus sessions including early ends. */
  sessionsTotal: number;
  distractionOverrides: number;
  pauseCount: number;
  breakCount: number;
  breakMs: number;
}

export interface TodayStats {
  focusMs: number;
  sessions: number;
}

export interface WeekContextStat {
  contextId: string;
  contextName: string;
  focusMs: number;
}

export interface SiteDistractionStat {
  site: string;
  count: number;
}

export interface TaskFocusStat {
  taskId: string | null;
  taskTitle: string;
  focusMs: number;
}

export interface DayCadenceStat {
  /** 0 = Monday … 6 = Sunday */
  dayIndex: number;
  label: string;
  focusMs: number;
  isToday: boolean;
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

function emptyPeriodStats(): PeriodStats {
  return {
    focusMs: 0,
    sessionsCompleted: 0,
    sessionsTotal: 0,
    distractionOverrides: 0,
    pauseCount: 0,
    breakCount: 0,
    breakMs: 0,
  };
}

export function getPeriodStats(
  history: SessionRecord[],
  start: number,
  end: number,
): PeriodStats {
  const stats = emptyPeriodStats();

  for (const record of history) {
    if (!inRange(record.endedAt, start, end)) {
      continue;
    }
    stats.focusMs += record.focusedMs;
    stats.sessionsTotal += 1;
    if (record.outcome === 'completed') {
      stats.sessionsCompleted += 1;
    }
    stats.distractionOverrides += record.distractionOverrides;
    stats.pauseCount += record.pauseCount;
    stats.breakCount += record.breakCount;
    stats.breakMs += record.breakMs;
  }

  return stats;
}

export function getTodayStats(history: SessionRecord[], now: number): TodayStats {
  const period = getPeriodStats(history, startOfLocalDay(now), startOfNextLocalDay(now));
  return {
    focusMs: period.focusMs,
    sessions: period.sessionsCompleted,
  };
}

export function getTodayPeriodStats(history: SessionRecord[], now: number): PeriodStats {
  return getPeriodStats(history, startOfLocalDay(now), startOfNextLocalDay(now));
}

export function getYesterdayPeriodStats(history: SessionRecord[], now: number): PeriodStats {
  const todayStart = startOfLocalDay(now);
  return getPeriodStats(history, todayStart - 24 * 60 * 60_000, todayStart);
}

export function getWeekPeriodStats(history: SessionRecord[], now: number): PeriodStats {
  return getPeriodStats(history, startOfLocalWeek(now), startOfNextLocalWeek(now));
}

export function getPreviousWeekPeriodStats(history: SessionRecord[], now: number): PeriodStats {
  const weekStart = startOfLocalWeek(now);
  return getPeriodStats(history, weekStart - 7 * 24 * 60 * 60_000, weekStart);
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

export function getPeriodByContext(
  history: SessionRecord[],
  start: number,
  end: number,
): WeekContextStat[] {
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

/** Aggregate focus ms by task snapshot on SessionRecord for a period. */
export function getFocusByTask(
  history: SessionRecord[],
  start: number,
  end: number,
): TaskFocusStat[] {
  const byTask = new Map<string, TaskFocusStat>();

  for (const record of history) {
    if (!inRange(record.endedAt, start, end)) {
      continue;
    }
    const key = record.taskId ?? '__unassigned__';
    const title = record.taskTitle?.trim() || 'Unassigned';
    const existing = byTask.get(key);
    if (existing) {
      existing.focusMs += record.focusedMs;
      if (record.taskTitle?.trim()) {
        existing.taskTitle = record.taskTitle;
      }
    } else {
      byTask.set(key, {
        taskId: record.taskId,
        taskTitle: title,
        focusMs: record.focusedMs,
      });
    }
  }

  return [...byTask.values()].sort(
    (a, b) => b.focusMs - a.focusMs || a.taskTitle.localeCompare(b.taskTitle),
  );
}

export function getDistractionsBySite(
  history: SessionRecord[],
  start: number,
  end: number,
  limit = 5,
): SiteDistractionStat[] {
  const counts = new Map<string, number>();

  for (const record of history) {
    if (!inRange(record.endedAt, start, end)) {
      continue;
    }
    for (const [site, count] of Object.entries(record.distractionBySite)) {
      if (count <= 0) continue;
      counts.set(site, (counts.get(site) ?? 0) + count);
    }
  }

  return [...counts.entries()]
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count || a.site.localeCompare(b.site))
    .slice(0, limit);
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Focus ms for Mon–Sun of the week containing `now`. */
export function getWeekCadence(history: SessionRecord[], now: number): DayCadenceStat[] {
  const weekStart = startOfLocalWeek(now);
  const todayStart = startOfLocalDay(now);
  const byDay = Array.from({ length: 7 }, () => 0);

  for (const record of history) {
    if (!inRange(record.endedAt, weekStart, startOfNextLocalWeek(now))) {
      continue;
    }
    const dayIndex = Math.floor((startOfLocalDay(record.endedAt) - weekStart) / (24 * 60 * 60_000));
    if (dayIndex >= 0 && dayIndex < 7) {
      byDay[dayIndex]! += record.focusedMs;
    }
  }

  return byDay.map((focusMs, dayIndex) => {
    const dayStart = weekStart + dayIndex * 24 * 60 * 60_000;
    return {
      dayIndex,
      label: WEEKDAY_LABELS[dayIndex]!,
      focusMs,
      isToday: dayStart === todayStart,
    };
  });
}

export function completionRate(stats: PeriodStats): number | null {
  if (stats.sessionsTotal === 0) {
    return null;
  }
  return stats.sessionsCompleted / stats.sessionsTotal;
}

/** Signed focus-time delta vs a comparison period (positive = improved). */
export function focusMsDelta(current: PeriodStats, previous: PeriodStats): number {
  return current.focusMs - previous.focusMs;
}

export function formatFocusDelta(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const totalMinutes = Math.round(abs / 60_000);
  if (totalMinutes <= 0) {
    return 'Same as before';
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let amount: string;
  if (hours > 0 && minutes > 0) {
    amount = `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    amount = `${hours}h`;
  } else {
    amount = `${minutes}m`;
  }
  return deltaMs >= 0 ? `↑ ${amount} vs prior` : `↓ ${amount} vs prior`;
}

export function formatTargetLabel(dailyFocusTargetMinutes: number): string {
  const hours = dailyFocusTargetMinutes / 60;
  if (Number.isInteger(hours)) {
    return `Target: ${hours}h / day`;
  }
  if (dailyFocusTargetMinutes >= 60) {
    const h = Math.floor(dailyFocusTargetMinutes / 60);
    const m = dailyFocusTargetMinutes % 60;
    return m > 0 ? `Target: ${h}h ${m}m / day` : `Target: ${h}h / day`;
  }
  return `Target: ${dailyFocusTargetMinutes}m / day`;
}
