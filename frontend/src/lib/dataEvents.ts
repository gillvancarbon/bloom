/**
 * A tiny in-app bus for "the stored data changed outside React" — e.g. a
 * notification action (Complete) or the home-screen widget ticking something
 * off. Data hooks subscribe and reload so the open screen never shows stale
 * rows.
 */

const EVENT = 'bloom:data-changed'

export function notifyDataChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENT))
}

export function onDataChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}
