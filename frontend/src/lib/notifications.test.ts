import { describe, expect, it } from 'vitest'
import type { Habit, Settings } from '../types'
import {
  digestHabitOccurrences,
  habitOccurrenceId,
  isForeground,
  isQuietAt,
  overdueNudgeAllowed,
  reminderHorizonDate,
  reminderOccurrences,
  snoozeAt,
  type HabitOccurrence,
} from './notifications'

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

const BASE_SETTINGS = { notificationsEnabled: true, timeFormat: '12' } as Settings

describe('isQuietAt', () => {
  it('never holds a reminder back when quiet hours are off', () => {
    expect(isQuietAt(new Date(2026, 10, 4, 23, 0), BASE_SETTINGS)).toBe(false)
  })

  it('holds back a moment inside an overnight window, end exclusive', () => {
    const settings = {
      ...BASE_SETTINGS,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    } as Settings
    expect(isQuietAt(new Date(2026, 10, 4, 21, 59), settings)).toBe(false)
    expect(isQuietAt(new Date(2026, 10, 4, 22, 0), settings)).toBe(true)
    expect(isQuietAt(new Date(2026, 10, 5, 6, 59), settings)).toBe(true)
    expect(isQuietAt(new Date(2026, 10, 5, 7, 0), settings)).toBe(false)
  })
})

describe('isForeground', () => {
  it('follows document visibility on the web', () => {
    expect(isForeground({ native: false, visibilityState: 'visible' })).toBe(true)
    expect(isForeground({ native: false, visibilityState: 'hidden' })).toBe(false)
    expect(isForeground({ native: false })).toBe(false)
  })

  it('prefers a wired app-state signal on native', () => {
    expect(
      isForeground({ native: true, visibilityState: 'hidden', appState: { isActive: true } }),
    ).toBe(true)
    expect(
      isForeground({ native: true, visibilityState: 'visible', appState: { isActive: false } }),
    ).toBe(false)
  })

  it('falls back to visibility on native without an app-state signal', () => {
    expect(isForeground({ native: true, visibilityState: 'visible', appState: null })).toBe(true)
    expect(isForeground({ native: true, visibilityState: 'hidden', appState: null })).toBe(false)
  })
})

describe('overdueNudgeAllowed', () => {
  const quiet = { start: '22:00', end: '07:00' }

  it('is false when overdue nudges are switched off', () => {
    expect(overdueNudgeAllowed(new Date(2026, 10, 4, 12, 0), { overdueNudges: false }, null)).toBe(
      false,
    )
  })

  it('is false when the follow-up would land in quiet hours', () => {
    expect(overdueNudgeAllowed(new Date(2026, 10, 4, 23, 0), { overdueNudges: true }, quiet)).toBe(
      false,
    )
  })

  it('is true otherwise', () => {
    expect(overdueNudgeAllowed(new Date(2026, 10, 4, 12, 0), { overdueNudges: true }, quiet)).toBe(
      true,
    )
    expect(overdueNudgeAllowed(new Date(2026, 10, 4, 23, 0), { overdueNudges: true }, null)).toBe(
      true,
    )
  })
})

describe('digestHabitOccurrences', () => {
  const at = (hour: number, minute = 0, dayOffset = 0): Date => {
    const moment = new Date(NOW)
    moment.setDate(moment.getDate() + dayOffset)
    moment.setHours(hour, minute, 0, 0)
    return moment
  }
  const occurrence = (id: number, when: Date, dayOffset: number): HabitOccurrence => ({
    habit: habit({ id, name: `Habit ${id}` }),
    at: when,
    dayOffset,
  })

  it('collapses same-hour reminders into one digest at the earliest moment', () => {
    const nudges = digestHabitOccurrences([
      occurrence(1, at(20, 30), 0),
      occurrence(2, at(20, 0), 0),
      occurrence(3, at(20, 45), 0),
    ])
    expect(nudges).toHaveLength(1)
    expect(nudges[0].habits.map((h) => h.id)).toEqual([1, 2, 3])
    expect(nudges[0].at).toEqual(at(20, 0))
  })

  it('passes a lone reminder through with its ordinary id', () => {
    const nudges = digestHabitOccurrences([occurrence(7, at(20), 2)])
    expect(nudges).toHaveLength(1)
    expect(nudges[0].id).toBe(habitOccurrenceId(7, 2))
    expect(nudges[0].habits).toHaveLength(1)
  })

  it('keeps reminders from different hours or days apart', () => {
    const nudges = digestHabitOccurrences([
      occurrence(1, at(20), 0),
      occurrence(2, at(21), 0),
      occurrence(3, at(20, 0, 1), 1),
    ])
    expect(nudges).toHaveLength(3)
  })

  it('gives deterministic, collision-free digest ids above the habit range', () => {
    const input = [
      occurrence(1, at(20), 0),
      occurrence(2, at(20), 0),
      occurrence(3, at(9), 1),
      occurrence(4, at(9), 1),
    ]
    const ids = digestHabitOccurrences(input).map((nudge) => nudge.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(digestHabitOccurrences(input).map((nudge) => nudge.id)).toEqual(ids)
    for (const id of ids) {
      // Comfortably clear of any plausible per-habit id.
      expect(id).toBeGreaterThan(habitOccurrenceId(500, 7))
    }
  })
})
