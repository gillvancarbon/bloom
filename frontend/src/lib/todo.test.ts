import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import {
  addMonths,
  matchesTodo,
  nextOccurrence,
  normalizeTodo,
  sortTodos,
  subtaskProgress,
  todoBucket,
} from './todo'
import { toISODate } from './streak'

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

  it('sorts by priority, ignoring due date', () => {
    const soonLow = todo({ id: 1, dueDate: '2026-01-01', importance: 'low' })
    const laterHigh = todo({ id: 2, dueDate: '2026-02-01', importance: 'high' })
    const nowMedium = todo({ id: 3, importance: 'medium' })
    expect(sortTodos([soonLow, laterHigh, nowMedium], 'importance').map((t) => t.id)).toEqual([
      2, 3, 1,
    ])
  })

  it('sorts A–Z and newest first', () => {
    const beta = todo({ id: 1, title: 'Beta', createdAt: '2026-01-01T00:00:00.000Z' })
    const alpha = todo({ id: 2, title: 'Alpha', createdAt: '2026-03-01T00:00:00.000Z' })
    const gamma = todo({ id: 3, title: 'Gamma', createdAt: '2026-02-01T00:00:00.000Z' })

    expect(sortTodos([beta, alpha, gamma], 'name').map((t) => t.title)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
    expect(sortTodos([beta, alpha, gamma], 'created').map((t) => t.id)).toEqual([2, 3, 1])
  })

  it('still keeps done and archived tasks below open ones for every sort', () => {
    const open = todo({ id: 1, title: 'Zed' })
    const done = todo({ id: 2, title: 'Aaa', done: true, completedAt: '2026-01-02T00:00:00.000Z' })
    const archived = todo({ id: 3, title: 'Mmm', archived: true })
    expect(sortTodos([done, archived, open], 'name').map((t) => t.id)).toEqual([1, 2, 3])
  })

  it('follows the manual order when asked', () => {
    const a = todo({ id: 1, title: 'First' })
    const b = todo({ id: 2, title: 'Second' })
    const c = todo({ id: 3, title: 'Third' })
    expect(sortTodos([c, a, b], 'manual', [2, 3, 1]).map((t) => t.id)).toEqual([2, 3, 1])
  })

  it('puts tasks missing from the manual order last, newest first', () => {
    const ranked = todo({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = todo({ id: 2, createdAt: '2026-03-01T00:00:00.000Z' })
    const older = todo({ id: 3, createdAt: '2026-02-01T00:00:00.000Z' })
    expect(sortTodos([older, newer, ranked], 'manual', [1]).map((t) => t.id)).toEqual([1, 2, 3])
  })

  it('keeps done and archived tasks below open ones in manual order', () => {
    const open = todo({ id: 1 })
    const done = todo({ id: 2, done: true, completedAt: '2026-01-02T00:00:00.000Z' })
    const archived = todo({ id: 3, archived: true })
    expect(sortTodos([done, archived, open], 'manual', [3, 2, 1]).map((t) => t.id)).toEqual([
      1, 2, 3,
    ])
  })
})

describe('todoBucket', () => {
  const now = new Date(2026, 10, 5, 10, 0, 0)

  it('puts overdue and today in Today, later dates in Upcoming, undated in Anytime', () => {
    expect(todoBucket(todo({ dueDate: '2026-11-05' }), now)).toBe('today')
    expect(todoBucket(todo({ dueDate: '2026-11-04' }), now)).toBe('today')
    expect(todoBucket(todo({ dueDate: '2026-11-06' }), now)).toBe('upcoming')
    expect(todoBucket(todo({ dueDate: null }), now)).toBe('anytime')
  })

  it('treats a passed time today as Today, not Overdue-elsewhere', () => {
    expect(todoBucket(todo({ dueDate: '2026-11-05', dueTime: '09:00' }), now)).toBe('today')
  })
})

describe('nextOccurrence', () => {
  const now = new Date(2026, 10, 5, 10, 0, 0)

  it('returns null for one-off tasks', () => {
    expect(nextOccurrence('2026-11-05', 'none', now)).toBeNull()
  })

  it('steps daily, weekly and monthly from the due date', () => {
    expect(nextOccurrence('2026-11-05', 'daily', now)).toBe('2026-11-06')
    expect(nextOccurrence('2026-11-05', 'weekly', now)).toBe('2026-11-12')
    expect(nextOccurrence('2026-11-05', 'monthly', now)).toBe('2026-12-05')
  })

  it('rolls an overdue task forward past today, not into the past', () => {
    expect(nextOccurrence('2026-10-01', 'daily', now)).toBe('2026-11-06')
    expect(nextOccurrence('2026-09-01', 'weekly', now)).toBe('2026-11-10')
  })

  it('clamps month ends', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', new Date(2026, 0, 31))).toBe('2026-02-28')
    // The next step must stay on the month's last day, not drift to the 28th.
    expect(nextOccurrence('2026-01-31', 'monthly', new Date(2026, 1, 28))).toBe('2026-03-31')
  })

  it('anchors to today when there is no due date', () => {
    expect(nextOccurrence(null, 'daily', now)).toBe('2026-11-06')
  })
})

describe('addMonths', () => {
  it('preserves the month-end chain Jan 31 → Feb 28 → Mar 31', () => {
    const feb = addMonths(new Date(2026, 0, 31), 1)
    expect(toISODate(feb)).toBe('2026-02-28')
    const mar = addMonths(feb, 1)
    expect(toISODate(mar)).toBe('2026-03-31')
  })

  it('clamps a normal day without treating it as month-end', () => {
    expect(toISODate(addMonths(new Date(2026, 0, 30), 1))).toBe('2026-02-28')
    expect(toISODate(addMonths(new Date(2026, 0, 15), 1))).toBe('2026-02-15')
  })
})

describe('subtask helpers', () => {
  it('counts progress and normalises malformed steps', () => {
    const withSteps = todo({
      subtasks: [
        { id: 'a', title: 'One', done: true },
        { id: 'b', title: 'Two', done: false },
        { id: '', title: '  ', done: false },
      ] as Todo['subtasks'],
    })
    expect(withSteps.subtasks).toHaveLength(2)
    expect(subtaskProgress(withSteps)).toEqual({ done: 1, total: 2 })
  })

  it('search matches title, note and steps', () => {
    const task = todo({ title: 'Tax return', note: 'find the P60', subtasks: [] })
    expect(matchesTodo(task, 'tax')).toBe(true)
    expect(matchesTodo(task, 'P60')).toBe(true)
    expect(matchesTodo(task, 'nope')).toBe(false)
    expect(matchesTodo(task, '  ')).toBe(true)
  })
})
