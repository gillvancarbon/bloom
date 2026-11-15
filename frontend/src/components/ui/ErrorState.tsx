import { AlertCircle } from 'lucide-react'
import { Button } from './Button'

interface ErrorStateProps {
  title: string
  detail?: string
  onRetry: () => void
}

/**
 * The shared failure state. A quiet peach rule and a plain explanation rather
 * than a bright alert box — the aim is to be honest and recoverable, not loud.
 */
export function ErrorState({ title, detail, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="border-l-2 border-peach-400 py-1 pl-3.5 text-sm">
      <p className="flex items-center gap-1.5 font-display font-semibold text-ink">
        <AlertCircle className="h-4 w-4 shrink-0 text-peach-500" aria-hidden />
        {title}
      </p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
