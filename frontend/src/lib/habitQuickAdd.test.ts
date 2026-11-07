import { describe, expect, it } from 'vitest'
import { parseHabitQuickAdd } from './habitQuickAdd'

// A Wednesday at 09:00, so the default period is "morning".
const NOW = new Date(2026, 10, 4, 9, 0, 0)

describe('parseHabitQuickAdd', () => {
  it('defaults to daily and the current period when nothing is given', () => {
    expect(parseHabitQuickAdd('Meditate', NOW)).toEqual({
      name: 'Meditate',
      schedule: { type: 'daily' },
      timeOfDay: 'morning',
    })
  })

  it('derives the default period from the clock', () => {
    expect(parseHabitQuickAdd('Meditate', new Date(2026, 10, 4, 15, 0, 0))?.timeOfDay).toBe(
      'afternoon',
    )
    expect(parseHabitQuickAdd('Meditate', new Date(2026, 10, 4, 20, 0, 0))?.timeOfDay).toBe(
      'evening',
    )
  })

  it('understands "every day" and "daily"', () => {
    for (const text of ['Meditate every day', 'Meditate daily']) {
      expect(parseHabitQuickAdd(text, NOW)).toMatchObject({
        name: 'Meditate',
        schedule: { type: 'daily' },
      })
    }
  })

  it('understands weekdays', () => {
    for (const text of ['Gym weekdays', 'Gym every weekday']) {
      expect(parseHabitQuickAdd(text, NOW)).toMatchObject({
        name: 'Gym',
        schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
      })
    }
  })

  it('understands weekends', () => {
    for (const text of ['Hike weekends', 'Hike every weekend']) {
      expect(parseHabitQuickAdd(text, NOW)).toMatchObject({
        name: 'Hike',
        schedule: { type: 'weekdays', days: [0, 6] },
      })
    }
  })

  it('understands named weekdays, comma/and separated', () => {
    expect(parseHabitQuickAdd('Gym every mon, wed and fri', NOW)).toMatchObject({
      name: 'Gym',
      schedule: { type: 'weekdays', days: [1, 3, 5] },
    })
    expect(parseHabitQuickAdd('Gym every monday and thursday', NOW)).toMatchObject({
      name: 'Gym',
      schedule: { type: 'weekdays', days: [1, 4] },
    })
    expect(parseHabitQuickAdd('Gym every mon/wed/fri', NOW)).toMatchObject({
      name: 'Gym',
      schedule: { type: 'weekdays', days: [1, 3, 5] },
    })
    // Sorted with Sunday first.
    expect(parseHabitQuickAdd('Walk every sat and sun', NOW)).toMatchObject({
      name: 'Walk',
      schedule: { type: 'weekdays', days: [0, 6] },
    })
  })

  it('understands "N times a week" and clamps it to 1…7', () => {
    for (const text of ['Yoga 3 times a week', 'Yoga 3 x a week', 'Yoga 3 times per week']) {
      expect(parseHabitQuickAdd(text, NOW)).toMatchObject({
        name: 'Yoga',
        schedule: { type: 'weekly', perWeek: 3 },
      })
    }
    expect(parseHabitQuickAdd('Run 9 times a week', NOW)?.schedule).toEqual({
      type: 'weekly',
      perWeek: 7,
    })
    expect(parseHabitQuickAdd('Run 0 times a week', NOW)?.schedule).toEqual({
      type: 'weekly',
      perWeek: 1,
    })
  })

  it('understands each period keyword', () => {
    expect(parseHabitQuickAdd('Stretch in the morning', NOW)?.timeOfDay).toBe('morning')
    expect(parseHabitQuickAdd('Walk in the afternoon', NOW)?.timeOfDay).toBe('afternoon')
    expect(parseHabitQuickAdd('Read every evening', NOW)?.timeOfDay).toBe('evening')
    expect(parseHabitQuickAdd('Journal anytime', NOW)?.timeOfDay).toBe('anytime')
    expect(parseHabitQuickAdd('Water plants afternoon', NOW)?.timeOfDay).toBe('afternoon')
  })

  it('strips the recognised parts and keeps the rest as the name', () => {
    expect(parseHabitQuickAdd('  Water   plants   every day  ', NOW)).toEqual({
      name: 'Water plants',
      schedule: { type: 'daily' },
      timeOfDay: 'morning',
    })
    expect(parseHabitQuickAdd('Stretch in the morning', NOW)?.name).toBe('Stretch')
    expect(parseHabitQuickAdd('Floss every mon and fri evening', NOW)).toEqual({
      name: 'Floss',
      schedule: { type: 'weekdays', days: [1, 5] },
      timeOfDay: 'evening',
    })
  })

  it('returns null when nothing is left as a name', () => {
    expect(parseHabitQuickAdd('', NOW)).toBeNull()
    expect(parseHabitQuickAdd('   ', NOW)).toBeNull()
    expect(parseHabitQuickAdd('every day', NOW)).toBeNull()
    expect(parseHabitQuickAdd('weekdays', NOW)).toBeNull()
    expect(parseHabitQuickAdd('3 times a week', NOW)).toBeNull()
    expect(parseHabitQuickAdd('morning', NOW)).toBeNull()
  })
})
