import type { Habit } from '../types'
import { normalizeSchedule } from './schedule'
import { minutesOfDay, nearestReminderPreset, snapReminderOffset } from './reminder'
import { asPeriod, periodFromDeadline } from './dayPeriod'

/** Habit JSON as it may arrive from storage or the API — old or new. */
type RawHabit = Partial<Habit> & {
  id: number
  sortOrder?: number
  /** Removed in favour of `reminderOffset`; kept so old records still load. */
  reminderTime?: string | null
}

/**
 * Resolve a reminder offset, converting the legacy fixed "HH:mm" time into an
 * offset relative to the habit's deadline. An explicit `reminderOffset` (even
 * null) always wins, so a deliberate "no reminder" is never overridden.
 */
function reminderOffsetFrom(raw: RawHabit): number | null {
  if (raw.reminderOffset !== undefined) return snapReminderOffset(raw.reminderOffset)
  const legacy = raw.reminderTime
  if (typeof legacy === 'string' && /^\d{1,2}:\d{2}$/.test(legacy)) {
    const offset = minutesOfDay(raw.deadline || '23:59') - minutesOfDay(legacy)
    return nearestReminderPreset(Math.max(0, offset))
  }
  return null
}

/**
 * Coerce any habit JSON (from the API or device storage, old or new) into a
 * complete, valid Habit. This is the single gate that lets the UI assume every
 * field exists, so older records and both data sources behave identically.
 */
export function normalizeHabit(raw: RawHabit): Habit {
  const history = Array.isArray(raw.history)
    ? [...new Set(raw.history.filter((d) => typeof d === 'string'))].sort()
    : []
  const last = raw.lastCompletedDate ?? null
  if (last && !history.includes(last)) {
    history.push(last)
    history.sort()
  }
  const frozen = Array.isArray(raw.frozen)
    ? [...new Set(raw.frozen.filter((d) => typeof d === 'string'))].sort()
    : []

  return {
    id: raw.id,
    name: raw.name ?? '',
    streakCount: raw.streakCount ?? 0,
    lastCompletedDate: last,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    colorIndex: raw.colorIndex ?? 0,
    deadline: raw.deadline || '23:59',
    history,
    frozen,
    schedule: normalizeSchedule(raw.schedule),
    target: Math.max(1, raw.target ?? 1),
    category: raw.category || 'General',
    timeOfDay: asPeriod(raw.timeOfDay) ?? periodFromDeadline(raw.deadline || '23:59'),
    archived: Boolean(raw.archived),
    order: raw.order ?? raw.sortOrder ?? 0,
    reminderOffset: reminderOffsetFrom(raw),
  }
}
