import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, ChevronDown, Plus, Sparkles } from 'lucide-react'
import { BrandHeader } from './BrandHeader'
import { ThemeToggle } from './ThemeToggle'
import { TodoCard } from './TodoCard'
import { TodoForm } from './TodoForm'
import { DeleteConfirm } from './DeleteConfirm'
import { Stat } from './Stat'
import { UndoToast } from './UndoToast'
import { useTodos } from '../hooks/useTodos'
import { useNow } from '../hooks/useNow'
import { useUndoQueue } from '../hooks/useUndoQueue'
import { useSettings } from '../context/SettingsContext'
import { isDoneToday, todoStats } from '../lib/todo'
import { playCompletionSound } from '../lib/sound'
import { clearPendingDelete, schedulePendingDelete } from '../data/pendingDeletes'
import type { Todo, TodoInput } from '../types'

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; todo: Todo }
  | { type: 'delete'; todo: Todo }

interface TodosViewProps {
  onOpenSettings: () => void
}

export function TodosView({ onOpenSettings }: TodosViewProps) {
  const { todos, loading, error, busyId, create, update, remove, archive, toggle } = useTodos()
  const { settings } = useSettings()
  const now = useNow()
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const undo = useUndoQueue()
  const { commitNow } = undo

  // Commit any pending delete when leaving the screen, so a tab switch can't
  // resurrect an optimistically-hidden task.
  useEffect(() => () => commitNow(), [commitNow])

  // Collapse the open card when tapping anywhere outside its action area.
  useEffect(() => {
    if (selectedId === null) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest(`[data-actions-for="${selectedId}"]`)) {
        setSelectedId(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [selectedId])

  const visible = todos.filter((todo) => !hidden.has(todo.id))
  const activeTodos = visible.filter((todo) => !todo.archived)
  const archivedTodos = visible.filter((todo) => todo.archived)
  const stats = todoStats(activeTodos, now)
  const openTodos = activeTodos.filter((todo) => !todo.done)
  const doneTodayTodos = activeTodos.filter((todo) => isDoneToday(todo, now))

  async function handleCreate(input: TodoInput) {
    await create(input)
  }

  async function handleUpdate(input: TodoInput) {
    if (dialog.type !== 'edit') return
    await update(dialog.todo.id, input)
  }

  async function handleToggle(todo: Todo) {
    const completing = !todo.done
    await toggle(todo.id)
    // A satisfying ding only when marking done, never when un-checking.
    if (completing) void playCompletionSound(settings)
  }

  async function handleArchive(todo: Todo) {
    const next = !todo.archived
    setSelectedId(null)
    await archive(todo.id, next)
    undo.push({
      message: next ? `“${todo.title}” archived` : `“${todo.title}” restored`,
      undoLabel: 'Undo',
      onUndo: () => archive(todo.id, !next).catch(() => undefined),
      onCommit: () => undefined,
    })
  }

  function confirmDelete(todo: Todo) {
    setDialog({ type: 'none' })
    setHidden((prev) => new Set(prev).add(todo.id))
    schedulePendingDelete('todo', todo.id)
    undo.push({
      message: `“${todo.title}” deleted`,
      onUndo: () => {
        clearPendingDelete('todo', todo.id)
        setHidden((prev) => {
          const next = new Set(prev)
          next.delete(todo.id)
          return next
        })
      },
      onCommit: () => {
        remove(todo.id)
          .catch(() => undefined)
          .finally(() => clearPendingDelete('todo', todo.id))
      },
    })
  }

  return (
    <div className="safe-shell relative z-10 mx-auto max-w-2xl px-4 sm:px-6">
      <BrandHeader subtitle="A calm place for what’s next." onOpenSettings={onOpenSettings}>
        <ThemeToggle />
      </BrandHeader>

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="mb-6 grid grid-cols-3 gap-2 sm:gap-3"
      >
        <Stat
          label="Done today"
          value={`${stats.doneToday} | ${openTodos.length + doneTodayTodos.length}`}
          title="Tasks completed today / tasks on your board"
        />
        <Stat label="Due today" value={stats.dueToday} title="Open tasks due today" />
        <Stat
          label="Overdue"
          value={stats.overdue}
          accent={stats.overdue > 0}
          title="Open tasks with a due date or time in the past"
        />
      </motion.section>

      {/* Add task */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink sm:text-lg">Your tasks</h2>
        <button
          type="button"
          onClick={() => setDialog({ type: 'create' })}
          className="silicone-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add task
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-calm bg-mint-100 dark:bg-mint-900/40"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-calm border border-peach-200 bg-peach-50 p-5 text-peach-700 dark:border-peach-900 dark:bg-peach-900/30 dark:text-peach-200">
          <p className="font-medium">We couldn’t load your tasks.</p>
          <p className="mt-1 text-sm opacity-80">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="silicone mt-3 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      ) : todos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center rounded-calm border border-dashed border-line bg-raised/60 px-6 py-14 text-center"
        >
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-100 text-sage-500 dark:bg-mint-900/50 dark:text-sage-300">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <h3 className="font-display text-lg font-semibold text-ink">Nothing on your plate</h3>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Add a task above and keep it light. Small steps still count.
          </p>
        </motion.div>
      ) : (
        <>
          {openTodos.length > 0 ? (
            <motion.ul layout className="space-y-3">
              <AnimatePresence initial={false}>
                {openTodos.map((todo) => (
                  <li key={todo.id}>
                    <TodoCard
                      todo={todo}
                      now={now}
                      busy={busyId === todo.id}
                      actionsOpen={selectedId === todo.id}
                      onToggleActions={() =>
                        setSelectedId((prev) => (prev === todo.id ? null : todo.id))
                      }
                      onToggle={handleToggle}
                      onEdit={(t) => {
                        setSelectedId(null)
                        setDialog({ type: 'edit', todo: t })
                      }}
                      onArchive={handleArchive}
                      onDelete={(t) => {
                        setSelectedId(null)
                        setDialog({ type: 'delete', todo: t })
                      }}
                    />
                  </li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : (
            <div className="rounded-calm border border-dashed border-line bg-raised/60 px-4 py-8 text-center">
              <p className="font-display text-sm font-semibold text-ink">All clear for now</p>
              <p className="mt-1 text-xs text-muted">Enjoy the breathing room.</p>
            </div>
          )}

          {doneTodayTodos.length > 0 && (
            <section className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">Done today</h3>
                <span className="text-xs text-muted">{doneTodayTodos.length}</span>
              </div>
              <motion.ul layout className="space-y-3">
                <AnimatePresence initial={false}>
                  {doneTodayTodos.map((todo) => (
                    <li key={todo.id}>
                      <TodoCard
                        todo={todo}
                        now={now}
                        busy={busyId === todo.id}
                        actionsOpen={selectedId === todo.id}
                        onToggleActions={() =>
                          setSelectedId((prev) => (prev === todo.id ? null : todo.id))
                        }
                        onToggle={handleToggle}
                        onEdit={(t) => {
                          setSelectedId(null)
                          setDialog({ type: 'edit', todo: t })
                        }}
                        onArchive={handleArchive}
                        onDelete={(t) => {
                          setSelectedId(null)
                          setDialog({ type: 'delete', todo: t })
                        }}
                      />
                    </li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          )}

          {archivedTodos.length > 0 && (
            <section className="mt-6">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                className="silicone-quiet flex w-full items-center justify-between rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
              >
                <span className="inline-flex items-center gap-2">
                  <Archive className="h-4 w-4" aria-hidden />
                  Archived ({archivedTodos.length})
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-calm ease-calm ${
                    showArchived ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {showArchived && (
                <motion.ul layout className="mt-3 space-y-3">
                  {archivedTodos.map((todo) => (
                    <li key={todo.id}>
                      <TodoCard
                        todo={todo}
                        now={now}
                        busy={busyId === todo.id}
                        actionsOpen={selectedId === todo.id}
                        onToggleActions={() =>
                          setSelectedId((prev) => (prev === todo.id ? null : todo.id))
                        }
                        onToggle={handleToggle}
                        onEdit={(t) => {
                          setSelectedId(null)
                          setDialog({ type: 'edit', todo: t })
                        }}
                        onArchive={handleArchive}
                        onDelete={(t) => {
                          setSelectedId(null)
                          setDialog({ type: 'delete', todo: t })
                        }}
                      />
                    </li>
                  ))}
                </motion.ul>
              )}
            </section>
          )}
        </>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        Tap the circle to finish a task — it moves to Done today.
      </footer>

      <UndoToast item={undo.item} onUndo={undo.undo} onDismiss={undo.commitNow} />

      {/* Dialogs */}
      <AnimatePresence>
        {(dialog.type === 'create' || dialog.type === 'edit') && (
          <TodoForm
            key={dialog.type === 'edit' ? `edit-${dialog.todo.id}` : 'create'}
            mode={dialog.type}
            todo={dialog.type === 'edit' ? dialog.todo : null}
            onClose={() => setDialog({ type: 'none' })}
            onSubmit={dialog.type === 'edit' ? handleUpdate : handleCreate}
          />
        )}
        {dialog.type === 'delete' && (
          <DeleteConfirm
            key={`delete-${dialog.todo.id}`}
            name={dialog.todo.title}
            title="Delete this task?"
            description={<>and its details will be removed. You can undo this for a few seconds.</>}
            onCancel={() => setDialog({ type: 'none' })}
            onConfirm={async () => confirmDelete(dialog.todo)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
