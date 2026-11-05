import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { normalizeTodo, sortTodos } from './todo'

function todo(overrides: Partial<Todo>): Todo {
  return normalizeTodo({
    id: 1,
    title: 'Task',
    note: null,
    category: 'personal',
    done: false,
    dueDate: null,
    dueTime: null,
    importance: 'medium',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  } as Todo)
}

describe('normalizeTodo', () => {
  it('defaults older rows to medium priority and not-archived', () => {
    const legacy = { ...todo({}) }
    delete (legacy as Partial<Todo>).importance
    delete (legacy as Partial<Todo>).archived
    const normalized = normalizeTodo(legacy as Todo)
    expect(normalized.importance).toBe('medium')
    expect(normalized.archived).toBe(false)
  })
})

describe('sortTodos', () => {
  it('sinks archived tasks below everything', () => {
    const archived = todo({ id: 1, title: 'Old', archived: true })
    const open = todo({ id: 2, title: 'New' })
    const order = sortTodos([archived, open]).map((t) => t.id)
    expect(order).toEqual([2, 1])
  })

  it('floats higher priority up within the same due slot', () => {
    const low = todo({ id: 1, importance: 'low' })
    const high = todo({ id: 2, importance: 'high' })
    const medium = todo({ id: 3, importance: 'medium' })
    expect(sortTodos([low, medium, high]).map((t) => t.importance)).toEqual([
      'high',
      'medium',
      'low',
    ])
  })

  it('still orders by due date before priority', () => {
    const soonLow = todo({ id: 1, dueDate: '2026-01-01', importance: 'low' })
    const laterHigh = todo({ id: 2, dueDate: '2026-02-01', importance: 'high' })
    expect(sortTodos([laterHigh, soonLow]).map((t) => t.id)).toEqual([1, 2])
  })

  it('places completed tasks after open ones', () => {
    const open = todo({ id: 1 })
    const done = todo({
      id: 2,
      done: true,
      completedAt: '2026-01-02T00:00:00.000Z',
    })
    expect(sortTodos([done, open]).map((t) => t.id)).toEqual([1, 2])
  })
})
