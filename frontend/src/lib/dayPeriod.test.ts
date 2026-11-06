import { describe, expect, it } from 'vitest'
import { normalizeHabit } from './habit'
import {
  asPeriod,
  clockAdvance,
  groupByPeriod,
  periodFromDeadline,
  periodFromMinutes,
  periodFromTime,
  shiftPeriod,
} from './dayPeriod'

const minutes = (hour: number, minute = 0) => hour * 60 + minute

describe('period boundaries', () => {
  it.each([
    [minutes(23, 59), 'evening'],
    [minutes(0, 0), 'evening'],
    [minutes(4, 59), 'evening'],
    [minutes(5, 0), 'morning'],
    [minutes(11, 59), 'morning'],
    [minutes(12, 0), 'afternoon'],
    [minutes(16, 59), 'afternoon'],
    [minutes(17, 0), 'evening'],
  ] as const)('%i minutes → %s', (value, expected) => {
    expect(periodFromMinutes(value)).toBe(expected)
  })
})

describe('period fallbacks', () => {
  it('derives a period from the deadline for older habits', () => {
    expect(periodFromDeadline('08:30')).toBe('morning')
    expect(periodFromDeadline('12:00')).toBe('afternoon')
    expect(periodFromDeadline('17:00')).toBe('evening')
    expect(periodFromDeadline('23:59')).toBe('evening')
  })

  it('reads the clock in local time', () => {
    expect(periodFromTime(new Date(2026, 5, 10, 7, 15))).toBe('morning')
    expect(periodFromTime(new Date(2026, 5, 10, 14, 0))).toBe('afternoon')
    expect(periodFromTime(new Date(2026, 5, 10, 21, 0))).toBe('evening')
  })

  it('accepts only the known values', () => {
    expect(asPeriod('morning')).toBe('morning')
    expect(asPeriod('evening')).toBe('evening')
    expect(asPeriod('anytime')).toBe('anytime')
    expect(asPeriod('night')).toBeNull()
    expect(asPeriod(undefined)).toBeNull()
  })
})

describe('navigating periods', () => {
  it('moves one step and clamps at the ends', () => {
    expect(shiftPeriod('morning', 1)).toBe('afternoon')
    expect(shiftPeriod('afternoon', -1)).toBe('morning')
    expect(shiftPeriod('evening', 1)).toBe('anytime')
    expect(shiftPeriod('anytime', -1)).toBe('evening')
    expect(shiftPeriod('anytime', 1)).toBe('anytime')
    expect(shiftPeriod('morning', -1)).toBe('morning')
  })
})

describe('clockAdvance (follow the clock)', () => {
  it('advances when the clock crosses into a new period', () => {
    expect(clockAdvance('morning', 'afternoon', 'morning', false)).toBe('afternoon')
    expect(clockAdvance('afternoon', 'evening', 'afternoon', false)).toBe('evening')
  })

  it('stays put while the clock is in the same period', () => {
    expect(clockAdvance('morning', 'morning', 'morning', false)).toBeNull()
    // The reader picked a period the clock hasn't reached yet — leave it.
    expect(clockAdvance('evening', 'morning', 'morning', false)).toBeNull()
  })

  it('jumps to the clock the moment following is switched on', () => {
    expect(clockAdvance('evening', 'morning', 'evening', true)).toBe('morning')
    // ...unless the reader is already on the current period.
    expect(clockAdvance('morning', 'morning', 'evening', true)).toBeNull()
  })

  it('never pulls the reader away from Anytime', () => {
    expect(clockAdvance('anytime', 'morning', 'evening', false)).toBeNull()
    expect(clockAdvance('anytime', 'evening', 'afternoon', true)).toBeNull()
  })
})

describe('groupByPeriod', () => {
  it('groups habits by their chosen period and keeps stored order', () => {
    const habit = (
      id: number,
      timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime',
      deadline?: string,
    ) => normalizeHabit({ id, name: `Habit ${id}`, timeOfDay, deadline })

    const groups = groupByPeriod([
      habit(1, 'evening'),
      habit(2, 'morning'),
      habit(3, 'afternoon'),
      habit(4, 'morning'),
      habit(5, undefined, '08:00'),
      habit(6, 'anytime'),
    ])

    expect(groups.morning.map((h) => h.id)).toEqual([2, 4, 5])
    expect(groups.afternoon.map((h) => h.id)).toEqual([3])
    expect(groups.evening.map((h) => h.id)).toEqual([1])
    expect(groups.anytime.map((h) => h.id)).toEqual([6])
  })
})
