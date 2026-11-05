# Bloom · Habit Tracker

A calm, wellbeing-focused habit tracker and to-do list built with **Spring Boot
(Java 21)** and **React + TypeScript + Tailwind CSS**. Track daily habits, build
streaks, keep a gentle task list, and switch between a soft light theme and a
restful dark theme.

**[Download the Android app](https://github.com/gillvancarbon/bloom/releases/latest/download/bloom.apk)** —
free for personal, noncommercial use.

## Features

- **Two calm spaces** — switch between **Habits** and **To-do** with the two
  full-width buttons pinned to the bottom of the screen.
- Add, edit, and delete habits and tasks
  - Tap the **leaf** on the right of a card to reveal the pencil and trash
    actions.
  - Deleting asks for **confirmation** first — no accidents.
- **Useful daily stats** — Habits shows *Done today*, *Remaining*, and
  *Overdue*; To-do shows *Done today*, *Due today*, and *Overdue*.
- **To-do list** — every task has a type (Chores, Schoolwork, Work, Personal,
  Health, Errands), a priority, an optional note, due date/time, a repeat, and an
  optional checklist.
  - The optional **due time** marks the task overdue at that exact time; without
    one it stays calm until the end of the day.
  - **Views** group tasks into **Today**, **Upcoming**, **Anytime** and **All**,
    with the same calm chips as the habit periods; sort by due date, priority,
    A–Z or newest.
  - **Quick add** understands plain sentences — “call mum tomorrow 6pm” sets the
    date and time, `!high` the priority, `#work` the type and `every monday` a
    repeat — and previews what it read before you add it.
  - **Search** by title, note or step. **Repeating** tasks roll forward when
    completed. **Checklists** track steps as `2/3 steps`. Overdue tasks offer a
    one-tap **Move to today**.
  - Completed tasks move into a **Done today** section and can be undone.
- **Streak counter** on every habit, with a one-tap daily completion circle
  that you can tap again to **undo** an accidental completion.
  - A one-day **grace period**: the flame shrinks to warn you after a missed day,
    and the streak only resets once a second day is missed.
- **Daily deadline** per habit (set when adding/editing). Each card shows a
  live countdown to the deadline that turns peach when it's under two hours away
  (and reads "Overdue" once it passes).
- **Consistency calendar** — tap the calendar icon beside the theme toggle to
  open a full-screen month view. Each day shows a short line: **green** when every
  habit was done that day, **amber** when only some were, and **red** when none
  were. Days before you started tracking stay blank, and months cross-slide
  smoothly as you browse.
- **Light / dark mode** toggle with smooth 300 ms colour transitions.
- Only **three hue families** — sage (primary), peach (accent), and mint
  (calm) — plus softly tinted neutrals. Everything adjusts for each theme.
- Soft rounded corners, gentle shadows, and subtle background glow.
- Fits phone screens with safe-area padding — and ships as a fully offline
  Android APK (see below).
- Accessible dialogs, keyboard support (Esc to close), and reduced-motion
  support.
- **Welcome tour & how-to guide** — a short first-run introduction walks new
  users through habits, streaks, parts of the day, reminders and the to-do list,
  and can finish by opening the templates. A step-by-step **How to use Bloom**
  guide lives in Settings, and the welcome tour can be replayed any time.
- **Settings** — tap the **Bloom logo** in the top-left to open it:
  reminders and sounds, appearance, habit options, automatic backups, and a
  confirm-gated *Clear all habits and tasks* action.
- **Richer habits** — repeat **every day**, on **chosen weekdays**, or a
  flexible **N× per week** target; add a **category**; see **target vs. actual**
  progress; **archive** habits (from the edit dialog) and **drag to reorder**
  them.
- **Insights** — weekly and monthly completion rates, perfect-day streaks, a
  30-day trend chart, and per-habit totals.
- **Reminders** — a per-habit or default reminder time, delivered as
  on-device notifications (with a browser fallback on the web).
- **Habit templates** — a gentle template picker that adds a few habits in
  one tap (non-blocking — always optional).
- **Automatic local backups** — a rolling set of on-device restore points
  (once a day, plus manual), with a safety snapshot before every restore.
- **Undo** — deleting a habit or task shows a short undo toast; the deletion
  is applied once the undo window closes, and survives a reload.
- **Your format** — 12- or 24-hour clock and a configurable week start
  (Sunday or Monday).
- **Home-screen widget** *(Android)* — a quiet snapshot of today's habits
  with a progress bar and up to three habit rows.

## Settings

Open Settings by tapping the **Bloom logo** at the top-left of either screen.
It groups:

- **Reminders** — daily reminders and task reminders on/off, and a default
  reminder time (timed to each habit's own deadline).
- **Sound** — the reminder sound and the completion ding, chosen from the
  phone's notification sounds.
- **Appearance** — light / dark theme, 12/24-hour clock, and week start
  (Sunday or Monday).
- **Habits** — follow the clock, and hide completed habits.
- **Data & backups** — automatic backups (with the last backup time, a
  *Back up now* button and restore points) and a confirm-gated *Clear all habits
  and tasks* action.
- **Help** — the **How to use Bloom** tutorial, and **Replay** for the welcome
  tour.
- **About** — version, the privacy summary, and links to the privacy policy
  and licence.

Settings are stored on the device; the app never sends them anywhere.

## Tech Stack

| Layer | Technology |
|------------|----------------------------------------------|
| Backend | Spring Boot 3.2 · Java 21 · Spring Data JPA |
| Database | H2 (file-based, zero setup) · PostgreSQL-ready |
| Frontend | React 18 · TypeScript · Vite |
| Styling | Tailwind CSS · Framer Motion · lucide-react |

## Requirements

- **JDK 21+**
- **Node.js 18+** and npm
- Maven is bundled via `./mvnw` (no system install required)

## Run it

The simplest path — build and launch on a single port:

```bash
./run.sh
# → http://localhost:8080
```

`run.sh` will automatically run `./build.sh` the first time it needs to.

### Other scripts

```bash
./build.sh # build frontend + backend into one runnable JAR
./run.sh # serve everything at http://localhost:8080 (port 8080)
PORT=9090./run.sh # serve on a custom port
./dev.sh # dev mode: Vite:5173 + Spring Boot:8080 with hot reload
```

## Android app

The Android build is a native shell around the same React UI, with habits and
tasks stored **on the device** — no server, no internet required.

```bash
cd frontend
npm run build:android # build the offline web bundle (VITE_DATA_MODE=local)
npx cap sync android # copy it into the Android project
cd android
./gradlew assembleRelease # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease # → app/build/outputs/bundle/release/app-release.aab
```

> Building requires the Android SDK (`ANDROID_HOME`) and **JDK 17+**. The app
> targets **API 36** (Android 16) with a minimum of **API 23**.
> The release build is signed with `android/bloom-release.jks` (config in
> `android/keystore.properties`) so updates install over the previous version.
> For Google Play, upload the **AAB** and let Play App Signing manage the key.

Install on a phone: allow "Install unknown apps" for your file manager/browser,
copy the APK over, then tap it. Note: the web build talks to Spring Boot
(`VITE_DATA_MODE` unset); the Android build sets `VITE_DATA_MODE=local` via
`frontend/.env.android`.

The status and navigation bars are tinted to match the app background (light or
dark) so nothing flashes white — a small `BloomBars` Capacitor plugin sets the
navigation-bar colour and icon tint at runtime, and `values-night` resources
cover the cold-start splash (see `android/app/src/main/res/`).

### Widget & notifications

A native **home-screen widget** (`HabitWidgetProvider`) shows today's progress.
The web layer computes the snapshot (so the widget can never disagree with the
app) and pushes it through the tiny `BloomWidgetPlugin`. Habit reminders use
`@capacitor/local-notifications`; `POST_NOTIFICATIONS` is requested on Android
13+ when reminders are enabled in Settings.

## Project layout


```
habit-tracker/
├── build.sh # one-shot production build
├── run.sh # build (if needed) + serve single JAR
├── dev.sh # two-process dev mode with hot reload
├──.github/workflows/ci.yml # CI: frontend, backend, signed release AAB
├── backend/
│ ├── mvnw # Maven wrapper
│ ├── pom.xml
│ └── src/main/java/com/habittracker/
│ ├── HabitTrackerApplication.java
│ └── habit/
│ ├── Habit.java # entity + streak logic + schedule
│ ├── HabitRepository.java
│ ├── HabitService.java
│ ├── HabitController.java # REST /api/habits · /api/v1/habits
│ ├── CalendarController.java # REST /api/calendar
│ ├── CalendarService.java
│ ├── Todo.java # to-do entity + due date/time
│ ├── TodoRepository.java
│ ├── TodoService.java
│ ├── TodoController.java # REST /api/todos · /api/v1/todos
│ ├── AppMeta.java # key/value app settings
│ ├── AppMetaRepository.java
│ ├── HabitNotFoundException.java
│ ├── TodoNotFoundException.java
│ └── GlobalExceptionHandler.java
│ └── src/main/resources/
│ ├── application.yml # dev profile (H2, Flyway off)
│ ├── application-prod.yml # prod profile (Flyway on)
│ └── db/migration/V1__baseline.sql
└── frontend/
    ├── index.html
    ├── tailwind.config.js # the 3-colour palette
    ├── eslint.config.js
    ├── vitest.config.ts
    └── src/
        ├── App.tsx # Habits / To-do tab shell
        ├── api.ts
        ├── types.ts
        ├── context/
        │ ├── ThemeContext.tsx
        │ └── SettingsContext.tsx
        ├── data/ # local stores, migrations, backups
        │ ├── localStore.ts
        │ ├── localTodoStore.ts
        │ ├── settingsStore.ts
        │ ├── backupStore.ts
        │ ├── migrations.ts
        │ ├── dataClient.ts
        │ └── pendingDeletes.ts
        ├── hooks/
        │ ├── useHabits.ts
        │ ├── useTodos.ts
        │ └── useUndoQueue.ts
        ├── lib/
        │ ├── streak.ts # streak + deadline logic
        │ ├── schedule.ts # schedules + progress
        │ ├── insights.ts # stats + trend
        │ ├── todo.ts # categories, due labels, stats
        │ ├── calendar.ts # consistency calendar logic
        │ ├── notifications.ts # habit reminders
        │ ├── widget.ts # home-screen widget bridge
        │ ├── quickAdd.ts # natural-language task capture
        │ ├── export.ts # JSON export/import
        │ └── templates.ts
        └── components/
            ├── HabitsView.tsx
            ├── TodosView.tsx
            ├── SettingsView.tsx # opened from the Bloom logo
            ├── HabitCard.tsx # leaf actions + streak
            ├── TodoCard.tsx # category chip + due time
            ├── RowActions.tsx # leaf → pencil + trash
            ├── HabitForm.tsx # add / edit habit dialog
            ├── TodoForm.tsx # add / edit task dialog
            ├── TemplatePicker.tsx # non-blocking habit templates
            ├── InsightsView.tsx
            ├── IntroFlow.tsx # first-run welcome tour
            ├── TutorialView.tsx # "How to use Bloom" guide
            ├── AboutView.tsx # privacy summary and licence
            ├── FreezeSheet.tsx # streak freezes sheet
            ├── FrozenFlame.tsx # the streak-freeze glyph
            ├── BottomNav.tsx # two full-width tabs
            ├── DeleteConfirm.tsx # confirmation dialog
            ├── ErrorBoundary.tsx
            └── CalendarView.tsx # consistency calendar overlay
```

## REST API

Every endpoint is also available under a versioned `/api/v1/…` alias.

| Method | Path | Description |
|--------|-----------------------------------|--------------------------|
| GET | `/api/habits` | List all habits |
| GET | `/api/habits/{id}` | Get one habit |
| POST | `/api/habits` | Create a habit |
| PUT | `/api/habits/{id}` | Update a habit |
| DELETE | `/api/habits/{id}` | Delete a habit |
| PUT | `/api/habits/order` | Persist a drag-to-reorder sequence `{ "ids": [...] }` |
| POST | `/api/habits/{id}/archive` | Archive / restore a habit `{ "archived": true }` |
| POST | `/api/habits/{id}/streak/increment` | Mark done today |
| POST | `/api/habits/{id}/streak/decrement` | Reset the streak |
| POST | `/api/habits/{id}/streak/toggle` | Toggle today's completion |
| GET | `/api/calendar` | When consistency tracking began |
| GET | `/api/todos` | List all tasks |
| GET | `/api/todos/{id}` | Get one task |
| POST | `/api/todos` | Create a task |
| PUT | `/api/todos/{id}` | Update a task |
| DELETE | `/api/todos/{id}` | Delete a task |
| POST | `/api/todos/{id}/toggle` | Toggle completion |

Example:

```bash
curl -X POST http://localhost:8080/api/habits \
  -H 'Content-Type: application/json' \
  -d '{"name":"Drink water","colorIndex":0,"deadline":"21:00"}'

curl -X POST http://localhost:8080/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Finish the reading response","category":"schoolwork","dueDate":"2026-11-02","dueTime":"17:30","note":"Draft the intro"}'
```

Habit fields: `name`, `colorIndex` (0–2), `deadline` (`"HH:mm"`, defaults to
`23:59` if omitted), `schedule` (`{"type":"daily"}`,
`{"type":"weekdays","days":[1,2,3]}`, or `{"type":"weekly","perWeek":3}`),
`category`, `reminderTime` (`"HH:mm"` or `null`), `archived`, and `order`.
`streakCount`, `lastCompletedDate`, and `history` (the list of completed days
that powers the calendar) are managed by the `/streak/*` endpoints.

Task fields: `title`, `note` (optional), `category`
(`chores | schoolwork | work | personal | health | errands`), `dueDate`
(`YYYY-MM-DD`, optional), and `dueTime` (`HH:mm`, optional; ignored when there is
no due date). `done` and `completedAt` are managed by the `/toggle` endpoint.

Interactive API docs: <http://localhost:8080/swagger-ui.html>

## Development & quality

```bash
cd frontend
npm run lint # ESLint
npm run format # Prettier
npm run typecheck # tsc --noEmit
npm run test # Vitest unit tests (schedules, insights)

cd../backend
mvn -B verify # build + JUnit tests
```

Continuous integration lives in `.github/workflows/ci.yml` (frontend lint/test/
build, backend verify, and a signed release **AAB** job for tags). See
`CONTRIBUTING.md` for the full checklist.

## Privacy & licence

- **Privacy** — the Android app keeps all of your data on the device and sends
  nothing anywhere. See [PRIVACY.md](PRIVACY.md).
- **Licence** — free for personal, noncommercial use. No selling or commercial
  redistribution. See [LICENSE](LICENSE).
- **Not medical advice** — Bloom is a wellbeing tool, not a medical device.
  Reminders are best-effort, so do not rely on them for anything time-critical.
- **Third-party software** — built with React, Capacitor, Tailwind CSS, Framer
  Motion, Lucide and Spring Boot, under their respective open-source licences.

The privacy summary and licence are also reachable in the app from
**Settings → About**.

## Notes

- Data is stored in `backend/data/habits.mv.db` (H2). Delete that file to start
  fresh.
- The three palette hues live in `frontend/tailwind.config.js`. Swap the `sage`,
  `peach`, and `mint` scales to re-skin the entire app.
- To use PostgreSQL, uncomment the PostgreSQL block in
  `backend/src/main/resources/application.yml` and add a database.
