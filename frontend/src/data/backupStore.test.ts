import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = new Map<string, string>()

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

const { backupStore } = await import('./backupStore')

beforeEach(() => {
  storage.clear()
})

describe('backupStore.restore', () => {
  it('replaces the dataset, dropping keys added after the backup', async () => {
    storage.set('bloom.habits.v1', '["A"]')
    storage.set('bloom.settings.v1', '{"weekStart":1}')

    const backupA = await backupStore.create('manual')
    expect(backupA.data['bloom.habits.v1']).toBe('["A"]')

    // A key added later, and a changed value, must not survive the restore.
    storage.set('bloom.todos.v1', '["NEW"]')
    storage.set('bloom.habits.v1', '["CHANGED"]')

    await backupStore.restore(backupA)

    expect(storage.has('bloom.todos.v1')).toBe(false)
    expect(storage.get('bloom.habits.v1')).toBe('["A"]')
    expect(storage.get('bloom.settings.v1')).toBe('{"weekStart":1}')
  })
})
