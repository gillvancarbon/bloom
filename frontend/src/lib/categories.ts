/**
 * Shared category suggestions.
 *
 * Habits keep a free-text category, so these are only soft prompts: the list
 * spans habit-flavoured groups and the fixed to-do types in `lib/todo.ts`.
 */
export const CATEGORY_SUGGESTIONS = [
  'Health',
  'Mind',
  'Growth',
  'Home',
  'Work',
  'Connection',
  'General',
  'Chores',
  'Errands',
] as const
