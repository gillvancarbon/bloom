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
 *   repeat     every day / daily, every week / weekly, every month / monthly,
 *              every <weekday> (weekly, anchored to that day)
 *
 * It also drives the guidance layer further down this file: suggestions while
 * you type, opt-in recommendations, and the `/help` reference.
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
  // "every monday" / "each friday" — weekly, anchored to that weekday. Only
  // "every"/"each" is consumed, so the weekday pass below still sets the date.
  rest = rest.replace(
    /\s(?:every|each)\s+(?=(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b)/i,
    () => {
      recurrence = 'weekly'
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

// ---------------------------------------------------------------------------
// Guidance — suggestions while typing, opt-in recommendations, and /help
// ---------------------------------------------------------------------------

export type SuggestionKind = 'date' | 'time' | 'repeat' | 'priority' | 'category' | 'command'

export interface QuickSuggestion {
  /** Chip text, e.g. "tomorrow" or "#work". */
  label: string
  /** Text placed in the input when the chip is tapped. */
  insert: string
  kind: SuggestionKind
}

/** Keep the chip row calm. */
const SUGGESTION_LIMIT = 4

const CATEGORY_LIST: TodoCategory[] = [
  'chores',
  'schoolwork',
  'work',
  'personal',
  'health',
  'errands',
]
const PRIORITY_TOKENS = ['!high', '!medium', '!low']
const DATE_WORDS = ['today', 'tonight', 'tomorrow', 'noon', 'midnight']
const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Recognise a slash command in the quick-add line. */
export function quickAddCommand(text: string): 'help' | null {
  return text.trim().toLowerCase() === '/help' ? 'help' : null
}

/**
 * Completions for whatever the user is partway through typing — the tail of a
 * date word, a `#`/`!` token, a `next …`/`in …`/`every …` phrase, or `/help`.
 * Empty when the trailing token is already complete or unrecognised.
 */
export function quickAddSuggestions(text: string): QuickSuggestion[] {
  if (quickAddCommand(text)) return []
  const cap = (list: QuickSuggestion[]) => list.slice(0, SUGGESTION_LIMIT)

  const every = text.match(/(?:^|\s)(?:every|each)\s+(\w*)$/i)
  if (every) {
    const frag = every[1].toLowerCase()
    return cap(
      ['day', 'week', 'month']
        .filter((unit) => unit.startsWith(frag) && unit !== frag)
        .map((unit): QuickSuggestion => ({
          label: `every ${unit}`,
          insert: `every ${unit}`,
          kind: 'repeat',
        })),
    )
  }

  const next = text.match(/(?:^|\s)next\s+(\w*)$/i)
  if (next) {
    const frag = next[1].toLowerCase()
    return cap(
      WEEKDAY_NAMES.filter((day) => day.startsWith(frag) && day !== frag).map(
        (day): QuickSuggestion => ({
          label: `next ${day}`,
          insert: `next ${day}`,
          kind: 'date',
        }),
      ),
    )
  }

  const relative = text.match(/(?:^|\s)in\s+(\w*)$/i)
  if (relative) {
    const frag = relative[1].toLowerCase()
    return cap(
      ['3 days', '2 weeks']
        .filter((phrase) => phrase.startsWith(frag))
        .map((phrase): QuickSuggestion => ({
          label: `in ${phrase}`,
          insert: `in ${phrase}`,
          kind: 'date',
        })),
    )
  }

  const token = text.match(/(?:^|\s)([^\s]*)$/)?.[1] ?? ''
  if (!token) return []
  const lower = token.toLowerCase()

  if (lower.startsWith('#')) {
    const partial = lower.slice(1)
    return cap(
      CATEGORY_LIST.filter((name) => name.startsWith(partial) && name !== partial).map(
        (name): QuickSuggestion => ({ label: `#${name}`, insert: `#${name}`, kind: 'category' }),
      ),
    )
  }
  if (lower.startsWith('!')) {
    const partial = lower.slice(1)
    return cap(
      PRIORITY_TOKENS.filter((p) => p.slice(1).startsWith(partial) && p.slice(1) !== partial).map(
        (p): QuickSuggestion => ({ label: p, insert: p, kind: 'priority' }),
      ),
    )
  }
  if (lower.startsWith('/')) {
    return '/help'.startsWith(lower) && lower !== '/help'
      ? [{ label: '/help', insert: '/help', kind: 'command' }]
      : []
  }
  if (lower.length < 2) return []

  return cap(
    [...DATE_WORDS, ...WEEKDAY_NAMES]
      .filter((word) => word.startsWith(lower) && word !== lower)
      .map((word): QuickSuggestion => ({ label: word, insert: word, kind: 'date' })),
  )
}

/** Words that hint at a task type, checked against the parsed title. */
const CATEGORY_KEYWORDS: Record<TodoCategory, string[]> = {
  health: [
    'gym',
    'run',
    'walk',
    'workout',
    'exercise',
    'doctor',
    'dentist',
    'meds',
    'medicine',
    'water',
    'sleep',
    'stretch',
    'yoga',
    'swim',
    'vitamin',
  ],
  work: [
    'email',
    'meeting',
    'standup',
    'report',
    'client',
    'invoice',
    'deck',
    'presentation',
    'boss',
    'slack',
    'interview',
    'deadline',
  ],
  schoolwork: [
    'homework',
    'assignment',
    'essay',
    'exam',
    'study',
    'revise',
    'lecture',
    'class',
    'coursework',
  ],
  errands: [
    'buy',
    'groceries',
    'grocery',
    'milk',
    'shop',
    'shopping',
    'bank',
    'post',
    'mail',
    'pharmacy',
    'pickup',
    'deliver',
  ],
  chores: [
    'clean',
    'laundry',
    'dishes',
    'vacuum',
    'tidy',
    'trash',
    'bins',
    'dust',
    'mop',
    'garden',
  ],
  personal: [],
}

const HIGH_PRIORITY_WORDS = ['urgent', 'asap', 'critical', 'important', 'overdue', 'emergency']
const LOW_PRIORITY_WORDS = ['maybe', 'sometime', 'someday', 'eventually', 'whenever']

/**
 * Opt-in hints for parts the sentence suggests but the parser left at their
 * defaults. Each chip inserts its token, so the preview updates and the user
 * learns the syntax. Never guesses when a value is already set.
 */
export function quickAddRecommendations(parsed: QuickAddResult): QuickSuggestion[] {
  const words = new Set(parsed.title.toLowerCase().match(/[a-z]+/g) ?? [])
  const out: QuickSuggestion[] = []

  if (parsed.category === 'personal') {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (category === 'personal') continue
      if (keywords.some((keyword) => words.has(keyword))) {
        out.push({ label: `#${category}`, insert: `#${category}`, kind: 'category' })
        break
      }
    }
  }

  if (parsed.importance === 'medium') {
    if (HIGH_PRIORITY_WORDS.some((word) => words.has(word))) {
      out.push({ label: '!high', insert: '!high', kind: 'priority' })
    } else if (LOW_PRIORITY_WORDS.some((word) => words.has(word))) {
      out.push({ label: '!low', insert: '!low', kind: 'priority' })
    }
  }

  // A time without a day is ambiguous — offer the two most likely days.
  if (parsed.dueTime && !parsed.dueDate) {
    out.push({ label: 'today', insert: 'today', kind: 'date' })
    out.push({ label: 'tomorrow', insert: 'tomorrow', kind: 'date' })
  }

  return out
}

/**
 * Put a suggestion token into the input: complete the trailing token/phrase it
 * was built from, or append it as a new token. Keeps the spacing tidy.
 */
export function applyQuickSuggestion(text: string, insert: string): string {
  const trimmed = text.replace(/\s+$/, '')
  const lowerText = trimmed.toLowerCase()
  const lowerInsert = insert.toLowerCase()

  const max = Math.min(lowerText.length, lowerInsert.length)
  for (let length = max; length > 0; length -= 1) {
    const start = lowerText.length - length
    const suffix = lowerText.slice(start)
    if (!lowerInsert.startsWith(suffix)) continue
    if (start > 0 && !/\s/.test(lowerText[start - 1])) continue
    return trimmed.slice(0, start) + insert
  }

  return trimmed ? `${trimmed} ${insert}` : insert
}

export interface QuickAddHelpEntry {
  /** The text inserted when the example is tapped. */
  insert: string
  /** A short, plain-language note. */
  hint: string
}

export interface QuickAddHelpSection {
  title: string
  entries: QuickAddHelpEntry[]
}

/** The full quick-add reference shown by writing `/help`. */
export const QUICK_ADD_HELP: QuickAddHelpSection[] = [
  {
    title: 'Dates',
    entries: [
      { insert: 'today', hint: 'due today' },
      { insert: 'tonight', hint: 'today at 8pm' },
      { insert: 'tomorrow', hint: 'due tomorrow' },
      { insert: 'friday', hint: 'the coming Friday' },
      { insert: 'next friday', hint: 'Friday of next week' },
      { insert: 'in 3 days', hint: 'three days from now' },
      { insert: 'in 2 weeks', hint: 'a fortnight from now' },
      { insert: '10/11', hint: 'day / month, also 2026-11-10 or 10 nov' },
    ],
  },
  {
    title: 'Times',
    entries: [
      { insert: 'at 5pm', hint: 'five in the evening' },
      { insert: 'at 5:30pm', hint: 'half past five' },
      { insert: '17:30', hint: '24-hour time' },
      { insert: 'noon', hint: 'midday' },
      { insert: 'midnight', hint: 'the start of the day' },
    ],
  },
  {
    title: 'Priority',
    entries: [
      { insert: '!high', hint: 'high priority, also !!!' },
      { insert: '!medium', hint: 'medium priority, also !!' },
      { insert: '!low', hint: 'low priority' },
    ],
  },
  {
    title: 'Type',
    entries: CATEGORY_LIST.map((name) => ({ insert: `#${name}`, hint: name })),
  },
  {
    title: 'Repeat',
    entries: [
      { insert: 'every day', hint: 'repeats daily' },
      { insert: 'every week', hint: 'repeats weekly' },
      { insert: 'every month', hint: 'repeats monthly' },
      { insert: 'every monday', hint: 'repeats every Monday' },
    ],
  },
  {
    title: 'Putting it together',
    entries: [
      { insert: 'call mum tomorrow 6pm', hint: 'title, day and time' },
      { insert: 'file taxes #work !high', hint: 'title, type and priority' },
      { insert: 'water plants every monday', hint: 'repeats weekly' },
      { insert: 'standup at 9:30am', hint: 'add a day too' },
    ],
  },
]
