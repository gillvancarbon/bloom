import { describe, expect, it } from 'vitest'
import type { Habit, Todo } from '../types'
import { normalizeHabit } from './habit'
import { normalizeTodo } from './todo'
import { buildPlan, inQuietHours, type PlanOptions } from './notificationPlan'

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

function todo(overrides: Partial<Todo> = {}): Todo {
  return normalizeTodo({
    id: 1,
    title: 'Pay rent',
    note: null,
    category: 'personal',
    done: false,
    dueDate: null,
    dueTime: null,
    importance: 'medium',
    recurrence: 'none',
    subtasks: [],
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  } as Todo)
}

/** A fixed Wednesday lunchtime, in the local timezone. */
const NOW = new Date(2026, 5, 10, 12, 0, 0)

function options(overrides: Partial<PlanOptions> = {}): PlanOptions {
  return {
    habits: [],
    todos: [],
    now: NOW,
    notificationsEnabled: true,
    taskReminders: true,
    quietHours: null,
    digest: false,
    ...overrides,
  }
}

/** A moment on the reference day at the given local clock time. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 5, 10, hour, minute)
}

describe('inQuietHours', () => {
  const overnight = { start: '22:00', end: '07:00' }

  it('treats a null window as never quiet', () => {
    expect(inQuietHours(at(23), null)).toBe(false)
  })

  it('handles a window that crosses midnight', () => {
    expect(inQuietHours(at(21, 59), overnight)).toBe(false)
    expect(inQuietHours(at(22), overnight)).toBe(true)
    expect(inQuietHours(at(23), overnight)).toBe(true)
    expect(inQuietHours(at(2), overnight)).toBe(true)
    expect(inQuietHours(at(6, 59), overnight)).toBe(true)
    expect(inQuietHours(at(7), overnight)).toBe(false)
    expect(inQuietHours(at(12), overnight)).toBe(false)
  })

  it('handles a same-day window with an exclusive end', () => {
    const daytime = { start: '09:00', end: '17:00' }
    expect(inQuietHours(at(8, 59), daytime)).toBe(false)
    expect(inQuietHours(at(9), daytime)).toBe(true)
    expect(inQuietHours(at(16, 59), daytime)).toBe(true)
    expect(inQuietHours(at(17), daytime)).toBe(false)
  })

  it('treats a zero-length window as protecting nothing', () => {
    expect(inQuietHours(at(12), { start: '09:00', end: '09:00' })).toBe(false)
  })
})

describe('buildPlan — gating', () => {
  it('returns nothing when notifications are off', () => {
    const h = habit({ id: 1, deadline: '20:00', reminderOffset: 60 })
    expect(buildPlan(options({ habits: [h], notificationsEnabled: false }))).toEqual([])
  })

  it('returns nothing when there is nothing to remind', () => {
    expect(buildPlan(options())).toEqual([])
  })

  it('skips archived habits and habits without a reminder', () => {
    const archived = habit({ id: 1, deadline: '20:00', reminderOffset: 60, archived: true })
    const noReminder = habit({ id: 2, deadline: '20:00', reminderOffset: null })
    expect(buildPlan(options({ habits: [archived, noReminder] }))).toEqual([])
  })
})

describe('buildPlan — habit nudges', () => {
  it('schedules deadline − offset on each scheduled day', () => {
    const h = habit({ id: 7, deadline: '20:00', reminderOffset: 60 })
    const plan = buildPlan(options({ habits: [h] }))

    expect(plan).toHaveLength(7)
    expect(plan[0]).toMatchObject({ kind: 'habit', title: 'Test habit' })
    expect(plan[0].at.getHours()).toBe(19)
    expect(plan[0].at.getMinutes()).toBe(0)
    expect(new Set(plan.map((nudge) => nudge.id)).size).toBe(7)
  })

  it('only nudges on a weekday habit’s selected days', () => {
    const h = habit({
      id: 8,
      deadline: '20:00',
      reminderOffset: 0,
      schedule: { type: 'weekdays', days: [NOW.getDay()] },
    })
    const plan = buildPlan(options({ habits: [h] }))
    for (const nudge of plan) expect(nudge.at.getDay()).toBe(NOW.getDay())
  })

  it('drops nudges that fall inside quiet hours', () => {
    const h = habit({ id: 9, deadline: '20:00', reminderOffset: 0 })
    const plan = buildPlan(options({ habits: [h], quietHours: { start: '18:00', end: '21:00' } }))
    expect(plan).toEqual([])
  })
})

describe('buildPlan — task nudges', () => {
  const t = todo({ id: 12, dueDate: '2026-06-10', dueTime: '17:30' })

  it('includes task reminders when enabled', () => {
    const plan = buildPlan(options({ todos: [t] }))
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ kind: 'task', title: 'Pay rent' })
    expect(plan[0].at.getHours()).toBe(17)
    expect(plan[0].at.getMinutes()).toBe(30)
  })

  it('omits task reminders when taskReminders is false', () => {
    expect(buildPlan(options({ todos: [t], taskReminders: false }))).toEqual([])
  })

  it('skips completed and undated tasks', () => {
    const done = todo({ id: 13, done: true, dueDate: '2026-06-10', dueTime: '17:30' })
    const undated = todo({ id: 14 })
    expect(buildPlan(options({ todos: [done, undated] }))).toEqual([])
  })
})

describe('buildPlan — digest', () => {
  const habits = [1, 2, 3].map((id) => habit({ id, deadline: '20:00', reminderOffset: 0 }))

  it('collapses several nudges in the same hour into one', () => {
    const plan = buildPlan(options({ habits, digest: true }))
    // One combined nudge per day for the seven-day horizon.
    expect(plan).toHaveLength(7)
    expect(plan.every((nudge) => nudge.kind === 'habit')).toBe(true)
    expect(plan[0].title).toBe('3 habits to do')
    expect(plan[0].at.getHours()).toBe(20)
  })

  it('keeps every nudge when digest is off', () => {
    expect(buildPlan(options({ habits, digest: false }))).toHaveLength(21)
  })

  it('leaves a lone nudge in an hour untouched', () => {
    const plan = buildPlan(
      options({
        habits: [habit({ id: 1, deadline: '20:00', reminderOffset: 0 })],
        digest: true,
      }),
    )
    expect(plan).toHaveLength(7)
    expect(plan[0].title).toBe('Test habit')
  })

  it('does not collapse nudges from different days', () => {
    const plan = buildPlan(options({ habits, digest: true }))
    const days = new Set(plan.map((nudge) => nudge.at.getDate()))
    expect(days.size).toBe(7)
  })
})
