import { useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { Check, Sparkles, X } from 'lucide-react'
import { HABIT_TEMPLATES, type HabitTemplate } from '../lib/templates'
import { scheduleLabel } from '../lib/schedule'
import type { HabitInput } from '../types'

interface TemplatePickerProps {
  onClose: () => void
  onCreate: (templates: HabitTemplate[]) => Promise<void>
}

/**
 * First-run (and always-available) habit templates. Non-blocking: it's a helper
 * sheet, so the normal "Add habit" flow is never hidden behind it.
 */
export function TemplatePicker({ onClose, onCreate }: TemplatePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function add() {
    const chosen = HABIT_TEMPLATES.filter((t) => selected.has(t.name))
    if (!chosen.length) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await onCreate(chosen)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        <div
          className="absolute inset-0 bg-sage-900/30 dark:bg-black/50"
          onClick={onClose}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="templates-title"
          className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-calm bg-raised p-5 shadow-calm-lg sm:rounded-calm sm:p-6"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="templates-title"
                className="flex items-center gap-2 font-display text-lg font-semibold text-ink"
              >
                <Sparkles className="h-5 w-5 text-sage-500 dark:text-sage-300" aria-hidden />
                Start with a template
              </h2>
              <p className="mt-1 text-sm text-muted">
                Pick a few gentle habits — you can edit them later.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close templates"
              className="silicone flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ul className="space-y-2">
            {HABIT_TEMPLATES.map((template) => {
              const on = selected.has(template.name)
              return (
                <li key={template.name}>
                  <button
                    type="button"
                    onClick={() => toggle(template.name)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-calm-sm border px-3 py-3 text-left transition-all duration-calm ease-calm ${
                      on
                        ? 'border-sage-400 bg-mint-100 dark:bg-mint-900/40'
                        : 'border-line bg-surface hover:border-sage-300'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                        on
                          ? 'border-sage-500 bg-sage-500 text-white'
                          : 'border-line text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{template.name}</span>
                      <span className="block text-xs text-muted">{template.blurb}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-muted">
                      {scheduleLabel(template.schedule ?? { type: 'daily' })}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 rounded-b-calm border-t border-line bg-raised px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
            <span className="text-xs text-muted">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={add}
                disabled={saving || selected.size === 0}
                className="silicone-primary rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving
                  ? 'Adding…'
                  : `Add ${selected.size || ''} habit${selected.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  )
}

/** Convenience wrapper so callers can pass plain HabitInput objects. */
export function toHabitInputs(templates: HabitTemplate[]): HabitInput[] {
  // `reminderOffset` is deliberately omitted so new habits inherit the user's
  // default reminder rather than each template dictating its own.
  return templates.map(({ name, colorIndex, deadline, schedule, category, timeOfDay }) => ({
    name,
    colorIndex,
    deadline,
    schedule,
    category,
    timeOfDay,
  }))
}
