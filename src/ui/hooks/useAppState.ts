import { useEffect, useState } from 'react';
import type { AppState } from '@core/types';
import { getAppRepository } from '../services/repository';

export function useAppState(): {
  state: AppState | null;
  loading: boolean;
  error: string | null;
} {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const repo = getAppRepository();

    void (async () => {
      try {
        const loaded = await repo.load();
        if (!cancelled) {
          setState(loaded);
          setError(null);
        }
      } catch (err: unknown) {
        console.error('[focus] failed to load state', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load state');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    const unsubscribe = repo.subscribe((next) => {
      setState(next);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { state, loading, error };
}
