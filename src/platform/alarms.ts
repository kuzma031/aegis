import type { AlarmAdapter } from './interfaces';

export const SESSION_END_ALARM = 'session-end';
export const BADGE_TICK_ALARM = 'badge-tick';

/** Chrome enforces a 1-minute minimum period for repeating alarms. */
const BADGE_TICK_PERIOD_MINUTES = 1;

export function createAlarmAdapter(): AlarmAdapter {
  return {
    async schedule(when: number): Promise<void> {
      await chrome.alarms.create(SESSION_END_ALARM, { when });
    },
    async clear(): Promise<void> {
      await chrome.alarms.clear(SESSION_END_ALARM);
    },
    async startBadgeTick(): Promise<void> {
      await chrome.alarms.create(BADGE_TICK_ALARM, {
        periodInMinutes: BADGE_TICK_PERIOD_MINUTES,
      });
    },
    async clearBadgeTick(): Promise<void> {
      await chrome.alarms.clear(BADGE_TICK_ALARM);
    },
  };
}
