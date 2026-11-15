import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Archive, Check, ListChecks, Plus, Search, Sparkles, X } from 'lucide-react'
import { AppHeader } from './AppHeader'
import { TodoCard } from './TodoCard'
import { TodoForm } from './TodoForm'
import { DeleteConfirm } from './DeleteConfirm'
import { UndoToast } from './UndoToast'
import { Button } from './ui/Button'
import { Chip } from './ui/Chip'
import { Collapsible } from './ui/Collapsible'
import { EmptyState } from './ui/EmptyState'
import { ErrorState } from './ui/ErrorState'
import { FIELD_INPUT, SELECT_CHEVRON } from './ui/Field'
import { IconButton } from './ui/IconButton'
import { SectionHeading } from './ui/SectionHeading'
import { SkeletonList } from './ui/Skeleton'
import { TaskSummary } from './TaskSummary'
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
import { celebrate, tap } from '../lib/feedback'
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

/** Build a TodoInput from an existing task, overriding only what changed. */
function todoInputFrom(todo: Todo, patch: Partial<TodoInput> = {}): TodoInput {
  return {
    title: todo.title,
    note: todo.note,
    category: todo.category,
    dueDate: todo.dueDate,
    dueTime: todo.dueTime,
    importance: todo.importance,
    recurrence: todo.recurrence,
    subtasks: todo.subtasks,
    ...patch,
  }
}

interface TodosViewProps {
  onOpenSettings: () => void
  onOpenCalendar: () => void
  onOpenInsights: () => void
}

