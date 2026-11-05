import { describe, expect, it } from 'vitest'
import type { Habit } from '../types'
import { normalizeHabit } from './habit'
import {
  bestStreak,
  dailyCompletion,
  dailyStreak,
  insightsSummary,
  milestones,
  weeklyReview,
} from './insights'

function habit(partial: Partial<Habit> & { id: number }): Habit {
  return normalizeHabit({
    name: 'Test habit',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  })
}

const NOW = new Date(2026, 5, 10, 12, 0, 0)

describe('bestStreak', () => {
  it('finds the longest run of consecutive days', () => {
    const h = habit({
      id: 1,
      history: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-05'],
    })
    expect(bestStreak(h)).toBe(3)
  })

  it('is zero for a habit with no history', () => {
    expect(bestStreak(habit({ id: 2 }))).toBe(0)
  })
})

describe('dailyCompletion', () => {
  it('returns one point per day, oldest first', () => {
    const points = dailyCompletion([habit({ id: 3 })], NOW, 7, null)
    expect(points).toHaveLength(7)
    expect(points[6].iso).toBe('2026-06-10')
    expect(points[0].iso).toBe('2026-06-04')
  })

  it('counts how many habits were done each day', () => {
    const done = habit({ id: 4, history: ['2026-06-10'] })
    const notDone = habit({ id: 5, history: [] })
    const points = dailyCompletion([done, notDone], NOW, 3, null)
    const today = points[points.length - 1]
    expect(today.done).toBe(1)
    expect(today.total).toBe(2)
  })
})

describe('dailyStreak', () => {
  it('counts consecutive days where at least one habit was done', () => {
    const a = habit({ id: 10, history: ['2026-06-08', '2026-06-09', '2026-06-10'] })
    const b = habit({ id: 11, history: [] })
    expect(dailyStreak([a, b], NOW, null)).toBe(3)
  })

  it('shows the run ending yesterday when nothing is done today', () => {
    const a = habit({ id: 12, history: ['2026-06-08', '2026-06-09'] })
    expect(dailyStreak([a], NOW, null)).toBe(2)
  })

  it('breaks on a missed day', () => {
    const a = habit({ id: 13, history: ['2026-06-06', '2026-06-08', '2026-06-10'] })
    expect(dailyStreak([a], NOW, null)).toBe(1)
  })

  it('is zero with no completions', () => {
    expect(dailyStreak([habit({ id: 14 })], NOW, null)).toBe(0)
  })

  it('respects the history start', () => {
    const a = habit({ id: 15, history: ['2026-06-08', '2026-06-09', '2026-06-10'] })
    expect(dailyStreak([a], NOW, '2026-06-09')).toBe(2)
  })
})

describe('insightsSummary', () => {
  it('totals completions across every habit', () => {
    const a = habit({ id: 6, history: ['2026-06-08', '2026-06-09', '2026-06-10'] })
    const b = habit({ id: 7, history: ['2026-06-10'] })
    const summary = insightsSummary([a, b], NOW, null, 1)
    expect(summary.totalCompletions).toBe(4)
    expect(summary.bestStreak).toBe(3)
  })

  it('reports a zero rate when there is nothing to do', () => {
    const summary = insightsSummary([], NOW, null, 1)
    expect(summary.weekRate).toBe(0)
    expect(summary.monthRate).toBe(0)
    expect(summary.totalCompletions).toBe(0)
  })
})

describe('weeklyReview', () => {
  it('summarises the week so far', () => {
    const a = habit({ id: 20, history: ['2026-06-08', '2026-06-09', '2026-06-10'] })
    const b = habit({ id: 21, history: ['2026-06-09'] })
    const review = weeklyReview([a, b], NOW, null, 1)
    expect(review.days).toBe(3) // Mon–Wed
    expect(review.activeDays).toBe(3)
    expect(review.completions).toBe(4)
    expect(review.bestDay?.done).toBe(2) // 9 June: both done
  })

  it('is empty for a fresh week', () => {
    const review = weeklyReview([habit({ id: 22 })], NOW, null, 1)
    expect(review.completions).toBe(0)
    expect(review.bestDay).toBeNull()
  })
})

describe('milestones', () => {
  it('awards a badge once the best streak reaches it', () => {
    const week = [
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]
    const badges = milestones(habit({ id: 23, history: week }))
    expect(badges.find((b) => b.id === 'streak-7')?.reached).toBe(true)
    expect(badges.find((b) => b.id === 'streak-30')?.reached).toBe(false)
    expect(badges.find((b) => b.id === 'total-10')?.reached).toBe(false)
  })
})
