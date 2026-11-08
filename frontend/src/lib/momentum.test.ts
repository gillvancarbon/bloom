import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { momentum, momentumTier } from './momentum'
import { normalizeHabit } from './habit'
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

/** The ISO dates for the `count` days ending on `now`, newest first. */
function isoDaysBack(now: Date, count: number, keep?: (day: Date) => boolean): string[] {
  const dates: string[] = []
  for (let offset = 0; offset < count; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    if (!keep || keep(day)) dates.push(toISODate(day))
  }
  return dates
}

const isWeekday = (day: Date) => day.getDay() >= 1 && day.getDay() <= 5

describe('momentum — daily habit', () => {
  it('reads 30/30 when every day was completed', () => {
    const h = habit({ id: 1, history: isoDaysBack(NOW, 30) })
    expect(momentum(h, NOW)).toEqual({ completed: 30, of: 30 })
    expect(momentumTier(30, 30)).toBe('strong')
  })

  it('lowers the ratio for a gap without punishing it', () => {
    // Complete the newest ten days and the oldest ten, skip the middle ten.
    const history = isoDaysBack(NOW, 30).filter((_, i) => i < 10 || i >= 20)
    const h = habit({ id: 2, history })
    expect(momentum(h, NOW)).toEqual({ completed: 20, of: 30 })
    expect(momentumTier(20, 30)).toBe('steady')
  })
})

describe('momentum — weekdays habit', () => {
  it('counts only the selected weekdays in the window', () => {
    // 12 May – 10 Jun 2026 (30 days ending on a Wednesday) holds 22 weekdays.
    const h = habit({
      id: 3,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: isoDaysBack(NOW, 30, isWeekday),
    })
    expect(momentum(h, NOW)).toEqual({ completed: 22, of: 22 })
  })

  it('counts a completed off-schedule day in `completed`, not in `of`', () => {
    const history = isoDaysBack(NOW, 30, isWeekday)
    const h = habit({
      id: 4,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: [...history, ...isoDaysBack(NOW, 30, (day) => day.getDay() === 6)],
    })
    const result = momentum(h, NOW)
    expect(result.of).toBe(22)
    expect(result.completed).toBe(22 + isoDaysBack(NOW, 30, (day) => day.getDay() === 6).length)
  })
})

describe('momentum — weekly N× habit', () => {
  it('scales the target by the window length', () => {
    const h = habit({
      id: 5,
      schedule: { type: 'weekly', perWeek: 3 },
      history: isoDaysBack(NOW, 10),
    })
    // round(3 * 30 / 7) = round(12.857) = 13.
    expect(momentum(h, NOW)).toEqual({ completed: 10, of: 13 })
    expect(momentumTier(10, 13)).toBe('steady')
  })
})

describe('momentum — edge cases', () => {
  it('never throws on empty history', () => {
    const h = habit({ id: 6 })
    expect(momentum(h, NOW)).toEqual({ completed: 0, of: 30 })
    expect(momentumTier(0, 30)).toBe('starting')
  })

  it('respects a custom window', () => {
    const h = habit({ id: 7, history: isoDaysBack(NOW, 3) })
    expect(momentum(h, NOW, 7)).toEqual({ completed: 3, of: 7 })
  })

  it('returns zeroes for a non-positive window', () => {
    const h = habit({ id: 8, history: isoDaysBack(NOW, 30) })
    expect(momentum(h, NOW, 0)).toEqual({ completed: 0, of: 0 })
  })
})

describe('momentumTier', () => {
  it.each([
    [0, 0, 'starting'],
    [0, 30, 'starting'],
    [19, 100, 'starting'],
    [20, 100, 'building'],
    [49, 100, 'building'],
    [50, 100, 'steady'],
    [79, 100, 'steady'],
    [80, 100, 'strong'],
    [100, 100, 'strong'],
  ] as const)('%i / %i → %s', (completed, of, tier) => {
    expect(momentumTier(completed, of)).toBe(tier)
  })
})
