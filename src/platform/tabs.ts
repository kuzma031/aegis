import type { TabsAdapter } from './interfaces';

/** Chrome throws these when two navigations race on the same tab. */
function isBenignNavigationError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return /navigation rejected|cannot be edited right now|no tab with id/i.test(
    message,
  );
}

export function createTabsAdapter(): TabsAdapter {
  return {
    async queryAll() {
      const tabs = await chrome.tabs.query({});
      return tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
        .map((tab) => ({ id: tab.id, url: tab.url }));
    },
    async redirect(tabId: number, url: string) {
      try {
        await chrome.tabs.update(tabId, { url });
      } catch (error: unknown) {
        if (isBenignNavigationError(error)) {
          return;
        }
        throw error;
      }
    },
    async getActiveTab() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab || typeof tab.id !== 'number') {
        return null;
      }
      return { id: tab.id, url: tab.url };
    },
  };
}
