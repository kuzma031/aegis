# Aegis

Your attention has a shield.

Aegis is a Manifest V3 Chrome extension for context-based focus sessions. Pick a context, start a timer, and the sites on that context are blocked until the session ends.

## Load unpacked

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

## Scripts

- `npm run build` — production build into `dist/`
- `npm run dev` — rebuild on change
- `npm run typecheck` — TypeScript check
- `npm test` — Vitest

## Architecture

```text
Popup / Blocked page
  -> sendCommand (session) or StateRepository (context CRUD)
Service worker
  -> SessionController + BlockingSync
  -> core domain (pure)
  -> platform adapters (storage, alarms, DNR, tabs, notifications)
chrome.storage.local["focus.state"]
```

### Folder responsibilities

| Path | Role |
| --- | --- |
| `src/core` | Pure domain: contexts, session state machine, site matching, stats, formatting |
| `src/platform` | Chrome API adapters behind interfaces |
| `src/background` | Service worker wiring, commands, blocking sync |
| `src/ui` | React popup and blocked page only — no business rules |

### Timer

Sessions store timestamps, not ticking counters. While running, remaining time is `endsAt - now`. While paused, remaining time is `remainingMs`. The UI derives the clock display from those values. `chrome.alarms` fires at `endsAt` so the service worker can complete the session even after it was suspended.

### Blocking

While a session is active (running or paused), `declarativeNetRequest` dynamic rules redirect matching main-frame navigations to `blocked.html#<original-url>`. Already-open tabs are redirected the same way. When blocking clears, those tabs are restored to the original URL. Storage changes mid-session (for example adding a site) re-sync rules immediately.

## Manual checklist (Chrome)

Run these after loading `dist/`:

- [ ] Start a session, close the popup: it keeps running and blocking still works
- [ ] Restart Chrome mid-session: remaining time is correct and the session continues
- [ ] Restart after `endsAt`: session completes on startup with a notification and blocking off
- [ ] Pause: clock stops, blocking stays on, resume restores the right remaining time
- [ ] Type a blocked URL, open one in a second window, reload a blocked tab — all blocked
- [ ] `old.reddit.com` and `www.reddit.com` are blocked; `notreddit.com` is not
- [ ] Add a site mid-session: it blocks immediately, including the current tab
- [ ] End the session: sites become reachable and blocked tabs return to their originals
- [ ] Delete the selected context; delete the active context (refused); duplicate name (rejected)
- [ ] Notification button **Start another session** reuses context and duration
- [ ] Stop the service worker in `chrome://serviceworker-internals` mid-session; the alarm still fires

## Future extension points

Not implemented in V1:

- Swap or wrap `StateRepository` for sync across devices
- Extend the `Context` type with more metadata
- Replace the blocking adapter (DNR today) without changing core session logic
