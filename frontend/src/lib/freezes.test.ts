import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { normalizeHabit } from './habit'
import { freezeRefillPatch, missedDays, nextFreezeDate, WEEKLY_FREEZES } from './freezes'
import { streakState } from './streak'
import { DEFAULT_SETTINGS } from '../data/settingsStore'

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

// A fixed Wednesday lunchtime: 10 June 2026 (week starts Monday 8 June).
const NOW = new Date(2026, 5, 10, 12, 0, 0)

describe('missedDays', () => {
  it('lists the missed days since the last completion, most recent first', () => {
    const h = habit({ id: 1, history: ['2026-06-08'] })
    expect(missedDays(h, NOW)).toEqual(['2026-06-09'])
  })

  it('steps over off-schedule days for a weekdays habit', () => {
    const h = habit({
      id: 2,
      schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      history: ['2026-06-05'], // Friday
    })
    // Sat/Sun are off, so only Mon 8 + Tue 9 count.
    expect(missedDays(h, NOW)).toEqual(['2026-06-09', '2026-06-08'])
  })

  it('never flags a flexible weekly habit or a habit with no history', () => {
    const weekly = habit({
      id: 3,
      schedule: { type: 'weekly', perWeek: 3 },
      history: ['2026-06-01'],
    })
    expect(missedDays(weekly, NOW)).toEqual([])
    expect(missedDays(habit({ id: 4 }), NOW)).toEqual([])
  })

  it('only counts the days still unprotected after a freeze', () => {
    // 8 June is frozen, so only 9 June is left to protect.
    const h = habit({ id: 5, history: ['2026-06-06'], frozen: ['2026-06-08'] })
    expect(missedDays(h, NOW)).toEqual(['2026-06-09'])
  })
})

describe('nextFreezeDate', () => {
  it('picks the earliest missed day so the gap closes from the back', () => {
    const h = habit({ id: 6, history: ['2026-06-06'] })
    expect(nextFreezeDate(h, NOW)).toBe('2026-06-07')
  })
})

describe('streak with freezes', () => {
  it('reports a broken streak when days are missed', () => {
    const h = habit({ id: 7, history: ['2026-06-07'], streakCount: 5 })
    expect(streakState(h, NOW).level).toBe('broken')
  })

  it('brings the streak back once the gap is frozen', () => {
    const h = habit({ id: 8, history: ['2026-06-07'], frozen: ['2026-06-09'], streakCount: 5 })
    const state = streakState(h, NOW)
    expect(state.level).toBe('safe')
    expect(state.count).toBe(5)
  })
})

describe('freezeRefillPatch', () => {
  it('tops the allowance back up once per week', () => {
    const current = {
      ...DEFAULT_SETTINGS,
      weekStart: 1 as const,
      freezeTokens: 0,
      lastFreezeWeek: '2026-06-08',
    }
    expect(freezeRefillPatch(current, NOW)).toBeNull()

    const stale = { ...current, lastFreezeWeek: '2026-06-01' }
    expect(freezeRefillPatch(stale, NOW)).toEqual({
      freezeTokens: WEEKLY_FREEZES,
      lastFreezeWeek: '2026-06-08',
    })
  })
})
