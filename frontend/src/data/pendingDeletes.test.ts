import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

/** Yield a few microtasks so an unserialised read-modify-write would interleave. */
async function gate(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    remove: vi.fn(),
    todos: { remove: vi.fn() },
  },
}))

vi.mock('../api', () => ({ api: apiMock }))
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

// Target the REST branch so removal is observed through the mocked api.
vi.stubEnv('VITE_DATA_MODE', 'server')

const { schedulePendingDelete, clearPendingDelete, flushPendingDeletes } =
  await import('./pendingDeletes')

const KEY = 'bloom.pendingDeletes.v1'

interface Queued {
  kind: string
  id: number
}

function queued(): Queued[] {
  return JSON.parse(storage.get(KEY) ?? '[]') as Queued[]
}

/** Drain the fire-and-forget schedule/clear microtasks. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  storage.clear()
  apiMock.remove.mockReset()
  apiMock.todos.remove.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('pendingDeletes', () => {
  it('keeps a delete queued when applying it fails', async () => {
    schedulePendingDelete('habit', 1)
    await settle()
    expect(queued()).toEqual([{ kind: 'habit', id: 1 }])

    apiMock.remove.mockRejectedValueOnce(new Error('offline'))
    await flushPendingDeletes()

    expect(apiMock.remove).toHaveBeenCalledWith(1)
    expect(queued()).toEqual([{ kind: 'habit', id: 1 }])
  })

  it('drops a delete from the queue once it succeeds', async () => {
    schedulePendingDelete('todo', 2)
    await settle()
    expect(queued()).toEqual([{ kind: 'todo', id: 2 }])

    apiMock.todos.remove.mockResolvedValueOnce(undefined)
    await flushPendingDeletes()

    expect(apiMock.todos.remove).toHaveBeenCalledWith(2)
    expect(queued()).toEqual([])
  })

  it('leaves the queue empty after a schedule that is immediately cleared', async () => {
    schedulePendingDelete('habit', 3)
    clearPendingDelete('habit', 3)
    await settle()

    expect(queued()).toEqual([])
  })
})
