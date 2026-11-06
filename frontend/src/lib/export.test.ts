import { describe, expect, it } from 'vitest'
import type { Habit, Todo } from '../types'
import { normalizeHabit } from './habit'
import { normalizeTodo } from './todo'
import { EXPORT_SCHEMA_VERSION, parseBundle, toJson } from './export'

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
    recurrence: 'none',
    subtasks: [],
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  } as Todo)
}

function habit(overrides: Partial<Habit>): Habit {
  return normalizeHabit({
    id: 1,
    name: 'Habit',
    streakCount: 0,
    lastCompletedDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    colorIndex: 0,
    deadline: '23:59',
    history: [],
    frozen: [],
    schedule: { type: 'daily' },
    target: 1,
    category: 'General',
    timeOfDay: 'anytime',
    archived: false,
    order: 0,
    reminderOffset: null,
    ...overrides,
  } as Habit)
}

describe('toJson', () => {
  it('wraps habits and tasks in a labelled, versioned snapshot', () => {
    const parsed = JSON.parse(toJson([habit({})], [todo({})], new Date('2026-11-05T10:00:00.000Z')))
    expect(parsed.app).toBe('Bloom')
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION)
    expect(parsed.exportedAt).toBe('2026-11-05T10:00:00.000Z')
    expect(parsed.habits).toHaveLength(1)
    expect(parsed.todos).toHaveLength(1)
  })

  it('includes settings when supplied', () => {
    const parsed = JSON.parse(
      toJson([], [], new Date('2026-11-05T10:00:00.000Z'), { theme: 'dark' } as never),
    )
    expect(parsed.settings.theme).toBe('dark')
  })
})

describe('parseBundle', () => {
  it('round-trips an exported snapshot through normalisation', () => {
    const text = toJson(
      [habit({ id: 7, name: 'Gym', streakCount: 4, history: ['2026-11-04'] })],
      [todo({ id: 9, title: 'Tax', subtasks: [{ id: 'a', title: 'Find P60', done: true }] })],
      new Date('2026-11-05T10:00:00.000Z'),
    )
    const bundle = parseBundle(text)
    expect(bundle.habits).toHaveLength(1)
    expect(bundle.habits[0]).toMatchObject({ id: 7, name: 'Gym', streakCount: 4 })
    expect(bundle.todos[0]).toMatchObject({ id: 9, title: 'Tax' })
    expect(bundle.todos[0].subtasks).toHaveLength(1)
  })

  it('accepts a bare object with just habits or just tasks', () => {
    expect(parseBundle('{"todos":[]}')).toEqual({ habits: [], todos: [] })
    expect(parseBundle('{"habits":[{"id":1,"name":"Read"}]}').habits[0].name).toBe('Read')
  })

  it('rejects invalid JSON and unrelated files', () => {
    expect(() => parseBundle('not json')).toThrow(/valid JSON/)
    expect(() => parseBundle('[1,2,3]')).toThrow(/Bloom export/)
    expect(() => parseBundle('{"hello":"world"}')).toThrow(/habits or tasks/)
  })

  it('refuses a snapshot written by a newer version', () => {
    expect(() =>
      parseBundle(`{"app":"Bloom","schemaVersion":${EXPORT_SCHEMA_VERSION + 1},"todos":[]}`),
    ).toThrow(/newer version/)
  })

  it('round-trips saved preferences', () => {
    const text = toJson([], [], new Date(), {
      timeFormat: '24',
      weekStart: 1,
      onboarded: true,
    } as never)
    const bundle = parseBundle(text)
    expect(bundle.settings).toMatchObject({ timeFormat: '24', weekStart: 1, onboarded: true })
  })

  it('treats a snapshot with no version as the original format', () => {
    const bundle = parseBundle('{"app":"Bloom","todos":[]}')
    expect(bundle.todos).toEqual([])
  })
})
