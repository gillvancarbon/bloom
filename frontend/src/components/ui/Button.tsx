import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from 'react'

/** Any icon component that takes a className — Lucide icons and the custom
 *  FrozenFlame glyph alike. */
type IconComponent = ComponentType<{ className?: string }>

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconComponent
  /** Hide the label below the `sm` breakpoint, keeping the icon. */
  iconOnlyOnMobile?: boolean
}

/**
 * The one labelled button in the app. Three levels of emphasis — primary
 * (sage), secondary (soft surface) and ghost (text only) — so a screen never
 * presents two equally loud actions.
 */
const VARIANT: Record<Variant, string> = {
  primary: 'silicone-primary',
  secondary: 'silicone',
  ghost: 'silicone-quiet',
  danger: 'silicone-peach',
}

const SIZE: Record<Size, string> = {
  sm: 'gap-1 px-3 py-1.5 text-xs',
  md: 'gap-1.5 px-4 py-2 text-sm',
}

const ICON_SIZE: Record<Size, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconOnlyOnMobile = false,
    className = '',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`${VARIANT[variant]} inline-flex items-center justify-center font-semibold ${SIZE[size]} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={`${ICON_SIZE[size]} shrink-0`} aria-hidden />}
      {/* Collapsing the label must not collapse the accessible name: below
          `sm` the text is swapped for a screen-reader-only copy, so an
          icon-only control still describes itself. */}
      {children !== undefined &&
        (iconOnlyOnMobile ? (
          <>
            <span className="hidden sm:inline">{children}</span>
            <span className="sr-only sm:hidden">{children}</span>
          </>
        ) : (
          children
        ))}
    </button>
  )
})
