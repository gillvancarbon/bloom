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
})
