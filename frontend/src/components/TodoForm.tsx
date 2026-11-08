import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { CalendarDays, ChevronDown, Clock, ListChecks, Plus, Repeat, Trash2, X } from 'lucide-react'
import type {
  Subtask,
  Todo,
  TodoCategory,
  TodoImportance,
  TodoInput,
  TodoRecurrence,
} from '../types'
import { TODO_CATEGORIES, TODO_IMPORTANCE, TODO_RECURRENCE } from '../lib/todo'
import { toISODate } from '../lib/streak'

function newSubtask(title = ''): Subtask {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { id, title, done: false }
}

interface TodoFormProps {
  mode: 'create' | 'edit'
  todo?: Todo | null
  onClose: () => void
  onSubmit: (input: TodoInput) => Promise<void>
}

export function TodoForm({ mode, todo, onClose, onSubmit }: TodoFormProps) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [note, setNote] = useState(todo?.note ?? '')
  const [category, setCategory] = useState<TodoCategory>(todo?.category ?? 'personal')
  const [importance, setImportance] = useState<TodoImportance>(todo?.importance ?? 'medium')
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '')
  const [dueTime, setDueTime] = useState(todo?.dueTime ?? '')
  const [recurrence, setRecurrence] = useState<TodoRecurrence>(todo?.recurrence ?? 'none')
  const [subtasks, setSubtasks] = useState<Subtask[]>(todo?.subtasks ?? [])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Title + due date are all a quick task needs; the rest folds away on create.
  const [showMore, setShowMore] = useState(mode === 'edit')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function addDays(base: Date, days: number): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Give your task a title.')
      return
    }
    if (trimmed.length > 120) {
      setError('Keep the title under 120 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        title: trimmed,
        note: note.trim() || null,
        category,
        dueDate: dueDate || null,
        dueTime: dueDate ? dueTime || null : null,
        importance,
        recurrence,
        subtasks: subtasks
          .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
          .filter((subtask) => subtask.title.length > 0),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        <div
          className="absolute inset-0 bg-sage-900/30 dark:bg-black/50"
          onClick={onClose}
          aria-hidden
        />
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-calm bg-raised p-6 shadow-calm-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="todo-form-title"
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 id="todo-form-title" className="font-display text-xl font-semibold text-ink">
                {mode === 'create' ? 'New task' : 'Edit task'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {mode === 'create'
                  ? 'Keep it small and clear.'
                  : 'Update the details of this task.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="silicone flex h-9 w-9 items-center justify-center rounded-full text-muted
                         hover:text-ink dark:hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <label htmlFor="todo-title" className="mb-2 block text-sm font-medium text-ink">
            Task
          </label>
          <input
            id="todo-title"
            ref={inputRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Finish the reading response"
            maxLength={120}
            className="w-full rounded-calm-sm border border-line bg-surface px-4 py-2.5
                       text-ink placeholder:text-muted/70
                       transition-all duration-calm ease-calm
                       focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
          />

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-controls="todo-more-options todo-more-options-note"
              aria-describedby="todo-more-options-help"
              className="silicone flex min-h-[44px] w-full items-center gap-2.5 rounded-calm-sm px-3 py-2 text-left"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted transition-transform duration-calm ease-calm ${
                  showMore ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
              <span className="text-sm font-medium text-ink">
                {showMore ? 'Hide options' : 'More options'}
              </span>
            </button>
            <p id="todo-more-options-help" className="mt-1.5 text-xs text-muted">
              Type, priority, repeat, note and steps.
            </p>
          </div>

          {showMore && (
            <div id="todo-more-options">
              <div className="mt-4">
                <span className="mb-2 block text-sm font-medium text-ink">Type</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TODO_CATEGORIES.map((option) => {
                    const Icon = option.icon
                    const selected = category === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setCategory(option.id)}
                        aria-pressed={selected}
                        className={`flex items-center gap-2 rounded-calm-sm border px-3 py-2 text-sm font-medium
                                transition-all duration-calm ease-calm active:scale-[0.98]
                                ${
                                  selected
                                    ? `${option.chip} border-transparent ring-2 ring-sage-400/40`
                                    : 'border-line bg-surface text-muted hover:border-sage-300 hover:text-ink'
                                }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4">
                <span className="mb-2 block text-sm font-medium text-ink">Priority</span>
                <div className="grid grid-cols-3 gap-2">
                  {TODO_IMPORTANCE.map((option) => {
                    const Icon = option.icon
                    const selected = importance === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setImportance(option.id)}
                        aria-pressed={selected}
                        className={`flex items-center justify-center gap-1.5 rounded-calm-sm border px-3 py-2 text-sm font-medium
                                transition-all duration-calm ease-calm active:scale-[0.98]
                                ${
                                  selected
                                    ? `${option.chip} border-transparent ring-2 ring-sage-400/40`
                                    : 'border-line bg-surface text-muted hover:border-sage-300 hover:text-ink'
                                }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4">
                <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Repeat className="h-4 w-4 text-muted" aria-hidden />
                  Repeat
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {TODO_RECURRENCE.map((option) => {
                    const selected = recurrence === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setRecurrence(option.id)
                          // A repeating task needs an anchor date to roll from.
                          if (option.id !== 'none' && !dueDate) setDueDate(toISODate(new Date()))
                        }}
                        aria-pressed={selected}
                        className={`rounded-calm-sm border px-2 py-2 text-sm font-medium
                                transition-all duration-calm ease-calm active:scale-[0.98]
                                ${
                                  selected
                                    ? 'border-transparent bg-sage-100 text-sage-700 ring-2 ring-sage-400/40 dark:bg-sage-900/50 dark:text-sage-200'
                                    : 'border-line bg-surface text-muted hover:border-sage-300 hover:text-ink'
                                }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
                {recurrence !== 'none' && (
                  <>
                    <p className="mt-1.5 text-xs text-muted">
                      Completing it moves it to the next{' '}
                      {recurrence === 'daily' ? 'day' : recurrence === 'weekly' ? 'week' : 'month'}{' '}
                      instead of leaving it done.
                    </p>
                    <p className="mt-1.5 text-xs text-muted">
                      For something you want to build a streak around, a Habit may fit better.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="todo-due" className="mb-2 block text-sm font-medium text-ink">
              Due date <span className="font-normal text-muted">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarDays
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  aria-hidden
                />
                <input
                  id="todo-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    const value = e.target.value
                    setDueDate(value)
                    if (!value) setDueTime('')
                  }}
                  className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-4
                             text-ink transition-all duration-calm ease-calm
                             focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
                />
              </div>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => {
                    setDueDate('')
                    setDueTime('')
                  }}
                  className="silicone-quiet rounded-full px-3 py-2 text-sm font-medium
                             hover:text-ink dark:hover:text-ink"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: 'Today', days: 0 },
              { label: 'Tomorrow', days: 1 },
              { label: 'Next week', days: 7 },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setDueDate(toISODate(addDays(new Date(), chip.days)))}
                className="silicone-quiet rounded-full px-3 py-1 text-xs font-medium text-muted hover:text-ink"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {dueDate && (
            <div className="mt-4">
              <label htmlFor="todo-time" className="mb-2 block text-sm font-medium text-ink">
                Due time <span className="font-normal text-muted">(optional)</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Clock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden
                  />
                  <input
                    id="todo-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-4
                               text-ink transition-all duration-calm ease-calm
                               focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
                  />
                </div>
                {dueTime && (
                  <button
                    type="button"
                    onClick={() => setDueTime('')}
                    className="silicone-quiet rounded-full px-3 py-2 text-sm font-medium
                               hover:text-ink dark:hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {dueTime
                  ? 'The task becomes overdue after this time.'
                  : 'Leave empty to make it overdue at the end of the day.'}
              </p>
            </div>
          )}

          {showMore && (
            <div id="todo-more-options-note">
              <div className="mt-4">
                <label htmlFor="todo-note" className="mb-2 block text-sm font-medium text-ink">
                  Note <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="todo-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything worth remembering?"
                  maxLength={280}
                  rows={2}
                  className="w-full resize-none rounded-calm-sm border border-line bg-surface px-4 py-2.5
                         text-ink placeholder:text-muted/70
                         transition-all duration-calm ease-calm
                         focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
                />
              </div>

              <div className="mt-4">
                <span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
                  <ListChecks className="h-4 w-4 text-muted" aria-hidden />
                  Steps <span className="font-normal text-muted">(optional)</span>
                </span>
                {subtasks.length > 0 && (
                  <ul className="mb-2 space-y-2">
                    {subtasks.map((subtask, index) => (
                      <li key={subtask.id} className="flex items-center gap-2">
                        <input
                          value={subtask.title}
                          onChange={(e) =>
                            setSubtasks((prev) =>
                              prev.map((s, i) =>
                                i === index ? { ...s, title: e.target.value } : s,
                              ),
                            )
                          }
                          placeholder={`Step ${index + 1}`}
                          maxLength={120}
                          aria-label={`Step ${index + 1}`}
                          className="w-full rounded-calm-sm border border-line bg-surface px-3 py-2 text-sm
                                 text-ink placeholder:text-muted/70 focus:border-sage-400 focus:outline-none
                                 focus:ring-2 focus:ring-sage-400/30"
                        />
                        <button
                          type="button"
                          onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={`Remove step ${index + 1}`}
                          className="silicone-quiet flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                                 text-muted hover:text-peach-600 dark:hover:text-peach-300"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setSubtasks((prev) => [...prev, newSubtask()])}
                  className="silicone-quiet inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium
                         text-muted hover:text-ink"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add a step
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-calm-sm bg-peach-100 px-3 py-2 text-sm text-peach-700 dark:bg-peach-900/40 dark:text-peach-200">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-2 rounded-b-calm border-t border-line bg-raised px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium
                         hover:text-ink dark:hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="silicone-primary rounded-full px-5 py-2 text-sm font-semibold
                         disabled:opacity-60"
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Add task' : 'Save changes'}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </Portal>
  )
}
