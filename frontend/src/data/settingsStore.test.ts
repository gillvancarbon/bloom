import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settingsStore'

describe('normalizeSettings', () => {
  it('fills in defaults for missing fields', () => {
    const settings = normalizeSettings(null)
    expect(settings.reminderSound).toBe('bloom_chime')
    expect(settings.completionSound).toBe('same')
  })

  it('keeps a chosen sound and coerces empty values back to the default', () => {
    expect(normalizeSettings({ reminderSound: 'content://sound/1' }).reminderSound).toBe(
      'content://sound/1',
    )
    expect(normalizeSettings({ reminderSound: '' }).reminderSound).toBe(
      DEFAULT_SETTINGS.reminderSound,
    )
  })

  it('defaults the habit view options and rejects unknown sorts', () => {
    const defaults = normalizeSettings(null)
    expect(defaults.habitSort).toBe('incomplete')
    expect(defaults.hideCompleted).toBe(false)
    expect(defaults.followClock).toBe(false)

    expect(normalizeSettings({ habitSort: 'name' }).habitSort).toBe('name')
    expect(normalizeSettings({ habitSort: 'sideways' as never }).habitSort).toBe('incomplete')
    expect(normalizeSettings({ hideCompleted: true, followClock: true })).toMatchObject({
      hideCompleted: true,
      followClock: true,
    })
  })

  it('defaults the task sort and rejects unknown values', () => {
    expect(normalizeSettings(null).todoSort).toBe('due')
    expect(normalizeSettings({ todoSort: 'importance' }).todoSort).toBe('importance')
    expect(normalizeSettings({ todoSort: 'sideways' as never }).todoSort).toBe('due')
  })

  it('keeps task reminders on by default and honours an explicit off', () => {
    expect(normalizeSettings(null).taskReminders).toBe(true)
    expect(normalizeSettings({ taskReminders: false }).taskReminders).toBe(false)
  })

  it('defaults the newer display and notification preferences', () => {
    const defaults = normalizeSettings(null)
    expect(defaults.streakDisplay).toBe('momentum')
    expect(defaults.celebrations).toBe(false)
    expect(defaults.haptics).toBe(false)
    expect(defaults.quietHoursEnabled).toBe(false)
    expect(defaults.quietHoursStart).toBe('22:00')
    expect(defaults.quietHoursEnd).toBe('07:00')
    expect(defaults.reminderDigest).toBe(false)
    expect(defaults.followClockNotice).toBe(true)
  })

  it('keeps a known streak display and rejects unknown ones', () => {
    expect(normalizeSettings({ streakDisplay: 'flame' }).streakDisplay).toBe('flame')
    expect(normalizeSettings({ streakDisplay: 'hidden' }).streakDisplay).toBe('hidden')
    expect(normalizeSettings({ streakDisplay: 'sparkle' as never }).streakDisplay).toBe('momentum')
  })

  it('accepts a real HH:mm quiet-hours window and falls back otherwise', () => {
    expect(normalizeSettings({ quietHoursStart: '23:30', quietHoursEnd: '06:15' })).toMatchObject({
      quietHoursStart: '23:30',
      quietHoursEnd: '06:15',
    })
    expect(normalizeSettings({ quietHoursStart: '24:00' }).quietHoursStart).toBe('22:00')
    expect(normalizeSettings({ quietHoursEnd: '7:00' as never }).quietHoursEnd).toBe('07:00')
    expect(normalizeSettings({ quietHoursStart: 42 as never }).quietHoursStart).toBe('22:00')
    expect(normalizeSettings({ quietHoursEnd: '' }).quietHoursEnd).toBe('07:00')
  })

  it('honours explicit booleans for the newer toggles', () => {
    expect(
      normalizeSettings({
        celebrations: true,
        haptics: true,
        quietHoursEnabled: true,
        reminderDigest: true,
        followClockNotice: false,
      }),
    ).toMatchObject({
      celebrations: true,
      haptics: true,
      quietHoursEnabled: true,
      reminderDigest: true,
      followClockNotice: false,
    })
  })

  it('only counts a real timestamp as accepted terms', () => {
    expect(normalizeSettings(null).termsAcceptedAt).toBeNull()
    expect(normalizeSettings({ termsAcceptedAt: '' }).termsAcceptedAt).toBeNull()
    expect(normalizeSettings({ termsAcceptedAt: 42 as never }).termsAcceptedAt).toBeNull()
    expect(normalizeSettings({ termsAcceptedAt: '2026-11-06T09:00:00.000Z' }).termsAcceptedAt).toBe(
      '2026-11-06T09:00:00.000Z',
    )
  })
})
