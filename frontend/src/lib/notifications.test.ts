import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { reminderHorizonDate, reminderOccurrences, snoozeAt } from './notifications'

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 7,
    name: 'Read',
    streakCount: 0,
    lastCompletedDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    colorIndex: 0,
    deadline: '20:00',
    history: [],
    frozen: [],
    schedule: { type: 'daily' },
    target: 1,
    category: 'General',
    timeOfDay: 'evening',
    archived: false,
    order: 0,
    reminderOffset: 0,
    ...overrides,
  }
}

// A fixed local-time reference: 4 Nov 2026, 10:00.
const NOW = new Date(2026, 10, 4, 10, 0, 0)

describe('reminderOccurrences', () => {
  it('arms one daily nudge for each day of the horizon', () => {
    const occurrences = reminderOccurrences(habit(), NOW, 7)
    expect(occurrences.map((o) => o.dayOffset)).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const { at } of occurrences) {
      expect(at.getHours()).toBe(20)
      expect(at.getMinutes()).toBe(0)
    }
  })

  it('skips today when the reminder time has already passed', () => {
    const occurrences = reminderOccurrences(
      habit({ deadline: '09:00', reminderOffset: 60 }),
      NOW,
      7,
    )
    // Reminder is 08:00, already past at 10:00, so it starts tomorrow.
    expect(occurrences.map((o) => o.dayOffset)).toEqual([1, 2, 3, 4, 5, 6])
    expect(occurrences[0].at.getHours()).toBe(8)
  })

  it('only schedules the selected weekdays', () => {
    const tomorrow = (NOW.getDay() + 1) % 7
    const occurrences = reminderOccurrences(
      habit({ schedule: { type: 'weekdays', days: [tomorrow] } }),
      NOW,
      8,
    )
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].at.getDay()).toBe(tomorrow)
  })

  it('still covers a weekday that has already passed today', () => {
    const occurrences = reminderOccurrences(
      habit({ deadline: '09:00', schedule: { type: 'weekdays', days: [NOW.getDay()] } }),
      NOW,
      8,
    )
    // Next occurrence of the same weekday is a full week away.
    expect(occurrences).toHaveLength(1)
    expect(occurrences[0].dayOffset).toBe(7)
  })

  it('returns nothing when the habit has no reminder', () => {
    expect(reminderOccurrences(habit({ reminderOffset: null }), NOW)).toEqual([])
  })
})

describe('reminderHorizonDate', () => {
  it('reports the last day of the rolling alarm window', () => {
    // Occurrences cover today plus the next seven days.
    expect(reminderHorizonDate(NOW).getDate()).toBe(11)
    expect(reminderHorizonDate(NOW).getMonth()).toBe(10)
    expect(reminderHorizonDate(NOW).getFullYear()).toBe(2026)
  })

  it('handles a window that crosses a month boundary', () => {
    const endOfMonth = new Date(2026, 10, 28, 10, 0, 0)
    const horizon = reminderHorizonDate(endOfMonth)
    expect(horizon.getMonth()).toBe(11) // December
    expect(horizon.getDate()).toBe(5)
  })
})

describe('snoozeAt', () => {
  it('adds ten minutes', () => {
    expect(snoozeAt('snooze_10', new Date(2026, 10, 4, 9, 0))).toEqual(new Date(2026, 10, 4, 9, 10))
  })

  it('adds one hour', () => {
    expect(snoozeAt('snooze_1h', new Date(2026, 10, 4, 9, 0))).toEqual(new Date(2026, 10, 4, 10, 0))
  })

  it('treats the legacy snooze id as one hour', () => {
    expect(snoozeAt('snooze', new Date(2026, 10, 4, 9, 30))).toEqual(new Date(2026, 10, 4, 10, 30))
  })

  it('sends “tomorrow” to 9am the next day', () => {
    expect(snoozeAt('snooze_tomorrow', new Date(2026, 10, 4, 23, 45))).toEqual(
      new Date(2026, 10, 5, 9, 0),
    )
  })

  it('rolls across a month boundary', () => {
    expect(snoozeAt('snooze_tomorrow', new Date(2026, 10, 30, 20, 0))).toEqual(
      new Date(2026, 11, 1, 9, 0),
    )
  })
})
