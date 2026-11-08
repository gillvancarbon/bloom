import { Capacitor } from '@capacitor/core'
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications'
import type { Habit, Settings, Todo, WeekStart } from '../types'
import { inQuietHours } from './notificationPlan'
import { quietWindow, reminderBody, reminderClock } from './reminder'
import { completionsThisWeek, normalizeSchedule } from './schedule'
import {
  OVERDUE_NUDGE_DELAY_MS,
  taskOverdue,
  taskOverdueBody,
  taskOverdueKey,
  taskReminderAt,
  taskReminderBody,
} from './taskReminders'
import { getReminderChannelId } from './sound'
import { localStore } from '../data/localStore'
import { localTodoStore } from '../data/localTodoStore'
import { nudgeStore } from '../data/nudgeStore'
import { settingsStore } from '../data/settingsStore'
import { notifyDataChanged } from './dataEvents'
import { showToast } from './toast'

/**
 * Habit reminders.
 *
 * On Android we use local notifications (no server, and deliberately no
 * SCHEDULE_EXACT_ALARM — Play restricts it, and a gentle nudge doesn't need it).
 *
 * Each habit gets a rolling window of one-shot wakeup alarms for the next
 * HORIZON_DAYS days. We avoid the plugin's cron `on` trigger because it
 * self-reschedules with a non-wakeup `setExact`, which Doze can defer
 * indefinitely — the usual "reminders only arrive when I open the app" symptom.
 * One-shot `at` alarms use `RTC_WAKEUP` + `allowWhileIdle` instead, so they fire
 * in the background, and the OS batches inexact alarms to stay battery-friendly.
 * The window is rebuilt whenever habits/settings change or the app opens.
 *
 * On the web we fall back to the browser Notification API while the tab is
 * open — browsers cannot deliver scheduled notifications from a closed tab.
 */

/**
 * The notification channel (sound) is owned by the native
 * `BloomSound` plugin, because the stock LocalNotifications plugin can only set
 * a channel sound from a bundled `res/raw` file — not a device ringtone. The
 * channel id is derived from the chosen sound and rebuilt when it changes.
 */
/** Habit notification ids live in [HABIT_BASE_ID, HABIT_MAX_ID]. */
const HABIT_BASE_ID = 1000
const HABIT_MAX_ID = 9_000_000
/**
 * Digest notifications share a band inside the habit range so the same
 * range-based cancel clears them. A digest id is
 *
 *   DIGEST_BASE_ID + dayOffset * 24 + hourOfDay
 *
 * which spans 0-191 for the 8-day window, so ids are deterministic, stay unique
 * within a window, and sit far above any real habit id (ordinary habit ids are
 * `HABIT_BASE_ID + habitId * 100 + dayOffset`).
 */
const DIGEST_BASE_ID = 8_500_000
/** Task notification ids live in a separate range so the two never collide. */
const TODO_BASE_ID = 10_000_000
const TODO_MAX_ID = 20_000_000
/** Overdue nudges sit in their own slice so they can't clash with due-time ones. */
const TODO_OVERDUE_OFFSET = 1_000_000
/** Days of one-shot alarms kept armed ahead of time (a full week, plus today). */
const HORIZON_DAYS = 8
/** The Android action set (Complete / Snooze) shared by every reminder. */
const ACTION_TYPE_ID = 'BLOOM_REMINDER'
/** A one-off notification used by Settings → "Send a test". */
const TEST_NOTIFICATION_ID = 999_999_999

const webTimers = new Map<number, ReturnType<typeof setTimeout>>()
const webTaskTimers = new Map<number, ReturnType<typeof setTimeout>>()

