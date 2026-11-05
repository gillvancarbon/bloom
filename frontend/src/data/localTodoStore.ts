import { Preferences } from '@capacitor/preferences'
import type { Todo, TodoInput } from '../types'
import { normalizeTodo, sortTodos } from '../lib/todo'

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

export const localTodoStore = {
  async list(): Promise<Todo[]> {
    return sortTodos(await readAll())
  },

  async create(input: TodoInput): Promise<Todo> {
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
      archived: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    await writeAll([todo, ...todos])
    return todo
  },

  async update(id: number, input: TodoInput): Promise<Todo> {
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
    }
    todos[index] = updated
    await writeAll(todos)
    return updated
  },

  async remove(id: number): Promise<void> {
    const todos = await readAll()
    await writeAll(todos.filter((todo) => todo.id !== id))
  },

  async archive(id: number, archived: boolean): Promise<Todo> {
    const todos = await readAll()
    const index = todos.findIndex((todo) => todo.id === id)
    if (index === -1) throw new Error('Task not found')
    todos[index] = { ...todos[index], archived }
    await writeAll(todos)
    return todos[index]
  },

  async toggle(id: number): Promise<Todo> {
    const todos = await readAll()
    const index = todos.findIndex((todo) => todo.id === id)
    if (index === -1) throw new Error('Task not found')
    const current = todos[index]
    const nextDone = !current.done
    const updated: Todo = {
      ...current,
      done: nextDone,
      completedAt: nextDone ? new Date().toISOString() : null,
    }
    todos[index] = updated
    await writeAll(todos)
    return updated
  },
}
