import { Preferences } from '@capacitor/preferences'
import type { Habit, HabitInput } from '../types'
import { lastKeptDate, todayISO } from '../lib/streak'
import { scheduledOccurrencesMissed } from '../lib/schedule'
import { normalizeHabit } from '../lib/habit'

/**
 * On-device habit store for the Android build.
 * Mirrors the REST API surface used by `useHabits` and the streak rules
 * implemented by the Spring Boot backend, so behaviour is identical.
 */

const HABITS_KEY = 'bloom.habits.v1'
const SEQ_KEY = 'bloom.seq.v1'
const HISTORY_START_KEY = 'bloom.historyStart.v1'
const DEFAULT_DEADLINE = '23:59'

async function readAll(): Promise<Habit[]> {
  const { value } = await Preferences.get({ key: HABITS_KEY })
  if (!value) return []
  try {
    const habits = JSON.parse(value) as Array<Partial<Habit> & { id: number }>
    return habits.map((h) => normalizeHabit(h))
  } catch {
    return []
  }
}

async function writeAll(habits: Habit[]): Promise<void> {
  await Preferences.set({ key: HABITS_KEY, value: JSON.stringify(habits) })
}

async function nextId(): Promise<number> {
  const { value } = await Preferences.get({ key: SEQ_KEY })
  const next = (value ? Number(value) : 0) + 1
  await Preferences.set({ key: SEQ_KEY, value: String(next) })
  return next
}

function increment(habit: Habit): Habit {
  const today = todayISO()
  // Measure the missed occurrences from the last kept day (completed or frozen)
  // against the habit's own schedule, so an off-schedule weekend doesn't reset a
  // weekday habit and a frozen day doesn't reset a daily one.
  const last = lastKeptDate(habit)
  const missed = last ? scheduledOccurrencesMissed(habit, last, new Date(), 1) : 0
  let streak: number
  if (!last)
    streak = 1 // first ever completion
  else if (missed >= 2)
    streak = 1 // two or more occurrences missed — reset
  else streak = habit.streakCount + 1 // on track, or a single grace occurrence
  const history = Array.from(new Set([...habit.history, today])).sort()
  return { ...habit, streakCount: streak, lastCompletedDate: today, history }
}

function toggle(habit: Habit): Habit {
  const today = todayISO()
  if (habit.lastCompletedDate === today) {
    const streak = Math.max(0, habit.streakCount - 1)
    // Undo only today's completion. The last completed date must fall back to
    // the newest remaining history entry (never a fabricated "yesterday", which
    // would claim a completion that never happened).
    const history = habit.history.filter((d) => d !== today)
    const lastCompletedDate = history.length ? history[history.length - 1] : null
    return { ...habit, streakCount: streak, lastCompletedDate, history }
  }
  return increment(habit)
}

/** Newest habits sort on top; manual order is honoured when present. */
function sortHabits(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return b.createdAt.localeCompare(a.createdAt)
  })
}

/**
 * Serialise store operations. Every read-modify-write (including id allocation)
 * runs after the previous one finishes, so two overlapping mutations can't read
 * the same array and clobber each other, and `nextId` can't hand out the same id
 * twice. Reads are queued too, so `list` never observes a half-applied write.
 */
let queue: Promise<unknown> = Promise.resolve()

