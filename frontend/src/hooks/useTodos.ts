import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { localTodoStore } from '../data/localTodoStore'
import { todoOrderStore } from '../data/todoOrderStore'
import { normalizeTodo, sortTodos } from '../lib/todo'
import { useSettings } from '../context/SettingsContext'
import { syncTaskReminders } from '../lib/notifications'
import { syncWidget } from '../lib/widget'
import { onDataChanged } from '../lib/dataEvents'
import type { Todo, TodoInput } from '../types'

const store = import.meta.env.VITE_DATA_MODE === 'local' ? localTodoStore : api.todos

/** Module-level cache so tab switches paint instantly instead of refetching. */
let todosCache: Todo[] | null = null

export function useTodos() {
  const { settings } = useSettings()
  const [todos, setTodos] = useState<Todo[]>(() => todosCache ?? [])
  const [loading, setLoading] = useState(todosCache === null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const todosRef = useRef(todos)
  /**
   * Bumped whenever a mutation commits. `load()` captures this before its
   * async read and skips the commit if it changed in the meantime, so a slow
   * read can never overwrite a newer local mutation.
   */
  const mutationVersion = useRef(0)
  // The manual order is kept in a ref so the sort helper never goes stale.
  const orderRef = useRef<number[]>([])
  const sortModeRef = useRef(settings.todoSort)
  sortModeRef.current = settings.todoSort

  /** Sort with the current mode and manual order. */
  const sortBy = useCallback((list: Todo[]) => {
    return sortTodos(list, sortModeRef.current, orderRef.current)
  }, [])

  /** Update local state, the ref, and the module cache together. */
  const commit = useCallback(
    (next: Todo[]) => {
      const ordered = sortBy(next)
      todosRef.current = ordered
      todosCache = ordered
      setTodos(ordered)
    },
    [sortBy],
  )

  const persistOrder = useCallback((ids: number[]) => {
    orderRef.current = ids
    setOrder(ids)
    void todoOrderStore.write(ids)
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      const version = mutationVersion.current
      const [storedOrder, list] = await Promise.all([todoOrderStore.read(), store.list()])
      // A mutation landed while we were reading — its state is newer than this.
      if (mutationVersion.current !== version) return
      orderRef.current = storedOrder
      setOrder(storedOrder)
      commit(list.map(normalizeTodo))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks')
    } finally {
      setLoading(false)
    }
  }, [commit])

  useEffect(() => {
    load()
  }, [load])

  // Nudge open tasks at their due moment, kept in step with edits and settings.
  useEffect(() => {
    syncTaskReminders(todos, settings).catch(() => undefined)
  }, [todos, settings])

  // Keep the home-screen widget's task section in step too.
  useEffect(() => {
    syncWidget({ todos }, new Date(), settings.weekStart).catch(() => undefined)
  }, [todos, settings.weekStart])

  // Re-arm when the app returns to the foreground (windows are one-shot).
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      syncTaskReminders(todosRef.current, settings).catch(() => undefined)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [settings])

  // Reload when data changes outside React (notification action, widget).
  useEffect(
    () =>
      onDataChanged(() => {
        void load()
      }),
    [load],
  )

  const create = useCallback(
    async (input: TodoInput) => {
      const created = await store.create(input)
      // New tasks join the end of the manual order.
      mutationVersion.current += 1
      persistOrder([...orderRef.current, created.id])
      commit([normalizeTodo(created), ...todosRef.current])
      return created
    },
    [commit, persistOrder],
  )

  const update = useCallback(
    async (id: number, input: TodoInput) => {
      const updated = await store.update(id, input)
      mutationVersion.current += 1
      commit(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t)))
      return updated
    },
    [commit],
  )

  const remove = useCallback(
    async (id: number) => {
      mutationVersion.current += 1
      persistOrder(orderRef.current.filter((existing) => existing !== id))
      commit(todosRef.current.filter((t) => t.id !== id))
      try {
        await store.remove(id)
      } catch (e) {
        await load()
        throw e
      }
    },
    [commit, load, persistOrder],
  )

  const archive = useCallback(
    async (id: number, archived: boolean) => {
      const updated = await store.archive(id, archived)
      mutationVersion.current += 1
      commit(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t)))
      return updated
    },
    [commit],
  )

  const toggle = useCallback(
    async (id: number) => {
      setBusyId(id)
      try {
        const updated = await store.toggle(id)
        mutationVersion.current += 1
        commit(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t)))
        return updated
      } finally {
        setBusyId(null)
      }
    },
    [commit],
  )

  /**
   * Move a task one slot up/down in the manual order. The full visible order is
   * captured first, so the swap always matches what the user sees.
   */
  const move = useCallback(
    (id: number, delta: number) => {
      const ids = todosRef.current.map((t) => t.id)
      const from = ids.indexOf(id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= ids.length) return
      ;[ids[from], ids[to]] = [ids[to], ids[from]]
      mutationVersion.current += 1
      persistOrder(ids)
      commit(todosRef.current)
    },
    [commit, persistOrder],
  )

  return {
    todos,
    order,
    loading,
    error,
    busyId,
    create,
    update,
    remove,
    archive,
    toggle,
    move,
    reload: load,
  }
}
