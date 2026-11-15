import { Flame } from 'lucide-react'
import { motion } from 'framer-motion'

interface DaySummaryProps {
  done: number
  total: number
  streak: number
  overdue: number
  /** Shown under the headline — a calm, human line about the day. */
  message: string
}

/**
 * The day at a glance. Instead of three boxed statistics, this reads as a
 * short editorial header: one headline number for the day's progress, a thin
 * progress rule, and the streak and overdue figures as quiet secondary facts.
 * Whitespace, not borders, keeps the three apart.
 */
export function DaySummary({ done, total, streak, overdue, message }: DaySummaryProps) {
  const ratio = total > 0 ? done / total : 0
  const allDone = total > 0 && done === total

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      aria-label="Today's progress"
      className="mb-7"
    >
      <div className="flex items-end justify-between gap-4">
        <p className="font-display text-[2.25rem] font-semibold leading-none tabular-nums tracking-tight text-ink sm:text-[2.75rem]">
          {done}
          {/* Full-strength muted: the token is tuned to just clear AA, so
              dimming it with opacity drops the fraction below contrast. */}
          <span className="text-muted">/{total}</span>
        </p>
        <p className="mb-1 max-w-[15rem] text-right text-xs leading-relaxed text-muted sm:text-sm">
          {message}
        </p>
      </div>

      {/* Progress rule — a single hairline that fills as the day is done. */}
      <div
        className="mt-3 h-1 w-full overflow-hidden rounded-full bg-mint-200/70 dark:bg-mint-900/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={`${done} of ${total} habits done today`}
      >
        <motion.div
          className={`h-full rounded-full ${allDone ? 'bg-sage-500' : 'bg-sage-400'}`}
          initial={false}
          animate={{ width: `${Math.round(ratio * 100)}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      <dl className="mt-4 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Day streak</dt>
          <Flame
            className={`h-4 w-4 ${streak > 0 ? 'text-peach-500' : 'text-muted/60'}`}
            aria-hidden
          />
          <dd className="text-sm text-muted">
            <span className="font-display font-semibold text-ink tabular-nums">{streak}</span> day
            {streak === 1 ? '' : 's'} in a row
          </dd>
        </div>
        {overdue > 0 && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Overdue</dt>
            <span className="h-1.5 w-1.5 rounded-full bg-peach-500" aria-hidden />
            <dd className="text-sm text-muted">
              <span className="font-display font-semibold tabular-nums text-peach-700 dark:text-peach-300">
                {overdue}
              </span>{' '}
              past deadline
            </dd>
          </div>
        )}
      </dl>
    </motion.section>
  )
}
