import { useRef, useState } from 'react'
import { Wand2 } from 'lucide-react'
import { parseHabitQuickAdd } from '../lib/habitQuickAdd'
import { PERIOD_LABELS } from '../lib/dayPeriod'
import { scheduleLabel } from '../lib/schedule'
import type { HabitInput } from '../types'

interface HabitQuickAddBarProps {
  now: Date
  /** Add the parsed habit. Errors are surfaced inline under the bar. */
  onCreate: (input: HabitInput) => Promise<void> | void
  /** When false, the live preview of the parsed habit stays hidden. */
  guidance?: boolean
}

/**
 * The sentence-based quick-add line for habits: it parses what you type and, when
 * guidance is on, previews the name, schedule and part of the day it understood.
 * A calm counterpart to the To-do list's `QuickAddBar`.
 */
export function HabitQuickAddBar({ now, onCreate, guidance = true }: HabitQuickAddBarProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const preview = text.trim() ? parseHabitQuickAdd(text, now) : null

  /** Announce a change to assistive tech, clearing first so repeats land. */
  function announce(message: string) {
    setAnnouncement('')
    requestAnimationFrame(() => setAnnouncement(message))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = parseHabitQuickAdd(text, now)
    if (!parsed) {
      setError('Add a name for your habit.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate({
        name: parsed.name,
        colorIndex: 0,
        deadline: '23:59',
        schedule: parsed.schedule,
        timeOfDay: parsed.timeOfDay,
      })
      setText('')
      announce(`Added “${parsed.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that habit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Wand2
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Try “meditate every morning”"
            maxLength={200}
            aria-label="Quick add a habit"
            aria-describedby="habit-quick-add-status"
            className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-3 text-sm
                       text-ink placeholder:text-muted/70 focus:border-sage-400 focus:outline-none
                       focus:ring-2 focus:ring-sage-400/30"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="silicone-primary shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold
                     disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Screen readers get the same summary sighted users see in the preview. */}
      <p id="habit-quick-add-status" role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? (
        <p className="mt-1.5 text-xs text-peach-600 dark:text-peach-300">{error}</p>
      ) : (
        guidance &&
        preview && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
              {preview.name}
            </span>
            <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
              {scheduleLabel(preview.schedule)}
            </span>
            <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
              {PERIOD_LABELS[preview.timeOfDay]}
            </span>
          </div>
        )
      )}
    </form>
  )
}
