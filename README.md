# Wardfocus

Your attention has a shield.

Wardfocus is a Manifest V3 Chrome extension for context-based focus sessions. Pick a context, start a timer, and the sites on that context are blocked until the session ends.

## Load unpacked

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

## Scripts

- `npm run build` — production build into `dist/`, then check that the unpacked files are present
- `npm run dev` — rebuild on change, in development mode (shorter timers are allowed)
- `npm run typecheck` — TypeScript check
- `npm test` — Vitest
- `npm run icons` — regenerate the toolbar icons from `public/icons/logo.svg`

## Documentation

- [Overview](docs/overview.md) — what a session is, and the features that exist
- [How it works](docs/how-it-works.md) — popup, side panel, blocked page, service worker, storage, alarms, and blocking
- [Settings and stats](docs/settings-and-stats.md) — options, limits, and what is recorded
- [Development](docs/development.md) — where the code lives, and a manual checklist for Chrome
