import { describe, expect, it } from 'vitest'
import { normalizeHabit } from './habit'
import { orderHabits } from './orderHabits'
import { toISODate } from './streak'
import type { Habit } from '../types'

const NOW = new Date(2026, 5, 10, 12, 0, 0)
const MONDAY = 1 as const
const TODAY = toISODate(NOW)

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: `Habit ${partial.id}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

describe('orderHabits', () => {
  it('sinks completed habits to the bottom in the default mode', () => {
    const a = habit({ id: 1, order: 1 })
    const b = habit({ id: 2, order: 2, history: [TODAY] })
    const c = habit({ id: 3, order: 3 })
    const ids = orderHabits([a, b, c], 'incomplete', NOW, MONDAY).map((h) => h.id)
    expect(ids).toEqual([1, 3, 2])
  })

  it('keeps stored order in manual mode, including completed habits', () => {
    const a = habit({ id: 1, order: 3 })
    const b = habit({ id: 2, order: 1, history: [TODAY] })
    const c = habit({ id: 3, order: 2 })
    expect(orderHabits([a, b, c], 'manual', NOW, MONDAY).map((h) => h.id)).toEqual([2, 3, 1])
  })

  it('orders by deadline, then stored order', () => {
    const a = habit({ id: 1, order: 2, deadline: '20:00' })
    const b = habit({ id: 2, order: 1, deadline: '08:00' })
    const c = habit({ id: 3, order: 0, deadline: '08:00' })
    expect(orderHabits([a, b, c], 'deadline', NOW, MONDAY).map((h) => h.id)).toEqual([3, 2, 1])
  })

  it('orders by name', () => {
    const a = habit({ id: 1, name: 'Zebra', order: 0 })
    const b = habit({ id: 2, name: 'apple', order: 1 })
    const c = habit({ id: 3, name: 'Mango', order: 2 })
    expect(orderHabits([a, b, c], 'name', NOW, MONDAY).map((h) => h.name)).toEqual([
      'apple',
      'Mango',
      'Zebra',
    ])
  })
})
