import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ChipProps {
  children: ReactNode
  icon?: LucideIcon
  /** A trailing count, rendered in a subtle inset pill. */
  count?: ReactNode
  /** Filled when true — the active state. */
  selected?: boolean
  onClick?: () => void
  /** Announced by assistive tech when the chip is a toggle. */
  ariaSelected?: boolean
  id?: string
  tabIndex?: number
  /** A small state dot (e.g. "something is overdue here"). */
  dot?: boolean
  /** Chip spans the full row and lays its label out to the edges. */
  block?: boolean
  className?: string
}

/**
 * A single filter chip. Quieter than a card and lighter than a button: an
 * unselected chip is a soft surface, the selected one fills with sage. Used
 * for the time-of-day filters, task views and the "hide done" toggle alike.
 */
export function Chip({
  children,
  icon: Icon,
  count,
  selected = false,
  onClick,
  ariaSelected,
  id,
  tabIndex,
  dot,
  block = false,
  className = '',
}: ChipProps) {
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'span'
  return (
    <Tag
      {...(interactive
        ? {
            type: 'button' as const,
            onClick,
            ...(ariaSelected !== undefined
              ? { role: 'tab' as const, 'aria-selected': ariaSelected }
              : {}),
          }
        : {})}
      {...(id ? { id } : {})}
      {...(tabIndex !== undefined ? { tabIndex } : {})}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                  transition-colors duration-calm ease-calm ${block ? 'w-full justify-between' : ''} ${
                    selected
                      ? 'bg-sage-500 text-white shadow-calm'
                      : 'border border-line bg-raised/70 text-muted hover:border-sage-300 hover:text-ink'
                  } ${className}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
        {children}
      </span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${
            selected ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'
          }`}
        >
          {count}
        </span>
      )}
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-white' : 'bg-peach-500'}`}
          aria-hidden
        />
      )}
    </Tag>
  )
}
