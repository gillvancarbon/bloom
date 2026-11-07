import { expect, test } from '@playwright/test'
import { openTodos, seedTodos, seedUser, todo } from './helpers'

/** A local-date "YYYY-MM-DD" relative to today. */
function isoOffset(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

test('screen readers are told when a task is completed', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [todo({ id: 1, title: 'Pay rent', dueDate: isoOffset(0) })])
  await openTodos(page)

  await page.getByRole('button', { name: 'Mark Pay rent complete' }).click()
  await expect(page.getByRole('status').filter({ hasText: '“Pay rent” completed.' })).toBeAttached()

  await page.getByRole('button', { name: 'Mark Pay rent as not done' }).click()
  await expect(page.getByRole('status').filter({ hasText: '“Pay rent” reopened.' })).toBeAttached()
})

test('first run: terms gate cannot be escaped, then the tour can be skipped', async ({ page }) => {
  await page.goto('/')

  const terms = page.getByRole('dialog', { name: 'Terms of Use' })
  await expect(terms).toBeVisible()

  // Escape is deliberately inert on the gate.
  await page.keyboard.press('Escape')
  await expect(terms).toBeVisible()

  await page.getByRole('checkbox').check({ force: true })
  await page.getByRole('button', { name: 'Agree and continue' }).click()

  await expect(page.getByRole('dialog', { name: 'Welcome to Bloom' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip' }).click()

  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add habit' })).toBeVisible()
})

test('habits: create a habit and check it off', async ({ page }) => {
  await seedUser(page)

  await page.getByRole('button', { name: 'Add habit' }).click()
  const form = page.getByRole('dialog', { name: 'New habit' })
  await form.getByLabel('Habit name').fill('Read for 10 minutes')
  await form.getByRole('button', { name: 'Create habit' }).click()

  await expect(page.getByText('Read for 10 minutes')).toBeVisible()

  await page.getByRole('button', { name: 'Mark Read for 10 minutes complete today' }).click()
  await expect(
    page.getByRole('button', { name: "Undo today's completion for Read for 10 minutes" }),
  ).toBeVisible()
})

test('quick add: a sentence is previewed and added', async ({ page }) => {
  await seedUser(page)
  await openTodos(page)

  const input = page.getByLabel('Quick add a task')
  await input.fill('call mum tomorrow 6pm')
  await expect(page.getByText(/Tomorrow/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(page.getByRole('status').filter({ hasText: 'Added “call mum”.' })).toBeAttached()

  await page.getByRole('tab', { name: /^All/ }).click()
  await expect(page.getByRole('heading', { name: 'call mum' })).toBeVisible()
})

test('quick add: /help opens the guide and an example fills the line', async ({ page }) => {
  await seedUser(page)
  await openTodos(page)

  const input = page.getByLabel('Quick add a task')
  await input.fill('/help')

  await expect(page.getByRole('region', { name: 'Quick add guide' })).toBeVisible()
  await page.getByRole('button', { name: /file taxes #work !high/ }).click()

  await expect(input).toHaveValue('file taxes #work !high')
  await expect(page.getByRole('region', { name: 'Quick add guide' })).toBeHidden()

  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('tab', { name: /^All/ }).click()
  await expect(page.getByRole('heading', { name: 'file taxes' })).toBeVisible()
})

test('repeating task: completing it rolls it forward instead of finishing it', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [
    todo({ id: 1, title: 'Water plants', dueDate: isoOffset(0), recurrence: 'daily' }),
  ])
  await openTodos(page)

  await page.getByRole('button', { name: 'Mark Water plants complete' }).click()

  await page.getByRole('tab', { name: /^All/ }).click()
  await expect(page.getByRole('heading', { name: 'Water plants' })).toBeVisible()
  await expect(page.getByText('Tomorrow').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Water plants complete' })).toBeVisible()
})

test('views: Today, Upcoming and Anytime hold the right tasks', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [
    todo({ id: 1, title: 'Pay rent', dueDate: isoOffset(0) }),
    todo({ id: 2, title: 'Book dentist', dueDate: isoOffset(3) }),
    todo({ id: 3, title: 'Read notes' }),
  ])
  await openTodos(page)

  await expect(page.getByRole('heading', { name: 'Pay rent' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Book dentist' })).toBeHidden()

  await page.getByRole('tab', { name: /^Upcoming/ }).click()
  await expect(page.getByRole('heading', { name: 'Book dentist' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pay rent' })).toBeHidden()

  await page.getByRole('tab', { name: /^Anytime/ }).click()
  await expect(page.getByRole('heading', { name: 'Read notes' })).toBeVisible()
})

test('quick add guidance can be switched off without losing /help', async ({ page }) => {
  await seedUser(page, { quickAddGuidance: false })
  await openTodos(page)

  const input = page.getByLabel('Quick add a task')
  await input.click()
  await expect(page.getByText('Try a whole sentence:')).toBeHidden()

  await input.fill('buy milk')
  await expect(page.getByText('Suggested:')).toBeHidden()

  await input.fill('/help')
  await expect(page.getByRole('region', { name: 'Quick add guide' })).toBeVisible()
})

test('settings: reminder self-check works and the guidance switch persists', async ({
  page,
  context,
}) => {
  // Headless Chromium on CI has no Notification constructor, so stub a
  // granted, working one to exercise the app's own success path.
  await page.addInitScript(() => {
    class FakeNotification {
      static permission = 'granted'
      static requestPermission = () => Promise.resolve('granted')
      constructor() {}
    }
    // @ts-expect-error test stub
    window.Notification = FakeNotification
  })
  await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:4173' })
  await seedUser(page, { notificationsEnabled: true })

  await page.getByRole('button', { name: 'Open settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: /^Reminders/ }).click()
  await expect(page.getByRole('heading', { name: 'Reminders' })).toBeVisible()
  await expect(page.getByText(/Reminders only fire while this tab stays open/)).toBeVisible()
  await page.getByRole('button', { name: 'Send test' }).click()
  await expect(page.getByText(/Test sent/)).toBeVisible()

  await page.getByRole('button', { name: 'Back to settings' }).click()
  await page.getByRole('button', { name: /^Habits & Tasks/ }).click()
  await page.getByRole('switch', { name: 'Quick add guidance' }).click()
  await page.getByRole('button', { name: 'Back to settings' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()

  await openTodos(page)
  await page.getByLabel('Quick add a task').click()
  await expect(page.getByText('Try a whole sentence:')).toBeHidden()
})

test('bulk actions: complete several tasks at once', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [
    todo({ id: 1, title: 'Alpha', dueDate: isoOffset(0) }),
    todo({ id: 2, title: 'Beta', dueDate: isoOffset(0) }),
    todo({ id: 3, title: 'Gamma', dueDate: isoOffset(0) }),
  ])
  await openTodos(page)

  await page.getByRole('button', { name: 'Select tasks' }).click()
  await page.getByRole('checkbox', { name: 'Select Alpha' }).click()
  await page.getByRole('checkbox', { name: 'Select Beta' }).click()
  await page.getByRole('button', { name: 'Complete', exact: true }).click()

  await expect(page.getByRole('status').filter({ hasText: '2 tasks completed.' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Mark Alpha as not done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Beta as not done' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Gamma complete' })).toBeVisible()
})

test('manual order: tasks can be reordered and the order sticks', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [
    todo({
      id: 1,
      title: 'First in line',
      dueDate: isoOffset(0),
      createdAt: '2026-11-02T09:00:00.000Z',
    }),
    todo({
      id: 2,
      title: 'Second in line',
      dueDate: isoOffset(0),
      createdAt: '2026-11-01T09:00:00.000Z',
    }),
  ])
  await openTodos(page)

  await page.getByLabel('Sort tasks').selectOption('manual')
  await page.getByRole('button', { name: 'Move First in line down' }).click()

  const order = await page.getByRole('heading', { level: 3 }).allTextContents()
  expect(order.indexOf('Second in line')).toBeLessThan(order.indexOf('First in line'))

  await page.reload()
  await openTodos(page)
  const afterReload = await page.getByRole('heading', { level: 3 }).allTextContents()
  expect(afterReload.indexOf('Second in line')).toBeLessThan(afterReload.indexOf('First in line'))
})

test('long lists mount a page at a time', async ({ page }) => {
  // Force the fallback control so the test is deterministic rather than racing
  // the intersection observer that normally grows the window on scroll.
  await page.addInitScript(() => {
    // @ts-expect-error deliberately removed for the test
    window.IntersectionObserver = undefined
  })

  await seedUser(page)
  const many = Array.from({ length: 40 }, (_, i) =>
    todo({ id: i + 1, title: `Task ${i + 1}`, dueDate: isoOffset(0) }),
  )
  await seedTodos(page, many)
  await openTodos(page)

  const shown = () => page.getByRole('heading', { level: 3 }).count()
  expect(await shown()).toBe(30)
  await expect(page.getByRole('button', { name: /Show more \(10 left\)/ })).toBeVisible()

  await page.getByRole('button', { name: /Show more/ }).click({ force: true })
  await expect.poll(shown).toBe(40)
})

test('import: a valid snapshot restores tasks', async ({ page }) => {
  await seedUser(page)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: /^Data & backups/ }).click()

  const bundle = {
    app: 'Bloom',
    schemaVersion: 1,
    exportedAt: '2026-11-01T09:00:00.000Z',
    habits: [],
    todos: [todo({ id: 90, title: 'Imported task', dueDate: isoOffset(0) })],
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bloom.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  })

  const confirmDialog = page.getByRole('alertdialog', { name: /Import this file/ })
  await expect(confirmDialog).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Import', exact: true }).click()

  await page.getByRole('button', { name: 'Back to settings' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()
  await openTodos(page)
  await expect(page.getByRole('heading', { name: 'Imported task' })).toBeVisible()
})

test('import: a newer-version file is refused', async ({ page }) => {
  await seedUser(page)
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: /^Data & backups/ }).click()

  const bundle = { app: 'Bloom', schemaVersion: 99, habits: [], todos: [] }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'newer.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  })

  await expect(page.getByText(/newer version of Bloom/)).toBeVisible()
  await expect(page.getByRole('alertdialog', { name: /Import this file/ })).toBeHidden()
})

test('settings: diagnostics download contains counts, not content', async ({ page }) => {
  await seedUser(page)
  await seedTodos(page, [todo({ id: 1, title: 'Secret title', dueDate: isoOffset(0) })])
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('button', { name: /^Data & backups/ }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^bloom-diagnostics-.*\.json$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  const parsed = JSON.parse(text)
  expect(parsed.todoCount).toBe(1)
  expect(parsed).not.toHaveProperty('todos')
  expect(text).not.toContain('Secret title')
})

test('in-app toast surfaces a message published outside React', async ({ page }) => {
  await seedUser(page)

  // Notification actions run outside React; a failure is published on the bus.
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('bloom:toast', {
        detail: { id: 1, text: 'Couldn’t snooze that reminder.', tone: 'error' },
      }),
    )
  })

  await expect(
    page.getByRole('status').filter({ hasText: 'Couldn’t snooze that reminder.' }),
  ).toBeVisible()
})

test('data persists across a reload', async ({ page }) => {
  await seedUser(page)
  await openTodos(page)

  await page.getByLabel('Quick add a task').fill('call mum today')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'call mum' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
  await openTodos(page)

  await expect(page.getByRole('heading', { name: 'call mum' })).toBeVisible()
})
