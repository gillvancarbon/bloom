import { describe, expect, it } from 'vitest'
import { buildDiagnostics, diagnosticsToJson } from './diagnostics'

const INPUT = {
  dataMode: 'local',
  habitCount: 3,
  todoCount: 5,
  nativeNotifications: true,
  remindersEnabled: true,
  notificationPermission: 'granted',
}

describe('buildDiagnostics', () => {
  it('captures versions, counts and environment', () => {
    const diagnostics = buildDiagnostics(INPUT, new Date('2026-11-06T10:00:00.000Z'), {
      platform: 'android',
      locale: 'en-GB',
      timeZone: 'Europe/London',
      userAgent: 'TestAgent',
    })

    expect(diagnostics).toMatchObject({
      app: 'Bloom',
      appVersion: expect.any(String),
      schemaVersion: expect.any(Number),
      settingsSchemaVersion: expect.any(Number),
      generatedAt: '2026-11-06T10:00:00.000Z',
      platform: 'android',
      locale: 'en-GB',
      timeZone: 'Europe/London',
      userAgent: 'TestAgent',
      dataMode: 'local',
      habitCount: 3,
      todoCount: 5,
      notificationPermission: 'granted',
    })
  })

  it('never includes habit or task content', () => {
    const json = diagnosticsToJson(buildDiagnostics(INPUT, new Date(), { platform: 'web' }))
    const parsed = JSON.parse(json)
    expect(parsed).not.toHaveProperty('habits')
    expect(parsed).not.toHaveProperty('todos')
    expect(json).not.toContain('title')
  })
})
