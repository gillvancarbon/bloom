import { Preferences } from '@capacitor/preferences'
import type { Habit, HabitInput } from '../types'
import { daysSince, lastKeptDate, toISODate, todayISO } from '../lib/streak'
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
  // Measure the gap from the last kept day (completed or frozen), so a frozen
  // missed day doesn't reset the streak.
  const last = lastKeptDate(habit)
  const gap = last ? daysSince(last, new Date()) : null
  let streak = habit.streakCount
  if (gap === null) streak = 1
  else if (gap <= 1)
    streak += 1 // yesterday (or already today) — on track
  else if (gap === 2)
    streak += 1 // one day missed — single grace day keeps it
  else streak = 1 // two or more days missed — streak resets
  const history = Array.from(new Set([...habit.history, today])).sort()
  return { ...habit, streakCount: streak, lastCompletedDate: today, history }
}

function toggle(habit: Habit): Habit {
  const today = todayISO()
  if (habit.lastCompletedDate === today) {
    const streak = Math.max(0, habit.streakCount - 1)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return {
      ...habit,
      streakCount: streak,
      lastCompletedDate: streak > 0 ? toISODate(yesterday) : null,
      history: habit.history.filter((d) => d !== today),
    }
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

export const localStore = {
  async list(): Promise<Habit[]> {
    return sortHabits(await readAll())
  },

  async create(input: HabitInput): Promise<Habit> {
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
  },

  async update(id: number, input: HabitInput): Promise<Habit> {
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
  },

  async remove(id: number): Promise<void> {
    const habits = await readAll()
    await writeAll(habits.filter((h) => h.id !== id))
  },

  async archive(id: number, archived: boolean): Promise<Habit> {
    const habits = await readAll()
    const index = habits.findIndex((h) => h.id === id)
    if (index === -1) throw new Error('Habit not found')
    habits[index] = { ...habits[index], archived }
    await writeAll(habits)
    return habits[index]
  },

  async reorder(ids: number[]): Promise<Habit[]> {
    const habits = await readAll()
    const position = new Map(ids.map((id, i) => [id, i]))
    const next = habits.map((h) => ({
      ...h,
      order: position.has(h.id) ? (position.get(h.id) as number) : h.order,
    }))
    await writeAll(next)
    return sortHabits(next)
  },

  async toggle(id: number): Promise<Habit> {
    const habits = await readAll()
    const index = habits.findIndex((h) => h.id === id)
    if (index === -1) throw new Error('Habit not found')
    const updated = toggle(habits[index])
    habits[index] = updated
    await writeAll(habits)
    return updated
  },

  /** Protect one missed day with a freeze, keeping the streak alive. */
  async freeze(id: number, date: string): Promise<Habit> {
    const habits = await readAll()
    const index = habits.findIndex((h) => h.id === id)
    if (index === -1) throw new Error('Habit not found')
    const frozen = [...new Set([...habits[index].frozen, date])].sort()
    habits[index] = { ...habits[index], frozen }
    await writeAll(habits)
    return habits[index]
  },

  /** The day consistency tracking began — stamped the first time it's asked for. */
  async historyStart(): Promise<string> {
    const { value } = await Preferences.get({ key: HISTORY_START_KEY })
    if (value) return value
    const today = todayISO()
    await Preferences.set({ key: HISTORY_START_KEY, value: today })
    return today
  },
}