export function notificationsNative(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Foreground state used to hold back a nudge while the user already has Bloom
 * open. An app-state signal (the Capacitor App plugin) is honoured only on
 * native, and only when something has wired it in; otherwise we fall back to
 * the document's visibility, which covers the web build.
 */
export function isForeground(signals: {
  native: boolean
  visibilityState?: string
  appState?: { isActive: boolean } | null
}): boolean {
  if (signals.native && signals.appState) return signals.appState.isActive
  return signals.visibilityState === 'visible'
}

/** Live foreground check for the JS delivery paths Bloom owns. */
function foregrounded(): boolean {
  return isForeground({
    native: notificationsNative(),
    visibilityState: typeof document === 'undefined' ? undefined : document.visibilityState,
    appState: null,
  })
}

/** True when a reminder at `at` must be held back by the quiet-hours setting. */
export function isQuietAt(at: Date, settings: Settings): boolean {
  return inQuietHours(at, quietWindow(settings))
}

/**
 * Whether the single overdue follow-up may be queued. It is skipped entirely
 * when the user has switched overdue nudges off, and held back when its
 * near-immediate delivery moment falls inside quiet hours.
 */
export function overdueNudgeAllowed(
  at: Date,
  settings: Pick<Settings, 'overdueNudges'>,
  quiet: { start: string; end: string } | null,
): boolean {
  return settings.overdueNudges && !inQuietHours(at, quiet)
}

/**
 * The last day the rolling one-shot window reaches. Shown in Settings so a
 * user can see reminders are actually armed beyond "right now".
 */
export function reminderHorizonDate(now: Date = new Date()): Date {
  const last = new Date(now)
  last.setDate(last.getDate() + HORIZON_DAYS - 1)
  return last
}

/**
 * Fire a notification a few seconds from now so the user can confirm that
 * reminders reach the device. Returns false when permission isn't granted.
 */
export async function sendTestNotification(): Promise<boolean> {
  const settings = await settingsStore.read()
  if (notificationsNative()) {
    try {
      const status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') return false
      const channelId = await getReminderChannelId(settings.reminderSound)
      // Replace any earlier test still waiting.
      await LocalNotifications.cancel({
        notifications: [{ id: TEST_NOTIFICATION_ID }],
      }).catch(() => undefined)
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_NOTIFICATION_ID,
            title: 'Bloom',
            body: 'This is a test reminder — everything is working.',
            channelId,
            smallIcon: 'ic_stat_bloom',
            ...(settings.reminderSound === 'bloom_chime' ? { sound: 'bloom_chime' } : {}),
            autoCancel: true,
            schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          },
        ],
      })
      return true
    } catch {
      return false
    }
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    new Notification('Bloom', {
      body: 'This is a test reminder — everything is working.',
      tag: 'bloom-test',
    })
    return true
  } catch {
    return false
  }
}

function parseHM(hhmm: string): { hour: number; minute: number } {
  const [h, m] = (hhmm || '').split(':').map(Number)
  return {
    hour: Number.isFinite(h) ? h : 20,
    minute: Number.isFinite(m) ? m : 0,
  }
}

/**
 * Stable id for one occurrence. Habit ids are spaced 100 apart so a 7-day
 * window can't overlap the next habit's ids.
 */
export function habitOccurrenceId(habitId: number, dayOffset: number): number {
  return HABIT_BASE_ID + habitId * 100 + dayOffset
}

/** The next time today/tomorrow that lands on hour:minute (web fallback). */
function nextOccurrence(hhmm: string, now = new Date()): Date {
  const { hour, minute } = parseHM(hhmm)
  const at = new Date(now)
  at.setHours(hour, minute, 0, 0)
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1)
  return at
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!notificationsNative()) {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted'
  }
  try {
    const status = await LocalNotifications.checkPermissions()
    return status.display === 'granted'
  } catch {
    return false
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsNative()) {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  }
  try {
    const status = await LocalNotifications.requestPermissions()
    return status.display === 'granted'
  } catch {
    return false
  }
}

/** Cancel every scheduled notification whose id falls in [base, max]. */
async function cancelRange(base: number, max: number): Promise<void> {
  try {
    const pending = await LocalNotifications.getPending()
    const mine = pending.notifications
      .filter((n) => n.id >= base && n.id <= max)
      .map((n) => ({ id: n.id }))
    if (mine.length) await LocalNotifications.cancel({ notifications: mine })
  } catch {
    /* ignore */
  }
}

async function cancelHabitReminders(): Promise<void> {
  if (notificationsNative()) {
    await cancelRange(HABIT_BASE_ID, HABIT_MAX_ID)
    return
  }
  for (const timer of webTimers.values()) clearTimeout(timer)
  webTimers.clear()
}

/** A reminder moment plus how many days from `now` it falls on. */
export interface ReminderOccurrence {
  at: Date
  dayOffset: number
}

