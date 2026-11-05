import type { ReactNode } from 'react'

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

/** A calm, accessible segmented control used across Settings and forms. */
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
      className="flex gap-1 rounded-calm-sm border border-line bg-surface p-1"
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
            className={`flex-1 rounded-calm-sm px-3 py-1.5 text-sm font-medium transition-all duration-calm ease-calm ${
              selected ? 'bg-sage-500 text-white shadow-calm' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
