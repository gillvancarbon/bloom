import { describe, expect, it } from 'vitest'
import {
  applyQuickSuggestion,
  parseQuickAdd,
  quickAddCommand,
  quickAddRecommendations,
  quickAddSuggestions,
} from './quickAdd'

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

  it('understands "every <weekday>" as a weekly repeat', () => {
    expect(parseQuickAdd('water plants every monday', NOW)).toMatchObject({
      title: 'water plants',
      recurrence: 'weekly',
      dueDate: '2026-11-09',
    })
  })
})

describe('quickAddSuggestions', () => {
  it('completes date words, weekdays and phrases while typing', () => {
    expect(quickAddSuggestions('call mum to').map((s) => s.label)).toEqual(
      expect.arrayContaining(['today', 'tonight', 'tomorrow']),
    )
    expect(quickAddSuggestions('gym fri').map((s) => s.label)).toContain('friday')
    expect(quickAddSuggestions('review next t').map((s) => s.label)).toEqual(
      expect.arrayContaining(['next tuesday', 'next thursday']),
    )
    expect(quickAddSuggestions('trip in ').map((s) => s.label)).toEqual(['in 3 days', 'in 2 weeks'])
    expect(quickAddSuggestions('water every ').map((s) => s.label)).toEqual([
      'every day',
      'every week',
      'every month',
    ])
  })

  it('offers categories, priorities and the /help command', () => {
    expect(quickAddSuggestions('buy milk #wo').map((s) => s.label)).toEqual(['#work'])
    expect(quickAddSuggestions('fix it !h').map((s) => s.label)).toEqual(['!high'])
    expect(quickAddSuggestions('/').map((s) => s.label)).toEqual(['/help'])
  })

  it('stays quiet for complete or unknown tokens', () => {
    expect(quickAddSuggestions('Read one chapter')).toEqual([])
    expect(quickAddSuggestions('grab a tomato')).toEqual([])
    expect(quickAddSuggestions('tomorrow')).toEqual([])
    expect(quickAddSuggestions('/help')).toEqual([])
  })
})

describe('quickAddCommand', () => {
  it('recognises /help only when it stands alone', () => {
    expect(quickAddCommand('/help')).toBe('help')
    expect(quickAddCommand('  /HELP  ')).toBe('help')
    expect(quickAddCommand('/helper')).toBeNull()
    expect(quickAddCommand('/help call mum')).toBeNull()
    expect(quickAddCommand('call mum tomorrow')).toBeNull()
  })
})

describe('quickAddRecommendations', () => {
  it('suggests a type from a keyword', () => {
    expect(
      quickAddRecommendations(parseQuickAdd('Gym session', NOW)!).map((s) => s.insert),
    ).toEqual(['#health'])
    expect(
      quickAddRecommendations(parseQuickAdd('Email the client', NOW)!).map((s) => s.insert),
    ).toEqual(['#work'])
  })

  it('suggests a priority from a keyword', () => {
    expect(quickAddRecommendations(parseQuickAdd('Fix urgent bug', NOW)!)).toEqual([
      { label: '!high', insert: '!high', kind: 'priority' },
    ])
    expect(
      quickAddRecommendations(parseQuickAdd('Maybe repaint', NOW)!).map((s) => s.insert),
    ).toEqual(['!low'])
  })

  it('offers a day when a time was given without one', () => {
    expect(
      quickAddRecommendations(parseQuickAdd('call mum at 9:30am', NOW)!).map((s) => s.insert),
    ).toEqual(['today', 'tomorrow'])
  })

  it('never recommends a value the sentence already set', () => {
    expect(quickAddRecommendations(parseQuickAdd('Gym #health !high tomorrow', NOW)!)).toEqual([])
    expect(quickAddRecommendations(parseQuickAdd('Read a chapter', NOW)!)).toEqual([])
  })
})

describe('applyQuickSuggestion', () => {
  it('completes a partial token or appends a new one', () => {
    expect(applyQuickSuggestion('call mum to', 'tomorrow')).toBe('call mum tomorrow')
    expect(applyQuickSuggestion('file taxes #wo', '#work')).toBe('file taxes #work')
    expect(applyQuickSuggestion('water every mon', 'every monday')).toBe('water every monday')
    expect(applyQuickSuggestion('buy milk', '#errands')).toBe('buy milk #errands')
    expect(applyQuickSuggestion('', 'call mum tomorrow 6pm')).toBe('call mum tomorrow 6pm')
  })
})

describe('QUICK_ADD_HELP examples', () => {
  // Every example the guide advertises must actually be understood.
  const withTitle = (insert: string) => parseQuickAdd(`sample ${insert}`, NOW)

  it('understands each date example', () => {
    const dates: Record<string, string> = {
      today: '2026-11-04',
      tonight: '2026-11-04',
      tomorrow: '2026-11-05',
      friday: '2026-11-06',
      'next friday': '2026-11-13',
      'in 3 days': '2026-11-07',
      'in 2 weeks': '2026-11-18',
      '10/11': '2026-11-10',
    }
    for (const [insert, due] of Object.entries(dates)) {
      expect(withTitle(insert)?.dueDate, insert).toBe(due)
    }
  })

  it('understands each time example', () => {
    const times: Record<string, string> = {
      'at 5pm': '17:00',
      'at 5:30pm': '17:30',
      '17:30': '17:30',
      noon: '12:00',
      midnight: '00:00',
    }
    for (const [insert, time] of Object.entries(times)) {
      expect(withTitle(insert)?.dueTime, insert).toBe(time)
    }
  })

  it('understands each priority and type example', () => {
    const priorities = [
      ['!high', 'high'],
      ['!medium', 'medium'],
      ['!low', 'low'],
    ] as const
    for (const [insert, importance] of priorities) {
      expect(withTitle(insert)?.importance, insert).toBe(importance)
    }
    const categories = ['chores', 'schoolwork', 'work', 'personal', 'health', 'errands'] as const
    for (const category of categories) {
      expect(withTitle(`#${category}`)?.category).toBe(category)
    }
  })

  it('understands each repeat example', () => {
    const repeats = [
      ['every day', 'daily'],
      ['every week', 'weekly'],
      ['every month', 'monthly'],
      ['every monday', 'weekly'],
    ] as const
    for (const [insert, recurrence] of repeats) {
      expect(withTitle(insert)?.recurrence, insert).toBe(recurrence)
    }
  })
})
