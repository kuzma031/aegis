# Development

## Build and load

From the repository root:

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

`npm run build` is `vite build && node scripts/verify-dist.mjs`. The Vite build writes the popup, blocked page, side panel, and service worker into `dist/`, then builds `content.js` as a single script. `verify-dist` checks that the manifest, pages, worker, content script, offscreen document, icons, and sound files are present, and that the HTML uses relative asset URLs.

`npm run dev` is `vite build --watch --mode development`. It rebuilds into `dist/` on change. Development mode is what allows focus and break lengths down to 1 second. `npm run build` is production mode: lengths use 0.5 minute steps and the 0.5 minute minimum. After a rebuild, click **Reload** on the extension's card at `chrome://extensions`.

`npm run typecheck` runs `tsc --noEmit`. `npm test` runs Vitest once and exits. `npm run icons` regenerates the PNG icons from `public/icons/logo.svg`.

Load the `dist/` folder, not the repository root. The root `manifest.json` is the source copy under `public/`; Chrome needs the built one.

## Layout

| Path | Role |
| --- | --- |
| `src/core` | Pure domain: contexts, the session state machine, site matching, tasks, stats, formatting. No Chrome APIs. |
| `src/platform` | Chrome adapters behind small interfaces: storage, alarms, declarativeNetRequest, tabs, notifications, badge, offscreen audio. |
| `src/background` | Service worker: command dispatch, session controller, blocking sync. |
| `src/ui` | React popup, side panel, and blocked page. Design tokens live in `src/ui/styles/tokens.css`. |
| `src/content` | Page-edge task rail and peek chip. |
| `public/` | Manifest, icons, sounds, offscreen page. Copied into `dist/`. |

Session commands (`START_SESSION`, `PAUSE_SESSION`, `RESUME_SESSION`, `END_SESSION`, `EXTEND_FOCUS`, `START_BREAK`, `CONTINUE_FOCUS`, `DISMISS_COMPLETION`, `RECORD_DISTRACTION`, `BEGIN_PEEK_WAIT`, `CLEAR_PEEK_WAIT`, `ALLOW_PEEK`, `CHECK_EXPIRED`) are messages to the worker. Creating a context, editing sites, and editing tasks call the storage repository from the page.

## Manual checklist

Run these after loading `dist/`:

- [ ] Start a session, close the popup: it keeps running and blocking still works
- [ ] Restart Chrome mid-session: remaining time is correct and the session continues
- [ ] Restart after `endsAt`: the phase completes on startup, with a notification, and blocking matches the next state
- [ ] Pause: the clock stops, blocking stays on, resume restores the remaining time
- [ ] Type a blocked URL, open one in a second window, reload a blocked tab — all blocked
- [ ] `old.reddit.com` and `www.reddit.com` are blocked when the site is `reddit.com`; `notreddit.com` is not
- [ ] Add a site mid-session: it blocks immediately, including the current tab
- [ ] End the session: sites load again and blocked tabs return to their original URLs
- [ ] Delete the selected context; delete the active context (refused); duplicate name (rejected)
- [ ] Stop the service worker in `chrome://serviceworker-internals` mid-session; the end alarm still fires
