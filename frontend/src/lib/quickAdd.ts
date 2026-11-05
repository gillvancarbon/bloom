import type { TodoCategory, TodoImportance, TodoRecurrence } from '../types'
import { toISODate } from './streak'

/**
 * Turn a plain sentence into a task. Deliberately small and predictable:
 * it only claims the parts it is confident about and leaves the rest as the
 * title, so "call mum tomorrow 6pm" becomes the task "call mum", due tomorrow
 * at 18:00.
 *
 * Understood:
 *   dates      today, tonight, tomorrow, mon…sunday, next friday,
 *              in 3 days, in 2 weeks, 2026-11-10, 10/11, 10 nov, nov 10
 *   times      at 5pm, 5:30pm, 17:30, at 9, noon, midnight
 *   priority   !high !medium !low (also !!! and !)
 *   category   #work (any task type)
 *   repeat     every day / daily, every week / weekly, every month / monthly
 */

export interface QuickAddResult {
  title: string
  dueDate: string | null
  dueTime: string | null
  importance: TodoImportance
  category: TodoCategory
  recurrence: TodoRecurrence
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const CATEGORIES = new Set<TodoCategory>([
  'chores',
  'schoolwork',
  'work',
  'personal',
  'health',
  'errands',
])

const PRIORITIES: Record<string, TodoImportance> = {
  '1': 'low',
  low: 'low',
  '2': 'medium',
  medium: 'medium',
  '3': 'high',
  high: 'high',
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Parse a "HH:mm" or 12-hour time. Returns null for an out-of-range value. */
function normalizeTime(hours: number, minutes: number, meridiem?: string): string | null {
  let h = hours
  if (meridiem === 'pm' && h < 12) h += 12
  if (meridiem === 'am' && h === 12) h = 0
  if (h < 0 || h > 23 || minutes < 0 || minutes > 59) return null
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function cleanTitle(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.!-]+|[\s,;:.!-]+$/g, '')
    .trim()
}

/**
 * Parse a sentence. Returns null when there is nothing left to use as a title.
 * `from` is injectable for tests.
 */
export function parseQuickAdd(text: string, from: Date = new Date()): QuickAddResult | null {
  let rest = ` ${text} `

  // Priority — !high / !medium / !low, or !!! / !!
  let importance: TodoImportance = 'medium'
  rest = rest.replace(/\s!{1,3}(low|medium|high)\b/i, (_m, level: string) => {
    importance = PRIORITIES[level.toLowerCase()] ?? 'medium'
    return ' '
  })
  rest = rest.replace(/\s(!{3})(?=\s|$)/, () => {
    importance = 'high'
    return ' '
  })
  rest = rest.replace(/\s(!{2})(?=\s|$)/, () => {
    importance = 'medium'
    return ' '
  })
  rest = rest.replace(/\s(!{1})(?=\s|$)/, () => {
    importance = 'high'
    return ' '
  })

  // Category — #work
  let category: TodoCategory = 'personal'
  rest = rest.replace(/\s#([a-z]+)\b/i, (match, name: string) => {
    const value = name.toLowerCase() as TodoCategory
    if (CATEGORIES.has(value)) {
      category = value
      return ' '
    }
    return match
  })

  // Recurrence — every day / daily, every week / weekly, every month / monthly
  let recurrence: TodoRecurrence = 'none'
  rest = rest.replace(
    /\s(?:every\s+(day|week|month)|(daily|weekly|monthly))\b/i,
    (_m, word: string | undefined, adverb: string | undefined) => {
      const value = (word ?? adverb ?? '').toLowerCase()
      if (value.startsWith('day') || value === 'daily') recurrence = 'daily'
      else if (value.startsWith('week') || value === 'weekly') recurrence = 'weekly'
      else if (value.startsWith('month') || value === 'monthly') recurrence = 'monthly'
      return ' '
    },
  )

