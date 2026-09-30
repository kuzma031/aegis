import { useEffect, useState } from 'react';

export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!enabled) {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
