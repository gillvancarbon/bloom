import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface SegmentedOption<T extends string | number> {
  value: T
  label: ReactNode
}

interface SegmentedProps<T extends string | number> {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

/**
 * A calm, accessible segmented control used across Settings and forms. The
 * selected option is marked by a soft sage pill that glides between slots,
 * rather than a hard-filled button, so the control reads as one surface with a
 * moving highlight.
 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-0.5 rounded-calm-sm bg-mint-100/70 p-1 dark:bg-mint-900/40"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="relative flex-1 rounded-[0.6rem] px-2.5 py-1.5 text-sm font-medium transition-colors duration-calm ease-calm"
          >
            {selected && (
              <motion.span
                layoutId={`segmented-${ariaLabel}`}
                className="absolute inset-0 rounded-[0.6rem] bg-raised shadow-calm"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span
              className={`relative z-10 ${
                selected ? 'font-semibold text-sage-700 dark:text-sage-200' : 'text-muted'
              }`}
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
