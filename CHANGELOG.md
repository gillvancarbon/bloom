# Changelog

All notable changes to Bloom are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] — 2026-11-09

A calmer, more forgiving pass: streaks can step back, nudges can be quieted, and
the app is harder to lose data to.

### Added

- **Streak display** — choose how streaks read in **Settings → Habits & Tasks**:
  **Flame** (the day count), **Momentum** (days done in the last 30 — the new
  default), or **Hidden**. The habits header still shows the day streak.
- **Quiet hours** — a daily window in which reminders are skipped; **Reminder
  digest** bundles habit nudges into one message per hour; and an **Overdue task
  nudges** toggle.
- **Celebrations and haptics** — opt-in, off by default: a gentle pulse on
  completion and a short vibration.
- **Announce period changes** — when "follow the clock" moves the visible
  period, a short notice with **Undo** explains what moved.
- **Quick-add guidance** toggle for the to-do quick-add line.

### Changed

- **Habit cards are easier to act on** — the actions menu is a visible, labelled
  button (no more hidden leaf), and reorder controls are always available in
  manual order.
- **Insights and the calendar no longer read as failure** — "perfect days" are
  now "full days", and days with nothing logged are neutral rather than red.
- **Onboarding** nudges starting with one to three habits, and templates mark a
  few good first habits.
- Momentum is the default streak presentation, so a missed day is framed as a
  dip rather than a reset.

### Removed

- **Habit quick-add** on the Habits screen. Adding a habit is via **Add habit**
  or **Templates**; the to-do quick-add line is unchanged.

### Fixed

- Opt-in **haptics now work on Android** (the release build requests the
  vibration permission).
- Near-deadline and overdue text now meets **WCAG AA** contrast.
- **No lost updates** — on-device writes are serialised, so rapid taps can't
  drop a change or reuse an id, and a pending delete survives a failed request.
- **No crash on malformed data** — bad due dates from an import or corrupt
  storage are dropped instead of blanking the to-do list, and imports are
  validated (invalid bodies return `400`, not `500`).
- The **last-backup time** is persisted, and spending streak freezes can no
  longer overspend.
- Habit list loads issue far fewer database queries, and **reorder** is a single
  batched write.
- Release builds never expose signing secrets to dependency install steps.

## [1.4.0] — 2026-11-08

### Added

- **Habit quick add** — type a sentence such as “meditate every weekday
  morning” and Bloom works out the schedule (daily, weekdays, weekends, named
  days, or _N× a week_) and time of day, previewing what it understood.
- **Settings sub-pages** — Settings is now a short list of topics (Reminders,
  Sounds, Appearance, Habits & Tasks, Data & backups, Help, About), each showing
  a live summary and opening its own page with a **Back to settings** control.
- **Accessible habit reordering** — along with press-and-hold drag, habits can be
  moved with dedicated **Move up** / **Move down** buttons.
- **Shared category suggestions** — Habits and To-dos draw on one suggestion
  list, and a task set to repeat now gently points you to Habits.
- **First-completion hint** — a one-time coach line explains the streak and its
  one-day grace the first time you have habits but nothing ticked.

### Changed

- **Calmer forms** — the Habit and To-do forms lead with the essentials and keep
  the rest behind a **More options** disclosure.
- **Gentler onboarding** — the terms gate now opens with a plain-language
  summary and the full terms behind an optional disclosure, and the welcome tour
  is trimmed to three slides.
- **Calmer urgency** — overdue habits use a quiet amber label instead of a loud
  countdown, and missed calendar days are neutral rather than red.
- **Clearer Insights** — archived habits are excluded consistently, rate labels
  read plainly, and the 30-day chart has a screen-reader summary.
- **Quieter reminders** — a weekly habit stops reminding you once its weekly
  target is met.
- Android export now uses the system share sheet, so a backup can be saved to
  Files, Drive or sent on.

### Fixed

- The Settings dialog could fail to close after visiting a sub-page.
- Importing a snapshot is now transactional and preserves supported fields.

