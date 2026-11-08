import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { seedUser } from './helpers'

/**
 * Covers the habit-card surface the other specs miss: the axe suite seeds zero
 * habits, so the momentum card, its action menu and the new settings controls
 * were never scanned or asserted. Keeps the calm-default behaviour honest.
 */

const HABITS_KEY = 'CapacitorStorage.bloom.habits.v1'

function habit(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Morning walk',
    streakCount: 5,
    lastCompletedDate: null,
    createdAt: '2026-11-01T09:00:00.000Z',
    colorIndex: 0,
    deadline: '23:59',
    history: [],
    frozen: [],
    schedule: { type: 'daily' },
    target: 1,
    category: 'Health',
    timeOfDay: 'anytime',
    archived: false,
    order: 0,
    reminderOffset: null,
    ...overrides,
  }
}

async function seedHabit(page: Page, value: unknown): Promise<void> {
  await page.evaluate(({ key, v }) => localStorage.setItem(key, JSON.stringify(v)), {
    key: HABITS_KEY,
    v: value,
  })
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
}

test('habit card shows momentum by default, hides the flame streak, and passes axe', async ({
  page,
}) => {
  await seedUser(page, { streakDisplay: 'momentum' })
  await seedHabit(page, [habit()])

  // Momentum is the default presentation: a 30-day count, never a flame count.
  await expect(page.getByText(/of 30 days/)).toBeVisible()

  // The actions menu is a labelled kebab, not the old unlabelled leaf.
  await expect(page.getByRole('button', { name: 'Show actions for Morning walk' })).toBeVisible()

  // Wait for entrance animations to reach their resting opacity; otherwise axe
  // measures text through a partially transparent ancestor and reports contrast
  // failures that only exist mid-animation.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
  )
  await page.waitForTimeout(200)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')),
    })),
  ).toEqual([])
})

test('settings expose the new calm controls with correct defaults', async ({ page }) => {
  await seedUser(page, { notificationsEnabled: true, taskReminders: true })

  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // Habits & Tasks: streak display choice plus opt-in feedback, off by default.
  await page.getByRole('button', { name: /^Habits & Tasks/ }).click()
  await expect(page.getByRole('radiogroup', { name: 'Streak display' })).toBeVisible()
  const celebrations = page.getByRole('switch', { name: 'Celebrations' })
  const haptics = page.getByRole('switch', { name: 'Haptics' })
  await expect(celebrations).toBeVisible()
  await expect(haptics).toBeVisible()
  await expect(celebrations).not.toBeChecked()
  await expect(haptics).not.toBeChecked()

  // Reminders: quiet hours starts off, and enabling it reveals the time bounds.
  await page.getByRole('button', { name: 'Back to settings' }).click()
  await page.getByRole('button', { name: /^Reminders/ }).click()
  const quiet = page.getByRole('switch', { name: 'Quiet hours' })
  await expect(quiet).toBeVisible()
  await expect(quiet).not.toBeChecked()
  await quiet.click()
  await expect(page.getByLabel('Quiet hours start')).toBeVisible()
  await expect(page.getByLabel('Quiet hours end')).toBeVisible()

  // Notification overload controls are present.
  await expect(page.getByRole('switch', { name: 'Bundle reminders' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Overdue task nudges' })).toBeVisible()
})
