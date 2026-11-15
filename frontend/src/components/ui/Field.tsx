/**
 * Shared form-field styling, kept in one place so every input, select and
 * textarea across the app matches. The look is deliberately quiet: a soft
 * filled surface with a hairline edge that warms to sage on focus, rather than
 * a heavy outlined box.
 */

/** Text inputs and textareas. */
export const FIELD_INPUT =
  'w-full rounded-calm-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-ink ' +
  'placeholder:text-muted transition-colors duration-calm ease-calm ' +
  'focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/25'

/** The same surface with room on the left for a leading glyph. */
export const FIELD_INPUT_ICON =
  'w-full rounded-calm-sm border border-line bg-surface py-2.5 pl-9 pr-3.5 text-sm text-ink ' +
  'placeholder:text-muted transition-colors duration-calm ease-calm ' +
  'focus:border-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-400/25'

/** Native select styled to match the inputs, with a drawn chevron. */
export const FIELD_SELECT = FIELD_INPUT + ' cursor-pointer appearance-none pr-8'

/**
 * Shared chevron for native selects, inline as a data URI. The stroke is the
 * muted ink (`--muted`, 95 110 95); keep it in one place so every select draws
 * the same glyph instead of three near-miss copies.
 */
export const SELECT_CHEVRON = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235f6e5f' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.6rem center',
} as const

/** A field label. */
export const FIELD_LABEL = 'mb-1.5 block text-sm font-medium text-ink'

/** The small helper line under a field. */
export const FIELD_HINT = 'mt-1.5 text-xs leading-relaxed text-muted'
