# Wardfocus Mobile

Expo (React Native) port of the Wardfocus focus timer. Shares the pure session engine from the Chrome extension under `src/core`.

## Requirements

- Node 20+
- Expo Go or a development build (Android emulator works from Windows; iOS needs macOS or EAS)

## Setup

```powershell
cd mobile
npm install
```

Optional short phases for testing:

```powershell
copy .env.example .env
```

Set `EXPO_PUBLIC_APP_MODE=development` to allow focus/break lengths down to 1 second.

## Run

```powershell
npm start
# or
npm run android
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` / `npm run ios` | Open on a platform |
| `npm test` | Vitest (core + controller) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run icons` | Regenerate app icons from `../public/icons/logo.svg` |

## Notifications and sound

Phase-end local notifications are scheduled while a session is running. Custom notification sound (`assets/sounds/bell.wav`) requires a **development or production build** — Expo Go does not play custom notification sounds.

```powershell
npx eas build --profile development --platform android
npx eas build --profile development --platform ios
```

In-app completion bell uses `assets/sounds/freesound-bell.mp3` via `expo-audio` when the app is in the foreground.

## Scope notes

- No Settings screen (audio/task presentation settings stay at defaults).
- Site lists, peeks, and the blocked preview screen are present; real OS-level blocking is not implemented yet.
- Open a blocked preview from Context detail by tapping a site name during a focus session (`wardfocus://blocked?host=…`).
