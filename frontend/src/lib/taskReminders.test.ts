import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { normalizeTodo } from './todo'
import { TASK_NUDGE_HOUR, taskReminderAt, taskReminderBody } from './taskReminders'

function todo(overrides: Partial<Todo> = {}): Todo {
  return normalizeTodo({
    id: 1,
    title: 'Pay rent',
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
    ...overrides,
  } as Todo)
}

// A fixed local reference: 4 Nov 2026, 10:00.
const NOW = new Date(2026, 10, 4, 10, 0, 0)

describe('taskReminderAt', () => {
  it('reminds at the exact due time', () => {
    const at = taskReminderAt(todo({ dueDate: '2026-11-04', dueTime: '17:30' }), NOW)
    expect(at?.getHours()).toBe(17)
    expect(at?.getMinutes()).toBe(30)
  })

  it('uses a gentle morning nudge when there is only a date', () => {
    const at = taskReminderAt(todo({ dueDate: '2026-11-05' }), NOW)
    expect(at?.getHours()).toBe(TASK_NUDGE_HOUR)
    expect(at?.getMinutes()).toBe(0)
    expect(at?.getDate()).toBe(5)
  })

  it('returns nothing for a moment already in the past', () => {
    expect(taskReminderAt(todo({ dueDate: '2026-11-03', dueTime: '09:00' }), NOW)).toBeNull()
    // Today at 09:00 is already behind the 10:00 reference.
    expect(taskReminderAt(todo({ dueDate: '2026-11-04' }), NOW)).toBeNull()
  })

  it('skips done, archived and undated tasks', () => {
    expect(taskReminderAt(todo({ dueDate: '2026-11-05', done: true }), NOW)).toBeNull()
    expect(taskReminderAt(todo({ dueDate: '2026-11-05', archived: true }), NOW)).toBeNull()
    expect(taskReminderAt(todo({ dueDate: null }), NOW)).toBeNull()
  })
})

describe('taskReminderBody', () => {
  it('names the time when there is one, otherwise just "today"', () => {
    expect(taskReminderBody(todo({ title: 'Pay rent', dueTime: '17:30' }), '24')).toBe(
      '“Pay rent” is due at 17:30.',
    )
    expect(taskReminderBody(todo({ title: 'Call mum' }), '12')).toBe('“Call mum” is due today.')
  })
})
