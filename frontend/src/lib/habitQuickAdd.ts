import type { DayPeriod, HabitSchedule } from '../types'
import { periodFromTime } from './dayPeriod'

/**
 * Turn a short sentence into a habit. The habit counterpart of `parseQuickAdd`:
 * it claims only the parts it is sure about and leaves the rest as the name, so
 * "meditate every morning" becomes the habit "meditate", due every morning.
 *
 * Understood (all case-insensitive):
 *   schedule   every day / daily, weekdays / every weekday,
 *              weekends / every weekend, every mon/wed/fri (or full names),
 *              N times a week / N x a week / N times per week
 *   period     morning, afternoon, evening, anytime — optionally preceded by
 *              "in the" or "every"
 *
 * When no schedule is given the habit is daily; when no period is given it
 * follows the clock via `periodFromTime`.
 */

/** Weekday spellings (abbreviated and full) → 0 = Sunday … 6 = Saturday. */
const WEEKDAYS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

/** One weekday token, in the same order as the `WEEKDAYS` keys. */
const WEEKDAY_TOKEN =
  'sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?'

/** "every mon, wed and fri" / "every monday/wednesday" — a list of weekdays. */
const NAMED_WEEKDAYS = new RegExp(
  `\\s(?:every|each)\\s+((?:${WEEKDAY_TOKEN})(?:\\s*(?:,|and|&|/)?\\s*(?:${WEEKDAY_TOKEN}))*)\\b`,
  'i',
)

const EVERY_DAY = /\s(?:every\s+day|daily)\b/i
const WEEKDAYS_ONLY = /\s(?:every\s+)?weekdays?\b/i
const WEEKENDS_ONLY = /\s(?:every\s+)?weekends?\b/i
const TIMES_A_WEEK = /\s(\d{1,2})\s*(?:times?|x|×)?\s*(?:a|per|each)\s*week\b/i
const PERIOD = /\s(?:in\s+the\s+|every\s+)?(morning|afternoon|evening|anytime)\b/gi

export interface HabitQuickAddResult {
  name: string
  schedule: HabitSchedule
  timeOfDay: DayPeriod
}

/** Collapse runs of whitespace and drop stray punctuation left by stripping. */
function cleanName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.!/-]+|[\s,;:.!/-]+$/g, '')
    .trim()
}

/** Map the weekday spellings inside a captured list to sorted day numbers. */
function weekdaysFrom(list: string): number[] {
  const found = list.toLowerCase().match(new RegExp(WEEKDAY_TOKEN, 'g')) ?? []
  const days = new Set<number>()
  for (const token of found) {
    const day = WEEKDAYS[token]
    if (day !== undefined) days.add(day)
  }
  return [...days].sort((a, b) => a - b)
}

/**
 * Parse a sentence into a habit name plus its schedule and time of day.
 * Returns null when nothing is left to use as a name. `now` is injectable so
 * the default period is deterministic in tests.
 */
export function parseHabitQuickAdd(text: string, now: Date): HabitQuickAddResult | null {
  // Pad so a keyword at either end still has surrounding whitespace to match.
  let rest = ` ${text} `

  // A "N times a week" target is the most specific, so claim it first.
  let schedule: HabitSchedule = { type: 'daily' }
  rest = rest.replace(TIMES_A_WEEK, (_match, count: string) => {
    const perWeek = Math.min(7, Math.max(1, Number(count)))
    schedule = { type: 'weekly', perWeek }
    return ' '
  })

  // Plain daily — "every day" / "daily".
  rest = rest.replace(EVERY_DAY, () => {
    schedule = { type: 'daily' }
    return ' '
  })

  // A fixed set of weekdays — the named set first, then an explicit list.
  rest = rest.replace(WEEKDAYS_ONLY, () => {
    schedule = { type: 'weekdays', days: [1, 2, 3, 4, 5] }
    return ' '
  })
  rest = rest.replace(WEEKENDS_ONLY, () => {
    schedule = { type: 'weekdays', days: [0, 6] }
    return ' '
  })
  rest = rest.replace(NAMED_WEEKDAYS, (_match, list: string) => {
    const days = weekdaysFrom(list)
    if (days.length > 0) schedule = { type: 'weekdays', days }
    return ' '
  })

  // Period — the last mention wins, and the default follows the clock.
  let timeOfDay: DayPeriod = periodFromTime(now)
  rest = rest.replace(PERIOD, (_match, word: string) => {
    timeOfDay = word.toLowerCase() as DayPeriod
    return ' '
  })

  const name = cleanName(rest)
  if (!name) return null

  return { name, schedule, timeOfDay }
}
