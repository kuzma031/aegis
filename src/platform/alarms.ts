import type { AlarmAdapter } from './interfaces';

export const SESSION_END_ALARM = 'session-end';

export function createAlarmAdapter(): AlarmAdapter {
  return {
    async schedule(when: number): Promise<void> {
      await chrome.alarms.create(SESSION_END_ALARM, { when });
    },
    async clear(): Promise<void> {
      await chrome.alarms.clear(SESSION_END_ALARM);
    },
  };
}
