import type { ButtonHTMLAttributes, ComponentType } from 'react'

/** Any icon component that takes a className — Lucide icons and the custom
 *  FrozenFlame glyph alike. */
type IconComponent = ComponentType<{ className?: string }>

type Tone = 'neutral' | 'quiet' | 'primary' | 'frost' | 'danger'
type Size = 'sm' | 'md'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent
  /** Required: an icon-only control must describe itself. */
  label: string
  tone?: Tone
  size?: Size
  /** Renders a small count badge in the corner (e.g. freeze tokens left). */
  badge?: number | string
}

const TONE: Record<Tone, string> = {
  neutral: 'silicone',
  quiet: 'silicone-quiet',
  primary: 'silicone-primary',
  frost: 'silicone-frost',
  danger: 'silicone-peach',
}

const SIZE: Record<Size, string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
}

const ICON_SIZE: Record<Size, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
}

/**
 * The shared round icon button. Every icon-only control in the app routes
 * through here, so touch targets, tones and hover behaviour stay identical.
 */
export function IconButton({
  icon: Icon,
  label,
  tone = 'neutral',
  size = 'md',
  badge,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${TONE[tone]} relative flex shrink-0 items-center justify-center rounded-full ${SIZE[size]} ${className}`}
      {...rest}
    >
      <Icon className={ICON_SIZE[size]} aria-hidden />
      {badge !== undefined && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full
                     border border-white/70 bg-white px-1 text-[10px] font-bold tabular-nums text-frost-700
                     dark:border-frost-900 dark:bg-frost-900 dark:text-frost-100"
          aria-hidden
        >
          {badge}
        </span>
      )}
    </button>
  )
}
