import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!enabled) {
      return;
    }
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        setNow(Date.now());
      }
    });

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [enabled, intervalMs]);

  return now;
}
