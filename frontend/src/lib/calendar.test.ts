import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { normalizeHabit } from './habit'
import { dayDescription, dayStatus } from './calendar'

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

const TODAY = '2026-06-10'
const HISTORY_START = '2026-06-01'

describe('dayStatus', () => {
  it('is "future" for days after today', () => {
    expect(dayStatus('2026-06-11', [habit({ id: 1 })], HISTORY_START, TODAY)).toBe('future')
  })

  it('is "none" for days before tracking started', () => {
    expect(dayStatus('2026-05-31', [habit({ id: 2 })], HISTORY_START, TODAY)).toBe('none')
  })

  it('is "none" when no habit existed yet', () => {
    const createdLater = habit({ id: 3, createdAt: '2026-06-05T00:00:00.000Z' })
    expect(dayStatus('2026-06-03', [createdLater], HISTORY_START, TODAY)).toBe('none')
  })

  it('is "empty" when nothing was logged', () => {
    expect(dayStatus(TODAY, [habit({ id: 4 })], HISTORY_START, TODAY)).toBe('empty')
  })

  it('is "partial" when some but not all habits were logged', () => {
    const done = habit({ id: 5, history: [TODAY] })
    const notDone = habit({ id: 6 })
    expect(dayStatus(TODAY, [done, notDone], HISTORY_START, TODAY)).toBe('partial')
  })

  it('is "full" when every habit that existed was logged', () => {
    const a = habit({ id: 7, history: [TODAY] })
    const b = habit({ id: 8, history: [TODAY] })
    expect(dayStatus(TODAY, [a, b], HISTORY_START, TODAY)).toBe('full')
  })

  it('ignores habits created after the day', () => {
    const existing = habit({ id: 9, history: [TODAY] })
    const later = habit({ id: 10, createdAt: '2026-06-20T00:00:00.000Z' })
    expect(dayStatus(TODAY, [existing, later], HISTORY_START, TODAY)).toBe('full')
  })

  it('is "none" when there is no history start at all', () => {
    expect(dayStatus(TODAY, [habit({ id: 11, history: [TODAY] })], null, TODAY)).toBe('none')
  })
})

describe('dayDescription', () => {
  it('reports how many of the day\u2019s habits were done', () => {
    const done = habit({ id: 12, history: [TODAY] })
    const notDone = habit({ id: 13 })
    expect(dayDescription(TODAY, [done, notDone], HISTORY_START, TODAY)).toMatch(/1 of 2 done$/)
  })

  it('reuses a status computed by the caller', () => {
    const done = habit({ id: 14, history: [TODAY] })
    const notDone = habit({ id: 15 })
    const status = dayStatus(TODAY, [done, notDone], HISTORY_START, TODAY)
    expect(dayDescription(TODAY, [done, notDone], HISTORY_START, TODAY, status)).toBe(
      dayDescription(TODAY, [done, notDone], HISTORY_START, TODAY),
    )
  })

  it('labels days with no data', () => {
    expect(dayDescription('2026-05-31', [habit({ id: 16 })], HISTORY_START, TODAY)).toMatch(
      /no data$/,
    )
  })
})
