import type { Habit, HabitInput, Todo, TodoInput } from './types'
import { normalizeHabit } from './lib/habit'

const BASE = '/api/habits'
const CALENDAR = '/api/calendar'
const TODOS = '/api/todos'
const DATA = '/api/data'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      const fieldError = body.errors
        ? Object.values(body.errors as Record<string, string>)[0]
        : undefined
      message = body.message ?? fieldError ?? body.error ?? message
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** The API returns the entity shape; normalise it into the web Habit model. */
async function habit(res: Response): Promise<Habit> {
  return normalizeHabit(await handle<Partial<Habit> & { id: number }>(res))
}

export const api = {
  list: () =>
    fetch(BASE)
      .then((r) => handle<Array<Partial<Habit> & { id: number }>>(r))
      .then((habits) => habits.map((h) => normalizeHabit(h))),

  create: (input: HabitInput) =>
    fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(habit),

  update: (id: number, input: HabitInput) =>
    fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).then(habit),

  remove: (id: number) => fetch(`${BASE}/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),

  archive: (id: number, archived: boolean) =>
    fetch(`${BASE}/${id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    }).then(habit),

  reorder: (ids: number[]) =>
    fetch(`${BASE}/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => handle<Array<Partial<Habit> & { id: number }>>(r))
      .then((habits) => habits.map((h) => normalizeHabit(h))),

  complete: (id: number) => fetch(`${BASE}/${id}/streak/increment`, { method: 'POST' }).then(habit),

  toggle: (id: number) => fetch(`${BASE}/${id}/streak/toggle`, { method: 'POST' }).then(habit),

  resetStreak: (id: number) =>
    fetch(`${BASE}/${id}/streak/decrement`, { method: 'POST' }).then(habit),

  historyStart: () =>
    fetch(CALENDAR)
      .then((r) => handle<{ historyStart: string }>(r))
      .then((d) => d.historyStart),

  /** Whole-dataset operations, both transactional on the server. */
  data: {
    clear: () => fetch(DATA, { method: 'DELETE' }).then((r) => handle<void>(r)),

    import: (bundle: { habits: Habit[]; todos: Todo[] }) =>
      fetch(`${DATA}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      }).then((r) => handle<void>(r)),
  },

  todos: {
    list: () => fetch(TODOS).then((r) => handle<Todo[]>(r)),

    create: (input: TodoInput) =>
      fetch(TODOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }).then((r) => handle<Todo>(r)),

    update: (id: number, input: TodoInput) =>
      fetch(`${TODOS}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }).then((r) => handle<Todo>(r)),

    remove: (id: number) =>
      fetch(`${TODOS}/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),

    archive: (id: number, archived: boolean) =>
      fetch(`${TODOS}/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      }).then((r) => handle<Todo>(r)),

    toggle: (id: number) =>
      fetch(`${TODOS}/${id}/toggle`, { method: 'POST' }).then((r) => handle<Todo>(r)),
  },
}
