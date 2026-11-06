import { beforeAll, describe, expect, it } from 'vitest'
import type { Todo } from '../types'

/**
 * Time-zone and daylight-saving behaviour.
 *
 * Bloom reasons in the user's *local* calendar day everywhere, so the tests
 * pin a zone that observes DST and check the two tricky transitions (spring
 * forward on 8 March 2026, fall back on 1 November 2026). Set the zone before
 * the modules load so every Date call sees it.
 */
process.env.TZ = 'America/New_York'

let toISODate: typeof import('./streak').toISODate
let daysSince: typeof import('./streak').daysSince
let nextOccurrence: typeof import('./todo').nextOccurrence
let taskDueMoment: typeof import('./taskReminders').taskDueMoment
let taskOverdueMoment: typeof import('./taskReminders').taskOverdueMoment
let snoozeAt: typeof import('./notifications').snoozeAt

beforeAll(async () => {
  ;({ toISODate, daysSince } = await import('./streak'))
  ;({ nextOccurrence } = await import('./todo'))
  ;({ taskDueMoment, taskOverdueMoment } = await import('./taskReminders'))
  ;({ snoozeAt } = await import('./notifications'))
})

function todo(overrides: Partial<Todo>): Todo {
  return {
    id: 1,
    title: 'Task',
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
  } as Todo
}

describe('local calendar dates', () => {
  it('uses the local day, not UTC, just after midnight', () => {
    // 04:00Z on 8 March is still 23:00 on the 7th in New York (EST).
    expect(toISODate(new Date('2026-03-08T04:00:00.000Z'))).toBe('2026-03-07')
  })

  it('counts whole local days across a spring-forward boundary', () => {
    const now = new Date(2026, 2, 8, 12, 0) // 8 March, noon
    expect(daysSince('2026-03-07', now)).toBe(1)
    expect(daysSince('2026-03-08', now)).toBe(0)
  })

  it('counts whole local days across a fall-back boundary', () => {
    const now = new Date(2026, 10, 1, 12, 0) // 1 November, noon
    expect(daysSince('2026-10-31', now)).toBe(1)
  })
})

describe('task reminders across DST', () => {
  it('keeps a date-only task at 9am local on the spring-forward day', () => {
    const at = taskDueMoment(todo({ dueDate: '2026-03-08' }))
    expect(at?.getHours()).toBe(9)
    expect(at && toISODate(at)).toBe('2026-03-08')
  })

  it('keeps a timed task at its stated local time on the spring-forward day', () => {
    const at = taskDueMoment(todo({ dueDate: '2026-03-08', dueTime: '14:30' }))
    expect(at?.getHours()).toBe(14)
    expect(at?.getMinutes()).toBe(30)
  })

  it('treats a date-only task as overdue at the end of its day, even after fall back', () => {
    const at = taskOverdueMoment(todo({ dueDate: '2026-11-01' }))
    expect(at && toISODate(at)).toBe('2026-11-01')
    expect(at?.getHours()).toBe(23)
    expect(at?.getMinutes()).toBe(59)
  })
})

describe('recurrence across DST', () => {
  it('does not skip the spring-forward day', () => {
    const from = new Date(2026, 2, 7, 12, 0) // 7 March
    expect(nextOccurrence('2026-03-07', 'daily', from)).toBe('2026-03-08')
  })

  it('does not skip the fall-back day', () => {
    const from = new Date(2026, 9, 31, 12, 0) // 31 October
    expect(nextOccurrence('2026-10-31', 'daily', from)).toBe('2026-11-01')
  })

  it('advances past the transition for a task due that day', () => {
    const from = new Date(2026, 2, 8, 12, 0) // 8 March
    expect(nextOccurrence('2026-03-08', 'daily', from)).toBe('2026-03-09')
  })
})

describe('snooze across DST', () => {
  it('snoozes to 9am the next local day, even into a DST change', () => {
    const at = snoozeAt('snooze_tomorrow', new Date(2026, 2, 7, 23, 45)) // 7 March, late
    expect(toISODate(at)).toBe('2026-03-08')
    expect(at.getHours()).toBe(9)
  })
})
