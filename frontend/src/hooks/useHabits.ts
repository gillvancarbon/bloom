import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { localStore } from '../data/localStore'
import type { Habit, HabitInput } from '../types'
import { useSettings } from '../context/SettingsContext'
import { syncHabitReminders } from '../lib/notifications'
import { syncWidget } from '../lib/widget'
import { onDataChanged } from '../lib/dataEvents'
import { nextFreezeDate } from '../lib/freezes'

/**
 * The web build talks to Spring Boot; the Android build stores everything
 * on-device (VITE_DATA_MODE=local, set in `.env.android`).
 */
const store = import.meta.env.VITE_DATA_MODE === 'local' ? localStore : api

/**
 * Module-level cache so switching tabs (which remounts the view) paints the
 * last known list immediately instead of flashing a loading skeleton. Every
 * mutation writes through here first, so a remount never sees stale data.
 */
let habitsCache: { habits: Habit[]; historyStart: string | null } | null = null

export function useHabits() {
  const { settings, update: updateSettings } = useSettings()
  const [habits, setHabits] = useState<Habit[]>(() => habitsCache?.habits ?? [])
  const [historyStart, setHistoryStart] = useState<string | null>(
    () => habitsCache?.historyStart ?? null,
  )
  const [loading, setLoading] = useState(habitsCache === null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const habitsRef = useRef(habits)
  const startRef = useRef(historyStart)

  /** Update local state, the ref, and the module cache together. */
  const commit = useCallback((next: Habit[], start: string | null = startRef.current) => {
    habitsRef.current = next
    startRef.current = start
    habitsCache = { habits: next, historyStart: start }
    setHabits(next)
    setHistoryStart(start)
  }, [])

  // Keep device reminders and the home-screen widget in step with the habits.
  useEffect(() => {
    syncHabitReminders(habits, settings).catch(() => undefined)
    syncWidget(habits, new Date(), settings.weekStart).catch(() => undefined)
  }, [habits, settings])

  // Reminders are armed only a week ahead. Re-arm whenever the app comes back
  // to the foreground (e.g. after days in the background), so the window never
  // runs dry. Alarms themselves are OS-scheduled — no polling, no battery drain.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      syncHabitReminders(habitsRef.current, settings).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [settings])

  const load = useCallback(async () => {
    try {
      setError(null)
      const [data, start] = await Promise.all([
        store.list(),
        store.historyStart().catch(() => null),
      ])
      commit(data, start)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load habits')
    } finally {
      setLoading(false)
    }
  }, [commit])

  useEffect(() => {
    load()
  }, [load])

  // Reload when data changes outside React (notification action, widget).
  useEffect(
    () =>
      onDataChanged(() => {
        void load()
      }),
    [load],
  )

  const create = useCallback(
    async (input: HabitInput) => {
      // Habits created programmatically (e.g. from templates) inherit the
      // default reminder; the form always sends an explicit offset, where null
      // means "no reminder".
      const withReminder =
        input.reminderOffset === undefined
          ? { ...input, reminderOffset: settings.defaultReminderOffset }
          : input
      const created = await store.create(withReminder)
      commit([created, ...habitsRef.current])
      return created
    },
    [commit, settings.defaultReminderOffset],
  )

  const update = useCallback(
    async (id: number, input: HabitInput) => {
      const updated = await store.update(id, input)
      commit(habitsRef.current.map((h) => (h.id === id ? updated : h)))
      return updated
    },
    [commit],
  )

  const remove = useCallback(
    async (id: number) => {
      // Drop it from the UI/cache immediately, then persist. If the write
      // fails we reload so the list can't silently drift from the device.
      commit(habitsRef.current.filter((h) => h.id !== id))
      try {
        await store.remove(id)
      } catch (e) {
        await load()
        throw e
      }
    },
    [commit, load],
  )

  const archive = useCallback(
    async (id: number, archived: boolean) => {
      const updated = await store.archive(id, archived)
      commit(habitsRef.current.map((h) => (h.id === id ? updated : h)))
      return updated
    },
    [commit],
  )

  const reorder = useCallback(
    async (ids: number[]) => {
      const next = await store.reorder(ids)
      commit(next)
    },
    [commit],
  )

  const toggle = useCallback(
    async (id: number) => {
      setBusyId(id)
      try {
        const updated = await store.toggle(id)
        commit(habitsRef.current.map((h) => (h.id === id ? updated : h)))
        return updated
      } finally {
        setBusyId(null)
      }
    },
    [commit],
  )

  /** Spend a streak freeze to protect a habit's most recent missed day. */
  const freeze = useCallback(
    async (id: number) => {
      if (!('freeze' in store) || settings.freezeTokens <= 0) return
      const habit = habitsRef.current.find((h) => h.id === id)
      if (!habit) return
      const date = nextFreezeDate(habit, new Date())
      if (!date) return
      const updated = await store.freeze(id, date)
      commit(habitsRef.current.map((h) => (h.id === id ? updated : h)))
      updateSettings({ freezeTokens: Math.max(0, settings.freezeTokens - 1) })
    },
    [commit, settings.freezeTokens, updateSettings],
  )

  return {
    habits,
    historyStart,
    loading,
    error,
    busyId,
    create,
    update,
    remove,
    archive,
    reorder,
    toggle,
    freeze,
    /** Freezes need the field-based local store, not the REST backend. */
    canFreeze: 'freeze' in store,
    reload: load,
  }
}
