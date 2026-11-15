import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, type LucideIcon } from 'lucide-react'

interface CollapsibleProps {
  /** The disclosure label, e.g. "Archived". */
  title: string
  /** A count shown beside the title. */
  count?: number
  icon?: LucideIcon
  open: boolean
  onToggle: () => void
  /** Optional one-line explanation shown above the children when open. */
  hint?: ReactNode
  /** A quiet second line under the title, visible whether open or closed. */
  subtitle?: ReactNode
  children: ReactNode
}

/**
 * The shared disclosure used for secondary groups ("Not today", "Archived") and
 * for expandable rows such as the per-habit breakdown in Insights. A plain text
 * row with a rotating chevron rather than a button-shaped pill, so these sit
 * clearly below the day's real content.
 */
export function Collapsible({
  title,
  count,
  icon: Icon,
  open,
  onToggle,
  hint,
  subtitle,
  children,
}: CollapsibleProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-2 py-2 text-sm font-medium text-muted
                   transition-colors duration-calm ease-calm hover:text-ink"
      >
        <span className="min-w-0">
          <span className="inline-flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
            <span className="truncate font-medium text-ink">{title}</span>
            {count !== undefined && (
              <span className="rounded-full bg-black/5 px-1.5 text-xs tabular-nums dark:bg-white/10">
                {count}
              </span>
            )}
          </span>
          {subtitle && <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-calm ease-calm ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              {hint && <p className="pb-1 text-xs leading-relaxed text-muted">{hint}</p>}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
