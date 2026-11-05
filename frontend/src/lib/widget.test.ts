import { describe, expect, it } from 'vitest'
import type { Habit, Todo } from '../types'
import { normalizeHabit } from './habit'
import { normalizeTodo } from './todo'
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

function task(partial: Partial<Todo> & { id: number }): Todo {
  return normalizeTodo({
    title: `Task ${partial.id}`,
    note: null,
    category: 'personal',
    done: false,
    dueDate: null,
    dueTime: null,
    importance: 'medium',
    recurrence: 'none',
    subtasks: [],
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...partial,
  } as Todo)
}

describe('buildSnapshot', () => {
  it('reports today only, with the current period', () => {
    const off = habit({
      id: 1,
      schedule: { type: 'weekdays', days: [(NOW.getDay() + 1) % 7] },
      name: 'Not today',
    })
    const done = habit({ id: 2, name: 'Done one', history: [TODAY] })
    const still = habit({ id: 3, name: 'Still to do' })

    const snapshot = buildSnapshot([off, done, still], [], NOW, MONDAY)
    expect(snapshot.period).toBe('Morning')
    expect(snapshot.total).toBe(2)
    expect(snapshot.done).toBe(1)
    expect(snapshot.items.map((i) => i.name)).toEqual(['Done one', 'Still to do'])
  })

  it('includes tasks that are overdue or due today, newest due first', () => {
    const overdue = task({ id: 1, title: 'Overdue', dueDate: '2026-06-09' })
    const today = task({ id: 2, title: 'Due today', dueDate: TODAY })
    const later = task({ id: 3, title: 'Next week', dueDate: '2026-06-20' })
    const finished = task({ id: 4, title: 'Done', dueDate: TODAY, done: true })

    const snapshot = buildSnapshot([], [overdue, today, later, finished], NOW, MONDAY)
    expect(snapshot.taskTotal).toBe(2)
    expect(snapshot.taskItems).toEqual(['Overdue', 'Due today'])
  })
})
