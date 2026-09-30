import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration } from './format';

describe('formatClock', () => {
  it('formats under and over one hour', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });
});

describe('formatDuration', () => {
  it('formats whole minutes and hours', () => {
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(120 * 60_000)).toBe('2h');
    expect(formatDuration(155 * 60_000 + 59_000)).toBe('2h 35m');
  });
});
