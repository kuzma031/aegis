# Settings and stats

Context rules live on the context. Settings that are not tied to one context live on `settings` inside the stored state. Strict-mode switches are copied onto the session at start. Site lists and **Keep sites blocked during breaks** are read from the context whenever blocking syncs, so they apply to a session already in progress.

## Context rules

Edited on Contexts → the context.

| Control | Default on a new context | Constraint |
| --- | --- | --- |
| Focus | 25 minutes | Production: 0.5 to 240 minutes, in 0.5 minute steps. Development builds (`npm run dev`): 1 second to 240 minutes, any step. |
| Break | 5 minutes | 0 skips the break. Otherwise the same range and step as focus. |
| Daily goal | 4 hours | Off, or 30 minutes to 8 hours in 30 minute steps. Home shows today's focus for this context against the goal. |
| Auto-start next session | On | Focus → break → focus until you end the run. |
| Keep sites blocked during breaks | On | Off means a break clears blocking and restores tabs. |
| Long breaks | Off | After every N focuses (1–99, default 4), use the long-break length (default 15 minutes) instead of the short break. Length uses the break rules, including 0. |
| Lock pause and end during session | Off | Pause and end are rejected while a phase is running or paused. Choice screens at the end of a phase still work. |
| Allow a peek during focus | On | Blocked page can open that host after a wait. |
| Allow a peek during breaks | On | Same flow, and only useful while breaks stay blocked. |
| Longer wait after each peek | On | Disabled unless at least one peek switch is on. Waits: 10s, 1m, 5m, 15m, 30m, based on how many peeks this run has already granted. |

A peek duration is a whole number of minutes from 1 to the smaller of 15 and the whole minutes remaining in the phase.

Sites: a valid http(s) hostname, duplicates rejected, `www.` removed. The active context cannot be deleted during its session. Context names cannot be empty, cannot exceed 40 characters, and cannot repeat (case-insensitive).

## Extension settings

Edited on Settings. These are not per context.

**Task presentation** — `hover` by default (page hover rail). Also `sidepanel` or `extension` (popup Tasks tab only). The Tasks tab stays available in every mode.

**Focus audio** — off by default. When on, the chosen track (Brown noise, Café, or Lo-fi) loops while a phase status is `running`, including breaks. Pause, the waiting screen, and the end of the run stop it.

**Completion sound** — Classic bell by default. Also Anvil bell, Notification bell, Opening bell, and Ring bell. Plays once when a focus or break phase ends.

Starting a session also saves that focus length, break length, and auto-repeat flag on settings. Home does not read them back. The next session started from Home uses the context's defaults.

`settings.dailyFocusTargetMinutes` is stored (default 240) and is not shown on any screen. The goal you see is the context daily goal.

## What a history record stores

Each finished or ended-early **focus** appends one record. A break does not get its own record; its time and its peeks are added onto the latest focus record. Records are kept for as long as extension storage is. Nothing in the code trims them.

A record holds:

- context id and the context name at the time
- planned focus length, focused time, start, end, and outcome (`completed` or `ended_early`)
- pause count and blocked-site hits, including a count per hostname
- break count and break time attached after the following break
- peek waits started, peeks granted, peeks cancelled, and granted peek time (focus-phase peeks, plus break peeks folded in afterward)
- the task id and title that were Working when the focus phase closed, if any

Focused time on an early end is the planned length minus the time still remaining, so paused time is excluded. A completed phase records the full planned length.

The task snapshot is whoever was Working at the close, and stats credit that record's **whole** focused time to them. The Home recap is different: it lists each task's accrued focus during the run, from the segments that were actually open. If you switch Working tasks mid-focus, the recap splits the time and the Stats "Focus by task" row does not.

Blocked-site hits are counted when the blocked page loads during focus, once per page load, and only then. Opening a blocked site on a break does not increment the count.

## Periods

Stats buckets records by the focus record's end time, in local time. Break time attached to that record is included in the same bucket, even if the break finished on a later day.

The Stats tab has two periods:

- **Today** — local midnight to the next midnight. The comparison line is against yesterday.
- **7 Days** — the calendar week that contains today, Monday 00:00 through the following Monday, not a rolling 168 hours. The comparison line is against the previous calendar week. This view also shows a Mon–Sun cadence chart for that week.

You can switch the header between **All** and one context. Context filter matches `contextId` on the record, so a renamed context still groups with its old records.

For the selected period, Stats shows:

- **Deep Flow Time** — sum of focused time, and the delta versus the comparison period
- **Sessions Shielded** — records with outcome `completed`, plus a completion percentage of completed / all focus records in the period
- **Peeks** — started, taken, time unlocked, cancelled
- **Distractions Warded Off** — up to four hosts, by hit count
- **Focus by task** — focused time attributed as described above, or **Unassigned**
- **Session rhythm** — pause count, break time, breaks taken

Today's focus total on Home uses the same "today" window, limited to the selected context, and compares it with that context's daily goal.