/**
 * The reminder moments for a habit over the next `horizonDays` days. Pure and
 * exported so the scheduling maths can be unit-tested without a device.
 */
export function reminderOccurrences(
  habit: Habit,
  now: Date,
  horizonDays = HORIZON_DAYS,
  weekStart: WeekStart = 1,
): ReminderOccurrence[] {
  const offset = habit.reminderOffset
  if (offset == null) return []

  const { hour, minute } = parseHM(reminderClock(habit.deadline, offset))
  const schedule = normalizeSchedule(habit.schedule)
  const weekdays =
    schedule.type === 'weekdays' && schedule.days.length ? new Set(schedule.days) : null

  const occurrences: ReminderOccurrence[] = []
  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const at = new Date(now)
    at.setDate(at.getDate() + dayOffset)
    at.setHours(hour, minute, 0, 0)
    if (at.getTime() <= now.getTime()) continue
    if (weekdays && !weekdays.has(at.getDay())) continue
    // A flexible weekly habit stops nudging once its target is met for the week.
    if (
      schedule.type === 'weekly' &&
      completionsThisWeek(habit, at, weekStart) >= schedule.perWeek
    ) {
      continue
    }
    occurrences.push({ at, dayOffset })
  }
  return occurrences
}

/** A habit reminder moment paired with the habit it belongs to. */
export interface HabitOccurrence {
  habit: Habit
  at: Date
  dayOffset: number
}

/**
 * One planned habit nudge: either an ordinary single-habit reminder or a digest
 * covering every habit that shares a local clock hour.
 */
export interface PlannedHabitNudge {
  id: number
  at: Date
  /** One habit for an ordinary reminder, several for a digest. */
  habits: Habit[]
}

/** The title for a combined digest of `count` habit reminders. */
function digestTitle(count: number): string {
  return `${count} habits due soon`
}

/** A calm body naming up to three of the habits a digest covers. */
function digestBody(names: string[]): string {
  const shown = names.slice(0, 3)
  const extra = names.length - shown.length
  const list =
    extra > 0
      ? `${shown.join(', ')} and ${extra} more`
      : shown.length === 1
        ? shown[0]
        : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
  return `${list} ${names.length === 1 ? 'is' : 'are'} coming up.`
}

/**
 * Collapse habit occurrences that land in the same local clock hour into one
 * digest, borrowing the earliest moment of the hour. A lone occurrence in an
 * hour passes through untouched as an ordinary reminder. Task reminders are
 * never digested.
 *
 * Digest ids come from {@link DIGEST_BASE_ID} (see above), so the range-based
 * cancel still clears them and they cannot collide with per-habit ids.
 */