## [1.3.0] — 2026-11-06

### Added

- **To-do views** — the To-do screen groups tasks into **Today** (including
  overdue), **Upcoming** and **Anytime**, with an **All** view, using the same
  calm chips as the habit periods. Tasks sort by due date, priority, A–Z or
  newest.
- **Repeating tasks** — a task can repeat daily, weekly or monthly. Completing
  it rolls it forward to its next occurrence instead of leaving it done, with an
  undo.
- **Quick add** — type a sentence such as “call mum tomorrow 6pm” and Bloom
  works out the title, due date/time, priority (`!high`), type (`#work`) and
  repeat (`every monday`), previewing what it understood before you add it.
- **Search** — find a task by its title, note or checklist step.
- **Checklists** — add steps to a task and tick them from the card; progress
  shows as `2/3 steps`.
- **One-tap reschedule** — overdue tasks offer a **Move to today** button.
- **Export & import** — download a full JSON snapshot, and restore one back, from
  **Settings → Data & backups**. Import replaces the current data after taking a
  safety backup.
- **Task widget section** — the Android home-screen widget now also shows the
  tasks due today.
- **Overdue nudges** — a task that is still open after its due moment reminds
  you once more that it's overdue. Completed and archived tasks stay quiet, and
  a task is nudged at most once per due occurrence.
- **Terms on first run** — a new user must read and accept the Terms of Use and
  Privacy Policy before the app opens; declining closes the app. The terms stay
  reachable from **Settings → About**.
- **Full user guide** — the in-app guide now walks through every screen, setting
  and gesture, and the same material is mirrored in [GUIDE.md](GUIDE.md) for new
  users.
- **Guided quick add** — the task quick-add line now suggests completions as you
  type, quietly recommends a type or priority it spotted (tap to add), and a
  `/help` command opens the full reference with tappable examples.
- **`every <weekday>` repeats** — “water plants every monday” now sets a weekly
  repeat anchored to that day, as the docs always claimed.

### Fixed

- **Follow the clock** — with it on, **Anytime** is now always reachable and
  stays put, since it is a bucket rather than a time of day. Any other period
  you pick also stays until the clock genuinely crosses into morning, afternoon
  or evening (and previously a tap bounced straight back).

## [1.2.4] — 2026-11-05

### Changed

- **Licence** — Bloom is now released under the
  [PolyForm Noncommercial License 1.0.0](LICENSE): free for personal,
  noncommercial use, with no selling or commercial redistribution.
- **Simpler documentation** — the README no longer uses emojis, and the privacy
  note, health disclaimer and third-party credit now live in the README and the
  in-app About screen. `TERMS.md`, `SECURITY.md` and `THIRD_PARTY_NOTICES.md`
  were removed.

## [1.2.3] — 2026-11-05

### Added

- **Welcome tour** — new users are met by a short, five-slide introduction to
  Bloom that covers habits and streaks, parts of the day, acting reminders and
  the to-do list. It offers to turn on reminders and can finish by opening the
  habit templates, so a first session starts with something to do. The tour runs
  once; play it again any time from **Settings → Help**.
- **How to use Bloom** — a step-by-step guide, reachable from **Settings →
  Help**, that walks through every screen and gesture (spaces, habits and
  check-offs, streaks and freezes, periods, editing and reordering, the to-do
  list, the calendar and insights, reminders, and your data).
- **About screen** — **Settings → About** shows the version and the plain
  privacy summary, with links to the privacy policy and licence. The project now
  ships [PRIVACY.md](PRIVACY.md) and a [LICENSE](LICENSE) for personal,
  noncommercial use.
- **Today view with Morning, Afternoon, Evening and Anytime** — the Habits
  screen now shows only habits scheduled for today, grouped into a time-of-day
  chip switcher below "Your habits". Each chip shows how much is done
  (`done/total`) and flags overdue work with a dot. Swipe left or right to move
  between periods, or tap a chip; the period matching the current time is
  selected when the app opens, and "Anytime" is always pinned last for habits
  that don't belong to one part of the day. Each habit gains a **Time of day**
  choice, and older habits fall back to their deadline. A weekly habit completed
  today stays visible so it can still be undone.
