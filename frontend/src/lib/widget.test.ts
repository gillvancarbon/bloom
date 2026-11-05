import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { normalizeHabit } from './habit'
import { buildSnapshot } from './widget'
import { toISODate } from './streak'

const NOW = new Date(2026, 5, 10, 8, 30) // Wednesday morning.
const MONDAY = 1 as const
const TODAY = toISODate(NOW)

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: `Habit ${partial.id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

describe('buildSnapshot', () => {
  it('reports today only, with the current period', () => {
    const off = habit({
      id: 1,
      schedule: { type: 'weekdays', days: [(NOW.getDay() + 1) % 7] },
      name: 'Not today',
    })
    const done = habit({ id: 2, name: 'Done one', history: [TODAY] })
    const todo = habit({ id: 3, name: 'Still to do' })

    const snapshot = buildSnapshot([off, done, todo], NOW, MONDAY)
    expect(snapshot.period).toBe('Morning')
    expect(snapshot.total).toBe(2)
    expect(snapshot.done).toBe(1)
    expect(snapshot.items.map((i) => i.name)).toEqual(['Done one', 'Still to do'])
  })
})
