import type { TimeFormat, WeekStart } from '../types'

/** Format an "HH:mm" time as either 12-hour or 24-hour, per the user's setting. */
export function formatTime(hhmm: string, format: TimeFormat): string {
  const [hRaw, mRaw] = (hhmm || '').split(':').map(Number)
  const h = Number.isFinite(hRaw) ? hRaw : 0
  const m = Number.isFinite(mRaw) ? mRaw : 0
  if (format === '24') {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

/** Weekday indices ordered from the user's chosen first day of the week. */
export function orderedWeekdays(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Full weekday names ordered from the user's chosen first day of the week. */
export function weekdayNames(weekStart: WeekStart): string[] {
  return orderedWeekdays(weekStart).map((i) => WEEKDAY_LABELS[i])
}

/** A compact label for a set of weekday indices, e.g. "Mon, Wed, Fri". */
export function describeWeekdays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  return sorted.map((d) => WEEKDAY_LABELS[d] ?? '?').join(', ')
}