- **Reminders that act** — reminders now carry **Complete** and **Snooze 1h**
  buttons, so a nudge can be dealt with without opening the app. The to-do list
  gains its own due-time reminders (nudging at a task's due time, or a gentle
  morning nudge when it only has a date), and both are controlled from a new
  **Task reminders** switch in Settings.
- **Streak freezes** — a frozen-flame token (a blue flame with a snowflake carved
  into it) beside the Templates button shows how many freezes are left (three
  each week). Spend one to protect a habit's most recent
  missed day and keep its streak alive, so a busy day doesn't wipe out weeks of
  work. Off-schedule days and flexible "N× per week" habits are left alone.
- **A little more insight** — Insights now opens with a **This week** review, and
  each habit expands to a 30-day heatmap with milestone badges for streak and
  total-completion milestones.
- **See habits that aren't on today** — a collapsible **Not today** section under
  the day's list gathers the habits whose schedule doesn't fall on today (an
  off-day for a weekday habit, or a weekly habit already at its target) so they
  can still be reviewed and edited, moved to another time of day, or completed
  early.
- **Shape your day** — a controls row under the period chips adds a **Hide done**
  toggle and a sort choice (To-do first, My order, By deadline, A–Z). Both are
  remembered in Settings, and drag-to-reorder is enabled automatically when
  "My order" is selected. Turning on **Follow the clock** in Settings advances
  the visible period as the day goes on.
- **Quick reclassify** — each habit card shows its part of the day as a small
  chip; tap it to move the habit to another period without opening the form.
  The card menu and the add/edit form suggest matching the period to a habit's
  deadline, so the two stay consistent.
- **Home-screen widget reflects today** — the widget snapshot now lists only
  today's habits, names the current part of the day, and counts progress against
  today's schedule instead of all active habits.
- **Completion ding** — finishing a habit or task plays a satisfying sound.
  Choose any of the phone's notification ringtones (or the bundled gentle
  chime, the phone default, or silence) in Settings, under a new **Sound**
  section. The completion sound can differ from the reminder sound, or reuse it.
- **Flame on the streak** — the Habits summary now shows a small flame beside
  the day-streak number, so a growing streak reads at a glance.
- **Category on the habit card** — each habit now shows its category as a
  rounded chip to the right of its name, so its type is visible at a glance.
- **Task priority** — choose Low, Medium or High when creating a task; higher
  priority floats up within the same due slot and shows as a chip on the card.
- **Archive tasks** — the to-do leaf menu can now archive/restore a task, kept
  in a collapsible "Archived" section, just like habits.
- **Startup splash** — a short, on-brand loading screen (white leaf on a sage
  disc) shows while the app warms up, so it never flashes in half-drawn.
- **Day-streak stat** — the Habits summary now shows how many days in a row at
  least one habit was completed (a single completion keeps it alive).
- **Quick archive** — the leaf menu again offers Archive/Restore alongside edit
  and delete, and all three buttons stay fully visible.
- **Phone-sized web preview** — add `?phone` to the URL to render the web build
  in a real 393 × 873 iframe (override with `&w=`/`&h=`), so it can be compared
  directly with the Android build.
- **Matching app icon + splash** — the launcher icon, adaptive icon and splash
  screens now use the same white leaf on a sage silicone disc as the header
  mark, instead of the old mint tile with a sage leaf.

### Changed

- **Minimal neomorphic buttons** — the tactile "silicone" controls are now soft
  UI neomorphic: every button shares the colour of the surface it sits on and is
  modelled purely by a soft light highlight (top-left) and shade (bottom-right),
  which invert to an inset when pressed. Cleaner, flatter and quieter than the
  old raised silicone lip, and cheaper to composite on phones.
