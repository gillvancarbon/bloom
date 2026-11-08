import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

/** Yield a few microtasks so an unserialised read-modify-write would interleave. */
async function gate(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => {
      await gate()
      return { value: storage.get(key) ?? null }
    }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      await gate()
      storage.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      storage.delete(key)
    }),
  },
}))

const { localTodoStore } = await import('./localTodoStore')

beforeEach(() => {
  storage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('localTodoStore recurrence', () => {
  it('rolls a daily task forward instead of marking it done', async () => {
    const created = await localTodoStore.create({
      title: 'Water plants',
      note: null,
      category: 'chores',
      dueDate: '2026-11-04',
      dueTime: null,
      importance: 'medium',
      recurrence: 'daily',
      subtasks: [],
    })

    const updated = await localTodoStore.toggle(created.id)

    expect(updated.done).toBe(false)
    expect(updated.completedAt).toBeNull()
    expect(updated.dueDate).toBe('2026-11-05')
    expect(await localTodoStore.toggle(updated.id)).toMatchObject({
      done: false,
      dueDate: '2026-11-06',
    })
  })

  it('still completes a one-off task normally', async () => {
    const created = await localTodoStore.create({
      title: 'Post the letter',
      note: null,
      category: 'errands',
      dueDate: null,
      dueTime: null,
      importance: 'medium',
      recurrence: 'none',
      subtasks: [],
    })

    const updated = await localTodoStore.toggle(created.id)
    expect(updated.done).toBe(true)
    expect(updated.completedAt).toEqual(expect.any(String))
  })
})

describe('localTodoStore serialisation', () => {
  it('keeps both tasks and never duplicates an id under overlapping creates', async () => {
    const [a, b] = await Promise.all([
      localTodoStore.create({
        title: 'A',
        note: null,
        category: 'personal',
        dueDate: null,
        dueTime: null,
        importance: 'medium',
        recurrence: 'none',
        subtasks: [],
      }),
      localTodoStore.create({
        title: 'B',
        note: null,
        category: 'personal',
        dueDate: null,
        dueTime: null,
        importance: 'medium',
        recurrence: 'none',
        subtasks: [],
      }),
    ])

    expect(a.id).not.toBe(b.id)
    const list = await localTodoStore.list()
    expect(list).toHaveLength(2)
    expect(new Set(list.map((todo) => todo.id)).size).toBe(2)
    expect(list.map((todo) => todo.title).sort()).toEqual(['A', 'B'])
  })
})
