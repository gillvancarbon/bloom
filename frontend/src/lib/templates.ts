import type { HabitInput } from '../types'

export interface HabitTemplate extends HabitInput {
  /** Short blurb shown under the template name. */
  blurb: string
  /**
   * A gentle starting point for a first habit. Purely presentational: callers
   * may group and label these first, but every template remains selectable.
   */
  suggested?: boolean
}

/** How many templates we suggest starting with. */
export const MAX_SUGGESTED_TEMPLATES = 3

/**
 * Split templates into the small suggested group and everything else, keeping
 * the original order within each group. Never hides a template.
 */
export function groupTemplates(templates: HabitTemplate[] = HABIT_TEMPLATES): {
  suggested: HabitTemplate[]
  others: HabitTemplate[]
} {
  return {
    suggested: templates.filter((template) => template.suggested),
    others: templates.filter((template) => !template.suggested),
  }
}

/**
 * Gentle starting points for the first-run experience. Intentionally broad so
 * a new user can pick two or three and feel at home immediately.
 */
export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    name: 'Move your body',
    timeOfDay: 'morning',
    blurb: 'A walk, a stretch, anything that counts.',
    colorIndex: 0,
    deadline: '21:00',
    category: 'Health',
    schedule: { type: 'daily' },
    suggested: true,
  },
  {
    name: 'Read for 10 minutes',
    timeOfDay: 'evening',
    blurb: 'A few pages before the day ends.',
    colorIndex: 1,
    deadline: '23:00',
    category: 'Mind',
    schedule: { type: 'daily' },
    suggested: true,
  },
  {
    name: 'Practise a skill',
    timeOfDay: 'afternoon',
    blurb: 'Deliberate practice, big or small.',
    colorIndex: 2,
    deadline: '23:59',
    category: 'Growth',
    schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] },
  },
  {
    name: 'Tidy for 5 minutes',
    timeOfDay: 'evening',
    blurb: 'A quick reset so tomorrow feels calm.',
    colorIndex: 0,
    deadline: '22:00',
    category: 'Home',
    schedule: { type: 'daily' },
    suggested: true,
  },
  {
    name: 'Go to bed on time',
    timeOfDay: 'evening',
    blurb: 'Wind down at your bedtime.',
    colorIndex: 1,
    deadline: '23:00',
    category: 'Health',
    schedule: { type: 'daily' },
  },
  {
    name: 'Call someone you love',
    timeOfDay: 'evening',
    blurb: 'Three times a week is plenty.',
    colorIndex: 2,
    deadline: '20:00',
    category: 'Connection',
    schedule: { type: 'weekly', perWeek: 3 },
  },
  {
    name: 'Journal one line',
    timeOfDay: 'evening',
    blurb: 'A sentence about the day.',
    colorIndex: 0,
    deadline: '23:30',
    category: 'Mind',
    schedule: { type: 'daily' },
  },
  {
    name: 'Step outside',
    timeOfDay: 'afternoon',
    blurb: 'Fresh air, even briefly.',
    colorIndex: 1,
    deadline: '18:00',
    category: 'Health',
    schedule: { type: 'daily' },
  },
  {
    name: 'Drink more water',
    timeOfDay: 'anytime',
    blurb: 'Sip through the day — no set time.',
    colorIndex: 2,
    deadline: '23:59',
    category: 'Health',
    schedule: { type: 'daily' },
  },
]
