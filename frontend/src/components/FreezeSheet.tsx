import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { Portal } from './Portal'
import { FrozenFlame } from './FrozenFlame'
import { Button } from './ui/Button'
import { EmptyState } from './ui/EmptyState'
import type { Habit } from '../types'
import { missedDays, WEEKLY_FREEZES } from '../lib/freezes'

interface FreezeSheetProps {
  /** Freezes left to spend. */
  tokens: number
  /** Habits with unprotected missed days. */
  atRisk: Habit[]
  now: Date
  onFreeze: (habit: Habit) => void
  onClose: () => void
}

/** A small row of frozen flames showing how many freezes are left. */
function TokenRow({ tokens }: { tokens: number }) {
  const shown = Math.max(WEEKLY_FREEZES, tokens)
  return (
    <div className="flex items-center gap-1.5" aria-label={`${tokens} freezes left`}>
      {Array.from({ length: shown }, (_, i) => {
        const filled = i < tokens
        return (
          <span
            key={i}
            className={`flex h-7 w-7 items-center justify-center rounded-full ${
              filled ? 'silicone-frost' : 'border border-dashed border-line text-muted/50'
            }`}
            aria-hidden
          >
            <FrozenFlame className="h-3.5 w-3.5" />
          </span>
        )
      })}
    </div>
  )
}

/**
 * The "Streak freezes" sheet: explains the weekly allowance and lets the user
 * spend a freeze to protect a habit's most recent missed day.
 */
export function FreezeSheet({ tokens, atRisk, now, onFreeze, onClose }: FreezeSheetProps) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
        <motion.div
          className="absolute inset-0 bg-sage-900/30 dark:bg-black/50"
          onClick={onClose}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Streak freezes"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-calm-lg bg-raised p-5 shadow-calm-lg sm:rounded-calm-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
              Streak freezes
            </h3>
            <Button variant="ghost" className="hover:text-ink" onClick={onClose}>
              Done
            </Button>
          </div>

          <p className="text-sm text-muted">
            Protect a streak when life gets in the way. You get {WEEKLY_FREEZES} freezes each week —
            spend one on a missed day to keep the flame alive.
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <TokenRow tokens={tokens} />
            <span className="text-sm font-medium text-ink">{tokens} left</span>
          </div>

          <div className="mt-5">
            {atRisk.length === 0 ? (
              <EmptyState
                compact
                icon={ShieldCheck}
                title="Every streak is safe"
                description="Nothing needs protecting right now. Miss a day and it’ll show up here."
              />
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {atRisk.map((habit) => {
                    const missed = missedDays(habit, now).length
                    return (
                      <motion.li
                        key={habit.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="flex items-center justify-between gap-3 border-b border-line/70 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{habit.name}</p>
                          <p className="text-xs text-muted">
                            {missed} missed {missed === 1 ? 'day' : 'days'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onFreeze(habit)}
                          disabled={tokens <= 0}
                          className="silicone-frost inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold
                                     disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FrozenFlame className="h-3.5 w-3.5" />
                          Use a freeze
                        </button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </motion.div>
      </div>
    </Portal>
  )
}
