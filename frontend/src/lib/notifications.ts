import { Capacitor } from '@capacitor/core'
import {
  LocalNotifications,
  type ActionPerformed,
  type LocalNotificationSchema,
} from '@capacitor/local-notifications'
import type { Habit, Settings, Todo } from '../types'
import { reminderBody, reminderClock } from './reminder'
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
function occurrenceId(habitId: number, dayOffset: number): number {
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
): ReminderOccurrence[] {
  const offset = habit.reminderOffset
  if (offset == null) return []

  const { hour, minute } = parseHM(reminderClock(habit.deadline, offset))
  const weekdays =
    habit.schedule.type === 'weekdays' && habit.schedule.days.length
      ? new Set(habit.schedule.days)
      : null

  const occurrences: ReminderOccurrence[] = []
  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const at = new Date(now)
    at.setDate(at.getDate() + dayOffset)
    at.setHours(hour, minute, 0, 0)
    if (at.getTime() <= now.getTime()) continue
    if (weekdays && !weekdays.has(at.getDay())) continue
    occurrences.push({ at, dayOffset })
  }
  return occurrences
}

/**
 * One-shot reminders for the next few days. Returns [] when reminders are off
 * or the habit has no reminder. Weekday habits only get their selected days;
 * all other schedules (daily, flexible weekly) nudge every day.
 */
function reminderJobs(
  habit: Habit,
  settings: Settings,
  channelId: string,
  now: Date,
): LocalNotificationSchema[] {
  if (!settings.notificationsEnabled || habit.archived) return []

  const base = {
    title: 'Bloom',
    body: reminderBody(habit),
    channelId,
    smallIcon: 'ic_stat_bloom',
    // Android 8+ takes the sound from the channel (set by the BloomSound
    // plugin, so it can be any ringtone). Pre-8 devices use this bundled chime.
    ...(settings.reminderSound === 'bloom_chime' ? { sound: 'bloom_chime' } : {}),
    autoCancel: true,
    actionTypeId: ACTION_TYPE_ID,
    extra: { bloomKind: 'habit', bloomId: habit.id },
  }

  return reminderOccurrences(habit, now).map(({ at, dayOffset }) => ({
    ...base,
    id: occurrenceId(habit.id, dayOffset),
    // RTC_WAKEUP + allow-while-idle, so Doze can't swallow the nudge.
    schedule: { at, allowWhileIdle: true },
  }))
}

function scheduleWeb(habit: Habit, time: string): void {
  const at = nextOccurrence(time)
  const delay = Math.min(at.getTime() - Date.now(), 2_147_000_000)
  const timer = setTimeout(() => {
    const today = new Date().getDay()
    const scheduledToday = habit.schedule.type !== 'weekdays' || habit.schedule.days.includes(today)
    if (
      scheduledToday &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification('Bloom', {
          body: reminderBody(habit),
          tag: `bloom-habit-${habit.id}`,
        })
      } catch {
        /* ignore */
      }
    }
    // Re-arm for the next day.
    scheduleWeb(habit, time)
  }, delay)
  webTimers.set(habit.id, timer)
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
    const notifications = habits.flatMap((habit) => reminderJobs(habit, settings, channelId, now))
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
  for (const habit of habits) {
    if (habit.archived) continue
    const offset = habit.reminderOffset
    if (offset == null) continue
    scheduleWeb(habit, reminderClock(habit.deadline, offset))
  }
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
  const alreadyNudged = await nudgeStore.list()
  const overdueKeys: string[] = []

  for (const todo of todos) {
    if (todo.done || todo.archived) continue

    const at = taskReminderAt(todo, now)
    if (at) {
      const delay = Math.min(at.getTime() - now.getTime(), 2_147_000_000)
      const timer = setTimeout(() => {
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
  const notifications: LocalNotificationSchema[] = []
  const overdueKeys: string[] = []
  const alreadyNudged = await nudgeStore.list()
  /** Overdue nudges that should survive this sync (already sent or queued). */
  const keepOverdue = new Set<number>()

  for (const todo of todos) {
    const at = taskReminderAt(todo, now)
    if (at) {
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
    const key = taskOverdueKey(todo)
    if (!key) continue
    if (alreadyNudged.has(key)) {
      // This occurrence has been nudged; leave any queued copy in place so a
      // quick re-sync can't cancel it a moment before it's delivered.
      keepOverdue.add(overdueNudgeId(todo.id))
      continue
    }
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
      schedule: { at: new Date(now.getTime() + OVERDUE_NUDGE_DELAY_MS), allowWhileIdle: true },
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
