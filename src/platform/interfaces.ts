import type { SessionRecord } from '@core/types';

export interface BlockingAdapter {
  sync(sites: string[]): Promise<void>;
}

export interface AlarmAdapter {
  schedule(when: number): Promise<void>;
  clear(): Promise<void>;
}

export interface NotificationAdapter {
  showSessionComplete(record: SessionRecord): Promise<void>;
  clear(): Promise<void>;
}

export interface TabInfo {
  id: number;
  url?: string;
}

export interface TabsAdapter {
  queryAll(): Promise<TabInfo[]>;
  redirect(tabId: number, url: string): Promise<void>;
  getActiveTab(): Promise<TabInfo | null>;
}

export const noopBlockingAdapter: BlockingAdapter = {
  async sync(): Promise<void> {
    // Phase 4 wires real blocking.
  },
};
