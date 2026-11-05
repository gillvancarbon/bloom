import { describe, expect, it } from 'vitest'
import type { Settings } from '../types'
import { normalizeHabit } from './habit'
import {
  minutesOfDay,
  nearestReminderPreset,
  normalizeReminderOffset,
  offsetPhrase,
  reminderBody,
  reminderClock,
  reminderPreview,
  reminderTimeFor,
  snapReminderOffset,
  toHHMM,
} from './reminder'

const SETTINGS = {
  notificationsEnabled: true,
  timeFormat: '12',
} as Settings

describe('minutesOfDay / toHHMM', () => {
  it('round-trips a time', () => {
    expect(minutesOfDay('21:30')).toBe(1290)
    expect(toHHMM(1290)).toBe('21:30')
  })

  it('clamps beyond a single day', () => {
    expect(toHHMM(-30)).toBe('00:00')
    expect(toHHMM(2000)).toBe('23:59')
    expect(minutesOfDay('')).toBe(0)
  })
})

describe('reminderClock', () => {
  it('moves the deadline back by the offset', () => {
    expect(reminderClock('21:00', 60)).toBe('20:00')
    // Never wraps to the previous day; it clamps to the start of the day.
    expect(reminderClock('00:30', 60)).toBe('00:00')
    expect(reminderClock('23:59', 0)).toBe('23:59')
  })
})

describe('nearestReminderPreset', () => {
  it.each([
    [0, 0],
    [10, 15],
    [16, 15],
    [35, 30],
    [90, 60],
    [170, 180],
    [9999, 180],
  ])('%i → %i', (input, expected) => {
    expect(nearestReminderPreset(input)).toBe(expected)
  })
})

describe('normalizeReminderOffset / snapReminderOffset', () => {
  it('treats empty and unknown values as no reminder', () => {
    expect(normalizeReminderOffset(null)).toBeNull()
    expect(normalizeReminderOffset(undefined)).toBeNull()
    expect(normalizeReminderOffset('')).toBeNull()
    expect(normalizeReminderOffset('nope')).toBeNull()
  })

  it('clamps negatives and rounds', () => {
    expect(normalizeReminderOffset(-5)).toBe(0)
    expect(normalizeReminderOffset(29.6)).toBe(30)
  })

  it('snaps to a preset', () => {
    expect(snapReminderOffset(50)).toBe(60)
    expect(snapReminderOffset(null)).toBeNull()
  })
})

describe('offsetPhrase', () => {
  it('reads naturally', () => {
    expect(offsetPhrase(15)).toBe('15 minutes')
    expect(offsetPhrase(60)).toBe('1 hour')
    expect(offsetPhrase(180)).toBe('3 hours')
  })
})

describe('reminderTimeFor / reminderPreview', () => {
  const habit = normalizeHabit({ id: 1, name: 'Read', deadline: '21:00', reminderOffset: 60 })

  it('is null when reminders are off', () => {
    expect(reminderTimeFor(habit, { ...SETTINGS, notificationsEnabled: false })).toBeNull()
    expect(reminderPreview(habit, { ...SETTINGS, notificationsEnabled: false })).toBeNull()
  })

  it('is null without an offset', () => {
    const off = normalizeHabit({ id: 2, name: 'Read', deadline: '21:00', reminderOffset: null })
    expect(reminderPreview(off, SETTINGS)).toBeNull()
  })

  it('previews the computed clock time', () => {
    expect(reminderTimeFor(habit, SETTINGS)).toBe('20:00')
    expect(reminderPreview(habit, SETTINGS)).toBe('8:00 PM')
  })
})

describe('reminderBody', () => {
  it('describes the offset', () => {
    const habit = normalizeHabit({ id: 1, name: 'Read', reminderOffset: 60 })
    expect(reminderBody(habit)).toBe('“Read” is due in 1 hour.')
  })

  it('adds the daily target when set', () => {
    const habit = normalizeHabit({ id: 2, name: 'Water', reminderOffset: 15, target: 3 })
    expect(reminderBody(habit)).toBe('“Water” is due in 15 minutes (3× today).')
  })

  it('reads "Time for" at the deadline', () => {
    const habit = normalizeHabit({ id: 3, name: 'Floss', reminderOffset: 0 })
    expect(reminderBody(habit)).toBe('Time for “Floss”.')
  })
})

describe('normalizeHabit reminder migration', () => {
  it('reads an explicit offset', () => {
    expect(normalizeHabit({ id: 1, reminderOffset: 30 }).reminderOffset).toBe(30)
  })

  it('converts a legacy "HH:mm" time relative to the deadline', () => {
    const habit = normalizeHabit({ id: 1, deadline: '21:00', reminderTime: '20:00' })
    expect(habit.reminderOffset).toBe(60)
  })

  it('snaps a legacy time to the nearest preset', () => {
    const habit = normalizeHabit({ id: 1, deadline: '23:59', reminderTime: '20:00' })
    expect(habit.reminderOffset).toBe(180)
  })

  it('prefers an explicit null over a legacy time', () => {
    const habit = normalizeHabit({
      id: 1,
      deadline: '21:00',
      reminderTime: '20:00',
      reminderOffset: null,
    })
    expect(habit.reminderOffset).toBeNull()
  })

  it('defaults to no reminder', () => {
    expect(normalizeHabit({ id: 1 }).reminderOffset).toBeNull()
  })
})
