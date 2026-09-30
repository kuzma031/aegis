import { describe, expect, it } from 'vitest';
import { BlockingSync, sitesToBlock } from './blockingSync';
import { createInitialState, DEVELOPMENT_CONTEXT_ID } from '@core/seed';
import { startSession, pauseSession, endSession } from '@core/session';
import type { AppState } from '@core/types';
import { buildBlockedPageUrl } from '@platform/blockingRules';
import type { BlockingAdapter, TabInfo, TabsAdapter } from '@platform/interfaces';

function createFakeBlocking(): BlockingAdapter & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async sync(sites: string[]) {
      calls.push([...sites]);
    },
  };
}

function createFakeTabs(initial: TabInfo[]): TabsAdapter & { tabs: TabInfo[] } {
  const tabs = initial.map((tab) => ({ ...tab }));
  return {
    tabs,
    async queryAll() {
      return tabs.map((tab) => ({ ...tab }));
    },
    async redirect(tabId: number, url: string) {
      const tab = tabs.find((item) => item.id === tabId);
      if (tab) {
        tab.url = url;
      }
    },
    async getActiveTab() {
      return tabs[0] ?? null;
    },
  };
}

describe('sitesToBlock', () => {
  const NOW = 1_700_000_000_000;

  it('returns context sites while running or paused, otherwise empty', () => {
    let state = createInitialState(NOW);
    expect(sitesToBlock(state)).toEqual([]);

    const started = startSession(state, DEVELOPMENT_CONTEXT_ID, 25, NOW);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.value;
    expect(sitesToBlock(state)).toEqual([
      'reddit.com',
      'youtube.com',
      'instagram.com',
      'x.com',
    ]);

    const paused = pauseSession(state, NOW + 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(sitesToBlock(paused.value)).toEqual(sitesToBlock(state));

    const ended = endSession(paused.value, NOW + 120_000);
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(sitesToBlock(ended.value)).toEqual([]);
  });
});

describe('BlockingSync', () => {
  const NOW = 1_700_000_000_000;
  const EXT = 'ext-id';

  function activeState(): AppState {
    const started = startSession(
      createInitialState(NOW),
      DEVELOPMENT_CONTEXT_ID,
      25,
      NOW,
    );
    if (!started.ok) {
      throw new Error('failed to start');
    }
    return started.value;
  }

  it('syncs sites when a session is running and skips unchanged repeats', async () => {
    const blocking = createFakeBlocking();
    const tabs = createFakeTabs([]);
    const sync = new BlockingSync(blocking, tabs, EXT);
    const state = activeState();

    await sync.syncFromState(state);
    await sync.syncFromState(state);

    expect(blocking.calls).toHaveLength(1);
    expect(blocking.calls[0]).toEqual([
      'reddit.com',
      'youtube.com',
      'instagram.com',
      'x.com',
    ]);
  });

  it('keeps blocking while paused', async () => {
    const blocking = createFakeBlocking();
    const tabs = createFakeTabs([]);
    const sync = new BlockingSync(blocking, tabs, EXT);
    const started = activeState();
    const paused = pauseSession(started, NOW + 60_000);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;

    await sync.syncFromState(paused.value);
    expect(blocking.calls[0]).toEqual([
      'reddit.com',
      'youtube.com',
      'instagram.com',
      'x.com',
    ]);
  });

  it('clears rules when idle', async () => {
    const blocking = createFakeBlocking();
    const tabs = createFakeTabs([]);
    const sync = new BlockingSync(blocking, tabs, EXT);

    await sync.syncFromState(activeState());
    await sync.syncFromState(createInitialState(NOW));

    expect(blocking.calls[1]).toEqual([]);
  });

  it('redirects already-open matching tabs and restores them when unblocked', async () => {
    const blocking = createFakeBlocking();
    const tabs = createFakeTabs([
      { id: 1, url: 'https://old.reddit.com/r/all' },
      { id: 2, url: 'https://example.com' },
      { id: 3, url: 'https://notreddit.com' },
    ]);
    const sync = new BlockingSync(blocking, tabs, EXT);

    await sync.syncFromState(activeState());

    expect(tabs.tabs[0]?.url).toBe(
      buildBlockedPageUrl(EXT, 'https://old.reddit.com/r/all'),
    );
    expect(tabs.tabs[1]?.url).toBe('https://example.com');
    expect(tabs.tabs[2]?.url).toBe('https://notreddit.com');

    await sync.syncFromState(createInitialState(NOW));
    expect(tabs.tabs[0]?.url).toBe('https://old.reddit.com/r/all');
  });

  it('blocks newly added sites mid-session via storage-driven sync', async () => {
    const blocking = createFakeBlocking();
    const tabs = createFakeTabs([{ id: 1, url: 'https://news.ycombinator.com' }]);
    const sync = new BlockingSync(blocking, tabs, EXT);

    let state = activeState();
    await sync.syncFromState(state);

    state = {
      ...state,
      contexts: state.contexts.map((context) =>
        context.id === DEVELOPMENT_CONTEXT_ID
          ? { ...context, sites: [...context.sites, 'news.ycombinator.com'] }
          : context,
      ),
    };

    await sync.syncFromState(state);
    expect(blocking.calls[1]).toContain('news.ycombinator.com');
    expect(tabs.tabs[0]?.url).toBe(
      buildBlockedPageUrl(EXT, 'https://news.ycombinator.com'),
    );
  });
});
