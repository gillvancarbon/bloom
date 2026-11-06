import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Archive, Check, ChevronDown, ListChecks, Plus, Search, Sparkles, X } from 'lucide-react'
import { BrandHeader } from './BrandHeader'
import { ThemeToggle } from './ThemeToggle'
import { TodoCard } from './TodoCard'
import { TodoForm } from './TodoForm'
import { DeleteConfirm } from './DeleteConfirm'
import { Stat } from './Stat'
import { UndoToast } from './UndoToast'
import { useTodos } from '../hooks/useTodos'
import { useNow } from '../hooks/useNow'
import { useWindowedList } from '../hooks/useWindowedList'
import { useUndoQueue } from '../hooks/useUndoQueue'
import { useSettings } from '../context/SettingsContext'
import {
  TODO_BUCKETS,
  TODO_BUCKET_LABELS,
  dueState,
  isDoneToday,
  matchesTodo,
  sortTodos,
  todoBucket,
  todoStats,
  type TodoBucket,
} from '../lib/todo'
import { QuickAddBar } from './QuickAddBar'
import { playCompletionSound } from '../lib/sound'
import { clearPendingDelete, schedulePendingDelete } from '../data/pendingDeletes'
import type { Subtask, Todo, TodoInput, TodoSort } from '../types'

type Dialog =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; todo: Todo }
  | { type: 'delete'; todo: Todo }

/** The visible to-do views: the due-date buckets, plus everything at once. */
type TodoView = TodoBucket | 'all'

const TODO_VIEWS: Array<{ value: TodoView; label: string }> = [
  ...TODO_BUCKETS.map((bucket) => ({ value: bucket, label: TODO_BUCKET_LABELS[bucket] })),
  { value: 'all', label: 'All' },
]

const TODO_SORT_OPTIONS: Array<{ value: TodoSort; label: string }> = [
  { value: 'due', label: 'By due date' },
  { value: 'importance', label: 'By priority' },
  { value: 'name', label: 'A–Z' },
  { value: 'created', label: 'Newest' },
  { value: 'manual', label: 'Manual order' },
]

const EMPTY_VIEW_TEXT: Record<TodoView, { title: string; hint: string }> = {
  today: { title: 'Nothing due today', hint: 'Enjoy the breathing room.' },
  upcoming: { title: 'Nothing coming up', hint: 'Tasks with a future date land here.' },
  anytime: { title: 'No undated tasks', hint: 'Add one without a due date to keep it here.' },
  all: { title: 'All clear for now', hint: 'Enjoy the breathing room.' },
}

/** The visible to-do views: the due-date buckets, plus everything at once. */
interface TodosViewProps {
  onOpenSettings: () => void
}