export function TodosView({ onOpenSettings, onOpenCalendar, onOpenInsights }: TodosViewProps) {
  const { todos, order, loading, error, busyId, create, update, remove, archive, toggle, move } =
    useTodos()
  const { settings, update: updateSettings } = useSettings()
  const now = useNow()
  const reducedMotion = useReducedMotion()
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
  const [pulsing, setPulsing] = useState<Set<number>>(new Set())
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undo = useUndoQueue()
  const { commitNow } = undo

  /**
   * Announce a change to assistive tech. Clearing first lets the same sentence
   * be announced twice in a row (e.g. adding two tasks with the same title).
   */
  /** Arrow keys rove across the view chips, matching the habits period tabs. */
  function handleViewKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = Math.max(
      0,
      TODO_VIEWS.findIndex((option) => option.value === view),
    )
    const dir = event.key === 'ArrowRight' ? 1 : -1
    const next = TODO_VIEWS[(index + dir + TODO_VIEWS.length) % TODO_VIEWS.length].value
    setView(next)
    requestAnimationFrame(() => document.getElementById(`todo-view-${next}`)?.focus())
  }

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

  /**
   * Opt-in feedback for a completion the user just made. One tap and one
   * celebration cover the whole action, however many tasks it touched, and the
   * card pulse stays off when motion is reduced or celebrations are disabled.
   */
  function signalCompletion(ids: number[]) {
    const opts = { haptics: settings.haptics, celebrations: settings.celebrations }
    tap(opts)
    if (!settings.celebrations) return
    celebrate(opts, 'task')
    if (reducedMotion || ids.length === 0) return
    setPulsing(new Set(ids))
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => {
      setPulsing(new Set())
      pulseTimer.current = null
    }, 600)
  }

  async function bulkComplete() {
    const ids = [...selected].filter((id) => !todos.find((t) => t.id === id)?.done)
    if (!ids.length) return endSelection()
    await runBulk(ids, (id) => toggle(id))
    signalCompletion(ids)
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

  // Stop a pulse timer if the screen unmounts mid-animation.
  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    },
    [],
  )

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
    // Quiet, opt-in feedback only when marking done, never when un-checking.
    if (completing) {
      void playCompletionSound(settings)
      signalCompletion([todo.id])
    }
    // Tell the reader where a repeating task went, and let them take it back.
    if (repeats) {
      const next = dueState(updated.dueDate, updated.dueTime, now)
      undo.push({
        message: `“${todo.title}” repeats — moved to ${next.text || 'its next turn'}`,
        undoLabel: 'Undo',
        onUndo: () => update(todo.id, todoInputFrom(todo)).then(() => undefined),
        onCommit: () => undefined,
      })
    } else {
      announce(completing ? `“${todo.title}” completed.` : `“${todo.title}” reopened.`)
    }
  }

  /** Move an overdue task to a new date without opening the editor. */
  async function handleReschedule(todo: Todo, dueDate: string) {
    setSelectedId(null)
    await update(todo.id, todoInputFrom(todo, { dueDate }))
    undo.push({
      message: `“${todo.title}” moved to today`,
      undoLabel: 'Undo',
      onUndo: () => update(todo.id, todoInputFrom(todo)).then(() => undefined),
      onCommit: () => undefined,
    })
  }

  async function handleToggleSubtask(todo: Todo, subtaskId: string) {
    const subtasks: Subtask[] = todo.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
    )
    await update(todo.id, todoInputFrom(todo, { subtasks }))
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
      <AppHeader
        subtitle="A calm place for what’s next."
        onOpenSettings={onOpenSettings}
        onOpenCalendar={onOpenCalendar}
        onOpenInsights={onOpenInsights}
      />

      {/* Today at a glance — hidden once the board is empty, matching the
          habits screen: "0 open · 0 done · 0 due today" is noise above an
          empty state that already says what to do. */}
      {!loading && !error && activeTodos.length > 0 && (
        <TaskSummary
          doneToday={stats.doneToday}
          boardTotal={openTodos.length + doneTodayTodos.length}
          dueToday={stats.dueToday}
          overdue={stats.overdue}
          hasTasks={activeTodos.length > 0}
        />
      )}

      {/* Add task */}
      <SectionHeading
        action={
          <>
            <IconButton
              icon={ListChecks}
              label={selecting ? 'Done selecting' : 'Select tasks'}
              tone="quiet"
              size="sm"
              aria-pressed={selecting}
              className={selecting ? 'text-sage-600 dark:text-sage-300' : ''}
              onClick={() => (selecting ? endSelection() : setSelecting(true))}
            />
            <IconButton
              icon={Search}
              label={searchOpen ? 'Close search' : 'Search tasks'}
              tone="quiet"
              size="sm"
              aria-pressed={searchOpen}
              className={searchOpen ? 'text-sage-600 dark:text-sage-300' : ''}
              onClick={() => {
                setSearchOpen((open) => !open)
                if (searchOpen) setQuery('')
              }}
            />
            <Button
              icon={Plus}
              variant="primary"
              size="sm"
              onClick={() => setDialog({ type: 'create' })}
            >
              Add task
            </Button>
          </>
        }
      >
        Your tasks
      </SectionHeading>

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
              className={`${FIELD_INPUT} pr-9`}
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
            onKeyDown={handleViewKeyDown}
            className="mb-3 flex flex-wrap items-center gap-1.5"
          >
            {TODO_VIEWS.map((option) => {
              const selected = option.value === view
              const count =
                option.value === 'all' ? openTodos.length : bucketCounts[option.value as TodoBucket]
              const showOverdue = option.value === 'today' && stats.overdue > 0
              return (
                <Chip
                  key={option.value}
                  id={`todo-view-${option.value}`}
                  selected={selected}
                  ariaSelected={selected}
                  tabIndex={selected ? 0 : -1}
                  count={count > 0 ? count : undefined}
                  dot={showOverdue}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </Chip>
              )
            })}
          </div>

          <div className="mb-4 flex items-center justify-end">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <span className="sr-only sm:not-sr-only">Sort</span>
              <select
                aria-label="Sort tasks"
                value={settings.todoSort}
                onChange={(e) => updateSettings({ todoSort: e.target.value as TodoSort })}
                className="cursor-pointer appearance-none rounded-full border border-line bg-transparent py-1.5 pl-3 pr-6
                           text-xs font-medium text-muted transition-colors duration-calm ease-calm
                           hover:border-sage-300 hover:text-ink focus:border-sage-400 focus:outline-none
                           focus:ring-2 focus:ring-sage-400/30"
                style={SELECT_CHEVRON}
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-l-2 border-sage-400 py-1 pl-3.5">
          <span className="text-xs font-medium text-muted">
            {selected.size === 0 ? 'Select tasks to act on' : `${selected.size} selected`}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectAllShown(orderedOpen.map((t) => t.id))}
              disabled={orderedOpen.length === 0}
            >
              Select all
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Check}
              onClick={() => void bulkComplete()}
              disabled={selected.size === 0}
              className="text-sage-700 dark:text-sage-200"
            >
              Complete
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Archive}
              onClick={() => void bulkArchive(true)}
              disabled={selected.size === 0}
            >
              Archive
            </Button>
            <Button variant="ghost" size="sm" onClick={endSelection}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SkeletonList rows={3} label="Loading tasks" />
      ) : error ? (
        <ErrorState
          title="We couldn’t load your tasks."
          detail={error}
          onRetry={() => window.location.reload()}
        />
      ) : todos.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing on your plate"
          description="Add a task above, or type a whole sentence into the quick-add line — Bloom works out the date for you."
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setDialog({ type: 'create' })}>
              Add your first task
            </Button>
          }
        />
      ) : (
        <>
          {orderedOpen.length > 0 ? (
            <motion.ul layout className="">
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
                      pulsing={pulsing.has(todo.id)}
                    />
                  </li>
                ))}
              </AnimatePresence>
            </motion.ul>
          ) : (
            <EmptyState
              compact
              title={searching ? 'No matching tasks' : EMPTY_VIEW_TEXT[view].title}
              description={
                searching ? `Nothing matches “${query.trim()}”.` : EMPTY_VIEW_TEXT[view].hint
              }
            />
          )}

          {/* Grow the window when the end of the mounted list comes into view. */}
          {orderedOpen.length > 0 && openWindow.hasMore && (
            <div ref={openWindow.sentinelRef} className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={openWindow.showMore}>
                Show more ({orderedOpen.length - openWindow.visible.length} left)
              </Button>
            </div>
          )}

          {doneTodayTodos.length > 0 && (
            <section className="mt-7">
              <SectionHeading variant="label">Done today</SectionHeading>
              <motion.ul layout className="">
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
                        pulsing={pulsing.has(todo.id)}
                      />
                    </li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          )}

          {archivedTodos.length > 0 && (
            <section className="mt-4">
              <Collapsible
                title="Archived"
                count={archivedTodos.length}
                icon={Archive}
                open={showArchived}
                onToggle={() => setShowArchived((v) => !v)}
              >
                <motion.ul layout className="">
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
              </Collapsible>
            </section>
          )}
        </>
      )}

      <footer className="mt-10 text-center text-xs leading-relaxed text-muted">
        Type a sentence in the quick-add line and Bloom works out the date.
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
