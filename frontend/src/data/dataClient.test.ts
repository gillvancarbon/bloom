import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    data: {
      clear: vi.fn().mockResolvedValue(undefined),
      import: vi.fn().mockResolvedValue(undefined),
    },
    list: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    todos: { list: vi.fn(), remove: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../api', () => ({ api: apiMock }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    keys: vi.fn(async () => ({ keys: [...storage.keys()] })),
    get: vi.fn(async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      storage.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      storage.delete(key)
    }),
  },
}))
vi.mock('./nudgeStore', () => ({ nudgeStore: { clear: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('./todoOrderStore', () => ({
  todoOrderStore: { clear: vi.fn().mockResolvedValue(undefined) },
}))

beforeEach(() => {
  storage.clear()
  apiMock.data.clear.mockClear()
  apiMock.data.import.mockClear()
  apiMock.remove.mockClear()
  apiMock.todos.remove.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('dataClient in REST mode', () => {
  it('clears through the transactional endpoint, never per-record deletes', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'server')
    const { dataClient } = await import('./dataClient')
    expect(dataClient.isLocal).toBe(false)

    await dataClient.clearAll()

    expect(apiMock.data.clear).toHaveBeenCalledTimes(1)
    expect(apiMock.remove).not.toHaveBeenCalled()
    expect(apiMock.todos.remove).not.toHaveBeenCalled()
  })

  it('imports the whole bundle through the transactional endpoint', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'server')
    const { dataClient } = await import('./dataClient')

    const bundle = {
      habits: [{ id: 1, name: 'Gym' }],
      todos: [{ id: 2, title: 'Tax' }],
    }
    await dataClient.importAll(bundle as never)

    expect(apiMock.data.import).toHaveBeenCalledTimes(1)
    expect(apiMock.data.import).toHaveBeenCalledWith(bundle)
    expect(apiMock.remove).not.toHaveBeenCalled()
    expect(apiMock.todos.remove).not.toHaveBeenCalled()
  })
})

describe('dataClient in local mode', () => {
  it('removes every device data key, including history start and pending deletes', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'local')
    storage.set('bloom.habits.v1', '[]')
    storage.set('bloom.historyStart.v1', '2026-01-01')
    storage.set('bloom.pendingDeletes.v1', '[]')
    storage.set('bloom.settings.v1', 'keep me')

    const { dataClient } = await import('./dataClient')
    expect(dataClient.isLocal).toBe(true)

    await dataClient.clearAll()

    expect(storage.has('bloom.habits.v1')).toBe(false)
    expect(storage.has('bloom.historyStart.v1')).toBe(false)
    expect(storage.has('bloom.pendingDeletes.v1')).toBe(false)
    // Settings are deliberately kept.
    expect(storage.get('bloom.settings.v1')).toBe('keep me')
  })
})