function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  // Keep the chain alive even when an operation rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export const localStore = {
  async list(): Promise<Habit[]> {
    return mutate(async () => sortHabits(await readAll()))
  },

  /** Replace the whole habit list, keeping ids and history (used by import). */
  async replaceAll(habits: Habit[]): Promise<void> {
    return mutate(async () => {
      const normalized = habits.map((habit) => normalizeHabit(habit))
      await writeAll(normalized)
      // Only finite numeric ids can seed the sequence; a malformed id must never
      // turn the counter into NaN.
      const maxId = normalized.reduce(
        (max, habit) => (Number.isFinite(habit.id) ? Math.max(max, habit.id) : max),
        0,
      )
      await Preferences.set({ key: SEQ_KEY, value: String(maxId) })
    })
  },

  async create(input: HabitInput): Promise<Habit> {
    return mutate(async () => {
      const habits = await readAll()
      const minOrder = habits.length ? Math.min(...habits.map((h) => h.order)) : 0
      const habit: Habit = normalizeHabit({
        id: await nextId(),
        name: input.name.trim(),
        streakCount: 0,
        lastCompletedDate: null,
        createdAt: new Date().toISOString(),
        colorIndex: input.colorIndex,
        deadline: input.deadline || DEFAULT_DEADLINE,
        history: [],
        schedule: input.schedule,
        target: input.target,
        category: input.category,
        timeOfDay: input.timeOfDay,
        reminderOffset: input.reminderOffset ?? null,
        order: minOrder - 1,
      })
      await writeAll([habit, ...habits])
      return habit
    })
  },

  async update(id: number, input: HabitInput): Promise<Habit> {
    return mutate(async () => {
      const habits = await readAll()
      const index = habits.findIndex((h) => h.id === id)
      if (index === -1) throw new Error('Habit not found')
      const updated: Habit = normalizeHabit({
        ...habits[index],
        name: input.name.trim(),
        colorIndex: input.colorIndex,
        deadline: input.deadline || DEFAULT_DEADLINE,
        schedule: input.schedule ?? habits[index].schedule,
        target: input.target ?? habits[index].target,
        category: input.category ?? habits[index].category,
        timeOfDay: input.timeOfDay ?? habits[index].timeOfDay,
        // `!== undefined` so an explicit "no reminder" (null) is honoured.
        reminderOffset:
          input.reminderOffset !== undefined ? input.reminderOffset : habits[index].reminderOffset,
      })
      habits[index] = updated
      await writeAll(habits)
      return updated
    })
  },

  async remove(id: number): Promise<void> {
    return mutate(async () => {
      const habits = await readAll()
      await writeAll(habits.filter((h) => h.id !== id))
    })
  },

  async archive(id: number, archived: boolean): Promise<Habit> {
    return mutate(async () => {
      const habits = await readAll()
      const index = habits.findIndex((h) => h.id === id)
      if (index === -1) throw new Error('Habit not found')
      habits[index] = { ...habits[index], archived }
      await writeAll(habits)
      return habits[index]
    })
  },

  async reorder(ids: number[]): Promise<Habit[]> {
    return mutate(async () => {
      const habits = await readAll()
      const position = new Map(ids.map((id, i) => [id, i]))
      const next = habits.map((h) => ({
        ...h,
        order: position.has(h.id) ? (position.get(h.id) as number) : h.order,
      }))
      await writeAll(next)
      return sortHabits(next)
    })
  },

  async toggle(id: number): Promise<Habit> {
    return mutate(async () => {
      const habits = await readAll()
      const index = habits.findIndex((h) => h.id === id)
      if (index === -1) throw new Error('Habit not found')
      const updated = toggle(habits[index])
      habits[index] = updated
      await writeAll(habits)
      return updated
    })
  },

  /** Protect one missed day with a freeze, keeping the streak alive. */
  async freeze(id: number, date: string): Promise<Habit> {
    return mutate(async () => {
      const habits = await readAll()
      const index = habits.findIndex((h) => h.id === id)
      if (index === -1) throw new Error('Habit not found')
      const frozen = [...new Set([...habits[index].frozen, date])].sort()
      habits[index] = { ...habits[index], frozen }
      await writeAll(habits)
      return habits[index]
    })
  },

  /** The day consistency tracking began — stamped the first time it's asked for. */
  async historyStart(): Promise<string> {
    return mutate(async () => {
      const { value } = await Preferences.get({ key: HISTORY_START_KEY })
      if (value) return value
      const today = todayISO()
      await Preferences.set({ key: HISTORY_START_KEY, value: today })
      return today
    })
  },
}
