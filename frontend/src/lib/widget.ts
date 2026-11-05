import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Habit, WeekStart } from '../types'
import { isCompleteForPeriod, scheduledOrCompletedToday } from './schedule'
import { PERIOD_LABELS, periodFromTime } from './dayPeriod'

/**
 * Home-screen widget bridge.
 *
 * The widget itself is a thin native renderer; the web layer owns the logic and
 * pushes a small snapshot ({ period, done, total, items }) whenever the habits
 * change. On the web this is a no-op.
 */

interface BloomWidgetPlugin {
  setSnapshot(options: { snapshot: string }): Promise<void>
}

const BloomWidget = registerPlugin<BloomWidgetPlugin>('BloomWidget')

export interface WidgetSnapshot {
  updatedAt: string
  /** The part of the day it is now, e.g. "Morning". */
  period: string
  done: number
  total: number
  items: Array<{ name: string; done: boolean }>
}

/** The number of habit rows the widget can show. */
const WIDGET_ROWS = 3

/** A snapshot of today's habits — what's left and what's done. */
export function buildSnapshot(habits: Habit[], now: Date, weekStart: WeekStart): WidgetSnapshot {
  const today = habits.filter(
    (habit) => !habit.archived && scheduledOrCompletedToday(habit, now, weekStart),
  )
  const items = today.slice(0, WIDGET_ROWS).map((habit) => ({
    name: habit.name,
    done: isCompleteForPeriod(habit, now, weekStart),
  }))
  return {
    updatedAt: now.toISOString(),
    period: PERIOD_LABELS[periodFromTime(now)],
    done: today.filter((habit) => isCompleteForPeriod(habit, now, weekStart)).length,
    total: today.length,
    items,
  }
}

/** True when a home-screen widget can actually be updated on this device. */
export function widgetSupported(): boolean {
  return Capacitor.getPlatform() === 'android'
}

export async function syncWidget(habits: Habit[], now: Date, weekStart: WeekStart): Promise<void> {
  if (!widgetSupported()) return
  try {
    const snapshot = JSON.stringify(buildSnapshot(habits, now, weekStart))
    await BloomWidget.setSnapshot({ snapshot })
  } catch {
    /* widget not placed, or plugin unavailable — nothing to do */
  }
}
