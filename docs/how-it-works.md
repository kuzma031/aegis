# How it works

Wardfocus is a Manifest V3 extension. The popup, side panel, and blocked page are React screens. They do not own the session rules. Session commands go to the service worker. Context, task, and settings edits are written straight to storage, and the worker reacts to that write.

```text
Popup / side panel / blocked page
  -> sendCommand (session) or StateRepository (contexts, tasks, settings)
Service worker
  -> SessionController + BlockingSync
  -> core domain (pure)
  -> platform adapters (storage, alarms, declarativeNetRequest, tabs, notifications, badge, audio)
chrome.storage.local["focus.state"]
```

The content script is separate. It draws the page-edge task rail and the peek countdown. It reads the same storage key. Marking a task from the rail writes that key directly with the same status rules the popup uses. It does not start, pause, or end sessions.

## Surfaces

**Popup** (`popup.html`) is the toolbar action. It is also opened from a notification click, or as a standalone popup window when `chrome.action.openPopup` is unavailable.

**Side panel** (`sidepanel.html`) loads the task list when task presentation is `sidepanel`. The worker enables or disables `chrome.sidePanel` from that setting.

**Blocked page** (`blocked.html`) is where a blocked main-frame navigation lands. The original URL is in the hash. The page shows the host, the context name, and the time left. If the session is gone, or this host's peek is active, it sends the tab back to the original URL. The first time the page loads during a focus phase it records one blocked-site hit for that host. Hits are not counted on breaks.

**Service worker** (`background.js`, from `src/background/index.ts`) starts on install, on browser startup, and whenever Chrome wakes the worker. Startup calls `reconcile`, then syncs ambient audio.

**Offscreen document** (`offscreen.html`) plays the completion bell and the ambient loop. A service worker cannot keep that audio itself.

**Content script** (`content.js`) is injected at `document_idle` on all URLs, top frame only.

## Storage

All app state lives in `chrome.storage.local` under the key `focus.state`. That key is the whole `AppState`: contexts, tasks, settings, the active session (or null), the last run recap, and history.

Writes are queued so two updates cannot clobber each other. The UI and the worker both subscribe to changes of that key. Older saved shapes are patched on load by the migration in `src/platform/migrations.ts`. The storage key itself is not renamed, so an existing install keeps its data.

There is no sync and no account. Clearing extension storage clears Wardfocus.

## Timer

Sessions store timestamps. While a phase is running, time left is `endsAt - now`. While paused, time left is `remainingMs` and `endsAt` is null. The popup and blocked page derive the clock from those fields and repaint locally. They do not ask the worker for a tick.

When a phase starts or resumes, the worker sets a `chrome.alarms` alarm named `session-end` for `endsAt`. That alarm survives the service worker being suspended, so the phase can still finish with the popup closed. Pause and end clear it.

Chrome can delay a one-shot alarm that is less than about 30 seconds away. For a shorter delay the worker also sets a `setTimeout` while it stays alive. A production build's shortest phase is 30 seconds, so that backup matters after a resume that leaves less than 30 seconds, and in development builds, which allow phases down to 1 second. The timeout does not survive a worker restart; the alarm does.

The popup also sends `CHECK_EXPIRED` when its own clock hits zero, so an open popup does not wait on the alarm. Alarm handling is serialized so the alarm and the popup cannot advance the same phase twice.

A second alarm, `badge-tick`, repeats every minute while a phase is running or a peek grant is still active. Each tick updates the badge, drops expired peeks (which turns blocking back on for that host), and completes the phase if `endsAt` has passed.

## What happens when a phase ends

`completeSession` runs only for a running phase whose end time has passed.

A finished **focus** writes a history record: planned length, focused time, outcome `completed`, pause count, blocked-site hits, peeks so far, and the task that was Working at the close (or none). Then:

- Auto-repeat on, and a break is due: the break phase starts. Long-break rules pick the length.
- Auto-repeat on, and the break length is 0: the next focus starts at the stored focus length.
- Auto-repeat off: status becomes `awaiting`. Blocking for a focus stays up, because the phase is still focus. The notification and Home ask for extend, break, or end.

A finished **break** adds its break time, and any peeks taken during the break, onto the latest focus record. It does not create its own history row. Then:

- Auto-repeat on: the next focus starts.
- Auto-repeat off: status becomes `awaiting` on the break phase. Home asks you to start another focus or end.

Ending early writes the focus record with outcome `ended_early` and the elapsed time, which excludes time spent paused. Ending during a break attaches the partial break to the latest focus record instead. Ending while already `awaiting` does not write another record; that phase was stored when it finished. In every end path the active session is cleared, a recap is saved as `lastSessionSummary`, and a Working task returns to Todo.

Dismissing the recap only clears `lastSessionSummary`.

## Pause

Pause is rejected if nothing is running, if the phase has already expired, or if the session copied the pause/end lock. It stores `remainingMs`, clears `endsAt`, increments the pause count, commits task focus, and clears the end alarm. Blocking is unchanged: a paused focus still blocks, and a paused break still blocks when the context says so. Ambient audio stops because it only plays while status is `running`.

Resume sets `endsAt` to now plus `remainingMs` and, on a focus, starts task focus again if a task is Working.

## Restarting Chrome

`chrome.runtime.onStartup` loads state and reconciles:

- No session: alarms stay clear, blocking rules are removed, the badge is cleared.
- Paused or waiting for a choice: no end alarm. Blocking and the badge are restored from the saved session.
- Running, and `endsAt` is still in the future: the end alarm is scheduled again. Time left is still `endsAt - now`, so the clock is right after the restart.
- Running, and `endsAt` has passed: the phase completes on startup, including its notification, and blocking follows whatever the next state is.

Install and update use the same reconcile path. A first run with no stored state gets the seeded contexts.

## Blocking

While a session should block, `declarativeNetRequest` dynamic rules redirect matching **main-frame** `http` and `https` navigations to `blocked.html#<original-url>`. Rules are rebuilt from the current site list whenever state changes. There is one rule per site, using `requestDomains` for that host.

A site is stored as a bare hostname. Input may include a scheme, path, port, or a leading `www.`; those are stripped. The host must contain a dot. `www.reddit.com` and `reddit.com` are the same site. A URL is blocked when its hostname equals the site or is a subdomain of it, so `old.reddit.com` matches `reddit.com` and `notreddit.com` does not. Non-http(s) URLs are ignored. Subresources and iframes are not redirected.

The site list comes from the session's context, live, so adding or removing a site mid-session updates the rules immediately. On a break the list is used only when **Keep sites blocked during breaks** is on. Hosts with an unexpired peek are left out. When the list changes, the worker also walks open tabs: a tab on a newly blocked URL is sent to the blocked page, and a blocked-page tab whose original URL is no longer blocked is sent back.

When the session ends, the rule list becomes empty and those tabs are restored.

## Sounds

The completion bell is chosen in Settings and played once from the offscreen document when a phase advances. Ambient audio is started or stopped from the worker whenever state changes, and again on the badge tick. It loops only for status `running`.
