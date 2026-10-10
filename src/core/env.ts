export type AppMode = 'development' | 'production';

/**
 * Vite build mode: `npm run dev` (`vite build --mode development`) → development,
 * `npm run build` → production.
 *
 * Use MODE, not `import.meta.env.DEV` — DEV is false for any `vite build`,
 * even when `--mode development` is set.
 */
export function getAppMode(): AppMode {
  return import.meta.env.MODE === 'development' ? 'development' : 'production';
}

export function isDevelopmentMode(mode: AppMode = getAppMode()): boolean {
  return mode === 'development';
}
