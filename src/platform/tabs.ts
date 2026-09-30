import type { TabsAdapter } from './interfaces';

export function createTabsAdapter(): TabsAdapter {
  return {
    async queryAll() {
      const tabs = await chrome.tabs.query({});
      return tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
        .map((tab) => ({ id: tab.id, url: tab.url }));
    },
    async redirect(tabId: number, url: string) {
      await chrome.tabs.update(tabId, { url });
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
