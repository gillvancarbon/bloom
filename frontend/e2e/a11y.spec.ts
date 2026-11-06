import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openTodos, seedUser } from './helpers'

/**
 * Automated accessibility checks for the screens a user spends time on.
 * Colour contrast is included; the suite fails on any WCAG 2.0/2.1 A or AA
 * violation so regressions are caught before release.
 */
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
}

async function expectClean(page: Page) {
  // Let entrance/fade animations reach their resting opacity; otherwise axe
  // measures text through a partially transparent ancestor.
  await page.waitForTimeout(700)
  const results = await scan(page)
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({
        target: node.target.join(' '),
        detail: node.failureSummary,
      })),
    })),
  ).toEqual([])
}

test('accessibility: first-run terms gate', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Terms of Use' })).toBeVisible()
  await expectClean(page)
})

test('accessibility: habits and tasks', async ({ page }) => {
  await seedUser(page)
  await expectClean(page)

  await openTodos(page)
  await expectClean(page)
})

test('accessibility: settings, guide and about', async ({ page }) => {
  await seedUser(page)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expectClean(page)

  await page.getByRole('button', { name: 'Open guide' }).click()
  await expect(page.getByRole('dialog', { name: 'How to use Bloom' })).toBeVisible()
  await expectClean(page)
  await page.getByRole('button', { name: 'Close guide' }).click()

  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'About Bloom' })).toBeVisible()
  await expectClean(page)
})

test('accessibility: dark mode', async ({ page }) => {
  await seedUser(page)
  await page.evaluate(() => localStorage.setItem('bloom-theme', 'dark'))
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
  await expectClean(page)

  await openTodos(page)
  await expectClean(page)

  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expectClean(page)
})

test('accessibility: keyboard focus is always visible', async ({ page }) => {
  await seedUser(page)

  // Tab into the shell; the focused control must paint the focus ring.
  await page.keyboard.press('Tab')
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element)
    return { color: style.outlineColor, width: style.outlineWidth, style: style.outlineStyle }
  })
  expect(ring.style).toBe('solid')
  expect(ring.width).toBe('2px')
  expect(ring.color).not.toBe('rgba(0, 0, 0, 0)')
})
