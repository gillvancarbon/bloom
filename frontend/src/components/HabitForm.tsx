import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Portal } from './Portal'
import { Archive, ArchiveRestore, Bell, Clock, Tag, X } from 'lucide-react'
import type { DayPeriod, Habit, HabitInput, HabitSchedule } from '../types'
import { normalizeSchedule } from '../lib/schedule'
import { DAY_PERIODS, PERIOD_LABELS, periodFromDeadline, periodFromTime } from '../lib/dayPeriod'
import { formatTime, orderedWeekdays, weekdayNames } from '../lib/format'
import { REMINDER_OPTIONS, offsetPhrase, reminderClock } from '../lib/reminder'
import { useSettings } from '../context/SettingsContext'

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

const CATEGORY_SUGGESTIONS = ['General', 'Health', 'Mind', 'Growth', 'Home', 'Work', 'Connection']

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
      return { type: 'weekdays', days: days.length ? days : [1, 2, 3, 4, 5] }
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
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-calm bg-raised p-6 shadow-calm-lg"
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
              className="silicone flex h-9 w-9 items-center justify-center rounded-full text-muted
                         hover:text-ink dark:hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <label htmlFor="habit-name" className="mb-2 block text-sm font-medium text-ink">
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
            className="w-full rounded-calm-sm border border-line bg-surface px-4 py-2.5
                       text-ink placeholder:text-muted/70
                       transition-all duration-calm ease-calm
                       focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
          />

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium text-ink">Colour</span>
            <div className="flex gap-2">
              {tones.map((tone, index) => (
                <button
                  key={tone.name}
                  type="button"
                  onClick={() => setColorIndex(index)}
                  aria-label={tone.name}
                  aria-pressed={colorIndex === index}
                  className={`silicone-swatch h-9 w-9 rounded-full ${tone.className} ${
                    colorIndex === index
                      ? 'outline outline-2 outline-offset-2 outline-sage-400'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Repeats */}
          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium text-ink">Repeats</span>
            <div
              role="radiogroup"
              aria-label="Repeats"
              className="flex gap-1 rounded-calm-sm border border-line bg-surface p-1"
            >
              {SCHEDULE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="radio"
                  aria-checked={scheduleType === tab.id}
                  onClick={() => setScheduleType(tab.id)}
                  className={`flex-1 rounded-calm-sm px-2 py-1.5 text-sm font-medium transition-all duration-calm ease-calm ${
                    scheduleType === tab.id
                      ? 'bg-sage-500 text-white shadow-calm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

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
                      className={`h-9 w-9 rounded-full text-xs font-semibold transition-all duration-calm ease-calm ${
                        on
                          ? 'bg-sage-500 text-white shadow-calm'
                          : 'border border-line bg-surface text-muted hover:text-ink'
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
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Fewer times per week"
                    onClick={() => setPerWeek((v) => Math.max(1, v - 1))}
                    className="silicone flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold"
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    className="w-6 text-center font-display text-lg font-semibold text-ink"
                  >
                    {perWeek}
                  </span>
                  <button
                    type="button"
                    aria-label="More times per week"
                    onClick={() => setPerWeek((v) => Math.min(7, v + 1))}
                    className="silicone flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <span className="mb-2 block text-sm font-medium text-ink">Time of day</span>
            <div
              role="radiogroup"
              aria-label="Time of day"
              className="flex gap-1 rounded-calm-sm border border-line bg-surface p-1"
            >
              {DAY_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  role="radio"
                  aria-checked={timeOfDay === period}
                  onClick={() => setTimeOfDay(period)}
                  className={`flex-1 rounded-calm-sm px-2 py-1.5 text-sm font-medium transition-all duration-calm ease-calm ${
                    timeOfDay === period
                      ? 'bg-sage-500 text-white shadow-calm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {PERIOD_LABELS[period]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Groups this habit under the matching part of your day.
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="habit-deadline" className="mb-2 block text-sm font-medium text-ink">
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
                className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-4
                           text-ink transition-all duration-calm ease-calm
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              The time you aim to finish by. A countdown on the card warns you as it approaches.
            </p>
            {timeOfDay !== 'anytime' && periodFromDeadline(deadline) !== timeOfDay && (
              <button
                type="button"
                onClick={() => setTimeOfDay(periodFromDeadline(deadline))}
                className="mt-1.5 text-left text-xs font-medium text-sage-600 hover:text-ink dark:text-sage-300"
              >
                This deadline falls in the {PERIOD_LABELS[periodFromDeadline(deadline)]} — tap to
                match.
              </button>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="habit-category" className="mb-2 block text-sm font-medium text-ink">
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
                className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-4
                           text-ink placeholder:text-muted/70 transition-all duration-calm ease-calm
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              />
              <datalist id="habit-category-options">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="habit-reminder" className="mb-2 block text-sm font-medium text-ink">
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
                className="w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-4
                           text-ink transition-all duration-calm ease-calm
                           focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/30"
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value ?? 'none'} value={option.value ?? ''}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-muted">
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

          {error && (
            <p className="mt-4 rounded-calm-sm bg-peach-100 px-3 py-2 text-sm text-peach-700 dark:bg-peach-900/40 dark:text-peach-200">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-2">
            {mode === 'edit' && onArchive ? (
              <button
                type="button"
                onClick={onArchive}
                className="silicone-quiet inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-ink"
              >
                {archived ? (
                  <ArchiveRestore className="h-4 w-4" aria-hidden />
                ) : (
                  <Archive className="h-4 w-4" aria-hidden />
                )}
                {archived ? 'Restore habit' : 'Archive habit'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="silicone-quiet rounded-full px-4 py-2 text-sm font-medium
                           hover:text-ink dark:hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="silicone-primary rounded-full px-5 py-2 text-sm font-semibold
                           disabled:opacity-60"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Create habit' : 'Save changes'}
              </button>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </Portal>
  )
}
