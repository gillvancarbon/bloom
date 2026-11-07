import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Habit } from '../types'
import { normalizeHabit } from '../lib/habit'

const storage = new Map<string, string>()

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: storage.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      storage.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      storage.delete(key)
    }),
  },
}))

const { localStore } = await import('./localStore')

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

// A fixed Wednesday 10 June 2026.
const NOW = new Date('2026-06-10T09:00:00')

beforeEach(() => {
  storage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('localStore.toggle undo', () => {
  it('falls back to the newest remaining completion, never a fabricated yesterday', async () => {
    await localStore.replaceAll([
      habit({
        id: 1,
        history: ['2026-06-08', '2026-06-10'],
        streakCount: 3,
        lastCompletedDate: '2026-06-10',
      }),
    ])

    await localStore.toggle(1)
    const [stored] = await localStore.list()

    expect(stored.lastCompletedDate).toBe('2026-06-08')
    expect(stored.streakCount).toBe(2)
    expect(stored.history).toEqual(['2026-06-08'])
    expect(stored.history).not.toContain('2026-06-09')

    // Re-reading through normalizeHabit must not re-introduce the gap day.
    const reread = normalizeHabit(stored)
    expect(reread.history).not.toContain('2026-06-09')
    expect(reread.lastCompletedDate).toBe('2026-06-08')
  })

  it('nulls the last completed date when nothing remains', async () => {
    await localStore.replaceAll([
      habit({
        id: 2,
        history: ['2026-06-10'],
        streakCount: 1,
        lastCompletedDate: '2026-06-10',
      }),
    ])

    await localStore.toggle(2)
    const [stored] = await localStore.list()

    expect(stored.lastCompletedDate).toBeNull()
    expect(stored.streakCount).toBe(0)
    expect(stored.history).toEqual([])
  })
})

describe('localStore.increment schedule awareness', () => {
  it('keeps a weekday habit alive across the weekend', async () => {
    vi.setSystemTime(new Date('2026-06-08T09:00:00')) // Monday
    await localStore.replaceAll([
      habit({
        id: 3,
        schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
        history: ['2026-06-05'], // Friday
        streakCount: 4,
        lastCompletedDate: '2026-06-05',
      }),
    ])

    const updated = await localStore.toggle(3)
    expect(updated.streakCount).toBe(5)
    expect(updated.lastCompletedDate).toBe('2026-06-08')
  })

  it('extends a daily habit by one after a single missed day', async () => {
    await localStore.replaceAll([
      habit({
        id: 4,
        history: ['2026-06-08'], // Monday; Tuesday missed
        streakCount: 2,
        lastCompletedDate: '2026-06-08',
      }),
    ])

    const updated = await localStore.toggle(4)
    expect(updated.streakCount).toBe(3)
  })

  it('resets a daily habit after two missed days', async () => {
    await localStore.replaceAll([
      habit({
        id: 5,
        history: ['2026-06-07'],
        streakCount: 9,
        lastCompletedDate: '2026-06-07',
      }),
    ])

    const updated = await localStore.toggle(5)
    expect(updated.streakCount).toBe(1)
  })
})
