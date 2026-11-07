import { describe, expect, it } from 'vitest'
import type { Habit, HabitSchedule } from '../types'
import { normalizeHabit } from './habit'
import {
  completionsThisWeek,
  isCompleteForPeriod,
  normalizeSchedule,
  scheduleLabel,
  scheduleProgress,
  scheduledOccurrencesMissed,
  scheduledOn,
  scheduledOrCompletedToday,
  scheduledToday,
  streakState,
  weekRange,
} from './schedule'
import { toISODate } from './streak'

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

/** A fixed Wednesday lunchtime, in the local timezone. */
const NOW = new Date(2026, 5, 10, 12, 0, 0)
const MONDAY = 1 as const

describe('normalizeSchedule', () => {
  it('defaults to daily', () => {
    expect(normalizeSchedule(undefined)).toEqual({ type: 'daily' })
  })

  it('falls back to daily when a weekday list is empty or invalid', () => {
    expect(normalizeSchedule({ type: 'weekdays', days: [] })).toEqual({ type: 'daily' })
    expect(normalizeSchedule({ type: 'weekdays', days: [9, -1] })).toEqual({ type: 'daily' })
  })

  it('keeps valid weekdays and clamps weekly targets', () => {
    expect(normalizeSchedule({ type: 'weekdays', days: [1, 3, 5] })).toEqual({
      type: 'weekdays',
      days: [1, 3, 5],
    })
    expect(normalizeSchedule({ type: 'weekly', perWeek: 4 })).toEqual({
      type: 'weekly',
      perWeek: 4,
    })
    expect(normalizeSchedule({ type: 'weekly', perWeek: 99 })).toEqual({
      type: 'weekly',
      perWeek: 3,
    })
  })
})

describe('scheduleLabel', () => {
  const cases: Array<[HabitSchedule, string]> = [
    [{ type: 'daily' }, 'Every day'],
    [{ type: 'weekdays', days: [1, 2, 3, 4, 5] }, 'Weekdays'],
    [{ type: 'weekdays', days: [0, 6] }, 'Weekends'],
    [{ type: 'weekly', perWeek: 3 }, '3× / week'],
  ]
  it.each(cases)('%j → %s', (schedule, label) => {
    expect(scheduleLabel(schedule)).toBe(label)
  })
})

describe('scheduledToday', () => {
  it('is always true for a daily habit', () => {
    expect(scheduledToday(habit({ id: 1 }), NOW, MONDAY)).toBe(true)
  })

  it('respects the chosen weekdays', () => {
    const on = habit({
      id: 2,
      schedule: { type: 'weekdays', days: [NOW.getDay()] },
    })
    const off = habit({
      id: 3,
      schedule: { type: 'weekdays', days: [(NOW.getDay() + 1) % 7] },
    })
    expect(scheduledToday(on, NOW, MONDAY)).toBe(true)
    expect(scheduledToday(off, NOW, MONDAY)).toBe(false)
  })
})

describe('scheduledOn', () => {
  it('answers for whichever day it is asked about', () => {
    const onMonday = habit({ id: 20, schedule: { type: 'weekdays', days: [1] } })
    const monday = new Date(2026, 5, 8, 12, 0, 0) // 8 June 2026 is a Monday.
    const tuesday = new Date(2026, 5, 9, 12, 0, 0)
    expect(scheduledOn(onMonday, monday, MONDAY)).toBe(true)
    expect(scheduledOn(onMonday, tuesday, MONDAY)).toBe(false)
  })

  it('still counts weekly progress against the week in question', () => {
    const weekly = habit({ id: 21, schedule: { type: 'weekly', perWeek: 2 } })
    expect(scheduledOn(weekly, NOW, MONDAY)).toBe(true)
  })
})

describe('scheduledOrCompletedToday', () => {
  const today = toISODate(NOW)
  const { start } = weekRange(NOW, MONDAY)

  it('keeps daily habits visible', () => {
    expect(scheduledOrCompletedToday(habit({ id: 10 }), NOW, MONDAY)).toBe(true)
  })

  it('hides a weekday habit that is not due today', () => {
    const off = habit({
      id: 11,
      schedule: { type: 'weekdays', days: [(NOW.getDay() + 1) % 7] },
    })
    expect(scheduledOrCompletedToday(off, NOW, MONDAY)).toBe(false)
  })

  it('hides a weekly habit whose target was met earlier in the week', () => {
    const done = habit({
      id: 12,
      schedule: { type: 'weekly', perWeek: 1 },
      history: [start],
    })
    expect(start).not.toBe(today)
    expect(scheduledOrCompletedToday(done, NOW, MONDAY)).toBe(false)
  })

  it('keeps a weekly habit completed today so it can be undone', () => {
    const doneToday = habit({
      id: 13,
      schedule: { type: 'weekly', perWeek: 1 },
      history: [today],
    })
    expect(scheduledOrCompletedToday(doneToday, NOW, MONDAY)).toBe(true)
  })
})

