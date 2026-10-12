import type { AppState } from '@core/types';

export interface BlockingAdapter {
  sync(sites: string[]): Promise<void>;
}

export interface AlarmAdapter {
  schedule(when: number): Promise<void>;
  clear(): Promise<void>;
  startBadgeTick(): Promise<void>;
  clearBadgeTick(): Promise<void>;
}

export interface NotificationButton {
  title: string;
}

export interface NotificationAdapter {
  show(title: string, message: string): Promise<void>;
  /** Choice notification with up to two buttons (Chrome limit). */
  showChoice(
    id: string,
    title: string,
    message: string,
    buttons: NotificationButton[],
  ): Promise<void>;
  clear(id?: string): Promise<void>;
}

export interface ActionBadgeAdapter {
  sync(state: AppState, now: number): Promise<void>;
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

export const noopActionBadgeAdapter: ActionBadgeAdapter = {
  async sync(): Promise<void> {
    // Optional in tests.
  },
};
