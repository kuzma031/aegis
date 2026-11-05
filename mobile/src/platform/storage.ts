import AsyncStorage from '@react-native-async-storage/async-storage';
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

export class AsyncStorageStateRepository implements StateRepository {
  private cache: AppState | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<(state: AppState) => void>();
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  async load(): Promise<AppState> {
    if (this.cache) {
      return this.cache;
    }
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (error: unknown) {
      console.error('[focus] stored state is not valid JSON', error);
    }
    this.cache = migrate(parsed, this.clock.now());
    if (raw == null) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    }
    return this.cache;
  }

  async save(state: AppState): Promise<void> {
    this.cache = state;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
