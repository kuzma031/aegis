import { isBlocked } from '@core/domain';
import { activePeekHosts } from '@core/session';
import type { AppState } from '@core/types';
import {
  buildBlockedPageUrl,
  isExtensionBlockedPageUrl,
  parseOriginalUrlFromBlocked,
} from '@platform/blockingRules';
import type { BlockingAdapter, TabsAdapter } from '@platform/interfaces';

export function sitesToBlock(state: AppState, now = Date.now()): string[] {
  const session = state.activeSession;
  if (!session) {
    return [];
  }
  const context = state.contexts.find((item) => item.id === session.contextId);
  if (!context) {
    return [];
  }
  let sites: string[] = [];
  if (session.phase === 'focus') {
    sites = context.sites;
  } else if (session.phase === 'break' && context.blockDuringBreak) {
    sites = context.sites;
  } else {
    return [];
  }

  const peeked = activePeekHosts(session, now);
  if (peeked.length === 0) {
    return sites;
  }
  const peekedSet = new Set(peeked);
  return sites.filter((site) => !peekedSet.has(site));
}

export function sitesKey(sites: string[]): string {
  return [...sites].sort().join('\0');
}

export interface BlockingSynchronizer {
  syncFromState(state: AppState, now?: number): Promise<void>;
}

export class BlockingSync implements BlockingSynchronizer {
  private lastKey: string | null = null;
  private readonly blocking: BlockingAdapter;
  private readonly tabs: TabsAdapter;
  private readonly extensionId: string;

  constructor(blocking: BlockingAdapter, tabs: TabsAdapter, extensionId: string) {
    this.blocking = blocking;
    this.tabs = tabs;
    this.extensionId = extensionId;
  }

  async syncFromState(state: AppState, now = Date.now()): Promise<void> {
    const sites = sitesToBlock(state, now);
    const key = sitesKey(sites);
    if (key === this.lastKey) {
      return;
    }

    await this.blocking.sync(sites);
    await this.enforceTabs(sites);
    this.lastKey = key;
  }

  /** Test helper: peek at the last synced key. */
  getLastKeyForTests(): string | null {
    return this.lastKey;
  }

  private async enforceTabs(sites: string[]): Promise<void> {
    const tabs = await this.tabs.queryAll();

    for (const tab of tabs) {
      if (!tab.url) {
        continue;
      }

      try {
        if (isExtensionBlockedPageUrl(tab.url, this.extensionId)) {
          const original = parseOriginalUrlFromBlocked(tab.url);
          if (!original) {
            continue;
          }
          if (sites.length === 0 || !isBlocked(original, sites).blocked) {
            await this.tabs.redirect(tab.id, original);
          }
          continue;
        }

        if (sites.length > 0 && isBlocked(tab.url, sites).blocked) {
          await this.tabs.redirect(
            tab.id,
            buildBlockedPageUrl(this.extensionId, tab.url),
          );
        }
      } catch (error: unknown) {
        // One tab failing (closed mid-flight, race) should not abort the rest.
        console.warn('[focus] tab enforce failed', tab.id, error);
      }
    }
  }
}
