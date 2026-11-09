import { expect, test, type Page } from '@playwright/test'
import { seedUser } from './helpers'

/**
 * "Follow the clock" coverage.
 *
 * The setting promises the visible period tracks the day. It was unreachable:
 * the habits view opens on the all-day list, and the effect that follows the
 * clock bailed out of any view filtered to "all" — including at the moment the
 * setting was switched on — so turning it on appeared to do nothing.
 */

const HABITS_KEY = 'CapacitorStorage.bloom.habits.v1'

const PERIODS = ['morning', 'afternoon', 'evening'] as const
type Period = (typeof PERIODS)[number]

const LABELS: Record<Period, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

/** One habit per period, so the chips show and each section is identifiable. */
const NAMES: Record<Period, string> = {
  morning: 'Morning swim',
  afternoon: 'Afternoon review',
  evening: 'Evening tidy',
}

function habit(id: number, timeOfDay: Period, name: string) {
  return {
    id,
    name,
    streakCount: 0,
    lastCompletedDate: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    colorIndex: id - 1,
    deadline: '23:59',
    history: [],
    frozen: [],
    schedule: { type: 'daily' },
    target: 1,
    category: 'Health',
    timeOfDay,
    archived: false,
    order: id - 1,
    reminderOffset: null,
  }
}

const HABITS = PERIODS.map((period, index) => habit(index + 1, period, NAMES[period]))

async function seed(page: Page, followClock: boolean) {
  await seedUser(page, { followClock })
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: HABITS_KEY,
    value: HABITS,
  })
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
}

/** The period the app should be following, read from the page's own clock. */
function clockPeriod(page: Page): Promise<Period> {
  return page.evaluate(() => {
    const minutes = new Date().getHours() * 60 + new Date().getMinutes()
    // Mirrors periodFromMinutes: morning 05:00–12:00, afternoon 12:00–17:00.
    if (minutes >= 5 * 60 && minutes < 12 * 60) return 'morning' as const
    if (minutes >= 12 * 60 && minutes < 17 * 60) return 'afternoon' as const
    return 'evening' as const
  })
}

const periodTab = (page: Page, period: Period) => page.getByRole('tab', { name: LABELS[period] })

test('with the setting already on, the view follows the clock instead of the all-day list', async ({
  page,
}) => {
  await seed(page, true)

  const expected = await clockPeriod(page)
  await expect(periodTab(page, expected)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'All day' })).toHaveAttribute('aria-selected', 'false')

  // Only the current part of the day is on screen.
  await expect(page.getByText(NAMES[expected])).toBeVisible()
  for (const other of PERIODS.filter((period) => period !== expected)) {
    await expect(page.getByText(NAMES[other])).toBeHidden()
  }
})

test('switching it on from the all-day list moves to the current period', async ({ page }) => {
  await seed(page, false)
  await expect(page.getByRole('tab', { name: 'All day' })).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: /Habits & Tasks/ }).click()
  await page.getByRole('switch', { name: 'Follow the clock' }).click()
  await page.getByRole('button', { name: 'Back to settings' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()

  const expected = await clockPeriod(page)
  await expect(periodTab(page, expected)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText(NAMES[expected])).toBeVisible()

  // The move is announced, and Undo returns to the all-day list.
  await expect(page.getByText(/Following the clock\./)).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('tab', { name: 'All day' })).toHaveAttribute('aria-selected', 'true')
})