export function digestHabitOccurrences(occurrences: HabitOccurrence[]): PlannedHabitNudge[] {
  const groups = new Map<string, HabitOccurrence[]>()
  for (const occurrence of occurrences) {
    const { at } = occurrence
    const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}-${at.getHours()}`
    const group = groups.get(key)
    if (group) group.push(occurrence)
    else groups.set(key, [occurrence])
  }

  const nudges: PlannedHabitNudge[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      const [only] = group
      nudges.push({
        id: habitOccurrenceId(only.habit.id, only.dayOffset),
        at: only.at,
        habits: [only.habit],
      })
      continue
    }
    const earliest = group.reduce((a, b) => (a.at.getTime() <= b.at.getTime() ? a : b))
    nudges.push({
      id: DIGEST_BASE_ID + earliest.dayOffset * 24 + earliest.at.getHours(),
      at: earliest.at,
      habits: group.map((occurrence) => occurrence.habit),
    })
  }
  return nudges
}

/** Whole local days from `fromDate` to `toDate`, used for a digest id slot. */
function localDayOffset(fromDate: Date, toDate: Date): number {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime()
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime()
  return Math.round((to - from) / 86_400_000)
}

/**
 * Every habit reminder for the rolling window, as notification jobs. Returns []
 * when reminders are off. Weekday habits only get their selected days; all other
 * schedules (daily, flexible weekly) nudge every day. Moments inside quiet hours
 * are dropped, and — with digest on — reminders sharing a clock hour collapse
 * into one.
 */
function habitNotifications(
  habits: Habit[],
  settings: Settings,
  channelId: string,
  now: Date,
): LocalNotificationSchema[] {
  if (!settings.notificationsEnabled) return []

  const occurrences: HabitOccurrence[] = []
  for (const habit of habits) {
    if (habit.archived) continue
    for (const occurrence of reminderOccurrences(habit, now)) {
      if (isQuietAt(occurrence.at, settings)) continue
      occurrences.push({ habit, at: occurrence.at, dayOffset: occurrence.dayOffset })
    }
  }

  const nudges: PlannedHabitNudge[] = settings.reminderDigest
    ? digestHabitOccurrences(occurrences)
    : occurrences.map((occurrence) => ({
        id: habitOccurrenceId(occurrence.habit.id, occurrence.dayOffset),
        at: occurrence.at,
        habits: [occurrence.habit],
      }))

  // Android 8+ takes the sound from the channel (set by the BloomSound plugin,
  // so it can be any ringtone). Pre-8 devices use this bundled chime.
  const sound = settings.reminderSound === 'bloom_chime' ? { sound: 'bloom_chime' } : {}

  return nudges.map((nudge) => {
    const base = {
      id: nudge.id,
      channelId,
      smallIcon: 'ic_stat_bloom',
      ...sound,
      autoCancel: true,
      // RTC_WAKEUP + allow-while-idle, so Doze can't swallow the nudge.
      schedule: { at: nudge.at, allowWhileIdle: true },
    }

    if (nudge.habits.length === 1) {
      const [habit] = nudge.habits
      return {
        ...base,
        title: 'Bloom',
        body: reminderBody(habit),
        actionTypeId: ACTION_TYPE_ID,
        extra: { bloomKind: 'habit', bloomId: habit.id },
      }
    }

    // A digest covers several habits, so there is no single record to Complete
    // or Snooze — it carries no action set.
    return {
      ...base,
      title: digestTitle(nudge.habits.length),
      body: digestBody(nudge.habits.map((habit) => habit.name)),
      extra: { bloomKind: 'habit' },
    }
  })
}

/** A group of web-fallback habits sharing one timer. */
interface WebHabitGroup {
  /** Timer key: the habit id for a lone reminder, else a digest slot. */
  id: number
  at: Date
  habits: Habit[]
  /** The clock time ("HH:mm") to re-arm the group at. */
  clock: string
}

/** The next occurrence of `clock` that isn't inside quiet hours, or null. */
function nextAudibleOccurrence(clock: string, settings: Settings, now: Date): Date | null {
  const at = nextOccurrence(clock, now)
  if (!isQuietAt(at, settings)) return at
  const tomorrow = new Date(at)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return isQuietAt(tomorrow, settings) ? null : tomorrow
}

/** The habits in a group that are actually scheduled on the current weekday. */
function scheduledOnToday(habits: Habit[], now: Date): Habit[] {
  const day = now.getDay()
  return habits.filter(
    (habit) => habit.schedule.type !== 'weekdays' || habit.schedule.days.includes(day),
  )
}

/** Deliver one web group, unless the app is open or permission is gone. */
function deliverWebGroup(group: WebHabitGroup): void {
  const due = scheduledOnToday(group.habits, new Date())
  if (!due.length) return
  // Don't nudge while the user already has Bloom open.
  if (foregrounded()) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    if (due.length === 1) {
      new Notification('Bloom', {
        body: reminderBody(due[0]),
        tag: `bloom-habit-${due[0].id}`,
      })
    } else {
      new Notification(digestTitle(due.length), {
        body: digestBody(due.map((habit) => habit.name)),
        tag: `bloom-habit-digest-${group.id}`,
      })
    }
  } catch {
    /* ignore */
  }
}

/** Arm a web timer for a group, then re-arm it for the next audible day. */
function scheduleWebGroup(group: WebHabitGroup, settings: Settings): void {
  const delay = Math.min(group.at.getTime() - Date.now(), 2_147_000_000)
  const timer = setTimeout(() => {
    deliverWebGroup(group)
    const next = nextAudibleOccurrence(group.clock, settings, group.at)
    if (next) scheduleWebGroup({ ...group, at: next }, settings)
  }, delay)
  webTimers.set(group.id, timer)
}

/** Plan the web fallback timers, digesting by local hour when asked to. */
function scheduleWebHabits(habits: Habit[], settings: Settings): void {
  const now = new Date()
  const entries: { habit: Habit; at: Date; clock: string }[] = []
  for (const habit of habits) {
    if (habit.archived) continue
    const offset = habit.reminderOffset
    if (offset == null) continue
    const clock = reminderClock(habit.deadline, offset)
    const at = nextAudibleOccurrence(clock, settings, now)
    if (!at) continue
    entries.push({ habit, at, clock })
  }

  if (!settings.reminderDigest) {
    for (const { habit, at, clock } of entries) {
      scheduleWebGroup({ id: habit.id, at, habits: [habit], clock }, settings)
    }
    return
  }

  const grouped = new Map<string, { at: Date; clock: string; habits: Habit[] }>()
  for (const { habit, at, clock } of entries) {
    const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}-${at.getHours()}`
    const existing = grouped.get(key)
    if (existing) {
      existing.habits.push(habit)
      if (at.getTime() < existing.at.getTime()) {
        existing.at = at
        existing.clock = clock
      }
    } else {
      grouped.set(key, { at, clock, habits: [habit] })
    }
  }

  for (const group of grouped.values()) {
    scheduleWebGroup(
      {
        id: DIGEST_BASE_ID + localDayOffset(now, group.at) * 24 + group.at.getHours(),
        at: group.at,
        habits: group.habits,
        clock: group.clock,
      },
      settings,
    )
  }
}

