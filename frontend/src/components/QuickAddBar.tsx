import { useRef, useState } from 'react'
import { Lightbulb, Wand2, X } from 'lucide-react'
import {
  QUICK_ADD_HELP,
  applyQuickSuggestion,
  parseQuickAdd,
  quickAddCommand,
  quickAddRecommendations,
  quickAddSuggestions,
  type QuickSuggestion,
} from '../lib/quickAdd'
import { dueState, recurrenceLabel } from '../lib/todo'
import type { TodoInput } from '../types'

/** A few example sentences for the primer, taken from the guide's last section. */
const QUICK_EXAMPLES =
  QUICK_ADD_HELP.find((section) => section.title === 'Putting it together')?.entries.slice(0, 3) ??
  []

function QuickChip({
  label,
  title,
  suggested = false,
  onClick,
}: {
  label: string
  title?: string
  suggested?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full px-2 py-0.5 font-medium transition-opacity duration-calm hover:opacity-80 ${
        suggested
          ? 'border border-dashed border-sage-500 text-sage-700 dark:border-sage-400 dark:text-sage-200'
          : 'bg-mint-100 text-sage-700 dark:bg-mint-900/50 dark:text-mint-100'
      }`}
    >
      {label}
    </button>
  )
}

/** The inline `/help` reference, opened by typing "/help" in the quick-add line. */
function QuickAddHelpPanel({
  onPick,
  onClose,
}: {
  onPick: (insert: string) => void
  onClose: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Quick add guide"
      className="mt-2 rounded-calm border border-line bg-raised p-3.5 shadow-calm"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Lightbulb className="h-4 w-4 text-sage-500 dark:text-sage-300" aria-hidden />
          Quick add guide
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick add guide"
          className="silicone flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        Write a sentence and Bloom picks out the parts it understands, keeping the rest as the
        title. Tap any example to try it.
      </p>
      <div className="space-y-3">
        {QUICK_ADD_HELP.map((section) => (
          <section key={section.title}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {section.title}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {section.entries.map((entry) => (
                <button
                  key={`${section.title}-${entry.insert}`}
                  type="button"
                  onClick={() => onPick(entry.insert)}
                  className="inline-flex items-baseline gap-1.5 rounded-calm-sm border border-line bg-surface px-2.5 py-1
                             text-left text-xs transition-all duration-calm hover:border-sage-300"
                >
                  <span className="font-semibold text-ink">{entry.insert}</span>
                  <span className="text-muted">{entry.hint}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

interface QuickAddBarProps {
  now: Date
  /** Add the parsed task. Errors are surfaced inline under the bar. */
  onAdd: (input: TodoInput) => Promise<unknown>
  /** When false, the suggestion/recommendation/primer chips stay hidden. */
  guidance?: boolean
}

/**
 * The sentence-based quick-add line: it parses what you type, previews the
 * parts it understood, and (when guidance is on) offers completions and opt-in
 * recommendations. Typing `/help` opens the full reference inline.
 */
export function QuickAddBar({ now, onAdd, guidance = true }: QuickAddBarProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const command = quickAddCommand(text)
  const preview = text.trim() && !command ? parseQuickAdd(text, now) : null
  const suggestions = guidance && !command && text.trim() ? quickAddSuggestions(text) : []
  const recommendations = guidance && preview ? quickAddRecommendations(preview) : []
  const hasPreviewChips = Boolean(
    preview &&
    (preview.dueDate ||
      preview.recurrence !== 'none' ||
      preview.importance !== 'medium' ||
      preview.category !== 'personal'),
  )
  const showPrimer = guidance && focused && !text.trim() && !command

  /** Put text in the quick-add line and keep the caret at the end. */
  function putText(next: string) {
    setText(next)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const end = input.value.length
      input.setSelectionRange(end, end)
    })
  }

  /** Complete the trailing token/phrase, or append the suggestion. */
  function insertSuggestion(insert: string) {
    putText(applyQuickSuggestion(text, insert))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (command) return
    const parsed = parseQuickAdd(text, now)
    if (!parsed) {
      setError('Add a title for your task.')
      return
    }
    const title = parsed.title.trim()
    if (!title) {
      setError('Add a title for your task.')
      return
    }
    if (title.length > 120) {
      setError('Keep the title under 120 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onAdd({ ...parsed, title, note: null, subtasks: [] })
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that task.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mb-2">
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
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Try “call mum tomorrow 6pm” or /help"
            maxLength={200}
            aria-label="Quick add a task"
            aria-describedby="quick-add-guidance"
            className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-3 text-sm
                       text-ink placeholder:text-muted/70 focus:border-sage-400 focus:outline-none
                       focus:ring-2 focus:ring-sage-400/30"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !text.trim() || command !== null}
          className="silicone-primary shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold
                     disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/*
        Screen readers get the same guidance sighted users see. The element is
        always present so the live region can announce updates; `.sr-only`
        keeps it out of the visual layout.
      */}
      <p id="quick-add-guidance" role="status" aria-live="polite" className="sr-only">
        {command === 'help'
          ? 'Quick add guide open.'
          : suggestions.length > 0
            ? `${suggestions.length === 1 ? 'Suggestion' : 'Suggestions'}: ${suggestions
                .map((s) => s.label)
                .join(', ')}.`
            : recommendations.length > 0
              ? `Suggested: ${recommendations.map((s) => s.label).join(', ')}.`
              : ''}
      </p>

      {error ? (
        <p className="mt-1.5 text-xs text-peach-600 dark:text-peach-300">{error}</p>
      ) : command === 'help' ? (
        <QuickAddHelpPanel onPick={putText} onClose={() => putText('')} />
      ) : (
        <>
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">
                {suggestions.length > 1 ? 'Suggestions:' : 'Suggestion:'}
              </span>
              {suggestions.map((suggestion: QuickSuggestion) => (
                <QuickChip
                  key={suggestion.insert}
                  label={suggestion.label}
                  onClick={() => insertSuggestion(suggestion.insert)}
                />
              ))}
            </div>
          )}

          {hasPreviewChips && preview && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {preview.dueDate && (
                <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
                  {dueState(preview.dueDate, preview.dueTime, now).text}
                </span>
              )}
              {recurrenceLabel(preview.recurrence) && (
                <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
                  {recurrenceLabel(preview.recurrence)}
                </span>
              )}
              {preview.importance !== 'medium' && (
                <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium capitalize text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
                  {preview.importance}
                </span>
              )}
              {preview.category !== 'personal' && (
                <span className="rounded-full bg-mint-100 px-2 py-0.5 font-medium capitalize text-sage-700 dark:bg-mint-900/50 dark:text-mint-100">
                  {preview.category}
                </span>
              )}
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 text-muted">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                Suggested:
              </span>
              {recommendations.map((suggestion: QuickSuggestion) => (
                <QuickChip
                  key={suggestion.insert}
                  label={suggestion.label}
                  title="Add to your task"
                  suggested
                  onClick={() => insertSuggestion(suggestion.insert)}
                />
              ))}
            </div>
          )}

          {showPrimer && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>Try a whole sentence:</span>
              {QUICK_EXAMPLES.map((example) => (
                <QuickChip
                  key={example.insert}
                  label={example.insert}
                  title={example.hint}
                  onClick={() => putText(example.insert)}
                />
              ))}
              <button
                type="button"
                onClick={() => putText('/help')}
                className="font-medium text-sage-600 underline-offset-2 hover:underline dark:text-sage-300"
              >
                or type /help
              </button>
            </div>
          )}
        </>
      )}
    </form>
  )
}
