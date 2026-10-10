import { describe, expect, it } from 'vitest';
import { formatBadgeText, formatClock, formatDuration, formatMinutesPhrase } from './format';

describe('formatClock', () => {
  it('formats under and over one hour', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(120 * 60_000)).toBe('2h');
    expect(formatDuration(155 * 60_000 + 59_000)).toBe('2h 35m');
  });
});

describe('formatMinutesPhrase', () => {
  it('formats minutes and sub-minute lengths', () => {
    expect(formatMinutesPhrase(50)).toBe('50 minutes');
    expect(formatMinutesPhrase(1)).toBe('1 minute');
    expect(formatMinutesPhrase(0.5)).toBe('30 seconds');
  });
});

describe('formatBadgeText', () => {
  it('shows compact remaining time and paused state', () => {
    expect(formatBadgeText(25 * 60_000, false)).toBe('25m');
    expect(formatBadgeText(90 * 60_000, false)).toBe('90m');
    expect(formatBadgeText(120 * 60_000, false)).toBe('2h');
    expect(formatBadgeText(0, false)).toBe('0m');
    expect(formatBadgeText(10 * 60_000, true)).toBe('||');
  });
});
