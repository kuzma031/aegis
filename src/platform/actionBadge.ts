import { formatBadgeText, formatClock } from '@core/format';
import { getRemainingMs } from '@core/session';
import type { AppState } from '@core/types';
import type { ActionBadgeAdapter } from './interfaces';

const DEFAULT_TITLE = 'Aegis';
/** Matches UI `--color-primary` (amber). Chrome badges cannot use CSS vars. */
const BADGE_BACKGROUND = '#b45309';
/** Matches UI `--color-on-primary`. */
const BADGE_TEXT = '#ffffff';

export function createActionBadgeAdapter(): ActionBadgeAdapter {
  return {
    async sync(state: AppState, now: number): Promise<void> {
      const session = state.activeSession;
      if (!session) {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: DEFAULT_TITLE });
        return;
      }

      if (session.status === 'awaiting') {
        const awaitingTitle =
          session.phase === 'break'
            ? 'Aegis · Break finished · Choose start focus or end'
            : 'Aegis · Focus finished · Choose extend or break';
        await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND });
        await chrome.action.setBadgeTextColor({ color: BADGE_TEXT });
        await chrome.action.setBadgeText({ text: 'Done' });
        await chrome.action.setTitle({ title: awaitingTitle });
        return;
      }

      const remainingMs = getRemainingMs(session, now);
      const paused = session.status === 'paused';
      const badge = formatBadgeText(remainingMs, paused);
      const clock = formatClock(remainingMs);
      const phaseLabel = session.phase === 'break' ? 'Break' : 'Focus';
      const title = paused
        ? `Aegis · ${phaseLabel} paused · ${clock} left`
        : `Aegis · ${phaseLabel} · ${clock} remaining`;

      await chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND });
      await chrome.action.setBadgeTextColor({ color: BADGE_TEXT });
      await chrome.action.setBadgeText({ text: badge });
      await chrome.action.setTitle({ title });
    },
  };
}