- **Reminders now work in the background** — each habit keeps a rolling week of
  one-shot wakeup alarms (`RTC_WAKEUP` with `allowWhileIdle`), so nudges arrive
  even when the app is closed and the phone is in Doze. The window re-arms when
  habits or settings change and whenever the app returns to the foreground; the
  OS batches the alarms, so battery use stays low.
- **Reminder sound is now a choice** — pick any device notification ringtone for
  reminders, not just the bundled chime. The Android notification channel is
  rebuilt behind the scenes to match (channel sound is immutable), so the change
  takes effect immediately.
- **No more overlay flicker** — Settings, Insights, Calendar, the template
  picker and the add/edit/delete dialogs now appear fully opaque and in place on
  the very first frame; only the closing fade is kept.
- Reordering is now **press-and-hold, then drag** instead of a visible grip
  handle, on both the web and Android builds.
- Templates are reachable on phones (icon-only below the `sm` breakpoint).
- Text can no longer be selected across the app; form fields stay selectable.
- Smoother scrolling and transitions on Android: replaced the large
  `blur(90px)` background glows with radial gradients, removed the global
  colour transition and the nav's backdrop blur, and trimmed layout animations.
- The bottom navigation no longer shifts when switching between Habits and
  To-do.
- The Bloom mark beside the wordmark is now a slightly larger silicone button,
  matching the other tactile controls.
- **Reminders are now a choice, not a clock time** — pick "15 minutes before",
  "1 hour before" and so on, relative to each habit's deadline, instead of
  typing an exact time. The Settings default seeds new habits.

### Removed

- **Haptics** — Bloom no longer vibrates on taps, completions or notifications.
  The Feel section and its intensity control are gone, and reminder channels are
  now silent-only (a fresh channel id applies this to existing installs).

### Fixed

- **Android reminders now fire reliably** — the schedule used `at` together with
  `repeats`, which the plugin turns into a fixed-interval repeat, and the cron
  trigger re-armed with a non-wakeup alarm that Doze could defer. Reminders now
  use rolling one-shot wakeup alarms, so they arrive on time with the app closed.

## [1.2.0] — 2026-11-02

### Added

- **Settings screen** — tap the Bloom logo (top-left) to open it. Includes
  reminders, appearance, haptics, automatic backups and a confirm-gated
  "clear all data" action.
- **Habit reminders** — per-habit or default reminder times, delivered as local
  notifications on Android (with a browser fallback on the web).
- **Home-screen widget** — a quiet snapshot of today's habits with a progress
  bar and up to three habit rows.
- **Automatic local backups** — a rolling set of on-device restore points
  (once per day, plus manual), with a safety snapshot before every restore.
- **Richer habits** — weekday and "N× per week" schedules, categories, target
  vs. actual progress, archiving, and drag-to-reorder.
- **Insights** — weekly/monthly completion rates, perfect-day streaks, best
  streak, a 30-day trend chart, and per-habit totals.
- **Habit templates** — a non-blocking first-run helper to add a few gentle
  habits in one tap.
- **Undo** — deleting a habit or task now offers a short undo window.
- **Reliability** — a React error boundary, offline-retry error states, and
  versioned local-schema migrations.
- **Localisation of format** — 12/24-hour clock and configurable week start.
- **Engineering** — ESLint + Prettier, in-repo unit tests (Vitest), a CI
  workflow, `.editorconfig`, `LICENSE`, `CONTRIBUTING.md`, and `/api/v1`
  aliases with profile-based configuration and Flyway migrations on the
  backend.

### Changed

- A completed habit now shows a calm **Done** label instead of a countdown.
- Fixed a blank screen that could appear after deleting the last habit.
- Android: `minSdk` 23, `compileSdk`/`targetSdk` 36, AGP 8.9.2, Gradle 8.11.1.

## [1.1.0] — 2026-11-01

### Added

- Consistency calendar with month navigation.
- Per-habit deadlines with countdown and overdue states.
- To-do list with categories, notes, and due date/time.
- Light and dark themes; silicone button system.

## [1.0.0] — 2026-10-25

### Added

- Initial habit tracker and to-do list.
