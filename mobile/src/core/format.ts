export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatDuration(ms: number): string {
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

/** Human label for focus/break lengths, e.g. "50 minutes" or "30 seconds". */
export function formatMinutesPhrase(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    return '0 minutes';
  }
  const ms = Math.round(minutes * 60_000);
  if (ms < 60_000) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return seconds === 1 ? '1 second' : `${seconds} seconds`;
  }
  const whole = Number.isInteger(minutes) ? minutes : Math.round(minutes * 10) / 10;
  return whole === 1 ? '1 minute' : `${whole} minutes`;
}

/** Compact remaining-time label for the Chrome action badge (~4 chars). */
export function formatBadgeText(remainingMs: number, paused: boolean): string {
  if (paused) {
    return '||';
  }
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  if (totalMinutes <= 0) {
    return '0m';
  }
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
      return `${hours}h`;
    }
    if (totalMinutes < 100) {
      return `${totalMinutes}m`;
    }
    return `${hours}h`;
  }
  return `${totalMinutes}m`;
}