/**
 * Rebuild the schedule so it matches the current habits + settings. Safe to
 * call whenever habits or settings change.
 */
export async function syncHabitReminders(habits: Habit[], settings: Settings): Promise<void> {
  if (notificationsNative()) {
    await cancelHabitReminders()
    if (!settings.notificationsEnabled) return
    const channelId = await getReminderChannelId(settings.reminderSound)
    const now = new Date()
    const notifications = habitNotifications(habits, settings, channelId, now)
    if (!notifications.length) return
    try {
      await LocalNotifications.schedule({ notifications })
    } catch {
      /* device rejected scheduling — keep the app usable */
    }
    return
  }

  // Web fallback: only schedule when the tab is open and permission is granted.
  await cancelHabitReminders()
  if (!settings.notificationsEnabled) return
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  if (!granted) return
  scheduleWebHabits(habits, settings)
}

/**
 * One-shot reminders for open tasks: one at the due moment, and — if that
 * moment passes with the task still open — a single follow-up saying it's
 * overdue. Completed and archived tasks are skipped entirely, so finishing a
 * task (or ticking it from the notification itself) also cancels any that were
 * already queued, because the whole range is rebuilt on every sync. Reuses the
 * same channel and action set as habit reminders. Native only — a browser can't
 * deliver a scheduled notification from a closed tab.
 */
/** The notification id for one task's overdue nudge. */
function overdueNudgeId(todoId: number): number {
  return TODO_BASE_ID + TODO_OVERDUE_OFFSET + todoId
}

/**
 * Browser fallback for task reminders. It only runs while the tab is open —
 * a closed tab can't deliver anything — so future due moments become timers,
 * and a task that is already overdue pops once per due occurrence, remembered
 * in the same ledger the native path uses.
 */
async function syncWebTaskReminders(todos: Todo[], settings: Settings): Promise<void> {
  for (const timer of webTaskTimers.values()) clearTimeout(timer)
  webTaskTimers.clear()
  if (!settings.notificationsEnabled || !settings.taskReminders) return
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

  const now = new Date()
  const quiet = quietWindow(settings)
  const alreadyNudged = await nudgeStore.list()
  const overdueKeys: string[] = []

  for (const todo of todos) {
    if (todo.done || todo.archived) continue

    const at = taskReminderAt(todo, now)
    if (at) {
      // Hold back a reminder that would land inside quiet hours.
      if (isQuietAt(at, settings)) continue
      const delay = Math.min(at.getTime() - now.getTime(), 2_147_000_000)
      const timer = setTimeout(() => {
        if (foregrounded()) return
        try {
          new Notification('Bloom', {
            body: taskReminderBody(todo, settings.timeFormat),
            tag: `bloom-todo-${todo.id}`,
          })
        } catch {
          /* ignore */
        }
      }, delay)
      webTaskTimers.set(todo.id, timer)
      continue
    }

    if (!taskOverdue(todo, now)) continue
    // No follow-up when it is switched off, in quiet hours, or while the app is
    // already open; an unmarked task can still pop once those clear.
    if (!overdueNudgeAllowed(now, settings, quiet)) continue
    if (foregrounded()) continue
    const key = taskOverdueKey(todo)
    if (!key || alreadyNudged.has(key)) continue
    overdueKeys.push(key)
    try {
      new Notification('Bloom', {
        body: taskOverdueBody(todo, settings.timeFormat),
        tag: `bloom-todo-overdue-${todo.id}`,
      })
    } catch {
      /* ignore */
    }
  }

  if (overdueKeys.length) await nudgeStore.mark(overdueKeys)
}

