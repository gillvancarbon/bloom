import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { localTodoStore } from '../data/localTodoStore'
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
  const todosRef = useRef(todos)

  /** Update local state, the ref, and the module cache together. */
  const commit = useCallback((next: Todo[]) => {
    todosRef.current = next
    todosCache = next
    setTodos(next)
  }, [])

  const load = useCallback(async () => {
    try {
      setError(null)
      commit(sortTodos((await store.list()).map(normalizeTodo)))
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
      commit(sortTodos([normalizeTodo(created), ...todosRef.current]))
      return created
    },
    [commit],
  )

  const update = useCallback(
    async (id: number, input: TodoInput) => {
      const updated = await store.update(id, input)
      commit(sortTodos(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t))))
      return updated
    },
    [commit],
  )

  const remove = useCallback(
    async (id: number) => {
      commit(todosRef.current.filter((t) => t.id !== id))
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
      commit(sortTodos(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t))))
      return updated
    },
    [commit],
  )

  const toggle = useCallback(
    async (id: number) => {
      setBusyId(id)
      try {
        const updated = await store.toggle(id)
        commit(sortTodos(todosRef.current.map((t) => (t.id === id ? normalizeTodo(updated) : t))))
        return updated
      } finally {
        setBusyId(null)
      }
    },
    [commit],
  )

  return { todos, loading, error, busyId, create, update, remove, archive, toggle, reload: load }
}
