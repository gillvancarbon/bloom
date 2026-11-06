/**
 * How often a habit is meant to be done.
 *   daily     — every day (the original behaviour)
 *   weekdays  — only on the chosen weekdays (0 = Sunday … 6 = Saturday)
 *   weekly    — a flexible "N times per week" target
 */
export type HabitSchedule =
  { type: 'daily' } | { type: 'weekdays'; days: number[] } | { type: 'weekly'; perWeek: number }

/**
 * The part of the day a habit belongs to. Chosen explicitly by the user, with
 * older records falling back to their deadline. "Anytime" is for habits that
 * don't naturally sit in one part of the day.
 */
export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'anytime'

/** How the habit list inside a period is ordered. */
export type HabitSort = 'incomplete' | 'manual' | 'deadline' | 'name'

/** How the to-do list is ordered inside the chosen view. */
export type TodoSort = 'due' | 'importance' | 'name' | 'created'

export interface Habit {
  id: number
  name: string
  streakCount: number
  lastCompletedDate: string | null
  createdAt: string
  colorIndex: number
  /** Daily deadline as "HH:mm" — the time you aim to finish by. Defaults to 23:59. */
  deadline: string
  /** Every day this habit was completed, as "YYYY-MM-DD" — powers the calendar. */
  history: string[]
  /**
   * Days protected by a streak freeze, as "YYYY-MM-DD". A frozen day keeps the
   * streak alive even though the habit wasn't completed, so a busy day doesn't
   * wipe out weeks of work.
   */
  frozen: string[]
  /** When the habit repeats. Defaults to every day. */
  schedule: HabitSchedule
  /** How many times per day counts as complete (e.g. glasses of water). Defaults to 1. */
  target: number
  /** A soft label such as "Health" or "Mind". */
  category: string
  /** Which part of the day this habit belongs to. */
  timeOfDay: DayPeriod
  /** Archived habits keep their history but leave the daily list. */
  archived: boolean
  /** Manual sort position (lower comes first). */
  order: number
  /**
   * Minutes before the deadline to remind, or null for no reminder. Storing an
   * offset (rather than a fixed clock time) keeps the nudge anchored to the
   * deadline when it changes — "1 hour before" stays 1 hour before.
   */
  reminderOffset: number | null
}

export interface HabitInput {
  name: string
  colorIndex: number
  deadline: string
  schedule?: HabitSchedule
  target?: number
  category?: string
  timeOfDay?: DayPeriod
  reminderOffset?: number | null
}

export type TodoCategory = 'chores' | 'schoolwork' | 'work' | 'personal' | 'health' | 'errands'

/** How much a task matters — shapes ordering and the small badge on the card. */
export type TodoImportance = 'low' | 'medium' | 'high'

/**
 * How a task repeats. Completing a repeating task rolls it forward to its next
 * occurrence instead of leaving it done, so a recurring chore never piles up.
 */
export type TodoRecurrence = 'none' | 'daily' | 'weekly' | 'monthly'

/** One step inside a task's checklist. */
export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Todo {
  id: number
  title: string
  note: string | null
  category: TodoCategory
  done: boolean
  /** Optional due date as "YYYY-MM-DD". */
  dueDate: string | null
  /** Optional exact overdue time as "HH:mm" on the due date. */
  dueTime: string | null
  /** How much this task matters. Defaults to 'medium'. */
  importance: TodoImportance
  /** How this task repeats. Defaults to 'none'. */
  recurrence: TodoRecurrence
  /** An optional checklist. Completing every step doesn't complete the task. */
  subtasks: Subtask[]
  /** Archived tasks keep their details but leave the board. */
  archived: boolean
  createdAt: string
  completedAt: string | null
}

export interface TodoInput {
  title: string
  note: string | null
  category: TodoCategory
  dueDate: string | null
  dueTime: string | null
  importance: TodoImportance
  recurrence: TodoRecurrence
  subtasks: Subtask[]
}

export type TimeFormat = '12' | '24'
export type WeekStart = 0 | 1

/**
 * A reminder/notification sound.
 *  - `bloom_chime` → the bundled gentle chime (default)
 *  - `default`     → the phone's default notification sound
 *  - `none`        → silent
 *  - anything else → a device notification ringtone URI
 */
export type SoundChoice = string

/** The completion ding plays the same sound as reminders unless overridden. */
export type CompletionSound = 'same' | 'none' | SoundChoice

/** User preferences, persisted on the device. */
export interface Settings {
  schemaVersion: number
  notificationsEnabled: boolean
  /** Also nudge tasks at their due date/time, not just habits. */
  taskReminders: boolean
  /** Minutes before a new habit's deadline to remind, or null for none. */
  defaultReminderOffset: number | null
  /** Sound used for reminder notifications. */
  reminderSound: SoundChoice
  /** Sound used for the in-app completion ding. */
  completionSound: CompletionSound
  /** 0 = Sunday, 1 = Monday. */
  weekStart: WeekStart
  timeFormat: TimeFormat
  /** How habits are ordered inside the chosen time of day. */
  habitSort: HabitSort
  /** How tasks are ordered inside the chosen to-do view. */
  todoSort: TodoSort
  /** Hide completed habits from the day's list. */
  hideCompleted: boolean
  /** Follow the clock: switch the visible period as the day advances. */
  followClock: boolean
  /** Streak freezes left to spend; refilled to a weekly allowance. */
  freezeTokens: number
  /** The week (its start date) the freezes were last refilled for. */
  lastFreezeWeek: string | null
  /** True once the first-run onboarding has been completed or skipped. */
  onboarded: boolean
  /** When a new user accepted the Terms of Use, or null if not yet accepted. */
  termsAcceptedAt: string | null
  autoBackupEnabled: boolean
  lastBackupAt: string | null
}