export function TodosView({ onOpenSettings }: TodosViewProps) {
  const { todos, order, loading, error, busyId, create, update, remove, archive, toggle, move } =
    useTodos()
  const { settings, update: updateSettings } = useSettings()
  const now = useNow()
  const [dialog, setDialog] = useState<Dialog>({ type: 'none' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [view, setView] = useState<TodoView>('today')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [hidden, setHidden] = useState<Set<number>>(new Set())
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [liveMessage, setLiveMessage] = useState('')
  const undo = useUndoQueue()
  const { commitNow } = undo

  /**
   * Announce a change to assistive tech. Clearing first lets the same sentence
   * be announced twice in a row (e.g. adding two tasks with the same title).
   */
  function announce(message: string) {
    setLiveMessage('')
    requestAnimationFrame(() => setLiveMessage(message))
  }

  /** Leave selection mode and forget anything that was ticked. */
  function endSelection() {
    setSelecting(false)
    setSelected(new Set())
  }

  function toggleSelect(todo: Todo) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(todo.id)) next.delete(todo.id)
      else next.add(todo.id)
      return next
    })
  }

  /** Tick every task currently shown in the open list. */
  function selectAllShown(ids: number[]) {
    setSelected(new Set(ids))
  }

  /** Apply an update to each selected task, one after another. */
  async function runBulk(ids: number[], task: (id: number) => Promise<unknown>) {
    for (const id of ids) {
      await task(id)
    }
  }

  async function bulkComplete() {
    const ids = [...selected].filter((id) => !todos.find((t) => t.id === id)?.done)
    if (!ids.length) return endSelection()
    await runBulk(ids, (id) => toggle(id))
    announce(ids.length === 1 ? '1 task completed.' : `${ids.length} tasks completed.`)
    endSelection()
  }

  async function bulkArchive(archived: boolean) {
    const ids = [...selected]
    if (!ids.length) return endSelection()
    await runBulk(ids, (id) => archive(id, archived))
    announce(
      archived
        ? ids.length === 1
          ? '1 task archived.'
          : `${ids.length} tasks archived.`
        : ids.length === 1
          ? '1 task restored.'
          : `${ids.length} tasks restored.`,
    )
    endSelection()
  }

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

  const bucketCounts = TODO_BUCKETS.reduce<Record<TodoBucket, number>>(
    (counts, bucket) => {
      counts[bucket] = openTodos.filter((todo) => todoBucket(todo, now) === bucket).length
      return counts
    },
    { today: 0, upcoming: 0, anytime: 0 },
  )

  const searching = query.trim().length > 0
  const matchingTodos = searching ? openTodos.filter((todo) => matchesTodo(todo, query)) : openTodos
  const viewTodos = matchingTodos.filter(
    (todo) => searching || view === 'all' || todoBucket(todo, now) === view,
  )
  const orderedOpen = sortTodos(viewTodos, settings.todoSort, order)
  const hasOpen = openTodos.length > 0
  const manualOrder = settings.todoSort === 'manual'
  // Long lists mount a page at a time so the DOM stays small and smooth.
  const openWindow = useWindowedList(orderedOpen)

  async function handleCreate(input: TodoInput) {
    await create(input)
    announce(`Added “${input.title}”.`)
  }

  async function handleUpdate(input: TodoInput) {
    if (dialog.type !== 'edit') return
    await update(dialog.todo.id, input)
  }

  async function handleToggle(todo: Todo) {
    const completing = !todo.done
    const repeats = completing && todo.recurrence !== 'none'
    const updated = await toggle(todo.id)
    // A satisfying ding only when marking done, never when un-checking.
    if (completing) void playCompletionSound(settings)
    // Tell the reader where a repeating task went, and let them take it back.
    if (repeats) {
      const next = dueState(updated.dueDate, updated.dueTime, now)
      undo.push({
        message: `“${todo.title}” repeats — moved to ${next.text || 'its next turn'}`,
        undoLabel: 'Undo',
        onUndo: () =>
          update(todo.id, {
            title: todo.title,
            note: todo.note,
            category: todo.category,
            dueDate: todo.dueDate,
            dueTime: todo.dueTime,
            importance: todo.importance,
            recurrence: todo.recurrence,
            subtasks: todo.subtasks,
          }).then(() => undefined),
        onCommit: () => undefined,
      })
    } else {
      announce(completing ? `“${todo.title}” completed.` : `“${todo.title}” reopened.`)
    }
  }

  /** Move an overdue task to a new date without opening the editor. */
  async function handleReschedule(todo: Todo, dueDate: string) {
    setSelectedId(null)
    await update(todo.id, {
      title: todo.title,
      note: todo.note,
      category: todo.category,
      dueDate,
      dueTime: todo.dueTime,
      importance: todo.importance,
      recurrence: todo.recurrence,
      subtasks: todo.subtasks,
    })
    undo.push({
      message: `“${todo.title}” moved to today`,
      undoLabel: 'Undo',
      onUndo: () =>
        update(todo.id, {
          title: todo.title,
          note: todo.note,
          category: todo.category,
          dueDate: todo.dueDate,
          dueTime: todo.dueTime,
          importance: todo.importance,
          recurrence: todo.recurrence,
          subtasks: todo.subtasks,
        }).then(() => undefined),
      onCommit: () => undefined,
    })
  }

  async function handleToggleSubtask(todo: Todo, subtaskId: string) {
    const subtasks: Subtask[] = todo.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
    )
    await update(todo.id, {
      title: todo.title,
      note: todo.note,
      category: todo.category,
      dueDate: todo.dueDate,
      dueTime: todo.dueTime,
      importance: todo.importance,
      recurrence: todo.recurrence,
      subtasks,
    })
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
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink sm:text-lg">Your tasks</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (selecting ? endSelection() : setSelecting(true))}
            aria-pressed={selecting}
            aria-label={selecting ? 'Done selecting' : 'Select tasks'}
            title="Select tasks"
            className={`silicone flex h-9 w-9 items-center justify-center rounded-full ${
              selecting ? 'text-sage-500 dark:text-sage-300' : 'text-muted'
            }`}
          >
            <ListChecks className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open)
              if (searchOpen) setQuery('')
            }}
            aria-label={searchOpen ? 'Close search' : 'Search tasks'}
            aria-pressed={searchOpen}
            title="Search tasks"
            className={`silicone flex h-9 w-9 items-center justify-center rounded-full ${
              searchOpen ? 'text-sage-500 dark:text-sage-300' : 'text-muted'
            }`}
          >
            <Search className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className="silicone-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add task
          </button>
        </div>
      </div>

      {/* Quick add — type a sentence, we work out the rest */}
      {!loading && !error && (
        <QuickAddBar now={now} onAdd={handleCreate} guidance={settings.quickAddGuidance} />
      )}

      {/* Search field */}
      {searchOpen && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks and steps"
              aria-label="Search tasks"
              className="w-full rounded-calm-sm border border-line bg-surface py-2 pl-9 pr-9 text-sm
                         text-ink placeholder:text-muted/70 focus:border-sage-400 focus:outline-none
                         focus:ring-2 focus:ring-sage-400/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}

      {/* View switcher — one due-date bucket at a time, or everything */}
      {!loading && !error && hasOpen && !searching && (
        <>
          <div
            role="tablist"
            aria-label="Task view"
            className="mb-3 flex flex-wrap items-center gap-1.5"
          >
            {TODO_VIEWS.map((option) => {
              const selected = option.value === view
              const count =
                option.value === 'all' ? openTodos.length : bucketCounts[option.value as TodoBucket]
              const showOverdue = option.value === 'today' && stats.overdue > 0
              const stateClass = selected
                ? 'bg-sage-500 text-white shadow-calm'
                : 'bg-mint-100 text-sage-700 hover:bg-mint-200 dark:bg-mint-900/50 dark:text-mint-100 dark:hover:bg-mint-900/70'
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setView(option.value)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
                              transition-all duration-calm ease-calm ${stateClass}`}
                >
                  {option.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
                        selected ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {showOverdue && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selected ? 'bg-white' : 'bg-peach-500 dark:bg-peach-300'
                      }`}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="mb-4 flex items-center justify-end">
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                aria-label="Sort tasks"
                value={settings.todoSort}
                onChange={(e) => updateSettings({ todoSort: e.target.value as TodoSort })}
                className="rounded-calm-sm border border-line bg-surface py-1.5 pl-2 pr-1 text-xs text-ink
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              >
                {TODO_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {/* Bulk actions — shown while selecting tasks */}
      {selecting && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-calm border border-line bg-raised px-3 py-2 shadow-calm">
          <span className="text-xs font-medium text-muted">
            {selected.size === 0 ? 'Select tasks to act on' : `${selected.size} selected`}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => selectAllShown(orderedOpen.map((t) => t.id))}
              disabled={orderedOpen.length === 0}
              className="silicone-quiet rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => void bulkComplete()}
              disabled={selected.size === 0}
              className="silicone inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-sage-700 disabled:opacity-40 dark:text-sage-200"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Complete
            </button>
            <button
              type="button"
              onClick={() => void bulkArchive(true)}
              disabled={selected.size === 0}
              className="silicone inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              Archive
            </button>
            <button
              type="button"
              onClick={endSelection}
              className="silicone-quiet rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
          {orderedOpen.length > 0 ? (
            <motion.ul layout className="space-y-3">
              <AnimatePresence initial={false}>
                {openWindow.visible.map((todo, index) => (
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
                      onReschedule={handleReschedule}
                      onToggleSubtask={handleToggleSubtask}
                      expanded={expandedId === todo.id}
                      onToggleExpand={() =>
                        setExpandedId((prev) => (prev === todo.id ? null : todo.id))
                      }
                      onEdit={(t) => {
                        setSelectedId(null)
                        setDialog({ type: 'edit', todo: t })
                      }}
                      onArchive={handleArchive}
                      onDelete={(t) => {
                        setSelectedId(null)
                        setDialog({ type: 'delete', todo: t })
                      }}
                      selectable={selecting}
                      selected={selected.has(todo.id)}
                      onSelect={toggleSelect}
                      onMoveUp={manualOrder ? () => move(todo.id, -1) : undefined}
                      onMoveDown={manualOrder ? () => move(todo.id, 1) : undefined}
                      canMoveUp={index > 0}
                      canMoveDown={index < orderedOpen.length - 1}
                    />
                  </li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : (
            <div className="rounded-calm border border-dashed border-line bg-raised/60 px-4 py-8 text-center">
              <p className="font-display text-sm font-semibold text-ink">
                {searching ? 'No matching tasks' : EMPTY_VIEW_TEXT[view].title}
              </p>
              <p className="mt-1 text-xs text-muted">
                {searching ? `Nothing matches “${query.trim()}”.` : EMPTY_VIEW_TEXT[view].hint}
              </p>
            </div>
          )}

          {/* Grow the window when the end of the mounted list comes into view. */}
          {orderedOpen.length > 0 && openWindow.hasMore && (
            <div ref={openWindow.sentinelRef} className="mt-4 text-center">
              <button
                type="button"
                onClick={openWindow.showMore}
                className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
              >
                Show more ({orderedOpen.length - openWindow.visible.length} left)
              </button>
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
        Type a sentence in the quick-add line and Bloom works out the date. Switch between Today,
        Upcoming and Anytime, or All to see everything.
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
