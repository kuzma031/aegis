export type AppMode = 'development' | 'production';

/**
 * Public build mode: set EXPO_PUBLIC_APP_MODE=development for short phases.
 * Unset or any other value → production (same default as vitest / release builds).
 */
export function getAppMode(): AppMode {
  return process.env.EXPO_PUBLIC_APP_MODE === 'development'
    ? 'development'
    : 'production';
}

export function isDevelopmentMode(mode: AppMode = getAppMode()): boolean {
  return mode === 'development';
}
