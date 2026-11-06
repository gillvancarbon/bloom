import { describe, expect, it } from 'vitest'
import type { Todo } from '../types'
import { normalizeTodo } from './todo'
import {
  OVERDUE_NUDGE_GRACE_MS,
  TASK_NUDGE_HOUR,
  taskOverdue,
  taskOverdueBody,
  taskOverdueKey,
  taskReminderAt,
  taskReminderBody,
} from './taskReminders'

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

describe('taskOverdue', () => {
  it('flags a task once its due moment is safely behind us', () => {
    // 09:00 yesterday is well past the 10:00 reference and its grace period.
    expect(taskOverdue(todo({ dueDate: '2026-11-03', dueTime: '09:00' }), NOW)).toBe(true)
    expect(taskOverdue(todo({ dueDate: '2026-11-03' }), NOW)).toBe(true)
  })

  it('waits out the grace period so it never doubles the due-time reminder', () => {
    // Due at 09:30 today, reference is 10:00 — only 30 min over, past grace.
    expect(taskOverdue(todo({ dueDate: '2026-11-04', dueTime: '09:30' }), NOW)).toBe(true)
    // Due at 09:55 today, only 5 minutes over — still inside the grace period.
    expect(taskOverdue(todo({ dueDate: '2026-11-04', dueTime: '09:55' }), NOW)).toBe(false)
    expect(OVERDUE_NUDGE_GRACE_MS).toBeGreaterThan(5 * 60 * 1000)
  })

  it('keeps a date-only task calm until the end of its day', () => {
    // Due today but no time: not overdue at 10:00, matching the to-do screen.
    expect(taskOverdue(todo({ dueDate: '2026-11-04' }), NOW)).toBe(false)
    // The same boundary used by the list: overdue once tomorrow arrives.
    expect(taskOverdue(todo({ dueDate: '2026-11-04' }), new Date(2026, 10, 5, 0, 30))).toBe(true)
  })

  it('is never overdue while the due moment is still ahead', () => {
    expect(taskOverdue(todo({ dueDate: '2026-11-04', dueTime: '17:00' }), NOW)).toBe(false)
    expect(taskOverdue(todo({ dueDate: '2026-11-05' }), NOW)).toBe(false)
  })

  it('never nudges a completed, archived or undated task', () => {
    const past = { dueDate: '2026-11-03', dueTime: '09:00' }
    expect(taskOverdue(todo({ ...past, done: true }), NOW)).toBe(false)
    expect(taskOverdue(todo({ ...past, archived: true }), NOW)).toBe(false)
    expect(taskOverdue(todo({ dueDate: null }), NOW)).toBe(false)
  })
})

describe('taskOverdueKey', () => {
  it('identifies one due occurrence and follows the due date/time', () => {
    expect(taskOverdueKey(todo({ id: 4, dueDate: '2026-11-03', dueTime: '09:00' }))).toBe(
      '4:2026-11-03:09:00',
    )
    expect(taskOverdueKey(todo({ id: 4, dueDate: '2026-11-03' }))).toBe('4:2026-11-03:')
    // A moved due date is a new occurrence, so it earns a fresh nudge.
    expect(taskOverdueKey(todo({ id: 4, dueDate: '2026-11-04' }))).toBe('4:2026-11-04:')
    expect(taskOverdueKey(todo({ dueDate: null }))).toBeNull()
  })
})

describe('taskOverdueBody', () => {
  it('names the missed time when there is one', () => {
    expect(taskOverdueBody(todo({ title: 'Pay rent', dueTime: '17:30' }), '24')).toBe(
      '“Pay rent” is overdue — it was due at 17:30.',
    )
    expect(taskOverdueBody(todo({ title: 'Call mum' }), '12')).toBe('“Call mum” is overdue.')
  })
})
