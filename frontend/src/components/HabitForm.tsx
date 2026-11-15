import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { Archive, ArchiveRestore, Bell, ChevronDown, Clock, Tag, X } from 'lucide-react'
import type { DayPeriod, Habit, HabitInput, HabitSchedule } from '../types'
import { normalizeSchedule } from '../lib/schedule'
import { DAY_PERIODS, PERIOD_LABELS, periodFromDeadline, periodFromTime } from '../lib/dayPeriod'
import { formatTime, orderedWeekdays, weekdayNames } from '../lib/format'
import { REMINDER_OPTIONS, offsetPhrase, reminderClock } from '../lib/reminder'
import { CATEGORY_SUGGESTIONS } from '../lib/categories'
import { useSettings } from '../context/SettingsContext'
import { Segmented } from './Segmented'
import { Button } from './ui/Button'
import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_INPUT_ICON,
  FIELD_LABEL,
  FIELD_SELECT,
  SELECT_CHEVRON,
} from './ui/Field'

interface HabitFormProps {
  mode: 'create' | 'edit'
  habit?: Habit | null
  /** Period preselected when creating a habit (e.g. the one being viewed). */
  defaultPeriod?: DayPeriod
  /** Whether the habit being edited is currently archived. */
  archived?: boolean
  /** Archive or restore the habit (edit mode only). */
  onArchive?: () => void
  onClose: () => void
  onSubmit: (input: HabitInput) => Promise<void>
}

const tones = [
  { name: 'Sage', className: 'bg-sage-400 dark:bg-sage-500' },
  { name: 'Peach', className: 'bg-peach-400 dark:bg-peach-500' },
  { name: 'Mint', className: 'bg-mint-400 dark:bg-mint-500' },
]

const SCHEDULE_TABS: Array<{ id: HabitSchedule['type']; label: string }> = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Days' },
  { id: 'weekly', label: 'Per week' },
]

