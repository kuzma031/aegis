import type { AppState } from '@core/types';
import type { Clock } from './clock';
import { migrate } from './migrations';

export const STORAGE_KEY = 'focus.state';

export interface StateRepository {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  update(fn: (state: AppState) => AppState): Promise<AppState>;
  subscribe(cb: (state: AppState) => void): () => void;
}

export class MemoryStateRepository implements StateRepository {
  private state: AppState | null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<(state: AppState) => void>();
  private readonly clock: Clock;

  constructor(clock: Clock, initial: AppState | null = null) {
    this.clock = clock;
    this.state = initial;
  }

  async load(): Promise<AppState> {
    if (this.state == null) {
      this.state = migrate(null, this.clock.now());
    }
    return this.state;
  }

  async save(state: AppState): Promise<void> {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  update(fn: (state: AppState) => AppState): Promise<AppState> {
    const run = this.queue.then(async () => {
      const current = await this.load();
      const next = fn(current);
      await this.save(next);
      return next;
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  subscribe(cb: (state: AppState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

export class ChromeStateRepository implements StateRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  async load(): Promise<AppState> {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return migrate(stored[STORAGE_KEY], this.clock.now());
  }

  async save(state: AppState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  update(fn: (state: AppState) => AppState): Promise<AppState> {
    const run = this.queue.then(async () => {
      const current = await this.load();
      const next = fn(current);
      await this.save(next);
      return next;
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  subscribe(cb: (state: AppState) => void): () => void {
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName,
    ) => {
      if (areaName !== 'local') {
        return;
      }
      const change = changes[STORAGE_KEY];
      if (!change || change.newValue === undefined) {
        return;
      }
      cb(migrate(change.newValue, this.clock.now()));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}
