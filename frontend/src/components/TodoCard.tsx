import { motion } from 'framer-motion'
import { CalendarDays, Check } from 'lucide-react'
import type { Todo } from '../types'
import { categoryMeta, dueState, importanceMeta } from '../lib/todo'
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
}: TodoCardProps) {
  const category = categoryMeta(todo.category)
  const CategoryIcon = category.icon
  const importance = importanceMeta(todo.importance)
  const ImportanceIcon = importance.icon
  const due = dueState(todo.dueDate, todo.dueTime, now)

  const dueClass =
    due.level === 'overdue'
      ? 'font-medium text-peach-600 dark:text-peach-300'
      : due.level === 'today'
        ? 'text-sage-600 dark:text-sage-300'
        : 'text-muted'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`group relative overflow-hidden rounded-calm border border-line
                  bg-raised px-4 py-3.5 shadow-calm sm:px-5
                  transition-all duration-calm ease-calm
                  hover:border-sage-300 hover:shadow-calm-lg
                  dark:hover:border-sage-700 ${todo.done ? 'opacity-80' : ''} ${
                    todo.archived ? 'opacity-70' : ''
                  }`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Completion toggle */}
        <button
          type="button"
          onClick={() => onToggle(todo)}
          disabled={busy}
          aria-pressed={todo.done}
          aria-label={todo.done ? `Mark ${todo.title} as not done` : `Mark ${todo.title} complete`}
          title={todo.done ? 'Mark as not done' : 'Mark complete'}
          className={`${todo.done ? 'silicone-primary' : 'silicone'} mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center
                      rounded-full sm:h-11 sm:w-11 ${busy ? 'opacity-60' : ''}`}
        >
          <Check
            className={`h-5 w-5 transition-all duration-calm ease-calm ${
              todo.done
                ? 'scale-100 opacity-100'
                : 'scale-75 text-sage-500 opacity-50 dark:text-sage-300'
            }`}
            aria-hidden
          />
        </button>

        {/* Title + type + due date */}
        <div className="min-w-0 flex-1">
          <h3
            className={`break-words font-display text-sm font-semibold sm:text-base ${
              todo.done ? 'text-muted line-through decoration-mint-400/80' : 'text-ink'
            }`}
          >
            {todo.title}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${category.chip}`}
            >
              <CategoryIcon className="h-3 w-3" aria-hidden />
              {category.label}
            </span>

            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${importance.chip}`}
            >
              <ImportanceIcon className="h-3 w-3" aria-hidden />
              {importance.label}
            </span>

            {due.level !== 'none' && !todo.done && (
              <span className={`inline-flex items-center gap-1 ${dueClass}`}>
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {due.text}
              </span>
            )}
          </div>

          {todo.archived && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              Archived
            </p>
          )}

          {todo.note && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{todo.note}</p>
          )}
        </div>

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
      </div>
    </motion.article>
  )
}
