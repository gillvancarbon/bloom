import { motion } from 'framer-motion'
import { CalendarDays, Check, ChevronDown, ListChecks, MoveRight, Repeat } from 'lucide-react'
import type { Todo } from '../types'
import {
  categoryMeta,
  dueState,
  importanceMeta,
  recurrenceLabel,
  subtaskProgress,
} from '../lib/todo'
import { toISODate } from '../lib/streak'
import { ReorderButtons } from './ReorderButtons'
import { RowActions } from './RowActions'

interface TodoCardProps {
  todo: Todo
  now: Date
  busy?: boolean
  actionsOpen: boolean
  onToggleActions: () => void
  onEdit: (todo: Todo) => void
  onArchive?: (todo: Todo) => void
  onDelete: (todo: Todo) => void
  onToggle: (todo: Todo) => void
  /** Move an overdue task to today in one tap. */
  onReschedule?: (todo: Todo, dueDate: string) => void
  /** Tick or untick a checklist step. */
  onToggleSubtask?: (todo: Todo, subtaskId: string) => void
  /** Whether the checklist is open. */
  expanded?: boolean
  onToggleExpand?: () => void
  /** Bulk-selection mode: show a checkbox and hide the per-row actions. */
  selectable?: boolean
  selected?: boolean
  onSelect?: (todo: Todo) => void
  /** Manual order: move this task one slot up or down. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** Briefly pulse the card after it is completed (opt-in celebrations). */
  pulsing?: boolean
}

