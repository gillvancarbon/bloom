import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Habit } from '../types'
import { normalizeHabit } from '../lib/habit'
import { toISODate } from '../lib/streak'
import { DEFAULT_SETTINGS } from '../data/settingsStore'

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

/**
 * A tiny stand-in for SettingsContext backed by real React state, so tests can
 * observe a functional `update` resolving against the latest value (as the real
 * provider does) and read the resulting token count.
 */
const settingsMock = vi.hoisted(() => {
  const initial = {
    defaultReminderOffset: null as number | null,
    freezeTokens: 3,
    weekStart: 1 as 0 | 1,
    notificationsEnabled: false,
    timeFormat: '24' as '12' | '24',
  }
  return {
    initial,
    value: { ...initial },
    listeners: new Set<() => void>(),
  }
})

vi.mock('../api', () => ({ api: apiMock }))
vi.mock('../lib/notifications', () => ({
  syncHabitReminders: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/widget', () => ({ syncWidget: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../context/SettingsContext', async () => {
  const React = await import('react')
  return {
    useSettings: () => {
      const settings = React.useSyncExternalStore(
        (onStoreChange) => {
          settingsMock.listeners.add(onStoreChange)
          return () => settingsMock.listeners.delete(onStoreChange)
        },
        () => settingsMock.value,
      )
      const update = React.useCallback((patch: unknown) => {
        const prev = settingsMock.value
        const resolved =
          typeof patch === 'function'
            ? (patch as (p: typeof prev) => Partial<typeof prev>)(prev)
            : (patch as Partial<typeof prev>)
        settingsMock.value = { ...prev, ...resolved }
        for (const listener of settingsMock.listeners) listener()
      }, [])
      return { settings, update }
    },
  }
})

// Keep the real provider's boot off disk so the update test starts from a known
// value and nothing overwrites it mid-tick.
vi.mock('../data/settingsStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/settingsStore')>()
  return {
    ...actual,
    settingsStore: {
      read: vi.fn(() => new Promise<never>(() => {})),
      write: vi.fn().mockResolvedValue(undefined),
    },
  }
})
vi.mock('../data/migrations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../data/migrations')>()),
  runMigrations: vi.fn().mockResolvedValue(undefined),
}))

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Habit',
    createdAt: '2026-06-01T10:00:00.000Z',
    ...partial,
  })
}

/** A local ISO date `days` before today, so freeze dates stay deterministic. */
function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

beforeEach(() => {
  vi.clearAllMocks()
  settingsMock.value = { ...settingsMock.initial }
  settingsMock.listeners.clear()
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

describe('SettingsContext update', () => {
  it('resolves a functional patch against the latest value within one tick', async () => {
    // Use the real provider: the module is mocked for the hook tests above.
    const actual = await vi.importActual<typeof import('../context/SettingsContext')>(
      '../context/SettingsContext',
    )
    const { result } = renderHook(() => actual.useSettings(), {
      wrapper: ({ children }) => <actual.SettingsProvider>{children}</actual.SettingsProvider>,
    })

    await act(async () => {
      result.current.update((prev) => ({ freezeTokens: prev.freezeTokens - 1 }))
      result.current.update((prev) => ({ freezeTokens: prev.freezeTokens - 1 }))
    })

    expect(result.current.settings.freezeTokens).toBe(DEFAULT_SETTINGS.freezeTokens - 2)
  })
})

describe('useHabits streak freezes', () => {
  it('spends one token per freeze even when two land in the same tick', async () => {
    const seeded = habit({ id: 1, history: [daysAgoISO(3)] })
    apiMock.list.mockResolvedValue([seeded])
    apiMock.historyStart.mockResolvedValue(null)
    apiMock.freeze.mockResolvedValue(seeded)

    vi.resetModules()
    const { useHabits } = await import('./useHabits')
    const { result } = renderHook(() => useHabits())

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.habits.map((h) => h.id)).toEqual([1])

    // Two freezes before any re-render must still cost two tokens.
    await act(async () => {
      await Promise.all([result.current.freeze(1), result.current.freeze(1)])
    })

    expect(apiMock.freeze).toHaveBeenCalledTimes(2)
    expect(settingsMock.value.freezeTokens).toBe(1)
  })
})
