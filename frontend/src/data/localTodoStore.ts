import { Preferences } from '@capacitor/preferences'
import type { Todo, TodoInput } from '../types'
import { nextOccurrence, normalizeSubtasks, normalizeTodo, sortTodos } from '../lib/todo'

/**
 * On-device to-do store for the Android build. Mirrors the REST surface and
 * the backend's ordering so the same UI works in both modes.
 */

const TODOS_KEY = 'bloom.todos.v1'
const SEQ_KEY = 'bloom.todoSeq.v1'
const DEFAULT_CATEGORY = 'personal'

function normalize(todo: Todo): Todo {
  return normalizeTodo({
    ...todo,
    note: todo.note ?? null,
    category: todo.category || DEFAULT_CATEGORY,
    dueDate: todo.dueDate ?? null,
    dueTime: todo.dueDate ? (todo.dueTime ?? null) : null,
    completedAt: todo.completedAt ?? null,
  })
}

async function readAll(): Promise<Todo[]> {
  const { value } = await Preferences.get({ key: TODOS_KEY })
  if (!value) return []
  try {
    return (JSON.parse(value) as Todo[]).map(normalize)
  } catch {
    return []
  }
}

async function writeAll(todos: Todo[]): Promise<void> {
  await Preferences.set({ key: TODOS_KEY, value: JSON.stringify(todos) })
}

async function nextId(): Promise<number> {
  const { value } = await Preferences.get({ key: SEQ_KEY })
  const next = (value ? Number(value) : 0) + 1
  await Preferences.set({ key: SEQ_KEY, value: String(next) })
  return next
}

/**
 * Serialise store operations. Every read-modify-write (including id allocation)
 * runs after the previous one finishes, so two overlapping mutations can't read
 * the same array and clobber each other, and `nextId` can't hand out the same id
 * twice. Reads are queued too, so `list` never observes a half-applied write.
 */
let queue: Promise<unknown> = Promise.resolve()

function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  // Keep the chain alive even when an operation rejects.
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export const localTodoStore = {
  async list(): Promise<Todo[]> {
    return mutate(async () => sortTodos(await readAll()))
  },

  /** Replace the whole task list, keeping ids and details (used by import). */
  async replaceAll(todos: Todo[]): Promise<void> {
    return mutate(async () => {
      const normalized = todos.map((todo) => normalizeTodo(todo))
      await writeAll(normalized)
      // Only finite numeric ids can seed the sequence; a malformed id must never
      // turn the counter into NaN.
      const maxId = normalized.reduce(
        (max, todo) => (Number.isFinite(todo.id) ? Math.max(max, todo.id) : max),
        0,
      )
      await Preferences.set({ key: SEQ_KEY, value: String(maxId) })
    })
  },

  async create(input: TodoInput): Promise<Todo> {
    return mutate(async () => {
      const todos = await readAll()
      const todo: Todo = {
        id: await nextId(),
        title: input.title.trim(),
        note: input.note?.trim() || null,
        category: input.category || DEFAULT_CATEGORY,
        done: false,
        dueDate: input.dueDate || null,
        dueTime: input.dueDate ? input.dueTime || null : null,
        importance: input.importance || 'medium',
        recurrence: input.recurrence || 'none',
        subtasks: normalizeSubtasks(input.subtasks),
        archived: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
      }
      await writeAll([todo, ...todos])
      return todo
    })
  },

  async update(id: number, input: TodoInput): Promise<Todo> {
    return mutate(async () => {
      const todos = await readAll()
      const index = todos.findIndex((todo) => todo.id === id)
      if (index === -1) throw new Error('Task not found')
      const updated: Todo = {
        ...todos[index],
        title: input.title.trim(),
        note: input.note?.trim() || null,
        category: input.category || DEFAULT_CATEGORY,
        dueDate: input.dueDate || null,
        dueTime: input.dueDate ? input.dueTime || null : null,
        importance: input.importance || todos[index].importance || 'medium',
        recurrence: input.recurrence || 'none',
        subtasks: normalizeSubtasks(input.subtasks),
      }
      todos[index] = updated
      await writeAll(todos)
      return updated
    })
  },

  async remove(id: number): Promise<void> {
    return mutate(async () => {
      const todos = await readAll()
      await writeAll(todos.filter((todo) => todo.id !== id))
    })
  },

  async archive(id: number, archived: boolean): Promise<Todo> {
    return mutate(async () => {
      const todos = await readAll()
      const index = todos.findIndex((todo) => todo.id === id)
      if (index === -1) throw new Error('Task not found')
      todos[index] = { ...todos[index], archived }
      await writeAll(todos)
      return todos[index]
    })
  },

  async toggle(id: number): Promise<Todo> {
    return mutate(async () => {
      const todos = await readAll()
      const index = todos.findIndex((todo) => todo.id === id)
      if (index === -1) throw new Error('Task not found')
      const current = todos[index]

      // A repeating task rolls forward instead of staying done, so it never
      // disappears into "Done today" and reappears as a fresh overdue task.
      if (!current.done && current.recurrence !== 'none') {
        const updated: Todo = {
          ...current,
          done: false,
          completedAt: null,
          dueDate: nextOccurrence(current.dueDate, current.recurrence),
        }
        todos[index] = updated
        await writeAll(todos)
        return updated
      }

      const nextDone = !current.done
      const updated: Todo = {
        ...current,
        done: nextDone,
        completedAt: nextDone ? new Date().toISOString() : null,
      }
      todos[index] = updated
      await writeAll(todos)
      return updated
    })
  },
}
