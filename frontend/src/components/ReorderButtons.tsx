import { ArrowDown, ArrowUp } from 'lucide-react'

interface ReorderButtonsProps {
  /** The item's name, used in the accessible labels ("Move {label} up"). */
  label: string
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** Wrapper layout (a row for habits, a column for tasks). */
  className?: string
  /** Set to "group" when the wrapper should be announced as a labelled group. */
  role?: 'group'
}

const BUTTON_CLASS =
  'silicone flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors duration-calm ease-calm hover:text-ink disabled:opacity-40'

/**
 * The paired up/down controls for manual reordering. Each button only renders
 * when its handler is provided, so callers can offer one direction alone.
 */
export function ReorderButtons({
  label,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  className,
  role,
}: ReorderButtonsProps) {
  return (
    <div className={className} role={role} aria-label={`Reorder ${label}`}>
      {onMoveUp && (
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move ${label} up`}
          className={BUTTON_CLASS}
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      )}
      {onMoveDown && (
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move ${label} down`}
          className={BUTTON_CLASS}
        >
          <ArrowDown className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  )
}
