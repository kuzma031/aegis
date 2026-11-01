# Overview

Wardfocus is a Chrome extension for timed focus. You keep one or more **contexts**. A context is a named list of sites plus the timing and rules for sessions that use it. You pick a context, start a focus session, and Wardfocus blocks those sites until the phase ends, you pause, or you end the session.

A fresh install starts with two contexts:

| Context | Default focus | Default break | Sites |
| --- | --- | --- | --- |
| Development | 25 minutes | 5 minutes | reddit.com, youtube.com, instagram.com, x.com |
| Research | 50 minutes | 10 minutes | instagram.com, tiktok.com |

Both start with auto-repeat on, sites still blocked during breaks, peeks allowed, and a 4 hour daily goal. Long breaks and the pause/end lock are off. You can edit or delete these, and add your own.

Only one session runs at a time.

## What you do

1. Open the toolbar popup.
2. On Home, choose a context. Its default focus and break lengths are the ones the next session uses.
3. Start the focus session. Matching sites redirect to the blocked page, including tabs that are already open.
4. Work until the timer finishes, or pause / end if the context allows it.
5. After a focus, take the break (automatically if auto-repeat is on, or by choice if it is off), extend the focus, or end and read the recap.

Home also shows today's focus time for the selected context against that context's daily goal, when the goal is not off.

## Popup

The popup has five tabs: Home, Contexts, Tasks, Stats, and Settings.

**Home** is the session screen. Idle, it shows the selected context, the focus and break it will use, and the start button. You can add the site of the current tab to that context while idle and during a focus. A site added during a focus starts blocking immediately. The control is not shown on a break. While a session is running it shows the countdown, pause, and end. A break has its own countdown. When auto-repeat is off and a phase finishes, Home asks you to extend, start the break, continue into the next focus, or end. Ending shows a recap for that run: focus and break counts and time, tasks that accrued focus, blocked-site hits, peeks, and pauses.

**Contexts** lists contexts, creates and renames them, and edits one context's sites and rules. Deleting the context that owns the active session is refused until you end the session. Names must be unique, ignoring case, and at most 40 characters.

**Tasks** is a list with three states: Working, Todo, and Finished. One task can be Working at a time. Marking another task Working moves the previous one back to Todo. Focus time accrues only while a focus phase is running and that task is Working. Pause commits the open segment. Ending a run moves a Working task back to Todo. Titles are required and at most 80 characters. The Tasks tab is always available. Settings decides whether the same tasks also appear in the Chrome side panel or on a rail at the edge of web pages.

**Stats** summarizes past focus records. See [Settings and stats](settings-and-stats.md).

**Settings** chooses where tasks appear, whether a loop plays during a running session, and which bell plays when a phase ends.

## Sessions, pause, and breaks

A run is a chain of focus and break phases that share one recap. Each phase stores a start time and an end time. The clock you see is the time left until that end, not a ticking counter stored in the background. While paused, the time left is frozen and the end time is cleared. Resume schedules a new end time from the frozen remainder. Paused time is not counted as focus or break.

Blocking stays on while a focus is paused. On a break, blocking stays on only when the context still has **Keep sites blocked during breaks** enabled. That flag is read from the context as it is now, so changing it mid-session updates blocking. The strict-mode flags are copied onto the session when it starts and stay with that run.

**Auto-start next session** (stored as auto-repeat) keeps the cycle going: focus, then break, then focus, until you end it. With it off, a finished phase waits. You can extend the focus by a new length (later focuses in the run still use the original focus length), start the pending break, start the next focus, or end.

A break length of 0 skips the break. With auto-repeat on, the next focus starts immediately. With it off, the finished focus waits and the only follow-up is to extend or end.

**Long breaks**, when enabled, replace the short break after every N completed focuses in the run (default every 4, for 15 minutes). N is a whole number from 1 to 99. A long break is used even when the short break is 0.

**Lock pause and end during session** hides and rejects pause and end while a phase is running or paused. At a phase boundary you can still choose. If auto-repeat would otherwise start the next phase with no way out, the completion notification includes **End session**, which is allowed to stop a locked run.

## Peeks

A peek is a timed exception for one blocked host. It is available only when the context allows it for the current phase (focus, and separately breaks). It is not available while Wardfocus is waiting for you to choose the next phase, or when less than one whole minute is left.

On the blocked page, **Open site** starts a wait. The first wait is 10 seconds. If **Longer wait after each peek** is on, each successful peek raises the next wait: 10 seconds, 1 minute, 5 minutes, 15 minutes, then 30 minutes. After the wait you choose how long the site stays open, in whole minutes, from 1 up to the lesser of 15 and the whole minutes left in the phase. That host is left out of the block list until the peek expires. A small **Peek** chip on the site counts down and pulses in the last 30 seconds. Cancelling a wait counts as abandoned. Starting a wait for a different host abandons the previous wait. Peeks are cleared when the phase changes.

## Tasks outside the popup

Settings → Task presentation:

- **Extension only** — Tasks tab in the popup.
- **Side panel** — Chrome's side panel, enabled only for this choice. Choosing it opens the panel. If you switch away, the side panel page says tasks are turned off.
- **Page hover rail** — a rail on the right edge of top-level web pages (the install default). It lists Working and Todo tasks, and can mark them Work, Pause, or Done. Finished tasks stay in the popup. The rail is removed when another presentation is selected.

## Notifications, badge, and sound

When a phase ends, a notification appears and the selected completion bell plays once.

- Auto-repeat off, focus finished: **Are you in flow?** Buttons: **Extend** (opens the popup so you can pick a length) and **Start break**, or **End session** when there is no break.
- Auto-repeat off, break finished: **Break finished**. Buttons: **Start focus** and **End session**.
- Auto-repeat on, focus finished into a break: **Focus complete**, with the focused time. If pause and end are locked, the notification's **End session** button can stop the run.
- Auto-repeat on, break finished into the next focus, with pause and end locked: **Break finished**, with **End session**.
- The run actually ends: **Session finished**.

Clicking the notification opens the popup. If Chrome cannot open the toolbar popup, Wardfocus opens a small popup window on the same page.

The toolbar badge is empty while idle, and the icon title is **Wardfocus**. During a running phase it shows a short remainder (`25m`, `2h`) and a hover title with the full clock (`Wardfocus · Focus · 24:10 remaining`). Paused shows `||` and says the phase is paused. Waiting for a choice shows **Done**. The badge refreshes about once a minute while a phase is running or a peek is still open, and also whenever stored state changes.

Focus audio, if enabled, loops only while a phase is **running**. It plays through breaks and stops on pause, on the waiting screen, and when the run ends. Tracks are Brown noise, Café, and Lo-fi. You can preview them in Settings; preview is disabled while that session audio is already playing.