export function HabitForm({
  mode,
  habit,
  defaultPeriod,
  archived,
  onArchive,
  onClose,
  onSubmit,
}: HabitFormProps) {
  const { settings } = useSettings()
  const initialSchedule = normalizeSchedule(habit?.schedule)
  const [name, setName] = useState(habit?.name ?? '')
  const [colorIndex, setColorIndex] = useState(habit?.colorIndex ?? 0)
  const [deadline, setDeadline] = useState(habit?.deadline ?? '23:59')
  const [scheduleType, setScheduleType] = useState<HabitSchedule['type']>(initialSchedule.type)
  const [days, setDays] = useState<number[]>(
    initialSchedule.type === 'weekdays' ? initialSchedule.days : [1, 2, 3, 4, 5],
  )
  const [perWeek, setPerWeek] = useState(
    initialSchedule.type === 'weekly' ? initialSchedule.perWeek : 3,
  )
  const [category, setCategory] = useState(habit?.category ?? 'General')
  const [timeOfDay, setTimeOfDay] = useState<DayPeriod>(
    habit?.timeOfDay ?? defaultPeriod ?? periodFromTime(new Date()),
  )
  const [reminderOffset, setReminderOffset] = useState<number | null>(
    mode === 'edit' ? (habit?.reminderOffset ?? null) : settings.defaultReminderOffset,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Creating stays a one-field job; the rest is revealed on demand. Editing
  // opens with everything visible because the values already exist.
  const [showMore, setShowMore] = useState(mode === 'edit')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function buildSchedule(): HabitSchedule {
    if (scheduleType === 'weekdays') {
      return { type: 'weekdays', days }
    }
    if (scheduleType === 'weekly') {
      return { type: 'weekly', perWeek: Math.min(7, Math.max(1, perWeek)) }
    }
    return { type: 'daily' }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give your habit a name.')
      return
    }
    if (trimmed.length > 100) {
      setError('Keep it under 100 characters.')
      return
    }
    if (scheduleType === 'weekdays' && days.length === 0) {
      setError('Choose at least one day.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: trimmed,
        colorIndex,
        deadline: deadline || '23:59',
        schedule: buildSchedule(),
        category: category.trim() || 'General',
        timeOfDay,
        reminderOffset,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  const weekdayOrder = orderedWeekdays(0)
  const names = weekdayNames(0)

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
      >
        <div
          className="absolute inset-0 bg-sage-900/30 dark:bg-black/50"
          onClick={onClose}
          aria-hidden
        />
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-calm-lg bg-raised p-6 shadow-calm-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="habit-form-title"
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 id="habit-form-title" className="font-display text-xl font-semibold text-ink">
                {mode === 'create' ? 'New habit' : 'Edit habit'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {mode === 'create'
                  ? 'Small steps, every day.'
                  : 'Refine the details of this habit.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="silicone -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted
                         hover:text-ink dark:hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <label htmlFor="habit-name" className={FIELD_LABEL}>
            Habit name
          </label>
          <input
            id="habit-name"
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Read for 10 minutes"
            maxLength={100}
            className={FIELD_INPUT}
          />

          {/* Repeats */}
          <div className="mt-4">
            <span className={FIELD_LABEL}>Repeats</span>
            <Segmented
              ariaLabel="Repeats"
              value={scheduleType}
              onChange={setScheduleType}
              options={SCHEDULE_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
            />

            {scheduleType === 'weekdays' && (
              <div className="mt-3 flex justify-between gap-1">
                {weekdayOrder.map((dayIndex, i) => {
                  const on = days.includes(dayIndex)
                  return (
                    <button
                      key={dayIndex}
                      type="button"
                      aria-label={names[i]}
                      aria-pressed={on}
                      onClick={() =>
                        setDays((prev) =>
                          prev.includes(dayIndex)
                            ? prev.filter((d) => d !== dayIndex)
                            : [...prev, dayIndex],
                        )
                      }
                      className={`h-10 w-10 rounded-full text-xs font-semibold transition-colors duration-calm ease-calm ${
                        on
                          ? 'bg-sage-500 text-white shadow-calm'
                          : 'silicone text-muted hover:text-ink'
                      }`}
                    >
                      {names[i].slice(0, 1)}
                    </button>
                  )
                })}
              </div>
            )}

            {scheduleType === 'weekly' && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-muted">Times per week</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Fewer times per week"
                    onClick={() => setPerWeek((v) => Math.max(1, v - 1))}
                    className="silicone flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-ink"
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    className="w-6 text-center font-display text-lg font-semibold tabular-nums text-ink"
                  >
                    {perWeek}
                  </span>
                  <button
                    type="button"
                    aria-label="More times per week"
                    onClick={() => setPerWeek((v) => Math.min(7, v + 1))}
                    className="silicone flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-ink"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <span className={FIELD_LABEL}>Time of day</span>
            <Segmented
              ariaLabel="Time of day"
              value={timeOfDay}
              onChange={setTimeOfDay}
              options={DAY_PERIODS.map((period) => ({
                value: period,
                label: PERIOD_LABELS[period],
              }))}
            />
            <p className={FIELD_HINT}>Groups this habit under the matching part of your day.</p>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-controls="habit-more-options"
              aria-describedby="habit-more-options-help"
              className="silicone flex min-h-[44px] w-full items-center gap-2.5 rounded-calm-sm px-3 py-2 text-left"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted transition-transform duration-calm ease-calm ${
                  showMore ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
              <span className="text-sm font-medium text-ink">
                {showMore ? 'Hide options' : 'More options'}
              </span>
            </button>
            <p id="habit-more-options-help" className={FIELD_HINT}>
              Reminders, category, colour and deadline.
            </p>
          </div>

          {showMore && (
            <div id="habit-more-options">
              <div className="mt-4">
                <span className={FIELD_LABEL}>Colour</span>
                <div className="flex gap-2">
                  {tones.map((tone, index) => (
                    <button
                      key={tone.name}
                      type="button"
                      onClick={() => setColorIndex(index)}
                      aria-label={tone.name}
                      aria-pressed={colorIndex === index}
                      className={`silicone-swatch h-10 w-10 rounded-full ${tone.className} ${
                        colorIndex === index
                          ? 'outline outline-2 outline-offset-2 outline-sage-400'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="habit-deadline" className={FIELD_LABEL}>
                  Daily deadline
                </label>
                <div className="relative">
                  <Clock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden
                  />
                  <input
                    id="habit-deadline"
                    type="time"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`${FIELD_INPUT_ICON} tabular-nums`}
                  />
                </div>
                <p className={FIELD_HINT}>
                  The time you aim to finish by. A countdown on the card warns you as it approaches.
                </p>
                {timeOfDay !== 'anytime' && periodFromDeadline(deadline) !== timeOfDay && (
                  <button
                    type="button"
                    onClick={() => setTimeOfDay(periodFromDeadline(deadline))}
                    className="mt-1.5 text-left text-xs font-medium text-sage-600 hover:text-ink dark:text-sage-300"
                  >
                    This deadline falls in the {PERIOD_LABELS[periodFromDeadline(deadline)]} — tap
                    to match.
                  </button>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="habit-category" className={FIELD_LABEL}>
                  Category
                </label>
                <div className="relative">
                  <Tag
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden
                  />
                  <input
                    id="habit-category"
                    list="habit-category-options"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Health"
                    maxLength={40}
                    className={FIELD_INPUT_ICON}
                  />
                  <datalist id="habit-category-options">
                    {CATEGORY_SUGGESTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="habit-reminder" className={FIELD_LABEL}>
                  Reminder <span className="font-normal text-muted">(optional)</span>
                </label>
                <div className="relative">
                  <Bell
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                    aria-hidden
                  />
                  <select
                    id="habit-reminder"
                    value={reminderOffset === null ? '' : String(reminderOffset)}
                    onChange={(e) =>
                      setReminderOffset(e.target.value === '' ? null : Number(e.target.value))
                    }
                    className={`${FIELD_SELECT} pl-9`}
                    style={SELECT_CHEVRON}
                  >
                    {REMINDER_OPTIONS.map((option) => (
                      <option key={option.value ?? 'none'} value={option.value ?? ''}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={FIELD_HINT}>
                  {!settings.notificationsEnabled
                    ? 'Reminders are off — turn them on in Settings.'
                    : reminderOffset === null
                      ? 'No reminder for this habit.'
                      : reminderOffset === 0
                        ? `A nudge at ${formatTime(
                            reminderClock(deadline, 0),
                            settings.timeFormat,
                          )}, when it's due.`
                        : `A nudge at ${formatTime(
                            reminderClock(deadline, reminderOffset),
                            settings.timeFormat,
                          )}, ${offsetPhrase(reminderOffset)} before the deadline.`}
                </p>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-5 border-l-2 border-peach-400 py-0.5 pl-3 text-sm text-peach-700 dark:text-peach-300"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-line/70 pt-5">
            {mode === 'edit' && onArchive ? (
              <Button
                variant="ghost"
                className="text-muted hover:text-ink"
                icon={archived ? ArchiveRestore : Archive}
                onClick={onArchive}
              >
                {archived ? 'Restore' : 'Archive'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="hover:text-ink" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving…' : mode === 'create' ? 'Create habit' : 'Save changes'}
              </Button>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </Portal>
  )
}