async function runTaskReminderSync(todos: Todo[], settings: Settings): Promise<void> {
  if (!notificationsNative()) {
    await syncWebTaskReminders(todos, settings)
    return
  }

  // Due-time reminders are always rebuilt from scratch.
  const dueMaxId = TODO_BASE_ID + TODO_OVERDUE_OFFSET - 1
  await cancelRange(TODO_BASE_ID, dueMaxId)
  if (!settings.notificationsEnabled || !settings.taskReminders) {
    // Reminders switched off: clear any overdue nudges still waiting too.
    await cancelRange(TODO_BASE_ID + TODO_OVERDUE_OFFSET, TODO_MAX_ID)
    return
  }

  const channelId = await getReminderChannelId(settings.reminderSound)
  const now = new Date()
  const quiet = quietWindow(settings)
  const notifications: LocalNotificationSchema[] = []
  const overdueKeys: string[] = []
  const alreadyNudged = await nudgeStore.list()
  /** Overdue nudges that should survive this sync (already sent or queued). */
  const keepOverdue = new Set<number>()

  for (const todo of todos) {
    const at = taskReminderAt(todo, now)
    if (at) {
      // A due-time reminder landing inside quiet hours is simply not queued.
      if (isQuietAt(at, settings)) continue
      notifications.push({
        id: TODO_BASE_ID + todo.id,
        title: 'Bloom',
        body: taskReminderBody(todo, settings.timeFormat),
        channelId,
        smallIcon: 'ic_stat_bloom',
        ...(settings.reminderSound === 'bloom_chime' ? { sound: 'bloom_chime' } : {}),
        autoCancel: true,
        actionTypeId: ACTION_TYPE_ID,
        extra: { bloomKind: 'todo', bloomId: todo.id },
        schedule: { at, allowWhileIdle: true },
      })
      continue
    }

    // Already due and still open? Nudge once per due occurrence.
    if (!taskOverdue(todo, now)) continue
    // Overdue follow-ups can be switched off entirely; leaving them out of
    // keepOverdue lets the stale sweep below cancel any still queued.
    if (!settings.overdueNudges) continue
    const key = taskOverdueKey(todo)
    if (!key) continue
    if (alreadyNudged.has(key)) {
      // This occurrence has been nudged; leave any queued copy in place so a
      // quick re-sync can't cancel it a moment before it's delivered.
      keepOverdue.add(overdueNudgeId(todo.id))
      continue
    }
    const overdueAt = new Date(now.getTime() + OVERDUE_NUDGE_DELAY_MS)
    // A follow-up that would land inside quiet hours is held back.
    if (!overdueNudgeAllowed(overdueAt, settings, quiet)) continue
    overdueKeys.push(key)
    notifications.push({
      id: overdueNudgeId(todo.id),
      title: 'Bloom',
      body: taskOverdueBody(todo, settings.timeFormat),
      channelId,
      smallIcon: 'ic_stat_bloom',
      ...(settings.reminderSound === 'bloom_chime' ? { sound: 'bloom_chime' } : {}),
      autoCancel: true,
      actionTypeId: ACTION_TYPE_ID,
      extra: { bloomKind: 'todo', bloomId: todo.id },
      schedule: { at: overdueAt, allowWhileIdle: true },
    })
  }

  // Drop overdue nudges that no longer apply: task done, archived or deleted,
  // or its due date moved (which earns a fresh one below).
  try {
    const pending = await LocalNotifications.getPending()
    const stale = pending.notifications
      .filter((n) => n.id > dueMaxId && n.id <= TODO_MAX_ID && !keepOverdue.has(n.id))
      .map((n) => ({ id: n.id }))
    if (stale.length) await LocalNotifications.cancel({ notifications: stale })
  } catch {
    /* ignore */
  }

  if (!notifications.length) return
  try {
    await LocalNotifications.schedule({ notifications })
    // Only remember what we actually managed to queue.
    await nudgeStore.mark(overdueKeys)
  } catch {
    /* device rejected scheduling — keep the app usable */
  }
}

