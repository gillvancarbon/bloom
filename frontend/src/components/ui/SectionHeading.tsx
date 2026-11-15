import type { ReactNode } from 'react'

interface SectionHeadingProps {
  /** The section label, e.g. "Your habits". */
  children: ReactNode
  /** An optional short line under the heading. */
  hint?: ReactNode
  /** Trailing controls (buttons, selectors) aligned to the right. */
  action?: ReactNode
  /** Small uppercase label instead of a full heading — used inside panels. */
  variant?: 'title' | 'label'
  id?: string
}

/**
 * A section heading with an optional trailing action. Replaces the repeated
 * "flex items-center justify-between + h2" pattern so every screen titles its
 * sections the same way.
 */
export function SectionHeading({
  children,
  hint,
  action,
  variant = 'title',
  id,
}: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {variant === 'label' ? (
          <h2 id={id} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            {children}
          </h2>
        ) : (
          <h2 id={id} className="font-display text-base font-semibold tracking-tight text-ink">
            {children}
          </h2>
        )}
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
