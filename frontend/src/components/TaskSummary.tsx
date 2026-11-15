import { motion } from 'framer-motion'

interface TaskSummaryProps {
  doneToday: number
  boardTotal: number
  dueToday: number
  overdue: number
  hasTasks: boolean
}

/**
 * The task board at a glance, mirroring the habit screen's DaySummary so the
 * two tabs share one visual language. The headline is what is still open;
 * completed, due and overdue sit underneath as quiet facts.
 */
export function TaskSummary({
  doneToday,
  boardTotal,
  dueToday,
  overdue,
  hasTasks,
}: TaskSummaryProps) {
  const open = Math.max(0, boardTotal - doneToday)
  const ratio = boardTotal > 0 ? doneToday / boardTotal : 0

  const message = !hasTasks
    ? 'Add a task to begin.'
    : open === 0
      ? 'Your board is clear. Nicely done.'
      : overdue > 0
        ? `${overdue} past due — clear those first, then the rest.`
        : dueToday > 0
          ? `${dueToday} due today. A steady pass will do it.`
          : 'Nothing pinned to today. Glance at what’s coming up.'

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      aria-label="Task board summary"
      className="mb-7"
    >
      <div className="flex items-end justify-between gap-4">
        <p className="font-display text-[2.25rem] font-semibold leading-none tabular-nums tracking-tight text-ink sm:text-[2.75rem]">
          {open}
          <span className="text-muted text-lg font-normal sm:text-xl"> open</span>
        </p>
        <p className="mb-1 max-w-[15rem] text-right text-xs leading-relaxed text-muted sm:text-sm">
          {message}
        </p>
      </div>

      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-mint-200/70 dark:bg-mint-900/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={boardTotal}
        aria-valuenow={doneToday}
        aria-label={`${doneToday} of ${boardTotal} tasks done today`}
      >
        <motion.div
          className="h-full rounded-full bg-sage-400"
          initial={false}
          animate={{ width: `${Math.round(ratio * 100)}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Done today</dt>
          <span className="h-1.5 w-1.5 rounded-full bg-sage-500" aria-hidden />
          <dd className="text-muted">
            <span className="font-display font-semibold tabular-nums text-ink">{doneToday}</span>{' '}
            done
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Due today</dt>
          <span className="h-1.5 w-1.5 rounded-full bg-mint-500" aria-hidden />
          <dd className="text-muted">
            <span className="font-display font-semibold tabular-nums text-ink">{dueToday}</span> due
            today
          </dd>
        </div>
        {overdue > 0 && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Overdue</dt>
            <span className="h-1.5 w-1.5 rounded-full bg-peach-500" aria-hidden />
            <dd className="text-muted">
              <span className="font-display font-semibold tabular-nums text-peach-700 dark:text-peach-300">
                {overdue}
              </span>{' '}
              past due
            </dd>
          </div>
        )}
      </dl>
    </motion.section>
  )
}