describe('weekly progress', () => {
  it('counts only completions inside the current week', () => {
    const { start, end } = weekRange(NOW, MONDAY)
    const inside = [start, end]
    const outside = '2020-01-01'
    const h = habit({ id: 4, history: [...inside, outside] })
    expect(completionsThisWeek(h, NOW, MONDAY)).toBe(2)
  })

  it('marks a weekly habit complete once the target is met', () => {
    const { start } = weekRange(NOW, MONDAY)
    const day = (offset: number) => {
      const d = new Date(`${start}T00:00:00`)
      d.setDate(d.getDate() + offset)
      return toISODate(d)
    }
    const h = habit({
      id: 5,
      schedule: { type: 'weekly', perWeek: 3 },
      history: [day(0), day(1), day(2)],
    })
    const progress = scheduleProgress(h, NOW, MONDAY)
    expect(progress.done).toBe(3)
    expect(progress.target).toBe(3)
    expect(progress.complete).toBe(true)
    expect(isCompleteForPeriod(h, NOW, MONDAY)).toBe(true)
  })
})

describe('daily completion', () => {
  it('is complete when today is in the history', () => {
    const today = toISODate(NOW)
    expect(isCompleteForPeriod(habit({ id: 6, history: [today] }), NOW, MONDAY)).toBe(true)
    expect(isCompleteForPeriod(habit({ id: 7, history: [] }), NOW, MONDAY)).toBe(false)
  })
})

describe('scheduledOccurrencesMissed', () => {
  it('steps over off-schedule days for a weekday habit', () => {
    const h = habit({
      id: 30,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: ['2026-06-05'], // Friday
    })
    const monday = new Date(2026, 5, 8, 12, 0, 0)
    expect(scheduledOccurrencesMissed(h, '2026-06-05', monday, MONDAY)).toBe(0)
  })

  it('counts scheduled days that were skipped', () => {
    const h = habit({
      id: 31,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: ['2026-06-08'], // Monday
    })
    // Tuesday and Wednesday (today is excluded) are both scheduled and missed.
    expect(scheduledOccurrencesMissed(h, '2026-06-08', new Date(2026, 5, 10, 12), MONDAY)).toBe(1)
    expect(scheduledOccurrencesMissed(h, '2026-06-08', new Date(2026, 5, 11, 12), MONDAY)).toBe(2)
  })
})

describe('streakState (schedule-aware)', () => {
  it('keeps a weekday habit safe across a weekend', () => {
    const h = habit({
      id: 40,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: ['2026-06-05'], // Friday
      streakCount: 4,
    })
    const monday = new Date(2026, 5, 8, 12, 0, 0)
    expect(streakState(h, monday, MONDAY)).toEqual({ level: 'safe', count: 4 })
  })

  it('flags one missed scheduled day as risk', () => {
    const h = habit({
      id: 41,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: ['2026-06-08'], // Monday; Tuesday missed, now Wednesday
      streakCount: 6,
    })
    expect(streakState(h, NOW, MONDAY)).toEqual({ level: 'risk', count: 6 })
  })

  it('breaks a daily habit after two missed days', () => {
    const h = habit({ id: 42, history: ['2026-06-07'], streakCount: 9 })
    expect(streakState(h, NOW, MONDAY)).toEqual({ level: 'broken', count: 0 })
  })

  it('reports none for a habit with no history', () => {
    expect(streakState(habit({ id: 43 }), NOW, MONDAY)).toEqual({ level: 'none', count: 0 })
  })

  it('is safe while a weekly target last succeeded this week or last week', () => {
    const h = habit({
      id: 50,
      schedule: { type: 'weekly', perWeek: 3 },
      history: ['2026-06-05'], // the previous week
      streakCount: 2,
    })
    expect(streakState(h, NOW, MONDAY)).toEqual({ level: 'safe', count: 2 })
  })

  it('flags one missed full week as risk and two as broken', () => {
    const oneWeek = habit({
      id: 51,
      schedule: { type: 'weekly', perWeek: 3 },
      history: ['2026-05-29'], // two weeks before the current one
      streakCount: 2,
    })
    expect(streakState(oneWeek, NOW, MONDAY)).toEqual({ level: 'risk', count: 2 })

    const twoWeeks = habit({
      id: 52,
      schedule: { type: 'weekly', perWeek: 3 },
      history: ['2026-05-22'],
      streakCount: 7,
    })
    expect(streakState(twoWeeks, NOW, MONDAY)).toEqual({ level: 'broken', count: 0 })
  })
})
