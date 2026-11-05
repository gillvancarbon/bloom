# Contributing to Bloom

Thanks for helping Bloom grow. This guide keeps contributions calm and
predictable.

## Project layout

```
backend/    Spring Boot (Java 21) REST API + serves the built frontend
frontend/   React + TypeScript + Tailwind (Vite); also the Capacitor Android app
build.sh    Builds the whole app into one JAR
dev.sh      Runs backend (:8080) + Vite (:5173) with hot reload
run.sh      Builds if needed and serves everything on :8080
```

## Prerequisites

- **JDK 21+** (backend)
- **Node 20+** (frontend)
- **Android SDK** with platform 36 (only for the Android app)

## Getting started

```bash
./dev.sh          # backend + Vite dev server
# then open http://localhost:5173
```

## Checks before you push

Run the same checks our CI runs.

Backend:

```bash
cd backend && mvn -B verify
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run test
npm run build
```

## Code style

- Formatting is enforced by **Prettier** and **ESLint** (frontend) and follows
  the `.editorconfig` at the repo root.
- Run `npm run format` in `frontend/` before committing.
- Java follows the default Google-ish style with 4-space indentation.

## Tests

- Frontend unit tests live beside the code as `*.test.ts` and run with
  **Vitest** (`npm run test`).
- Backend tests are standard JUnit tests under `backend/src/test`.

## Commit messages

Use short, imperative subjects, for example:

```
Add weekday schedules to habits
Fix blank screen after deleting the last habit
```

## Branching

Work on a feature branch and open a pull request against `main`. Keep pull
requests focused; one feature or fix per PR.
