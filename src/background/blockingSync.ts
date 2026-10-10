import { isBlocked } from '@core/domain';
import type { AppState } from '@core/types';
import {
  buildBlockedPageUrl,
  isExtensionBlockedPageUrl,
  parseOriginalUrlFromBlocked,
} from '@platform/blockingRules';
import type { BlockingAdapter, TabsAdapter } from '@platform/interfaces';

export function sitesToBlock(state: AppState): string[] {
  const session = state.activeSession;
  if (!session) {
    return [];
  }
  const context = state.contexts.find((item) => item.id === session.contextId);
  if (!context) {
    return [];
  }
  if (session.phase === 'focus') {
    return context.sites;
  }
  if (session.phase === 'break' && context.blockDuringBreak) {
    return context.sites;
  }
  return [];
}

export function sitesKey(sites: string[]): string {
  return [...sites].sort().join('\0');
}

export interface BlockingSynchronizer {
  syncFromState(state: AppState): Promise<void>;
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

  async syncFromState(state: AppState): Promise<void> {
    const sites = sitesToBlock(state);
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
    }
  }
}
