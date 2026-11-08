# Bloom — User Guide

A complete, plain-language guide to Bloom for new users. It covers the first
run, every screen, each setting, and what happens to your data. For a quick
overview see the [README](README.md); for the legal details see
[Privacy](PRIVACY.md) and the [licence](LICENSE).

## Contents

- [What Bloom is](#what-bloom-is)
- [Installing](#installing)
- [Your first run](#your-first-run)
- [Getting around](#getting-around)
- [Habits](#habits)
- [To-do list](#to-do-list)
- [Insights and calendar](#insights-and-calendar)
- [Reminders and sounds](#reminders-and-sounds)
- [Settings reference](#settings-reference)
- [Your data](#your-data)
- [Home-screen widget](#home-screen-widget)
- [Troubleshooting](#troubleshooting)

## What Bloom is

Bloom is a calm habit tracker and to-do list. It helps you build gentle daily
streaks and keep a light task list without noise, accounts or analytics.
Everything lives on your device.

## Installing

- **Android** — download the app from the
  [latest release](https://github.com/gillvancarbon/bloom/releases/latest/download/bloom.apk)
  and open the APK to install it. You may need to allow installs from your
  browser or file manager the first time.
- **Web** — run the project following the [README](README.md) and open it in a
  browser. The web version stores data on the server you connect it to.

## Your first run

1. **Accept the terms.** A new user must read and agree to the Terms of Use and
   the Privacy Policy. Tick the box and choose **Agree and continue**. If you do
   not agree, choose **Decline and close** and the app closes — it cannot be used
   without your agreement. The terms are always available afterwards under
   **Settings → About**.
2. **Take the welcome tour.** A few short slides introduce habits, streaks,
   periods, reminders and tasks. You can skip at any point.
3. **Pick starter habits (optional).** The last slide can add a few ready-made
   habits. You can rename, edit or delete them whenever you like, or explore on
   your own.

## Getting around

- **Two spaces.** Habits and To-do are the two full-width buttons at the bottom
  of the screen. Tap to switch between them.
- **Settings.** Tap the Bloom leaf in the top-left corner of either screen.
- **The guide.** Reopen this guide from **Settings → Help → Open guide**, and
  replay the welcome tour from the same place.

## Habits

### Adding a habit

Tap **Add habit** and give it:

- a **name**;
- a **part of the day** — Morning, Afternoon, Evening or Anytime;
- a **deadline** (used for overdue warnings and default reminders);
- how often it **repeats** — daily, chosen weekdays, or a weekly target;
- an optional **type** and **target**.

In a hurry, tap **Templates** beside Add habit and pick from ready-made habits.

### Checking habits off

Tap the circle on a card to mark it done for the day; tap again to undo. A gentle
ding plays and the card settles into the done state. Completed habits can be
hidden with **Settings → Habits & Tasks → Hide completed**.

### Streaks and freezes

How streaks read is up to you — **Settings → Habits & Tasks → Streak display**
switches between **Flame** (the day count), **Momentum** (days done in the last
30, the default) and **Hidden**.

In Flame mode, each completed day grows a habit's flame. Miss a day and the
flame shrinks but survives; miss a second day in a row and the streak resets.
The frozen-flame token holds three **streak freezes** a week — spend one on a
habit with a missed day to keep its streak alive.

### Periods and order

Habits are grouped into **Morning**, **Afternoon**, **Evening** and **Anytime**.
Tap a chip or swipe left and right to move between them. Each chip shows the
done/total count and flags overdue work.

- **Anytime** is a bucket rather than a time of day, so **Follow the clock**
  never pulls you out of it.
- Press and hold a card to drag it into a new order.
- Tap the leaf on a card for **edit**, **archive** and **delete**.
- Habits not scheduled today — an off-day, or a weekly habit whose target is
  already met — gather under a collapsible **Not today** section.

## To-do list

### Adding a task

Give a task a **category**, a **priority**, an optional **note**, and a due date
and time if it matters. Without a due time a task stays calm until the end of its
day.

### Quick add

Type a sentence such as `call mum tomorrow 6pm` into the quick-add line. Bloom
reads the date, time, priority (`!high`, `!medium`, `!low`), type (`#work`) and
repeat (`every monday`, `daily`, `weekly`, `monthly`), previews what it
understood, and adds the task when you confirm.

Quick add also guides you:

- **Suggestions while you type.** Start a word such as `to` or `#wo`, or a
  phrase like `every` or `next`, and a row of suggestions appears. Tap one to
  complete it.
- **Recommendations.** When the sentence hints at a type (`buy milk` →
  `#errands`), a priority (`urgent` → `!high`), or a time without a day, Bloom
  offers an opt-in chip marked **Suggested**. Tap to add it.
- **The full guide.** Type `/help` (or tap the `/help` hint under an empty
  box) to open a complete list of every token with tappable examples. Choosing
  one fills the line so you can try it. Press Escape or close the panel to go
  back.

What quick add understands:

| Kind     | Examples                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Dates    | `today`, `tonight`, `tomorrow`, `friday`, `next friday`, `in 3 days`, `in 2 weeks`, `2026-11-10`, `10/11`, `10 nov`, `nov 10` |
| Times    | `at 5pm`, `at 5:30pm`, `17:30`, `noon`, `midnight` (`tonight` implies 8pm)                                                    |
| Priority | `!high`, `!medium`, `!low`, `!!!`, `!!`                                                                                       |
| Type     | `#work`, `#health`, `#chores`, `#schoolwork`, `#errands`, `#personal`                                                         |
| Repeat   | `every day`, `every week`, `every month`, `every monday`, `daily`, `weekly`, `monthly`                                        |

For example: `file taxes #work !high`, `water plants every monday`,
`standup at 9:30am`.

### Views, sorting and search

Switch between **Today**, **Upcoming**, **Anytime** and **All**. Sort by **due
date**, **priority**, **A–Z** or **newest**. Search matches a task's title, note
or checklist step.

### Repeats and checklists

A task can repeat **daily**, **weekly** or **monthly**. Completing a repeating
task rolls it forward to its next turn instead of leaving it done, with an undo.
A task can also hold a **checklist** of steps, shown as `2/3 steps`; expand the
card and tick steps inline.

### Finishing, undoing and rescheduling

Tap the circle to complete a task. It moves into **Done today**, where you can
still undo it. Overdue tasks offer a one-tap **Move to today**. Deleting a task
shows a short **undo** toast in case of a slip.

### Overdue nudges

Turn task reminders on in Settings. Bloom nudges you at a task's due moment, and
once more if it is still open after the due date. Completed and archived tasks
never remind, and each due occurrence nudges at most once.

## Insights and calendar

- **Calendar** — the calendar icon opens a month view. Green days are days when
  everything was done, amber when only some was, red when none was. Browse
  months with a swipe.
- **Insights** — the trend icon opens weekly and monthly completion rates, a
  30-day trend, and a per-habit heatmap with milestone badges.

## Reminders and sounds

- **Habit reminders.** In **Settings → Reminders**, turn on daily reminders and
  pick a default reminder time. Each habit can override it. Reminders carry
  **Complete** and **Snooze 1h** buttons, so you can act without opening Bloom.
  The app asks for notification permission the first time you switch reminders
  on; on the web they only fire while the tab stays open.
- **Task reminders.** A separate switch covers tasks (due moments and overdue
  nudges).
- **Sounds.** In **Settings → Sound**, choose the reminder sound from your
  phone's notification sounds, and set a separate completion ding or keep it the
  same. Either can be silent.

## Settings reference

- **Reminders** — daily reminders and task reminders on/off, and the default
  reminder time.
- **Sound** — the reminder sound and the completion ding.
- **Appearance** — light or dark theme, 12- or 24-hour clock, and week start
  (Sunday or Monday).
- **Habits** — Follow the clock, Hide completed, habit sort order, and the
  default reminder for new habits.
- **Data & backups** — automatic backups, manual backups, restore, JSON export
  and import, and **Clear all habits and tasks**.
- **Help** — open this guide, or replay the welcome tour.
- **About** — version, privacy summary, terms of use and licence.

## Your data

Bloom keeps your habits, tasks, settings and backups **on your device**. There
is no account and nothing is sent to the developers. Uninstalling the app or
clearing its data removes everything, so keep your own copies if it matters to
you.

- **Backups** — Bloom takes a daily automatic backup and lets you make one on
  demand. Restore any point with one tap; a safety snapshot is taken first.
- **Export and import** — export a full JSON snapshot from **Settings → Data &
  backups**, and import one back on the same screen. On Android, export opens the
  system share sheet, where you can save the file to Files, Drive or another app.
  Import replaces the current habits and tasks after taking a safety backup.
- **Clear all** — resets the habits and tasks without touching your settings or
  backups.

## Home-screen widget

On Android you can add the Bloom widget to your home screen. It shows today's
habit progress and the tasks due today, and tapping a habit's circle completes it
right from the widget.

## Troubleshooting

- **No reminders?** Check **Settings → Reminders** is on, and that notifications
  are allowed for Bloom in your system settings. On the web, reminders only fire
  while the tab is open.
- **A streak reset.** A missed day shrinks the flame; a second missed day in a
  row resets it. Spend a streak freeze to protect a habit with a single missed
  day, or switch **Streak display** to **Momentum** or **Hidden** if you would
  rather not see a count.
- **Where is my data?** It is on your device. Use **Data & backups** to export,
  import or restore.
- **Undo a delete.** A short **Undo** toast appears after deleting a habit or
  task. After it closes, restore from a backup if needed.

## Privacy and terms

- **Privacy** — see [PRIVACY.md](PRIVACY.md).
- **Licence** — free for personal, noncommercial use under the PolyForm
  Noncommercial License 1.0.0. See [LICENSE](LICENSE).
- **Terms of use** — see the [README](README.md#terms-of-use).