  // Time — "at 5pm", "5:30pm", "17:30", "at 9", "noon", "midnight"
  let dueTime: string | null = null
  rest = rest.replace(/\s(?:at\s+)?noon\b/i, () => {
    dueTime = '12:00'
    return ' '
  })
  rest = rest.replace(/\s(?:at\s+)?midnight\b/i, () => {
    dueTime = '00:00'
    return ' '
  })
  rest = rest.replace(
    /\sat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
    (match, h: string, m: string | undefined, mer: string | undefined) => {
      const parsed = normalizeTime(Number(h), m ? Number(m) : 0, mer?.toLowerCase())
      if (!parsed) return match
      dueTime = parsed
      return ' '
    },
  )
  rest = rest.replace(
    /\s(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
    (match, h: string, m: string, mer: string | undefined) => {
      const parsed = normalizeTime(Number(h), Number(m), mer?.toLowerCase())
      if (!parsed) return match
      dueTime = parsed
      return ' '
    },
  )
  rest = rest.replace(/\s(\d{1,2})\s*(am|pm)\b/i, (match, h: string, mer: string) => {
    const parsed = normalizeTime(Number(h), 0, mer.toLowerCase())
    if (!parsed) return match
    dueTime = parsed
    return ' '
  })

  // Date — absolute forms first, then relative words.
  const today = startOfDay(from)
  let dueDate: string | null = null

  rest = rest.replace(/\s(\d{4})-(\d{2})-(\d{2})\b/, (match, y: string, mo: string, d: string) => {
    const date = new Date(Number(y), Number(mo) - 1, Number(d))
    if (Number.isNaN(date.getTime())) return match
    dueDate = toISODate(date)
    return ' '
  })
  rest = rest.replace(
    /\sin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i,
    (match, n: string, unit: string) => {
      const amount = Number(n)
      if (!Number.isFinite(amount)) return match
      dueDate = toISODate(addDays(today, unit.startsWith('week') ? amount * 7 : amount))
      return ' '
    },
  )
  rest = rest.replace(
    /\s(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i,
    (match, d: string, name: string) => {
      const month = MONTHS[name.toLowerCase()]
      const date = new Date(today.getFullYear(), month, Number(d))
      if (month === undefined || Number.isNaN(date.getTime())) return match
      dueDate = toISODate(date)
      return ' '
    },
  )
  rest = rest.replace(
    /\s(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})\b/i,
    (match, name: string, d: string) => {
      const month = MONTHS[name.toLowerCase()]
      const date = new Date(today.getFullYear(), month, Number(d))
      if (month === undefined || Number.isNaN(date.getTime())) return match
      dueDate = toISODate(date)
      return ' '
    },
  )
  rest = rest.replace(
    /\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
    (match, d: string, mo: string, y?: string) => {
      const year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : today.getFullYear()
      const date = new Date(year, Number(mo) - 1, Number(d))
      if (Number.isNaN(date.getTime())) return match
      dueDate = toISODate(date)
      return ' '
    },
  )
  rest = rest.replace(/\s\btonight\b/i, () => {
    dueDate = toISODate(today)
    if (!dueTime) dueTime = '20:00'
    return ' '
  })
  rest = rest.replace(/\s\btomorrow\b/i, () => {
    dueDate = toISODate(addDays(today, 1))
    return ' '
  })
  rest = rest.replace(/\s\btoday\b/i, () => {
    dueDate = toISODate(today)
    return ' '
  })
  rest = rest.replace(
    /\snext\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i,
    (match, name: string) => {
      const target = WEEKDAYS[name.toLowerCase()]
      if (target === undefined) return match
      const ahead = ((target - today.getDay() + 7) % 7) + 7
      dueDate = toISODate(addDays(today, ahead))
      return ' '
    },
  )
  rest = rest.replace(
    /\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i,
    (match, name: string) => {
      const target = WEEKDAYS[name.toLowerCase()]
      if (target === undefined) return match
      const ahead = (target - today.getDay() + 7) % 7
      dueDate = toISODate(addDays(today, ahead))
      return ' '
    },
  )

  // A repeating task needs an anchor date; start it today when none was given.
  if (recurrence !== 'none' && !dueDate) dueDate = toISODate(today)

  const title = cleanTitle(rest)
  if (!title) return null

  return { title, dueDate, dueTime, importance, category, recurrence }
}
