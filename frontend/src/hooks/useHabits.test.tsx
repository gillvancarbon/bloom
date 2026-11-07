import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Habit } from '../types'
import { normalizeHabit } from '../lib/habit'

const apiMock = vi.hoisted(() => ({
  list: vi.fn(),
  historyStart: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  archive: vi.fn(),
  reorder: vi.fn(),
  toggle: vi.fn(),
  freeze: vi.fn(),
}))

vi.mock('../api', () => ({ api: apiMock }))
vi.mock('../lib/notifications', () => ({
  syncHabitReminders: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/widget', () => ({ syncWidget: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      defaultReminderOffset: null,
      freezeTokens: 3,
      weekStart: 1,
      notificationsEnabled: false,
      timeFormat: '24',
    },
    update: vi.fn(),
  }),
}))

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Habit',
    createdAt: '2026-06-01T10:00:00.000Z',
    ...partial,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useHabits load/mutation race', () => {
  it('does not let a slow load overwrite a newer mutation', async () => {
    const created = habit({ id: 2, name: 'New' })
    const onServer = habit({ id: 1, name: 'Server' })

    let resolveList!: (habits: Habit[]) => void
    apiMock.list.mockReturnValue(
      new Promise<Habit[]>((resolve) => {
        resolveList = resolve
      }),
    )
    apiMock.historyStart.mockResolvedValue(null)
    apiMock.create.mockResolvedValue(created)

    vi.resetModules()
    const { useHabits } = await import('./useHabits')
    const { result } = renderHook(() => useHabits())

    // The initial load is still in flight; commit a mutation first.
    await act(async () => {
      await result.current.create({ name: 'New', colorIndex: 0, deadline: '23:59' })
    })
    expect(result.current.habits.map((h) => h.id)).toContain(2)

    // The stale read resolves now — it must be ignored, not overwrite the hook.
    await act(async () => {
      resolveList([onServer])
      await Promise.resolve()
    })

    expect(result.current.habits.map((h) => h.id)).toEqual([2])
  })
})
