import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAdd'

// A Wednesday, so weekday maths is easy to reason about.
const NOW = new Date(2026, 10, 4, 9, 0, 0)

describe('parseQuickAdd', () => {
  it('returns a bare title when there is nothing to parse', () => {
    expect(parseQuickAdd('Read one chapter', NOW)).toMatchObject({
      title: 'Read one chapter',
      dueDate: null,
      dueTime: null,
      importance: 'medium',
      category: 'personal',
      recurrence: 'none',
    })
  })

  it('parses tomorrow and a 12-hour time', () => {
    expect(parseQuickAdd('Call mum tomorrow 6pm', NOW)).toMatchObject({
      title: 'Call mum',
      dueDate: '2026-11-05',
      dueTime: '18:00',
    })
  })

  it('understands "at" times and 24-hour times', () => {
    expect(parseQuickAdd('Standup at 9:30am', NOW)).toMatchObject({
      title: 'Standup',
      dueTime: '09:30',
      dueDate: null,
    })
    expect(parseQuickAdd('Deploy 17:45', NOW)).toMatchObject({
      title: 'Deploy',
      dueTime: '17:45',
    })
  })

  it('uses today for today/tonight and gives tonight an evening time', () => {
    expect(parseQuickAdd('Pay the rent today', NOW)?.dueDate).toBe('2026-11-04')
    const tonight = parseQuickAdd('Water plants tonight', NOW)
    expect(tonight).toMatchObject({
      title: 'Water plants',
      dueDate: '2026-11-04',
      dueTime: '20:00',
    })
  })

  it('resolves weekdays and next weekdays', () => {
    expect(parseQuickAdd('Gym friday', NOW)?.dueDate).toBe('2026-11-06')
    expect(parseQuickAdd('Review next tuesday', NOW)?.dueDate).toBe('2026-11-17')
  })

  it('parses relative, ISO and day/month dates', () => {
    expect(parseQuickAdd('Relax in 3 days', NOW)?.dueDate).toBe('2026-11-07')
    expect(parseQuickAdd('Trip in 2 weeks', NOW)?.dueDate).toBe('2026-11-18')
    expect(parseQuickAdd('Renew passport 2027-01-09', NOW)).toMatchObject({
      title: 'Renew passport',
      dueDate: '2027-01-09',
    })
    expect(parseQuickAdd('Dentist 10/11', NOW)?.dueDate).toBe('2026-11-10')
    expect(parseQuickAdd('Concert 10 nov', NOW)?.dueDate).toBe('2026-11-10')
  })

  it('parses priority, category and recurrence tokens', () => {
    expect(parseQuickAdd('Fix the tap !high', NOW)).toMatchObject({
      title: 'Fix the tap',
      importance: 'high',
    })
    expect(parseQuickAdd('File taxes !!!', NOW)?.importance).toBe('high')
    expect(parseQuickAdd('Email the lab !low', NOW)?.importance).toBe('low')
    expect(parseQuickAdd('Buy stamps #errands', NOW)).toMatchObject({
      title: 'Buy stamps',
      category: 'errands',
    })
    expect(parseQuickAdd('Water plants every day', NOW)).toMatchObject({
      title: 'Water plants',
      recurrence: 'daily',
      dueDate: '2026-11-04',
    })
  })

  it('keeps unknown hash words in the title', () => {
    expect(parseQuickAdd('Ship #bloom release', NOW)?.title).toBe('Ship #bloom release')
  })

  it('returns null when only tokens remain', () => {
    expect(parseQuickAdd('tomorrow 5pm', NOW)).toBeNull()
  })
})
