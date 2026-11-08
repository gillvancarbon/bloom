/**
 * Opt-in, gentle feedback for a tap or a completion.
 *
 * Bloom deliberately stays quiet: nothing here runs unless the caller opts in,
 * and every branch is a safe no-op on the web or in tests. `tap` gives a short
 * vibration when haptics are enabled; `celebrate` publishes a tiny window event
 * so a mounted component can animate — it never touches the DOM itself.
 */

export type CelebrationKind = 'habit' | 'task' | 'milestone'

export interface FeedbackOptions {
  haptics: boolean
  celebrations: boolean
  /**
   * Overrides the OS "reduce motion" preference. When omitted, the preference
   * is read lazily from `window.matchMedia`.
   */
  reducedMotion?: boolean
}

/** Haptic length for a light tap, in milliseconds. */
const TAP_MS = 10

/** The window event `celebrate` dispatches for an animating component. */
export const CELEBRATE_EVENT = 'bloom:celebrate'

/** Read the OS reduce-motion preference, safely, on any host. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function reducedMotion(opts: FeedbackOptions): boolean {
  return opts.reducedMotion ?? prefersReducedMotion()
}

/**
 * A short vibration for a tap. No-op when haptics are off, when reduced motion
 * is on, when there is no vibrator, or when the call is refused — it never
 * throws.
 */
export function tap(opts: FeedbackOptions): void {
  if (!opts.haptics || reducedMotion(opts)) return
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(TAP_MS)
  } catch {
    /* Device without a vibrator, or a blocked call — stay quiet. */
  }
}

/**
 * Announce a completion so a component can celebrate it. Dispatches the
 * {@link CELEBRATE_EVENT} window event with `{ kind }` when celebrations are on
 * and motion is allowed; otherwise it does nothing at all.
 */
export function celebrate(opts: FeedbackOptions, kind: CelebrationKind = 'habit'): void {
  if (!opts.celebrations || reducedMotion(opts)) return
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  if (typeof CustomEvent !== 'function') return
  try {
    window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { kind } }))
  } catch {
    /* A host without CustomEvent support — stay quiet. */
  }
}
