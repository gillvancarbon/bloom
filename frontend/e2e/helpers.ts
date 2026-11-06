import { expect, type Page } from '@playwright/test'
import type { Settings, Todo } from '../src/types'

const SETTINGS_KEY = 'CapacitorStorage.bloom.settings.v1'
const TODOS_KEY = 'CapacitorStorage.bloom.todos.v1'

/** A complete on-device settings blob for a returning user. */
export function userSettings(overrides: Partial<Settings> = {}): Partial<Settings> {
  return {
    schemaVersion: 2,
    onboarded: true,
    termsAcceptedAt: '2026-11-01T09:00:00.000Z',
    notificationsEnabled: false,
    ...overrides,
  }
}

/** Clear the device store, seed settings, and wait for the app shell. */
export async function seedUser(page: Page, overrides: Partial<Settings> = {}): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ({ key, settings }) => {
      localStorage.clear()
      localStorage.setItem(key, JSON.stringify(settings))
    },
    { key: SETTINGS_KEY, settings: userSettings(overrides) },
  )
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
}

/** Seed tasks straight into the local store (used for deterministic dates). */
export async function seedTodos(page: Page, todos: Todo[]): Promise<void> {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: TODOS_KEY,
    value: todos,
  })
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Main sections' })).toBeVisible()
}

export function todo(overrides: Partial<Todo> & Pick<Todo, 'id' | 'title'>): Todo {
  return {
    note: null,
    category: 'personal',
    done: false,
    dueDate: null,
    dueTime: null,
    importance: 'medium',
    recurrence: 'none',
    subtasks: [],
    archived: false,
    createdAt: '2026-11-01T09:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

/** Open the To-do tab from the bottom navigation. */
export async function openTodos(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'To-do' }).click()
  await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible()
}