/**
 * Serialise task reminder syncs. The app root and the To-do screen can both ask
 * for a rebuild (and a foreground event can overlap one), so queueing them
 * keeps a cancel/reschedule pair from interleaving with the next.
 */
let taskSyncChain: Promise<void> = Promise.resolve()

export function syncTaskReminders(todos: Todo[], settings: Settings): Promise<void> {
  taskSyncChain = taskSyncChain
    .then(() => runTaskReminderSync(todos, settings))
    .catch(() => undefined)
  return taskSyncChain
}

/** Every snooze choice a reminder offers, from a short breather to tomorrow. */
export type SnoozeChoice = 'snooze_10' | 'snooze_1h' | 'snooze_tomorrow'

const SNOOZE_CHOICES: SnoozeChoice[] = ['snooze_10', 'snooze_1h', 'snooze_tomorrow']

/** True for the current ids and the original single "Snooze 1h" action. */
function isSnooze(actionId: string): actionId is SnoozeChoice | 'snooze' {
  return actionId === 'snooze' || (SNOOZE_CHOICES as string[]).includes(actionId)
}

/**
 * When a snooze should re-fire. Ten minutes and an hour are relative; "tomorrow"
 * lands on 9am the next day so a reminder deferred at night arrives at a
 * sensible hour rather than in the small hours.
 */
export function snoozeAt(choice: SnoozeChoice | 'snooze', now: Date = new Date()): Date {
  const at = new Date(now)
  switch (choice) {
    case 'snooze_10':
      at.setMinutes(at.getMinutes() + 10)
      break
    case 'snooze_tomorrow':
      at.setDate(at.getDate() + 1)
      at.setHours(9, 0, 0, 0)
      break
    case 'snooze_1h':
    case 'snooze':
    default:
      at.setHours(at.getHours() + 1)
      break
  }
  return at
}

/**
 * Register the reminder actions and handle them as they're tapped. Complete
 * writes straight to the on-device store (so it works whether or not a screen
 * is open) and then re-arms the reminder window; a failure is surfaced through
 * the shared toast bus. Snooze re-arms the same notification at the chosen
 * time. Native only.
 */
export async function initReminderActions(): Promise<void> {
  if (!notificationsNative()) return

  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE_ID,
          actions: [
            { id: 'complete', title: 'Complete' },
            { id: 'snooze_10', title: 'Snooze 10 min' },
            { id: 'snooze_1h', title: 'Snooze 1 hour' },
            { id: 'snooze_tomorrow', title: 'Snooze until tomorrow' },
          ],
        },
      ],
    })
  } catch {
    /* device without action support — the reminder itself still works */
  }

  try {
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      void handleReminderAction(event)
    })
  } catch {
    /* ignore */
  }
}

async function handleReminderAction(event: ActionPerformed): Promise<void> {
  const { actionId, notification } = event

  // Snooze: re-arm the very same notification at the chosen time.
  if (isSnooze(actionId)) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          { ...notification, schedule: { at: snoozeAt(actionId), allowWhileIdle: true } },
        ],
      })
    } catch {
      showToast('Couldn’t snooze that reminder. Open Bloom to reschedule it.', 'error')
    }
    return
  }

  if (actionId !== 'complete') return
  const extra = (notification.extra ?? {}) as { bloomKind?: string; bloomId?: number }
  if (typeof extra.bloomId !== 'number') return

  try {
    if (extra.bloomKind === 'habit') {
      await localStore.toggle(extra.bloomId)
      await syncHabitReminders(await localStore.list(), await settingsStore.read())
    } else if (extra.bloomKind === 'todo') {
      await localTodoStore.toggle(extra.bloomId)
      await syncTaskReminders(await localTodoStore.list(), await settingsStore.read())
    }
  } catch {
    // The record may have been deleted, or the store refused the write.
    showToast('Couldn’t update that from the reminder. Open Bloom to try again.', 'error')
  } finally {
    notifyDataChanged()
  }
}
