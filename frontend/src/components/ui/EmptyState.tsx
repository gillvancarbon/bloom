import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  /** Primary and secondary actions, shown as a row on wide screens. */
  actions?: ReactNode
  /** Smaller, quieter layout for an empty sub-section rather than a whole screen. */
  compact?: boolean
}

/**
 * The shared empty state. Uses a soft sage medallion and centred copy rather
 * than a boxed card, so an empty screen reads as calm space waiting to be
 * filled instead of a broken panel.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  compact = false,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`flex flex-col items-center text-center ${compact ? 'py-8' : 'py-14'}`}
    >
      {Icon && (
        <span
          className={`mb-4 flex items-center justify-center rounded-full bg-sage-500/10 text-sage-600
                      ring-1 ring-inset ring-sage-500/15 dark:bg-sage-400/10 dark:text-sage-300 dark:ring-sage-400/20 ${
                        compact ? 'h-11 w-11' : 'h-14 w-14'
                      }`}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
        </span>
      )}
      <h3
        className={`font-display font-semibold tracking-tight text-ink ${
          compact ? 'text-sm' : 'text-base'
        }`}
      >
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{description}</p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      )}
    </motion.div>
  )
}
