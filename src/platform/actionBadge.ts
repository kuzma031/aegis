import { formatBadgeText, formatClock } from '@core/format';
import { getRemainingMs } from '@core/session';
import type { AppState } from '@core/types';
import type { ActionBadgeAdapter } from './interfaces';

const DEFAULT_TITLE = 'Aegis';
const BADGE_COLOR = '#3d6b5a';

export function createActionBadgeAdapter(): ActionBadgeAdapter {
  return {
    async sync(state: AppState, now: number): Promise<void> {
      const session = state.activeSession;
      if (!session) {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: DEFAULT_TITLE });
        return;
      }

      const remainingMs = getRemainingMs(session, now);
      const paused = session.status === 'paused';
      const badge = formatBadgeText(remainingMs, paused);
      const clock = formatClock(remainingMs);
      const title = paused
        ? `Aegis · Paused · ${clock} left`
        : `Aegis · ${clock} remaining`;

      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
      await chrome.action.setBadgeText({ text: badge });
      await chrome.action.setTitle({ title });
    },
  };
}