export function TodoCard({
  todo,
  now,
  busy,
  actionsOpen,
  onToggleActions,
  onEdit,
  onArchive,
  onDelete,
  onToggle,
  onReschedule,
  onToggleSubtask,
  expanded = false,
  onToggleExpand,
  selectable = false,
  selected = false,
  onSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  pulsing = false,
}: TodoCardProps) {
  const category = categoryMeta(todo.category)
  const CategoryIcon = category.icon
  const importance = importanceMeta(todo.importance)
  const ImportanceIcon = importance.icon
  const due = dueState(todo.dueDate, todo.dueTime, now)
  const repeat = recurrenceLabel(todo.recurrence)
  const steps = subtaskProgress(todo)
  const canExpand = steps.total > 0
  const reschedulable = due.level === 'overdue' && !todo.done && !todo.archived && onReschedule

  const overdue = due.level === 'overdue' && !todo.done
  const dueClass =
    due.level === 'overdue'
      ? 'font-semibold text-peach-700 dark:text-peach-300'
      : due.level === 'today'
        ? 'font-medium text-sage-600 dark:text-sage-300'
        : 'text-muted'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={
        pulsing ? { opacity: 1, y: 0, scale: [1, 1.012, 1] } : { opacity: 1, y: 0, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      transition={
        pulsing
          ? { duration: 0.6, ease: [0.4, 0, 0.2, 1], times: [0, 0.35, 1] }
          : { duration: 0.32, ease: [0.4, 0, 0.2, 1] }
      }
      className={`group relative flex items-start gap-3 border-b border-line/70 py-3.5
                 transition-colors duration-calm ease-calm first:border-t last:border-b-0
                 sm:gap-4 ${todo.done ? 'opacity-70' : ''} ${todo.archived ? 'opacity-60' : ''}`}
    >
      {selectable ? (
        /* Bulk selection checkbox */
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Select ${todo.title}`}
          onClick={() => onSelect?.(todo)}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2
                      transition-colors duration-calm ease-calm sm:h-10 sm:w-10 ${
                        selected
                          ? 'border-sage-500 bg-sage-500 text-white'
                          : 'border-line text-transparent hover:border-sage-300'
                      }`}
        >
          <Check className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
        </button>
      ) : (
        /* Completion control — a ring that fills with sage and stamps a check. */
        <button
          type="button"
          onClick={() => onToggle(todo)}
          disabled={busy}
          aria-pressed={todo.done}
          aria-label={todo.done ? `Mark ${todo.title} as not done` : `Mark ${todo.title} complete`}
          title={todo.done ? 'Mark as not done' : 'Mark complete'}
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2
                      transition-all duration-calm ease-calm active:scale-90 sm:h-10 sm:w-10
                      ${busy ? 'opacity-60' : ''} ${
                        todo.done
                          ? 'border-sage-500 bg-sage-500 text-white shadow-calm'
                          : overdue
                            ? 'border-peach-400 text-peach-600 hover:bg-peach-500/5 dark:border-peach-500 dark:text-peach-300 dark:hover:bg-peach-400/5'
                            : 'border-mint-400 text-sage-600 hover:bg-sage-500/5 dark:border-mint-600 dark:text-sage-300 dark:hover:bg-sage-400/5'
                      }`}
        >
          <Check
            className={`h-[18px] w-[18px] transition-all duration-calm ease-calm ${
              todo.done ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
            strokeWidth={2.6}
            aria-hidden
          />
        </button>
      )}

      {/* Title + facts */}
      <div className="min-w-0 flex-1">
        <h3
          className={`break-words font-display text-[15px] font-semibold leading-snug sm:text-base ${
            todo.done ? 'text-muted line-through decoration-mint-400/70' : 'text-ink'
          }`}
        >
          {todo.title}
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span
            className={`inline-flex items-center gap-1 ${category.chip} rounded-full px-2 py-0.5 font-medium`}
          >
            <CategoryIcon className="h-3 w-3 shrink-0" aria-hidden />
            {category.label}
          </span>

          <span className="inline-flex items-center gap-1 text-muted">
            <ImportanceIcon className="h-3 w-3 shrink-0" aria-hidden />
            {importance.label}
          </span>

          {due.level !== 'none' && !todo.done && (
            <span className={`inline-flex items-center gap-1 tabular-nums ${dueClass}`}>
              <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
              {due.text}
            </span>
          )}

          {repeat && (
            <span className="inline-flex items-center gap-1 text-muted">
              <Repeat className="h-3 w-3 shrink-0" aria-hidden />
              {repeat}
            </span>
          )}

          {canExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-muted
                         transition-colors duration-calm ease-calm hover:bg-mint-100 hover:text-ink
                         dark:hover:bg-mint-900/40"
            >
              <ListChecks className="h-3 w-3 shrink-0" aria-hidden />
              {steps.done}/{steps.total} steps
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform duration-calm ease-calm ${
                  expanded ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
          )}
        </div>

        {reschedulable && (
          <button
            type="button"
            onClick={() => onReschedule(todo, toISODate(now))}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-peach-500/10 px-2.5 py-1 text-xs font-semibold
                       text-peach-700 transition-colors duration-calm ease-calm hover:bg-peach-500/20
                       dark:text-peach-300"
          >
            <MoveRight className="h-3.5 w-3.5" aria-hidden />
            Move to today
          </button>
        )}

        {canExpand && expanded && (
          <ul className="mt-2 space-y-0.5">
            {todo.subtasks.map((subtask) => (
              <li key={subtask.id}>
                <button
                  type="button"
                  onClick={() => onToggleSubtask?.(todo, subtask.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-calm-sm px-1 py-1 text-left text-xs
                             text-muted transition-colors duration-calm ease-calm hover:text-ink"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      subtask.done
                        ? 'border-sage-500 bg-sage-500 text-white'
                        : 'border-line bg-surface'
                    }`}
                  >
                    {subtask.done && <Check className="h-2.5 w-2.5" aria-hidden />}
                  </span>
                  <span className={subtask.done ? 'line-through decoration-mint-400/80' : ''}>
                    {subtask.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {todo.note && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{todo.note}</p>
        )}

        {todo.archived && (
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">
            Archived
          </p>
        )}
      </div>

      {!selectable &&
        (onMoveUp || onMoveDown ? (
          <ReorderButtons
            label={todo.title}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            role="group"
            className="flex shrink-0 flex-col gap-1"
          />
        ) : (
          <RowActions
            id={todo.id}
            label={todo.title}
            archived={todo.archived}
            open={actionsOpen}
            onToggle={onToggleActions}
            onEdit={() => onEdit(todo)}
            onArchive={onArchive ? () => onArchive(todo) : undefined}
            onDelete={() => onDelete(todo)}
          />
        ))}
    </motion.article>
  )
}
